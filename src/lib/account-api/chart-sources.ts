import { Buffer } from 'node:buffer';
import {
  ACCOUNT_SYNC_V2_ENCRYPTION_FORMAT,
  ACCOUNT_SYNC_V2_KEY_SCOPE,
  decryptAccountPrivatePayload,
  type AccountEncryptedEnvelope,
} from './encryption.js';
import {
  parseSerializedAccountPrivateChartPayload,
  type AccountPrivateChartPayloadV1,
} from './sync-wire.js';

/**
 * Server and job access to the one encrypted self chart of an account, for
 * the three uses the launch allows and no other:
 *
 * - the daily and weekly emails, only for accounts that are active and hold
 *   BOTH chart_sync and chart_emails (account_v2_chart_email_sources);
 * - a compatibility invitation the owner creates during their own signed-in
 *   request (account_v2_owner_self_chart, chart_sync only).
 *
 * The database returns envelopes only. Decryption happens here, in memory,
 * with the service keyring from ACCOUNT_SYNC_V2_ENCRYPTION_KEYS and
 * ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION. Nothing in this module logs, and no
 * error it throws carries a label, a birth field or an email address.
 */

type Environment = Record<string, unknown>;
type Fetch = typeof fetch;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_SOURCE_IDS = 500;
const MAX_CIPHERTEXT_BYTES = 16 * 1024 + 16;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

export class AccountChartSourceFailure extends Error {
  constructor() {
    super('Account chart sources are unavailable.');
    this.name = 'AccountChartSourceFailure';
  }
}

export interface AccountChartSource {
  userId: string;
  chartId: string;
  revision: number;
  envelope: AccountEncryptedEnvelope;
}

export interface AccountChartSourceConnection {
  supabaseUrl: string;
  serviceKey: string;
  fetcher?: Fetch;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}

