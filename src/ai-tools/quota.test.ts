import { describe, it, expect, vi } from 'vitest';
import { reserveAiQuota } from './quota';

const env = { PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: `sb_secret_${'x'.repeat(40)}`, VERCEL_ENV: 'preview' };
describe('atomic MCP budget boundary', () => {
  it('sends only the trusted scope and budget kind, with secret-key authentication', async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _options?: RequestInit) => new Response('true'));
    expect(await reserveAiQuota('event', env, fetcher)).toBe('allowed');
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://synthetic.supabase.co/rest/v1/rpc/zodiacs_mcp_quota_reserve_v1');
    expect(JSON.parse(options.body as string)).toEqual({ quota_scope: 'preview', quota_kind: 'event' });
    expect(options.headers).not.toHaveProperty('Authorization');
    expect(options.redirect).toBe('error');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it('uses legacy service-role JWT authorization without putting credentials in a URL', async () => {
    const key = 'synthetic-service-role-jwt-value';
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _options?: RequestInit) => new Response('false'));
    expect(await reserveAiQuota('request', { ...env, SUPABASE_SERVICE_ROLE_KEY: key }, fetcher)).toBe('limited');
    expect((fetcher.mock.calls[0][1]!.headers as Record<string, string>).Authorization).toBe(`Bearer ${key}`);
    expect(fetcher.mock.calls[0][0]).not.toContain(key);
  });
  it('refuses incomplete configuration before network work', async () => {
    const fetcher = vi.fn();
    for (const changed of [{ VERCEL_ENV: 'development' }, { VERCEL_ENV: undefined }, { PUBLIC_SUPABASE_URL: 'https://example.com' }, { SUPABASE_SERVICE_ROLE_KEY: '' }]) {
      expect(await reserveAiQuota('event', { ...env, ...changed }, fetcher)).toBe('unavailable');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('fails closed on transport, permissions, schema and timeout failures', async () => {
    for (const fetcher of [async () => { throw new Error('synthetic timeout'); }, async () => new Response('false', { status: 403 }), async () => new Response('{}'), async () => new Response('null'), async () => new Response('invalid')]) {
      expect(await reserveAiQuota('event', env, fetcher)).toBe('unavailable');
    }
  });
});
