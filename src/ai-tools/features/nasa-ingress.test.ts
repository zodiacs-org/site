/**
 * ZOD-63: the AI tools give a planet's sign change at the time NASA JPL Horizons gives, as the pages do.
 *
 * The reference here is independent of the engine: docs/accuracy-audit-2026-11/truth-events.json, the sign
 * changes solved on NASA JPL Horizons (DE441) tables by scripts/accuracy-audit/truth.py, and
 * src/data/nasa-event-instants.json, built from the same tables. CI cannot reach NASA, so the committed files
 * are the reference; no expected time below comes from the engine.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OUTPUT_SCHEMAS } from '../contracts';
import { executeAiTool, type AiDependencies } from '../tools';
import committedWindow from '../../data/horoscope-window.json';
import committedMonths from '../../data/horoscope-months.json';
import committedProgram from '../../data/horoscope-program.json';
import type { HoroscopeWindow } from '../horoscope/window';
import type { HoroscopeProgram } from '../../lib/horoscope-program-types';
import {
  NASA_INGRESS_BODIES,
  checkIngressFact,
  largestCorrectionSeconds,
  largestCorrectionWords,
  nasaCoversIngress,
  nasaIngressCoverage,
  nasaIngressNear,
  nasaIngressesBetween,
  refineIngressEvents,
} from './nasa-ingress';

const read = <T>(path: string): T => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as T;
/** NASA's sign changes, solved independently of the engine. */
const truth = read<{ ingresses: Record<string, { at: string; sign: string; retrograde: boolean }[]> }>('docs/accuracy-audit-2026-11/truth-events.json');
const ingressTable = read<{ horizons: { planets: string[]; from: string; to: string }[]; windows: { planet: string; sign: string; from: string; to: string }[] }>('src/data/ingresses.json');

/** NASA's instant for a body entering a sign near `near`, from the audit's solved events. */
function nasaTruth(body: string, sign: string, near: string): number {
  const found = truth.ingresses[body].filter((event) => event.sign === sign && Math.abs(Date.parse(event.at) - Date.parse(near)) < 3 * 86_400_000);
  expect(found, `${body} ${sign} ${near}`).toHaveLength(1);
  return Date.parse(found[0].at);
}

/** NASA's time for Neptune entering Aries in 2026, to the second: 17:35:23 UTC on 26 January. */
const NEPTUNE_ARIES = '2026-01-26T17:35:23.000Z';
/** The engine's own crossing, which the tools used to give. */
const NEPTUNE_ARIES_ENGINE_DAY_AND_HOUR = '2026-01-26T14:3';

const NOW = new Date('2026-11-11T12:00:00Z');
const dependencies: AiDependencies = {
  occasions: true, coverage: true, skyEvents: true, now: () => NOW,
  horoscopeWindow: async () => committedWindow as HoroscopeWindow,
  horoscopeMonths: async () => committedMonths,
  horoscopeProgram: async () => committedProgram as unknown as HoroscopeProgram,
};
type Link = { title: string; url: string };
type Answer = { ok: boolean; data: Record<string, unknown>; links: Link[] };
async function call(tool: Parameters<typeof executeAiTool>[0], args: Record<string, unknown>): Promise<Answer> {
  const result = await executeAiTool(tool, args, dependencies, {});
  expect(result.ok, `${tool} ${JSON.stringify(result)}`).toBe(true);
  return result as unknown as Answer;
}

describe('the reference: NASA\'s time for Neptune entering Aries', () => {
  it('is 17:35:23 UTC on 26 January 2026 in the audit\'s solved events and in the NASA table', () => {
    const solved = nasaTruth('Neptune', 'aries', '2026-01-26T12:00:00Z');
    expect(Math.abs(solved - Date.parse(NEPTUNE_ARIES))).toBeLessThan(1000);
    expect(nasaIngressNear('Neptune', 'aries', '2026-01-26T14:31:41.082Z')).toBe(NEPTUNE_ARIES);
  });

  it('holds every sign change in the NASA table to the audit\'s solved events within a second', () => {
    let rows = 0;
    for (const body of NASA_INGRESS_BODIES) {
      const span = nasaIngressCoverage(body)!;
      for (const row of nasaIngressesBetween(body, new Date(`${span.from}T00:00:00Z`), new Date(`${span.to}T00:00:00Z`))) {
        expect(Math.abs(Date.parse(row.at) - nasaTruth(body, row.sign, row.at)), `${body} ${row.sign} ${row.at}`).toBeLessThan(1000);
        rows += 1;
      }
    }
    expect(rows).toBe(498);
    expect([...NASA_INGRESS_BODIES].sort()).toEqual(['Jupiter', 'Mars', 'Mercury', 'Neptune', 'Pluto', 'Saturn', 'Uranus', 'Venus']);
  });
});

