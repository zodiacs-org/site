import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import type { AuthenticatedEmailUser } from '../email/daily-server.js';
import { dailySunRecipientHash } from '../email/daily-sun-server.js';
import {
  consentMutationPreimageV1,
  deleteChartMutationPreimageV1,
  putChartMutationPreimageV1,
} from '../account-v2/mutation-fingerprint.js';
import {
  ACCOUNT_SYNC_V2_ENCRYPTION_FORMAT,
  ACCOUNT_SYNC_V2_KEY_SCOPE,
  AccountEncryptionFailure,
  decryptAccountPrivatePayload,
  encryptAccountDailySunAliasLocator,
  encryptAccountPrivatePayload,
  type AccountEncryptedEnvelope,
} from './encryption.js';
import { accountMutationRequestVerifiers } from './mutation-verifier.js';
import {
  accountConsentPolicyVersion,
  type AccountConsentPurpose,
} from '../account-v2/policy.js';
import { isAccountUuid } from './request.js';
import {
  ACCOUNT_SYNC_V2_MINIMUM_AGE,
  isAdultAccountBirthDate,
  parseSerializedAccountPrivateChartPayload,
  serializeAccountPrivateChartPayload,
  type AccountChartDeleteInput,
  type AccountChartGetInput,
  type AccountChartPutInput,
  type AccountConsentInput,
  type AccountPullInput,
  type AccountSyncInput,
} from './sync-wire.js';

type Environment = Record<string, unknown>;
type Fetch = typeof fetch;

const MAX_UPSTREAM_BYTES = 512 * 1024;
const MAX_CIPHERTEXT_BYTES = 16 * 1024 + 16;
const MAX_WRAPPED_KEY_BYTES = 256;
const MAX_CURSOR = Number.MAX_SAFE_INTEGER;
const PULL_PAGE_SIZE = 200;
const MAX_PULL_PAGES = 256;

export class AccountSyncServerFailure extends Error {
  constructor() {
    super('Account synchronization is unavailable.');
    this.name = 'AccountSyncServerFailure';
  }
}

function envValue(env: Environment, name: string): string {
  const candidate = env[name];
  return typeof candidate === 'string' ? candidate.trim() : '';
}

function supabaseOrigin(env: Environment): string {
  let url: URL;
  try {
    url = new URL(envValue(env, 'PUBLIC_SUPABASE_URL'));
  } catch {
    throw new AccountSyncServerFailure();
  }
  if (url.protocol !== 'https:'
    || url.username
    || url.password
    || (url.pathname !== '/' && url.pathname !== '')
    || url.search
    || url.hash) throw new AccountSyncServerFailure();
  return url.origin;
}

function serviceHeaders(env: Environment): Record<string, string> {
  const key = envValue(env, 'SUPABASE_SERVICE_ROLE_KEY');
  if (key.length < 16) throw new AccountSyncServerFailure();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
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

function safeCounter(input: unknown, minimum = 0): number | null {
  return Number.isSafeInteger(input) && (input as number) >= minimum && (input as number) <= MAX_CURSOR
    ? input as number
    : null;
}

function isoDate(input: unknown): string | null {
  return typeof input === 'string' && Number.isFinite(Date.parse(input)) ? input : null;
}

function canonicalBase64(input: unknown, minimum: number, maximum: number): Buffer | null {
  if (typeof input !== 'string' || input.length < 1 || input.length > maximum * 2) return null;
  const normalized = input.replace(/[\r\n]/gu, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(normalized) || normalized.length % 4 !== 0) return null;
  const decoded = Buffer.from(normalized, 'base64');
  return decoded.byteLength >= minimum
    && decoded.byteLength <= maximum
    && decoded.toString('base64') === normalized
    ? decoded
    : null;
}

function byteaHex(input: Buffer): string {
  return `\\x${input.toString('hex')}`;
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

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

async function responseJson(response: Response): Promise<unknown> {
  const rawLength = response.headers.get('content-length');
  if (rawLength && /^\d+$/u.test(rawLength) && Number(rawLength) > MAX_UPSTREAM_BYTES) {
    throw new AccountSyncServerFailure();
  }
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_UPSTREAM_BYTES) throw new AccountSyncServerFailure();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AccountSyncServerFailure();
  }
}

