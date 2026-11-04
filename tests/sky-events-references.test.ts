import '../scripts/lib/deltat-install.mjs';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MakeTime, NextGlobalSolarEclipse, NextLunarEclipse, SearchGlobalSolarEclipse, SearchLunarEclipse } from 'astronomy-engine';
import { calc } from '@zodiacs/engine/calc';
import { executeAiTool } from '../src/ai-tools/tools';
import { timeBasis } from '../src/lib/engine/time-basis.mjs';
import { SIGNS } from '../src/lib/signs';
import eightCases from '../src/lib/engine/fixtures/independent-eight-cases.json';
import nodePolar from '../src/lib/engine/fixtures/independent-node-polar.json';
import type { NatalChartDataWithNodes } from '../src/ai-tools/features/natal-chart';

/**
 * search_sky_events and get_natal_chart's nodes (ZODIACS_SKY_EVENTS_ENABLED=1) held to public references only; no
 * Swiss Ephemeris output (docs/engine-validation/SWISS-OUTPUT-REMOVAL.md). Where each reference comes from:
 *
 * - Eclipses: NASA Goddard's Five Millennium Canon catalogs (F. Espenak and J. Meeus), the 2025 to 2030 rows,
 *   in docs/engine-validation/sky-events-references/nasa-eclipses-2025-2030.json with each page's address,
 *   retrieval date and SHA-256 (fetch.py beside it). The canon gives greatest eclipse in TD (TT); the tool's
 *   UTC instant is carried to TT on the engine's own clock (src/lib/engine/time-basis.mjs), so the comparison
 *   measures geometry, not the canon's predicted Delta T. Gate: 30 seconds, and the same type.
 * - New and full Moons, and the Sun's sign changes: NASA JPL Horizons (DE441), apparent ecliptic longitude of date,
 *   hourly on a TT clock. The Moon for 2025-12-30 to 2026-02-11 and 2026-02-27 to 2026-04-11 is the independent
 *   reference pipeline's own (docs/engine-validation/independent-references/horizons/); the Sun over the same
 *   hours, and the Sun and Moon for 2028-12-15 to 2029-01-21, past the engine's IERS table, were fetched with
 *   that pipeline's client into docs/engine-validation/sky-events-references/horizons/ (MANIFEST.json records each
 *   query, its retrieval time and SHA-256). Instants are roots of a nine-point Lagrange interpolant, as the
 *   pipeline's tools/series.py takes them. Gates: 30 seconds for a lunation; for a sign change, Horizons'
 *   longitude at the tool's instant within the engine's own measured bound against Horizons for that body, which
 *   its calc API states (Sun 3, Jupiter 13, Saturn 18, Uranus 20 arcseconds), of the sign's edge.
 * - Stations and the slow planets' sign changes: the pipeline's Horizons responses for Mercury (2026), Jupiter,
 *   Uranus, Neptune and Pluto (2019 to 2020) and Saturn (2016 to 2082), and its two Horizons-derived stations in
 *   src/lib/engine/fixtures/independent-eight-cases.json. Gate: 5 minutes for Mercury and 20 for Jupiter
 *   to Pluto, whose stations are slow enough that an arcsecond moves them by minutes.
 * - The lunar nodes: the pipeline's true nodes from Horizons state vectors
 *   (src/lib/engine/fixtures/independent-node-polar.json), against the arcminute get_natal_chart prints.
 */
const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const PIPELINE = 'docs/engine-validation/independent-references/horizons/';
const SKY_REFERENCES = 'docs/engine-validation/sky-events-references/';
const on = { occasions: true, coverage: true, skyEvents: true };
const J2000 = 2451545.0;
const DAY = 86_400_000;
/** The engine's TT for a UTC instant, as a Julian date. */
const jdTT = (iso: string) => timeBasis(Date.parse(iso)).ttDays + J2000;
/** A Julian date written as a calendar day, for a search window. */
const dayOf = (jd: number, days = 0) => new Date((jd - 2440587.5) * DAY + days * DAY).toISOString().slice(0, 10);

interface SkyEvent { kind: string; at: { utc: string }; planet: string | null; sign: string; type: string | null; position: string | null }
async function search(args: Record<string, unknown>): Promise<SkyEvent[]> {
  const result = await executeAiTool('search_sky_events', args, on);
  if (!result.ok || result.tool !== 'search_sky_events') throw new Error(JSON.stringify(result));
  return result.data.events as SkyEvent[];
}

