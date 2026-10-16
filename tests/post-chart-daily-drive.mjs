/**
 * Phase 3 post-chart state acceptance.
 *
 * Run against a build made with the documented Phase 3 test provider env.
 * Every Supabase/preference request is intercepted; no external service or
 * real subscriber is contacted.
 */
import { chromium } from 'playwright-core';
import {
  findChromium,
  isSiteFooterIconTeardownAbort,
  STABLE_CHROMIUM_ARGS,
} from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const PROFILE_KEY = 'zodiacs.profile.v1';
const AUTH_KEY = 'sb-phase3-test-auth-token';
const USER_ID = '110e8400-e29b-41d4-a716-446655440000';
const CURRENT_ID = '220e8400-e29b-41d4-a716-446655440000';
const OTHER_ID = '330e8400-e29b-41d4-a716-446655440000';
const MASKED_EMAIL = 'f…@example.com';
const LONG_MASKED_EMAIL = 'f…@a-very-long-example-domain-for-proof.example';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

const accessToken = [
  base64url({ alg: 'HS256', typ: 'JWT' }),
  base64url({ aud: 'authenticated', exp: 4102444800, sub: USER_ID }),
  'phase3-test-signature',
].join('.');

const session = {
  access_token: accessToken,
  refresh_token: 'phase3-test-refresh',
  expires_at: 4102444800,
  expires_in: 2147483647,
  token_type: 'bearer',
  user: {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'frida@example.com',
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: '2026-07-20T00:00:00.000Z',
  },
};

function savedChart(id = CURRENT_ID, name = 'Frida Kahlo') {
  return {
    id,
    name,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    birth: {
      date: '1907-07-06',
      time: '08:30',
      timeKnown: true,
      place: {
        name: 'Coyoacán',
        admin1: 'Ciudad de México',
        country: 'MX',
        lat: 19.35,
        lon: -99.16,
        tz: 'America/Mexico_City',
      },
    },
    summary: {
      engineVersion: 'test',
      utcISO: '1907-07-06T15:06:36.000Z',
      houseSystem: 'whole',
      bodies: [{ body: 'Sun', lon: 103.91, retrograde: false }],
      angles: { asc: 143.2, mc: 58.4 },
      flags: [],
    },
  };
}

const profile = (charts) => ({ version: 1, settings: { houseSystem: 'whole' }, charts });

const fragment = `#c=1.${base64url({
  d: '1907-07-06',
  t: '08:30',
  z: 'America/Mexico_City',
  la: 19.35,
  lo: -99.16,
  n: 'Frida Kahlo',
  p: 'Coyoacán, Mexico',
})}`;

const emptyPreference = {
  enabled: false,
  pending: false,
  paused: false,
  requiresConfirmation: false,
  chartId: null,
  timezone: null,
  confirmedAt: null,
  maskedEmail: null,
};

const cases = [
  {
    name: 'device-only', expected: 'device-only', signedIn: false, charts: [], synced: [],
    preference: emptyPreference, form: true, note: true, panel: null,
  },
  {
    name: 'signed-in-unsynced', expected: 'signed-in-unsynced', signedIn: true,
    charts: [savedChart()], synced: [], preference: emptyPreference,
    form: true, note: true, panel: null,
  },
  {
    name: 'synced-eligible', expected: 'synced-eligible', signedIn: true,
    charts: [savedChart()], synced: [CURRENT_ID], preference: emptyPreference,
    form: true, note: false, panel: 'synced-eligible',
  },
  {
    name: 'pending', expected: 'pending', signedIn: true,
    charts: [savedChart()], synced: [CURRENT_ID],
    preference: {
      enabled: false, pending: true, paused: false, requiresConfirmation: false, chartId: CURRENT_ID,
      timezone: 'America/Mexico_City', confirmedAt: null, maskedEmail: MASKED_EMAIL,
    },
    form: true, note: false, panel: 'pending',
  },
  {
    name: 'active', expected: 'active', signedIn: true,
    charts: [savedChart()], synced: [CURRENT_ID],
    preference: {
      enabled: true, pending: false, paused: false, requiresConfirmation: false, chartId: CURRENT_ID,
      timezone: 'America/Mexico_City', confirmedAt: '2026-07-20T00:00:00.000Z', maskedEmail: null,
    },
    form: false, note: false, panel: 'active',
  },
  {
    name: 'paused', expected: 'paused', signedIn: true,
    charts: [savedChart()], synced: [CURRENT_ID],
    preference: {
      enabled: true, pending: false, paused: true, requiresConfirmation: false, chartId: null,
      timezone: 'America/Mexico_City', confirmedAt: '2026-07-20T00:00:00.000Z', maskedEmail: null,
    },
    form: false, note: false, panel: 'paused',
  },
];

