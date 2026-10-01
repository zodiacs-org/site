/**
 * Website Guide UI drive with a fully mocked /v1/guide/turn endpoint.
 *
 *   npm run build
 *   OUT_DIR=/tmp/guide-ui node tests/assistant-drive.mjs
 *   GUIDE_AVATAR_ONLY=1 OUT_DIR=/tmp/guide-avatar node tests/assistant-drive.mjs
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
import { driveLegacyPolarGuide } from './legacy-polar-guide-drive.mjs';

const OUT = process.env.OUT_DIR ?? null;
const GUIDE_AVATAR_ONLY = process.env.GUIDE_AVATAR_ONLY === '1';
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
if (OUT) await mkdir(OUT, { recursive: true });

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CHART_ID = '33333333-3333-4333-8333-333333333333';

const profile = {
  version: 1,
  settings: { houseSystem: 'whole' },
  charts: [{
    id: CHART_ID,
    name: 'Secret Person',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
    birth: {
      date: '1990-04-17', time: '08:45', timeKnown: true,
      place: { name: 'Bangkok', country: 'TH', lat: 13.7563, lon: 100.5018, tz: 'Asia/Bangkok' },
    },
    summary: {
      houseSystem: 'whole',
      bodies: [
        { body: 'Sun', lon: 27.2, retrograde: false },
        { body: 'Moon', lon: 301.5, retrograde: false },
        { body: 'Mercury', lon: 45.25, retrograde: true },
      ],
      angles: { asc: 125, mc: 35 },
      // 08:45 in Bangkok (UTC+7). Guide sends the bodies at this instant
      // rounded to the whole minute, as a link does; it is one already.
      utcISO: '1990-04-17T01:45:00.000Z',
    },
  }],
};

function guideSequence(body) {
  const historyMax = body.ephemeralContext.history.reduce(
    (maximum, message) => Math.max(maximum, message.sequence),
    body.ephemeralContext.modelHistoryStartSequence - 1,
  );
  return historyMax + 2;
}

function guideEvents(body, answer) {
  const acceptedRevision = body.baseRevision + 1;
  const chunks = [answer.slice(0, Math.ceil(answer.length / 2)), answer.slice(Math.ceil(answer.length / 2))];
  const base = {
    schema: 'zodiacs.guide.stream-event.draft.v1',
    conversationId: body.conversationId,
    turnId: body.turnId,
    attemptId: body.attemptId,
    clientAuthEpoch: body.clientAuthEpoch,
  };
  const events = [
    { ...base, eventSequence: 0, type: 'accepted', conversationRevision: acceptedRevision },
    ...chunks.filter(Boolean).map((delta, index) => ({
      ...base, eventSequence: index + 1, type: 'delta', delta,
    })),
  ];
  events.push({
    ...base,
    eventSequence: events.length,
    type: 'completed',
    conversationRevision: acceptedRevision + 1,
    message: {
      messageId: crypto.randomUUID(),
      turnId: body.turnId,
      sequence: guideSequence(body),
      author: 'guide',
      content: answer,
      contextRevision: body.contextEpoch,
      createdAt: new Date().toISOString(),
      generation: {
        modelId: 'gpt-5.6-luna',
        promptVersion: 'guide-prompt.draft.v1',
        policyVersion: 'guide-policy.draft.v1',
        protocolSchema: 'zodiacs.guide.conversation.draft.v1',
        generatedAt: new Date().toISOString(),
      },
    },
  });
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
}

async function installGuideRoute(page, requests) {
  // CI intentionally builds with account-v2 rollout off and no deploy-time
  // Supabase public config. Supply only the authenticated identity boundary
  // this Guide drive owns; account-v2 auth behavior has separate regressions.
  await page.route('**/assets/assistant-chunks/client-*.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `export function getSupabaseClient() {
        return {
          auth: {
            onAuthStateChange() {
              return { data: { subscription: { unsubscribe() {} } } };
            },
            async getSession() {
              return { data: { session: { user: { id: ${JSON.stringify(ACCOUNT_ID)} } } }, error: null };
            },
          },
        };
      }`,
    });
  });
  await page.route('**/v1/guide/turn', async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (body.userMessage.content.includes('[limit]')) {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          schema: 'zodiacs.guide.turn-rejection.draft.v1',
          conversationId: body.conversationId,
          turnId: body.turnId,
          attemptId: body.attemptId,
          clientAuthEpoch: body.clientAuthEpoch,
          code: 'rate_limited',
          retryable: true,
        }),
      });
      return;
    }
    const chart = body.ephemeralContext.baseContext.ownerChart.source;
    const answer = chart
      ? 'Your placements can be read practically. Continue at /birth-chart/.'
      : 'A **practical answer** grounded in Zodiacs.org:\n\n- Continue at /learn/\n- Read [the Moon sign guide](/moon-sign/)';
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: guideEvents(body, answer) });
  });
}

