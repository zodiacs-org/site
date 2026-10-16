import { describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, randomUUID, sign, createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { oauthClaimsValid } from '../auth/oauth';
import { configuredWatchOAuth } from '../watch/oauth';
import { ALL_AI_TOOL_NAMES } from '../contracts';
import { COUNTED_TOOL_NAMES } from '../usage';
import { ACCOUNT_PERMISSION, ACCOUNT_SCOPES, MAX_SAVED_RECORD_BYTES, SAVE_TOOL_NAME, saveInput } from './contracts';
import { accountsResourceOrigin, configuredAccounts, invalidTokenChallenge, signInChallenge } from './service';
import { buildSavedRecord, recordDigest, recordProblem, saveToZodiacs, type SavedRecord } from './save';
import { allowedRedirect, consentKind } from './consent';
import { CONSENT_HTML, CONSENT_SCRIPT_HASH, CONSENT_STYLE_HASH } from '../../../integrations/generated/accounts-consent.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const issuer = 'https://accountstest.supabase.co/auth/v1';
const resource = 'https://zodiacs.org/mcp';
const CLIENT = '6f9619ff-8b86-4011-b42d-00c04fc964ff';
const requirement = { issuer, resource, scopes: ACCOUNT_SCOPES, permission: ACCOUNT_PERMISSION };
const claims = (patch: Record<string, unknown> = {}) => ({ iss: issuer, aud: resource, role: 'authenticated', is_anonymous: false,
  sub: randomUUID(), session_id: randomUUID(), client_id: CLIENT, scope: 'openid email',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60, zodiacs_permissions: [ACCOUNT_PERMISSION], ...patch });
const production = { ZODIACS_ACCOUNTS_ENABLED: '1', VERCEL_ENV: 'production', PUBLIC_SUPABASE_URL: issuer.replace('/auth/v1', ''),
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SERVICE_ROLE_KEY: `sb_secret_${'x'.repeat(40)}`, ZODIACS_ACCOUNTS_OAUTH_CLIENTS: CLIENT, PUBLIC_ACCOUNT_SAVES_ENABLED: '1' };
const now = () => new Date('2026-10-14T12:00:00Z');

describe('account sign-in: audience, scope and permission', () => {
  it('accepts only a token minted for this exact MCP endpoint with openid and the save permission', () => {
    expect(oauthClaimsValid(claims(), requirement)).toBe(true);
    for (const patch of [{ aud: 'authenticated' }, { aud: [resource] }, { aud: 'https://www.zodiacs.org/mcp' }, { aud: 'https://zodiacs-sky-watch-test.vercel.app/mcp' },
      { iss: 'https://other.supabase.co/auth/v1' }, { scope: 'email' }, { zodiacs_permissions: ['sky:watch'] }, { zodiacs_permissions: [] },
      { zodiacs_permissions: undefined, app_metadata: { zodiacs_permissions: [ACCOUNT_PERMISSION] } }, { role: 'service_role' }, { is_anonymous: true },
      { exp: Math.floor(Date.now() / 1000) - 1 }, { iat: Math.floor(Date.now() / 1000) + 3600 }, { nbf: Math.floor(Date.now() / 1000) + 60 },
      { client_id: 'chatgpt' }, { session_id: undefined }, { sub: 'someone' }]) {
      expect(oauthClaimsValid(claims(patch), requirement), JSON.stringify(patch)).toBe(false);
    }
  });
  it('keeps Sky Watch tokens and account tokens apart', () => {
    const watchToken = claims({ aud: 'https://zodiacs-sky-watch-test.vercel.app/mcp', zodiacs_permissions: ['sky:watch'] });
    expect(oauthClaimsValid(watchToken, requirement)).toBe(false);
    expect(oauthClaimsValid(claims(), { ...requirement, resource: 'https://zodiacs-sky-watch-test.vercel.app/mcp', permission: 'sky:watch' })).toBe(false);
  });
});

describe('account configuration', () => {
  it('allows shared consent only in preview, with disjoint valid client lists', () => {
    const watch = '11111111-2222-4333-8444-555555555555';
    const env = { ...production, VERCEL_ENV: 'preview', ZODIACS_MCP_STAGING_HOST: 'zodiacs-accounts-test.vercel.app', ZODIACS_ACCOUNTS_PREVIEW_WATCH_CLIENTS: watch };
    const service = configuredAccounts(env, vi.fn())!;
    expect(service.clients).toEqual([CLIENT]);
    expect(service.previewWatchClients).toEqual([watch]);
    for (const patch of [{ VERCEL_ENV: 'production' }, { ZODIACS_ACCOUNTS_PREVIEW_WATCH_CLIENTS: CLIENT },
      { ZODIACS_ACCOUNTS_PREVIEW_WATCH_CLIENTS: CLIENT.toUpperCase() }, { ZODIACS_ACCOUNTS_PREVIEW_WATCH_CLIENTS: 'not-a-client' }]) {
      expect(() => configuredAccounts({ ...env, ...patch }, vi.fn())).toThrow('accounts-unavailable');
    }
    expect(configuredAccounts(production, vi.fn())!.previewWatchClients).toBeUndefined();
  });
  it('is off unless the switch is exactly 1, and refuses a half-configured switch-on', () => {
    for (const value of [undefined, '', '0', 'true', ' 1', '1 ']) expect(configuredAccounts({ ...production, ZODIACS_ACCOUNTS_ENABLED: value })).toBeUndefined();
    for (const patch of [{ PUBLIC_SUPABASE_URL: undefined }, { PUBLIC_SUPABASE_URL: 'https://evil.example' }, { PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOi' },
      { ZODIACS_ACCOUNTS_OAUTH_CLIENTS: '' }, { ZODIACS_ACCOUNTS_OAUTH_CLIENTS: 'chatgpt' }, { VERCEL_ENV: 'development' },
      { VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'preview', ZODIACS_MCP_STAGING_HOST: 'attacker.example' }, { ZODIACS_SKY_WATCH_ENABLED: '1' }, { PUBLIC_ACCOUNT_SAVES_ENABLED: undefined },
      { SUPABASE_SERVICE_ROLE_KEY: undefined }]) {
      expect(() => configuredAccounts({ ...production, ...patch }), JSON.stringify(patch)).toThrow();
    }
  });
  it('names the exact production resource, its metadata and both challenges', () => {
    const service = configuredAccounts(production, vi.fn())!;
    expect(service.oauth.resource).toBe('https://zodiacs.org/mcp');
    expect(service.oauth.metadata).toEqual({ resource: 'https://zodiacs.org/mcp', authorization_servers: [issuer], scopes_supported: ['openid'],
      bearer_methods_supported: ['header'], resource_name: 'Zodiacs', resource_documentation: 'https://zodiacs.org/privacy/' });
    expect(service.oauth.challenge).toBe('Bearer resource_metadata="https://zodiacs.org/.well-known/oauth-protected-resource/mcp", scope="openid"');
    expect(invalidTokenChallenge(service.oauth)).toBe(`${service.oauth.challenge}, error="invalid_token"`);
    expect(signInChallenge(service.oauth)).toContain('error="insufficient_scope"');
    expect(service.clients).toEqual([CLIENT]);
  });
  it('uses only the exact staging host on a preview deployment', () => {
    expect(accountsResourceOrigin({ VERCEL_ENV: 'preview', ZODIACS_MCP_STAGING_HOST: 'zodiacs-accounts-staging.vercel.app' })).toBe('https://zodiacs-accounts-staging.vercel.app');
    expect(() => accountsResourceOrigin({ VERCEL_ENV: 'preview', ZODIACS_MCP_STAGING_HOST: 'zodiacs.org.evil.app' })).toThrow();
  });
  it('leaves the Sky Watch preview metadata and challenge exactly as they were', () => {
    const oauth = configuredWatchOAuth({ ZODIACS_SKY_WATCH_AUTH: 'oauth', VERCEL_ENV: 'preview', ZODIACS_MCP_STAGING_HOST: 'zodiacs-sky-watch-test.vercel.app',
      PUBLIC_SUPABASE_URL: 'https://oauthtest.supabase.co', PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }, vi.fn())!;
    expect(JSON.stringify(oauth.metadata)).toBe('{"resource":"https://zodiacs-sky-watch-test.vercel.app/mcp","authorization_servers":["https://oauthtest.supabase.co/auth/v1"],"scopes_supported":["openid"],"bearer_methods_supported":["header"],"resource_name":"Zodiacs Sky Watch preview","resource_documentation":"https://zodiacs.org/developers/"}');
    expect(oauth.challenge).toBe('Bearer resource_metadata="https://zodiacs-sky-watch-test.vercel.app/.well-known/oauth-protected-resource/mcp", scope="openid"');
  });
  it('verifies a real signature, then the client list, then the live database check', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const kid = randomUUID(); const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'ES256', use: 'sig' };
    const jwt = (payload: object) => {
      const body = [JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' }), JSON.stringify(payload)].map(s => Buffer.from(s).toString('base64url')).join('.');
      return `${body}.${sign('sha256', Buffer.from(body), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'Content-Type': 'application/json' } })));
    const rpc = vi.fn(async () => true as any);
    try {
      const { oauth } = configuredAccounts(production, rpc as any)!;
      const valid = claims();
      expect(await oauth.authenticate(jwt(valid))).toEqual({ user: valid.sub, session: valid.session_id, client: CLIENT });
      expect(rpc).toHaveBeenCalledWith('oauth', { user: valid.sub, session: valid.session_id, client: CLIENT, resource });
      rpc.mockClear();
      expect(await oauth.authenticate(jwt({ ...valid, client_id: randomUUID() }))).toBeNull();
      expect(await oauth.authenticate(jwt({ ...valid, aud: 'authenticated' }))).toBeNull();
      const parts = jwt(valid).split('.'); parts[1] = Buffer.from(JSON.stringify({ ...valid, sub: randomUUID() })).toString('base64url');
      expect(await oauth.authenticate(parts.join('.'))).toBeNull();
      expect(await oauth.authenticate('not-a-jwt')).toBeNull();
      expect(rpc).not.toHaveBeenCalled();
      rpc.mockResolvedValueOnce(false as any);
      expect(await oauth.authenticate(jwt(valid))).toBeNull();
    } finally { vi.unstubAllGlobals(); }
  });
});

describe('what can be saved', () => {
  it('takes exactly one kind with its own details, and a plain-text label', () => {
    const occasion = { occasion: 'wedding', date: '2027-06-12' };
    expect(saveInput.safeParse({ kind: 'occasion', occasion }).success).toBe(true);
    expect(saveInput.safeParse({ kind: 'occasion', occasion, label: 'Our wedding day' }).success).toBe(true);
    for (const args of [{ kind: 'chart', occasion }, { kind: 'occasion' }, { kind: 'occasion', occasion, week: { birthDate: '1990-05-03' } },
      { kind: 'occasion', occasion, label: '<script>alert(1)</script>' }, { kind: 'occasion', occasion, label: 'a\u0000b' }, { kind: 'occasion', occasion, label: 'x'.repeat(81) },
      { kind: 'occasion', occasion, label: '[click](https://evil.example)' }, { kind: 'occasion', occasion, result: { score: 100 } }, { kind: 'note', note: 'anything' },
      { kind: 'comparison', comparison: { a: { birthDate: '1990-05-03' } } }, { kind: 'week', week: { birthDate: '1990-05-03', birthTime: '08:00' } }]) {
      expect(saveInput.safeParse(args).success, JSON.stringify(args)).toBe(false);
    }
  });

  it('works each kind out again with the tool that made it, as bounded plain text', async () => {
    const cases = [
      { kind: 'chart', chart: { name: 'Ana', birthDate: '1990-05-03', time: '08:30', zone: 'europe/madrid', latitude: 40.4168, longitude: -3.7038 } },
      { kind: 'chart', chart: { famous: 'Frida Kahlo' } },
      { kind: 'comparison', comparison: { a: { name: 'Ana', birthDate: '1990-05-03' }, b: { famous: 'Frida Kahlo' } } },
      { kind: 'occasion', occasion: { occasion: 'wedding', searchFrom: '2027-06-01', searchTo: '2027-06-30', zone: 'Europe/Rome', latitude: 43.77, longitude: 11.25, place: 'Florence, Italy', names: 'Ana & Luis' } },
      { kind: 'week', week: { birthDate: '1990-05-03', birthTime: '08:30', birthZone: 'Europe/Madrid', zone: 'Asia/Bangkok' } },
    ] as const;
    for (const args of cases) {
      const record = await buildSavedRecord(saveInput.parse(args), { now });
      if ('failure' in record) throw new Error(record.failure);
      expect(record.kind).toBe(args.kind);
      expect(recordProblem(record), args.kind).toBeNull();
      expect(Buffer.byteLength(JSON.stringify(record))).toBeLessThanOrEqual(MAX_SAVED_RECORD_BYTES);
      expect(JSON.stringify(record)).not.toContain('?ref=');
      expect(record.href.startsWith('/')).toBe(true);
    }
    const chart = await buildSavedRecord(saveInput.parse(cases[0]), { now });
    if ('failure' in chart) throw new Error(chart.failure);
    expect(chart.data).toMatchObject({ sun: 'taurus', zone: 'Europe/Madrid', time: '08:30', birthDate: '1990-05-03' });
    // A chart with its place reopens on the birth chart page; a famous chart on the person's page.
    expect(chart.href).toMatch(/^\/birth-chart\/#c=1\.[A-Za-z0-9_-]+$/u);
    const famous = await buildSavedRecord(saveInput.parse(cases[1]), { now });
    if ('failure' in famous) throw new Error(famous.failure);
    expect(famous.href).toBe('/people/frida-kahlo/');
    const week = await buildSavedRecord(saveInput.parse(cases[4]), { now });
    if ('failure' in week) throw new Error(week.failure);
    expect(week.href).toMatch(/^\/horoscopes\/#week=2026-10-1[45]&saved=[0-9a-f]{16}$/u);
    const comparison = await buildSavedRecord(saveInput.parse(cases[2]), { now });
    if ('failure' in comparison) throw new Error(comparison.failure);
    expect(comparison.title).toMatch(/^Ana and Frida Kahlo: \d+ out of 100$/u);
    const occasion = await buildSavedRecord(saveInput.parse(cases[3]), { now });
    if ('failure' in occasion) throw new Error(occasion.failure);
    expect((occasion.data as { bestDays: { best: unknown[] } }).bestDays.best).toHaveLength(3);
    expect(occasion.href).toMatch(/^\/occasions\/#o=wedding&d=2027-06-\d\d/u);
    const pairOnly = await buildSavedRecord(saveInput.parse(cases[2]), { now });
    if ('failure' in pairOnly) throw new Error(pairOnly.failure);
    // A famous side has no birth place, so the comparison links to its sign pair with the result's digest.
    expect(pairOnly.href).toMatch(/^\/compatibility\/[a-z]+-[a-z]+\/#saved=[0-9a-f]{16}$/u);
  });

  it('refuses what the tool itself would refuse, and a famous name it does not have', async () => {
    for (const args of [{ kind: 'chart', chart: { famous: 'Nobody Anybody Zzyzx' } }, { kind: 'chart', chart: { birthDate: '1990-02-30' } },
      { kind: 'comparison', comparison: { a: { birthDate: '1990-05-03' }, b: { famous: 'Nobody Anybody Zzyzx' } } },
      { kind: 'occasion', occasion: { occasion: 'wedding', searchFrom: '2027-06-01', searchTo: '2027-12-30' } },
      { kind: 'week', week: { birthDate: '1990-05-03', zone: 'Not/A_Zone' } }]) {
      const record = await buildSavedRecord(saveInput.parse(args), { now });
      expect(record, JSON.stringify(args)).toHaveProperty('failure');
    }
  });

  it('refuses markup, foreign links, long strings, oversized records and links outside the kind\'s pages', () => {
    const base: SavedRecord = { schema: 'zodiacs.assistant-save.v1', kind: 'occasion', title: 'Wedding', summary: 'A good day.', data: {}, links: [], href: '/occasions/#o=wedding&d=2027-06-12' };
    expect(recordProblem(base)).toBeNull();
    expect(recordProblem({ ...base, summary: '<img src=x onerror=alert(1)>' })).toBe('not-plain-text');
    expect(recordProblem({ ...base, data: { line: 'tab\there' } })).toBe('not-plain-text');
    expect(recordProblem({ ...base, links: [{ title: 'Elsewhere', url: 'https://evil.example/' }] })).toBe('foreign-link');
    expect(recordProblem({ ...base, data: { cardUrl: 'javascript:alert(1)' } })).toBe('foreign-link');
    expect(recordProblem({ ...base, summary: 'x'.repeat(601) })).toBe('too-long');
    expect(recordProblem({ ...base, data: { lines: Array.from({ length: 30 }, () => 'y'.repeat(500)) } })).toBe('too-large');
    for (const href of ['https://evil.example/occasions/', '//evil.example/occasions/', '/birth-chart/#c=x', '/occasions/#a b', '/occasions/\\x']) {
      expect(recordProblem({ ...base, href }), href).toBe('bad-link');
    }
  });

  it('identifies the same item by what was worked out, not by its label', () => {
    const base: SavedRecord = { schema: 'zodiacs.assistant-save.v1', kind: 'occasion', title: 'Wedding', summary: 'A good day.', data: { date: '2027-06-12' }, links: [], href: '/occasions/' };
    expect(recordDigest({ ...base, title: 'Renamed' })).toBe(recordDigest(base));
    expect(recordDigest({ ...base, data: { date: '2027-06-13' } })).not.toBe(recordDigest(base));
    expect(recordDigest(base)).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('returns the saved item, one copy for a repeat, and plain refusals', async () => {
    const principal = { user: randomUUID(), session: randomUUID(), client: CLIENT };
    const args = { kind: 'occasion', occasion: { occasion: 'wedding', date: '2027-06-12' }, label: 'Our day' };
    const store = vi.fn(async () => ({ id: randomUUID(), saved_at: '2026-10-14T12:00:00.000+00:00', created: true }));
    const saved = await saveToZodiacs(args, principal, store, { now }, 'chatgpt');
    expect(saved).toMatchObject({ ok: true, tool: SAVE_TOOL_NAME, data: { saved: true, kind: 'occasion', title: 'Our day', alreadySaved: false, profileUrl: 'https://zodiacs.org/profile/?ref=chatgpt' } });
    const [, record] = store.mock.calls[0] as unknown as [unknown, SavedRecord];
    expect(record.title).toBe('Our day');
    expect(record.href).toBe('/occasions/#o=wedding&d=2027-06-12');
    store.mockResolvedValueOnce({ id: randomUUID(), saved_at: '2026-10-14T12:00:00.000+00:00', created: false });
    expect(await saveToZodiacs(args, principal, store, { now })).toMatchObject({ ok: true, data: { alreadySaved: true, profileUrl: 'https://zodiacs.org/profile/' } });
    store.mockResolvedValueOnce('full' as any);
    expect(await saveToZodiacs(args, principal, store, { now })).toMatchObject({ ok: false, error: { code: 'account-full' } });
    store.mockResolvedValueOnce(null as any);
    expect(await saveToZodiacs(args, principal, store, { now })).toMatchObject({ ok: false, error: { code: 'authentication-required' } });
    store.mockRejectedValueOnce(new Error('synthetic outage'));
    expect(await saveToZodiacs(args, principal, store, { now })).toMatchObject({ ok: false, error: { code: 'save-unavailable' } });
    store.mockClear();
    expect(await saveToZodiacs({ kind: 'occasion', result: { score: 100 } }, principal, store, { now })).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(store).not.toHaveBeenCalled();
  });
});

describe('the consent page', () => {
  it('selects the correct consent permissions and refuses unknown or ambiguous clients', () => {
    const config = { clients: ['account'], previewWatchClients: ['watch'] };
    expect(consentKind('account', config)).toBe('accounts');
    expect(consentKind('watch', config)).toBe('watch');
    expect(consentKind('unknown', config)).toBeUndefined();
    expect(consentKind('account', { ...config, previewWatchClients: ['account'] })).toBeUndefined();
    expect(consentKind('watch', { clients: ['account'] })).toBeUndefined();
  });
  it('returns only to the assistants’ own OAuth addresses', () => {
    for (const url of ['https://chatgpt.com/connector_platform_oauth_redirect', 'https://chatgpt.com/connector/oauth/abc', 'https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback']) expect(allowedRedirect(url), url).toBe(true);
    for (const url of ['https://evil.example/connector_platform_oauth_redirect', 'http://chatgpt.com/connector_platform_oauth_redirect', 'https://chatgpt.com.evil.example/connector/oauth/x',
      'https://user:pass@chatgpt.com/connector/oauth/x', 'https://chatgpt.com:8443/connector/oauth/x', 'https://claude.ai/login', 'javascript:alert(1)', 'not a url']) expect(allowedRedirect(url), url).toBe(false);
  });
  it('is generated with the CSP hashes of its inline script and style, and an empty settings block', () => {
    const script = CONSENT_HTML.match(/<script type="module">([\s\S]*?)<\/script>/u)![1];
    const style = CONSENT_HTML.match(/<style>([\s\S]*?)<\/style>/u)![1];
    expect(CONSENT_SCRIPT_HASH).toBe(`sha256-${createHash('sha256').update(script).digest('base64')}`);
    expect(CONSENT_STYLE_HASH).toBe(`sha256-${createHash('sha256').update(style).digest('base64')}`);
    expect(CONSENT_HTML).toContain('<script type="application/json" id="zodiacs-consent-config"></script>');
    expect(CONSENT_HTML).toContain('noindex');
    expect(CONSENT_HTML).not.toMatch(/fonts\.googleapis|gold/iu);
  });
});

describe('usage counting for the save tool', () => {
  it('adds only save_to_zodiacs to the counted names, in a later migration than the 0.5.0 widening', () => {
    expect(COUNTED_TOOL_NAMES).toEqual([...ALL_AI_TOOL_NAMES, SAVE_TOOL_NAME]);
    const migrations = readdirSync(`${root}supabase/migrations`);
    const widened = migrations.filter(name => name.endsWith('_zodiacs_mcp_usage_occasion_tools.sql'));
    const save = migrations.filter(name => name.endsWith('_zodiacs_mcp_usage_save_tool.sql'));
    expect(save).toHaveLength(1);
    expect(save[0] > widened[0]).toBe(true);
    const lists = [...readFileSync(`${root}supabase/migrations/${save[0]}`, 'utf8').matchAll(/in \(((?:'[a-z_]+'(?:, )?)+)\)/g)].map(match => match[1].split(', ').map(value => value.slice(1, -1)));
    const tools = lists.filter(list => list.includes('get_sky'));
    expect(tools).toHaveLength(2);
    for (const list of tools) expect(list).toEqual([...COUNTED_TOOL_NAMES]);
  });
});
