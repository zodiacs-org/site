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
 * This branch carries only its own page (Retrogrades for you); a page whose source is not in src/pages is skipped.
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
    path: '/retrogrades/for-you/',
    flag: 'PUBLIC_RETROGRADES_FOR_YOU_ENABLED',
    source: 'src/pages/retrogrades/for-you/index.astro',
    keys: { file: 'src/lib/retrograde-for-you/share.ts', name: 'RETROGRADE_FOR_YOU_SHARE_KEYS' },
    sharePath: '/share/retrograde-for-you/',
    linkedFrom: ['/', '/tools/', '/retrogrades/', '/mercury-retrograde/'],
    async run(tab) {
      // Every request address, to check no request depends on the date or the place entered.
      const addresses = [];
      tab.on('request', (request) => addresses.push(request.url()));
      // The calendar module loads with the page, so a date before 1924 asks for nothing a later date does not.
      const loaded = await tab.evaluate(() => performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname));
      check('the calendar module loads with the page, before any date', loaded.some((path) => /\/_astro\/BirthCalendar[.-]/u.test(path)), loaded.join(', '));
      const afterDate = async (date) => {
        const from = addresses.length;
        await tab.fill('#rfy-date', date);
        await settle(tab);
        return addresses.slice(from);
      };
      // A date under 13 keeps the birth time and birthplace locked, with no birthplace search to send a request.
      await afterDate('2020-01-01');
      check('an under-13 date locks the birth time', await tab.locator('#rfy-time').isDisabled());
      check('an under-13 date offers no birthplace search', (await tab.locator('#rfy-place[role="combobox"]').count()) === 0 && await tab.locator('#rfy-place').isDisabled());
      const early = await afterDate('1920-05-03');
      check('a date before 1924 asks for no file', early.length === 0, early.join('\n'));
      const modern = await afterDate(BIRTH.date);
      check('a date after 1924 asks for no file', modern.length === 0, modern.join('\n'));
      await tab.fill('#rfy-time', BIRTH.time);
      await choosePlace(tab, 'rfy-place', BIRTH.place);
      await tab.getByRole('button', { name: 'Show my retrogrades' }).click();
      await tab.locator('.rfy__share-link').first().waitFor({ state: 'visible', timeout: 60_000 });
      // The birthplace search asks for the whole city index, the same files whatever is typed.
      const index = JSON.parse(await readFile(resolve(projectRoot, 'dist/data/cities/index.json'), 'utf8'));
      const whole = ['/data/cities/index.json', ...index.shards.map((key) => `/data/cities/${key}.json`)].sort();
      const cities = [...new Set(addresses.map((address) => new URL(address)).filter((url) => url.pathname.startsWith('/data/cities/')).map((url) => `${url.pathname}${url.search}`))].sort();
      check('the birthplace search requests the whole city index, the same files whatever is typed', JSON.stringify(cities) === JSON.stringify(whole), cities.join(', '));
      const typed = addresses.filter((address) => /london/iu.test(address));
      check('no request carries the place typed into the search', typed.length === 0, typed.join('\n'));
      // A 1990 birth needs no zone history file, yet the page asks for the whole set, as it does for any birth.
      const paths = addresses.map((address) => new URL(address).pathname);
      const builtHistories = (await readdir(resolve(projectRoot, 'dist/_astro'))).map((name) => `/_astro/${name}`).filter((path) => ZONE_HISTORY_FILE.test(path)).sort();
      const asked = [...new Set(paths.filter((path) => ZONE_HISTORY_FILE.test(path)))].sort();
      check('the page asks for every zone history file, whatever the birth', builtHistories.length === 16 && JSON.stringify(asked) === JSON.stringify(builtHistories), asked.join(', '));
      return '.rfy__share-link';
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
