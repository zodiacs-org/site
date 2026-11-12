import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// A route-scoped Content-Security-Policy in vercel.json REPLACES the global
// one for that route; nothing is inherited. Every source the global policy
// allows therefore has to be copied into the route policy unless the route
// means to drop it, or the page breaks quietly: the account bootstrap and
// the Guide's sign-in check talk to Supabase from every Base-layout page and
// every page that opens the Guide, so a route policy without Supabase leaves
// a signed-in visitor's tab locked (third-party-scripts audit, finding 4).
//
// The narrowings below are the deliberate ones. Anything else a route policy
// leaves out of the global policy fails this test.

const ROOT = resolve(import.meta.dirname, '..');

// Each route's deliberate removals, by directive. A source listed here may be
// absent from the route; every other global source must be present.
const SANCTIONED_NARROWING = {
  '/astrofolio/how-to-buy/(.*)': {
    // The Wikipedia pageviews read belongs to app.js pages, not this guide.
    'connect-src': ['https://wikimedia.org'],
    'frame-src': ["'self'"],
  },
  '/terminal/markets/(.*)': {
    'connect-src': ['https://wikimedia.org'],
    'frame-src': ["'self'"],
  },
  '/registry/collection/(.*)': {
    // The Cabinet touches no price API (docs/GAMES-SITE-MAP.md).
    'connect-src': [
      'https://api.jup.ag',
      'https://api.dexscreener.com',
      'https://api.geckoterminal.com',
      'https://wikimedia.org',
    ],
    'frame-src': ["'self'"],
  },
};

// `/embed/(.*)` sends a frame-ancestors-only policy so third parties can
// frame the widgets; it is not a narrowed copy of the global policy and is
// tracked separately (security-headers audit, F3).
const NOT_DERIVED = new Set(['/embed/(.*)']);

function parsePolicy(value) {
  const directives = new Map();
  for (const part of value.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/u).filter(Boolean);
    if (name) directives.set(name, sources);
  }
  return directives;
}

async function cspRules() {
  const config = JSON.parse(await readFile(resolve(ROOT, 'vercel.json'), 'utf8'));
  return config.headers
    .map(({ source, headers }) => ({
      source,
      csp: headers.find((header) => header.key === 'Content-Security-Policy')?.value,
    }))
    .filter(({ csp }) => csp);
}

describe('route-scoped CSPs derive from the global policy', () => {
  it('lists every route-scoped CSP, so a new one cannot skip this check', async () => {
    const rules = await cspRules();
    const scoped = rules.map(({ source }) => source).filter((source) => source !== '/(.*)');
    expect(rules.filter(({ source }) => source === '/(.*)')).toHaveLength(1);
    expect(scoped.sort()).toEqual([...Object.keys(SANCTIONED_NARROWING), ...NOT_DERIVED].sort());
  });

  it('keeps every global directive and source except the sanctioned narrowings', async () => {
    const rules = await cspRules();
    const global = parsePolicy(rules.find(({ source }) => source === '/(.*)').csp);
    for (const { source, csp } of rules) {
      if (source === '/(.*)' || NOT_DERIVED.has(source)) continue;
      const route = parsePolicy(csp);
      const allowedToDrop = SANCTIONED_NARROWING[source] ?? {};
      for (const [directive, globalSources] of global) {
        expect(route.has(directive), `${source} drops ${directive}`).toBe(true);
        const dropped = globalSources.filter((value) => !route.get(directive).includes(value));
        expect(dropped, `${source} ${directive}`).toEqual(
          globalSources.filter((value) => (allowedToDrop[directive] ?? []).includes(value)),
        );
      }
    }
  });

  it('never sanctions dropping the account backend', async () => {
    const rules = await cspRules();
    const global = parsePolicy(rules.find(({ source }) => source === '/(.*)').csp);
    const supabase = global.get('connect-src').filter((value) => value.includes('.supabase.co'));
    expect(supabase).toHaveLength(2);
    for (const [source, narrowing] of Object.entries(SANCTIONED_NARROWING)) {
      for (const value of supabase) expect(narrowing['connect-src'] ?? [], source).not.toContain(value);
    }
  });
});
