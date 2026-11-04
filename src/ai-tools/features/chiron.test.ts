import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { CHIRON_ABOUT, CHIRON_OUTSIDE, CHIRON_SPAN, chironAt, chironAtJdTT, chironEvents } from './chiron';
import { CHIRON_STATION_NOTE } from './sky-events';
import { EXPLAIN_TOPICS, explainAstrology, matchTopic } from './explain';
import { executeAiTool } from '../tools';
import { ASPECTS } from '../../lib/engine/aspects';
import { timeBasis } from '../../lib/engine/time-basis.mjs';
import { buildChironTable } from '../../../scripts/build-chiron.mjs';
import table from '../../data/chiron.json';
import dense from '../../../docs/engine-validation/chiron/dense-check.json';

/**
 * Chiron's table against NASA JPL Horizons, from the responses docs/engine-validation/chiron/fetch.py keeps byte
 * for byte. None of the instants checked here is a table row: 280 fresh values (240 at random over 1800 to 2199
 * and 40 in the first and last 120 days of the span), each with the values 12 hours either side for its daily
 * motion, and twelve hourly windows around stations and sign changes. dense-check.json records the same comparison
 * against every day of the span, from responses too large to keep.
 */
const STORE = new URL('../../../docs/engine-validation/chiron/horizons/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('MANIFEST.json', STORE), 'utf8')) as { responses: Record<string, { file: string; bytes: number; sha256: string; query: Record<string, string>; source: { target: string; targetSource: string } }> };
const J2000 = 2451545;
/**
 * The gates: the largest differences measured over every day of the span (dense-check.json: 2.51″, and 1.03″ a day
 * against the change over the two days around it), rounded up. The 280 kept checks come to 2.22″ and 0.32″ a day.
 */
const LONGITUDE_ARCSEC = 3;
const MOTION_ARCSEC_PER_DAY = 1.5;
/**
 * A station read from the table can sit up to about an hour and a half from Horizons' (90 minutes measured): Earth's
 * monthly swing around the Earth-Moon centre moves Chiron by up to 0.8″, which a 24-day table cannot follow and which
 * shifts the moment its slowest motion turns. A sign change, at full speed, is within minutes (8.5 measured).
 */
const STATION_HOURS = 2;
const SIGN_CHANGE_MINUTES = 15;

const wrap = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;
const arcsec = (degrees: number) => Math.abs(degrees) * 3600;
function rows(name: string): number[][] {
  const text = readFileSync(new URL(manifest.responses[name].file, STORE), 'utf8');
  return text.slice(text.indexOf('$$SOE') + 5, text.indexOf('$$EOE')).trim().split('\n').map((line) => line.trim().split(/\s+/u).map(Number));
}
/** A TT Julian date as the engine's UTC instant: TT less the engine's own Delta T, solved by iteration. */
function utcOf(jdTT: number): number {
  let ms = (jdTT - 2440587.5) * 86_400_000;
  for (let round = 0; round < 4; round += 1) ms -= (J2000 + timeBasis(ms).ttDays - jdTT) * 86_400_000;
  return ms;
}
const names = (prefix: string) => Object.keys(manifest.responses).filter((name) => name.startsWith(prefix)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

describe('the Chiron table', () => {
  it('is what scripts/build-chiron.mjs builds from the kept Horizons response, and every response is kept byte for byte', async () => {
    expect(readFileSync(new URL('../../data/chiron.json', import.meta.url), 'utf8')).toBe(await buildChironTable());
    expect(Object.keys(manifest.responses)).toHaveLength(27);
    for (const [name, entry] of Object.entries(manifest.responses)) {
      const bytes = readFileSync(new URL(entry.file, STORE));
      expect(createHash('sha256').update(bytes).digest('hex'), name).toBe(entry.sha256);
      expect(bytes.length, name).toBe(entry.bytes);
      expect(entry.query, name).toMatchObject({ COMMAND: '2060;', EPHEM_TYPE: 'OBSERVER', CENTER: '500@399', TIME_TYPE: 'TT', QUANTITIES: '31', APPARENT: 'AIRLESS' });
      expect(entry.source, name).toMatchObject({ target: '2060 Chiron (1977 UB)', targetSource: 'JPL#171' });
    }
    // Every 24 days from four steps before 1800-01-01 TT to four after the last row 2200 needs.
    expect(table).toMatchObject({ firstJd: 2378400.5, stepDays: 24, points: 8, unitDegrees: 0.00001, timeScale: 'TT', span: { from: '1800-01-01T00:00:00Z', to: '2200-01-01T00:00:00Z' } });
    expect(table.longitudes).toHaveLength(6097);
  });

  it('matches 280 fresh Horizons values it does not hold, inside the span and at its edges, within 3 arcseconds, and their daily motion within 1.5 arcseconds a day', () => {
    let checked = 0;
    let worst = 0;
    let worstMotion = 0;
    let edges = 0;
    for (const name of names('chiron-checks-')) {
      // Horizons answers a list of instants in time order, so each row is found by the instant asked for.
      const values = rows(name);
      const asked = manifest.responses[name].query.TLIST.split(' ').map(Number);
      expect(values, name).toHaveLength(asked.length);
      const row = (jd: number) => values.find((value) => Math.abs(value[0] - jd) < 1e-6)!;
      for (let index = 0; index < asked.length; index += 3) {
        const [before, here, after] = asked.slice(index, index + 3).map(row);
        // Not a table row, and the neighbours are 12 hours either side.
        expect(Math.abs(((here[0] - table.firstJd) / table.stepDays) - Math.round((here[0] - table.firstJd) / table.stepDays)) * table.stepDays).toBeGreaterThan(0.5);
        expect(here[0] - before[0]).toBeCloseTo(0.5, 6);
        expect(after[0] - here[0]).toBeCloseTo(0.5, 6);
        const found = chironAtJdTT(here[0]);
        const error = arcsec(wrap(found.lon - here[1]));
        const motion = arcsec(found.speed - wrap(after[1] - before[1]) / (after[0] - before[0]));
        expect(error, `JD ${here[0]} TT`).toBeLessThan(LONGITUDE_ARCSEC);
        expect(motion, `JD ${here[0]} TT`).toBeLessThan(MOTION_ARCSEC_PER_DAY);
        worst = Math.max(worst, error);
        worstMotion = Math.max(worstMotion, motion);
        if (here[0] < 2378496.5 + 121 || here[0] > 2524593.5 - 122) edges += 1;
        checked += 1;
      }
    }
    expect(checked).toBe(280);
    expect(edges).toBeGreaterThanOrEqual(40);
    // Below the gates, and in line with the run over every day of the span.
    expect(worst).toBeGreaterThan(0.5);
    expect(dense.longitudeArcsec.max).toBeLessThan(LONGITUDE_ARCSEC);
    expect(dense.dailyMotionArcsecPerDay.max).toBeLessThan(MOTION_ARCSEC_PER_DAY);
    expect(dense.longitudeArcsec.count).toBe(140009);
    expect(dense.table.sha256).toBe(table.source.sha256);
  });

  it('finds the stations and sign changes Horizons gives hour by hour, near known stations and at both ends of the span', () => {
    const seen: string[] = [];
    for (const name of names('chiron-hourly-')) {
      const values = rows(name);
      const lon: number[] = [];
      for (const [, value] of values) lon.push(lon.length ? lon.at(-1)! + wrap(value - lon.at(-1)!) : value);
      // Horizons' own events in the window: where the hourly central difference turns sign, and where the longitude
      // passes a multiple of 30 degrees, each placed by linear interpolation between hours.
      const expected: { kind: 'station' | 'ingress'; ms: number; sign: number }[] = [];
      for (let index = 1; index + 2 < values.length; index += 1) {
        const [s0, s1] = [lon[index + 1] - lon[index - 1], lon[index + 2] - lon[index]];
        if (Math.sign(s0) !== Math.sign(s1)) expected.push({ kind: 'station', ms: utcOf(values[index][0] + s0 / (s0 - s1) / 24), sign: Math.floor((((lon[index] % 360) + 360) % 360) / 30) });
      }
      for (let index = 0; index + 1 < values.length; index += 1) {
        const [a, b] = [Math.floor(lon[index] / 30), Math.floor(lon[index + 1] / 30)];
        if (a !== b) expected.push({ kind: 'ingress', ms: utcOf(values[index][0] + (Math.max(a, b) * 30 - lon[index]) / (lon[index + 1] - lon[index]) / 24), sign: (((b % 12) + 12) % 12) });
      }
      expected.sort((x, y) => x.ms - y.ms);
      const found = chironEvents(new Date(utcOf(values[0][0])), new Date(utcOf(values.at(-1)![0]))).events;
      expect(found.map((event) => event.kind), name).toEqual(expected.map((event) => event.kind));
      for (const [index, event] of found.entries()) {
        const minutes = Math.abs(event.at.getTime() - expected[index].ms) / 60_000;
        expect(minutes, `${name} ${event.kind}`).toBeLessThan(event.kind === 'station' ? STATION_HOURS * 60 : SIGN_CHANGE_MINUTES);
        expect(event.sign, name).toBe(expected[index].sign);
        seen.push(`${name.slice(14)} ${event.kind}${event.retrograde ? ' retrograde' : ''}`);
      }
    }
    // The 2026 to 2028 steps between Aries and Taurus: into Taurus, back into Aries while retrograde, into Taurus to
    // stay, and the station direct of January 2028 four hundredths of a degree inside Taurus, with no sign change.
    expect(seen).toEqual([
      '1800-03-07 station retrograde', '1800-11-28 ingress', '1976-10-13 ingress retrograde', '2025-07-30 station retrograde',
      '2026-01-02 station', '2026-06-19 ingress', '2026-08-03 station retrograde', '2026-09-18 ingress retrograde',
      '2027-01-06 station', '2027-04-14 ingress', '2028-01-10 station', '2199-08-05 station',
    ]);
    const taurus = chironEvents(new Date('2026-01-01T00:00:00Z'), new Date('2028-12-31T00:00:00Z')).events;
    expect(taurus.filter((event) => event.kind === 'ingress').map((event) => [event.at.toISOString().slice(0, 10), event.sign, event.retrograde])).toEqual([
      ['2026-06-19', 1, false], ['2026-09-18', 0, true], ['2027-04-14', 1, false],
    ]);
    const direct = taurus.find((event) => event.kind === 'station' && event.at.toISOString().startsWith('2028-01-10'))!;
    expect(direct).toMatchObject({ retrograde: false, sign: 1 });
    expect(direct.lon).toBeGreaterThan(30);
    expect(direct.lon).toBeLessThan(30.05);
  });

  it('turns slowly enough for four-day sampling to find every station: over the whole span they are months apart', () => {
    let stations = 0;
    let signChanges = 0;
    let previous = -Infinity;
    let fewest = Infinity;
    for (let year = 1800; year < 2200; year += 2) {
      for (const event of chironEvents(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year + 2, 0, 1))).events) {
        if (event.kind === 'ingress') { signChanges += 1; continue; }
        stations += 1;
        fewest = Math.min(fewest, event.at.getTime() - previous);
        previous = event.at.getTime();
      }
    }
    // As many as the daily Horizons values give (dense-check.json), and never within 100 days of each other.
    expect([stations, signChanges]).toEqual([dense.stations.daily, dense.signChanges.daily]);
    expect(fewest / 86_400_000).toBeGreaterThan(100);
  }, 60_000);

  it('reads an instant on the engine clock, and leaves Chiron out before 1800 and from 2200, never extrapolating', () => {
    for (const at of ['1800-01-01T00:00:00Z', '1903-05-17T04:12:00Z', '2026-11-05T12:00:00Z', '2199-12-31T23:59:59.999Z']) {
      const ms = Date.parse(at);
      const found = chironAt(new Date(ms))!;
      const direct = chironAtJdTT(J2000 + timeBasis(ms).ttDays);
      expect(found.lon, at).toBeCloseTo(((direct.lon % 360) + 360) % 360, 12);
      expect(found.speed, at).toBe(direct.speed);
      expect(found.retrograde, at).toBe(direct.speed < 0);
    }
    // On TT, not UTC: in 2026 the engine's clock puts TT 69 seconds ahead, which moves Chiron by a fraction of an arcsecond.
    const now = Date.parse('2026-11-05T12:00:00Z');
    expect(arcsec(chironAt(new Date(now))!.lon - chironAtJdTT(J2000 + (now - Date.parse('2000-01-01T12:00:00Z')) / 86_400_000).lon)).toBeGreaterThan(0.01);
    for (const at of ['1799-12-31T23:59:59.999Z', '2200-01-01T00:00:00Z', '1066-10-14T12:00:00Z', '2500-01-01T00:00:00Z']) expect(chironAt(new Date(at)), at).toBeNull();
    expect(CHIRON_SPAN).toEqual({ from: Date.parse('1800-01-01T00:00:00Z'), to: Date.parse('2200-01-01T00:00:00Z') });
    expect(() => chironAtJdTT(2378400.5)).toThrow(RangeError);
    // A search past either end keeps to the span and says it was cut.
    expect(chironEvents(new Date('1799-06-01T00:00:00Z'), new Date('1800-06-01T00:00:00Z'))).toMatchObject({ clipped: true });
    expect(chironEvents(new Date('1799-06-01T00:00:00Z'), new Date('1800-06-01T00:00:00Z')).events.every((event) => event.at.getTime() >= CHIRON_SPAN.from)).toBe(true);
    expect(chironEvents(new Date('2199-06-01T00:00:00Z'), new Date('2200-01-01T00:00:00Z')).clipped).toBe(false);
    expect(chironEvents(new Date('2200-01-01T00:00:00Z'), new Date('2201-01-01T00:00:00Z'))).toEqual({ events: [], clipped: true });
  });
});

