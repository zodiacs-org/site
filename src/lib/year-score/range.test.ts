import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { scoreBirth } from './browser';
import { type NatalPoints, type SlowPlanet } from './core';
import { birthDayEnds, birthDayEnvelope, birthDayRange, birthDaySamples, cachedLongitude, rangeWorthShowing, scoreRange } from './range';

const START = new Date('2026-01-01T00:00:00Z');
// Pluto held at 100 degrees all year; the other slow planets at 245, clear of every natal point below.
const pluto = (body: SlowPlanet) => (body === 'Pluto' ? 100 : 245);
const withMercury = (mercury: number): NatalPoints => ({ Sun: 15, Moon: null, Mercury: mercury, Venus: 20, Mars: 25 });

describe('scoreRange', () => {
  it('moves by more than a whole point when Mercury spans 2 degrees around a 1.5 degree Pluto conjunction', () => {
    const natals = [100.5, 101, 101.5, 102, 102.5].map(withMercury);
    const range = scoreRange(natals, pluto, START);
    expect(range.high - range.low).toBeGreaterThan(1);
    // The worked example: 1.5 degrees off reads about 3.6, a degree closer about 2.5, a degree wider about 4.9; three tiers.
    const near = (value: number, expected: number) => expect(Math.abs(value - expected)).toBeLessThanOrEqual(0.15);
    near(scoreRange([withMercury(101.5)], pluto, START).low, 3.6);
    near(range.low, 2.5);
    near(range.high, 4.9);
  });

  it('is a single score for a single chart', () => {
    const range = scoreRange([withMercury(150)], pluto, START);
    expect(range.low).toBe(range.high);
  });
});

describe('birthDaySamples', () => {
  it('returns five instants, the first and last the two ends', () => {
    const earliest = new Date('1990-05-02T10:00:00Z');
    const latest = new Date('1990-05-04T11:59:00Z');
    const samples = birthDaySamples(earliest, latest);
    expect(samples).toHaveLength(5);
    expect(samples[0].getTime()).toBe(earliest.getTime());
    expect(samples[4].getTime()).toBe(latest.getTime());
    expect(samples[2].getTime()).toBe((earliest.getTime() + latest.getTime()) / 2);
  });
});

describe('the ends of an untimed birth day', () => {
  it('without a place, covers every clock’s version of the date', () => {
    const [earliest, latest] = birthDayEnvelope('1990-05-03');
    expect(earliest.toISOString()).toBe('1990-05-02T10:00:00.000Z');
    expect(latest.toISOString()).toBe('1990-05-04T11:59:00.000Z');
    expect(birthDayEnds('1990-05-03', new Date('1990-05-03T12:00:00Z'))).toEqual([earliest, latest]);
  });

  it('with a place, takes local 00:00 and 23:59 as the caller’s resolver placed them', () => {
    const local = (time: string) => new Date(`1990-05-03T${time}:00+02:00`);
    const [earliest, latest] = birthDayEnds('1990-05-03', new Date('1990-05-03T10:00:00Z'), [local('00:00'), local('23:59')]);
    expect(earliest.toISOString()).toBe('1990-05-02T22:00:00.000Z');
    expect(latest.toISOString()).toBe('1990-05-03T21:59:00.000Z');
  });

  it('falls back to midday plus and minus 12 hours when the resolver cannot place either end', () => {
    const midday = new Date('1990-05-03T10:00:00Z');
    expect(birthDayEnds('1990-05-03', midday, null).map((at) => at.toISOString())).toEqual(['1990-05-02T22:00:00.000Z', '1990-05-03T22:00:00.000Z']);
    // Two ends out of order are no day either.
    expect(birthDayEnds('1990-05-03', midday, [midday, new Date(midday.getTime() - 1)]).map((at) => at.toISOString())).toEqual(['1990-05-02T22:00:00.000Z', '1990-05-03T22:00:00.000Z']);
  });
});

describe('cachedLongitude', () => {
  it('works each planet and instant out once', () => {
    const source = vi.fn((body: SlowPlanet, date: Date) => (body === 'Pluto' ? 100 : date.getTime() % 360));
    const cached = cachedLongitude(source);
    const day = new Date('2026-01-01T12:00:00Z');
    expect(cached('Pluto', day)).toBe(100);
    expect(cached('Pluto', new Date(day))).toBe(100);
    cached('Saturn', day);
    expect(source).toHaveBeenCalledTimes(2);
  });

  it('lets six charts share one pass over the slow planets', () => {
    const source = vi.fn(pluto);
    const cached = cachedLongitude(source);
    birthDayRange(withMercury(101.5), () => withMercury(102), [new Date('1990-05-02T10:00:00Z'), new Date('1990-05-04T11:59:00Z')], cached, START);
    expect(source).toHaveBeenCalledTimes(5 * 365);
  });
});

describe('rangeWorthShowing', () => {
  it('shows a range of 0.3 or more and nothing narrower', () => {
    expect(rangeWorthShowing(null)).toBe(false);
    expect(rangeWorthShowing({ low: 5, high: 5.2 })).toBe(false);
    expect(rangeWorthShowing({ low: 5, high: 5.3 })).toBe(true);
    expect(rangeWorthShowing({ low: 0.1, high: 0.4 })).toBe(true);
  });
});

describe('a real untimed birth', () => {
  it('1990-05-03 without a place: the midday score lies inside the range across the day', () => {
    const date = '1990-05-03';
    const midday = new Date(`${date}T12:00:00Z`);
    const start = new Date('2026-11-01T00:00:00Z');
    const { year, range } = scoreBirth(midday, false, start, birthDayEnds(date, midday));
    expect(range).not.toBeNull();
    expect(range!.low).toBeLessThanOrEqual(year.score);
    expect(year.score).toBeLessThanOrEqual(range!.high);
    // A timed birth has no range, and its score is the same with or without the day's ends.
    const timed = scoreBirth(midday, true, start, birthDayEnds(date, midday));
    expect(timed.range).toBeNull();
    expect(timed.year).toEqual(scoreBirth(midday, true, start).year);
  });
});

describe('the date-only copy', () => {
  it('no longer says a date alone is stable to about a day', () => {
    for (const file of ['src/islands/YearScoreCalculator.tsx', 'src/pages/year-score/index.astro', 'src/ai-tools/features/year-score.ts']) {
      const text = readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');
      expect(text, file).not.toContain('shift by about a day');
      expect(text, file).not.toContain('fraction of a degree');
    }
  });
});
