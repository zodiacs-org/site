import { describe, expect, it } from 'vitest';
import { bodyLongitude } from '../../lib/engine/full';
import { solarReturnInstant } from '../../lib/engine/solar-return';
import { yearScan } from '../../lib/engine/year-scan';
import { computeSolarReturn, currentReturnYear, nearForReturnYear, prepareLocalTime } from './compute';

const KAHLO_BIRTH = new Date('1907-07-06T15:06:36Z');
const KAHLO_SUN = bodyLongitude('Sun', KAHLO_BIRTH);

describe('solar return calculator model', () => {
  it('exercises the island helper against yearScan within a minute', () => {
    const result = computeSolarReturn({
      birthDate: '1907-07-06', birthTime: null, timeKnown: true, birthplace: null,
      savedSunLon: KAHLO_SUN, houseSystem: 'whole', castLocation: null, year: 2026,
    }, new Date('2026-08-01T00:00:00Z'));
    const near = nearForReturnYear(2026, '1907-07-06');
    const scan = yearScan({ sunLon: KAHLO_SUN, moonLon: null, ascLon: null, birthUtc: KAHLO_BIRTH },
      new Date(near.getTime() - 200 * 86_400_000), new Date(near.getTime() + 200 * 86_400_000));
    expect(Math.abs(result.chart.input.utc.getTime() - new Date(scan.solarReturns[0]).getTime())).toBeLessThanOrEqual(60_000);
  });

  it('flips the governing year at the exact return instant', () => {
    const thisReturn = computeSolarReturn({
      birthDate: '1907-07-06', birthTime: null, timeKnown: true, birthplace: null,
      savedSunLon: KAHLO_SUN, houseSystem: 'whole', castLocation: null, year: 2026,
    }).chart.input.utc;
    expect(currentReturnYear(KAHLO_SUN, '1907-07-06', new Date(thisReturn.getTime() - 1))).toBe(2025);
    expect(currentReturnYear(KAHLO_SUN, '1907-07-06', thisReturn)).toBe(2026);
  });

  it('handles a January 1 return that lands on December 31', () => {
    const sun = bodyLongitude('Sun', new Date('1900-01-01T00:00:00Z'));
    const instant = solarReturnInstant(sun, nearForReturnYear(2025, '1900-01-01'));
    expect(instant.getUTCFullYear()).toBe(2024);
    expect(currentReturnYear(sun, '1900-01-01', new Date(instant.getTime() - 1))).toBe(2024);
    expect(currentReturnYear(sun, '1900-01-01', instant)).toBe(2025);
  });

  it('handles a December 31 return that lands on January 1', () => {
    const sun = bodyLongitude('Sun', new Date('2000-12-31T23:00:00Z'));
    const instant = solarReturnInstant(sun, nearForReturnYear(2025, '2000-12-31'));
    expect(instant.getUTCFullYear()).toBe(2026);
    expect(currentReturnYear(sun, '2000-12-31', new Date(instant.getTime() - 1))).toBe(2024);
    expect(currentReturnYear(sun, '2000-12-31', instant)).toBe(2025);
  });

  it('relocation changes angles but not planets and no-time suppresses houses', async () => {
    await prepareLocalTime('1907-07-06', 'America/Mexico_City');
    const base = {
      birthDate: '1907-07-06', birthTime: '08:30', timeKnown: true,
      birthplace: { name: 'Mexico City', admin1: '', country: 'Mexico', lat: 19.4326, lon: -99.1332, tz: 'America/Mexico_City' },
      savedSunLon: KAHLO_SUN, houseSystem: 'whole' as const, year: 2026,
    };
    const mexico = computeSolarReturn({ ...base, castLocation: base.birthplace });
    const london = computeSolarReturn({ ...base, castLocation: { name: 'London', lat: 51.5072, lon: -0.1276, tz: 'Europe/London' } });
    expect(mexico.chart.angles?.asc).not.toBeCloseTo(london.chart.angles!.asc, 2);
    expect(mexico.chart.bodies.map((b) => b.lon)).toEqual(london.chart.bodies.map((b) => b.lon));
    const noTime = computeSolarReturn({ ...base, timeKnown: false, castLocation: base.birthplace });
    expect(noTime.chart.angles).toBeNull();
    expect(noTime.chart.houses).toBeNull();
    // Untimed, the birthplace still settles the Sun sign across its own clock's day: Cancer all of 6 July 1907.
    expect(noTime.sunSign).toBe(3);
  });
});

describe('the Sun sign of an untimed solar return', () => {
  const untimed = { birthTime: null, timeKnown: false, birthplace: null, savedSunLon: null, houseSystem: 'whole' as const, castLocation: null, year: 2026 };
  it('is cast from 12:00 UTC and settled across every clock’s version of the date without a birthplace', () => {
    const settled = computeSolarReturn({ ...untimed, birthDate: '1990-05-03' });
    expect(settled.noTime).toBe(true);
    expect(settled.sunSign).toBe(1);
    // The Sun entered Aries on 20 March 1990 at 21:19 UTC: no sign is named.
    expect(computeSolarReturn({ ...untimed, birthDate: '1990-03-20' }).sunSign).toBeNull();
  });
  it('is the same return with or without a birthplace, which only narrows the day the sign is read across', async () => {
    await prepareLocalTime('1990-03-20', 'Asia/Tokyo');
    const tokyo = computeSolarReturn({ ...untimed, birthDate: '1990-03-20', birthplace: { name: 'Tokyo', lat: 35.68, lon: 139.69, tz: 'Asia/Tokyo' } });
    const nowhere = computeSolarReturn({ ...untimed, birthDate: '1990-03-20' });
    expect(tokyo.chart.input.utc.getTime()).toBe(nowhere.chart.input.utc.getTime());
    expect(tokyo.sunSign).toBe(11);
  });
});
