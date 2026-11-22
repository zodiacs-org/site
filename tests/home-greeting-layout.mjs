import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const chart = {
  id: '77777777-7777-4777-8777-777777777777', name: 'Cameron', relationship: 'self',
  createdAt: '2026-08-01', updatedAt: '2026-08-01',
  birth: { date: '1990-05-08', time: '10:30', timeKnown: true,
    place: { name: 'Fixture town', lat: 15.3, lon: 33.4, tz: 'Etc/UTC' } },
  summary: { bodies: [{ body: 'Sun', lon: 255 }, { body: 'Moon', lon: 256 }], angles: { asc: 257, mc: 0 } },
};
const other = { ...chart, id: '88888888-8888-4888-8888-888888888888', name: 'Another chart', relationship: 'other' };

function observeLayoutShifts() {
  window.shifts = [];
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) window.shifts.push(entry.value);
    }
  }).observe({ type: 'layout-shift', buffered: true });
}

function geometry() {
  const box = selector => {
    const rect = document.querySelector(selector)?.getBoundingClientRect();
    return rect && [rect.x, rect.y, rect.width, rect.height];
  };
  const variant = document.documentElement.dataset.homeReturning;
  const card = `.wb-${variant}`;
  return {
    card: box(card), title: box(card + ' h2'), primary: box(card + ' .btn'),
    profile: box(card + ' a[href="/profile/"]'), next: box('.home-sky'),
  };
}

async function verify(browser, baseURL, width, variant) {
  const height = width === 1280 ? 720 : 844;
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const profiles = { chart: [other, chart], choose: [other], none: [] };
  await page.addInitScript(observeLayoutShifts);
  await page.addInitScript(charts => {
    if (charts.length) localStorage.setItem('zodiacs.profile.v1', JSON.stringify({ version: 1, charts }));
  }, profiles[variant]);

  // Hold the module to inspect the actual first paint independently of Preact.
  let requests = 0;
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/_astro/WelcomeBack.*.js', async route => { requests++; await held; await route.continue(); });
  try {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0);
    const section = page.locator('.wb-greeting');
    assert.equal(await section.locator('.wb-card').count(), 2);
    assert.equal(await section.locator('.wb-card:visible').count(), variant === 'none' ? 0 : 1);
    assert.equal(await page.locator('html').getAttribute('data-home-returning'), variant === 'none' ? null : variant);
    if (variant === 'none') {
      assert.equal(await section.boundingBox(), null);
    } else {
      const shell = section.locator('.wb-card:visible');
      assert.equal(await shell.locator('h2').innerText(), variant === 'chart' ? 'Today, for your chart' : 'Make today personal');
      assert.equal(await shell.locator('.btn span').first().innerText(), variant === 'chart' ? 'Open my daily brief' : 'Choose my chart');
      assert.deepEqual(await shell.locator('a').evaluateAll(links => links.map(a => a.getAttribute('href'))), ['/today/', '/profile/']);
    }
    const before = await page.evaluate(geometry);
    release();
    if (variant !== 'none') {
      await page.locator('astro-island[component-url*="WelcomeBack."]:not([ssr])').waitFor({ state: 'attached' });
      await page.waitForFunction(() => document.querySelectorAll('.wb-card').length === 1);
    } else {
      await page.waitForLoadState('load');
    }
    if (variant === 'chart') {
      assert.ok((await section.locator('h2').innerText()).includes(chart.name));
      assert.equal(await section.locator('.chip').count(), 3);
      assert.equal(await section.getByRole('link', { name: 'Open saved chart' }).getAttribute('href'), '/birth-chart/#profileChartId=' + chart.id);
    }
    await page.waitForTimeout(3000);
    assert.equal(requests, variant === 'none' ? 0 : 1);
    assert.deepEqual(await page.evaluate(geometry), before, 'Greeting and following section keep their geometry');
    assert.deepEqual(await page.evaluate(() => window.shifts), [], 'No layout shift from navigation through hydration + 3s');
    if (width === 1280 && variant === 'chart') {
      const button = section.locator('.btn');
      await button.hover();
      assert.equal(await button.locator('.orb').evaluate(el => getComputedStyle(el).transform), 'none');
    }
    console.log(`${width}x${height} ${variant}: CLS 0, card height ${before.card?.[3] ?? 0}px`);
  } finally {
    release();
    await context.close();
  }
}

