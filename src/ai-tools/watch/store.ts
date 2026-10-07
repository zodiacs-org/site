import type { Rpc } from './contracts';
type Environment = Readonly<Record<string, string | undefined>>;

/** Privileged RPC is server-only; no raw filters, credentials or URLs enter errors/logs. */
export function watchRpc(env: Environment, fetcher: typeof fetch = fetch): Rpc {
  const url = env.PUBLIC_SUPABASE_URL; const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !key || key.length < 24) throw new Error('watch-store-unavailable');
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  return async (operation, input = {}) => {
    const response = await fetcher(`${url}/rest/v1/rpc/zodiacs_sky_watch_v1`, { method: 'POST', headers, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(5000), body: JSON.stringify({ operation, input }) });
    if (!response.ok) throw new Error('watch-store-unavailable');
    return response.json();
  };
}
