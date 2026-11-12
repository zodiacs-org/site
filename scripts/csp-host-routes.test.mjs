import { describe, expect, it } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { injectRegistryExchange, registryExchangeBuildEnv } from '../src/exchange/entry.mjs';

// Which routes need each external connect-src host, traced from the code that
// fetches it. The third-party-scripts audit (finding 2) found that a global
// connect-src narrowed to /terminal/markets/ and /astrofolio/how-to-buy/
// would silently break prices on /fomo/, /terminal/, /astrofolio/, the
// Registry pages and the gallery, because every market fetch is wrapped in
// try/catch. This test works the map out from the files themselves:
//
//   1. every first-party browser file (src/ and public/) that names an
//      external host is either a page, a bundle a page loads, or a source
//      bundled into one, so a new fetch site cannot go unmapped;
//   2. each host's routes are checked against EVERY Content-Security-Policy
//      in vercel.json that matches the route (a route-scoped policy replaces
//      the global one, and whichever reading Vercel applies, no matching
//      policy may block a route's host);
//   3. every external host the global connect-src allows has a route that
//      needs it, or is listed below as allowed without one.
//
// Changing which routes need a host means changing EXPECTED_ROUTES on purpose.

const ROOT = resolve(import.meta.dirname, '..');

const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

// Hosts written into first-party code.
const LITERAL_HOSTS = [
  'https://api.dexscreener.com',
  'https://api.geckoterminal.com',
  'https://api.jup.ag',
  'https://wikimedia.org',
];

// Hosts that come from deploy configuration rather than a literal in the code.
// Each is read by Base.astro, so it is needed on Base-layout pages. The routes
// here are representative pages, chosen to include every Base page a
// route-scoped policy covers.
const CONFIGURED_HOSTS = {
  // Plausible: the analytics loader injects PUBLIC_PLAUSIBLE_SCRIPT_URL and
  // posts events to plausible.io, on indexable pages that are not account or
  // private surfaces (so not the noindex /astrofolio/how-to-buy/).
  'https://plausible.io': {
    env: 'PUBLIC_PLAUSIBLE_SCRIPT_URL',
    directives: ['script-src', 'connect-src'],
    pages: ['src/pages/fomo/index.astro', 'src/pages/privacy/index.astro'],
  },
  // The account backend: the presence loader on every Base page imports the
  // account bootstrap when this device holds the Supabase session key.
  'https://mftpcdpttteuwbolobye.supabase.co': {
    env: 'PUBLIC_SUPABASE_URL',
    directives: ['connect-src'],
    pages: [
      'src/pages/astrofolio/how-to-buy/index.astro',
      'src/pages/birth-chart/index.astro',
      'src/pages/fomo/index.astro',
      'src/pages/profile/index.astro',
      'src/pages/registry/collection/index.astro',
    ],
  },
};

// Allowed by the global connect-src with no route that needs it today. Kept
// as it is (narrowing the global policy is a separate decision); listed so
// that any further unmapped host fails here.
const ALLOWED_WITHOUT_ROUTE = {
  // supabase-js opens Realtime over wss only when a channel subscribes, and
  // no first-party code subscribes to one.
  'wss://mftpcdpttteuwbolobye.supabase.co': () => noRealtimeChannel(),
};

// Bundles and the files that load them. Each edge is checked: the loader, as
// it is served in production, must reference the bundle's path.
const LOADED_BY = {
  'public/assets/app.js': [
    'public/astrofolio/index.html',
    'public/registry/technical/index.html',
    'public/terminal/index.html',
  ],
  // The gallery band: app.js injects it as it nears the viewport, and the
  // thesis essay plate does the same.
  'public/assets/gallery.js': ['public/assets/app.js', 'public/thesis/index.html'],
  // The selected-token chart, imported by app.js on demand.
  'public/assets/registry-token-chart.js': ['public/assets/app.js'],
  // The Terminal's venue route, stamped into /terminal/markets/ by
  // src/exchange/entry.mjs on production builds.
  'public/assets/exchange.js': ['public/terminal/markets/index.html'],
};

// Sources that name a host and the committed bundles they are built into.
// Each bundle must carry the same host, so the bundle's routes cover it.
const BUNDLED_INTO = {
  'src/app.jsx': ['public/assets/app.js'],
  'src/shelf/card.mjs': ['public/assets/gallery.js'],
  'src/exchange/gecko.mjs': ['public/assets/exchange.js', 'public/assets/registry-token-chart.js'],
  'src/exchange/stats.mjs': ['public/assets/exchange.js'],
  'src/trade/liquidity.mjs': ['public/assets/exchange.js'],
  'src/trade/ultra.mjs': ['public/assets/exchange.js'],
};

