/**
 * Drives the Year Ahead Score, Birthday report, solar return and Year Ahead
 * directory pages in Chromium at phone (390px) and desktop (1280px) widths:
 * the layout shift before any input stays at zero (and, on the birthday
 * report, through a result held back past the input window and through
 * switching the birthday year), nothing scrolls sideways,
 * the calculators answer from a birth date alone and offer their share links,
 * an untimed solar return is a date with no clock time, a birth date on which
 * the Sun changes sign gets both signs and no share link, and no answer puts a
 * birth detail in the address bar.
 *
 * Each page follows its launch switch (src/lib/launch-flags.ts), read here from
 * the shell as the build reads it. A page whose switch is off is checked in the
 * built HTML instead: the 404 redirect and none of the page's own markup, or,
 * for a figure's page, no page at all. Each switch launches on its own, so no
 * built page, no sitemap row and no link a calculator draws may lead to a page
 * whose switch is off, and the solar return result shows its themes and share
 * link only with PUBLIC_SOLAR_RETURN_SHARE_ENABLED.
 *
 * Run it once per build, with the same switches in the shell as the build had.
 * The combinations that matter: every switch unset; each one alone
 * (PUBLIC_BIRTHDAY_REPORT_ENABLED=1 alone is the report without the score);
 * the people switch without the score's (still off); all four.
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
/** Where each switch's pages live: no page may link there while the switch is off. */
const OFF_TARGETS = [
  { flag: 'yearScore', test: (href) => href === '/year-score/' },
  { flag: 'birthdayReport', test: (href) => href === '/birthday-report/' },
  { flag: 'yearPeople', test: (href) => href.startsWith('/year/') },
].filter(({ flag }) => !FLAGS[flag]);
/** A site-relative path from an href or a sitemap location, without its query or fragment. */
const sitePath = (href) => {
  try { return new URL(href, 'https://zodiacs.org').pathname; } catch { return href; }
};
const offTarget = (href) => OFF_TARGETS.find(({ test }) => test(sitePath(href)))?.flag;
/** Built pages that carry, or used to carry, a link to one of the switched pages. */
const LINKING_PAGES = ['/year-score/', '/birthday-report/', '/year/', '/year/jensen-huang/', '/solar-return/', '/tools/', '/transits/', '/birthday/', '/'];
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

// No built page and no sitemap row leads to a page whose switch is off.
for (const path of LINKING_PAGES.filter((path) => ALL_PAGES.find((page) => page.path === path)?.on ?? true)) {
  const file = `dist${path}index.html`;
  if (!existsSync(file)) { fail(`${path}: not built`); continue; }
  const html = await readFile(file, 'utf8');
  const hrefs = [...html.matchAll(/\shref="([^"]*)"/gu)].map((match) => match[1]);
  const bad = hrefs.filter((href) => offTarget(href));
  if (bad.length) fail(`${path}: links to ${[...new Set(bad)].join(', ')} although its switch is off`);
  else console.log(`ok ${path}: no link to a page whose switch is off`);
}
{
  const sitemap = await readFile('dist/sitemap.xml', 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/gu)].map((match) => match[1]);
  const bad = locs.filter((loc) => offTarget(loc));
  if (bad.length) fail(`sitemap.xml lists ${bad.join(', ')} although its switch is off`);
  for (const [flag, path] of [['yearScore', '/year-score/'], ['birthdayReport', '/birthday-report/']]) {
    if (FLAGS[flag] && !locs.some((loc) => sitePath(loc) === path)) fail(`sitemap.xml leaves out ${path} although its switch is on`);
  }
  console.log('ok sitemap.xml: lists the switched pages only while on');
}

/** Links in the live page to a page whose switch is off, after the scripts have drawn the page. */
const offLinks = (page) => page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))
  .then((hrefs) => [...new Set(hrefs.filter((href) => offTarget(href)))]);
const linkCount = (page, name) => page.getByRole('link', { name, exact: true }).count();

