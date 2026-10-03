/**
 * Drive /today/ against the static preview.
 *
 *   npm run build
 *   OUT_DIR=/tmp/today-shots npm run test:today:browser
 */
import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const OUT = process.env.OUT_DIR ?? null;
const CHROMIUM = await findChromium();
const manifest = JSON.parse(await readFile(
  new URL('../src/data/daily-publication-manifest.json', import.meta.url),
  'utf8',
));
const daily = JSON.parse(await readFile(new URL('../src/data/daily.json', import.meta.url), 'utf8'));
const MAJOR_ASPECT_ANGLES = [0, 60, 90, 120, 180];

function quietAriesLongitude() {
  const candidates = Array.from({ length: 300 }, (_, index) => index / 10).map((lon) => {
    const nearestOrb = Math.min(...daily.bodies.flatMap((body) => {
      const rawSeparation = Math.abs(body.lon - lon) % 360;
      const separation = rawSeparation > 180 ? 360 - rawSeparation : rawSeparation;
      return MAJOR_ASPECT_ANGLES.map((angle) => Math.abs(separation - angle));
    }));
    return { lon, nearestOrb };
  });
  const best = candidates.sort((a, b) => b.nearestOrb - a.nearestOrb)[0];
  if (!best || best.nearestOrb <= 3) {
    throw new Error(`No deterministic quiet Aries fixture exists for ${daily.date}.`);
  }
  return best.lon;
}

const profile = {
  version: 1,
  settings: { houseSystem: 'whole' },
  charts: [{
    id: 'today-drive',
    name: 'Fixture chart',
    relationship: 'self',
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
    birth: { date: '1990-01-01', time: '12:00', timeKnown: true, place: null },
    summary: {
      engineVersion: 'fixture',
      utcISO: '1990-01-01T12:00:00.000Z',
      houseSystem: 'whole',
      // These positions deliberately make several contacts with the committed
      // daily snapshot while containing no birth details beyond the local fixture.
      bodies: [
        { body: 'Sun', lon: 20.2, retrograde: false },
        { body: 'Moon', lon: 213.1, retrograde: false },
        { body: 'Mercury', lon: 51.1, retrograde: false },
        { body: 'Venus', lon: 93.1, retrograde: false },
        { body: 'Mars', lon: 279.7, retrograde: false },
        { body: 'Jupiter', lon: 302.7, retrograde: false },
        { body: 'Saturn', lon: 104.6, retrograde: false },
        { body: 'Uranus', lon: 244.3, retrograde: false },
        { body: 'Neptune', lon: 184.4, retrograde: false },
        { body: 'Pluto', lon: 124.6, retrograde: false },
      ],
      angles: { asc: 290, mc: 200 },
      flags: [],
    },
  }],
};

const LONG_CHART_NAME = 'AChartNameThatKeepsGoingWithoutAnyBreakOpportunityForTheEntireMobileViewport';
const threeHitMobileProfile = {
  ...profile,
  charts: [{ ...profile.charts[0], id: 'today-drive-mobile-active', name: LONG_CHART_NAME }],
};
const quietMobileProfile = {
  ...profile,
  charts: [{
    ...profile.charts[0],
    id: 'today-drive-mobile-quiet',
    name: LONG_CHART_NAME,
    summary: {
      ...profile.charts[0].summary,
      bodies: [{ body: 'Sun', lon: quietAriesLongitude(), retrograde: false }],
      angles: null,
    },
  }],
};

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

async function newTodayPage(browser, options) {
  const page = await browser.newPage(options);
  return page;
}

async function observeLayoutShifts(page) {
  await page.addInitScript(() => {
    globalThis.__zdxLayoutShifts = [];
    globalThis.__zdxLayoutShiftDetails = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          globalThis.__zdxLayoutShifts.push(entry.value);
          globalThis.__zdxLayoutShiftDetails.push({
            value: entry.value,
            startTime: entry.startTime,
            readyState: document.readyState,
            fonts: document.fonts.status,
            sources: entry.sources.map(({ node, previousRect, currentRect }) => ({
              node: node ? { tag: node.nodeName, id: node.id, class: node.getAttribute?.('class') } : null,
              previousRect: previousRect.toJSON(),
              currentRect: currentRect.toJSON(),
            })),
          });
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

async function measuredCls(page) {
  await page.evaluate(() => new Promise((resolvePaint) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolvePaint()));
  }));
  const cls = await page.evaluate(() => globalThis.__zdxLayoutShifts.reduce((sum, value) => sum + value, 0));
  if (cls !== 0) {
    const failureDir = OUT ?? 'tests/visual/artifacts/today';
    await mkdir(failureDir, { recursive: true });
    const shifts = await page.evaluate(() => globalThis.__zdxLayoutShiftDetails);
    await writeFile(`${failureDir}/layout-shifts-${Date.now()}.json`, JSON.stringify(shifts, null, 2));
  }
  return cls;
}

