import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import { handleAccountApi } from './handler.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const DEVICE_ID = '22222222-2222-4222-8222-222222222222';
const CHART_ID = '33333333-3333-4333-8333-333333333333';
const MUTATION_ID = '44444444-4444-4444-8444-444444444444';
const ORIGIN = 'https://project-ref.supabase.co';
const SERVICE_KEY = 'sb_secret_test_service_role_value';
const WRAPPING_KEY = Buffer.alloc(32, 0x42).toString('base64');
const FINGERPRINT_KEY = Buffer.alloc(32, 0x24).toString('base64');
const ENV = {
  NODE_ENV: 'production',
  ACCOUNT_SYNC_V2_API_ENABLED: '1',
  PUBLIC_SUPABASE_URL: ORIGIN,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_value',
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  ACCOUNT_SYNC_V2_ENCRYPTION_KEYS: JSON.stringify({ 7: WRAPPING_KEY }),
  ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION: '7',
  ACCOUNT_SYNC_V2_FINGERPRINT_KEYS: JSON.stringify({ 3: FINGERPRINT_KEY }),
  ACCOUNT_SYNC_V2_ACTIVE_FINGERPRINT_KEY_VERSION: '3',
  DAILY_EMAIL_RECIPIENT_HASH_SECRET: 'daily-email-recipient-hash-test-secret-2026',
};

const birth = {
  date: '1990-01-01',
  time: '08:45',
  timeKnown: true,
  place: {
    name: 'Bangkok',
    admin1: 'Bangkok',
    country: 'Thailand',
    lat: 13.7563,
    lon: 100.5018,
    tz: 'Asia/Bangkok',
  },
};
const positions = {
  b: [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345],
  a: [100, 190],
  h: 'w',
  v: '3.2.1',
};
const chartPut = {
  deviceId: DEVICE_ID,
  chartId: CHART_ID,
  baseRevision: 0,
  mutationId: MUTATION_ID,
  label: 'My private chart',
  subjectKind: 'self',
  selfAttestation: true,
  birth,
  derived: {
    positions,
    timeKnown: true,
    sunSign: 'aries',
    engineVersion: '3.2.1',
    houseSystem: 'whole',
  },
};

function request(action: string, body: unknown) {
  return {
    method: 'POST',
    query: { action },
    headers: {
      origin: 'https://zodiacs.org',
      host: 'zodiacs.org',
      authorization: 'Bearer header.payload.signature',
      'content-type': 'application/json',
    },
    body,
  };
}

function responseRecorder() {
  return {
    statusCode: 0,
    headers: new Map<string, string>(),
    body: '',
    setHeader(name: string, value: string) { this.headers.set(name, value); },
    end(value: string) { this.body = value; },
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function authenticatedFetcher(rpcResponse: unknown) {
  return vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/auth/v1/user') return json({ id: USER_ID, email: 'person@example.com' });
    if (url.pathname === '/rest/v1/charts') return json([]);
    if (url.pathname.startsWith('/rest/v1/rpc/')) return json(rpcResponse);
    throw new Error(`Unexpected fetch ${url}`);
  });
}

function rpcInit(
  fetcher: ReturnType<typeof authenticatedFetcher>,
  rpcName: string,
): RequestInit {
  const calls = fetcher.mock.calls as Array<[string | URL | Request, RequestInit?]>;
  const call = calls.find(([input]) => String(input).includes(`/rpc/${rpcName}`));
  if (!call?.[1]) throw new Error(`Missing ${rpcName} RPC call.`);
  return call[1];
}

function requiredRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected a record.');
  return input as Record<string, unknown>;
}

function hexToBase64(value: unknown): string {
  if (typeof value !== 'string' || !/^\\x[0-9a-f]+$/u.test(value)) throw new Error('Invalid bytea wire.');
  return Buffer.from(value.slice(2), 'hex').toString('base64');
}

