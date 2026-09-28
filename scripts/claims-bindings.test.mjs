import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventsCatalog } from '../src/lib/events/catalog.ts';
import { bodyLongitude } from '../src/lib/engine/full.ts';
import { solarReturnInstant } from '../src/lib/engine/solar-return.ts';
import { prepareLocalTime, resolveLocalToUtc } from '../src/lib/time/localToUtc.ts';

/*
 * Sentences that state a measured accuracy, held to the measurement behind
 * them. Each binding checks both halves: the sentence is on the page, and
 * the figure it states still covers what was measured.
 */
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const evidence = JSON.parse(read('docs/platform/evidence/events-vs-swiss-2026-09-25/deltas.json'));
const MINUTE = 60;
const HOUR = 3600;

// deltas.json keeps each event's id and published instant; its differences
// from Swiss were removed on 2026-09-28 (DECISIONS-2026-09-28 §3), leaving the
// summary statistics the copy is held to.
describe('event times against Swiss Ephemeris', () => {
  it('were measured on the catalog the site publishes now', () => {
    const published = eventsCatalog().events
      .map(({ facts }) => facts)
      .filter((facts) => facts.family !== 'retrograde' && facts.at)
      .map((facts) => `${facts.id} ${facts.at}`)
      .sort();
    const measured = evidence.deltas.map((row) => `${row.id} ${row.published}`).sort();
    // A regenerated catalog needs docs/platform/evidence/events-vs-swiss-*/tools run again.
    expect(published).toEqual(measured);
  });

  it('keep moons and eclipses within a minute, as the events hub and full-moon calendar say', () => {
    expect(evidence.summary.lunation.maxAbsSeconds).toBeLessThan(MINUTE);
    expect(evidence.summary.eclipse.maxAbsSeconds).toBeLessThan(MINUTE);
    expect(read('src/pages/full-moon-calendar/index.astro')).toContain('to within a minute, in universal time');
    expect(read('src/pages/full-moon-calendar/index.astro')).toContain('timed to within a minute through the end of 2027');
    expect(read('src/pages/events/index.astro')).toContain('and eclipses are timed to within a minute');
  });

  it('keep stations within about 40 minutes, and a few minutes on the retrograde pages', () => {
    expect(evidence.summary.station.maxAbsSeconds).toBeLessThan(45 * MINUTE);
    const byPlanet = evidence.summary.stationMaxAbsSecondsByPlanet;
    for (const planet of ['Mercury', 'Venus', 'Mars']) expect(byPlanet[planet]).toBeLessThan(10 * MINUTE);
    expect(read('src/pages/events/index.astro')).toContain('a station can be off by up to about 40 minutes');
    expect(read('src/components/events/EventFactsBand.astro'))
      .toContain('so these station times can be off by a few minutes.');
    expect(read('src/pages/mercury-retrograde/index.astro')).toContain('compute to within a few minutes');
  });

  it('keep slow sign changes and alignments within half an hour, or several hours with Uranus, Neptune or Pluto', () => {
    const slow = evidence.summary.slowEventMaxAbsSeconds;
    expect(slow['ingress of Jupiter and Saturn only']).toBeLessThan(35 * MINUTE);
    expect(slow['aspect of Jupiter and Saturn only']).toBeLessThan(35 * MINUTE);
    expect(slow['ingress with Uranus, Neptune or Pluto']).toBeLessThan(8 * HOUR);
    expect(slow['aspect with Uranus, Neptune or Pluto']).toBeLessThan(8 * HOUR);
    const band = read('src/components/events/EventFactsBand.astro');
    expect(band).toContain('this time can be off by up to about half an hour.');
    expect(band).toContain('so slowly that this time can be off by several hours.');
    expect(read('src/pages/events/index.astro')).toContain('Uranus, Neptune or Pluto by several hours');
  });
});

