/**
 * The birth chart form's finished layout: after a full load, the boxes of its
 * rows and the SHA-256 of a screenshot of the form, at 412 x 823 (mobile) and
 * 1440 x 900. Run on two builds, the outputs show whether a change moved
 * anything once the page has loaded.
 *
 * Run after `npm run build`, from the repository root:
 *   node docs/platform/evidence/site-engine-1-1-0-rc1/tools/form-layout.mjs > out.json
 */
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from '../../../../../tests/visual/browser.mjs';
import { withPreview } from '../../../../../tests/visual/preview-server.mjs';

const ROWS = ['.calc__core', '.calc__fields', '.calc__submit', '.calc__privacy', '.calc__options', '.calc__guide'];
const executablePath = await findChromium();
const layouts = {};
await withPreview({ port: 4360 }, async (base) => {
  const browser = await chromium.launch({ executablePath, args: ['--headless=new', ...STABLE_CHROMIUM_ARGS] });
  for (const path of ['/birth-chart/', '/ru/birth-chart/']) {
    for (const [width, height, isMobile] of [[412, 823, true], [1440, 900, false]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.goto(base + path, { waitUntil: 'load' });
      await page.waitForTimeout(800);
      const boxes = await page.evaluate((selectors) => Object.fromEntries(selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return [selector, null];
        const box = element.getBoundingClientRect();
        return [selector, [box.x, box.y, box.width, box.height].map((value) => Math.round(value * 10) / 10)];
      })), ROWS);
      const screenshot = await page.locator('.calc__core').screenshot();
      layouts[`${path} ${width}x${height}`] = { boxes, formScreenshotSha256: createHash('sha256').update(screenshot).digest('hex') };
      await context.close();
    }
  }
  await browser.close();
});
console.log(JSON.stringify({ schema: 'zodiacs.form-layout.v1', layouts }, null, 2));
