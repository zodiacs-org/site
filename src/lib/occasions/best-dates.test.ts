import { afterAll, describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { BEST_DAYS_MAX_WINDOW, bestDays, bestDaysWindow } from './best-dates';
import { rateOccasionDate } from './date-score';
import { skyAt } from './sky';

const localTime = createLocalTimeModule();
afterAll(() => localTime.dispose());

describe('bestDays', () => {
  it('returns the three best-rated days of a month, best first, each with up to three reasons', async () => {
    const result = await bestDays({ occasion: 'wedding', from: '2027-06-01', to: '2027-06-30', time: null, timeZone: 'Europe/Rome', longitude: null }, localTime);
    expect(result).toMatchObject({ from: '2027-06-01', to: '2027-06-30', days: 30 });
    expect(result.best).toHaveLength(3);
    for (let index = 1; index < result.best.length; index += 1) {
      const [before, after] = [result.best[index - 1], result.best[index]];
      expect(before.score > after.score || (before.score === after.score && before.date < after.date)).toBe(true);
    }
    for (const day of result.best) {
      expect(day.date >= '2027-06-01' && day.date <= '2027-06-30').toBe(true);
      expect(day.reasons.length).toBeGreaterThan(0);
      expect(day.reasons.length).toBeLessThanOrEqual(3);
    }
  });

  it('rates each day as the single-day rating does, at local noon', async () => {
    const result = await bestDays({ occasion: 'job', from: '2027-01-10', to: '2027-01-12', time: null, timeZone: null, longitude: null }, localTime);
    const ratings = ['2027-01-10', '2027-01-11', '2027-01-12'].map((date) => rateOccasionDate('job', skyAt(new Date(`${date}T12:00:00Z`))).score);
    expect(result.best.map((day) => day.score).sort((a, b) => b - a)).toEqual([...ratings].sort((a, b) => b - a));
  });

  it('searches the longest window quickly', async () => {
    const started = performance.now();
    const result = await bestDays({ occasion: 'wedding', from: '2027-06-01', to: '2027-08-31', time: '17:00', timeZone: 'Europe/Rome', longitude: 11.2558 }, localTime);
    expect(result.days).toBe(BEST_DAYS_MAX_WINDOW);
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it('refuses a window longer than 92 days, reversed or not real', async () => {
    expect(bestDaysWindow('2027-06-01', '2027-08-31')).toBe(92);
    expect(() => bestDaysWindow('2027-06-01', '2027-09-01')).toThrow(RangeError);
    expect(() => bestDaysWindow('2027-06-30', '2027-06-01')).toThrow(RangeError);
    expect(() => bestDaysWindow('2027-02-30', '2027-03-10')).toThrow(RangeError);
    await expect(bestDays({ occasion: 'wedding', from: '2027-06-01', to: '2027-12-31', time: null, timeZone: null, longitude: null }, localTime)).rejects.toThrow(RangeError);
  });
});
