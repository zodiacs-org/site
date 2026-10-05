/**
 * End-to-end drive of the Chart Explorer + Guided Tour against
 * `astro preview`: visual reading path → wheel + inspector + table + URL
 * sync; beginner context; contextual wheel actions; keyboard model; layer
 * chips; ?sel= deep link; mobile bottom sheet and non-overlapping action
 * dock; tour chapters, anchor rotation, house morph, analytics events.
 *
 * Not part of `npm test` (needs a built site + Chromium). Run manually:
 *
 *   npm run build
 *   OUT_DIR=/tmp/shots node tests/explorer-drive.mjs
 *
 * OUT_DIR is optional — screenshots are skipped without it. In the
 * remote container, Chromium lives at /opt/pw-browsers/chromium.
 * The three A20 OG candidates always use the generator's fixed review-artifact
 * directory; production OG files are never updated by this drive.
 */
import { chromium } from 'playwright-core';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as wait } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { driveLegacyPolarProfile } from './legacy-polar-profile-drive.mjs';
import { runPersonalChartHandoff } from './personal-chart-handoff.mjs';
import { runRecoveryBrowserChecks } from './recovery-browser-checks.mjs';
import { driveLocaleDiscovery } from './locale-discovery-drive.mjs';
import { runExplorerKeyboardChecks } from './explorer-keyboard-checks.mjs';
import { runExplorerCrowdedWheelChecks } from './explorer-crowded-wheel-checks.mjs';
import { runExplorerMoonChecks } from './explorer-moon-checks.mjs';
import { runSearchLearningChecks } from './search-learning-checks.mjs';
import { runSolarReturnChecks } from './solar-return-drive.mjs';
import { runChartContextChecks } from './chart-context-checks.mjs';
import { runLearningPracticeChecks } from './learning-practice-checks.mjs';
import { runAspectPatternBrowserChecks } from './aspect-pattern-browser-checks.mjs';
import { runLunarReturnChecks } from './lunar-return-drive.mjs';
import { runEventTransitChecks } from './event-transit-checks.mjs';
import { runTransitItineraryChecks } from './transit-itinerary-checks.mjs';
import { runEditorialMetadataChecks } from './editorial-metadata-drive.mjs';
import { verifyWidgetBuilder } from './widgets-drive.mjs';
import { awaitAppliedFooter, runFooterStyleChecks } from './footer-style-checks.mjs';

const OUT = process.env.OUT_DIR ?? null;
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? await findChromium();
const encodeChart = (data) => `#c=1.${Buffer.from(JSON.stringify(data)).toString('base64url')}`;
const kahlo = encodeChart({
  d: '1907-07-06', z: 'America/Mexico_City', la: 19.35, lo: -99.16,
  t: '08:30', n: 'Frida Kahlo', p: 'Coyoacán, Mexico',
});
// The same birth without a time — the honest no-houses tour variant.
const kahloNoTime = encodeChart({
  d: '1907-07-06', z: 'America/Mexico_City', la: 19.35, lo: -99.16,
});

const preview = spawn('npx', ['astro', 'preview', '--port', '4399', '--host', '127.0.0.1'], { stdio: 'ignore', detached: false });
await wait(2500);
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  // Preserve completed checks even if a later browser action times out.
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  · ${detail}` : ''}`);
};
const shot = async (target, path, opts = {}) => {
  if (OUT) return await target.screenshot({ path: `${OUT}/${path}`, ...opts });
};
const identityFixtures = [
  ['neil-armstrong', 'Neil Armstrong', 'Astronaut and test pilot · United States · 1930–2012'],
  ['amelia-earhart', 'Amelia Earhart', 'Aircraft pilot · United States · 1897–1939'],
  ['maya-angelou', 'Maya Angelou', 'Writer · United States · 1928–2014'],
];

const profileLayoutFixtures = [
  ...identityFixtures,
  ['mary-wollstonecraft', 'Mary Wollstonecraft', 'Translator and feminist · United Kingdom · 1759–1797'],
  ['subrahmanyan-chandrasekhar', 'Subrahmanyan Chandrasekhar', 'Mathematician and university teacher · Pakistan · 1910–1995'],
  ['cecilia-payne-gaposchkin', 'Cecilia Payne-Gaposchkin', 'Astronomer and university teacher · United Kingdom · 1900–1979'],
  ['henri-cartier-bresson', 'Henri Cartier-Bresson', 'Photographer and journalist · France · 1908–2004'],
  ['paula-modersohn-becker', 'Paula Modersohn-Becker', 'Painter · Germany · 1876–1907'],
];

async function readyForPeopleCapture(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction((target) => [...document.querySelector(target).querySelectorAll('img')]
    .filter((image) => image.offsetWidth > 0 && image.offsetHeight > 0)
    .every((image) => image.complete && image.naturalWidth > 0), selector, { timeout: 10000 });
  await page.locator(selector).evaluate(async (element) => {
    await Promise.all([...element.querySelectorAll('img')]
      .filter((image) => image.offsetWidth > 0 && image.offsetHeight > 0)
      .map((image) => image.decode()));
  });
}

async function peopleFit(page, selector) {
  return page.locator(selector).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return document.documentElement.scrollWidth <= innerWidth + 1
      && box.width > 0 && box.left >= -1 && box.right <= innerWidth + 1
      && element.scrollWidth <= element.clientWidth + 1;
  });
}

async function peopleHeadingGeometry(page) {
  return page.locator('.person-identity h1').evaluate((heading) => {
    const bounds = heading.getBoundingClientRect();
    const identity = heading.closest('.person-identity');
    const readingOrder = ['.person-identity__name', '.person-identity__description', '.person-identity__meta', '.person-quality']
      .map((selector) => {
        const { top, bottom, height } = identity.querySelector(selector).getBoundingClientRect();
        return { selector, top, bottom, height };
      });
    const readingOrderPass = readingOrder.every((box, index) => box.height > 0
      && (index === 0 || box.top >= readingOrder[index - 1].bottom - 1));
    const words = [];
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      // Spaces and explicit hyphens are natural breakpoints; letters within
      // an unbroken part of a name must stay on one rendered line.
      for (const match of node.textContent.matchAll(/[^\s\-\u2010]+/gu)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0)
          .map(({ left, right, top, width, height }) => ({ left, right, top, width, height }));
        words.push({
          text: match[0], rects,
          intact: rects.length > 0 && rects.every((rect) => Math.abs(rect.top - rects[0].top) < 1),
          fits: rects.every((rect) => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1),
        });
      }
    }
    return {
      name: heading.textContent.trim(),
      fontSize: getComputedStyle(heading).fontSize,
      heading: { left: bounds.left, right: bounds.right, width: bounds.width },
      viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
      words, readingOrder, readingOrderPass,
      pass: readingOrderPass && words.length > 0 && words.every((word) => word.intact && word.fits)
        && heading.scrollWidth <= heading.clientWidth + 1
        && document.documentElement.scrollWidth <= innerWidth + 1,
    };
  });
}

async function checkKahloNatalReading(page, viewport) {
  const aspects = page.locator('[data-reading-card="aspects"]');
  await aspects.waitFor({ state: 'visible' });
  const lines = await aspects.locator('.reading-path__aspect-list > li').evaluateAll((items) =>
    Object.fromEntries(items.map((item) => [
      item.querySelector('h4')?.textContent?.trim(),
      { text: item.querySelector('p')?.textContent?.trim(), orb: item.querySelector('.reading-path__orb')?.textContent?.trim() },
    ])));
  const sunNeptune = lines['Sun conjunction Neptune'];
  const venusPluto = lines['Venus conjunction Pluto'];
  check(`${viewport}: conjunction readings depend on the actual planet pair`,
    sunNeptune?.text?.includes('imagination can be woven into your sense of self')
      && venusPluto?.text?.includes('affection and taste can invite deep investment')
      && sunNeptune.text !== venusPluto.text
      && sunNeptune.orb === 'Conjunction · 1.0° orb'
      && venusPluto.orb === 'Conjunction · 0.6° orb');
  const orientation = page.locator('[data-reading-card="big-three"]');
  check(`${viewport}: big three is a compact locator with all three chart controls`,
    JSON.stringify(await orientation.locator('.reading-path__big-tile > p').allTextContents()) === JSON.stringify([
      'The part of you that chooses a direction.',
      'What you need in order to feel steady.',
      'How people first meet you.',
    ]) && await orientation.locator('.reading-path__show').count() === 3);
  for (const [card, name] of [[orientation, 'orientation'], [aspects, 'pair-readings']]) {
    await card.scrollIntoViewIfNeeded();
    await page.waitForFunction((slug) => document.querySelector(`[data-reading-card="${slug}"]`)?.getAttribute('data-visible') === 'true',
      await card.getAttribute('data-reading-card'));
    await card.locator('img').evaluateAll(async (images) => {
      await Promise.all(images.map(async (image) => {
        if (!image.complete) await new Promise((resolve, reject) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', () => reject(new Error('Natal orientation image failed to load')), { once: true });
        });
        await image.decode();
      }));
    });
    check(`${viewport}: ${name} fits its container and retains 44px actions`, await card.evaluate((node) =>
      node.scrollWidth <= node.clientWidth + 1
      && Array.from(node.querySelectorAll('.reading-path__show')).every((control) => control.getBoundingClientRect().height >= 43.5)));
    await shot(card, `${viewport}-natal-${name}.png`, { animations: 'disabled' });
  }
  await page.locator('.xplr__wheelbox').scrollIntoViewIfNeeded();
}

