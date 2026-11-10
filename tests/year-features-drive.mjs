/**
 * Drives the Year Ahead Score, Birthday report, solar return and Year Ahead
 * directory pages in Chromium at phone (390px) and desktop (1280px) widths:
 * the layout shift before any input stays at zero, nothing scrolls sideways,
 * the calculators answer from a birth date alone and offer their share links,
 * and no answer puts a birth detail in the address bar.
 *
 * Each page follows its launch switch (src/lib/launch-flags.ts), read here from
 * the shell as the build reads it. A page whose switch is off is checked in the
 * built HTML instead: the 404 redirect and none of the page's own markup, or,
 * for a figure's page, no page at all.
 *
 *   npm run build && node tests/year-features-drive.mjs [--shots <dir>]
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const shotsArg = process.argv.indexOf('--shots');
const shots = shotsArg === -1 ? null : process.argv[shotsArg + 1];
if (shots) await mkdir(shots, { recursive: true });
const WIDTHS = [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 900 }];
const on = (name) => process.env[name] === '1';
const FLAGS = {
  yearScore: on('PUBLIC_YEAR_SCORE_ENABLED'),
  // The people pages need the score's switch as well.
  yearPeople: on('PUBLIC_YEAR_PEOPLE_ENABLED') && on('PUBLIC_YEAR_SCORE_ENABLED'),
  birthdayReport: on('PUBLIC_BIRTHDAY_REPORT_ENABLED'),
  solarReturnShare: on('PUBLIC_SOLAR_RETURN_SHARE_ENABLED'),
};
/** Each page, whether its switch is on, and the markup only the page itself prints. */
const ALL_PAGES = [
  { path: '/year-score/', on: FLAGS.yearScore, markup: ['id="ys-date"', '<h1'] },
  { path: '/birthday-report/', on: FLAGS.birthdayReport, markup: ['id="br-date"', '<h1'] },
  { path: '/solar-return/', on: true, markup: [] },
  { path: '/year/', on: FLAGS.yearPeople, markup: ['<h1'] },
  { path: '/year/jensen-huang/', on: FLAGS.yearPeople, markup: null },
  { path: '/tools/', on: true, markup: [] },
];
const PAGES = ALL_PAGES.filter((page) => page.on).map((page) => page.path);
const failures = [];
const fail = (message) => { failures.push(message); console.error(`FAIL ${message}`); };
console.log(`switches: ${Object.entries(FLAGS).map(([name, value]) => `${name} ${value ? 'on' : 'off'}`).join(', ')}`);

// A page behind a switch that is off: the built file is the 404 redirect, or is not built at all.
for (const { path, markup } of ALL_PAGES.filter((page) => !page.on)) {
  const file = `dist${path}index.html`;
  if (markup === null) {
    if (existsSync(file)) fail(`${path}: built although its switch is off`);
    else console.log(`ok ${path}: not built, switch off`);
    continue;
  }
  const html = existsSync(file) ? await readFile(file, 'utf8') : '';
  if (!html.includes('http-equiv="refresh"')) fail(`${path}: no redirect although its switch is off`);
  for (const text of markup) if (html.includes(text)) fail(`${path}: prints ${text} although its switch is off`);
  console.log(`ok ${path}: redirects, switch off`);
}

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
      ].filter(([path]) => PAGES.includes(path))) {
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
