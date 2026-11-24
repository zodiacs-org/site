/**
 * The personal tool pages behind their launch switches (src/lib/launch-flags.ts), against the built site
 * (npm run build first, with the same switches in the shell as this run):
 *
 * - switch off: the page is the redirect to the 404 page, and no page that links to it on launch (the tools hub,
 *   the home page's Tools menu, the pages its pull request linked from) and no sitemap row leads to it;
 * - switch on, at 360px and 1280px: the page loads with zero layout shift (one rerun, as AGENTS.md allows for a
 *   micro-shift flake; a second shift fails), a fixed adult birth gives a result without changing the address
 *   bar or sending the birth date anywhere, and every share link on the result carries exactly the tool's
 *   *_SHARE_KEYS (without `ref`, which only the assistant adds), each once, and no birth detail.
 *
 * A branch carries only its own pages; a page whose source is not in src/pages is skipped.
 *
 *   npm run build && node tests/personal-pages-drive.mjs
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { projectRoot, withPreview } from './visual/preview-server.mjs';

/** A fixed adult birth: a date, a clock time and a place the place search finds. */
const BIRTH = { date: '1990-05-03', time: '08:30', place: 'London' };
const BIRTH_DETAIL = /1990|05-03|0503|08:30|0830|london|51\.5|-0\.1/iu;
/** A birth before 1970, whose clock the engine reads from the zone's history file rather than from Intl. */
const HISTORICAL_BIRTH = { date: '1950-05-03', time: '08:30' };
/** The engine's zone history files as the built site serves them. */
const ZONE_HISTORY_FILE = /\/_astro\/tzdb-\d{4}[a-z]-\d{2}-/u;

async function choosePlace(tab, id, query) {
  await tab.locator(`#${id}`).fill(query);
  const option = tab.locator(`#${id}-list [role="option"]:not([aria-disabled="true"])`).first();
  await option.waitFor({ state: 'visible', timeout: 30_000 });
  await option.click();
}

