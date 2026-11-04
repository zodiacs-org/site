import { describe, expect, it } from 'vitest';
import { executeAiTool } from '../tools';
import type { NatalChartData } from './natal-chart';

const on = { occasions: true, coverage: true, now: () => new Date('2026-11-02T05:00:00Z') };
async function chart(args: Record<string, unknown>): Promise<NatalChartData> {
  const result = await executeAiTool('get_natal_chart', args, on);
  if (!result.ok || result.tool !== 'get_natal_chart') throw new Error(JSON.stringify(result));
  return result.data;
}
const MADRID = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038, place: 'Madrid, Spain' };

describe('get_natal_chart', () => {
  it('reads a chart with a birth time and place: big three, houses, aspects and balance', async () => {
    const data = await chart(MADRID);
    expect([data.sun.sign, data.moon.sign, data.rising.sign]).toEqual(['taurus', 'leo', 'gemini']);
    expect(data.castFor).toEqual({ utc: '1990-05-03T06:30:00.000Z', basis: 'birth-time' });
    expect(data.houseSystem).toBe('whole-sign');
    expect(data.angles!.ascendant).toMatch(/Gemini$/u);
    expect(data.planets.every((row) => row.sign && row.house && row.houseLine && row.signLine)).toBe(true);
    // Whole-sign houses: Gemini rising puts the Taurus Sun in the twelfth.
    expect(data.planets[0]).toMatchObject({ body: 'Sun', sign: 'taurus', house: 12, pageUrl: 'https://zodiacs.org/learn/placements/sun-in-taurus/' });
    expect(data.aspects.length).toBeGreaterThan(0);
    expect(data.aspects.length).toBeLessThanOrEqual(8);
    expect(data.aspects.map((aspect) => aspect.orb)).toEqual([...data.aspects.map((aspect) => aspect.orb)].sort((a, b) => a - b));
    expect(data.aspects.every((aspect) => aspect.line.includes(aspect.a) || aspect.line.length > 20)).toBe(true);
    const { elements, modalities } = data.balance;
    expect(elements.fire + elements.earth + elements.air + elements.water).toBe(10);
    expect(modalities.cardinal + modalities.fixed + modalities.mutable).toBe(10);
    expect(data.unknown).toEqual([]);
    expect(data.chartUrl).toBe('https://zodiacs.org/birth-chart/');
    expect(data.chartUrl).not.toContain('1990');
    expect(data.sun.meaning).toBeTruthy();
    expect(data.rising.pageUrl).toBe('https://zodiacs.org/rising-sign/gemini/');
  });

  it('says what is unknown without a birth time instead of guessing', async () => {
    const data = await chart({ birthDate: '1990-05-03' });
    expect(data.timeKnown).toBe(false);
    expect(data.rising).toEqual({ sign: null, possibleSigns: [], meaning: null, pageUrl: null });
    // The Moon left Leo for Virgo that day, so both are given and neither is chosen.
    expect(data.moon).toMatchObject({ sign: null, possibleSigns: ['leo', 'virgo'], meaning: null });
    expect(data.houseSystem).toBeNull();
    expect(data.planets.every((row) => row.house === null)).toBe(true);
    expect(data.aspects.some((aspect) => aspect.a === 'Moon' || aspect.b === 'Moon')).toBe(false);
    expect(data.unknown.join(' ')).toContain('rising sign and the houses are unknown');
    expect(data.unknown.join(' ')).toContain('Leo or Virgo');
    expect(data.chartUrl).toBe('https://zodiacs.org/birth-chart/');
  });

  it('states a Moon sign without a time only when the whole birth day keeps it there', async () => {
    // The Moon spent all of 6 May 1990 in Libra on London's clock, and changed sign on the 5th and the 8th.
    const data = await chart({ birthDate: '1990-05-06', zone: 'Europe/London' });
    expect(data.moon).toMatchObject({ sign: 'libra', possibleSigns: ['libra'] });
    expect((await chart({ birthDate: '1990-05-08', zone: 'Europe/London' })).moon).toMatchObject({ sign: null, possibleSigns: ['libra', 'scorpio'] });
    expect(data.unknown.join(' ')).toContain(`stayed in`);
  });

  it('leaves the Sun sign open on a day the Sun changed sign and no time was given', async () => {
    // The Sun entered Aries at about 21:19 UTC on 20 March 1990.
    const data = await chart({ birthDate: '1990-03-20' });
    expect(data.sun).toMatchObject({ sign: null, possibleSigns: ['pisces', 'aries'] });
    expect(data.unknown.join(' ')).toContain('The Sun changed sign that day');
    const timed = await chart({ birthDate: '1990-03-20', time: '09:00', zone: 'Europe/London' });
    expect(timed.sun.sign).toBe('pisces');
  });

  it('lists only the two signs a retrograde body crossed on the birth day', async () => {
    // Mercury, retrograde, went back from Aries into Pisces around the turn of 29 to 30 March 2025.
    const data = await chart({ birthDate: '2025-03-30' });
    const mercury = data.planets.find((row) => row.body === 'Mercury')!;
    expect(mercury.retrograde).toBe(true);
    expect(mercury).toMatchObject({ sign: null, possibleSigns: ['aries', 'pisces'] });
    expect(data.planets.every((row) => row.possibleSigns.length <= 2)).toBe(true);
  });

  it('needs a time zone with a time or a place, and names a missing birth date', async () => {
    expect(await executeAiTool('get_natal_chart', { birthDate: '1990-05-03', time: '08:30' }, on)).toMatchObject({ ok: false, error: { code: 'invalid-request', message: 'A birth time or a place needs its time zone.' } });
    expect(await executeAiTool('get_natal_chart', { time: '08:30', zone: 'Europe/Madrid' }, on)).toMatchObject({ ok: false, error: { message: 'birthDate is required.' } });
    expect(await executeAiTool('get_natal_chart', { birthDate: '1990-05-03', latitude: 40 , zone: 'Europe/Madrid' }, on)).toMatchObject({ ok: false, error: { message: 'Give latitude and longitude together.' } });
    expect(await executeAiTool('get_natal_chart', { birthDate: '1990-13-03' }, on)).toMatchObject({ ok: false, error: { message: 'birthDate must be a real date from 1800 to 2199.' } });
  });

  it('spells the zone as tzdb does and adds ?ref= to links for the assistant', async () => {
    const result = await executeAiTool('get_natal_chart', { ...MADRID, zone: 'europe/madrid' }, on, { ref: 'assistant' });
    if (!result.ok || result.tool !== 'get_natal_chart') throw new Error('refused');
    expect(result.data.zone).toBe('Europe/Madrid');
    expect(result.data.chartUrl).toBe('https://zodiacs.org/birth-chart/?ref=assistant');
  });

  it('says when a birth time fell in a daylight saving gap, and how far it moved', async () => {
    // 02:30 on 8 March 2026 never showed on New York clocks: they went from 02:00 straight to 03:00 EDT.
    const data = await chart({ birthDate: '2026-03-08', time: '02:30', zone: 'America/New_York', latitude: 40.7128, longitude: -74.006 });
    expect(data.castFor).toEqual({ utc: '2026-03-08T07:30:00.000Z', basis: 'birth-time' });
    expect(data.timeNote).toEqual({
      kind: 'dst-gap', shiftMinutes: 60, offsetUsed: '-04:00',
      text: '02:30 did not exist on 2026-03-08 in America/New_York: the clocks jumped forward past it. The chart is cast for 03:30 on the new clock (UTC-04:00), 60 minutes later. Check the birth time with the person if it matters.',
    });
    expect(JSON.stringify(data)).not.toMatch(/[–—]/u);
  });

  it('names the new date when the clock skipped a whole day, as Samoa did on 30 December 2011', async () => {
    const data = await chart({ birthDate: '2011-12-30', time: '12:00', zone: 'Pacific/Apia', latitude: -13.83, longitude: -171.76 });
    expect(data.timeNote).toMatchObject({ kind: 'dst-gap', shiftMinutes: 1440, offsetUsed: '+14:00' });
    expect(data.timeNote!.text).toBe('12:00 did not exist on 2011-12-30 in Pacific/Apia: the clocks jumped forward past it. The chart is cast for 12:00 on 2011-12-31 on the new clock (UTC+14:00), 1440 minutes later. Check the birth time with the person if it matters.');
  });

  it('names the birth years it takes when a date falls outside them', async () => {
    for (const tool of ['get_natal_chart', 'get_personal_transits'] as const) {
      for (const birthDate of ['1799-05-03', '2200-01-01']) {
        expect(await executeAiTool(tool, { birthDate }, on), `${tool} ${birthDate}`).toMatchObject({ ok: false, error: { code: 'invalid-request', message: 'birthDate must be a date from 1800 to 2199, such as 1990-05-03.' } });
      }
      expect(await executeAiTool(tool, { birthDate: '3 May 1990' }, on)).toMatchObject({ ok: false, error: { message: 'birthDate must be a date such as 1990-05-03.' } });
    }
  });

  it('says when a birth time happened twice, and which one the chart uses', async () => {
    // 01:30 on 1 November 2026 showed twice in New York: first on EDT (05:30Z), then on EST (06:30Z).
    const data = await chart({ birthDate: '2026-11-01', time: '01:30', zone: 'America/New_York' });
    expect(data.castFor.utc).toBe('2026-11-01T05:30:00.000Z');
    expect(data.timeNote).toMatchObject({ kind: 'dst-fold', shiftMinutes: 0, offsetUsed: '-04:00' });
    expect(data.timeNote!.text).toContain('happened twice on 2026-11-01 in America/New_York');
    expect(data.timeNote!.text).toContain('uses the first time (UTC-04:00)');
  });

  it('adds no time note for an ordinary birth time or without one', async () => {
    expect((await chart(MADRID)).timeNote).toBeUndefined();
    expect((await chart({ birthDate: '2026-03-08', zone: 'America/New_York' })).timeNote).toBeUndefined();
    expect('timeNote' in (await chart({ birthDate: '1990-05-03' }))).toBe(false);
  });
});
