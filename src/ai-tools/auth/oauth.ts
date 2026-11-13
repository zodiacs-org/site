import { createClient } from '@supabase/supabase-js';

/**
 * The OAuth resource-server checks shared by Sky Watch and Zodiacs accounts.
 * Supabase Auth is the authorization server: predefined public clients, PKCE
 * S256, an exact MCP audience set by an access-token hook and a separate
 * server-issued permission claim. Identity scopes stay with the provider.
 */
export interface OAuthRequirement {
  issuer: string;
  /** The exact MCP endpoint the token was minted for (the JWT audience). */
  resource: string;
  scopes: readonly string[];
  /** The application permission the access-token hook adds for enabled clients. */
  permission: string;
}

/** The identity facts every live authorization check is keyed by. */
export interface OAuthIdentity { user: string; session: string; client: string }

export interface OAuthResource<P> {
  resource: string;
  issuer: string;
  /** The WWW-Authenticate value for a request that carried no usable token. */
  challenge: string;
  /** Protected-resource metadata (RFC 9728). */
  metadata: Record<string, unknown>;
  authenticate(token: string): Promise<P | null>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
export const MAX_TOKEN_LENGTH = 8192;

/** These checks run only after the provider SDK has verified the JWT signature.
 * Browser sign-in tokens, ID tokens and tokens minted for other resources fail.
 */
export function oauthClaimsValid(claims: Record<string, unknown>, requirement: OAuthRequirement, now = Date.now()) {
  const scopes = typeof claims.scope === 'string' ? claims.scope.split(' ') : [];
  return claims.iss === requirement.issuer && claims.aud === requirement.resource && claims.role === 'authenticated'
    && claims.is_anonymous === false && typeof claims.exp === 'number' && claims.exp * 1000 > now
    && typeof claims.iat === 'number' && claims.iat * 1000 <= now + 30_000
    && (claims.nbf === undefined || typeof claims.nbf === 'number' && claims.nbf * 1000 <= now)
    && requirement.scopes.every(scope => scopes.includes(scope))
    && Array.isArray(claims.zodiacs_permissions) && claims.zodiacs_permissions.includes(requirement.permission)
    && ['sub', 'client_id', 'session_id'].every(key => typeof claims[key] === 'string' && uuid.test(claims[key] as string));
}

export interface SupabaseOAuthOptions<P> {
  supabaseUrl: string;
  publishableKey: string;
  resource: string;
  /** Where the protected-resource metadata is published. */
  metadataUrl: string;
  scopes: readonly string[];
  permission: string;
  resourceName: string;
  resourceDocumentation: string;
  /** Live session, consent, client and revocation checks; null refuses. */
  live(identity: OAuthIdentity): Promise<P | null>;
}

/** A Supabase-issued bearer token, verified by signature, claims and a live check. */
export function supabaseOAuthResource<P>(options: SupabaseOAuthOptions<P>): OAuthResource<P> {
  const { supabaseUrl: url, publishableKey: key, resource, scopes, permission } = options;
  const issuer = `${url}/auth/v1`;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(5000) }) } });
  return {
    resource, issuer,
    challenge: `Bearer resource_metadata="${options.metadataUrl}", scope="${scopes.join(' ')}"`,
    metadata: { resource, authorization_servers: [issuer], scopes_supported: scopes, bearer_methods_supported: ['header'],
      resource_name: options.resourceName, resource_documentation: options.resourceDocumentation },
    async authenticate(token) {
      if (token.length > MAX_TOKEN_LENGTH || !JWT_PATTERN.test(token)) return null;
      const { data, error } = await client.auth.getClaims(token);
      if (error || !data || !['ES256', 'RS256'].includes(data.header.alg)
        || !oauthClaimsValid(data.claims, { issuer, resource, scopes, permission })) return null;
      return options.live({ user: data.claims.sub, session: data.claims.session_id as string, client: data.claims.client_id as string });
    },
  };
}
