import type { RateLimitVerdict } from '../lib/compute-api/constants';

export type QuotaKind = 'request' | 'event';
type Environment = Readonly<Record<string, string | undefined>>;

/** A service-wide, database-clock budget shared by every instance and region.
 * No IP, caller identifier, arguments or request receipt is persisted. The
 * existing Firewall remains the separate per-address abuse boundary.
 */
export async function reserveAiQuota(kind: QuotaKind, env: Environment, fetcher: typeof fetch = fetch): Promise<RateLimitVerdict> {
  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const scope = env.VERCEL_ENV;
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)
    || !key || key.length < 24 || key.length > 2048
    || !['preview', 'production'].includes(scope ?? '')) return 'unavailable';
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  try {
    const response = await fetcher(`${url}/rest/v1/rpc/zodiacs_mcp_quota_reserve_v1`, {
      method: 'POST', headers, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(3000), body: JSON.stringify({ quota_scope: scope, quota_kind: kind }),
    });
    if (!response.ok) return 'unavailable';
    const result = await response.json();
    return result === true ? 'allowed' : result === false ? 'limited' : 'unavailable';
  } catch { return 'unavailable'; }
}
