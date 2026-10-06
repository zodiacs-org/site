import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { observeFooterStyles, observeViewportRegions, viewportRegionFailures,
  observeMobileToolMenu, mobileToolMenuFailures } from './locale-capture-readiness.mjs';

// Invoked by Explorer in the existing Browser Evidence comparison job. These
// are real preview navigations; screenshots are review evidence, not baselines.
const DAILY = [
  { code: 'en', prefix: '', lang: 'en', today: 'Today' },
  { code: 'es', prefix: '/es', lang: 'es', today: 'Hoy', dates: '22 dic – 19 ene', intl: 'es-419' },
  { code: 'pt', prefix: '/pt', lang: 'pt-BR', today: 'Hoje', dates: '22 dez – 19 jan', intl: 'pt-BR' },
];
const TOOLS = [
  { code: 'es', title: 'Herramientas gratis de astrología', promise: 'doce signos solares' },
  { code: 'pt', title: 'Ferramentas gratuitas de astrologia', promise: 'doze signos solares' },
  { code: 'fr', title: 'Outils d’astrologie gratuits', cue: 'en anglais' },
  { code: 'it', title: 'Strumenti astrologici gratuiti', cue: 'in inglese' },
  { code: 'ru', title: 'Бесплатные астроинструменты', cue: 'по-английски' },
];
const ENGLISH_CUES = {
  fr: { text: '— pour l’instant en anglais', title: 'Contenu pour l’instant en anglais' },
  it: { text: '— per ora in inglese', title: 'Contenuto per ora in inglese' },
};
const BIRTHDAY = {
  en: { label: 'Birthday', cue: null, title: null },
  es: { label: 'Cumpleaños (en inglés)', cue: 'inglés', title: 'Contenido por ahora en inglés' },
  pt: { label: 'Aniversário (em inglês)', cue: 'inglês', title: 'Conteúdo por enquanto em inglês' },
};
const TIMEOUT = 15_000;
const pathFor = (locale, route) => `${locale.prefix}${route}`;
const sorted = (entries) => [...entries].sort(([a], [b]) => a.localeCompare(b));

// Keep the observed DOM separate from its expectation so a wrong-language
// fallback cannot pass merely because the browser followed a valid URL.
export function dailyRouteFailures(state, localeCode, route) {
  const locale = DAILY.find(({ code }) => code === localeCode);
  assert.ok(locale, `unsupported daily locale: ${localeCode}`);
  const expected = DAILY.map((entry) => [entry.lang, `https://zodiacs.org${pathFor(entry, route)}`]);
  const expectedRail = DAILY.map((entry) => [entry.lang, entry.code === localeCode ? null : pathFor(entry, route)]);
  return [
    state.path === pathFor(locale, route) || 'navigation changed the route',
    state.lang === locale.lang || 'wrong document language',
    state.canonical === `https://zodiacs.org${pathFor(locale, route)}` || 'wrong canonical',
    JSON.stringify(sorted(state.alternates)) === JSON.stringify(sorted([...expected, ['x-default', `https://zodiacs.org${route}`]])) || 'wrong reciprocal alternates',
    JSON.stringify(sorted(state.rail)) === JSON.stringify(sorted(expectedRail)) || 'language switch falls back or offers an unavailable edition',
    state.current.length === 1 && state.current[0] === locale.lang || 'wrong current language marker',
    state.width <= state.viewport + 1 || 'horizontal overflow',
  ].filter((entry) => entry !== true);
}