const signRoutes = SIGNS.map((sign) => `/registry/${sign}/`);

const EXPECTED_ROUTES = {
  'https://api.dexscreener.com': [
    '/astrofolio/',
    '/fomo/',
    ...signRoutes,
    '/registry/technical/',
    '/terminal/',
    '/terminal/markets/',
    '/thesis/',
  ],
  'https://api.geckoterminal.com': [
    '/astrofolio/',
    '/registry/technical/',
    '/terminal/',
    '/terminal/markets/',
  ],
  'https://api.jup.ag': ['/terminal/markets/'],
  'https://wikimedia.org': ['/astrofolio/', '/registry/technical/', '/terminal/', '/thesis/'],
  'https://plausible.io': ['/fomo/', '/privacy/'],
  'https://mftpcdpttteuwbolobye.supabase.co': [
    '/astrofolio/how-to-buy/',
    '/birth-chart/',
    '/fomo/',
    '/profile/',
    '/registry/collection/',
  ],
};

// Routes the audit named: if the map stops covering one, a narrowing that
// forgets it would no longer fail here.
const AUDIT_ROUTES = ['/fomo/', '/terminal/', '/astrofolio/', '/registry/technical/', '/thesis/'];

const CODE_FILE = /\.(astro|html|jsx?|mjs|tsx?)$/u;

function hostPattern(host) {
  const escaped = host.replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&');
  return new RegExp(`${escaped}(?![\\w.-])`, 'u');
}

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await walk(path, out);
    else if (CODE_FILE.test(entry.name) && !/\.test\./u.test(entry.name)) out.push(path);
  }
  return out;
}

const text = new Map();
async function read(file) {
  if (!text.has(file)) text.set(file, await readFile(resolve(ROOT, file), 'utf8'));
  return text.get(file);
}

// The file as production serves it: /terminal/markets/ gets its venue route
// stamped in at build time.
async function served(file) {
  const html = await read(file);
  if (file !== 'public/terminal/markets/index.html') return html;
  const { output, enabled } = injectRegistryExchange(html, registryExchangeBuildEnv({ VERCEL_ENV: 'production' }));
  expect(enabled, 'production builds stamp the Terminal venue route').toBe(true);
  return output;
}

function routeOf(file) {
  const page = file.match(/^public\/(.+\/)?index\.html$/u) ?? file.match(/^src\/pages\/(.+\/)?index\.astro$/u);
  return page ? `/${page[1] ?? ''}` : null;
}

async function noRealtimeChannel() {
  const offenders = [];
  for (const path of await walk(resolve(ROOT, 'src'))) {
    if (/\.channel\(|\.realtime\b/u.test(await readFile(path, 'utf8'))) offenders.push(relative(ROOT, path));
  }
  return offenders;
}

function parsePolicy(value) {
  const directives = new Map();
  for (const part of value.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/u).filter(Boolean);
    if (name) directives.set(name, sources);
  }
  return directives;
}

async function cspRules() {
  const config = JSON.parse(await read('vercel.json'));
  return config.headers
    .map(({ source, headers }) => ({
      source,
      csp: headers.find((header) => header.key === 'Content-Security-Policy')?.value,
    }))
    .filter(({ csp }) => csp)
    .map(({ source, csp }) => {
      // Only the `(.*)` wildcard is in use; anything else needs a real matcher.
      expect(source.replace(/\(\.\*\)/gu, ''), `${source} uses only (.*)`).toMatch(/^[\w/.-]+$/u);
      const pattern = source.split('(.*)').map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('.*');
      return { source, matches: new RegExp(`^${pattern}$`, 'u'), policy: parsePolicy(csp) };
    });
}

// Whether a policy lets the route use host under directive, following the
// CSP fallback to default-src (and to no restriction at all).
function allows(policy, directive, host) {
  const sources = policy.get(directive) ?? policy.get('default-src');
  if (!sources) return true;
  return sources.includes(host) || sources.includes('*');
}

let traced;
function tracedRoutes() {
  traced ??= traceRoutes();
  return traced;
}