const now = () => new Date('2026-11-04T12:00:00Z');
const on = { occasions: true, coverage: true, skyEvents: true, now };
const off = { occasions: true, coverage: true, now };
const DASH = /[–—]/u;
const BOUNDARY_WORDS = /\b(?:crypto\w*|token\w*|blockchain|market\w*|invest\w*)\b/iu;
const root = new URL('../../../', import.meta.url);
const pageExists = (url: string) => {
  const path = new URL(url).pathname.replace(/^\/|\/$/gu, '');
  return existsSync(new URL(`src/pages/${path}/index.astro`, root)) || existsSync(new URL(`src/pages/${path}.astro`, root)) || existsSync(new URL(`src/pages/${path}/[slug].astro`, root));
};
async function chart(args: Record<string, unknown>, dependencies: Record<string, unknown> = on) {
  const result = await executeAiTool('get_natal_chart', args, dependencies);
  if (!result.ok || result.tool !== 'get_natal_chart') throw new Error(JSON.stringify(result));
  return result.data as Record<string, any>;
}
const separation = (a: number, b: number) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };
const degreesOf = (position: string, sign: string) => {
  const [, degree, minute] = position.match(/^(\d+)°(\d+)′/u)!;
  return ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'].indexOf(sign) * 30 + Number(degree) + Number(minute) / 60;
};

