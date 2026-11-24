import { readFileSync } from 'node:fs';
import { createServer, request, type Server } from 'node:http';
import { afterAll, describe, expect, it, vi } from 'vitest';
import * as geometry from '../../lib/astrocartography/lines';
import { skyEvents } from '@zodiacs/engine/sky';
import { computeChart } from '../../lib/engine/full.js';
import { meanObliquity } from '../../lib/engine/houses';
import { ACG_BODIES, distanceKm, distanceToMeridianKm, eclipticToEquatorial, horizonLine, horizonLongitude, lineDistances, mcLongitude, ramcFromMc, wrapLongitude } from '../../lib/astrocartography/lines';
import { LINE_MEANING, MINOR_NOTE } from '../../lib/astrocartography/meanings';
import { coverageInputRefusal, executeAiTool } from '../tools';
import { createAiNodeHandler } from '../http';
import { INPUT_SCHEMAS, UNDER_13_REFUSAL } from '../contracts';
import { loadPlaceTable } from '../features/place-table';
import { astrocartographyInput, astrocartographyTool, equatorialBodies, greenwichSiderealDegrees } from './astrocartography';
import { forbiddenClaim } from './shared';

const BIRTH = new Date('1990-05-03T07:30:00Z');
const PAGE_FLAG = 'PUBLIC_ASTROCARTOGRAPHY_ENABLED';
const ON = { occasions: true, coverage: true, personal: true, now: () => new Date('2026-11-09T09:00:00Z'), placeTable: async () => loadPlaceTable(), sitePageOn: (flag: string) => flag === PAGE_FLAG };
const bodies = equatorialBodies(BIRTH);
const gast = greenwichSiderealDegrees(BIRTH);
const minutesFrom = (at: Date) => Math.abs(at.getTime() - BIRTH.getTime()) / 60_000;

/** The engine's own rise, set and transit search (@zodiacs/engine/sky), geometric horizon, the body's centre. */
function eventsAt(body: string, latitude: number, longitude: number) {
  const result = skyEvents(body as never, { latitude, longitude }, new Date(BIRTH.getTime() - 3 * 3_600_000), new Date(BIRTH.getTime() + 3 * 3_600_000), { limb: 'centre', refraction: 'none' });
  if (result.status !== 'complete') throw new Error('refused');
  return result.events;
}

