import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import compatibility from '../../api/compatibility';
import { matchingHeaderRules, sourcePattern } from '../../scripts/lib/vercel-source-pattern.mjs';
import { COMPUTE_ENDPOINTS, COMPUTE_ROUTE_PARAM } from '../../src/lib/compute-api/constants';
import { MCP_ROUTE_PARAM, MCP_ROUTES, MCP_SWITCH_ENV, MCP_URL } from '../../src/mcp/hosted-route';

/*
 * The hosted sky MCP endpoint's routing: exactly /api/v1/mcp and
 * /api/v1/mcp/health rewrite to the shared compatibility function with the MCP
 * route parameter. No redirect turns a POST into a GET of another address
 * first, which an MCP client would not follow; no caching header rule reaches
 * them; and the routes leave /mcp, pull request #618's endpoint, and the seven
 * compute routes as they were.
 */
const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const ROUTES = [['/api/v1/mcp', MCP_ROUTES.protocol], ['/api/v1/mcp/health', MCP_ROUTES.health]] as const;

describe('the hosted sky MCP routes', () => {
  it('rewrites exactly /api/v1/mcp and /api/v1/mcp/health to the compatibility function with the MCP route parameter', () => {
    expect(new URL(MCP_URL).pathname).toBe('/api/v1/mcp');
    for (const [path, value] of ROUTES) {
      expect(config.rewrites).toContainEqual({ source: path, destination: `/api/compatibility?${MCP_ROUTE_PARAM}=${value}` });
    }
    const ours = config.rewrites.filter((rule: any) => rule.destination.includes(`${MCP_ROUTE_PARAM}=`));
    expect(ours.map((rule: any) => rule.source)).toEqual(ROUTES.map(([path]) => path));
  });

  it('sends neither path through a redirect, and lets no caching header rule reach them', () => {
    for (const [path] of ROUTES) {
      const redirected = config.redirects.filter((rule: any) => !rule.has && sourcePattern(rule.source).test(path));
      expect(redirected, path).toEqual([]);
      expect(matchingHeaderRules(config, path).map((rule: any) => rule.source), path).toEqual(['/(.*)']);
    }
  });

  it('leaves /mcp and the seven compute routes as they were', () => {
    for (const path of ['/mcp', '/mcp/', '/mcp/health', '/mcp/health/']) {
      const routed = config.rewrites.filter((rule: any) => rule.source === path && rule.destination.includes(`${MCP_ROUTE_PARAM}=`));
      expect(routed, path).toEqual([]);
    }
    const compute = config.rewrites.filter((rule: any) => rule.destination.includes(`${COMPUTE_ROUTE_PARAM}=`));
    expect(compute).toHaveLength(COMPUTE_ENDPOINTS.length);
    expect(compute).toHaveLength(7);
  });

  it('hands a request with the MCP route parameter to the hosted endpoint, which is off unless switched on', async () => {
    const source = readFileSync(new URL('../../api/compatibility.ts', import.meta.url), 'utf8');
    expect(source).toContain(`req.query?.${MCP_ROUTE_PARAM} !== undefined`);
    const previous = process.env[MCP_SWITCH_ENV];
    delete process.env[MCP_SWITCH_ENV];
    try {
      const headers: Record<string, string> = {};
      let status = 0;
      await new Promise<void>((resolve) => {
        void compatibility({
          method: 'POST', url: `/api/compatibility?${MCP_ROUTE_PARAM}=1`, query: { [MCP_ROUTE_PARAM]: '1' },
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
      if (previous !== undefined) process.env[MCP_SWITCH_ENV] = previous;
    }
  });
});