describe('get_natal_chart\'s Chiron, with the sky events switch', () => {
  const madrid = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };

  it('gives its sign, degree, retrograde flag and house when the birth time and place are known', async () => {
    const data = await chart(madrid);
    const at = chironAt(new Date(data.castFor.utc))!;
    expect(data.chiron).toMatchObject({ about: CHIRON_ABOUT, sign: 'cancer', possibleSigns: ['cancer'], position: '12°18′ Cancer', retrograde: false, house: 2 });
    expect(Math.abs(degreesOf(data.chiron.position, data.chiron.sign) - at.lon) * 60).toBeLessThan(1);
    expect(data.chiron.signLine).toMatch(/^In Cancer, it takes on a cardinal water style\. /u);
    expect(data.chiron.houseLine).toBe('The second house brings it into earning, owning, and what security is made of.');
    expect(data.chiron.meaning).toContain('between Saturn and Uranus');
    // In the chart's house system: Placidus moves it as it moves the planets.
    const retrograde = await chart({ birthDate: '2025-09-01', time: '12:00', zone: 'Europe/London', latitude: 51.5, longitude: -0.12, houseSystem: 'placidus' });
    expect(retrograde.houseSystem).toBe('placidus');
    expect(retrograde.chiron).toMatchObject({ sign: 'aries', retrograde: true, house: 6 });
    // The sixth house never reads as health.
    expect(retrograde.chiron.houseLine).toBe('The sixth house brings it into routines, craft, and the shape of the day.');
    expect((await chart({ birthDate: '2026-03-01', time: '12:00', zone: 'Europe/London' })).chiron).toMatchObject({ sign: 'aries', retrograde: false, house: null, houseLine: null });
    expect(JSON.stringify(data.chiron)).not.toMatch(DASH);
    expect(JSON.stringify(data.chiron)).not.toMatch(BOUNDARY_WORDS);
  });

  it('lists its aspects to the planets under the chart\'s own orbs, closest first, and every one within them', async () => {
    for (const args of [madrid, { birthDate: '2025-09-01', time: '12:00', zone: 'Europe/London', latitude: 51.5, longitude: -0.12 }, { birthDate: '1955-02-24', time: '19:15', zone: 'America/Los_Angeles', latitude: 37.77, longitude: -122.42 }]) {
      const data = await chart(args);
      const chiron = chironAt(new Date(data.castFor.utc))!.lon;
      const listed = data.chiron.aspects as { body: string; type: string; orb: number; line: string }[];
      expect(listed.map((aspect) => aspect.orb)).toEqual([...listed.map((aspect) => aspect.orb)].sort((a, b) => a - b));
      for (const planet of data.planets as { body: string; position: string; sign: string }[]) {
        // The same policy as the chart's own aspects: the engine's orbs, wider when the Sun or Moon is in it.
        const luminary = planet.body === 'Sun' || planet.body === 'Moon';
        const distance = separation(chiron, degreesOf(planet.position, planet.sign));
        const within = ASPECTS.find((aspect) => Math.abs(distance - aspect.angle) <= (luminary ? aspect.orbLuminary : aspect.orb) - 0.05);
        const found = listed.find((aspect) => aspect.body === planet.body);
        if (within) expect(found, `${args.birthDate} ${planet.body}`).toMatchObject({ type: within.type });
        if (found) {
          const definition = ASPECTS.find((aspect) => aspect.type === found.type)!;
          expect(found.orb).toBeLessThanOrEqual(luminary ? definition.orbLuminary : definition.orb);
          expect(Math.abs(Math.abs(distance - definition.angle) - found.orb)).toBeLessThan(0.1);
          expect(found.line).toMatch(new RegExp(`^Your Chiron .* your ${planet.body}\\. Astrology `, 'u'));
        }
      }
    }
  });

  it('says what a chart without a birth time cannot settle: no house, no Moon aspect, and the signs of a day it changed sign', async () => {
    const data = await chart({ birthDate: '2026-06-19', zone: 'Europe/London' });
    expect(data.chiron).toMatchObject({ sign: null, possibleSigns: ['aries', 'taurus'], position: null, house: null, signLine: null, houseLine: null });
    expect(data.unknown).toContain('Chiron changed sign that day, from Aries to Taurus; the birth time settles it.');
    const settled = await chart({ birthDate: '1990-05-03' });
    expect(settled.chiron).toMatchObject({ sign: 'cancer', possibleSigns: ['cancer'], house: null });
    expect(settled.chiron.aspects.some((aspect: { body: string }) => aspect.body === 'Moon')).toBe(false);
  });

  it('leaves Chiron out with a plain note before 1800 and from 2200, never extrapolating', async () => {
    // Untimed on 1 January 1800 in Tokyo, the day began on 31 December 1799 in UTC.
    for (const args of [{ birthDate: '1800-01-01', zone: 'Asia/Tokyo' }, { birthDate: '2199-12-31', time: '23:30', zone: 'America/Los_Angeles', latitude: 34.05, longitude: -118.24 }]) {
      const data = await chart(args);
      expect(data.chiron, args.birthDate).toBeNull();
      expect(data.unknown, args.birthDate).toContain(CHIRON_OUTSIDE);
    }
    expect((await chart({ birthDate: '1800-01-01', time: '12:00', zone: 'Europe/London' })).chiron).not.toBeNull();
    expect(CHIRON_OUTSIDE).not.toMatch(DASH);
  });

  it('keeps romantic and health wording out of Chiron for anyone under 18', async () => {
    const data = await chart({ birthDate: '2012-06-01', time: '12:00', zone: 'Europe/London', latitude: 51.5, longitude: -0.12 });
    expect(data.under18).toBe(true);
    expect(data.chiron.aspects.length).toBeGreaterThan(0);
    expect(JSON.stringify(data.chiron)).not.toMatch(/\b(?:romance|romantic|attraction|health)\b/iu);
  });

  it('gives no Chiron while the switch is off', async () => {
    const data = await chart(madrid, off);
    expect(data).not.toHaveProperty('chiron');
    expect(JSON.stringify(data)).not.toMatch(/chiron/iu);
  });
});

