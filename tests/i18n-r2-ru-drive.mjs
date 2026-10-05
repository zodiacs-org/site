import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { RU_OG_ROUTE_CARDS } from '../src/strings/seo.ru.mjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
import { russianDeferredStyleURLs, russianDeferredStylesReady } from './i18n-r2-deferred-styles.mjs';

const OUT = process.env.OUT_DIR ?? null;
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const signs = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const corePaths = [
  '/', '/tools/', '/birth-chart/', '/compatibility/', '/moon-sign/',
  '/rising-sign/', '/moon-phase/', '/saturn-return/', '/transits/',
  '/baby-zodiac/', '/profile/', '/methodology/', '/privacy/', '/disclosure/',
  '/big-three/', '/compatibility/invite/', '/group-charts/', '/chart-twins/',
  ...signs.map((sign) => `/${sign}/`),
];
const signPaths = new Set(signs.map((sign) => `/${sign}/`));
const indexedRoutes = corePaths.filter((path) => !signPaths.has(path)).map((path) => `/ru${path}`);
const noindexSignRoutes = new Set(signs.map((sign) => `/ru/${sign}/`));
const routes = [...indexedRoutes, ...noindexSignRoutes, '/ru/404/'];
const expectedHreflangs = ['en', 'es', 'pt-BR', 'fr', 'it', 'ru', 'x-default'];
const structuredImageRoutes = new Set([
  '/ru/birth-chart/', '/ru/compatibility/', '/ru/moon-sign/',
  '/ru/rising-sign/', '/ru/moon-phase/', '/ru/saturn-return/',
  '/ru/transits/', '/ru/baby-zodiac/', '/ru/methodology/',
  ...signs.map((sign) => `/ru/${sign}/`),
]);

if (OUT) await mkdir(OUT, { recursive: true });

