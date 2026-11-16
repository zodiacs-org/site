import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '@zodiacs/engine';
import { executeAiTool } from '../tools';
import { computeEvents } from '../../lib/compute-api/endpoints';
import { parseEventsRequest } from '../../lib/compute-api/validate';
import { engineIngressInstant, ingressBoundary } from './engine-ingress';
import nasa from '../../data/nasa-event-instants.json';
import committedWindow from '../../data/horoscope-window.json';
import committedMonths from '../../data/horoscope-months.json';
import committedProgram from '../../data/horoscope-program.json';
import type { HoroscopeWindow } from '../horoscope/window';
import type { HoroscopeProgram } from '../../lib/horoscope-program-types';

/**
 * ZOD-63: one time for a planet's sign change in every connector tool. The expected times are the engine's
 * own (get_upcoming_events' search), and their distance from NASA JPL Horizons is read from the committed
 * Horizons table (src/data/nasa-event-instants.json), never from the engine.
 */
const now = () => new Date('2026-01-01T00:00:00Z');
const dependencies = {
  occasions: true, coverage: true, skyEvents: true, now,
  horoscopeWindow: async () => committedWindow as HoroscopeWindow,
  horoscopeMonths: async () => committedMonths,
  horoscopeProgram: async () => committedProgram as unknown as HoroscopeProgram,
};
const NASA_NEPTUNE_ARIES = '2026-01-26T17:35:23Z';
type NasaRow = { body: string; sign: string; retrograde: boolean; nasa: string };
const nasaRow = (body: string, sign: string, day: string) => (nasa.ingresses as NasaRow[]).find((row) => row.body === body && row.sign === sign && row.nasa.startsWith(day))!;

async function tool(name: string, args: Record<string, unknown>) {
  const result = await executeAiTool(name as never, args, dependencies);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.data as any;
}

/** The engine's sign changes over a window, as get_upcoming_events solves them, in windows the compute API takes. */
function engineIngresses(from: string, to: string, bodies: string[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (let start = Date.parse(from); start < Date.parse(to); start += 90 * 86_400_000) {
    const end = Math.min(start + 90 * 86_400_000, Date.parse(to));
    const events = computeEvents(parseEventsRequest({ from: new Date(start).toISOString(), to: new Date(end).toISOString(), kinds: ['ingress'], bodies })).result.events;
    for (const event of events as { body: string; sign: string; at: string; retrograde: boolean }[]) {
      const key = `${event.body}|${event.sign}|${event.retrograde}`;
      out.set(key, [...(out.get(key) ?? []), Date.parse(event.at)]);
    }
  }
  return out;
}

describe('a planet\'s sign change has one time across the connector', () => {
  it('runs on engine 1.1.0', () => {
    expect(ENGINE_VERSION).toBe('1.1.0');
  });

  it('names the boundary a planet crosses, forward and backward', () => {
    expect(ingressBoundary('aries', false)).toBe(0);
    expect(ingressBoundary('pisces', true)).toBe(0);
    expect(ingressBoundary('gemini', false)).toBe(60);
    expect(ingressBoundary('capricorn', true)).toBe(300);
  });

  it('gives Neptune into Aries on 26 January 2026 within a minute of NASA\'s time, the same in every tool', async () => {
    const upcoming = await tool('get_upcoming_events', { from: '2026-01-25T00:00:00Z', to: '2026-01-28T00:00:00Z' });
    const solved = upcoming.calculation.result.events.find((event: { kind: string; body: string }) => event.kind === 'ingress' && event.body === 'Neptune');
    expect(solved).toMatchObject({ sign: 'aries', retrograde: false });
    const at = Date.parse(solved.at);
    expect(Math.abs(at - Date.parse(NASA_NEPTUNE_ARIES))).toBeLessThan(60_000);

    const search = await tool('search_sky_events', { from: '2026-01-01', to: '2026-02-28', kinds: ['ingress'], planets: ['Neptune'] });
    expect(search.events).toHaveLength(1);
    expect(Math.abs(Date.parse(search.events[0].at.utc) - at)).toBeLessThan(1_000);

    const year = await tool('get_horoscope_period', { sign: 'aries', period: 'year', date: '2026-03-01' });
    const neptune = year.sky.find((event: { kind: string; planet: string }) => event.kind === 'ingress' && event.planet === 'Neptune');
    expect(neptune).toMatchObject({ sign: 'aries', date: 'Mon 26 Jan' });
    expect(Math.abs(Date.parse(neptune.utc) - at)).toBeLessThan(1_000);

    const month = await tool('get_horoscope_period', { sign: 'aries', period: 'month', date: '2026-01-15' });
    const inMonth = month.sky.find((event: { kind: string; planet: string }) => event.kind === 'ingress' && event.planet === 'Neptune');
    expect(Math.abs(Date.parse(inMonth.utc) - at)).toBeLessThan(1_000);

    // On Tokyo's clock NASA's time is on the 27th, and so is the engine's now: check_sky_fact agrees.
    expect((await tool('check_sky_fact', { kind: 'ingress', body: 'Neptune', sign: 'aries', date: '2026-01-27', zone: 'Asia/Tokyo' })).answer).toBe('true');
    expect((await tool('check_sky_fact', { kind: 'ingress', body: 'Neptune', sign: 'aries', date: '2026-01-26', zone: 'Asia/Tokyo' })).answer).toBe('false');
  });

  it('gives every sign change search_sky_events lists in 2026 and 2027 at get_upcoming_events\' time', async () => {
    const bodies = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
    const engine = engineIngresses('2026-01-01T00:00:00Z', '2027-12-31T00:00:00Z', bodies);
    const listed = [];
    for (const [from, to] of [['2026-01-02', '2026-06-30'], ['2026-07-01', '2026-12-31'], ['2027-01-01', '2027-06-30'], ['2027-07-01', '2027-12-29']]) {
      const found = await tool('search_sky_events', { from, to, kinds: ['ingress'], planets: bodies, limit: 100 });
      expect(found.events.length).toBeLessThan(100);
      listed.push(...found.events.filter((event: { planet: string }) => event.planet !== 'Chiron'));
    }
    expect(listed.length).toBeGreaterThan(80);
    for (const event of listed) {
      const retrograde = /moves back/u.test(event.title);
      const times = engine.get(`${event.planet}|${event.sign}|${retrograde}`) ?? [];
      // The same instant: each search bisects its own bracket, so they agree to a fraction of a second.
      const nearest = Math.min(...times.map((at) => Math.abs(Date.parse(event.at.utc) - at)));
      expect(nearest, `${event.title} ${event.at.utc}`).toBeLessThan(1_000);
    }
  });

  it('puts the slow planets\' recent sign changes within minutes of NASA\'s, where the table had them hours away', () => {
    const cases: [string, string, boolean, string][] = [
      ['Neptune', 'aries', false, '2026-01-26'],
      ['Saturn', 'aries', false, '2026-02-14'],
      ['Uranus', 'gemini', false, '2026-04-26'],
      ['Uranus', 'gemini', false, '2025-07-07'],
      ['Saturn', 'aries', false, '2025-05-25'],
      ['Pluto', 'aquarius', false, '2024-11-19'],
    ];
    for (const [body, sign, retrograde, day] of cases) {
      const row = nasaRow(body, sign, day);
      const at = engineIngressInstant(body, sign, retrograde, new Date(row.nasa));
      expect(Math.abs(at.getTime() - Date.parse(row.nasa)) / 1000, `${body} ${sign} ${day}`).toBeLessThan(body === 'Pluto' ? 180 : 60);
    }
  });
});
