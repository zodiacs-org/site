/**
 * Loads of the localized daily pages, without streaming, on the real clock,
 * each in a fresh browser context: the CLS of every load, then the shifts of
 * the first load that had any, with their times and the elements that moved.
 * `nofonts` aborts the web fonts; `warm` loads the page once before measuring
 * (the footer stylesheet still revalidates: it is served must-revalidate).
 *
 *   npm run build
 *   node docs/platform/evidence/edition-dated-locales-20261012/measure-footer-shift.mjs [cold|nofonts|warm] [loads]
 */
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from '../../../../tests/visual/browser.mjs';
import { withPreview } from '../../../../tests/visual/preview-server.mjs';

const mode = process.argv[2] ?? 'cold';
const loads = Number(process.argv[3] ?? 5);
const routes = ['/es/horoscopes/aries/', '/pt/horoscopes/aries/', '/es/today/', '/pt/today/'];
const widths = [360, 412, 1280];

await withPreview({ port: 4397 }, async (baseURL) => {
  const browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
  try {
    console.log(`Chromium ${browser.version()} · ${mode} · ${loads} loads each · viewport height 1400`);
    for (const route of routes) {
      for (const width of widths) {
        const values = [];
        let example;
        for (let load = 0; load < loads; load += 1) {
        const context = await browser.newContext({ viewport: { width, height: 1400 } });
        const page = await context.newPage();
        if (mode === 'nofonts') await page.route(/\.woff2(\?|$)/u, (request) => request.abort());
        if (mode === 'warm') await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
        await page.addInitScript(() => {
          globalThis.__shifts = [];
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              globalThis.__shifts.push({
                at: Math.round(entry.startTime),
                value: Number(entry.value.toFixed(4)),
                moved: (entry.sources ?? []).map((source) => {
                  const node = source.node?.nodeType === 1 ? source.node : source.node?.parentElement;
                  return node ? `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}` : '(removed)';
                }),
              });
            }
          }).observe({ type: 'layout-shift', buffered: true });
        });
        await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        const shifts = await page.evaluate(() => globalThis.__shifts);
        const total = shifts.reduce((sum, shift) => sum + shift.value, 0);
        values.push(total.toFixed(4));
        if (shifts.length && !example) example = shifts;
        await context.close();
        }
        const shifted = values.filter((value) => Number(value) > 0).length;
        console.log(`${route.padEnd(22)} ${String(width).padStart(4)} px  ${shifted}/${loads} loads shifted  CLS ${values.join(' ')}${example ? `  first: ${JSON.stringify(example)}` : ''}`);
      }
    }
  } finally {
    await browser.close();
  }
});
