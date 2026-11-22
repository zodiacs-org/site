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
  await page.addInitScript(charts => {
    if (charts.length) localStorage.setItem('zodiacs.profile.v1', JSON.stringify({ version: 1, charts }));
    window.shifts = [];
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.shifts.push(entry.value);
      }
    }).observe({ type: 'layout-shift', buffered: true });
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

await withPreview({ port: 4392 }, async baseURL => {
  const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  try {
    for (const width of [390, 430, 768, 1280]) {
      for (const variant of ['chart', 'choose', 'none']) await verify(browser, baseURL, width, variant);
    }
  } finally {
    await browser.close();
  }
});
