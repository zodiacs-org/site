import { afterEach, describe, expect, it, vi } from 'vitest';
import dispatcher, {
  COMPATIBILITY_INVITE_ACTIONS,
  compatibilityInviteHandlerForAction,
} from '../../../api/compatibility';
import { POSITION_BODY_ORDER } from '../share-positions';
import completeHandler from './routes/invite-complete';
import exchangeHandler from './routes/invite-exchange';
import revokeHandler from './routes/invite-revoke';
import sessionHandler from './routes/invite-session';
import sweepHandler from './routes/invite-sweep';
import invitesHandler from './routes/invites';
import { compatibilityInviteTokenHash } from './token';

const ORIGINAL_ENV = { ...process.env };
const OWNER_ID = '110e8400-e29b-41d4-a716-446655440000';
const CHART_ID = '220e8400-e29b-41d4-a716-446655440000';
const INVITE_ID = '330e8400-e29b-41d4-a716-446655440000';
const TOKEN = 'A'.repeat(43);
const OTHER_TOKEN = 'B'.repeat(43);
const SESSION_A = 'a'.repeat(22);
const SESSION_B = 'b'.repeat(22);

function configure(enabled = true): void {
  Object.assign(process.env, {
    PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    COMPAT_INVITES_ENABLED: enabled ? '1' : '0',
    COMPAT_INVITE_BASE_URL: 'https://zodiacs.org',
    COMPAT_INVITE_TEST_USER_IDS: OWNER_ID,
    COMPAT_INVITE_SWEEP_SECRET: 's'.repeat(32),
    COMPAT_INVITE_RECIPIENT_HASH_SECRET: 'r'.repeat(32),
  });
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

function responseRecorder() {
  return {
    statusCode: 0,
    headers: new Map<string, string | string[]>(),
    body: '',
    setHeader(name: string, value: string | string[]) { this.headers.set(name.toLowerCase(), value); },
    end(value = '') { this.body = value; },
  };
}

const BROWSER_HEADERS = {
  origin: 'https://zodiacs.org',
  host: 'zodiacs.org',
  authorization: 'Bearer access-token',
  'content-type': 'application/json',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function chartPayload() {
  return {
    name: 'Private chart',
    birth: { date: '1907-07-06', time: '08:30', timeKnown: true, place: { name: 'Private' } },
    summary: {
      engineVersion: 'zodiacs-1.0.0',
      utcISO: '1907-07-06T08:30:00.000Z',
      houseSystem: 'whole',
      bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: index * 27 })),
      angles: { asc: 12, mc: 101 },
    },
  };
}

