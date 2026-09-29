/**
 * End-to-end drive for the lazy "Find a transit" search.
 *
 *   npm run build
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium \
 *     node tests/transit-search-drive.mjs
 */
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium';
const PORT = 4403;
const BASE = `http://127.0.0.1:${PORT}`;
const FIXED_NOW = Date.parse('2022-07-13T00:00:00.000Z');
const fixture = JSON.parse(await readFile(new URL('../src/data/demo-chart-frida.json', import.meta.url), 'utf8'));

const profile = {
  version: 1,
  settings: { houseSystem: 'whole' },
  charts: [{
    id: 'drive-frida-search',
    name: 'Frida Kahlo',
    createdAt: '2022-07-13T00:00:00.000Z',
    updatedAt: '2022-07-13T00:00:00.000Z',
    birth: {
      date: '1907-07-06',
      time: '08:30',
      timeKnown: true,
      // No stored place forces TransitTracker to consume this exact canonical
      // summary rather than recomputing a rounded drive fixture.
      place: null,
    },
    summary: {
      engineVersion: '1.0.0',
      utcISO: fixture.utc,
      houseSystem: 'whole',
      bodies: fixture.bodies,
      angles: fixture.angles,
      flags: fixture.flags,
    },
  }],
};

const preview = spawn(
  process.execPath,
  ['node_modules/astro/bin/astro.mjs', 'preview', '--host', '127.0.0.1', '--port', String(PORT)],
  { stdio: 'ignore' },
);
await wait(2200);

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const privateValues = ['Frida', '1907-07-06', 'Coyoacán', '19.35', '-99.16'];

async function calendarFrom(page) {
  const pending = page.waitForEvent('download', { timeout: 15_000 });
  await page.locator('[data-search-calendar]').click();
  const download = await pending;
  const path = await download.path();
  return path ? readFile(path, 'utf8') : '';
}

async function waitForSearch(page, timeout = 120_000) {
  await page.waitForFunction(() => {
    const form = document.querySelector('.tsearch__form');
    return form?.getAttribute('aria-busy') === 'false'
      && document.querySelector('[data-search-results], .tsearch__empty, .calc__error');
  }, null, { timeout });
}

