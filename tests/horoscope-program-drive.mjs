/**
 * Browser contract for the Phase 1 horoscope program.
 *
 *   npm run build
 *   OUT_DIR=/tmp/horoscope-program node tests/horoscope-program-drive.mjs
 *
 * Point ZODIACS_TEST_BASE_URL at an existing preview to skip spawning one.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const OUT = process.env.OUT_DIR ?? null;
const CHROMIUM = await findChromium();
const DAILY = JSON.parse(await readFile(new URL('../src/data/daily.json', import.meta.url), 'utf8'));
const PROGRAM = JSON.parse(await readFile(new URL('../src/data/horoscope-program.json', import.meta.url), 'utf8'));
const LONG_CHART_NAME = 'AChartNameThatKeepsGoingWithoutAnyBreakOpportunityForTheEntireMobileViewport';
const DAILY_FOR_YOU_MOVERS = new Set(['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']);
const MAJOR_ASPECT_ANGLES = [0, 60, 90, 120, 180];

function quietAriesLongitude() {
  const sky = DAILY.bodies.filter((body) => DAILY_FOR_YOU_MOVERS.has(body.body));
  const candidates = Array.from({ length: 300 }, (_, index) => index / 10).map((lon) => {
    const nearestOrb = Math.min(...sky.flatMap((body) => {
      const rawSeparation = Math.abs(body.lon - lon) % 360;
      const separation = rawSeparation > 180 ? 360 - rawSeparation : rawSeparation;
      return MAJOR_ASPECT_ANGLES.map((angle) => Math.abs(separation - angle));
    }));
    return { lon, nearestOrb };
  });
  const best = candidates.sort((a, b) => b.nearestOrb - a.nearestOrb)[0];
  if (!best || best.nearestOrb <= 3) {
    throw new Error(`No deterministic quiet Aries fixture exists for ${DAILY.date}.`);
  }
  return best.lon;
}

const RETURNING_PROFILE = {
  version: 1,
  settings: { houseSystem: 'whole' },
  charts: [{
    id: 'phase1-returning-aries',
    name: 'Fixture chart',
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
    birth: { date: '1990-01-01', time: '12:00', timeKnown: true, place: null },
    summary: {
      engineVersion: 'fixture',
      utcISO: '1990-01-01T12:00:00.000Z',
      houseSystem: 'whole',
      bodies: DAILY.bodies.map((body) => ({
        body: body.body,
        lon: body.body === 'Sun' ? 20.2 : body.lon,
        retrograde: body.retrograde === true,
      })),
      angles: { asc: 290, mc: 200 },
      flags: [],
    },
  }],
};
const THREE_HIT_MOBILE_PROFILE = {
  ...RETURNING_PROFILE,
  charts: [{ ...RETURNING_PROFILE.charts[0], id: 'phase1-mobile-active', name: LONG_CHART_NAME }],
};
const QUIET_MOBILE_PROFILE = {
  ...RETURNING_PROFILE,
  charts: [{
    ...RETURNING_PROFILE.charts[0],
    id: 'phase1-mobile-quiet',
    name: LONG_CHART_NAME,
    summary: {
      ...RETURNING_PROFILE.charts[0].summary,
      bodies: [{ body: 'Sun', lon: quietAriesLongitude(), retrograde: false }],
      angles: null,
    },
  }],
};
const tomorrowDate = PROGRAM.signs[0].readings.tomorrow.period.from;
const TOMORROW_MOON_PHASE = PROGRAM.evidence.find((receipt) => (
  receipt.id === `fact:${tomorrowDate}:body:moon:1200z`
))?.moonPhase;

// Today, This week and This month form the period switch; Tomorrow, Love,
// Career and the year (with the week and month again) are the "More for"
// list under the reading. Every canonical period stays one link away.
const SWITCH = [
  ['Today', ''],
  ['This week', 'weekly'],
  ['This month', 'monthly'],
];
const PERIOD_SUFFIXES = ['', 'tomorrow', 'weekly', 'monthly', 'love', 'career', '2027'];

const ROUTES = [
  { key: 'daily', sign: 'aries', name: 'Aries', suffix: '', title: 'daily horoscope', active: 'Today', minWords: 90 },
  { key: 'tomorrow', sign: 'taurus', name: 'Taurus', suffix: 'tomorrow', title: 'tomorrow horoscope', active: 'Tomorrow', minWords: 90 },
  { key: 'weekly', sign: 'libra', name: 'Libra', suffix: 'weekly', title: 'weekly horoscope', active: 'This week', minWords: 200 },
  { key: 'monthly', sign: 'cancer', name: 'Cancer', suffix: 'monthly', title: 'monthly horoscope', active: 'This month', minWords: 250 },
  { key: 'love', sign: 'scorpio', name: 'Scorpio', suffix: 'love', title: 'love horoscope', active: 'Love', minWords: 60 },
  { key: 'career', sign: 'capricorn', name: 'Capricorn', suffix: 'career', title: 'career horoscope', active: 'Career', minWords: 60 },
  { key: 'year', sign: 'pisces', name: 'Pisces', suffix: '2027', title: '2027 horoscope', active: 'Pisces in 2027', minWords: 1_200 },
].map((route) => ({
  ...route,
  path: `/horoscopes/${route.sign}/${route.suffix ? `${route.suffix}/` : ''}`,
  heading: `${route.name} ${route.title}`,
}));

const VIEWPORTS = [
  { key: 'desktop', width: 1280, height: 900, deviceScaleFactor: 1, hasTouch: false },
  { key: 'mobile', width: 360, height: 800, deviceScaleFactor: 2, hasTouch: true },
];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

function countWords(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function safeName(value) {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

async function installLayoutShiftObserver(page) {
  await page.addInitScript(() => {
    globalThis.__zdxProgramLayoutShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) globalThis.__zdxProgramLayoutShifts.push(entry.value);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

async function inspectReturningDailyForYou(browser, baseURL) {
  const context = await browser.newContext({
    baseURL,
    reducedMotion: 'no-preference',
    viewport: { width: 1280, height: 1400 },
  });
  const page = await context.newPage();
  try {
    await installLayoutShiftObserver(page);
    await page.addInitScript((value) => {
      localStorage.setItem('zodiacs.profile.v1', JSON.stringify(value));
    }, RETURNING_PROFILE);
    await page.goto('/horoscopes/aries/', { waitUntil: 'networkidle' });
    // DailyForYou hydrates with client:visible, and the reading now fills the
    // first screen above it. Bring its reserved block into view first.
    await page.locator('.dfy').first().scrollIntoViewIfNeeded();
    await page.waitForSelector('.dfy:not(.dfy--placeholder)');
    const evidence = await page.evaluate(() => new Promise((resolveEvidence) => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const block = document.querySelector('.dfy:not(.dfy--placeholder)');
        resolveEvidence({
          cls: globalThis.__zdxProgramLayoutShifts.reduce((sum, value) => sum + value, 0),
          height: block?.getBoundingClientRect().height ?? 0,
          prepaintHint: document.documentElement.hasAttribute('data-dfy-saved-chart'),
        });
      }));
    }));
    check(
      'daily returning chart: DailyForYou hydration has exactly zero CLS',
      evidence.cls === 0,
      `${evidence.cls} · ${evidence.height}px block`,
    );
    check(
      'daily returning chart: matching Sun-sign prepaint hint is present',
      evidence.prepaintHint,
      String(evidence.prepaintHint),
    );
    check(
      'daily returning chart: personalized lines replace the placeholder',
      await page.locator('.dfy--placeholder').count() === 0
        && await page.locator('.dfy__lines li').count() === 3,
    );
  } finally {
    await context.close();
  }
}

async function inspectReturningDailyForYouMobile(browser, baseURL, fixtureProfile, state, expectedContacts) {
  const context = await browser.newContext({
    baseURL,
    reducedMotion: 'no-preference',
    viewport: { width: 360, height: 1800 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await installLayoutShiftObserver(page);
    await page.addInitScript((value) => {
      localStorage.setItem('zodiacs.profile.v1', JSON.stringify(value));
    }, fixtureProfile);
    await page.goto('/horoscopes/aries/', { waitUntil: 'networkidle' });
    await page.locator('.dfy').first().scrollIntoViewIfNeeded();
    await page.waitForSelector(`.dfy${state === 'quiet' ? ':has(.dfy__quiet)' : ':has(.dfy__lines)'}`);
    const evidence = await page.evaluate(() => new Promise((resolveEvidence) => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const block = document.querySelector('.dfy:not(.dfy--placeholder)');
        const stamp = block.querySelector('.dfy__stamp');
        const body = block.querySelector('.dfy__body');
        const bodyLast = body.lastElementChild;
        const blockStyle = getComputedStyle(block);
        const stampStyle = getComputedStyle(stamp);
        resolveEvidence({
          cls: globalThis.__zdxProgramLayoutShifts.reduce((sum, value) => sum + value, 0),
          pageWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          viewportWidth: innerWidth,
          blockHeight: block.getBoundingClientRect().height,
          blockMinHeight: blockStyle.minHeight,
          bodyBottomGap: body.getBoundingClientRect().bottom - bodyLast.getBoundingClientRect().bottom,
          bodyClientHeight: body.clientHeight,
          bodyScrollHeight: body.scrollHeight,
          stampTitle: stamp.getAttribute('title'),
          stampText: stamp.textContent.trim(),
          stampOverflow: stampStyle.overflow,
          stampTextOverflow: stampStyle.textOverflow,
          stampRight: stamp.getBoundingClientRect().right,
          blockRight: block.getBoundingClientRect().right,
        });
      }));
    }));
    check(`DailyForYou 360px ${state}: hydration has exactly zero CLS`, evidence.cls === 0, JSON.stringify(evidence));
    check(
      `DailyForYou 360px ${state}: resolved card has no outer fallback reservation or dead body tail`,
      // 'auto' as a grid item, '0px' in block flow: either way, no reservation.
      ['auto', '0px'].includes(evidence.blockMinHeight)
        && Math.abs(evidence.bodyBottomGap) <= 1
        && evidence.bodyScrollHeight <= evidence.bodyClientHeight + 1,
      JSON.stringify(evidence),
    );
    check(
      `DailyForYou 360px ${state}: long saved-chart name is accessibly contained`,
      evidence.stampTitle === `${LONG_CHART_NAME} · ${DAILY.date}`
        && evidence.stampText === `Saved chart · ${DAILY.date}`
        && evidence.stampOverflow === 'hidden'
        && evidence.stampTextOverflow === 'ellipsis'
        && evidence.stampRight <= evidence.blockRight + 0.5,
      JSON.stringify(evidence),
    );
    check(
      `DailyForYou 360px ${state}: page has no horizontal overflow`,
      evidence.pageWidth <= evidence.viewportWidth,
      `${evidence.pageWidth}/${evidence.viewportWidth}`,
    );
    check(
      `DailyForYou 360px ${state}: expected contact state renders`,
      await page.locator('.dfy__lines li').count() === expectedContacts
        && (state === 'quiet' ? await page.locator('.dfy__quiet').isVisible() : true),
    );
    if (OUT) await page.screenshot({ path: `${OUT}/daily-for-you-returning-${state}-360.png`, fullPage: true });
  } finally {
    await context.close();
  }
}

async function inspectHubFocusRing(browser, baseURL) {
  const context = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  try {
    await page.goto('/horoscopes/', { waitUntil: 'networkidle' });
    const summary = page.locator('.horo-method summary');
    await summary.focus();
    const ring = await summary.evaluate((node) => {
      const style = getComputedStyle(node);
      return { color: style.outlineColor, style: style.outlineStyle, width: style.outlineWidth };
    });
    const focusRingPass = ring.color === 'rgb(238, 241, 247)'
      && ring.style !== 'none'
      && Number.parseFloat(ring.width) >= 2;
    check(
      'horoscopes hub: focus-visible disclosure uses the high-contrast ink ring',
      focusRingPass,
      JSON.stringify(ring),
    );
  } finally {
    await context.close();
  }
}

async function inspectStaleEditionLabels(browser, baseURL) {
  const staleInstant = new Date(`${PROGRAM.anchorDate}T12:00:00.000Z`);
  staleInstant.setUTCDate(staleInstant.getUTCDate() + 1);
  const editionLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${PROGRAM.anchorDate}T00:00:00.000Z`));
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 900, height: 1000 },
  });
  await context.addInitScript((fixedInstant) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [fixedInstant]));
      }

      static now() {
        return new NativeDate(fixedInstant).getTime();
      }
    }
    globalThis.Date = FixedDate;
  }, staleInstant.toISOString());

  try {
    for (const route of [
      { path: '/today/', scope: '.today-page', name: 'today brief' },
      { path: '/horoscopes/', scope: '[data-edition-content]', name: 'horoscope hub' },
      { path: '/horoscopes/aries/', scope: '.program[data-edition-content]', name: 'daily sign' },
    ]) {
      const page = await context.newPage();
      try {
        await page.goto(route.path, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.documentElement.dataset.editionState === 'dated');
        await page.evaluate(() => new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }));
        const text = await page.locator(route.scope).innerText();
        check(
          `${route.name}: prior-day edition is marked dated`,
          await page.locator('html[data-edition-state="dated"]').count() === 1,
        );
        check(
          `${route.name}: prior-day edition never presents relative Today copy`,
          !/\btoday(?:[’']s)?\b/iu.test(text) && text.includes(editionLabel),
          text.match(/.{0,35}\btoday(?:[’']s)?\b.{0,35}/iu)?.[0] ?? 'dated copy shown',
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
  }
}

async function inspectEditionMidnightRollover(browser, baseURL) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 900, height: 1000 },
  });
  const page = await context.newPage();
  const editionLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${PROGRAM.anchorDate}T00:00:00.000Z`));

  try {
    // Leave enough frozen-clock headroom for slower CI navigation before the
    // deliberate rollover; a 500 ms margin made this probe timing-dependent.
    await page.clock.install({ time: new Date(`${PROGRAM.anchorDate}T23:59:50.000Z`) });
    await page.goto('/today/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.editionState === 'current');
    await page.waitForSelector('[data-today-state="empty"]');
    await page.clock.fastForward(11_000);
    await page.waitForFunction(() => document.documentElement.dataset.editionState === 'dated');
    await page.locator('.today-page').evaluate((scope) => {
      const probe = document.createElement('p');
      probe.dataset.rolloverProbe = 'true';
      probe.setAttribute('aria-label', 'Today’s hydrated label');
      probe.textContent = 'Today’s hydrated note';
      scope.append(probe);
    });
    await page.waitForFunction((label) => {
      const probe = document.querySelector('[data-rollover-probe]');
      return probe?.textContent?.includes(label)
        && probe.getAttribute('aria-label')?.includes(label);
    }, editionLabel);
    const probe = page.locator('[data-rollover-probe]');
    const [text, ariaLabel] = await Promise.all([
      probe.innerText(),
      probe.getAttribute('aria-label'),
    ]);
    check(
      'today brief: open page changes from current to dated at UTC midnight',
      await page.locator('html[data-edition-state="dated"]').count() === 1,
    );
    check(
      'today brief: post-rollover hydrated text and labels are dated',
      [text, ariaLabel ?? ''].every((value) => (
        value.includes(editionLabel) && !/\btoday(?:[’']s)?\b/iu.test(value)
      )),
      `${text} · ${ariaLabel ?? ''}`,
    );
  } finally {
    await context.close();
  }
}

async function inspectDailyForYouChunkFailure(browser, baseURL) {
  const context = await browser.newContext({
    baseURL,
    reducedMotion: 'no-preference',
    viewport: { width: 1280, height: 900 },
    // The production worker precaches hashed Astro chunks. Block it here so
    // this probe exercises a real network failure instead of a cached module.
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  try {
    let blockedChunkRequests = 0;
    await page.addInitScript((value) => {
      localStorage.setItem('zodiacs.profile.v1', JSON.stringify(value));
    }, RETURNING_PROFILE);
    await page.route(/DailyForYou[^/]*\.js(?:\?.*)?$/u, async (route) => {
      blockedChunkRequests += 1;
      await route.abort();
    });
    await page.goto('/horoscopes/aries/', { waitUntil: 'networkidle' });
    const fallback = page.locator('.dfy--placeholder');
    // DailyForYou hydrates with client:visible. Move the reserved fallback into
    // view so this probe actually requests—and blocks—the island chunk.
    await fallback.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    check(
      'daily island failure: the DailyForYou chunk was blocked by the harness',
      blockedChunkRequests > 0,
      String(blockedChunkRequests),
    );
    check(
      'daily island failure: the reserved saved-chart fallback stays visible and useful',
      await fallback.isVisible()
        && (await fallback.innerText()).includes('Your Sun-sign reading is ready above'),
    );
  } finally {
    await context.close();
  }
}

async function checkStaticHtml(baseURL, route) {
  const response = await fetch(`${baseURL}${route.path}`);
  const html = await response.text();
  const canonical = `https://zodiacs.org${route.path}`;

  check(`${route.key}: static response is 200`, response.status === 200, String(response.status));
  check(`${route.key}: heading is present in initial HTML`, html.includes(route.heading));
  check(
    `${route.key}: canonical is present in initial HTML`,
    html.includes(`rel="canonical" href="${canonical}"`),
    canonical,
  );
  check(`${route.key}: shared reading is server-rendered`, html.includes('class="program__reading'));
  check(`${route.key}: sky behind the reading is server-rendered`, html.includes('class="program__sky"'));
  if (route.key === 'daily') {
    check(`${route.key}: sky strip includes the current Moon phase`, html.includes(DAILY.moon.phase));
  }
  if (route.key === 'tomorrow') {
    check(`${route.key}: sky strip includes tomorrow’s Moon phase`, html.includes(TOMORROW_MOON_PHASE));
  }
  check(
    `${route.key}: sign hero art is present in initial HTML`,
    html.includes(`/assets/sign-art/${route.sign}-1200.webp`),
  );
  check(
    `${route.key}: hero art is preloaded from the document head`,
    new RegExp(`<link[^>]+rel="preload"[^>]+as="image"[^>]+imagesrcset="[^"]*/assets/sign-art/${route.sign}-720\\.webp`).test(html),
  );
  check(`${route.key}: period navigation is present in initial HTML`, /class="[^"]*\bprogram__periods\b/.test(html));
  check(`${route.key}: more periods are present in initial HTML`, html.includes('class="program__more"'));
  const wheelSurface = { daily: 'today', year: 'year' }[route.key] ?? route.key;
  const wheelPath = `/horoscopes/${route.sign}/sky-wheel-${wheelSurface}.svg`;
  check(
    `${route.key}: the wheel of the edition sky is a lazy, sized image`,
    new RegExp(`<img[^>]+src="${wheelPath}"[^>]+width="462"[^>]+height="462"[^>]+alt="The sky at noon UTC[^"]+"[^>]+loading="lazy"`).test(html),
    wheelPath,
  );
  const wheelResponse = await fetch(`${baseURL}${wheelPath}`);
  const wheelSvg = await wheelResponse.text();
  check(
    `${route.key}: the wheel SVG is built by the shared Wheel and loads nothing else`,
    wheelResponse.status === 200
      && /^image\/svg\+xml/.test(wheelResponse.headers.get('content-type') ?? '')
      && wheelSvg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')
      && wheelSvg.includes('class="wheel"')
      && (wheelSvg.match(/<image href="data:image\/webp;base64,/g) ?? []).length === 12
      && !/href="\//.test(wheelSvg),
    `${wheelResponse.status} · ${wheelSvg.length} bytes`,
  );
  check(`${route.key}: the Zodiac Games strip is not on the reading`, !html.includes('race-ramp'));
  check(
    `${route.key}: sign feed is discoverable in the document head`,
    new RegExp(`<link[^>]+rel="alternate"[^>]+type="application/rss\\+xml"[^>]+href="/feeds/horoscopes/${route.sign}\\.xml"`).test(html),
  );
}

async function inspectRenderedPage(page, route, viewportKey) {
  const response = await page.goto(route.path, {
    waitUntil: 'networkidle',
  });
  check(`${route.key} ${viewportKey}: browser response is 200`, response?.status() === 200, String(response?.status()));

  const canonical = `https://zodiacs.org${route.path}`;
  const canonicalNode = page.locator('link[rel="canonical"]');
  const canonicalHref = await canonicalNode.count() > 0 ? await canonicalNode.getAttribute('href') : null;
  check(
    `${route.key} ${viewportKey}: canonical URL is exact`,
    canonicalHref === canonical,
    canonicalHref ?? 'missing',
  );
  const headingNode = page.locator('h1').first();
  const headingText = await headingNode.count() > 0 ? (await headingNode.innerText()).trim() : '';
  check(
    `${route.key} ${viewportKey}: expected heading renders`,
    headingText === route.heading,
    headingText || 'missing',
  );

  const artNode = page.locator('.program__hero .artframe img');
  const art = await artNode.count() === 1 ? await artNode.evaluate((image) => ({
    src: image.getAttribute('src'),
    current: new URL(image.currentSrc).pathname,
    loading: image.getAttribute('loading'),
    priority: image.getAttribute('fetchpriority'),
    width: image.getAttribute('width'),
    height: image.getAttribute('height'),
    alt: image.getAttribute('alt'),
  })) : null;
  check(
    `${route.key} ${viewportKey}: hero uses the sign art in the cinematic frame`,
    art?.src === `/assets/sign-art/${route.sign}-1200.webp` && Boolean(art?.alt),
    JSON.stringify(art),
  );
  check(
    `${route.key} ${viewportKey}: hero art loads first, at a reserved size`,
    art?.loading === 'eager' && art?.priority === 'high' && art?.width === '1200' && art?.height === '800',
    JSON.stringify(art),
  );
  check(
    `${route.key} ${viewportKey}: hero art selects a published derivative`,
    [`/assets/sign-art/${route.sign}-720.webp`, `/assets/sign-art/${route.sign}-1200.webp`].includes(art?.current ?? ''),
    art?.current ?? 'missing',
  );

  const signFeed = page.locator(
    `head link[rel="alternate"][type="application/rss+xml"][href="/feeds/horoscopes/${route.sign}.xml"]`,
  );
  check(
    `${route.key} ${viewportKey}: head advertises the matching sign feed`,
    await signFeed.count() === 1,
  );

  const skyStrip = page.locator('.program__sky');
  check(
    `${route.key} ${viewportKey}: the sky behind the reading lists one to four planets`,
    await skyStrip.count() === 1
      && await skyStrip.locator('.program__sky-marker').count() >= 1
      && await skyStrip.locator('.program__sky-marker').count() <= 4,
  );
  if (route.key === 'daily') {
    check(
      `${route.key} ${viewportKey}: sky strip exposes the current Moon phase`,
      (await skyStrip.innerText()).includes(DAILY.moon.phase),
      await skyStrip.innerText(),
    );
  }
  if (route.key === 'tomorrow') {
    check(
      `${route.key} ${viewportKey}: sky strip exposes tomorrow’s Moon phase`,
      (await skyStrip.innerText()).includes(TOMORROW_MOON_PHASE),
      await skyStrip.innerText(),
    );
  }
  const markerCopy = await skyStrip.locator('.program__sky-marker').evaluateAll((markers) => markers.map((marker) => ({
    label: (marker.querySelector('.mono')?.textContent ?? '').trim(),
    value: (marker.querySelector('time, strong')?.textContent ?? '').trim(),
  })));
  check(
    `${route.key} ${viewportKey}: marker values do not repeat their labels`,
    markerCopy.every(({ label, value }) => !value.toLocaleLowerCase('en').startsWith(`${label.toLocaleLowerCase('en')} `)),
    JSON.stringify(markerCopy),
  );
  const skyAnimation = await skyStrip.evaluate((node) => getComputedStyle(node, '::before').animationName);
  check(
    `${route.key} ${viewportKey}: reduced motion removes the sky-line drift`,
    skyAnimation === 'none',
    skyAnimation,
  );

  // A label set as edition text reads "Today" while the edition is the day's
  // and its dated form ("Oct 16") once a day has passed. Either is right, so
  // a correctly dated label is compared by the current form it carries.
  const linkFacts = (links) => links.map((link) => {
    const shown = (link.querySelector('.program__more-label')?.textContent ?? link.textContent ?? '').trim();
    const edition = link.querySelector('[data-edition-text]');
    return {
      text: edition && shown === edition.getAttribute('data-edition-dated')?.trim()
        ? edition.getAttribute('data-edition-current') ?? shown
        : shown,
      href: link.getAttribute('href'),
      current: link.getAttribute('aria-current'),
    };
  });
  const switchLinks = await page.locator('.program__periods a').evaluateAll(linkFacts);
  const moreLinks = await page.locator('.program__more a').evaluateAll(linkFacts);
  const periodLinks = [...switchLinks, ...moreLinks];
  const expectedSwitch = SWITCH.map(([label, suffix]) => ({
    text: label,
    href: `/horoscopes/${route.sign}/${suffix ? `${suffix}/` : ''}`,
  }));
  check(
    `${route.key} ${viewportKey}: the period switch is Today, This week and This month`,
    JSON.stringify(switchLinks.map(({ text, href }) => ({ text, href }))) === JSON.stringify(expectedSwitch),
    JSON.stringify(switchLinks),
  );
  const reachable = new Set(periodLinks.map(({ href }) => href));
  check(
    `${route.key} ${viewportKey}: period navigation reaches all seven canonical periods`,
    PERIOD_SUFFIXES.every((suffix) => reachable.has(`/horoscopes/${route.sign}/${suffix ? `${suffix}/` : ''}`)),
    JSON.stringify([...reachable]),
  );
  check(
    `${route.key} ${viewportKey}: one period is marked current`,
    periodLinks.filter(({ current }) => current === 'page').length === 1
      && periodLinks.find(({ current }) => current === 'page')?.text === route.active
      && periodLinks.find(({ current }) => current === 'page')?.href === route.path,
    JSON.stringify(periodLinks.filter(({ current }) => current === 'page')),
  );
  const signRail = await page.locator('nav[aria-label="Switch sign"] a').evaluateAll((links) => links.map((link) => ({
    href: link.getAttribute('href'),
    current: link.getAttribute('aria-current'),
  })));
  check(
    `${route.key} ${viewportKey}: the sign switch keeps the period for all twelve signs`,
    signRail.length === 12
      && signRail.every(({ href }) => href?.endsWith(`/${route.suffix ? `${route.suffix}/` : ''}`))
      && signRail.filter(({ current }) => current === 'page').map(({ href }) => href).join() === route.path,
    JSON.stringify(signRail),
  );

  const readingNode = page.locator('.program__reading');
  const readingText = await readingNode.count() > 0 ? await readingNode.innerText() : '';
  const words = countWords(readingText);
  check(
    `${route.key} ${viewportKey}: complete editorial reading renders`,
    words >= route.minWords,
    `${words} words / ${route.minWords} minimum`,
  );
  const sourceNode = page.locator('.program__basis');
  const sourceSummary = sourceNode.locator('summary');
  check(
    `${route.key} ${viewportKey}: astrology details stay out of the primary reading`,
    await sourceNode.count() === 1 && !await sourceNode.evaluate((node) => node.hasAttribute('open')),
  );
  check(
    `${route.key} ${viewportKey}: evidence disclosure is keyboard and touch reachable`,
    (await sourceSummary.innerText()).includes('Behind this reading'),
  );
  await sourceSummary.click();
  const sourceText = await sourceNode.innerText();
  check(
    `${route.key} ${viewportKey}: evidence and method remain available on demand`,
    await sourceNode.evaluate((node) => node.hasAttribute('open'))
      && sourceText.includes('Read our method and sources'),
  );

  const layout = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return {
      viewport: innerWidth,
      root: root.scrollWidth,
      body: body.scrollWidth,
      periodClient: document.querySelector('.program__periods')?.clientWidth ?? 0,
      periodScroll: document.querySelector('.program__periods')?.scrollWidth ?? 0,
      periodRight: document.querySelector('.program__periods')?.getBoundingClientRect().right ?? Infinity,
    };
  });
  check(
    `${route.key} ${viewportKey}: page has no horizontal overflow`,
    Math.max(layout.root, layout.body) <= layout.viewport + 1,
    JSON.stringify(layout),
  );
  if (viewportKey === 'mobile') {
    check(
      `${route.key} mobile: the period switch fits the screen without scrolling`,
      layout.periodScroll <= layout.periodClient + 1 && layout.periodRight <= layout.viewport,
      JSON.stringify(layout),
    );
  }

  if (OUT) {
    await page.screenshot({ path: `${OUT}/${safeName(`${route.key}-${viewportKey}`)}.png`, fullPage: true });
  }
}

