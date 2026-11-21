import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { loadSkyApiSources } from '../src/lib/sky-api/sources.ts';
import { buildSkyApi } from '../src/lib/sky-api/files.ts';
import { YEAR_FAMILIES } from '../src/lib/sky-api/build.ts';
import { cacheControlFor } from '../src/lib/sky-api/schemas.ts';
import { PLANET_SLUGS } from '../src/lib/sky-api/meta.ts';
import { effectiveHeaders as headersFor } from './lib/vercel-source-pattern.mjs';

/**
 * The shared sky API is public data served as static files, so everything a
 * consumer can rely on about delivery — that it is reachable cross-origin
 * without a key, that it is not indexed as pages, and that a cached copy never
 * outlives the cadence the API itself advertises — lives in `vercel.json` and
 * nowhere else. The payloads are gated by `sky-api.test.mjs`; this gates how
 * they arrive, and ties the cache tiers to the endpoint manifest so the two
 * cannot drift apart silently.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED_AT = '2026-09-07T00:00:00.000Z';
const DAY_SECONDS = 86_400;

const sources = await loadSkyApiSources(root);
const build = buildSkyApi(sources, { generatedAt: GENERATED_AT });
const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));

/** Every file the builder actually writes, as the path it is served from. */
const servedPaths = [...build.files.keys()].map((file) => `/api/v1/${file}`);
const advertised = build.payloads.get('index.json').endpoints;

/**
 * Vercel's `source` is a path pattern, not a regular expression: every literal
 * character is escaped before parameters and groups are translated, or a `.`
 * in a filename silently matches anything. scripts/lib/vercel-source-pattern.mjs
 * compiles it as Vercel does. Verified against production, where
 * `/api/v1/sky/today.json` really does return `max-age=300` from its own rule
 * and inherits `noindex` from the family rule above it.
 */
const effectiveHeaders = (path) => headersFor(config, path);

/**
 * The longest a cached copy may live, read from the endpoint's own `updates`
 * sentence rather than assumed. An unrecognised cadence is a failure, not a
 * default: a new one has to be classified here deliberately.
 */
function cadenceSeconds(updates) {
  if (/\bhourly\b/u.test(updates)) return 3_600;
  if (/\bdaily\b/u.test(updates)) return DAY_SECONDS;
  if (/underlying yearly data is refreshed/u.test(updates)) return DAY_SECONDS;
  throw new Error(`Unclassified update cadence, add it to cadenceSeconds: ${updates}`);
}

function maxAge(path) {
  const value = effectiveHeaders(path).get('cache-control');
  const match = /max-age=(\d+)/u.exec(value ?? '');
  return match ? Number(match[1]) : null;
}

