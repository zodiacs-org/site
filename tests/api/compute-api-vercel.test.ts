import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMPUTE_ENDPOINTS, COMPUTE_FUNCTION_PATH, COMPUTE_ROUTE_PARAM, computePath } from '../../src/lib/compute-api/constants';
import { effectiveHeaders, matchingHeaderRules, sourcePattern, sourceRegexSource } from '../../scripts/lib/vercel-source-pattern.mjs';

/*
 * How vercel.json delivers the compute endpoints. Until this change one rule,
 * `/api/v1/(.*)`, gave everything under /api/v1/ `Cache-Control: public,
 * max-age=86400, must-revalidate`, which would have reached every compute
 * response, a 405 answering a GET with birth data in its query included. The
 * rule now matches only paths that end in a file name with an extension, as
 * every static sky data file does and no compute path can, so the function's
 * own `Cache-Control: no-store` is the only cache header on its answers.
 */
const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const recorded = JSON.parse(readFileSync(new URL('../../docs/platform/evidence/compute-api-2026-09-29/vercel-build-routes.json', import.meta.url), 'utf8'));
const COMPUTE_PATHS = COMPUTE_ENDPOINTS.map(computePath);

describe('vercel.json for the compute API', () => {
  it('rewrites each endpoint, exactly, to the compatibility function with the compute route parameter', () => {
    for (const endpoint of COMPUTE_ENDPOINTS) {
      expect(config.rewrites).toContainEqual({
        source: computePath(endpoint),
        destination: `${COMPUTE_FUNCTION_PATH}?${COMPUTE_ROUTE_PARAM}=${endpoint}`,
      });
    }
    const destinations = config.rewrites.filter((rule: any) => rule.destination.includes(`${COMPUTE_ROUTE_PARAM}=`));
    expect(destinations).toHaveLength(COMPUTE_ENDPOINTS.length);
    // The host function keeps the platform's defaults.
    expect(config.functions?.['api/compatibility.ts']).toBeUndefined();
  });

  it('lets no header rule set a cache lifetime, CORS or anything but the site-wide security headers on a compute path', () => {
    const siteWide = config.headers.find((rule: any) => rule.source === '/(.*)');
    for (const path of [...COMPUTE_PATHS, ...COMPUTE_PATHS.map((path) => `${path}/`), COMPUTE_FUNCTION_PATH]) {
      expect(matchingHeaderRules(config, path).map((rule: any) => rule.source), path).toEqual(['/(.*)']);
      const headers = effectiveHeaders(config, path);
      expect(headers.get('cache-control'), path).toBeUndefined();
      expect(headers.get('access-control-allow-origin'), path).toBeUndefined();
      expect([...headers.keys()].sort()).toEqual(siteWide.headers.map((header: any) => header.key.toLowerCase()).sort());
    }
  });

  it('still gives every static sky data file its family rule, and would have matched the compute paths before', () => {
    const family = config.headers.find((rule: any) => rule.source.startsWith('/api/v1/:file('));
    expect(family.headers).toContainEqual({ key: 'Cache-Control', value: 'public, max-age=86400, must-revalidate' });
    for (const path of ['/api/v1/index.json', '/api/v1/llms.txt', '/api/v1/sky/today.md', '/api/v1/schema/today.v1.json', '/api/v1/retrogrades/2026.json']) {
      expect(sourcePattern(family.source).test(path), path).toBe(true);
    }
    const before = sourcePattern('/api/v1/(.*)');
    for (const path of COMPUTE_PATHS) {
      expect(before.test(path), path).toBe(true);
      expect(sourcePattern(family.source).test(path), path).toBe(false);
    }
  });

  it('sends no compute path through a redirect on the canonical host', () => {
    for (const path of COMPUTE_PATHS) {
      const redirected = config.redirects.filter((rule: any) => !rule.has && sourcePattern(rule.source).test(path));
      expect(redirected, path).toEqual([]);
    }
  });

  it('compiles each source as `vercel build` did for this vercel.json', () => {
    expect(recorded.headers.map((rule: any) => rule.source)).toEqual(config.headers.map((rule: any) => rule.source));
    for (const rule of recorded.headers) expect(sourceRegexSource(rule.source), rule.source).toBe(rule.src);
    for (const rule of recorded.computeRewrites) {
      const source = config.rewrites.find((candidate: any) => candidate.destination === rule.dest).source;
      expect(sourceRegexSource(source)).toBe(rule.src);
    }
    // The platform's own header routes, which the build put ahead of these, reach no compute path.
    for (const rule of recorded.platformHeaders) {
      for (const path of COMPUTE_PATHS) expect(new RegExp(rule.src, 'u').test(path), `${rule.src} ${path}`).toBe(false);
    }
  });
});