function hasExactKeys(input: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(input).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

/** Postgres base64 wraps at 76 columns; the bytes must otherwise be canonical. */
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

function revision(input: unknown): number | null {
  return Number.isSafeInteger(input) && (input as number) >= 1 ? input as number : null;
}

function envelopeFrom(input: {
  ciphertext: unknown;
  nonce: unknown;
  format: unknown;
  keyScope: unknown;
  keyVersion: unknown;
  wrappedKey: unknown;
}): AccountEncryptedEnvelope | null {
  if (input.format !== ACCOUNT_SYNC_V2_ENCRYPTION_FORMAT
    || input.keyScope !== ACCOUNT_SYNC_V2_KEY_SCOPE) return null;
  const ciphertext = canonicalBase64(input.ciphertext, 17, MAX_CIPHERTEXT_BYTES);
  const nonce = canonicalBase64(input.nonce, 12, 12);
  const wrappedKey = canonicalBase64(input.wrappedKey, 68, 68);
  const keyVersion = Number.isSafeInteger(input.keyVersion)
    && (input.keyVersion as number) >= 1
    && (input.keyVersion as number) <= 1_000_000
    ? input.keyVersion as number
    : null;
  return ciphertext && nonce && wrappedKey && keyVersion
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

function origin(supabaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(supabaseUrl.trim());
  } catch {
    throw new AccountChartSourceFailure();
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) {
    throw new AccountChartSourceFailure();
  }
  return url.origin;
}

async function rpc(
  name: string,
  body: Record<string, unknown>,
  connection: AccountChartSourceConnection,
): Promise<unknown> {
  const key = connection.serviceKey.trim();
  if (!key) throw new AccountChartSourceFailure();
  const fetcher = connection.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(`${origin(connection.supabaseUrl)}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AccountChartSourceFailure();
  }
  if (!response.ok) throw new AccountChartSourceFailure();
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new AccountChartSourceFailure();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AccountChartSourceFailure();
  }
}

/** Strictly parses account_v2_chart_email_sources rows; only requested ids may appear. */
export function parseChartEmailSourceRows(
  input: unknown,
  requested: ReadonlySet<string>,
): AccountChartSource[] {
  if (!Array.isArray(input) || input.length > requested.size) throw new AccountChartSourceFailure();
  const seen = new Set<string>();
  return input.map((row) => {
    if (!isRecord(row)
      || !hasExactKeys(row, [
        'user_id', 'chart_id', 'revision', 'ciphertext', 'nonce', 'format',
        'key_scope', 'key_version', 'wrapped_key',
      ])
      || typeof row.user_id !== 'string'
      || !UUID.test(row.user_id)
      || typeof row.chart_id !== 'string'
      || !UUID.test(row.chart_id)) throw new AccountChartSourceFailure();
    const userId = row.user_id.toLowerCase();
    const parsedRevision = revision(row.revision);
    const envelope = envelopeFrom({
      ciphertext: row.ciphertext,
      nonce: row.nonce,
      format: row.format,
      keyScope: row.key_scope,
      keyVersion: row.key_version,
      wrappedKey: row.wrapped_key,
    });
    if (!requested.has(userId) || seen.has(userId) || !parsedRevision || !envelope) {
      throw new AccountChartSourceFailure();
    }
    seen.add(userId);
    return { userId, chartId: row.chart_id.toLowerCase(), revision: parsedRevision, envelope };
  });
}

/**
 * The encrypted self charts of the listed accounts that currently hold both
 * chart_sync and chart_emails. Accounts without both consents are simply
 * absent. Calls are batched at the RPC's 500-id bound.
 */
export async function loadChartEmailSources(
  userIds: readonly string[],
  connection: AccountChartSourceConnection,
): Promise<Map<string, AccountChartSource>> {
  const unique = [...new Set(userIds.map((id) => id.toLowerCase()))];
  if (unique.some((id) => !UUID.test(id))) throw new AccountChartSourceFailure();
  const sources = new Map<string, AccountChartSource>();
  for (let offset = 0; offset < unique.length; offset += MAX_SOURCE_IDS) {
    const batch = unique.slice(offset, offset + MAX_SOURCE_IDS);
    const rows = parseChartEmailSourceRows(
      await rpc('account_v2_chart_email_sources', { candidate_user_ids: batch }, connection),
      new Set(batch),
    );
    for (const row of rows) sources.set(row.userId, row);
  }
  return sources;
}

/** The owner's own encrypted self chart while chart_sync is granted, or null. */
export async function loadOwnerSelfChartSource(
  userId: string,
  connection: AccountChartSourceConnection,
): Promise<AccountChartSource | null> {
  if (!UUID.test(userId)) return null;
  const result = await rpc('account_v2_owner_self_chart', {
    candidate_user_id: userId.toLowerCase(),
  }, connection);
  if (isRecord(result)
    && hasExactKeys(result, ['outcome'])
    && (result.outcome === 'not_found' || result.outcome === 'invalid')) return null;
  if (!isRecord(result)
    || !hasExactKeys(result, ['outcome', 'chart_id', 'revision', 'encrypted_source'])
    || result.outcome !== 'ready'
    || typeof result.chart_id !== 'string'
    || !UUID.test(result.chart_id)
    || !isRecord(result.encrypted_source)
    || !hasExactKeys(result.encrypted_source, [
      'ciphertext', 'nonce', 'format', 'key_scope', 'key_version', 'wrapped_key',
    ])) throw new AccountChartSourceFailure();
  const source = result.encrypted_source;
  const parsedRevision = revision(result.revision);
  const envelope = envelopeFrom({
    ciphertext: source.ciphertext,
    nonce: source.nonce,
    format: source.format,
    keyScope: source.key_scope,
    keyVersion: source.key_version,
    wrappedKey: source.wrapped_key,
  });
  if (!parsedRevision || !envelope) throw new AccountChartSourceFailure();
  return {
    userId: userId.toLowerCase(),
    chartId: result.chart_id.toLowerCase(),
    revision: parsedRevision,
    envelope,
  };
}

/**
 * Decrypts one source in memory. Any failure (missing or rotated-out key,
 * tampered envelope, wrong binding, invalid payload) returns null so a caller
 * can fall back or skip that one account; it never throws a detail.
 */
export function decryptAccountChartSource(
  source: AccountChartSource,
  env: Environment,
): AccountPrivateChartPayloadV1 | null {
  try {
    const plaintext = decryptAccountPrivatePayload(source.envelope, {
      userId: source.userId,
      chartId: source.chartId,
      revision: source.revision,
    }, env);
    return parseSerializedAccountPrivateChartPayload(plaintext);
  } catch {
    return null;
  }
}

/** Planet order of the stored positions (b). Mirrors POSITION_BODY_ORDER. */
export const ACCOUNT_CHART_BODY_ORDER = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter',
  'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node',
] as const;

/** The stored natal longitudes, named. No birth field is read. */
export function accountChartBodies(
  payload: AccountPrivateChartPayloadV1,
): Array<{ body: string; lon: number }> {
  return ACCOUNT_CHART_BODY_ORDER.map((body, index) => ({
    body,
    lon: payload.derived.positions.b[index]!,
  }));
}
