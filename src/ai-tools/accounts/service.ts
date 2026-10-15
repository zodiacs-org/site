import { supabaseOAuthResource, type OAuthResource } from '../auth/oauth';
import { ORIGIN } from '../contracts';
import { ACCOUNT_PERMISSION, ACCOUNT_SCOPES, ACCOUNTS_SWITCH_ENV } from './contracts';
import { PAGE_KINDS, type AccountPrincipal, type SavedRecord, type SaveStore, type StoredSave } from './save';

type Environment = Readonly<Record<string, string | undefined>>;
export type AccountsRpc = <T = unknown>(operation: 'oauth' | 'save', input: Record<string, unknown>) => Promise<T>;

/** What the hosted server needs to offer save_to_zodiacs. */
export interface AccountsService {
  oauth: OAuthResource<AccountPrincipal>;
  save: SaveStore;
  /** The predefined OAuth client IDs the consent page accepts. */
  clients: readonly string[];
  supabaseUrl: string;
  publishableKey: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for the exact value '1'. Anything else leaves the 0.5.0 server as it is. */
export function accountsEnabled(env: Environment): boolean {
  return env[ACCOUNTS_SWITCH_ENV] === '1';
}

/**
 * The exact MCP audience. Production is https://zodiacs.org/mcp; a preview
 * deployment uses only its exact, administrator-configured staging host.
 */
export function accountsResourceOrigin(env: Environment): string {
  if (env.VERCEL_ENV === 'production') return ORIGIN;
  const host = env.ZODIACS_MCP_STAGING_HOST;
  if (env.VERCEL_ENV === 'preview' && host && host.length <= 253 && /^[a-z0-9-]+\.vercel\.app$/.test(host)) return `https://${host}`;
  throw new Error('accounts-unavailable');
}

/** Privileged RPC is server-only; no record, token or identity enters errors or logs. */
export function accountsRpc(env: Environment, fetcher: typeof fetch = fetch): AccountsRpc {
  const url = env.PUBLIC_SUPABASE_URL; const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !key || key.length < 24) throw new Error('accounts-unavailable');
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  return async (operation, input) => {
    const response = await fetcher(`${url}/rest/v1/rpc/zodiacs_accounts_v1`, { method: 'POST', headers, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(5000), body: JSON.stringify({ operation, input }) });
    if (!response.ok) { await response.body?.cancel().catch(() => {}); throw new Error('accounts-unavailable'); }
    return response.json();
  };
}

/**
 * Off unless ZODIACS_ACCOUNTS_ENABLED=1. On, a missing or malformed setting
 * throws, so the server refuses rather than offering a half-configured sign-in.
 * Sky Watch's preview requires a token for every request; the two never share
 * a deployment.
 */
export function configuredAccounts(env: Environment, rpc?: AccountsRpc): AccountsService | undefined {
  if (!accountsEnabled(env)) return undefined;
  if (env.ZODIACS_SKY_WATCH_ENABLED === '1') throw new Error('accounts-unavailable');
  // Saves land in public.saved_pages; the profile must list and remove them before anything is saved there.
  if (env.PUBLIC_ACCOUNT_SAVES_ENABLED !== '1') throw new Error('accounts-unavailable');
  const url = env.PUBLIC_SUPABASE_URL, key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const clients = (env.ZODIACS_ACCOUNTS_OAUTH_CLIENTS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !key?.startsWith('sb_publishable_')
    || !clients.length || clients.length > 8 || clients.some(client => !UUID.test(client))) throw new Error('accounts-unavailable');
  const origin = accountsResourceOrigin(env);
  const resource = `${origin}/mcp`;
  const call = rpc ?? accountsRpc(env);
  const oauth = supabaseOAuthResource<AccountPrincipal>({
    supabaseUrl: url, publishableKey: key, resource,
    metadataUrl: `${origin}/.well-known/oauth-protected-resource/mcp`,
    scopes: ACCOUNT_SCOPES, permission: ACCOUNT_PERMISSION,
    resourceName: 'Zodiacs', resourceDocumentation: `${ORIGIN}/privacy/`,
    // The live check: enabled client for this exact resource, the session, its
    // consent, and the account. Repeated inside the save transaction.
    live: async ({ user, session, client }) => {
      if (!clients.includes(client)) return null;
      const active = await call<boolean>('oauth', { user, session, client, resource });
      return active === true ? { user, session, client } : null;
    },
  });
  // One row in the site's public.saved_pages, listed and removed on the profile with everything else saved there.
  const save: SaveStore = async (principal: AccountPrincipal, record: SavedRecord) =>
    call<StoredSave | 'full' | null>('save', { ...principal, resource, kind: PAGE_KINDS[record.kind], title: record.title, href: record.href, summary: record.summary, detail: record });
  return { oauth, save, clients, supabaseUrl: url, publishableKey: key };
}

/** The WWW-Authenticate value for a token that was present but is no longer usable. */
export function invalidTokenChallenge(oauth: OAuthResource<unknown>): string {
  return `${oauth.challenge}, error="invalid_token"`;
}

/** The Apps SDK's tool-level challenge: ChatGPT shows its sign-in prompt from it. */
export function signInChallenge(oauth: OAuthResource<unknown>): string {
  return `${oauth.challenge}, error="insufficient_scope", error_description="Sign in to your Zodiacs account to save this."`;
}
