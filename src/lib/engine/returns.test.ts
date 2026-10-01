/**
 * Saturn-return scanner against the real ephemeris. The dated anchors
 * are externally checkable: the 2018–2020 Saturn-in-Capricorn transit
 * produced the first return for early-1990 births and the second for
 * mid-1961 births.
 */
import { describe, expect, it } from 'vitest';
import { computeChart } from './full';
import { groupIntoSeasons, saturnReturns } from './returns';
import type { Crossing } from './returns';
import independentCases from './fixtures/independent-eight-cases.json';
import independentPolicy from './fixtures/swiss-eight-cases-policy.json';
import { angularDifference, expectIndependentTime } from './fixtures/independent-validation.test-helpers';

const YEAR = 365.25 * 86400_000;

const ageAt = (birth: Date, d: Date) => (d.getTime() - birth.getTime()) / YEAR;

describe('groupIntoSeasons', () => {
  it('groups near crossings and splits distant ones', () => {
    const t0 = Date.UTC(2019, 2, 1);
    const mk = (ms: number, retrograde = false): Crossing => ({ at: new Date(ms), retrograde });
    const seasons = groupIntoSeasons([
      mk(t0),
      mk(t0 + 200 * 86400_000, true),
      mk(t0 + 350 * 86400_000),
      mk(t0 + 29 * YEAR),
    ]);
    expect(seasons).toHaveLength(2);
    expect(seasons[0].crossings).toHaveLength(3);
    expect(seasons[0].index).toBe(1);
    expect(seasons[1].index).toBe(2);
    expect(seasons[0].first.getTime()).toBe(t0);
    expect(seasons[0].last.getTime()).toBe(t0 + 350 * 86400_000);
  });
});

describe('saturnReturns', () => {
  it('matches all independent nominal-UT1 return passes and three seasons', () => {
    // The complete birth/search chronology uses nominal UT1. Future ISO Z
    // strings are numeric transport, not a civil-UTC prediction. The natal
    // longitude, every crossing and its ±0.1° band come from NASA JPL
    // Horizons (DE441) at the engine's own TT
    // (docs/engine-validation/independent-references/).
    const actual = saturnReturns(new Date(independentPolicy.saturn.productDateTransport));
    const reference = independentCases.saturn;
    expect(angularDifference(actual.natalLon, reference.natalLongitudeDegrees))
      .toBeLessThanOrEqual(independentPolicy.gates.planetLongitudeCircularDegreesMaximum);
    expect(actual.natalRetrograde).toBe(reference.natalRetrograde);
    expect(actual.seasons).toHaveLength(reference.seasons.length);
    actual.seasons.forEach((season, index) => {
      const expected = reference.seasons[index];
      expect(season.index).toBe(expected.index);
      expect(season.crossings).toHaveLength(expected.crossings.length);
      season.crossings.forEach((crossing, pass) => {
        expectIndependentTime(crossing.at, expected.crossings[pass]);
        expect(crossing.retrograde).toBe(expected.crossings[pass].retrograde);
      });
      expect(season.first).toEqual(season.crossings[0].at);
      expect(season.last).toEqual(season.crossings.at(-1)!.at);
    });
  });

  const births = [
    new Date('1990-02-01T12:00:00Z'),
    new Date('1961-08-04T00:00:00Z'),
    new Date('2000-06-15T12:00:00Z'),
    new Date('1975-03-10T12:00:00Z'),
  ];

  it('first return begins between ages 27.5 and 30.5 for every fixture', () => {
    for (const birth of births) {
      const { seasons } = saturnReturns(birth);
      expect(seasons.length).toBeGreaterThanOrEqual(3);
      const age = ageAt(birth, seasons[0].first);
      expect(age).toBeGreaterThan(27.5);
      expect(age).toBeLessThan(30.5);
    }
  }, 120_000);

  it('every season carries an odd number of crossings', () => {
    for (const birth of births) {
      for (const season of saturnReturns(birth).seasons) {
        expect([1, 3, 5]).toContain(season.crossings.length);
      }
    }
  }, 120_000);

  it('1990-02-01: natal Saturn in Capricorn, triple first pass across 2019', () => {
    const r = saturnReturns(new Date('1990-02-01T12:00:00Z'));
    // Natal longitude ~289.3° = Capricorn (270–300).
    expect(Math.floor(r.natalLon / 30)).toBe(9);
    const first = r.seasons[0];
    expect(first.crossings).toHaveLength(3);
    expect(first.crossings.map((c) => c.at.toISOString().slice(0, 10))).toEqual([
      '2019-03-21', '2019-06-09', '2019-12-13',
    ]);
    // The middle hit is the retrograde pass.
    expect(first.crossings.map((c) => c.retrograde)).toEqual([false, true, false]);
    // Second return: single crossing, ~29.8 years after the first ends.
    const second = r.seasons[1];
    expect(second.crossings).toHaveLength(1);
    expect(second.first.toISOString().slice(0, 7)).toBe('2049-01');
    expect(ageAt(new Date('1990-02-01T12:00:00Z'), second.first)).toBeCloseTo(58.96, 1);
  }, 120_000);

  it('1961-08-04: second return is the 2020 Saturn-in-Capricorn stint', () => {
    const r = saturnReturns(new Date('1961-08-04T00:00:00Z'));
    expect(r.seasons[0].crossings).toHaveLength(1);
    expect(r.seasons[0].first.toISOString().slice(0, 10)).toBe('1990-12-29');
    const second = r.seasons[1];
    expect(second.crossings).toHaveLength(3);
    for (const c of second.crossings) {
      expect(c.at.toISOString().slice(0, 4)).toBe('2020');
    }
  }, 120_000);
});

describe('natal Saturn direction', () => {
  // Saturn stations retrograde on 2026-07-26. Full IAU 2000B in rc.16
  // changes the longitude derivative and moves the chart's ±0.001-day
  // speed zero to about 19:53:14.040Z. Retain the earlier-version witnesses
  // too: the Saturn page and chart must use the same speed on either side.
  it.each([
    '2026-07-26T19:53:04.040Z',
    '2026-07-26T19:53:24.040Z',
    '2026-07-26T19:57:16.990Z',
    '2026-07-26T19:57:26.921Z',
    '2026-07-26T19:57:46.921Z',
    '2026-07-26T19:56:40.000Z',
    '1990-02-01T12:00:00.000Z',
  ])('agrees with the chart at %s', (iso) => {
    const utc = new Date(iso);
    const chart = computeChart({ utc, latitude: 0, longitude: 0, houseSystem: 'whole', timeKnown: true });
    const saturn = chart.bodies.find(({ body }) => body === 'Saturn')!;
    expect(saturnReturns(utc).natalRetrograde).toBe(saturn.retrograde);
  });

  it('is direct just before the chart\'s station and retrograde just after', () => {
    expect(saturnReturns(new Date('2026-07-26T19:53:04.040Z')).natalRetrograde).toBe(false);
    expect(saturnReturns(new Date('2026-07-26T19:53:24.040Z')).natalRetrograde).toBe(true);
  });
});
