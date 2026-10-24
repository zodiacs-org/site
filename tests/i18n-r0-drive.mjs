import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const CORE_LOCALES = [
  { code: 'en', prefix: '', lang: 'en', hreflang: 'en' },
  { code: 'es', prefix: '/es', lang: 'es', hreflang: 'es' },
  { code: 'pt', prefix: '/pt', lang: 'pt-BR', hreflang: 'pt-BR' },
  { code: 'fr', prefix: '/fr', lang: 'fr', hreflang: 'fr' },
  { code: 'it', prefix: '/it', lang: 'it', hreflang: 'it' },
  { code: 'ru', prefix: '/ru', lang: 'ru', hreflang: 'ru' },
];
const PROGRAMMATIC_LOCALES = CORE_LOCALES.filter((entry) => entry.code !== 'ru');
const CORE_HREFLANGS = [...CORE_LOCALES.map((entry) => entry.hreflang), 'x-default'];
const FORECAST_LOCALES = CORE_LOCALES.filter((entry) => ['en', 'es', 'pt'].includes(entry.code));
// The Chinese zodiac guide alone also has Simplified and Traditional Chinese editions.
const CHINESE_ZODIAC_LOCALES = [
  ...PROGRAMMATIC_LOCALES,
  { code: 'zh-hans', prefix: '/zh-hans', lang: 'zh-Hans', hreflang: 'zh-Hans' },
  { code: 'zh-hant', prefix: '/zh-hant', lang: 'zh-Hant', hreflang: 'zh-Hant' },
];
const CHINESE_ZODIAC_HREFLANGS = [...CHINESE_ZODIAC_LOCALES.map((entry) => entry.hreflang), 'x-default'];
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const localizedPath = (prefix, path) => `${prefix}${path}` || '/';

async function routeState(page) {
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    dirAttribute: document.documentElement.getAttribute('dir'),
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
    robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
    alternates: Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'))
      .map((node) => [node.getAttribute('hreflang'), node.href]),
    selector: Array.from(document.querySelectorAll(
      '.footer__languages .footer__language-option, .zfooter__locales .zfooter__locale',
    ))
      .map((node) => node.textContent?.replace(/^\s*·\s*/, '').trim()),
    forecastSelector: Array.from(document.querySelectorAll('.zfooter__locales .zfooter__locale'))
      .map((node) => ({
        lang: node.getAttribute('lang'),
        href: node.getAttribute('href'),
        current: node.getAttribute('aria-current'),
      })),
    russian: /Русский/u.test(document.body.textContent ?? '')
      || Boolean(document.querySelector('a[href="/ru"], a[href^="/ru/"]')),
    arabic: /العربية/u.test(document.body.textContent ?? '')
      || Boolean(document.querySelector('a[href="/ar"], a[href^="/ar/"]')),
  }));
}

