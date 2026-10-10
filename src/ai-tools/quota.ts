import type { RateLimitVerdict } from '../lib/compute-api/constants';

export type QuotaKind = 'request' | 'event';
type Environment = Readonly<Record<string, string | undefined>>;

export interface ServiceRpc { url: string; scope: 'preview' | 'production'; headers: Record<string, string> }

/** The deployment's trusted scope and service-role headers, or nothing when the
 * deployment is not fully configured. Shared by the quota and the daily usage
 * counter; the key travels only in headers, never in a URL.
 */
export function serviceRpc(env: Environment): ServiceRpc | undefined {
  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const scope = env.VERCEL_ENV;
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)
    || !key || key.length < 24 || key.length > 2048
    || (scope !== 'preview' && scope !== 'production')) return undefined;
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  return { url, scope, headers };
}

/** A service-wide, database-clock budget shared by every instance and region.
 * No IP, caller identifier, arguments or request receipt is persisted. The
 * existing Firewall remains the separate per-address abuse boundary.
 */
export async function reserveAiQuota(kind: QuotaKind, env: Environment, fetcher: typeof fetch = fetch): Promise<RateLimitVerdict> {
  const rpc = serviceRpc(env);
  if (!rpc) return 'unavailable';
  try {
    const response = await fetcher(`${rpc.url}/rest/v1/rpc/zodiacs_mcp_quota_reserve_v1`, {
      method: 'POST', headers: rpc.headers, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(3000), body: JSON.stringify({ quota_scope: rpc.scope, quota_kind: kind }),
    });
    if (!response.ok) return 'unavailable';
    const result = await response.json();
    return result === true ? 'allowed' : result === false ? 'limited' : 'unavailable';
  } catch { return 'unavailable'; }
}
