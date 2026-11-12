import { Buffer } from 'node:buffer';
import {
  getAdminEmailUser,
  type AuthenticatedEmailUser,
} from '../email/daily-server.js';
import { dailySunRecipientHash } from '../email/daily-sun-server.js';
import { removeDailySunSegment } from '../email/daily-resend.js';
import {
  AccountEncryptionFailure,
  decryptAccountDailySunAliasLocator,
  decryptAccountDeletionProviderPayload,
  decryptAccountPrivatePayload,
  encryptAccountDeletionProviderPayload,
  type AccountEncryptedEnvelope,
} from './encryption.js';
import {
  accountDeletionRecoveryPreimage,
  accountMutationRequestVerifiers,
} from './mutation-verifier.js';
import {
  parseSerializedAccountPrivateChartPayload,
  serializeAccountPrivateChartPayload,
} from './sync-wire.js';
import {
  ACCOUNT_EXPORT_SCHEMA,
  ACCOUNT_SYNC_V2_EXPORT_SCHEMA,
  type AccountAuthExportV1,
  type AccountSyncV2ExportV1,
  type CompatibilityInviteExportV1,
  type DailyChartPreferenceExportV1,
  type LegacyChartDeletionExportV1,
  type LegacyChartExportV1,
  type LegacyProfileExportV1,
  type ZodiacsAccountExportV1,
} from './types.js';
import { isAccountUuid } from './request.js';

type Environment = Record<string, unknown>;
type Fetch = typeof fetch;

const MAX_UPSTREAM_BYTES = 10 * 1024 * 1024;
const MAX_EXPORT_BYTES = 10 * 1024 * 1024;
const MAX_DAILY_SUN_ALIASES = 16;
const PROVIDER_DRAIN_BUDGET_MS = 5_000;
const PROVIDER_REQUEST_TIMEOUT_MS = 2_000;
// Every purpose the private.account_consents and account_consent_events checks
// allow (20261111170000). account_v2_export returns every row unfiltered, so a
// purpose missing here makes the whole export fail closed.
const PURPOSES = new Set([
  'chart_sync',
  'chart_emails',
  'weekly_digest',
  'daily_chart_email',
  'compatibility_invites',
  'ai_memory',
  'public_presentation',
]);
const SUN_SIGNS = new Set([
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
]);

export type AccountServerFailureCode =
  | 'export_unavailable'
  | 'deletion_conflict'
  | 'deletion_blocked'
  | 'deletion_receipt_not_found'
  | 'deletion_receipt_expired'
  | 'deletion_unavailable';

export class AccountServerFailure extends Error {
  constructor(readonly code: AccountServerFailureCode) {
    super(code);
    this.name = 'AccountServerFailure';
  }
}

function value(env: Environment, key: string): string {
  const candidate = env[key];
  return typeof candidate === 'string' ? candidate.trim() : '';
}

export function accountSupabaseOrigin(env: Environment = process.env): string {
  const configured = value(env, 'PUBLIC_SUPABASE_URL');
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new AccountServerFailure('export_unavailable');
  }
  if (url.protocol !== 'https:'
    || url.username
    || url.password
    || (url.pathname !== '/' && url.pathname !== '')
    || url.search
    || url.hash) {
    throw new AccountServerFailure('export_unavailable');
  }
  return url.origin;
}

function serviceHeaders(env: Environment, prefer?: string): Record<string, string> {
  const key = value(env, 'SUPABASE_SERVICE_ROLE_KEY');
  if (key.length < 16) throw new AccountServerFailure('export_unavailable');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}

function hasExactKeys(input: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(input).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isoDate(input: unknown): string | null {
  return typeof input === 'string' && Number.isFinite(Date.parse(input)) ? input : null;
}

function nullableIsoDate(input: unknown): string | null | undefined {
  return input === null ? null : isoDate(input) ?? undefined;
}

function safeInteger(input: unknown, minimum = 0): number | null {
  return Number.isSafeInteger(input) && (input as number) >= minimum ? input as number : null;
}

function boundedText(input: unknown, maxLength: number): string | null {
  return typeof input === 'string'
    && input.length >= 1
    && input.length <= maxLength
    && !/[\u0000-\u001f\u007f]/u.test(input)
    ? input
    : null;
}

function strictBase64(input: unknown, maxDecodedBytes: number): string | null {
  if (typeof input !== 'string' || input.length < 1 || input.length > maxDecodedBytes * 2) return null;
  const normalized = input.replace(/[\r\n]/gu, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) return null;
  try {
    const decoded = Buffer.from(normalized, 'base64');
    return decoded.byteLength >= 1
      && decoded.byteLength <= maxDecodedBytes
      && decoded.toString('base64') === normalized
      ? normalized
      : null;
  } catch {
    return null;
  }
}

async function responseJson(response: Response, failure: AccountServerFailureCode): Promise<unknown> {
  const rawLength = response.headers.get('content-length');
  if (rawLength && /^\d+$/.test(rawLength) && Number(rawLength) > MAX_UPSTREAM_BYTES) {
    throw new AccountServerFailure(failure);
  }
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_UPSTREAM_BYTES) {
    throw new AccountServerFailure(failure);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AccountServerFailure(failure);
  }
}

interface RowQuery {
  table: string;
  select: string;
  filters: Record<string, string>;
  order?: string;
  pageSize: number;
  maximumRows: number;
}

async function fetchRows(
  query: RowQuery,
  env: Environment,
  fetcher: Fetch,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let offset = 0;
  while (offset <= query.maximumRows) {
    const params = new URLSearchParams({
      select: query.select,
      ...query.filters,
      ...(query.order ? { order: query.order } : {}),
      limit: String(query.pageSize),
      offset: String(offset),
    });
    const response = await fetcher(
      `${accountSupabaseOrigin(env)}/rest/v1/${query.table}?${params}`,
      { headers: serviceHeaders(env) },
    );
    if (!response.ok) throw new AccountServerFailure('export_unavailable');
    const page = await responseJson(response, 'export_unavailable');
    if (!Array.isArray(page) || page.some((row) => !isRecord(row))) {
      throw new AccountServerFailure('export_unavailable');
    }
    rows.push(...page as Record<string, unknown>[]);
    if (rows.length > query.maximumRows) throw new AccountServerFailure('export_unavailable');
    if (page.length < query.pageSize) return rows;
    offset += page.length;
  }
  throw new AccountServerFailure('export_unavailable');
}

