import { Buffer } from 'node:buffer';
import { randomBytes, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  AccountEncryptionFailure,
  decryptAccountDailySunAliasLocator,
  decryptAccountDeletionProviderPayload,
  decryptAccountPrivatePayload,
  encryptAccountDailySunAliasLocator,
  encryptAccountDeletionProviderPayload,
  encryptAccountPrivatePayload,
  rewrapAccountPrivatePayloadKey,
  type AccountEncryptedEnvelope,
} from './encryption';
import {
  AccountRewrapError,
  accountKeyVersionInventory,
  runAccountKeyRewrap,
  wrappedKeyBytes,
  type AccountRewrapKind,
  type AccountRewrapOptions,
} from './rewrap';
import { parseRewrapArgs, serviceRpc } from '../../../scripts/account-sync-v2-rewrap';

// Throwaway keys, made for this test run only.
const OLD_KEY = randomBytes(32).toString('base64');
const NEW_KEY = randomBytes(32).toString('base64');
const OLD_ENV = {
  ACCOUNT_SYNC_V2_ENCRYPTION_KEYS: JSON.stringify({ 1: OLD_KEY }),
  ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION: '1',
};
const ROTATING_ENV = {
  ACCOUNT_SYNC_V2_ENCRYPTION_KEYS: JSON.stringify({ 1: OLD_KEY, 2: NEW_KEY }),
  ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION: '2',
};
const NEW_ONLY_ENV = {
  ACCOUNT_SYNC_V2_ENCRYPTION_KEYS: JSON.stringify({ 2: NEW_KEY }),
  ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION: '2',
};

const CHART_PLAINTEXT = '{"label":"Rewrap test chart"}';
const EMAIL = 'rewrap-test@example.com';
const hash = (fill: string) => fill.repeat(64);

interface StoredRow {
  kind: AccountRewrapKind;
  ids: Record<string, string | number>;
  envelope: AccountEncryptedEnvelope;
}

function fixture() {
  const rows: StoredRow[] = [];
  for (let index = 0; index < 3; index += 1) {
    const userId = randomUUID();
    const chartId = randomUUID();
    rows.push({
      kind: 'chart',
      ids: { user_id: userId, chart_id: chartId, revision: index + 1 },
      envelope: encryptAccountPrivatePayload(CHART_PLAINTEXT, { userId, chartId, revision: index + 1 }, OLD_ENV),
    });
  }
  const aliasUser = randomUUID();
  rows.push({
    kind: 'alias',
    ids: { user_id: aliasUser, recipient_hash: hash('a') },
    envelope: encryptAccountDailySunAliasLocator(EMAIL, { userId: aliasUser, recipientHash: hash('a') }, OLD_ENV),
  });
  const requestId = randomUUID();
  rows.push({
    kind: 'provider',
    ids: { request_id: requestId, recipient_hash: hash('b') },
    envelope: encryptAccountDeletionProviderPayload(EMAIL, { requestId, recipientHash: hash('b') }, OLD_ENV),
  });
  return rows;
}

// PostgreSQL's encode(bytes, 'base64'): a newline after every 76 characters.
// The migration strips them from the candidate list; the fake keeps them, so
// the tool is tested against the raw server form too.
function pgBase64(bytes: Buffer): string {
  return bytes.toString('base64').replace(/(.{76})(?=.)/gu, '$1\n');
}