async function verifyAccountDecision(browser, baseURL, width, variant) {
  const height = width === 390 ? 844 : 720;
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const returning = variant === 'chart' || variant === 'choose';
  const charts = variant === 'choose' ? [other] : variant === 'empty' ? [] : [chart];
  await page.addInitScript(observeLayoutShifts);
  await page.addInitScript(({ charts, variant }) => {
    if (variant !== 'no-key') localStorage.setItem('zodiacs.profile.v1', JSON.stringify({ version: 1, charts }));
    if (variant === 'denied') localStorage.setItem('zodiacs.account-sync-v2.local-owner.v1', JSON.stringify({
      version: 1, accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }));
    window.profileReads = 0;
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === 'zodiacs.profile.v1') window.profileReads++;
      return getItem.call(this, key);
    };
  }, { charts, variant });

  let release;
  const held = new Promise(resolve => { release = resolve; });
  let requests = 0;
  await page.route(/\/profile-access-autostart\.[^/]+\.js$/, async route => {
    requests++;
    await held;
    if (variant === 'failed') await route.abort('failed');
    else await route.continue();
  });
  try {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0);
    const root = page.locator('html');
    assert.equal(await root.getAttribute('data-account-sync-v2'), '');
    assert.equal(await root.getAttribute('data-home-returning'), null);
    const hero = page.locator('.hero');
    const before = await hero.boundingBox();
    assert.ok(before && await hero.isVisible());
    const ticker = page.locator('.home-sky');
    if (variant === 'no-key') {
      assert.equal(await root.getAttribute('data-home-access-pending'), null);
      assert.ok(await ticker.isVisible());
    } else {
      assert.equal(await root.getAttribute('data-home-access-pending'), '');
      assert.equal(await ticker.isVisible(), false);
      assert.equal(await page.locator('footer').isVisible(), false);
    }
    await page.waitForTimeout(2000);
    assert.equal(requests, variant === 'no-key' ? 0 : 1);
    assert.equal(await page.evaluate(() => window.profileReads), 0);
    release();
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-home-access-pending'));
    assert.ok(await ticker.isVisible());
    assert.equal(await root.getAttribute('data-home-returning'), returning ? variant : null);
    if (returning) {
      await page.waitForFunction(() => document.querySelectorAll('.wb-card').length === 1);
      if (variant === 'chart') assert.ok((await page.locator('.wb-card h2').innerText()).includes(chart.name));
    } else {
      assert.equal(await page.locator('.wb-greeting').boundingBox(), null);
    }
    await page.waitForTimeout(3000);
    assert.deepEqual(await hero.boundingBox(), before);
    assert.deepEqual(await page.evaluate(() => window.shifts), []);
    console.log(`${width}x${height} account decision (${variant}): CLS 0`);
  } finally {
    release();
    await context.close();
  }
}

await withPreview({ port: 4392 }, async baseURL => {
  const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  try {
    const html = await (await fetch(baseURL)).text();
    if (/<html\b[^>]*\bdata-account-sync-v2\b/.test(html)) {
      for (const width of [390, 1280]) {
        for (const variant of ['chart', 'choose', 'empty', 'no-key', 'denied', 'failed']) {
          await verifyAccountDecision(browser, baseURL, width, variant);
        }
      }
    } else {
      for (const width of [390, 430, 768, 1280]) {
        for (const variant of ['chart', 'choose', 'none']) await verify(browser, baseURL, width, variant);
      }
    }
  } finally {
    await browser.close();
  }
});