describe('shared sky API delivery headers', () => {
  it('serves every file it writes cross-origin, unindexed, and revalidated', () => {
    // Pinned to what the builder really writes, so files disappearing from the
    // API cannot quietly shrink what this test covers.
    expect(servedPaths.length).toBe(build.files.size);
    expect(servedPaths.length).toBeGreaterThanOrEqual(59);

    for (const path of servedPaths) {
      const headers = effectiveHeaders(path);
      // Public data with no key: a browser on someone else's origin can read it.
      expect(headers.get('access-control-allow-origin'), path).toBe('*');
      // Data, not pages. Indexing these would put raw JSON in search results.
      expect(headers.get('x-robots-tag'), path).toBe('noindex');
      // `must-revalidate` is the promise that a stale copy is never served as
      // if it were current once its freshness window has passed.
      expect(headers.get('cache-control'), path).toMatch(/must-revalidate/u);
      expect(maxAge(path), path).not.toBeNull();
    }
  });

  it('never caches an endpoint for longer than the cadence it advertises', () => {
    expect(advertised.length).toBeGreaterThanOrEqual(43);

    for (const { path, updates } of advertised) {
      // Every advertised endpoint must actually be a file the builder writes;
      // otherwise the API promises a URL that 404s while still inheriting a
      // cache header from the family rule.
      expect(servedPaths, `${path} is advertised but never written`).toContain(path);

      const age = maxAge(path);
      const limit = cadenceSeconds(updates);
      expect(age, `${path} has no max-age`).not.toBeNull();
      expect(age, `${path} is cached ${age}s against its stated cadence (${limit}s): ${updates}`)
        .toBeLessThanOrEqual(limit);
    }
  });

  it('caches the two entry points at least as tightly as the rest', () => {
    // Today's sky is the most time-sensitive payload and the index is what a
    // consumer polls to discover the others; neither may be the stalest thing
    // in the family.
    const today = maxAge('/api/v1/sky/today.json');
    const index = maxAge('/api/v1/index.json');
    const others = servedPaths
      .filter((path) => path !== '/api/v1/sky/today.json' && path !== '/api/v1/index.json')
      .map((path) => maxAge(path));
    const family = Math.max(...others);

    expect(today, 'today.json must not be cached longer than anything else').toBeLessThanOrEqual(Math.min(...others));
    // Strictly tighter than the family default, so deleting the index rule and
    // letting it fall back to the wildcard is a failure rather than a no-op.
    expect(index, 'index.json must be cached more tightly than the family default').toBeLessThan(family);
    expect(today).toBeLessThanOrEqual(index);
  });

  it('sends each written file the lifetime the OpenAPI document states for it', () => {
    const openapi = JSON.parse(build.files.get('openapi.json'));
    for (const path of servedPaths) {
      const file = path.slice('/api/v1/'.length);
      // Every file the builder writes gets a real lifetime from a rule that
      // names it, never the catch-all fallback kept for misses.
      expect(maxAge(path), `${path} falls through to the miss fallback; name it in vercel.json`).toBeGreaterThan(0);
      if (file.endsWith('.json') && build.payloads.has(file)) {
        expect(effectiveHeaders(path).get('cache-control'), path).toBe(cacheControlFor(file));
      }
    }
    // The OpenAPI header for each operation is the one its example file is sent with.
    let checked = 0;
    for (const [route, item] of Object.entries(openapi.paths)) {
      const ok = item.get?.responses?.[200];
      if (!ok) continue;
      const example = ok.content['application/json'].examples.served.externalValue.replace('https://zodiacs.org', '');
      expect(ok.headers['Cache-Control'].schema.const, route).toBe(effectiveHeaders(example).get('cache-control'));
      checked += 1;
    }
    expect(checked).toBe(11);
  });

  it('does not cache a miss outside coverage as if it were a file', () => {
    const misses = [
      ...YEAR_FAMILIES.flatMap((family) => {
        const years = advertised
          .map(({ path }) => new RegExp(`^/api/v1/${family}/(\\d{4})\\.json$`, 'u').exec(path)?.[1])
          .filter(Boolean)
          .map(Number);
        expect(years.length, family).toBeGreaterThan(0);
        return [Math.min(...years) - 1, Math.max(...years) + 1].map((year) => `/api/v1/${family}/${year}.json`);
      }),
      '/api/v1/retrogrades/2031.json',
      '/api/v1/retrogrades/2025.json',
      '/api/v1/planets/chiron.json',
      '/api/v1/schema/nope.v1.json',
      '/api/v1/sky/tomorrow.json',
      '/api/v1/index.md',
    ];
    for (const path of misses) {
      expect(servedPaths, path).not.toContain(path);
      const headers = effectiveHeaders(path);
      expect(headers.get('cache-control'), path).toBe('public, max-age=0, must-revalidate');
      // Still data, still open: a 404 here is not indexed and is readable cross-origin.
      expect(headers.get('x-robots-tag'), path).toBe('noindex');
      expect(headers.get('access-control-allow-origin'), path).toBe('*');
    }
    // The planet rule names exactly the published bodies.
    for (const slug of PLANET_SLUGS) expect(maxAge(`/api/v1/planets/${slug}.json`), slug).toBe(DAY_SECONDS);
  });

  it('advertises each document with the Content-Type it is served with', () => {
    // Vercel sends a static file the type of its extension unless a header
    // rule sets one; observed in production on 2026-11-12, for instance
    // application/json; charset=utf-8 on /api/v1/schema/today.v1.json.
    const byExtension = { json: 'application/json', txt: 'text/plain', md: 'text/markdown' };
    const { documents } = build.payloads.get('index.json');
    expect(documents.length).toBeGreaterThanOrEqual(15);
    for (const { path, contentType } of documents) {
      expect(servedPaths, path).toContain(path);
      const set = effectiveHeaders(path).get('content-type');
      const served = (set ?? byExtension[path.split('.').pop()]).split(';')[0].trim();
      expect(contentType, path).toBe(served);
    }
  });

  it('keeps the API delivery rules off the rest of the site', () => {
    for (const path of ['/', '/birth-chart/', '/today/', '/horoscopes/aries/', '/developers/']) {
      const headers = effectiveHeaders(path);
      expect(headers.get('access-control-allow-origin'), path).toBeUndefined();
      expect(headers.get('x-robots-tag'), path).toBeUndefined();
    }
  });
});
