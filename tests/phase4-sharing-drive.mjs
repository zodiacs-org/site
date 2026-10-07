/**
 * Phase 4 private-sharing browser acceptance.
 *
 * This driver runs in two modes against an already-built Astro preview:
 *
 *   PHASE4_SHARING_MODE=off     node tests/phase4-sharing-drive.mjs
 *   PHASE4_SHARING_MODE=enabled node tests/phase4-sharing-drive.mjs
 *
 * The enabled fixture intercepts the fake Supabase origin and every
 * compatibility-invitation endpoint. It never contacts a real project,
 * account, recipient, or provider.
 */
import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  findChromium,
  isSiteFooterIconTeardownAbort,
  STABLE_CHROMIUM_ARGS,
} from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
import {
  COMPARISON_READY_TIMEOUT_MS,
  featureOffComparisonState,
  waitForFeatureOffComparison,
} from './phase4-sharing-readiness.mjs';

const MODE = process.env.PHASE4_SHARING_MODE === 'enabled' ? 'enabled' : 'off';
const PROFILE_KEY = 'zodiacs.profile.v1';
const AUTH_KEY = 'sb-phase4-test-auth-token';
const USER_ID = '410e8400-e29b-41d4-a716-446655440000';
const CHART_ID = '420e8400-e29b-41d4-a716-446655440000';
const INVITE_ID = '430e8400-e29b-41d4-a716-446655440000';
const INVITE_SECRET = 'A'.repeat(43);
const SESSION_HANDLE = 'B'.repeat(22);
const ENGINE_VERSION = '0.1.0';
const BODY_NAMES = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter',
  'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node',
];
const FIRST_LONGITUDES = [
  103.91, 210.2, 72.4, 100.1, 12.3, 105.8,
  294.4, 278.2, 282.7, 225.9, 307.1, 127.1,
];
const SECOND_LONGITUDES = [
  256.1, 340.2, 265.4, 277.1, 300.3, 188.8,
  112.4, 280.2, 284.7, 228.9, 129.1, 309.1,
];
const EXPIRES_AT = '2099-08-07T00:00:00.000Z';
const results = [];
const browserErrors = [];
const unexpectedRequests = [];
const readinessEvidence = [];
let observedBrowser = null;

const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
};

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

const accessToken = [
  base64url({ alg: 'HS256', typ: 'JWT' }),
  base64url({ aud: 'authenticated', exp: 4102444800, sub: USER_ID }),
  'phase4-test-signature',
].join('.');

const session = {
  access_token: accessToken,
  refresh_token: 'phase4-test-refresh',
  expires_at: 4102444800,
  expires_in: 2147483647,
  token_type: 'bearer',
  user: {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'fixture@example.com',
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: '2026-07-24T00:00:00.000Z',
  },
};

const positions = (longitudes, angles) => ({
  bodies: BODY_NAMES.map((body, index) => ({ body, lon: longitudes[index] })),
  angles,
  houseSystem: 'whole',
  engineVersion: ENGINE_VERSION,
});

const savedChart = {
  id: CHART_ID,
  name: 'Fixture chart',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-24T00:00:00.000Z',
  birth: {
    date: '1990-06-15',
    time: '08:30',
    timeKnown: true,
    place: {
      name: 'New York',
      admin1: 'New York',
      country: 'US',
      lat: 40.7128,
      lon: -74.006,
      tz: 'America/New_York',
    },
  },
  summary: {
    engineVersion: ENGINE_VERSION,
    utcISO: '1990-06-15T12:30:00.000Z',
    houseSystem: 'whole',
    bodies: BODY_NAMES.map((body, index) => ({
      body,
      lon: SECOND_LONGITUDES[index],
      retrograde: false,
    })),
    angles: { asc: 166, mc: 74 },
    flags: [],
  },
};

const profile = {
  version: 1,
  settings: { houseSystem: 'whole' },
  charts: [savedChart],
};

const invitePayload = {
  version: 1,
  label: 'Frida',
  sunSign: 'cancer',
  positions: positions(FIRST_LONGITUDES, { asc: 143.2, mc: 58.4 }),
  timeKnown: true,
  expiresAt: EXPIRES_AT,
};

function positionsToken(longitudes, angles) {
  const wire = {
    b: longitudes,
    ...(angles ? { a: [angles.asc, angles.mc] } : {}),
    h: 'w',
    v: ENGINE_VERSION,
  };
  return `2.${base64url(wire)}`;
}

