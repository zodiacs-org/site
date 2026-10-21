/** Pair calculators must stay deferred until their form is visible, then work. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { withPreview } from './visual/preview-server.mjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';

// Stale summaries exercise the real browser engine after choosing saved charts.
const chart = (id, name, date) => ({
  id, name, createdAt: '2026-07-11T00:00:00Z', updatedAt: '2026-07-11T00:00:00Z',
  birth: {
    date, time: '12:00', timeKnown: true,
    place: { name: 'London', admin1: '', country: 'GB', lat: 51.51, lon: -0.13, tz: 'Europe/London' },
  },
  summary: {
    engineVersion: '0-stale', utcISO: `${date}T12:00:00Z`, houseSystem: 'whole',
    bodies: [], angles: { asc: 0, mc: 0 }, flags: [],
  },
});
const profile = {
  version: 1, settings: { houseSystem: 'whole' },
  charts: [chart('visible-a', 'Person A', '1990-04-01'), chart('visible-b', 'Person B', '1992-07-01')],
};

await withPreview({ port: 4401 }, async (baseURL) => {
  const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  const failures = [];
  try {
    for (const width of [390, 1440]) {
      for (const path of ['/compatibility/aries-cancer/', '/es/compatibility/aries-cancer/']) {
        const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
        const errors = [];
        const calculatorRequests = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => {
          if (/\/SynastryCalculator\.[^/]+\.js(?:\?|$)/.test(request.url())) calculatorRequests.push(request.url());
        });
        await page.addInitScript((value) => localStorage.setItem('zodiacs.profile.v1', JSON.stringify(value)), profile);
        try {
          await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
          const island = page.locator('#compare astro-island[component-export="default"]');
          assert.equal(await island.count(), 1);
          assert.equal(await island.getAttribute('client'), 'visible');
          assert.equal(await island.getAttribute('ssr'), '');
          assert.ok((await page.locator('#compare .calc__form').boundingBox()).y > 844);
          assert.deepEqual(calculatorRequests, [], 'calculator JavaScript must stay deferred at load');
          console.log(`PASS ${path} ${width}: SSR and no calculator request at load`);

          await page.locator('#compare .calc__form').scrollIntoViewIfNeeded();
          await page.waitForFunction(() => !document.querySelector('#compare astro-island[ssr]'), null, { timeout: 8000 });
          assert.ok(calculatorRequests.length > 0);
          await page.locator('#syn-a-source').selectOption('visible-a');
          await page.locator('#syn-b-source').selectOption('visible-a');
          assert.equal(await page.locator('#compare .calc__submit').isDisabled(), true, 'same chart stays invalid');
          await page.locator('#syn-b-source').selectOption('visible-b');
          assert.equal(await page.locator('#compare .calc__submit').isEnabled(), true);
          await page.locator('#compare .calc__submit').click();
          await page.locator('#compare .rwheel').waitFor({ timeout: 20000 });
          await page.locator('#compare .wheel__transit').first().waitFor();
          assert.equal(await page.locator('#compare [data-check-our-math] time').count(), 2);
          const layout = await page.evaluate(() => ({
            resultWidth: document.querySelector('#compare .calc__result').getBoundingClientRect().width,
            compareWidth: document.querySelector('#compare .ph-compare').getBoundingClientRect().width,
            scrollWidth: document.documentElement.scrollWidth,
            viewportWidth: innerWidth,
          }));
          assert.ok(Math.abs(layout.resultWidth - layout.compareWidth) < 1, 'results span both grid columns');
          assert.ok(layout.scrollWidth <= layout.viewportWidth, 'comparison does not overflow the viewport');
          assert.deepEqual(errors, []);
          console.log(`PASS ${path} ${width}: scroll hydrates, validation works, comparison renders both charts`);
        } catch (error) {
          failures.push(`${path} ${width}: ${error.message}`);
          console.error(`FAIL ${failures.at(-1)}`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  assert.deepEqual(failures, [], 'pair calculator browser regression');
});