async function inspectNoJavaScript(browser, baseURL, route) {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    reducedMotion: 'reduce',
    viewport: { width: 900, height: 800 },
  });
  const page = await context.newPage();
  try {
    const response = await page.goto(route.path, { waitUntil: 'networkidle' });
    const readingNode = page.locator('.program__reading');
    const readingText = await readingNode.count() > 0 ? await readingNode.innerText() : '';
    check(`${route.key} no-JavaScript: response is 200`, response?.status() === 200, String(response?.status()));
    check(
      `${route.key} no-JavaScript: heading remains visible`,
      await page.getByRole('heading', { level: 1, name: route.heading, exact: true }).isVisible(),
    );
    check(
      `${route.key} no-JavaScript: editorial copy remains visible`,
      await readingNode.isVisible() && countWords(readingText) >= route.minWords,
    );
    check(
      `${route.key} no-JavaScript: sky facts remain visible`,
      await page.locator('.program__sky').isVisible()
        && await page.locator('.program__sky-marker').count() >= 1,
    );
    const noJsHrefs = new Set(await page.locator('.program__periods a, .program__more a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href'))));
    check(
      `${route.key} no-JavaScript: native period links remain available`,
      await page.locator('.program__periods a').count() === SWITCH.length
        && PERIOD_SUFFIXES.every((suffix) => noJsHrefs.has(`/horoscopes/${route.sign}/${suffix ? `${suffix}/` : ''}`)),
    );
    const basis = page.locator('.program__basis');
    await basis.locator('summary').click();
    check(
      `${route.key} no-JavaScript: astrology disclosure remains usable`,
      await basis.evaluate((node) => node.hasAttribute('open'))
        && (await basis.innerText()).includes('Read our method and sources'),
    );
    check(
      `${route.key} no-JavaScript: page is not a loading shell`,
      readingText.length > 0 && !/\bloading\b/i.test(readingText),
    );
  } finally {
    await context.close();
  }
}