describe('the solar return with an unknown birth time', () => {
  it('can move by up to about 12 hours, as the page and the result notice say', () => {
    // The widest case of a 1930-2010 sweep of five zones: a birth at the start of the day.
    const date = '1958-10-15';
    const noon = resolveLocalToUtc(date, '12:00', 'Pacific/Pago_Pago').utc;
    const midnight = resolveLocalToUtc(date, '00:00', 'Pacific/Pago_Pago').utc;
    const near = new Date(Date.UTC(2026, 9, 15, 12));
    const shift = Math.abs(solarReturnInstant(bodyLongitude('Sun', midnight), near).getTime()
      - solarReturnInstant(bodyLongitude('Sun', noon), near).getTime()) / 3_600_000;
    expect(shift).toBeGreaterThan(11.5);
    expect(shift).toBeLessThan(12.5);
    expect(read('src/pages/solar-return/index.astro')).toContain('shift the return by up to about 12 hours');
    expect(read('src/islands/solar-return/copy.ts')).toContain('can shift by up to about 12 hours');
  });
});

describe('the NASA JPL Horizons figure', () => {
  it('is the largest residual of the reference values the engine test uses', () => {
    const reference = JSON.parse(read('src/lib/engine/fixtures/horizons-reference.json'));
    const wrap = (d) => ((d + 540) % 360) - 180;
    let largest = { arcseconds: 0, where: '' };
    for (const epoch of reference.epochs) {
      for (const [body, longitude] of Object.entries(epoch.longitudes)) {
        const arcseconds = Math.abs(wrap(bodyLongitude(body, new Date(epoch.utc)) - longitude)) * 3600;
        if (arcseconds > largest.arcseconds) largest = { arcseconds, where: `${body} ${epoch.utc.slice(0, 4)}` };
      }
    }
    expect(largest.where).toBe('Neptune 2020');
    expect(largest.arcseconds.toFixed(1)).toBe('14.8');
    for (const path of ['public/llms.txt', 'public/llms-full.txt', 'src/lib/sky-api/meta.ts',
      'src/pages/developers/engine/index.astro']) {
      expect(read(path), path).toContain('the largest difference is 14.8 arcseconds');
    }
    expect(read('src/pages/developers/index.astro').replace(/\s+/g, ' ')).toContain('the largest difference is 14.8 arcseconds');
  });
});

describe('ΔT on the developer engine page', () => {
  it('states the measured 2026-09-22 values of the formula rc.8 replaced', () => {
    const deltaT = JSON.parse(read('docs/platform/evidence/deltat-2026-09-23/values.json'));
    const today = deltaT.values.find((row) => row.date === '2026-09-22');
    const page = read('src/pages/developers/engine/index.astro').replace(/\s+/g, ' ');
    expect(page).toContain(`it read ${today.formulaSeconds.toFixed(1)} seconds where the IERS value is ${today.observedSeconds.toFixed(1)}`);
    expect(page).toContain(`moved the Moon about ${today.moonArcseconds.toFixed(1)} arcseconds`);
  });

  it('bounds the observed ΔT the engine uses by the worst day measured', () => {
    const gate = JSON.parse(read('docs/platform/evidence/deltat-2026-09-25/outputs/gate1.json'));
    const page = read('src/pages/developers/engine/index.astro').replace(/\s+/g, ' ');
    const stated = /from 1962 on it is within ([\d.]+) seconds of the IERS value on every day/u.exec(page);
    expect(stated).toBeTruthy();
    expect(Number(stated[1])).toBeGreaterThanOrEqual(gate.everyObservedDay.maxAbs);
    expect(gate.everyObservedDay.from).toBe('1962-01-01');
  });
});