describe('search_sky_events\' Chiron', () => {
  async function search(args: Record<string, unknown>) {
    const result = await executeAiTool('search_sky_events', args, on);
    if (!result.ok || result.tool !== 'search_sky_events') throw new Error(JSON.stringify(result));
    return result.data;
  }

  it('lists its stations and sign changes, with its steps between Aries and Taurus, and links no page', async () => {
    const data = await search({ planets: ['Chiron'], from: '2026-01-01', to: '2027-12-31', zone: 'Europe/London' });
    expect(data.kinds).toEqual(['station', 'ingress']);
    expect(data.events.map((event) => [event.title, event.at.local.split(',')[0]])).toEqual([
      ['Chiron turns direct in Aries', 'Fri 2 Jan 2026'], ['Chiron enters Taurus', 'Fri 19 Jun 2026'], ['Chiron turns retrograde in Taurus', 'Mon 3 Aug 2026'],
      ['Chiron moves back into Aries', 'Fri 18 Sept 2026'], ['Chiron turns direct in Aries', 'Wed 6 Jan 2027'], ['Chiron enters Taurus', 'Wed 14 Apr 2027'],
      ['Chiron turns retrograde in Taurus', 'Sun 8 Aug 2027'],
    ]);
    for (const event of data.events) expect(event).toMatchObject({ planet: 'Chiron', pageUrl: null, until: null, nextSign: null });
    expect(data.events[3]).toMatchObject({ kind: 'ingress', sign: 'aries', position: null, line: 'Chiron moves back into Aries while it is retrograde.' });
    expect(data.events[2]).toMatchObject({ kind: 'station', type: 'retrograde', sign: 'taurus', position: '0°52′ Taurus', line: 'Chiron stands still at 0°52′ Taurus and turns retrograde: from here it appears to move backward through the zodiac.' });
    expect(data.message).toContain(CHIRON_STATION_NOTE);
    expect(JSON.stringify(data)).not.toMatch(DASH);
  });

  it('comes with the other planets unless planets leaves it out, and keeps to 1800 to 2199', async () => {
    const all = await search({ kinds: ['station', 'ingress'], from: '2026-01-01', to: '2026-12-31', limit: 100 });
    expect(all.events.filter((event) => event.planet === 'Chiron').map((event) => event.title)).toEqual(['Chiron turns direct in Aries', 'Chiron enters Taurus', 'Chiron turns retrograde in Taurus', 'Chiron moves back into Aries']);
    const mercury = await search({ planets: ['Mercury'], from: '2026-01-01', to: '2026-12-31', limit: 100 });
    expect(mercury.events.some((event) => event.planet === 'Chiron')).toBe(false);
    expect(mercury.message ?? '').not.toContain('Chiron');
    const ingresses = await search({ kinds: ['ingress'], planets: ['Chiron'], from: '2026-01-01', to: '2026-12-31' });
    expect(ingresses.message ?? '').not.toContain(CHIRON_STATION_NOTE);
    // 1 January 1800 in Tokyo began in 1799 in UTC: what falls before 1800 is left out, and the answer says so.
    const early = await search({ planets: ['Chiron'], from: '1800-01-01', to: '1800-12-31', zone: 'Asia/Tokyo' });
    expect(early.message).toContain('Chiron\'s stations and sign changes are listed from 1 January 1800 to 31 December 2199, the years its NASA JPL Horizons positions cover.');
    expect(early.events.map((event) => event.title)).toEqual(['Chiron turns retrograde in Scorpio', 'Chiron turns direct in Scorpio', 'Chiron enters Sagittarius']);
  });
});