function authExport(input: unknown, expected: AuthenticatedEmailUser): AccountAuthExportV1 {
  if (!isRecord(input)) throw new AccountServerFailure('export_unavailable');
  const row = isRecord(input.user) ? input.user : input;
  if (row.id !== expected.id
    || typeof row.email !== 'string'
    || row.email.trim().toLowerCase() !== expected.email) {
    throw new AccountServerFailure('export_unavailable');
  }

  const providerCandidates: unknown[] = [];
  if (isRecord(row.app_metadata)) {
    if (Array.isArray(row.app_metadata.providers)) providerCandidates.push(...row.app_metadata.providers);
    providerCandidates.push(row.app_metadata.provider);
  }
  if (Array.isArray(row.identities)) {
    for (const identity of row.identities) {
      if (isRecord(identity)) providerCandidates.push(identity.provider);
    }
  }
  const providers = [...new Set(providerCandidates.filter((candidate): candidate is string => (
    typeof candidate === 'string'
      && candidate.length >= 1
      && candidate.length <= 64
      && /^[a-z0-9_./-]+$/i.test(candidate)
  )))].sort();
  const phone = typeof row.phone === 'string' && row.phone.trim()
    ? boundedText(row.phone.trim(), 64)
    : null;
  if (phone === null && typeof row.phone === 'string' && row.phone.trim()) {
    throw new AccountServerFailure('export_unavailable');
  }

  const optionalDate = (candidate: unknown): string | null => candidate === null || candidate === undefined
    ? null
    : isoDate(candidate) ?? (() => { throw new AccountServerFailure('export_unavailable'); })();

  return {
    id: expected.id,
    email: expected.email,
    phone,
    providers,
    isAnonymous: row.is_anonymous === true,
    createdAt: optionalDate(row.created_at),
    updatedAt: optionalDate(row.updated_at),
    lastSignInAt: optionalDate(row.last_sign_in_at),
    emailConfirmedAt: optionalDate(row.email_confirmed_at),
    phoneConfirmedAt: optionalDate(row.phone_confirmed_at),
  };
}

function profileExport(rows: Record<string, unknown>[]): LegacyProfileExportV1 | null {
  if (rows.length === 0) return null;
  if (rows.length !== 1 || !isRecord(rows[0]?.settings) || typeof rows[0]?.digest_opt_in !== 'boolean') {
    throw new AccountServerFailure('export_unavailable');
  }
  const createdAt = isoDate(rows[0].created_at);
  const updatedAt = isoDate(rows[0].updated_at);
  if (!createdAt || !updatedAt) throw new AccountServerFailure('export_unavailable');
  return { settings: rows[0].settings, digestOptIn: rows[0].digest_opt_in, createdAt, updatedAt };
}

function chartExports(rows: Record<string, unknown>[]): LegacyChartExportV1[] {
  return rows.map((row) => {
    const createdAt = isoDate(row.created_at);
    const updatedAt = isoDate(row.updated_at);
    if (!isAccountUuid(row.id) || !isRecord(row.payload) || !createdAt || !updatedAt) {
      throw new AccountServerFailure('export_unavailable');
    }
    return { id: row.id, payload: row.payload, createdAt, updatedAt };
  });
}

function chartDeletionExports(rows: Record<string, unknown>[]): LegacyChartDeletionExportV1[] {
  return rows.map((row) => {
    const deletedAt = isoDate(row.deleted_at);
    const createdAt = isoDate(row.created_at);
    if (!isAccountUuid(row.id) || !deletedAt || !createdAt) {
      throw new AccountServerFailure('export_unavailable');
    }
    return { id: row.id, deletedAt, createdAt };
  });
}

function dailyPreferenceExport(rows: Record<string, unknown>[]): DailyChartPreferenceExportV1 | null {
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new AccountServerFailure('export_unavailable');
  const row = rows[0];
  const chartId = row.chart_id === null || isAccountUuid(row.chart_id) ? row.chart_id as string | null : undefined;
  const confirmedAt = nullableIsoDate(row.confirmed_at);
  const createdAt = isoDate(row.created_at);
  const updatedAt = isoDate(row.updated_at);
  if (chartId === undefined
    || confirmedAt === undefined
    || typeof row.timezone !== 'string'
    || row.timezone.length < 1
    || row.timezone.length > 255
    || !createdAt
    || !updatedAt) {
    throw new AccountServerFailure('export_unavailable');
  }
  return {
    chartId,
    timezone: row.timezone,
    state: confirmedAt === null ? 'pending' : 'confirmed',
    confirmedAt,
    createdAt,
    updatedAt,
  };
}

function inviteExports(rows: Record<string, unknown>[]): CompatibilityInviteExportV1[] {
  const allowedStatuses = new Set(['active', 'completed', 'revoked', 'expired']);
  return rows.map((row) => {
    if (!hasExactKeys(row, [
      'id', 'label', 'sun_sign', 'positions', 'time_known', 'status',
      'notify_on_complete', 'created_at', 'expires_at', 'opened_at',
      'completed_at', 'revoked_at', 'expired_at', 'authority_destroyed_at',
      'delete_after', 'owner_hidden_at',
    ])) {
      throw new AccountServerFailure('export_unavailable');
    }
    const requiredDates = {
      createdAt: isoDate(row.created_at),
      expiresAt: isoDate(row.expires_at),
    };
    const nullableDates = {
      openedAt: nullableIsoDate(row.opened_at),
      completedAt: nullableIsoDate(row.completed_at),
      revokedAt: nullableIsoDate(row.revoked_at),
      expiredAt: nullableIsoDate(row.expired_at),
      authorityDestroyedAt: nullableIsoDate(row.authority_destroyed_at),
      deleteAfter: nullableIsoDate(row.delete_after),
      ownerHiddenAt: nullableIsoDate(row.owner_hidden_at),
    };
    if (!isAccountUuid(row.id)
      || !boundedText(row.label, 24)
      || typeof row.sun_sign !== 'string'
      || !SUN_SIGNS.has(row.sun_sign)
      || !(row.positions === null || isRecord(row.positions))
      || typeof row.time_known !== 'boolean'
      || typeof row.status !== 'string'
      || !allowedStatuses.has(row.status)
      || typeof row.notify_on_complete !== 'boolean'
      || !requiredDates.createdAt
      || !requiredDates.expiresAt
      || Object.values(nullableDates).some((date) => date === undefined)) {
      throw new AccountServerFailure('export_unavailable');
    }
    return {
      id: row.id,
      label: row.label as string,
      sunSign: row.sun_sign,
      positions: row.positions as Record<string, unknown> | null,
      timeKnown: row.time_known,
      status: row.status,
      notifyOnComplete: row.notify_on_complete,
      createdAt: requiredDates.createdAt,
      expiresAt: requiredDates.expiresAt,
      openedAt: nullableDates.openedAt as string | null,
      completedAt: nullableDates.completedAt as string | null,
      revokedAt: nullableDates.revokedAt as string | null,
      expiredAt: nullableDates.expiredAt as string | null,
      authorityDestroyedAt: nullableDates.authorityDestroyedAt as string | null,
      deleteAfter: nullableDates.deleteAfter as string | null,
      ownerHiddenAt: nullableDates.ownerHiddenAt as string | null,
    };
  });
}