async function preparePage(browser, baseURL, testCase, viewport) {
  const context = await browser.newContext({
    viewport,
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(({ authKey, auth, profileKey, profileValue }) => {
    localStorage.clear();
    if (auth) localStorage.setItem(authKey, JSON.stringify(auth));
    localStorage.setItem(profileKey, JSON.stringify(profileValue));
  }, {
    authKey: AUTH_KEY,
    auth: testCase.signedIn ? session : null,
    profileKey: PROFILE_KEY,
    profileValue: profile(testCase.charts),
  });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  const requestFailures = [];
  const unexpectedRequests = [];
  let resendBody = null;
  let resendAttempted = false;
  let preferenceReads = 0;
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('request', (request) => requests.push(request.url()));
  page.on('requestfailed', (request) => {
    if (isSiteFooterIconTeardownAbort(request)) return;
    requestFailures.push(
      `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`,
    );
  });

  await page.route('https://phase3-test.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    let body = null;
    if (url.pathname === '/auth/v1/user' && method === 'GET') {
      body = session.user;
    } else if (url.pathname === '/rest/v1/charts' && method === 'GET') {
      const select = url.searchParams.get('select') ?? '';
      body = select === 'id'
        ? testCase.synced.map((id) => ({ id }))
        : (testCase.remoteCharts ?? []).map((chart) => ({
          id: chart.id,
          payload: chart,
          updated_at: chart.updatedAt,
        }));
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
  await page.route('**/api/email/chart-preference', async (route) => {
    if (route.request().method() === 'POST') {
      resendBody = JSON.parse(route.request().postData() ?? '{}');
      resendAttempted = true;
      const status = testCase.resendStatus ?? 200;
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(status === 200
          ? { ok: true, pending: true, requestId: 'browser-proof' }
          : { error: testCase.resendError ?? 'unavailable' }),
      });
      return;
    }
    preferenceReads += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        resendAttempted && testCase.preferenceAfterResend
          ? testCase.preferenceAfterResend
          : testCase.preference,
      ),
    });
  });

  const response = await page.goto(`${baseURL}/birth-chart/${fragment}`, { waitUntil: 'domcontentloaded' });
  const shell = page.locator(`[data-email-capture-shell][data-post-chart-state="${testCase.expected}"]`);
  await shell.waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(75);
  const fixturePrefix = `${testCase.name}@${viewport.width}`;
  check(`${fixturePrefix} has no request failures`, requestFailures.length === 0, requestFailures.join(' | '));
  check(`${fixturePrefix} makes no unexpected fixture requests`, unexpectedRequests.length === 0, unexpectedRequests.join(' | '));
  return {
    context,
    page,
    shell,
    errors,
    requests,
    requestFailures,
    unexpectedRequests,
    getResendBody: () => resendBody,
    getPreferenceReads: () => preferenceReads,
    response,
  };
}

async function prepareProfilePage(browser, baseURL, initialPreference, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(({ authKey, auth, profileKey, profileValue }) => {
    localStorage.clear();
    localStorage.setItem(authKey, JSON.stringify(auth));
    localStorage.setItem(profileKey, JSON.stringify(profileValue));
  }, {
    authKey: AUTH_KEY,
    auth: session,
    profileKey: PROFILE_KEY,
    profileValue: profile([savedChart()]),
  });
  const page = await context.newPage();
  const requestFailures = [];
  const unexpectedRequests = [];
  let preference = initialPreference;
  let mutationBody = null;
  page.on('requestfailed', (request) => {
    if (isSiteFooterIconTeardownAbort(request)) return;
    requestFailures.push(
      `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`,
    );
  });
  await page.route('https://phase3-test.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    let body = null;
    if (url.pathname === '/auth/v1/user' && method === 'GET') {
      body = session.user;
    } else if (url.pathname === '/rest/v1/charts' && method === 'GET') {
      body = (url.searchParams.get('select') ?? '') === 'id'
        ? [{ id: CURRENT_ID }]
        : [];
    } else if (url.pathname === '/rest/v1/profiles' && method === 'GET') {
      body = [];
    } else if (url.pathname === '/rest/v1/chart_deletions' && method === 'GET') {
      body = [];
    } else if (url.pathname === '/rest/v1/living_chart_sync_consents' && method === 'GET') {
      // Profile now mounts the Living Chart recovery surface alongside the
      // Phase 3 email controls. Keep this fixture explicitly device-only so
      // the unrelated email scenarios cannot contact a real sync backend.
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
      headers: { 'Content-Range': Array.isArray(body) && body.length === 0 ? '*/0' : '0-0/1' },
      body: JSON.stringify(body),
    });
  });
  await page.route('**/api/email/chart-preference', async (route) => {
    if (route.request().method() === 'POST') {
      mutationBody = JSON.parse(route.request().postData() ?? '{}');
      const isResend = mutationBody.action === 'resend';
      const status = isResend ? options.resendStatus ?? 200 : 200;
      if (isResend && options.preferenceAfterResend) {
        preference = options.preferenceAfterResend;
      } else {
        preference = {
          enabled: false,
          pending: true,
          paused: false,
          requiresConfirmation: false,
          chartId: CURRENT_ID,
          timezone: 'UTC',
          confirmedAt: null,
          maskedEmail: MASKED_EMAIL,
        };
      }
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(status === 200
          ? { ok: true, pending: true, requestId: 'profile-browser-proof' }
          : { error: options.resendError ?? 'not_pending' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(preference),
    });
  });
  const response = await page.goto(`${baseURL}/profile/`, { waitUntil: 'domcontentloaded' });
  const panel = page.locator('#daily-brief');
  await panel.waitFor({ state: 'visible', timeout: 30_000 });
  return {
    context,
    page,
    panel,
    requestFailures,
    unexpectedRequests,
    response,
    getMutationBody: () => mutationBody,
  };
}

