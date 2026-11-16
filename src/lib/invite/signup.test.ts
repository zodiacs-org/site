import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { INVITER_CONSENT_VERSION, RECIPIENT_CONSENT_VERSION, confirmCompatibilityInviteSignups, inviteSignupEnabled, recordInviterConsent, stageCompatibilityInviteSignup } from './signup';
import { NO_DATE_INVITE, UNDER_13_INVITE, UNDER_18_INVITE, deviceToday, inviteRecipientGate, recipientBand, requestInviteSignup } from './recipient';
import { SIGNUP_ENV } from './signup-fixture';

const ORIGINAL_ENV = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL_ENV }; vi.restoreAllMocks(); });

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const INVITE = '330e8400-e29b-41d4-a716-446655440000';
const OWNER = '110e8400-e29b-41d4-a716-446655440000';
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('the invite signup switch', () => {
  it('is on only as exactly 1, with the invite contract and the daily double opt-in', () => {
    expect(inviteSignupEnabled(SIGNUP_ENV)).toBe(true);
    for (const value of [undefined, '', '0', 'true', ' 1x', 'yes']) expect(inviteSignupEnabled({ ...SIGNUP_ENV, INVITE_SIGNUP_ENABLED: value })).toBe(false);
    expect(inviteSignupEnabled({ ...SIGNUP_ENV, DAILY_EMAIL_ENABLED: '0' })).toBe(false);
    expect(inviteSignupEnabled({ ...SIGNUP_ENV, SUPABASE_SERVICE_ROLE_KEY: '' })).toBe(false);
  });
});

describe('what crosses to the database', () => {
  it('stages with two hashes and nothing else', async () => {
    const fetcher = vi.fn(async () => json({ outcome: 'staged' }));
    expect(await stageCompatibilityInviteSignup(HASH_A, HASH_B, SIGNUP_ENV, fetcher as unknown as typeof fetch)).toBe('staged');
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://project.supabase.co/rest/v1/rpc/stage_compatibility_invite_signup');
    expect(JSON.parse(String(init.body))).toEqual({ candidate_token_hash: HASH_A, candidate_recipient_hash: HASH_B });
    // A malformed hash never reaches the database.
    expect(await stageCompatibilityInviteSignup('not-a-hash', HASH_B, SIGNUP_ENV, fetcher as unknown as typeof fetch)).toBe('unavailable');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reads back only well-formed completed invites on confirmation', async () => {
    const fetcher = vi.fn(async () => json({ completed: [
      { invite_id: INVITE, owner_user_id: OWNER, label: 'Sam', notify_on_complete: true, completed_at: '2026-11-09T10:00:00Z' },
      { invite_id: 'nope', owner_user_id: OWNER, label: 'x', notify_on_complete: true, completed_at: '2026-11-09T10:00:00Z' },
    ] }));
    expect(await confirmCompatibilityInviteSignups(HASH_B, SIGNUP_ENV, fetcher as unknown as typeof fetch)).toEqual([
      { inviteId: INVITE, ownerUserId: OWNER, label: 'Sam', notify: true, completedAt: '2026-11-09T10:00:00Z' },
    ]);
    expect(JSON.parse(String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ candidate_recipient_hash: HASH_B });
  });

  it('records the inviter consent by policy version, and nothing while the switch is off', async () => {
    const fetcher = vi.fn(async () => json({ outcome: 'recorded' }));
    expect(await recordInviterConsent(INVITE, OWNER, { ...SIGNUP_ENV, INVITE_SIGNUP_ENABLED: '0' }, fetcher as unknown as typeof fetch)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await recordInviterConsent(INVITE, OWNER, SIGNUP_ENV, fetcher as unknown as typeof fetch)).toBe(true);
    expect(JSON.parse(String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ candidate_invite_id: INVITE, candidate_owner_user_id: OWNER, candidate_policy_version: INVITER_CONSENT_VERSION });
  });
});

describe('the migration', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20261109120000_compat_invite_signups.sql', import.meta.url), 'utf8');
  it('stores hashes, a policy version and times, never an address, a birth detail or a name', () => {
    const tables = [...sql.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/gu)];
    expect(tables.map((match) => match[1])).toEqual(['compatibility_invite_signups', 'compatibility_invite_consents']);
    for (const [, , body] of tables) expect(body).not.toMatch(/email|birth|date_of|place|lat|lon|name|position|ip_/iu);
    expect(sql).toContain(`'${RECIPIENT_CONSENT_VERSION}'`);
  });
  it('keeps every table closed to browser roles and every function to the service role', () => {
    for (const table of ['compatibility_invite_signups', 'compatibility_invite_consents']) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
      expect(sql).toMatch(new RegExp(`revoke all on table public\\.${table}\\s+from public, anon, authenticated, service_role;`, 'u'));
    }
    for (const fn of ['stage_compatibility_invite_signup(text, text)', 'confirm_compatibility_invite_signups(text)', 'record_compatibility_invite_inviter_consent(uuid, uuid, text)']) {
      expect(sql).toContain(`revoke all on function public.${fn}\n  from public, anon, authenticated;`);
      expect(sql).toContain(`grant execute on function public.${fn}\n  to service_role;`);
    }
    expect(sql).not.toMatch(/grant [^;]* to (anon|authenticated|public)/iu);
  });
  it('completes an invite on confirmation as the released completion does: token and positions destroyed', () => {
    const confirm = sql.slice(sql.indexOf('confirm_compatibility_invite_signups('));
    for (const line of ["status = 'completed'", 'token_hash = null', 'positions = null', 'authority_destroyed_at = operation_time', "delete_after = operation_time + interval '30 days'"]) expect(confirm).toContain(line);
    expect(confirm).toContain("and status = 'active'\n      and expires_at > operation_time;");
  });
});

