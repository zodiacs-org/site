/** Flag-on responsive acceptance for the live Terminal venue route. */
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
import { injectRegistryExchange, REGISTRY_EXCHANGE_FLAG } from '../src/exchange/entry.mjs';

const OUT = process.env.OUT_DIR ?? null;
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const registry = JSON.parse(await readFile(
  new URL('../public/registry/zodiacs.registry.json', import.meta.url),
  'utf8',
));
const mints = registry.assets.map((asset) => asset.native.address);

async function enableExchangeFixture(page) {
  await page.route('**/terminal/markets/**', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const source = await response.text();
    const body = injectRegistryExchange(source, { [REGISTRY_EXCHANGE_FLAG]: '1' }).output;
    return route.fulfill({
      response,
      body,
      headers: { ...response.headers(), 'content-length': undefined },
    });
  });
}

async function mockProviders(page, requests) {
  await page.route('https://api.dexscreener.com/**', (route) => route.fulfill({
    json: mints.map((mint, index) => ({
      chainId: 'solana',
      pairAddress: `fixture-pool-${index}`,
      baseToken: { address: mint },
      priceUsd: String(0.000037 + index * 0.000001),
      priceChange: { h24: index % 2 ? -1.2 : 3.65 },
      liquidity: { usd: 52_000 + index * 1_000 },
    })),
  }));
  await page.route('https://api.geckoterminal.com/**', (route) => {
    const url = route.request().url();
    if (url.includes('/ohlcv/')) {
      const now = Math.floor(Date.now() / 1000);
      return route.fulfill({
        json: {
          data: {
            attributes: {
              ohlcv_list: Array.from({ length: 36 }, (_, index) => {
                const close = 0.000037 + Math.sin(index / 3) * 0.000002;
                return [now - index * 3600, close, close + 0.000001, close - 0.000001, close + 0.0000003, 1200 + index];
              }),
            },
          },
        },
      });
    }
    return route.fulfill({
      json: {
        data: Array.from({ length: 12 }, (_, index) => ({
          id: `trade-${index}`,
          attributes: {
            block_timestamp: new Date(Date.now() - index * 60_000).toISOString(),
            kind: index % 2 ? 'sell' : 'buy',
            from_token_amount: '1000',
            to_token_amount: '37',
            price_from_in_usd: '0.000037',
            volume_in_usd: '37',
            tx_hash: `fixture-${index}`,
          },
        })),
      },
    });
  });
  await page.route('https://api.jup.ag/**', (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
}

async function waitForTerminal(page) {
  await page.goto('/terminal/markets/#aries', { waitUntil: 'domcontentloaded' });
  await page.locator('.zme-mobile-market__name').waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.querySelector('.zme-mobile-market__name')?.textContent === 'Aries');
}

async function inspectMobile(browser, baseURL, width) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const providerRequests = [];
  const requestOrigins = new Set();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => requestOrigins.add(new URL(request.url()).origin));
  await enableExchangeFixture(page);
  await mockProviders(page, providerRequests);
  await waitForTerminal(page);

  const layout = await page.evaluate(() => {
    const canvas = document.querySelector('.zme__canvas');
    const tabs = document.querySelector('.zme-mobile-tabs');
    const market = document.querySelector('.zme-mobile-market');
    const rect = canvas?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      canvasTop: rect?.top ?? 9999,
      canvasVisible: rect ? Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)) : 0,
      tabsTop: tabs?.getBoundingClientRect().top ?? 9999,
      marketTop: market?.getBoundingClientRect().top ?? 9999,
      canvasRole: canvas?.getAttribute('role'),
      canvasLabel: canvas?.getAttribute('aria-label'),
    };
  });
  check(`${width}: no horizontal overflow`, layout.overflow <= 0, JSON.stringify(layout));
  check(`${width}: terminal-first fold`, layout.marketTop < 190 && layout.tabsTop < 300 && layout.canvasTop < 520, JSON.stringify(layout));
  check(`${width}: meaningful chart in first viewport`, layout.canvasVisible >= 220, JSON.stringify(layout));
  check(`${width}: chart canvas remains named`, layout.canvasRole === 'img' && Boolean(layout.canvasLabel));

  const tabs = page.getByRole('tab');
  check(`${width}: exactly Chart and Registry tabs`, await tabs.allTextContents().then((labels) => labels.join('|') === 'Chart|Registry'));
  check(`${width}: Chart selected initially`, await page.getByRole('tab', { name: 'Chart' }).getAttribute('aria-selected') === 'true');

  const marketButton = page.locator('.zme-mobile-market__button');
  await marketButton.click();
  const sheet = page.getByRole('dialog', { name: 'Choose a market' });
  check(`${width}: selector exposes all twelve markets`, await sheet.locator('.zme__rail-item').count() === 12);
  if (OUT && width === 390) {
    await mkdir(OUT, { recursive: true });
    await page.waitForTimeout(240);
    await page.screenshot({ path: `${OUT}/zodiac-markets-${width}-selector.png` });
  }
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await sheet.getByRole('button', { name: 'Close' }).focus();
  await page.keyboard.press('Shift+Tab');
  await page.waitForFunction(() => document.activeElement === document.querySelector('.zme__rail-list li:last-child .zme__rail-item'), null, { timeout: 1_000 }).catch(() => {});
  const backwardFocus = await page.evaluate(() => ({
    ok: document.activeElement === document.querySelector('.zme__rail-list li:last-child .zme__rail-item'),
    active: document.activeElement?.outerHTML?.slice(0, 180) ?? '',
  }));
  check(`${width}: selector traps backward focus`, backwardFocus.ok, backwardFocus.active);
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.activeElement === document.querySelector('.zme__sheet-close'), null, { timeout: 1_000 }).catch(() => {});
  const forwardFocus = await page.evaluate(() => ({
    ok: document.activeElement === document.querySelector('.zme__sheet-close'),
    active: document.activeElement?.outerHTML?.slice(0, 180) ?? '',
  }));
  check(`${width}: selector traps forward focus`, forwardFocus.ok, forwardFocus.active);
  await page.keyboard.press('Escape');
  check(`${width}: Escape restores selector focus`, await marketButton.evaluate((node) => document.activeElement === node));
  await marketButton.click();
  await page.locator('.zme__sheet-backdrop').click({ position: { x: 2, y: 2 } });
  check(`${width}: backdrop closes selector`, await marketButton.getAttribute('aria-expanded') === 'false');
  await marketButton.click();
  await sheet.getByRole('button', { name: /Taurus/u }).click();
  check(`${width}: market choice updates hash`, await page.evaluate(() => location.hash) === '#taurus');
  check(`${width}: market choice updates header`, await page.locator('.zme-mobile-market__name').textContent() === 'Taurus');

  await page.locator('.zme-mobile-buy').click();
  check(`${width}: sticky Registry opens record tab`, await page.getByRole('tab', { name: 'Registry' }).getAttribute('aria-selected') === 'true');
  const record = page.locator('.zme__panel-host a');
  check(`${width}: record link stays pinned to selected sign`, await record.getAttribute('href') === '/registry/taurus/');
  check(`${width}: no transaction panel`, await page.locator('.tp').count() === 0);
  if (OUT && width === 390) {
    await page.screenshot({ path: `${OUT}/zodiac-markets-${width}-registry.png` });
  }
  await page.getByRole('tab', { name: 'Chart' }).click();
  await page.getByRole('tab', { name: 'Registry' }).click();
  check(`${width}: tab switch preserves selected record`, await record.getAttribute('href') === '/registry/taurus/');
  check(`${width}: no signing or wallet button`,
    await page.getByRole('button', { name: /^(?:Connect wallet|Buy|Sell|Sign|Limit|TP\/SL)$/iu }).count() === 0);

  const beforeDepth = providerRequests.length;
  check(`${width}: depth remains explicit`, await page.getByRole('button', { name: 'Load depth' }).count() === 1);
  check(`${width}: depth caption remains visible`, await page.locator('.zme__ladder-caption').isVisible());
  check(`${width}: no eager depth burst`, beforeDepth <= 2, String(beforeDepth));

  await page.getByRole('tab', { name: 'Chart' }).focus();
  await page.keyboard.press('ArrowRight');
  check(`${width}: tab keyboard navigation works`, await page.getByRole('tab', { name: 'Registry' }).getAttribute('aria-selected') === 'true');
  check(`${width}: no runtime exception`, pageErrors.length === 0, pageErrors.join('\n'));
  const allowedOrigins = new Set([
    new URL(baseURL).origin,
    'https://api.dexscreener.com',
    'https://api.geckoterminal.com',
    'https://api.jup.ag',
    'https://plausible.io',
  ]);
  check(`${width}: no added request origin`,
    [...requestOrigins].every((origin) => allowedOrigins.has(origin)), [...requestOrigins].join(', '));
  check(`${width}: display quotes remain taker-less`,
    providerRequests.every((url) => !new URL(url).searchParams.has('taker')), providerRequests.join('\n'));

  if (OUT) {
    await mkdir(OUT, { recursive: true });
    await page.getByRole('tab', { name: 'Chart' }).click();
    if (width === 390) {
      await page.screenshot({ path: `${OUT}/zodiac-markets-${width}-fold.png` });
    }
    await page.screenshot({ path: `${OUT}/zodiac-markets-${width}.png`, fullPage: true });
  }
  await context.close();
}