await withPreview({ port: 4417 }, async (baseURL) => {
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    args: STABLE_CHROMIUM_ARGS,
  });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
      const page = await browser.newPage({ viewport });
      const browserErrors = [];
      page.on('pageerror', (error) => browserErrors.push(error.message));

      for (const route of ['/', '/birth-chart/']) {
        for (const locale of CORE_LOCALES) {
          const path = localizedPath(locale.prefix, route);
          const response = await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
          check(response?.status() === 200, `${path}@${viewport.width}: expected 200, got ${response?.status()}`);
          const state = await routeState(page);
          check(state.lang === locale.lang, `${path}@${viewport.width}: lang ${state.lang}`);
          check(state.dirAttribute === null, `${path}@${viewport.width}: LTR output gained dir=${state.dirAttribute}`);
          check(state.width <= state.viewport + 1, `${path}@${viewport.width}: ${state.width}px overflow`);
          check(state.canonical === `https://zodiacs.org${path}`, `${path}: canonical ${state.canonical}`);
          check(
            JSON.stringify(state.alternates.map(([lang]) => lang)) === JSON.stringify(CORE_HREFLANGS),
            `${path}: hreflangs ${state.alternates.map(([lang]) => lang).join(',')}`,
          );
          check(state.selector.length === 6, `${path}: selector has ${state.selector.length} entries`);
          check(state.russian && !state.arabic, `${path}: public core selector release set drifted`);
        }
      }

      for (const route of ['/learn/chinese-zodiac/dragon/']) {
        for (const locale of CHINESE_ZODIAC_LOCALES) {
          const path = localizedPath(locale.prefix, route);
          const response = await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
          check(response?.status() === 200, `${path}@${viewport.width}: expected 200, got ${response?.status()}`);
          const state = await routeState(page);
          check(state.lang === locale.lang, `${path}@${viewport.width}: lang ${state.lang}`);
          check(state.dirAttribute === null, `${path}@${viewport.width}: LTR output gained dir=${state.dirAttribute}`);
          check(state.width <= state.viewport + 1, `${path}@${viewport.width}: ${state.width}px overflow`);
          check(state.canonical === `https://zodiacs.org${path}`, `${path}: canonical ${state.canonical}`);
          check(
            JSON.stringify(state.alternates.map(([lang]) => lang)) === JSON.stringify(CHINESE_ZODIAC_HREFLANGS),
            `${path}: hreflangs ${state.alternates.map(([lang]) => lang).join(',')}`,
          );
          check(state.selector.length === 7, `${path}: selector has ${state.selector.length} entries`);
          check(!state.russian && !state.arabic, `${path}: deferred locale leaked into programmatic output`);
        }
      }

      for (const locale of PROGRAMMATIC_LOCALES) {
        const route = '/birthday/july-15/';
        const path = localizedPath(locale.prefix, route);
        const response = await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
        check(response?.status() === 200, `${path}@${viewport.width}: expected 200, got ${response?.status()}`);
        const state = await routeState(page);
        const localizedPreview = locale.code !== 'en';
        check(state.lang === locale.lang, `${path}@${viewport.width}: lang ${state.lang}`);
        check(state.dirAttribute === null, `${path}@${viewport.width}: LTR output gained dir=${state.dirAttribute}`);
        check(state.width <= state.viewport + 1, `${path}@${viewport.width}: ${state.width}px overflow`);
        check(state.canonical === `https://zodiacs.org${path}`, `${path}: canonical ${state.canonical}`);
        check(
          state.robots === (localizedPreview
            ? 'noindex, follow, max-image-preview:large'
            : 'max-image-preview:large'),
          `${path}: robots ${state.robots}`,
        );
        check(
          JSON.stringify(state.alternates.map(([lang]) => lang))
            === JSON.stringify(localizedPreview ? [] : ['en', 'x-default']),
          `${path}: hreflangs ${state.alternates.map(([lang]) => lang).join(',')}`,
        );
        check(state.selector.length === 5, `${path}: selector has ${state.selector.length} entries`);
        check(!state.russian && !state.arabic, `${path}: deferred locale leaked into birthday output`);
      }

      // These forecasts have a released EN/ES/PT route family. Verify exact
      // reciprocal destinations; the remaining deferred routes stay separate.
      for (const route of ['/today/', '/horoscopes/', '/horoscopes/aries/']) {
        const expectedAlternates = [
          ...FORECAST_LOCALES.map((entry) => [entry.hreflang, `https://zodiacs.org${localizedPath(entry.prefix, route)}`]),
          ['x-default', `https://zodiacs.org${route}`],
        ];
        for (const locale of FORECAST_LOCALES) {
          const path = localizedPath(locale.prefix, route);
          const response = await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
          check(response?.status() === 200, `${path}@${viewport.width}: released forecast is unavailable`);
          const state = await routeState(page);
          check(state.lang === locale.lang && state.dirAttribute === null,
            `${path}: forecast language/direction ${state.lang}/${state.dirAttribute}`);
          check(state.canonical === `https://zodiacs.org${path}`, `${path}: canonical ${state.canonical}`);
          check(JSON.stringify(state.alternates) === JSON.stringify(expectedAlternates),
            `${path}: forecast alternates ${JSON.stringify(state.alternates)}`);
          const expectedSelector = FORECAST_LOCALES.map((entry) => ({
            lang: entry.lang,
            href: entry.code === locale.code ? null : localizedPath(entry.prefix, route),
            current: entry.code === locale.code ? 'page' : null,
          }));
          check(JSON.stringify(state.forecastSelector) === JSON.stringify(expectedSelector),
            `${path}: forecast route selector ${JSON.stringify(state.forecastSelector)}`);
          check(state.width <= state.viewport + 1, `${path}@${viewport.width}: ${state.width}px overflow`);
          check(!state.russian && !state.arabic, `${path}: unavailable forecast locale leaked`);
        }
      }

      for (const { path, selectorCount } of [
        { path: '/events/', selectorCount: 5 },
        { path: '/registry/', selectorCount: 5 },
      ]) {
        const response = await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
        check(response?.status() === 200, `${path}@${viewport.width}: deferred route is unavailable`);
        const state = await routeState(page);
        check(state.alternates.length === 0, `${path}: deferred route emitted ${state.alternates.length} hreflangs`);
        check(state.selector.length === selectorCount,
          `${path}: deferred route locale-home selector has ${state.selector.length} entries`);
        check(state.width <= state.viewport + 1, `${path}@${viewport.width}: ${state.width}px overflow`);
        check(!state.russian && !state.arabic, `${path}: unavailable locale href leaked`);
      }
      check(browserErrors.length === 0, `${viewport.width}px browser errors: ${browserErrors.join(' | ')}`);
      await page.close();
    }

    const page = await browser.newPage();
    for (const path of [
      '/ar/', '/ar/birth-chart/',
      '/ru/birthday/july-15/', '/ru/learn/chinese-zodiac/dragon/',
      '/ru/today/', '/ru/horoscopes/aries/', '/ru/events/', '/ru/registry/',
    ]) {
      const response = await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
      check(response?.status() === 404, `${path}: expected 404, got ${response?.status()}`);
    }
    await page.close();

    // A short page can put the canonical footer in the first viewport before
    // images finish loading. Its stylesheet must be requested as soon as the
    // loader learns the footer is near (the observer's first report, after
    // the first layout that follows the loader), never by the post-load
    // fallback, which fires 250 ms after the window load event. The footer is
    // held hidden until then, so no raw footer markup shows either way.
    // That report is not due by DOMContentLoaded: when Chromium paints its
    // first frame before the parser reaches the footer, the report waits for
    // the next frame, which a page with nothing left to load reaches after
    // DOMContentLoaded and window load. So both checks wait for the loader's
    // decision (its link, or a distant footer's hold dropped) instead of
    // reading the page at DOMContentLoaded.
    // Match the canonical asset independently of its rotating cache version.
    const footerLink = 'link[rel="stylesheet"][href^="/assets/site-footer.css?"]';
    const recordFooterTiming = (selector) => {
      window.__zdxFooterLinkAt = null;
      window.__zdxWindowLoadAt = null;
      const recordFooterLink = () => {
        if (window.__zdxFooterLinkAt === null && document.querySelector(selector)) {
          window.__zdxFooterLinkAt = performance.now();
        }
      };
      new MutationObserver(recordFooterLink).observe(document, { childList: true, subtree: true });
      window.addEventListener('load', () => {
        recordFooterLink();
        window.__zdxWindowLoadAt = performance.now();
      }, { once: true });
    };
    const footerDecision = async (page) => {
      const decided = await page.waitForFunction(
        (selector) => Boolean(document.querySelector(selector))
          || !document.documentElement.hasAttribute('data-footer-styles-pending'),
        footerLink,
        { timeout: 10_000 },
      ).then(() => true, () => false);
      return page.evaluate(({ selector, decided }) => {
        const footer = document.querySelector('.zfooter');
        return {
          decided,
          nearViewport: Boolean(footer && footer.getBoundingClientRect().top <= innerHeight + 200),
          stylesheetRequested: Boolean(document.querySelector(selector)),
          stylesheetObservedAt: window.__zdxFooterLinkAt,
          windowLoadAt: window.__zdxWindowLoadAt,
        };
      }, { selector: footerLink, decided });
    };

    // With its fonts held in flight, as a short page's images can be, the
    // page cannot fire window load, so the request must come before it.
    const heldPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    let releaseFonts;
    const fontsReleased = new Promise((resolve) => { releaseFonts = resolve; });
    let heldFonts = 0;
    try {
      await heldPage.addInitScript(recordFooterTiming, footerLink);
      await heldPage.route((url) => url.pathname.startsWith('/fonts/'), async (route) => {
        heldFonts += 1;
        await fontsReleased;
        await route.continue().catch(() => {});
      });
      const heldResponse = await heldPage.goto(`${baseURL}/es/learn/`, { waitUntil: 'domcontentloaded' });
      check(heldResponse?.status() === 200, `/es/learn/: expected 200, got ${heldResponse?.status()}`);
      const heldFooter = await footerDecision(heldPage);
      check(heldFonts > 0, '/es/learn/: no font request held window load open');
      check(
        heldFooter.decided && heldFooter.stylesheetRequested && heldFooter.windowLoadAt === null,
        `/es/learn/: near-viewport footer CSS waited for window load (${JSON.stringify(heldFooter)})`,
      );
    } finally {
      releaseFonts();
      await heldPage.waitForLoadState('load', { timeout: 10_000 }).catch(() => {});
      await heldPage.close();
    }

    // With nothing left to load, window load fires as parsing ends and the
    // observer's report can follow it by a frame; it must still be that
    // report, not the fallback, that requests the stylesheet.
    const shortPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await shortPage.addInitScript(recordFooterTiming, footerLink);
    const shortResponse = await shortPage.goto(`${baseURL}/es/learn/`, {
      waitUntil: 'domcontentloaded',
    });
    check(shortResponse?.status() === 200, `/es/learn/: expected 200, got ${shortResponse?.status()}`);
    const shortFooter = await footerDecision(shortPage);
    check(shortFooter.nearViewport, '/es/learn/: fixture footer is no longer near the first viewport');
    check(
      shortFooter.decided && shortFooter.stylesheetObservedAt !== null
        && (shortFooter.windowLoadAt === null || shortFooter.stylesheetObservedAt < shortFooter.windowLoadAt + 250),
      `/es/learn/: footer CSS waited for the post-load fallback (${shortFooter.stylesheetObservedAt} >= ${shortFooter.windowLoadAt} + 250)`,
    );
    await shortPage.close();
  } finally {
    await browser.close();
  }
});

if (failures.length) {
  console.error(`i18n-r0-drive: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('i18n-r0-drive: core, programmatic, EN/ES/PT forecast and deferred route boundaries pass; Arabic stays absent');