describe('the tools give Neptune entering Aries at NASA\'s time', () => {
  it('get_upcoming_events lists it at 17:35:23 UTC, and keeps the engine\'s receipted calculation as it was', async () => {
    const answer = await call('get_upcoming_events', { from: '2026-01-25T00:00:00Z', to: '2026-01-28T00:00:00Z', kinds: ['ingress'], bodies: ['Neptune'] });
    expect(answer.data.events).toEqual([{ kind: 'ingress', at: NEPTUNE_ARIES, localAt: '26/01/2026, 17:35:23 GMT+0', body: 'Neptune', sign: 'aries', retrograde: false }]);
    const calculation = answer.data.calculation as { result: { events: { at: string }[] }; receipt: { search: { solver: string } } };
    expect(calculation.result.events).toHaveLength(1);
    expect(calculation.result.events[0].at.startsWith(NEPTUNE_ARIES_ENGINE_DAY_AND_HOUR)).toBe(true);
    expect(calculation.receipt.search.solver).toBe('engine-longitude-crossings');
    expect(answer.links[0]).toEqual({ title: 'Sign-change times of Mercury through Pluto are NASA JPL Horizons times; the calculation block keeps the engine\'s own', url: 'https://zodiacs.org/methodology/#event-times' });
    // The published output schema takes the answer as it is: no field was added.
    expect(OUTPUT_SCHEMAS.get_upcoming_events.safeParse(answer).success).toBe(true);
  });

  it('get_upcoming_events shows the time on the person\'s clock', async () => {
    const answer = await call('get_upcoming_events', { from: '2026-01-25T00:00:00Z', to: '2026-01-28T00:00:00Z', kinds: ['ingress'], bodies: ['Neptune'], zone: 'Asia/Tokyo' });
    expect((answer.data.events as { localAt: string }[])[0].localAt).toBe('27/01/2026, 02:35:23 GMT+9');
  });

  it('search_sky_events lists it at 17:35:23 UTC and still links its page', async () => {
    const answer = await call('search_sky_events', { kinds: ['ingress'], planets: ['Neptune'], from: '2026-01-01', to: '2026-12-31' });
    const events = answer.data.events as { title: string; at: { utc: string; local: string }; pageUrl: string | null }[];
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Neptune enters Aries');
    expect(events[0].at).toEqual({ utc: NEPTUNE_ARIES, local: 'Mon 26 Jan 2026, 17:35 UTC' });
    expect(events[0].pageUrl).toBe('https://zodiacs.org/events/neptune-enters-aries-2026-01-26/');
  });

  it('get_horoscope_period dates it at 17:35:23 UTC in the year\'s sky', async () => {
    const answer = await call('get_horoscope_period', { sign: 'aries', period: 'year', date: '2026-06-01' });
    const sky = answer.data.sky as { kind: string; planet: string; sign: string; utc: string; date: string }[];
    const neptune = sky.filter((event) => event.kind === 'ingress' && event.planet === 'Neptune');
    expect(neptune.map((event) => [event.sign, event.utc])).toEqual([['aries', NEPTUNE_ARIES]]);
  });

  it('check_sky_fact names NASA\'s time beside its verdict', async () => {
    const answer = await call('check_sky_fact', { kind: 'ingress', body: 'Neptune', sign: 'aries', date: '2026-01-26' });
    expect(answer.data.answer).toBe('depends');
    expect(answer.links[0]).toEqual({ title: 'By NASA JPL Horizons, Neptune enters Aries at 2026-01-26T17:35:23Z; the verdict follows NASA\'s time, and the calculation block keeps the engine\'s own', url: 'https://zodiacs.org/methodology/#event-times' });
    expect(OUTPUT_SCHEMAS.check_sky_fact.safeParse(answer).success).toBe(true);
  });
});

