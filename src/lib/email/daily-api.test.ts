import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import chartPreferenceHandler from '../../../api/email/chart-preference';
import confirmHandler from '../../../api/email/_confirm';
import unsubscribeHandler from '../../../api/email/_unsubscribe';
import { createDailyChartOptInToken } from './daily-chart-token';
import { createDailyUnsubscribeToken } from './daily-unsubscribe-token';
import { createEmailOptInToken } from './opt-in-token';
import { createDailySunOptInToken } from './daily-sun-token';
import { claimDailyChartConfirmationSend } from './daily-server';
import { dailyRecipientHash } from '../daily-email/identity';

const ORIGINAL_ENV = { ...process.env };
const SECRET = 'test-secret-that-is-at-least-thirty-two-characters';
const USER_ID = '110e8400-e29b-41d4-a716-446655440000';
const CHART_ID = '220e8400-e29b-41d4-a716-446655440000';
const CLAIM_TOKEN = '330e8400-e29b-41d4-a716-446655440000';
const CONTACT_ID = 'contact_12345678';
const RECIPIENT_HASH = dailyRecipientHash('person@example.com', SECRET);
const CLAIMED_AT = '2026-07-20T12:00:00.000Z';
const DAILY_SEGMENT = 'segment_daily_sun';

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

function configure(): void {
  Object.assign(process.env, {
    DAILY_EMAIL_ENABLED: '1',
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_sending_test',
    RESEND_CONTACTS_API_KEY: 're_contacts_test',
    RESEND_FROM_EMAIL: 'Zodiacs.org <hello@zodiacs.org>',
    EMAIL_CONFIRM_SECRET: SECRET,
    EMAIL_CONFIRM_BASE_URL: 'https://zodiacs.org',
    DAILY_EMAIL_UNSUBSCRIBE_SECRET: SECRET,
    DAILY_EMAIL_RECIPIENT_HASH_SECRET: SECRET,
    RESEND_DAILY_SEGMENT_ID: DAILY_SEGMENT,
    PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SERVICE_ROLE_KEY: 'service_test',
  });
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

const SITE_HEADERS = {
  origin: 'https://zodiacs.org',
  host: 'zodiacs.org',
  authorization: 'Bearer user_access_token',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function claimedChartSend(): Response {
  return json({ outcome: 'claimed', claimed_at: CLAIMED_AT, retry_after_seconds: 0 });
}


/** One eligible v2 chart source: account_v2_chart_email_sources answers ids and an envelope only. */
function chartEmailSourceRows(userId: string, chartId: string): Array<Record<string, unknown>> {
  return [{
    user_id: userId,
    chart_id: chartId,
    revision: 1,
    ciphertext: Buffer.alloc(32, 1).toString('base64'),
    nonce: Buffer.alloc(12, 2).toString('base64'),
    format: 'opaque_v1',
    key_scope: 'service',
    key_version: 1,
    wrapped_key: Buffer.alloc(68, 3).toString('base64'),
  }];
}

describe('daily chart confirmation send claim', () => {
  it('retries one thrown transport failure with the same idempotency token', async () => {
    configure();
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce(claimedChartSend());

    await expect(claimDailyChartConfirmationSend(
      USER_ID,
      CLAIM_TOKEN,
      process.env,
      fetcher,
    )).resolves.toEqual({
      outcome: 'claimed',
      claimedAt: CLAIMED_AT,
      retryAfterSeconds: 0,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const bodies = fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies).toEqual([
      { candidate_user_id: USER_ID, candidate_claim_token: CLAIM_TOKEN },
      { candidate_user_id: USER_ID, candidate_claim_token: CLAIM_TOKEN },
    ]);
  });

  it('does not retry a non-success response and rejects malformed success state', async () => {
    configure();
    const rejected = vi.fn().mockResolvedValue(json({}, 503));
    await expect(claimDailyChartConfirmationSend(
      USER_ID,
      CLAIM_TOKEN,
      process.env,
      rejected,
    )).rejects.toThrow(/claim failed \(503\)/u);
    expect(rejected).toHaveBeenCalledOnce();

    const malformed = vi.fn().mockResolvedValue(json({
      outcome: 'capped_24h',
      next_allowed_at: 'not-an-instant',
      retry_after_seconds: 900,
    }));
    await expect(claimDailyChartConfirmationSend(
      USER_ID,
      CLAIM_TOKEN,
      process.env,
      malformed,
    )).rejects.toThrow(/invalid state/u);
  });
});

describe('daily sun confirmation', () => {
  it('keeps GET read-only, commits DOI authority, then assigns the one daily segment', async () => {
    configure();
    const token = createDailySunOptInToken({ email: 'person@example.com', sign: 'libra' }, SECRET);
    let requestState: 'pending' | 'confirming' | 'confirmed' = 'pending';
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/rest/v1/rpc/inspect_daily_sun_confirmation')) {
        return json(requestState === 'pending'
          ? {
            outcome: 'valid', request_kind: 'subscribe', active_sign: null,
            confirmation_state: 'pending',
          }
          : { outcome: 'invalid' });
      }
      if (url.endsWith('/rest/v1/rpc/claim_daily_sun_confirmation')) {
        if (requestState !== 'pending') return json({ outcome: 'unavailable' });
        requestState = 'confirming';
        return json({ outcome: 'claimed', request_kind: 'subscribe', active_sign: null });
      }
      if (url.endsWith('/rest/v1/rpc/complete_daily_sun_confirmation')) {
        requestState = 'confirmed';
        return json({ outcome: 'completed', active_sign: 'libra' });
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_begin_daily_sun_provider_mutation')) {
        return json({ outcome: 'ready' });
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_finish_daily_sun_provider_mutation')) {
        return json({ outcome: 'released' });
      }
      if (url.includes('/rest/v1/daily_sun_preferences?') && !init?.method) {
        return json(requestState === 'confirmed' ? [{
          recipient_hash: RECIPIENT_HASH,
          sign: 'libra',
          confirmed_at: '2026-07-20T12:00:00.000Z',
          confirmed_by_attempt_id: USER_ID,
        }] : []);
      }
      if (url === 'https://api.resend.com/contacts' && init?.method === 'POST') {
        return json({ id: CONTACT_ID }, 201);
      }
      if (url.includes('/segments/')) return json({}, 200);
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const getResponse = responseRecorder();
    await confirmHandler({ method: 'GET', query: { token } }, getResponse);
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body).toContain('Confirm subscription');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/rpc/inspect_daily_sun_confirmation');
    expect(requestState).toBe('pending');

    const postResponse = responseRecorder();
    await confirmHandler({ method: 'POST', body: { token } }, postResponse);
    expect(postResponse.statusCode).toBe(200);
    expect(fetcher.mock.calls.filter(([url]) => String(url).startsWith('https://api.resend.com')))
      .toHaveLength(2);
    expect(requestState).toBe('confirmed');
    const segmentCalls = fetcher.mock.calls.filter(([url]) => String(url).includes('/segments/'));
    expect(segmentCalls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0);
    expect(segmentCalls.filter(([, init]) => init?.method === 'POST').map(([url]) => String(url)))
      .toEqual([`https://api.resend.com/contacts/${CONTACT_ID}/segments/${DAILY_SEGMENT}`]);
    for (const [, init] of fetcher.mock.calls.filter(([url]) => String(url).startsWith('https://api.resend.com'))) {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer re_contacts_test');
    }
    const completionIndex = fetcher.mock.calls.findIndex(([url]) => (
      String(url).endsWith('/rest/v1/rpc/complete_daily_sun_confirmation')
    ));
    const authorityIndices = fetcher.mock.calls
      .map(([url], index) => String(url).includes('/rest/v1/daily_sun_preferences?') ? index : -1)
      .filter((index) => index >= 0);
    const firstProviderIndex = fetcher.mock.calls.findIndex(([url]) => (
      String(url).startsWith('https://api.resend.com')
    ));
    const lastProviderIndex = fetcher.mock.calls.reduce((last, [url], index) => (
      String(url).startsWith('https://api.resend.com') ? index : last
    ), -1);
    expect(authorityIndices).toHaveLength(2);
    expect(completionIndex).toBeLessThan(authorityIndices[0]!);
    expect(authorityIndices[0]!).toBeLessThan(firstProviderIndex);
    expect(lastProviderIndex).toBeLessThan(authorityIndices[1]!);
  });

  it('retries a Resend 429 without moving segment membership for a sign change', async () => {
    configure();
    const token = createDailySunOptInToken({ email: 'person@example.com', sign: 'libra' }, SECRET);
    let requestState: 'pending' | 'confirming' | 'confirmed' = 'pending';
    let segmentAttempts = 0;
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/rest/v1/rpc/claim_daily_sun_confirmation')) {
        requestState = 'confirming';
        return json({ outcome: 'claimed', request_kind: 'subscribe', active_sign: null });
      }
      if (url.endsWith('/rest/v1/rpc/complete_daily_sun_confirmation')) {
        requestState = 'confirmed';
        return json({ outcome: 'completed', active_sign: 'libra' });
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_begin_daily_sun_provider_mutation')) {
        return json({ outcome: 'ready' });
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_finish_daily_sun_provider_mutation')) {
        return json({ outcome: 'released' });
      }
      if (url.includes('/rest/v1/daily_sun_preferences?') && !init?.method) {
        return json(requestState === 'confirmed' ? [{
          recipient_hash: RECIPIENT_HASH,
          sign: 'libra',
          confirmed_at: '2026-07-20T12:00:00.000Z',
          confirmed_by_attempt_id: USER_ID,
        }] : []);
      }
      if (url === 'https://api.resend.com/contacts' && init?.method === 'POST') {
        return json({ id: CONTACT_ID }, 201);
      }
      if (url.endsWith(`/${CONTACT_ID}/segments/${DAILY_SEGMENT}`) && init?.method === 'POST') {
        segmentAttempts += 1;
        return segmentAttempts === 1
          ? new Response('', { status: 429, headers: { 'retry-after': '0' } })
          : json({}, 200);
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await confirmHandler({ method: 'POST', body: { token } }, response);
    expect(response.statusCode).toBe(200);
    expect(segmentAttempts).toBe(2);
    expect(requestState).toBe('confirmed');
    const mutations = fetcher.mock.calls
      .filter(([url, init]) => String(url).startsWith('https://api.resend.com')
        && (init?.method === 'DELETE' || init?.method === 'POST'))
      .map(([url, init]) => `${init?.method} ${String(url)}`);
    expect(mutations).toEqual([
      'POST https://api.resend.com/contacts',
      `POST https://api.resend.com/contacts/${CONTACT_ID}/segments/${DAILY_SEGMENT}`,
      `POST https://api.resend.com/contacts/${CONTACT_ID}/segments/${DAILY_SEGMENT}`,
    ]);
    expect(mutations.some((mutation) => mutation.startsWith('DELETE '))).toBe(false);
  });

  it('does not let a superseded worker mutate provider routing', async () => {
    configure();
    const token = createDailySunOptInToken({ email: 'person@example.com', sign: 'libra' }, SECRET);
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/rest/v1/rpc/claim_daily_sun_confirmation')) {
        return json({ outcome: 'claimed', request_kind: 'sign_change', active_sign: 'aries' });
      }
      if (url.endsWith('/rest/v1/rpc/complete_daily_sun_confirmation')) {
        return json({ outcome: 'superseded', active_sign: 'aries' });
      }
      if (url.startsWith('https://api.resend.com')) return json({}, 200);
      throw new Error(`Unexpected request: GET ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const response = responseRecorder();
    await confirmHandler({ method: 'POST', body: { token, decision: 'switch' } }, response);

    expect(response.statusCode).toBe(409);
    expect(response.body).toContain('A newer request or unsubscribe replaced it');
    expect(fetcher.mock.calls.filter(([url]) => String(url).startsWith('https://api.resend.com')))
      .toHaveLength(0);
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      'https://project.supabase.co/rest/v1/rpc/claim_daily_sun_confirmation',
      'https://project.supabase.co/rest/v1/rpc/complete_daily_sun_confirmation',
    ]);
  });

  it('never upgrades a pending weekly token into daily consent', async () => {
    configure();
    process.env.STANDALONE_WEEKLY_EMAIL_ENABLED = '1';
    process.env.RESEND_SEGMENT_ID = 'segment_weekly_test';
    const token = createEmailOptInToken({
      email: 'person@example.com', sign: 'libra', locale: 'en',
    }, SECRET);
    const fetcher = vi.fn().mockResolvedValue(json({ id: CONTACT_ID }, 201));
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await confirmHandler({ method: 'POST', body: { token } }, response);
    expect(response.statusCode).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.resend.com/contacts');
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      email: 'person@example.com',
      properties: { sun_sign: 'libra' },
    });
  });
});

describe('daily chart preference', () => {
  it.each([
    {
      name: 'the request is cross-origin',
      headers: { ...SITE_HEADERS, origin: 'https://attacker.example' },
      expectedStatus: 403,
      authStatus: null,
    },
    {
      name: 'the bearer token is missing',
      headers: { origin: SITE_HEADERS.origin, host: SITE_HEADERS.host },
      expectedStatus: 401,
      authStatus: null,
    },
    {
      name: 'the bearer token is invalid',
      headers: { ...SITE_HEADERS, authorization: 'Bearer invalid_access_token' },
      expectedStatus: 401,
      authStatus: 401,
    },
  ])('rejects resend before preference or provider access when $name', async ({
    headers, expectedStatus, authStatus,
  }) => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (authStatus === 401 && url.endsWith('/auth/v1/user')) return json({}, 401);
      throw new Error(`Unexpected request: GET ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();

    await chartPreferenceHandler({
      method: 'POST', headers, body: { action: 'resend' },
    }, response);

    expect(response.statusCode).toBe(expectedStatus);
    const requestedUrls = fetcher.mock.calls.map(([url]) => String(url));
    expect(requestedUrls.filter((url) => (
      url.includes('/rest/v1/daily_chart_preferences')
      || url.startsWith('https://api.resend.com')
    ))).toEqual([]);
    if (authStatus === 401) {
      expect(requestedUrls).toEqual(['https://project.supabase.co/auth/v1/user']);
    } else {
      expect(requestedUrls).toEqual([]);
    }
  });

  it('authenticates, verifies chart ownership, stores only a pending token hash, and sends DOI', async () => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: USER_ID, email: 'person@example.com' });
      if (url.endsWith('/rest/v1/rpc/account_v2_chart_email_sources')) {
        return json(chartEmailSourceRows(USER_ID, CHART_ID));
      }
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) return json([]);
      if (url.endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')) return claimedChartSend();
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'POST') return json({}, 201);
      if (url === 'https://api.resend.com/emails' && init?.method === 'POST') return json({ id: 'email_1' }, 200);
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await chartPreferenceHandler({
      method: 'POST',
      headers: SITE_HEADERS,
      body: { chartId: CHART_ID, timezone: 'America/New_York' },
    }, response);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ ok: true, pending: true });
    const pendingWrite = fetcher.mock.calls.find(([url, init]) => (
      String(url).includes('daily_chart_preferences') && init?.method === 'POST'
    ));
    const pendingBody = JSON.parse(String(pendingWrite?.[1]?.body));
    expect(pendingBody).toMatchObject({
      user_id: USER_ID,
      chart_id: CHART_ID,
      recipient_hash: RECIPIENT_HASH,
      timezone: 'America/New_York',
      confirmed_at: null,
    });
    expect(pendingBody.confirmation_token_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(String(pendingWrite?.[1]?.body)).not.toContain('@');
    const emailRequest = fetcher.mock.calls.find(([url]) => String(url) === 'https://api.resend.com/emails');
    expect(new Headers(emailRequest?.[1]?.headers).get('authorization'))
      .toBe('Bearer re_sending_test');
    const emailBody = JSON.parse(String(emailRequest?.[1]?.body));
    expect(emailBody.to).toEqual(['person@example.com']);
    expect(emailBody.subject).toBe('Confirm your Zodiacs.org personal daily brief');
    expect(emailBody.text).toContain('personal daily brief for your synced chart');
    expect(emailBody.text).toContain('/api/email/confirm?token=');
    expect(emailBody).not.toHaveProperty('html');
    const claimIndex = fetcher.mock.calls.findIndex(([url]) => (
      String(url).endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')
    ));
    const preferenceIndex = fetcher.mock.calls.findIndex(([url, init]) => (
      String(url).includes('/rest/v1/daily_chart_preferences?') && init?.method === 'POST'
    ));
    const providerIndex = fetcher.mock.calls.findIndex(([url]) => (
      String(url) === 'https://api.resend.com/emails'
    ));
    expect(claimIndex).toBeGreaterThan(-1);
    expect(claimIndex).toBeLessThan(preferenceIndex);
    expect(preferenceIndex).toBeLessThan(providerIndex);
    const claimBody = JSON.parse(String(fetcher.mock.calls[claimIndex]?.[1]?.body));
    expect(claimBody.candidate_user_id).toBe(USER_ID);
    expect(claimBody.candidate_claim_token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
  });

  it('does not mislabel a pending request after the account email changes', async () => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return json({ id: USER_ID, email: 'new-address@example.com' });
      }
      if (url.includes('/rest/v1/daily_chart_preferences?')) {
        return json([{
          chart_id: CHART_ID,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: 'a'.repeat(64),
          timezone: 'UTC',
          confirmed_at: null,
        }]);
      }
      throw new Error(`Unexpected request: GET ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await chartPreferenceHandler({ method: 'GET', headers: SITE_HEADERS }, response);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      enabled: false,
      pending: true,
      maskedEmail: null,
    });
    expect(response.body).not.toContain('new-address');
    expect(response.body).not.toContain('person@example');
  });

  it('requires confirmation instead of claiming delivery after the account email changes', async () => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return json({ id: USER_ID, email: 'new-address@example.com' });
      }
      if (url.includes('/rest/v1/daily_chart_preferences?')) {
        return json([{
          chart_id: CHART_ID,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: null,
          timezone: 'UTC',
          confirmed_at: '2026-07-01T00:00:00.000Z',
        }]);
      }
      throw new Error(`Unexpected request: GET ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await chartPreferenceHandler({ method: 'GET', headers: SITE_HEADERS }, response);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      enabled: false,
      pending: false,
      requiresConfirmation: true,
      chartId: CHART_ID,
      maskedEmail: null,
    });
    expect(response.body).not.toContain('new-address');
    expect(response.body).not.toContain('person@example');
  });

  it('keeps a deleted-chart pause authoritative after the account email changes', async () => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return json({ id: USER_ID, email: 'new-address@example.com' });
      }
      if (url.includes('/rest/v1/daily_chart_preferences?')) {
        return json([{
          chart_id: null,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: null,
          timezone: 'UTC',
          confirmed_at: '2026-07-01T00:00:00.000Z',
        }]);
      }
      throw new Error(`Unexpected request: GET ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();

    await chartPreferenceHandler({ method: 'GET', headers: SITE_HEADERS }, response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      enabled: false,
      pending: false,
      paused: true,
      requiresConfirmation: true,
      chartId: null,
      timezone: 'UTC',
      confirmedAt: '2026-07-01T00:00:00.000Z',
      maskedEmail: null,
    });
  });

  it('resends only the current pending server selection with a conditional replacement', async () => {
    configure();
    const previousTokenHash = 'a'.repeat(64);
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: USER_ID, email: 'person@example.com' });
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) {
        return json([{
          chart_id: CHART_ID,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: previousTokenHash,
          timezone: 'America/New_York',
          confirmed_at: null,
        }]);
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_chart_email_sources')) {
        return json(chartEmailSourceRows(USER_ID, CHART_ID));
      }
      if (url.endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')) return claimedChartSend();
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'PATCH') {
        return json([{}]);
      }
      if (url === 'https://api.resend.com/emails' && init?.method === 'POST') {
        return json({ id: 'email_resend' });
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await chartPreferenceHandler({
      method: 'POST',
      headers: SITE_HEADERS,
      body: { action: 'resend', chartId: 'ignored-by-server' },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ ok: true, pending: true });
    const replacement = fetcher.mock.calls.find(([url, init]) => (
      String(url).includes('/daily_chart_preferences?') && init?.method === 'PATCH'
    ));
    expect(String(replacement?.[0])).toContain(`confirmation_token_hash=eq.${previousTokenHash}`);
    expect(String(replacement?.[0])).not.toContain('updated_at=');
    const replacementBody = JSON.parse(String(replacement?.[1]?.body));
    expect(replacementBody).toMatchObject({
      chart_id: CHART_ID,
      recipient_hash: RECIPIENT_HASH,
      timezone: 'America/New_York',
    });
    expect(replacementBody.confirmation_token_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(String(replacement?.[1]?.body)).not.toContain('@');
    const email = fetcher.mock.calls.find(([url]) => String(url) === 'https://api.resend.com/emails');
    expect(JSON.parse(String(email?.[1]?.body))).toMatchObject({
      to: ['person@example.com'],
    });
  });

  it('does not revive a pending request when confirmation wins the resend race', async () => {
    configure();
    let preferenceReads = 0;
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: USER_ID, email: 'person@example.com' });
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) {
        preferenceReads += 1;
        if (preferenceReads > 1) {
          return json([{
            chart_id: CHART_ID,
            recipient_hash: RECIPIENT_HASH,
            confirmation_token_hash: null,
            timezone: 'UTC',
            confirmed_at: '2026-07-20T00:00:00.000Z',
          }]);
        }
        return json([{
          chart_id: CHART_ID,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: 'a'.repeat(64),
          timezone: 'UTC',
          confirmed_at: null,
        }]);
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_chart_email_sources')) {
        return json(chartEmailSourceRows(USER_ID, CHART_ID));
      }
      if (url.endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')) return claimedChartSend();
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'PATCH') {
        return json([]);
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await chartPreferenceHandler({
      method: 'POST', headers: SITE_HEADERS, body: { action: 'resend' },
    }, response);
    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toEqual({ error: 'not_pending' });
    expect(fetcher.mock.calls.some(([url]) => String(url) === 'https://api.resend.com/emails')).toBe(false);
  });

  it('debounces a still-current pending resend atomically', async () => {
    configure();
    const tokenHash = 'a'.repeat(64);
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: USER_ID, email: 'person@example.com' });
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) {
        return json([{
          chart_id: CHART_ID,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: tokenHash,
          timezone: 'UTC',
          confirmed_at: null,
        }]);
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_chart_email_sources')) {
        return json(chartEmailSourceRows(USER_ID, CHART_ID));
      }
      if (url.endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')) {
        return json({
          outcome: 'capped_60s',
          next_allowed_at: '2026-07-20T12:00:37.000Z',
          retry_after_seconds: 37,
        });
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await chartPreferenceHandler({
      method: 'POST', headers: SITE_HEADERS, body: { action: 'resend' },
    }, response);
    expect(response.statusCode).toBe(429);
    expect(JSON.parse(response.body)).toEqual({
      error: 'rate_limited',
      retryAfterSeconds: 37,
    });
    expect(response.headers.get('Retry-After')).toBe('37');
    expect(fetcher.mock.calls.some(([url, init]) => (
      String(url).includes('/daily_chart_preferences?') && init?.method === 'PATCH'
    ))).toBe(false);
    expect(fetcher.mock.calls.some(([url]) => String(url) === 'https://api.resend.com/emails')).toBe(false);
  });

  it('applies the exact 24-hour account ceiling after an Auth email change', async () => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return json({ id: USER_ID, email: 'new-address@example.com' });
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_chart_email_sources')) {
        return json(chartEmailSourceRows(USER_ID, CHART_ID));
      }
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) {
        return json([{
          chart_id: CHART_ID,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: null,
          timezone: 'UTC',
          confirmed_at: '2026-07-01T00:00:00.000Z',
        }]);
      }
      if (url.endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')) {
        return json({
          outcome: 'capped_24h',
          next_allowed_at: '2026-07-21T06:00:00.000Z',
          retry_after_seconds: 64_800,
        });
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();

    await chartPreferenceHandler({
      method: 'POST', headers: SITE_HEADERS,
      body: { chartId: CHART_ID, timezone: 'UTC' },
    }, response);

    expect(response.statusCode).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('64800');
    expect(JSON.parse(response.body)).toEqual({
      error: 'rate_limited',
      retryAfterSeconds: 64_800,
    });
    const claim = fetcher.mock.calls.find(([url]) => (
      String(url).endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')
    ));
    expect(JSON.parse(String(claim?.[1]?.body))).toMatchObject({ candidate_user_id: USER_ID });
    expect(fetcher.mock.calls.some(([url, init]) => (
      String(url).includes('/daily_chart_preferences?') && init?.method === 'PATCH'
    ))).toBe(false);
    expect(fetcher.mock.calls.some(([url]) => String(url) === 'https://api.resend.com/emails')).toBe(false);
  });

  it('fails closed when the durable claim response is malformed', async () => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: USER_ID, email: 'person@example.com' });
      if (url.endsWith('/rest/v1/rpc/account_v2_chart_email_sources')) {
        return json(chartEmailSourceRows(USER_ID, CHART_ID));
      }
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) return json([]);
      if (url.endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')) {
        return json({ outcome: 'claimed', retry_after_seconds: 0 });
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();

    await chartPreferenceHandler({
      method: 'POST', headers: SITE_HEADERS,
      body: { chartId: CHART_ID, timezone: 'UTC' },
    }, response);

    expect(response.statusCode).toBe(502);
    expect(JSON.parse(response.body)).toEqual({ error: 'unavailable' });
    expect(fetcher.mock.calls.some(([url, init]) => (
      String(url).includes('/daily_chart_preferences?') && init?.method === 'POST'
    ))).toBe(false);
    expect(fetcher.mock.calls.some(([url]) => String(url) === 'https://api.resend.com/emails')).toBe(false);
  });

  it('restores the complete older pending request when resend delivery fails', async () => {
    configure();
    const oldTokenHash = 'a'.repeat(64);
    let patchCount = 0;
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: USER_ID, email: 'new-address@example.com' });
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) {
        return json([{
          chart_id: CHART_ID,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: oldTokenHash,
          timezone: 'UTC',
          confirmed_at: null,
        }]);
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_chart_email_sources')) {
        return json(chartEmailSourceRows(USER_ID, CHART_ID));
      }
      if (url.endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')) return claimedChartSend();
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'PATCH') {
        patchCount += 1;
        return json([{}]);
      }
      if (url === 'https://api.resend.com/emails' && init?.method === 'POST') {
        return json({ error: 'rejected' }, 422);
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await chartPreferenceHandler({
      method: 'POST', headers: SITE_HEADERS, body: { action: 'resend' },
    }, response);
    expect(response.statusCode).toBe(502);
    const patches = fetcher.mock.calls.filter(([url, init]) => (
      String(url).includes('/daily_chart_preferences?') && init?.method === 'PATCH'
    ));
    expect(patchCount).toBe(2);
    const replacementBody = JSON.parse(String(patches[0]?.[1]?.body));
    const restoreBody = JSON.parse(String(patches[1]?.[1]?.body));
    expect(replacementBody.recipient_hash).not.toBe(RECIPIENT_HASH);
    expect(restoreBody).toMatchObject({
      chart_id: CHART_ID,
      recipient_hash: RECIPIENT_HASH,
      confirmation_token_hash: oldTokenHash,
      timezone: 'UTC',
    });
    expect(String(patches[1]?.[0])).toContain(`confirmation_token_hash=eq.${replacementBody.confirmation_token_hash}`);
    expect(fetcher.mock.calls.filter(([url]) => (
      String(url).endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')
    ))).toHaveLength(1);
  });

  it('applies chart and timezone changes immediately after chart-tier consent is confirmed', async () => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: USER_ID, email: 'person@example.com' });
      if (url.endsWith('/rest/v1/rpc/account_v2_chart_email_sources')) {
        return json(chartEmailSourceRows(USER_ID, CHART_ID));
      }
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) {
        return json([{
          chart_id: null,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: null,
          timezone: 'UTC',
          confirmed_at: '2026-07-01T00:00:00.000Z',
        }]);
      }
      if (url.endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')) return claimedChartSend();
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'PATCH') {
        return json([{}]);
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await chartPreferenceHandler({
      method: 'POST',
      headers: SITE_HEADERS,
      body: { chartId: CHART_ID, timezone: 'Asia/Bangkok' },
    }, response);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: true,
      pending: false,
      preference: { chartId: CHART_ID, timezone: 'Asia/Bangkok', paused: false },
    });
    const update = fetcher.mock.calls.find(([url, init]) => (
      String(url).includes('/daily_chart_preferences?') && init?.method === 'PATCH'
    ));
    expect(String(update?.[0])).toContain('chart_id=is.null');
    expect(String(update?.[0])).toContain('confirmed_at=eq.2026-07-01T00%3A00%3A00.000Z');
    expect(JSON.parse(String(update?.[1]?.body))).toEqual({
      chart_id: CHART_ID,
      timezone: 'Asia/Bangkok',
    });
    expect(fetcher.mock.calls.some(([url]) => (
      String(url).endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')
    ))).toBe(false);
    expect(fetcher.mock.calls.some(([url]) => String(url) === 'https://api.resend.com/emails')).toBe(false);
  });

  it('does not recreate confirmed consent when opt-out wins a preference edit race', async () => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: USER_ID, email: 'person@example.com' });
      if (url.endsWith('/rest/v1/rpc/account_v2_chart_email_sources')) {
        return json(chartEmailSourceRows(USER_ID, CHART_ID));
      }
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) {
        return json([{
          chart_id: CHART_ID,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: null,
          timezone: 'UTC',
          confirmed_at: '2026-07-01T00:00:00.000Z',
        }]);
      }
      if (url.endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')) return claimedChartSend();
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'PATCH') {
        return json([]);
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await chartPreferenceHandler({
      method: 'POST', headers: SITE_HEADERS,
      body: { chartId: CHART_ID, timezone: 'Asia/Bangkok' },
    }, response);
    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toEqual({ error: 'preference_changed' });
    expect(fetcher.mock.calls.some(([url, init]) => (
      String(url).includes('/daily_chart_preferences?') && init?.method === 'POST'
    ))).toBe(false);
    expect(fetcher.mock.calls.some(([url]) => (
      String(url).endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')
    ))).toBe(false);
  });

  it('requires fresh confirmation instead of carrying chart consent to a changed account email', async () => {
    configure();
    const nextHash = dailyRecipientHash('new-address@example.com', SECRET);
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return json({ id: USER_ID, email: 'new-address@example.com' });
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_chart_email_sources')) {
        return json(chartEmailSourceRows(USER_ID, CHART_ID));
      }
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) {
        return json([{
          chart_id: CHART_ID,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: null,
          timezone: 'UTC',
          confirmed_at: '2026-07-01T00:00:00.000Z',
        }]);
      }
      if (url.endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')) return claimedChartSend();
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'PATCH') {
        return json([{}]);
      }
      if (url === 'https://api.resend.com/emails' && init?.method === 'POST') {
        return json({ id: 'email_changed_address' });
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await chartPreferenceHandler({
      method: 'POST',
      headers: SITE_HEADERS,
      body: { chartId: CHART_ID, timezone: 'Asia/Bangkok' },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ ok: true, pending: true });
    const preferenceWrite = fetcher.mock.calls.find(([url, init]) => (
      String(url).includes('/daily_chart_preferences?') && init?.method === 'PATCH'
    ));
    expect(String(preferenceWrite?.[0])).toContain(`chart_id=eq.${CHART_ID}`);
    expect(String(preferenceWrite?.[0])).toContain(`recipient_hash=eq.${RECIPIENT_HASH}`);
    expect(String(preferenceWrite?.[0])).toContain('confirmation_token_hash=is.null');
    expect(String(preferenceWrite?.[0])).toContain('timezone=eq.UTC');
    expect(String(preferenceWrite?.[0])).toContain('confirmed_at=eq.2026-07-01T00%3A00%3A00.000Z');
    expect(JSON.parse(String(preferenceWrite?.[1]?.body))).toMatchObject({
      recipient_hash: nextHash,
      confirmed_at: null,
      confirmation_token_hash: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
    expect(fetcher.mock.calls.some(([url, init]) => (
      String(url).includes('/daily_chart_preferences?') && init?.method === 'POST'
    ))).toBe(false);
    const confirmationEmail = fetcher.mock.calls.find(([url]) => (
      String(url) === 'https://api.resend.com/emails'
    ));
    expect(JSON.parse(String(confirmationEmail?.[1]?.body))).toMatchObject({
      to: ['new-address@example.com'],
    });
    const claim = fetcher.mock.calls.find(([url]) => (
      String(url).endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')
    ));
    expect(JSON.parse(String(claim?.[1]?.body))).toMatchObject({ candidate_user_id: USER_ID });
  });

  it('does not recreate consent when Stop wins a changed-recipient confirmation race', async () => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return json({ id: USER_ID, email: 'new-address@example.com' });
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_chart_email_sources')) {
        return json(chartEmailSourceRows(USER_ID, CHART_ID));
      }
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) {
        return json([{
          chart_id: CHART_ID,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: null,
          timezone: 'UTC',
          confirmed_at: '2026-07-01T00:00:00.000Z',
        }]);
      }
      if (url.endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')) return claimedChartSend();
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'PATCH') {
        return json([]);
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();

    await chartPreferenceHandler({
      method: 'POST', headers: SITE_HEADERS,
      body: { chartId: CHART_ID, timezone: 'Asia/Bangkok' },
    }, response);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toEqual({ error: 'preference_changed' });
    expect(fetcher.mock.calls.some(([url, init]) => (
      String(url).includes('/daily_chart_preferences?') && init?.method === 'POST'
    ))).toBe(false);
    expect(fetcher.mock.calls.some(([url]) => String(url) === 'https://api.resend.com/emails')).toBe(false);
  });

  it('keeps authenticated preference revocation available while sending is off', async () => {
    configure();
    process.env.DAILY_EMAIL_ENABLED = '0';
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: USER_ID, email: 'person@example.com' });
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'DELETE') return json({}, 200);
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await chartPreferenceHandler({ method: 'DELETE', headers: SITE_HEADERS }, response);
    expect(response.statusCode).toBe(200);
    expect(fetcher.mock.calls.some(([url, init]) => (
      String(url).includes('/daily_chart_preferences?user_id=eq.') && init?.method === 'DELETE'
    ))).toBe(true);
  });

  it('invalidates a pending confirmation link when the profile request is cancelled', async () => {
    configure();
    const token = createDailyChartOptInToken({
      userId: USER_ID,
      chartId: CHART_ID,
      recipientHash: RECIPIENT_HASH,
      timezone: 'UTC',
    }, SECRET);
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: USER_ID, email: 'person@example.com' });
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'DELETE') {
        return json({}, 200);
      }
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) return json([]);
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const cancelled = responseRecorder();
    await chartPreferenceHandler({ method: 'DELETE', headers: SITE_HEADERS }, cancelled);
    expect(cancelled.statusCode).toBe(200);

    const confirmation = responseRecorder();
    await confirmHandler({ method: 'POST', body: { token } }, confirmation);
    expect(confirmation.statusCode).toBe(409);
    expect(confirmation.body).toContain('This link is not valid.');
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/rest/v1/rpc/account_v2_chart_email_sources'))).toBe(false);
  });

  it('revalidates ownership before confirmation and then stores only the selection', async () => {
    configure();
    const token = createDailyChartOptInToken({
      userId: USER_ID, chartId: CHART_ID, recipientHash: RECIPIENT_HASH, timezone: 'Asia/Bangkok',
    }, SECRET);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) {
        return json([{
          chart_id: CHART_ID,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: tokenHash,
          timezone: 'Asia/Bangkok',
          confirmed_at: null,
        }]);
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_chart_email_sources')) return json(chartEmailSourceRows(USER_ID, CHART_ID));
      if (url.includes(`/auth/v1/admin/users/${USER_ID}`)) {
        return json({ id: USER_ID, email: 'person@example.com' });
      }
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'PATCH') return json([{}]);
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await confirmHandler({ method: 'POST', body: { token } }, response);
    expect(response.statusCode).toBe(200);
    const write = fetcher.mock.calls.find(([url, init]) => (
      String(url).includes('/daily_chart_preferences?') && init?.method === 'PATCH'
    ));
    expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({
      confirmation_token_hash: null,
      confirmed_at: expect.any(String),
    });
    expect(String(write?.[0])).toContain(`confirmation_token_hash=eq.${tokenHash}`);
    expect(String(write?.[0])).toContain(`chart_id=eq.${CHART_ID}`);
    expect(String(write?.[1]?.body)).not.toContain('@');
  });

  it('does not revive chart consent when cancellation wins the confirmation race', async () => {
    configure();
    const token = createDailyChartOptInToken({
      userId: USER_ID, chartId: CHART_ID, recipientHash: RECIPIENT_HASH, timezone: 'UTC',
    }, SECRET);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) {
        return json([{
          chart_id: CHART_ID,
          recipient_hash: RECIPIENT_HASH,
          confirmation_token_hash: tokenHash,
          timezone: 'UTC',
          confirmed_at: null,
        }]);
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_chart_email_sources')) return json(chartEmailSourceRows(USER_ID, CHART_ID));
      if (url.includes(`/auth/v1/admin/users/${USER_ID}`)) {
        return json({ id: USER_ID, email: 'person@example.com' });
      }
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'PATCH') {
        return json([]);
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await confirmHandler({ method: 'POST', body: { token } }, response);
    expect(response.statusCode).toBe(409);
    expect(response.body).toContain('This link is not valid.');
  });

  it('pauses a selected confirmed chart before local deletion can proceed', async () => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: USER_ID, email: 'person@example.com' });
      if (url.endsWith('/rest/v1/rpc/pause_or_cancel_daily_chart_for_deletion')
        && init?.method === 'POST') {
        return json({ outcome: 'paused', selected_chart_id: null });
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await chartPreferenceHandler({
      method: 'PATCH',
      headers: SITE_HEADERS,
      body: { chartId: CHART_ID },
    }, response);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true, paused: true, cancelled: false, selectedChartId: null,
    });
    const pause = fetcher.mock.calls.find(([url]) => (
      String(url).endsWith('/rest/v1/rpc/pause_or_cancel_daily_chart_for_deletion')
    ));
    expect(JSON.parse(String(pause?.[1]?.body))).toEqual({
      candidate_user_id: USER_ID,
      candidate_chart_id: CHART_ID,
    });
  });

  it('atomically cancels a pending chart request before local deletion', async () => {
    configure();
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return json({ id: USER_ID, email: 'person@example.com' });
      if (url.endsWith('/rest/v1/rpc/pause_or_cancel_daily_chart_for_deletion')
        && init?.method === 'POST') {
        return json({ outcome: 'cancelled', selected_chart_id: null });
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await chartPreferenceHandler({
      method: 'PATCH',
      headers: SITE_HEADERS,
      body: { chartId: CHART_ID },
    }, response);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true, paused: false, cancelled: true, selectedChartId: null,
    });
  });
});

describe('daily unsubscribe', () => {
  it('keeps GET scanner-safe and revokes only the Sun tier on POST', async () => {
    configure();
    const token = createDailyUnsubscribeToken({
      kind: 'sun', contactId: CONTACT_ID, recipientHash: RECIPIENT_HASH,
    }, SECRET);
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/contacts/${CONTACT_ID}`) && !init?.method) {
        return json({ id: CONTACT_ID, email: 'person@example.com' });
      }
      return json({}, 200);
    });
    vi.stubGlobal('fetch', fetcher);

    const getResponse = responseRecorder();
    await unsubscribeHandler({ method: 'GET', query: { token } }, getResponse);
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body).toContain('Confirm unsubscribe');
    expect(getResponse.body).toContain('p…@example.com');
    expect(getResponse.body).toContain('This stops the sun-sign daily');
    expect(getResponse.body).not.toContain('other daily tier');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1]?.method).toBeUndefined();
    fetcher.mockClear();

    process.env.DAILY_EMAIL_ENABLED = '0';
    const postResponse = responseRecorder();
    await unsubscribeHandler({ method: 'POST', query: { token } }, postResponse);
    expect(postResponse.statusCode).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(3);
    const deleted = fetcher.mock.calls
      .filter(([, init]) => init?.method === 'DELETE')
      .map(([url]) => String(url));
    expect(deleted).toEqual([
      `https://api.resend.com/contacts/${CONTACT_ID}/segments/${DAILY_SEGMENT}`,
    ]);
    const revoked = fetcher.mock.calls.find(([url, init]) => (
      String(url).endsWith('/rest/v1/rpc/revoke_daily_email_preference') && init?.method === 'POST'
    ));
    expect(JSON.parse(String(revoked?.[1]?.body))).toEqual({
      candidate_recipient_hash: RECIPIENT_HASH,
      candidate_tier: 'sun_sign',
      candidate_user_id: null,
    });
    const revokeIndex = fetcher.mock.calls.findIndex(([url]) => (
      String(url).endsWith('/rest/v1/rpc/revoke_daily_email_preference')
    ));
    const cleanupIndex = fetcher.mock.calls.findIndex(([url, init]) => (
      init?.method === 'DELETE' && String(url).includes('/segments/')
    ));
    expect(revokeIndex).toBeLessThan(cleanupIndex);
    expect(postResponse.body).toContain('No more sun-sign daily.');
  });

  it('uses a chart link to revoke only the personal tier', async () => {
    configure();
    const token = createDailyUnsubscribeToken({
      kind: 'chart',
      userId: USER_ID,
      recipientHash: RECIPIENT_HASH,
    }, SECRET);
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => json({}, 200));
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await unsubscribeHandler({ method: 'POST', query: { token } }, response);
    expect(response.statusCode).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toContain('/rest/v1/rpc/revoke_daily_email_preference');
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      candidate_recipient_hash: RECIPIENT_HASH,
      candidate_tier: 'chart',
      candidate_user_id: USER_ID,
    });
    expect(fetcher.mock.calls.some(([url]) => String(url).startsWith('https://api.resend.com'))).toBe(false);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/auth/v1/admin/users/'))).toBe(false);
    expect(response.body).toContain('No more personal daily brief.');
    expect(response.body).toContain('/profile/#daily-brief');
  });

  it('never exposes or unsubscribes a changed account email through an old chart link', async () => {
    configure();
    const token = createDailyUnsubscribeToken({
      kind: 'chart', userId: USER_ID, recipientHash: RECIPIENT_HASH,
    }, SECRET);
    const fetcher = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes(`/auth/v1/admin/users/${USER_ID}`)) {
        return json({ id: USER_ID, email: 'new-address@example.com' });
      }
      return json({}, 200);
    });
    vi.stubGlobal('fetch', fetcher);

    const getResponse = responseRecorder();
    await unsubscribeHandler({ method: 'GET', query: { token } }, getResponse);
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body).toContain('this address');
    expect(getResponse.body).not.toContain('new-address');
    fetcher.mockClear();

    const postResponse = responseRecorder();
    await unsubscribeHandler({ method: 'POST', query: { token } }, postResponse);
    expect(postResponse.statusCode).toBe(200);
    expect(fetcher.mock.calls.some(([url]) => String(url).startsWith('https://api.resend.com'))).toBe(false);
    expect(fetcher.mock.calls.some(([url, init]) => (
      String(url).endsWith('/rest/v1/rpc/revoke_daily_email_preference') && init?.method === 'POST'
    ))).toBe(true);
    const revoke = fetcher.mock.calls.find(([url]) => (
      String(url).endsWith('/rest/v1/rpc/revoke_daily_email_preference')
    ));
    expect(JSON.parse(String(revoke?.[1]?.body))).toMatchObject({
      candidate_tier: 'chart',
      candidate_user_id: USER_ID,
    });
  });

  it('keeps the Sun revocation authoritative when provider cleanup is unavailable', async () => {
    configure();
    const token = createDailyUnsubscribeToken({
      kind: 'sun', contactId: CONTACT_ID, recipientHash: RECIPIENT_HASH,
    }, SECRET);
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/rest/v1/rpc/revoke_daily_email_preference') && init?.method === 'POST') {
        return json(null, 200);
      }
      if (url.endsWith(`/contacts/${CONTACT_ID}`) && !init?.method) {
        return json({ id: CONTACT_ID, email: 'person@example.com' });
      }
      if (url.endsWith(`/${CONTACT_ID}/segments/${DAILY_SEGMENT}`) && init?.method === 'DELETE') {
        return json({ error: 'unavailable' }, 503);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await unsubscribeHandler({ method: 'POST', query: { token } }, response);
    expect(response.statusCode).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0]?.[0]).toContain('/rest/v1/rpc/revoke_daily_email_preference');
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      candidate_tier: 'sun_sign',
      candidate_user_id: null,
    });
    expect(response.body).toContain('Done');
  });

  it('revokes a valid list while enrollment and provider configuration are disabled', async () => {
    configure();
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_CONTACTS_API_KEY;
    delete process.env.RESEND_DAILY_SEGMENT_ID;
    process.env.DAILY_EMAIL_ENABLED = '0';
    const token = createDailyUnsubscribeToken({
      kind: 'chart', userId: USER_ID, recipientHash: RECIPIENT_HASH,
    }, SECRET);
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/rest/v1/rpc/revoke_daily_email_preference') && init?.method === 'POST') {
        return json(null, 200);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await unsubscribeHandler({ method: 'POST', query: { token } }, response);
    expect(response.statusCode).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(response.body).toContain('No more personal daily brief.');
  });

  it('does not reveal or clean a recycled Sun provider contact', async () => {
    configure();
    const token = createDailyUnsubscribeToken({
      kind: 'sun', contactId: CONTACT_ID, recipientHash: RECIPIENT_HASH,
    }, SECRET);
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/contacts/${CONTACT_ID}`) && !init?.method) {
        return json({ id: CONTACT_ID, email: 'someone-else@example.com' });
      }
      if (url.endsWith('/rest/v1/rpc/revoke_daily_email_preference') && init?.method === 'POST') {
        return json(null, 200);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const getResponse = responseRecorder();
    await unsubscribeHandler({ method: 'GET', query: { token } }, getResponse);
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body).toContain('this address');
    expect(getResponse.body).not.toContain('someone-else');
    fetcher.mockClear();

    const postResponse = responseRecorder();
    await unsubscribeHandler({ method: 'POST', query: { token } }, postResponse);
    expect(postResponse.statusCode).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes(`/${CONTACT_ID}/segments/`))).toBe(false);
  });
});