describe('dormant account chart-sync API', () => {
  it('admits any signed-in account without an allowlist and ignores a retired canary list', async () => {
    const fetcher = authenticatedFetcher({
      outcome: 'ready',
      account_state: 'active',
      chart_sync_consent: 'pending',
      cursor: 0,
    });
    const response = responseRecorder();
    await handleAccountApi(request('bootstrap', {
      deviceId: DEVICE_ID,
      platform: 'web',
    }), response, {
      env: { ...ENV, ACCOUNT_SYNC_V2_CANARY_USER_IDS: '99999999-9999-4999-8999-999999999999' },
      fetcher,
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ outcome: 'ready', chart_sync_consent: 'pending' });
  });

  it('keeps granular consent withdrawal available', async () => {
    const fetcher = authenticatedFetcher({
      outcome: 'withdrawn', purpose: 'chart_sync', event_id: 10,
    });
    const response = responseRecorder();
    await handleAccountApi(request('consent', {
      mutationId: MUTATION_ID,
      decision: 'withdraw',
      policyVersion: 'chart-sync-2026-08-12.v1',
    }), response, { env: ENV, fetcher });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      outcome: 'withdrawn', purpose: 'chart_sync', event_id: 10,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps consent withdrawal and remote chart deletion available when sync is disabled', async () => {
    const disabledEnv = { ...ENV, ACCOUNT_SYNC_V2_API_ENABLED: '0' };
    const withdrawFetcher = authenticatedFetcher({
      outcome: 'withdrawn', purpose: 'chart_sync', event_id: 12,
    });
    const withdrawResponse = responseRecorder();
    await handleAccountApi(request('consent', {
      mutationId: MUTATION_ID,
      decision: 'withdraw',
    }), withdrawResponse, { env: disabledEnv, fetcher: withdrawFetcher });
    expect(withdrawResponse.statusCode).toBe(200);

    const deleteFetcher = authenticatedFetcher({
      outcome: 'already_deleted', chart_id: CHART_ID, revision: 2,
    });
    const deleteResponse = responseRecorder();
    await handleAccountApi(request('chart-delete', {
      deviceId: DEVICE_ID,
      chartId: CHART_ID,
      baseRevision: 2,
      mutationId: MUTATION_ID,
    }), deleteResponse, { env: disabledEnv, fetcher: deleteFetcher });
    expect(deleteResponse.statusCode).toBe(200);

    const bootstrapFetcher = vi.fn();
    const bootstrapResponse = responseRecorder();
    await handleAccountApi(request('bootstrap', {
      deviceId: DEVICE_ID,
      platform: 'web',
    }), bootstrapResponse, { env: disabledEnv, fetcher: bootstrapFetcher });
    expect(bootstrapResponse.statusCode).toBe(404);
    expect(JSON.parse(bootstrapResponse.body)).toEqual({ error: 'disabled' });
    expect(bootstrapFetcher).not.toHaveBeenCalled();
  });

  it('keeps deletion of an existing remote chart available', async () => {
    const fetcher = authenticatedFetcher({
      outcome: 'already_deleted', chart_id: CHART_ID, revision: 2,
    });
    const response = responseRecorder();
    await handleAccountApi(request('chart-delete', {
      deviceId: DEVICE_ID,
      chartId: CHART_ID,
      baseRevision: 2,
      mutationId: MUTATION_ID,
    }), response, { env: ENV, fetcher });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      outcome: 'already_deleted', chart_id: CHART_ID, revision: 2,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('derives user authority from the validated bearer token and rejects request-supplied owners', async () => {
    const fetcher = authenticatedFetcher({
      outcome: 'ready',
      account_state: 'active',
      chart_sync_consent: 'pending',
      cursor: 0,
    });
    const response = responseRecorder();
    await handleAccountApi(request('bootstrap', {
      deviceId: DEVICE_ID,
      platform: 'web',
    }), response, { env: ENV, fetcher });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(String(rpcInit(fetcher, 'account_v2_bootstrap').body))).toEqual({
      candidate_user_id: USER_ID,
      candidate_device_id: DEVICE_ID,
      candidate_platform: 'web',
      candidate_daily_sun_recipient_hash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      candidate_daily_sun_encrypted_locator: {
        ciphertext: expect.any(String),
        nonce: expect.any(String),
        format: 'opaque_v1',
        key_scope: 'service',
        key_version: 7,
        wrapped_key: expect.any(String),
      },
    });
    const bootstrapWire = JSON.stringify(
      JSON.parse(String(rpcInit(fetcher, 'account_v2_bootstrap').body))
        .candidate_daily_sun_encrypted_locator,
    );
    expect(bootstrapWire).not.toContain('person@example.com');

    const rejectedFetcher = vi.fn();
    const rejected = responseRecorder();
    await handleAccountApi(request('bootstrap', {
      deviceId: DEVICE_ID,
      platform: 'web',
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }), rejected, { env: ENV, fetcher: rejectedFetcher });
    expect(rejected.statusCode).toBe(400);
    expect(rejectedFetcher).not.toHaveBeenCalled();
  });

  it('passes through the stable bootstrap device-cap outcome', async () => {
    const fetcher = authenticatedFetcher({ outcome: 'device_limit_reached' });
    const response = responseRecorder();
    await handleAccountApi(request('bootstrap', {
      deviceId: DEVICE_ID,
      platform: 'web',
    }), response, { env: ENV, fetcher });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ outcome: 'device_limit_reached' });
  });

  it('accepts the database-enforced legacy migration boundary after the ID-only precheck', async () => {
    const fetcher = authenticatedFetcher({ outcome: 'legacy_migration_required' });
    const response = responseRecorder();
    await handleAccountApi(request('bootstrap', {
      deviceId: DEVICE_ID,
      platform: 'web',
    }), response, { env: ENV, fetcher });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ outcome: 'legacy_migration_required' });
  });

  it('blocks v2 bootstrap when an ID-only check finds a legacy plaintext cloud chart', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/auth/v1/user') return json({ id: USER_ID, email: 'person@example.com' });
      if (url.pathname === '/rest/v1/charts') {
        expect(url.searchParams.get('select')).toBe('id');
        expect(url.searchParams.get('user_id')).toBe(`eq.${USER_ID}`);
        expect(url.searchParams.get('limit')).toBe('1');
        expect(url.search).not.toContain('payload');
        expect(init?.headers).toEqual(expect.objectContaining({
          Authorization: `Bearer ${SERVICE_KEY}`,
        }));
        return json([{ id: CHART_ID }]);
      }
      throw new Error(`Bootstrap must not continue after legacy chart detection: ${url}`);
    });
    const response = responseRecorder();
    await handleAccountApi(request('bootstrap', { deviceId: DEVICE_ID, platform: 'web' }), response, {
      env: ENV,
      fetcher,
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ outcome: 'legacy_migration_required' });
    expect(fetcher.mock.calls.some(([input]) => String(input).includes('/rpc/account_v2_bootstrap'))).toBe(false);
  });

  it('hardcodes chart-sync consent purpose and web source', async () => {
    const fetcher = authenticatedFetcher({ outcome: 'granted', purpose: 'chart_sync', event_id: 9 });
    const response = responseRecorder();
    await handleAccountApi(request('consent', {
      mutationId: MUTATION_ID,
      decision: 'grant',
      policyVersion: 'chart-sync-2026-08-12.v1',
    }), response, { env: ENV, fetcher });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      outcome: 'granted', purpose: 'chart_sync', event_id: 9,
    });
    const body = JSON.parse(String(rpcInit(fetcher, 'account_v2_record_consent').body));
    expect(body).toEqual({
      candidate_user_id: USER_ID,
      candidate_purpose: 'chart_sync',
      candidate_decision: 'grant',
      candidate_policy_version: 'chart-sync-2026-08-12.v1',
      candidate_source: 'web',
      candidate_mutation_id: MUTATION_ID,
      candidate_request_fingerprints: [expect.stringMatching(/^3:[0-9a-f]{64}$/u)],
    });
  });

  it('fails closed if a consent commit response widens beyond the exact public contract', async () => {
    const fetcher = authenticatedFetcher({
      outcome: 'granted',
      purpose: 'chart_sync',
      event_id: 9,
      policy_version: 'chart-sync-2026-08-12.v1',
    });
    const response = responseRecorder();
    await handleAccountApi(request('consent', {
      mutationId: MUTATION_ID,
      decision: 'grant',
      policyVersion: 'chart-sync-2026-08-12.v1',
    }), response, { env: ENV, fetcher });

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ error: 'sync_unavailable' });
  });

  it('ignores a stale client policy when recording withdrawal', async () => {
    const fetcher = authenticatedFetcher({
      outcome: 'withdrawn', purpose: 'chart_sync', event_id: 11,
    });
    const response = responseRecorder();
    await handleAccountApi(request('consent', {
      mutationId: MUTATION_ID,
      decision: 'withdraw',
      policyVersion: 'chart-sync-older.v0',
    }), response, { env: ENV, fetcher });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(String(rpcInit(fetcher, 'account_v2_record_consent').body)))
      .toEqual(expect.objectContaining({
        candidate_decision: 'withdraw',
        candidate_policy_version: null,
        candidate_request_fingerprints: [expect.stringMatching(/^3:[0-9a-f]{64}$/u)],
      }));
  });

  it('rejects a caller-supplied consent policy label before authentication', async () => {
    const fetcher = vi.fn();
    const response = responseRecorder();
    await handleAccountApi(request('consent', {
      mutationId: MUTATION_ID,
      decision: 'grant',
      policyVersion: 'forged-policy-label',
    }), response, { env: ENV, fetcher });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'invalid_request' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('envelope-encrypts the full private chart and sends only routing/key metadata to the RPC', async () => {
    const fetcher = authenticatedFetcher({
      outcome: 'saved', chart_id: CHART_ID, revision: 1, change_seq: 12,
    });
    const response = responseRecorder();
    await handleAccountApi(request('chart-put', chartPut), response, { env: ENV, fetcher });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      outcome: 'saved', chart_id: CHART_ID, revision: 1, change_seq: 12,
    });
    const init = rpcInit(fetcher, 'account_v2_put_chart');
    const rpcBody = JSON.parse(String(init.body));
    expect(rpcBody).toEqual(expect.objectContaining({
      candidate_user_id: USER_ID,
      candidate_chart_id: CHART_ID,
      candidate_subject_kind: 'self',
      candidate_subject_attestation: 'self_declared_v1',
      candidate_encryption_format: 'opaque_v1',
      candidate_key_scope: 'service',
      candidate_key_version: 7,
      candidate_request_fingerprints: [expect.stringMatching(/^3:[0-9a-f]{64}$/u)],
    }));
    expect(rpcBody.candidate_ciphertext).toMatch(/^\\x[0-9a-f]+$/u);
    expect(rpcBody.candidate_nonce).toMatch(/^\\x[0-9a-f]{24}$/u);
    expect(rpcBody.candidate_wrapped_key).toMatch(/^\\x[0-9a-f]{136}$/u);
    const wire = JSON.stringify(rpcBody);
    expect(wire).not.toContain('1990-01-01');
    expect(wire).not.toContain('Bangkok');
    expect(wire).not.toContain('My private chart');
    expect(wire).not.toContain('candidate_label');
    expect(wire).not.toContain('candidate_positions');
    expect(wire).not.toContain('candidate_sun_sign');
    expect(wire).not.toContain(WRAPPING_KEY);
    expect(init.headers).toEqual(expect.objectContaining({
      Authorization: `Bearer ${SERVICE_KEY}`,
    }));
  });

  it('returns the stable one-chart domain outcome without treating it as a server failure', async () => {
    const response = responseRecorder();
    await handleAccountApi(request('chart-put', chartPut), response, {
      env: ENV,
      fetcher: authenticatedFetcher({ outcome: 'chart_limit_reached', limit: 1 }),
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ outcome: 'chart_limit_reached', limit: 1 });
  });

  it('rejects under-18 and future birth dates before encryption or storage', async () => {
    for (const date of ['2008-08-13', '2099-01-01']) {
      const fetcher = authenticatedFetcher({
        outcome: 'saved', chart_id: CHART_ID, revision: 1, change_seq: 1,
      });
      const response = responseRecorder();
      await handleAccountApi(request('chart-put', {
        ...chartPut,
        birth: { ...birth, date },
      }), response, {
        env: ENV,
        fetcher,
        now: () => Date.parse('2026-08-12T23:59:59.000Z'),
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ outcome: 'ineligible_age', minimum_age: 18 });
      expect(fetcher.mock.calls.some(([input]) => String(input).includes('/rpc/account_v2_put_chart')))
        .toBe(false);
    }
  });

  it('decrypts a ready chart for its owner and never returns the storage envelope', async () => {
    let persisted: Record<string, unknown> | null = null;
    const putFetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/auth/v1/user') return json({ id: USER_ID, email: 'person@example.com' });
      if (url.pathname === '/rest/v1/rpc/account_v2_put_chart') {
        persisted = JSON.parse(String(init?.body));
        return json({ outcome: 'saved', chart_id: CHART_ID, revision: 1, change_seq: 1 });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    await handleAccountApi(request('chart-put', chartPut), responseRecorder(), { env: ENV, fetcher: putFetcher });
    expect(persisted).not.toBeNull();
    const stored = requiredRecord(persisted);

    const getFetcher = authenticatedFetcher({
      outcome: 'ready',
      chart_id: CHART_ID,
      subject_kind: 'self',
      subject_attestation: 'self_declared_v1',
      revision: 1,
      created_at: '2026-08-12T00:00:00.000Z',
      updated_at: '2026-08-12T00:00:00.000Z',
      encrypted_source: {
        ciphertext: hexToBase64(stored.candidate_ciphertext),
        nonce: hexToBase64(stored.candidate_nonce),
        format: 'opaque_v1',
        key_scope: 'service',
        key_version: 7,
        wrapped_key: hexToBase64(stored.candidate_wrapped_key),
      },
    });
    const response = responseRecorder();
    await handleAccountApi(request('chart-get', { deviceId: DEVICE_ID, chartId: CHART_ID }), response, {
      env: ENV,
      fetcher: getFetcher,
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      outcome: 'ready',
      chart_id: CHART_ID,
      label: chartPut.label,
      subject_kind: 'self',
      subject_attestation: 'self_declared_v1',
      revision: 1,
      created_at: '2026-08-12T00:00:00.000Z',
      updated_at: '2026-08-12T00:00:00.000Z',
      derived: {
        positions,
        time_known: true,
        sun_sign: 'aries',
        engine_version: '3.2.1',
        house_system: 'whole',
      },
      birth,
    });
    expect(response.body).not.toContain('encrypted_source');
    expect(response.body).not.toContain('wrapped_key');
    expect(response.body).not.toContain(WRAPPING_KEY);
  });

  it('keeps pull payload-free and fails closed if the RPC widens a change', async () => {
    const validChange = {
      seq: 4,
      entity_type: 'chart',
      entity_id: CHART_ID,
      operation: 'upsert',
      revision: 1,
      mutation_id: MUTATION_ID,
      created_at: '2026-08-12T00:00:00.000Z',
    };
    const ready = responseRecorder();
    await handleAccountApi(request('pull', { deviceId: DEVICE_ID, afterCursor: 3, limit: 100 }), ready, {
      env: ENV,
      fetcher: authenticatedFetcher({
        outcome: 'ready', changes: [validChange], next_cursor: 4, has_more: false,
      }),
    });
    expect(ready.statusCode).toBe(200);
    expect(ready.body).not.toContain('birth');
    expect(ready.body).not.toContain('positions');

    const widened = responseRecorder();
    await handleAccountApi(request('pull', { deviceId: DEVICE_ID, afterCursor: 3 }), widened, {
      env: ENV,
      fetcher: authenticatedFetcher({
        outcome: 'ready',
        changes: [{ ...validChange, birth: { date: '1990-01-01' } }],
        next_cursor: 4,
        has_more: false,
      }),
    });
    expect(widened.statusCode).toBe(503);
    expect(JSON.parse(widened.body)).toEqual({ error: 'sync_unavailable' });
  });

  it('collapses create then delete to the latest entity state for a new device', async () => {
    const response = responseRecorder();
    await handleAccountApi(request('pull', { deviceId: DEVICE_ID, afterCursor: 0 }), response, {
      env: ENV,
      fetcher: authenticatedFetcher({
        outcome: 'ready',
        changes: [
          {
            seq: 1, entity_type: 'chart', entity_id: CHART_ID, operation: 'upsert', revision: 1,
            mutation_id: MUTATION_ID, created_at: '2026-08-12T00:00:00.000Z',
          },
          {
            seq: 2, entity_type: 'chart', entity_id: CHART_ID, operation: 'delete', revision: 2,
            mutation_id: '55555555-5555-4555-8555-555555555555',
            created_at: '2026-08-12T00:01:00.000Z',
          },
        ],
        next_cursor: 2,
        has_more: false,
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      outcome: 'ready',
      changes: [{ seq: 2, operation: 'delete', entity_id: CHART_ID }],
      next_cursor: 2,
      has_more: false,
    });
  });

  it('drains more than 100 upstream changes before returning a reconciled snapshot', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => ({
      seq: index + 1,
      entity_type: 'consent',
      entity_id: null,
      operation: index % 2 === 0 ? 'grant' : 'withdraw',
      revision: index + 1,
      mutation_id: `00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`,
      created_at: '2026-08-12T00:00:00.000Z',
    }));
    let page = 0;
    const fetcher = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/auth/v1/user') return json({ id: USER_ID, email: 'person@example.com' });
      if (url.pathname === '/rest/v1/rpc/account_v2_pull') {
        page += 1;
        return page === 1
          ? json({ outcome: 'ready', changes: firstPage, next_cursor: 200, has_more: true })
          : json({
              outcome: 'ready',
              changes: [{
                seq: 201, entity_type: 'consent', entity_id: null, operation: 'grant', revision: 201,
                mutation_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                created_at: '2026-08-12T00:01:00.000Z',
              }],
              next_cursor: 201,
              has_more: false,
            });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    const response = responseRecorder();
    await handleAccountApi(request('pull', { deviceId: DEVICE_ID, afterCursor: 0, limit: 100 }), response, {
      env: ENV,
      fetcher,
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      outcome: 'ready', changes: [{ seq: 201, operation: 'grant' }], next_cursor: 201, has_more: false,
    });
    const pullBodies = fetcher.mock.calls
      .filter(([input]) => String(input).includes('/rpc/account_v2_pull'))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    expect(pullBodies).toEqual([
      expect.objectContaining({ candidate_after_seq: 0, candidate_limit: 200 }),
      expect.objectContaining({ candidate_after_seq: 200, candidate_limit: 200 }),
    ]);
  });

  it('fails closed before the write RPC when the server-only keyring is unavailable', async () => {
    const fetcher = authenticatedFetcher({
      outcome: 'saved', chart_id: CHART_ID, revision: 1, change_seq: 1,
    });
    const response = responseRecorder();
    await handleAccountApi(request('chart-put', chartPut), response, {
      env: {
        ...ENV,
        ACCOUNT_SYNC_V2_ENCRYPTION_KEYS: '',
        ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION: '',
      },
      fetcher,
    });
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ error: 'sync_unavailable' });
    expect(fetcher.mock.calls.some(([input]) => String(input).includes('/rpc/account_v2_put_chart'))).toBe(false);
  });
});
