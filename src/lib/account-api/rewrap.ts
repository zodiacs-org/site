import { Buffer } from 'node:buffer';
import {
  ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION_ENV,
  AccountEncryptionFailure,
  rewrapAccountDailySunAliasLocatorKey,
  rewrapAccountDeletionProviderPayloadKey,
  rewrapAccountPrivatePayloadKey,
  type AccountRewrappedKey,
} from './encryption.js';

/**
 * Re-wraps Account Sync v2 data keys from an old service key version to the
 * active one (docs/ACCOUNT-SYNC-V2-KEY-ROTATION.md). Only wrapped data keys
 * move: ciphertext and nonces stay in the database and no payload is
 * decrypted. Dry run unless `apply` is set. Output is counts and row ids only,
 * never key material, wrapped keys or plaintext.
 */

type Environment = Record<string, unknown>;

export const ACCOUNT_REWRAP_KINDS = ['chart', 'alias', 'provider'] as const;
export type AccountRewrapKind = typeof ACCOUNT_REWRAP_KINDS[number];

export type AccountRewrapRpc = (name: string, body: Record<string, unknown>) => Promise<unknown>;

export interface AccountRewrapOptions {
  fromVersion: number;
  kinds: readonly AccountRewrapKind[];
  batchSize: number;
  maxBatches: number;
  apply: boolean;
}

export interface AccountRewrapKindReport {
  kind: AccountRewrapKind;
  listed: number;
  rewrappable: number;
  failedIds: string[];
  updated: number;
  skipped: number;
}

export interface AccountRewrapReport {
  apply: boolean;
  fromVersion: number;
  activeVersion: number;
  kinds: AccountRewrapKindReport[];
}

export class AccountRewrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountRewrapError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const RECIPIENT_HASH = /^[0-9a-f]{64}$/u;
const MAX_BATCH = 500;
const MAX_VERSION = 1_000_000;

interface CandidateRow {
  id: string;
  ids: Record<string, string | number>;
  keyVersion: number;
  wrappedKey: Buffer;
  rewrap: (env: Environment) => AccountRewrappedKey;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}

function exactKeys(input: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(input).sort();
  const wanted = [...keys].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function wrappedKeyBytes(input: unknown): Buffer | null {
  if (typeof input !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/u.test(input)) return null;
  const bytes = Buffer.from(input, 'base64');
  return bytes.byteLength === 68 && bytes.toString('base64') === input ? bytes : null;
}

function version(input: unknown): number | null {
  return Number.isSafeInteger(input) && (input as number) >= 1 && (input as number) <= MAX_VERSION
    ? input as number
    : null;
}

function parseCandidate(kind: AccountRewrapKind, row: unknown, fromVersion: number): CandidateRow {
  const invalid = () => new AccountRewrapError(`the ${kind} candidate list has an unexpected row`);
  if (!isRecord(row)) throw invalid();
  const keyVersion = version(row.key_version);
  const wrappedKey = wrappedKeyBytes(row.wrapped_key);
  if (keyVersion !== fromVersion || !wrappedKey) throw invalid();

  if (kind === 'chart') {
    if (!exactKeys(row, ['user_id', 'chart_id', 'revision', 'key_version', 'wrapped_key'])
      || typeof row.user_id !== 'string' || !UUID.test(row.user_id)
      || typeof row.chart_id !== 'string' || !UUID.test(row.chart_id)
      || !Number.isSafeInteger(row.revision) || (row.revision as number) < 1) throw invalid();
    const userId = row.user_id;
    const chartId = row.chart_id;
    const revision = row.revision as number;
    return {
      id: `chart ${userId}/${chartId} revision ${revision}`,
      ids: { user_id: userId, chart_id: chartId, revision },
      keyVersion,
      wrappedKey,
      rewrap: (env) => rewrapAccountPrivatePayloadKey(wrappedKey, keyVersion, { userId, chartId, revision }, env),
    };
  }

  if (!exactKeys(row, [kind === 'alias' ? 'user_id' : 'request_id', 'recipient_hash', 'key_version', 'wrapped_key'])
    || typeof row.recipient_hash !== 'string' || !RECIPIENT_HASH.test(row.recipient_hash)) throw invalid();
  const recipientHash = row.recipient_hash;
  if (kind === 'alias') {
    if (typeof row.user_id !== 'string' || !UUID.test(row.user_id)) throw invalid();
    const userId = row.user_id;
    return {
      id: `alias ${userId}/${recipientHash.slice(0, 12)}`,
      ids: { user_id: userId, recipient_hash: recipientHash },
      keyVersion,
      wrappedKey,
      rewrap: (env) => rewrapAccountDailySunAliasLocatorKey(wrappedKey, keyVersion, { userId, recipientHash }, env),
    };
  }
  if (typeof row.request_id !== 'string' || !UUID.test(row.request_id)) throw invalid();
  const requestId = row.request_id;
  return {
    id: `provider ${requestId}/${recipientHash.slice(0, 12)}`,
    ids: { request_id: requestId, recipient_hash: recipientHash },
    keyVersion,
    wrappedKey,
    rewrap: (env) => rewrapAccountDeletionProviderPayloadKey(wrappedKey, keyVersion, { requestId, recipientHash }, env),
  };
}

function activeVersion(env: Environment): number {
  const raw = env[ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION_ENV];
  const parsed = typeof raw === 'string' && /^[1-9][0-9]{0,6}$/u.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed > MAX_VERSION) {
    throw new AccountRewrapError(`${ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION_ENV} is not set to a key version`);
  }
  return parsed;
}