async function inspectDesktop(browser, baseURL, width) {
  const context = await browser.newContext({ baseURL, viewport: { width, height: 900 } });
  const page = await context.newPage();
  await enableExchangeFixture(page);
  await mockProviders(page, []);
  await waitForTerminal(page);
  const state = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    mobileHeader: getComputedStyle(document.querySelector('.zme-mobile-market')).display,
    tabs: getComputedStyle(document.querySelector('.zme-mobile-tabs')).display,
    rail: getComputedStyle(document.querySelector('.zme__rail')).position,
    center: getComputedStyle(document.querySelector('.zme__center')).display,
    desk: getComputedStyle(document.querySelector('.zme__desk')).display,
  }));
  check(`${width}: desktop has no overflow`, state.overflow <= 0, JSON.stringify(state));
  check(`${width}: desktop chrome unchanged`, state.mobileHeader === 'none' && state.tabs === 'none', JSON.stringify(state));
  check(`${width}: desktop rail and both columns remain`, state.rail !== 'fixed' && state.center !== 'none' && state.desk !== 'none', JSON.stringify(state));
  await context.close();
}

async function inspectReducedMotion(browser, baseURL) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await enableExchangeFixture(page);
  await mockProviders(page, []);
  await waitForTerminal(page);
  const durations = await page.evaluate(() => ({
    tab: getComputedStyle(document.querySelector('.zme-mobile-tabs__tab'), '::after').transitionDuration,
    sheet: getComputedStyle(document.querySelector('.zme__rail')).transitionDuration,
    action: getComputedStyle(document.querySelector('.zme-mobile-buy')).transitionDuration,
  }));
  check('reduced motion removes terminal movement',
    Object.values(durations).every((duration) => duration.split(',').every((part) => part.trim() === '0s')),
    JSON.stringify(durations));
  await context.close();
}

const executablePath = await findChromium();
const browser = await chromium.launch({ executablePath, headless: true, args: STABLE_CHROMIUM_ARGS });
try {
  await withPreview({ port: 4327 }, async (baseURL) => {
    for (const width of [320, 360, 390, 430]) await inspectMobile(browser, baseURL, width);
    for (const width of [801, 1180, 1280]) await inspectDesktop(browser, baseURL, width);
    await inspectReducedMotion(browser, baseURL);
  });
} finally {
  await browser.close();
}

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
}
const failures = results.filter((result) => !result.ok);
if (failures.length) process.exitCode = 1;
else console.log(`Registry exchange mobile drive passed ${results.length}/${results.length} checks.`);
