import { timingSafeEqual } from 'node:crypto';
import { createAiNodeHandler } from '../http';
import { configuredSkyWatch } from './service';
import { fillWatchLedger, deliverWatchEvents } from './worker';

/** Dedicated preview deployment: no production routes or credentials. */
export function createWatchPreviewHandler(env: Readonly<Record<string, string | undefined>> = process.env) {
  const mcp = createAiNodeHandler({ env });
  return async (req: any, res: any) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex'); res.setHeader('Referrer-Policy', 'no-referrer');
    const json = (status: number, value: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
    if (env.VERCEL_ENV !== 'preview' || env.ZODIACS_SKY_WATCH_AUTH !== 'oauth'
      || req.headers?.host !== env.ZODIACS_MCP_STAGING_HOST) return json(404, { error: 'unavailable' });
    const path = new URL(req.url ?? '/', 'https://preview.invalid').pathname;
    if (path === '/mcp' || path === '/api/mcp') return mcp(req, res);
    try {
      const service = configuredSkyWatch(env);
      if (!service?.oauth) return json(503, { error: 'unavailable' });
      if (req.method === 'GET' && ['/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-protected-resource'].includes(path)) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return json(200, service.oauth.metadata);
      }
      if (req.method === 'GET' && path === '/account-config') {
        return json(200, { url: env.PUBLIC_SUPABASE_URL, key: env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          clients: (env.ZODIACS_WATCH_OAUTH_CLIENTS ?? '').split(',').filter(Boolean) });
      }
      if (req.method === 'POST' && path === '/worker') {
        const secret = env.ZODIACS_SKY_WATCH_WORKER_KEY;
        const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(String(req.headers?.authorization ?? ''));
        if (!secret || secret.length < 43 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return json(401, { error: 'unauthorized' });
        // Durable lease prevents concurrent invocations from multiplying sky searches.
        const lease = await service.rpc<string | null>('workerclaim');
        if (!lease) return json(200, { skipped: true });
        try {
          const windowsFilled = await fillWatchLedger(service.rpc);
          const delivery = await deliverWatchEvents(service.rpc, service.vault, service.post);
          await service.rpc('workerdone', { lease, ok: true, windowsFilled, ...delivery });
          return json(200, { windowsFilled, ...delivery });
        } catch {
          await service.rpc('workerdone', { lease, ok: false }).catch(() => {});
          return json(503, { error: 'worker-unavailable' });
        }
      }
      return json(404, { error: 'unavailable' });
    } catch { return json(503, { error: 'unavailable' }); }
  };
}
