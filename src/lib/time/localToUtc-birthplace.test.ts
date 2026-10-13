import { beforeAll, describe, expect, it } from 'vitest';
import {
  TZDB, prepareLocalTime as preparePackageLocalTime, resolveLocalToUtc as packageResolveLocalToUtc, zoneOffsetAt,
} from '@zodiacs/engine/geo';
import { parseNatalEnvelope } from '@zodiacs/engine/receipt';
import cityIndex from '../../../public/data/cities/index.json';
import { computeCalculatorReceipt } from '../engine/calculator-receipt';
import { offsetAt, prepareLocalTime, resolveLocalToUtc } from './localToUtc';

// Longitudes as the shipped city index carries them (GeoNames, 0.01°).
const BUFFALO = -78.88;
const BREST = -4.49;
const OMAHA = -95.94;
const NEW_YORK = -74.01;
const CHICAGO = -87.65;
const PARIS = 2.35;
const HARTFORD = -72.69;
const PORTO = -8.61;
const GALWAY = -9.05;
const BERGEN = 5.32;
const MANILA = 120.98;

const minutes = (h: number, m: number, s: number) => Math.sign(h || m || s) * (Math.abs(h) * 60 + m + s / 60);

describe('birthplace local mean time', () => {
  beforeAll(() => Promise.all([
    'Africa/Addis_Ababa', 'America/Anchorage', 'America/Chicago', 'America/Juneau', 'America/Kralendijk',
    'America/Mexico_City', 'America/New_York', 'Asia/Manila', 'Asia/Shanghai', 'Europe/Dublin', 'Europe/Isle_of_Man',
    'Europe/Lisbon', 'Europe/Oslo', 'Europe/Paris', 'Indian/Kerguelen', 'Pacific/Apia', 'Pacific/Kiritimati',
    'Pacific/Midway', 'Pacific/Pohnpei', 'UTC', 'Etc/GMT+5',
  ].map((zone) => prepareLocalTime('1800-01-01', zone))));

  it.each([
    // The three towns the engine review measured, each 19–33 minutes from
    // its zone's reference city: 5° to 8° of Ascendant.
    ['Buffalo 1870', '1870-06-15', '12:00', 'America/New_York', BUFFALO, '1870-06-15T17:15:31.000Z', -(5 * 60 + 15 + 31 / 60), -(4 * 60 + 56 + 2 / 60)],
    ['Brest 1880', '1880-06-15', '12:00', 'Europe/Paris', BREST, '1880-06-15T12:17:58.000Z', -(17 + 58 / 60), 9 + 21 / 60],
    ['Omaha 1880', '1880-06-15', '12:00', 'America/Chicago', OMAHA, '1880-06-15T18:23:46.000Z', -(6 * 60 + 23 + 46 / 60), -(5 * 60 + 50 + 36 / 60)],
    ['Porto 1880', '1880-06-15', '12:00', 'Europe/Lisbon', PORTO, '1880-06-15T12:34:26.000Z', -(34 + 26 / 60), -(36 + 45 / 60)],
  ])('%s uses the birthplace mean time', (_label, date, time, zone, longitude, iso, offset, zoneOffset) => {
    const resolved = resolveLocalToUtc(date, time, zone, { longitude });
    expect(resolved.utc.toISOString()).toBe(iso);
    expect(resolved.offsetMinutes).toBeCloseTo(offset, 9);
    expect(resolved.flags).toEqual(['lmt']);
    expect(resolved.localMeanTime?.longitude).toBe(longitude);
    expect(resolved.localMeanTime?.zoneOffsetMinutes).toBeCloseTo(zoneOffset, 9);
    // Without a longitude, the zone's reference city decides, as before.
    const zoneOnly = resolveLocalToUtc(date, time, zone);
    expect(zoneOnly.offsetMinutes).toBeCloseTo(zoneOffset, 9);
    expect(zoneOnly.localMeanTime).toBeUndefined();
  });

  it.each([
    // New York's mean time is tzdb's −4:56:02, Chicago's −5:50:36; the city
    // index's 74.01° W and 87.65° W round to the same seconds.
    ['New York 1870', '1870-06-15', 'America/New_York', NEW_YORK],
    ['Chicago 1880', '1880-06-15', 'America/Chicago', CHICAGO],
  ])('agrees with the zone at its own reference city: %s', (_label, date, zone, longitude) => {
    const withPlace = resolveLocalToUtc(date, '12:00', zone, { longitude });
    const zoneOnly = resolveLocalToUtc(date, '12:00', zone);
    expect(withPlace.utc.toISOString()).toBe(zoneOnly.utc.toISOString());
    expect(withPlace.offsetMinutes).toBeCloseTo(zoneOnly.offsetMinutes, 9);
  });

  it('moves Paris before 1891 by the 3 s between the city index and tzdb', () => {
    // tzdb's Paris mean time is +0:09:21; the index's 2.35° E is +0:09:24.
    const resolved = resolveLocalToUtc('1880-06-15', '12:00', 'Europe/Paris', { longitude: PARIS });
    expect(resolved.utc.toISOString()).toBe('1880-06-15T11:50:36.000Z');
    expect(resolved.offsetMinutes).toBeCloseTo(minutes(0, 9, 24), 9);
    expect(resolved.localMeanTime?.zoneOffsetMinutes).toBeCloseTo(minutes(0, 9, 21), 9);
  });

  it.each([
    // After the era ended, a national mean time was the legal time for the
    // whole country at the capital's offset. Those eras stay Intl's.
    ['Brest under Paris Mean Time, 1900', '1900-06-15', 'Europe/Paris', BREST, minutes(0, 9, 21)],
    ['Galway under Dublin Mean Time, 1885', '1885-06-15', 'Europe/Dublin', GALWAY, -minutes(0, 25, 21)],
    ['Porto under Lisbon Mean Time, 1890', '1890-06-15', 'Europe/Lisbon', PORTO, -minutes(0, 36, 45)],
    ['Buffalo under Eastern time, 1900', '1900-06-15', 'America/New_York', BUFFALO, -300],
    ['Buffalo today', '2024-06-15', 'America/New_York', BUFFALO, -240],
  ])('%s is unchanged', (_label, date, zone, longitude, offset) => {
    const resolved = resolveLocalToUtc(date, '12:00', zone, { longitude });
    expect(resolved).toEqual(resolveLocalToUtc(date, '12:00', zone));
    expect(resolved.offsetMinutes).toBeCloseTo(offset, 9);
    expect(resolved.localMeanTime).toBeUndefined();
  });

  it('follows backzone where the zone kept its own mean time longer than its link', () => {
    // Norway kept local mean time until 1895; Intl follows Berlin's 1893 change.
    const resolved = resolveLocalToUtc('1894-06-15', '12:00', 'Europe/Oslo', { longitude: BERGEN });
    expect(resolved.utc.toISOString()).toBe('1894-06-15T11:38:43.000Z');
    expect(resolved.offsetMinutes).toBeCloseTo(minutes(0, 21, 17), 9);
    // The zone's own clock is Oslo's mean time from the pinned history, not Berlin's +1:00.
    expect(offsetAt('Europe/Oslo', Date.UTC(1894, 5, 15, 11))).toBe(60);
    expect(resolved.localMeanTime?.zoneOffsetMinutes).toBe(43);
    // A year later, Norway's legal time applies.
    const later = resolveLocalToUtc('1895-06-15', '12:00', 'Europe/Oslo', { longitude: BERGEN });
    expect(later.offsetMinutes).toBe(60);
    expect(later.localMeanTime).toBeUndefined();
  });

  it('keeps the calendar day of a zone that later moved across the date line', () => {
    // Manila kept the American date until the end of 1844: −15:56:08 in tzdb.
    const resolved = resolveLocalToUtc('1840-06-15', '12:00', 'Asia/Manila', { longitude: MANILA });
    expect(resolved.offsetMinutes).toBeCloseTo(-minutes(15, 56, 5), 9);
    expect(resolved.utc.toISOString()).toBe('1840-06-16T03:56:05.000Z');
    const after = resolveLocalToUtc('1850-06-15', '12:00', 'Asia/Manila', { longitude: MANILA });
    expect(after.offsetMinutes).toBeCloseTo(minutes(8, 3, 55), 9);
    expect(after.utc.toISOString()).toBe('1850-06-15T03:56:05.000Z');
    // Pohnpei made the same move at the same time, but the host's zone data
    // lacks it; the table's record decides. 158.16° E is 10:32:38.
    const pohnpei = resolveLocalToUtc('1840-06-01', '12:00', 'Pacific/Pohnpei', { longitude: 158.16 });
    expect(pohnpei.utc.toISOString()).toBe('1840-06-02T01:27:22.000Z');
    expect(pohnpei.offsetMinutes).toBeCloseTo(-minutes(13, 27, 22), 9);
    expect(pohnpei.localMeanTime?.longitude).toBe(158.16);
    const pohnpeiAfter = resolveLocalToUtc('1850-06-01', '12:00', 'Pacific/Pohnpei', { longitude: 158.16 });
    expect(pohnpeiAfter.utc.toISOString()).toBe('1850-06-01T01:27:22.000Z');
    // Midway kept the American date; the host links it to Pago Pago, on the Asian one until 1892.
    const midway = resolveLocalToUtc('1880-06-01', '12:00', 'Pacific/Midway', { longitude: -177.37 });
    expect(midway.utc.toISOString()).toBe('1880-06-01T23:49:29.000Z');
  });

  it('moves a skipped wall time forward by the gap the change to standard time left', () => {
    // At 17:00 UT on 1883-11-18 Buffalo's clocks jumped from 11:44:29 to 12:00.
    const resolved = resolveLocalToUtc('1883-11-18', '11:50', 'America/New_York', { longitude: BUFFALO });
    expect(resolved.utc.toISOString()).toBe('1883-11-18T17:05:31.000Z');
    expect(resolved.offsetMinutes).toBe(-300);
    expect(resolved.flags).toEqual(['dst-gap']);
    // The shifted instant is already on Eastern time, but the clock the reading
    // came from was Buffalo's own mean time, which the shift is measured from:
    // the engine reports it, with New York's mean time for comparison.
    expect(resolved.localMeanTime).toEqual({ longitude: BUFFALO, zoneOffsetMinutes: minutes(-4, 56, 2) });
    // Either side of the gap reads normally.
    expect(resolveLocalToUtc('1883-11-18', '11:44', 'America/New_York', { longitude: BUFFALO }).utc.toISOString())
      .toBe('1883-11-18T16:59:31.000Z');
    expect(resolveLocalToUtc('1883-11-18', '12:00', 'America/New_York', { longitude: BUFFALO }).utc.toISOString())
      .toBe('1883-11-18T17:00:00.000Z');
  });

  it('takes the earlier instant of a wall time the change to standard time repeated', () => {
    // East of 75° W the clocks went back: Hartford read 12:00–12:09 twice.
    const resolved = resolveLocalToUtc('1883-11-18', '12:05', 'America/New_York', { longitude: HARTFORD });
    expect(resolved.utc.toISOString()).toBe('1883-11-18T16:55:46.000Z');
    expect(resolved.flags).toEqual(['dst-fold', 'lmt']);
    expect(resolveLocalToUtc('1883-11-18', '12:15', 'America/New_York', { longitude: HARTFORD }).utc.toISOString())
      .toBe('1883-11-18T17:15:00.000Z');
  });

  it.each([
    ['no longitude', undefined],
    ['a non-finite longitude', Number.NaN],
    ['an out-of-range longitude', 200],
  ])('ignores %s', (_label, longitude) => {
    const resolved = resolveLocalToUtc('1870-06-15', '12:00', 'America/New_York', { longitude });
    expect(resolved).toEqual(resolveLocalToUtc('1870-06-15', '12:00', 'America/New_York'));
  });

  it('loads the table for 1953 dates, the last year an era can reach', async () => {
    const fresh = await import('./localToUtc?boundary' as string) as typeof import('./localToUtc');
    await fresh.prepareLocalTime('1953-01-01', 'Pacific/Kiritimati');
    expect(() => fresh.resolveLocalToUtc('1953-01-01', '00:00', 'Pacific/Kiritimati', { longitude: -157.4 })).not.toThrow();
  });

  it('refuses to guess an early time before the zone is prepared', async () => {
    // A zone no test prepares: the engine keeps what it has loaded for the
    // whole run, and its module is shared by every copy of the resolver.
    const zone = 'America/Indiana/Knox';
    const KNOX = -86.62;
    expect(() => resolveLocalToUtc('1870-06-15', '12:00', zone, { longitude: KNOX })).toThrow('prepareLocalTime');
    // Dates up to 1970 need the zone's shipped history, with a longitude or
    // without one; later dates need nothing.
    expect(() => resolveLocalToUtc('1953-01-04', '12:00', zone, { longitude: KNOX })).toThrow('prepareLocalTime');
    expect(() => resolveLocalToUtc('1870-06-15', '12:00', zone)).toThrow('prepareLocalTime');
    expect(resolveLocalToUtc('1971-01-04', '12:00', zone, { longitude: KNOX }).offsetMinutes).toBe(-360);
    await prepareLocalTime('1952-12-31', zone);
    expect(resolveLocalToUtc('1870-06-15', '12:00', zone, { longitude: KNOX }).utc.toISOString()).toBe('1870-06-15T17:46:29.000Z');
    expect(resolveLocalToUtc('1870-06-15', '12:00', zone).offsetMinutes).toBeCloseTo(minutes(-5, 46, 30), 9);
  });

  it('keeps a skipped or repeated date across a date-line move inside the era', () => {
    // Alaska left the Asian date on 1867-10-19: 10:00 that day happened twice.
    const anchorage = resolveLocalToUtc('1867-10-19', '10:00', 'America/Anchorage', { longitude: -149.9 });
    expect(anchorage.utc.toISOString()).toBe('1867-10-18T19:59:36.000Z');
    expect(anchorage.flags).toEqual(['dst-fold', 'lmt']);
    // Manila skipped 1844-12-31 when it moved to the Asian date.
    const manila = resolveLocalToUtc('1844-12-31', '20:00', 'Asia/Manila', { longitude: MANILA });
    expect(manila.flags).toContain('dst-gap');
    expect(manila.utc.getTime()).toBeGreaterThan(resolveLocalToUtc('1844-12-30', '20:00', 'Asia/Manila', { longitude: MANILA }).utc.getTime());
    // Samoa lived 1892-07-04 twice.
    const apia = resolveLocalToUtc('1892-07-04', '18:00', 'Pacific/Apia', { longitude: -171.76 });
    expect(apia.flags).toContain('dst-fold');
  });

  it('treats a whole-minute mean time as local mean time too', () => {
    // 38.75° E is exactly +2:35:00: no seconds, but still the birthplace clock, and since
    // engine rc.15 `lmt` says a local mean time read the wall time, not that it ran to seconds.
    const resolved = resolveLocalToUtc('1860-06-15', '12:00', 'Africa/Addis_Ababa', { longitude: 38.75 });
    expect(resolved.offsetMinutes).toBe(155);
    expect(resolved.flags).toEqual(['lmt']);
    expect(resolved.localMeanTime?.longitude).toBe(38.75);
  });

  it('bounds the departure in whole seconds, alike in every zone', () => {
    // 29.008333° W is exactly 180 minutes from New York's mean time.
    expect(resolveLocalToUtc('1883-11-17', '09:03', 'America/New_York', { longitude: -29.008333333333333 }).localMeanTime)
      .toBeDefined();
    expect(resolveLocalToUtc('1883-11-17', '09:03', 'America/New_York', { longitude: -29 }).localMeanTime).toBeUndefined();
  });

  it('ignores a longitude hours away from the zone, as a birthplace in another zone', () => {
    // Toronto's longitude under Juneau's zone is 3 h 40 min from Juneau's mean time.
    const resolved = resolveLocalToUtc('1867-10-18', '12:00', 'America/Juneau', { longitude: -79.38 });
    // The zone's clock, as without a longitude, with `lmt`: the zone's own mean time read the wall time.
    expect(resolved).toEqual(resolveLocalToUtc('1867-10-18', '12:00', 'America/Juneau'));
    expect(resolved.flags).toEqual(['lmt']);
    // The widest real case in the city index, Gar under Shanghai's zone, is kept.
    expect(resolveLocalToUtc('1890-06-15', '12:00', 'Asia/Shanghai', { longitude: 80.1 }).localMeanTime).toBeDefined();
  });

  it.each(['UTC', 'Etc/GMT+5'])('leaves %s, which has no local mean time era, to Intl', (zone) => {
    const resolved = resolveLocalToUtc('1870-06-15', '12:00', zone, { longitude: BUFFALO });
    expect(resolved).toEqual(resolveLocalToUtc('1870-06-15', '12:00', zone));
  });

  it('produces portable receipts that validate', () => {
    for (const [date, time, zone, longitude] of [
      ['1870-06-15', '12:00', 'America/New_York', BUFFALO],
      ['1883-11-18', '11:50', 'America/New_York', BUFFALO],
      ['1883-11-18', '12:05', 'America/New_York', HARTFORD],
    ] as const) {
      const resolved = resolveLocalToUtc(date, time, zone, { longitude });
      const captured = computeCalculatorReceipt({
        utc: resolved.utc, latitude: 42.89, longitude, houseSystem: 'placidus', timeKnown: true, flags: resolved.flags,
      }, { date, time, timeZone: zone, offsetMinutes: resolved.offsetMinutes, reference: 'supplied-instant' });
      expect(captured).not.toBeNull();
      expect(parseNatalEnvelope(captured!.envelopeJson).ok).toBe(true);
    }
  });
});