try {
  if (OUT) await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: STABLE_CHROMIUM_ARGS,
  });
  await runRecoveryBrowserChecks({
    browser, baseURL: 'http://127.0.0.1:4399', check, outDir: OUT,
  });

  await driveLocaleDiscovery({ browser, baseURL: 'http://127.0.0.1:4399', check, outDir: OUT });

  await runExplorerKeyboardChecks({
    browser, baseURL: 'http://127.0.0.1:4399', check, outDir: OUT,
    knownFragment: kahlo, unknownFragment: kahloNoTime,
  });
  await runExplorerMoonChecks({
    browser, baseURL: 'http://127.0.0.1:4399', check, outDir: OUT,
  });

  await runSearchLearningChecks({ browser, baseURL: 'http://127.0.0.1:4399', check, outDir: OUT });

  await runEventTransitChecks({ browser, baseURL: 'http://127.0.0.1:4399', check, outDir: OUT ? `${OUT}/event-transits` : null });
  await runEditorialMetadataChecks({ browser, baseURL: 'http://127.0.0.1:4399', check, outDir: OUT ? `${OUT}/editorial-metadata` : null });

  // Each feature owns and closes its browser contexts. Collect independent
  // evidence after a failure, but retain every failure in the final exit code.
  for (const [name, run] of [
    ['transit-itinerary', runTransitItineraryChecks],
    ['solar-return', runSolarReturnChecks],
    ['lunar-return', runLunarReturnChecks],
    ['aspect-patterns', runAspectPatternBrowserChecks],
    ['chart-context', runChartContextChecks],
    ['learning-practice', runLearningPracticeChecks],
  ]) {
    try {
      await run({ browser, baseURL: 'http://127.0.0.1:4399', check, outDir: OUT ? `${OUT}/${name}` : null });
    } catch (error) {
      check(`${name}: browser drive completed without an unhandled failure`, false,
        error instanceof Error ? error.stack ?? error.message : String(error));
    }
  }

  await verifyWidgetBuilder({
    browser, baseURL: 'http://127.0.0.1:4399', check, outDir: OUT ? `${OUT}/widgets` : null,
  });

  await runFooterStyleChecks({ browser, baseURL: 'http://127.0.0.1:4399', check, outDir: OUT ? `${OUT}/footer-styles` : null });

  for (const width of [390, 1440]) {
    const peoplePage = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    try {
      const response = await peoplePage.goto('http://127.0.0.1:4399/people/', { waitUntil: 'domcontentloaded' });
      check(`People index ${width}: HTTP 200 and one plain heading`, response?.status() === 200
        && (await peoplePage.locator('h1').allTextContents()).join('') === 'People'
        && await peoplePage.locator('.people-kicker').count() === 0);
      await readyForPeopleCapture(peoplePage, '.people-page__hero');
      check(`People index ${width}: hero fits`, await peopleFit(peoplePage, '.people-page__hero'));
      await shot(peoplePage.locator('.people-page__hero'), `people-index-${width}.png`);

      const navLink = peoplePage.locator('[data-nav] .nav__chip');
      check(`People index ${width}: visible Astrofolio navigation retains its destination`,
        await navLink.isVisible()
        && (await navLink.getAttribute('href')) === '/astrofolio/'
        && (await navLink.textContent()).trim() === 'Astrofolio');
      for (const [slug, name, identity] of identityFixtures) {
        const selector = `[data-person-card][href="/people/${slug}/"]`;
        const card = peoplePage.locator(selector);
        check(`People index ${width}: ${name} uses the reviewed identity`,
          await card.count() === 1 && (await card.locator('small').innerText()).trim() === identity);
        await readyForPeopleCapture(peoplePage, selector);
        check(`People index ${width}: ${name} card fits`, await peopleFit(peoplePage, selector));
        await shot(card, `people-index-${slug}-${width}.png`);
      }

      const footerGroup = peoplePage.locator('.zfooter__group--wide');
      await awaitAppliedFooter(peoplePage);
      await readyForPeopleCapture(peoplePage, '.zfooter__directory');
      check(`People index ${width}: Registry footer heading and Astrofolio link retain distinct labels`,
        (await footerGroup.locator('.zfooter__label').textContent()).trim() === 'Registry'
        && (await footerGroup.getAttribute('aria-label')) === 'Registry'
        && (await footerGroup.locator('a[href="/astrofolio/"]').textContent()).trim() === 'Astrofolio'
        && await peopleFit(peoplePage, '.zfooter__directory'));
      await shot(peoplePage.locator('.zfooter__directory'), `people-footer-${width}.png`);
    } finally {
      await peoplePage.close();
    }

  }

  const profileGeometry = [];
  for (const width of [360, 390, 1060, 1440]) {
    for (const [slug, name, identity] of profileLayoutFixtures) {
      const personPage = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      try {
        const response = await personPage.goto(`http://127.0.0.1:4399/people/${slug}/`, { waitUntil: 'domcontentloaded' });
        await readyForPeopleCapture(personPage, '.person-identity');
        check(`People profile ${width}: ${name} has the reviewed header without repeated eyebrows`,
          response?.status() === 200
          && (await personPage.locator('h1').innerText()).trim() === name
          && (await personPage.locator('.person-identity__description').innerText()).trim() === identity
          && await personPage.locator('.people-kicker').count() === 0
          && await personPage.getByText('The day, read honestly', { exact: true }).count() === 0
          && await peopleFit(personPage, '.person-identity')
          && await peopleFit(personPage, '.person-identity__description'));
        const geometry = await peopleHeadingGeometry(personPage);
        profileGeometry.push({ slug, width, ...geometry });
        check(`People profile ${width}: ${name} preserves whole name parts within the heading`,
          geometry.pass, JSON.stringify(geometry));
        check(`People profile ${width}: ${name} displays name, identity, birth metadata and quality in order`,
          geometry.readingOrderPass, JSON.stringify(geometry.readingOrder));
        check(`People profile ${width}: ${name} reading and chart fit`,
          await peopleFit(personPage, '.person-reading')
          && await peopleFit(personPage, '.person-wheel'));
        await shot(personPage.locator('.person-identity'), `people-${slug}-${width}.png`);
        if (width === 1060 && slug === 'neil-armstrong') {
          await shot(personPage.locator('.person-layout'), 'people-layout-neil-armstrong-1060.png');
        }
      } finally {
        await personPage.close();
      }
    }
  }

  if (OUT) await writeFile(`${OUT}/people-heading-geometry.json`, `${JSON.stringify(profileGeometry, null, 2)}\n`);

  await runExplorerCrowdedWheelChecks({
    browser, baseURL: 'http://127.0.0.1:4399', check, outDir: OUT,
  });

  // Editorial pages keep the Astrofolio door at every boundary. Tool pages
  // (owner rule since #633: no Astrofolio branding on tools) keep the same
  // reserved shell with the door removed from both the bar and the menu.
  for (const [surface, route, expectsDoor] of [
    ['editorial', '/learn/', true],
    ['tool', '/birth-chart/', false],
  ]) {
    let navBreakpointsPass = true;
    const navBreakpointsDetail = [];
    for (const [prefix, desktopBreakpoint, englishOnlyCue] of [
      ['', 920, ''],
      ['/es', 1040, '— por ahora en inglés'],
      ['/pt', 1040, '— por enquanto em inglês'],
      ['/fr', 1040, '— pour l’instant en anglais'],
      ['/it', 1040, '— per ora in inglese'],
    ]) {
      // Retain the old 819/820 checks as compact-layout regressions, and check
      // both sides of the new reserved-shell desktop thresholds independently.
      for (const width of [819, 820, desktopBreakpoint - 1, desktopBreakpoint]) {
        const desktop = width >= desktopBreakpoint;
        const navPage = await browser.newPage({ viewport: { width, height: 844 } });
        await navPage.goto(`http://127.0.0.1:4399${prefix}${route}`, { waitUntil: 'domcontentloaded' });
        const state = await navPage.evaluate(() => {
          const nav = document.querySelector('[data-nav]')?.getBoundingClientRect();
          const chip = document.querySelector('.nav__chip');
          const burger = document.querySelector('[data-menu-toggle]');
          const links = document.querySelector('.nav__links');
          return {
            navFits: Boolean(nav && nav.left >= 16 && nav.right <= innerWidth - 16),
            navWidth: nav?.width,
            chipPresent: Boolean(chip),
            chipVisible: Boolean(chip && getComputedStyle(chip).display !== 'none'),
            chipHref: chip?.getAttribute('href'),
            chipText: (chip?.querySelector(':scope > span') ?? chip)?.textContent?.trim(),
            chipCue: chip?.querySelector('small')?.textContent?.trim() ?? '',
            wingLinks: document.querySelectorAll('[data-nav] a[href^="/astrofolio/"], .mobile-menu a[href^="/astrofolio/"]').length,
            burgerVisible: Boolean(burger && getComputedStyle(burger).display !== 'none'),
            linksVisible: Boolean(links && getComputedStyle(links).display !== 'none'),
          };
        });
        if (!desktop) {
          await navPage.locator('[data-menu-toggle]').click();
          state.mobileRegistryVisible = await navPage.locator('.mobile-menu__registry').count() > 0
            && await navPage.locator('.mobile-menu__registry').isVisible();
        }
        const door = expectsDoor
          ? state.chipVisible
            && state.chipHref === '/astrofolio/'
            && state.chipText === 'Astrofolio'
            && state.chipCue === englishOnlyCue
            && (desktop || state.mobileRegistryVisible === true)
          : !state.chipPresent
            && state.wingLinks === 0
            && (desktop || state.mobileRegistryVisible === false);
        const pass = state.navFits
          && door
          && Math.abs(state.navWidth - (desktop ? (prefix ? 992 : 884) : 336)) <= 0.1
          && state.burgerVisible === !desktop
          && state.linksVisible === desktop;
        navBreakpointsPass &&= pass;
        navBreakpointsDetail.push(`${prefix || '/en'}@${width}:${pass ? 'ok' : JSON.stringify(state)}`);
        await navPage.close();
      }
    }
    check(expectsDoor
      ? 'navigation: reserved shells and Astrofolio persist at compact and desktop boundaries in all five locales'
      : `navigation: ${surface} pages keep the reserved shells without any Astrofolio link in all five locales`,
    navBreakpointsPass, navBreakpointsDetail.join(' · '));
  }

  // A shared-chart receiver intentionally removes every wing link. Its head
  // marker must reserve the shorter shell before hydration, with no empty
  // destination track and no later movement of the surviving controls.
  const receiverDetails = [];
  let receiverPass = true;
  for (const [prefix, desktopBreakpoint, compactWidth, mobileWidth, desktopWidth] of [
    ['', 920, 180, 210, 746],
    ['/es', 1040, 184, 210, 854],
    ['/ru', 1040, 132, 166, 854],
  ]) {
    for (const width of [320, 390, desktopBreakpoint, ...(prefix === '' ? [1440] : [])]) {
      const desktop = width >= desktopBreakpoint;
      const navPage = await browser.newPage({ viewport: { width, height: 844 } });
      await navPage.goto(`http://127.0.0.1:4399${prefix}/birth-chart/${kahlo}`, { waitUntil: 'domcontentloaded' });
      const receiverGeometry = () => navPage.evaluate(() => {
        const nav = document.querySelector('[data-nav]');
        const box = nav?.getBoundingClientRect();
        const children = [...(nav?.children ?? [])]
          .filter((element) => getComputedStyle(element).display !== 'none')
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
          });
        const controls = [...document.querySelectorAll('.nav__search, .nav__burger')]
          .filter((element) => getComputedStyle(element).display !== 'none')
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          });
        return {
          receiver: document.documentElement.hasAttribute('data-chart-share-receiver'),
          wingLinks: document.querySelectorAll('a[href="/astrofolio/"],a[href^="/registry/"],a[href^="/sdk/"]').length,
          left: box?.left, right: box?.right, top: box?.top, bottom: box?.bottom, width: box?.width,
          scrollX, scrollY,
          viewport: visualViewport && {
            pageLeft: visualViewport.pageLeft, pageTop: visualViewport.pageTop,
            offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop,
            width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale,
          },
          resultTop: document.querySelector('.calc__result')?.getBoundingClientRect().top,
          visible: Boolean(nav && [nav, nav.closest('.nav-wrap')].every((element) => {
            if (!element) return false;
            const style = getComputedStyle(element);
            return style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) === 1;
          })),
          children, controls,
          endGap: box ? box.right - Math.max(...children.map((child) => child.right)) : null,
        };
      });
      const early = await receiverGeometry();
      await navPage.locator('.calc__result').waitFor({ state: 'visible', timeout: 15000 });
      await navPage.waitForLoadState('networkidle');
      await navPage.waitForFunction(() => document.querySelector('.calc__form')?.getAttribute('aria-busy') === 'false');
      await navPage.evaluate(() => document.fonts.ready.then(() => undefined));
      // Result visibility precedes the calculator's scheduled smooth scroll.
      // Wait for its real destination and a stable pair of animation frames,
      // without changing product scrolling or accepting a pre-scroll pause.
      await navPage.waitForFunction(async () => {
        const before = scrollY;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const result = document.querySelector('.calc__result');
        if (!result) return false;
        const margin = Number.parseFloat(getComputedStyle(result).scrollMarginTop) || 0;
        const target = Math.min(Math.max(0, scrollY + result.getBoundingClientRect().top - margin),
          Math.max(0, document.documentElement.scrollHeight - innerHeight));
        return Math.abs(scrollY - target) <= 1 && Math.abs(scrollY - before) <= 0.1;
      });
      const settled = await receiverGeometry();
      const expectedWidth = desktop ? desktopWidth : width <= 360 ? compactWidth : mobileWidth;
      const pass = [early, settled].every((state) => state.receiver
        && state.visible
        && state.wingLinks === 0
        && Math.abs(state.width - expectedWidth) <= 0.1
        && state.left >= 16 && state.right <= width - 16
        && Math.abs(state.left - (width - expectedWidth) / 2) <= 0.1
        && Math.abs(state.endGap - (width <= 360 ? 5 : 11)) <= 0.1
        && state.children.every((child) => child.left >= state.left && child.right <= state.right)
        && state.controls.length === (desktop ? (prefix === '/ru' ? 0 : 1) : (prefix === '/ru' ? 1 : 2))
        && (desktop || state.controls.every((control) => control.width === 44 && control.height === 44)))
        && Math.abs(early.left - settled.left) <= 0.1
        && Math.abs(early.width - settled.width) <= 0.1;
      receiverPass &&= pass;
      receiverDetails.push(`${prefix || '/en'}@${width}:${pass ? 'ok' : JSON.stringify({ early, settled })}`);
      if (OUT) {
        // Capture the native viewport without Playwright's separate metrics →
        // document-clip conversion, which can race Chromium's compositor origin.
        // Keep the exact viewport and nav-region checks; never select a retry.
        const stem = `receiver-nav-${prefix.slice(1) || 'en'}-${width}`;
        const session = await navPage.context().newCDPSession(navPage);
        let capture;
        try {
          const { data } = await session.send('Page.captureScreenshot', {
            format: 'png', captureBeyondViewport: false, fromSurface: true,
          });
          capture = Buffer.from(data, 'base64');
        } finally {
          await session.detach();
        }
        const after = await receiverGeometry();
        await mkdir(OUT, { recursive: true });
        await writeFile(`${OUT}/${stem}.png`, capture);
        await writeFile(`${OUT}/${stem}.json`, `${JSON.stringify({
          captureMethod: 'Page.captureScreenshot: native viewport, no clip',
          before: settled, after,
        }, null, 2)}\n`);
        check(`navigation: ${prefix || '/en'}@${width} receiver geometry is unchanged across capture`,
          ['left', 'right', 'top', 'bottom', 'width', 'scrollX', 'scrollY', 'resultTop']
            .every((key) => Math.abs(settled[key] - after[key]) <= 0.1)
          && settled.viewport && after.viewport
          && Object.keys(settled.viewport).every((key) => Math.abs(settled.viewport[key] - after.viewport[key]) <= 0.1),
          JSON.stringify({ before: settled, after }));
        const png = PNG.sync.read(capture);
        let foregroundPixels = 0;
        for (let y = Math.ceil(settled.top); y < Math.floor(settled.bottom); y += 1) {
          for (let x = Math.ceil(settled.left); x < Math.floor(settled.right); x += 1) {
            const offset = (y * png.width + x) * 4;
            if (Math.max(...png.data.subarray(offset, offset + 3)) > 100) foregroundPixels += 1;
          }
        }
        check(`navigation: ${prefix || '/en'}@${width} receiver viewport captures visible foreground`,
          png.width === width && png.height === 844 && foregroundPixels >= 30,
          `${png.width}×${png.height}; ${foregroundPixels} foreground pixels in the nav`);
      }
      await navPage.close();
    }
  }
  check('navigation: shared receivers keep stable centered controls without a blank wing track', receiverPass, receiverDetails.join(' · '));

  // The site sets `scroll-behavior: smooth`, so scrolls animate — poll the
  // box until it stops moving before clicking.
  async function settledBox(el) {
    let prev = await el.boundingBox();
    for (let i = 0; i < 20; i += 1) {
      await wait(120);
      const cur = await el.boundingBox();
      if (prev && cur && Math.abs(cur.y - prev.y) < 0.5 && Math.abs(cur.x - prev.x) < 0.5) return cur;
      prev = cur;
    }
    return prev;
  }
  // Click helper: center the wheel, then click a mark's visual center —
  // the svg resolves the entity geometrically.
  async function clickMark(pg, selector) {
    const el = pg.locator(selector).first();
    await el.evaluate((n) => n.closest('svg').scrollIntoView({ block: 'center' }));
    const box = await settledBox(el);
    await pg.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  async function hasBeginnerInspector(pg) {
    const labels = await pg.locator('.insp__insight h4').allTextContents();
    return labels.length === 4
      && /^What/.test(labels[0] ?? '')
      && /^How/.test(labels[1] ?? '')
      && /^Where/.test(labels[2] ?? '')
      && /^Why/.test(labels[3] ?? '');
  }
  async function revealFullGuide(pg) {
    await pg.waitForSelector('[data-first-reading-prompt], [data-tour-start]', { timeout: 5000 });
    const prompt = pg.locator('[data-first-reading-prompt]');
    if (await prompt.count()) await pg.locator('[data-first-reading-dismiss]').click();
    await pg.waitForSelector('[data-tour-start]', { timeout: 5000 });
  }

  // ── Desktop: free exploration ──
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.__detailEvents = [];
    window.zodiacsAnalytics = Object.freeze({
      track: (name, props) => window.__detailEvents.push({ name, props }),
    });
  });
  await page.goto('http://127.0.0.1:4399/birth-chart/', { waitUntil: 'networkidle' });
  check('communication read: lazy chunk is absent before compute', await page.evaluate(() =>
    !performance.getEntriesByType('resource').some((entry) => /\/CommunicationRead\.[^/]+\.js$/.test(new URL(entry.name).pathname))));
  await page.goto('about:blank');
  await page.goto(`http://127.0.0.1:4399/birth-chart/${kahlo}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.calc__result', { timeout: 15000 });
  await page.waitForSelector('.wheel--interactive', { timeout: 15000 });
  await page.waitForSelector('.calc__approach', { timeout: 15000 });
  await page.waitForSelector('.calc__comm', { timeout: 15000 });
  await page.waitForFunction(() => window.__detailEvents.filter((event) => event.name === 'comm_read_view').length === 1);

  const detail = page.locator('details.calc__detail[data-detail]');
  const detailSummary = detail.locator('summary');
  const placementCount = await detail.locator('.calc__table tbody tr').count();
  const aspectCount = await detail.locator('.calc__aspects li').count();
  check('first reading: prompt withholds guide and read-another but keeps save and share available', await page.evaluate(() => {
    const prompt = document.querySelector('[data-first-reading-prompt]');
    const dock = document.querySelector('[data-chart-action-dock]');
    return Boolean(prompt && dock
      && !dock.querySelector('[data-tour-start]')
      && !dock.querySelector('[data-read-another-chart]')
      && dock.querySelectorAll('[data-save-chart]').length === 1
      && dock.querySelectorAll('[data-share-card]').length === 1
      && document.querySelectorAll('[data-share-card]').length === 1);
  }));
  await page.locator('[data-first-reading-dismiss]').click();
  await page.waitForSelector('[data-tour-start]', { timeout: 5000 });
  check('first reading: dismissal reveals Save + Guide + Share + Read another and one white next action', await page.evaluate(() => {
    const dock = document.querySelector('[data-chart-action-dock]');
    return !document.querySelector('[data-first-reading-prompt]')
      && dock?.querySelectorAll('.chart-action-dock__actions > .btn').length === 4
      && dock.querySelectorAll('[data-save-chart]').length === 1
      && dock.querySelectorAll('[data-tour-start]').length === 1
      && dock.querySelectorAll('[data-share-card]').length === 1
      && dock.querySelectorAll('[data-read-another-chart]').length === 1
      && dock.querySelector('[data-read-another-chart]')?.getAttribute('href')?.startsWith('/birth-chart/someone-else/#mine=')
      && document.querySelectorAll('[data-primary-action]').length === 1;
  }));
  check('chart actions: save/guide/share/read-another actions are unique and absent from More ways', await page.evaluate(() =>
    document.querySelectorAll('[data-save-chart]').length === 1
    && document.querySelectorAll('[data-tour-start]').length === 1
    && document.querySelectorAll('[data-share-card]').length === 1
    && document.querySelectorAll('[data-read-another-chart]').length === 1
    && !document.querySelector('[data-chart-more] [data-save-chart], [data-chart-more] [data-tour-start], [data-chart-more] [data-share-card], [data-chart-more] [data-read-another-chart]')));
  check('plain-first: visual story, approach, and communication precede actions and full detail', await page.evaluate(() => {
    const wheel = document.querySelector('.calc__wheel');
    const read = document.querySelector('.reading-path');
    const approach = document.querySelector('[data-approach-read]');
    const communication = document.querySelector('.calc__comm');
    const actions = document.querySelector('.calc__actions');
    const detailNode = document.querySelector('[data-detail]');
    const table = document.querySelector('.calc__table');
    return Boolean(wheel && read && approach && communication && actions && detailNode && table
      && (wheel.compareDocumentPosition(read) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (read.compareDocumentPosition(approach) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (approach.compareDocumentPosition(communication) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (communication.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (actions.compareDocumentPosition(detailNode) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (read.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING));
  }));
  check('approach read: audience-facing roles and contextual share render', await page.evaluate(() => {
    const roles = Array.from(document.querySelectorAll('.calc__approach-part h3'))
      .map((node) => node.textContent?.trim());
    return roles.join('|') === 'How to open|How to say it|What builds trust|What to avoid under pressure'
      && document.querySelectorAll('[data-approach-share]').length === 1;
  }));
  check('visual story: all four cards render with houses, aspects, and balance bars', await page.evaluate(() => {
    const slugs = Array.from(document.querySelectorAll('[data-reading-card]'))
      .map((node) => node.getAttribute('data-reading-card'));
    return slugs.join(',') === 'big-three,places,aspects,pattern'
      && document.querySelectorAll('[data-reading-house]').length === 12
      && document.querySelectorAll('.reading-path__aspect-list > li').length > 0
      && document.querySelectorAll('.reading-path__bar-fill').length === 7;
  }));
  await checkKahloNatalReading(page, 'desktop');
  check('visual story: explicit Show on chart controls are keyboard-operable', await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll('.reading-path__show'))
      .filter((control) => control.getClientRects().length > 0);
    return controls.length >= 3
      && controls.every((control) => control instanceof HTMLButtonElement
        && control.getAttribute('aria-label')?.startsWith('Show on chart:')
        && /(Spotlight|Trace|Highlighted on chart)/.test(control.textContent ?? '')
        && control.getBoundingClientRect().height >= 43.5);
  }));
  check('communication read: Mercury, Moon, Mars roles and contextual share render', await page.evaluate(() => {
    const roles = Array.from(document.querySelectorAll('.calc__comm-part h3'))
      .map((node) => node.textContent?.trim());
    return roles.join('|') === 'How you phrase things|What helps you feel heard|How you handle friction'
      && document.querySelectorAll('[data-communication-share]').length === 1;
  }));
  check('communication read: chunk loads after compute', await page.evaluate(() =>
    performance.getEntriesByType('resource').some((entry) => /\/CommunicationRead\.[^/]+\.js$/.test(new URL(entry.name).pathname))));
  check('communication read: Kahlo corpus line is byte-identical',
    await page.locator('.calc__comm-part').first().locator(':scope > p').first().textContent()
      === 'You communicate like a performance with an audience of one — warm, committed, a story where a sentence would do. It works because you mean it; flattery without conviction reads as static to you.');
  check('communication read: analytics fires once with no properties', await page.evaluate(() => {
    const events = window.__detailEvents.filter((event) => event.name === 'comm_read_view');
    return events.length === 1 && Object.keys(events[0].props ?? {}).length === 0;
  }));
  check('plain-first: detail is closed by default', !(await detail.evaluate((node) => node.open)));
  check('plain-first: EN summary is exact with mono counts',
    await detailSummary.textContent() === `See exact chart data — ${placementCount} placements · ${aspectCount} aspects`
    && await detailSummary.locator('.mono').count() === 2,
    await detailSummary.textContent() ?? '');
  check('plain-first: aspects are a section with no nested details',
    await detail.locator('details').count() === 0
    && await detail.locator('section.calc__aspects > h3 + ul').count() === 1);

  await detailSummary.click();
  await page.waitForFunction(() => document.querySelector('[data-detail]')?.hasAttribute('open')
    && localStorage.getItem('zodiacs.detail.v1') === 'open'
    && window.__detailEvents.some((event) => event.name === 'detail_toggle' && event.props?.to === 'full'));
  check('plain-first: opening persists',
    await page.evaluate(() => localStorage.getItem('zodiacs.detail.v1')) === 'open');
  check('plain-first: open analytics is allowlisted shape', await page.evaluate(() =>
    window.__detailEvents.some((event) => event.name === 'detail_toggle' && event.props?.to === 'full')));
  check('communication read: parent rerender does not duplicate analytics', await page.evaluate(() =>
    window.__detailEvents.filter((event) => event.name === 'comm_read_view').length === 1));

  await page.goto('about:blank');
  await page.goto(`http://127.0.0.1:4399/birth-chart/${kahlo}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.wheel--interactive', { timeout: 15000 });
  await wait(100); // allow any restore-time native toggle task to flush
  check('plain-first: open choice restores across reload', await detail.evaluate((node) => node.open));
  check('plain-first: restoring does not emit a toggle event', await page.evaluate(() =>
    window.__detailEvents.filter((event) => event.name === 'detail_toggle').length === 0));
  await detailSummary.click();
  await page.waitForFunction(() => !document.querySelector('[data-detail]')?.hasAttribute('open')
    && localStorage.getItem('zodiacs.detail.v1') === 'closed'
    && window.__detailEvents.some((event) => event.name === 'detail_toggle' && event.props?.to === 'plain'));
  check('plain-first: closing persists and tracks plain',
    await page.evaluate(() => localStorage.getItem('zodiacs.detail.v1')) === 'closed'
    && await page.evaluate(() => window.__detailEvents.some(
      (event) => event.name === 'detail_toggle' && event.props?.to === 'plain')));

  await page.goto('about:blank');
  await page.goto(`http://127.0.0.1:4399/birth-chart/${kahlo}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.wheel--interactive', { timeout: 15000 });
  check('plain-first: closed choice restores across reload', !(await detail.evaluate((node) => node.open)));
  await wait(950); // let the freshly remounted wheel finish its entrance before geometric clicks

  check('wheel interactive', true);
  check('hint visible pre-selection', await page.locator('.insp--hint').isVisible());

  // Select Mars via its marker circle.
  await clickMark(page, 'g[data-entity="body:Mars"] circle');
  await page.waitForSelector('.insp--card', { timeout: 5000 });
  const title = await page.locator('.insp__title').textContent();
  check('inspector opens on Mars', /Mars/.test(title ?? ''), title ?? '');
  check('beginner inspector: body uses What / How / Where / Why', await hasBeginnerInspector(page));
  check('beginner inspector: exact chart data is secondary and closed', await page.evaluate(() => {
    const exact = document.querySelector('.insp__exact');
    return exact instanceof HTMLDetailsElement
      && !exact.open
      && exact.querySelector('summary')?.textContent?.trim() === 'Exact chart data';
  }));
  check('url carries ?sel', (await page.url()).includes('sel=body%3AMars') || (await page.url()).includes('sel=body:Mars'), await page.url());
  check('wheel body selection re-lights closed detail', await detail.evaluate((node) => node.open));
  check('table row synced', await page.locator('tr[data-selected="true"] .calc__rowbtn').textContent().then((x) => /Mars/.test(x ?? '')));
  check('visual story syncs the selected placement to its house', (await page.locator('.reading-path__room-map button[data-selected="true"]').count()) === 1);
  await page.locator('.reading-path__placements > summary').click();
  check('visual story syncs the selected body in all placements', await page.evaluate(() => {
    const selected = document.querySelector('.reading-path__placements li[data-selected="true"]');
    return selected?.querySelector('strong')?.textContent === 'Mars';
  }));
  await shot(page.locator('.xplr__wheelbox'), 'desktop-mars-selected.png');
  await shot(page, 'desktop-explorer-region.png', { clip: { x: 0, y: 0, width: 1440, height: 1000 } });

  // Reading-path actions return to the wheel, synchronize URL/selection,
  // and hand focus back to the interactive chart for both pointer and keys.
  const sunShow = page.locator('.reading-path__show[aria-label^="Show on chart: Sun in"]').first();
  await sunShow.evaluate((node) => node.scrollIntoView({ block: 'center' }));
  await sunShow.click();
  await page.waitForFunction(() => new URLSearchParams(location.search).get('sel') === 'body:Sun'
    && document.activeElement?.classList.contains('xplr__wheelbox'));
  await page.waitForFunction(() => {
    const wheel = document.querySelector('.xplr__wheelbox');
    return wheel?.getAttribute('data-spotlight-id') === 'body:Sun'
      && wheel?.getAttribute('data-spotlight-motion') === 'animated'
      && wheel?.getAttribute('data-spotlight-phase') === 'settled';
  });
  check('visual story: pointer Show on chart selects Sun and returns to wheel',
    /Sun/.test(await page.locator('.insp__title').textContent() ?? '')
    && (await sunShow.getAttribute('aria-pressed')) === 'true');
  check('visual story: Sun gets a unique animated planet halo', await page.evaluate(() => (
    document.querySelectorAll('[data-spotlight-target="body:Sun"][data-spotlight-kind="body"]').length === 1
    && document.querySelectorAll('[data-spotlight-target]').length === 1
    && document.querySelector('g[data-entity="body:Sun"]')?.getAttribute('data-selected') === 'true'
  )));

  const firstSunRun = Number(await page.locator('.xplr__wheelbox').getAttribute('data-spotlight-run'));
  await sunShow.click();
  await page.waitForFunction((previous) => {
    const wheel = document.querySelector('.xplr__wheelbox');
    return wheel?.getAttribute('data-spotlight-id') === 'body:Sun'
      && Number(wheel?.getAttribute('data-spotlight-run')) > previous
      // A new halo/run is exposed while primed, before its deferred focus.
      // Finish that replay before starting a distinct keyboard interaction.
      && wheel?.getAttribute('data-spotlight-phase') === 'settled'
      && document.activeElement === wheel
      && document.querySelectorAll('[data-spotlight-target="body:Sun"]').length === 1;
  }, firstSunRun);
  check('visual story: re-clicking the same target replays one spotlight', true);

  const moonShow = page.locator('.reading-path__show[aria-label^="Show on chart: Moon in"]').first();
  await moonShow.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => new URLSearchParams(location.search).get('sel') === 'body:Moon'
    && document.activeElement?.classList.contains('xplr__wheelbox'));
  check('visual story: keyboard Show on chart selects Moon and returns to wheel',
    /Moon/.test(await page.locator('.insp__title').textContent() ?? '')
    && (await moonShow.getAttribute('aria-pressed')) === 'true');
  check('visual story: keyboard spotlight is immediate but remains visible', await page.evaluate(() => {
    const wheel = document.querySelector('.xplr__wheelbox');
    const target = document.querySelector('[data-spotlight-target="body:Moon"][data-spotlight-kind="body"]');
    const entity = document.querySelector('g[data-entity="body:Moon"]');
    return wheel?.getAttribute('data-spotlight-motion') === 'instant'
      && target != null
      && target.getAnimations({ subtree: true }).every((animation) => animation.playState !== 'running')
      && entity != null
      && getComputedStyle(entity).transitionDuration.split(',')
        .every((duration) => duration.trim() === '0s');
  }));

  const houseTen = page.locator('[data-reading-house="10"] button');
  await houseTen.click();
  await page.waitForFunction(() => {
    const wheel = document.querySelector('.xplr__wheelbox');
    return wheel?.getAttribute('data-spotlight-id') === 'house:10'
      && wheel?.getAttribute('data-spotlight-phase') === 'settled';
  });
  check('visual story: House 10 illuminates one wedge, not a generic point', await page.evaluate(() => (
    document.querySelectorAll('[data-spotlight-target="house:10"][data-spotlight-kind="house"]').length === 1
    && document.querySelector('g[data-entity="house:10"]')?.getAttribute('data-selected') === 'true'
    && document.querySelectorAll('[data-spotlight-target]').length === 1
  )));

  const rapidStartRun = Number(await page.locator('.xplr__wheelbox').getAttribute('data-spotlight-run'));
  await page.evaluate(() => {
    const sun = document.querySelector('.reading-path__show[aria-label^="Show on chart: Sun in"]');
    const house = document.querySelector('[data-reading-house="10"] button');
    sun?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    house?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
  await page.waitForFunction((previous) => {
    const wheel = document.querySelector('.xplr__wheelbox');
    return wheel?.getAttribute('data-spotlight-id') === 'house:10'
      && wheel?.getAttribute('data-spotlight-phase') === 'settled'
      && Number(wheel?.getAttribute('data-spotlight-run')) >= previous + 2;
  }, rapidStartRun);
  await wait(1500);
  check('visual story: rapid retarget cancels the stale spotlight', await page.evaluate(() => (
    document.querySelectorAll('[data-spotlight-target="house:10"]').length === 1
    && document.querySelectorAll('[data-spotlight-target]').length === 1
    && document.querySelector('.xplr__wheelbox')?.getAttribute('data-spotlight-id') === 'house:10'
  )));

  const aspectShow = page.locator('.reading-path__aspect-list .reading-path__show').first();
  await aspectShow.click();
  await page.waitForFunction(() => {
    const wheel = document.querySelector('.xplr__wheelbox');
    return wheel?.getAttribute('data-spotlight-id')?.startsWith('aspect:')
      && wheel?.getAttribute('data-spotlight-phase') === 'settled';
  });
  check('visual story: an aspect traces one chord and its two endpoints', await page.evaluate(() => (
    document.querySelectorAll('[data-spotlight-target][data-spotlight-kind="aspect"]').length === 1
    && document.querySelectorAll('[data-spotlight-target] .wheel__focus-aspect-node').length === 2
    && document.querySelectorAll('[data-spotlight-target]').length === 1
  )));

  // A named aspect chip inside the beginner inspector navigates to that
  // connection and focuses its new heading.
  await clickMark(page, 'g[data-entity="body:Mars"] circle');
  const chip = page.locator('.insp__related-actions .insp__chip')
    .filter({ hasText: /conjunction|sextile|square|trine|opposition/i }).first();
  if (await chip.count()) {
    await chip.click();
    const t2 = await page.locator('.insp__title').textContent();
    check('inspector chip → named aspect selection',
      /(conjunction|sextile|square|trine|opposition)/i.test(t2 ?? '')
      && (await page.url()).includes('sel=aspect'), t2 ?? '');
    check('beginner inspector: aspect uses What / How / Where / Why', await hasBeginnerInspector(page));
    // Contextual selection schedules focus on the next animation frame.
    // Assert the resulting focus state after that bounded transition.
    await page.waitForFunction(() => document.activeElement?.hasAttribute('data-inspector-heading'), null, { timeout: 3000 });
    check('beginner inspector: contextual navigation focuses the new heading',
      await page.evaluate(() => document.activeElement?.hasAttribute('data-inspector-heading') ?? false));
  }

  // Escape clears via wheelbox keyboard.
  await page.locator('.xplr__wheelbox').focus();
  await page.keyboard.press('Escape');
  check('Escape clears selection', await page.locator('.insp--hint').isVisible());

  // Arrow keys cycle bodies.
  await page.keyboard.press('ArrowRight');
  const t3 = await page.locator('.insp__title').textContent();
  check('ArrowRight selects a body', (t3 ?? '').trim().length > 0, t3 ?? '');
  await page.keyboard.press('ArrowRight');
  const t4 = await page.locator('.insp__title').textContent();
  check('ArrowRight advances', t4 !== t3, `${t3} → ${t4}`);
  await page.keyboard.press('Enter');
  check('Enter focuses inspector heading', await page.evaluate(() => document.activeElement?.hasAttribute('data-inspector-heading') ?? false));
  await page.keyboard.press('Escape');

  // Table row click selects on wheel.
  await page.locator('.calc__rowbtn', { hasText: 'Moon' }).first().click();
  check('table click → wheel selection ring', (await page.locator('.wheel__sel-ring').count()) === 1);

  // House selection via its numeral (the wedge band resolves geometrically).
  await clickMark(page, 'g[data-entity="house:7"] text');
  const t5 = await page.locator('.insp__title').textContent();
  check('house numeral selectable', /7/.test(t5 ?? ''), t5 ?? '');
  check('beginner inspector: house uses What / How / Where / Why', await hasBeginnerInspector(page));

  // Sign selection via its disc in the ring.
  await clickMark(page, 'g[data-entity="sign:leo"] image');
  const tSign = await page.locator('.insp__title').textContent();
  check('sign disc selectable', /Leo/i.test(tSign ?? ''), tSign ?? '');
  check('beginner inspector: sign uses What / How / Where / Why', await hasBeginnerInspector(page));

  // Layer chip: toggling squares off removes square chords.
  await page.locator('.xplr-chip[data-aspect="square"]').click();
  await wait(200);
  const squaresOff = await page.locator('.xplr-chip[data-aspect="square"][aria-pressed="false"]').count();
  check('square chip toggles off', squaresOff === 1);
  await page.locator('.xplr-chip[data-aspect="square"]').click();

  // Houses toggle clears a HOUSE selection (other kinds persist).
  await clickMark(page, 'g[data-entity="house:7"] text');
  await page.locator('.xplr-chip--houses').click();
  await wait(300);
  check('houses off clears house selection', await page.locator('.insp--hint').isVisible());
  await page.locator('.xplr-chip--houses').click();

  // With a selection active, Enter on a layer chip must toggle the chip,
  // not hijack focus.
  await clickMark(page, 'g[data-entity="body:Mars"] circle');
  await page.locator('.xplr-chip[data-aspect="trine"]').focus();
  await page.keyboard.press('Enter');
  await wait(150);
  check('chip Enter toggles while selected', (await page.locator('.xplr-chip[data-aspect="trine"]').getAttribute('aria-pressed')) === 'false');
  await page.locator('.xplr-chip[data-aspect="trine"]').click(); // restore

  // Escape from inside the inspector clears the selection.
  await clickMark(page, 'g[data-entity="body:Mars"] circle');
  await page.locator('.xplr__wheelbox').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await wait(300);
  check('Escape inside inspector clears', await page.locator('.insp--hint').isVisible());

  // Arrow cycle reaches the angles after the last body.
  await page.locator('.xplr__wheelbox').focus();
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('ArrowRight');
  const tAng = await page.locator('.insp__title').textContent();
  check('arrow cycle reaches ASC', /ASC/.test(tAng ?? ''), tAng ?? '');
  check('beginner inspector: angle uses What / How / Where / Why', await hasBeginnerInspector(page));
  await page.keyboard.press('Escape');

  // Selecting an aspect then filtering its type off clears the selection.
  await page.locator('.calc__aspects .calc__rowbtn').first().click();
  const selUrl = page.url();
  const m = /sel=aspect%3A[^&]*(conjunction|sextile|square|trine|opposition)/.exec(selUrl);
  if (m) {
    await page.locator(`.xplr-chip[data-aspect="${m[1]}"]`).click();
    await wait(300);
    check('filtering off selected aspect type clears it', await page.locator('.insp--hint').isVisible());
    await page.locator(`.xplr-chip[data-aspect="${m[1]}"]`).click();
  } else {
    check('filtering off selected aspect type clears it', false, 'could not derive selected aspect from url: ' + selUrl);
  }

  // Invalid sign deep link must not crash the island.
  await page.goto(`http://127.0.0.1:4399/birth-chart/?sel=sign%3Afoobar${kahlo}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.wheel--interactive', { timeout: 15000 });
  check('invalid ?sel survives (no crash)', (await page.locator('.calc__table').count()) === 1);

  // North Node inspector explains the calculated point and its ordinary
  // backward motion without pretending there is a placement page/aspect list.
  await page.goto('about:blank');
  await page.goto(`http://127.0.0.1:4399/birth-chart/?sel=body%3ANorth%20Node${kahlo}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.insp--card', { timeout: 15000 });
  const nodeText = await page.locator('.insp__body').innerText();
  check('North Node card has beginner What / How / Where / Why context', await hasBeginnerInspector(page));
  check('North Node card frames growth as symbolic, not fixed destiny',
    /calculated point/i.test(nodeText)
    && /direction of growth/i.test(nodeText)
    && /not a (prediction or )?fixed destiny/i.test(nodeText), nodeText);
  check('North Node card explains normal node motion without planet-retrograde framing',
    /nodes usually move backward/i.test(nodeText)
    && /do not read this like a retrograde planet/i.test(nodeText), nodeText);
  check('North Node card links to the glossary',
    (await page.locator('.insp__more[href="/learn/glossary/#north-node"]').count()) === 1);
  check('North Node card has no 404 learn link', (await page.locator('.insp__more[href*="placements/north-node"]').count()) === 0);
  check('North Node card does not invent node aspects', await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.insp__related-actions button'))
      .map((node) => node.textContent ?? '');
    return labels.every((label) => !/conjunction|sextile|square|trine|opposition/i.test(label));
  }));

  // Deep link: fresh load with ?sel=body:Venus.
  await page.goto('about:blank');
  await page.goto(`http://127.0.0.1:4399/birth-chart/?sel=body%3AVenus${kahlo}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.insp--card', { timeout: 15000 });
  const t6 = await page.locator('.insp__title').textContent();
  check('?sel deep link applies after compute', /Venus/.test(t6 ?? ''), t6 ?? '');
  await page.close();

  // The disclosure copy is host-local; Spanish keeps the exact approved line.
  const es = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await es.goto(`http://127.0.0.1:4399/es/birth-chart/${kahlo}`, { waitUntil: 'networkidle' });
  await es.waitForSelector('.wheel--interactive', { timeout: 15000 });
  const esDetail = es.locator('[data-detail]');
  const esPlacements = await esDetail.locator('.calc__table tbody tr').count();
  const esAspects = await esDetail.locator('.calc__aspects li').count();
  const esSummary = await esDetail.locator('summary').textContent();
  check('plain-first: ES summary line is exact',
    esSummary === `Ver los datos exactos — ${esPlacements} posiciones · ${esAspects} aspectos`,
    esSummary ?? '');
  check('communication read: absent from Spanish',
    await es.locator('.calc__comm').count() === 0
    && await es.evaluate(() => !performance.getEntriesByType('resource')
      .some((entry) => /\/CommunicationRead\.[^/]+\.js$/.test(new URL(entry.name).pathname))));
  await es.close();

  // A real timed chart with an aspect signature keeps its interpretation in
  // the reading and only the computed orb in the compact wheel dock.
  const aspectSignature = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const aspectBirth = encodeChart({ d: '2000-05-01', t: '12:00', z: 'UTC', la: 51.5, lo: 0 });
  const aspectResponse = await aspectSignature.goto(`http://127.0.0.1:4399/birth-chart/${aspectBirth}`, { waitUntil: 'networkidle' });
  check('aspect signature: fixture route responds successfully', aspectResponse?.status() === 200);
  await aspectSignature.waitForSelector('.chart-action-dock__signature small', { timeout: 15000 });
  check('aspect signature: dock uses the computed orb without repeating the reading',
    await aspectSignature.locator('.chart-action-dock__signature strong').textContent() === 'Moon sextile Neptune'
      && await aspectSignature.locator('.chart-action-dock__signature small').textContent() === '0.3° orb');
  await shot(aspectSignature.locator('[data-chart-action-dock]'), 'desktop-natal-aspect-signature.png', { animations: 'disabled' });
  await aspectSignature.close();

  // ── Desktop: guided tour ──
  const tp = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  // Replace the no-op analytics shim before the page scripts run so the
  // emitters are observable end-to-end (Base.astro's `||` keeps ours).
  await tp.addInitScript(() => {
    window.__tourEvents = [];
    window.zodiacsAnalytics = Object.freeze({
      track: (name, props) => window.__tourEvents.push({ name, props }),
    });
  });
  await tp.goto(`http://127.0.0.1:4399/birth-chart/${kahlo}`, { waitUntil: 'networkidle' });
  await tp.waitForSelector('.wheel--interactive', { timeout: 15000 });
  await revealFullGuide(tp);

  await tp.locator('[data-tour-start]').click();
  await tp.waitForSelector('[data-tour-card]', { timeout: 10000 }); // lazy chunk fetch
  check('tour: desktop dock persists with Share as its only action', await tp.evaluate(() => {
    const dock = document.querySelector('[data-chart-action-dock]');
    if (!dock || getComputedStyle(dock).display === 'none') return false;
    const actions = dock.querySelectorAll('.chart-action-dock__actions > .btn');
    return actions.length === 1
      && dock.querySelectorAll('[data-share-card]').length === 1
      && !dock.querySelector('[data-tour-start], [data-read-another-chart]');
  }));
  const kick1 = await tp.locator('[data-tour-kicker]').textContent();
  check('tour: starts at chapter 1', /Chapter 1 of \d/.test(kick1 ?? ''), kick1 ?? '');
  check('tour: one dot per chapter (full chart = 8)', (await tp.locator('[data-tour-dot]').count()) === 8);
  await shot(tp, 'tour-ch1-sky.png', { clip: { x: 0, y: 0, width: 1440, height: 1000 } });

  // Next advances into chapter 2 and the anchor rotation moves the wheel.
  const head1 = await tp.locator('[data-tour-heading]').textContent();
  await tp.locator('[data-tour-next]').click();
  await wait(150);
  const head2 = await tp.locator('[data-tour-heading]').textContent();
  const kick2 = await tp.locator('[data-tour-kicker]').textContent();
  check('tour: next advances a chapter', head2 !== head1 && /Chapter 2/.test(kick2 ?? ''), `${head1} → ${head2}`);

  const sunBefore = await tp.locator('g[data-entity="body:Sun"] circle').first().boundingBox();
  await tp.locator('[data-tour-rotate]').click();
  await wait(900); // 600 ms tween + settle
  const sunAfter = await tp.locator('g[data-entity="body:Sun"] circle').first().boundingBox();
  const moved = sunBefore && sunAfter
    && (Math.abs(sunAfter.x - sunBefore.x) > 2 || Math.abs(sunAfter.y - sunBefore.y) > 2);
  check('tour: anchor rotation moves the wheel', Boolean(moved)
    && (await tp.locator('[data-tour-rotate]').getAttribute('aria-pressed')) === 'true');
  await shot(tp, 'tour-ch2-aries-anchor.png', { clip: { x: 0, y: 0, width: 1440, height: 1000 } });

  // Big three (dot 4): the chapter lights the Sun and dims the rest.
  await tp.locator('[data-tour-dot]').nth(3).click();
  await wait(200);
  const sunOp = await tp.locator('g[data-entity="body:Sun"]').first().getAttribute('opacity');
  const marsOp = await tp.locator('g[data-entity="body:Mars"]').first().getAttribute('opacity');
  check('tour: chapter emphasis lights Sun, dims Mars',
    Number(sunOp) === 1 && Number(marsOp) < 1, `sun ${sunOp}, mars ${marsOp}`);
  check('tour: chapter change moves focus to heading',
    await tp.evaluate(() => document.activeElement?.hasAttribute('data-tour-heading') ?? false));
  await shot(tp, 'tour-ch4-big-three.png', { clip: { x: 0, y: 0, width: 1440, height: 1000 } });

  // Mid-tour selection detours to the inspector; the way back preserves
  // the chapter index.
  await clickMark(tp, 'g[data-entity="body:Mars"] circle');
  await tp.waitForSelector('[data-tour-back]', { timeout: 5000 });
  check('tour: selection swaps in inspector with return banner',
    /Mars/.test(await tp.locator('.insp__title').textContent() ?? ''));
  await tp.locator('[data-tour-back]').click();
  await tp.waitForSelector('[data-tour-card]', { timeout: 5000 });
  check('tour: back returns to the same chapter',
    /Chapter 4/.test(await tp.locator('[data-tour-kicker]').textContent() ?? ''));

  // Houses (dot 6): the morph preview renders a diff without touching state.
  await tp.locator('[data-tour-dot]').nth(5).click();
  await tp.locator('[data-house-preview]').click();
  await tp.waitForSelector('[data-tour-diff]', { timeout: 8000 }); // engine + 450 ms tween
  check('tour: house morph shows the placement diff',
    (await tp.locator('[data-house-preview]').getAttribute('aria-pressed')) === 'true');
  await shot(tp, 'tour-ch6-house-morph.png', { clip: { x: 0, y: 0, width: 1440, height: 1000 } });

  // Jumping to the last chapter fires tour_complete exactly once.
  await tp.locator('[data-tour-dot]').last().click();
  await wait(200);
  const events = await tp.evaluate(() => window.__tourEvents);
  const completes = events.filter((e) => e.name === 'tour_complete');
  check('tour: analytics — start, steps, one completion',
    events.some((e) => e.name === 'tour_start' && e.props?.variant === 'v1')
    && events.filter((e) => e.name === 'tour_step').length >= 5
    && completes.length === 1 && completes[0].props?.variant === 'v1',
    JSON.stringify(events.map((e) => e.name)).slice(0, 120));
  await shot(tp, 'tour-ch8-whole.png', { clip: { x: 0, y: 0, width: 1440, height: 1000 } });

  // Escape from the wheelbox ends the tour and restores the hint.
  await tp.locator('.xplr__wheelbox').focus();
  await tp.keyboard.press('Escape');
  await wait(200);
  check('tour: Escape exits to free exploration',
    (await tp.locator('[data-tour-card]').count()) === 0
    && await tp.locator('.insp--hint').isVisible()
    && (await tp.locator('[data-chart-action-dock]').count()) === 1
    && (await tp.locator('[data-chart-action-dock] .chart-action-dock__actions > .btn').count()) === 4);

  // No-time chart: horizon and houses give way to the honest chapter.
  // (Hop through about:blank — a bare fragment swap on the same path is a
  // same-document navigation and would leave the old chart mounted.)
  await tp.goto('about:blank');
  await tp.goto(`http://127.0.0.1:4399/birth-chart/${kahloNoTime}`, { waitUntil: 'networkidle' });
  await tp.waitForSelector('.wheel--interactive', { timeout: 15000 });
  check('visual story: no-time chart swaps houses for twelve sign groups', await tp.evaluate(() =>
    document.querySelectorAll('[data-reading-house]').length === 0
    && document.querySelectorAll('[data-reading-sign]').length === 12
    && /Birth time is unknown/i.test(document.querySelector('.reading-path__no-time')?.textContent ?? '')));
  await clickMark(tp, 'g[data-entity="body:Sun"] circle');
  const noTimeInspector = await tp.locator('.insp__body').innerText();
  check('beginner inspector: no-time body keeps context and names the missing house limit',
    await hasBeginnerInspector(tp)
    && /birth time is needed to place it in a house/i.test(noTimeInspector), noTimeInspector);
  await tp.locator('.xplr__wheelbox').focus();
  await tp.keyboard.press('Escape');
  await tp.locator('[data-tour-start]').click();
  await tp.waitForSelector('[data-tour-card]', { timeout: 10000 });
  const noTimeDots = await tp.locator('[data-tour-dot]').count();
  const dotLabels = await tp.locator('[data-tour-dot]').evaluateAll(
    (els) => els.map((el) => el.getAttribute('aria-label') ?? ''),
  );
  check('tour: no-time chart derives 7 chapters incl. "no houses"',
    noTimeDots === 7 && dotLabels.some((l) => /no houses/i.test(l)),
    `${noTimeDots} dots: ${dotLabels.join(' | ').slice(0, 120)}`);
  await shot(tp, 'tour-no-time.png', { clip: { x: 0, y: 0, width: 1440, height: 1000 } });
  await tp.close();

  // ── Mobile: bottom sheet ──
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  await mob.goto(`http://127.0.0.1:4399/birth-chart/${kahlo}`, { waitUntil: 'networkidle' });
  await mob.waitForSelector('.wheel--interactive', { timeout: 15000 });
  await revealFullGuide(mob);
  await checkKahloNatalReading(mob, 'mobile');
  check('mobile: hint hidden', !(await mob.locator('.insp--hint').isVisible().catch(() => false)));
  check('mobile: Save + Guide + Share + Read another dock is full-width below the interactive chart', await mob.evaluate(() => {
    const wheel = document.querySelector('.xplr__wheelbox')?.getBoundingClientRect();
    const dock = document.querySelector('[data-chart-action-dock]')?.getBoundingClientRect();
    const buttons = Array.from(document.querySelectorAll('[data-chart-action-dock] .chart-action-dock__actions > .btn'))
      .map((button) => button.getBoundingClientRect());
    if (!wheel || !dock || buttons.length !== 4) return false;
    return dock.top >= wheel.bottom - 0.5
      && buttons.every((button) => button.top >= dock.top
        && button.bottom <= dock.bottom + 0.5
        && button.left >= dock.left
        && button.right <= dock.right
        && button.width >= dock.width - 26);
  }));
  {
    const el = mob.locator('g[data-entity="body:Sun"] circle').first();
    await el.evaluate((n) => n.closest('svg').scrollIntoView({ block: 'center' }));
    const box = await settledBox(el);
    await mob.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await mob.waitForSelector('.insp--card', { timeout: 5000 });
  const sheetBox = await mob.locator('.insp--card').boundingBox();
  check('mobile: sheet opens from bottom', !!sheetBox && sheetBox.y > 400, JSON.stringify(sheetBox));
  await shot(mob, 'mobile-sheet-half.png');
  // Drag handle up → full detent.
  const handle = await mob.locator('.insp__handle').boundingBox();
  if (handle) {
    await mob.mouse.move(handle.x + handle.width / 2, handle.y + 8);
    await mob.mouse.down();
    await mob.mouse.move(handle.x + handle.width / 2, handle.y - 120, { steps: 6 });
    await mob.mouse.up();
    await wait(350);
    check('mobile: drag to full detent', (await mob.locator('.insp--full').count()) === 1);
    await shot(mob, 'mobile-sheet-full.png');
  }
  // Close returns to wheel.
  await mob.locator('.insp__close').click();
  check('mobile: close clears selection', (await mob.locator('.insp--card').count()) === 0);

  // Tour in the sheet: a sideways swipe on the handle turns the page.
  {
    const startBtn = mob.locator('[data-tour-start]');
    await startBtn.evaluate((n) => n.scrollIntoView({ block: 'center' }));
    const box = await settledBox(startBtn);
    await mob.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await mob.waitForSelector('[data-tour-card]', { timeout: 10000 });
  check('mobile: external dock hides during tour while sticky Share remains visible', await mob.evaluate(() => {
    const dock = document.querySelector('[data-chart-action-dock]');
    const share = document.querySelector('[data-tour-share]');
    if (!dock || !share) return false;
    const shareBox = share.getBoundingClientRect();
    return getComputedStyle(dock).display === 'none'
      && getComputedStyle(share).display !== 'none'
      && shareBox.width >= 44
      && shareBox.height >= 44;
  }));
  const tourShareDownloadPromise = mob.waitForEvent('download', { timeout: 10000 });
  await mob.locator('[data-tour-share]').click();
  const tourShareDownload = await tourShareDownloadPromise;
  check('mobile: tour Share exports the prepared chart without ending the tour',
    tourShareDownload.suggestedFilename() === 'zodiacs-chart-sheet.png'
    && (await mob.locator('[data-share-dialog]').count()) === 0
    && (await mob.locator('[data-tour-card]').count()) === 1);
  await shot(mob, 'mobile-tour-sheet.png');
  const mobHandle = await mob.locator('[data-tour-card] .insp__handle').boundingBox();
  if (mobHandle) {
    await mob.mouse.move(mobHandle.x + mobHandle.width / 2, mobHandle.y + 6);
    await mob.mouse.down();
    await mob.mouse.move(mobHandle.x + mobHandle.width / 2 - 140, mobHandle.y + 6, { steps: 6 });
    await mob.mouse.up();
    await wait(300);
    check('mobile: swipe left turns the tour page',
      /2/.test(await mob.locator('[data-tour-kicker]').textContent() ?? ''));
  } else {
    check('mobile: swipe left turns the tour page', false, 'no handle box');
  }
  await mob.locator('[data-tour-exit]').click();
  check('mobile: tour exit closes the sheet and restores wheel actions',
    (await mob.locator('[data-tour-card]').count()) === 0
    && await mob.locator('[data-chart-action-dock]').isVisible()
    && (await mob.locator('[data-chart-action-dock] .chart-action-dock__actions > .btn').count()) === 4);
  await mob.close();

  // ── Reduced motion: selection and tour transitions are instant ──
  const rm = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await rm.goto(`http://127.0.0.1:4399/birth-chart/${kahlo}`, { waitUntil: 'networkidle' });
  await rm.waitForSelector('.wheel--interactive', { timeout: 15000 });
  await revealFullGuide(rm);
  check('reduced motion: story cards, connectors, and bars render in their final state', await rm.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-reading-card]'));
    const lines = Array.from(document.querySelectorAll('.reading-path__line'));
    const bars = Array.from(document.querySelectorAll('.reading-path__bar-fill'));
    const identity = (transform) => transform === 'none'
      || transform === 'matrix(1, 0, 0, 1, 0, 0)';
    const noTransition = (node) => getComputedStyle(node).transitionDuration
      .split(',').every((duration) => duration.trim() === '0s');
    return cards.length === 4
      && cards.every((node) => {
        const style = getComputedStyle(node);
        return style.opacity === '1' && identity(style.transform);
      })
      && lines.every(noTransition)
      && bars.every(noTransition);
  }));
  const rmSunShow = rm.locator('.reading-path__show[aria-label^="Show on chart: Sun in"]').first();
  await rmSunShow.click();
  await rm.waitForFunction(() => document.querySelector('.xplr__wheelbox')
    ?.getAttribute('data-spotlight-id') === 'body:Sun');
  check('reduced motion: pointer spotlight jumps to a stable halo with no movement', await rm.evaluate(() => {
    const wheel = document.querySelector('.xplr__wheelbox');
    const target = document.querySelector('[data-spotlight-target="body:Sun"]');
    const entity = document.querySelector('g[data-entity="body:Sun"]');
    if (!target) return false;
    const style = getComputedStyle(target);
    return wheel?.getAttribute('data-spotlight-motion') === 'instant'
      && (style.transform === 'none' || style.transform === 'matrix(1, 0, 0, 1, 0, 0)')
      && style.transitionDuration.split(',').every((duration) => duration.trim() === '0s')
      && entity != null
      && getComputedStyle(entity).transitionDuration.split(',')
        .every((duration) => duration.trim() === '0s');
  }));
  await rm.keyboard.press('Escape');
  {
    const el = rm.locator('g[data-entity="body:Saturn"] circle').first();
    await el.evaluate((n) => n.closest('svg').scrollIntoView({ block: 'center' }));
    const box = await settledBox(el);
    await rm.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  check('reduced motion: selection works', /Saturn/.test(await rm.locator('.insp__title').textContent() ?? ''));
  await rm.keyboard.press('Escape');
  // The anchor rotation lands instantly (no 600 ms tween frame).
  await rm.locator('[data-tour-start]').click();
  await rm.waitForSelector('[data-tour-card]', { timeout: 10000 });
  await rm.locator('[data-tour-next]').click();
  const rmSunBefore = await rm.locator('g[data-entity="body:Sun"] circle').first().boundingBox();
  await rm.locator('[data-tour-rotate]').click();
  await wait(120); // far below the tween duration
  const rmSunAfter = await rm.locator('g[data-entity="body:Sun"] circle').first().boundingBox();
  check('reduced motion: rotation is instant',
    !!rmSunBefore && !!rmSunAfter
    && (Math.abs(rmSunAfter.x - rmSunBefore.x) > 2 || Math.abs(rmSunAfter.y - rmSunBefore.y) > 2));
  await rm.close();

  await driveLegacyPolarProfile({ browser, baseURL: 'http://127.0.0.1:4399', check, outDir: OUT });
  await runPersonalChartHandoff({ browser, baseURL: 'http://127.0.0.1:4399', check, outDir: OUT });
  await browser.close();
  // Reuse the owning renderer only after the main browser has closed. Its
  // closed review mode verifies that every production OG file stays identical.
  const ogReview = await promisify(execFile)(process.execPath,
    ['scripts/build-og-void.mjs', '--review-people-identities'], {
      env: { ...process.env, CHROMIUM_PATH: CHROMIUM },
      timeout: 120000,
      maxBuffer: 2 * 1024 * 1024,
    });
  check('People identity OG: three review candidates rendered with production files unchanged',
    /Reviewed 3 People identity cards; production OG files unchanged\./u.test(ogReview.stdout), ogReview.stdout.trim());
  const factsReview = await promisify(execFile)(process.execPath,
    ['scripts/build-og-void.mjs', '--review-people-facts'], {
      env: { ...process.env, CHROMIUM_PATH: CHROMIUM }, timeout: 120000, maxBuffer: 2 * 1024 * 1024,
    });
  check('People facts OG: seven source corrections rendered with production files unchanged',
    /Reviewed 7 People facts cards; production OG files unchanged\./u.test(factsReview.stdout), factsReview.stdout.trim());
} finally {
  preview.kill();
}

const failed = results.filter((result) => !result.ok).length;
console.log(failed ? `\n${failed} FAILURES` : '\nALL PASS');
process.exit(failed ? 1 : 0);