const ALL_PAGES = [
  {
    path: '/astrocartography/',
    flag: 'PUBLIC_ASTROCARTOGRAPHY_ENABLED',
    source: 'src/pages/astrocartography/index.astro',
    keys: { file: 'src/lib/astrocartography/share.ts', name: 'ASTROCARTOGRAPHY_SHARE_KEYS' },
    sharePath: '/share/astrocartography/',
    linkedFrom: ['/', '/tools/', '/rising-sign/', '/solar-return/'],
    async run(tab) {
      // Every request address, to check the place searches ask for the same fixed set of city files whatever is typed.
      const addresses = [];
      tab.on('request', (request) => addresses.push(request.url()));
      // The calendar module loads with the page, so a date before 1924 asks for nothing a later date does not.
      const loaded = await tab.evaluate(() => performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname));
      check('the calendar module loads with the page, before any date', loaded.some((path) => /\/_astro\/BirthCalendar[.-]/u.test(path)), loaded.join(', '));
      const afterDate = async (date) => {
        const from = addresses.length;
        await tab.fill('#acg-date', date);
        await settle(tab);
        return addresses.slice(from);
      };
      const early = await afterDate('1920-05-03');
      check('a date before 1924 asks for no file', early.length === 0, early.join('\n'));
      // Old Style, then a day no calendar has, then a child's date: each is refused at the date, and the birth time
      // and birthplace stay disabled.
      const shut = async (label) => {
        await settle(tab);
        const state = await tab.evaluate(() => ({
          time: document.querySelector('#acg-time')?.disabled, place: document.querySelector('#acg-place')?.disabled,
          error: document.querySelector('#acg-date-error')?.textContent ?? '',
        }));
        check(`${label}: refused at the date, birth time and birthplace disabled`, state.time === true && state.place === true && state.error !== '', JSON.stringify(state));
      };
      await tab.locator('input[name="acg-date-calendar"][value="julian"]').check();
      // Old Style dates are typed: wait for the date field to become a text field.
      await tab.locator('#acg-date[type="text"]').waitFor({ state: 'visible', timeout: 10_000 });
      await tab.fill('#acg-date', '1990-02-30');
      await shut('Old Style, then 1990-02-30');
      // The control closes once a 1924 or later date is Gregorian, so the choice is a click, not a checked state.
      await tab.locator('input[name="acg-date-calendar"][value="gregorian"]').click();
      await shut('Old Style 1990-02-30, then Gregorian');
      await tab.fill('#acg-date', '1920-05-03');
      await tab.locator('input[name="acg-date-calendar"][value="julian"]').check();
      // Old Style dates are typed: wait for the date field to become a text field.
      await tab.locator('#acg-date[type="text"]').waitFor({ state: 'visible', timeout: 10_000 });
      await tab.fill('#acg-date', '1900-02-30');
      await shut('Old Style, then 1900-02-30');
      await tab.fill('#acg-date', '2020-05-03');
      await shut('Old Style, then a child\'s date');
      const modern = await afterDate(BIRTH.date);
      check('a date after 1924 asks for no file', modern.length === 0, modern.join('\n'));
      await tab.fill('#acg-time', BIRTH.time);
      await choosePlace(tab, 'acg-place', BIRTH.place);
      await tab.getByRole('button', { name: 'Draw my map' }).click();
      await tab.locator('#acg-check').waitFor({ state: 'visible', timeout: 60_000 });
      // The share links are on the lines nearest a place the person checks.
      await choosePlace(tab, 'acg-check', 'Paris');
      await tab.locator('.acg__share').first().waitFor({ state: 'visible', timeout: 30_000 });
      // Two towns called Udaipur in Rajasthan: the picker tells them apart by their coordinates, each with its own id.
      await tab.locator('#acg-check').fill('Udaipur');
      const udaipurs = tab.locator('#acg-check-list [role="option"]:not([aria-disabled="true"])');
      await udaipurs.first().waitFor({ state: 'visible', timeout: 30_000 });
      const labels = (await udaipurs.allInnerTexts()).map((text) => text.replace(/\s+/gu, ' ').trim());
      const placeIds = await tab.locator('#acg-check-list li[data-place-id]').evaluateAll((items) => items.map((item) => item.getAttribute('data-place-id')));
      const rajasthan = labels.filter((label) => label.startsWith('Udaipur Rajasthan, India'));
      check('same-named places in the picker show distinct labels and ids', rajasthan.length === 2 && new Set(labels).size === labels.length && rajasthan.every((label) => /\d+\.\d{2}° N, \d+\.\d{2}° E/u.test(label)) && placeIds.length === labels.length && new Set(placeIds).size === placeIds.length, `${labels.join(' / ')} | ${placeIds.join(', ')}`);
      await tab.locator('#acg-check').fill('');
      const index = JSON.parse(await readFile(resolve(projectRoot, 'dist/data/cities/index.json'), 'utf8'));
      const whole = ['/data/cities/index.json', ...index.shards.map((key) => `/data/cities/${key}.json`)].sort();
      const cities = [...new Set(addresses.map((address) => new URL(address)).filter((url) => url.pathname.startsWith('/data/cities/')).map((url) => `${url.pathname}${url.search}`))].sort();
      check('the place searches request the whole city index, the same files whatever is typed', JSON.stringify(cities) === JSON.stringify(whole), cities.join(', '));
      const typed = addresses.filter((address) => /london|paris|udaipur/iu.test(address));
      check('no request carries a place typed into a search', typed.length === 0, typed.join('\n'));
      const table = tab.getByRole('table', { name: 'Where each line runs' });
      const sun = await table.getByRole('row', { name: /^Sun /u }).innerText();
      check('the table gives the Sun meridians', sun.includes('66.7° E') && sun.includes('113.3° W'));
      const lines = tab.locator('.acg__lines :is(line, path)');
      check('every planetary line has a title', await lines.evaluateAll((items) => items.length >= 40 && items.every((item) => item.querySelector('title')?.textContent.trim())));
      const card = tab.getByRole('article').filter({ has: tab.getByRole('heading', { name: /Paris/u }) });
      check('the place card prints reading confidence', await card.getByText('Reading confidence 70%', { exact: true }).isVisible());
      // The zone history files: a 1990 birth needs none and a 1950 one needs its zone's, yet both ask for the whole set.
      const histories = () => [...new Set(addresses.map((address) => new URL(address).pathname).filter((path) => ZONE_HISTORY_FILE.test(path)))].sort();
      const builtHistories = (await readdir(resolve(projectRoot, 'dist/_astro'))).map((name) => `/_astro/${name}`).filter((path) => ZONE_HISTORY_FILE.test(path)).sort();
      check('the built site has the engine\'s sixteen zone history files', builtHistories.length === 16, builtHistories.join(', '));
      const afterModern = histories();
      check('a birth after 1970 asks for every zone history file', JSON.stringify(afterModern) === JSON.stringify(builtHistories), afterModern.join(', '));
      const before = addresses.length;
      // The Moon's row moves most between the two births; its text says which map is drawn.
      const moonText = () => tab.evaluate(() => [...document.querySelectorAll('table tr')].find((row) => row.textContent.trim().startsWith('Moon'))?.textContent ?? '');
      const moonIs = (text, same) => tab.waitForFunction(([want, equal]) => {
        const now = [...document.querySelectorAll('table tr')].find((row) => row.textContent.trim().startsWith('Moon'))?.textContent ?? '';
        return now !== '' && (now === want) === equal;
      }, [text, same], { timeout: 60_000 });
      const moonModern = await moonText();
      await tab.fill('#acg-date', HISTORICAL_BIRTH.date);
      await tab.fill('#acg-time', HISTORICAL_BIRTH.time);
      await tab.getByRole('button', { name: 'Draw my map' }).click();
      await moonIs(moonModern, false);
      const later = addresses.slice(before);
      check('a birth before 1970 asks for no zone history file of its own', later.every((address) => !ZONE_HISTORY_FILE.test(new URL(address).pathname)), later.join('\n'));
      check('a birth before 1970 leaves the same set of zone history files', JSON.stringify(histories()) === JSON.stringify(builtHistories), histories().join(', '));
      check('no request carries the historical birth date', later.every((address) => !address.includes('1950')), later.join('\n'));
      // Back to the fixed birth, whose share links the drive checks next.
      await tab.fill('#acg-date', BIRTH.date);
      await tab.getByRole('button', { name: 'Draw my map' }).click();
      await moonIs(moonModern, true);
      await choosePlace(tab, 'acg-check', 'Paris');
      await tab.locator('.acg__share').first().waitFor({ state: 'visible', timeout: 30_000 });
      return '.acg__share';
    },
  },
];