function strictRows<T>(
  input: unknown,
  maximum: number,
  parse: (row: Record<string, unknown>) => T | null,
): T[] | null {
  if (!Array.isArray(input) || input.length > maximum) return null;
  const parsed: T[] = [];
  for (const value of input) {
    if (!isRecord(value)) return null;
    const row = parse(value);
    if (!row) return null;
    parsed.push(row);
  }
  return parsed;
}

function parseV2Export(
  input: unknown,
  userId: string,
  env: Environment,
): AccountSyncV2ExportV1 | null {
  if (!isRecord(input) || !hasExactKeys(input, [
    'outcome', 'schema', 'account', 'consents', 'consent_events', 'devices',
    'daily_sun_aliases', 'charts', 'changes', 'tombstones',
  ]) || input.outcome !== 'ready' || input.schema !== ACCOUNT_SYNC_V2_EXPORT_SCHEMA) return null;

  let account: AccountSyncV2ExportV1['account'] = null;
  if (input.account !== null) {
    if (!isRecord(input.account)
      || !hasExactKeys(input.account, ['status', 'created_at', 'updated_at', 'deletion_started_at'])
      || (input.account.status !== 'active' && input.account.status !== 'deleting')) return null;
    const createdAt = isoDate(input.account.created_at);
    const updatedAt = isoDate(input.account.updated_at);
    const deletionStartedAt = nullableIsoDate(input.account.deletion_started_at);
    if (!createdAt || !updatedAt || deletionStartedAt === undefined) return null;
    account = {
      status: input.account.status,
      created_at: createdAt,
      updated_at: updatedAt,
      deletion_started_at: deletionStartedAt,
    };
  }

  const consents = strictRows<AccountSyncV2ExportV1['consents'][number]>(input.consents, 16, (row) => {
    if (!hasExactKeys(row, ['purpose', 'state', 'policy_version', 'granted_at', 'withdrawn_at', 'updated_at'])
      || typeof row.purpose !== 'string'
      || !PURPOSES.has(row.purpose)
      || (row.state !== 'granted' && row.state !== 'withdrawn')) return null;
    const policy = boundedText(row.policy_version, 64);
    const granted = nullableIsoDate(row.granted_at);
    const withdrawn = nullableIsoDate(row.withdrawn_at);
    const updated = isoDate(row.updated_at);
    return policy && granted !== undefined && withdrawn !== undefined && updated
      ? { purpose: row.purpose, state: row.state, policy_version: policy, granted_at: granted, withdrawn_at: withdrawn, updated_at: updated }
      : null;
  });
  const consentEvents = strictRows<AccountSyncV2ExportV1['consent_events'][number]>(input.consent_events, 10_000, (row) => {
    if (!hasExactKeys(row, ['event_id', 'purpose', 'decision', 'policy_version', 'source', 'occurred_at'])
      || typeof row.purpose !== 'string'
      || !PURPOSES.has(row.purpose)
      || (row.decision !== 'grant' && row.decision !== 'withdraw')
      || (row.source !== 'web' && row.source !== 'ios' && row.source !== 'support' && row.source !== 'system')) return null;
    const eventId = safeInteger(row.event_id, 1);
    const policy = boundedText(row.policy_version, 64);
    const occurred = isoDate(row.occurred_at);
    return eventId && policy && occurred
      ? { event_id: eventId, purpose: row.purpose, decision: row.decision, policy_version: policy, source: row.source, occurred_at: occurred }
      : null;
  });
  const devices = strictRows<AccountSyncV2ExportV1['devices'][number]>(input.devices, 100, (row) => {
    if (!hasExactKeys(row, ['device_id', 'platform', 'last_cursor', 'created_at', 'last_seen_at', 'revoked_at'])
      || !isAccountUuid(row.device_id)
      || (row.platform !== 'web' && row.platform !== 'ios' && row.platform !== 'unknown')) return null;
    const cursor = safeInteger(row.last_cursor);
    const created = isoDate(row.created_at);
    const seen = isoDate(row.last_seen_at);
    const revoked = nullableIsoDate(row.revoked_at);
    return cursor !== null && created && seen && revoked !== undefined
      ? { device_id: row.device_id, platform: row.platform, last_cursor: cursor, created_at: created, last_seen_at: seen, revoked_at: revoked }
      : null;
  });
  const exportedAliasHashes = new Set<string>();
  const dailySunAliases = strictRows<AccountSyncV2ExportV1['daily_sun_aliases'][number]>(
    input.daily_sun_aliases,
    MAX_DAILY_SUN_ALIASES,
    (row) => {
      if (!hasExactKeys(row, [
        'recipient_hash', 'encrypted_locator', 'bound_at', 'updated_at',
      ])
        || typeof row.recipient_hash !== 'string'
        || !/^[0-9a-f]{64}$/u.test(row.recipient_hash)
        || exportedAliasHashes.has(row.recipient_hash)) return null;
      exportedAliasHashes.add(row.recipient_hash);
      const boundAt = isoDate(row.bound_at);
      const updatedAt = isoDate(row.updated_at);
      if (!boundAt || !updatedAt) return null;
      if (row.encrypted_locator === null) {
        return {
          schema: 'zodiacs.account.daily-sun-alias.v1',
          email: null,
          locatorStatus: 'unavailable',
          boundAt,
          updatedAt,
        };
      }
      const envelope = parseProviderEnvelope(row.encrypted_locator);
      if (!envelope) return null;
      let email: string;
      try {
        email = decryptAccountDailySunAliasLocator(envelope, {
          userId: userId.toLowerCase(),
          recipientHash: row.recipient_hash,
        }, env);
      } catch (error) {
        if (error instanceof AccountEncryptionFailure) return null;
        throw error;
      }
      return {
        schema: 'zodiacs.account.daily-sun-alias.v1',
        email,
        locatorStatus: 'available',
        boundAt,
        updatedAt,
      };
    },
  );
  type ParsedChart = {
    routing: AccountSyncV2ExportV1['charts'][number];
    privateChart: AccountSyncV2ExportV1['private_charts'][number];
    encryptedSource: AccountSyncV2ExportV1['encrypted_sources'][number];
  };
  const parsedCharts = strictRows<ParsedChart>(input.charts, 500, (row) => {
    if (!hasExactKeys(row, [
      'chart_id', 'subject_kind', 'subject_attestation', 'revision', 'created_at', 'updated_at',
      'encrypted_source',
    ])
      || !isAccountUuid(row.chart_id)
      || row.subject_kind !== 'self'
      || row.subject_attestation !== 'self_declared_v1'
      || !isRecord(row.encrypted_source)
      || !hasExactKeys(row.encrypted_source, [
        'ciphertext', 'nonce', 'format', 'key_scope', 'key_version', 'wrapped_key',
      ])
      || row.encrypted_source.format !== 'opaque_v1'
      || row.encrypted_source.key_scope !== 'service'
      || row.encrypted_source.wrapped_key === null) return null;
    const chartId = row.chart_id.toLowerCase();
    const revision = safeInteger(row.revision, 1);
    const created = isoDate(row.created_at);
    const updated = isoDate(row.updated_at);
    const ciphertext = strictBase64(row.encrypted_source.ciphertext, 16 * 1024 + 16);
    const nonce = strictBase64(row.encrypted_source.nonce, 12);
    const keyVersion = safeInteger(row.encrypted_source.key_version, 1);
    const wrappedKey = strictBase64(row.encrypted_source.wrapped_key, 256);
    if (!revision || !created || !updated || !ciphertext || !nonce || !keyVersion
      || keyVersion > 1_000_000 || !wrappedKey
      || Buffer.from(nonce, 'base64').byteLength !== 12) return null;

    const envelope: AccountEncryptedEnvelope = {
      ciphertext: Buffer.from(ciphertext, 'base64'),
      nonce: Buffer.from(nonce, 'base64'),
      format: 'opaque_v1',
      keyScope: 'service',
      keyVersion,
      wrappedKey: Buffer.from(wrappedKey, 'base64'),
    };
    let plaintext: string;
    try {
      plaintext = decryptAccountPrivatePayload(envelope, {
        userId: userId.toLowerCase(),
        chartId,
        revision,
      }, env);
    } catch (error) {
      if (error instanceof AccountEncryptionFailure) return null;
      throw error;
    }
    const privatePayload = parseSerializedAccountPrivateChartPayload(plaintext);
    if (!privatePayload || serializeAccountPrivateChartPayload(privatePayload) !== plaintext) return null;

    return {
      routing: {
        chart_id: chartId,
        subject_kind: 'self',
        subject_attestation: 'self_declared_v1',
        revision,
        created_at: created,
        updated_at: updated,
      },
      privateChart: {
        chart_id: chartId,
        revision,
        schema: 'zodiacs.account.private-chart.v1',
        label: privatePayload.label,
        birth: privatePayload.birth,
        derived: privatePayload.derived,
      },
      encryptedSource: {
        chart_id: chartId,
        revision,
        ciphertext,
        nonce,
        format: 'opaque_v1',
        key_scope: 'service',
        key_version: keyVersion,
        wrapped_key: wrappedKey,
        created_at: created,
        updated_at: updated,
      },
    };
  });
  const changes = strictRows<AccountSyncV2ExportV1['changes'][number]>(input.changes, 50_000, (row) => {
    if (!hasExactKeys(row, ['seq', 'entity_type', 'entity_id', 'operation', 'revision', 'created_at'])
      || (row.entity_type !== 'chart' && row.entity_type !== 'consent' && row.entity_type !== 'account')) return null;
    const seq = safeInteger(row.seq, 1);
    const revision = safeInteger(row.revision);
    const created = isoDate(row.created_at);
    const entityId = row.entity_id === null || isAccountUuid(row.entity_id) ? row.entity_id as string | null : undefined;
    const operationValid = (row.entity_type === 'chart' && entityId !== null && (row.operation === 'upsert' || row.operation === 'delete'))
      || (row.entity_type === 'consent' && entityId === null && (row.operation === 'grant' || row.operation === 'withdraw'))
      || (row.entity_type === 'account' && entityId === null && row.operation === 'delete');
    return seq && revision !== null && created && entityId !== undefined && operationValid
      ? { seq, entity_type: row.entity_type, entity_id: entityId, operation: row.operation as 'upsert' | 'delete' | 'grant' | 'withdraw', revision, created_at: created }
      : null;
  });
  const tombstones = strictRows<AccountSyncV2ExportV1['tombstones'][number]>(input.tombstones, 5_000, (row) => {
    if (!hasExactKeys(row, ['chart_id', 'revision', 'deleted_at']) || !isAccountUuid(row.chart_id)) return null;
    const revision = safeInteger(row.revision, 1);
    const deleted = isoDate(row.deleted_at);
    return revision && deleted ? { chart_id: row.chart_id, revision, deleted_at: deleted } : null;
  });

  if (!consents || !consentEvents || !devices || !dailySunAliases
    || !parsedCharts || !changes || !tombstones) {
    return null;
  }
  const charts = parsedCharts.map((chart) => chart.routing);
  const privateCharts = parsedCharts.map((chart) => chart.privateChart);
  const encryptedSources = parsedCharts.map((chart) => chart.encryptedSource);
  if (new Set(charts.map((chart) => chart.chart_id)).size !== charts.length) return null;
  if (account === null
    && [consents, consentEvents, devices, dailySunAliases, charts, changes, tombstones]
      .some((rows) => rows.length > 0)) {
    return null;
  }

  return {
    outcome: 'ready',
    schema: ACCOUNT_SYNC_V2_EXPORT_SCHEMA,
    account,
    consents,
    consent_events: consentEvents,
    devices,
    daily_sun_aliases: dailySunAliases,
    charts,
    private_charts: privateCharts,
    encrypted_sources: encryptedSources,
    changes,
    tombstones,
  };
}

