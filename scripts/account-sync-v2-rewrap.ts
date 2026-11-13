/**
 * Re-wraps Account Sync v2 service envelopes from an old key version to the
 * active one. Runbook: docs/ACCOUNT-SYNC-V2-KEY-ROTATION.md.
 *
 *   npx vite-node --script scripts/account-sync-v2-rewrap.ts -- --from 1
 *   npx vite-node --script scripts/account-sync-v2-rewrap.ts -- --from 1 --apply
 *
 * Options: --from <version> (required), --kind chart|alias|provider|all
 * (default all), --batch <1-500> (default 100), --batches <n> per kind
 * (default 50), --apply (default is a dry run that writes nothing).
 *
 * Reads PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * ACCOUNT_SYNC_V2_ENCRYPTION_KEYS and ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION from
 * the shell environment only (no .env file). The keyring must hold both the
 * old version and the active one. Prints counts and row ids only: never a key,
 * a wrapped key, ciphertext or plaintext. Idempotent: every write is a
 * compare-and-swap, and a second run finds nothing left to re-wrap.
 */
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { accountSupabaseOrigin } from '../src/lib/account-api/server';
import {
  ACCOUNT_REWRAP_KINDS,
  AccountRewrapError,
  accountKeyVersionInventory,
  runAccountKeyRewrap,
  type AccountRewrapKind,
  type AccountRewrapRpc,
} from '../src/lib/account-api/rewrap';

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

export function parseRewrapArgs(argv: readonly string[]): {
  fromVersion: number;
  kinds: AccountRewrapKind[];
  batchSize: number;
  maxBatches: number;
  apply: boolean;
} {
  const args = argv.filter((arg) => arg !== '--');
  const valueOf = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    if (index === -1) return undefined;
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) throw new AccountRewrapError(`${flag} needs a value`);
    return value;
  };
  const known = new Set(['--from', '--kind', '--batch', '--batches', '--apply']);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!known.has(arg)) throw new AccountRewrapError(`unknown argument ${JSON.stringify(arg)}`);
    if (arg !== '--apply') index += 1;
  }
  const integer = (flag: string, fallback?: number): number => {
    const raw = valueOf(flag);
    if (raw === undefined) {
      if (fallback === undefined) throw new AccountRewrapError(`${flag} is required`);
      return fallback;
    }
    if (!/^[1-9][0-9]{0,6}$/u.test(raw)) throw new AccountRewrapError(`${flag} must be a positive whole number`);
    return Number(raw);
  };
  const kind = valueOf('--kind') ?? 'all';
  const kinds = kind === 'all'
    ? [...ACCOUNT_REWRAP_KINDS]
    : ACCOUNT_REWRAP_KINDS.includes(kind as AccountRewrapKind)
      ? [kind as AccountRewrapKind]
      : (() => { throw new AccountRewrapError(`--kind must be ${ACCOUNT_REWRAP_KINDS.join(', ')} or all`); })();
  return {
    fromVersion: integer('--from'),
    kinds,
    batchSize: integer('--batch', 100),
    maxBatches: integer('--batches', 50),
    apply: args.includes('--apply'),
  };
}

export function serviceRpc(env: Record<string, unknown>, fetcher: typeof fetch = fetch): AccountRewrapRpc {
  const origin = accountSupabaseOrigin(env);
  const key = typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string' ? env.SUPABASE_SERVICE_ROLE_KEY.trim() : '';
  if (key.length < 16) throw new AccountRewrapError('SUPABASE_SERVICE_ROLE_KEY is not set');
  return async (name, body) => {
    const response = await fetcher(`${origin}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new AccountRewrapError(`${name} answered HTTP ${response.status}`);
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new AccountRewrapError(`${name} answered with too much data`);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new AccountRewrapError(`${name} did not answer JSON`);
    }
  };
}

async function main(): Promise<void> {
  const options = parseRewrapArgs(process.argv.slice(2));
  const rpc = serviceRpc(process.env);
  const log = (line: string) => console.log(line);
  const printInventory = async (label: string) => {
    for (const row of await accountKeyVersionInventory(rpc)) {
      log(`${label}: ${row.kind} key version ${row.keyVersion}: ${row.rows} rows`);
    }
  };
  await printInventory('before');
  const report = await runAccountKeyRewrap(options, rpc, process.env, log);
  if (report.apply) await printInventory('after');
  if (report.kinds.some((kind) => kind.failedIds.length > 0)) process.exitCode = 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((error: unknown) => {
    // Fixed messages only: AccountRewrapError text carries no key or payload.
    console.error(error instanceof AccountRewrapError ? error.message : 'account key rewrap failed');
    process.exitCode = 1;
  });
}