await withPreview({ port: 4418 }, async (baseURL) => {
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    args: STABLE_CHROMIUM_ARGS,
  });
  try {
    for (const viewport of [{ width: 360, height: 800 }, { width: 1280, height: 900 }]) {
      const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
      const page = await context.newPage();
      const browserErrors = [];
      page.on('pageerror', (error) => browserErrors.push(error.message));

      for (const route of routes) {
        const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
        check(response?.status() === 200, `${route}@${viewport.width}: expected 200, got ${response?.status()}`);
        const state = await page.evaluate(() => ({
          lang: document.documentElement.lang,
          dir: document.documentElement.getAttribute('dir'),
          robots: document.querySelector('meta[name="robots"]')?.getAttribute('content'),
          canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
          alternates: Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'))
            .map((node) => [node.getAttribute('hreflang'), node.getAttribute('href')]),
          ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
          twitterImage: document.querySelector('meta[name="twitter:image"]')?.getAttribute('content'),
          structuredImages: Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
            .flatMap((node) => {
              const images = [];
              const walk = (value) => {
                if (Array.isArray(value)) {
                  value.forEach(walk);
                  return;
                }
                if (!value || typeof value !== 'object') return;
                if (typeof value.image === 'string') images.push(value.image);
                Object.values(value).forEach(walk);
              };
              try { walk(JSON.parse(node.textContent ?? 'null')); } catch { return ['INVALID_JSON_LD']; }
              return images;
            }),
          width: document.documentElement.scrollWidth,
          viewport: innerWidth,
          selectorEntries: document.querySelectorAll(
            '.footer__languages .footer__language-option, .zfooter__locales .zfooter__locale',
          ).length,
          selectorText: document.querySelector('.footer__languages, .zfooter__locales')?.textContent ?? '',
          cyrillic: (document.body.innerText.match(/[А-Яа-яЁё]/gu) ?? []).length,
          arHref: Boolean(document.querySelector('a[href="/ar"], a[href^="/ar/"]')),
        }));
        const notFound = route === '/ru/404/';
        const noindex = notFound || noindexSignRoutes.has(route);
        check(state.lang === 'ru', `${route}@${viewport.width}: lang=${state.lang}`);
        check(state.dir === null, `${route}@${viewport.width}: Russian page emitted dir=${state.dir}`);
        check(
          state.robots === (noindex ? 'noindex, follow, max-image-preview:large' : 'max-image-preview:large'),
          `${route}: robots=${state.robots}`,
        );
        check(state.canonical === `https://zodiacs.org${route}`, `${route}: canonical=${state.canonical}`);
        check(
          JSON.stringify(state.alternates.map(([hreflang]) => hreflang))
            === JSON.stringify(noindex ? [] : expectedHreflangs),
          `${route}: hreflangs=${state.alternates.map(([hreflang]) => hreflang).join(',') || 'none'}`,
        );
        if (!noindex) {
          const englishPath = route === '/ru/' ? '/' : route.slice('/ru'.length);
          check(
            state.alternates.find(([hreflang]) => hreflang === 'x-default')?.[1]
              === `https://zodiacs.org${englishPath}`,
            `${route}: x-default is not English`,
          );
        }
        const expectedImage = RU_OG_ROUTE_CARDS[route]
          ? `https://zodiacs.org/assets/og/v2/ru/${RU_OG_ROUTE_CARDS[route]}`
          : null;
        check(state.ogImage === expectedImage, `${route}: og:image=${state.ogImage}`);
        check(state.twitterImage === expectedImage, `${route}: twitter:image=${state.twitterImage}`);
        if (structuredImageRoutes.has(route)) {
          check(
            state.structuredImages.length === 1 && state.structuredImages[0] === expectedImage,
            `${route}: structured image=${state.structuredImages.join(',') || 'none'}`,
          );
        }
        check(
          state.structuredImages.every((value) => value === expectedImage),
          `${route}: structured data references non-Russian artwork`,
        );
        check(state.width <= state.viewport + 1, `${route}@${viewport.width}: ${state.width}px overflow`);
        check(state.selectorEntries === 6, `${route}: language selector has ${state.selectorEntries} entries`);
        check(/Русский/u.test(state.selectorText) && !/العربية/u.test(state.selectorText), `${route}: selector release set drifted`);
        check(state.cyrillic >= 60, `${route}: too little Russian copy (${state.cyrillic} Cyrillic letters)`);
        check(!state.arHref, `${route}: Arabic route leaked`);

        if (route === '/ru/' && viewport.width === 1280) {
          const desktopEnglishSeams = await page.locator('.nav__deferred').allTextContents();
          check(desktopEnglishSeams.length === 3, `Russian desktop nav exposes ${desktopEnglishSeams.length} English-only seams; expected 3`);
          check(desktopEnglishSeams.every((value) => value.trim() === '— пока по-английски'), 'Russian desktop nav seam copy drifted');
          check(await page.locator('.nav__search').count() === 0, 'English-only search control leaked into Russian desktop nav');
          const astrofolioChip = page.locator('.nav__chip');
          check(await astrofolioChip.getAttribute('href') === '/astrofolio/', 'Russian desktop Astrofolio seam points somewhere else');
          check(await astrofolioChip.getAttribute('hreflang') === 'en', 'Russian desktop Astrofolio seam is not declared English');
          check((await astrofolioChip.textContent() ?? '').includes('Astrofolio'), 'Russian desktop Astrofolio seam lost its label');
        }

        if (OUT && ['/ru/', '/ru/birth-chart/', '/ru/aries/'].includes(route)) {
          const name = route === '/ru/' ? 'home' : route.split('/').filter(Boolean).at(-1);
          await page.screenshot({ path: `${OUT}/${name}-${viewport.width}.png`, fullPage: true });
        }
      }

      if (viewport.width === 1280) {
        for (const path of corePaths) {
          await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
          const russianAlternateNode = page.locator('link[rel="alternate"][hreflang="ru"]');
          const russianAlternate = await russianAlternateNode.count() > 0
            ? await russianAlternateNode.first().getAttribute('href')
            : null;
          check(
            russianAlternate === (signPaths.has(path) ? null : `https://zodiacs.org/ru${path}`),
            `${path}: reciprocal Russian alternate=${russianAlternate}`,
          );
          check(
            await page.locator(
              '.footer__languages .footer__language-option, .zfooter__locales .zfooter__locale',
            ).count() === 6,
            `${path}: public language selector does not expose Russian`,
          );
        }
      }

      check(browserErrors.length === 0, `${viewport.width}px browser errors: ${browserErrors.join(' | ')}`);
      await context.close();
    }

    const mobile = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${baseURL}/ru/`, { waitUntil: 'domcontentloaded' });
    const menu = mobilePage.locator('[data-menu-toggle]');
    check(await menu.getAttribute('aria-label') === 'Открыть меню', 'mobile menu open label is not Russian');
    await menu.focus();
    await menu.press('Enter');
    check(await menu.getAttribute('aria-expanded') === 'true', 'mobile menu did not open from keyboard');
    check(await menu.getAttribute('aria-label') === 'Закрыть меню', 'mobile menu close label is not Russian');
    check(await mobilePage.locator('[data-mobile-menu]').isVisible(), 'mobile menu is not visible after keyboard open');
    check(await mobilePage.locator('[data-mobile-menu] a[href="/birthday/"]').count() === 0, 'deferred birthday tool leaked into Russian mobile menu');
    check(await mobilePage.locator('[data-mobile-menu] a[href="/learn/"][hreflang="en"]').count() === 1, 'Russian mobile Learn seam is not declared English');
    check(await mobilePage.locator('[data-mobile-menu] a[href="/astrofolio/"][hreflang="en"]').count() === 1, 'Russian mobile Astrofolio seam is not declared English');
    // Opening the full-screen menu moves focus onto its first link (the
    // burger no longer keeps it), so the visible-focus contract is checked
    // on whatever actually holds focus inside the menu.
    const focusReceipt = await mobilePage.evaluate(() => {
      const active = document.activeElement;
      return {
        inMenu: Boolean(active && active.closest('[data-mobile-menu]')),
        outline: active ? getComputedStyle(active).outlineStyle : 'none',
      };
    });
    check(focusReceipt.inMenu, 'keyboard open did not move focus into the mobile menu');
    check(focusReceipt.outline !== 'none', 'mobile menu focus is not visible');
    await mobile.close();

    const reduced = await browser.newContext({
      viewport: { width: 360, height: 800 },
      reducedMotion: 'reduce',
    });
    const reducedPage = await reduced.newPage();
    await reducedPage.goto(`${baseURL}/ru/`, { waitUntil: 'networkidle' });
    const reducedState = await reducedPage.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      hiddenReveal: Array.from(document.querySelectorAll('.reveal')).some((node) => getComputedStyle(node).opacity === '0'),
    }));
    check(reducedState.width <= reducedState.viewport + 1, 'reduced-motion Russian home overflows');
    check(!reducedState.hiddenReveal, 'reduced-motion Russian home leaves content hidden');
    await reduced.close();

    const chartContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const chart = await chartContext.newPage();
    const chartErrors = [];
    chart.on('pageerror', (error) => chartErrors.push(error.message));
    await chart.goto(`${baseURL}/ru/birth-chart/`, { waitUntil: 'networkidle' });
    check(await chart.getByLabel('Дата рождения').count() === 1, 'Russian birth-date label is missing');
    check(await chart.getByLabel('Время рождения').count() === 1, 'Russian birth-time label is missing');
    check(await chart.getByLabel('Место рождения').count() === 1, 'Russian birthplace label is missing');
    await chart.locator('#birth-date').fill('1990-06-15');
    await chart.locator('#birth-time').fill('08:30');
    await chart.locator('#place').fill('New York');
    await chart.locator('#place-list [role="option"]').first().waitFor({ timeout: 10_000 });
    await chart.locator('#place-list [role="option"]').first().click();
    await chart.locator('form.calc__form button[type="submit"]').click();
    await chart.locator('.calc__result').waitFor({ timeout: 20_000 });
    const chartText = await chart.locator('.calc__result').innerText();
    check(/[А-Яа-яЁё]/u.test(chartText), 'computed chart result has no Russian copy');
    check(!/Your (?:Moon|Rising)|Birth chart|House system/u.test(chartText), 'computed chart result leaked English interface copy');
    check(await chart.locator('.calc__result').evaluate((node) => node.scrollWidth <= node.clientWidth + 1), 'computed Russian chart result overflows');
    check(chartErrors.length === 0, `Russian chart browser errors: ${chartErrors.join(' | ')}`);
    await chartContext.close();

    const firstPaintContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const firstPaint = await firstPaintContext.newPage();
    await firstPaint.addInitScript(() => {
      window.__zdxLayoutShift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__zdxLayoutShift += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const firstPaintResponse = await firstPaint.goto(`${baseURL}/ru/birth-chart/`, { waitUntil: 'domcontentloaded' });
    const initialGeometry = await firstPaint.evaluate(() => {
      const rect = (selector) => {
        const bounds = document.querySelector(selector)?.getBoundingClientRect();
        return bounds && [bounds.x, bounds.y, bounds.width, bounds.height]
          .map((value) => Math.round(value * 100) / 100);
      };
      return {
        stylesheetURLs: Array.from(document.styleSheets, (sheet) => sheet.href),
        core: rect('.calc__core'),
        fields: rect('.calc__fields'),
        date: rect('#birth-date'),
        submit: rect('.calc__submit'),
      };
    });
    // Use the served response, since the loader removes templates after activation.
    const deferredStyleURLs = russianDeferredStyleURLs(await firstPaintResponse.text(), baseURL);
    const initialToolStyles = initialGeometry.stylesheetURLs.filter((url) => deferredStyleURLs.includes(url));
    check(initialToolStyles.length === 0, `Russian calculator loaded ${initialToolStyles.length} deferred styles before first paint`);
    await firstPaint.waitForFunction(russianDeferredStylesReady, deferredStyleURLs);
    await firstPaint.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    const settledGeometry = await firstPaint.evaluate(() => {
      const rect = (selector) => {
        const bounds = document.querySelector(selector)?.getBoundingClientRect();
        return bounds && [bounds.x, bounds.y, bounds.width, bounds.height]
          .map((value) => Math.round(value * 100) / 100);
      };
      return {
        core: rect('.calc__core'),
        fields: rect('.calc__fields'),
        date: rect('#birth-date'),
        submit: rect('.calc__submit'),
        layoutShift: window.__zdxLayoutShift,
      };
    });
    for (const target of ['core', 'fields', 'date', 'submit']) {
      check(
        JSON.stringify(initialGeometry[target]) === JSON.stringify(settledGeometry[target]),
        `Russian calculator ${target} moved when deferred styles loaded: ${JSON.stringify(initialGeometry[target])} -> ${JSON.stringify(settledGeometry[target])}`,
      );
    }
    check(settledGeometry.layoutShift === 0, `Russian calculator deferred styles caused CLS ${settledGeometry.layoutShift}`);
    await firstPaintContext.close();

    const criticalInteractionContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const criticalInteraction = await criticalInteractionContext.newPage();
    await criticalInteraction.route(
      (url) => deferredStyleURLs.includes(url.href),
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3_000));
        await route.continue();
      },
    );
    await criticalInteraction.goto(`${baseURL}/ru/birth-chart/`, { waitUntil: 'domcontentloaded' });
    await criticalInteraction.locator('#birth-date').focus();
    const focusState = await criticalInteraction.locator('#birth-date').evaluate((control) => ({
      focusVisible: control.matches(':focus-visible'),
      outlineStyle: getComputedStyle(control).outlineStyle,
      outlineWidth: getComputedStyle(control).outlineWidth,
    }));
    check(focusState.focusVisible, 'Russian calculator date input does not receive :focus-visible');
    check(
      focusState.outlineStyle !== 'none' && focusState.outlineWidth === '2px',
      `Russian calculator keyboard focus ring is ${focusState.outlineStyle} ${focusState.outlineWidth}`,
    );
    await criticalInteraction.locator('#place').fill('New York');
    const criticalPlaceList = criticalInteraction.locator('#place-list');
    await criticalPlaceList.waitFor({ timeout: 10_000 });
    const criticalPlaceState = await criticalPlaceList.evaluate((list, expectedURLs) => ({
      position: getComputedStyle(list).position,
      listStyle: getComputedStyle(list).listStyleType,
      padding: getComputedStyle(list).padding,
      background: getComputedStyle(list).backgroundColor,
      toolStyles: Array.from(document.styleSheets)
        .filter((sheet) => expectedURLs.includes(sheet.href)).length,
    }), deferredStyleURLs);
    check(criticalPlaceState.toolStyles === 0, 'Russian PlaceSearch test did not hold the deferred styles in flight');
    check(criticalPlaceState.position === 'absolute', `Russian PlaceSearch position=${criticalPlaceState.position} before deferred CSS`);
    check(criticalPlaceState.listStyle === 'none', `Russian PlaceSearch list-style=${criticalPlaceState.listStyle} before deferred CSS`);
    check(criticalPlaceState.padding === '6px', `Russian PlaceSearch padding=${criticalPlaceState.padding} before deferred CSS`);
    check(
      criticalPlaceState.background !== 'rgba(0, 0, 0, 0)',
      'Russian PlaceSearch background is transparent before deferred CSS',
    );
    await criticalInteractionContext.close();

    const hydrationRaceContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const hydrationRace = await hydrationRaceContext.newPage();
    await hydrationRace.route(/\/_astro\/ChartCalculator\..*\.js$/u, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    await hydrationRace.goto(`${baseURL}/ru/birth-chart/`, { waitUntil: 'domcontentloaded' });
    await hydrationRace.locator('#birth-date').fill('2000-01-02');
    await hydrationRace.locator('astro-island:not([ssr])').waitFor({ timeout: 10_000 });
    check(
      await hydrationRace.locator('#birth-date').inputValue() === '2000-01-02',
      'Russian calculator hydration erased a value entered while its module was in flight',
    );

    await hydrationRace.goto(`${baseURL}/ru/birth-chart/`, { waitUntil: 'domcontentloaded' });
    await hydrationRace.evaluate(() => {
      window.__zdxLateHydrationEdit = false;
      document.querySelector('astro-island')?.addEventListener('astro:hydrate', () => {
        const input = document.querySelector('#birth-date');
        input.value = '2001-02-03';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        window.__zdxLateHydrationEdit = true;
      }, { once: true });
    });
    await hydrationRace.locator('#birth-date').fill('2000-01-02');
    await hydrationRace.waitForFunction(() => window.__zdxLateHydrationEdit === true);
    await hydrationRace.waitForTimeout(200);
    check(
      await hydrationRace.locator('#birth-date').inputValue() === '2001-02-03',
      'Russian calculator hydration restore overwrote a newer edit made during takeover',
    );
    await hydrationRaceContext.close();

    const submitGuardContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const submitGuard = await submitGuardContext.newPage();
    const submitGuardErrors = [];
    let submitGuardDocuments = 0;
    submitGuard.on('pageerror', (error) => submitGuardErrors.push(error.message));
    submitGuard.on('request', (request) => {
      if (request.resourceType() === 'document') submitGuardDocuments += 1;
    });
    await submitGuard.addInitScript(() => {
      // A hidden tab may suspend requestAnimationFrame forever. Keep it inert
      // here so the directive's timer barrier is the only way to replay submit.
      let frame = 0;
      window.requestAnimationFrame = () => { frame += 1; return frame; };
      window.cancelAnimationFrame = () => {};
    });
    await submitGuard.route(/\/_astro\/ChartCalculator\..*\.js$/u, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    await submitGuard.goto(`${baseURL}/ru/birth-chart/`, { waitUntil: 'domcontentloaded' });
    await submitGuard.locator('form.calc__form button[type="submit"]').click();
    await submitGuard.locator('#birth-date[aria-invalid="true"]').waitFor({ timeout: 10_000 });
    check(
      submitGuardDocuments === 1,
      `Russian calculator pre-hydration submit navigated ${submitGuardDocuments} documents`,
    );
    check(
      new URL(submitGuard.url()).search === '',
      `Russian calculator pre-hydration submit changed URL to ${submitGuard.url()}`,
    );
    check(
      submitGuardErrors.length === 0,
      `Russian calculator submit guard browser errors: ${submitGuardErrors.join(' | ')}`,
    );

    const falseEagerHash = await submitGuard.evaluate(async () => {
      history.replaceState(null, '', '#p=must-not-eagerly-hydrate');
      const host = document.createElement('div');
      document.body.append(host);
      let loads = 0;
      window.Astro.interaction(
        async () => {
          loads += 1;
          return async () => {};
        },
        { value: { eagerHash: false } },
        host,
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      host.remove();
      return loads;
    });
    check(falseEagerHash === 0, `client:interaction treated eagerHash:false as eager (${falseEagerHash} loads)`);
    await submitGuardContext.close();

    const retryContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const retry = await retryContext.newPage();
    await retry.goto(`${baseURL}/ru/birth-chart/`, { waitUntil: 'domcontentloaded' });
    const retryReceipt = await retry.evaluate(async () => {
      const host = document.createElement('div');
      const input = document.createElement('input');
      host.append(input);
      document.body.append(host);
      let attempts = 0;
      let hydrations = 0;
      let unhandled = 0;
      const onUnhandled = (event) => {
        unhandled += 1;
        event.preventDefault();
      };
      window.addEventListener('unhandledrejection', onUnhandled);

      window.Astro.interaction(
        async () => {
          attempts += 1;
          if (attempts === 1) throw new Error('expected interaction load rejection');
          return async () => { hydrations += 1; };
        },
        { value: false },
        host,
      );
      input.focus();
      await new Promise((resolve) => setTimeout(resolve, 50));
      input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 200));

      window.removeEventListener('unhandledrejection', onUnhandled);
      host.remove();
      return { attempts, hydrations, unhandled };
    });
    check(retryReceipt.attempts === 2, `client:interaction rejected-load attempts=${retryReceipt.attempts}`);
    check(retryReceipt.hydrations === 1, `client:interaction retry hydrations=${retryReceipt.hydrations}`);
    check(retryReceipt.unhandled === 0, `client:interaction leaked ${retryReceipt.unhandled} unhandled rejection(s)`);
    await retryContext.close();

    const fontPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await fontPage.goto(`${baseURL}/ru/`, { waitUntil: 'networkidle' });
    const fonts = await fontPage.evaluate(async () => {
      await document.fonts.ready;
      return {
        golos: document.fonts.check('16px "Golos Text"', 'Натальная карта'),
        garamond: document.fonts.check('32px "EB Garamond Cyrillic"', 'Знаки'),
        mono: document.fonts.check('12px "JetBrains Mono Cyrillic"', 'ДАТА'),
      };
    });
    check(fonts.golos && fonts.garamond && fonts.mono, `Russian fonts did not load: ${JSON.stringify(fonts)}`);
    await fontPage.close();
  } finally {
    await browser.close();
  }
});

if (failures.length) {
  console.error(`i18n-r2-ru-drive: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('i18n-r2-ru-drive: 26 public routes + noindex 404 passed at 360/1280, including reciprocal discovery, keyboard, reduced-motion, chart-result, and font checks');