async function fetchAuthExport(
  user: AuthenticatedEmailUser,
  env: Environment,
  fetcher: Fetch,
): Promise<AccountAuthExportV1> {
  const response = await fetcher(
    `${accountSupabaseOrigin(env)}/auth/v1/admin/users/${encodeURIComponent(user.id)}`,
    { headers: serviceHeaders(env) },
  );
  if (!response.ok) throw new AccountServerFailure('export_unavailable');
  return authExport(await responseJson(response, 'export_unavailable'), user);
}

async function fetchV2Export(
  userId: string,
  env: Environment,
  fetcher: Fetch,
): Promise<AccountSyncV2ExportV1> {
  const response = await fetcher(
    `${accountSupabaseOrigin(env)}/rest/v1/rpc/account_v2_export`,
    {
      method: 'POST',
      headers: serviceHeaders(env),
      body: JSON.stringify({ candidate_user_id: userId }),
    },
  );
  if (!response.ok) throw new AccountServerFailure('export_unavailable');
  const parsed = parseV2Export(
    await responseJson(response, 'export_unavailable'),
    userId,
    env,
  );
  if (!parsed) throw new AccountServerFailure('export_unavailable');
  return parsed;
}

async function fetchLegacyInviteExport(
  userId: string,
  env: Environment,
  fetcher: Fetch,
): Promise<Record<string, unknown>[]> {
  const response = await fetcher(
    `${accountSupabaseOrigin(env)}/rest/v1/rpc/account_v2_export_legacy_invites`,
    {
      method: 'POST',
      headers: serviceHeaders(env),
      body: JSON.stringify({ candidate_user_id: userId }),
    },
  );
  if (!response.ok) throw new AccountServerFailure('export_unavailable');
  const body = await responseJson(response, 'export_unavailable');
  if (!Array.isArray(body)
    || body.length > 5_000
    || body.some((row) => !isRecord(row))) {
    throw new AccountServerFailure('export_unavailable');
  }
  return body as Record<string, unknown>[];
}

