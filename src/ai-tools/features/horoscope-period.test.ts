import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { executeAiTool } from '../tools';
import committedWindow from '../../data/horoscope-window.json';
import committedMonths from '../../data/horoscope-months.json';
import committedProgram from '../../data/horoscope-program.json';
import type { HoroscopeWindow } from '../horoscope/window';
import type { HoroscopeProgram } from '../../lib/horoscope-program-types';
import type { HoroscopePeriodData } from './horoscope-period';
import { hasDash, render } from '../../../scripts/build-horoscope-months.mjs';

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

describe('the monthly readings file', () => {
  it('serves July to September 2026 as written, rewritten without dashes, with no punctuation changed by the build', async () => {
    const { left } = await render();
    for (const month of ['2026-07', '2026-08', '2026-09']) {
      expect(left).not.toContain(month);
      expect(Object.keys(committedMonths.months), month).toContain(month);
      const signs = committedMonths.months[month as keyof typeof committedMonths.months];
      expect(JSON.stringify(signs), month).not.toMatch(/[\u2013\u2014]|\s-\s/u);
      for (const [sign, entry] of Object.entries(signs)) {
        // Each paragraph is the source's own words with the line breaks joined.
        const source = readFileSync(new URL(`../../content/horoscopes/${month}-${sign}.mdx`, import.meta.url), 'utf8').replace(/\s+/gu, ' ');
        for (const paragraph of entry.paragraphs) expect(source, `${month} ${sign}`).toContain(paragraph);
      }
    }
    expect(JSON.stringify(committedMonths)).not.toMatch(/[\u2013\u2014]/u);
  });

  it('leaves out any month with an em or en dash, or a spaced hyphen used as one', () => {
    expect(hasDash('the new moon \u2014 a total solar eclipse')).toBe(true);
    expect(hasDash('days 4\u20136 of the month')).toBe(true);
    expect(hasDash('a plan - and more')).toBe(true);
    expect(hasDash('a well-known plan, and days 4 to 6')).toBe(false);
  });
});

