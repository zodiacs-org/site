/**
 * Audit finding F-18 on the profile: the sign pictures beside saved charts
 * (Sun, Moon and rising) and beside compatibility invitations must not show in
 * the requests the page makes, or they give our host the signs of everyone a
 * visitor keeps. The islands draw them through signIcon (lib/sign-icon.ts),
 * which asks for all twelve pictures of a size in zodiac order first; the
 * pictures shown then come from the twelve the page holds. Two browsers
 * holding different people, with no sign in common, must make the same
 * requests on /profile/ and on each translated profile: the same addresses,
 * and the same sign pictures in the same order.
 *
 * Nothing here intercepts requests: Playwright's interception turns the
 * browser cache off, so every picture shown would be fetched again by name,
 * which a visitor's browser does not do. Instead, a front server answers the
 * site's own functions (/api/) and passes everything else to the preview, the
 * account service is a loopback stand-in on its configured port, and the
 * browser resolves no other host, so nothing leaves the machine.
 *
 * The invitations panel needs the production flags (invites on, and the
 * loopback account service to sign in to); with them the English page is also
 * checked with two invitations each.
 *
 *   npm run build && node tests/profile-sign-icon-requests-drive.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const TIMEOUT = 45_000;
const SIGN_ORDER = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const ICON = /^\/assets\/zodiac-icons\/(\d+)\/([a-z]+)\.(webp|avif)(\?[^#]*)?$/u;
const SIGN_IN_PATH = new RegExp(`(?:^|/)(?:${SIGN_ORDER.join('|')})(?![a-z])`, 'u');
const PAGES = ['/profile/', '/es/profile/', '/pt/profile/', '/fr/profile/', '/it/profile/', '/ru/profile/'];
const serviceURL = process.env.PUBLIC_SUPABASE_URL ? new URL(process.env.PUBLIC_SUPABASE_URL) : null;
const loopbackService = serviceURL?.hostname === '127.0.0.1';
const signedIn = process.env.PUBLIC_COMPAT_INVITES_ENABLED === '1' && loopbackService;

/** A saved chart whose Sun, Moon and rising fall 15° into the given signs. */
function chart(id, name, relationship, [sun, moon, rising]) {
  const lon = (slug) => SIGN_ORDER.indexOf(slug) * 30 + 15;
  return {
    id, name, relationship,
    createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z',
    birth: { date: '1990-01-01', time: '12:00', timeKnown: true, place: { name: 'London', admin1: '', country: 'GB', lat: 51.5, lon: 0, tz: 'Europe/London' } },
    summary: {
      engineVersion: '0.1.0', utcISO: '1990-01-01T12:00:00Z', houseSystem: 'whole',
      bodies: [{ body: 'Sun', lon: lon(sun), retrograde: false }, { body: 'Moon', lon: lon(moon), retrograde: false }],
      angles: { asc: lon(rising), mc: lon(sun) }, flags: [],
    },
  };
}

/** One invitation row as the invitations endpoint lists it. */
function invite(id, label, sunSign) {
  return {
    id, label, sunSign, state: 'waiting',
    createdAt: '2026-10-16T10:00:00.000Z', expiresAt: '2099-10-30T10:00:00.000Z',
    openedAt: null, closedAt: null, hiddenAt: null,
  };
}

// Twelve signs, six to each visitor: nothing one shows, the other shows too.
const VISITORS = [
  {
    name: 'first',
    charts: [
      chart('11111111-1111-4111-8111-111111111111', 'Ada', 'self', ['aries', 'taurus', 'gemini']),
      chart('11111111-1111-4111-8111-111111111112', 'Ben', 'other', ['cancer', 'leo', 'virgo']),
    ],
    invites: [
      invite('9e4c5f6a-7b8c-4d9e-8f0a-2b3c4d5e6f7a', 'Cal', 'gemini'),
      invite('9e4c5f6a-7b8c-4d9e-8f0a-2b3c4d5e6f7b', 'Dee', 'virgo'),
    ],
  },
  {
    name: 'second',
    charts: [
      chart('22222222-2222-4222-8222-222222222221', 'Eva', 'self', ['libra', 'scorpio', 'sagittarius']),
      chart('22222222-2222-4222-8222-222222222222', 'Finn', 'other', ['capricorn', 'aquarius', 'pisces']),
    ],
    invites: [
      invite('a05d6a7b-8c9d-4e0f-9a1b-3c4d5e6f7a8b', 'Gus', 'sagittarius'),
      invite('a05d6a7b-8c9d-4e0f-9a1b-3c4d5e6f7a8c', 'Hal', 'pisces'),
    ],
  },
];

