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
    expect(data.aspects.every((aspect) => aspect.line.includes(aspect.a) || aspect.line.length > 20)).toBe(true);
    const { elements, modalities } = data.balance;
    expect(elements.fire + elements.earth + elements.air + elements.water).toBe(10);
    expect(modalities.cardinal + modalities.fixed + modalities.mutable).toBe(10);
    expect(data.unknown).toEqual([]);
    expect(data.chartUrl).toMatch(/^https:\/\/zodiacs\.org\/birth-chart\/#c=/u);
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
    expect(data.chartUrl).toBe('https://zodiacs.org/birth-chart/#date=1990-05-03&time=unknown');
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
    expect(result.data.chartUrl).toMatch(/^https:\/\/zodiacs\.org\/birth-chart\/\?ref=assistant#c=/u);
  });
});
