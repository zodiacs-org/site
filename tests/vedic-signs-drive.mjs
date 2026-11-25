/**
 * The personal tool pages behind their launch switches (src/lib/launch-flags.ts), against the built site
 * (npm run build first, with the same switches in the shell as this run):
 *
 * - switch off: the page is the redirect to the 404 page, and no page that links to it on launch (the tools hub,
 *   the home page's Tools menu, the pages its pull request linked from) and no sitemap row leads to it;
 * - switch on, at 360px and 1280px: the page loads with zero layout shift (one rerun, as AGENTS.md allows for a
 *   micro-shift flake; a second shift fails), a fixed adult birth gives a result without changing the address
 *   bar or sending the birth date anywhere, and every share link on the result carries exactly the tool's
 *   *_SHARE_KEYS (without `ref`, which only the assistant adds), each once, and no birth detail. A page that
 *   lists `privateRequests` is also held to them: no request carries the birth time, the chosen birthplace's full
 *   name or its coordinates, and a second, different birth in a fresh browser asks for the same sign pictures,
 *   so the requests do not tell the host which signs a reading shows.
 *
 * The page with `privateRequests` is also held to files that do not depend on the birth: its birthplace search asks
 * for the whole city index, and it asks for all sixteen zone history files, for a 1990 birth and a 1915 one alike.
 *
 * A page whose source is not in src/pages is skipped.
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
/** A second adult birth whose Sun, Moon and rising signs all differ from the first's. */
const OTHER_BIRTH = { date: '1985-11-20', time: '14:15', place: 'Mumbai' };
/**
 * A birth from before 1970, in another zone and under another letter: the resolver reads its zone's history, so the
 * requests would differ from a 1990 birth's if the page asked only for the history files a birth needs.
 */
const HISTORICAL_BIRTH = { date: '1915-11-02', time: '09:00', place: 'Accra' };
/** The engine's zone history files as the built site serves them. */
const ZONE_HISTORY_FILE = /\/_astro\/tzdb-\d{4}[a-z]-\d{2}-/u;

/** Chooses the first place the search offers, and returns its name, region and country as the option shows them. */
async function choosePlace(tab, id, query) {
  await tab.locator(`#${id}`).fill(query);
  const option = tab.locator(`#${id}-list [role="option"]:not([aria-disabled="true"])`).first();
  await option.waitFor({ state: 'visible', timeout: 30_000 });
  const name = (await option.locator('.place__name').textContent())?.trim() ?? '';
  const meta = (await option.locator('.place__meta').textContent())?.trim() ?? '';
  await option.click();
  return { name, meta };
}

/** The ways a request could carry one birth: its date, its clock time, and the chosen place's name and coordinates. */
function birthLeaks(birth, place) {
  const [year, month, day] = birth.date.split('-');
  const time = birth.time;
  const coordinates = place.coordinates ?? [];
  return [
    birth.date, `${month}-${day}`, year,
    time, time.replace(':', ''), encodeURIComponent(time),
    place.name, encodeURIComponent(place.name), `${place.name}, ${place.meta}`, encodeURIComponent(`${place.name}, ${place.meta}`),
    ...coordinates.flatMap((value) => [value.toFixed(2), String(value)]),
  ].filter(Boolean);
}

