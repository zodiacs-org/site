/**
 * Audit finding F-18: the sign pictures a chart shows must not show in the
 * requests the page makes, or they give our host the chart's Sun, Moon and
 * rising signs. Two different charts, each computed in a fresh browser from
 * the same birthplace, must make the same requests: the same addresses, and
 * the same sign pictures in the same order, which is all twelve of a size in
 * zodiac order. Checked on the birth chart (with its share options, which
 * draw the discs into cards) and on the Big Three tool.
 *
 * Synthetic births, both in Lyon after 1970 (so neither loads a file of
 * historical clock changes), with no sign in common in their Big Three:
 * 1987-03-14 06:42 is Pisces, Virgo, Pisces rising; 1994-08-02 19:10 is Leo,
 * Gemini, Capricorn rising.
 *
 *   npm run build && node tests/sign-icon-requests-drive.mjs
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const TIMEOUT = 45_000;
const SIGN_ORDER = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const BIRTHS = [
  { date: '1987-03-14', time: '06:42', city: 'Lyon', bigThree: ['Pisces', 'Virgo', 'Pisces'] },
  { date: '1994-08-02', time: '19:10', city: 'Lyon', bigThree: ['Leo', 'Gemini', 'Capricorn'] },
];
const ICON = /^\/assets\/zodiac-icons\/(\d+)\/([a-z]+)\.(webp|avif)(\?[^#]*)?$/u;
const PAGES = [
  {
    route: '/birth-chart/', date: '#birth-date', time: '#birth-time', place: '#place',
    submit: '.calc__form button[type="submit"]', result: '.calc__result', shareOptions: true,
  },
  {
    route: '/big-three/', date: '#bt-date', time: '#bt-time', place: '#bt-place',
    submit: '[data-big-three-submit]', result: '[data-big-three-result]', shareOptions: false,
  },
];

/** Resolves once the page has made no request for `settle` ms. */
async function quiet(requests, settle = 2_000, limit = 30_000) {
  const deadline = Date.now() + limit;
  let seen = -1;
  while (Date.now() < deadline) {
    if (requests.length === seen) return;
    seen = requests.length;
    await new Promise((resolveWait) => setTimeout(resolveWait, settle));
  }
  throw new Error(`requests did not settle within ${limit} ms`);
}

async function computeAndRecord(browser, baseURL, pageSpec, birth) {
  const origin = new URL(baseURL).origin;
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const requests = [];
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    requests.push(url.origin === origin ? `${url.pathname}${url.search}` : url.href);
  });
  try {
    const page = await context.newPage();
    const response = await page.goto(`${baseURL}${pageSpec.route}`, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200, `${pageSpec.route} must return 200`);
    await page.locator('.calc__form').waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.waitForFunction(() => {
      const form = document.querySelector('.calc__form');
      const island = form?.closest('astro-island');
      return island ? !island.hasAttribute('ssr') : Boolean(form);
    }, null, { timeout: TIMEOUT });

    await page.locator(pageSpec.date).fill(birth.date);
    await page.locator(pageSpec.time).fill(birth.time);
    await page.locator(pageSpec.place).fill(birth.city);
    const option = page.locator(`${pageSpec.place}-list [role="option"]:not([aria-disabled="true"])`).first();
    await option.waitFor({ state: 'visible', timeout: TIMEOUT });
    await option.click();
    await page.locator(`${pageSpec.place}[readonly]`).waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.locator(pageSpec.submit).click();
    await page.locator(pageSpec.result).waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.waitForFunction(
      (submit) => !document.querySelector(submit)?.disabled
        && document.querySelector('.calc__form')?.getAttribute('aria-busy') !== 'true',
      pageSpec.submit,
      { timeout: TIMEOUT },
    );
    await quiet(requests);

    // Bring the whole result into view, so every lazy picture loads.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((resolveStep) => setTimeout(resolveStep, 60));
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await quiet(requests);

    if (pageSpec.shareOptions) {
      // The share options prepare the chart's cards and sheet, which draw discs.
      const more = page.locator('[data-chart-more]');
      if ((await more.getAttribute('open')) === null) await more.locator('summary').click();
      await page.locator('[data-share-options]').click();
      await page.locator('[data-share-dialog]').waitFor({ state: 'visible', timeout: TIMEOUT });
      await quiet(requests);
    }

    const bigThree = (await page.locator('.three-card__sign').allInnerTexts()).map((text) => text.trim());
    return { requests, bigThree };
  } finally {
    await context.close();
  }
}

/** For each size, format (and query), the order in which its pictures were first asked for. */
function firstRequestOrder(icons) {
  const orders = new Map();
  for (const path of icons) {
    const [, size, slug, format, query = ''] = ICON.exec(path);
    const key = `${size}/*.${format}${query}`;
    const order = orders.get(key) ?? [];
    if (!order.includes(slug)) order.push(slug);
    orders.set(key, order);
  }
  return orders;
}

const browser = await chromium.launch({
  executablePath: await findChromium(),
  headless: true,
  args: STABLE_CHROMIUM_ARGS,
});

try {
  await withPreview({ port: Number(process.env.SIGN_ICON_PORT ?? 4336) }, async (baseURL) => {
    const icons = (requests) => requests.filter((path) => path.startsWith('/assets/zodiac-icons/'));
    const addresses = (requests) => [...new Set(requests)].sort();
    for (const pageSpec of PAGES) {
      const runs = [];
      for (const birth of BIRTHS) {
        const run = await computeAndRecord(browser, baseURL, pageSpec, birth);
        assert.deepEqual(run.bigThree, birth.bigThree, `${pageSpec.route} ${birth.date} must show its own Big Three`);
        runs.push(run);
      }
      const [first, second] = runs;

      const firstIcons = icons(first.requests);
      assert.ok(firstIcons.length >= 12, `${pageSpec.route}: the chart must show sign pictures`);
      for (const path of firstIcons) {
        assert.match(path, ICON, `${pageSpec.route}: unexpected sign picture address ${path}`);
      }
      // Pictures a page shows for every visitor (its sign grid, the footer)
      // are all twelve too; each set, whatever shows it, is asked for whole.
      for (const [key, order] of firstRequestOrder(firstIcons)) {
        assert.deepEqual(order, SIGN_ORDER,
          `${pageSpec.route}: sign pictures ${key} must be asked for as all twelve, in zodiac order`);
      }

      assert.deepEqual(icons(second.requests), firstIcons,
        `${pageSpec.route}: two different charts must ask for the same sign pictures in the same order`);

      const onlyFirst = addresses(first.requests).filter((path) => !second.requests.includes(path));
      const onlySecond = addresses(second.requests).filter((path) => !first.requests.includes(path));
      assert.deepEqual({ onlyFirst, onlySecond }, { onlyFirst: [], onlySecond: [] },
        `${pageSpec.route}: two different charts must make requests to the same set of addresses`);

      console.log(`sign-icon-requests: ${pageSpec.route} PASS — ${BIRTHS.length} charts, `
        + `${addresses(first.requests).length} addresses each, ${firstIcons.length} sign-picture requests `
        + `in the same order (${[...firstRequestOrder(firstIcons).keys()].join(', ')})`);
    }
  });
} finally {
  await browser.close();
}