const user = {
  id: '33333333-3333-4333-8333-333333333333', aud: 'authenticated', role: 'authenticated',
  email: 'profile-icons-fixture@example.invalid', app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {}, created_at: '2026-10-01T12:00:00Z',
};
const jwt = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 7200 })).toString('base64url'),
  'fixture',
].join('.');
const session = {
  access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 7200,
  expires_at: Math.floor(Date.now() / 1000) + 7200, user,
};
const authStorageKey = serviceURL ? `sb-${serviceURL.hostname.split('.')[0]}-auth-token` : '';

/** The visitor whose page is open; the stand-ins answer for them. */
let current = VISITORS[0];
let currentRoute = '/profile/';

function listen(server, port = 0) {
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, '127.0.0.1', () => resolveListen(server));
  });
}

function sendJSON(response, json, headers = {}) {
  response.writeHead(200, { ...headers, 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(json));
}

/** The account service on its configured loopback port: a session, and the visitor's charts. */
function accountService() {
  return createServer((request, response) => {
    const url = new URL(request.url, serviceURL);
    const headers = {
      'access-control-allow-origin': request.headers.origin ?? '*',
      'access-control-allow-methods': 'GET,POST,DELETE,PATCH,OPTIONS',
      'access-control-allow-headers': request.headers['access-control-request-headers'] ?? '*',
      'access-control-allow-credentials': 'true',
    };
    if (request.method === 'OPTIONS') { response.writeHead(204, headers); response.end(); return; }
    request.resume();
    if (url.pathname === '/auth/v1/user') return sendJSON(response, user, headers);
    if (url.pathname === '/auth/v1/token') return sendJSON(response, session, headers);
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop();
      if (request.method !== 'GET') return sendJSON(response, null, headers);
      if (table === 'charts') return sendJSON(response, current.charts.map((saved) => ({ id: saved.id, payload: saved, updated_at: saved.updatedAt })), headers);
      if (table === 'profiles') return sendJSON(response, { settings: { houseSystem: 'whole' } }, headers);
      return sendJSON(response, [], headers);
    }
    return sendJSON(response, {}, headers);
  });
}

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length']);

/** The site's own functions do not run under preview; this answers them and passes the rest through. */
function frontServer(previewURL) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, previewURL);
    if (url.pathname.startsWith('/api/')) {
      request.resume();
      if (url.pathname === '/api/compatibility/invites') {
        return sendJSON(response, { invites: signedIn && currentRoute === '/profile/' ? current.invites : [] });
      }
      if (url.pathname === '/api/email/chart-preference') return sendJSON(response, { enabled: false, chartId: null });
      return sendJSON(response, {});
    }
    try {
      const upstream = await fetch(url, {
        method: request.method,
        headers: Object.fromEntries(Object.entries(request.headers).filter(([name]) => name !== 'host' && !HOP_BY_HOP.has(name))),
        redirect: 'manual',
      });
      const headers = {};
      upstream.headers.forEach((value, name) => { if (!HOP_BY_HOP.has(name)) headers[name] = value; });
      response.writeHead(upstream.status, headers);
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      response.writeHead(502, { 'content-type': 'text/plain' });
      response.end(String(error));
    }
  });
}

/** Resolves once the page has made no request for `settle` ms. */
async function quiet(requests, settle = 2_000, limit = 30_000) {
  const deadline = Date.now() + limit;
  let seen = -1;
  while (Date.now() < deadline) {
    if (requests.length === seen) return;
    seen = requests.length;
    await new Promise((resolveWait) => setTimeout(resolveWait, settle));
  }
  throw new Error(`requests did not settle within ${limit} ms`);
}

async function visit(browser, baseURL, route, visitor) {
  current = visitor;
  currentRoute = route;
  const origin = new URL(baseURL).origin;
  const withInvites = signedIn && route === '/profile/';
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const requests = [];
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    requests.push(url.origin === origin ? `${url.pathname}${url.search}` : url.href);
  });
  await context.addInitScript(({ charts, signedIn, session, authStorageKey }) => {
    if (sessionStorage.getItem('profile-icons-seeded')) return;
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify({ version: 1, settings: { houseSystem: 'whole' }, charts }));
    localStorage.setItem('zodiacs.me.v1', JSON.stringify({ version: 1, displayName: charts[0].name, keepCloseDismissed: true }));
    if (signedIn) localStorage.setItem(authStorageKey, JSON.stringify(session));
    sessionStorage.setItem('profile-icons-seeded', '1');
  }, { charts: visitor.charts, signedIn, session, authStorageKey });

  try {
    const page = await context.newPage();
    const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200, `${route} must return 200`);
    const chips = page.locator('.pf-chart__three a.pf-chip');
    await page.waitForFunction(
      (count) => document.querySelectorAll('.pf-chart__three a.pf-chip').length >= count,
      visitor.charts.length * 3,
      { timeout: TIMEOUT },
    );
    if (withInvites) await page.locator('.pf-invites__disc img').nth(visitor.invites.length - 1).waitFor({ state: 'attached', timeout: TIMEOUT });
    await quiet(requests);

    // Bring the whole page into view, so every lazy picture loads.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((resolveStep) => setTimeout(resolveStep, 60));
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await quiet(requests);

    const chipSigns = await chips.evaluateAll((links) => links.map((link) => link.getAttribute('href').split('/').filter(Boolean).pop()));
    const chipPictures = await page.locator('.pf-chart__three a.pf-chip img').evaluateAll((images) => images.map((image) => image.complete && image.naturalWidth > 0));
    const discSigns = withInvites
      ? await page.locator('.pf-invites__disc img').evaluateAll((images) => images.map((image) => /\/([a-z]+)\.webp$/u.exec(image.getAttribute('src'))?.[1]))
      : [];
    return { requests, chipSigns, chipPictures, discSigns, withInvites };
  } finally {
    await context.close();
  }
}

