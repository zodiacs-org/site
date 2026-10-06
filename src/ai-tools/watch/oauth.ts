import { createClient } from '@supabase/supabase-js';
import type { Principal, Rpc } from './contracts';

type Environment = Readonly<Record<string, string | undefined>>;
export const WATCH_SCOPES = ['openid'] as const;
export interface WatchOAuth {
  resource: string;
  issuer: string;
  challenge: string;
  metadata: Record<string, unknown>;
  authenticate(token: string): Promise<Principal | null>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** These checks run only after the provider SDK has verified the JWT signature.
 * Browser sign-in tokens, ID tokens and tokens minted for other resources fail.
 */
export function watchClaims(claims: Record<string, unknown>, issuer: string, resource: string, now = Date.now()) {
  const scopes = typeof claims.scope === 'string' ? claims.scope.split(' ') : [];
  return claims.iss === issuer && claims.aud === resource && claims.role === 'authenticated'
    && claims.is_anonymous === false && typeof claims.exp === 'number' && claims.exp * 1000 > now
    && typeof claims.iat === 'number' && claims.iat * 1000 <= now + 30_000
    && (claims.nbf === undefined || typeof claims.nbf === 'number' && claims.nbf * 1000 <= now)
    && WATCH_SCOPES.every(scope => scopes.includes(scope))
    && Array.isArray(claims.zodiacs_permissions) && claims.zodiacs_permissions.includes('sky:watch')
    && ['sub', 'client_id', 'session_id'].every(key => typeof claims[key] === 'string' && uuid.test(claims[key] as string));
}

export function configuredWatchOAuth(env: Environment, rpc: Rpc): WatchOAuth | undefined {
  if (env.ZODIACS_SKY_WATCH_AUTH !== 'oauth') return undefined;
  const host = env.ZODIACS_MCP_STAGING_HOST, url = env.PUBLIC_SUPABASE_URL, key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (env.VERCEL_ENV !== 'preview' || !host || !/^[a-z0-9-]+\.vercel\.app$/.test(host)
    || !url || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !key?.startsWith('sb_publishable_')) throw new Error('watch-oauth-unavailable');
  const resource = `https://${host}/mcp`, issuer = `${url}/auth/v1`;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(5000) }) } });
  return {
    resource, issuer,
    challenge: `Bearer resource_metadata="https://${host}/.well-known/oauth-protected-resource/mcp", scope="${WATCH_SCOPES.join(' ')}"`,
    metadata: { resource, authorization_servers: [issuer], scopes_supported: WATCH_SCOPES, bearer_methods_supported: ['header'],
      resource_name: 'Zodiacs Sky Watch preview', resource_documentation: 'https://zodiacs.org/developers/' },
    async authenticate(token) {
      if (token.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
      const { data, error } = await client.auth.getClaims(token);
      if (error || !data || !['ES256', 'RS256'].includes(data.header.alg) || !watchClaims(data.claims, issuer, resource)) return null;
      // Live session, consent, client and revocation checks are repeated by SQL
      // before subscription writes and before each background delivery.
      return rpc<Principal | null>('oauth', { user: data.claims.sub, session: data.claims.session_id,
        client: data.claims.client_id, resource });
    },
  };
}