function returnedToken() {
  return `s1.${base64url({
    p: [
      positionsToken(FIRST_LONGITUDES, { asc: 143.2, mc: 58.4 }),
      positionsToken(SECOND_LONGITUDES, { asc: 166, mc: 74 }),
    ],
    l: ['Frida', 'Diego'],
    k: [true, true],
  })}`;
}

const birthChartFragment = `#c=1.${base64url({
  d: '1990-06-15',
  t: '08:30',
  z: 'America/New_York',
  la: 40.7128,
  lo: -74.006,
  n: 'Fixture chart',
  p: 'New York',
})}`;

function watchPage(page, label) {
  page.on('pageerror', (error) => browserErrors.push(`${label}: pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`${label}: console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'failed';
    const teardownIconAbort = isSiteFooterIconTeardownAbort(request) || (label === 'chart-share'
      && request.method() === 'GET'
      && request.resourceType() === 'image'
      && /^https?:\/\/[^/]+\/assets\/zodiac-icons\/128\/[a-z-]+\.webp$/u.test(request.url())
      && failure === 'net::ERR_ABORTED');
    if (teardownIconAbort) return;
    browserErrors.push(
      `${label}: requestfailed: ${request.method()} ${request.url()} — ${failure}`,
    );
  });
}

async function installFixtureRoutes(context, options = {}) {
  await context.route('https://phase4-test.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    let body;
    if (url.pathname === '/auth/v1/user' && method === 'GET') {
      body = session.user;
    } else if (url.pathname === '/rest/v1/charts' && method === 'GET') {
      body = (url.searchParams.get('select') ?? '') === 'id'
        ? [{ id: CHART_ID }]
        : [{ id: CHART_ID, payload: savedChart, updated_at: savedChart.updatedAt }];
    } else if (url.pathname === '/rest/v1/profiles' && method === 'GET') {
      body = [];
    } else if (url.pathname === '/rest/v1/chart_deletions' && method === 'GET') {
      body = [];
    } else if (url.pathname.startsWith('/rest/v1/')
      && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      body = {};
    } else {
      unexpectedRequests.push(`${method} ${url.pathname}${url.search}`);
      await route.fulfill({
        status: 418,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unexpected_fixture_request' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Content-Range': Array.isArray(body)
          ? body.length > 0 ? `0-${body.length - 1}/${body.length}` : '*/0'
          : '0-0/1',
      },
      body: JSON.stringify(body),
    });
  });

  await context.route('**/api/compatibility/invites', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      unexpectedRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
      await route.fulfill({ status: 405, body: '' });
      return;
    }
    options.onCreate?.({
      body: request.postDataJSON(),
      authorization: request.headers().authorization ?? '',
    });
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: INVITE_ID,
        url: `https://zodiacs.org/c/${INVITE_SECRET}/`,
        expiresAt: EXPIRES_AT,
      }),
    });
  });

  await context.route('**/api/compatibility/invite-session**', async (route) => {
    options.onSession?.(route.request());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(options.sessionPayload ?? { state: 'unavailable' }),
    });
  });

  await context.route('**/api/compatibility/invite-complete**', async (route) => {
    options.onComplete?.({
      body: route.request().postData() ?? '',
      url: route.request().url(),
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ outcome: 'completed' }),
    });
  });
}

async function seededContext(browser, {
  signedIn = false,
  reducedMotion = 'reduce',
  routes = {},
} = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion,
    serviceWorkers: 'block',
  });
  await context.addInitScript((fixture) => {
    if (sessionStorage.getItem('zodiacs.phase4.drive.initialized') !== '1') {
      localStorage.clear();
      localStorage.setItem(fixture.profileKey, JSON.stringify(fixture.profile));
      if (fixture.auth) localStorage.setItem(fixture.authKey, JSON.stringify(fixture.auth));
      sessionStorage.setItem('zodiacs.phase4.drive.initialized', '1');
    }
    globalThis.__phase4Clipboard = [];
    globalThis.__phase4Analytics = [];
    globalThis.__phase4TimeoutDelays = [];
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    globalThis.setTimeout = (callback, delay = 0, ...args) => {
      globalThis.__phase4TimeoutDelays.push(Number(delay));
      return nativeSetTimeout(callback, delay, ...args);
    };
    Object.defineProperty(Navigator.prototype, 'clipboard', {
      configurable: true,
      get() {
        return {
          writeText(value) {
            globalThis.__phase4Clipboard.push(String(value));
            return Promise.resolve();
          },
        };
      },
    });
    globalThis.zodiacsAnalytics = Object.freeze({
      track(name, props = {}) {
        globalThis.__phase4Analytics.push({ name, props });
      },
    });
  }, {
    profileKey: PROFILE_KEY,
    profile,
    authKey: AUTH_KEY,
    auth: signedIn ? session : null,
  });
  await installFixtureRoutes(context, routes);
  return context;
}