async function inspectReturningMobile(BASE, browser, fixtureProfile, state, expectedContacts) {
  const page = await newTodayPage(browser, {
    // Tall enough that content after the card participates in the CLS impact
    // region; a placeholder collapse cannot hide below the fold.
    viewport: { width: 360, height: 1800 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await observeLayoutShifts(page);
  await page.addInitScript(({ savedProfile }) => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify(savedProfile));
    localStorage.setItem('zodiacs.today.v1', JSON.stringify({
      version: 1,
      count: 364,
      lastOpenedUtcDay: yesterday,
    }));
  }, { savedProfile: fixtureProfile });
  await page.goto(`${BASE}/today/`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`.today-reading--${state}`);
  const evidence = await page.evaluate(() => new Promise((resolveEvidence) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const reading = document.querySelector('.today-reading--resolved');
      const chartName = document.querySelector('.today-reading__chart-name');
      const body = reading.querySelector('.today-reading__body');
      const bodyLast = body.querySelector('.today-lines li:last-child, .today-quiet__baseline');
      const details = reading.querySelector('.today-method-details');
      const streak = document.querySelector('.today-streak');
      const count = document.querySelector('.today-streak__count');
      const unit = document.querySelector('.today-streak > span');
      const readingStyle = getComputedStyle(reading);
      const chartNameStyle = getComputedStyle(chartName);
      resolveEvidence({
        cls: globalThis.__zdxLayoutShifts.reduce((sum, value) => sum + value, 0),
        pageWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        viewportWidth: innerWidth,
        readingHeight: reading.getBoundingClientRect().height,
        readingMinHeight: readingStyle.minHeight,
        bodyBottomGap: body.getBoundingClientRect().bottom - bodyLast.getBoundingClientRect().bottom,
        readingBottomGap: reading.getBoundingClientRect().bottom - details.getBoundingClientRect().bottom,
        chartNameTitle: chartName.getAttribute('title'),
        chartNameOverflow: chartNameStyle.overflow,
        chartNameTextOverflow: chartNameStyle.textOverflow,
        chartNameRight: chartName.getBoundingClientRect().right,
        headingRight: chartName.parentElement.getBoundingClientRect().right,
        streakText: count.textContent.trim(),
        streakLabel: streak.getAttribute('aria-label'),
        countRight: count.getBoundingClientRect().right,
        unitLeft: unit.getBoundingClientRect().left,
      });
    }));
  }));
  if (evidence.cls !== 0) {
    const failureDir = OUT ?? 'tests/visual/artifacts/today';
    await mkdir(failureDir, { recursive: true });
    const shifts = await page.evaluate(() => globalThis.__zdxLayoutShiftDetails);
    await writeFile(`${failureDir}/returning-${state}-360-layout-shifts.json`, JSON.stringify(shifts, null, 2));
  }
  check(`360px returning ${state}: hydration has exactly zero CLS`, evidence.cls === 0, JSON.stringify(evidence));
  check(
    `360px returning ${state}: resolved reading has no outer fallback reservation or dead tail`,
    evidence.readingMinHeight === '0px'
      && evidence.bodyBottomGap <= 1
      && evidence.readingBottomGap <= 1,
    JSON.stringify(evidence),
  );
  check(
    `360px returning ${state}: long saved-chart name stays inside its heading`,
    evidence.chartNameTitle === LONG_CHART_NAME
      && evidence.chartNameOverflow === 'hidden'
      && evidence.chartNameTextOverflow === 'ellipsis'
      && evidence.chartNameRight <= evidence.headingRight + 0.5,
    JSON.stringify(evidence),
  );
  check(
    `360px returning ${state}: page has no horizontal overflow`,
    evidence.pageWidth <= evidence.viewportWidth,
    `${evidence.pageWidth}/${evidence.viewportWidth}`,
  );
  check(
    `360px returning ${state}: a 365-day streak has a collision-free digit lane`,
    evidence.streakText === '365'
      && evidence.streakLabel === '365 day streak'
      && evidence.countRight <= evidence.unitLeft,
    JSON.stringify(evidence),
  );
  check(
    `360px returning ${state}: expected contact state renders`,
    await page.locator('.today-lines li').count() === expectedContacts
      && (state === 'quiet'
        ? await page.locator('[data-today-quiet] .today-quiet__baseline').isVisible()
          && await page.getByText('Aries Sun-sign baseline', { exact: true }).isVisible()
        : true),
  );
  if (OUT) await page.screenshot({ path: `${OUT}/today-returning-${state}-360.png`, fullPage: true });
  await page.close();
}