describe('check_sky_fact judges a sign change on NASA\'s time', () => {
  // By NASA the entry is at 02:35 on 27 January in Tokyo; the engine's own crossing is at 23:31 on the 26th.
  it('says Neptune did not enter Aries on 26 January 2026 in Tokyo, and did on the 27th', async () => {
    const on26 = await call('check_sky_fact', { kind: 'ingress', body: 'Neptune', sign: 'aries', date: '2026-01-26', zone: 'Asia/Tokyo' });
    expect(on26.data.answer).toBe('false');
    expect(on26.links[0].title).toBe('By NASA JPL Horizons, Neptune enters Aries at 2026-01-26T17:35:23Z, outside this day; the verdict follows NASA\'s time, and the calculation block keeps the engine\'s own');
    const on27 = await call('check_sky_fact', { kind: 'ingress', body: 'Neptune', sign: 'aries', date: '2026-01-27', zone: 'Asia/Tokyo' });
    expect(on27.data.answer).toBe('true');
    expect(on27.links[0].title).toMatch(/^By NASA JPL Horizons, Neptune enters Aries at 2026-01-26T17:35:23Z;/u);
  });

  it('agrees with the engine where the day is the same on both times', async () => {
    const honolulu = await call('check_sky_fact', { kind: 'ingress', body: 'Neptune', sign: 'aries', date: '2026-01-26', zone: 'Pacific/Honolulu' });
    expect(honolulu.data.answer).toBe('true');
    const other = await call('check_sky_fact', { kind: 'ingress', body: 'Neptune', sign: 'aries', date: '2026-03-01' });
    expect(other.data.answer).toBe('false');
    expect(other.links.map((link) => link.title)).not.toContain(expect.stringMatching(/NASA JPL Horizons/u));
  });

  it('leaves the Sun\'s and the Moon\'s sign changes, and every other kind of check, to the engine', async () => {
    const sun = await call('check_sky_fact', { kind: 'ingress', body: 'Sun', sign: 'aries', date: '2026-03-20' });
    expect(sun.data.answer).toBe((sun.data.calculation as { result: { answer: string } }).result.answer);
    expect(sun.links.some((link) => /NASA/u.test(link.title))).toBe(false);
    expect(checkIngressFact('https://zodiacs.org', { answer: 'true', basis: 'local-day', fact: { kind: 'ingress', body: 'Moon', sign: 'aries' }, window: { from: '2026-01-26T00:00:00.000Z', to: '2026-01-27T00:00:00.000Z' }, facts: { ingresses: [] } })).toBeNull();
  });
});

