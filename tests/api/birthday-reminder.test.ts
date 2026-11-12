import { describe, expect, it, vi } from 'vitest';
import birthdayReminderHandler from '../../api/email/_birthday-reminder';
import { emailLifecycleRoute } from '../../api/email/subscribe';
import { unsubscribeToken } from '../../src/lib/birthday-reminder/core';
import vercel from '../../vercel.json';

const SECRET = 'x'.repeat(40);
const ENV = { BIRTHDAY_REMINDER_ENABLED: '1', PUBLIC_YEAR_SCORE_ENABLED: '1', PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service', RESEND_API_KEY: 'resend', RESEND_FROM_EMAIL: 'Zodiacs.org <hello@zodiacs.org>', BIRTHDAY_REMINDER_SECRET: SECRET };

function response() {
  const res: any = { headers: {} as Record<string, string>, statusCode: 0, body: '' };
  res.setHeader = (key: string, value: string) => { res.headers[key.toLowerCase()] = value; };
  res.end = (body = '') => { res.body = body; };
  return res;
}
const request = (method: string, init: { query?: Record<string, string>; body?: unknown; origin?: string } = {}) => ({
  method, query: { __zodiacs_email_route: 'birthday-reminder', ...(init.query ?? {}) }, body: init.body,
  headers: { origin: init.origin ?? 'https://zodiacs.org', host: 'zodiacs.org' },
});

describe('the birthday reminder endpoint', () => {
  it('is routed through the email lifecycle function, with no Function of its own', () => {
    expect(emailLifecycleRoute({ query: { __zodiacs_email_route: 'birthday-reminder' } })).toBe('birthday-reminder');
    expect((vercel as { rewrites: unknown[] }).rewrites).toContainEqual({ source: '/api/email/birthday-reminder', destination: '/api/email/subscribe?__zodiacs_email_route=birthday-reminder' });
  });

  it('answers 404 and calls nothing while the switch is off', async () => {
    const fetcher = vi.fn();
    const res = response();
    await birthdayReminderHandler(request('POST', { body: { email: 'a@b.co', month: 5, day: 3, consent: true, adult: true } }), res, { env: { ...ENV, BIRTHDAY_REMINDER_ENABLED: '0' }, fetcher, rateLimit: async () => false });
    expect(res.statusCode).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps a stop link working while the switch is off, as long as the list can be reached', async () => {
    const token = unsubscribeToken('0f8fad5b-d9cb-469f-a165-70867728950e', SECRET);
    for (const env of [{ ...ENV, BIRTHDAY_REMINDER_ENABLED: '0' }, { ...ENV, PUBLIC_YEAR_SCORE_ENABLED: '0', RESEND_API_KEY: '' }]) {
      const fetcher = vi.fn(async () => new Response('true'));
      const res = response();
      await birthdayReminderHandler(request('POST', { query: { unsubscribe: token } }), res, { env, fetcher: fetcher as unknown as typeof fetch });
      expect(res.statusCode).toBe(200);
      expect(String((fetcher.mock.calls[0] as unknown[])[0])).toContain('/rest/v1/rpc/birthday_reminder_delete');
    }
    // A confirmation still needs the switch.
    const res = response();
    await birthdayReminderHandler(request('POST', { query: { confirm: 'a'.repeat(43) } }), res, { env: { ...ENV, BIRTHDAY_REMINDER_ENABLED: '0' }, fetcher: vi.fn() as unknown as typeof fetch });
    expect(res.statusCode).toBe(404);
  });

  it('sends nothing for an address that already has a confirmed reminder, and answers the same', async () => {
    const fetcher = vi.fn(async () => new Response('{"outcome":"confirmed"}'));
    const res = response();
    await birthdayReminderHandler(request('POST', { body: { email: 'ana@example.com', month: 6, day: 9, consent: true, adult: true } }), res, { env: ENV, fetcher: fetcher as unknown as typeof fetch, rateLimit: async () => false });
    expect(res.statusCode).toBe(202);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('stores the email, month and day, sends one confirmation, and logs nothing', async () => {
    const calls: { url: string; body: string }[] = [];
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), body: String(init.body) });
      return String(url).includes('supabase') ? new Response('{"outcome":"requested","id":"0f8fad5b-d9cb-469f-a165-70867728950e"}') : new Response('{"id":"x"}');
    });
    const log = vi.spyOn(console, 'log'); const error = vi.spyOn(console, 'error'); const warn = vi.spyOn(console, 'warn');
    const res = response();
    await birthdayReminderHandler(request('POST', { body: { email: 'ana@example.com', month: 5, day: 3, consent: true, adult: true } }), res, { env: ENV, fetcher: fetcher as unknown as typeof fetch, rateLimit: async () => false });
    expect(res.statusCode).toBe(202);
    expect(JSON.parse(calls[0].body)).toMatchObject({ p_email: 'ana@example.com', p_month: 5, p_day: 3 });
    expect(Object.keys(JSON.parse(calls[0].body)).sort()).toEqual(['p_confirm_hash', 'p_day', 'p_email', 'p_month']);
    expect(calls[1].url).toBe('https://api.resend.com/emails');
    expect(calls[1].body).toContain('/api/email/birthday-reminder?confirm=');
    // The way out is in the confirmation email, from the start.
    expect(calls[1].body).toContain(`/api/email/birthday-reminder?unsubscribe=${unsubscribeToken('0f8fad5b-d9cb-469f-a165-70867728950e', SECRET)}`);
    expect(res.body).not.toContain('ana@example.com');
    for (const spy of [log, error, warn]) expect(spy).not.toHaveBeenCalled();
  });

  it('refuses a birth year, a missing yes, and a request from another site', async () => {
    for (const [body, error] of [[{ email: 'a@b.co', month: 5, day: 3, year: 1990, consent: true, adult: true }, 'unexpected-field'], [{ email: 'a@b.co', month: 5, day: 3, consent: true }, 'adult-required']] as const) {
      const res = response();
      await birthdayReminderHandler(request('POST', { body }), res, { env: ENV, fetcher: vi.fn() as unknown as typeof fetch, rateLimit: async () => false });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body)).toEqual({ error });
    }
    const res = response();
    await birthdayReminderHandler(request('POST', { body: {}, origin: 'https://elsewhere.example' }), res, { env: ENV, fetcher: vi.fn() as unknown as typeof fetch, rateLimit: async () => false });
    expect(res.statusCode).toBe(403);
  });

  it('acts on a confirmation or unsubscribe link only on POST, so mail scanners change nothing', async () => {
    const fetcher = vi.fn(async () => new Response('true'));
    const token = unsubscribeToken('0f8fad5b-d9cb-469f-a165-70867728950e', SECRET);
    const shown = response();
    await birthdayReminderHandler(request('GET', { query: { unsubscribe: token } }), shown, { env: ENV, fetcher: fetcher as unknown as typeof fetch });
    expect(shown.statusCode).toBe(200);
    expect(shown.body).toContain('Stop and delete');
    expect(fetcher).not.toHaveBeenCalled();
    const done = response();
    await birthdayReminderHandler(request('POST', { query: { unsubscribe: token } }), done, { env: ENV, fetcher: fetcher as unknown as typeof fetch });
    expect(done.statusCode).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String((fetcher.mock.calls[0] as unknown[])[0])).toContain('/rest/v1/rpc/birthday_reminder_delete');
  });
});
