import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import adminBootstrapHandler from '../../../api/email/admin-bootstrap';
import chartPreferenceHandler from '../../../api/email/chart-preference';
import confirmHandler from '../../../api/email/_confirm';
import { dailyRecipientHash } from '../daily-email/identity';
import {
  DAILY_EMAIL_ADMIN_BOOTSTRAP_HEADER,
} from './daily-admin-bootstrap';
import { createDailyChartOptInToken, verifyDailyChartOptInToken } from './daily-chart-token';
import { createDailySunOptInToken, verifyDailySunOptInToken } from './daily-sun-token';

const ORIGINAL_ENV = { ...process.env };
const ADMIN_EMAIL = 'admin@zodiacs.org';
const EMAIL_SECRET = 'email-secret-that-is-at-least-thirty-two-characters';
const BOOTSTRAP_SECRET = 'bootstrap-secret-that-is-at-least-thirty-two-characters';
const DAILY_SEGMENT = 'segment_daily_admin_canary';
const CONTACT_ID = 'contact_admin_canary';
const ADMIN_USER_ID = '110e8400-e29b-41d4-a716-446655440000';
const CHART_ID = '220e8400-e29b-41d4-a716-446655440000';
const CLAIMED_AT = '2026-07-21T16:30:00.000Z';

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