const ALL_PAGES = [
  {
    path: '/vedic-signs/',
    flag: 'PUBLIC_VEDIC_SIGNS_ENABLED',
    source: 'src/pages/vedic-signs/index.astro',
    keys: { file: 'src/lib/vedic-signs/share.ts', name: 'VEDIC_SIGNS_SHARE_KEYS' },
    sharePath: '/share/vedic-signs/',
    linkedFrom: ['/', '/tools/', '/big-three/', '/moon-sign/'],
    // The sign pictures the result shows (src/lib/sign-icon.ts asks for all twelve of a size).
    privateRequests: { signPictures: /\/assets\/zodiac-icons\//u, result: '.vedic__result' },
    async run(tab, birth = BIRTH, first = true) {
      if (first) {
        const addresses = [];
        tab.on('request', (request) => addresses.push(request.url()));
        const afterDate = async (date) => {
          const from = addresses.length;
          await tab.fill('#vedic-date', date);
          await settle(tab);
          return addresses.slice(from);
        };
        // A date under 13 keeps the birth time and birthplace locked, with no birthplace search to send a request.
        await afterDate('2020-01-01');
        check('an under-13 date locks the birth time', await tab.locator('#vedic-time').isDisabled());
        check('an under-13 date offers no birthplace search', (await tab.locator('#vedic-place[role="combobox"]').count()) === 0 && await tab.locator('#vedic-place').isDisabled());
        // The calendar module loads with the fields, so a date before 1924 asks for nothing a later date does not.
        const early = await afterDate('1920-05-03');
        check('a date before 1924 asks for no file', early.length === 0, early.join('\n'));
      }
      await tab.fill('#vedic-date', birth.date);
      await tab.fill('#vedic-time', birth.time);
      const place = await choosePlace(tab, 'vedic-place', birth.place);
      // The sidereal half runs in the page's worker.
      await tab.getByRole('button', { name: 'Find my Vedic signs' }).click();
      await tab.locator('.vedic__share a[href^="/share/vedic-signs/"]').first().waitFor({ state: 'visible', timeout: 60_000 });
      return { selector: '.vedic__share a[href^="/share/vedic-signs/"]', place };
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
  // The birthplace index and shards the place search loaded, to find the chosen place's coordinates.
  const cities = { index: null, rows: [] };
  tab.on('response', async (response) => {
    const path = new URL(response.url()).pathname;
    if (!path.startsWith('/data/cities/') || !response.ok()) return;
    const body = await response.json().catch(() => null);
    if (path === '/data/cities/index.json') cities.index = body;
    else if (Array.isArray(body)) cities.rows.push(...body);
  });
  const errors = [];
  tab.on('pageerror', (error) => errors.push(String(error)));
  return { context, tab, requests, errors, cities };
}

/** The chosen place's coordinates, as the place search gives them (two decimals), from the rows it loaded. */
function placeCoordinates(cities, place) {
  if (!cities.index) return null;
  const row = cities.rows.find((r) => r[0] === place.name
    && [cities.index.admin1[r[2]], cities.index.countries[r[3]]].filter(Boolean).join(', ') === place.meta);
  return row ? [row[4] / 100, row[5] / 100] : null;
}

/**
 * The files a reading asked for that could depend on a birth: the city index files, and the engine's zone history
 * files. Both must be the same for every birth (the whole city index, and all sixteen history files).
 */
function birthDependentFiles(requests) {
  const paths = [...new Set(requests.map((line) => new URL(line.split(' ')[0]).pathname))];
  return {
    cities: paths.filter((path) => path.startsWith('/data/cities/')).sort(),
    histories: paths.filter((path) => ZONE_HISTORY_FILE.test(path)).sort(),
  };
}

/** One more reading in a fresh browser context: the requests it sent and the result's text. */
async function otherReading(browser, viewport, base, page, birth) {
  const { context, tab, requests, cities } = await open(browser, viewport);
  try {
    await tab.goto(`${base}${page.path}`, { waitUntil: 'networkidle' });
    const { place } = await page.run(tab, birth, false);
    await settle(tab);
    place.coordinates = placeCoordinates(cities, place);
    return { requests: [...requests], place, text: await tab.locator(page.privateRequests.result).innerText() };
  } finally {
    await context.close();
  }
}
const signPictureRequests = (requests, pattern) => requests.map((line) => line.split(' ')[0]).filter((url) => pattern.test(url)).map((url) => new URL(url).pathname).sort();
const leaksIn = (requests, needles) => requests.filter((line) => needles.some((needle) => line.toLowerCase().includes(needle.toLowerCase())));
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
          const { context, tab, requests, errors, cities } = session;
          check(`${label}: first load has zero CLS`, load.cls === 0, JSON.stringify(load));

          const before = tab.url();
          const { selector, place } = await page.run(tab);
          await settle(tab);
          check(`${label}: the address bar is unchanged after the result`, tab.url() === before, tab.url());
          // Only a count, so a privacy regression cannot write a birth detail to the test log.
          const leaked = requests.filter((line) => line.includes(BIRTH.date) || line.includes(BIRTH.date.slice(0, 4))).length;
          check(`${label}: no request carries the birth date`, leaked === 0, `${leaked} request(s)`);
          if (page.privateRequests) {
            place.coordinates = placeCoordinates(cities, place);
            check(`${label}: the chosen birthplace's coordinates are known to the drive`, place.coordinates !== null, JSON.stringify(place));
            const needles = birthLeaks(BIRTH, place);
            const carried = leaksIn(requests, needles);
            check(`${label}: no request carries the birth time, the birthplace's full name or its coordinates`, carried.length === 0, `${needles.join(' | ')}\n${carried.join('\n')}`);
            const pictures = signPictureRequests(requests, page.privateRequests.signPictures);
            check(`${label}: the result asked for sign pictures`, pictures.length > 0);
            const firstText = await tab.locator(page.privateRequests.result).innerText();
            const other = await otherReading(browser, viewport, base, page, OTHER_BIRTH);
            check(`${label}: the second birth gives a different reading`, other.text !== firstText);
            const otherNeedles = birthLeaks(OTHER_BIRTH, other.place);
            const otherCarried = leaksIn(other.requests, otherNeedles);
            check(`${label}: the second birth's coordinates are known to the drive`, other.place.coordinates !== null, JSON.stringify(other.place));
            check(`${label}: no request for the second birth carries its date, time, birthplace's full name or coordinates`, otherCarried.length === 0, `${otherNeedles.join(' | ')}\n${otherCarried.join('\n')}`);
            const otherPictures = signPictureRequests(other.requests, page.privateRequests.signPictures);
            check(`${label}: both readings ask for the same sign pictures`, JSON.stringify(pictures) === JSON.stringify(otherPictures), `${pictures.join(', ')}\nvs\n${otherPictures.join(', ')}`);
            // The birthplace search asks for the whole city index, and the page for every zone history file, whatever
            // the birth: a 1990 birth needs no history file, a 1915 one needs its zone's.
            const index = JSON.parse(await readFile(resolve(projectRoot, 'dist/data/cities/index.json'), 'utf8'));
            const wholeIndex = ['/data/cities/index.json', ...index.shards.map((key) => `/data/cities/${key}.json`)].sort();
            const builtHistories = (await readdir(resolve(projectRoot, 'dist/_astro'))).map((name) => `/_astro/${name}`).filter((path) => ZONE_HISTORY_FILE.test(path)).sort();
            const files = birthDependentFiles(requests);
            check(`${label}: the birthplace search requests the whole city index`, JSON.stringify(files.cities) === JSON.stringify(wholeIndex), files.cities.join(', '));
            check(`${label}: the page asks for every zone history file for a 1990 birth`, builtHistories.length === 16 && JSON.stringify(files.histories) === JSON.stringify(builtHistories), files.histories.join(', '));
            const historical = await otherReading(browser, viewport, base, page, HISTORICAL_BIRTH);
            const historicalNeedles = birthLeaks(HISTORICAL_BIRTH, historical.place);
            const historicalCarried = leaksIn(historical.requests, historicalNeedles);
            check(`${label}: the historical birth's coordinates are known to the drive`, historical.place.coordinates !== null, JSON.stringify(historical.place));
            check(`${label}: no request for the historical birth carries its date, time, birthplace's full name or coordinates`, historicalCarried.length === 0, `${historicalNeedles.join(' | ')}\n${historicalCarried.join('\n')}`);
            for (const [name, reading] of [['the second birth', other], ['the 1915 birth', historical]]) {
              const theirs = birthDependentFiles(reading.requests);
              check(`${label}: ${name} asks for the same city and zone history files as the first`, JSON.stringify(theirs) === JSON.stringify(files), `${JSON.stringify(theirs)}\nvs\n${JSON.stringify(files)}`);
            }
          }

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