describe('astrocartography lines against the engine\'s own rise, set and transit times', () => {
  it('puts every planet on its Midheaven line exactly at its upper transit, and on its IC line at its lower transit', () => {
    for (const entry of bodies.filter((row) => row.body !== 'Moon')) {
      for (const latitude of [-35, 0, 40, 60]) {
        const mc = mcLongitude(entry, gast);
        const upper = eventsAt(entry.body, latitude, mc).find((event) => event.kind === 'upper-transit')!;
        expect(minutesFrom(upper.at), `${entry.body} MC at ${latitude}`).toBeLessThan(0.5);
        const lower = eventsAt(entry.body, latitude, wrapLongitude(mc + 180)).find((event) => event.kind === 'lower-transit')!;
        expect(minutesFrom(lower.at), `${entry.body} IC at ${latitude}`).toBeLessThan(0.5);
      }
    }
  });

  it('puts every planet on its Ascendant line as it rises and on its Descendant line as it sets', () => {
    for (const entry of bodies.filter((row) => row.body !== 'Moon')) {
      for (const latitude of [-40, -10, 25, 51.5]) {
        for (const [angle, kind] of [['ASC', 'rise'], ['DSC', 'set']] as const) {
          const longitude = horizonLongitude(entry, gast, latitude, angle);
          if (longitude === null) continue;
          const event = eventsAt(entry.body, latitude, longitude).find((row) => row.kind === kind);
          expect(event, `${entry.body} ${angle} at ${latitude}`).toBeDefined();
          // Geocentric lines against a topocentric search: a planet's parallax is seconds of time at most.
          expect(minutesFrom(event!.at), `${entry.body} ${angle} at ${latitude}`).toBeLessThan(1);
        }
      }
    }
  });

  it('keeps the Moon within its parallax (about a degree, a few minutes of time) of the topocentric search', () => {
    const moon = bodies.find((row) => row.body === 'Moon')!;
    const event = eventsAt('Moon', 30, mcLongitude(moon, gast)).find((row) => row.kind === 'upper-transit')!;
    expect(minutesFrom(event.at)).toBeLessThan(5);
  });

  it('agrees with the relocated chart: on the Sun\'s Ascendant line the chart\'s rising degree is the Sun\'s longitude', () => {
    const sun = bodies.find((row) => row.body === 'Sun')!;
    for (const latitude of [-30, 10, 48]) {
      const longitude = horizonLongitude(sun, gast, latitude, 'ASC')!;
      const chart = computeChart({ utc: BIRTH, latitude, longitude, houseSystem: 'whole', timeKnown: true });
      const sunLon = chart.bodies.find((row) => row.body === 'Sun')!.lon;
      expect(Math.abs(wrapLongitude(chart.angles!.asc - sunLon))).toBeLessThan(0.01);
      // And on its Midheaven line, the chart's Midheaven is the Sun's longitude.
      const atMc = computeChart({ utc: BIRTH, latitude, longitude: mcLongitude(sun, gast), houseSystem: 'whole', timeKnown: true });
      expect(Math.abs(wrapLongitude(atMc.angles!.mc - sunLon))).toBeLessThan(0.01);
    }
  });

  it('puts the Sun overhead at the longitude of solar noon: 66.7 degrees east at 07:30 UTC on 3 May 1990', () => {
    // Apparent noon at 07:30 UTC is 4.5 hours east of Greenwich, 67.5 degrees, less the equation of time (+3.2 minutes, 0.8 degrees).
    expect(mcLongitude(bodies.find((row) => row.body === 'Sun')!, gast)).toBeCloseTo(66.72, 1);
  });

  it('reads Greenwich sidereal time and the Sun\'s right ascension and declination at J2000 as published', () => {
    // 2000-01-01 12:00 UT: Greenwich sidereal time 280.46 degrees (18h 41m 50s); the Sun at
    // right ascension 281.29 degrees (18h 45m 09s), declination -23.03 degrees (Astronomical Almanac 2000).
    const j2000 = new Date('2000-01-01T12:00:00Z');
    expect(greenwichSiderealDegrees(j2000)).toBeCloseTo(280.46, 1);
    const sun = equatorialBodies(j2000).find((row) => row.body === 'Sun')!;
    expect(sun.ra).toBeCloseTo(281.29, 1);
    expect(sun.dec).toBeCloseTo(-23.03, 1);
  });
});

