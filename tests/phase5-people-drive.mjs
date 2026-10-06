import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import peopleData from '../src/data/people.json' with { type: 'json' };
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
import { waitForPortraitReadiness } from './portrait-readiness.mjs';

const OUT = process.env.OUT_DIR ?? null;
const failures = [];
let assertions = 0;
const check = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};

const people = peopleData.people;
const routes = ['/people/', ...people.map((person) => `/people/${person.slug}/`)];
const indexablePeople = people.filter((person) => person.indexEligibility.eligible);
const deferredPeople = people.filter((person) => !person.indexEligibility.eligible && !person.living);
const protectedLiving = people.filter((person) => person.living);
const indexablePaths = new Set(indexablePeople.map((person) => `/people/${person.slug}/`));
if (peopleData.directoryIndexable) indexablePaths.add('/people/');
const representative = [
  '/people/ada-lovelace/',
  '/people/serena-williams/',
  '/people/bill-gates/',
  '/people/leonardo-dicaprio/',
  '/people/chien-shiung-wu/',
];

if (OUT) await mkdir(OUT, { recursive: true });

await withPreview({ port: 4425 }, async (baseURL) => {
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    args: STABLE_CHROMIUM_ARGS,
  });

  try {
    // Every generated route receives the search/privacy contract derived from
    // the explicit Phase 5C allowlist.
    const inventoryContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'no-preference',
    });
    const inventoryPage = await inventoryContext.newPage();
    const inventoryErrors = [];
    inventoryPage.on('pageerror', (error) => inventoryErrors.push(error.message));
    const portraitRequests = new Map();
    inventoryPage.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/assets/people/')) {
        portraitRequests.set(request, { url: request.url(), status: null, finished: false, error: null });
      }
    });
    inventoryPage.on('response', (response) => {
      const request = portraitRequests.get(response.request());
      if (request) request.status = response.status();
    });
    inventoryPage.on('requestfinished', (request) => {
      const observed = portraitRequests.get(request);
      if (observed) observed.finished = true;
    });
    inventoryPage.on('requestfailed', (request) => {
      const observed = portraitRequests.get(request);
      if (observed) observed.error = request.failure()?.errorText ?? 'request failed';
    });

    for (const route of routes) {
      portraitRequests.clear();
      const response = await inventoryPage.goto(`${baseURL}${route}`, {
        waitUntil: 'domcontentloaded',
      });
      check(response?.status() === 200, `${route}: expected 200, got ${response?.status()}`);
      const state = await inventoryPage.evaluate(() => ({
        robots: document.querySelector('meta[name="robots"]')?.getAttribute('content'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        alternates: document.querySelectorAll('link[rel="alternate"][hreflang]').length,
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        title: document.title,
        jsonLdValid: [...document.querySelectorAll('script[type="application/ld+json"]')]
          .every((node) => {
            try {
              JSON.parse(node.textContent ?? 'null');
              return true;
            } catch {
              return false;
            }
          }),
      }));
      const routePerson = people.find((person) => `/people/${person.slug}/` === route);
      const expectedRobots = indexablePaths.has(route)
        ? 'max-image-preview:large'
        : routePerson?.living
          ? 'noindex, nofollow, max-image-preview:large'
          : 'noindex, follow, max-image-preview:large';
      check(state.robots === expectedRobots, `${route}: robots=${state.robots}`);
      check(state.canonical === `https://zodiacs.org${route}`, `${route}: canonical=${state.canonical}`);
      check(state.alternates === 0, `${route}: emitted ${state.alternates} hreflang alternates`);
      check(state.width <= state.viewport + 1, `${route}: ${state.width}px content in ${state.viewport}px viewport`);
      check(state.title.includes('Zodiacs.org'), `${route}: missing site title`);
      check(state.jsonLdValid, `${route}: invalid JSON-LD`);

      if (route !== '/people/') {
        const source = people.find((person) => `/people/${person.slug}/` === route);
        check(
          await inventoryPage.locator('h1').textContent() === source?.displayName,
          `${route}: person heading drifted`,
        );
        check(
          await inventoryPage.locator('.person-block').count() === source?.copy.blocks.length,
          `${route}: reading-block count drifted`,
        );
        check(
          (await inventoryPage.locator('.person-wheel__caption').innerText()).includes(
            'No houses, rising sign, angles, or sect were computed.',
          ),
          `${route}: unknown-time disclosure missing`,
        );
        check(
          await inventoryPage.locator('a[href^="mailto:people@zodiacs.org"]').count() === 1,
          `${route}: correction route missing`,
        );
        const openSignFacts = source?.copy.blocks
          .flatMap((block) => block.facts)
          .filter((fact) => fact.startsWith('sign-uncertain:')) ?? [];
        check(
          await inventoryPage.locator('.person-evidence dt', { hasText: 'Open signs' }).count()
            === (openSignFacts.length > 0 ? 1 : 0),
          `${route}: open-sign disclosure-row state drifted`,
        );
        const pageText = await inventoryPage.locator('.person-page').innerText();
        for (const fact of openSignFacts) {
          const [, body, start, end] = fact.split(':');
          const startName = start.charAt(0).toUpperCase() + start.slice(1);
          const endName = end.charAt(0).toUpperCase() + end.slice(1);
          check(
            pageText.includes(
              `${body} crossed from ${startName} into ${endName} during that day, so its sign is left open.`,
            ),
            `${route}: ${body} sign uncertainty is not reader-visible`,
          );
        }

        if (source?.portrait.available) {
          const image = inventoryPage.locator('[data-person-portrait-image]');
          let portrait;
          try {
            await image.waitFor();
            portrait = await image.evaluate(waitForPortraitReadiness, 10_000);
          } catch (error) {
            const state = await image.evaluateAll((nodes) => {
              const node = nodes[0];
              return { src: node?.getAttribute('src') ?? null, currentSrc: node?.currentSrc ?? null,
                complete: node?.complete ?? false, naturalWidth: node?.naturalWidth ?? 0,
                naturalHeight: node?.naturalHeight ?? 0 };
            });
            portrait = { ready: false, error: String(error), ...state };
          }
          if (!portrait.ready) {
            console.error(`portrait diagnostic: ${JSON.stringify({ route, ...portrait,
              requests: [...portraitRequests.values()] })}`);
          }
          check(
            portrait.ready && portrait.complete && portrait.naturalWidth > 0,
            `${route}: portrait did not load`,
          );
          check(
            (await inventoryPage.locator('.person-credit').innerText()).includes('Wikimedia Commons'),
            `${route}: visible portrait attribution missing`,
          );
          check(
            await inventoryPage.locator('[data-person-portrait-fallback]').isHidden(),
            `${route}: portrait fallback overlays a loaded image`,
          );
        } else {
          check(
            await inventoryPage.locator('[data-person-portrait-image]').count() === 0,
            `${route}: rendered a portrait outside the accepted licence set`,
          );
          check(
            await inventoryPage.locator('.person-identity .sign-icon').count() >= 1,
            `${route}: no-portrait sign fallback missing`,
          );
        }
      }
    }
    check(inventoryErrors.length === 0, `inventory browser errors: ${inventoryErrors.join(' | ')}`);
    check(
      indexablePeople.length === 104 && deferredPeople.length === 393,
      `People demand partition drifted: ${indexablePeople.length} indexable / ${deferredPeople.length} deferred`,
    );
    check(
      protectedLiving.map((person) => person.slug).sort().join(',')
        === 'bill-gates,leonardo-dicaprio,rigoberta-menchu,serena-williams',
      'protected living-person set drifted',
    );
    await inventoryContext.close();

    // Directory: exact pilot size, progressive enhancement, 44px targets,
    // no-JS sign filtering, keyboard focus, and birthday cross-links.
    const directoryContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const directoryPage = await directoryContext.newPage();
    const directoryErrors = [];
    directoryPage.on('pageerror', (error) => directoryErrors.push(error.message));
    await directoryPage.goto(`${baseURL}/people/`, { waitUntil: 'networkidle' });
    check(await directoryPage.locator('[data-person-card]').count() === indexablePeople.length, `directory does not show exactly ${indexablePeople.length} indexable people`);
    check(
      await directoryPage.locator('a[href="/people/bill-gates/"], a[href="/people/leonardo-dicaprio/"]').count() === 0,
      'protected living profiles entered the public People directory',
    );
    check(
      await directoryPage.locator('[data-filter-discipline]').count() === 9,
      'directory does not use the nine approved discipline filters',
    );
    check(await directoryPage.locator('[data-people-search]').isVisible(), 'enhanced name search is not visible');
    const signTargets = await directoryPage.locator('[data-filter-sign]').evaluateAll((nodes) => (
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height };
      })
    ));
    check(
      signTargets.length === 12 && signTargets.every(({ width, height }) => width >= 44 && height >= 44),
      'one or more sign filter targets are below 44×44px',
    );

    const firstSign = directoryPage.locator('[data-filter-sign]').first();
    await firstSign.focus();
    const focus = await firstSign.evaluate((node) => {
      const style = getComputedStyle(node);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    check(focus.style !== 'none' && focus.width !== '0px', 'sign filter keyboard focus is not visible');

    const uniqueNeedle = 'Ada Lovelace';
    const expectedMatches = indexablePeople.filter((person) => (
      person.displayName.toLowerCase().includes(uniqueNeedle.toLowerCase())
    )).length;
    await directoryPage.locator('#people-name').fill(uniqueNeedle);
    await directoryPage.waitForTimeout(80);
    check(
      await directoryPage.locator('[data-person-card]:visible').count() === expectedMatches,
      'name search did not narrow to the exact match set',
    );
    check(
      (await directoryPage.locator('[data-people-count]').innerText()).startsWith(`${expectedMatches} of ${indexablePeople.length}`),
      'name-search result count is not announced',
    );
    await directoryPage.locator('#people-name').fill('not a pilot name');
    await directoryPage.waitForTimeout(50);
    check(await directoryPage.locator('.people-empty').isVisible(), 'empty search state did not appear');
    check(directoryErrors.length === 0, `directory browser errors: ${directoryErrors.join(' | ')}`);
    await directoryContext.close();

    const noJsContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      javaScriptEnabled: false,
    });
    const noJsDirectory = await noJsContext.newPage();
    await noJsDirectory.goto(`${baseURL}/people/?sign=leo#filter-sign-leo`, {
      waitUntil: 'domcontentloaded',
    });
    const expectedLeo = indexablePeople.filter((person) => person.sunSign.slug === 'leo').length;
    check(
      await noJsDirectory.locator('[data-person-card]:visible').count() === expectedLeo,
      'no-JS Leo filter did not use the reviewed manifest',
    );
    check(
      await noJsDirectory.locator('[data-people-search]').isHidden(),
      'no-JS directory exposed an inert search field',
    );
    for (const route of representative) {
      const response = await noJsDirectory.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
      check(response?.status() === 200, `${route}: no-JS request failed`);
      check(await noJsDirectory.locator('h1').isVisible(), `${route}: no-JS heading hidden`);
      check(await noJsDirectory.locator('.person-block').count() >= 4, `${route}: no-JS reading incomplete`);
      const correction = noJsDirectory.locator('a[href^="mailto:people@zodiacs.org"]');
      check(await correction.count() === 1, `${route}: no-JS correction route missing`);
      await noJsDirectory.locator('[data-evidence-disclosure] > summary').click();
      check(await correction.isVisible(), `${route}: no-JS correction route cannot be revealed`);
      check(
        await noJsDirectory.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${route}: no-JS page overflows`,
      );
    }
    await noJsContext.close();

    // The shared capsule must keep the same geometry on default, stable, and
    // local-content typography routes. Normal and font-blocked passes verify
    // both the canonical main-site faces and their shared fallback path.
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1280, height: 900 },
    ]) {
      const navRuns = [];
      for (const blockFonts of [false, true]) {
        const navStates = [];
        for (const route of ['/', '/people/', '/people/ada-lovelace/', '/birth-chart/', '/today/']) {
          const context = await browser.newContext({ viewport });
          if (blockFonts) {
            await context.route(/\.woff2(?:\?|$)/u, (requestRoute) => requestRoute.abort());
          }
          const page = await context.newPage();
          const fontRequests = [];
          const browserErrors = [];
          page.on('request', (request) => {
            if (request.resourceType() === 'font') fontRequests.push(request.url());
          });
          page.on('pageerror', (error) => browserErrors.push(error.message));
          const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
          const measureNav = () => page.evaluate(() => {
            const nav = document.querySelector('[data-nav]');
            const box = nav?.getBoundingClientRect();
            return {
              width: box?.width ?? 0,
              hasCollection: Boolean(nav?.querySelector('.nav__chip')),
              height: box?.height ?? 0,
              sans: nav ? getComputedStyle(nav).fontFamily : '',
              serif: document.querySelector('.nav__name')
                ? getComputedStyle(document.querySelector('.nav__name')).fontFamily
                : '',
              mono: document.querySelector('.nav__search-kbd')
                ? getComputedStyle(document.querySelector('.nav__search-kbd')).fontFamily
                : '',
            };
          });
          const initial = await measureNav();
          await page.waitForLoadState('load');
          await page.evaluate(async () => {
            await Promise.race([
              document.fonts.ready,
              new Promise((resolveReady) => setTimeout(resolveReady, 2_000)),
            ]);
            await new Promise((resolvePaint) => requestAnimationFrame(() => requestAnimationFrame(resolvePaint)));
          });
          const settled = await measureNav();
          navStates.push({ route, initial, settled });

          check(response?.status() === 200, `${route}@${viewport.width}: navigation geometry route failed`);
          if (blockFonts) {
            check(
              Math.abs(initial.width - settled.width) <= 0.1
                && Math.abs(initial.height - settled.height) <= 0.1,
              `${route}@${viewport.width}: fallback navigation resized after first paint`,
            );
          }
          check(
            browserErrors.length === 0,
            `${route}@${viewport.width}: navigation browser errors: ${browserErrors.join(' | ')}`,
          );
          if (route === '/people/' || route === '/today/') {
            const requestedFontPaths = [...new Set(fontRequests.map((url) => new URL(url).pathname))];
            const canonicalNavFonts = new Set([
              '/fonts/instrument-sans-latin-wght-normal.woff2',
              '/fonts/eb-garamond-latin-400-normal.woff2',
              '/fonts/eb-garamond-latin-500-normal.woff2',
              '/fonts/jetbrains-mono-latin-wght-normal.woff2',
            ]);
            check(
              requestedFontPaths.every((fontPath) => canonicalNavFonts.has(fontPath)),
              `${route}@${viewport.width}: local-content typography fetched a non-navigation font: ${requestedFontPaths.join(', ')}`,
            );
          }
          await context.close();
        }

        const baseline = navStates[0].settled;
        for (const state of navStates) {
          const isTool = ['/birth-chart/', '/today/'].includes(state.route);
          check(state.settled.hasCollection === !isTool, `${state.route}: navigation collection boundary differs`);
          // Tools omit Astrofolio and its reserved desktop width. Compare
          // each composition against its own reference, retaining the shared
          // height, typography and first-paint stability checks.
          const geometryReference = navStates.find((entry) => entry.route === (isTool ? '/birth-chart/' : '/'));
          check(
            Math.abs(state.settled.width - geometryReference.settled.width) <= 0.1
              && Math.abs(state.settled.height - baseline.height) <= 0.1,
            `${state.route}@${viewport.width}: navigation geometry differs from ${geometryReference.route}${blockFonts ? ' with fonts blocked' : ''}`,
          );
          check(
            state.settled.sans === baseline.sans
              && state.settled.serif === baseline.serif
              && state.settled.mono === baseline.mono,
            `${state.route}@${viewport.width}: navigation font families differ from /${blockFonts ? ' with fonts blocked' : ''}`,
          );
        }
        navRuns.push({ blockFonts, navStates });
      }

      const normalStates = navRuns.find((run) => !run.blockFonts)?.navStates ?? [];
      const blockedStates = navRuns.find((run) => run.blockFonts)?.navStates ?? [];
      check(normalStates.length === blockedStates.length, `${viewport.width}: navigation font-mode coverage differs`);
    }

    // Responsive and motion verification on representative content.
    for (const viewport of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 781, height: 900 },
      { width: 1280, height: 900 },
    ]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const browserErrors = [];
      page.on('pageerror', (error) => browserErrors.push(error.message));
      for (const route of ['/people/', ...representative]) {
        await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
        const width = await page.evaluate(() => {
          const shell = document.querySelector('.people-page, .person-page')?.getBoundingClientRect();
          return {
            document: document.documentElement.scrollWidth,
            viewport: innerWidth,
            gutterStart: shell?.left ?? -1,
            gutterEnd: shell ? innerWidth - shell.right : -1,
          };
        });
        check(
          width.document <= width.viewport + 1,
          `${route}@${viewport.width}: ${width.document}px content in ${width.viewport}px viewport`,
        );
        const expectedGutter = (viewport.width - Math.min(1120, viewport.width - 40)) / 2;
        check(
          Math.abs(width.gutterStart - expectedGutter) <= 0.5
            && Math.abs(width.gutterEnd - expectedGutter) <= 0.5,
          `${route}@${viewport.width}: People gutters ${width.gutterStart}/${width.gutterEnd}, expected ${expectedGutter}`,
        );
        if (OUT && (route === '/people/' || route === '/people/ada-lovelace/')) {
          const label = route === '/people/' ? 'directory' : 'ada-lovelace';
          await page.screenshot({
            path: `${OUT}/${label}-${viewport.width}.png`,
            fullPage: true,
          });
        }
      }
      check(browserErrors.length === 0, `${viewport.width}px browser errors: ${browserErrors.join(' | ')}`);
      await context.close();
    }

    const reducedContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const reducedPage = await reducedContext.newPage();
    await reducedPage.goto(`${baseURL}/people/ada-lovelace/`, { waitUntil: 'networkidle' });
    const reducedState = await reducedPage.evaluate(() => ({
      hiddenContent: [...document.querySelectorAll('.person-page *')].some((node) => (
        node instanceof HTMLElement && getComputedStyle(node).opacity === '0'
      )),
      moving: document.getAnimations().some((animation) => animation.playState === 'running'),
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    check(!reducedState.hiddenContent, 'reduced motion leaves People content invisible');
    check(!reducedState.moving, 'reduced motion leaves a People animation running');
    check(reducedState.width <= reducedState.viewport + 1, 'reduced-motion People page overflows');
    await reducedContext.close();

    // A 320 CSS-pixel viewport represents the layout available at 200% zoom
    // on a 640px-wide display and is the WCAG reflow boundary.
    const zoomContext = await browser.newContext({ viewport: { width: 320, height: 800 } });
    const zoomPage = await zoomContext.newPage();
    for (const route of ['/people/', '/people/ada-lovelace/']) {
      await zoomPage.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
      check(
        await zoomPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${route}: 200% equivalent reflow overflows`,
      );
    }
    await zoomContext.close();

    const birthdayContext = await browser.newContext({ viewport: { width: 781, height: 900 } });
    const birthdayPage = await birthdayContext.newPage();
    await birthdayPage.goto(`${baseURL}/birthday/december-10/`, { waitUntil: 'domcontentloaded' });
    check(
      await birthdayPage.locator('a[href="/people/ada-lovelace/"]').count() === 1,
      'birthday page does not cross-link Ada Lovelace',
    );
    await birthdayPage.goto(`${baseURL}/birthday/september-26/`, { waitUntil: 'domcontentloaded' });
    check(
      await birthdayPage.locator('a[href="/people/serena-williams/"]').count() === 0,
      'indexable birthday page links to a protected living profile',
    );
    await birthdayPage.goto(`${baseURL}/people/mahatma-gandhi/`, { waitUntil: 'domcontentloaded' });
    check(
      await birthdayPage.locator('.person-related a[href="/people/serena-williams/"]').count() === 0,
      'indexable related-person rail links to a protected living profile',
    );
    const takenRoutes = new Set(indexablePeople.map((person) => person.birthDate.birthdayRoute));
    const MONTH_SLUGS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    let emptyRoute = null;
    outer: for (let month = 1; month <= 12 && !emptyRoute; month += 1) {
      for (let day = 1; day <= 28; day += 1) {
        const route = `/birthday/${MONTH_SLUGS[month - 1]}-${day}/`;
        if (!takenRoutes.has(route)) { emptyRoute = route; break outer; }
      }
    }
    await birthdayPage.goto(`${baseURL}${emptyRoute}`, { waitUntil: 'domcontentloaded' });
    check(
      await birthdayPage.locator('.bday-people').count() === 0,
      `empty birthday date renders a People section (${emptyRoute})`,
    );
    /* Crowded date: the details disclosure appears past three people. */
    const crowded = [...takenRoutes].map((route) => ({
      route,
      count: indexablePeople.filter((person) => person.birthDate.birthdayRoute === route).length,
    })).sort((a, b) => b.count - a.count)[0];
    if (crowded.count > 3) {
      await birthdayPage.goto(`${baseURL}${crowded.route}`, { waitUntil: 'domcontentloaded' });
      check(
        await birthdayPage.locator('.bday-people__more summary').count() === 1,
        `crowded birthday date lacks the progressive disclosure (${crowded.route})`,
      );
      check(
        (await birthdayPage.locator('.bday-people [data-person-card]').count()) === crowded.count,
        `crowded date does not carry all ${crowded.count} people (${crowded.route})`,
      );
    }
    await birthdayContext.close();
  } finally {
    await browser.close();
  }
});

if (failures.length) {
  console.error(`phase5-people-drive: ${failures.length} failure(s) across ${assertions} assertions`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `phase5-people-drive: PASS — ${assertions} assertions;`
  + ` ${indexablePeople.length} indexable profiles, ${deferredPeople.length} deferred,`
  + ` directory + ${protectedLiving.length} living profiles protected,`
  + ' 20 portraits/fallbacks, no-JS, responsive, keyboard and reduced-motion states',
);
