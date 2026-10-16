import { afterAll, describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { PERSONAL_WEEK_NOTE, personalWeek } from './personal-week';

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