async function runFeatureOff(browser, baseURL) {
  const context = await seededContext(browser);
  const page = await context.newPage();
  watchPage(page, 'feature-off');
  const response = await page.goto(`${baseURL}/compatibility/#invite=${SESSION_HANDLE}`, {
    waitUntil: 'domcontentloaded',
  });
  const started = performance.now();
  const hydrated = await waitForFeatureOffComparison(page);
  readinessEvidence.push({
    case: 'ordinary feature-off',
    ready: hydrated,
    timeoutMs: COMPARISON_READY_TIMEOUT_MS,
    elapsedMs: performance.now() - started,
    state: await featureOffComparisonState(page),
  });
  check('feature-off required hydrated state arrives within the existing 30-second deadline', hydrated);

  check('feature-off compatibility route returns 200', response?.status() === 200, String(response?.status()));
  check('feature-off leaves the existing two-person calculator intact',
    await page.locator('#syn-a-source, #syn-b-source').count() === 2
      && await page.locator('.calc__submit').count() === 1);
  check('feature-off mounts no invitation or return-loop UI',
    await page.locator('.syn-invite, .syn-arrival, .syn-return, .syn-sendback, .syn-conversion').count() === 0);
  check('feature-off does not consume the reserved invitation fragment',
    await page.evaluate(() => window.location.hash) === `#invite=${SESSION_HANDLE}`);
  check('feature-off has no horizontal overflow',
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

  const profilePage = await context.newPage();
  watchPage(profilePage, 'feature-off-profile');
  await profilePage.goto(`${baseURL}/profile/`, { waitUntil: 'domcontentloaded' });
  await profilePage.locator('main').waitFor({ state: 'visible', timeout: 30_000 });
  await profilePage.waitForTimeout(250);
  check('feature-off profile exposes no invitation register without server rows',
    await profilePage.locator('#compat-invites').count() === 0);

  await context.close();
}

async function runCreation(browser, baseURL) {
  const creates = [];
  const context = await seededContext(browser, {
    signedIn: true,
    routes: {
      onCreate: (request) => creates.push(request),
    },
  });
  const page = await context.newPage();
  watchPage(page, 'create');
  await page.goto(`${baseURL}/compatibility/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#syn-a-source').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#syn-a-source').selectOption(CHART_ID);
  const panel = page.locator('.syn-invite');
  await panel.waitFor({ state: 'visible', timeout: 30_000 });

  const consent = panel.locator('.syn-invite__check input').nth(0);
  const notify = panel.locator('.syn-invite__check input').nth(1);
  const create = panel.getByRole('button', { name: 'Create the invitation link' });
  check('creation requires explicit positions-only consent', await create.isDisabled());
  await consent.check();
  await notify.check();
  check('consent unlocks creation for one chosen synced chart', !(await create.isDisabled()));
  await create.click();

  const link = panel.locator('#syn-invite-link');
  await link.waitFor({ state: 'visible', timeout: 30_000 });
  check('creation reveals the raw private URL exactly once in the ready state',
    await link.inputValue() === `https://zodiacs.org/c/${INVITE_SECRET}/`);
  check('creation sends only chart id, consent, and one-shot email choice',
    creates.length === 1
      && JSON.stringify(Object.keys(creates[0].body).sort()) === JSON.stringify(['chartId', 'consent', 'notify'])
      && creates[0].body.chartId === CHART_ID
      && creates[0].body.consent === true
      && creates[0].body.notify === true,
    JSON.stringify(creates));
  check('creation authenticates with the fixture account token',
    creates[0]?.authorization === `Bearer ${accessToken}`);
  check('creation request contains no birth input, positions, email, or token',
    !/(birth|date|time|place|lat|lon|positions|email|token)/iu.test(JSON.stringify(creates[0]?.body ?? {})));
  check('ready copy tells the truth about positions-only sharing',
    /label and chart positions\. No birth details\./i.test(await panel.textContent() ?? ''));

  await context.close();
}

async function runUnavailable(browser, baseURL) {
  const sessionRequests = [];
  const context = await seededContext(browser, {
    routes: {
      sessionPayload: { state: 'unavailable' },
      onSession: (request) => sessionRequests.push(request.url()),
    },
  });
  const page = await context.newPage();
  watchPage(page, 'unavailable');
  await page.goto(`${baseURL}/compatibility/#invite=${SESSION_HANDLE}`, { waitUntil: 'domcontentloaded' });
  const arrival = page.locator('.syn-arrival');
  await arrival.waitFor({ state: 'visible', timeout: 30_000 });
  check('unavailable invitation uses one generic terminal heading',
    (await arrival.locator('h2').textContent())?.trim() === "This invitation isn't available.");
  check('unavailable invitation does not disclose its actual server reason',
    !/(revoked by|expired at|completed at|owner|account|database)/iu.test(await arrival.textContent() ?? ''));
  check('invitation fragment is removed after the one-time exchange',
    await page.evaluate(() => window.location.hash) === '');
  check('generic failure offers retry and fetches only its own session handle',
    await arrival.getByRole('button', { name: 'Try again' }).count() === 1
      && sessionRequests.length === 1
      && new URL(sessionRequests[0]).searchParams.get('session') === SESSION_HANDLE,
    JSON.stringify(sessionRequests));
  await context.close();
}

async function runMalformedArrivals(browser, baseURL) {
  let sessionRequests = 0;
  const context = await seededContext(browser, {
    routes: {
      onSession: () => { sessionRequests += 1; },
    },
  });
  for (const [name, fragment] of [
    ['short handle', '#invite=short'],
    ['duplicate handles', `#invite=${SESSION_HANDLE}&invite=${'C'.repeat(22)}`],
  ]) {
    const page = await context.newPage();
    watchPage(page, `malformed-${name}`);
    await page.goto(`${baseURL}/compatibility/${fragment}`, { waitUntil: 'domcontentloaded' });
    const arrival = page.locator('.syn-arrival');
    await arrival.waitFor({ state: 'visible', timeout: 30_000 });
    check(`${name} gets the same generic unavailable state`,
      (await arrival.locator('h2').textContent())?.trim() === "This invitation isn't available.");
    check(`${name} is consumed without exposing the fragment`,
      await page.evaluate(() => window.location.hash) === '');
    await page.close();
  }
  check('malformed or ambiguous handles never reach the session endpoint',
    sessionRequests === 0, String(sessionRequests));
  await context.close();
}

async function runInvitationAndReturn(browser, baseURL) {
  const completionBodies = [];
  const context = await seededContext(browser, {
    signedIn: true,
    reducedMotion: 'reduce',
    routes: {
      sessionPayload: { state: 'ready', payload: invitePayload },
      onComplete: (request) => completionBodies.push(request),
    },
  });
  const page = await context.newPage();
  watchPage(page, 'invitation');
  await page.goto(`${baseURL}/compatibility/#invite=${SESSION_HANDLE}`, { waitUntil: 'domcontentloaded' });
  // The arrival mounts as an aria-busy "Opening the invitation…" shell while
  // the session exchange is in flight; read its copy only once it settles.
  const arrival = page.locator('.syn-arrival:not([aria-busy="true"])');
  await arrival.waitFor({ state: 'visible', timeout: 30_000 });
  check('ready arrival names the inviter and positions-only boundary',
    /Frida wants to read your charts together/.test(await arrival.textContent() ?? '')
      && /chart positions, with no birth details/.test(await arrival.textContent() ?? ''));

  await page.locator('#syn-b-source').selectOption(CHART_ID);
  await page.evaluate(() => { globalThis.__phase4TimeoutDelays = []; });
  await page.locator('.calc__submit').click();
  const settled = page.locator('.syn-meet.is-settled');
  await settled.waitFor({ state: 'visible', timeout: 30_000 });
  check('reduced motion skips the 1.4-second meeting animation',
    await page.evaluate(() => !globalThis.__phase4TimeoutDelays.includes(1_400)),
    JSON.stringify(await page.evaluate(() => globalThis.__phase4TimeoutDelays)));
  check('completed invitation shows the send-back action before conversion',
    await settled.locator('.syn-sendback').count() === 1
      && await settled.locator('.syn-conversion').count() === 1
      && await settled.locator('.syn-sendback').evaluate((node) => (
        Boolean(node.compareDocumentPosition(document.querySelector('.syn-conversion')) & Node.DOCUMENT_POSITION_FOLLOWING)
      )));
  for (const width of [360, 390, 781, 1280]) {
    await page.setViewportSize({ width, height: width < 720 ? 844 : 900 });
    const geometry = await page.evaluate(() => {
      const core = document.querySelector('.syn-conversion .next-action__core');
      const copy = document.querySelector('.syn-conversion .next-action__copy');
      const actions = document.querySelector('.syn-conversion .next-action__actions');
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        coreWidth: core?.getBoundingClientRect().width ?? 0,
        copyWidth: copy?.getBoundingClientRect().width ?? 0,
        actionsWidth: actions?.getBoundingClientRect().width ?? 0,
      };
    });
    check(`completed invitation has no horizontal overflow at ${width}px`,
      geometry.scrollWidth === geometry.clientWidth,
      JSON.stringify(geometry));
    check(`completed invitation keeps the conversion copy full-width at ${width}px`,
      geometry.coreWidth > 0
        && geometry.copyWidth >= geometry.coreWidth * 0.75
        && geometry.actionsWidth >= geometry.coreWidth * 0.75,
      JSON.stringify(geometry));
  }
  const invitationBigThree = settled.locator('[data-share-card-action="big-three"]');
  await invitationBigThree.waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => {
    const action = document.querySelector('.syn-sendback [data-share-card-action="big-three"]');
    return action instanceof HTMLButtonElement && !action.disabled;
  }, null, { timeout: 30_000 });
  check('completed invitation exposes B’s prepared Big Three card when B has angles',
    await invitationBigThree.count() === 1);
  await page.waitForFunction(() => globalThis.__phase4Clipboard.length === 0
    && document.querySelector('.syn-sendback button'));
  await settled.locator('.syn-sendback').getByRole('button', {
    name: 'Copy the private link',
  }).click();
  await page.waitForFunction(() => globalThis.__phase4Clipboard.length === 1);
  const returnedURL = await page.evaluate(() => globalThis.__phase4Clipboard[0]);
  const returned = new URL(returnedURL);
  const returnedParams = new URLSearchParams(returned.hash.slice(1));
  check('send-back produces one client-only #s positions link',
    returned.origin === baseURL
      && returned.pathname === '/compatibility/'
      && returnedParams.getAll('s').length === 1
      && returnedParams.get('s')?.startsWith('s1.'));
  check('send-back URL contains no birth data or account identifiers',
    !/(1990|new.?york|america|fixture@example|410e8400|420e8400|birth|date|time|place|lat|lon)/iu.test(returnedURL),
    returnedURL);
  await page.waitForFunction(() => globalThis.__phase4Analytics.some((event) => event.name === 'invite_completed'));
  check('completion endpoint receives only the empty object',
    completionBodies.length === 1
      && completionBodies[0].body === '{}'
      && new URL(completionBodies[0].url).searchParams.get('session') === SESSION_HANDLE,
    JSON.stringify(completionBodies));

  await settled.locator('.syn-conversion').getByRole('button', {
    name: 'Keep the whole comparison',
  }).click();
  const storedInvitePair = await page.evaluate(() => (
    JSON.parse(localStorage.getItem('zodiacs.pairs.v1') ?? '[]')
  ));
  check('keeping the comparison stores two canonical positions-only sides',
    storedInvitePair.length === 1
      && storedInvitePair[0].a.kind === 'positions'
      && storedInvitePair[0].a.received === true
      && storedInvitePair[0].b.kind === 'positions'
      && storedInvitePair[0].b.received === true
      && !/(birth|date|time|place|lat|tz|email|token)/iu.test(JSON.stringify(storedInvitePair)));

  await page.reload({ waitUntil: 'domcontentloaded' });
  const restore = page.locator('.syn__pair-restore').first();
  await restore.waitFor({ state: 'visible', timeout: 30_000 });
  await page.evaluate(() => { globalThis.__phase4TimeoutDelays = []; });
  await restore.click();
  const restored = page.locator('.syn-meet.is-settled');
  await restored.waitFor({ state: 'visible', timeout: 30_000 });
  check('restored invitation comparison stays settled and keeps send-back available',
    await restored.locator('.syn-sendback').count() === 1
      && !await page.evaluate(() => globalThis.__phase4TimeoutDelays.includes(1_400)));
  check('restored invitation comparison never repeats the conversion prompt',
    await restored.locator('.syn-conversion').count() === 0);

  const returnContext = await seededContext(browser, { reducedMotion: 'no-preference' });
  const returnedPage = await returnContext.newPage();
  watchPage(returnedPage, 'returned');
  await returnedPage.goto(returnedURL, { waitUntil: 'domcontentloaded' });
  const provenance = returnedPage.locator('.syn-return');
  await provenance.waitFor({ state: 'visible', timeout: 30_000 });
  await returnedPage.locator('.syn-meet.is-settled').waitFor({ state: 'visible', timeout: 30_000 });
  check('returned #s result arrives settled with a dismissible provenance band',
    /A reading, sent back/.test(await provenance.textContent() ?? '')
      && await provenance.getByRole('button', { name: 'Dismiss' }).count() === 1);
  check('returned comparison exposes no numeric score',
    !/\b\d{1,3}%\b/u.test(await returnedPage.locator('.syn-meet').textContent() ?? ''));
  check('returned #s fragment is consumed without entering history or requests',
    await returnedPage.evaluate(() => window.location.hash) === '');
  await provenance.getByRole('button', { name: 'Dismiss' }).click();
  check('returned provenance can be dismissed without removing the reading',
    await returnedPage.locator('.syn-return').count() === 0
      && await returnedPage.locator('.syn-meet').count() === 1);

  await returnContext.close();
  await context.close();
}