async function rpc(
  name: string,
  body: Record<string, unknown>,
  env: Environment,
  fetcher: Fetch,
): Promise<unknown> {
  const response = await fetcher(`${supabaseOrigin(env)}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: serviceHeaders(env),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new AccountSyncServerFailure();
  return responseJson(response);
}

function oneKeyOutcome(input: unknown, allowed: readonly string[]): Record<string, unknown> | null {
  return isRecord(input)
    && hasExactKeys(input, ['outcome'])
    && typeof input.outcome === 'string'
    && allowed.includes(input.outcome)
    ? { outcome: input.outcome }
    : null;
}

const CONSENT_STATES = ['pending', 'granted', 'withdrawn'];

function parseBootstrap(input: unknown): Record<string, unknown> | null {
  const simple = oneKeyOutcome(input, [
    'invalid', 'deleting', 'device_revoked', 'device_limit_reached',
    'legacy_migration_required', 'user_not_found',
  ]);
  if (simple) return simple;
  // Before 20261111170000 the ready shape had no chart_emails_consent; it then
  // reads as pending, which is the default for that purpose anyway.
  if (!isRecord(input)
    || !(hasExactKeys(input, ['outcome', 'account_state', 'chart_sync_consent', 'cursor'])
      || hasExactKeys(input, [
        'outcome', 'account_state', 'chart_sync_consent', 'chart_emails_consent', 'cursor',
      ]))
    || input.outcome !== 'ready'
    || input.account_state !== 'active'
    || !CONSENT_STATES.includes(String(input.chart_sync_consent))
    || (input.chart_emails_consent !== undefined
      && !CONSENT_STATES.includes(String(input.chart_emails_consent)))) return null;
  const cursor = safeCounter(input.cursor);
  return cursor === null
    ? null
    : {
        outcome: 'ready',
        account_state: 'active',
        chart_sync_consent: input.chart_sync_consent,
        chart_emails_consent: input.chart_emails_consent ?? 'pending',
        cursor,
      };
}

function parseConsent(input: unknown, purpose: AccountConsentPurpose): Record<string, unknown> | null {
  const simple = oneKeyOutcome(input, [
    'invalid', 'not_bootstrapped', 'deleting', 'user_not_found', 'mutation_conflict',
  ]);
  if (simple) return simple;
  if (!isRecord(input)
    || !hasExactKeys(input, ['outcome', 'purpose', 'event_id'])
    || (input.outcome !== 'granted' && input.outcome !== 'withdrawn')
    || input.purpose !== purpose) return null;
  const eventId = safeCounter(input.event_id, 1);
  return eventId === null ? null : { outcome: input.outcome, purpose, event_id: eventId };
}

function parseConflict(input: unknown): Record<string, unknown> | null {
  if (!isRecord(input)
    || !hasExactKeys(input, ['outcome', 'current_revision', 'deleted'])
    || input.outcome !== 'conflict'
    || typeof input.deleted !== 'boolean') return null;
  const revision = safeCounter(input.current_revision);
  return revision === null ? null : { outcome: 'conflict', current_revision: revision, deleted: input.deleted };
}

function parsePut(input: unknown, expectedChartId: string): Record<string, unknown> | null {
  const simple = oneKeyOutcome(input, [
    'invalid', 'not_bootstrapped', 'deleting', 'device_unavailable', 'consent_required',
    'mutation_conflict',
  ]);
  if (simple) return simple;
  if (isRecord(input)
    && hasExactKeys(input, ['outcome', 'limit'])
    && input.outcome === 'chart_limit_reached'
    && input.limit === 1) return { outcome: 'chart_limit_reached', limit: 1 };
  const conflict = parseConflict(input);
  if (conflict) return conflict;
  if (!isRecord(input)
    || !hasExactKeys(input, ['outcome', 'chart_id', 'revision', 'change_seq'])
    || input.outcome !== 'saved'
    || input.chart_id !== expectedChartId) return null;
  const revision = safeCounter(input.revision, 1);
  const changeSeq = safeCounter(input.change_seq, 1);
  return revision && changeSeq
    ? { outcome: 'saved', chart_id: expectedChartId, revision, change_seq: changeSeq }
    : null;
}

function parseDelete(input: unknown, expectedChartId: string): Record<string, unknown> | null {
  const simple = oneKeyOutcome(input, [
    'invalid', 'not_bootstrapped', 'deleting', 'device_unavailable', 'mutation_conflict',
  ]);
  if (simple) return simple;
  const conflict = parseConflict(input);
  if (conflict) return conflict;
  if (!isRecord(input) || input.chart_id !== expectedChartId) return null;
  if (input.outcome === 'already_deleted'
    && hasExactKeys(input, ['outcome', 'chart_id', 'revision'])) {
    const revision = safeCounter(input.revision, 1);
    return revision ? { outcome: 'already_deleted', chart_id: expectedChartId, revision } : null;
  }
  if (input.outcome === 'deleted'
    && hasExactKeys(input, ['outcome', 'chart_id', 'revision', 'change_seq'])) {
    const revision = safeCounter(input.revision, 1);
    const changeSeq = safeCounter(input.change_seq, 1);
    return revision && changeSeq
      ? { outcome: 'deleted', chart_id: expectedChartId, revision, change_seq: changeSeq }
      : null;
  }
  return null;
}

function parsePull(input: unknown, request: AccountPullInput): Record<string, unknown> | null {
  const simple = oneKeyOutcome(input, ['invalid', 'not_bootstrapped', 'deleting', 'device_unavailable']);
  if (simple) return simple;
  if (!isRecord(input)
    || !hasExactKeys(input, ['outcome', 'changes', 'next_cursor', 'has_more'])
    || input.outcome !== 'ready'
    || !Array.isArray(input.changes)
    || input.changes.length > request.limit
    || typeof input.has_more !== 'boolean') return null;
  const nextCursor = safeCounter(input.next_cursor);
  if (nextCursor === null || nextCursor < request.afterCursor) return null;

  const changes: Record<string, unknown>[] = [];
  let previous = request.afterCursor;
  for (const raw of input.changes) {
    if (!isRecord(raw)
      || !hasExactKeys(raw, [
        'seq', 'entity_type', 'entity_id', 'operation', 'revision', 'mutation_id', 'created_at',
      ])
      || !isAccountUuid(raw.mutation_id)) return null;
    const seq = safeCounter(raw.seq, 1);
    const revision = safeCounter(raw.revision);
    const createdAt = isoDate(raw.created_at);
    const chartChange = raw.entity_type === 'chart'
      && isAccountUuid(raw.entity_id)
      && (raw.operation === 'upsert' || raw.operation === 'delete');
    const consentChange = raw.entity_type === 'consent'
      && raw.entity_id === null
      && (raw.operation === 'grant' || raw.operation === 'withdraw');
    const accountChange = raw.entity_type === 'account'
      && raw.entity_id === null
      && raw.operation === 'delete';
    if (seq === null
      || revision === null
      || !createdAt
      || seq <= previous
      || (!chartChange && !consentChange && !accountChange)) return null;
    previous = seq;
    changes.push({
      seq,
      entity_type: raw.entity_type,
      entity_id: raw.entity_id,
      operation: raw.operation,
      revision,
      mutation_id: (raw.mutation_id as string).toLowerCase(),
      created_at: createdAt,
    });
  }
  if ((changes.length === 0 && nextCursor !== request.afterCursor)
    || (changes.length > 0 && nextCursor !== previous)) return null;
  return { outcome: 'ready', changes, next_cursor: nextCursor, has_more: input.has_more };
}

function parseEncryptedEnvelope(input: unknown): AccountEncryptedEnvelope | null {
  if (!isRecord(input)
    || !hasExactKeys(input, ['ciphertext', 'nonce', 'format', 'key_scope', 'key_version', 'wrapped_key'])
    || input.format !== ACCOUNT_SYNC_V2_ENCRYPTION_FORMAT
    || input.key_scope !== ACCOUNT_SYNC_V2_KEY_SCOPE
    || input.wrapped_key === null) return null;
  const ciphertext = canonicalBase64(input.ciphertext, 17, MAX_CIPHERTEXT_BYTES);
  const nonce = canonicalBase64(input.nonce, 12, 12);
  const wrappedKey = canonicalBase64(input.wrapped_key, 1, MAX_WRAPPED_KEY_BYTES);
  const keyVersion = safeCounter(input.key_version, 1);
  return ciphertext && nonce && wrappedKey && keyVersion && keyVersion <= 1_000_000
    ? {
        ciphertext,
        nonce,
        format: ACCOUNT_SYNC_V2_ENCRYPTION_FORMAT,
        keyScope: ACCOUNT_SYNC_V2_KEY_SCOPE,
        keyVersion,
        wrappedKey,
      }
    : null;
}

function parseChart(
  input: unknown,
  expectedChartId: string,
  userId: string,
  env: Environment,
): Record<string, unknown> | null {
  const simple = oneKeyOutcome(input, [
    'invalid', 'account_unavailable', 'consent_required', 'device_unavailable', 'not_found',
  ]);
  if (simple) return simple;
  if (!isRecord(input)
    || !hasExactKeys(input, [
      'outcome', 'chart_id', 'subject_kind', 'subject_attestation', 'revision',
      'created_at', 'updated_at', 'encrypted_source',
    ])
    || input.outcome !== 'ready'
    || input.chart_id !== expectedChartId
    || input.subject_kind !== 'self'
    || input.subject_attestation !== 'self_declared_v1') return null;
  const revision = safeCounter(input.revision, 1);
  const createdAt = isoDate(input.created_at);
  const updatedAt = isoDate(input.updated_at);
  const envelope = parseEncryptedEnvelope(input.encrypted_source);
  if (!revision || !createdAt || !updatedAt || !envelope) return null;

  let plaintext: string;
  try {
    plaintext = decryptAccountPrivatePayload(envelope, {
      userId,
      chartId: expectedChartId,
      revision,
    }, env);
  } catch (error) {
    if (error instanceof AccountEncryptionFailure) throw new AccountSyncServerFailure();
    throw error;
  }
  const privateChart = parseSerializedAccountPrivateChartPayload(plaintext);
  if (!privateChart) return null;

  return {
    outcome: 'ready',
    chart_id: expectedChartId,
    label: privateChart.label,
    subject_kind: 'self',
    subject_attestation: 'self_declared_v1',
    revision,
    created_at: createdAt,
    updated_at: updatedAt,
    derived: {
      positions: privateChart.derived.positions,
      time_known: privateChart.derived.timeKnown,
      sun_sign: privateChart.derived.sunSign,
      engine_version: privateChart.derived.engineVersion,
      house_system: privateChart.derived.houseSystem,
    },
    birth: privateChart.birth,
  };
}

async function consent(
  userId: string,
  input: AccountConsentInput,
  env: Environment,
  fetcher: Fetch,
): Promise<Record<string, unknown>> {
  const policyVersion = accountConsentPolicyVersion(input.purpose);
  const requestFingerprints = accountMutationRequestVerifiers(consentMutationPreimageV1({
    decision: input.decision,
    purpose: input.purpose,
    ...(input.decision === 'grant' ? { policyVersion } : {}),
  }), env);
  const result = await rpc('account_v2_record_consent', {
    candidate_user_id: userId,
    candidate_purpose: input.purpose,
    candidate_decision: input.decision,
    candidate_policy_version: input.decision === 'grant' ? policyVersion : null,
    candidate_source: 'web',
    candidate_mutation_id: input.mutationId,
    candidate_request_fingerprints: requestFingerprints,
  }, env, fetcher);
  const parsed = parseConsent(result, input.purpose);
  if (!parsed) throw new AccountSyncServerFailure();
  return parsed;
}

async function putChart(
  userId: string,
  input: AccountChartPutInput,
  env: Environment,
  fetcher: Fetch,
  nowMs: number,
): Promise<Record<string, unknown>> {
  if (!isAdultAccountBirthDate(input.birth.date, nowMs)) {
    return { outcome: 'ineligible_age', minimum_age: ACCOUNT_SYNC_V2_MINIMUM_AGE };
  }
  const nextRevision = input.baseRevision + 1;
  const plaintext = serializeAccountPrivateChartPayload({
    label: input.label,
    birth: input.birth,
    derived: input.derived,
  });
  const requestFingerprints = accountMutationRequestVerifiers(putChartMutationPreimageV1({
    chartId: input.chartId,
    baseRevision: input.baseRevision,
    payloadSha256: sha256Hex(plaintext),
  }), env);
  let envelope: AccountEncryptedEnvelope;
  try {
    envelope = encryptAccountPrivatePayload(
      plaintext,
      { userId, chartId: input.chartId, revision: nextRevision },
      env,
    );
  } catch (error) {
    if (error instanceof AccountEncryptionFailure) throw new AccountSyncServerFailure();
    throw error;
  }
  const result = await rpc('account_v2_put_chart', {
    candidate_user_id: userId,
    candidate_device_id: input.deviceId,
    candidate_chart_id: input.chartId,
    candidate_base_revision: input.baseRevision,
    candidate_mutation_id: input.mutationId,
    candidate_request_fingerprints: requestFingerprints,
    candidate_subject_kind: 'self',
    candidate_subject_attestation: 'self_declared_v1',
    candidate_ciphertext: byteaHex(envelope.ciphertext),
    candidate_nonce: byteaHex(envelope.nonce),
    candidate_encryption_format: envelope.format,
    candidate_key_scope: envelope.keyScope,
    candidate_key_version: envelope.keyVersion,
    candidate_wrapped_key: byteaHex(envelope.wrappedKey),
  }, env, fetcher);
  const parsed = parsePut(result, input.chartId);
  if (!parsed) throw new AccountSyncServerFailure();
  return parsed;
}

async function deleteChart(
  userId: string,
  input: AccountChartDeleteInput,
  env: Environment,
  fetcher: Fetch,
): Promise<Record<string, unknown>> {
  const requestFingerprints = accountMutationRequestVerifiers(deleteChartMutationPreimageV1({
    chartId: input.chartId,
    baseRevision: input.baseRevision,
  }), env);
  const result = await rpc('account_v2_delete_chart', {
    candidate_user_id: userId,
    candidate_device_id: input.deviceId,
    candidate_chart_id: input.chartId,
    candidate_base_revision: input.baseRevision,
    candidate_mutation_id: input.mutationId,
    candidate_request_fingerprints: requestFingerprints,
  }, env, fetcher);
  const parsed = parseDelete(result, input.chartId);
  if (!parsed) throw new AccountSyncServerFailure();
  return parsed;
}

async function pull(
  userId: string,
  input: AccountPullInput,
  env: Environment,
  fetcher: Fetch,
): Promise<Record<string, unknown>> {
  let cursor = input.afterCursor;
  const latest = new Map<string, Record<string, unknown>>();
  for (let page = 0; page < MAX_PULL_PAGES; page += 1) {
    const result = await rpc('account_v2_pull', {
      candidate_user_id: userId,
      candidate_device_id: input.deviceId,
      candidate_after_seq: cursor,
      candidate_limit: PULL_PAGE_SIZE,
    }, env, fetcher);
    const parsed = parsePull(result, { ...input, afterCursor: cursor, limit: PULL_PAGE_SIZE });
    if (!parsed) throw new AccountSyncServerFailure();
    if (parsed.outcome !== 'ready') {
      if (page !== 0) throw new AccountSyncServerFailure();
      return parsed;
    }
    const changes = parsed.changes as Record<string, unknown>[];
    for (const change of changes) {
      const key = change.entity_type === 'chart'
        ? `chart:${String(change.entity_id)}`
        : String(change.entity_type);
      latest.set(key, change);
    }
    const nextCursor = parsed.next_cursor as number;
    if (parsed.has_more !== true) {
      return {
        outcome: 'ready',
        changes: [...latest.values()].sort((left, right) => (left.seq as number) - (right.seq as number)),
        next_cursor: nextCursor,
        has_more: false,
      };
    }
    if (nextCursor <= cursor || changes.length === 0) throw new AccountSyncServerFailure();
    cursor = nextCursor;
  }
  throw new AccountSyncServerFailure();
}

async function getChart(
  userId: string,
  input: AccountChartGetInput,
  env: Environment,
  fetcher: Fetch,
): Promise<Record<string, unknown>> {
  const result = await rpc('account_v2_get_chart', {
    candidate_user_id: userId,
    candidate_device_id: input.deviceId,
    candidate_chart_id: input.chartId,
  }, env, fetcher);
  const parsed = parseChart(result, input.chartId, userId, env);
  if (!parsed) throw new AccountSyncServerFailure();
  return parsed;
}

export async function executeAccountSync(
  user: AuthenticatedEmailUser,
  input: AccountSyncInput,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
  nowMs: number = Date.now(),
): Promise<Record<string, unknown>> {
  if (!isAccountUuid(user.id)) throw new AccountSyncServerFailure();
  const userId = user.id.toLowerCase();
  if (input.action === 'bootstrap') {
    // No v1 chart lookup: v1 cloud charts are retired and never block or
    // feed the v2 account (20261111170000).
    const recipientHash = dailySunRecipientHash(user.email, env);
    let encryptedLocator: AccountEncryptedEnvelope;
    try {
      encryptedLocator = encryptAccountDailySunAliasLocator(user.email, {
        userId,
        recipientHash,
      }, env);
    } catch (error) {
      if (error instanceof AccountEncryptionFailure) throw new AccountSyncServerFailure();
      throw error;
    }
    const result = await rpc('account_v2_bootstrap', {
      candidate_user_id: userId,
      candidate_device_id: input.deviceId,
      candidate_platform: 'web',
      candidate_daily_sun_recipient_hash: recipientHash,
      candidate_daily_sun_encrypted_locator: envelopeJson(encryptedLocator),
    }, env, fetcher);
    const parsed = parseBootstrap(result);
    if (!parsed) throw new AccountSyncServerFailure();
    return parsed;
  }
  if (input.action === 'consent') return consent(userId, input, env, fetcher);
  if (input.action === 'chart-put') return putChart(userId, input, env, fetcher, nowMs);
  if (input.action === 'chart-delete') return deleteChart(userId, input, env, fetcher);
  if (input.action === 'pull') return pull(userId, input, env, fetcher);
  return getChart(userId, input, env, fetcher);
}
