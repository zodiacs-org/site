import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The create and completion routes with invite signups on: the invite is
 * created and completed as released, and a consent row is recorded only for a
 * version the page sent and the server knows (ZOD-21).
 */
const state = vi.hoisted(() => ({ created: 0, completed: 0 }));

vi.mock('@vercel/functions', () => ({ waitUntil: () => undefined }));
vi.mock('../../email/daily-server.js', () => ({
  authenticateEmailUser: async () => ({ id: '110e8400-e29b-41d4-a716-446655440000', email: 'owner@example.com' }),
}));
vi.mock('../../engine/server-ephemeris.js', () => ({ bodyLongitude: () => 10 }));
vi.mock('../email.js', () => ({ dispatchCompatibilityInviteCompletionEmail: async () => undefined }));
vi.mock('../validate.js', async (original) => ({
  ...(await original<typeof import('../validate.js')>()),
  deriveInviteChartFromSyncedPayload: () => ({ label: 'Sam', sunSign: 'leo', positions: { b: [], h: 'w', v: 't' }, timeKnown: true }),
}));
vi.mock('../server.js', () => ({
  getOwnedSyncedChartPayload: async () => ({}),
  listCompatibilityInvites: async () => [],
  createCompatibilityInvite: async () => {
    state.created += 1;
    return { outcome: 'created', id: '330e8400-e29b-41d4-a716-446655440000', expiresAt: '2026-12-01T00:00:00.000Z' };
  },
  completeCompatibilityInvite: async () => {
    state.completed += 1;
    return {
      outcome: 'completed', inviteId: '330e8400-e29b-41d4-a716-446655440000', ownerUserId: '110e8400-e29b-41d4-a716-446655440000',
      label: 'Sam', notify: false, completedAt: '2026-11-16T10:00:00.000Z',
    };
  },
}));

import invitesHandler from './invites';
import completeHandler from './invite-complete';
import { INVITER_CONSENT_VERSION, RECIPIENT_CONSENT_VERSION } from '../consent';
import { SIGNUP_ENV } from '../signup-fixture';

const ORIGINAL_ENV = { ...process.env };
const OWNER = '110e8400-e29b-41d4-a716-446655440000';
const INVITE = '330e8400-e29b-41d4-a716-446655440000';
const CHART = '220e8400-e29b-41d4-a716-446655440000';
const SESSION = 'a'.repeat(22);
const TOKEN = 'A'.repeat(43);
const HEADERS = { origin: 'https://zodiacs.org', host: 'zodiacs.org', authorization: 'Bearer access-token', 'content-type': 'application/json' };

let rpcs: Array<{ name: string; body: Record<string, unknown> }> = [];

beforeEach(() => {
  Object.assign(process.env, SIGNUP_ENV, { COMPAT_INVITES_ENABLED: '1', COMPAT_INVITE_TEST_USER_IDS: OWNER, COMPAT_INVITE_BASE_URL: 'https://zodiacs.org' });
  Object.assign(state, { created: 0, completed: 0 });
  rpcs = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const name = url.slice(url.lastIndexOf('/') + 1);
    rpcs.push({ name, body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response(JSON.stringify({ outcome: 'recorded' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => { process.env = { ...ORIGINAL_ENV }; vi.unstubAllGlobals(); });

function recorder() {
  return { statusCode: 0, headers: new Map<string, unknown>(), body: '', setHeader(name: string, value: unknown) { this.headers.set(name.toLowerCase(), value); }, end(value = '') { this.body = value; } };
}
async function create(body: Record<string, unknown>) {
  const res = recorder();
  const text = JSON.stringify(body);
  await invitesHandler({ method: 'POST', headers: { ...HEADERS, 'content-length': String(text.length) }, body }, res);
  return res;
}
async function complete(body: unknown) {
  const res = recorder();
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  await completeHandler({ method: 'POST', query: { session: SESSION }, headers: { ...HEADERS, 'content-length': String(text.length), cookie: `zodiacs_compat_invite_${SESSION}=${TOKEN}` }, body }, res);
  return res;
}

describe('creating an invite with signups on', () => {
  it('records the inviter consent for the known version the page sent', async () => {
    const res = await create({ chartId: CHART, consent: true, notify: false, consentVersion: INVITER_CONSENT_VERSION });
    expect(res.statusCode).toBe(201);
    expect(state.created).toBe(1);
    expect(rpcs).toEqual([{ name: 'record_compatibility_invite_inviter_consent', body: { candidate_invite_id: INVITE, candidate_owner_user_id: OWNER, candidate_policy_version: INVITER_CONSENT_VERSION } }]);
  });

  it('records no consent row for an unknown version, and still creates the invite', async () => {
    for (const consentVersion of ['invite-inviter-2026-11-09.v1', RECIPIENT_CONSENT_VERSION]) {
      const res = await create({ chartId: CHART, consent: true, notify: false, consentVersion });
      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).state).toBe('waiting');
    }
    expect(state.created).toBe(2);
    expect(rpcs).toEqual([]);
  });

  it('records nothing for the released three-key request, which a page without the signup text sends', async () => {
    const res = await create({ chartId: CHART, consent: true, notify: false });
    expect(res.statusCode).toBe(201);
    expect(rpcs).toEqual([]);
  });
});

describe('completing an invite with signups on', () => {
  it('completes on the reading and records the recipient consent for the known version', async () => {
    const res = await complete({ consentVersion: RECIPIENT_CONSENT_VERSION });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ outcome: 'completed', notification: 'skipped' });
    expect(state.completed).toBe(1);
    expect(rpcs).toEqual([{ name: 'record_compatibility_invite_recipient_consent', body: { candidate_invite_id: INVITE, candidate_policy_version: RECIPIENT_CONSENT_VERSION } }]);
  });

  it('completes as released with an empty body or an unknown version, recording nothing', async () => {
    for (const body of [{}, { consentVersion: 'invite-recipient-2026-11-09.v1' }, { consentVersion: INVITER_CONSENT_VERSION }]) {
      const res = await complete(body);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).outcome).toBe('completed');
    }
    expect(state.completed).toBe(3);
    expect(rpcs).toEqual([]);
  });

  it('refuses anything else in the completion body before completing', async () => {
    for (const body of [{ consentVersion: RECIPIENT_CONSENT_VERSION, email: 'sam@example.com' }, { birth: '1990-01-01' }]) {
      const res = await complete(body);
      expect(res.statusCode).toBe(400);
    }
    expect(state.completed).toBe(0);
    expect(rpcs).toEqual([]);
  });
});