export async function buildAccountExport(
  user: AuthenticatedEmailUser,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
  now: () => number = Date.now,
): Promise<ZodiacsAccountExportV1> {
  const userFilter = `eq.${user.id}`;
  const [account, profiles, charts, deletions, dailyPreferences, invites, accountSyncV2] = await Promise.all([
    fetchAuthExport(user, env, fetcher),
    fetchRows({
      table: 'profiles', select: 'settings,digest_opt_in,created_at,updated_at', filters: { user_id: userFilter },
      order: 'created_at.asc', pageSize: 2, maximumRows: 1,
    }, env, fetcher),
    fetchRows({
      table: 'charts', select: 'id,payload,created_at,updated_at', filters: { user_id: userFilter },
      order: 'created_at.asc,id.asc', pageSize: 250, maximumRows: 500,
    }, env, fetcher),
    fetchRows({
      table: 'chart_deletions', select: 'id,deleted_at,created_at', filters: { user_id: userFilter },
      order: 'deleted_at.asc,id.asc', pageSize: 500, maximumRows: 5_000,
    }, env, fetcher),
    fetchRows({
      table: 'daily_chart_preferences', select: 'chart_id,timezone,confirmed_at,created_at,updated_at', filters: { user_id: userFilter },
      order: 'created_at.asc', pageSize: 2, maximumRows: 1,
    }, env, fetcher),
    fetchLegacyInviteExport(user.id, env, fetcher),
    fetchV2Export(user.id, env, fetcher),
  ]);

  const result: ZodiacsAccountExportV1 = {
    schema: ACCOUNT_EXPORT_SCHEMA,
    exportedAt: new Date(now()).toISOString(),
    account,
    cloud: {
      profile: profileExport(profiles),
      charts: chartExports(charts),
      chartDeletions: chartDeletionExports(deletions),
      dailyChartPreference: dailyPreferenceExport(dailyPreferences),
      compatibilityInvites: inviteExports(invites),
      accountSyncV2,
    },
  };
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > MAX_EXPORT_BYTES) {
    throw new AccountServerFailure('export_unavailable');
  }
  return result;
}

export interface AccountDeletionReceipt {
  outcome: 'prepared' | 'completed';
  requestId: string;
  preparedAt: string;
  expiresAt: string;
  completedAt: string | null;
  dailySunRevoked: boolean;
  dailySunReconciliationRequired: boolean;
}

function deletionRecoveryVerifiers(
  requestId: string,
  recoverySecret: string,
  env: Environment,
): string[] {
  return accountMutationRequestVerifiers(
    accountDeletionRecoveryPreimage(requestId, recoverySecret),
    env,
  );
}

