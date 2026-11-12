import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import {
  encryptAccountDailySunAliasLocator,
  encryptAccountDeletionProviderPayload,
  encryptAccountPrivatePayload,
} from './encryption.js';
import { handleAccountApi } from './handler.js';
import { serializeAccountPrivateChartPayload } from './sync-wire.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const RECOVERY_SECRET = Buffer.alloc(32, 0x37).toString('base64url');
const CHART_ID = '44444444-4444-4444-8444-444444444444';
const INVITE_ID = '55555555-5555-4555-8555-555555555555';
const NOW = Date.parse('2026-08-11T16:00:00.000Z');
const ORIGIN = 'https://project-ref.supabase.co';
const WRAPPING_KEY = Buffer.alloc(32, 0x61).toString('base64');
const ENV = {
  NODE_ENV: 'production',
  ACCOUNT_SYNC_V2_API_ENABLED: '1',
  PUBLIC_SUPABASE_URL: ORIGIN,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_value',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test_service_role_value',
  DAILY_EMAIL_RECIPIENT_HASH_SECRET: 'daily-email-recipient-hash-test-secret-2026',
  RESEND_CONTACTS_API_KEY: 're_contacts_test_key',
  RESEND_DAILY_SEGMENT_ID: 'daily_segment_test',
  ACCOUNT_SYNC_V2_ENCRYPTION_KEYS: JSON.stringify({ 5: WRAPPING_KEY }),
  ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION: '5',
  ACCOUNT_SYNC_V2_FINGERPRINT_KEYS: JSON.stringify({ 4: Buffer.alloc(32, 0x49).toString('base64') }),
  ACCOUNT_SYNC_V2_ACTIVE_FINGERPRINT_KEY_VERSION: '4',
};

function jwt(method = 'magiclink', timestamp = Math.floor(NOW / 1_000) - 30): string {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: `${ORIGIN}/auth/v1`,
    aud: 'authenticated',
    exp: Math.floor(NOW / 1_000) + 3_600,
    iat: Math.floor(NOW / 1_000) - 30,
    sub: USER_ID,
    role: 'authenticated',
    aal: 'aal1',
    session_id: SESSION_ID,
    email: 'person@example.com',
    phone: '',
    is_anonymous: false,
    amr: [{ method, timestamp }],
  })).toString('base64url');
  return `${header}.${payload}.test-signature`;
}

function request(
  action: 'export' | 'delete-prepare' | 'delete-status' | 'delete-finish' | 'cleanup-receipts',
  options: { token?: string | null; body?: unknown; headers?: Record<string, string>; method?: string } = {},
) {
  const authenticated = action === 'export' || action === 'delete-prepare';
  const token = options.token === undefined ? (authenticated ? jwt() : null) : options.token;
  const body = options.body ?? (action === 'delete-prepare'
    ? { confirmation: 'DELETE', requestId: REQUEST_ID, recoverySecret: RECOVERY_SECRET }
    : action === 'delete-status' || action === 'delete-finish'
      ? { requestId: REQUEST_ID, recoverySecret: RECOVERY_SECRET }
      : undefined);
  return {
    method: options.method ?? (action === 'export' ? 'GET' : 'POST'),
    query: { action },
    headers: {
      origin: 'https://zodiacs.org',
      host: 'zodiacs.org',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(action !== 'export' ? {
        'content-type': 'application/json',
      } : {}),
      ...options.headers,
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

const EMPTY_V2_RPC_EXPORT = {
  outcome: 'ready',
  schema: 'zodiacs.account-sync-v2.export.v1',
  account: null,
  consents: [],
  consent_events: [],
  devices: [],
  daily_sun_aliases: [],
  charts: [],
  changes: [],
  tombstones: [],
};

const EMPTY_V2_EXPORT = {
  ...EMPTY_V2_RPC_EXPORT,
  private_charts: [],
  encrypted_sources: [],
};

function exportFetcher(v2Export: unknown = EMPTY_V2_RPC_EXPORT) {
  return vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/auth/v1/user') {
      return json({ id: USER_ID, email: 'person@example.com' });
    }
    if (url.pathname === `/auth/v1/admin/users/${USER_ID}`) {
      return json({
        id: USER_ID,
        email: 'person@example.com',
        phone: '',
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
        last_sign_in_at: '2026-08-11T15:59:30.000Z',
        email_confirmed_at: '2026-07-01T00:01:00.000Z',
        phone_confirmed_at: null,
        is_anonymous: false,
        app_metadata: { providers: ['email'], internal_role: 'operator-secret' },
        user_metadata: { private_note: 'must-not-export' },
      });
    }
    if (url.pathname === '/rest/v1/profiles') {
      return json([{
        settings: { houseSystem: 'whole' },
        digest_opt_in: true,
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
      }]);
    }
    if (url.pathname === '/rest/v1/charts') {
      return json([{
        id: CHART_ID,
        payload: { name: 'My chart', birth: { date: '1990-01-01' } },
        created_at: '2026-07-02T00:00:00.000Z',
        updated_at: '2026-08-02T00:00:00.000Z',
      }]);
    }
    if (url.pathname === '/rest/v1/chart_deletions') return json([]);
    if (url.pathname === '/rest/v1/daily_chart_preferences') return json([]);
    if (url.pathname === '/rest/v1/rpc/account_v2_export_legacy_invites') {
      return json([{
        id: INVITE_ID,
        label: 'Partner',
        sun_sign: 'aries',
        positions: null,
        time_known: true,
        status: 'completed',
        notify_on_complete: false,
        created_at: '2026-08-01T00:00:00.000Z',
        expires_at: '2026-08-15T00:00:00.000Z',
        opened_at: '2026-08-02T00:00:00.000Z',
        completed_at: '2026-08-03T00:00:00.000Z',
        revoked_at: null,
        expired_at: null,
        authority_destroyed_at: '2026-08-03T00:00:00.000Z',
        delete_after: '2026-09-02T00:00:00.000Z',
        owner_hidden_at: null,
      }]);
    }
    if (url.pathname === '/rest/v1/rpc/account_v2_export') return json(v2Export);
    throw new Error(`Unexpected fetch ${url}`);
  });
}

