/**
 * Audit finding F-18 on the profile: the sign pictures beside saved charts
 * (Sun, Moon and rising) and beside compatibility invitations must not show in
 * the requests the page makes, or they give our host the signs of everyone a
 * visitor keeps. The islands draw them through signIcon (lib/sign-icon.ts),
 * which asks for all twelve pictures of a size in zodiac order first. Two
 * browsers holding different people, with no sign in common, must make the
 * same requests on /profile/ and on each translated profile: the same
 * addresses, and the same sign pictures in the same order.
 *
 * The invitations panel needs the production flags (invites on, and an
 * account service to sign in to); with PUBLIC_COMPAT_INVITES_ENABLED=1 the
 * English page is also checked with two invitations each. The account service
 * is the loopback stand-in, answered here; nothing leaves the machine.
 *
 *   npm run build && node tests/profile-sign-icon-requests-drive.mjs
 */
import assert from 'node:assert/strict';
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
const invitesEnabled = process.env.PUBLIC_COMPAT_INVITES_ENABLED === '1';
const serviceURL = process.env.PUBLIC_SUPABASE_URL ?? '';
const signedIn = invitesEnabled && Boolean(serviceURL);

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
const authStorageKey = serviceURL ? `sb-${new URL(serviceURL).hostname.split('.')[0]}-auth-token` : '';

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
  if (serviceURL) {
    await context.route(`${serviceURL}/**`, (request) => {
      const url = new URL(request.request().url());
      const method = request.request().method();
      const headers = {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET,POST,DELETE,PATCH,OPTIONS',
        'access-control-allow-headers': 'apikey,authorization,content-type,x-client-info,prefer,accept-profile,content-profile',
        'access-control-allow-credentials': 'true',
      };
      const reply = (json) => request.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(json) });
      if (method === 'OPTIONS') return request.fulfill({ status: 204, headers });
      if (url.pathname === '/auth/v1/user') return reply(user);
      if (url.pathname === '/auth/v1/token') return reply(session);
      if (url.pathname.startsWith('/rest/v1/')) {
        const table = url.pathname.split('/').pop();
        if (method !== 'GET') return reply(null);
        if (table === 'charts') return reply(visitor.charts.map((saved) => ({ id: saved.id, payload: saved, updated_at: saved.updatedAt })));
        if (table === 'profiles') return reply({ settings: { houseSystem: 'whole' } });
        return reply([]);
      }
      return reply({});
    });
  }
  // The site's own functions do not run under preview. Playwright tries the
  // most recently added route first, so the catch-all goes first.
  await context.route('**/api/**', (request) => request.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await context.route('**/api/email/chart-preference', (request) => request.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: false, chartId: null }),
  }));
  await context.route('**/api/compatibility/invites', (request) => request.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ invites: withInvites ? visitor.invites : [] }),
  }));
  await context.route(/plausible\.io|vercel-insights|va\.vercel/u, (request) => request.abort());

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

const browser = await chromium.launch({
  executablePath: await findChromium(),
  headless: true,
  args: STABLE_CHROMIUM_ARGS,
});

try {
  await withPreview({ port: Number(process.env.PROFILE_SIGN_ICON_PORT ?? 4337) }, async (baseURL) => {
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
}