describe('astrocartography geometry', () => {
  it('measures great-circle distances: London to Paris is about 344 km', () => {
    expect(distanceKm({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 })).toBeCloseTo(344, -1);
    // A meridian 1 degree away at the equator is 111 km; at 60 degrees north it is half that.
    expect(distanceToMeridianKm({ lat: 0, lon: 0 }, 1)).toBeCloseTo(111.2, 0);
    expect(distanceToMeridianKm({ lat: 60, lon: 0 }, 1)).toBeCloseTo(55.6, 0);
    expect(distanceToMeridianKm({ lat: 60, lon: 0 }, 179)).toBeCloseTo(30 * 111.195, -1);
  });

  it('stops a rising line where the planet only grazes the horizon, and draws it as a meridian on the equator', () => {
    const line = horizonLine({ ra: 90, dec: 23.44 }, 0, 'ASC');
    expect(Math.max(...line.map((point) => Math.abs(point.lat)))).toBeLessThanOrEqual(85);
    expect(horizonLongitude({ ra: 90, dec: 23.44 }, 0, 70, 'ASC')).toBeNull();
    expect(new Set(horizonLine({ ra: 90, dec: 0 }, 0, 'ASC').map((point) => point.lon))).toEqual(new Set([0]));
  });

  it('keeps the rising and setting lines whole for a declination near zero, close to an equinox', () => {
    // At 07:30 UTC on 20 March 2000 the Sun's declination is about -0.0014 degrees: every hour-angle step fell past 85 degrees, so both lines were empty.
    const at = new Date('2000-03-20T07:30:00Z');
    const equinox = equatorialBodies(at);
    const equinoxGast = greenwichSiderealDegrees(at);
    const sun = equinox.find((row) => row.body === 'Sun')!;
    expect(Math.abs(sun.dec)).toBeLessThan(0.01);
    const drawn = geometry.mapLines(equinox, equinoxGast).find((row) => row.body === 'Sun')!;
    for (const [angle, line] of [['ASC', drawn.asc], ['DSC', drawn.dsc]] as const) {
      expect(line.length, angle).toBeGreaterThan(300);
      expect(line[0].lat, angle).toBeCloseTo(-85, 6);
      expect(line.at(-1)!.lat, angle).toBeCloseTo(85, 6);
      for (let index = 1; index < line.length; index += 1) {
        expect(line[index].lat - line[index - 1].lat, `${angle} at ${line[index].lat}`).toBeGreaterThan(0);
        expect(line[index].lat - line[index - 1].lat, `${angle} at ${line[index].lat}`).toBeLessThanOrEqual(0.5 + 1e-9);
      }
      for (const point of line) expect(Math.abs(wrapLongitude(point.lon - horizonLongitude(sun, equinoxGast, point.lat, angle)!)), `${angle} at ${point.lat}`).toBeLessThan(1e-9);
      // A place on the line is found on it, so the distance a city is read at is not lost.
      const place = { lat: 10, lon: horizonLongitude(sun, equinoxGast, 10, angle)! };
      const row = lineDistances(place, equinox, equinoxGast).find((entry) => entry.body === 'Sun' && entry.angle === angle)!;
      expect(row.km, angle).toBeLessThan(1);
    }
    // And for any small declination, either side of zero: whole, in order, and no stretch of latitude left wider than a step.
    for (const dec of [1e-6, -1e-4, 0.01, -0.1, 0.5, 2, -3.4]) {
      for (const angle of ['ASC', 'DSC'] as const) {
        const line = horizonLine({ ra: 30, dec }, 100, angle);
        const reach = Math.min(85, 90 - Math.abs(dec));
        expect(line[0].lat, `${dec} ${angle}`).toBeLessThanOrEqual(-reach + 0.5);
        expect(line.at(-1)!.lat, `${dec} ${angle}`).toBeGreaterThanOrEqual(reach - 0.5);
        for (let index = 1; index < line.length; index += 1) expect(line[index].lat - line[index - 1].lat, `${dec} ${angle}`).toBeLessThanOrEqual(0.5 + 1e-9);
      }
    }
  });

  it('finds a place on a line at distance zero, and lists the nearest first', () => {
    const venus = bodies.find((row) => row.body === 'Venus')!;
    const lon = horizonLongitude(venus, gast, 20, 'DSC')!;
    const rows = lineDistances({ lat: 20, lon }, bodies, gast);
    expect(rows[0]).toMatchObject({ body: 'Venus', angle: 'DSC' });
    expect(rows[0].km).toBeLessThan(1);
    expect(rows.map((row) => row.km)).toEqual([...rows.map((row) => row.km)].sort((a, b) => a - b));
    expect(rows).toHaveLength(40);
  });

  it('has a reading for every planet on every angle, inside the copy rule', () => {
    for (const body of ACG_BODIES) for (const text of Object.values(LINE_MEANING[body])) expect(forbiddenClaim(text), text).toBeNull();
  });
});

