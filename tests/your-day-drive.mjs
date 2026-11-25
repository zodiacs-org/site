/**
 * The personal tool pages behind their launch switches (src/lib/launch-flags.ts), against the built site
 * (npm run build first, with the same switches in the shell as this run):
 *
 * - switch off: the page is the redirect to the 404 page, and no page that links to it on launch (the tools hub,
 *   the home page's Tools menu, the pages its pull request linked from) and no sitemap row leads to it;
 * - switch on, at 360px and 1280px: the page loads with zero layout shift (one rerun, as AGENTS.md allows for a
 *   micro-shift flake; a second shift fails), and again at 360px and 768px on a device whose zone has a long name
 *   (America/Argentina/Rio_Gallegos) that the page fills in after load, with the name shown whole; a fixed adult
 *   birth gives a result without changing the address
 *   bar or sending the birth date anywhere, and every share link on the result carries exactly the tool's
 *   *_SHARE_KEYS (without `ref`, which only the assistant adds), each once, and no birth detail.
 *
 * This branch carries only its own page (Your day); a page whose source is not in src/pages is skipped.
 *
 *   npm run build && node tests/personal-pages-drive.mjs
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { projectRoot, withPreview } from './visual/preview-server.mjs';

/** A fixed adult birth: a date, a clock time and a place the place search finds. */
const BIRTH = { date: '1990-05-03', time: '08:30', place: 'London' };
const BIRTH_DETAIL = /1990|05-03|0503|08:30|0830|london|51\.5|-0\.1/iu;

async function choosePlace(tab, id, query) {
  await tab.locator(`#${id}`).fill(query);
  const option = tab.locator(`#${id}-list [role="option"]:not([aria-disabled="true"])`).first();
  await option.waitFor({ state: 'visible', timeout: 30_000 });
  await option.click();
}

const ALL_PAGES = [
  {
    path: '/your-day/',
    flag: 'PUBLIC_YOUR_DAY_ENABLED',
    source: 'src/pages/your-day/index.astro',
    keys: { file: 'src/lib/personal-day/share.ts', name: 'YOUR_DAY_SHARE_KEYS' },
    sharePath: '/share/your-day/',
    linkedFrom: ['/', '/tools/', '/today/', '/transits/', '/horoscopes/'],
    /** The device-clock line the page fills in after load, and the zone name it must show whole. */
    zoneLabel: { selector: '.yd__clock', shows: 'America/Argentina/Rio Gallegos' },
    async run(tab) {
      // A date under 13 keeps the birth time and birthplace locked, with no birthplace search to send a request.
      await tab.fill('#yd-date', '2020-01-01');
      check('an under-13 date locks the birth time', await tab.locator('#yd-time').isDisabled());
      check('an under-13 date offers no birthplace search', (await tab.locator('#yd-place[role="combobox"]').count()) === 0 && await tab.locator('#yd-place').isDisabled());
      await tab.fill('#yd-date', BIRTH.date);
      await tab.fill('#yd-time', BIRTH.time);
      await choosePlace(tab, 'yd-place', BIRTH.place);
      await tab.getByRole('button', { name: 'Read my day' }).click();
      await tab.locator('[data-your-day-share]').first().waitFor({ state: 'visible', timeout: 60_000 });
      return '[data-your-day-share]';
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
    check(`switch off: ${page.path} is the redirect to the 404 page`, /http-equiv="refresh"[^>]*\/404\.html/u.test(html), String(html.length));
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

/** Devices on a zone with a long name, filled in after load: the reserved space must hold it at these widths. */
const LONG_ZONE = 'America/Argentina/Rio_Gallegos';
const LONG_ZONE_VIEWPORTS = [
  { name: 'mobile', width: 360, height: 780, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 768, height: 1024 },
];

async function open(browser, viewport, timezoneId = 'Europe/London') {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1,
    isMobile: !!viewport.isMobile, hasTouch: !!viewport.hasTouch, timezoneId, locale: 'en-GB', reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const tab = await context.newPage();
  const counts = { birthRequests: 0, errors: 0 };
  tab.on('request', (request) => {
    const line = request.url() + ' ' + (request.postData() ?? '');
    if (line.includes(BIRTH.date) || line.includes('1990')) counts.birthRequests++;
  });
  tab.on('pageerror', () => { counts.errors++; });
  return { context, tab, counts };
}
const settle = (tab) => tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 1500)))));
const cls = (tab) => tab.evaluate(() => ({ cls: window.__cls }));

if (onPages.length) {
  await withPreview({ port: Number(process.env.PERSONAL_PAGES_PORT ?? 4381) }, async (base) => {
    const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
    try {
      for (const page of onPages.filter((entry) => entry.zoneLabel)) {
        for (const viewport of LONG_ZONE_VIEWPORTS) {
          const label = `${page.path} @${viewport.width} on ${LONG_ZONE}`;
          let session = await open(browser, viewport, LONG_ZONE);
          await session.tab.goto(`${base}${page.path}`, { waitUntil: 'networkidle' });
          await settle(session.tab);
          let load = await cls(session.tab);
          if (load.cls !== 0) {
            console.log(`rerun ${label}: first load shifted ${load.cls}`);
            await session.context.close();
            session = await open(browser, viewport, LONG_ZONE);
            await session.tab.goto(`${base}${page.path}`, { waitUntil: 'networkidle' });
            await settle(session.tab);
            load = await cls(session.tab);
          }
          check(`${label}: first load has zero CLS`, load.cls === 0, JSON.stringify(load));
          const zone = await session.tab.locator(page.zoneLabel.selector).evaluate((node) => ({
            text: node.textContent, whole: node.scrollHeight <= node.clientHeight + 1,
          }));
          check(`${label}: the clock line names the zone`, zone.text.includes(page.zoneLabel.shows));
          check(`${label}: the zone name is shown whole in the reserved space`, zone.whole);
          check(`${label}: no page errors`, session.counts.errors === 0, String(session.counts.errors));
          await session.context.close();
        }
      }
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
          const { context, tab, counts } = session;
          check(`${label}: first load has zero CLS`, load.cls === 0, JSON.stringify(load));

          const before = tab.url();
          const selector = await page.run(tab).catch(() => { throw new Error('The personal day interaction did not finish.'); });
          await settle(tab);
          check(`${label}: the address bar is unchanged after the result`, tab.url() === before);
          check(`${label}: no request carries the birth date`, counts.birthRequests === 0, String(counts.birthRequests));

          const hrefs = await tab.locator(selector).evaluateAll((links) => links.map((link) => link.getAttribute('href')));
          check(`${label}: the result offers a share link`, hrefs.length > 0);
          for (const href of hrefs) {
            const url = new URL(href, base);
            const keys = [...url.searchParams.keys()];
            check(`${label}: share link goes to ${page.sharePath}`, url.pathname === page.sharePath);
            check(`${label}: share link carries exactly ${page.expectedKeys.join(', ')}`,
              new Set(keys).size === keys.length && JSON.stringify([...keys].sort()) === JSON.stringify(page.expectedKeys), String(keys.length));
            check(`${label}: share link carries no birth detail`, !BIRTH_DETAIL.test(url.search));
          }
          const overflow = await tab.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
          check(`${label}: no horizontal scroll`, !overflow);
          check(`${label}: no page errors`, counts.errors === 0, String(counts.errors));
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