/** A kept Horizons observer table: Julian dates (TT) and longitudes, unwrapped so they run continuously. */
function horizons(path: string): { jd: number[]; lon: number[] } {
  const text = read(path);
  const rows = text.slice(text.indexOf('$$SOE') + 5, text.indexOf('$$EOE')).trim().split('\n').map((line) => line.trim().split(/\s+/u).map(Number));
  const lon: number[] = [];
  let turns = 0;
  rows.forEach((row, index) => {
    if (index && row[1] - rows[index - 1][1] < -180) turns += 360;
    if (index && row[1] - rows[index - 1][1] > 180) turns -= 360;
    lon.push(row[1] + turns);
  });
  return { jd: rows.map((row) => row[0]), lon };
}
type Table = ReturnType<typeof horizons>;

/** The table's value at `t` from a nine-point Lagrange interpolant on its uniform steps. */
function at(table: Table, t: number): number {
  const step = table.jd[1] - table.jd[0];
  const first = Math.max(0, Math.min(table.jd.length - 9, Math.round((t - table.jd[0]) / step) - 4));
  let sum = 0;
  for (let i = first; i < first + 9; i += 1) {
    let weight = 1;
    for (let j = first; j < first + 9; j += 1) if (j !== i) weight *= (t - table.jd[j]) / (table.jd[i] - table.jd[j]);
    sum += weight * table.lon[i];
  }
  return sum;
}

/** Every root of f between the table's fifth and fifth-last samples, bracketed per step and bisected to 1e-9 day. */
function roots(f: (t: number) => number, table: Table): number[] {
  const out: number[] = [];
  for (let i = 4; i < table.jd.length - 5; i += 1) {
    let [lo, hi] = [table.jd[i], table.jd[i + 1]];
    let fLo = f(lo);
    const fHi = f(hi);
    if (Math.sign(fLo) === Math.sign(fHi) || Math.abs(fLo - fHi) > 90) continue;
    while (hi - lo > 1e-9) {
      const mid = (lo + hi) / 2;
      const value = f(mid);
      if (Math.sign(value) === Math.sign(fLo)) { lo = mid; fLo = value; } else hi = mid;
    }
    out.push((lo + hi) / 2);
  }
  return out;
}
const wrap = (degrees: number) => ((degrees % 360) + 540) % 360 - 180;
/** The sign edges a table's body crosses: the edge, the root and the sign entered. */
function signChanges(table: Table): { edge: number; jd: number; sign: string }[] {
  const out: { edge: number; jd: number; sign: string }[] = [];
  for (let i = 4; i < table.jd.length - 5; i += 1) {
    const [a, b] = [Math.floor(table.lon[i] / 30), Math.floor(table.lon[i + 1] / 30)];
    if (a === b) continue;
    const edge = 30 * Math.max(a, b);
    const [jd] = roots((t) => at(table, t) - edge, { jd: table.jd.slice(i - 4, i + 6), lon: table.lon.slice(i - 4, i + 6) });
    out.push({ edge, jd, sign: SIGNS[((b % 12) + 12) % 12].slug });
  }
  return out;
}
/** The engine's measured position bound against Horizons for a body, in arcseconds, as its calc API states it. */
function bound(body: string): number {
  const result = calc({ body: body as never, time: '2026-01-01T00:00:00Z' });
  const position = result.status === 'ok' ? result.bounds.position : null;
  if (!position || position.unit !== 'arcsec' || position.value === null) throw new Error(`No position bound for ${body}`);
  return position.value;
}
/** Where the table's longitude stands still: the station's instant and the direction it turns. */
function stations(table: Table): { jd: number; type: 'retrograde' | 'direct' }[] {
  const speed = (t: number) => (at(table, t + 0.01) - at(table, t - 0.01)) / 0.02;
  return roots(speed, table).map((jd) => ({ jd, type: speed(jd - 0.5) > 0 ? 'retrograde' : 'direct' }));
}