describe('the recipient in the browser', () => {
  it('bands a birth date: under 13 refused, 13 to 17 no signup, 18 and over offered it', () => {
    expect(recipientBand('2013-11-10', '2026-11-09')).toBe('under13');
    expect(recipientBand('2027-01-01', '2026-11-09')).toBe('under13');
    expect(recipientBand('2013-11-09', '2026-11-09')).toBe('minor');
    expect(recipientBand('2008-11-10', '2026-11-09')).toBe('minor');
    expect(recipientBand('2008-11-09', '2026-11-09')).toBe('adult');
    expect(recipientBand('1990-05-03', '2026-11-09')).toBe('adult');
    // 29 February keeps its own date.
    expect(recipientBand('2015-03-01', '2028-02-29')).toBe('under13');
    expect(recipientBand('2015-02-28', '2028-02-29')).toBe('minor');
    expect(deviceToday(new Date(2026, 10, 9, 23, 59))).toBe('2026-11-09');
  });

  it('works out a reading for an adult only: under 18 and a missing date get a fixed message (ZOD-22)', () => {
    expect(recipientBand('2010-06-01', '2026-11-10')).toBe('minor');
    expect(inviteRecipientGate('1990-05-03', '2026-11-10')).toEqual({ allowed: true, band: 'adult' });
    expect(inviteRecipientGate('2008-11-10', '2026-11-10')).toEqual({ allowed: true, band: 'adult' });
    expect(inviteRecipientGate('2008-11-11', '2026-11-10')).toEqual({ allowed: false, band: 'minor', message: UNDER_18_INVITE });
    expect(inviteRecipientGate('2010-06-01', '2026-11-10')).toEqual({ allowed: false, band: 'minor', message: UNDER_18_INVITE });
    expect(inviteRecipientGate('2015-06-01', '2026-11-10')).toEqual({ allowed: false, band: 'under13', message: UNDER_13_INVITE });
    for (const missing of [undefined, null, '', '1990-5-3', 'not a date']) {
      expect(inviteRecipientGate(missing, '2026-11-10')).toEqual({ allowed: false, band: null, message: NO_DATE_INVITE });
    }
    for (const text of [UNDER_18_INVITE, NO_DATE_INVITE]) expect(text).not.toMatch(/[\u2013\u2014]/u);
  });

  it('checks every invitation in the island before anything is worked out, signups on or off (ZOD-22)', () => {
    const source = readFileSync(new URL('../../islands/SynastryCalculator.tsx', import.meta.url), 'utf8');
    const gate = source.indexOf('inviteRecipientGate(ownDate');
    expect(gate).toBeGreaterThan(-1);
    // The check sits under the invitation itself, not under the signup switch.
    const guard = source.lastIndexOf('if (', gate);
    expect(source.slice(guard, source.indexOf('{', guard))).toBe('if (inviteArrivalActive) ');
    expect(source).toMatch(/const inviteArrivalActive = inviteUiActive && arrival\.state === 'ready';/u);
    // A refusal returns before either side is resolved or the engine is loaded.
    const after = source.slice(gate, source.indexOf('const resolve = (slot', gate));
    expect(after).toMatch(/if \(!gate\.allowed\) \{\s*setError\(gate\.message\);\s*return;\s*\}/u);
    expect(after).not.toMatch(/fetch\(|resolveForm|loadEngine/u);
    // The footer for a 13 to 17 recipient's result is gone: there is no such result.
    expect(source).not.toContain("recipientBand === 'minor'");
  });

  it('sends the address, the sign and the two yeses only, never the birth date', async () => {
    const fetcher = vi.fn(async () => json({ outcome: 'pending' }));
    expect(await requestInviteSignup('a'.repeat(22), 'sam@example.com', 'leo', fetcher as unknown as typeof fetch)).toBe('pending');
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/compatibility/invite-signup?session=${'a'.repeat(22)}`);
    expect(JSON.parse(String(init.body))).toEqual({ email: 'sam@example.com', sign: 'leo', consent: true, adult: true });
    expect(await requestInviteSignup('bad', 'sam@example.com', 'leo', fetcher as unknown as typeof fetch)).toBe('unavailable');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