async function inspectKeyboardAndDefaultMotion(browser, baseURL) {
  const route = ROUTES[0];
  const context = await browser.newContext({
    baseURL,
    reducedMotion: 'no-preference',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.goto(route.path, { waitUntil: 'networkidle' });
    const skyStrip = page.locator('.program__sky');
    const skyAnimation = await skyStrip.evaluate((node) => getComputedStyle(node, '::before').animationName);
    check(
      'daily keyboard: default motion keeps the restrained sky-line drift',
      skyAnimation !== 'none',
      skyAnimation,
    );

    const summary = page.locator('.program__basis summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    check(
      'daily keyboard: Enter opens the native evidence disclosure',
      await page.locator('.program__basis').evaluate((node) => node.hasAttribute('open')),
    );

    const tomorrow = page.locator('.program__more a', { hasText: 'Tomorrow' });
    await tomorrow.focus();
    await Promise.all([
      page.waitForURL('**/horoscopes/aries/tomorrow/'),
      page.keyboard.press('Enter'),
    ]);
    check(
      'daily keyboard: Enter follows the period navigation',
      new URL(page.url()).pathname === '/horoscopes/aries/tomorrow/',
      page.url(),
    );
  } finally {
    await context.close();
  }
}

await withPreview({ port: 4409 }, async (baseURL) => {
  if (OUT) await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: STABLE_CHROMIUM_ARGS,
  });
  try {
    for (const route of ROUTES) await checkStaticHtml(baseURL, route);

    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        baseURL,
        reducedMotion: 'reduce',
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor,
        hasTouch: viewport.hasTouch,
      });
      for (const route of ROUTES) {
        const page = await context.newPage();
        const runtimeErrors = [];
        page.on('pageerror', (error) => runtimeErrors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') runtimeErrors.push(message.text());
        });
        try {
          await inspectRenderedPage(page, route, viewport.key);
          check(
            `${route.key} ${viewport.key}: no browser runtime errors`,
            runtimeErrors.length === 0,
            runtimeErrors.slice(0, 3).join(' | '),
          );
        } finally {
          await page.close();
        }
      }
      await context.close();
    }

    for (const route of ROUTES) await inspectNoJavaScript(browser, baseURL, route);
    await inspectKeyboardAndDefaultMotion(browser, baseURL);
    await inspectReturningDailyForYou(browser, baseURL);
    await inspectReturningDailyForYouMobile(browser, baseURL, THREE_HIT_MOBILE_PROFILE, 'active', 3);
    await inspectReturningDailyForYouMobile(browser, baseURL, QUIET_MOBILE_PROFILE, 'quiet', 0);
    await inspectDailyForYouChunkFailure(browser, baseURL);
    await inspectHubFocusRing(browser, baseURL);
    await inspectStaleEditionLabels(browser, baseURL);
    await inspectEditionMidnightRollover(browser, baseURL);
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