const PAGES = ALL_PAGES.filter((page) => existsSync(resolve(projectRoot, page.source)));
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: ${detail}`}`);
  if (!ok) failures.push(name);
};
const built = (path) => readFile(resolve(projectRoot, 'dist', `.${path}`, 'index.html'), 'utf8').catch(() => '');

/** The tool's share keys, read from its source (this drive is plain Node and does not load TypeScript). */
async function shareKeys({ file, name }) {
  const source = await readFile(resolve(projectRoot, file), 'utf8');
  const match = source.match(new RegExp(`${name}: readonly string\\[\\] = Object\\.freeze\\(\\[([^\\]]*)\\]\\)`, 'u'));
  if (!match) throw new Error(`${name} not found in ${file}`);
  return [...match[1].matchAll(/'([^']+)'/gu)].map((key) => key[1]);
}

if (PAGES.length === 0) {
  console.error('personal pages drive: no personal page in src/pages');
  process.exit(1);
}

const sitemap = await readFile(resolve(projectRoot, 'dist/sitemap.xml'), 'utf8');
const onPages = [];
for (const page of PAGES) {
  const on = process.env[page.flag] === '1';
  console.log(`${page.path}: ${page.flag} ${on ? 'on' : 'off'}`);
  const html = await built(page.path);
  if (!on) {
    check(`switch off: ${page.path} is the redirect to the 404 page`, /http-equiv="refresh"[^>]*\/404\.html/u.test(html), html.slice(0, 200));
    for (const from of page.linkedFrom) {
      check(`switch off: ${from} does not link to ${page.path}`, !(await built(from)).includes(`href="${page.path}"`));
    }
    check(`switch off: the sitemap does not list ${page.path}`, !sitemap.includes(`<loc>https://zodiacs.org${page.path}</loc>`));
    continue;
  }
  check(`switch on: ${page.path} is built`, html.includes('<h1') && !html.includes('http-equiv="refresh"'));
  check(`switch on: the sitemap lists ${page.path}`, sitemap.includes(`<loc>https://zodiacs.org${page.path}</loc>`));
  for (const from of page.linkedFrom) {
    check(`switch on: ${from} links to ${page.path}`, (await built(from)).includes(`href="${page.path}"`));
  }
  onPages.push({ ...page, expectedKeys: (await shareKeys(page.keys)).filter((key) => key !== 'ref').sort() });
}