/** The saved chart the solar return casts from, as tests/solar-return-drive.mjs seeds it (a public figure's published birth). */
const SR_PROFILE = {
  version: 1, settings: { houseSystem: 'whole' }, charts: [{
    id: 'kahlo-located', name: 'Frida', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    birth: { date: '1907-07-06', time: '08:30', timeKnown: true, place: { name: 'Mexico City', admin1: 'Ciudad de México', country: 'Mexico', lat: 19.4326, lon: -99.1332, tz: 'America/Mexico_City' } },
    summary: { engineVersion: '1.0.0', utcISO: '1907-07-06T15:06:36Z', houseSystem: 'whole', bodies: [{ body: 'Sun', lon: 103.3755, retrograde: false }], angles: null, flags: [] },
  }],
};

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
        const off = await offLinks(page);
        if (off.length) fail(`${path} @${size.width}: links to ${off.join(', ')} although its switch is off`);
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
        const off = await offLinks(page);
        if (off.length) fail(`${path} result @${size.width}: links to ${off.join(', ')} although its switch is off`);
        if (path === '/birthday-report/') {
          // Without a birth time the return is a date: no clock time, and the line says it can be a day either side.
          const returnLine = (await page.locator('[data-br-return]').innerText()).trim();
          if (/\b\d{1,2}:\d{2}\b/u.test(returnLine) || !returnLine.startsWith('Around ')) fail(`${path} result @${size.width}: the untimed return line reads "${returnLine}"`);
          // The report includes the score either way; its links to the score's page wait for that switch.
          const intro = await page.locator('.tool-hero a[href="/year-score/"]').count();
          const months = await linkCount(page, 'See the months and the transits behind it');
          if (intro !== Number(FLAGS.yearScore) || months !== Number(FLAGS.yearScore)) fail(`${path} result @${size.width}: introduction ${intro}, result ${months} link(s) to /year-score/ with the score's switch ${FLAGS.yearScore ? 'on' : 'off'}`);
          const introText = (await page.locator('.tool-hero p').first().innerText()).replace(/\s+/gu, ' ');
          if (!introText.includes('your Year Ahead Score, your numerology Personal Year')) fail(`${path} @${size.width}: the introduction reads "${introText}"`);
        }
        if (shots) await page.screenshot({ path: `${shots}/${path.replaceAll('/', '_')}result-${size.name}.png`, fullPage: true });
        console.log(`ok ${path} result @${size.width}: ${href}`);
      }

      // The birthday report's year buttons: their row is reserved from the first paint, so a result that
      // arrives long after the click (every lazy chunk held back) and each switch of year shift nothing.
      if (FLAGS.birthdayReport) {
        // Its own context with the service worker blocked: the worker serves /_astro/ from its cache, which no route can hold back.
        const brContext = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' });
        const page = await brContext.newPage();
        await page.goto(`${baseURL}/birthday-report/`, { waitUntil: 'networkidle' });
        await page.evaluate(() => {
          window.__brShifts = [];
          new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__brShifts.push({ value: entry.value, recent: entry.hadRecentInput }); })
            .observe({ type: 'layout-shift' });
        });
        const rowBox = () => page.locator('.br__years').evaluate((row) => {
          const box = row.getBoundingClientRect();
          return { top: Math.round(box.top + window.scrollY), height: Math.round(box.height), visible: getComputedStyle(row).visibility };
        });
        const reserved = await rowBox();
        await page.route('**/_astro/*.js', async (route) => { await new Promise((resolve) => setTimeout(resolve, 1500)); await route.continue(); });
        // A birthday 20 days from today (27 at most), so the report opens on the year it starts. A date from
        // the 18th to the 24th moves on to the 26th: the Sun can change sign on those days, and an unsettled
        // Sun gets no share link to compare.
        const soon = new Date(Date.now() + 20 * 86_400_000);
        const month = soon.getUTCMonth() + 1;
        const dayOfMonth = soon.getUTCDate() >= 18 && soon.getUTCDate() <= 24 ? 26 : soon.getUTCDate();
        const birthDate = `1990-${String(month).padStart(2, '0')}-${String(month === 2 ? Math.min(dayOfMonth, 28) : dayOfMonth).padStart(2, '0')}`;
        await page.fill('#br-date', birthDate);
        const clicked = Date.now();
        await page.getByRole('button', { name: 'Make my birthday report' }).click();
        await page.locator('.br__heading').waitFor({ timeout: 45_000 });
        const waited = Date.now() - clicked;
        await page.unroute('**/_astro/*.js');
        // Routing turns the HTTP cache off, so the chunks come late; the result must land outside the click's 500ms input window.
        if (waited < 1000) fail(`/birthday-report/ @${size.width}: the result came ${waited}ms after the click, too soon to test a late result`);
        const filled = await rowBox();
        if (reserved.visible !== 'hidden' || filled.visible !== 'visible') fail(`/birthday-report/ @${size.width}: year row ${reserved.visible} before the report, ${filled.visible} after`);
        if (reserved.top !== filled.top || reserved.height !== filled.height) fail(`/birthday-report/ @${size.width}: the year row moved from ${JSON.stringify(reserved)} to ${JSON.stringify(filled)}`);
        const years = page.locator('.br__year');
        const states = async () => years.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-pressed')));
        if ((await states()).join() !== 'false,true') fail(`/birthday-report/ @${size.width}: a birthday 20 days away opens with aria-pressed ${(await states()).join()}`);
        const shareHref = () => page.getByRole('link', { name: 'Share my birthday report' }).getAttribute('href');
        const nextShare = await shareHref();
        await years.nth(0).click();
        await page.waitForFunction(() => document.querySelector('.br__year')?.getAttribute('aria-pressed') === 'true');
        const currentShare = await shareHref();
        if (!currentShare || currentShare === nextShare || /1990|py=/u.test(currentShare)) fail(`/birthday-report/ @${size.width}: share link after switching ${currentShare}`);
        await page.waitForTimeout(700);
        await years.nth(1).click();
        await page.waitForFunction(() => document.querySelectorAll('.br__year')[1]?.getAttribute('aria-pressed') === 'true');
        if (await shareHref() !== nextShare) fail(`/birthday-report/ @${size.width}: switching back did not restore the share link`);
        await page.waitForTimeout(700);
        const shifts = await page.evaluate(() => window.__brShifts);
        const cls = shifts.filter((entry) => !entry.recent).reduce((sum, entry) => sum + entry.value, 0);
        if (cls > 0.001) fail(`/birthday-report/ @${size.width}: layout shift ${cls.toFixed(4)} from a delayed result and switching years`);
        if ((await rowBox()).top !== filled.top) fail(`/birthday-report/ @${size.width}: switching years moved the year row`);
        console.log(`ok /birthday-report/ years @${size.width}: row reserved (${reserved.height}px), result after ${waited}ms, CLS ${cls.toFixed(4)} through it and two switches`);
        await brContext.close();
      }

      // A date-only birth on the day the Sun changes sign (into Aries, 20 March 1990 at 21:19 UTC): both signs, and no share link.
      for (const [path, field, button, result, share, unsettled] of [
        ['/year-score/', '#ys-date', 'Score my year', '.ys__number', 'Share your score', '[data-ys-sun-unsettled]'],
        ['/birthday-report/', '#br-date', 'Make my birthday report', '.br__heading', 'Share my birthday report', '[data-br-sun-unsettled]'],
      ].filter(([path]) => PAGES.includes(path))) {
        await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
        await page.fill(field, '1990-03-20');
        await page.getByRole('button', { name: button }).click();
        await page.locator(result).first().waitFor({ timeout: 30_000 });
        const shares = await page.getByRole('link', { name: share }).count();
        if (shares !== 0) fail(`${path} 1990-03-20 @${size.width}: ${shares} share link(s) for an unsettled Sun sign`);
        const line = (await page.locator(unsettled).innerText().catch(() => '')).trim();
        if (line !== 'Your Sun is in Pisces or Aries: a birth time settles it.') fail(`${path} 1990-03-20 @${size.width}: the Sun line reads "${line}"`);
        console.log(`ok ${path} 1990-03-20 @${size.width}: no share link, ${line}`);
      }
      await context.close();

      // The solar return result: themes and share link behind their own switch, each button behind its page's.
      const srContext = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      await srContext.addInitScript((seed) => {
        if (location.origin !== 'null') localStorage.setItem('zodiacs.profile.v1', JSON.stringify(seed));
      }, SR_PROFILE);
      const sr = await srContext.newPage();
      await sr.goto(`${baseURL}/solar-return/`, { waitUntil: 'networkidle' });
      await sr.waitForFunction(() => document.querySelector('#sr-source')?.value === 'kahlo-located');
      await sr.locator('#sr-year-mode').selectOption('custom');
      await sr.getByLabel('Custom return year').fill('2024');
      await sr.getByRole('button', { name: 'Find my solar return', exact: true }).click();
      await sr.locator('[data-solar-return-result]').waitFor({ state: 'visible', timeout: 45_000 });
      const themes = await sr.locator('.sr-themes [data-sr-theme]').count();
      if (FLAGS.solarReturnShare ? themes === 0 : themes !== 0) fail(`/solar-return/ result @${size.width}: ${themes} theme(s) with the share switch ${FLAGS.solarReturnShare ? 'on' : 'off'}`);
      const shareLinks = sr.locator('[data-sr-share-link]');
      const shareCount = await shareLinks.count();
      if (shareCount !== Number(FLAGS.solarReturnShare)) fail(`/solar-return/ result @${size.width}: ${shareCount} share link(s) with the share switch ${FLAGS.solarReturnShare ? 'on' : 'off'}`);
      if (shareCount) {
        const href = await shareLinks.first().getAttribute('href');
        if (!href || !sitePath(href).startsWith('/share/solar-return/') || /1907|07-06|0706|08:30|Mexico|19\.43|99\.13/u.test(href)) fail(`/solar-return/ result @${size.width}: share link ${href}`);
      }
      for (const [flag, name] of [['yearScore', 'Score the year ahead →'], ['birthdayReport', 'Your birthday report →']]) {
        const count = await linkCount(sr, name);
        if (count !== Number(FLAGS[flag])) fail(`/solar-return/ result @${size.width}: ${count} "${name}" link(s) with ${flag} ${FLAGS[flag] ? 'on' : 'off'}`);
      }
      const srOff = await offLinks(sr);
      if (srOff.length) fail(`/solar-return/ result @${size.width}: links to ${srOff.join(', ')} although its switch is off`);
      if (/1907|07-06/u.test(sr.url())) fail(`/solar-return/ result @${size.width}: the address bar carries a birth detail`);
      if (shots) await sr.screenshot({ path: `${shots}/_solar-return_result-${size.name}.png`, fullPage: true });
      console.log(`ok /solar-return/ result @${size.width}: ${themes} theme(s), share ${shareCount ? 'on' : 'off'}`);
      await srContext.close();
    }
  });
} finally {
  await browser.close();
}
if (failures.length) { console.error(`year features drive: ${failures.length} failure(s)`); process.exit(1); }
console.log('year features drive: PASS');
