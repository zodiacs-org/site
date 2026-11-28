import { describe, expect, it } from 'vitest';
import { bodyLongitude } from '../../lib/engine/full';
import { solarReturnInstant } from '../../lib/engine/solar-return';
import { yearScan } from '../../lib/engine/year-scan';
import { computeSolarReturn, currentReturnYear, nearForReturnYear, prepareLocalTime } from './compute';
import { REPEATED_BIRTH_TIME, SkippedBirthDateError, SkippedBirthTimeError } from '../../lib/vedic-signs/clock';

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

  it('rejects a custom return year on or before the birth year', () => {
    expect(() => computeSolarReturn({ ...untimed, birthDate: '1990-05-03', year: 1990 })).toThrow(RangeError);
    expect(() => computeSolarReturn({ ...untimed, birthDate: '1990-05-03', year: 1989 })).toThrow(RangeError);
  });

  it('suppresses angles and houses at geographic poles and sets under18 using the non-rolling leap-day cutoff', async () => {
    await prepareLocalTime('2010-03-01', 'UTC');
    const pole = computeSolarReturn({
      birthDate: '2010-03-01', birthTime: '08:30', timeKnown: true,
      birthplace: { name: 'North Pole', lat: 90, lon: 0, tz: 'UTC' },
      savedSunLon: null, houseSystem: 'whole',
      castLocation: { name: 'North Pole', lat: 90, lon: 0, tz: 'UTC' },
      year: 2028,
    }, new Date('2028-02-29T12:00:00Z'));
    expect(pole.chart.angles).toBeNull();
    expect(pole.chart.houses).toBeNull();
    expect(pole.atPole).toBe(true);
    expect(pole.under18).toBe(true);

    // Just short of the pole (89.999 deg), full-precision cast coordinates keep their rising sign and houses.
    const nearPole = computeSolarReturn({
      birthDate: '1990-05-03', birthTime: '08:30', timeKnown: true,
      birthplace: { name: 'Near Pole', lat: 89.999, lon: 0, tz: 'UTC' },
      savedSunLon: null, houseSystem: 'whole',
      castLocation: { name: 'Near Pole', lat: 89.999, lon: 0, tz: 'UTC' },
      year: 2026,
    });
    expect(nearPole.atPole).toBeUndefined();
    expect(nearPole.chart.angles).not.toBeNull();
    expect(nearPole.chart.houses).not.toBeNull();
  });

  it('refuses skipped birth times and dates and records a notice on repeated DST-fold birth times', async () => {
    await prepareLocalTime('1990-03-25', 'Europe/Madrid');
    expect(() => computeSolarReturn({
      birthDate: '1990-03-25', birthTime: '02:30', timeKnown: true,
      birthplace: { name: 'Madrid', lat: 40.42, lon: -3.7, tz: 'Europe/Madrid' },
      savedSunLon: null, houseSystem: 'whole',
      castLocation: { name: 'Madrid', lat: 40.42, lon: -3.7, tz: 'Europe/Madrid' },
      year: 2026,
    })).toThrow(SkippedBirthTimeError);

    // A chart previously saved with a DST-gap adjustment preserves its solar return using the saved UTC instant.
    const savedAdjusted = computeSolarReturn({
      birthDate: '1990-03-25', birthTime: '02:30', timeKnown: true,
      birthplace: { name: 'Madrid', lat: 40.42, lon: -3.7, tz: 'Europe/Madrid' },
      savedSunLon: null, savedUtc: '1990-03-25T01:30:00.000Z', houseSystem: 'whole',
      castLocation: { name: 'Madrid', lat: 40.42, lon: -3.7, tz: 'Europe/Madrid' },
      year: 2026,
    });
    expect(savedAdjusted.returnYear).toBe(2026);
    expect(savedAdjusted.chart.angles).not.toBeNull();
    expect(savedAdjusted.chart.houses).not.toBeNull();
    expect(savedAdjusted.clockLimit).toContain('adjusted moment saved with the chart');

    await prepareLocalTime('2011-12-30', 'Pacific/Apia');
    expect(() => computeSolarReturn({
      birthDate: '2011-12-30', birthTime: null, timeKnown: false,
      birthplace: { name: 'Apia', lat: -13.83, lon: -171.76, tz: 'Pacific/Apia' },
      savedSunLon: null, houseSystem: 'whole', castLocation: null,
      year: 2026,
    })).toThrow(SkippedBirthDateError);

    await prepareLocalTime('1990-09-30', 'Europe/Madrid');
    const fold = computeSolarReturn({
      birthDate: '1990-09-30', birthTime: '02:30', timeKnown: true,
      birthplace: { name: 'Madrid', lat: 40.42, lon: -3.7, tz: 'Europe/Madrid' },
      savedSunLon: null, houseSystem: 'whole',
      castLocation: { name: 'Madrid', lat: 40.42, lon: -3.7, tz: 'Europe/Madrid' },
      year: 2026,
    });
    expect(fold.clockLimit).toBe(REPEATED_BIRTH_TIME);
  });
});
