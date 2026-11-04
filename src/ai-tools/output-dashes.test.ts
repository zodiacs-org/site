import { describe, expect, it } from 'vitest';
import { executeAiTool } from './tools';
import { plainDashes } from './plain-text';
import committedWindow from '../data/horoscope-window.json';
import committedMonths from '../data/horoscope-months.json';
import committedProgram from '../data/horoscope-program.json';
import type { HoroscopeWindow } from './horoscope/window';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';
import { loadPlaceTable } from './features/place-table';

/**
 * Tool results must not contain an en dash (U+2013) or an em dash (U+2014).
 * The thirteen published definitions still contain "(years 1800–2199)" in
 * input descriptions. That text is for the model, it cannot change, and this
 * check does not read it. A minus sign and an arrow are not dashes.
 */
const DASH = /[–—]/u;
const sources = {
  occasions: true,
  coverage: true,
  now: () => new Date('2026-11-04T12:00:00Z'),
  horoscopeWindow: async () => committedWindow as HoroscopeWindow,
  horoscopeMonths: async () => committedMonths,
  horoscopeProgram: async () => committedProgram as unknown as HoroscopeProgram,
  placeTable: async () => loadPlaceTable(),
};

describe('MCP tool output has no en or em dashes', () => {
  it('rewrites ranges and breaks without touching a minus sign', () => {
    expect(plainDashes('Painter · Mexico · 1907–1954')).toBe('Painter · Mexico · 1907 to 1954');
    expect(plainDashes('Apr 20 – May 20')).toBe('Apr 20 to May 20');
    expect(plainDashes('Coyoacán—a reference instant, not a birth time.')).toBe('Coyoacán, a reference instant, not a birth time.');
    expect(plainDashes('an exact opposition — near enough that the tradition reads it as one')).toBe('an exact opposition, near enough that the tradition reads it as one');
    expect(plainDashes('ΔT = TT − UT1')).toBe('ΔT = TT − UT1');
    expect(plainDashes('File → New Calendar Subscription')).toBe('File → New Calendar Subscription');
  });

  it('keeps dashes out of forecast, chart, people and place answers', async () => {
    const calls: [string, Record<string, unknown>][] = [
      ['get_famous_chart', { name: 'Frida Kahlo' }],
      ['get_birthday', { date: '05-03' }],
      ['find_chart_twins', { birthDate: '1990-05-15' }],
      ['get_horoscope', { sign: 'leo' }],
      ['get_horoscope_period', { sign: 'leo', period: 'month' }],
      ['get_natal_chart', { birthDate: '1990-05-15', time: '14:30', zone: 'Europe/London', latitude: 51.5074, longitude: -0.1278 }],
      ['get_personal_transits', { birthDate: '1990-05-15', from: '2026-11-01', to: '2026-11-30' }],
      ['get_compatibility', { a: { birthDate: '1990-05-15' }, b: { birthDate: '1992-08-05' } }],
      ['get_occasion_sky', { occasion: 'wedding', date: '2027-06-12' }],
      ['get_capabilities', {}],
      ['find_birthplace', { place: 'Sydney', country: 'Australia', date: '1944-01-15' }],
      ['explain_astrology', { topic: 'Saturn return' }],
    ];
    for (const [tool, args] of calls) {
      const result = await executeAiTool(tool as 'get_capabilities', args, sources);
      expect(JSON.stringify(result), tool).not.toMatch(DASH);
    }
  }, 60_000);
});