const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 780, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1280, height: 900 },
];

async function open(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1,
    isMobile: !!viewport.isMobile, hasTouch: !!viewport.hasTouch, timezoneId: 'Europe/London', locale: 'en-GB', reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    window.__cls = 0;
    window.__shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__cls += entry.value;
        window.__shifts.push({ value: entry.value, sources: entry.sources?.map((source) => source.node?.outerHTML?.slice(0, 160)) });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const tab = await context.newPage();
  const requests = [];
  tab.on('request', (request) => requests.push(`${request.url()} ${request.postData() ?? ''}`));
  const errors = [];
  tab.on('pageerror', (error) => errors.push(String(error)));
  return { context, tab, requests, errors };
}
const settle = (tab) => tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 1500)))));
const cls = (tab) => tab.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts }));

if (onPages.length) {
  await withPreview({ port: Number(process.env.PERSONAL_PAGES_PORT ?? 4381) }, async (base) => {
    const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
    try {
      for (const page of onPages) {
        for (const viewport of VIEWPORTS) {
          const label = `${page.path} @${viewport.width}`;
          let session = await open(browser, viewport);
          await session.tab.goto(`${base}${page.path}`, { waitUntil: 'networkidle' });
          await settle(session.tab);
          let load = await cls(session.tab);
          if (load.cls !== 0) {
            // One rerun for a micro-shift flake; a second shift is real.
            console.log(`rerun ${label}: first load shifted ${load.cls}`);
            await session.context.close();
            session = await open(browser, viewport);
            await session.tab.goto(`${base}${page.path}`, { waitUntil: 'networkidle' });
            await settle(session.tab);
            load = await cls(session.tab);
          }
          const { context, tab, requests, errors } = session;
          check(`${label}: first load has zero CLS`, load.cls === 0, JSON.stringify(load));

          const before = tab.url();
          const selector = await page.run(tab);
          await settle(tab);
          check(`${label}: the address bar is unchanged after the result`, tab.url() === before, tab.url());
          const leaked = requests.filter((line) => line.includes(BIRTH.date) || line.includes('1990'));
          check(`${label}: no request carries the birth date`, leaked.length === 0, leaked.join('\n'));

          const hrefs = await tab.locator(selector).evaluateAll((links) => links.map((link) => link.getAttribute('href')));
          check(`${label}: the result offers a share link`, hrefs.length > 0);
          for (const href of hrefs) {
            const url = new URL(href, base);
            const keys = [...url.searchParams.keys()];
            check(`${label}: share link ${href} goes to ${page.sharePath}`, url.pathname === page.sharePath, url.pathname);
            check(`${label}: share link ${href} carries exactly ${page.expectedKeys.join(', ')}`,
              new Set(keys).size === keys.length && JSON.stringify([...keys].sort()) === JSON.stringify(page.expectedKeys), keys.join(', '));
            check(`${label}: share link ${href} carries no birth detail`, !BIRTH_DETAIL.test(url.search));
          }
          const overflow = await tab.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
          check(`${label}: no horizontal scroll`, !overflow);
          check(`${label}: no page errors`, errors.length === 0, errors.join('\n'));
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
}

console.log(failures.length ? `personal pages drive: ${failures.length} failure(s)` : 'personal pages drive: PASS');
process.exit(failures.length ? 1 : 0);
