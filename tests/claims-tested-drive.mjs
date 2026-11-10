/**
 * "Astrology claims, tested" in Chromium, against the built site (npm run build first):
 * - always noindex, and out of the sitemap;
 * - with PUBLIC_CLAIMS_TESTED_ENABLED unset (the CI build): a stub that says it is not published;
 * - with it set to 1: every entry, the two tallies apart (prediction tests, calculation checks), the empty
 *   prediction section's paragraph, zero CLS on load at 360px and 1280px, no horizontal scroll and no page errors.
 * With --screenshots it writes the PR evidence to docs/claims-tested/evidence/.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { projectRoot, withPreview } from './visual/preview-server.mjs';

const SCREENSHOTS = process.argv.includes('--screenshots');
const ON = process.env.PUBLIC_CLAIMS_TESTED_ENABLED === '1';
const evidence = resolve(projectRoot, 'docs/claims-tested/evidence');
if (SCREENSHOTS) await mkdir(evidence, { recursive: true });
const { entries, updated } = JSON.parse(await readFile(resolve(projectRoot, 'src/data/claims-tested.json'), 'utf8'));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SUMMARY = ['Prediction tests: none yet. Held up: 0.', 'Calculation checks: 2. Held up: 2.', `Updated: ${Number(updated.slice(8, 10))} ${MONTHS[Number(updated.slice(5, 7)) - 1]} ${updated.slice(0, 4)}`];
const EMPTY = 'No prediction test we can stand behind yet. A first trial on four people and three checkable months was too small to report as a result. A fair test needs dozens of people with recorded birth times, scored blind.';
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: ${detail}`}`);
  if (!ok) failures.push(name);
};
const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 780, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1280, height: 900 },
];

await withPreview({ port: 4372 }, async (base) => {
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  check('out of the sitemap', !sitemap.includes('/claims-tested/'));
  const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: SCREENSHOTS ? 2 : 1, isMobile: !!viewport.isMobile, hasTouch: !!viewport.hasTouch });
      await context.addInitScript(() => {
        window.__cls = 0;
        new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
      });
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(String(error)));
      await tab.goto(`${base}/claims-tested/`, { waitUntil: 'networkidle' });
      await tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 300)))));
      const robots = await tab.getAttribute('meta[name="robots"]', 'content');
      check(`${viewport.name}: noindex`, /noindex/u.test(robots ?? ''), robots ?? 'none');
      if (!ON) {
        check(`${viewport.name}: off, it says it is not published and lists nothing`, (await tab.textContent('.tool-hero p'))?.includes('not published yet') === true && (await tab.locator('.claims-entry').count()) === 0);
      } else {
        check(`${viewport.name}: every entry is listed`, (await tab.locator('.claims-entry').count()) === entries.length);
        const summary = (await tab.locator('.claims-summary li').allTextContents()).map((line) => line.trim());
        check(`${viewport.name}: two tallies, prediction and calculation, and the date`, JSON.stringify(summary) === JSON.stringify(SUMMARY), JSON.stringify(summary));
        check(`${viewport.name}: the empty prediction section says so`, (await tab.locator('#prediction .claims-empty').textContent())?.trim() === EMPTY && (await tab.locator('#prediction .claims-entry').count()) === 0);
        check(`${viewport.name}: zero CLS on load`, (await tab.evaluate(() => window.__cls)) === 0, String(await tab.evaluate(() => window.__cls)));
        check(`${viewport.name}: no horizontal scroll`, !(await tab.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)));
        if (SCREENSHOTS) await tab.screenshot({ path: `${evidence}/${viewport.name}.png`, fullPage: true });
      }
      check(`${viewport.name}: no page errors`, errors.length === 0, errors.join('\n'));
      await context.close();
    }
  } finally {
    await browser.close();
  }
});

console.log(failures.length ? `claims-tested drive: ${failures.length} failure(s)` : 'claims-tested drive: PASS');
process.exit(failures.length ? 1 : 0);
