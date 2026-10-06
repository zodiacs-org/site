import { describe, it, expect, vi } from 'vitest';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { configuredWatchOAuth, watchClaims } from './oauth';

const issuer = 'https://oauthtest.supabase.co/auth/v1';
const resource = 'https://zodiacs-sky-watch-test.vercel.app/mcp';
const claims = () => ({ iss: issuer, aud: resource, role: 'authenticated', is_anonymous: false,
  sub: randomUUID(), session_id: randomUUID(), client_id: randomUUID(), scope: 'openid',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60, zodiacs_permissions: ['sky:watch'] });

describe('Sky Watch OAuth authorization', () => {
  it('requires issuer, exact audience, active time, identity, scope and a server-issued permission', () => {
    const valid = claims(); expect(watchClaims(valid, issuer, resource)).toBe(true);
    for (const patch of [{ iss: issuer + '/' }, { aud: 'authenticated' }, { aud: [resource] }, { exp: 0 },
      { iat: Date.now() }, { nbf: Math.floor(Date.now() / 1000) + 60 }, { scope: 'email' },
      { role: 'service_role' }, { is_anonymous: true }, { client_id: undefined }, { session_id: 'bad' },
      { zodiacs_permissions: [] }, { zodiacs_permissions: undefined, user_metadata: { zodiacs_permissions: ['sky:watch'] } }]) {
      expect(watchClaims({ ...valid, ...patch }, issuer, resource)).toBe(false);
    }
  });
  it('publishes exact resource discovery and refuses enabling OAuth outside a configured preview', () => {
    expect(configuredWatchOAuth({}, vi.fn())).toBeUndefined();
    for (const env of [{}, { VERCEL_ENV: 'production' }, { VERCEL_ENV: 'preview', ZODIACS_MCP_STAGING_HOST: 'attacker.example' }]) {
      expect(() => configuredWatchOAuth({ ...env, ZODIACS_SKY_WATCH_AUTH: 'oauth' }, vi.fn())).toThrow();
    }
  });
  it('verifies a real signature before resolving live authorization and rejects a tampered token', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const kid = randomUUID(); const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'ES256', use: 'sig' };
    const jwt = (payload: object) => {
      const body = [JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' }), JSON.stringify(payload)].map(s => Buffer.from(s).toString('base64url')).join('.');
      return `${body}.${sign('sha256', Buffer.from(body), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
    };
    const rpc = vi.fn(async () => ({ id: randomUUID(), expires_at: new Date(Date.now() + 60_000).toISOString() }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(String(url)).toBe(`${issuer}/.well-known/jwks.json`);
      return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'Content-Type': 'application/json' } });
    }));
    try {
      const oauth = configuredWatchOAuth({ ZODIACS_SKY_WATCH_AUTH: 'oauth', VERCEL_ENV: 'preview',
        ZODIACS_MCP_STAGING_HOST: new URL(resource).host, PUBLIC_SUPABASE_URL: issuer.replace('/auth/v1', ''),
        PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }, rpc as any)!;
      expect(oauth.metadata.resource).toBe(resource);
      expect(oauth.challenge).toContain('/.well-known/oauth-protected-resource/mcp');
      const valid = claims(); const token = jwt(valid);
      expect(await oauth.authenticate(token)).toBeTruthy();
      expect(rpc).toHaveBeenCalledWith('oauth', { user: valid.sub, session: valid.session_id, client: valid.client_id, resource });
      rpc.mockClear();
      const parts = token.split('.'); parts[1] = Buffer.from(JSON.stringify({ ...valid, sub: randomUUID() })).toString('base64url');
      expect(await oauth.authenticate(parts.join('.'))).toBeNull();
      expect(await oauth.authenticate(jwt({ ...valid, aud: 'authenticated' }))).toBeNull();
      expect(await oauth.authenticate('zsw_legacy-bearer')).toBeNull();
      expect(rpc).not.toHaveBeenCalled();
      rpc.mockResolvedValueOnce(null as any);
      expect(await oauth.authenticate(token)).toBeNull();
    } finally { vi.unstubAllGlobals(); }
  });
});