/** Control real module arrival; do not substitute a simplified UI fixture. */
async function runFeatureOffHydrationChecks(browser, baseURL) {
  for (const neverArrives of [false, true]) {
    const context = await seededContext(browser);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    let release;
    const held = new Promise((resolveHeld) => { release = resolveHeld; });
    const pendingRoutes = [];
    let heldRequests = 0;
    await context.route('**/_astro/SynastryCalculator.*.js', (route) => {
      heldRequests += 1;
      const pending = held.then(() => route.continue());
      pendingRoutes.push(pending);
      return pending;
    });
    const evidence = {
      case: neverArrives ? 'required controls never arrive before deadline' : 'delayed real hydration',
      timeoutMs: COMPARISON_READY_TIMEOUT_MS,
      errors,
    };
    readinessEvidence.push(evidence);
    try {
      await page.goto(`${baseURL}/compatibility/#invite=${SESSION_HANDLE}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.calc__form').waitFor({ state: 'visible', timeout: COMPARISON_READY_TIMEOUT_MS });
      evidence.before = await featureOffComparisonState(page);
      if (!neverArrives) {
        // The old 250ms allowance cannot establish readiness while the actual
        // hydration module is held. This is a controlled deadline, not a sleep.
        evidence.legacyProbeReady = await waitForFeatureOffComparison(page, { timeout: 250 });
        check('feature-off delayed hydration keeps the SSR form from proving profile readiness',
          heldRequests > 0 && evidence.before.sources === 0 && evidence.before.submits === 1
            && !evidence.legacyProbeReady);
      }
      const started = performance.now();
      const ready = waitForFeatureOffComparison(page);
      if (!neverArrives) release();
      evidence.ready = await ready;
      evidence.elapsedMs = performance.now() - started;
      evidence.after = await featureOffComparisonState(page);
      evidence.heldRequests = heldRequests;
      check(neverArrives
        ? 'feature-off missing hydration cannot pass the required-control deadline'
        : 'feature-off delayed real hydration reaches the same two-select and one-submit state',
      neverArrives
        ? heldRequests > 0 && !evidence.ready && evidence.after.sources === 0 && evidence.after.submits === 1
        : evidence.ready && evidence.after.sources === 2 && evidence.after.submits === 1);
    } finally {
      try {
        release();
        await Promise.allSettled(pendingRoutes);
        // Release only for teardown after the negative outcome is recorded.
        // Let ordinary resources settle so closing the test context does not
        // turn an intentionally held request into an unrelated console error.
        await page.waitForLoadState('networkidle', { timeout: COMPARISON_READY_TIMEOUT_MS });
      } finally {
        await context.close();
      }
    }
    check(`feature-off ${neverArrives ? 'missing' : 'delayed'} hydration control has no page errors`, errors.length === 0, errors.join(' | '));
  }
}

async function runChartShareExposure(browser, baseURL) {
  const context = await seededContext(browser);
  const page = await context.newPage();
  watchPage(page, 'chart-share');
  await page.goto(`${baseURL}/birth-chart/${birthChartFragment}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('.calc__result [data-share-card]').waitFor({
    state: 'attached',
    timeout: 45_000,
  });
  const more = page.locator('[data-chart-more]');
  if (!(await more.getAttribute('open'))) await more.locator('summary').click();
  await more.locator('[data-share-options]').click();
  const dialog = page.locator('[data-share-dialog]');
  await dialog.waitFor({ state: 'visible', timeout: 45_000 });
  check('chart share dialog exposes the chart sheet and signature image together',
    await dialog.getAttribute('data-share-mode') === 'full'
      && await dialog.locator('[data-share-card-action="sheet"]').count() === 1
      && await dialog.locator('[data-share-card-action="signature"]').count() === 1);
  await page.waitForFunction(() => {
    const sheet = document.querySelector('[data-share-card-action="sheet"]');
    const signature = document.querySelector('[data-share-card-action="signature"]');
    return sheet instanceof HTMLButtonElement && !sheet.disabled
      && signature instanceof HTMLButtonElement && !signature.disabled;
  }, null, { timeout: 45_000 });
  check('both chart images are prepared before the final user tap', true);
  check('the dialog keeps the private positions link primary and labels the details link',
    await dialog.locator('[data-positions-link].btn--primary').count() === 1
      && await dialog.locator('[data-preview-link]').count() === 0
      && await dialog.locator('[data-details-link]').count() === 1
      && /includes your birth details/iu.test(await dialog.textContent() ?? ''));
  check('chart share sheet never displays fixture birth details',
    !/(1990-06-15|08:30|New York|America\/New_York|40\.7128|74\.006)/u.test(
      await dialog.textContent() ?? '',
    ));
  // Let ordinary page imagery settle before closing this short-lived context.
  // Linux Chromium otherwise reports in-flight pastel icon requests as
  // net::ERR_ABORTED during teardown even though both prepared cards passed.
  await page.waitForLoadState('networkidle');
  await context.close();
}

await withPreview({ port: MODE === 'enabled' ? 4452 : 4451 }, async (baseURL) => {
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    headless: true,
    args: STABLE_CHROMIUM_ARGS,
  });
  observedBrowser = browser.version();
  try {
    if (MODE === 'off') {
      await runFeatureOff(browser, baseURL);
      await runFeatureOffHydrationChecks(browser, baseURL);
    } else {
      await runCreation(browser, baseURL);
      await runUnavailable(browser, baseURL);
      await runMalformedArrivals(browser, baseURL);
      await runInvitationAndReturn(browser, baseURL);
      await runChartShareExposure(browser, baseURL);
    }
  } catch (error) {
    check(`${MODE} driver completes without an unexpected exception`, false, error?.stack ?? String(error));
  } finally {
    await browser.close();
  }
});

check(`${MODE} drive makes no unexpected fixture request`,
  unexpectedRequests.length === 0, unexpectedRequests.join(' | '));
check(`${MODE} drive observes no browser or network errors`,
  browserErrors.length === 0, browserErrors.join(' | '));

const failures = results.filter((result) => !result.ok);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const evidenceRoot = resolve('tests/visual/artifacts/phase4-sharing');
await mkdir(evidenceRoot, { recursive: true });
await writeFile(resolve(evidenceRoot, `${MODE}-result.json`), `${JSON.stringify({
  schema: 'zodiacs.phase4-sharing-readiness.v1',
  mode: MODE,
  checkoutCommit: process.env.GITHUB_SHA ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  browser: observedBrowser,
  driverSha256: hash(await readFile(new URL(import.meta.url))),
  readinessHelperSha256: hash(await readFile(new URL('./phase4-sharing-readiness.mjs', import.meta.url))),
  packageLockSha256: hash(await readFile(resolve('package-lock.json'))),
  results,
  readinessEvidence,
}, null, 2)}\n`);
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
}
if (failures.length > 0) {
  console.error(`Phase 4 sharing ${MODE}: FAIL — ${failures.length}/${results.length} checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`Phase 4 sharing ${MODE}: PASS — ${results.length}/${results.length} checks passed.`);
}