async function routeState(page) {
  return page.evaluate(() => ({
    path: location.pathname,
    lang: document.documentElement.lang,
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')]
      .map((node) => [node.getAttribute('hreflang'), node.href]),
    rail: [...document.querySelectorAll('.zfooter__locale')]
      .map((node) => [node.getAttribute('lang'), node.getAttribute('href')]),
    current: [...document.querySelectorAll('.zfooter__locale[aria-current="page"]')]
      .map((node) => node.getAttribute('lang')),
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
}

export async function driveLocaleDiscovery({ browser, baseURL, check, outDir }) {
  const directory = outDir ? `${outDir}/locales` : null;
  if (directory) await mkdir(directory, { recursive: true });
  const daily = JSON.parse(await readFile(new URL('../src/data/daily.json', import.meta.url), 'utf8'));
  const report = { editionDate: daily.date, checks: [], screenshots: [], captureDiagnostics: [] };
  const footerRequestsByPage = new WeakMap();
  const record = (name, ok, detail = '') => {
    report.checks.push({ name, ok, detail });
    check(`locale discovery: ${name}`, ok, detail);
  };
  const persist = async () => {
    if (directory) await writeFile(`${directory}/results.json`, `${JSON.stringify(report, null, 2)}\n`);
  };
  const waitForFooter = async (page, name) => {
    try {
      await page.waitForFunction(observeFooterStyles, { readyOnly: true }, { timeout: TIMEOUT });
    } catch (error) {
      const diagnostic = { name,
        footer: await page.evaluate(observeFooterStyles).catch((failure) => ({ error: failure.message })),
        requests: (footerRequestsByPage.get(page) ?? []).map((row) => ({ ...row })) };
      report.captureDiagnostics.push(diagnostic);
      console.error(`locale capture footer readiness: ${JSON.stringify(diagnostic)}`);
      throw error;
    }
    record(`${name} canonical footer CSS applied`, true);
  };
  const shot = async (target, name, options = {}) => {
    if (!directory) return;
    if (options.fullPage) {
      // Wait for the site's real deferred request and applied rules before
      // scrolling or awaiting fonts; neither DOMContentLoaded nor an earlier
      // document.fonts.ready waits for a stylesheet that has not been added.
      await waitForFooter(target, name);
      // Match the existing visual/Phase 1 capture preparation: Chromium may
      // otherwise paint the offscreen footer's intrinsic placeholder when it
      // returns to the top for a full-page raster. Only skip that paint
      // optimization; preserve the actual content, typography and geometry.
      await target.addStyleTag({ content: '.zfooter { content-visibility: visible !important; }' });
      const missing = await target.evaluate(async () => {
        const paint = () => new Promise((resolve) => requestAnimationFrame(resolve));
        for (const image of document.images) image.loading = 'eager';
        const step = Math.max(480, Math.floor(innerHeight * 0.8));
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
          scrollTo(0, y);
          await paint();
        }
        await Promise.race([
          Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))),
          new Promise((resolve) => setTimeout(resolve, 10_000)),
        ]);
        await document.fonts.ready;
        scrollTo(0, 0);
        await paint();
        await paint();
        return [...document.images].filter((image) => (image.currentSrc || image.src).includes('/assets/zodiac-icons/')
          && (!image.complete || image.naturalWidth === 0)).map((image) => image.currentSrc || image.src);
      });
      record(`${name} screenshot icons loaded`, missing.length === 0, missing.join(' | '));
    }
    await target.screenshot({ path: `${directory}/${name}.png`, animations: 'disabled', ...options });
    report.screenshots.push(`${name}.png`);
  };
  const selectedSignShots = async (page, name) => {
    if (!directory) return;
    await waitForFooter(page, name);
    await page.waitForFunction(() => [...document.querySelectorAll('.tbs img')]
      .every((image) => image.complete && image.naturalWidth > 0), undefined, { timeout: TIMEOUT });
    await page.evaluate(() => document.fonts.ready);
    const fits = await page.locator('.tbs').evaluate((node) => {
      const navBottom = document.querySelector('.nav-wrap')?.getBoundingClientRect().bottom ?? 0;
      return node.getBoundingClientRect().height <= innerHeight - Math.max(0, navBottom) - 32;
    });
    const views = fits
      ? [{ name, anchor: '.tbs', regions: ['.tbs__head', '.tbs__signs', '.tbs__read'] }]
      : [
        { name: `${name}-overview`, anchor: '.tbs', regions: ['.tbs__head', '.tbs__signs'] },
        { name: `${name}-reading`, anchor: '.tbs__read', regions: ['.tbs__read'] },
      ];
    for (const view of views) {
      await page.evaluate(async (selector) => {
        const node = document.querySelector(selector);
        if (!node) throw new Error(`missing capture region ${selector}`);
        const navBottom = document.querySelector('.nav-wrap')?.getBoundingClientRect().bottom ?? 0;
        scrollTo({ top: scrollY + node.getBoundingClientRect().top - Math.max(0, navBottom) - 16, behavior: 'instant' });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, view.anchor);
      const state = await page.evaluate(observeViewportRegions, view.regions);
      const failures = viewportRegionFailures(state);
      record(`${view.name} important regions clear of navigation and viewport edges`, failures.length === 0, JSON.stringify(state));
      assert.deepEqual(failures, [], `${view.name}: ${failures.join('; ')}`);
      // A real viewport preserves the fixed navigation and its relationship
      // to the reading. A locator crop may silently scroll a tall component
      // behind that navigation, so it cannot prove this state is readable.
      await shot(page, view.name);
    }
  };

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', timezoneId: 'UTC' });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const footerRequests = [];
    footerRequestsByPage.set(page, footerRequests);
    const footerRequestRows = new WeakMap();
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin !== new URL(baseURL).origin || url.pathname !== '/assets/site-footer.css') return;
      const row = { path: url.pathname, status: null, finished: false, error: null };
      footerRequestRows.set(request, row);
      footerRequests.push(row);
    });
    page.on('response', (response) => {
      const row = footerRequestRows.get(response.request());
      if (row) row.status = response.status();
    });
    page.on('requestfinished', (request) => {
      const row = footerRequestRows.get(request);
      if (row) row.finished = true;
    });
    page.on('requestfailed', (request) => {
      const row = footerRequestRows.get(request);
      if (row) row.error = request.failure()?.errorText ?? 'request failed';
    });
    const open = async (path) => {
      footerRequests.length = 0;
      const response = await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
      assert.equal(response?.status(), 200, path);
      await page.locator('h1').first().waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
    };
    const follow = async (link, path) => {
      footerRequests.length = 0;
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        link.click(),
      ]);
      assert.equal(response?.status(), 200, `link to ${path}`);
      await page.waitForURL(`${baseURL}${path}`);
      await page.locator('h1').first().waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
    };
    const run = async (name, action) => {
      try {
        await action();
      } catch (error) {
        record(`${name}@${viewport.width}`, false, error.message);
      } finally {
        await persist();
      }
    };
    const mobileMenu = async (locale, width) => {
      const name = `${locale.code}-today-menu-${width}`;
      const burger = page.locator('[data-menu-toggle]');
      const guide = page.locator('[data-guide-launcher]');
      const birthday = page.locator('.mobile-menu__tool[href="/birthday/"]');
      const waitForGuide = async () => {
        await page.waitForFunction(() => {
          const node = document.querySelector('[data-guide-launcher]');
          if (!node) return false;
          const style = getComputedStyle(node);
          return style.visibility === 'visible' && style.pointerEvents !== 'none' && Number(style.opacity) === 1;
        }, null, { timeout: TIMEOUT });
      };
      const settleMenu = async () => {
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => [...document.querySelectorAll('[data-mobile-menu] img, [data-guide-launcher] img')]
          .every((node) => node.complete && node.naturalWidth > 0), null, { timeout: TIMEOUT });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      };
      const measure = async (suffix, requireBirthdayFocus = false) => {
        const state = await page.evaluate(observeMobileToolMenu);
        const failures = mobileToolMenuFailures(state, { requireBirthdayFocus });
        report.captureDiagnostics.push({ name: `${name}-${suffix}`, menu: state });
        record(`${name} ${suffix}: text, 44px targets and Guide clearance`, failures.length === 0, failures.join('; '));
        if (failures.length) console.log(`Locale menu failure geometry: ${JSON.stringify({ name: `${name}-${suffix}`, menu: state })}`);
        return state;
      };
      const tabToBirthday = async () => {
        const count = await page.locator('[data-mobile-menu] a, [data-mobile-menu] button').count();
        for (let step = 0; step < count; step += 1) {
          if (await birthday.evaluate((node) => document.activeElement === node)) break;
          await page.keyboard.press('Tab');
        }
        await settleMenu();
      };
      const closeWithEscape = async () => {
        await page.keyboard.press('Escape');
        await page.locator('[data-mobile-menu]').waitFor({ state: 'hidden' });
        record(`${name} Escape returns native focus`, await burger.evaluate((node) => document.activeElement === node)
          && await burger.getAttribute('aria-expanded') === 'false');
        await waitForGuide();
        record(`${name} closed menu restores Guide`, true);
      };

      await page.evaluate(() => scrollTo(0, 0));
      await waitForGuide();
      await burger.click();
      await settleMenu();
      const today = page.locator(`.mobile-menu__link[href="${pathFor(locale, '/today/')}"]`);
      record(`${locale.code} Today mobile discovery@${width}`, await today.isVisible() && (await today.locator(':scope > span').innerText()).trim() === locale.today
        && (await today.locator(':scope > small').innerText()).trim().length > 0);
      const initial = await measure('opened');
      const expected = BIRTHDAY[locale.code];
      const observed = initial.rows.find((row) => row.href === '/birthday/');
      record(`${name} Birthday has one honest language cue`, observed?.text === expected.label
        && (expected.cue ? observed.ariaLabel?.split(expected.cue).length === 2 && observed.hreflang === 'en'
          : observed.hreflang === null) && observed.title === expected.title, JSON.stringify(observed));
      await shot(page, name);
      await tabToBirthday();
      await measure('native-birthday-focus', true);
      await shot(page, `${name}-birthday-focus`);
      await page.keyboard.press('Shift+Tab');
      await settleMenu();
      record(`${name} reverse native focus keeps the complete target visible`, await page.evaluate(() => {
        const menu = document.querySelector('[data-mobile-menu]');
        const focused = document.activeElement;
        const preceding = menu?.querySelector('.mobile-menu__tool[href="/birthday/"]')?.previousElementSibling;
        if (!menu || !focused || focused !== preceding || !menu.contains(focused)) return false;
        const row = focused.getBoundingClientRect();
        const navBottom = document.querySelector('[data-nav]')?.parentElement?.getBoundingClientRect().bottom ?? 0;
        return row.top >= navBottom && row.bottom <= innerHeight && row.height >= 44;
      }));
      await page.keyboard.press('Tab');
      await settleMenu();
      await measure('returned-native-birthday-focus', true);
      await closeWithEscape();

      // Exercise the same launcher after the real lazy drawer stylesheet loads.
      // No message is entered or sent; Escape closes the actual dialog.
      if (locale.code === 'en' && width === 390) {
        await guide.click();
        await page.locator('.zassistant__panel[role="dialog"]').waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        await page.locator('.zassistant').waitFor({ state: 'hidden' });
        await waitForGuide();
      }
      await burger.click();
      await tabToBirthday();
      await measure('reopened-native-birthday-focus', true);
      if (locale.code === 'en' && width === 390) {
        await shot(page, `${name}-loaded-guide`);
        await closeWithEscape();
        await burger.click();
        await tabToBirthday();
      }
      await follow(birthday, '/birthday/');
      record(`${name} native Birthday click reaches English destination`, await page.locator('html').getAttribute('lang') === 'en');
      await open(pathFor(locale, '/today/'));
      await waitForFooter(page, `${name} return to Today`);
    };

    try {
      // Each cycle clicks the actual language rail EN → ES → PT → EN on the
      // same route. The daily-sign case uses non-English month abbreviations.
      for (const [slug, route] of [['today', '/today/'], ['horoscopes', '/horoscopes/'], ['capricorn', '/horoscopes/capricorn/']]) {
        await run(`${slug} reciprocal switch`, async () => {
          await open(route);
          for (let index = 0; index < DAILY.length; index += 1) {
            const locale = DAILY[index];
            const state = await routeState(page);
            const failures = dailyRouteFailures(state, locale.code, route);
            record(`${locale.code} ${slug} identity@${viewport.width}`, failures.length === 0, failures.join('; '));
            if (locale.code !== 'en') {
              const date = new Intl.DateTimeFormat(locale.intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
                .format(new Date(`${daily.date}T12:00:00Z`));
              const heading = await page.locator(`[data-edition-content] .kicker`).first().textContent();
              record(`${locale.code} ${slug} edition date@${viewport.width}`, heading.includes(date), heading.trim());
              if (slug !== 'today') {
                const dates = slug === 'horoscopes'
                  ? page.locator(`.horo-${locale.code}__card[href="${locale.prefix}/horoscopes/capricorn/"] .horo-${locale.code}__dates`)
                  : page.locator(`.sign-${locale.code}__stamp`);
                const text = await dates.textContent();
                record(`${locale.code} ${slug} localized sign dates@${viewport.width}`, text.includes(locale.dates), text.trim());
              }
            }
            await page.evaluate(() => scrollTo(0, 0));
            await shot(page, `${locale.code}-${slug}-${viewport.width}`, { fullPage: true });

            if (slug === 'today') {
              const footerLink = page.locator(`.zfooter__links a[href="${pathFor(locale, '/today/')}"]`);
              record(`${locale.code} Today footer is local@${viewport.width}`,
                await footerLink.count() === 1 && (await footerLink.textContent()).trim() === locale.today
                && await footerLink.getAttribute('hreflang') !== 'en');
              if (viewport.width === 390) {
                await mobileMenu(locale, 390);
                if (locale.code === 'pt') {
                  try {
                    await page.setViewportSize({ width: 320, height: 844 });
                    await mobileMenu(locale, 320);
                  } finally {
                    await page.setViewportSize(viewport);
                  }
                }
              } else {
                const nav = await page.locator('.nav__links').evaluate((node) => {
                  const bounds = node.getBoundingClientRect();
                  const children = [...node.children].map((child) => {
                    const rect = child.getBoundingClientRect();
                    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
                      fits: child.scrollWidth <= child.clientWidth + 1 };
                  });
                  return { tracks: getComputedStyle(node).gridTemplateColumns.split(' ').length, children,
                    fits: children.every((child, i) => child.fits && child.left >= bounds.left - 1 && child.right <= bounds.right + 1
                      && (i === 0 || child.left >= children[i - 1].right - 1)) };
                });
                const link = page.locator(`.nav__links a[href="${pathFor(locale, '/today/')}"]`);
                const profile = page.locator(`.nav__profile-shortcut[href="${pathFor(locale, '/profile/')}"]`);
                const profileBox = await profile.boundingBox();
                record(`${locale.code} five-track Today navigation and separate profile shortcut@1440`, nav.tracks === 5 && nav.children.length === 5 && nav.fits
                  && await link.isVisible() && (await link.textContent()).trim() === locale.today
                  && await profile.isVisible() && Boolean((await profile.getAttribute('aria-label'))?.trim())
                  && profileBox?.width >= 44 && profileBox?.height >= 44,
                JSON.stringify({ ...nav, profileBox }));
              }
            }

            const next = DAILY[(index + 1) % DAILY.length];
            await follow(page.locator(`.zfooter__locales a[hreflang="${next.lang}"]`), pathFor(next, route));
          }
          const failures = dailyRouteFailures(await routeState(page), 'en', route);
          record(`${slug} completes reciprocal cycle@${viewport.width}`, failures.length === 0, failures.join('; '));
        });
      }

      for (const locale of TOOLS) {
        await run(`${locale.code} Tools`, async () => {
          await open(`/${locale.code}/tools/`);
          const headings = await page.locator('h1').allTextContents();
          const cards = await page.locator('.tool-card').count();
          record(`${locale.code} Tools heading hierarchy@${viewport.width}`, headings.length === 1 && headings[0].trim() === locale.title
            && cards > 0 && await page.locator('.tool-card > h2').count() === cards && await page.locator('.tool-card h3').count() === 0);
          const todayPath = locale.promise ? `/${locale.code}/today/` : '/today/';
          const today = page.locator(`.tools-grid a[href="${todayPath}"]`);
          const text = await today.textContent();
          record(`${locale.code} Tools Today availability@${viewport.width}`, locale.promise
            ? text.includes(locale.promise) && await today.getAttribute('hreflang') === null && !/ingl[eê]s/u.test(text)
            : text.includes(locale.cue) && await today.getAttribute('hreflang') === 'en' && Boolean(await today.getAttribute('title')));
          const state = await routeState(page);
          record(`${locale.code} Tools fits@${viewport.width}`, state.width <= state.viewport + 1);
          await shot(page, `${locale.code}-tools-${viewport.width}`, { fullPage: true });
        });
      }

      for (const code of ['es', 'pt', 'fr', 'it']) {
        await run(`${code} homepage reading discovery`, async () => {
          await open(`/${code}/`);
          const cue = ENGLISH_CUES[code];
          if (cue) {
            const forecast = page.locator('.hero-es__ghost[href="/horoscopes/"]');
            record(`${code} hero English forecast cue@${viewport.width}`, (await forecast.textContent()).includes(cue.text)
              && await forecast.getAttribute('hreflang') === 'en' && await forecast.getAttribute('title') === cue.title);
            await shot(page, `${code}-home-forecast-${viewport.width}`);
          }
          const firstSign = page.locator('.tbs__sign').first();
          await firstSign.scrollIntoViewIfNeeded();
          await page.waitForFunction(() => {
            const island = document.querySelector('.tbs')?.closest('astro-island');
            return island && !island.hasAttribute('ssr');
          });
          await firstSign.click();
          const link = page.locator('.tbs__more');
          await link.waitFor({ state: 'visible' });
          const expected = cue ? '/horoscopes/aries/' : `/${code}/horoscopes/aries/`;
          record(`${code} selected sign has honest destination@${viewport.width}`, await link.getAttribute('href') === expected
            && (cue ? (await link.textContent()).includes(cue.text) && await link.getAttribute('hreflang') === 'en'
              && await link.getAttribute('title') === cue.title : await link.getAttribute('hreflang') === null));
          await selectedSignShots(page, `${code}-home-selected-sign-${viewport.width}`);
          await follow(link, expected);
          record(`${code} selected sign opens the available edition@${viewport.width}`,
            await page.locator('html').getAttribute('lang') === (cue ? 'en' : code === 'pt' ? 'pt-BR' : code));
          if (cue) {
            await open(`/${code}/`);
            await follow(page.locator('.hero-es__ghost[href="/horoscopes/"]'), '/horoscopes/');
            record(`${code} hero opens the English forecast hub@${viewport.width}`, await page.locator('html').getAttribute('lang') === 'en');
          }
        });
      }
      record(`no page errors@${viewport.width}`, errors.length === 0, errors.join(' | '));
    } finally {
      await context.close();
      await persist();
    }
  }
}