describe('eclipses against NASA\'s Five Millennium Canon, 2025 to 2030', () => {
  const canon = JSON.parse(read(`${SKY_REFERENCES}nasa-eclipses-2025-2030.json`)) as {
    sources: { url: string; sha256: string }[];
    solar: { date: string; greatestEclipseTD: string; type: string }[];
    lunar: { date: string; greatestEclipseTD: string; type: string }[];
  };
  const KIND: Record<string, string> = { T: 'total', A: 'annular', H: 'hybrid', P: 'partial', N: 'penumbral' };
  const tdOf = (row: { date: string; greatestEclipseTD: string }) => Date.parse(`${row.date}T${row.greatestEclipseTD}Z`) / DAY + 2440587.5;
  const rows = [...canon.solar.map((row) => ({ ...row, body: 'solar' })), ...canon.lunar.map((row) => ({ ...row, body: 'lunar' }))];

  it('records where the canon came from', () => {
    expect(canon.sources.map((source) => source.url)).toEqual(['https://eclipse.gsfc.nasa.gov/SEcat5/SE2001-2100.html', 'https://eclipse.gsfc.nasa.gov/LEcat5/LE2001-2100.html']);
    for (const source of canon.sources) expect(source.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(rows).toHaveLength(28);
  });

  it('finds every eclipse from 2026 to 2030 at the canon\'s greatest eclipse, within 30 seconds, and of the same type', async () => {
    const found = await search({ kinds: ['solar-eclipse', 'lunar-eclipse'], from: '2026-01-01', to: '2027-12-31', limit: 100 });
    found.push(...await search({ kinds: ['solar-eclipse', 'lunar-eclipse'], from: '2028-01-01', to: '2029-12-31', limit: 100 }));
    found.push(...await search({ kinds: ['solar-eclipse', 'lunar-eclipse'], from: '2030-01-01', to: '2030-12-31', limit: 100 }));
    const expected = rows.filter((row) => row.date >= '2026');
    expect(found).toHaveLength(expected.length);
    expect(expected).toHaveLength(24);
    for (const row of expected) {
      const event = found.find((candidate) => candidate.kind === `${row.body}-eclipse` && Math.abs(jdTT(candidate.at.utc) - tdOf(row)) < 0.5);
      expect(event, `${row.body} ${row.date}`).toBeDefined();
      expect(Math.abs(jdTT(event!.at.utc) - tdOf(row)) * 86_400, `${row.body} ${row.date}`).toBeLessThanOrEqual(30);
      expect(event!.type, `${row.body} ${row.date}`).toBe(KIND[row.type[0]]);
    }
  });

  it('gives 2025\'s eclipses, outside the tool\'s table, by the same search the table is built with, and says the tool does not list them', async () => {
    const solar = [SearchGlobalSolarEclipse(MakeTime(new Date('2025-01-01T00:00:00Z')))];
    solar.push(NextGlobalSolarEclipse(solar[0].peak));
    const lunar = [SearchLunarEclipse(MakeTime(new Date('2025-01-01T00:00:00Z')))];
    lunar.push(NextLunarEclipse(lunar[0].peak));
    const computed = [...solar.map((eclipse) => ({ body: 'solar', tt: eclipse.peak.tt + J2000, kind: eclipse.kind })), ...lunar.map((eclipse) => ({ body: 'lunar', tt: eclipse.peak.tt + J2000, kind: eclipse.kind }))];
    const expected = rows.filter((row) => row.date < '2026');
    expect(expected).toHaveLength(4);
    for (const row of expected) {
      const match = computed.find((eclipse) => eclipse.body === row.body && Math.abs(eclipse.tt - tdOf(row)) < 0.5);
      expect(match, `${row.body} ${row.date}`).toBeDefined();
      expect(Math.abs(match!.tt - tdOf(row)) * 86_400, `${row.body} ${row.date}`).toBeLessThanOrEqual(30);
      expect(String(match!.kind), `${row.body} ${row.date}`).toBe(KIND[row.type[0]]);
    }
    const result = await executeAiTool('search_sky_events', { kinds: ['solar-eclipse', 'lunar-eclipse'], from: '2025-01-01', to: '2025-12-31' }, on);
    if (!result.ok || result.tool !== 'search_sky_events') throw new Error(JSON.stringify(result));
    expect(result.data.events).toEqual([]);
    expect(result.data.message).toContain('Eclipses are listed from 1 January 2026 to 31 December 2030, the years the eclipse table covers.');
  });
});

describe('new and full Moons and the Sun\'s sign changes against JPL Horizons', () => {
  const PAIRS = [
    [`${PIPELINE}moon-from-2025-12-31.txt`, `${SKY_REFERENCES}horizons/sun-from-2025-12-31.txt`],
    [`${PIPELINE}moon-from-2026-03-01.txt`, `${SKY_REFERENCES}horizons/sun-from-2026-03-01.txt`],
    [`${SKY_REFERENCES}horizons/moon-from-2028-12-15.txt`, `${SKY_REFERENCES}horizons/sun-from-2028-12-15.txt`],
  ];

  it('keeps each Horizons response as its manifest records it', () => {
    const manifest = JSON.parse(read(`${SKY_REFERENCES}horizons/MANIFEST.json`)) as { api: string; responses: Record<string, { file: string; sha256: string; query: Record<string, string>; source: { targetSource: string } }> };
    expect(manifest.api).toBe('https://ssd.jpl.nasa.gov/api/horizons.api');
    expect(Object.keys(manifest.responses).sort()).toEqual(['moon-from-2028-12-15', 'sun-from-2025-12-31', 'sun-from-2026-03-01', 'sun-from-2028-12-15']);
    for (const entry of Object.values(manifest.responses)) {
      expect(createHash('sha256').update(readFileSync(new URL(`${SKY_REFERENCES}horizons/${entry.file}`, root))).digest('hex'), entry.file).toBe(entry.sha256);
      expect(entry.query).toMatchObject({ EPHEM_TYPE: 'OBSERVER', CENTER: '500@399', TIME_TYPE: 'TT', QUANTITIES: '31', APPARENT: 'AIRLESS' });
      expect(entry.source.targetSource).toBe('DE441');
    }
  });

  it('times every new and full Moon within 30 seconds of Horizons', async () => {
    let checked = 0;
    for (const [moonPath, sunPath] of PAIRS) {
      const moon = horizons(moonPath);
      const sun = horizons(sunPath);
      expect(sun.jd).toEqual(moon.jd);
      for (const [kind, target] of [['new-moon', 0], ['full-moon', 180]] as const) {
        for (const jd of roots((t) => wrap(at(moon, t) - at(sun, t) - target), moon)) {
          const events = await search({ kinds: [kind], from: dayOf(jd, -2), to: dayOf(jd, 2) });
          const event = events.find((candidate) => Math.abs(jdTT(candidate.at.utc) - jd) < 1);
          expect(event, `${kind} ${dayOf(jd)}`).toBeDefined();
          expect(Math.abs(jdTT(event!.at.utc) - jd) * 86_400, `${kind} ${dayOf(jd)}`).toBeLessThanOrEqual(30);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(9);
  }, 60_000);

  it('puts the Sun on the sign\'s edge, within the engine\'s 3 arcseconds of Horizons, at each sign change it lists', async () => {
    expect(bound('Sun')).toBe(3);
    let checked = 0;
    for (const [, sunPath] of PAIRS) {
      const sun = horizons(sunPath);
      for (const change of signChanges(sun)) {
        const events = await search({ kinds: ['ingress'], planets: ['Sun'], from: dayOf(change.jd, -2), to: dayOf(change.jd, 2) });
        const event = events.find((candidate) => candidate.sign === change.sign);
        expect(event, `Sun into ${change.sign}`).toBeDefined();
        expect(Math.abs(at(sun, jdTT(event!.at.utc)) - change.edge) * 3600, `Sun into ${change.sign}`).toBeLessThanOrEqual(bound('Sun'));
        checked += 1;
      }
    }
    // Aquarius and Aries in 2026; Capricorn and Aquarius over 2028 to 2029.
    expect(checked).toBe(4);
  }, 60_000);
});

describe('stations and the slow planets\' sign changes against JPL Horizons', () => {
  const TABLES = [
    ['Mercury', 'mercury-2026-03.txt', 5], ['Jupiter', 'jupiter-2019-2020.txt', 20], ['Saturn', 'saturn-2016-2082.txt', 20],
    ['Uranus', 'uranus-2019-2020.txt', 20], ['Neptune', 'neptune-2019-2020.txt', 20], ['Pluto', 'pluto-2019-2020.txt', 20],
  ] as const;
  /** Saturn's table runs to 2082; the checks keep to the tool's own years ahead, 2026 to 2028. */
  const keep = (planet: string, jd: number) => planet !== 'Saturn' || (jd > 2461041 && jd < 2462138);

  it('times every station within 5 minutes for Mercury and 20 for Jupiter to Pluto, turning the same way', async () => {
    let checked = 0;
    for (const [planet, file, minutes] of TABLES) {
      for (const station of stations(horizons(`${PIPELINE}${file}`)).filter((candidate) => keep(planet, candidate.jd))) {
        const events = await search({ kinds: ['station'], planets: [planet], from: dayOf(station.jd, -5), to: dayOf(station.jd, 5) });
        const event = events.find((candidate) => Math.abs(jdTT(candidate.at.utc) - station.jd) < 3);
        expect(event, `${planet} ${dayOf(station.jd)}`).toBeDefined();
        expect(event!.type, `${planet} ${dayOf(station.jd)}`).toBe(station.type);
        expect(Math.abs(jdTT(event!.at.utc) - station.jd) * 1440, `${planet} ${dayOf(station.jd)}`).toBeLessThanOrEqual(minutes);
        checked += 1;
      }
    }
    // Mercury 2, Jupiter, Uranus, Neptune and Pluto 4 each, Saturn 5 (July 2026 to August 2028).
    expect(checked).toBe(23);
  }, 120_000);

  it('agrees with the reference pipeline\'s two Horizons stations', async () => {
    for (const [id, planet, minutes] of [['Mstation', 'Mercury', 5], ['Sstation', 'Saturn', 20]] as const) {
      const reference = eightCases.stations.find((station) => station.id === id)!;
      const instant = reference.analyticStationMilliseconds;
      const day = new Date(instant).toISOString().slice(0, 10);
      const events = await search({ kinds: ['station'], planets: [planet], from: day, to: day });
      expect(events, id).toHaveLength(1);
      expect(Math.abs(Date.parse(events[0].at.utc) - instant) / 60_000, id).toBeLessThanOrEqual(minutes);
    }
  });

  it('puts each planet on the sign\'s edge, within the engine\'s own bound against Horizons, at the sign changes in the ingress table', async () => {
    expect([bound('Jupiter'), bound('Saturn'), bound('Uranus')]).toEqual([13, 18, 20]);
    // Jupiter into Capricorn and Aquarius, Saturn into Aries and Taurus, Uranus into Taurus.
    const expected = [['Jupiter', 'jupiter-2019-2020.txt', 2], ['Saturn', 'saturn-2016-2082.txt', 2], ['Uranus', 'uranus-2019-2020.txt', 1]] as const;
    for (const [planet, file, count] of expected) {
      const table = horizons(`${PIPELINE}${file}`);
      // Jupiter's table covers 2014 to 2045 and Saturn's 1980 to 2079 in the tool; Saturn's checks keep to 2026 to 2028.
      const changes = signChanges(table).filter((change) => keep(planet, change.jd) && (planet !== 'Jupiter' || change.jd > 2458800));
      expect(changes, planet).toHaveLength(count);
      for (const change of changes) {
        const events = await search({ kinds: ['ingress'], planets: [planet], from: dayOf(change.jd, -3), to: dayOf(change.jd, 3) });
        const event = events.find((candidate) => candidate.sign === change.sign);
        expect(event, `${planet} into ${change.sign}`).toBeDefined();
        expect(Math.abs(at(table, jdTT(event!.at.utc)) - change.edge) * 3600, `${planet} into ${change.sign}`).toBeLessThanOrEqual(bound(planet));
      }
    }
  }, 60_000);
});

describe('the natal chart\'s lunar nodes against the reference pipeline\'s true nodes', () => {
  it('prints the North Node in the arcminute that holds the Horizons true node, and the South Node opposite', async () => {
    const parse = (position: string) => {
      const match = /^(\d+)°(\d{2})′ (\w+)$/u.exec(position)!;
      return SIGNS.findIndex((sign) => sign.name === match[3]) * 30 + Number(match[1]) + Number(match[2]) / 60;
    };
    expect(nodePolar.trueNode).toHaveLength(3);
    for (const reference of nodePolar.trueNode) {
      const [date, clock] = reference.input.utc.split('T');
      const result = await executeAiTool('get_natal_chart', { birthDate: date, time: clock.slice(0, 5), zone: 'UTC', latitude: 0, longitude: 0 }, on);
      if (!result.ok || result.tool !== 'get_natal_chart' || !('nodes' in result.data)) throw new Error(JSON.stringify(result));
      const { nodes } = result.data as NatalChartDataWithNodes;
      const { north, south } = nodes;
      // The printed arcminute is the engine's, floored; the engine's true node is within arcseconds of Horizons'.
      const shown = parse(north.position!);
      expect(wrap(reference.longitudeDegrees - shown), reference.id).toBeGreaterThan(-0.003);
      expect(wrap(reference.longitudeDegrees - shown), reference.id).toBeLessThan(1 / 60 + 0.003);
      expect(Math.abs(wrap(parse(south.position!) - shown - 180)), reference.id).toBeLessThan(1 / 60 + 1e-9);
      expect(nodes.node).toBe('true');
    }
  });
});