describe('a window is read on NASA\'s times', () => {
  it('adds a sign change NASA puts inside the window and drops one NASA puts outside it', async () => {
    const after = await call('get_upcoming_events', { from: '2026-01-26T15:00:00Z', to: '2026-01-26T18:00:00Z', kinds: ['ingress'], bodies: ['Neptune'] });
    expect((after.data.calculation as { result: { events: unknown[] } }).result.events).toEqual([]);
    expect((after.data.events as { at: string; sign: string }[]).map((event) => [event.at, event.sign])).toEqual([[NEPTUNE_ARIES, 'aries']]);
    const before = await call('get_upcoming_events', { from: '2026-01-26T14:00:00Z', to: '2026-01-26T15:00:00Z', kinds: ['ingress'], bodies: ['Neptune'] });
    expect((before.data.calculation as { result: { events: unknown[] } }).result.events).toHaveLength(1);
    expect(before.data.events).toEqual([]);
  });

  it('keeps stations, lunations and the Sun\'s and the Moon\'s sign changes as the search found them', () => {
    const events = [
      { kind: 'ingress', body: 'Sun', at: '2026-01-20T01:44:40.353Z', sign: 'aquarius', retrograde: false },
      { kind: 'ingress', body: 'Moon', at: '2026-01-26T05:00:00.000Z', sign: 'taurus', retrograde: false },
      { kind: 'ingress', body: 'Neptune', at: '2026-01-26T14:31:41.082Z', sign: 'aries', retrograde: false },
      { kind: 'lunation', at: '2026-02-01T22:09:00.000Z', sign: 'leo' },
      { kind: 'station', body: 'Mercury', at: '2026-02-26T06:48:00.000Z', sign: 'pisces' },
    ];
    const refined = refineIngressEvents(events, new Date('2026-01-01T00:00:00Z'), new Date('2026-03-01T00:00:00Z'), []);
    expect(refined.events.filter((event) => event.body !== 'Neptune')).toEqual(events.filter((event) => event.body !== 'Neptune'));
    expect(refined.events.find((event) => event.body === 'Neptune')!.at).toBe(NEPTUNE_ARIES);
    expect(refined.engineOnly).toEqual([]);
  });

  it('gives every sign change search_sky_events lists for Mercury through Pluto at NASA\'s solved time', async () => {
    let checked = 0;
    for (const [from, to] of [['1990-01-01', '1991-12-31'], ['2026-01-01', '2027-12-31'], ['2060-01-01', '2061-12-31']]) {
      const answer = await call('search_sky_events', { kinds: ['ingress'], planets: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'], from, to, limit: 100 });
      for (const event of answer.data.events as { planet: string; sign: string; at: { utc: string } }[]) {
        expect(Math.abs(Date.parse(event.at.utc) - nasaTruth(event.planet, event.sign, event.at.utc)), `${event.planet} ${event.sign} ${event.at.utc}`).toBeLessThan(1000);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});

describe('outside the dates NASA\'s table covers', () => {
  it('covers the long horizons of the ingress table for the slow planets', () => {
    for (const horizon of ingressTable.horizons) {
      for (const planet of horizon.planets.filter((name) => ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(name))) {
        expect(nasaCoversIngress(planet, `${horizon.from}T00:00:00Z`), planet).toBe(true);
        expect(nasaCoversIngress(planet, `${horizon.to}T00:00:00Z`), planet).toBe(true);
      }
    }
    expect(nasaCoversIngress('Neptune', '1861-04-13T00:00:00Z')).toBe(false);
    expect(nasaCoversIngress('Mercury', '2035-01-01T00:00:00Z')).toBe(false);
    expect(nasaCoversIngress('Sun', '2026-03-20T00:00:00Z')).toBe(false);
  });

  it('get_upcoming_events keeps the engine\'s time and says how far such a time has been from NASA\'s', async () => {
    // Neptune's entry into Aries in 1861, before the table's first year.
    const answer = await call('get_upcoming_events', { from: '1861-03-01T00:00:00Z', to: '1861-05-30T00:00:00Z', kinds: ['ingress'], bodies: ['Neptune'] });
    const events = answer.data.events as { at: string; sign: string }[];
    expect(events.map((event) => event.sign)).toEqual(['aries']);
    expect(events[0].at).toBe((answer.data.calculation as { result: { events: { at: string }[] } }).result.events[0].at);
    expect(answer.links[0]).toEqual({
      title: 'Not checked against NASA at these dates: the sign-change time of Neptune is the engine\'s own. Where it was checked it was up to about 8 hours 8 minutes for Neptune from NASA\'s, and it can be more here',
      url: 'https://zodiacs.org/methodology/#event-times',
    });
    expect(OUTPUT_SCHEMAS.get_upcoming_events.safeParse(answer).success).toBe(true);
  });

  it('measures those gaps from the table\'s own rows: NASA\'s instant against the engine instants it replaces', () => {
    const hours = (body: string) => largestCorrectionSeconds(body)! / 3600;
    expect(hours('Neptune')).toBeGreaterThan(8);
    expect(hours('Neptune')).toBeLessThan(8.25);
    expect(hours('Pluto')).toBeGreaterThan(9.5);
    expect(hours('Pluto')).toBeLessThan(9.75);
    expect(hours('Uranus')).toBeLessThan(3);
    expect(hours('Saturn')).toBeLessThan(2);
    expect(hours('Jupiter')).toBeLessThan(0.5);
    expect(largestCorrectionWords('Pluto')).toBe('about 9 hours 37 minutes');
    expect(largestCorrectionWords('Mars')).toBe('about 3 minutes');
    expect(largestCorrectionSeconds('Sun')).toBeUndefined();
  });

  it('is what the methodology page says', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/methodology/index.astro'), 'utf8').replace(/\s+/gu, ' ');
    expect(page).toContain('Jupiter\'s from 2014 to 2045, Saturn\'s from 1980 to 2079, and those of Uranus, Neptune and Pluto from 1900 to 2099');
    const years = (planet: string) => { const horizon = ingressTable.horizons.find((entry) => entry.planets.includes(planet))!; return [Number(horizon.from.slice(0, 4)), Number(horizon.to.slice(0, 4)) - 1]; };
    expect(years('Jupiter')).toEqual([2014, 2045]);
    expect(years('Saturn')).toEqual([1980, 2079]);
    for (const planet of ['Uranus', 'Neptune', 'Pluto']) expect(years(planet)).toEqual([1900, 2099]);
    expect(page).toContain('up to about 8 hours from NASA\'s for Neptune and about 9 and a half hours for Pluto');
    expect(Math.round(largestCorrectionSeconds('Neptune')! / 1800) / 2).toBe(8);
    expect(Math.round(largestCorrectionSeconds('Pluto')! / 1800) / 2).toBe(9.5);
    expect(page).toContain('By NASA, Neptune entered Aries at 17:35 UTC on January 26, 2026');
  });
});