await withPreview({ port: 4404 }, async (baseURL) => {
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    args: STABLE_CHROMIUM_ARGS,
  });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await context.addInitScript(({ savedProfile, accountId, chartId }) => {
      localStorage.setItem('zodiacs.profile.v1', JSON.stringify(savedProfile));
      localStorage.setItem('zodiacs.account-sync-v2.local-owner.v1', JSON.stringify({
        version: 1,
        accountId,
      }));
      localStorage.setItem(`zodiacs.account-sync-v2.account.${accountId}.v1`, JSON.stringify({
        version: 1,
        accountId,
        deviceId: '44444444-4444-4444-8444-444444444444',
        serverCursor: null,
        pendingConsentOperation: null,
        charts: [{
          chartId,
          selectedForSync: true,
          serverRevision: 1,
          pendingOperation: null,
        }],
      }));
      const jwtPart = (value) => btoa(JSON.stringify(value))
        .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
      const accessToken = `${jwtPart({ alg: 'none', typ: 'JWT' })}.${jwtPart({
        aud: 'authenticated',
        exp: 4_102_444_800,
        sub: accountId,
      })}.signature`;
      localStorage.setItem('sb-guide-test-auth-token', JSON.stringify({
        access_token: accessToken,
        refresh_token: 'browser-test-refresh-token',
        expires_at: 4_102_444_800,
        expires_in: 2_147_483_647,
        token_type: 'bearer',
        user: { id: accountId, aud: 'authenticated', role: 'authenticated' },
      }));
      window.__guideAnalytics = [];
      window.__profileReads = 0;
      window.__profileAllowed = true;
      window.zodiacsAnalytics = { track(...args) { window.__guideAnalytics.push(args); } };
      window.zodiacsProfileAccess = { canRead() { return window.__profileAllowed; } };
      const original = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (key === 'zodiacs.profile.v1') window.__profileReads += 1;
        return original.call(this, key);
      };
    }, { savedProfile: profile, accountId: ACCOUNT_ID, chartId: CHART_ID });

    const page = await context.newPage();
    const requests = [];
    const assistantAssets = [];
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith('/assets/assistant-') || pathname === '/assets/guide-avatar.webp') {
        assistantAssets.push(pathname);
      }
    });
    await installGuideRoute(page, requests);
    await page.goto(`${baseURL}/ask/?private=must-not-leak`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-account-sync-v2', '');
      window.__profileReads = 0;
    });

    const launcher = page.locator('[data-guide-launcher]');
    await launcher.waitFor({ state: 'visible', timeout: 15_000 });
    await page.evaluate(() => { window.__initialGuideLauncher = document.querySelector('[data-guide-launcher]'); });
    const launcherBox = await launcher.boundingBox();
    check('Guide launcher is an accessible icon with a full circular touch target',
      (await launcher.textContent())?.trim() === ''
      && await launcher.getAttribute('aria-label') === 'Open Guide'
      && Boolean(launcherBox) && launcherBox.width >= 44 && launcherBox.height >= 44
      && Math.abs(launcherBox.width - launcherBox.height) <= 1, JSON.stringify(launcherBox));
    check('pre-action shell does not fetch the private drawer graph',
      !assistantAssets.some((path) => path === '/assets/assistant-drawer.js'
        || path === '/assets/assistant-drawer.css'
        || path.startsWith('/assets/assistant-chunks/')),
      assistantAssets.join(' | '));
    const launcherAvatar = launcher.locator('.zguide-launcher__avatar');
    await launcherAvatar.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.zguide-launcher__avatar')
      ?.getAttribute('data-guide-portrait') === 'ready');
    check('launcher uses the bounded local Guide avatar accessibly',
      await launcherAvatar.evaluate((node) => node.tagName === 'CANVAS'
        && node.getAttribute('aria-hidden') === 'true'
        && node.getAttribute('role') === 'presentation'
        && node.getAttribute('data-guide-portrait') === 'ready'
        && node.width > 0 && node.height > 0));
    // The quiet shell stays collapsed until a visitor acts: no proactive
    // invite, no Guide call, no saved-chart read while the page just sits.
    await page.waitForTimeout(2_200);
    check('quiet shell never volunteers an invite', await page.locator('.zguide-invite').count() === 0);
    check('quiet shell neither calls Guide nor reads a chart', requests.length === 0
      && await page.evaluate(() => window.__profileReads) === 0);
    check('quiet shell does not steal focus', await launcher.evaluate((node) => !node.contains(document.activeElement)));

    await launcher.tap();
    const dialog = page.locator('.zassistant__panel');
    const input = page.locator('.zassistant__input');
    await dialog.waitFor({ state: 'visible' });
    check('first action fetches the drawer graph exactly once',
      assistantAssets.filter((path) => path === '/assets/assistant-drawer.js').length === 1
      && assistantAssets.filter((path) => path === '/assets/assistant-drawer.css').length === 1
      && assistantAssets.some((path) => path.startsWith('/assets/assistant-chunks/')),
      assistantAssets.join(' | '));
    check('drawer adopts the stable launcher without duplicating it',
      await page.evaluate(() => document.querySelectorAll('[data-guide-launcher]').length === 1
        && document.querySelector('[data-guide-launcher]') === window.__initialGuideLauncher));
    check('drawer header carries the Guide identity avatar',
      await dialog.locator('.zassistant__avatar[src="/assets/guide-avatar.webp"]').count() === 1);
    check('touch opening focuses the dialog without summoning the composer keyboard',
      await dialog.evaluate((node) => document.activeElement === node)
      && !await input.evaluate((node) => document.activeElement === node));
    if (!GUIDE_AVATAR_ONLY) {
      check('opening is the first saved-chart read', await page.evaluate(() => window.__profileReads) > 0);
    }
    // Visibility begins during the entrance animation; measure the settled sheet.
    await page.waitForFunction(() => {
      const panel = document.querySelector('.zassistant__panel');
      return panel && getComputedStyle(panel).transform === 'none';
    });
    const mobileBox = await dialog.boundingBox();
    check('mobile Guide is an inset compact sheet that leaves the page visible', Boolean(mobileBox)
      && mobileBox.x >= 8 && mobileBox.x + mobileBox.width <= 382
      && mobileBox.y > 200 && mobileBox.height >= 844 * 0.5 && mobileBox.height <= 844 * 0.7
      && Math.abs((mobileBox.y + mobileBox.height) - 834) <= 2, JSON.stringify(mobileBox));
    const expand = page.getByRole('button', { name: 'Expand Guide', exact: true });
    await expand.tap();
    const expandedBox = await dialog.boundingBox();
    check('mobile visitors can expand Guide while retaining a visible page margin', Boolean(expandedBox)
      && expandedBox.height > mobileBox.height
      && expandedBox.height >= 844 * 0.8 && expandedBox.height <= 844 * 0.9
      && await page.locator('.zassistant__expand').getAttribute('aria-pressed') === 'true',
      JSON.stringify(expandedBox));
    await page.locator('.zassistant__expand').tap();
    const compactBox = await dialog.boundingBox();
    check('Guide can return to its compact height', Boolean(compactBox)
      && Math.abs(compactBox.height - mobileBox.height) <= 2
      && await expand.getAttribute('aria-pressed') === 'false');
    check('fixed current-page source ignores private query data',
      (await page.locator('.zassistant__source-chip').textContent() ?? '').includes('Guide')
      && !(await page.locator('.zassistant__source-chip').textContent() ?? '').includes('must-not-leak'));

    await input.fill('What is a square aspect?');
    await page.getByRole('button', { name: 'Close Guide', exact: true }).tap();
    check('Hide dismisses Guide and restores the same icon launcher',
      await page.locator('.zassistant').isHidden()
      && await launcher.evaluate((node) => document.activeElement === node)
      && (await launcher.textContent())?.trim() === '');
    await launcher.tap();
    await dialog.waitFor({ state: 'visible' });
    check('reopening keeps the draft without sending it or focusing the touch composer',
      await input.inputValue() === 'What is a square aspect?' && requests.length === 0
      && await dialog.evaluate((node) => document.activeElement === node));
    await input.press('Enter');
    const cloud = page.locator('.zassistant__consent');
    await cloud.waitFor({ state: 'visible' });
    check('first send pauses for accurate OpenAI disclosure', requests.length === 0
      && (await cloud.textContent() ?? '').includes('OpenAI')
      && (await cloud.textContent() ?? '').includes('30 days'));
    await page.getByRole('button', { name: 'Continue with Guide' }).click();
    const firstGuideMessage = page.locator('.zassistant__message--assistant')
      .filter({ hasText: 'practical answer' });
    await firstGuideMessage.waitFor();
    check('Guide messages carry the same decorative identity avatar',
      await firstGuideMessage.locator('.zassistant__message-avatar[src="/assets/guide-avatar.webp"]')
        .count() === 1);
    if (GUIDE_AVATAR_ONLY) {
      check('focused avatar drive has no page errors', errors.length === 0, errors.join(' | '));
      if (OUT) await page.screenshot({ path: `${OUT}/guide-avatar.png`, fullPage: false });
      await context.close();
      return;
    }
    const first = requests[0];
    check('Guide uses the canonical ephemeral transport', first.schema === 'zodiacs.guide.ephemeral-turn.draft.v1'
      && first.mode === 'ephemeral');
    check('ordinary turn contains no chart', first.ephemeralContext.baseContext.ownerChart.state === 'unavailable');
    check('page context is a fixed site_page catalog selector', first.ephemeralContext.attachments.length === 1
      && first.ephemeralContext.attachments[0].kind === 'site_page'
      && first.ephemeralContext.attachments[0].sourceId === 'page:guide');
    check('request leaks no query or saved PII', !/must-not-leak|Secret Person|private-chart-id|1990-04-17|08:45|Bangkok|13\.7563|100\.5018/.test(JSON.stringify(first)));
    check('approved response paths become safe links',
      await page.locator('.zassistant__link[href="/learn/"]').count() === 1
        && await page.locator('.zassistant__link[href="/moon-sign/"]').count() === 1);
    check('the markdown subset renders as DOM structure, never raw markup',
      await firstGuideMessage.locator('.zassistant__message-body strong').first().textContent() === 'practical answer'
        && await firstGuideMessage.locator('.zassistant__message-body li').count() === 2
        && await page.locator('.zassistant__link[href="/moon-sign/"]').evaluate((node) => node.textContent) === 'the Moon sign guide'
        && await firstGuideMessage.evaluate((node) => !node.textContent.includes('**') && !node.textContent.includes('](')));

    const conversationId = first.conversationId;
    await page.goto(`${baseURL}/learn/`, { waitUntil: 'networkidle' });
    // A full navigation restores the real flag-off HTML, so re-establish the
    // simulated account-v2 boundary before exercising its selected self chart.
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-account-sync-v2', '');
    });
    await page.locator('[data-guide-launcher]').click();
    await page.locator('.zassistant__panel').waitFor({ state: 'visible' });
    check('daily session restores earlier bubbles after navigation',
      (await page.locator('.zassistant__log').textContent() ?? '').includes('What is a square aspect?'));
    await page.locator('.zassistant__input').fill('How should I start learning?');
    await page.locator('.zassistant__input').press('Enter');
    const changedScopeConsent = page.locator('.zassistant__consent');
    await changedScopeConsent.waitFor({ state: 'visible' });
    check('a replaced page source renews the visible-scope cloud consent', requests.length === 1);
    await page.getByRole('button', { name: 'Continue with Guide' }).click();
    await page.locator('.zassistant__message--assistant').filter({ hasText: 'practical answer' }).nth(1).waitFor();
    const second = requests[1];
    check('one daily conversation continues across the site', second.conversationId === conversationId);
    check('replaced page context cuts off prior model history but keeps bubbles visible',
      second.ephemeralContext.attachments[0].sourceId === 'page:learn'
      && second.ephemeralContext.history.length === 0
      && second.ephemeralContext.modelHistoryStartSequence > 1);
    check('cloud consent resumes after the changed source is confirmed', await page.locator('.zassistant__consent').count() === 0);

    const beforeRemove = requests.length;
    await page.getByRole('button', { name: /Remove source/ }).click();
    check('This page is visibly removable without a cloud call', requests.length === beforeRemove
      && await page.locator('.zassistant__source-chip').isHidden()
      && await page.getByRole('button', { name: /Use this page/ }).isVisible());

    await page.locator('.zassistant__chart-chip').click();
    const preview = page.locator('.zassistant__consent-preview');
    await preview.waitFor({ state: 'visible' });
    const previewText = (await preview.textContent() ?? '').trim();
    check('chart consent shows exact placement-only text before a call', requests.length === beforeRemove
      && /Sun: \d+°\d{2}′/.test(previewText)
      && previewText.includes('Selected self chart (kept on this device): Secret Person')
      && !/1990-04-17|08:45|Bangkok/.test(previewText));
    await page.getByRole('button', { name: 'Attach my chart' }).click();
    await page.locator('.zassistant__input').fill('What does my chart emphasize?');
    await page.locator('.zassistant__input').press('Enter');
    await page.locator('.zassistant__message--assistant').filter({ hasText: 'Your placements' }).waitFor();
    const chartRequest = requests.at(-1);
    const chartSource = chartRequest.ephemeralContext.baseContext.ownerChart.source;
    const placementPreview = previewText.split('\n\n').at(-1)?.trim();
    check('confirmed chart attaches exactly the placement-only preview', chartSource.facts.trim() === placementPreview);
    check('chart request contains no saved birth PII', !/Secret Person|private-chart-id|1990-04-17|08:45|Bangkok|13\.7563|100\.5018|Asia\/Bangkok/.test(JSON.stringify(chartRequest))
      && !JSON.stringify(chartRequest).includes(CHART_ID)
      && !JSON.stringify(chartRequest).includes(ACCOUNT_ID));

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-account-sync-v2', '');
      window.__profileAllowed = false;
      window.dispatchEvent(new Event('zodiacs:profile-access'));
    });
    check('account-boundary revocation scrubs transcript and session state',
      await page.locator('.zassistant__message').count() === 0
      && !await page.evaluate(() => sessionStorage.getItem('zodiacs.guide.daily-session.v1')?.includes('square aspect')));
    check('no page errors across mobile states', errors.length === 0, errors.join(' | '));
    const analytics = await page.evaluate(() => window.__guideAnalytics);
    check('Guide analytics contain fixed no-property events only',
      analytics.every((args) => args.length === 1 && ['guide_open', 'guide_reply'].includes(args[0]))
      && analytics.some(([name]) => name === 'guide_open')
      && analytics.some(([name]) => name === 'guide_reply'), JSON.stringify(analytics));
    if (OUT) await page.screenshot({ path: `${OUT}/guide-mobile.png`, fullPage: false });
    await context.close();

    const early = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const earlyPage = await early.newPage();
    const earlyAssets = [];
    earlyPage.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith('/assets/assistant-')) earlyAssets.push(pathname);
    });
    await installGuideRoute(earlyPage, []);
    await earlyPage.goto(`${baseURL}/ask/`, { waitUntil: 'domcontentloaded' });
    await earlyPage.locator('[data-assistant-open]').first().click();
    await earlyPage.locator('.zassistant__panel').waitFor({ state: 'visible' });
    check('an explicit CTA opens Guide before the scheduled shell mount without double loading',
      earlyAssets.filter((path) => path === '/assets/assistant-ui.js').length === 1
      && earlyAssets.filter((path) => path === '/assets/assistant-drawer.js').length === 1
      && await earlyPage.locator('[data-guide-launcher]').count() === 1,
      earlyAssets.join(' | '));
    await early.close();

    const stalled = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const stalledPage = await stalled.newPage();
    let releaseShellCss;
    const shellCssGate = new Promise((resolve) => { releaseShellCss = resolve; });
    // The shell stylesheet ships with a cache-busting query — match any version.
    await stalledPage.route('**/assets/assistant-ui.css*', async (route) => {
      await shellCssGate;
      await route.continue();
    });
    await installGuideRoute(stalledPage, []);
    const shellCssRequest = stalledPage.waitForRequest('**/assets/assistant-ui.css*');
    await stalledPage.goto(`${baseURL}/ask/`, { waitUntil: 'domcontentloaded' });
    await shellCssRequest;
    await stalledPage.locator('[data-assistant-open]').first().click();
    releaseShellCss();
    await stalledPage.locator('.zassistant__panel').waitFor({ state: 'visible' });
    check('CTA remains live while the scheduled shell is waiting for its stylesheet',
      await stalledPage.locator('[data-guide-launcher]').count() === 1);
    await stalled.close();

    const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const desktopPage = await desktop.newPage();
    await installGuideRoute(desktopPage, []);
    await desktopPage.goto(`${baseURL}/ask/`, { waitUntil: 'networkidle' });
    await desktopPage.locator('[data-guide-launcher]').click();
    const desktopDialog = desktopPage.locator('.zassistant__panel');
    await desktopDialog.waitFor({ state: 'visible' });
    await desktopPage.waitForFunction(() => {
      const panel = document.querySelector('.zassistant__panel');
      return panel && getComputedStyle(panel).transform === 'none';
    });
    const desktopBox = await desktopDialog.boundingBox();
    check('desktop Guide is a compact inset drawer on the right', Boolean(desktopBox)
      && desktopBox.x > 800 && desktopBox.width <= 440 && desktopBox.width >= 400
      && desktopBox.y >= 180 && desktopBox.height >= 600 && desktopBox.height <= 700
      && Math.abs(desktopBox.x + desktopBox.width - 1264) <= 2
      && Math.abs(desktopBox.y + desktopBox.height - 884) <= 2, JSON.stringify(desktopBox));
    check('desktop opening focuses the composer for typing',
      await desktopPage.locator('.zassistant__input').evaluate((node) => document.activeElement === node));
    const close = desktopPage.getByRole('button', { name: 'Close Guide' });
    const closeBox = await close.boundingBox();
    check('Guide controls retain 44px targets', (closeBox?.width ?? 0) >= 44 && (closeBox?.height ?? 0) >= 44);
    await desktopPage.keyboard.press('Escape');
    check('Escape closes and restores the launcher', await desktopPage.locator('.zassistant').isHidden()
      && await desktopPage.locator('[data-guide-launcher]').evaluate((node) => document.activeElement === node));
    if (OUT) await desktopPage.screenshot({ path: `${OUT}/guide-desktop.png`, fullPage: false });
    await desktop.close();
    await driveLegacyPolarGuide({ browser, baseURL, check, outDir: OUT, installGuideRoute, accountId: ACCOUNT_ID });
  } finally {
    await browser.close();
  }
});

let failed = 0;
for (const result of results) {
  if (!result.ok) failed += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` · ${result.detail}` : ''}`);
}
console.log(failed ? `\n${failed} FAILURE${failed === 1 ? '' : 'S'}` : `\nALL ${results.length} CHECKS PASS`);
process.exit(failed ? 1 : 0);