describe('the engine\'s local mean time eras', () => {
  it('ships tzdata 2025c with backzone', () => {
    expect(TZDB).toMatchObject({ version: '2025c', form: 'main+backzone' });
    expect(TZDB.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('covers every zone the birthplace search offers', async () => {
    // Before standard time every zone of the city index reads the engine's
    // shipped history; Kerguelen was uninhabited until 1950, which tzdb
    // records as "-00", read from Intl.
    const fromIntl = new Set(['Indian/Kerguelen']);
    const uncovered: string[] = [];
    for (const zone of cityIndex.tz.filter((name: string) => !/^(?:Etc\/|UTC$)/.test(name))) {
      await preparePackageLocalTime('1850-06-15', zone);
      const source = packageResolveLocalToUtc('1850-06-15', '12:00', zone).zone.source;
      if (source !== (fromIntl.has(zone) ? 'intl' : 'tzdb')) uncovered.push(zone);
    }
    expect(uncovered).toEqual([]);
  });

  it.each([
    ['America/New_York', '1883-11-18T17:00:00.000Z'],
    ['America/Chicago', '1883-11-18T18:00:00.000Z'],
    ['Europe/Paris', '1891-03-15T23:50:39.000Z'],
    ['Europe/Dublin', '1880-08-02T00:25:21.000Z'],
    ['Europe/Lisbon', '1884-01-01T00:36:45.000Z'],
    ['Europe/Oslo', '1894-12-31T23:17:00.000Z'],
    ['Asia/Manila', '1899-09-06T04:00:00.000Z'],
    ['America/Anchorage', '1900-08-20T21:59:36.000Z'],
    // A backzone Zone that replaces a main-data Link (to Puerto Rico).
    ['America/Kralendijk', '1912-02-12T04:35:47.000Z'],
    // An UNTIL in standard time ("0:00s"), not universal time.
    ['Europe/Isle_of_Man', '1883-03-30T00:17:55.000Z'],
  ])('ends %s at %s', async (zone, iso) => {
    await prepareLocalTime('1850-01-01', zone);
    const end = Date.parse(iso);
    // The wall time an hour either side of the end, on the zone's own clock.
    const read = (instant: number) => {
      const wall = new Date(instant + zoneOffsetAt(zone, instant) * 60_000).toISOString();
      return resolveLocalToUtc(wall.slice(0, 10), wall.slice(11, 16), zone);
    };
    const before = read(end - 3_600_000);
    const after = read(end + 3_600_000);
    expect(before.flags).toContain('lmt');
    expect(after.flags).not.toContain('lmt');
  });

  it('matches Intl on the offset change where the zone and its reference data agree', () => {
    // New York and Chicago change from local mean time to a different
    // standard offset, which Intl can see.
    for (const [zone, iso] of [['America/New_York', '1883-11-18T17:00:00.000Z'], ['America/Chicago', '1883-11-18T18:00:00.000Z']]) {
      const end = Date.parse(iso);
      expect(offsetAt(zone, end - 1000)).not.toBe(offsetAt(zone, end));
    }
  });
});
