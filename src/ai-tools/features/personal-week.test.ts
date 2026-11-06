import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { executeAiTool } from '../tools';
import { OUTPUT_SCHEMAS } from '../contracts';
import type { HoroscopeWindow } from '../horoscope/window';
import { PERSONAL_WEEK_NOTE, guardPersonalWeek, personalWeek } from './personal-week';

const clock = createLocalTimeModule();
afterAll(() => clock.dispose());
const now = new Date('2026-10-15T08:00:00Z');

describe('personalWeek', () => {
  it('lists the week’s transits to the person’s own chart as dated forecast lines', async () => {
    const week = await personalWeek({ birthDate: '1990-05-03', birthTime: '08:30', birthZone: 'Europe/Madrid' }, now, clock, 'Europe/Madrid');
    expect(week.timeKnown).toBe(true);
    expect(week.items.length).toBeGreaterThan(0);
    for (const item of week.items) {
      expect(item.title).toMatch(/ your /u);
      expect(item.line).toMatch(/your/u);
      expect(item.when).toMatch(/\w{3} \d{1,2} \w{3}|All week/u);
    }
    expect(week.note).toBe(PERSONAL_WEEK_NOTE);
    expect(JSON.stringify(week)).not.toMatch(/guarantee(?!\.)|pays out/u);
  });

  it('works from a birth date alone, leaving the Moon out, and refuses a time without a zone', async () => {
    const week = await personalWeek({ birthDate: '1990-05-03' }, now, clock);
    expect(week.timeKnown).toBe(false);
    expect(week.items.every((item) => !/your Moon/u.test(item.title))).toBe(true);
    await expect(personalWeek({ birthDate: '1990-05-03', birthTime: '08:30' }, now, clock)).rejects.toThrow(RangeError);
    await expect(personalWeek({ birthDate: '1990-02-30' }, now, clock)).rejects.toThrow(RangeError);
  });
});

describe('a personal week for a birth date under 18', () => {
  const week = { timeKnown: false, note: PERSONAL_WEEK_NOTE, items: [
    { title: 'Pluto sextile your Venus', line: 'Pluto opens a door for your way of loving: a years-long excavation, an opening that rewards you if you take it.', when: 'From Sat 7 Nov' },
    { title: 'Mars square your Sun', line: 'Mars pushes against your sense of self: a charged stretch of heat and urgency.', when: 'Mon 9 Nov' },
  ] };

  it('goes through softenMinor, says why, and leaves an adult week as it is', () => {
    const young = guardPersonalWeek(week, '2011-01-10', '2026-11-04');
    expect(young.items[0].line).toBe('Pluto opens a door for your way of caring: a years-long excavation, an opening that rewards you if you take it.');
    expect(young.items[1]).toEqual(week.items[1]);
    expect(young.note).toBe(`${PERSONAL_WEEK_NOTE} This birth date is under 18, so romantic and attraction readings are left out.`);
    expect(guardPersonalWeek(week, '2008-11-04', '2026-11-04')).toBe(week);
  });

  it('reaches get_horoscope: no romantic line in the week of someone under 18', async () => {
    const window = JSON.parse(readFileSync(new URL('../../data/horoscope-window.json', import.meta.url), 'utf8')) as HoroscopeWindow;
    const now = new Date(`${window.generatedFor}T12:00:00Z`);
    const result = await executeAiTool('get_horoscope', { sign: 'capricorn', birthDate: '2011-01-10' }, { occasions: true, now: () => now, horoscopeWindow: async () => window });
    if (!result.ok || result.tool !== 'get_horoscope') throw new Error(JSON.stringify(result));
    const personal = result.data.personal!;
    expect(personal.note).toContain('This birth date is under 18, so romantic and attraction readings are left out.');
    expect(JSON.stringify(personal.items)).not.toMatch(/\b(?:romance|romantic|attraction|intimacy|sexual|chemistry|way of loving)\b/iu);
    expect(OUTPUT_SCHEMAS.get_horoscope.safeParse(result).success).toBe(true);
  });
});

