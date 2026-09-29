import { mkdir, readFile, copyFile } from 'node:fs/promises';

const chart = {
  id: 'audit-itinerary-known', name: 'Private fixture name',
  createdAt: '2026-09-07T00:00:00Z', updatedAt: '2026-09-07T00:00:00Z',
  birth: { date: '1990-02-01', time: '06:00', timeKnown: true,
    place: { name: 'Mexico City', country: 'MX', admin1: 'CDMX', lat: 19.4326, lon: -99.1332, tz: 'America/Mexico_City' } },
  summary: { engineVersion: 'deliberately-stale-fixture', utcISO: '1990-02-01T12:00:00Z', houseSystem: 'whole',
    bodies: [{ body: 'Sun', lon: 0, retrograde: false }, { body: 'Moon', lon: 0, retrograde: false }],
    angles: { asc: 0, mc: 0 }, flags: [] },
};
const profile = { version: 1, settings: { houseSystem: 'whole' }, charts: [chart,
  { ...chart, id: 'audit-itinerary-unknown', name: 'Unknown fixture', birth: { ...chart.birth, timeKnown: false, time: null } },
  { ...chart, id: 'audit-itinerary-unverified', name: 'Unverified fixture', birth: { ...chart.birth, place: null } },
  { ...chart, id: 'audit-itinerary-ambiguous', name: 'Ambiguous fixture', birth: { date: '2025-11-02', time: '01:30', timeKnown: true,
    place: { name: 'New York', country: 'US', admin1: 'NY', lat: 40.7128, lon: -74.006, tz: 'America/New_York' } } },
] };

export async function runTransitItineraryChecks({ browser, baseURL, check, outDir }) {
  if (outDir) await mkdir(outDir, { recursive: true });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', acceptDownloads: true, serviceWorkers: 'block' });
    await context.addInitScript((value) => {
      if (location.protocol === 'http:' || location.protocol === 'https:') localStorage.setItem('zodiacs.profile.v1', JSON.stringify(value));
    }, profile);
    try {
      const page = await context.newPage(); const errors = []; const fetched = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => fetched.push(response.url()));
      await page.goto(`${baseURL}/transits/?at=2026-01-01T00%3A00%3A00.000Z`, { waitUntil: 'domcontentloaded' });
      await page.locator('#trans-source').selectOption(chart.id);
      await page.locator('.calc__submit').click(); await page.locator('.tring').waitFor({ timeout: 30_000 });
      check(`itinerary ${width}: code stays lazy before expansion`, !fetched.some((url) => /TransitItinerary[.-]/.test(url)));
      const host = page.locator('[data-transit-itinerary-host]');
      await host.locator('summary').focus(); await page.keyboard.press('Enter');
      const itinerary = page.locator('[data-transit-itinerary]');
      await itinerary.getByRole('button', { name: 'Build my itinerary', exact: true }).click();
      await itinerary.getByText('Your itinerary is ready.', { exact: true }).waitFor({ timeout: 45_000 });
      check(`itinerary ${width}: active, next and upcoming sections render`,
        await itinerary.getByRole('region', { name: 'Active periods', exact: true }).count() === 1
        && await itinerary.getByRole('region', { name: 'Next period', exact: true }).count() === 1
        && await itinerary.locator('[data-itinerary-period]').count() > 0);
      check(`itinerary ${width}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (outDir) { await itinerary.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${outDir}/itinerary-known-${width}.png` }); }
      const pending = page.waitForEvent('download');
      await itinerary.getByRole('button', { name: /^Calendar for \d+ periods$/ }).click();
      const download = await pending; const path = await download.path(); const calendar = await readFile(path, 'utf8');
      check(`itinerary ${width}: genuine calendar contains periods without birth details`, calendar.includes('BEGIN:VEVENT')
        && calendar.includes('DTEND:') && !calendar.includes('DURATION:PT1M')
        && !['Private fixture name', '1990-02-01', '19.4326', '-99.1332', chart.id].some((value) => calendar.includes(value)));
      if (outDir) await copyFile(path, `${outDir}/itinerary-known-${width}.ics`);
      const EXACT_NOTE = 'The times in the file come from your exact chart';
      const NOON_NOTE = 'Without a birth time, the times in the file come from your chart for noon at your birthplace';
      check(`itinerary ${width}: the calendar note says the file's times come from the exact chart`,
        (await itinerary.locator('[data-itinerary-calendar-note]').innerText()).startsWith(EXACT_NOTE));
      for (const id of ['audit-itinerary-unknown', 'audit-itinerary-unverified', 'audit-itinerary-ambiguous']) {
        await page.locator('#trans-source').selectOption(id);
        check(`itinerary ${width}: source replacement clears old results`, await page.locator('[data-transit-itinerary]').count() === 0);
        await page.locator('.calc__submit').click(); await page.locator('.tring').waitFor({ timeout: 30_000 });
        await page.locator('[data-transit-itinerary-host] summary').click();
        await itinerary.getByRole('button', { name: 'Build my itinerary', exact: true }).click();
        await itinerary.getByText('Your itinerary is ready.', { exact: true }).waitFor({ timeout: 45_000 });
        const headings = await itinerary.locator('h4').allTextContents();
        check(`itinerary ${width}: ${id} excludes Moon and angles`, !headings.some((text) => /your (?:Moon|ASC|MC|rising sign|Midheaven)\b/.test(text)));
        // Without a birth time the chart is noon at the birthplace, which the note names.
        const note = await itinerary.locator('[data-itinerary-calendar-note]').innerText();
        check(`itinerary ${width}: ${id} calendar note names where its times come from`,
          note.startsWith(id === 'audit-itinerary-unknown' ? NOON_NOTE : EXACT_NOTE), note);
      }
      if (outDir) { await itinerary.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${outDir}/itinerary-reference-${width}.png` }); }
      // A real worker-load failure keeps the result page usable and offers retry.
      // Block the actual network request; a site service-worker cache must not
      // silently satisfy the request this failure scenario intends to reject.
      let blockedWorkers = 0;
      await context.route(/TransitItinerary\.worker[^/]*\.js/, (route) => { blockedWorkers += 1; return route.abort(); });
      await itinerary.getByRole('button', { name: 'Rebuild itinerary', exact: true }).click();
      await itinerary.getByRole('alert').waitFor({ timeout: 15_000 });
      check(`itinerary ${width}: failure exercised a real rejected worker request`, blockedWorkers > 0);
      check(`itinerary ${width}: worker failure clears stale calendar`, await itinerary.getByRole('button', { name: /^Calendar for/ }).count() === 0);
      await context.unroute(/TransitItinerary\.worker[^/]*\.js/);
      await itinerary.getByRole('button', { name: 'Build my itinerary', exact: true }).click();
      await itinerary.getByText('Your itinerary is ready.', { exact: true }).waitFor({ timeout: 45_000 });
      check(`itinerary ${width}: retry recovers with no page exceptions`, errors.length === 0, errors.join('; '));
    } finally { await context.close(); }
  }
}