describe('the pinned zone history on the methodology page', () => {
  it('states how many city-index zones it changes, as measured', () => {
    const measured = JSON.parse(read('docs/platform/evidence/tz-history-2025c/index-divergence.json'));
    const page = read('src/pages/methodology/index.astro').replace(/\s+/g, ' ');
    expect(page).toContain(`for about ${measured.divergentZones} of the ${measured.indexZones} time zones in our city index`);
    expect(page).toContain(`${measured.divergentByAnHourOrMore} of them by an hour or more`);
    expect(measured.divergent['Europe/Stockholm']).toBeDefined();
  });

  it('gives the Stockholm example as the resolver reads it', async () => {
    await prepareLocalTime('1947-07-01', 'Europe/Stockholm');
    expect(resolveLocalToUtc('1947-07-01', '12:00', 'Europe/Stockholm').utc.toISOString()).toBe('1947-07-01T10:00:00.000Z');
    expect(resolveLocalToUtc('1947-07-01', '12:00', 'Europe/Stockholm', { longitude: 18.07 }).utc.toISOString())
      .toBe('1947-07-01T11:00:00.000Z');
    const page = read('src/pages/methodology/index.astro').replace(/\s+/g, ' ');
    expect(page).toContain('a Stockholm birth reads 10:00 UTC with Berlin\'s summer time in the browser\'s history, where Sweden kept +1:00 and the chart uses 11:00');
  });
});

describe('the famous-people pages', () => {
  it('keep the reference instant and civil day the birth chart calculator gives for the same place and date', async () => {
    // Until 2026-09-23, 218 of these pages kept instants computed with the
    // browser's history and each zone's own mean time, and the methodology
    // page named them as the exception. The migration recorded in
    // docs/phase5/people-pilot/corrections/2026-09-23-reference-instants.json
    // moved them to the calculator's resolver, so no exception remains.
    const { people } = JSON.parse(read('src/data/people.json'));
    const differ = [];
    for (const { slug, computation, birthDate, birthPlace } of people) {
      const date = birthDate.computedGregorianDate;
      const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      await prepareLocalTime(date, birthPlace.timeZone);
      await prepareLocalTime(next, birthPlace.timeZone);
      const at = (day, time) => resolveLocalToUtc(day, time, birthPlace.timeZone,
        { longitude: birthPlace.coordinates.longitude }).utc.toISOString();
      if (at(date, computation.civilTime) !== computation.utcInstant
          || at(date, '00:00') !== computation.civilDayStartUtc
          || at(next, '00:00') !== computation.civilDayEndUtc) differ.push(slug);
    }
    expect(people).toHaveLength(501);
    expect(differ).toEqual([]);
    const page = read('src/pages/methodology/index.astro').replace(/\s+/g, ' ');
    expect(page).not.toContain('famous-people pages are the exception');
  });
});

describe('the Moon ingresses on the void-of-course calendar', () => {
  it('are within about 5 seconds of Swiss Ephemeris, measured on the table the site publishes', () => {
    const measured = JSON.parse(read('docs/platform/evidence/events-vs-swiss-2026-09-25/moon-ingresses.json'));
    const bytes = readFileSync(new URL('../src/data/aura-moon-ingresses.json', import.meta.url));
    // A regenerated table needs docs/platform/evidence/events-vs-swiss-2026-09-25/tools/moon-ingresses.py run again.
    expect(measured.rc8.tableSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(measured.rc8.maxAbsSeconds).toBeLessThan(5);
    expect(read('src/pages/void-of-course-moon/index.astro').replace(/\s+/g, ' '))
      .toContain('falls within about 5 seconds of Swiss Ephemeris');
  });
});

describe('the Moon\'s disagreement with Swiss Ephemeris on the methodology page', () => {
  it('states the in-span maximum as the ceiling, and the median beside it', () => {
    // The per-row differences were removed on 2026-09-28 (DECISIONS-2026-09-28
    // §3); these are their statistics, computed from the rows before then by
    // the formula this test used on them (median of the middle two of 16).
    const report = JSON.parse(read('docs/platform/evidence/swiss-benchmark/report-measure-rc8.json'));
    const moon = report.statistics.withinRecord.moon;
    expect(moon.n).toBe(16);
    const page = read('src/pages/methodology/index.astro').replace(/\s+/g, ' ');
    expect(page).toContain(`is at most ${moon.maxAbsArcsec.toFixed(1)} arcseconds over the span measured below, with a median of ${moon.medianAbsArcsec.toFixed(1)}`);
  });
});