/** For each size, format (and query), the order in which its pictures were first asked for. */
function firstRequestOrder(icons) {
  const orders = new Map();
  for (const path of icons) {
    const [, size, slug, format, query = ''] = ICON.exec(path);
    const key = `${size}/*.${format}${query}`;
    const order = orders.get(key) ?? [];
    if (!order.includes(slug)) order.push(slug);
    orders.set(key, order);
  }
  return orders;
}

const servers = [];
if (loopbackService) servers.push(await listen(accountService(), Number(serviceURL.port)));
const browser = await chromium.launch({
  executablePath: await findChromium(),
  headless: true,
  // Every host but the loopback fails to resolve: no analytics, no live service.
  args: [...STABLE_CHROMIUM_ARGS, '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
});

try {
  await withPreview({ port: Number(process.env.PROFILE_SIGN_ICON_PORT ?? 4337) }, async (previewURL) => {
    const front = await listen(frontServer(previewURL));
    servers.push(front);
    const baseURL = `http://127.0.0.1:${front.address().port}`;
    const icons = (requests) => requests.filter((path) => path.startsWith('/assets/zodiac-icons/'));
    const addresses = (requests) => [...new Set(requests)].sort();
    for (const route of PAGES) {
      const runs = [];
      for (const visitor of VISITORS) {
        const run = await visit(browser, baseURL, route, visitor);
        const shown = visitor.charts.flatMap(({ summary }) => [
          summary.bodies[0].lon, summary.bodies[1].lon, summary.angles.asc,
        ].map((lon) => SIGN_ORDER[Math.floor(lon / 30)]));
        assert.deepEqual(run.chipSigns, shown, `${route} (${visitor.name}): each saved chart must show its own Sun, Moon and rising`);
        assert.ok(run.chipPictures.every(Boolean), `${route} (${visitor.name}): every chip's sign picture must be drawn`);
        if (run.withInvites) {
          assert.deepEqual(run.discSigns, visitor.invites.map(({ sunSign }) => sunSign),
            `${route} (${visitor.name}): each invitation must show its own sign`);
        }
        runs.push(run);
      }
      const [first, second] = runs;

      const firstIcons = icons(first.requests);
      assert.ok(firstIcons.length >= 12, `${route}: the page must show sign pictures`);
      for (const path of firstIcons) assert.match(path, ICON, `${route}: unexpected sign picture address ${path}`);
      // Every set of sign pictures, whatever shows it, is asked for whole.
      for (const [key, order] of firstRequestOrder(firstIcons)) {
        assert.deepEqual(order, SIGN_ORDER, `${route}: sign pictures ${key} must be asked for as all twelve, in zodiac order`);
      }
      assert.deepEqual(icons(second.requests), firstIcons,
        `${route}: two different visitors must ask for the same sign pictures in the same order`);

      // Nothing else may name a sign either: no sign page, card or data file.
      const named = addresses([...first.requests, ...second.requests])
        .filter((path) => !ICON.test(path) && SIGN_IN_PATH.test(new URL(path, baseURL).pathname));
      assert.deepEqual(named, [], `${route}: no other request may name a sign`);

      const onlyFirst = addresses(first.requests).filter((path) => !second.requests.includes(path));
      const onlySecond = addresses(second.requests).filter((path) => !first.requests.includes(path));
      assert.deepEqual({ onlyFirst, onlySecond }, { onlyFirst: [], onlySecond: [] },
        `${route}: two different visitors must make requests to the same set of addresses`);

      console.log(`profile-sign-icon-requests: ${route} PASS, ${VISITORS.length} visitors with no sign in common, `
        + `${first.chipSigns.length} chart chips${first.withInvites ? ` and ${first.discSigns.length} invitation discs` : ''} each, `
        + `${addresses(first.requests).length} addresses each, ${firstIcons.length} sign-picture requests in the same order `
        + `(${[...firstRequestOrder(firstIcons).keys()].join(', ')})`);
    }
  });
} finally {
  await browser.close();
  await Promise.all(servers.map((server) => new Promise((resolveClose) => {
    server.close(resolveClose);
    server.closeAllConnections();
  })));
}