try {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const fetched = [];
  page.on('response', (response) => fetched.push(new URL(response.url()).pathname));
  await page.addInitScript(({ seededProfile, fixedNow }) => {
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify(seededProfile));
    globalThis.__transitSearchEvents = [];
    globalThis.zodiacsAnalytics = Object.freeze({
      track(name, props) { globalThis.__transitSearchEvents.push({ name, props }); },
    });
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixedNow])); }
      static now() { return fixedNow; }
    }
    globalThis.Date = FixedDate;
  }, { seededProfile: profile, fixedNow: FIXED_NOW });

  await page.goto(`${BASE}/transits/`, { waitUntil: 'networkidle' });
  const host = page.locator('[data-transit-search-host]');
  check('search host starts collapsed', !(await host.getAttribute('open')));
  check('lazy search code is absent before expansion', !fetched.some((path) => /TransitSearch\./.test(path)));

  await host.locator('summary').click();
  await page.waitForSelector('[data-transit-search]', { timeout: 15_000 });
  check('search module fetches on first expansion', fetched.some((path) => /TransitSearch\./.test(path)));
  check('worker is still absent before the first run', !fetched.some((path) => /TransitSearch\.worker/.test(path)));
  check('run stays disabled until a chart is loaded', await page.locator('[data-search-run]').isDisabled());
  check('all Sun-through-Pluto chips exist, including Moon',
    (await page.locator('[data-search-body]').count()) === 10
      && (await page.locator('[data-search-body="Moon"]').count()) === 1);

  await page.locator('.calc__submit').click();
  await page.waitForSelector('.tring', { timeout: 20_000 });
  await page.waitForSelector('[data-search-run]:not([disabled])', { timeout: 10_000 });
  await page.locator('[data-search-natal-point]').selectOption('ASC');
  await page.locator('[data-search-span="10y"]').click();

  // Default slow set: runtime evidence + slow analytics classification.
  const defaultPressed = await page.locator('[data-search-body][aria-pressed="true"]').allTextContents();
  check('default body set is Jupiter through Pluto',
    defaultPressed.join(',') === 'Jupiter,Saturn,Uranus,Neptune,Pluto', defaultPressed.join(','));
  const slowStarted = performance.now();
  await page.locator('[data-search-run]').click();
  await waitForSearch(page);
  const slowRuntimeMs = Math.round(performance.now() - slowStarted);
  check('10-year slow-set search returns contacts', (await page.locator('[data-search-contact]').count()) > 0,
    `${slowRuntimeMs} ms`);
  check('dedicated worker loads only after run', fetched.some((path) => /TransitSearch\.worker/.test(path)));

  // Saturn → natal ASC opposition: pin the canonical Kahlo three-pass loop.
  for (const body of ['Jupiter', 'Uranus', 'Neptune', 'Pluto']) {
    await page.locator(`[data-search-body="${body}"]`).click();
  }
  await page.locator('[data-search-aspect]').selectOption('opposition');
  await page.locator('[data-search-run]').click();
  await waitForSearch(page);
  const triplet = page.locator('[data-search-contact="Saturn|opposition|ASC"]');
  const tripletDates = (await triplet.evaluateAll((rows) => rows.map((row) =>
    row.getAttribute('data-search-exact')?.slice(0, 10)))).filter(Boolean);
  check('Kahlo Saturn–ASC opposition keeps the three exact passes',
    JSON.stringify(tripletDates) === JSON.stringify(['2022-04-19', '2022-07-23', '2023-01-11']),
    tripletDates.join(', '));
  check('each Kahlo opposition row reports Pass n of 3',
    (await triplet.evaluateAll((rows) => rows.every((row) => row.getAttribute('data-search-pass-count') === '3'))));

  const firstTriplet = triplet.first();
  const requestedInstant = await firstTriplet.getAttribute('data-search-exact');
  await firstTriplet.locator('[data-search-show-ring]').click();
  await page.waitForFunction((instant) =>
    document.querySelector('[data-ring-instant]')?.getAttribute('data-ring-instant') === instant,
  requestedInstant, { timeout: 5000 });
  check('Show on ring preserves the exact fractional UTC instant',
    (await page.locator('[data-ring-instant]').getAttribute('data-ring-instant')) === requestedInstant,
    requestedInstant ?? 'missing instant');
  check('ASC focus draws a module-local chord',
    (await page.locator('[data-transit-angle-aspect="Saturn-opposition-ASC"]').count()) === 1);
  check('ASC focus exposes an accessible receipt',
    (await page.locator('[data-transit-angle-focus]').count()) === 1);

  const tripletCalendar = await calendarFrom(page);
  check('triplet calendar has one VEVENT per pass',
    (tripletCalendar.match(/BEGIN:VEVENT/g) ?? []).length === 3);
  check('calendar contains positions-only contact copy and no birth data',
    tripletCalendar.includes('Transiting Saturn opposition natal ASC')
      && privateValues.every((value) => !tripletCalendar.includes(value)));
  // The file keeps exact times, which the note beside its button says; its
  // UIDs are hashes of what each event shows, with no time in them.
  const tripletUids = tripletCalendar.split('\r\n').filter((line) => line.startsWith('UID:'));
  check('calendar UIDs carry no time', tripletUids.length === 3
    && tripletUids.every((line) => /^UID:transit-[0-9a-f]{16}@zodiacs\.org$/u.test(line)), tripletUids.join(' '));
  check('calendar keeps each contact to the second', (tripletCalendar.match(/DTSTART:\d{8}T\d{6}Z/gu) ?? []).length === 3);
  check('the note beside the calendar button says its times come from the exact chart',
    (await page.locator('[data-search-calendar-note]').innerText()).startsWith('The times in the file come from your exact chart'));

  // Moon stays out of the standing active-transit list, but a search request
  // must still bridge into one local focused chord and receipt.
  await page.locator('[data-search-body="Saturn"]').click();
  await page.locator('[data-search-body="Moon"]').click();
  await page.locator('[data-search-natal-point]').selectOption('Sun');
  await page.locator('[data-search-aspect]').selectOption('all');
  await page.locator('[data-search-span="1y"]').click();
  await page.locator('[data-search-run]').click();
  await waitForSearch(page);
  const moonContact = page.locator('[data-search-contact^="Moon|"]').filter({
    has: page.locator('[data-search-show-ring]'),
  }).first();
  const moonInstant = await moonContact.getAttribute('data-search-exact');
  await moonContact.locator('[data-search-show-ring]').click();
  await page.waitForFunction((instant) =>
    document.querySelector('[data-ring-instant]')?.getAttribute('data-ring-instant') === instant,
  moonInstant, { timeout: 5000 });
  check('Moon search focus keeps the exact ring instant',
    (await page.locator('[data-ring-instant]').getAttribute('data-ring-instant')) === moonInstant,
    moonInstant ?? 'missing instant');
  check('Moon search focus draws its own chord and receipt',
    (await page.locator('[data-transit-search-aspect^="Moon-"]').count()) === 1
      && (await page.locator('[data-transit-search-focus]').textContent())?.includes('Moon'));

  // All bodies, all aspects, ±10 years: record every sequential progress
  // update and prove the 200-row DOM cap does not cap the calendar payload.
  await page.evaluate(() => {
    globalThis.__transitSearchProgress = [];
    const root = document.querySelector('[data-transit-search]');
    const capture = () => {
      const text = root?.querySelector('.tsearch__status')?.textContent?.trim();
      if (text && !globalThis.__transitSearchProgress.includes(text)) {
        globalThis.__transitSearchProgress.push(text);
      }
    };
    new MutationObserver(capture).observe(root, { childList: true, subtree: true, characterData: true });
    capture();
  });
  for (const body of ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']) {
    await page.locator(`[data-search-body="${body}"]`).click();
  }
  await page.locator('[data-search-aspect]').selectOption('all');
  await page.locator('[data-search-span="10y"]').click();
  check('all ten bodies can be selected together',
    (await page.locator('[data-search-body][aria-pressed="true"]').count()) === 10);
  await page.locator('[data-search-run]').click();
  await waitForSearch(page);
  const progress = await page.evaluate(() => globalThis.__transitSearchProgress);
  check('worker scans one body at a time and includes Moon',
    progress.length === 10
      && progress[0] === 'Scanning Sun…'
      && progress[1] === 'Scanning Moon…'
      && progress.at(-1) === 'Scanning Pluto…',
    progress.join(' | '));

  const capText = await page.locator('[data-search-cap]').textContent();
  const total = Number(capText?.match(/first 200 of (\d+) contacts/)?.[1] ?? 0);
  check('all-body result renders the exact cap line',
    total > 200
      && capText === `Showing the first 200 of ${total} contacts — narrow the range or the bodies to see the rest.`,
    capText ?? 'missing cap');
  check('rendered rows stop at 200', (await page.locator('[data-search-contact]').count()) === 200);
  const fullCalendar = await calendarFrom(page);
  check('capped search calendar still exports every contact',
    (fullCalendar.match(/BEGIN:VEVENT/g) ?? []).length === total,
    `${(fullCalendar.match(/BEGIN:VEVENT/g) ?? []).length}/${total}`);
  check('full calendar remains birth-data free', privateValues.every((value) => !fullCalendar.includes(value)));

  const events = await page.evaluate(() => globalThis.__transitSearchEvents);
  check('every run emits the allowlisted analytics shape', JSON.stringify(events) === JSON.stringify([
    { name: 'transit_search', props: { span: '10y', bodies: 'slow' } },
    { name: 'transit_search', props: { span: '10y', bodies: 'custom' } },
    { name: 'transit_search', props: { span: '1y', bodies: 'custom' } },
    { name: 'transit_search', props: { span: '10y', bodies: 'custom' } },
  ]), JSON.stringify(events));

  await page.setViewportSize({ width: 320, height: 900 });
  check('320px result surface has no horizontal overflow', await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  `${await page.evaluate(() => document.documentElement.scrollWidth)}/320`);

  const spanish = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await spanish.goto(`${BASE}/es/transits/`, { waitUntil: 'networkidle' });
  check('EN-only v1 search does not leak English chrome onto Spanish',
    (await spanish.locator('[data-transit-search-host]').count()) === 0);
  await spanish.close();

  console.log(`RUNTIME  10y slow set · ${slowRuntimeMs} ms`);
  await page.close();
  await browser.close();
} finally {
  preview.kill();
}

let failed = 0;
for (const result of results) {
  if (!result.ok) failed += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? `  · ${result.detail}` : ''}`);
}
console.log(failed ? `\n${failed} FAILURES` : '\nALL PASS');
process.exit(failed ? 1 : 0);
