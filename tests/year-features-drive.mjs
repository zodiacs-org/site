/**
 * Drives the Year Ahead Score, Birthday report, solar return and Year Ahead
 * directory pages in Chromium at phone (390px) and desktop (1280px) widths:
 * the layout shift before any input stays at zero, nothing scrolls sideways,
 * the calculators answer from a birth date alone and offer their share links,
 * and no answer puts a birth detail in the address bar.
 *
 *   npm run build && node tests/year-features-drive.mjs [--shots <dir>]
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const shotsArg = process.argv.indexOf('--shots');
const shots = shotsArg === -1 ? null : process.argv[shotsArg + 1];
if (shots) await mkdir(shots, { recursive: true });
const WIDTHS = [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 900 }];
const PAGES = ['/year-score/', '/birthday-report/', '/solar-return/', '/year/', '/year/jensen-huang/', '/tools/'];
const failures = [];
const fail = (message) => { failures.push(message); console.error(`FAIL ${message}`); };

async function layoutShiftBeforeInput(page) {
  return page.evaluate(() => new Promise((resolve) => {
    let total = 0;
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) total += entry.value; })
      .observe({ type: 'layout-shift', buffered: true });
    setTimeout(() => resolve(total), 2500);
  }));
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
try {
  await withPreview({ port: Number(process.env.YEAR_FEATURES_PORT ?? 4337) }, async (baseURL) => {
    for (const size of WIDTHS) {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const page = await context.newPage();
      for (const path of PAGES) {
        await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
        const cls = await layoutShiftBeforeInput(page);
        if (cls > 0.001) fail(`${path} @${size.width}: layout shift ${cls.toFixed(4)} before any input`);
        const wide = await overflow(page);
        if (wide > 0) fail(`${path} @${size.width}: scrolls sideways by ${wide}px`);
        if (shots) await page.screenshot({ path: `${shots}/${path.replaceAll('/', '_') || 'home'}-${size.name}.png`, fullPage: true });
        console.log(`ok ${path} @${size.width}: CLS ${cls.toFixed(4)}`);
      }

      // The calculators, from a birth date alone.
      for (const [path, field, button, result, share] of [
        ['/year-score/', '#ys-date', 'Score my year', '.ys__number', 'Share your score'],
        ['/birthday-report/', '#br-date', 'Make my birthday report', '.br__heading', 'Share my birthday report'],
      ]) {
        await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
        await page.fill(field, '1990-05-03');
        await page.getByRole('button', { name: button }).click();
        await page.locator(result).first().waitFor({ timeout: 30_000 });
        const href = await page.getByRole('link', { name: share }).getAttribute('href');
        if (!href || /1990|05-03|0503/u.test(href)) fail(`${path} @${size.width}: share link ${href}`);
        if (/1990|05-03/u.test(page.url())) fail(`${path} @${size.width}: the address bar carries a birth detail`);
        const wide = await overflow(page);
        if (wide > 0) fail(`${path} result @${size.width}: scrolls sideways by ${wide}px`);
        if (shots) await page.screenshot({ path: `${shots}/${path.replaceAll('/', '_')}result-${size.name}.png`, fullPage: true });
        console.log(`ok ${path} result @${size.width}: ${href}`);
      }
      await context.close();
    }
  });
} finally {
  await browser.close();
}
if (failures.length) { console.error(`year features drive: ${failures.length} failure(s)`); process.exit(1); }
console.log('year features drive: PASS');