// An in-memory stand-in for the three service RPCs, with the same
// compare-and-swap rule as the migration (decode() ignores line breaks, so
// the old wrapped key is compared as bytes).
function fakeDatabase(rows: StoredRow[]) {
  const calls: Array<{ name: string; body: Record<string, unknown> }> = [];
  const rpc = vi.fn(async (name: string, body: Record<string, unknown>) => {
    calls.push({ name, body });
    if (name === 'account_v2_key_version_inventory') {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const key = `${row.kind}:${row.envelope.keyVersion}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts].map(([key, count]) => {
        const [kind, version] = key.split(':');
        return { kind, key_version: Number(version), rows: count };
      });
    }
    if (name === 'account_v2_rewrap_candidates') {
      return {
        outcome: 'ready',
        rows: rows
          .filter((row) => row.kind === body.candidate_kind && row.envelope.keyVersion === body.candidate_key_version)
          .slice(0, body.candidate_limit as number)
          .map((row) => ({
            ...row.ids,
            key_version: row.envelope.keyVersion,
            wrapped_key: pgBase64(row.envelope.wrappedKey),
          })),
      };
    }
    if (name === 'account_v2_rewrap_apply') {
      let updated = 0;
      let skipped = 0;
      for (const candidate of body.candidate_rows as Array<Record<string, unknown>>) {
        const row = rows.find((stored) => stored.kind === body.candidate_kind
          && Object.entries(stored.ids).every(([key, value]) => candidate[key] === value)
          && stored.envelope.keyVersion === candidate.old_key_version
          && stored.envelope.wrappedKey.equals(Buffer.from(candidate.old_wrapped_key as string, 'base64')));
        if (!row) {
          skipped += 1;
          continue;
        }
        row.envelope = {
          ...row.envelope,
          keyVersion: candidate.new_key_version as number,
          wrappedKey: Buffer.from(candidate.new_wrapped_key as string, 'base64'),
        };
        updated += 1;
      }
      return { outcome: 'applied', updated, skipped };
    }
    throw new Error(`unexpected rpc ${name}`);
  });
  return { rpc, calls };
}

function decryptAll(rows: StoredRow[], env: Record<string, unknown>): string[] {
  return rows.map((row) => {
    if (row.kind === 'chart') {
      return decryptAccountPrivatePayload(row.envelope, {
        userId: row.ids.user_id as string,
        chartId: row.ids.chart_id as string,
        revision: row.ids.revision as number,
      }, env);
    }
    if (row.kind === 'alias') {
      return decryptAccountDailySunAliasLocator(row.envelope, {
        userId: row.ids.user_id as string,
        recipientHash: row.ids.recipient_hash as string,
      }, env);
    }
    return decryptAccountDeletionProviderPayload(row.envelope, {
      requestId: row.ids.request_id as string,
      recipientHash: row.ids.recipient_hash as string,
    }, env);
  });
}

const OPTIONS: AccountRewrapOptions = {
  fromVersion: 1,
  kinds: ['chart', 'alias', 'provider'],
  batchSize: 100,
  maxBatches: 50,
  apply: false,
};

function secretsIn(rows: StoredRow[]): string[] {
  return [
    OLD_KEY,
    NEW_KEY,
    CHART_PLAINTEXT,
    'Rewrap test chart',
    EMAIL,
    ...rows.flatMap((row) => [
      row.envelope.wrappedKey.toString('base64'),
      row.envelope.ciphertext.toString('base64'),
    ]),
  ];
}

describe('account key rewrap', () => {
  it('re-wraps only the data key: ciphertext and nonce stay, the old key is no longer needed', () => {
    const userId = randomUUID();
    const chartId = randomUUID();
    const envelope = encryptAccountPrivatePayload(CHART_PLAINTEXT, { userId, chartId, revision: 4 }, OLD_ENV);
    const next = rewrapAccountPrivatePayloadKey(envelope.wrappedKey, 1, { userId, chartId, revision: 4 }, ROTATING_ENV);
    expect(next.keyVersion).toBe(2);
    expect(next.wrappedKey.equals(envelope.wrappedKey)).toBe(false);
    expect(decryptAccountPrivatePayload(
      { ...envelope, keyVersion: next.keyVersion, wrappedKey: next.wrappedKey },
      { userId, chartId, revision: 4 },
      NEW_ONLY_ENV,
    )).toBe(CHART_PLAINTEXT);

    // Bound to its context: another revision cannot unwrap it.
    expect(() => rewrapAccountPrivatePayloadKey(envelope.wrappedKey, 1, { userId, chartId, revision: 5 }, ROTATING_ENV))
      .toThrow(AccountEncryptionFailure);
    // Already under the active version: refused, never a silent no-op.
    expect(() => rewrapAccountPrivatePayloadKey(next.wrappedKey, 2, { userId, chartId, revision: 4 }, ROTATING_ENV))
      .toThrow(AccountEncryptionFailure);
    // The keyring must still hold the old version.
    expect(() => rewrapAccountPrivatePayloadKey(envelope.wrappedKey, 1, { userId, chartId, revision: 4 }, NEW_ONLY_ENV))
      .toThrow(AccountEncryptionFailure);
  });

  it('reads a wrapped key exactly as PostgreSQL 17 encodes it, with or without its line break', () => {
    // Verbatim from PostgreSQL 17.11:
    //   select to_jsonb(encode(decode(repeat('a7', 68), 'hex'), 'base64'))::text
    // (the candidate RPC before it removed line breaks), and the same value
    // with translate(..., E'\n\r', '') as the candidate RPC now returns it.
    const raw = JSON.parse('"p6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6en\\np6enp6enp6enp6c="') as string;
    const unbroken = JSON.parse('"p6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6c="') as string;
    const expected = Buffer.alloc(68, 0xa7);
    expect(raw).toHaveLength(93);
    expect(raw.indexOf('\n')).toBe(76);
    expect(pgBase64(expected)).toBe(raw);
    expect(wrappedKeyBytes(raw)?.equals(expected)).toBe(true);
    expect(wrappedKeyBytes(raw.replace('\n', '\r\n'))?.equals(expected)).toBe(true);
    expect(wrappedKeyBytes(unbroken)?.equals(expected)).toBe(true);
    // Only line breaks are tolerated; anything else still fails closed.
    expect(wrappedKeyBytes(raw.replace('\n', ' '))).toBeNull();
    expect(wrappedKeyBytes(raw.replace('\n', '\t'))).toBeNull();
    expect(wrappedKeyBytes(`${unbroken}AA==`)).toBeNull();
    expect(wrappedKeyBytes(unbroken.slice(0, -4))).toBeNull();
  });

  it('writes nothing in a dry run and prints only counts and ids', async () => {
    const rows = fixture();
    const before = rows.map((row) => row.envelope.wrappedKey.toString('base64'));
    const { rpc, calls } = fakeDatabase(rows);
    const lines: string[] = [];
    const report = await runAccountKeyRewrap(OPTIONS, rpc, ROTATING_ENV, (line) => lines.push(line));

    expect(calls.some(({ name }) => name === 'account_v2_rewrap_apply')).toBe(false);
    expect(rows.map((row) => row.envelope.wrappedKey.toString('base64'))).toEqual(before);
    expect(report.kinds.map(({ kind, listed, rewrappable, updated }) => ({ kind, listed, rewrappable, updated })))
      .toEqual([
        { kind: 'chart', listed: 3, rewrappable: 3, updated: 0 },
        { kind: 'alias', listed: 1, rewrappable: 1, updated: 0 },
        { kind: 'provider', listed: 1, rewrappable: 1, updated: 0 },
      ]);
    expect(lines.filter((line) => line.startsWith('would rewrap '))).toHaveLength(5);
    const output = lines.join('\n');
    for (const secret of secretsIn(rows)) expect(output).not.toContain(secret);
  });

  it('applies in batches, is idempotent, and leaves every record readable under the new key only', async () => {
    const rows = fixture();
    const { rpc } = fakeDatabase(rows);
    const lines: string[] = [];

    const limited = await runAccountKeyRewrap(
      { ...OPTIONS, kinds: ['chart'], apply: true, batchSize: 2, maxBatches: 1 },
      rpc,
      ROTATING_ENV,
      (line) => lines.push(line),
    );
    expect(limited.kinds[0]).toMatchObject({ listed: 2, updated: 2, skipped: 0 });
    expect(rows.filter((row) => row.kind === 'chart' && row.envelope.keyVersion === 1)).toHaveLength(1);

    const full = await runAccountKeyRewrap({ ...OPTIONS, apply: true, batchSize: 2 }, rpc, ROTATING_ENV, (line) => lines.push(line));
    expect(full.kinds.map(({ kind, updated, failedIds }) => ({ kind, updated, failed: failedIds.length }))).toEqual([
      { kind: 'chart', updated: 1, failed: 0 },
      { kind: 'alias', updated: 1, failed: 0 },
      { kind: 'provider', updated: 1, failed: 0 },
    ]);
    expect(rows.every((row) => row.envelope.keyVersion === 2)).toBe(true);
    expect(decryptAll(rows, NEW_ONLY_ENV)).toEqual([
      CHART_PLAINTEXT, CHART_PLAINTEXT, CHART_PLAINTEXT, EMAIL, EMAIL,
    ]);

    const again = await runAccountKeyRewrap({ ...OPTIONS, apply: true }, rpc, ROTATING_ENV, (line) => lines.push(line));
    expect(again.kinds.every((kind) => kind.listed === 0 && kind.updated === 0)).toBe(true);
    expect(await accountKeyVersionInventory(rpc)).toEqual([
      { kind: 'chart', keyVersion: 2, rows: 3 },
      { kind: 'alias', keyVersion: 2, rows: 1 },
      { kind: 'provider', keyVersion: 2, rows: 1 },
    ]);

    const output = lines.join('\n');
    for (const secret of secretsIn(rows)) expect(output).not.toContain(secret);
  });

  it('reports a row it cannot unwrap by id and still re-wraps the rest', async () => {
    const rows = fixture();
    const broken = rows[0];
    broken.envelope = { ...broken.envelope, wrappedKey: Buffer.from(randomBytes(68)) };
    broken.envelope.wrappedKey.write('ZK01', 0, 'ascii');
    broken.envelope.wrappedKey.writeUInt32BE(1, 4);
    const { rpc } = fakeDatabase(rows);
    const lines: string[] = [];
    const report = await runAccountKeyRewrap(
      { ...OPTIONS, kinds: ['chart'], apply: true, batchSize: 2 },
      rpc,
      ROTATING_ENV,
      (line) => lines.push(line),
    );
    expect(report.kinds[0].updated).toBe(2);
    expect(report.kinds[0].failedIds).toEqual([
      `chart ${broken.ids.user_id}/${broken.ids.chart_id} revision ${broken.ids.revision}`,
    ]);
    expect(lines).toContain(`cannot rewrap ${report.kinds[0].failedIds[0]}`);
  });

  it('skips a row that changed between listing and applying', async () => {
    const rows = fixture().filter((row) => row.kind === 'chart').slice(0, 1);
    const { rpc } = fakeDatabase(rows);
    const racing = vi.fn(async (name: string, body: Record<string, unknown>) => {
      if (name === 'account_v2_rewrap_apply') {
        // The owner saved a new revision meanwhile.
        rows[0].envelope = encryptAccountPrivatePayload(CHART_PLAINTEXT, {
          userId: rows[0].ids.user_id as string,
          chartId: rows[0].ids.chart_id as string,
          revision: rows[0].ids.revision as number,
        }, OLD_ENV);
      }
      return rpc(name, body);
    });
    const report = await runAccountKeyRewrap({ ...OPTIONS, kinds: ['chart'], apply: true, maxBatches: 1 }, racing, ROTATING_ENV, () => {});
    expect(report.kinds[0]).toMatchObject({ updated: 0, skipped: 1 });
    expect(rows[0].envelope.keyVersion).toBe(1);
  });

  it('refuses to run from the active version or with an unexpected candidate row', async () => {
    const { rpc } = fakeDatabase(fixture());
    await expect(runAccountKeyRewrap({ ...OPTIONS, fromVersion: 2 }, rpc, ROTATING_ENV, () => {}))
      .rejects.toThrow(AccountRewrapError);
    await expect(runAccountKeyRewrap({ ...OPTIONS, batchSize: 501 }, rpc, ROTATING_ENV, () => {}))
      .rejects.toThrow(AccountRewrapError);
    const widened = vi.fn(async () => ({
      outcome: 'ready',
      rows: [{ user_id: randomUUID(), chart_id: randomUUID(), revision: 1, key_version: 1, wrapped_key: 'AA==', ciphertext: 'AA==' }],
    }));
    await expect(runAccountKeyRewrap({ ...OPTIONS, kinds: ['chart'] }, widened, ROTATING_ENV, () => {}))
      .rejects.toThrow(AccountRewrapError);
  });

  it('parses the command line with a dry run by default', () => {
    expect(parseRewrapArgs(['--', '--from', '1'])).toEqual({
      fromVersion: 1, kinds: ['chart', 'alias', 'provider'], batchSize: 100, maxBatches: 50, apply: false,
    });
    expect(parseRewrapArgs(['--from', '3', '--kind', 'alias', '--batch', '20', '--batches', '2', '--apply']))
      .toEqual({ fromVersion: 3, kinds: ['alias'], batchSize: 20, maxBatches: 2, apply: true });
    expect(() => parseRewrapArgs([])).toThrow(AccountRewrapError);
    expect(() => parseRewrapArgs(['--from', '0'])).toThrow(AccountRewrapError);
    expect(() => parseRewrapArgs(['--from', '1', '--kind', 'charts'])).toThrow(AccountRewrapError);
    expect(() => parseRewrapArgs(['--from', '1', '--yes'])).toThrow(AccountRewrapError);
  });

  it('never echoes argument text in its errors', () => {
    const pasted = randomBytes(32).toString('base64');
    for (const argv of [
      ['--from', '1', pasted],
      ['--from', '1', `--key=${pasted}`],
      [pasted, '--from', '1'],
      ['--from', pasted],
      ['--from', '1', '--kind', pasted],
      ['--from', '1', '--batch', pasted],
    ]) {
      let message = '';
      try {
        parseRewrapArgs(argv);
      } catch (error) {
        expect(error).toBeInstanceOf(AccountRewrapError);
        message = (error as Error).message;
      }
      expect(message).not.toBe('');
      expect(message).not.toContain(pasted);
      expect(message).not.toContain(pasted.slice(0, 12));
    }
  });

  it('calls only the service RPC endpoint and reports failures without the response body', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe('https://project.supabase.co/rest/v1/rpc/account_v2_key_version_inventory');
      expect(init?.method).toBe('POST');
      return new Response('{"message":"detail that must not be printed"}', { status: 500 });
    });
    const rpc = serviceRpc({
      PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-not-real',
    }, fetcher as typeof fetch);
    await expect(rpc('account_v2_key_version_inventory', {}))
      .rejects.toThrow('account_v2_key_version_inventory answered HTTP 500');
    expect(() => serviceRpc({ PUBLIC_SUPABASE_URL: 'https://project.supabase.co' })).toThrow(AccountRewrapError);
  });
});