describe('get_astrocartography', () => {
  it('names the nearest lines to the cities asked for, and puts neither the cities nor the birth details in a link', async () => {
    const result = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['New York', 'Lisbon', 'Paris, France', 'Qwxzv'] }, ON) as { ok: true; data: any; links: { url: string }[] };
    expect(result.ok).toBe(true);
    expect(result.data.instantUtc).toBe('1990-05-03T07:30:00.000Z');
    expect(result.data.cities.map((city: { name: string }) => city.name)).toEqual(['New York City', 'Lisbon', 'Paris']);
    expect(result.data.unmatched).toEqual(['Qwxzv']);
    const newYork = result.data.cities[0];
    expect(newYork.closest[0]).toMatchObject({ planet: 'Mars', angle: 'ASC', strength: 'strong' });
    expect(newYork.closest[0].distanceKm).toBeLessThan(100);
    expect(newYork.closest[0].line).toMatch(/Reading confidence \d+%\.$/u);
    for (const city of result.data.cities) {
      expect(city.closest.length).toBeGreaterThanOrEqual(3);
      for (const row of city.closest) expect(row.distanceKm % 10).toBe(0);
    }
    const text = JSON.stringify(result);
    expect(forbiddenClaim(text)).toBeNull();
    for (const url of text.match(/https:\/\/[^"]+/gu) ?? []) expect(url).not.toMatch(/1990|08:30|London|New|Lisbon|Paris/u);
    expect(result.data.lines).toHaveLength(10);
  });

  it('links to the page and its line cards only while the website page is switched on', async () => {
    expect(astrocartographyTool.pageFlag).toBe(PAGE_FLAG);
    const args = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['Lisbon', 'New York'] };
    const linked = (result: Awaited<ReturnType<typeof executeAiTool>>) => {
      if (!result.ok) throw new Error('refused');
      const data = result.data as { pageUrl: string | null; cities: { closest: { shareUrl: string | null }[] }[] };
      return { data, shares: data.cities.flatMap((city) => city.closest.map((row) => row.shareUrl)), urls: JSON.stringify(result).match(/https:\/\/[^"]+/gu) ?? [] };
    };
    // The MCP switches on and the page on: the page, and a card for each line near a place.
    const on = linked(await executeAiTool('get_astrocartography', args, ON));
    expect(on.data.pageUrl).toBe('https://zodiacs.org/astrocartography/');
    expect(on.shares.length).toBeGreaterThan(0);
    for (const share of on.shares) expect(share).toMatch(/^https:\/\/zodiacs\.org\/share\/astrocartography\//u);
    expect(on.urls).toContain('https://zodiacs.org/astrocartography/');
    // The MCP switches on and the page off (or no page switch read at all): neither, so no link is a 404.
    for (const dependencies of [{ ...ON, sitePageOn: () => false }, { ...ON, sitePageOn: undefined }]) {
      const off = linked(await executeAiTool('get_astrocartography', args, dependencies));
      expect(off.data.pageUrl).toBeNull();
      expect(off.shares.length).toBe(on.shares.length);
      expect(off.shares.every((share) => share === null)).toBe(true);
      expect(off.urls.filter((url) => url.includes('/astrocartography/') || url.includes('/share/'))).toEqual([]);
      // The rest of the answer is the same reading.
      expect({ ...off.data, pageUrl: null, cities: null }).toEqual({ ...on.data, pageUrl: null, cities: null });
    }
  });

  it.each([
    [3002, '3,000'], [800.1, '800'],
  ] as const)('gives only the nearest measurement when all lines are beyond the noticeable range (%s km)', async (km, printed) => {
    const distances = vi.spyOn(geometry, 'lineDistances').mockReturnValueOnce([
      { body: 'Venus', angle: 'DSC', side: 'west', km },
      { body: 'Sun', angle: 'MC', side: 'east', km: 3500 },
    ]);
    try {
      const answer = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'UTC', cities: ['Lisbon'] }, ON);
      const summary = `No line within 800 km; the nearest is the Venus Descendant line, ${printed} km.`;
      expect(answer).toMatchObject({ ok: true, data: { cities: [{ summary, closest: [{
        distanceKm: Math.round(km / 10) * 10, strength: 'faint', line: summary,
      }] }] } });
    } finally {
      distances.mockRestore();
    }
  });

  it('needs a birth time and its zone, and refuses a child', async () => {
    expect(await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', zone: 'Europe/London' }, ON)).toMatchObject({ ok: false, error: { message: 'time is required.' } });
    expect(await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30' }, ON)).toMatchObject({ ok: false, error: { message: 'zone is required.' } });
    expect(await executeAiTool('get_astrocartography', { birthDate: '2019-05-03', time: '08:30', zone: 'Europe/London' }, ON)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['a', 'b', 'c', 'd', 'e', 'f'].map((c) => `${c}${c}`) }, ON)).toMatchObject({ ok: false });
  });

  it('draws nothing for a child\'s birth date written with spaces around it, and does not repeat it back', async () => {
    const positions = await import('../../lib/astrocartography/positions');
    const moment = vi.spyOn(positions, 'equatorialMoment');
    try {
      for (const birthDate of [' 2020-01-01', '2020-01-01 ', '\t2020-01-01', '2020-01-01\n']) {
        const answer = await executeAiTool('get_astrocartography', { birthDate, time: '08:30', zone: 'Europe/London' }, ON) as { ok: boolean; data?: unknown; error?: { code: string; message: string } };
        expect(answer, JSON.stringify(birthDate)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
        expect(answer.data, JSON.stringify(birthDate)).toBeUndefined();
        expect(answer.error!.message).not.toContain('2020');
      }
      expect(moment).not.toHaveBeenCalled();
      // The spy sees the calculation when it runs.
      expect(await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London' }, ON)).toMatchObject({ ok: true });
      expect(moment).toHaveBeenCalled();
    } finally {
      moment.mockRestore();
    }
  });

  it('reads the age on the arguments as the tool parses them, as well as on what was sent', () => {
    const source = readFileSync(new URL('../tools.ts', import.meta.url), 'utf8');
    const branch = source.slice(source.indexOf('if (isPersonalTool(tool)) {'));
    expect(branch).toMatch(/childBirthDateRefusal\(tool, input, now, context\.hostZone\) \?\? childBirthDateRefusal\(tool, parsed\.data, now, context\.hostZone\)/u);
    expect(branch.indexOf('childBirthDateRefusal(')).toBeLessThan(branch.indexOf('definition.run('));
  });

  describe('reads the age as the /astrocartography/ page does, on the calendar date at UTC-12', () => {
    // Born 10 November 2008 in Kiritimati (UTC+14), living in Los Angeles. At 2026-11-10T02:00Z it is already the
    // 10th on the birthplace clock, but still the 9th at UTC-12 and in Los Angeles: the person is 17.
    const BORN = { birthDate: '2008-11-10', time: '08:30', zone: 'Pacific/Kiritimati', cities: ['Los Angeles'] };
    const LOVE = LINE_MEANING.Venus.DSC;
    const at = (iso: string) => ({ ...ON, now: () => new Date(iso) });
    async function venusNearby(args: Record<string, unknown>, iso: string) {
      // Los Angeles sits on the Venus Descendant line, so the reading the place gets is that line's.
      const distances = vi.spyOn(geometry, 'lineDistances').mockReturnValueOnce([
        { body: 'Venus', angle: 'DSC', side: 'east', km: 40 },
        { body: 'Sun', angle: 'MC', side: 'west', km: 900 },
        { body: 'Moon', angle: 'IC', side: 'west', km: 1200 },
      ]);
      try {
        const answer = await executeAiTool('get_astrocartography', args, at(iso)) as { ok: true; data: any };
        expect(answer.ok).toBe(true);
        return answer.data;
      } finally {
        distances.mockRestore();
      }
    }

    it('gives no love-and-partnership reading to a 17-year-old whose birthplace clock has passed the 18th birthday', async () => {
      for (const args of [BORN]) {
        const data = await venusNearby(args, '2026-11-10T02:00:00Z');
        const text = JSON.stringify(data);
        expect(text, JSON.stringify(args)).not.toContain(LOVE);
        expect(text).not.toMatch(/\b(?:love|romance|partner(?:ship)?s?)\b/iu);
        expect(data.limits).toContain(MINOR_NOTE);
        expect(data.readings.DSC).toBe('Descendant lines (setting).');
        expect(data.cities[0].closest[0]).toMatchObject({ planet: 'Venus', angle: 'DSC' });
      }
      // Still 17 one second before the 18th birthday begins at UTC-12.
      expect(JSON.stringify(await venusNearby(BORN, '2026-11-10T11:59:59Z'))).not.toContain(LOVE);
    });

    it('gives the adult reading once the 18th birthday has begun everywhere', async () => {
      const data = await venusNearby(BORN, '2026-11-10T12:00:00Z');
      expect(data.cities[0].summary).toContain(LOVE);
      expect(data.limits).not.toContain(MINOR_NOTE);
      // No line about which clock "today" was read on: the age is read on the same day everywhere.
      expect(data.limits.join(' ')).not.toMatch(/Today is read/u);
    });

    it('takes no current zone, since the age does not depend on where the person is now', async () => {
      expect(Object.keys(astrocartographyInput.shape)).not.toContain('currentZone');
      expect(JSON.stringify(astrocartographyTool.description)).not.toMatch(/where the person is now|own clock/iu);
      for (const currentZone of ['Asia/Bangkok', 'Mars/Olympus_Mons']) {
        expect(await executeAiTool('get_astrocartography', { ...BORN, currentZone }, at('2026-11-10T12:00:00Z'))).toMatchObject({ ok: false, error: { message: 'Leave out fields this tool does not take.' } });
      }
    });

    it('is marked clock dependent, since a repeat call across the 18th birthday changes the reading', () => {
      expect(astrocartographyTool.clockDependent).toBe(true);
    });
  });

  it('reads its confidence from the details given, as the shared rule does: 55% without the birthplace coordinates, 70% with them', async () => {
    const CITY = ['Lisbon'];
    const untimed = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: CITY }, ON) as { ok: true; data: any };
    expect(untimed.data).toMatchObject({ confidence: 55, confidenceLabel: 'Reading confidence 55%' });
    for (const row of untimed.data.cities[0].closest) if (row.strength !== 'faint') expect(row.line).toMatch(/Reading confidence 55%\.$/u);
    expect(JSON.stringify(untimed)).not.toContain('Reading confidence 70%');
    const placed = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', latitude: 51.51, longitude: -0.13, cities: CITY }, ON) as { ok: true; data: any };
    expect(placed.data).toMatchObject({ confidence: 70, confidenceLabel: 'Reading confidence 70%' });
    for (const row of placed.data.cities[0].closest) if (row.strength !== 'faint') expect(row.line).toMatch(/Reading confidence 70%\.$/u);
    expect(JSON.stringify(placed)).not.toContain('Reading confidence 55%');
  });

  it('refuses a child\'s birth date before it names any missing field', async () => {
    for (const args of [{ birthDate: '2020-01-01' }, { birthDate: '2020-01-01', zone: 'Europe/London' }, { birthDate: '2020-01-01', time: '8:30' }, { birthDate: '2020-01-01', cities: 'Lisbon' }]) {
      expect(await executeAiTool('get_astrocartography', args, ON), JSON.stringify(args)).toMatchObject({ ok: false, error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
    }
    // An adult's date with the same fields missing is still asked for them.
    expect(await executeAiTool('get_astrocartography', { birthDate: '1990-05-03' }, ON)).toMatchObject({ ok: false, error: { message: 'time is required. zone is required.' } });
  });

  it('tells the assistant to check the age before it asks for a birth time or birthplace', () => {
    expect(astrocartographyTool.description).toMatch(/not directed at children under 13: check the birth date first, and ask for no birth time or birthplace when it is less than 13 years ago/u);
    expect(astrocartographyTool.description.indexOf('under 13')).toBeLessThan(astrocartographyTool.description.indexOf('A birth time is required'));
  });

  it('is not offered with the switch off', async () => {
    expect((await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London' }, { occasions: true, coverage: true })).ok).toBe(false);
  });
});

describe('get_astrocartography on the hosted server', () => {
  const servers: Server[] = [];
  afterAll(async () => { await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });
  async function serve() {
    let handle: (req: unknown, res: unknown) => Promise<void> = async () => {};
    const server = createServer((req, res) => { void handle(req, res); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    servers.push(server);
    const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
    handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1', ZODIACS_PERSONAL_TOOLS_ENABLED: '1' }, allowedHosts: [host],
      rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed', countUsage: async () => {}, dependencies: { now: ON.now, placeTable: ON.placeTable } });
    return host;
  }
  function call(host: string, name: string, args: unknown) {
    return new Promise<any>((resolve, reject) => {
      const req = request(`http://${host}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' } }, (res) => {
        let text = ''; res.setEncoding('utf8');
        res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => {
          const body = text.includes('data: ') ? text.split('\n').find((line) => line.startsWith('data: '))!.slice(6) : text;
          resolve(JSON.parse(body).result);
        });
      });
      req.on('error', reject);
      req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }));
    });
  }

  it('answers a call with only a child\'s birth date with the age refusal, not the fields still missing', async () => {
    const host = await serve();
    for (const args of [{ birthDate: '2020-01-01' }, { birthDate: '2015-06-01', zone: 'Europe/London' }]) {
      const result = await call(host, 'get_astrocartography', args);
      expect(result.isError, JSON.stringify(args)).toBe(true);
      expect(result.structuredContent).toMatchObject({ ok: false, tool: 'get_astrocartography', error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
      expect(JSON.stringify(result)).not.toMatch(/is required/u);
      expect(JSON.stringify(result)).not.toMatch(/2020-01-01|2015-06-01/u);
    }
    // An adult's date alone is still asked for the birth time and its zone.
    expect((await call(host, 'get_astrocartography', { birthDate: '1990-05-03' })).structuredContent).toMatchObject({ ok: false, error: { message: 'time is required. zone is required.' } });
  });

  it('leaves every other tool\'s reply to arguments its schema refuses as it was', async () => {
    const host = await serve();
    const args = { birthDate: '2020-01-01', time: '8:30' };
    const expected = coverageInputRefusal('get_natal_chart', args, INPUT_SCHEMAS.get_natal_chart);
    expect(expected?.error.message).not.toBe(UNDER_13_REFUSAL);
    expect((await call(host, 'get_natal_chart', args)).structuredContent).toEqual(expected);
  });
});
