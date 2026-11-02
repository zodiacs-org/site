import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { executeAiTool } from '../tools';
import committedWindow from '../../data/horoscope-window.json';
import committedMonths from '../../data/horoscope-months.json';
import committedProgram from '../../data/horoscope-program.json';
import type { HoroscopeWindow } from '../horoscope/window';
import type { HoroscopeProgram } from '../../lib/horoscope-program-types';
import type { HoroscopePeriodData } from './horoscope-period';
import { render } from '../../../scripts/build-horoscope-months.mjs';

const dependencies = {
  occasions: true, coverage: true, now: () => new Date('2026-11-02T05:00:00Z'),
  horoscopeWindow: async () => committedWindow as HoroscopeWindow,
  horoscopeMonths: async () => committedMonths,
  horoscopeProgram: async () => committedProgram as unknown as HoroscopeProgram,
};
async function period(args: Record<string, unknown>): Promise<HoroscopePeriodData> {
  const result = await executeAiTool('get_horoscope_period', args, dependencies);
  if (!result.ok || result.tool !== 'get_horoscope_period') throw new Error(JSON.stringify(result));
  return result.data;
}

describe('the monthly readings file', () => {
  it('is what the generator makes from src/content/horoscopes', async () => {
    expect(readFileSync(new URL('../../data/horoscope-months.json', import.meta.url), 'utf8')).toBe((await render()).text);
  });
});

describe('get_horoscope_period', () => {
  it("gives the month's published reading, word for word, with the month's sky in the sign's solar houses", async () => {
    const data = await period({ sign: 'leo', period: 'month' });
    expect(data).toMatchObject({ status: 'available', from: '2026-11-01', to: '2026-11-30', label: 'November 2026', pageUrl: 'https://zodiacs.org/horoscopes/leo/monthly/' });
    const source = readFileSync(new URL('../../content/horoscopes/2026-11-leo.mdx', import.meta.url), 'utf8');
    expect(source.replace(/\s+/gu, ' ')).toContain(data.reading!.paragraphs[0].text);
    expect(data.reading!.published).toBe('2026-11-01');
    // The new Moon in Scorpio on 9 November falls in Leo's fourth solar house.
    expect(data.sky.find((event) => event.kind === 'lunation' && event.sign === 'scorpio')).toMatchObject({ house: 4, date: 'Mon 9 Nov' });
    expect(data.sky.map((event) => event.utc)).toEqual([...data.sky.map((event) => event.utc)].sort());
  });

  it('does not give a month before its first day, and says so', async () => {
    const data = await period({ sign: 'leo', period: 'month', date: '2026-12-10' });
    expect(data.status).toBe('sky-only');
    expect(data.reading).toBeNull();
    expect(data.message).toContain("isn't published yet");
    expect(data.sky.length).toBeGreaterThan(0);
    expect(data.available.months).toEqual(['2026-10', '2026-11']);
  });

  it('gives the 2026 yearly reading for this year, with its page', async () => {
    const year = await period({ sign: 'capricorn', period: 'year' });
    expect(year).toMatchObject({ status: 'available', label: '2026', pageUrl: 'https://zodiacs.org/horoscopes/capricorn/2026/' });
    expect(year.reading!.title).toBe('Capricorn 2026 horoscope');
    expect(year.reading!.paragraphs[0]).toMatchObject({ heading: 'The shape of Capricorn’s 2026' });
    expect(year.available.years).toEqual([2026, 2027]);
  });

  it('gives the 2027 yearly reading, and only the sky for a year without one', async () => {
    const year = await period({ sign: 'virgo', period: 'year', date: '2027-03-01' });
    expect(year).toMatchObject({ status: 'available', label: '2027', pageUrl: 'https://zodiacs.org/horoscopes/virgo/2027/' });
    expect(year.reading!.title).toBe('Virgo 2027 horoscope');
    expect(year.sky.some((event) => event.kind === 'ingress' && event.planet === 'Jupiter' && event.sign === 'virgo')).toBe(true);
    expect(year.sky.some((event) => event.kind === 'eclipse')).toBe(true);
    const later = await period({ sign: 'virgo', period: 'year', date: '2028-03-01' });
    expect(later).toMatchObject({ status: 'sky-only', reading: null });
    expect(later.message).toContain('Zodiacs publishes the yearly reading for 2026 and 2027');
  });

  it("gives the week's reading, and for love that week's love readings and the sky that bears on love", async () => {
    const week = await period({ sign: 'leo', period: 'week', focus: 'love' });
    expect(week).toMatchObject({ from: '2026-11-02', to: '2026-11-08', label: 'Week of 2 November 2026', pageUrl: 'https://zodiacs.org/horoscopes/leo/love/' });
    expect(week.reading!.title).toBe('Leo · Week of 2 November 2026');
    const loveDates = week.focusReadings.map((reading) => reading.date);
    expect(loveDates).toContain('2026-11-02');
    expect(loveDates.every((date) => date >= '2026-11-02' && date <= '2026-11-08')).toBe(true);
    expect([...loveDates].sort()).toEqual(loveDates);
    expect(week.sky.every((event) => ['Venus', 'Mars'].includes(event.planet) || [5, 7, 8].includes(event.house))).toBe(true);
    expect(week.message).toContain('love readings by the day');
    const career = await period({ sign: 'leo', period: 'week', focus: 'career' });
    expect(career.focusReadings[0].title).toContain('Career');
  });

  it('never writes a reading of its own, and refuses a sign it does not know', async () => {
    const away = await period({ sign: 'pisces', period: 'week', date: '2027-04-07' });
    expect(away.reading).toBeNull();
    expect(away.message).toContain("isn't kept here");
    expect(await executeAiTool('get_horoscope_period', { sign: 'ophiuchus', period: 'month' }, dependencies)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(await executeAiTool('get_horoscope_period', { period: 'month' }, dependencies)).toMatchObject({ ok: false, error: { message: 'sign is required.' } });
  });

  it('is offered only with the monthly readings and the program alongside the window', async () => {
    const { horoscopeMonths: _months, ...withoutMonths } = dependencies;
    expect(await executeAiTool('get_horoscope_period', { sign: 'leo', period: 'month' }, withoutMonths)).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });
});