async function listCandidates(
  rpc: AccountRewrapRpc,
  kind: AccountRewrapKind,
  fromVersion: number,
  batchSize: number,
): Promise<CandidateRow[]> {
  const result = await rpc('account_v2_rewrap_candidates', {
    candidate_kind: kind,
    candidate_key_version: fromVersion,
    candidate_limit: batchSize,
  });
  if (!isRecord(result) || result.outcome !== 'ready' || !Array.isArray(result.rows)
    || result.rows.length > batchSize) {
    throw new AccountRewrapError(`the ${kind} candidate list was refused`);
  }
  return result.rows.map((row) => parseCandidate(kind, row, fromVersion));
}

async function applyBatch(
  rpc: AccountRewrapRpc,
  kind: AccountRewrapKind,
  rows: Array<{ candidate: CandidateRow; next: AccountRewrappedKey }>,
): Promise<{ updated: number; skipped: number }> {
  const result = await rpc('account_v2_rewrap_apply', {
    candidate_kind: kind,
    candidate_rows: rows.map(({ candidate, next }) => ({
      ...candidate.ids,
      old_key_version: candidate.keyVersion,
      old_wrapped_key: candidate.wrappedKey.toString('base64'),
      new_key_version: next.keyVersion,
      new_wrapped_key: next.wrappedKey.toString('base64'),
    })),
  });
  if (!isRecord(result) || result.outcome !== 'applied'
    || !Number.isSafeInteger(result.updated) || !Number.isSafeInteger(result.skipped)
    || (result.updated as number) + (result.skipped as number) !== rows.length) {
    throw new AccountRewrapError(`the ${kind} apply call was refused`);
  }
  return { updated: result.updated as number, skipped: result.skipped as number };
}

export async function runAccountKeyRewrap(
  options: AccountRewrapOptions,
  rpc: AccountRewrapRpc,
  env: Environment,
  log: (line: string) => void,
): Promise<AccountRewrapReport> {
  const { fromVersion, kinds, batchSize, maxBatches, apply } = options;
  if (version(fromVersion) === null) throw new AccountRewrapError('--from must be a key version');
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH) {
    throw new AccountRewrapError(`--batch must be 1 to ${MAX_BATCH}`);
  }
  if (!Number.isSafeInteger(maxBatches) || maxBatches < 1 || maxBatches > 10_000) {
    throw new AccountRewrapError('--batches must be 1 to 10000');
  }
  if (kinds.length < 1 || kinds.some((kind) => !ACCOUNT_REWRAP_KINDS.includes(kind))) {
    throw new AccountRewrapError(`--kind must be ${ACCOUNT_REWRAP_KINDS.join(', ')} or all`);
  }
  const active = activeVersion(env);
  if (active === fromVersion) {
    throw new AccountRewrapError('--from is the active key version; there is nothing to re-wrap');
  }

  log(`${apply ? 'apply' : 'dry run'}: re-wrap key version ${fromVersion} to ${active}, batch ${batchSize}, at most ${maxBatches} batches per kind`);
  const reports: AccountRewrapKindReport[] = [];
  for (const kind of kinds) {
    const report: AccountRewrapKindReport = {
      kind, listed: 0, rewrappable: 0, failedIds: [], updated: 0, skipped: 0,
    };
    const failed = new Set<string>();
    for (let batch = 1; batch <= maxBatches; batch += 1) {
      const candidates = await listCandidates(rpc, kind, fromVersion, batchSize);
      if (candidates.length === 0) break;
      const ready: Array<{ candidate: CandidateRow; next: AccountRewrappedKey }> = [];
      for (const candidate of candidates) {
        if (failed.has(candidate.id)) continue;
        report.listed += 1;
        try {
          ready.push({ candidate, next: candidate.rewrap(env) });
          log(`${apply ? 'rewrap' : 'would rewrap'} ${candidate.id}`);
        } catch (error) {
          if (!(error instanceof AccountEncryptionFailure)) throw error;
          failed.add(candidate.id);
          log(`cannot rewrap ${candidate.id}`);
        }
      }
      report.rewrappable += ready.length;
      // A dry run changes nothing, so a second page would list the same rows.
      if (!apply || ready.length === 0) break;
      const applied = await applyBatch(rpc, kind, ready);
      report.updated += applied.updated;
      report.skipped += applied.skipped;
      log(`${kind} batch ${batch}: updated ${applied.updated}, skipped ${applied.skipped}`);
      if (applied.updated === 0) break;
    }
    report.failedIds.push(...[...failed].sort());
    log(`${kind}: listed ${report.listed}, rewrappable ${report.rewrappable}, failed ${report.failedIds.length}, updated ${report.updated}, skipped ${report.skipped}`);
    reports.push(report);
  }
  return { apply, fromVersion, activeVersion: active, kinds: reports };
}

/** Row counts per kind and key version, for the before and after evidence. */
export async function accountKeyVersionInventory(
  rpc: AccountRewrapRpc,
): Promise<Array<{ kind: AccountRewrapKind; keyVersion: number; rows: number }>> {
  const result = await rpc('account_v2_key_version_inventory', {});
  if (!Array.isArray(result)) throw new AccountRewrapError('the key version inventory was refused');
  return result.map((row) => {
    if (!isRecord(row) || !exactKeys(row, ['kind', 'key_version', 'rows'])
      || !ACCOUNT_REWRAP_KINDS.includes(row.kind as AccountRewrapKind)
      || version(row.key_version) === null
      || !Number.isSafeInteger(row.rows) || (row.rows as number) < 0) {
      throw new AccountRewrapError('the key version inventory has an unexpected row');
    }
    return { kind: row.kind as AccountRewrapKind, keyVersion: row.key_version as number, rows: row.rows as number };
  });
}