// host -> sorted routes, worked out from the files.
async function traceRoutes() {
  const files = [
    ...(await walk(resolve(ROOT, 'src'))),
    ...(await walk(resolve(ROOT, 'public'))),
  ].map((path) => relative(ROOT, path));

  const carriers = new Map(LITERAL_HOSTS.map((host) => [host, []]));
  for (const file of files) {
    const body = await readFile(resolve(ROOT, file), 'utf8');
    for (const host of LITERAL_HOSTS) if (hostPattern(host).test(body)) carriers.get(host).push(file);
  }

  const unmapped = [];
  const routes = new Map();
  async function reach(file, host, seen = new Set()) {
    if (seen.has(file)) return [];
    seen.add(file);
    const route = routeOf(file);
    if (route) return [route];
    const loaders = LOADED_BY[file];
    if (!loaders) {
      unmapped.push(`${file} (${host})`);
      return [];
    }
    const found = [];
    for (const loader of loaders) {
      const reference = `/${file.replace(/^public\//u, '')}`;
      expect((await served(loader)).includes(reference), `${loader} loads ${reference}`).toBe(true);
      found.push(...(await reach(loader, host, seen)));
    }
    return found;
  }

  for (const [host, files] of carriers) {
    const found = new Set();
    for (const file of files) {
      if (file.startsWith('src/') && !routeOf(file)) {
        const bundles = BUNDLED_INTO[file];
        if (!bundles) {
          unmapped.push(`${file} (${host})`);
          continue;
        }
        for (const bundle of bundles) {
          expect(hostPattern(host).test(await read(bundle)), `${bundle} carries ${host} from ${file}`).toBe(true);
        }
        continue;
      }
      for (const route of await reach(file, host)) found.add(route);
    }
    routes.set(host, [...found].sort());
  }

  for (const [host, { env, pages }] of Object.entries(CONFIGURED_HOSTS)) {
    expect(await read('src/layouts/Base.astro'), `Base.astro reads ${env}`).toContain(env);
    for (const page of pages) expect(await read(page), `${page} renders the Base layout`).toMatch(/<Base\b/u);
    routes.set(host, pages.map(routeOf).sort());
  }

  return { routes, unmapped };
}

describe('connect-src hosts map to the routes that need them', () => {
  it('traces every first-party fetch host to a page', async () => {
    const { routes, unmapped } = await tracedRoutes();
    expect(unmapped, 'files naming a host that no page loads; add them to LOADED_BY or BUNDLED_INTO').toEqual([]);
    const expected = Object.fromEntries(Object.entries(EXPECTED_ROUTES).map(([host, list]) => [host, [...list].sort()]));
    expect(Object.fromEntries(routes)).toEqual(expected);
  });

  it('still covers the routes the audit found outside the two Terminal pages', async () => {
    const { routes } = await tracedRoutes();
    const marketRoutes = new Set(
      ['https://api.dexscreener.com', 'https://api.geckoterminal.com', 'https://wikimedia.org'].flatMap((host) => routes.get(host)),
    );
    for (const route of AUDIT_ROUTES) expect(marketRoutes.has(route), route).toBe(true);
    for (const sign of signRoutes) expect(routes.get('https://api.dexscreener.com'), sign).toContain(sign);
  });

  it('keeps each host in every policy that covers a route needing it', async () => {
    const [{ routes }, rules] = await Promise.all([tracedRoutes(), cspRules()]);
    const blocked = [];
    for (const [host, list] of routes) {
      const directives = CONFIGURED_HOSTS[host]?.directives ?? ['connect-src'];
      for (const route of list) {
        const covering = rules.filter(({ matches }) => matches.test(route));
        expect(covering.length, `${route} is covered by a CSP`).toBeGreaterThan(0);
        for (const { source, policy } of covering) {
          for (const directive of directives) {
            if (!allows(policy, directive, host)) blocked.push(`${route}: ${source} ${directive} drops ${host}`);
          }
        }
      }
    }
    expect(blocked).toEqual([]);
  });

  it('gives every host the global connect-src allows a route, or a listed reason', async () => {
    const [{ routes }, rules] = await Promise.all([tracedRoutes(), cspRules()]);
    const global = rules.filter(({ source }) => source === '/(.*)');
    expect(global).toHaveLength(1);
    const external = global[0].policy.get('connect-src').filter((value) => /^(https|wss):\/\//u.test(value));
    const withoutRoute = external.filter((host) => !(routes.get(host)?.length > 0));
    expect(withoutRoute.sort()).toEqual(Object.keys(ALLOWED_WITHOUT_ROUTE).sort());
    for (const [host, stillUnused] of Object.entries(ALLOWED_WITHOUT_ROUTE)) {
      expect(await stillUnused(), `${host} now has a user; map its routes`).toEqual([]);
    }
  });
});