describe('account lifecycle API foundation', () => {
  it('keeps deletion receipt recovery available while the sync kill switch is disabled', async () => {
    const fetcher = vi.fn(async () => json({
      outcome: 'ready', request_id: REQUEST_ID, user_id: USER_ID, state: 'prepared',
      prepared_at: '2026-08-11T16:00:01.000Z', completed_at: null,
      expires_at: '2026-08-18T16:00:01.000Z',
      daily_sun_revoked: false, daily_sun_reconciliation_required: true,
    }));
    const response = responseRecorder();
    await handleAccountApi(request('delete-status'), response, {
      env: { ...ENV, ACCOUNT_SYNC_V2_API_ENABLED: '0' },
      fetcher,
      now: () => NOW,
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining({
      outcome: 'prepared', requestId: REQUEST_ID,
      dailySunReconciliationRequired: true,
    }));
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('requires an exact same-origin request and a strict JWT bearer header', async () => {
    const fetcher = vi.fn();
    const crossPort = responseRecorder();
    await handleAccountApi(request('export', {
      headers: { origin: 'https://zodiacs.org:8443' },
    }), crossPort, { env: ENV, fetcher, now: () => NOW });
    expect(crossPort.statusCode).toBe(403);

    const looseBearer = responseRecorder();
    const req = request('export');
    req.headers.authorization = `bearer ${jwt()}`;
    await handleAccountApi(req, looseBearer, { env: ENV, fetcher, now: () => NOW });
    expect(looseBearer.statusCode).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns an allowlisted, versioned export without performing synchronization', async () => {
    const fetcher = exportFetcher();
    const response = responseRecorder();
    await handleAccountApi(request('export'), response, { env: ENV, fetcher, now: () => NOW });

    expect(response.statusCode).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
    expect(response.headers.get('Content-Disposition')).toContain('zodiacs-account-export.json');

    const body = JSON.parse(response.body);
    expect(body.schema).toBe('zodiacs.account.export.v1');
    expect(body.exportedAt).toBe('2026-08-11T16:00:00.000Z');
    expect(body.account).toEqual(expect.objectContaining({
      id: USER_ID,
      email: 'person@example.com',
      providers: ['email'],
    }));
    expect(body.cloud.charts).toHaveLength(1);
    expect(body.cloud.compatibilityInvites).toHaveLength(1);
    expect(body.cloud.accountSyncV2).toEqual(EMPTY_V2_EXPORT);
    expect(response.body).not.toContain('operator-secret');
    expect(response.body).not.toContain('private_note');
    expect(response.body).not.toContain('token_hash');
    expect(response.body).not.toContain('completion_replay_hash');

    const calls = fetcher.mock.calls.map(([input, init]) => ({
      url: new URL(String(input)).pathname,
      method: (init as RequestInit | undefined)?.method ?? 'GET',
    }));
    expect(calls).toContainEqual({ url: '/rest/v1/rpc/account_v2_export', method: 'POST' });
    expect(calls.some(({ url }) => /bootstrap|pull|put_chart|record_consent/.test(url))).toBe(false);
    expect(calls.filter(({ method }) => method !== 'GET').map(({ url }) => url).sort())
      .toEqual([
        '/rest/v1/rpc/account_v2_export',
        '/rest/v1/rpc/account_v2_export_legacy_invites',
      ]);
  });

  it.each(['granted', 'withdrawn'] as const)(
    'exports chart-email consent and its audit history while %s',
    async (state) => {
      const grantedAt = '2026-08-10T00:00:00.000Z';
      const withdrawnAt = '2026-08-11T00:00:00.000Z';
      const account = {
        status: 'active',
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: state === 'granted' ? grantedAt : withdrawnAt,
        deletion_started_at: null,
      };
      const consent = {
        purpose: 'chart_emails',
        state,
        policy_version: 'chart-emails-test-v1',
        granted_at: state === 'granted' ? grantedAt : null,
        withdrawn_at: state === 'withdrawn' ? withdrawnAt : null,
        updated_at: account.updated_at,
      };
      const grantEvent = {
        event_id: 1,
        purpose: 'chart_emails',
        decision: 'grant',
        policy_version: consent.policy_version,
        source: 'web',
        occurred_at: grantedAt,
      };
      const events = state === 'granted' ? [grantEvent] : [grantEvent, {
        ...grantEvent, event_id: 2, decision: 'withdraw', occurred_at: withdrawnAt,
      }];
      const response = responseRecorder();
      await handleAccountApi(request('export'), response, {
        env: ENV,
        fetcher: exportFetcher({
          ...EMPTY_V2_RPC_EXPORT, account, consents: [consent], consent_events: events,
        }),
        now: () => NOW,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers.get('Content-Disposition')).toContain('zodiacs-account-export.json');
      expect(JSON.parse(response.body).cloud.accountSyncV2).toEqual({
        ...EMPTY_V2_EXPORT, account, consents: [consent], consent_events: events,
      });
    },
  );

  it.each(['consents', 'consent_events'] as const)(
    'still rejects an unknown consent purpose in %s',
    async (field) => {
      const timestamp = '2026-08-10T00:00:00.000Z';
      const row = field === 'consents'
        ? {
          purpose: 'unknown_purpose', state: 'granted', policy_version: 'test-v1',
          granted_at: timestamp, withdrawn_at: null, updated_at: timestamp,
        }
        : {
          event_id: 1, purpose: 'unknown_purpose', decision: 'grant',
          policy_version: 'test-v1', source: 'web', occurred_at: timestamp,
        };
      const response = responseRecorder();
      await handleAccountApi(request('export'), response, {
        env: ENV,
        fetcher: exportFetcher({
          ...EMPTY_V2_RPC_EXPORT,
          account: {
            status: 'active', created_at: timestamp, updated_at: timestamp,
            deletion_started_at: null,
          },
          [field]: [row],
        }),
        now: () => NOW,
      });

      expect(response.statusCode).toBe(503);
      expect(JSON.parse(response.body)).toEqual({ error: 'export_unavailable' });
    },
  );

  it('decrypts the combined v2 envelope into a portable owner export without widening routing data', async () => {
    const privatePayload = {
      label: 'My encrypted chart',
      birth: {
        date: '1990-01-01',
        time: '08:45',
        timeKnown: true,
        place: {
          name: 'Bangkok', admin1: 'Bangkok', country: 'Thailand',
          lat: 13.7563, lon: 100.5018, tz: 'Asia/Bangkok',
        },
      },
      derived: {
        positions: {
          b: [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345],
          a: [100, 190] as [number, number],
          h: 'w' as const,
          v: '3.2.1',
        },
        timeKnown: true,
        sunSign: 'aries' as const,
        engineVersion: '3.2.1',
        houseSystem: 'whole' as const,
      },
    };
    const envelope = encryptAccountPrivatePayload(
      serializeAccountPrivateChartPayload(privatePayload),
      { userId: USER_ID, chartId: CHART_ID, revision: 3 },
      ENV,
    );
    const aliasHash = 'a'.repeat(64);
    const aliasEnvelope = encryptAccountDailySunAliasLocator(
      'old-address@example.com',
      { userId: USER_ID, recipientHash: aliasHash },
      ENV,
    );
    const v2RpcExport = {
      ...EMPTY_V2_RPC_EXPORT,
      account: {
        status: 'active',
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-11T00:00:00.000Z',
        deletion_started_at: null,
      },
      daily_sun_aliases: [{
        recipient_hash: aliasHash,
        encrypted_locator: {
          ciphertext: aliasEnvelope.ciphertext.toString('base64'),
          nonce: aliasEnvelope.nonce.toString('base64'),
          format: aliasEnvelope.format,
          key_scope: aliasEnvelope.keyScope,
          key_version: aliasEnvelope.keyVersion,
          wrapped_key: aliasEnvelope.wrappedKey.toString('base64'),
        },
        bound_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-03T00:00:00.000Z',
      }, {
        recipient_hash: 'b'.repeat(64),
        encrypted_locator: null,
        bound_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
      }],
      charts: [{
        chart_id: CHART_ID,
        subject_kind: 'self',
        subject_attestation: 'self_declared_v1',
        revision: 3,
        created_at: '2026-08-02T00:00:00.000Z',
        updated_at: '2026-08-10T00:00:00.000Z',
        encrypted_source: {
          ciphertext: envelope.ciphertext.toString('base64'),
          nonce: envelope.nonce.toString('base64'),
          format: envelope.format,
          key_scope: envelope.keyScope,
          key_version: envelope.keyVersion,
          wrapped_key: envelope.wrappedKey.toString('base64'),
        },
      }],
    };
    const response = responseRecorder();
    await handleAccountApi(request('export'), response, {
      env: ENV,
      fetcher: exportFetcher(v2RpcExport),
      now: () => NOW,
    });

    expect(response.statusCode).toBe(200);
    const exported = JSON.parse(response.body).cloud.accountSyncV2;
    expect(exported.charts).toEqual([{
      chart_id: CHART_ID,
      subject_kind: 'self',
      subject_attestation: 'self_declared_v1',
      revision: 3,
      created_at: '2026-08-02T00:00:00.000Z',
      updated_at: '2026-08-10T00:00:00.000Z',
    }]);
    expect(exported.private_charts).toEqual([{
      chart_id: CHART_ID,
      revision: 3,
      schema: 'zodiacs.account.private-chart.v1',
      ...privatePayload,
    }]);
    expect(exported.encrypted_sources).toEqual([
      expect.objectContaining({
        chart_id: CHART_ID,
        revision: 3,
        key_scope: 'service',
        wrapped_key: envelope.wrappedKey.toString('base64'),
      }),
    ]);
    expect(exported.daily_sun_aliases).toEqual([
      {
        schema: 'zodiacs.account.daily-sun-alias.v1',
        email: 'old-address@example.com',
        locatorStatus: 'available',
        boundAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-03T00:00:00.000Z',
      },
      {
        schema: 'zodiacs.account.daily-sun-alias.v1',
        email: null,
        locatorStatus: 'unavailable',
        boundAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ]);
    expect(JSON.stringify(exported.daily_sun_aliases)).not.toContain(aliasHash);
    expect(JSON.stringify(exported.charts)).not.toContain('Bangkok');
    expect(JSON.stringify(exported.charts)).not.toContain('positions');
  });

  it('fails a v2 owner export closed if its combined envelope cannot be decrypted', async () => {
    const response = responseRecorder();
    await handleAccountApi(request('export'), response, {
      env: ENV,
      fetcher: exportFetcher({
        ...EMPTY_V2_RPC_EXPORT,
        account: {
          status: 'active',
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-11T00:00:00.000Z',
          deletion_started_at: null,
        },
        charts: [{
          chart_id: CHART_ID,
          subject_kind: 'self',
          subject_attestation: 'self_declared_v1',
          revision: 1,
          created_at: '2026-08-02T00:00:00.000Z',
          updated_at: '2026-08-10T00:00:00.000Z',
          encrypted_source: {
            ciphertext: Buffer.alloc(32, 0x44).toString('base64'),
            nonce: Buffer.alloc(12, 0x55).toString('base64'),
            format: 'opaque_v1',
            key_scope: 'service',
            key_version: 5,
            wrapped_key: Buffer.alloc(68, 0x66).toString('base64'),
          },
        }],
      }),
      now: () => NOW,
    });
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ error: 'export_unavailable' });
  });

  it('fails the owner export closed rather than omitting an invalid encrypted email locator', async () => {
    const response = responseRecorder();
    await handleAccountApi(request('export'), response, {
      env: ENV,
      fetcher: exportFetcher({
        ...EMPTY_V2_RPC_EXPORT,
        account: {
          status: 'active',
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-11T00:00:00.000Z',
          deletion_started_at: null,
        },
        daily_sun_aliases: [{
          recipient_hash: 'a'.repeat(64),
          encrypted_locator: {
            ciphertext: Buffer.alloc(32, 0x44).toString('base64'),
            nonce: Buffer.alloc(12, 0x55).toString('base64'),
            format: 'opaque_v1',
            key_scope: 'service',
            key_version: 5,
            wrapped_key: Buffer.alloc(68, 0x66).toString('base64'),
          },
          bound_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-03T00:00:00.000Z',
        }],
      }),
      now: () => NOW,
    });
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ error: 'export_unavailable' });
  });

  it('fails the export closed when the private export shape widens unexpectedly', async () => {
    const fetcher = exportFetcher();
    fetcher.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/rest/v1/rpc/account_v2_export') {
        return json({ ...EMPTY_V2_RPC_EXPORT, mutation_receipts: [] });
      }
      return exportFetcher()(input, init);
    });
    const response = responseRecorder();
    await handleAccountApi(request('export'), response, { env: ENV, fetcher, now: () => NOW });
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ error: 'export_unavailable' });
  });

  it('rejects widened or non-canonical deletion recovery requests before any network call', async () => {
    const fetcher = vi.fn();
    const widened = responseRecorder();
    await handleAccountApi(request('delete-prepare', {
      body: {
        confirmation: 'DELETE', requestId: REQUEST_ID, recoverySecret: RECOVERY_SECRET,
        userId: USER_ID,
      },
    }), widened, { env: ENV, fetcher, now: () => NOW });
    expect(widened.statusCode).toBe(400);

    const shortSecret = responseRecorder();
    await handleAccountApi(request('delete-status', {
      body: { requestId: REQUEST_ID, recoverySecret: 'short' },
    }), shortSecret, { env: ENV, fetcher, now: () => NOW });
    expect(shortSecret.statusCode).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ['a refresh-only token', jwt('token_refresh')],
    ['a stale interactive token', jwt('magiclink', Math.floor(NOW / 1_000) - 301)],
  ])('requires recent interactive authentication for deletion prepare: %s', async (_label, token) => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === '/auth/v1/user') return json({ id: USER_ID, email: 'person@example.com' });
      throw new Error(`Unexpected fetch ${url}`);
    });
    const response = responseRecorder();
    await handleAccountApi(request('delete-prepare', { token }), response, {
      env: ENV, fetcher, now: () => NOW,
    });
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error: 'reauthentication_required' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('prepares erasure without deleting Auth and stores only a server HMAC recovery verifier', async () => {
    const preparedAt = '2026-08-11T16:00:01.000Z';
    const expiresAt = '2026-08-18T16:00:01.000Z';
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/auth/v1/user') return json({ id: USER_ID, email: 'person@example.com' });
      if (url.pathname === '/rest/v1/rpc/account_v2_list_daily_sun_aliases') {
        return json({ outcome: 'ready', aliases: [] });
      }
      if (url.pathname === '/rest/v1/rpc/account_v2_prepare_deletion') {
        const body = JSON.parse(String(init?.body));
        expect(body).toEqual(expect.objectContaining({
          candidate_user_id: USER_ID,
          candidate_request_id: REQUEST_ID,
          candidate_request_fingerprints: [expect.stringMatching(/^4:[0-9a-f]{64}$/u)],
          candidate_provider_cleanup_entries: [{
            recipient_hash: 'c45cfb6313e82304c62403d66b993f6b74fe5ceb6130943f64ad50ee1fa41ab6',
            encrypted_payload: {
              ciphertext: expect.any(String), nonce: expect.any(String), format: 'opaque_v1',
              key_scope: 'service', key_version: 5, wrapped_key: expect.any(String),
            },
          }],
          candidate_provider_cleanup_inventory_complete: true,
        }));
        expect(String(init?.body)).not.toContain(RECOVERY_SECRET);
        expect(String(init?.body)).not.toContain('person@example.com');
        return json({
          outcome: 'prepared', request_id: REQUEST_ID, prepared_at: preparedAt,
          daily_sun_revoked: false, daily_sun_reconciliation_required: true,
        });
      }
      if (url.pathname === '/rest/v1/rpc/account_v2_deletion_status') {
        return json({
          outcome: 'ready', request_id: REQUEST_ID, user_id: USER_ID, state: 'prepared',
          prepared_at: preparedAt, completed_at: null, expires_at: expiresAt,
          daily_sun_revoked: false, daily_sun_reconciliation_required: true,
        });
      }
      if (url.pathname.startsWith('/auth/v1/admin/users/')) {
        throw new Error('Prepare must not hard-delete Auth before the recovery receipt is acknowledged.');
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    const response = responseRecorder();
    await handleAccountApi(request('delete-prepare'), response, { env: ENV, fetcher, now: () => NOW });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      outcome: 'prepared', requestId: REQUEST_ID, preparedAt, expiresAt,
      dailySunRevoked: false, dailySunReconciliationRequired: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('keeps core prepare available without the optional Daily Sun hash secret', async () => {
    const { DAILY_EMAIL_RECIPIENT_HASH_SECRET: _secret, ...envWithoutDailyHash } = ENV;
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/auth/v1/user') return json({ id: USER_ID, email: 'person@example.com' });
      if (url.pathname === '/rest/v1/rpc/account_v2_list_daily_sun_aliases') {
        return json({ outcome: 'ready', aliases: [] });
      }
      if (url.pathname === '/rest/v1/rpc/account_v2_prepare_deletion') {
        expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({
          candidate_provider_cleanup_entries: [],
          candidate_provider_cleanup_inventory_complete: false,
        }));
        return json({
          outcome: 'prepared', request_id: REQUEST_ID,
          prepared_at: '2026-08-11T16:00:01.000Z', daily_sun_revoked: false,
          daily_sun_reconciliation_required: true,
        });
      }
      if (url.pathname === '/rest/v1/rpc/account_v2_deletion_status') return json({
        outcome: 'ready', request_id: REQUEST_ID, user_id: USER_ID, state: 'prepared',
        prepared_at: '2026-08-11T16:00:01.000Z', completed_at: null,
        expires_at: '2026-08-18T16:00:01.000Z',
        daily_sun_revoked: false, daily_sun_reconciliation_required: true,
      });
      throw new Error(`Unexpected fetch ${url}`);
    });
    const response = responseRecorder();
    await handleAccountApi(request('delete-prepare'), response, {
      env: envWithoutDailyHash, fetcher, now: () => NOW,
    });
    expect(response.statusCode).toBe(200);
  });

  it('prioritizes the current verified email and marks a capped alias inventory incomplete', async () => {
    const preparedAt = '2026-08-11T16:00:01.000Z';
    const aliases = Array.from({ length: 16 }, (_, index) => {
      const recipientHash = (index + 1).toString(16).padStart(64, '0');
      const envelope = encryptAccountDailySunAliasLocator(
        `old-${index}@example.com`,
        { userId: USER_ID, recipientHash },
        ENV,
      );
      return {
        recipient_hash: recipientHash,
        encrypted_locator: {
          ciphertext: envelope.ciphertext.toString('base64'),
          nonce: envelope.nonce.toString('base64'),
          format: envelope.format,
          key_scope: envelope.keyScope,
          key_version: envelope.keyVersion,
          wrapped_key: envelope.wrappedKey.toString('base64'),
        },
      };
    });
    const currentHash = 'c45cfb6313e82304c62403d66b993f6b74fe5ceb6130943f64ad50ee1fa41ab6';
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/auth/v1/user') return json({ id: USER_ID, email: 'person@example.com' });
      if (url.pathname === '/rest/v1/rpc/account_v2_list_daily_sun_aliases') {
        return json({ outcome: 'ready', aliases });
      }
      if (url.pathname === '/rest/v1/rpc/account_v2_prepare_deletion') {
        const body = JSON.parse(String(init?.body));
        expect(body.candidate_provider_cleanup_entries).toHaveLength(16);
        expect(body.candidate_provider_cleanup_entries[0].recipient_hash).toBe(currentHash);
        expect(body.candidate_provider_cleanup_entries.map(
          (entry: { recipient_hash: string }) => entry.recipient_hash,
        )).not.toContain(aliases[15].recipient_hash);
        expect(body.candidate_provider_cleanup_inventory_complete).toBe(false);
        return json({
          outcome: 'prepared', request_id: REQUEST_ID, prepared_at: preparedAt,
          daily_sun_revoked: false, daily_sun_reconciliation_required: true,
        });
      }
      if (url.pathname === '/rest/v1/rpc/account_v2_deletion_status') return json({
        outcome: 'ready', request_id: REQUEST_ID, user_id: USER_ID, state: 'prepared',
        prepared_at: preparedAt, completed_at: null,
        expires_at: '2026-08-18T16:00:01.000Z',
        daily_sun_revoked: false, daily_sun_reconciliation_required: true,
      });
      throw new Error(`Unexpected fetch ${url}`);
    });

    const response = responseRecorder();
    await handleAccountApi(request('delete-prepare'), response, { env: ENV, fetcher, now: () => NOW });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining({
      outcome: 'prepared', dailySunReconciliationRequired: true,
    }));
  });

  it('allows unauthenticated same-origin status with the recovery proof but never returns user_id', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/rest/v1/rpc/account_v2_deletion_status');
      return json({
        outcome: 'ready', request_id: REQUEST_ID, user_id: USER_ID, state: 'prepared',
        prepared_at: '2026-08-11T16:00:01.000Z', completed_at: null,
        expires_at: '2026-08-18T16:00:01.000Z',
        daily_sun_revoked: false, daily_sun_reconciliation_required: true,
      });
    });
    const response = responseRecorder();
    await handleAccountApi(request('delete-status'), response, { env: ENV, fetcher, now: () => NOW });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      outcome: 'prepared', requestId: REQUEST_ID,
      preparedAt: '2026-08-11T16:00:01.000Z', expiresAt: '2026-08-18T16:00:01.000Z',
      completedAt: null,
      dailySunRevoked: false,
      dailySunReconciliationRequired: true,
    });
    expect(response.body).not.toContain(USER_ID);
  });

  it('erases Auth before provider work, preserves provider failure truth, and reconciles on retry', async () => {
    const completedAt = '2026-08-11T16:02:00.000Z';
    const cleanupClaimId = '66666666-6666-4666-8666-666666666666';
    const recipientHash = 'c45cfb6313e82304c62403d66b993f6b74fe5ceb6130943f64ad50ee1fa41ab6';
    const providerEnvelope = encryptAccountDeletionProviderPayload('person@example.com', {
      requestId: REQUEST_ID,
      recipientHash,
    }, ENV);
    const encryptedPayload = {
      ciphertext: providerEnvelope.ciphertext.toString('base64'),
      nonce: providerEnvelope.nonce.toString('base64'),
      format: providerEnvelope.format,
      key_scope: providerEnvelope.keyScope,
      key_version: providerEnvelope.keyVersion,
      wrapped_key: providerEnvelope.wrappedKey.toString('base64'),
    };
    let authDeleted = false;
    let receiptCompleted = false;
    let providerCleaned = false;
    let providerAttempts = 0;
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/rest/v1/rpc/account_v2_deletion_status') {
        return json({
          outcome: 'ready', request_id: REQUEST_ID, user_id: USER_ID,
          state: receiptCompleted ? 'completed' : 'prepared',
          prepared_at: '2026-08-11T16:00:01.000Z',
          completed_at: receiptCompleted ? completedAt : null,
          expires_at: '2026-08-18T16:00:01.000Z',
          daily_sun_revoked: providerCleaned,
          daily_sun_reconciliation_required: !providerCleaned,
        });
      }
      if (url.pathname === `/auth/v1/admin/users/${USER_ID}`) {
        if (init?.method !== 'DELETE') return json({ id: USER_ID, email: 'person@example.com' });
        expect(url.searchParams.get('should_soft_delete')).toBe('false');
        authDeleted = true;
        return json({ id: USER_ID });
      }
      if (url.pathname === '/rest/v1/rpc/account_v2_list_daily_sun_aliases') {
        return json({ outcome: 'ready', aliases: [] });
      }
      if (url.pathname === '/rest/v1/rpc/account_v2_terminal_cleanup') {
        expect(authDeleted).toBe(false);
        const body = JSON.parse(String(init?.body));
        expect(body.candidate_provider_cleanup_entries).toEqual([{
          recipient_hash: recipientHash,
          encrypted_payload: expect.objectContaining({
            format: 'opaque_v1', key_scope: 'service', key_version: 5,
          }),
        }]);
        expect(body.candidate_provider_cleanup_inventory_complete).toBe(true);
        expect(String(init?.body)).not.toContain('person@example.com');
        return json({ outcome: 'ready', user_id: USER_ID });
      }
      if (url.pathname === '/rest/v1/rpc/account_v2_finish_deletion') {
        expect(authDeleted).toBe(true);
        receiptCompleted = true;
        return json({
          outcome: 'completed', request_id: REQUEST_ID, user_id: USER_ID,
          prepared_at: '2026-08-11T16:00:01.000Z', completed_at: completedAt,
          expires_at: '2026-08-18T16:00:01.000Z',
          daily_sun_revoked: false, daily_sun_reconciliation_required: true,
        });
      }
      if (url.pathname === '/rest/v1/rpc/account_v2_list_deletion_provider_cleanup') {
        return json({
          outcome: 'ready',
          entries: providerCleaned ? [] : [{
            recipient_hash: recipientHash,
            claim_id: cleanupClaimId,
            encrypted_payload: encryptedPayload,
            attempt_count: providerAttempts,
          }],
          has_more: false,
        });
      }
      if (url.pathname === '/rest/v1/rpc/account_v2_record_deletion_provider_cleanup') {
        const body = JSON.parse(String(init?.body));
        expect(body.candidate_cleanup_claim_id).toBe(cleanupClaimId);
        providerCleaned = body.candidate_succeeded === true;
        return json({
          outcome: 'recorded', recipient_hash: recipientHash,
          state: providerCleaned ? 'completed' : 'pending',
          daily_sun_revoked: providerCleaned,
          daily_sun_reconciliation_required: !providerCleaned,
        });
      }
      if (url.hostname === 'api.resend.com') {
        expect(authDeleted).toBe(true);
        expect(receiptCompleted).toBe(true);
        expect(init?.method).toBe('DELETE');
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        providerAttempts += 1;
        return providerAttempts === 1
          ? json({ message: 'temporary outage' }, 503)
          : new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const first = responseRecorder();
    const rollbackEnv = { ...ENV, ACCOUNT_SYNC_V2_API_ENABLED: '0' };
    await handleAccountApi(request('delete-finish'), first, {
      env: rollbackEnv, fetcher, now: () => NOW,
    });
    expect(first.statusCode).toBe(200);
    expect(JSON.parse(first.body)).toEqual({
      outcome: 'completed', requestId: REQUEST_ID, completedAt,
      dailySunRevoked: false, dailySunReconciliationRequired: true,
    });

    const retry = responseRecorder();
    await handleAccountApi(request('delete-finish'), retry, {
      env: rollbackEnv, fetcher, now: () => NOW,
    });
    expect(retry.statusCode).toBe(200);
    expect(JSON.parse(retry.body)).toEqual({
      outcome: 'completed', requestId: REQUEST_ID, completedAt,
      dailySunRevoked: true, dailySunReconciliationRequired: false,
    });
    expect(fetcher.mock.calls.filter(([input, init]) => (
      String(input).includes('/auth/v1/admin/users/') && init?.method === 'DELETE'
    )))
      .toHaveLength(1);
    expect(fetcher.mock.calls.filter(([input]) => String(input).includes('/rpc/account_v2_finish_deletion')))
      .toHaveLength(1);
    expect(fetcher.mock.calls.filter(([input]) => String(input).includes('api.resend.com')))
      .toHaveLength(2);
    const terminalIndex = fetcher.mock.calls.findIndex(([input]) => (
      String(input).includes('/rpc/account_v2_terminal_cleanup')
    ));
    const authDeleteIndex = fetcher.mock.calls.findIndex(([input, init]) => (
      String(input).includes('/auth/v1/admin/users/') && init?.method === 'DELETE'
    ));
    expect(authDeleteIndex).toBe(terminalIndex + 1);
  });

  it('maps a mismatched recovery proof to the same not-found response', async () => {
    const fetcher = vi.fn(async () => json({ outcome: 'recovery_mismatch' }));
    const response = responseRecorder();
    await handleAccountApi(request('delete-status'), response, { env: ENV, fetcher, now: () => NOW });
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'deletion_receipt_not_found' });
  });

  it('maps the database-enforced active receipt cap to a stable deletion block', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === '/auth/v1/user') {
        return json({ id: USER_ID, email: 'person@example.com' });
      }
      if (url.pathname === '/rest/v1/rpc/account_v2_list_daily_sun_aliases') {
        return json({ outcome: 'ready', aliases: [] });
      }
      if (url.pathname === '/rest/v1/rpc/account_v2_prepare_deletion') {
        return json({ outcome: 'receipt_limit_reached' });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    const response = responseRecorder();
    await handleAccountApi(request('delete-prepare'), response, {
      env: ENV, fetcher, now: () => NOW,
    });
    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toEqual({ error: 'deletion_blocked' });
  });

  it('runs one bounded receipt cleanup batch behind a dedicated secret while flags are off', async () => {
    const cleanupSecret = 'cleanup-secret-that-is-at-least-thirty-two-characters';
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/rest/v1/rpc/account_v2_cleanup_deletion_receipts');
      expect(JSON.parse(String(init?.body))).toEqual({ candidate_limit: 256 });
      return json(17);
    });
    const response = responseRecorder();
    await handleAccountApi(request('cleanup-receipts', {
      token: null,
      body: {},
      headers: { authorization: `Bearer ${cleanupSecret}` },
    }), response, {
      env: {
        ...ENV,
        ACCOUNT_SYNC_V2_API_ENABLED: '0',
        ACCOUNT_SYNC_V2_CLEANUP_SECRET: cleanupSecret,
      },
      fetcher,
      now: () => NOW,
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ removed: 17, limit: 256 });
    expect(fetcher).toHaveBeenCalledOnce();

    const deniedFetcher = vi.fn();
    const denied = responseRecorder();
    await handleAccountApi(request('cleanup-receipts', {
      token: null,
      body: {},
      headers: { authorization: 'Bearer wrong-secret-that-is-still-long-enough' },
    }), denied, {
      env: { ...ENV, ACCOUNT_SYNC_V2_CLEANUP_SECRET: cleanupSecret },
      fetcher: deniedFetcher,
      now: () => NOW,
    });
    expect(denied.statusCode).toBe(404);
    expect(deniedFetcher).not.toHaveBeenCalled();

    const oversizedFetcher = vi.fn();
    const oversized = responseRecorder();
    await handleAccountApi(request('cleanup-receipts', {
      token: null,
      body: { repeat: 'x'.repeat(4_096) },
      headers: { authorization: `Bearer ${cleanupSecret}` },
    }), oversized, {
      env: { ...ENV, ACCOUNT_SYNC_V2_CLEANUP_SECRET: cleanupSecret },
      fetcher: oversizedFetcher,
      now: () => NOW,
    });
    expect(oversized.statusCode).toBe(400);
    expect(oversizedFetcher).not.toHaveBeenCalled();
  });
});
