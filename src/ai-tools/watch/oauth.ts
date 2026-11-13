import type { Principal, Rpc } from './contracts';
import { oauthClaimsValid, supabaseOAuthResource, type OAuthResource } from '../auth/oauth';

type Environment = Readonly<Record<string, string | undefined>>;
export const WATCH_SCOPES = ['openid'] as const;
export const WATCH_PERMISSION = 'sky:watch';
export type WatchOAuth = OAuthResource<Principal>;

/** These checks run only after the provider SDK has verified the JWT signature.
 * Browser sign-in tokens, ID tokens and tokens minted for other resources fail.
 */
export function watchClaims(claims: Record<string, unknown>, issuer: string, resource: string, now = Date.now()) {
  return oauthClaimsValid(claims, { issuer, resource, scopes: WATCH_SCOPES, permission: WATCH_PERMISSION }, now);
}

export function configuredWatchOAuth(env: Environment, rpc: Rpc): WatchOAuth | undefined {
  if (env.ZODIACS_SKY_WATCH_AUTH !== 'oauth') return undefined;
  const host = env.ZODIACS_MCP_STAGING_HOST, url = env.PUBLIC_SUPABASE_URL, key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (env.VERCEL_ENV !== 'preview' || !host || !/^[a-z0-9-]+\.vercel\.app$/.test(host)
    || !url || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !key?.startsWith('sb_publishable_')) throw new Error('watch-oauth-unavailable');
  const resource = `https://${host}/mcp`;
  return supabaseOAuthResource<Principal>({
    supabaseUrl: url, publishableKey: key, resource,
    metadataUrl: `https://${host}/.well-known/oauth-protected-resource/mcp`,
    scopes: WATCH_SCOPES, permission: WATCH_PERMISSION,
    resourceName: 'Zodiacs Sky Watch preview', resourceDocumentation: 'https://zodiacs.org/developers/',
    // Live session, consent, client and revocation checks are repeated by SQL
    // before subscription writes and before each background delivery.
    live: ({ user, session, client }) => rpc<Principal | null>('oauth', { user, session, client, resource }),
  });
}
