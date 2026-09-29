import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import './lib/deltat-install.mjs';
import { e_tilt, MakeTime, SiderealTime } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { eventsCatalog } from '../src/lib/events/catalog.ts';
import { bodyLongitude, computeChart } from '../src/lib/engine/full.ts';
import { solarReturnInstant } from '../src/lib/engine/solar-return.ts';
import { prepareLocalTime, resolveLocalToUtc } from '../src/lib/time/localToUtc.ts';
import { computeLunarReturn } from '../src/islands/lunar-return/compute.ts';
import { computeSolarReturn } from '../src/islands/solar-return/compute.ts';

/*
 * Sentences that state a measured accuracy, held to the measurement behind
 * them. Each binding checks both halves: the sentence is on the page, and
 * the figure it states still covers what was measured.
 */
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const evidence = JSON.parse(read('docs/platform/evidence/events-vs-swiss-2026-09-25/deltas.json'));
const MINUTE = 60;
const HOUR = 3600;

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

describe('images of one birth shared together', () => {
  it('narrow the birthplace about five times with one solar return image, as the privacy page says', async () => {
    // A link carries the ascendant and midheaven to the whole degree at the
    // birth minute. A solar or lunar return image cast at the birthplace, as
    // they are by default, draws its own to the whole degree, at an instant
    // anyone can find again from the link. The places left are those that
    // give every image's whole degrees, counted on a 0.01° grid.
    const birth = { date: '1987-03-14', time: '06:42', zone: 'Europe/Paris', lat: 45.764, lon: 4.8357 };
    await prepareLocalTime(birth.date, birth.zone);
    const utc = resolveLocalToUtc(birth.date, birth.time, birth.zone, { longitude: birth.lon }).utc;
    const place = { name: 'Lyon', lat: birth.lat, lon: birth.lon, tz: birth.zone };
    const shown = [utc];
    for (const year of [2025, 2026]) {
      const result = computeSolarReturn({
        birthDate: birth.date, birthTime: birth.time, timeKnown: true, birthplace: place,
        savedSunLon: null, houseSystem: 'whole', castLocation: place, year,
      }, new Date('2026-09-28T00:00:00Z'));
      shown.push((result.shared ?? result.chart).input.utc);
    }
    let reference = new Date('2026-06-01T00:00:00Z');
    for (let pass = 0; pass < 4; pass += 1) {
      const result = computeLunarReturn({
        birthDate: birth.date, birthTime: birth.time, timeKnown: true, birthplace: place,
        houseSystem: 'whole', castLocation: null,
      }, reference);
      const at = (result.shared ?? result.chart).input.utc;
      shown.push(at);
      reference = new Date(at.getTime() + 86_400_000);
    }
    const RAD = Math.PI / 180;
    const norm = (x) => ((x % 360) + 360) % 360;
    const images = shown.map((at) => {
      const chart = computeChart({ utc: at, latitude: birth.lat, longitude: birth.lon, houseSystem: 'whole', timeKnown: true });
      const time = MakeTime(at);
      return {
        gast: SiderealTime(time) * 15,
        eps: e_tilt(time).tobl * RAD,
        asc: Math.floor(chart.angles.asc),
        mc: Math.floor(chart.angles.mc),
      };
    });
    // How many images, in order, a place gives the same whole degrees as.
    const agrees = (lat, lon) => {
      let count = 0;
      for (const image of images) {
        const ramc = norm(image.gast + lon) * RAD;
        const mc = norm(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(image.eps)) / RAD);
        if (Math.floor(mc) !== image.mc) break;
        const asc = norm(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(image.eps) + Math.tan(lat * RAD) * Math.sin(image.eps))) / RAD);
        if (Math.floor(asc) !== image.asc) break;
        count += 1;
      }
      return count;
    };
    const cellKm2 = 0.01 * 111.32 * Math.cos(birth.lat * RAD) * 0.01 * 110.57;
    const cells = new Array(images.length + 1).fill(0);
    for (let lon = birth.lon - 1.5; lon <= birth.lon + 1.5; lon += 0.01) {
      for (let lat = birth.lat - 12; lat <= birth.lat + 12; lat += 0.01) cells[agrees(lat, lon)] += 1;
    }
    // Places that agree with at least the first n images.
    const area = (n) => cells.slice(n).reduce((sum, count) => sum + count, 0) * cellKm2;
    const [link, oneSolar, all] = [area(1), area(2), area(7)];
    expect(link).toBeGreaterThan(18_600);
    expect(link).toBeLessThan(19_600);
    expect(oneSolar).toBeGreaterThan(3_700);
    expect(oneSolar).toBeLessThan(4_100);
    expect(link / oneSolar).toBeGreaterThan(4.5);
    expect(link / oneSolar).toBeLessThan(5.5);
    expect(all).toBeGreaterThan(1_400);
    expect(all).toBeLessThan(1_650);
    const page = read('src/pages/privacy/index.astro').replace(/\s+/gu, ' ');
    expect(page).toContain('For a birth in Lyon in 1987, a link alone leaves an area of about 19,100 km²;');
    expect(page).toContain('leave about 3,900 km², about five times smaller;');
    expect(page).toContain('a link with two solar return images and four lunar return images leaves about 1,500 km².');
  }, 120_000);
});

describe('the solar return with an unknown birth time', () => {
  it('can move by up to about a day from the 12:00 UTC it starts from, as the page and the result notice say', () => {
    // Without a birth time the natal Sun is the Sun at 12:00 UTC on the birth
    // date. A birth on that date was, somewhere, from 26 hours before it
    // (00:00 at UTC+14) to 24 hours after (24:00 at UTC-12); Pago Pago, at
    // UTC-11, ends the date 23 hours after it.
    const date = '2000-10-15';
    const noon = new Date(`${date}T12:00:00Z`);
    const near = new Date(Date.UTC(2026, 9, 15, 12));
    const shift = (birth) => (solarReturnInstant(bodyLongitude('Sun', birth), near).getTime()
      - solarReturnInstant(bodyLongitude('Sun', noon), near).getTime()) / 3_600_000;
    const earliest = shift(resolveLocalToUtc(date, '00:00', 'Pacific/Kiritimati').utc);
    const latest = shift(resolveLocalToUtc(date, '23:59', 'Pacific/Pago_Pago').utc);
    expect(earliest).toBeGreaterThan(-26.5);
    expect(earliest).toBeLessThan(-25.5);
    expect(latest).toBeGreaterThan(22.5);
    expect(latest).toBeLessThan(23.5);
    expect(read('src/islands/solar-return/compute.ts')).toContain('const noon = sharedReferenceInstant(birthDate);');
    expect(read('src/pages/solar-return/index.astro')).toContain('shift the return by up to about a day');
    expect(read('src/islands/solar-return/copy.ts')).toContain('can shift by up to about a day');
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
    const report = JSON.parse(read('docs/platform/evidence/swiss-benchmark/report-measure-rc8.json'));
    const moon = report.rows.filter((row) => row.body === 'Moon' && row.stratum !== 'future')
      .map((row) => Math.abs(row.dLonArcsec)).sort((a, b) => a - b);
    const median = (moon[moon.length / 2 - 1] + moon[moon.length / 2]) / 2;
    const page = read('src/pages/methodology/index.astro').replace(/\s+/g, ' ');
    expect(page).toContain(`is at most ${moon.at(-1).toFixed(1)} arcseconds over the span measured below, with a median of ${median.toFixed(1)}`);
  });
});
