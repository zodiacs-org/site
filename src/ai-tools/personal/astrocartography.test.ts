import { describe, expect, it } from 'vitest';
import { skyEvents } from '@zodiacs/engine/sky';
import { computeChart } from '../../lib/engine/full.js';
import { meanObliquity } from '../../lib/engine/houses';
import { ACG_BODIES, distanceKm, distanceToMeridianKm, eclipticToEquatorial, horizonLine, horizonLongitude, lineDistances, mcLongitude, ramcFromMc, wrapLongitude } from '../../lib/astrocartography/lines';
import { LINE_MEANING } from '../../lib/astrocartography/meanings';
import { executeAiTool } from '../tools';
import { loadPlaceTable } from '../features/place-table';
import { equatorialBodies, greenwichSiderealDegrees } from './astrocartography';
import { forbiddenClaim } from './shared';

const BIRTH = new Date('1990-05-03T07:30:00Z');
const ON = { occasions: true, coverage: true, personal: true, now: () => new Date('2026-11-09T09:00:00Z'), placeTable: async () => loadPlaceTable() };
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

  it('gives the browser\'s conversion from the chart engine the same lines as the server\'s calc() within 0.01 degrees', () => {
    const chart = computeChart({ utc: BIRTH, latitude: 0, longitude: 0, houseSystem: 'whole', timeKnown: true });
    const t = (BIRTH.getTime() / 86_400_000 + 2440587.5 - 2451545) / 36525;
    const obliquity = meanObliquity(t);
    expect(Math.abs(wrapLongitude(ramcFromMc(chart.angles!.mc, obliquity) - gast))).toBeLessThan(0.01);
    for (const name of ACG_BODIES) {
      const row = chart.bodies.find((entry) => entry.body === name)!;
      const browser = eclipticToEquatorial(row.lon, row.lat, obliquity);
      const server = bodies.find((entry) => entry.body === name)!;
      expect(Math.abs(wrapLongitude(browser.ra - server.ra)), name).toBeLessThan(0.01);
      expect(Math.abs(browser.dec - server.dec), name).toBeLessThan(0.01);
    }
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
    for (const city of result.data.cities) expect(city.closest.length).toBeGreaterThanOrEqual(3);
    const text = JSON.stringify(result);
    expect(forbiddenClaim(text)).toBeNull();
    for (const url of text.match(/https:\/\/[^"]+/gu) ?? []) expect(url).not.toMatch(/1990|08:30|London|New|Lisbon|Paris/u);
    expect(result.data.lines).toHaveLength(10);
  });

  it('needs a birth time and its zone, and refuses a child', async () => {
    expect(await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', zone: 'Europe/London' }, ON)).toMatchObject({ ok: false, error: { message: 'time is required.' } });
    expect(await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30' }, ON)).toMatchObject({ ok: false, error: { message: 'zone is required.' } });
    expect(await executeAiTool('get_astrocartography', { birthDate: '2019-05-03', time: '08:30', zone: 'Europe/London' }, ON)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['a', 'b', 'c', 'd', 'e', 'f'].map((c) => `${c}${c}`) }, ON)).toMatchObject({ ok: false });
  });

  it('is not offered with the switch off', async () => {
    expect((await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London' }, { occasions: true, coverage: true })).ok).toBe(false);
  });
});
