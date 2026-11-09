import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ subscribe: [] as unknown[][], stage: [] as unknown[][], confirm: [] as unknown[][], dispatched: [] as unknown[], waits: [] as Promise<unknown>[] }));
const state = vi.hoisted(() => ({ staged: 'staged' as 'staged' | 'unavailable', confirmed: false, limited: false }));

vi.mock('@vercel/functions', () => ({ waitUntil: (promise: Promise<unknown>) => { calls.waits.push(promise); } }));
vi.mock('@vercel/firewall', () => ({ checkRateLimit: async () => ({ rateLimited: state.limited }) }));
vi.mock('../../email/provider.js', () => ({ createEmailSubscriptionAdapter: () => ({ provider: 'resend', subscribe: async (...args: unknown[]) => { calls.subscribe.push(args); return { provider: 'resend', pending: true }; } }) }));
vi.mock('../../email/daily-sun-server.js', () => ({
  dailySunRecipientHash: (email: string) => (email === 'sam@example.com' ? 'f'.repeat(64) : 'e'.repeat(64)),
  getDailySunPreference: async () => (state.confirmed ? { recipientHash: 'f'.repeat(64), sign: 'leo', confirmedAt: '2026-01-01T00:00:00Z', confirmedByAttemptId: 'x' } : null),
}));
vi.mock('../signup-notify.js', () => ({ dispatchConfirmedInvites: async (rows: unknown) => { calls.dispatched.push(rows); } }));
vi.mock('../signup.js', async (original) => ({
  ...(await original<typeof import('../signup.js')>()),
  stageCompatibilityInviteSignup: async (...args: unknown[]) => { calls.stage.push(args); return state.staged; },
  confirmCompatibilityInviteSignups: async (...args: unknown[]) => { calls.confirm.push(args); return [{ inviteId: 'i', ownerUserId: 'o', label: 'Sam', notify: true, completedAt: 'now' }]; },
}));

import handler, { parseInviteSignup } from './invite-signup';
import { SIGNUP_ENV } from '../signup-fixture';

const ORIGINAL_ENV = { ...process.env };
const SESSION = 'a'.repeat(22);
const TOKEN = 'A'.repeat(43);
const BODY = { email: 'Sam@Example.com ', sign: 'leo', consent: true, adult: true };

beforeEach(() => {
  Object.assign(process.env, SIGNUP_ENV);
  Object.assign(calls, { subscribe: [], stage: [], confirm: [], dispatched: [], waits: [] });
  Object.assign(state, { staged: 'staged', confirmed: false, limited: false });
});
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

function recorder() {
  return { statusCode: 0, headers: new Map<string, unknown>(), body: '', setHeader(name: string, value: unknown) { this.headers.set(name.toLowerCase(), value); }, end(value = '') { this.body = value; } };
}
async function post(body: unknown, cookie = true, session = SESSION) {
  const res = recorder();
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  await handler({ method: 'POST', query: { session }, body: text,
    headers: { origin: 'https://zodiacs.org', host: 'zodiacs.org', 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(text)), ...(cookie ? { cookie: `zodiacs_compat_invite_${session}=${TOKEN}` } : {}) } }, res);
  await Promise.all(calls.waits);
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, headers: res.headers };
}

describe('the invite signup body', () => {
  it('takes exactly the address, a sign and two yeses', () => {
    expect(parseInviteSignup(BODY)).toEqual({ email: 'sam@example.com', sign: 'leo' });
    for (const bad of [
      { ...BODY, consent: false }, { ...BODY, adult: false }, { ...BODY, consent: 'yes' }, { ...BODY, sign: 'ophiuchus' }, { ...BODY, email: 'not-an-email' },
      { ...BODY, birthDate: '1990-05-03' }, { ...BODY, time: '08:30' }, { ...BODY, name: 'Sam' }, { email: BODY.email, sign: 'leo', consent: true },
      [BODY], 'not json', null,
    ]) expect(parseInviteSignup(bad), JSON.stringify(bad)).toBeNull();
  });
});

describe('POST /api/compatibility/invite-signup', () => {
  it('is not found while the switch is off, and sends nothing', async () => {
    for (const value of ['0', '', 'true']) {
      process.env.INVITE_SIGNUP_ENABLED = value;
      expect((await post(BODY)).status).toBe(404);
    }
    expect(calls.stage).toEqual([]);
    expect(calls.subscribe).toEqual([]);
  });

  it('stages the invite against the address hash and sends the daily double opt-in, with the address and sign only', async () => {
    const reply = await post(BODY);
    expect(reply).toMatchObject({ status: 200, body: { outcome: 'pending' } });
    expect(calls.stage).toHaveLength(1);
    expect(calls.stage[0][1]).toBe('f'.repeat(64));
    expect(String(calls.stage[0][0])).toMatch(/^[0-9a-f]{64}$/u);
    expect(calls.subscribe).toEqual([['sam@example.com', 'leo']]);
    expect(calls.confirm).toEqual([]);
    // The capability stays: the invite is not complete until they confirm.
    expect(reply.headers.has('set-cookie')).toBe(false);
  });

  it('completes at once for an address already confirmed for the daily email, and sends no second confirmation', async () => {
    state.confirmed = true;
    expect((await post(BODY)).body).toEqual({ outcome: 'pending' });
    expect(calls.subscribe).toEqual([]);
    expect(calls.confirm).toEqual([['f'.repeat(64)]]);
    expect(calls.dispatched).toHaveLength(1);
  });

  it('sends nothing for an invite that has closed, or without the invite capability, and answers alike', async () => {
    state.staged = 'unavailable';
    expect((await post(BODY)).body).toEqual({ outcome: 'unavailable' });
    expect((await post(BODY, false)).body).toEqual({ outcome: 'unavailable' });
    expect(calls.subscribe).toEqual([]);
  });

  it('refuses a body with a birth detail before touching anything, and never echoes it', async () => {
    const reply = await post({ ...BODY, birthDate: '1990-05-03' });
    expect(reply.status).toBe(400);
    expect(JSON.stringify(reply.body)).not.toContain('1990');
    expect(calls.stage).toEqual([]);
  });

  it('holds to the daily signup rate limit', async () => {
    state.limited = true;
    const reply = await post(BODY);
    expect(reply.status).toBe(429);
    expect(reply.headers.get('retry-after')).toBe('60');
    expect(calls.stage).toEqual([]);
  });
});
