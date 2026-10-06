import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import compatibility from '../../api/compatibility';
import { sourcePattern } from '../../scripts/lib/vercel-source-pattern.mjs';
import { MCP_ROUTE_PARAM, MCP_ROUTES } from '../../src/mcp/hosted-route';

/*
 * The hosted MCP endpoint's routing: /mcp and /mcp/health, with or without a
 * trailing slash, rewrite to the shared compatibility function with the MCP
 * route parameter, and no redirect on the canonical host turns a POST to /mcp
 * into a GET of /mcp/ first, which an MCP client would not follow.
 */
const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const PATHS = ['/mcp', '/mcp/', '/mcp/health', '/mcp/health/'];

describe('the hosted MCP routes', () => {
  it('rewrites each path, exactly, to the compatibility function with the MCP route parameter', () => {
    for (const path of PATHS) {
      const value = path.startsWith('/mcp/health') ? MCP_ROUTES.health : MCP_ROUTES.protocol;
      expect(config.rewrites).toContainEqual({ source: path, destination: `/api/compatibility?${MCP_ROUTE_PARAM}=${value}` });
    }
    expect(config.rewrites.filter((rule: any) => rule.destination.includes(`${MCP_ROUTE_PARAM}=`))).toHaveLength(PATHS.length);
  });

  it('sends no MCP path through a redirect on the canonical host', () => {
    for (const path of PATHS) {
      const redirected = config.redirects.filter((rule: any) => !rule.has && sourcePattern(rule.source).test(path));
      expect(redirected, path).toEqual([]);
    }
  });

  it('still adds the trailing slash to an ordinary page', () => {
    const slash = config.redirects.find((rule: any) => rule.destination === '/:path/');
    expect(sourcePattern(slash.source).test('/moon-sign')).toBe(true);
    expect(sourcePattern(slash.source).test('/mcpx')).toBe(true);
  });

  it('hands an MCP request to the hosted endpoint, which is off unless switched on', async () => {
    const previous = process.env.ZODIACS_MCP_ENABLED;
    delete process.env.ZODIACS_MCP_ENABLED;
    try {
      const headers: Record<string, string> = {};
      let status = 0;
      await new Promise<void>((resolve) => {
        void compatibility({
          method: 'POST', url: '/api/compatibility?__zodiacs_mcp=1', query: { [MCP_ROUTE_PARAM]: '1' },
          headers: { host: 'zodiacs.org', 'content-type': 'application/json' }, body: '{}',
        }, {
          statusCode: 200,
          setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; },
          end() { status = this.statusCode; resolve(); },
        });
      });
      expect(status).toBe(503);
      expect(headers['retry-after']).toBe('3600');
    } finally {
      if (previous !== undefined) process.env.ZODIACS_MCP_ENABLED = previous;
    }
  });
});