function configureBootstrap(): void {
  Object.assign(process.env, {
    RESEND_API_KEY: 're_sending_test',
    RESEND_CONTACTS_API_KEY: 're_contacts_test',
    RESEND_FROM_EMAIL: 'Zodiacs.org <hello@zodiacs.org>',
    EMAIL_CONFIRM_SECRET: EMAIL_SECRET,
    EMAIL_CONFIRM_BASE_URL: 'https://zodiacs.org',
    DAILY_EMAIL_UNSUBSCRIBE_SECRET: EMAIL_SECRET,
    DAILY_EMAIL_RECIPIENT_HASH_SECRET: EMAIL_SECRET,
    RESEND_DAILY_SEGMENT_ID: DAILY_SEGMENT,
    PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SERVICE_ROLE_KEY: 'service_test',
    DAILY_EMAIL_ADMIN_BOOTSTRAP_ENABLED: '1',
    DAILY_EMAIL_ADMIN_BOOTSTRAP_EMAIL: ADMIN_EMAIL,
    DAILY_EMAIL_ADMIN_BOOTSTRAP_SECRET: BOOTSTRAP_SECRET,
  });
  delete process.env.DAILY_EMAIL_ENABLED;
  delete process.env.EMAIL_PROVIDER;
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function bootstrapRequest(body: Record<string, unknown>, authorization = `Bearer ${BOOTSTRAP_SECRET}`) {
  return {
    method: 'POST',
    headers: { authorization },
    body,
  };
}

function chartRequest(
  body: Record<string, unknown>,
  options: { bootstrap?: string; accessToken?: string } = {},
) {
  return {
    method: 'POST',
    headers: {
      origin: 'https://zodiacs.org',
      host: 'zodiacs.org',
      authorization: `Bearer ${options.accessToken ?? 'admin_access_token'}`,
      ...(options.bootstrap === '' ? {} : {
        [DAILY_EMAIL_ADMIN_BOOTSTRAP_HEADER]: options.bootstrap
          ?? `Bearer ${BOOTSTRAP_SECRET}`,
      }),
    },
    body,
  };
}

describe('admin-only daily email bootstrap', () => {
  it('fails closed when its server-only configuration is incomplete', async () => {
    configureBootstrap();
    delete process.env.DAILY_EMAIL_ADMIN_BOOTSTRAP_SECRET;
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();

    await adminBootstrapHandler(bootstrapRequest({
      email: ADMIN_EMAIL,
      sign: 'libra',
      locale: 'en',
    }), response);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'not_found' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a missing or incorrect bearer before parsing or provider access', async () => {
    configureBootstrap();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    for (const authorization of ['', 'Bearer wrong-secret']) {
      const response = responseRecorder();
      await adminBootstrapHandler(bootstrapRequest({
        email: ADMIN_EMAIL,
        sign: 'libra',
        locale: 'en',
      }, authorization), response);
      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({ error: 'unauthorized' });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects every address except the fixed admin mailbox', async () => {
    configureBootstrap();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();

    await adminBootstrapHandler(bootstrapRequest({
      email: 'reader@example.com',
      sign: 'libra',
      locale: 'en',
    }), response);

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error: 'forbidden' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('stages and sends admin DOI while the public daily flag remains off', async () => {
    configureBootstrap();
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/rest/v1/rpc/stage_daily_sun_confirmation')) {
        return json({ outcome: 'new_request', active_sign: null });
      }
      if (url === 'https://api.resend.com/emails' && init?.method === 'POST') {
        return json({ id: 'email_admin_doi' });
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();

    await adminBootstrapHandler(bootstrapRequest({
      email: ADMIN_EMAIL,
      sign: 'libra',
      locale: 'en',
    }), response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true, pending: true });
    expect(process.env.DAILY_EMAIL_ENABLED).toBeUndefined();
    expect(process.env.EMAIL_PROVIDER).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);

    const stageRequest = fetcher.mock.calls.find(([url]) => (
      String(url).endsWith('/rest/v1/rpc/stage_daily_sun_confirmation')
    ));
    expect(JSON.parse(String(stageRequest?.[1]?.body))).toMatchObject({
      candidate_sign: 'libra',
    });
    expect(String(stageRequest?.[1]?.body)).not.toContain(ADMIN_EMAIL);

    const emailRequest = fetcher.mock.calls.find(([url]) => String(url) === 'https://api.resend.com/emails');
    const emailBody = JSON.parse(String(emailRequest?.[1]?.body));
    expect(emailBody.to).toEqual([ADMIN_EMAIL]);
    expect(emailBody.subject).toBe('Confirm your Zodiacs.org daily forecast');
    // The ring and the chosen sign's disc ride along as inline attachments.
    expect([...emailBody.html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/giu)].map((match) => match[1]))
      .toEqual(['cid:zodiacs-sign', 'cid:zodiacs-ring']);
    expect(emailBody.attachments.map((item: { filename: string }) => item.filename))
      .toEqual(['zodiacs-ring.png', 'libra.png']);
    const confirmationUrl = emailBody.text.match(/https:\/\/zodiacs\.org\/api\/email\/confirm\?token=\S+/u)?.[0];
    expect(confirmationUrl).toBeTruthy();
    const token = new URL(confirmationUrl!).searchParams.get('token') ?? '';
    expect(verifyDailySunOptInToken(token, EMAIL_SECRET)).toMatchObject({
      email: ADMIN_EMAIL,
      sign: 'libra',
    });
  });

  it('keeps the admin token scanner-safe on GET and confirms it on POST while public daily is off', async () => {
    configureBootstrap();
    const token = createDailySunOptInToken({ email: ADMIN_EMAIL, sign: 'libra' }, EMAIL_SECRET);
    const recipientHash = dailyRecipientHash(ADMIN_EMAIL, EMAIL_SECRET);
    let state: 'pending' | 'confirming' | 'confirmed' = 'pending';
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/rest/v1/rpc/inspect_daily_sun_confirmation')) {
        return json(state === 'pending' ? {
          outcome: 'valid',
          request_kind: 'subscribe',
          active_sign: null,
          confirmation_state: 'pending',
        } : { outcome: 'invalid' });
      }
      if (url.endsWith('/rest/v1/rpc/claim_daily_sun_confirmation')) {
        state = 'confirming';
        return json({ outcome: 'claimed', request_kind: 'subscribe', active_sign: null });
      }
      if (url.endsWith('/rest/v1/rpc/complete_daily_sun_confirmation')) {
        state = 'confirmed';
        return json({ outcome: 'completed', active_sign: 'libra' });
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_begin_daily_sun_provider_mutation')) {
        return json({ outcome: 'ready' });
      }
      if (url.endsWith('/rest/v1/rpc/account_v2_finish_daily_sun_provider_mutation')) {
        return json({ outcome: 'released' });
      }
      if (url.includes('/rest/v1/daily_sun_preferences?') && !init?.method) {
        return json(state === 'confirmed' ? [{
          recipient_hash: recipientHash,
          sign: 'libra',
          confirmed_at: '2026-07-21T12:00:00.000Z',
          confirmed_by_attempt_id: ADMIN_USER_ID,
        }] : []);
      }
      if (url === 'https://api.resend.com/contacts' && init?.method === 'POST') {
        return json({ id: CONTACT_ID }, 201);
      }
      if (url.endsWith(`/${CONTACT_ID}/segments/${DAILY_SEGMENT}`) && init?.method === 'POST') {
        return json({});
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const getResponse = responseRecorder();
    await confirmHandler({ method: 'GET', query: { token } }, getResponse);
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body).toContain('Confirm subscription');
    expect(state).toBe('pending');
    expect(fetcher).toHaveBeenCalledOnce();

    const postResponse = responseRecorder();
    await confirmHandler({ method: 'POST', body: { token } }, postResponse);
    expect(postResponse.statusCode).toBe(200);
    expect(postResponse.body).toContain('Subscription confirmed.');
    expect(state).toBe('confirmed');
    expect(process.env.DAILY_EMAIL_ENABLED).toBeUndefined();
    expect(process.env.EMAIL_PROVIDER).toBeUndefined();
    expect(fetcher.mock.calls.filter(([url]) => String(url).startsWith('https://api.resend.com')))
      .toHaveLength(2);
  });

  it('does not let a non-admin daily token use the public-off confirm exception', async () => {
    configureBootstrap();
    const token = createDailySunOptInToken({ email: 'reader@example.com', sign: 'libra' }, EMAIL_SECRET);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();

    await confirmHandler({ method: 'GET', query: { token } }, response);

    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('Confirm subscription');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('admin-only chart daily canary bootstrap', () => {
  const validSelection = { chartId: CHART_ID, timezone: 'UTC' };

  it('stays inert without the temporary variables and rejects missing or wrong bootstrap bearers', async () => {
    configureBootstrap();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    const missing = responseRecorder();
    await chartPreferenceHandler(chartRequest(validSelection, { bootstrap: '' }), missing);
    expect(missing.statusCode).toBe(503);

    const wrong = responseRecorder();
    await chartPreferenceHandler(chartRequest(validSelection, {
      bootstrap: 'Bearer wrong-secret',
    }), wrong);
    expect(wrong.statusCode).toBe(401);

    delete process.env.DAILY_EMAIL_ADMIN_BOOTSTRAP_SECRET;
    const removed = responseRecorder();
    await chartPreferenceHandler(chartRequest(validSelection), removed);
    expect(removed.statusCode).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requires a real Supabase session and the fixed admin account', async () => {
    configureBootstrap();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({
        id: ADMIN_USER_ID,
        email: 'reader@example.com',
      }));
    vi.stubGlobal('fetch', fetcher);

    const unauthenticated = responseRecorder();
    await chartPreferenceHandler(chartRequest(validSelection, {
      accessToken: 'invalid_access_token',
    }), unauthenticated);
    expect(unauthenticated.statusCode).toBe(401);

    const nonAdmin = responseRecorder();
    await chartPreferenceHandler(chartRequest(validSelection), nonAdmin);
    expect(nonAdmin.statusCode).toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [url] of fetcher.mock.calls) {
      expect(String(url)).toBe('https://project.supabase.co/auth/v1/user');
    }
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get('authorization'))
      .toBe('Bearer admin_access_token');
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get('authorization'))
      .not.toContain(BOOTSTRAP_SECRET);
  });

  it('rejects an invalid IANA timezone before ownership or DOI work', async () => {
    configureBootstrap();
    const fetcher = vi.fn().mockResolvedValue(json({
      id: ADMIN_USER_ID,
      email: ADMIN_EMAIL,
    }));
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();

    await chartPreferenceHandler(chartRequest({
      chartId: CHART_ID,
      timezone: 'Mars/Olympus_Mons',
    }), response);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'invalid' });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).toBe('https://project.supabase.co/auth/v1/user');
  });

  it('requires the selected chart to be synced and owned by the authenticated admin', async () => {
    configureBootstrap();
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return json({ id: ADMIN_USER_ID, email: ADMIN_EMAIL });
      }
      if (url.includes('/rest/v1/charts?')) return json([]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();

    await chartPreferenceHandler(chartRequest(validSelection), response);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'chart_not_found' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/rpc/'))).toBe(false);
    expect(fetcher.mock.calls.some(([url]) => String(url).startsWith('https://api.resend.com'))).toBe(false);
  });

  it('stages the normal pending authority and sends chart DOI without enabling public enrollment', async () => {
    configureBootstrap();
    const recipientHash = dailyRecipientHash(ADMIN_EMAIL, EMAIL_SECRET);
    let pendingWrite: Record<string, unknown> | null = null;
    let emailBody: Record<string, unknown> | null = null;
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return json({ id: ADMIN_USER_ID, email: ADMIN_EMAIL });
      }
      if (url.includes('/rest/v1/charts?')) {
        return json([{ id: CHART_ID, payload: { name: 'Canary chart' } }]);
      }
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) return json([]);
      if (url.endsWith('/rest/v1/rpc/claim_daily_chart_confirmation_send')) {
        return json({
          outcome: 'claimed',
          claimed_at: CLAIMED_AT,
          retry_after_seconds: 0,
        });
      }
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'POST') {
        pendingWrite = JSON.parse(String(init.body)) as Record<string, unknown>;
        return json({}, 201);
      }
      if (url === 'https://api.resend.com/emails' && init?.method === 'POST') {
        emailBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return json({ id: 'email_admin_chart_doi' });
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();

    await chartPreferenceHandler(chartRequest(validSelection), response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ ok: true, pending: true });
    expect(process.env.DAILY_EMAIL_ENABLED).toBeUndefined();
    expect(process.env.EMAIL_PROVIDER).toBeUndefined();
    expect(pendingWrite).toMatchObject({
      user_id: ADMIN_USER_ID,
      chart_id: CHART_ID,
      recipient_hash: recipientHash,
      timezone: 'UTC',
      confirmed_at: null,
    });
    expect(JSON.stringify(pendingWrite)).not.toContain(ADMIN_EMAIL);
    expect(emailBody).toMatchObject({
      to: [ADMIN_EMAIL],
      subject: 'Confirm your Zodiacs.org personal daily brief',
    });
    const confirmationUrl = String(
      (emailBody as Record<string, unknown> | null)?.text,
    )
      .match(/https:\/\/zodiacs\.org\/api\/email\/confirm\?token=\S+/u)?.[0];
    expect(confirmationUrl).toBeTruthy();
    const token = new URL(confirmationUrl!).searchParams.get('token') ?? '';
    expect(verifyDailyChartOptInToken(token, EMAIL_SECRET)).toMatchObject({
      userId: ADMIN_USER_ID,
      chartId: CHART_ID,
      recipientHash,
      timezone: 'UTC',
    });
  });

  it('keeps chart GET scanner-safe, commits only on POST, and rejects replay', async () => {
    configureBootstrap();
    const recipientHash = dailyRecipientHash(ADMIN_EMAIL, EMAIL_SECRET);
    const token = createDailyChartOptInToken({
      userId: ADMIN_USER_ID,
      chartId: CHART_ID,
      recipientHash,
      timezone: 'UTC',
    }, EMAIL_SECRET);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    let confirmedAt: string | null = null;
    let patchCount = 0;
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) {
        return json([{
          chart_id: CHART_ID,
          recipient_hash: recipientHash,
          confirmation_token_hash: confirmedAt ? null : tokenHash,
          timezone: 'UTC',
          confirmed_at: confirmedAt,
        }]);
      }
      if (url.includes('/rest/v1/charts?')) {
        return json([{ id: CHART_ID, payload: { name: 'Canary chart' } }]);
      }
      if (url.includes(`/auth/v1/admin/users/${ADMIN_USER_ID}`)) {
        return json({ id: ADMIN_USER_ID, email: ADMIN_EMAIL });
      }
      if (url.includes('/rest/v1/daily_chart_preferences?') && init?.method === 'PATCH') {
        patchCount += 1;
        confirmedAt = '2026-07-21T16:35:00.000Z';
        return json([{}]);
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const getResponse = responseRecorder();
    await confirmHandler({ method: 'GET', query: { token } }, getResponse);
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body).toContain('Confirm subscription');
    expect(confirmedAt).toBeNull();
    expect(patchCount).toBe(0);

    const postResponse = responseRecorder();
    await confirmHandler({ method: 'POST', body: { token } }, postResponse);
    expect(postResponse.statusCode).toBe(200);
    expect(postResponse.body).toContain('Subscription confirmed.');
    expect(confirmedAt).not.toBeNull();
    expect(patchCount).toBe(1);

    const replay = responseRecorder();
    await confirmHandler({ method: 'POST', body: { token } }, replay);
    expect(replay.statusCode).toBe(409);
    expect(replay.body).toContain('This link is not valid.');
    expect(patchCount).toBe(1);
  });

  it('makes an already-issued chart token inert when bootstrap configuration is removed', async () => {
    configureBootstrap();
    const recipientHash = dailyRecipientHash(ADMIN_EMAIL, EMAIL_SECRET);
    const token = createDailyChartOptInToken({
      userId: ADMIN_USER_ID,
      chartId: CHART_ID,
      recipientHash,
      timezone: 'UTC',
    }, EMAIL_SECRET);
    delete process.env.DAILY_EMAIL_ADMIN_BOOTSTRAP_SECRET;
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    const getResponse = responseRecorder();
    await confirmHandler({ method: 'GET', query: { token } }, getResponse);
    expect(getResponse.statusCode).toBe(503);
    expect(getResponse.body).not.toContain('Confirm subscription');

    const postResponse = responseRecorder();
    await confirmHandler({ method: 'POST', body: { token } }, postResponse);
    expect(postResponse.statusCode).toBe(503);
    expect(postResponse.body).not.toContain('Subscription confirmed.');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not present or commit an admin-hash token for a different current account email', async () => {
    configureBootstrap();
    const recipientHash = dailyRecipientHash(ADMIN_EMAIL, EMAIL_SECRET);
    const token = createDailyChartOptInToken({
      userId: ADMIN_USER_ID,
      chartId: CHART_ID,
      recipientHash,
      timezone: 'UTC',
    }, EMAIL_SECRET);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/daily_chart_preferences?') && !init?.method) {
        return json([{
          chart_id: CHART_ID,
          recipient_hash: recipientHash,
          confirmation_token_hash: tokenHash,
          timezone: 'UTC',
          confirmed_at: null,
        }]);
      }
      if (url.includes('/rest/v1/charts?')) {
        return json([{ id: CHART_ID, payload: { name: 'Canary chart' } }]);
      }
      if (url.includes(`/auth/v1/admin/users/${ADMIN_USER_ID}`)) {
        return json({ id: ADMIN_USER_ID, email: 'reader@example.com' });
      }
      if (init?.method === 'PATCH') throw new Error('Consent must not be committed.');
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const getResponse = responseRecorder();
    await confirmHandler({ method: 'GET', query: { token } }, getResponse);
    expect(getResponse.statusCode).toBe(400);
    expect(getResponse.body).not.toContain('Confirm subscription');

    const postResponse = responseRecorder();
    await confirmHandler({ method: 'POST', body: { token } }, postResponse);
    expect(postResponse.statusCode).toBe(409);
    expect(postResponse.body).toContain('Request a fresh link');
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });
});