describe('Phase 4 invite API boundary', () => {
  it('routes the seven public paths through one exact, fail-closed dispatcher', async () => {
    expect(COMPATIBILITY_INVITE_ACTIONS).toEqual([
      'invites',
      'invite-exchange',
      'invite-session',
      'invite-complete',
      'invite-revoke',
      'invite-hide',
      'invite-sweep',
    ]);
    for (const action of COMPATIBILITY_INVITE_ACTIONS) {
      expect(compatibilityInviteHandlerForAction(action)).toBeTypeOf('function');
    }
    expect(compatibilityInviteHandlerForAction(['invites'])).toBeNull();
    expect(compatibilityInviteHandlerForAction('not-an-action')).toBeNull();

    const response = responseRecorder();
    await dispatcher({ query: { action: 'not-an-action' } }, response);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'not_found' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('fails creation closed before authentication or database access when the flag is off', async () => {
    configure(false);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await invitesHandler({
      method: 'POST',
      headers: BROWSER_HEADERS,
      body: { chartId: CHART_ID, consent: true, notify: false },
    }, response);
    expect(response.statusCode).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fails creation closed without a named canary before reading any chart', async () => {
    configure();
    delete process.env.COMPAT_INVITE_TEST_USER_IDS;
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return json({ id: OWNER_ID, email: 'owner@example.com' });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await invitesHandler({
      method: 'POST',
      headers: BROWSER_HEADERS,
      body: { chartId: CHART_ID, consent: true, notify: false },
    }, response);
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error: 'canary_only' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/auth/v1/user');
  });

  it('lets public users reach only their own synchronized saved-chart boundary', async () => {
    configure();
    delete process.env.COMPAT_INVITE_TEST_USER_IDS;
    process.env.COMPAT_INVITES_PUBLIC_ENABLED = '1';
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return json({ id: OWNER_ID, email: 'owner@example.com' });
      }
      if (url.includes('/rest/v1/charts?')) return json([]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await invitesHandler({
      method: 'POST',
      headers: BROWSER_HEADERS,
      body: { chartId: CHART_ID, consent: true, notify: false },
    }, response);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'chart_not_found' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1]?.[0])).toContain('/rest/v1/charts?');
  });

  it('authenticates, derives positions server-side, and returns the raw URL once', async () => {
    configure();
    let createBody: Record<string, unknown> | null = null;
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: OWNER_ID, email: 'owner@example.com' });
      if (url.includes('/rest/v1/charts?')) return json([{ id: CHART_ID, payload: chartPayload() }]);
      if (url.endsWith('/rest/v1/rpc/create_compatibility_invite')) {
        createBody = JSON.parse(String(init?.body));
        return json({
          outcome: 'created',
          invite_id: INVITE_ID,
          expires_at: '2026-08-07T00:00:00.000Z',
        });
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await invitesHandler({
      method: 'POST',
      headers: BROWSER_HEADERS,
      body: { chartId: CHART_ID, consent: true, notify: false },
    }, response);
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.url).toMatch(/^https:\/\/zodiacs\.org\/c\/[A-Za-z0-9_-]{43}\/$/u);
    expect(createBody).not.toBeNull();
    const persisted = createBody as unknown as Record<string, unknown>;
    expect(persisted.candidate_token_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.stringify(persisted)).not.toMatch(
      /owner@example|1907|Private place|birth|chart_id|raw_token/iu,
    );
    const rawToken = body.url.split('/').at(-2);
    expect(JSON.stringify(persisted)).not.toContain(rawToken);
  });

  it('exchanges a path token for a scoped cookie and a token-free destination', async () => {
    configure();
    const fetcher = vi.fn().mockResolvedValue(json({
      outcome: 'ready',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    }));
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await exchangeHandler({ method: 'GET', query: { token: TOKEN }, headers: {} }, response);
    expect(response.statusCode).toBe(303);
    const location = String(response.headers.get('location'));
    expect(location).toMatch(/^\/compatibility\/#invite=[A-Za-z0-9_-]{22}$/u);
    const handle = location.split('=').at(-1)!;
    const cookie = String(response.headers.get('set-cookie'));
    expect(cookie).toContain(`zodiacs_compat_invite_${handle}=${TOKEN}`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(location).not.toContain(TOKEN);
    const rpcBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(rpcBody.candidate_token_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(rpcBody.candidate_token_hash).not.toBe(TOKEN);
  });

  it('returns only the public positions payload from the cookie session', async () => {
    configure();
    let readBody: Record<string, unknown> | null = null;
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      readBody = JSON.parse(String(init?.body));
      return json({
        outcome: 'ready',
        label: 'Private chart',
        sun_sign: 'aries',
        positions: {
          b: POSITION_BODY_ORDER.map((_, index) => index * 27),
          a: [12, 101],
          h: 'w',
          v: 'zodiacs-1.0.0',
        },
        time_known: true,
        expires_at: '2026-08-07T00:00:00.000Z',
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await sessionHandler({
      method: 'GET',
      query: { session: SESSION_A },
      headers: {
        origin: 'https://zodiacs.org',
        host: 'zodiacs.org',
        cookie: [
          `zodiacs_compat_invite_${SESSION_A}=${TOKEN}`,
          `zodiacs_compat_invite_${SESSION_B}=${OTHER_TOKEN}`,
        ].join('; '),
      },
    }, response);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      state: 'ready',
      payload: { label: 'Private chart', sunSign: 'aries', timeKnown: true },
    });
    expect(JSON.stringify(body)).not.toMatch(/token|owner|email|chartId|birth|place/iu);
    expect(readBody).toEqual({
      candidate_token_hash: compatibilityInviteTokenHash(TOKEN),
    });
  });

  it('rejects completion data and leaves owner withdrawal live while creation is off', async () => {
    configure(false);
    const noFetch = vi.fn();
    vi.stubGlobal('fetch', noFetch);
    const completeResponse = responseRecorder();
    await completeHandler({
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        cookie: `zodiacs_compat_invite_${SESSION_A}=${TOKEN}`,
      },
      query: { session: SESSION_A },
      body: { birth: 'must not cross' },
    }, completeResponse);
    expect(completeResponse.statusCode).toBe(400);
    expect(noFetch).not.toHaveBeenCalled();

    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: OWNER_ID, email: 'owner@example.com' });
      if (url.endsWith('/rest/v1/rpc/revoke_compatibility_invite')) {
        return json({ outcome: 'revoked', invite_id: INVITE_ID });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const revokeResponse = responseRecorder();
    await revokeHandler({
      method: 'POST',
      headers: BROWSER_HEADERS,
      body: { id: INVITE_ID },
    }, revokeResponse);
    expect(revokeResponse.statusCode).toBe(200);
    expect(JSON.parse(revokeResponse.body)).toEqual({ state: 'revoked' });
  });

  it('does not schedule a completion email when the owner did not request one', async () => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/rest/v1/rpc/complete_compatibility_invite')) {
        return json({
          outcome: 'completed',
          invite_id: INVITE_ID,
          owner_user_id: OWNER_ID,
          label: 'Private chart',
          notify_on_complete: false,
          completed_at: '2026-07-24T08:15:00.000Z',
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await completeHandler({
      method: 'POST',
      query: { session: SESSION_A },
      headers: {
        ...BROWSER_HEADERS,
        cookie: [
          `zodiacs_compat_invite_${SESSION_A}=${TOKEN}`,
          `zodiacs_compat_invite_${SESSION_B}=${OTHER_TOKEN}`,
        ].join('; '),
      },
      body: {},
    }, response);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      outcome: 'completed',
      notification: 'skipped',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0]))
      .toContain('/rest/v1/rpc/complete_compatibility_invite');
    expect(String(response.headers.get('set-cookie')))
      .toContain(`zodiacs_compat_invite_${SESSION_A}=`);
    expect(String(response.headers.get('set-cookie')))
      .not.toContain(`zodiacs_compat_invite_${SESSION_B}=`);
  });

  it('retries duplicate completion notification only through the durable claim', async () => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/rest/v1/rpc/complete_compatibility_invite')) {
        return json({
          outcome: 'duplicate',
          invite_id: INVITE_ID,
          owner_user_id: OWNER_ID,
          label: 'Private chart',
          notify_on_complete: true,
          completed_at: '2026-07-24T08:15:00.000Z',
        });
      }
      if (url.endsWith(`/auth/v1/admin/users/${OWNER_ID}`)) {
        return json({ id: OWNER_ID, email: 'owner@example.com' });
      }
      if (url.endsWith('/rest/v1/rpc/reserve_compatibility_invite_delivery')) {
        return json({ outcome: 'duplicate', state: 'sent' });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await completeHandler({
      method: 'POST',
      query: { session: SESSION_A },
      headers: {
        ...BROWSER_HEADERS,
        cookie: `zodiacs_compat_invite_${SESSION_A}=${TOKEN}`,
      },
      body: {},
    }, response);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      outcome: 'duplicate',
      notification: 'queued',
    });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(fetcher.mock.calls.some(([input]) => String(input).includes('api.resend.com'))).toBe(false);
  });

  it('keeps the sweep closed to an incorrect bearer', async () => {
    configure();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await sweepHandler({
      method: 'POST',
      headers: { authorization: `Bearer ${'x'.repeat(32)}` },
    }, response);
    expect(response.statusCode).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