async function deletionRpc(
  name: string,
  body: Record<string, unknown>,
  env: Environment,
  fetcher: Fetch,
): Promise<unknown> {
  const response = await fetcher(
    `${accountSupabaseOrigin(env)}/rest/v1/rpc/${name}`,
    {
      method: 'POST',
      headers: serviceHeaders(env),
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw new AccountServerFailure('deletion_unavailable');
  return responseJson(response, 'deletion_unavailable');
}

interface ProviderCleanupEntry {
  recipient_hash: string;
  encrypted_payload: Record<string, unknown>;
}

interface ClaimedProviderCleanupEntry {
  recipientHash: string;
  claimId: string;
  envelope: AccountEncryptedEnvelope;
}

function envelopeJson(envelope: AccountEncryptedEnvelope): Record<string, unknown> {
  return {
    ciphertext: envelope.ciphertext.toString('base64'),
    nonce: envelope.nonce.toString('base64'),
    format: envelope.format,
    key_scope: envelope.keyScope,
    key_version: envelope.keyVersion,
    wrapped_key: envelope.wrappedKey.toString('base64'),
  };
}

function parseProviderEnvelope(input: unknown): AccountEncryptedEnvelope | null {
  if (!isRecord(input)
    || !hasExactKeys(input, [
      'ciphertext', 'nonce', 'format', 'key_scope', 'key_version', 'wrapped_key',
    ])
    || input.format !== 'opaque_v1'
    || input.key_scope !== 'service') return null;
  const ciphertext = strictBase64(input.ciphertext, 528);
  const nonce = strictBase64(input.nonce, 12);
  const wrappedKey = strictBase64(input.wrapped_key, 256);
  const keyVersion = safeInteger(input.key_version, 1);
  if (!ciphertext || !nonce || !wrappedKey || !keyVersion || keyVersion > 1_000_000
    || Buffer.from(ciphertext, 'base64').byteLength <= 16
    || Buffer.from(nonce, 'base64').byteLength !== 12) return null;
  return {
    ciphertext: Buffer.from(ciphertext, 'base64'),
    nonce: Buffer.from(nonce, 'base64'),
    format: 'opaque_v1',
    keyScope: 'service',
    keyVersion,
    wrappedKey: Buffer.from(wrappedKey, 'base64'),
  };
}

async function listDailySunAliases(
  userId: string,
  env: Environment,
  fetcher: Fetch,
): Promise<Array<{ recipientHash: string; envelope: AccountEncryptedEnvelope }> | null> {
  try {
    const result = await deletionRpc('account_v2_list_daily_sun_aliases', {
      candidate_user_id: userId,
    }, env, fetcher);
    if (!isRecord(result)
      || !hasExactKeys(result, ['outcome', 'aliases'])
      || result.outcome !== 'ready'
      || !Array.isArray(result.aliases)
      || result.aliases.length > MAX_DAILY_SUN_ALIASES) return null;
    const aliases: Array<{ recipientHash: string; envelope: AccountEncryptedEnvelope }> = [];
    const seen = new Set<string>();
    for (const row of result.aliases) {
      if (!isRecord(row)
        || !hasExactKeys(row, ['recipient_hash', 'encrypted_locator'])
        || typeof row.recipient_hash !== 'string'
        || !/^[0-9a-f]{64}$/u.test(row.recipient_hash)
        || seen.has(row.recipient_hash)) return null;
      const envelope = parseProviderEnvelope(row.encrypted_locator);
      if (!envelope) return null;
      seen.add(row.recipient_hash);
      aliases.push({ recipientHash: row.recipient_hash, envelope });
    }
    return aliases;
  } catch {
    // Provider reconciliation is ancillary to the irreversible account erase.
    return null;
  }
}

async function buildProviderCleanupEntries(
  userId: string,
  requestId: string,
  currentEmail: string | null,
  env: Environment,
  fetcher: Fetch,
): Promise<{ entries: ProviderCleanupEntry[]; inventoryComplete: boolean }> {
  const emails = new Map<string, string>();
  const aliases = await listDailySunAliases(userId, env, fetcher);
  let inventoryComplete = aliases !== null;
  if (currentEmail) {
    try {
      emails.set(dailySunRecipientHash(currentEmail, env), currentEmail);
    } catch {
      inventoryComplete = false;
    }
  } else {
    inventoryComplete = false;
  }
  for (const alias of aliases ?? []) {
    if (emails.has(alias.recipientHash)) continue;
    try {
      const email = decryptAccountDailySunAliasLocator(alias.envelope, {
        userId,
        recipientHash: alias.recipientHash,
      }, env);
      emails.set(alias.recipientHash, email);
    } catch {
      // Omitting an unreadable locator makes the SQL receipt remain explicitly
      // reconciliation-required; it never permits a false cleanup claim.
      inventoryComplete = false;
    }
  }

  if (emails.size > MAX_DAILY_SUN_ALIASES) inventoryComplete = false;

  const entries: ProviderCleanupEntry[] = [];
  for (const [recipientHash, email] of [...emails.entries()].slice(0, MAX_DAILY_SUN_ALIASES)) {
    try {
      entries.push({
        recipient_hash: recipientHash,
        encrypted_payload: envelopeJson(encryptAccountDeletionProviderPayload(email, {
          requestId,
          recipientHash,
        }, env)),
      });
    } catch {
      // As above: an omitted entry is durable unresolved reconciliation truth.
      inventoryComplete = false;
    }
  }
  return { entries, inventoryComplete };
}

async function listProviderCleanup(
  requestId: string,
  recoveryFingerprints: string[],
  env: Environment,
  fetcher: Fetch,
): Promise<ClaimedProviderCleanupEntry[] | null> {
  const result = await deletionRpc('account_v2_list_deletion_provider_cleanup', {
    candidate_request_id: requestId,
    candidate_recovery_fingerprints: recoveryFingerprints,
  }, env, fetcher);
  if (!isRecord(result)
    || !hasExactKeys(result, ['outcome', 'entries', 'has_more'])
    || result.outcome !== 'ready'
    || typeof result.has_more !== 'boolean'
    || !Array.isArray(result.entries)
    || result.entries.length > MAX_DAILY_SUN_ALIASES) return null;
  const entries: ClaimedProviderCleanupEntry[] = [];
  const seen = new Set<string>();
  for (const row of result.entries) {
    if (!isRecord(row)
      || !hasExactKeys(row, ['recipient_hash', 'claim_id', 'encrypted_payload', 'attempt_count'])
      || typeof row.recipient_hash !== 'string'
      || !/^[0-9a-f]{64}$/u.test(row.recipient_hash)
      || !isAccountUuid(row.claim_id)
      || seen.has(row.recipient_hash)
      || safeInteger(row.attempt_count) === null) return null;
    const envelope = parseProviderEnvelope(row.encrypted_payload);
    if (!envelope) return null;
    seen.add(row.recipient_hash);
    entries.push({
      recipientHash: row.recipient_hash,
      claimId: row.claim_id.toLowerCase(),
      envelope,
    });
  }
  return entries;
}

async function removeDailySunSegmentWithTimeout(
  email: string,
  timeoutMs: number,
  env: Environment,
  fetcher: Fetch,
): Promise<void> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const boundedFetcher: Fetch = (input, init) => fetcher(input, {
    ...init,
    signal: controller.signal,
  });
  try {
    await Promise.race([
      removeDailySunSegment({ email }, env, boundedFetcher),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('Daily Sun provider cleanup timed out.'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function recordProviderCleanup(
  requestId: string,
  recoveryFingerprints: string[],
  recipientHash: string,
  claimId: string,
  succeeded: boolean,
  env: Environment,
  fetcher: Fetch,
): Promise<void> {
  const result = await deletionRpc('account_v2_record_deletion_provider_cleanup', {
    candidate_request_id: requestId,
    candidate_recovery_fingerprints: recoveryFingerprints,
    candidate_recipient_hash: recipientHash,
    candidate_cleanup_claim_id: claimId,
    candidate_succeeded: succeeded,
  }, env, fetcher);
  if (!isRecord(result)
    || !hasExactKeys(result, [
      'outcome', 'recipient_hash', 'state', 'daily_sun_revoked',
      'daily_sun_reconciliation_required',
    ])
    || result.outcome !== 'recorded'
    || result.recipient_hash !== recipientHash
    || (result.state !== 'pending'
      && result.state !== 'completed'
      && result.state !== 'superseded')
    || typeof result.daily_sun_revoked !== 'boolean'
    || typeof result.daily_sun_reconciliation_required !== 'boolean') {
    throw new AccountServerFailure('deletion_unavailable');
  }
}

async function drainProviderCleanup(
  requestId: string,
  recoveryFingerprints: string[],
  env: Environment,
  fetcher: Fetch,
): Promise<void> {
  let entries: ClaimedProviderCleanupEntry[] | null;
  try {
    entries = await listProviderCleanup(requestId, recoveryFingerprints, env, fetcher);
  } catch {
    return;
  }
  if (!entries) return;
  const deadline = Date.now() + PROVIDER_DRAIN_BUDGET_MS;
  for (const entry of entries) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    let succeeded = false;
    try {
      const email = decryptAccountDeletionProviderPayload(entry.envelope, {
        requestId,
        recipientHash: entry.recipientHash,
      }, env);
      await removeDailySunSegmentWithTimeout(
        email,
        Math.min(PROVIDER_REQUEST_TIMEOUT_MS, remaining),
        env,
        fetcher,
      );
      succeeded = true;
    } catch {
      // The durable row remains retryable, and core erasure is already done.
    }
    try {
      await recordProviderCleanup(
        requestId,
        recoveryFingerprints,
        entry.recipientHash,
        entry.claimId,
        succeeded,
        env,
        fetcher,
      );
    } catch {
      // A lost/failing acknowledgement leaves the row pending for a later
      // finish retry; provider removal itself is idempotent.
    }
  }
}

function receiptFailure(input: Record<string, unknown>): never | void {
  if (input.outcome === 'not_found' || input.outcome === 'recovery_mismatch') {
    throw new AccountServerFailure('deletion_receipt_not_found');
  }
  if (input.outcome === 'expired') {
    throw new AccountServerFailure('deletion_receipt_expired');
  }
  if (input.outcome === 'request_conflict'
    || input.outcome === 'mutation_conflict') {
    throw new AccountServerFailure('deletion_conflict');
  }
  if (input.outcome === 'receipt_limit_reached') {
    throw new AccountServerFailure('deletion_blocked');
  }
}

interface ServiceDeletionReceipt extends AccountDeletionReceipt {
  userId: string;
}

function parseDeletionStatus(
  input: unknown,
  requestId: string,
): ServiceDeletionReceipt {
  if (!isRecord(input) || typeof input.outcome !== 'string') {
    throw new AccountServerFailure('deletion_unavailable');
  }
  receiptFailure(input);
  if (!hasExactKeys(input, [
    'outcome', 'request_id', 'user_id', 'state', 'prepared_at', 'expires_at', 'completed_at',
    'daily_sun_revoked', 'daily_sun_reconciliation_required',
  ])
    || input.outcome !== 'ready'
    || (input.state !== 'prepared' && input.state !== 'completed')
    || input.request_id !== requestId
    || !isAccountUuid(input.user_id)
    || typeof input.daily_sun_revoked !== 'boolean'
    || typeof input.daily_sun_reconciliation_required !== 'boolean') {
    throw new AccountServerFailure('deletion_unavailable');
  }
  const preparedAt = isoDate(input.prepared_at);
  const expiresAt = isoDate(input.expires_at);
  const completedAt = nullableIsoDate(input.completed_at);
  if (!preparedAt || !expiresAt || completedAt === undefined
    || (input.state === 'prepared' && completedAt !== null)
    || (input.state === 'completed' && completedAt === null)) {
    throw new AccountServerFailure('deletion_unavailable');
  }
  return {
    outcome: input.state,
    requestId,
    userId: input.user_id.toLowerCase(),
    preparedAt,
    expiresAt,
    completedAt,
    dailySunRevoked: input.daily_sun_revoked,
    dailySunReconciliationRequired: input.daily_sun_reconciliation_required,
  };
}

export async function prepareAccountDeletion(
  user: AuthenticatedEmailUser,
  requestId: string,
  recoverySecret: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<AccountDeletionReceipt> {
  if (!isAccountUuid(user.id) || !isAccountUuid(requestId)) {
    throw new AccountServerFailure('deletion_unavailable');
  }
  const normalizedUserId = user.id.toLowerCase();
  const normalizedRequestId = requestId.toLowerCase();
  const requestFingerprints = deletionRecoveryVerifiers(requestId, recoverySecret, env);
  const providerCleanup = await buildProviderCleanupEntries(
    normalizedUserId,
    normalizedRequestId,
    user.email,
    env,
    fetcher,
  );
  const result = await deletionRpc('account_v2_prepare_deletion', {
    candidate_user_id: normalizedUserId,
    candidate_request_id: normalizedRequestId,
    candidate_request_fingerprints: requestFingerprints,
    candidate_provider_cleanup_entries: providerCleanup.entries,
    candidate_provider_cleanup_inventory_complete: providerCleanup.inventoryComplete,
  }, env, fetcher);
  if (!isRecord(result) || typeof result.outcome !== 'string') {
    throw new AccountServerFailure('deletion_unavailable');
  }
  receiptFailure(result);
  if (!hasExactKeys(result, [
    'outcome', 'request_id', 'prepared_at', 'daily_sun_revoked',
    'daily_sun_reconciliation_required',
  ])
    || (result.outcome !== 'prepared' && result.outcome !== 'already_prepared')
    || result.request_id !== normalizedRequestId
    || !isoDate(result.prepared_at)
    || typeof result.daily_sun_revoked !== 'boolean'
    || typeof result.daily_sun_reconciliation_required !== 'boolean') {
    throw new AccountServerFailure('deletion_unavailable');
  }
  return accountDeletionStatus(requestId, recoverySecret, env, fetcher);
}

export async function cleanupExpiredAccountDeletionReceipts(
  limit = 256,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
    throw new AccountServerFailure('deletion_unavailable');
  }
  const result = await deletionRpc('account_v2_cleanup_deletion_receipts', {
    candidate_limit: limit,
  }, env, fetcher);
  const removed = safeInteger(result);
  if (removed === null || removed > limit) {
    throw new AccountServerFailure('deletion_unavailable');
  }
  return removed;
}

export async function accountDeletionStatus(
  requestId: string,
  recoverySecret: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<AccountDeletionReceipt> {
  if (!isAccountUuid(requestId)) throw new AccountServerFailure('deletion_receipt_not_found');
  const result = await deletionRpc('account_v2_deletion_status', {
    candidate_request_id: requestId.toLowerCase(),
    candidate_recovery_fingerprints: deletionRecoveryVerifiers(requestId, recoverySecret, env),
  }, env, fetcher);
  const { userId: _userId, ...receipt } = parseDeletionStatus(result, requestId.toLowerCase());
  return receipt;
}

export async function finishAccountDeletion(
  requestId: string,
  recoverySecret: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<AccountDeletionReceipt> {
  if (!isAccountUuid(requestId)) throw new AccountServerFailure('deletion_receipt_not_found');
  const requestVerifiers = deletionRecoveryVerifiers(requestId, recoverySecret, env);
  const statusResult = await deletionRpc('account_v2_deletion_status', {
    candidate_request_id: requestId.toLowerCase(),
    candidate_recovery_fingerprints: requestVerifiers,
  }, env, fetcher);
  const normalizedRequestId = requestId.toLowerCase();
  const status = parseDeletionStatus(statusResult, normalizedRequestId);
  if (status.outcome === 'completed') {
    await drainProviderCleanup(normalizedRequestId, requestVerifiers, env, fetcher);
    const refreshed = parseDeletionStatus(await deletionRpc('account_v2_deletion_status', {
      candidate_request_id: normalizedRequestId,
      candidate_recovery_fingerprints: requestVerifiers,
    }, env, fetcher), normalizedRequestId);
    if (refreshed.outcome !== 'completed') throw new AccountServerFailure('deletion_unavailable');
    const { userId: _userId, ...receipt } = refreshed;
    return receipt;
  }

  let currentEmail: string | null = null;
  try {
    currentEmail = (await getAdminEmailUser(status.userId, env, fetcher))?.email ?? null;
  } catch {
    // The encrypted alias inventory remains usable if Auth lookup is degraded.
  }
  const providerCleanup = await buildProviderCleanupEntries(
    status.userId,
    normalizedRequestId,
    currentEmail,
    env,
    fetcher,
  );
  const terminal = await deletionRpc('account_v2_terminal_cleanup', {
    candidate_request_id: normalizedRequestId,
    candidate_recovery_fingerprints: requestVerifiers,
    candidate_provider_cleanup_entries: providerCleanup.entries,
    candidate_provider_cleanup_inventory_complete: providerCleanup.inventoryComplete,
  }, env, fetcher);
  if (!isRecord(terminal)
    || !hasExactKeys(terminal, ['outcome', 'user_id'])
    || terminal.outcome !== 'ready'
    || terminal.user_id !== status.userId) {
    throw new AccountServerFailure('deletion_unavailable');
  }

  // The terminal SQL cleanup and Auth hard-delete are deliberately adjacent:
  // no provider network request may reopen the account-recreation race here.
  const authResponse = await fetcher(
    `${accountSupabaseOrigin(env)}/auth/v1/admin/users/${encodeURIComponent(status.userId)}?should_soft_delete=false`,
    { method: 'DELETE', headers: serviceHeaders(env) },
  );
  if (authResponse.status === 400 || authResponse.status === 409 || authResponse.status === 422) {
    throw new AccountServerFailure('deletion_blocked');
  }
  if (!(authResponse.ok || authResponse.status === 404)) {
    throw new AccountServerFailure('deletion_unavailable');
  }

  const completed = await deletionRpc('account_v2_finish_deletion', {
    candidate_request_id: normalizedRequestId,
    candidate_recovery_fingerprints: requestVerifiers,
  }, env, fetcher);
  if (!isRecord(completed) || typeof completed.outcome !== 'string') {
    throw new AccountServerFailure('deletion_unavailable');
  }
  receiptFailure(completed);
  const preparedAt = isoDate(completed.prepared_at);
  const expiresAt = isoDate(completed.expires_at);
  const completedAt = isoDate(completed.completed_at);
  if (!hasExactKeys(completed, [
    'outcome', 'request_id', 'user_id', 'prepared_at', 'expires_at', 'completed_at',
    'daily_sun_revoked', 'daily_sun_reconciliation_required',
  ])
    || completed.outcome !== 'completed'
    || completed.request_id !== normalizedRequestId
    || completed.user_id !== status.userId
    || typeof completed.daily_sun_revoked !== 'boolean'
    || typeof completed.daily_sun_reconciliation_required !== 'boolean'
    || !preparedAt
    || !expiresAt
    || !completedAt) {
    throw new AccountServerFailure('deletion_unavailable');
  }
  await drainProviderCleanup(normalizedRequestId, requestVerifiers, env, fetcher);
  const refreshed = parseDeletionStatus(await deletionRpc('account_v2_deletion_status', {
    candidate_request_id: normalizedRequestId,
    candidate_recovery_fingerprints: requestVerifiers,
  }, env, fetcher), normalizedRequestId);
  if (refreshed.outcome !== 'completed'
    || refreshed.preparedAt !== preparedAt
    || refreshed.expiresAt !== expiresAt
    || refreshed.completedAt !== completedAt) {
    throw new AccountServerFailure('deletion_unavailable');
  }
  const { userId: _userId, ...receipt } = refreshed;
  return receipt;
}
