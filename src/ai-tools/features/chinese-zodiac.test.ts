import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { executeAiTool } from '../tools';
import { chineseElement, chineseYearOf, lunarNewYearOf } from './chinese-zodiac';
import { render } from '../../../scripts/build-lunar-new-year.mjs';

const on = { occasions: true, coverage: true, now: () => new Date('2026-11-02T05:00:00Z') };
const call = async (args: Record<string, unknown>, now = on.now) => {
  const result = await executeAiTool('get_chinese_zodiac', args, { ...on, now });
  if (!result.ok || result.tool !== 'get_chinese_zodiac') throw new Error(JSON.stringify(result));
  return result.data;
};

describe('the Lunar New Year table', () => {
  it('is what the generator makes, so it can be rebuilt and checked', () => {
    expect(readFileSync(new URL('../../data/lunar-new-year.json', import.meta.url), 'utf8')).toBe(render());
  });

  it('matches published Lunar New Year dates, including the hard cases', () => {
    // Published dates (a 1900 to 2099 reference table, checked year by year when the table was made). 1916 needs
    // Beijing mean time, 1985 a new Moon close to midnight, and 2034 the leap eleventh month of 2033.
    const published: Record<number, string> = {
      1900: '1900-01-31', 1912: '1912-02-18', 1916: '1916-02-03', 1949: '1949-01-29', 1966: '1966-01-21', 1985: '1985-02-20', 1990: '1990-01-27',
      1996: '1996-02-19', 2000: '2000-02-05', 2001: '2001-01-24', 2006: '2006-01-29', 2012: '2012-01-23', 2015: '2015-02-19', 2020: '2020-01-25',
      2023: '2023-01-22', 2024: '2024-02-10', 2025: '2025-01-29', 2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26', 2030: '2030-02-03',
      2033: '2033-01-31', 2034: '2034-02-19', 2044: '2044-01-30', 2050: '2050-01-23', 2061: '2061-01-21', 2099: '2099-01-21',
    };
    for (const [year, date] of Object.entries(published)) expect(lunarNewYearOf(Number(year)), year).toBe(date);
  });

  it('gives each year its element and yin or yang from the stem', () => {
    expect(chineseElement(1984)).toEqual({ element: 'wood', yinYang: 'yang' });
    expect(chineseElement(1989)).toEqual({ element: 'earth', yinYang: 'yin' });
    expect(chineseElement(2026)).toEqual({ element: 'fire', yinYang: 'yang' });
    expect(chineseYearOf('2026-02-16')).toBe(2025);
    expect(chineseYearOf('2026-02-17')).toBe(2026);
  });
});

describe('get_chinese_zodiac', () => {
  it('puts a birth before Lunar New Year in the previous animal year', async () => {
    const data = await call({ birthDate: '1990-01-20' });
    expect(data.person).toMatchObject({ year: 1989, animal: { slug: 'snake', name: 'Snake', pageUrl: 'https://zodiacs.org/learn/chinese-zodiac/snake/' }, element: 'earth', yinYang: 'yin', stemBranch: '己巳', label: 'Earth Snake (yin)', starts: '1989-02-06', ends: '1990-01-26' });
    expect(data.boundary).toMatchObject({ lunarNewYear: '1990-01-27', beforeNewYear: true });
    expect(data.boundary!.text).toContain('before the Lunar New Year of 27 January 1990');
  });

  it('puts a birth on Lunar New Year in the new animal year', async () => {
    const data = await call({ birthDate: '1990-01-27' });
    expect(data.person).toMatchObject({ year: 1990, animal: { slug: 'horse' }, element: 'metal', yinYang: 'yang' });
    expect(data.boundary!.beforeNewYear).toBe(false);
  });

  it('with only a year, names the animal for anyone born before its Lunar New Year', async () => {
    const data = await call({ year: 1990 });
    expect(data.from).toBe('year');
    expect(data.person!.animal.slug).toBe('horse');
    expect(data.boundary).toMatchObject({ lunarNewYear: '1990-01-27', beforeNewYear: null, earlierAnimal: { slug: 'snake' } });
  });

  it('gives the traditional pairings', async () => {
    const data = await call({ birthDate: '1996-03-01' });
    expect(data.person!.animal.slug).toBe('rat');
    expect(data.person!.pairings.harmony.map((animal) => animal.slug)).toEqual(['dragon', 'monkey']);
    expect(data.person!.pairings.partner.slug).toBe('ox');
    expect(data.person!.pairings.opposite.slug).toBe('horse');
  });

  it("gives the current year's animal on the person's own date", async () => {
    expect((await call({})).current).toMatchObject({ year: 2026, label: 'Fire Horse (yang)', starts: '2026-02-17', ends: '2027-02-05' });
    // 6 February 2027 begins the Fire Goat year in Asia, while it is still 5 February in Los Angeles.
    const instant = () => new Date('2027-02-06T02:00:00Z');
    expect((await call({ zone: 'Asia/Shanghai' }, instant)).current.animal.slug).toBe('goat');
    expect((await call({ zone: 'America/Los_Angeles' }, instant)).current.animal.slug).toBe('horse');
  });

  it('refuses what it cannot answer, naming the field', async () => {
    expect(await executeAiTool('get_chinese_zodiac', { birthDate: '1990-01-20', year: 1990 }, on)).toMatchObject({ ok: false, error: { code: 'invalid-request', message: 'Give birthDate or year, not both.' } });
    expect(await executeAiTool('get_chinese_zodiac', { birthDate: '1990-02-30' }, on)).toMatchObject({ ok: false, error: { message: 'birthDate must be a real date, such as 1990-01-20.' } });
    expect(await executeAiTool('get_chinese_zodiac', { year: 2101 }, on)).toMatchObject({ ok: false, error: { message: 'year must be at most 2100.' } });
    expect(await executeAiTool('get_chinese_zodiac', { year: 1990 }, { now: on.now })).toMatchObject({ ok: false, error: { code: 'unavailable' } });
    expect(await executeAiTool('get_chinese_zodiac', { year: 1990 }, { now: on.now, occasions: true })).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });
});