describe('explain_astrology\'s Chiron, with the sky events switch', () => {
  it('explains Chiron in plain words, with pages on zodiacs.org and the tools that place and date it', async () => {
    const result = await executeAiTool('explain_astrology', { topic: 'what does chiron mean' }, on);
    if (!result.ok || result.tool !== 'explain_astrology') throw new Error(JSON.stringify(result));
    const { data } = result;
    expect(data).toMatchObject({ found: true, topic: 'chiron', title: 'Chiron', terms: [] });
    const text = data.paragraphs.join(' ');
    expect(text).toContain('between Saturn and Uranus');
    expect(text).toContain('NASA JPL Horizons, for 1800 to 2199');
    expect(text).toContain('use get_natal_chart');
    expect(text).toContain('use search_sky_events');
    expect(data.pages.length).toBeGreaterThan(0);
    for (const page of data.pages) expect(pageExists(page.url), page.url).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(DASH);
    expect(JSON.stringify(data)).not.toMatch(/confidence/iu);
  });

  it('answers any question naming Chiron, with the sign or house it names', () => {
    for (const query of ['Chiron', 'chiron in sagittarius', 'Chiron in the 12th house', 'my chiron return', 'wounded healer', 'chiron retrograde', 'Sagittarius Chiron']) {
      expect(matchTopic(query, { skyEvents: true })?.key, query).toBe('chiron');
    }
    const sign = explainAstrology({ topic: 'Chiron in Sagittarius' }, 'https://zodiacs.org', { skyEvents: true }).data;
    expect(sign.title).toBe('Chiron in Sagittarius');
    expect(sign.paragraphs.at(-1)).toMatch(/^In Sagittarius, Chiron takes on a mutable fire style\. /u);
    expect(sign.pages[0].url).toBe('https://zodiacs.org/sagittarius/');
    const house = explainAstrology({ topic: 'chiron in the sixth house' }, 'https://zodiacs.org', { skyEvents: true }).data;
    expect(house.title).toBe('Chiron in the Sixth house');
    expect(house.paragraphs.at(-1)).toBe('The sixth house brings Chiron into routines, craft, and the shape of the day.');
    expect(house.pages[0].url).toBe('https://zodiacs.org/learn/houses/sixth-house/');
    // A planet named beside Chiron does not turn the answer into that planet's.
    expect(explainAstrology({ topic: 'Chiron conjunct Venus in Leo' }, 'https://zodiacs.org', { skyEvents: true }).data).toMatchObject({ topic: 'chiron', title: 'Chiron' });
  });

  it('answers as before while the switch is off', () => {
    expect(EXPLAIN_TOPICS).not.toContain('chiron');
    expect(matchTopic('chiron')).toBeNull();
    expect(explainAstrology({ topic: 'chiron' }).data).toMatchObject({ found: false, topics: [...EXPLAIN_TOPICS] });
  });
});
