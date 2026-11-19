import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const output = resolve(process.env.PLATFORM_SHARE_EVIDENCE ?? 'tests/visual/artifacts/platform-share');
await mkdir(output, { recursive: true });
const { version } = JSON.parse(await readFile(new URL('../node_modules/@zodiacs/engine/package.json', import.meta.url), 'utf8'));
const wire = (date, time = '08:30') => {
  const input = { d: date, z: 'UTC', la: 13.7563, lo: 100.5018, n: 'Synthetic', p: 'Synthetic place' };
  if (time !== null) input.t = time;
  return '1.' + Buffer.from(JSON.stringify(input)).toString('base64url');
};
const browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
const checks = [];
try {
  await withPreview({ port: 4336 }, async (baseURL) => {
    for (const width of [1280, 390]) {
      for (const [date, time, accepted] of [
        ['2001-02-29', '08:30', false],
        ['1900-02-29', '08:30', false],
        ['2001-04-31', '08:30', false],
        ['2000-02-29', '24:00', false],
        ['2000-02-29', '08:30', true],
        ['2000-02-29', null, true],
      ]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', timezoneId: 'UTC' });
        try {
          await context.addInitScript(() => {
            window.__platformComputed = [];
            window.addEventListener('zodiacs:chart-computed', (event) => window.__platformComputed.push(event.detail));
          });
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', (error) => errors.push(error.message));
          const response = await page.goto(`${baseURL}/birth-chart/#c=${wire(date, time)}`, { waitUntil: 'networkidle' });
          assert.equal(response.status(), 200);
          await page.locator('.calc__form').waitFor({ state: 'visible' });
          await page.waitForFunction(() => !document.querySelector('.calc__form')?.closest('astro-island')?.hasAttribute('ssr'));
          if (accepted) {
            await page.locator('.calc__result').waitFor({ state: 'visible', timeout: 45000 });
            await page.waitForFunction(() => window.__platformComputed.length === 1);
            assert.equal(await page.locator('#birth-date').inputValue(), date);
            assert.equal(await page.locator('#birth-time').isDisabled(), time === null);
            assert.equal(await page.evaluate(() => location.hash), '', 'accepted input consumes its fragment');
            assert.ok((await page.locator('.calc__result').textContent()).includes(version));
          } else {
            await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
            assert.equal(await page.locator('.calc__result').count(), 0, 'invalid share must never display a normalized chart');
            assert.equal(await page.locator('#birth-date').inputValue(), '', 'invalid decoded input must not populate the form');
            assert.equal(await page.locator('.calc__form').getAttribute('aria-busy'), 'false');
            assert.deepEqual(await page.evaluate(() => window.__platformComputed), [], 'invalid share must not emit a calculation event');
          }
          const layout = await page.evaluate(() => ({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth }));
          assert.equal(layout.pageWidth, width);
          assert.deepEqual(errors, []);
          const events = await page.evaluate(() => window.__platformComputed);
          const stored = await page.evaluate(() => localStorage.getItem('zodiacs.profile.v1'));
          assert.equal(stored, null, 'opening a share must not write a saved chart');
          checks.push({ date, time, accepted, width, events, layout, noSavedProfile: true, errors });
          if (date === '2001-02-29' || (date === '2000-02-29' && time === null)) {
            await page.screenshot({ path: resolve(output, `share-${accepted ? 'unknown' : 'rejected'}-${width}.png`) });
          }
        } finally {
          await context.close();
        }
      }
    }
  });
  const report = { result: 'passed', capturedAt: new Date().toISOString(), browser: browser.version(), engineVersion: version, checks };
  await writeFile(resolve(output, 'share-boundary-browser.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
