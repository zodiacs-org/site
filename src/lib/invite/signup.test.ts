import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { INVITER_CONSENT_VERSION, RECIPIENT_CONSENT_VERSION, inviteSignupEnabled, recordInviterConsent, recordRecipientConsent } from './signup';
import { KNOWN_INVITER_CONSENT_VERSIONS, KNOWN_RECIPIENT_CONSENT_VERSIONS, knownConsentVersion } from './consent';
import { NO_DATE_INVITE, RECIPIENT_CONSENT_LABEL, UNDER_13_INVITE, UNDER_18_INVITE, deviceToday, inviteRecipientGate, recipientBand, requestDailySignup } from './recipient';
import { parseCompleteInviteBody, parseCreateInviteBody } from './validate';
import { SIGNUP_ENV } from './signup-fixture';

const ORIGINAL_ENV = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL_ENV }; vi.restoreAllMocks(); });

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

describe('consent versions', () => {
  it('knows exactly one version per side, and never one side\'s version for the other', () => {
    expect(KNOWN_INVITER_CONSENT_VERSIONS).toEqual([INVITER_CONSENT_VERSION]);
    expect(KNOWN_RECIPIENT_CONSENT_VERSIONS).toEqual([RECIPIENT_CONSENT_VERSION]);
    expect(knownConsentVersion('inviter', INVITER_CONSENT_VERSION)).toBe(true);
    expect(knownConsentVersion('recipient', RECIPIENT_CONSENT_VERSION)).toBe(true);
    for (const unknown of [RECIPIENT_CONSENT_VERSION, 'invite-inviter-2026-11-09.v1', '', undefined, null, 1]) expect(knownConsentVersion('inviter', unknown)).toBe(false);
    for (const unknown of [INVITER_CONSENT_VERSION, 'invite-recipient-2026-11-09.v1', 'invite-recipient-2026-11-16.v1', '', undefined, null, 1]) expect(knownConsentVersion('recipient', unknown)).toBe(false);
  });

  it('lets the create request carry a consent version, and the completion request only that', () => {
    const chartId = '99fdb58f-5dbe-4ce3-8afa-08edee193229';
    expect(parseCreateInviteBody({ chartId, consent: true, notify: true })).toEqual({ chartId, consent: true, notify: true });
    expect(parseCreateInviteBody({ chartId, consent: true, notify: true, consentVersion: INVITER_CONSENT_VERSION }))
      .toEqual({ chartId, consent: true, notify: true, consentVersion: INVITER_CONSENT_VERSION });
    // An unknown but well-formed version still parses; the route records nothing for it.
    expect(parseCreateInviteBody({ chartId, consent: true, notify: false, consentVersion: 'some-other.v9' })?.consentVersion).toBe('some-other.v9');
    for (const consentVersion of [1, '', 'Not A Version!', 'x'.repeat(65), null]) {
      expect(parseCreateInviteBody({ chartId, consent: true, notify: false, consentVersion })).toBeNull();
    }
    expect(parseCreateInviteBody({ chartId, consent: true, notify: false, consentVersion: INVITER_CONSENT_VERSION, birth: '1990-01-01' })).toBeNull();
    expect(parseCreateInviteBody({ chartId, consent: true, consentVersion: INVITER_CONSENT_VERSION })).toBeNull();

    expect(parseCompleteInviteBody(undefined)).toEqual({});
    expect(parseCompleteInviteBody('{}')).toEqual({});
    expect(parseCompleteInviteBody({ consentVersion: RECIPIENT_CONSENT_VERSION })).toEqual({ consentVersion: RECIPIENT_CONSENT_VERSION });
    expect(parseCompleteInviteBody(JSON.stringify({ consentVersion: RECIPIENT_CONSENT_VERSION }))).toEqual({ consentVersion: RECIPIENT_CONSENT_VERSION });
    for (const bad of [{ birth: 'no' }, { consentVersion: RECIPIENT_CONSENT_VERSION, email: 'sam@example.com' }, { consentVersion: 7 }, { consentVersion: 'Bad Version' }, 'not json']) {
      expect(parseCompleteInviteBody(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('what crosses to the database', () => {
  it('records the inviter consent for a known version only, and nothing while the switch is off', async () => {
    const fetcher = vi.fn(async () => json({ outcome: 'recorded' }));
    expect(await recordInviterConsent(INVITE, OWNER, INVITER_CONSENT_VERSION, { ...SIGNUP_ENV, INVITE_SIGNUP_ENABLED: '0' }, fetcher as unknown as typeof fetch)).toBe(false);
    for (const version of [undefined, 'invite-inviter-2026-11-09.v1', RECIPIENT_CONSENT_VERSION]) {
      expect(await recordInviterConsent(INVITE, OWNER, version, SIGNUP_ENV, fetcher as unknown as typeof fetch)).toBe(false);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(await recordInviterConsent(INVITE, OWNER, INVITER_CONSENT_VERSION, SIGNUP_ENV, fetcher as unknown as typeof fetch)).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://project.supabase.co/rest/v1/rpc/record_compatibility_invite_inviter_consent');
    expect(JSON.parse(String(init.body))).toEqual({ candidate_invite_id: INVITE, candidate_owner_user_id: OWNER, candidate_policy_version: INVITER_CONSENT_VERSION });
  });

  it('records the recipient consent for a known version only, against the invite id alone', async () => {
    const fetcher = vi.fn(async () => json({ outcome: 'recorded' }));
    expect(await recordRecipientConsent(INVITE, RECIPIENT_CONSENT_VERSION, { ...SIGNUP_ENV, INVITE_SIGNUP_ENABLED: '0' }, fetcher as unknown as typeof fetch)).toBe(false);
    for (const version of [undefined, 'invite-recipient-2026-11-09.v1', INVITER_CONSENT_VERSION]) {
      expect(await recordRecipientConsent(INVITE, version, SIGNUP_ENV, fetcher as unknown as typeof fetch)).toBe(false);
    }
    expect(await recordRecipientConsent('not-an-id', RECIPIENT_CONSENT_VERSION, SIGNUP_ENV, fetcher as unknown as typeof fetch)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await recordRecipientConsent(INVITE, RECIPIENT_CONSENT_VERSION, SIGNUP_ENV, fetcher as unknown as typeof fetch)).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://project.supabase.co/rest/v1/rpc/record_compatibility_invite_recipient_consent');
    expect(JSON.parse(String(init.body))).toEqual({ candidate_invite_id: INVITE, candidate_policy_version: RECIPIENT_CONSENT_VERSION });
  });
});

describe('the migration', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20261109120000_compat_invite_signups.sql', import.meta.url), 'utf8');
  it('creates the consent table only: nothing that ties an address to an invite', () => {
    const tables = [...sql.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/gu)];
    expect(tables.map((match) => match[1])).toEqual(['compatibility_invite_consents']);
    for (const [, , body] of tables) expect(body).not.toMatch(/email|hash|birth|date_of|place|lat|lon|name|position|ip_/iu);
    for (const gone of ['compatibility_invite_signups', 'stage_compatibility_invite_signup', 'confirm_compatibility_invite_signups', 'recipient_hash', "status = 'completed',"]) {
      expect(sql).not.toContain(gone);
    }
  });
  it('records only the versions the site knows, the same allowlist on both sides of the wire', () => {
    const allowlist = (fn: string) => {
      const body = sql.slice(sql.indexOf(`function public.${fn}(`));
      return [...body.slice(0, body.indexOf('$$;')).matchAll(/not in \(([^)]*)\)/gu)].flatMap((match) => [...match[1].matchAll(/'([^']+)'/gu)].map((value) => value[1]));
    };
    expect(allowlist('record_compatibility_invite_inviter_consent')).toEqual([...KNOWN_INVITER_CONSENT_VERSIONS]);
    expect(allowlist('record_compatibility_invite_recipient_consent')).toEqual([...KNOWN_RECIPIENT_CONSENT_VERSIONS]);
    // The recipient row waits for the released completion.
    const recipient = sql.slice(sql.indexOf('function public.record_compatibility_invite_recipient_consent('));
    expect(recipient.slice(0, recipient.indexOf('$$;'))).toContain("and i.status = 'completed'");
  });
  it('keeps the table closed to browser roles and every function to the service role', () => {
    expect(sql).toContain('alter table public.compatibility_invite_consents enable row level security;');
    expect(sql).toMatch(/revoke all on table public\.compatibility_invite_consents\s+from public, anon, authenticated, service_role;/u);
    for (const fn of ['record_compatibility_invite_inviter_consent(uuid, uuid, text)', 'record_compatibility_invite_recipient_consent(uuid, text)']) {
      expect(sql).toContain(`revoke all on function public.${fn}\n  from public, anon, authenticated;`);
      expect(sql).toContain(`grant execute on function public.${fn}\n  to service_role;`);
    }
    expect(sql).not.toMatch(/grant [^;]* to (anon|authenticated|public)/iu);
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

  it('signs up through the public daily route with the address, the sign and the two yeses only: no invite handle', async () => {
    const fetcher = vi.fn(async () => json({ ok: true, pending: true }));
    expect(await requestDailySignup('sam@example.com', 'leo', fetcher as unknown as typeof fetch)).toBe('sent');
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/email/subscribe');
    expect(init.method).toBe('POST');
    expect(Object.keys(JSON.parse(String(init.body))).sort()).toEqual(['adult', 'consent', 'email', 'sign']);
    expect(JSON.parse(String(init.body))).toEqual({ email: 'sam@example.com', sign: 'leo', consent: true, adult: true });
    expect(`${url} ${String(init.body)}`).not.toMatch(/session|handle|invite|token|birth|date/iu);
    const failing = vi.fn(async () => new Response('{}', { status: 503 }));
    expect(await requestDailySignup('sam@example.com', 'leo', failing as unknown as typeof fetch)).toBe('error');
    const offline = vi.fn(async () => { throw new TypeError('offline'); });
    expect(await requestDailySignup('sam@example.com', 'leo', offline as unknown as typeof fetch)).toBe('error');
  });

  it('keeps the signup card apart from the invitation', () => {
    const card = readFileSync(new URL('../../islands/synastry/InviteSignup.tsx', import.meta.url), 'utf8');
    expect(card).not.toMatch(/finishes|handle[=:]|invite-signup\?|requestInviteSignup|arrival/u);
    expect(card).toContain("'If that address is new to us, we sent one email to confirm.'");
    expect(card).not.toMatch(/[\u2013\u2014]/u);
    const island = readFileSync(new URL('../../islands/SynastryCalculator.tsx', import.meta.url), 'utf8');
    // Completion is no longer held back behind the signup switch.
    expect(island).not.toMatch(/if \(INVITE_SIGNUP_UI_ENABLED\) return;/u);
    expect(island).not.toMatch(/InviteSignup handle=/u);
  });

  it('asks the recipient to confirm they are 18 or older, the age the gate needs, under its own version', () => {
    expect(RECIPIENT_CONSENT_LABEL).toBe('These are my own birth details, and I am 18 or older.');
    expect(RECIPIENT_CONSENT_VERSION).toBe('invite-recipient-2026-11-16.v2');
    const island = readFileSync(new URL('../../islands/SynastryCalculator.tsx', import.meta.url), 'utf8');
    expect(island).toContain('<span>{RECIPIENT_CONSENT_LABEL}</span>');
    expect(island).not.toContain('13 or older');
  });

  it('offers the daily email card only where the daily email can be joined, never the weekly fallback', () => {
    const page = readFileSync(new URL('../../pages/compatibility/index.astro', import.meta.url), 'utf8');
    expect(page).toContain('const dailyEmail = dailyEmailFeatureEnabled(process.env) && hasDailySunEmailProvider(process.env);');
    expect(page).toContain('<SynastryCalculator client:load dailyEmail={dailyEmail} />');
    const island = readFileSync(new URL('../../islands/SynastryCalculator.tsx', import.meta.url), 'utf8');
    expect(island).toMatch(/inviteSignupActive && dailyEmail && recipientBand === 'adult' && signupMod/u);
    expect(island).toMatch(/dailyEmail = false \}/u);
  });
});