async function drive(BASE, browser) {
  if (OUT) await mkdir(OUT, { recursive: true });
  // The tall viewport keeps the SSR reading grid inside the impact region, so
  // a returning-user collapse cannot hide below the fold and evade CLS.
  const desktop = await newTodayPage(browser, { viewport: { width: 1440, height: 1400 } });
  await observeLayoutShifts(desktop);
  await desktop.addInitScript((value) => {
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify(value));
  }, profile);
  let apiRequests = 0;
  await desktop.route('**/api/**', (route) => {
    apiRequests += 1;
    return route.abort();
  });
  await desktop.goto(`${BASE}/today/`, { waitUntil: 'networkidle' });
  await desktop.waitForSelector('[data-today-state="chart"]');
  await desktop.waitForTimeout(2_100);
  check(
    'Today geometry stays free of proactive Guide popovers',
    await desktop.locator('.zguide-invite').count() === 0,
  );
  const savedChartHeight = await desktop.locator('.today-reading').evaluate((node) => node.getBoundingClientRect().height);
  const savedChartCls = await measuredCls(desktop);
  check('saved-chart hydration has exactly zero CLS', savedChartCls === 0, `${savedChartCls} · ${savedChartHeight}px reading`);
  check('saved chart renders a real brief', await desktop.locator('.today-lines li').count() >= 2);
  check('saved chart replaces the Sun-sign baseline', await desktop.locator('#today-sun-sign-reading [data-today-sun-sign]').count() === 0);
  check('brief makes no backend requests', apiRequests === 0, `${apiRequests} requests`);
  await desktop.context().setOffline(true);
  check('rendered brief remains available offline', await desktop.locator('.today-lines').isVisible());
  await desktop.context().setOffline(false);
  if (OUT) await desktop.screenshot({ path: `${OUT}/today-1440.png`, fullPage: true });
  await desktop.close();

  const failedMainIsland = await newTodayPage(browser, { viewport: { width: 900, height: 1400 } });
  await observeLayoutShifts(failedMainIsland);
  let failedMainAborts = 0;
  let resolveFailedMainRetry;
  let rejectFailedMainRetry;
  const failedMainRetry = new Promise((resolve, reject) => {
    resolveFailedMainRetry = resolve;
    rejectFailedMainRetry = reject;
  });
  await failedMainIsland.context().route('**/_astro/TodayBrief.*.js*', (route) => {
    failedMainAborts += 1;
    if (failedMainAborts >= 2) resolveFailedMainRetry();
    return route.abort();
  });
  await failedMainIsland.addInitScript((value) => {
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify(value));
  }, profile);
  await failedMainIsland.goto(`${BASE}/today/`, { waitUntil: 'networkidle' });
  const failedMainRetryTimeout = setTimeout(() => {
    rejectFailedMainRetry(new Error('TodayBrief retry was not intercepted within 3 seconds.'));
  }, 3_000);
  try {
    await failedMainRetry;
  } finally {
    clearTimeout(failedMainRetryTimeout);
  }
  const savedChartFallback = failedMainIsland.locator('.today-returning-chart-placeholder');
  const failedMainEvidence = {
    aborts: failedMainAborts,
    profilePresent: await failedMainIsland.evaluate(() => localStorage.getItem('zodiacs.profile.v1') !== null),
    savedChart: await failedMainIsland.locator('html').getAttribute('data-today-saved-chart'),
    chartSign: await failedMainIsland.locator('html').getAttribute('data-today-chart-sun-sign'),
    fallback: await savedChartFallback.isVisible(),
    aries: await failedMainIsland.locator('[data-today-chart-sun="aries"]').isVisible(),
    label: await failedMainIsland.getByText('Aries Sun-sign baseline', { exact: true }).isVisible(),
    link: await failedMainIsland.locator('[data-today-chart-sun="aries"] a[href="/horoscopes/aries/"]').isVisible(),
  };
  check(
    'failed Today island keeps a useful Aries Sun-sign baseline in the reserved shell',
    failedMainEvidence.aborts >= 2
      && failedMainEvidence.profilePresent
      && failedMainEvidence.savedChart === ''
      && failedMainEvidence.chartSign === 'aries'
      && failedMainEvidence.fallback
      && failedMainEvidence.aries
      && failedMainEvidence.label
      && failedMainEvidence.link,
    JSON.stringify(failedMainEvidence),
  );
  const failedMainCls = await measuredCls(failedMainIsland);
  check('failed Today island fallback has exactly zero CLS', failedMainCls === 0, String(failedMainCls));
  await failedMainIsland.close();

  const failedTransits = await newTodayPage(browser, { viewport: { width: 900, height: 1400 } });
  await observeLayoutShifts(failedTransits);
  const failedTransitsErrors = [];
  failedTransits.on('pageerror', (error) => failedTransitsErrors.push(error.message));
  await failedTransits.route('**/_astro/transits.*.js', (route) => route.abort());
  await failedTransits.addInitScript((value) => {
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify(value));
  }, profile);
  await failedTransits.goto(`${BASE}/today/`, { waitUntil: 'networkidle' });
  await failedTransits.waitForFunction(() => (
    document.querySelector('.today-returning-chart-status.is-visible')
      && getComputedStyle(document.querySelector('.today-returning-chart-placeholder')).display !== 'none'
  ));
  check(
    'failed transit chunk keeps the compact Sun-sign baseline in the reserved shell',
    await failedTransits.locator('.today-returning-chart-placeholder').isVisible()
      && await failedTransits.locator('[data-today-chart-sun="aries"]').isVisible()
      && !await failedTransits.locator('.today-fallback').isVisible(),
  );
  check(
    'failed transit chunk explains the fallback without a broken page',
    await failedTransits.locator('.today-returning-chart-placeholder')
      .getByText('saved-chart comparison is temporarily unavailable', { exact: false }).isVisible()
      && failedTransitsErrors.length === 0,
    failedTransitsErrors.join(' | '),
  );
  const failedTransitsCls = await measuredCls(failedTransits);
  check('failed transit chunk has exactly zero CLS', failedTransitsCls === 0, String(failedTransitsCls));
  await failedTransits.close();

  const invalidProfile = await newTodayPage(browser, { viewport: { width: 900, height: 1000 } });
  const invalidProfileErrors = [];
  invalidProfile.on('pageerror', (error) => invalidProfileErrors.push(error.message));
  await invalidProfile.addInitScript(() => {
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify({
      version: 1,
      settings: { houseSystem: 'whole' },
      charts: [{ id: 'invalid-local-chart' }],
    }));
  });
  await invalidProfile.goto(`${BASE}/today/`, { waitUntil: 'networkidle' });
  await invalidProfile.waitForFunction(() => getComputedStyle(document.querySelector('.today-fallback')).display !== 'none');
  check(
    'invalid local profile never traps Today behind the chart placeholder',
    !await invalidProfile.locator('html').getAttribute('data-today-saved-chart')
      && await invalidProfile.locator('.today-fallback').isVisible()
      && invalidProfileErrors.length === 0,
    invalidProfileErrors.join(' | '),
  );
  await invalidProfile.close();

  const hintedInvalidProfile = await newTodayPage(browser, {
    viewport: { width: 360, height: 1800 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await observeLayoutShifts(hintedInvalidProfile);
  const hintedInvalidErrors = [];
  hintedInvalidProfile.on('pageerror', (error) => hintedInvalidErrors.push(error.message));
  await hintedInvalidProfile.addInitScript((validProfile) => {
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify({
      ...validProfile,
      charts: [
        validProfile.charts[0],
        {
          id: 'newer-malformed-local-chart',
          name: 'Malformed newer chart',
          createdAt: '2026-07-12T00:00:00.000Z',
          updatedAt: '2026-07-12T00:00:00.000Z',
        },
      ],
    }));
  }, profile);
  await hintedInvalidProfile.goto(`${BASE}/today/`, { waitUntil: 'networkidle' });
  await hintedInvalidProfile.waitForSelector('[data-today-state="chart"]');
  const hintedInvalidCls = await measuredCls(hintedInvalidProfile);
  check(
    'hint-passing malformed newer chart falls back to the valid saved chart without collapsing',
    await hintedInvalidProfile.locator('html').getAttribute('data-today-saved-chart') === ''
      && await hintedInvalidProfile.locator('.today-reading--resolved').isVisible()
      && hintedInvalidErrors.length === 0,
    hintedInvalidErrors.join(' | '),
  );
  check(
    'hint-passing malformed profile has exactly zero CLS at tall 360px',
    hintedInvalidCls === 0,
    String(hintedInvalidCls),
  );
  await hintedInvalidProfile.close();

  const returningSign = await newTodayPage(browser, { viewport: { width: 900, height: 1400 } });
  await observeLayoutShifts(returningSign);
  await returningSign.addInitScript(() => {
    localStorage.setItem('zodiacs:today-sun-sign:v1', 'leo');
  });
  await returningSign.goto(`${BASE}/today/`, { waitUntil: 'networkidle' });
  await returningSign.waitForFunction(() => (
    document.querySelector('.today-sign[aria-current="true"]')?.getAttribute('href') === '#today-sun-sign-leo'
      && document.querySelectorAll('#today-sun-sign-reading [data-today-sun-sign]').length === 12
  ));
  const returningSignCls = await measuredCls(returningSign);
  const returningSignShifts = await returningSign.evaluate(() => globalThis.__zdxLayoutShiftDetails);
  check('stored Sun-sign hydration has exactly zero CLS', returningSignCls === 0, JSON.stringify({ cls: returningSignCls, shifts: returningSignShifts }));
  if (returningSignCls !== 0) {
    const failureDir = OUT ?? 'tests/visual/artifacts/today';
    await mkdir(failureDir, { recursive: true });
    await writeFile(`${failureDir}/stored-sign-layout-shifts.json`, JSON.stringify(returningSignShifts, null, 2));
    await returningSign.screenshot({ path: `${failureDir}/stored-sign-layout-shift-900.png`, fullPage: true });
  }
  const returningSignState = await returningSign.evaluate(() => ({
    totalReadings: document.querySelectorAll('#today-sun-sign-reading [data-today-sun-sign]').length,
    visibleReadings: Array.from(document.querySelectorAll('#today-sun-sign-reading [data-today-sun-sign]'))
      .filter((node) => getComputedStyle(node).display !== 'none')
      .map((node) => node.getAttribute('data-today-sun-sign')),
    selectedHref: document.querySelector('.today-sign[aria-current="true"]')?.getAttribute('href') ?? null,
  }));
  check(
    'stored Sun sign preserves the SSR readings and restores only Leo visibly',
    returningSignState.totalReadings === 12
      && returningSignState.visibleReadings.length === 1
      && returningSignState.visibleReadings[0] === 'leo'
      && returningSignState.selectedHref === '#today-sun-sign-leo',
    JSON.stringify(returningSignState),
  );
  await returningSign.close();

  const empty = await newTodayPage(browser, { viewport: { width: 900, height: 1400 } });
  const emptyPersonalizationRequests = [];
  empty.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/^\/_astro\/(?:transits|compat)\.[^/]+\.js$/.test(pathname)) {
      emptyPersonalizationRequests.push(pathname);
    }
  });
  await observeLayoutShifts(empty);
  await empty.goto(`${BASE}/today/`, { waitUntil: 'networkidle' });
  await empty.waitForSelector('[data-today-state="empty"]');
  const emptyCls = await measuredCls(empty);
  check('empty Today hydration has exactly zero CLS', emptyCls === 0, String(emptyCls));
  check('no-chart state is honest', await empty.getByText('No saved chart on this device.').isVisible());
  check('no-chart state renders all twelve sign notes', await empty.locator('#today-sun-sign-reading [data-today-sun-sign]').count() === 12);
  check(
    'sign picker uses all twelve pastel icon assets',
    await empty.locator('.today-sign-picker .today-sign__icon img[src^="/assets/zodiac-icons/48/"]').count() === 12,
  );
  check(
    'sign notes use all twelve pastel icon assets',
    await empty.locator('[data-today-all-signs] .today-sign-reading__icon img[src^="/assets/zodiac-icons/48/"]').count() === 12,
  );
  check('no-chart state links to the calculator', await empty.locator('.today-fallback__personalize a[href="/birth-chart/"]').isVisible());
  check(
    'verified edition markers match the manifest',
    await empty.locator(`[data-daily-date="${manifest.date}"][data-generation-mode="${manifest.generation.mode}"]`).count() === 1,
  );
  check('edition details are summarized without leading the page', await empty.locator('.today-provenance summary').isVisible());
  check('edition details are closed by default', await empty.locator('.today-provenance').evaluate((node) => !node.open));
  check('public provenance link remains available', await empty.locator('a[href="/data/daily-publication.json"]').count() === 1);
  if (OUT) await empty.screenshot({ path: `${OUT}/today-empty-900.png`, fullPage: true });
  await empty.locator('a[href="#today-sun-sign-leo"]').click();
  await empty.waitForFunction(() => document.querySelectorAll('#today-sun-sign-reading [data-today-sun-sign]').length === 1);
  check('enhanced sign link narrows to one note', await empty.locator('#today-sun-sign-reading [data-today-sun-sign="leo"]').count() === 1);
  check('selected sign keeps its pastel icon', await empty.locator('#today-sun-sign-reading [data-today-sun-sign="leo"] .today-sign-reading__icon img[src$="/leo.webp"]').count() === 1);
  const selectedHash = await empty.evaluate(() => location.hash);
  check('enhanced sign link keeps native hash navigation', selectedHash === '#today-sun-sign-leo', selectedHash);
  check(
    'first visit and Sun-sign selection do not request transit or compatibility chunks',
    emptyPersonalizationRequests.length === 0,
    JSON.stringify(emptyPersonalizationRequests),
  );
  const requestsBeforeChartSave = emptyPersonalizationRequests.length;
  await empty.evaluate((savedProfile) => {
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify(savedProfile));
    window.dispatchEvent(new CustomEvent('zodiacs:profile', { detail: savedProfile }));
  }, profile);
  await empty.waitForSelector('[data-today-state="chart"]');
  const chartSaveRequests = emptyPersonalizationRequests.slice(requestsBeforeChartSave);
  check(
    'same-window chart save requests transit copy on demand',
    chartSaveRequests.some((pathname) => pathname.startsWith('/_astro/transits.')),
    JSON.stringify(chartSaveRequests),
  );
  check(
    'same-window chart save renders the current saved chart and replaces the Sun-sign notes',
    await empty.locator('.today-reading--resolved').isVisible()
      && await empty.locator('.today-reading__chart-name').innerText() === profile.charts[0].name
      && await empty.locator('.today-lines li').count() >= 2
      && await empty.locator('#today-sun-sign-reading [data-today-sun-sign]').count() === 0,
  );
  await empty.close();

  const noJs = await newTodayPage(browser, {
    viewport: { width: 900, height: 800 },
    javaScriptEnabled: false,
  });
  await noJs.goto(`${BASE}/today/`, { waitUntil: 'networkidle' });
  check('no-JavaScript page renders all twelve sign notes', await noJs.locator('#today-sun-sign-reading [data-today-sun-sign]').count() === 12);
  check('no-JavaScript sign notes link to full horoscopes', await noJs.locator('#today-sun-sign-reading [data-today-sun-sign] a[href^="/horoscopes/"]').count() === 12);
  check('no-JavaScript page has no loading gate', await noJs.locator('.today-loading').count() === 0);
  const noJsEdition = noJs.locator('.today-provenance');
  check('no-JavaScript page keeps native edition details', await noJsEdition.count() === 1);
  check('no-JavaScript edition details start closed', await noJsEdition.evaluate((node) => !node.open));
  check('no-JavaScript edition summary stays visible', await noJsEdition.locator('summary').isVisible());
  await noJsEdition.locator('summary').click();
  check(
    'no-JavaScript edition evidence opens on request',
    await noJs.getByText('Each reading is tied to the recorded sky', { exact: false }).isVisible(),
  );
  check(
    'edition note keeps a space before its date',
    (await noJsEdition.innerText()).includes(`for ${manifest.date}`),
  );
  check(
    'Today does not lead with AI-operations language',
    await noJs.getByText('Zodiacs.org is AI-operated.', { exact: false }).count() === 0,
  );
  if (OUT) await noJs.screenshot({ path: `${OUT}/today-nojs-900.png`, fullPage: true });
  await noJs.close();

  const fallbackMobile = await newTodayPage(browser, {
    // Match Lighthouse's default mobile screen so its zero-CLS contract is
    // covered by the browser drive as well as the performance audit.
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    hasTouch: true,
  });
  await observeLayoutShifts(fallbackMobile);
  await fallbackMobile.goto(`${BASE}/today/`, { waitUntil: 'networkidle' });
  await fallbackMobile.waitForSelector('[data-today-state="empty"]');
  const fallbackEvidence = await fallbackMobile.evaluate(() => new Promise((resolveEvidence) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const cards = [...document.querySelectorAll('.today-sign')];
      const icons = cards.map((card) => card.querySelector('.today-sign__icon'));
      const cardRects = cards.map((card) => card.getBoundingClientRect());
      const iconRects = icons.map((icon) => icon.getBoundingClientRect());
      resolveEvidence({
        cls: globalThis.__zdxLayoutShifts.reduce((sum, value) => sum + value, 0),
        page: document.documentElement.scrollWidth,
        viewport: innerWidth,
        cardHeights: cardRects.map((rect) => rect.height),
        iconSizes: iconRects.map((rect) => [rect.width, rect.height]),
        iconInsets: iconRects.map((rect, index) => rect.top - cardRects[index].top),
        rowPitches: cardRects.slice(3).map((rect, index) => rect.top - cardRects[index].top),
      });
    }));
  }));
  check(
    '412px Sun-sign baseline has no horizontal overflow',
    fallbackEvidence.page <= fallbackEvidence.viewport,
    `${fallbackEvidence.page}/${fallbackEvidence.viewport}`,
  );
  check(
    '412px Sun-sign picker hydration has exactly zero CLS',
    fallbackEvidence.cls === 0,
    JSON.stringify(fallbackEvidence),
  );
  check(
    '412px Sun-sign picker keeps fixed card and icon geometry',
    fallbackEvidence.cardHeights.length === 12
      && fallbackEvidence.cardHeights.every((height) => height === 88)
      && fallbackEvidence.iconSizes.every(([width, height]) => width === 34 && height === 34)
      && fallbackEvidence.iconInsets.every((inset) => inset === 10)
      && fallbackEvidence.rowPitches.every((pitch) => pitch === 96),
    JSON.stringify(fallbackEvidence),
  );
  await fallbackMobile.setViewportSize({ width: 375, height: 812 });
  const fallbackNarrowWidth = await fallbackMobile.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  check(
    '375px Sun-sign baseline has no horizontal overflow',
    fallbackNarrowWidth.page <= fallbackNarrowWidth.viewport,
    `${fallbackNarrowWidth.page}/${fallbackNarrowWidth.viewport}`,
  );
  if (OUT) await fallbackMobile.screenshot({ path: `${OUT}/today-empty-375.png`, fullPage: true });
  await fallbackMobile.close();

  const reduced = await newTodayPage(browser, {
    viewport: { width: 900, height: 800 },
    reducedMotion: 'reduce',
  });
  await reduced.addInitScript((value) => {
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify(value));
  }, profile);
  await reduced.goto(`${BASE}/today/`, { waitUntil: 'networkidle' });
  await reduced.waitForSelector('.today-streak__count');
  const animation = await reduced.locator('.today-streak__count').evaluate((node) => {
    const style = getComputedStyle(node);
    return { name: style.animationName, duration: style.animationDuration };
  });
  check('reduced motion makes the streak instant', animation.name === 'none' || animation.duration === '0s', JSON.stringify(animation));
  await reduced.close();

  const mobile = await newTodayPage(browser, {
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await mobile.addInitScript((value) => {
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify(value));
  }, profile);
  await mobile.goto(`${BASE}/today/`, { waitUntil: 'networkidle' });
  await mobile.waitForSelector('[data-today-state="chart"]');
  const width = await mobile.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  check('375px layout has no horizontal overflow', width.page <= width.viewport, `${width.page}/${width.viewport}`);
  if (OUT) await mobile.screenshot({ path: `${OUT}/today-375.png`, fullPage: true });
  await mobile.close();

  await inspectReturningMobile(BASE, browser, threeHitMobileProfile, 'active', 3);
  await inspectReturningMobile(BASE, browser, quietMobileProfile, 'quiet', 0);
}

await withPreview({ port: 4398 }, async (BASE) => {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: STABLE_CHROMIUM_ARGS,
  });
  try {
    await drive(BASE, browser);
  } finally {
    await browser.close();
  }
});

let failures = 0;
for (const result of results) {
  if (!result.ok) failures += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` · ${result.detail}` : ''}`);
}
console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
process.exit(failures ? 1 : 0);