describe('get_horoscope_period', () => {
  it('serves the September 2026 reading with no dashes, and a month sky without the Moon changing sign', async () => {
    const data = await period({ sign: 'leo', period: 'month', date: '2026-09-15' });
    expect(data).toMatchObject({ status: 'available', label: 'September 2026', from: '2026-09-01', to: '2026-09-30' });
    expect(data.reading!.published).toBe(committedMonths.months['2026-09'].leo.published);
    expect(JSON.stringify(data)).not.toMatch(/[\u2013\u2014]/u);
    expect(data.sky.some((event) => event.kind === 'ingress' && event.planet === 'Moon')).toBe(false);
    expect(data.sky.some((event) => event.kind === 'lunation')).toBe(true);
    const november = await period({ sign: 'leo', period: 'month' });
    expect(november.sky.some((event) => event.kind === 'ingress' && event.planet === 'Moon')).toBe(false);
    expect(november.sky.length).toBeLessThan(10);
  });

  it('never says Zodiacs has no reading for a month it does not serve', async () => {
    const data = await period({ sign: 'leo', period: 'month', date: '2026-03-10' });
    expect(data.status).toBe('sky-only');
    // No zone was given or shared, so the dates are UTC's and the answer says so.
    expect(data.message).toBe('The March 2026 reading for Leo is outside the range this tool serves: Zodiacs serves the monthly readings from July 2026 to November 2026 only. The Leo horoscope pages on Zodiacs are linked. Dates assume UTC because no time zone was given.');
    expect(data.zoneSource).toBe('default');
    expect(data.message).not.toMatch(/no published/u);
    expect(data.pageUrl).toBe('https://zodiacs.org/horoscopes/leo/');
  });

  it('does not suggest a reading is coming for a month long past, such as 1900', async () => {
    const data = await period({ sign: 'leo', period: 'month', date: '1900-03-10' });
    expect(data).toMatchObject({ status: 'sky-only', reading: null });
    expect(data.message).toContain('Zodiacs serves the monthly readings from July 2026 to November 2026 only');
    expect(data.message).not.toMatch(/\byet\b|coming|soon|will be/u);
  });

  it('takes the sign in any capitalisation, and still refuses a sign it does not know', async () => {
    const lower = await period({ sign: 'leo', period: 'month', date: '2026-09-15' });
    for (const sign of ['Leo', 'LEO', ' leo ']) expect(await period({ sign, period: 'month', date: '2026-09-15' }), sign).toEqual(lower);
    expect(await executeAiTool('get_horoscope_period', { sign: 'Ophiuchus', period: 'month' }, dependencies)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(await executeAiTool('get_horoscope_period', { sign: 'Le o', period: 'month' }, dependencies)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
  });


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
    expect(data.available.months).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(data.available.years).toEqual([2026, 2027]);
  });

  it('lists the published yearly readings for week answers too, not a fixed year', async () => {
    const week = await period({ sign: 'leo', period: 'week' });
    expect(week.available.years).toEqual([2026, 2027]);
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
    expect(loveDates[0]).toBe('2026-11-03');
    expect(loveDates.every((date) => date >= week.from && date <= week.to)).toBe(true);
    expect([...loveDates].sort()).toEqual(loveDates);
    expect(week.sky.every((event) => ['Venus', 'Mars'].includes(event.planet) || [5, 7, 8].includes(event.house))).toBe(true);
    expect(week.message).toContain('love readings by the day');
    expect(week.message).toContain('If the person is under 18, do not frame this as romance or attraction.');
    const career = await period({ sign: 'leo', period: 'week', focus: 'career' });
    expect(career.focusReadings[0].title).toContain('Career');
    expect(career.message).not.toContain('under 18');
  });

  it('says it assumed UTC only when no zone was given or shared', async () => {
    const given = await period({ sign: 'leo', period: 'month', zone: 'Asia/Bangkok' });
    expect(given.zoneSource).toBe('request');
    expect(given.message ?? '').not.toMatch(/UTC/u);
    const shared = await executeAiTool('get_horoscope_period', { sign: 'leo', period: 'month' }, dependencies, { hostZone: 'America/New_York' });
    if (!shared.ok || shared.tool !== 'get_horoscope_period') throw new Error(JSON.stringify(shared));
    expect(shared.data.zoneSource).toBe('assistant');
    expect(shared.data.zone).toBe('America/New_York');
    expect(shared.data.message ?? '').not.toMatch(/UTC/u);
    const assumed = await period({ sign: 'leo', period: 'month' });
    expect(assumed.zoneSource).toBe('default');
    expect(assumed.message).toContain('Dates assume UTC because no time zone was given.');
  });

  it('never reads the sixth house as health', async () => {
    for (const sign of ['aries', 'leo', 'pisces']) {
      const data = await period({ sign, period: 'year', date: '2027-06-01', zone: 'Europe/London' });
      expect(data.sky.map((event) => event.line).join(' '), sign).not.toMatch(/\bhealth\b/iu);
    }
  });

  it('never writes a reading of its own, and refuses a sign it does not know', async () => {
    const away = await period({ sign: 'pisces', period: 'week', date: '2027-04-07' });
    expect(away.reading).toBeNull();
    expect(away.message).toContain('use get_horoscope');
    expect(away.confidenceLabel).toBe('Reading confidence 40%');
    expect(await executeAiTool('get_horoscope_period', { sign: 'ophiuchus', period: 'month' }, dependencies)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(await executeAiTool('get_horoscope_period', { period: 'month' }, dependencies)).toMatchObject({ ok: false, error: { message: 'sign is required.' } });
  });

  it('is offered only with the monthly readings and the program alongside the window', async () => {
    const { horoscopeMonths: _months, ...withoutMonths } = dependencies;
    expect(await executeAiTool('get_horoscope_period', { sign: 'leo', period: 'month' }, withoutMonths)).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });
});