await withPreview({ port: 4426 }, async (baseURL) => {
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    headless: true,
    args: STABLE_CHROMIUM_ARGS,
  });
  try {
    let deviceText = '';
    for (const viewport of [{ width: 360, height: 800 }, { width: 1280, height: 900 }]) {
      for (const testCase of cases) {
        const run = await preparePage(browser, baseURL, testCase, viewport);
        const { page, shell } = run;
        const prefix = `${testCase.name}@${viewport.width}`;
        check(`${prefix} returned 200`, run.response?.ok() === true, String(run.response?.status()));
        check(`${prefix} has the expected stable state`, await shell.getAttribute('data-post-chart-state') === testCase.expected);
        check(`${prefix} form visibility`, await shell.locator('[data-email-capture]').isVisible() === testCase.form);
        check(`${prefix} device-note visibility`, await shell.locator('[data-post-chart-device-note]').isVisible() === testCase.note);
        check(`${prefix} panel identity`, testCase.panel
          ? await shell.locator(`[data-post-chart-panel="${testCase.panel}"]`).isVisible()
          : await shell.locator('[data-post-chart-panel]').count() === 0);
        check(`${prefix} computed Cancer is preselected`, await shell.locator('input[name="sign"][value="cancer"]').isChecked());
        check(`${prefix} has no horizontal overflow`, await page.evaluate(() => (
          document.documentElement.scrollWidth <= document.documentElement.clientWidth
        )));
        check(`${prefix} has no browser errors`, run.errors.length === 0, run.errors.join(' | '));
        check(`${prefix} never queries the private preference table`, run.requests.every((url) => (
          !url.includes('daily_chart_preferences')
        )), run.requests.filter((url) => url.includes('daily_chart_preferences')).join(', '));

        const eventContract = await page.evaluate(() => {
          const value = window.zodiacsPostChartContext;
          return {
            keys: value ? Object.keys(value).sort() : [],
            serialized: JSON.stringify(value ?? null),
          };
        });
        check(`${prefix} chart event is privacy-minimal`,
          JSON.stringify(eventContract.keys) === JSON.stringify(['chartId', 'contextId', 'mode', 'sunSign'])
            && !/(birth|email|token|payload|frida@example)/iu.test(eventContract.serialized),
          eventContract.serialized);

        const regionName = {
          'device-only': 'Your Cancer day ahead.',
          'signed-in-unsynced': 'Your Cancer day ahead.',
          'synced-eligible': 'This chart can have its own daily brief.',
          pending: 'Almost on.',
          active: 'Personal daily brief',
          paused: 'Your daily brief is paused.',
        }[testCase.expected];
        check(`${prefix} region has the expected accessible name`, await page.getByRole('region', {
          name: regionName,
          exact: true,
        }).count() === 1);
        const visiblePrimaryCount = await shell.locator('.btn--primary:visible').count();
        check(`${prefix} has at most one primary action`, visiblePrimaryCount <= 1, String(visiblePrimaryCount));
        const touchTargets = await shell.locator('.btn:visible').evaluateAll((nodes) => nodes.map((node) => ({
          text: node.textContent?.trim() ?? '',
          height: node.getBoundingClientRect().height,
        })));
        check(`${prefix} visible button targets are at least 44px`,
          touchTargets.every((target) => target.height >= 44),
          JSON.stringify(touchTargets));

        if (testCase.panel && testCase.form) {
          check(`${prefix} personal panel precedes the Sun alternative`, await shell.evaluate((node) => {
            const panel = node.querySelector('[data-post-chart-panel]');
            const form = node.querySelector('[data-email-capture]');
            return Boolean(panel && form
              && (panel.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING));
          }));
        }

        if (testCase.note) {
          const note = shell.locator('[data-post-chart-device-note]');
          check(`${prefix} sync note is prose`, await note.evaluate((node) => node.tagName === 'P')
            && await note.locator('button, input, select, textarea').count() === 0);
          check(`${prefix} sync explainer target`, await note.locator('a').getAttribute('href') === '/profile/#profile-sync');
          check(`${prefix} exact device-only note`, (await note.innerText()).replace(/\s+/gu, ' ').trim() === (
            'Prefer a brief matched to this exact chart? That exists only for account-synced charts. '
            + 'Syncing is always your call, and this chart stays on your device until you make it. '
            + 'How chart sync works'
          ));
          const text = (await shell.innerText()).replace(testCase.expected, '').trim();
          if (testCase.name === 'device-only') deviceText = text;
          if (testCase.name === 'signed-in-unsynced') {
            check(`${prefix} is visually identical in content to device-only`, text === deviceText);
          }
        }
        if (testCase.expected === 'synced-eligible') {
          check(`${prefix} exact title`, await shell.getByRole('heading', {
            name: 'This chart can have its own daily brief.', exact: true,
          }).count() === 1);
          const cta = shell.getByRole('link', { name: 'Set it up in your profile', exact: true });
          check(`${prefix} one setup CTA`, await cta.count() === 1
            && await cta.getAttribute('href') === '/profile/#daily-brief');
          check(`${prefix} exact setup body`, await shell.getByText(
            'A personal morning email for Frida Kahlo, where each day’s sky touches its saved placements, not just its Sun sign.',
            { exact: true },
          ).count() === 1);
          check(`${prefix} Sun submit is the lighter action`, await shell.locator('.email-capture__submit.btn--ghost').count() === 1
            && !(await shell.locator('.email-capture__submit').evaluate((node) => node.classList.contains('btn--primary'))));
          await cta.focus();
          check(`${prefix} setup CTA is keyboard-focusable`, await cta.evaluate((node) => document.activeElement === node));
          check(`${prefix} setup CTA has visible focus treatment`, await cta.evaluate((node) => {
            const style = getComputedStyle(node);
            return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 2;
          }));
        }
        if (testCase.expected === 'pending') {
          check(`${prefix} masked address only`, (await shell.innerText()).includes(MASKED_EMAIL)
            && !(await shell.innerText()).includes('frida@example.com'));
          check(`${prefix} exact pending body`, await shell.getByText(
            `Confirm from the email we sent to ${MASKED_EMAIL} and the daily brief begins.`,
            { exact: true },
          ).count() === 1);
          const resend = shell.getByRole('button', { name: 'Resend the link', exact: true });
          await resend.click();
          await shell.getByRole('status').getByText('Another confirmation link is on its way. The newest link is the one that works.', { exact: true }).waitFor();
          check(`${prefix} resend sends no chart choice`, JSON.stringify(run.getResendBody()) === JSON.stringify({ action: 'resend' }));
          await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Resend the link');
          check(`${prefix} resend retains focus`, await resend.evaluate((node) => document.activeElement === node));
        }
        if (testCase.expected === 'active') {
          const manage = shell.getByRole('link', { name: 'Manage it in your profile.', exact: true });
          check(`${prefix} exact active line`, (await shell.innerText()).includes('The personal daily brief is on for Frida Kahlo.'));
          check(`${prefix} one quiet manage link`, await manage.count() === 1
            && await manage.getAttribute('href') === '/profile/#daily-brief');
        }
        if (testCase.expected === 'paused') {
          const choose = shell.getByRole('link', { name: 'Choose in your profile', exact: true });
          check(`${prefix} exact paused title`, await shell.getByRole('heading', {
            name: 'Your daily brief is paused.', exact: true,
          }).count() === 1);
          check(`${prefix} exact paused body`, await shell.getByText(
            'The chart it read was deleted, so delivery stopped. Choose another synced chart whenever you’re ready. Nothing is chosen for you.',
            { exact: true },
          ).count() === 1);
          check(`${prefix} one explicit replacement CTA`, await choose.count() === 1
            && await choose.getAttribute('href') === '/profile/#daily-brief');
        }
        await run.context.close();
      }
    }

    // An active preference on another valid chart remains one active daily;
    // the displayed chart is never silently substituted or offered a second.
    {
      const other = savedChart(OTHER_ID, 'Long selected chart name that remains safe and truthfully identified');
      const run = await preparePage(browser, baseURL, {
        ...cases[4],
        name: 'active-other',
        charts: [savedChart(), other],
        synced: [CURRENT_ID, OTHER_ID],
        preference: { ...cases[4].preference, chartId: OTHER_ID },
      }, { width: 360, height: 800 });
      check('active-other names the selected chart', (await run.shell.innerText()).includes(other.name));
      check('active-other suppresses the Sun form', !(await run.shell.locator('[data-email-capture]').isVisible()));
      check('active-other does not overflow', await run.page.evaluate(() => (
        document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )));
      const activeStatusStyle = await run.shell.locator('.post-chart-daily__status-line').evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          overflow: style.overflow,
          textOverflow: style.textOverflow,
          whiteSpace: style.whiteSpace,
          clipped: node.scrollWidth > node.clientWidth,
        };
      });
      check('active-other long name uses one-line ellipsis',
        activeStatusStyle.overflow === 'hidden'
          && activeStatusStyle.textOverflow === 'ellipsis'
          && activeStatusStyle.whiteSpace === 'nowrap'
          && activeStatusStyle.clipped,
        JSON.stringify(activeStatusStyle));
      await run.context.close();
    }

    // Long recipient masks use the same one-line status treatment without
    // leaking the unmasked Auth address or growing the card.
    {
      const run = await preparePage(browser, baseURL, {
        ...cases[3],
        name: 'pending-long-mask',
        preference: { ...cases[3].preference, maskedEmail: LONG_MASKED_EMAIL },
      }, { width: 360, height: 800 });
      const line = run.shell.locator('.post-chart-daily__status-line');
      const style = await line.evaluate((node) => {
        const computed = getComputedStyle(node);
        return {
          overflow: computed.overflow,
          textOverflow: computed.textOverflow,
          whiteSpace: computed.whiteSpace,
          clipped: node.scrollWidth > node.clientWidth,
        };
      });
      check('long pending mask remains private', (await run.shell.innerText()).includes(LONG_MASKED_EMAIL)
        && !(await run.shell.innerText()).includes('frida@example.com'));
      check('long pending mask uses one-line ellipsis', style.overflow === 'hidden'
        && style.textOverflow === 'ellipsis'
        && style.whiteSpace === 'nowrap'
        && style.clipped, JSON.stringify(style));
      await run.context.close();
    }

    // A changed account email pauses effective delivery. The post-chart card
    // points back to profile and never makes the old recipient look active.
    {
      const run = await preparePage(browser, baseURL, {
        ...cases[2],
        name: 'recipient-changed',
        preference: {
          enabled: false,
          pending: false,
          paused: false,
          requiresConfirmation: true,
          chartId: CURRENT_ID,
          timezone: 'UTC',
          confirmedAt: '2026-07-20T00:00:00.000Z',
          maskedEmail: null,
        },
      }, { width: 360, height: 800 });
      check('changed recipient is never called active', !(await run.shell.innerText()).includes('is on for'));
      check('changed recipient gets the profile setup path', await run.shell.getByRole('link', {
        name: 'Set it up in your profile', exact: true,
      }).count() === 1);
      await run.context.close();
    }

    // Profile owns the deliberate account-email re-confirmation path. It does
    // not call the old recipient active and uses the normal DOI mutation.
    {
      const run = await prepareProfilePage(browser, baseURL, {
        enabled: false,
        pending: false,
        paused: false,
        requiresConfirmation: true,
        chartId: CURRENT_ID,
        timezone: 'UTC',
        confirmedAt: '2026-07-20T00:00:00.000Z',
        maskedEmail: null,
      });
      const reconfirm = run.panel.getByRole('button', {
        name: 'Confirm my current email', exact: true,
      });
      await reconfirm.waitFor({ state: 'visible' });
      check('profile changed-recipient page returned 200', run.response?.ok() === true);
      check('profile changed-recipient state never claims active', !(await run.panel.innerText()).includes('On · reading'));
      // The paused-delivery sentence can paint a beat after the button on a
      // slow runner, and the panel re-renders as the state settles — waiting
      // for the node then counting still read zero once the node was replaced
      // between the two calls (2026-07-29). Poll the count instead, so a
      // genuine absence still reports as a failed check rather than throwing.
      const changedCopy = run.panel.getByText(
        'Your account email changed. Delivery is paused until you confirm the current address.',
        { exact: true },
      );
      let changedCopyCount = 0;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        changedCopyCount = await changedCopy.count();
        if (changedCopyCount === 1) break;
        await run.page.waitForTimeout(125);
      }
      check('profile changed-recipient copy is explicit', changedCopyCount === 1,
        `count=${changedCopyCount}`);
      await reconfirm.click();
      await run.panel.getByRole('heading', { name: 'Confirm from your inbox.', exact: true }).waitFor();
      check('profile re-confirm uses the prior explicit chart and timezone',
        JSON.stringify(run.getMutationBody()) === JSON.stringify({ chartId: CURRENT_ID, timezone: 'UTC' }),
        JSON.stringify(run.getMutationBody()));
      check('profile re-confirm enters pending rather than active', !(await run.panel.innerText()).includes('On · reading'));
      await run.page.waitForTimeout(75);
      check('profile re-confirm has no request failures', run.requestFailures.length === 0, run.requestFailures.join(' | '));
      check('profile re-confirm has no unexpected requests', run.unexpectedRequests.length === 0, run.unexpectedRequests.join(' | '));
      await run.context.close();
    }

    // If confirmation wins a profile resend race, the authoritative refresh
    // owns the UI. A stale mutation error must not survive under active truth.
    {
      const run = await prepareProfilePage(browser, baseURL, {
        enabled: false,
        pending: true,
        paused: false,
        requiresConfirmation: false,
        chartId: CURRENT_ID,
        timezone: 'UTC',
        confirmedAt: null,
        maskedEmail: MASKED_EMAIL,
      }, {
        resendStatus: 409,
        resendError: 'not_pending',
        preferenceAfterResend: cases[4].preference,
      });
      const resend = run.panel.getByRole('button', { name: 'Resend the link', exact: true });
      await resend.waitFor({ state: 'visible' });
      await resend.click();
      await run.panel.getByText(
        'On · reading Frida Kahlo · arriving around 7:00, America/Mexico_City',
        { exact: true },
      ).waitFor();
      check('profile confirmation race resolves to active truth',
        !(await run.panel.innerText()).includes('Confirm from your inbox.'));
      check('profile confirmation race clears the stale mutation error',
        !(await run.panel.innerText()).includes("Couldn't update this preference."));
      check('profile resend sends only the server-owned action',
        JSON.stringify(run.getMutationBody()) === JSON.stringify({ action: 'resend' }));
      check('profile confirmation race has no request failures',
        run.requestFailures.length === 0, run.requestFailures.join(' | '));
      check('profile confirmation race has no unexpected requests',
        run.unexpectedRequests.length === 0, run.unexpectedRequests.join(' | '));
      await run.context.close();
    }

    // A pending request for an older Auth address is generic everywhere: the
    // new address is not smuggled into hover or accessible metadata.
    {
      const run = await prepareProfilePage(browser, baseURL, {
        enabled: false,
        pending: true,
        paused: false,
        requiresConfirmation: false,
        chartId: CURRENT_ID,
        timezone: 'UTC',
        confirmedAt: null,
        maskedEmail: null,
      });
      const pending = run.panel.getByText(
        'A confirmation is still pending. Resend the link to your current account email, then confirm it to begin the brief.',
        { exact: true },
      );
      await pending.waitFor({ state: 'visible' });
      check('profile changed-address pending copy stays generic', !(await pending.innerText()).includes('@'));
      check('profile changed-address pending has no misleading title', await pending.getAttribute('title') === null);
      check('profile changed-address pending has no request failures', run.requestFailures.length === 0, run.requestFailures.join(' | '));
      check('profile changed-address pending has no unexpected requests', run.unexpectedRequests.length === 0, run.unexpectedRequests.join(' | '));
      await run.context.close();
    }

    // Provider failure or a confirmation/cancel race prompts a fresh read, so
    // the pending card cannot survive after its server authority changed.
    {
      const run = await preparePage(browser, baseURL, {
        ...cases[3],
        name: 'resend-provider-failure',
        resendStatus: 502,
        preferenceAfterResend: emptyPreference,
      }, { width: 360, height: 800 });
      await run.shell.getByRole('button', { name: 'Resend the link', exact: true }).click();
      const refreshed = run.page.locator('[data-email-capture-shell][data-post-chart-state="synced-eligible"]');
      await refreshed.waitFor({ state: 'visible' });
      check('failed resend replaces stale pending with fresh eligible state',
        await refreshed.locator('[data-post-chart-panel="synced-eligible"]').isVisible());
      check('failed resend leaves no stale resend control', await refreshed.getByRole('button', {
        name: 'Resend the link', exact: true,
      }).count() === 0);
      await run.context.close();
    }
    {
      const run = await preparePage(browser, baseURL, {
        ...cases[3],
        name: 'resend-confirmation-race',
        resendStatus: 409,
        resendError: 'not_pending',
        preferenceAfterResend: cases[4].preference,
      }, { width: 360, height: 800 });
      await run.shell.getByRole('button', { name: 'Resend the link', exact: true }).click();
      const refreshed = run.page.locator('[data-email-capture-shell][data-post-chart-state="active"]');
      await refreshed.waitFor({ state: 'visible' });
      check('confirmation race resolves to active truth', (await refreshed.innerText()).includes(
        'The personal daily brief is on for Frida Kahlo.',
      ));
      check('confirmation race suppresses the Sun form', !(await refreshed.locator('[data-email-capture]').isVisible()));
      await run.context.close();
    }

    // A local save is not called synced until the data-free successful-sync
    // signal prompts a fresh RLS-owned id read.
    {
      const transitionCase = {
        ...cases[1],
        name: 'sync-transition',
        synced: [],
      };
      const run = await preparePage(browser, baseURL, transitionCase, { width: 360, height: 800 });
      const email = run.page.locator('[data-email-capture-shell][data-post-chart-managed="true"] input[type="email"]');
      await email.focus();
      transitionCase.synced.push(CURRENT_ID);
      await run.page.evaluate(() => window.dispatchEvent(new Event('zodiacs:profile-synced')));
      const shell = run.page.locator('[data-email-capture-shell][data-post-chart-state="synced-eligible"]');
      await shell.waitFor({ state: 'visible' });
      check('successful sync refreshes state 2 to state 3', await shell.locator('[data-post-chart-panel="synced-eligible"]').isVisible());
      check('sync transition retains the Sun alternative', await shell.locator('[data-email-capture]').isVisible());
      check('sync transition preserves focus in the retained Sun form', await email.evaluate((node) => (
        document.activeElement === node
      )));
      await run.context.close();
    }

    // A remote chart arriving after computation rematches the current result.
    // A subsequent input edit invalidates that result and all derived surfaces.
    {
      const run = await preparePage(browser, baseURL, {
        ...cases[0],
        name: 'remote-match-after-compute',
        signedIn: true,
        synced: [CURRENT_ID],
        charts: [],
      }, { width: 360, height: 800 });
      await run.page.evaluate(({ profileKey, profileValue }) => {
        localStorage.setItem(profileKey, JSON.stringify(profileValue));
        window.dispatchEvent(new CustomEvent('zodiacs:profile', { detail: profileValue }));
      }, { profileKey: PROFILE_KEY, profileValue: profile([savedChart()]) });
      const matched = run.page.locator('[data-email-capture-shell][data-post-chart-state="synced-eligible"]');
      await matched.waitFor({ state: 'visible' });
      check('remote profile arrival rematches without recompute', await matched.locator(
        '[data-post-chart-panel="synced-eligible"]',
      ).isVisible());
      const beforeEdit = await run.page.evaluate(() => JSON.stringify(window.zodiacsPostChartContext));
      const email = matched.locator('input[type="email"]');
      await email.fill('retained@example.com');
      const readsBeforeEdit = run.getPreferenceReads();
      await run.page.locator('#birth-date').fill('1908-07-06');
      await run.page.evaluate(() => window.dispatchEvent(new Event('zodiacs:profile-synced')));
      await run.page.waitForTimeout(150);
      const afterEdit = await run.page.evaluate(() => JSON.stringify(window.zodiacsPostChartContext));
      check('editing form fields clears the obsolete result context', beforeEdit !== undefined && afterEdit === undefined,
        `${beforeEdit} -> ${afterEdit}`);
      check('editing form fields hides the matched daily surface', !(await matched.isVisible()));
      check('cleared context does not initiate another preference read', run.getPreferenceReads() === readsBeforeEdit);
      check('cleared capture preserves typed email', await run.page.locator(
        '[data-email-capture-shell][data-post-chart-managed="true"] input[type="email"]',
      ).inputValue() === 'retained@example.com');
      check('editing form fields clears result and derived actions', await run.page.locator(
        '.calc__result, [data-calculation-receipt-export], [data-share-card], [data-save-chart]',
      ).count() === 0);
      await run.context.close();
    }

    // Same-state account refreshes retain the reader's place in the form.
    {
      const run = await preparePage(browser, baseURL, cases[2], { width: 360, height: 800 });
      const email = run.shell.locator('input[type="email"]');
      await email.focus();
      await run.page.evaluate(() => window.dispatchEvent(new Event('zodiacs:profile-synced')));
      await run.page.waitForTimeout(150);
      check('same-state refresh keeps the capture visible', await run.shell.isVisible());
      check('same-state refresh preserves form focus', await email.evaluate((node) => document.activeElement === node));
      await run.context.close();
    }

    // A transient preference failure is not a seventh semantic state and must
    // not flash a signup form to a possibly active reader.
    {
      const testCase = { ...cases[2], name: 'preference-failure' };
      const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
      await context.addInitScript(({ authKey, auth, profileKey, profileValue }) => {
        localStorage.setItem(authKey, JSON.stringify(auth));
        localStorage.setItem(profileKey, JSON.stringify(profileValue));
      }, { authKey: AUTH_KEY, auth: session, profileKey: PROFILE_KEY, profileValue: profile(testCase.charts) });
      const page = await context.newPage();
      const requestFailures = [];
      const unexpectedRequests = [];
      page.on('requestfailed', (request) => {
        if (isSiteFooterIconTeardownAbort(request)) return;
        requestFailures.push(
          `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`,
        );
      });
      await page.route('https://phase3-test.supabase.co/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const method = request.method();
        let body = null;
        if (url.pathname === '/auth/v1/user' && method === 'GET') {
          body = session.user;
        } else if (url.pathname === '/rest/v1/charts' && method === 'GET') {
          body = (url.searchParams.get('select') ?? '') === 'id' ? [{ id: CURRENT_ID }] : [];
        } else if ((url.pathname === '/rest/v1/profiles'
            || url.pathname === '/rest/v1/chart_deletions') && method === 'GET') {
          body = [];
        } else if (url.pathname.startsWith('/rest/v1/')
          && ['POST', 'PATCH', 'DELETE'].includes(method)) {
          body = {};
        } else {
          unexpectedRequests.push(`${method} ${url.pathname}${url.search}`);
          await route.fulfill({ status: 418, body: '{}' });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Content-Range': Array.isArray(body) && body.length === 0 ? '*/0' : '0-0/1' },
          body: JSON.stringify(body),
        });
      });
      await page.route('**/api/email/chart-preference', (route) => route.fulfill({
        status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }),
      }));
      await page.goto(`${baseURL}/birth-chart/${fragment}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.calc__result').waitFor({ timeout: 30_000 });
      await page.waitForTimeout(500);
      const shell = page.locator('[data-email-capture-shell][data-post-chart-managed="true"]');
      check('transient failure keeps the optional surface hidden', !(await shell.isVisible()));
      check('transient failure exposes no stable state', await shell.getAttribute('data-post-chart-state') === null);
      check('transient failure fixture has no request failures', requestFailures.length === 0, requestFailures.join(' | '));
      check('transient failure fixture has no unexpected requests', unexpectedRequests.length === 0, unexpectedRequests.join(' | '));
      await context.close();
    }

    // The accepted English-first seam: localized birth-chart captures remain
    // the existing weekly form and never gain Phase 3 account state.
    {
      const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
      const page = await context.newPage();
      await page.goto(`${baseURL}/es/birth-chart/${fragment}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.calc__result').waitFor({ timeout: 30_000 });
      const shell = page.locator('[data-email-capture-shell]');
      await shell.waitFor({ state: 'visible' });
      check('localized capture has no post-chart controller', await shell.locator('[data-post-chart-controller]').count() === 0);
      check('localized capture remains weekly', (await shell.innerText()).includes('semanal'));
      await context.close();
    }

    // A non-full calculator event cannot reveal or initialize this placement.
    {
      const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
      const page = await context.newPage();
      await page.goto(`${baseURL}/birth-chart/`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('zodiacs:chart-computed', {
        detail: { mode: 'moon', sunSign: 'cancer', contextId: 1 },
      })));
      await page.waitForTimeout(100);
      const shell = page.locator('[data-email-capture-shell][data-post-chart-managed="true"]');
      check('non-full chart event reveals nothing', !(await shell.isVisible()));
      check('non-full chart event derives no state', await shell.getAttribute('data-post-chart-state') === null);
      await context.close();
    }

    // With JavaScript disabled the chart cannot compute, so the existing
    // calculator noscript is the only fallback and no fake email state appears.
    {
      const context = await browser.newContext({
        viewport: { width: 360, height: 800 },
        javaScriptEnabled: false,
      });
      const page = await context.newPage();
      await page.goto(`${baseURL}/birth-chart/${fragment}`, { waitUntil: 'domcontentloaded' });
      const calculatorFallback = page.locator('#main noscript > p').filter({
        hasText: 'This birth chart calculator needs JavaScript',
      });
      check('no-JS calculator explanation remains visible', await calculatorFallback.isVisible());
      check('no-JS post-chart capture remains hidden', !(await page.locator('[data-email-capture-shell]').isVisible()));
      check('no-JS exposes no personal controls', await page.locator('[data-post-chart-panel]').count() === 0);
      await context.close();
    }
  } finally {
    await browser.close();
  }
});

const failed = results.filter((result) => !result.ok);
const reported = process.argv.includes('--summary') ? failed : results;
for (const result of reported) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
}
if (failed.length > 0) {
  throw new Error(`Post-chart daily acceptance failed: ${failed.length}/${results.length} checks.`);
}
console.log(`Post-chart daily acceptance: PASS — ${results.length}/${results.length} checks`);
