import { beforeAll, describe, expect, it, vi } from 'vitest';
import { prepareLocalTime as preparePackageLocalTime, resolveLocalToUtc as packageResolveLocalToUtc } from '@zodiacs/engine/geo';
import { offsetAt, prepareLocalTime, resolveLocalToUtc } from './localToUtc';

/*
 * Before 1970, a wall time takes its zone's legal offsets from the history
 * @zodiacs/engine/geo ships (tzdata 2025c with backzone), not from the
 * browser, whose default build gives many places another city's history.
 * Each case below differs from the host (Node's ICU, tzdb 2025c without
 * backzone), which the "host" column records. Since the site resolves through
 * the engine, the shipped history applies with or without a longitude.
 */
const CASES: [label: string, date: string, zone: string, longitude: number, utc: string, offset: number, host: number][] = [
  // Sweden kept +1:00 all year from 1917 to 1979; Berlin had summer time, and double summer time in 1947.
  ['Stockholm, July 1947', '1947-07-01', 'Europe/Stockholm', 18.07, '1947-07-01T11:00:00.000Z', 60, 120],
  ['Stockholm, June 1947', '1947-06-15', 'Europe/Stockholm', 18.07, '1947-06-15T11:00:00.000Z', 60, 180],
  // Amsterdam's own summer time, +1:20, where the host has Brussels's +1:00.
  ['Amsterdam, 1938', '1938-06-15', 'Europe/Amsterdam', 4.89, '1938-06-15T10:40:00.000Z', 80, 60],
  // Amsterdam Mean Time was Dutch legal time from 1835; the host has Brussels's +0:17:30.
  ['Rotterdam, 1880', '1880-06-15', 'Europe/Amsterdam', 4.48, '1880-06-15T11:40:28.000Z', 19 + 32 / 60, 17.5],
  ['Reykjavik, 1950', '1950-01-15', 'Atlantic/Reykjavik', -21.9, '1950-01-15T13:00:00.000Z', -60, 0],
  ['Oslo, 1960', '1960-07-01', 'Europe/Oslo', 10.75, '1960-07-01T10:00:00.000Z', 120, 60],
  ['Oranjestad, 1943', '1943-06-01', 'America/Aruba', -70.03, '1943-06-01T16:30:00.000Z', -270, -180],
  ["St John's, Antigua, 1930", '1930-06-01', 'America/Antigua', -61.85, '1930-06-01T17:00:00.000Z', -300, -240],
  ['Copenhagen, 1945', '1945-08-20', 'Europe/Copenhagen', 12.57, '1945-08-20T11:00:00.000Z', 60, 180],
  // Kinshasa adopted West Africa Time in 1897; the host has Lagos's mean time.
  ['Kinshasa, 1900', '1900-06-01', 'Africa/Kinshasa', 15.31, '1900-06-01T11:00:00.000Z', 60, 13 + 35 / 60],
];

describe('the pinned zone history before 1970', () => {
  beforeAll(() => Promise.all([...new Set([...CASES.map((row) => row[2]), 'America/New_York', 'WET', 'Indian/Kerguelen'])]
    .map((zone) => prepareLocalTime('1900-01-01', zone))));

  it.each(CASES)('%s', (_label, date, zone, longitude, utc, offset, host) => {
    const resolved = resolveLocalToUtc(date, '12:00', zone, { longitude });
    expect(resolved.utc.toISOString()).toBe(utc);
    expect(resolved.offsetMinutes).toBeCloseTo(offset, 9);
    // Without a longitude the shipped history applies too: no birthplace here keeps a local mean time.
    expect(resolveLocalToUtc(date, '12:00', zone)).toEqual(resolved);
    // The host's default build would have given another offset at that instant.
    expect(offsetAt(zone, resolved.utc.getTime())).toBeCloseTo(host, 9);
  });

  it('changes nothing where the host already has the place\'s history', () => {
    const resolved = resolveLocalToUtc('1950-07-01', '12:00', 'America/New_York', { longitude: -74.01 });
    expect(resolved).toEqual(resolveLocalToUtc('1950-07-01', '12:00', 'America/New_York'));
  });

  it('resolves across the hand-over to the host at 1970', () => {
    for (const [date, time, utc] of [
      ['1969-12-31', '23:30', '1969-12-31T22:30:00.000Z'],
      ['1970-01-01', '00:30', '1969-12-31T23:30:00.000Z'],
      ['1970-01-01', '01:30', '1970-01-01T00:30:00.000Z'],
    ]) {
      const resolved = resolveLocalToUtc(date, time, 'Europe/Stockholm', { longitude: 18.07 });
      expect(resolved.utc.toISOString()).toBe(utc);
      expect(resolved.flags).toEqual([]);
    }
  });

  it('matches a zone name in any letter case, as Intl does', async () => {
    await prepareLocalTime('1947-07-01', 'europe/stockholm');
    for (const zone of ['europe/stockholm', 'EUROPE/STOCKHOLM', 'Europe/Stockholm']) {
      expect(resolveLocalToUtc('1947-07-01', '12:00', zone, { longitude: 18.07 }).utc.toISOString()).toBe('1947-07-01T11:00:00.000Z');
    }
  });

  it('reads the host where the pinned history has no local time ("-00")', () => {
    // tzdb has no local time for the Kerguelen Islands before 1950.
    const resolved = resolveLocalToUtc('1940-01-01', '12:00', 'Indian/Kerguelen', { longitude: 70.22 });
    expect(resolved.utc.getTime()).toBe(resolveLocalToUtc('1940-01-01', '12:00', 'Indian/Kerguelen').utc.getTime());
  });

  it('leaves a name whose pinned history differs after 1970 to the default build', async () => {
    // One of the 16 names the engine ships in the default build's form, so the hand-over at 1970 cannot jump.
    await preparePackageLocalTime('1950-06-15', 'WET');
    expect(packageResolveLocalToUtc('1950-06-15', '12:00', 'WET').zone.dataForm).toBe('main');
    const resolved = resolveLocalToUtc('1950-06-15', '12:00', 'WET', { longitude: -9.14 });
    expect(resolved).toEqual(resolveLocalToUtc('1950-06-15', '12:00', 'WET'));
  });
});

describe('loading the pinned history', () => {
  it('refuses to resolve a birthplace time before 1970 until the zone is prepared', async () => {
    // Zones no other test in this file prepares: the loaded clock is shared.
    const fresh = await import('./localToUtc?history-unloaded' as string) as typeof import('./localToUtc');
    expect(() => fresh.resolveLocalToUtc('1938-06-15', '12:00', 'Europe/Luxembourg', { longitude: 6.13 }))
      .toThrow('prepareLocalTime');
    await fresh.prepareLocalTime('1938-06-15', 'Europe/Zagreb');
    // Preparing another zone does not prepare this one.
    expect(() => fresh.resolveLocalToUtc('1938-06-15', '12:00', 'Europe/Luxembourg', { longitude: 6.13 }))
      .toThrow('prepareLocalTime');
    // 1971 needs nothing.
    expect(() => fresh.resolveLocalToUtc('1971-06-15', '12:00', 'Europe/Luxembourg', { longitude: 6.13 })).not.toThrow();
    await fresh.prepareLocalTime('1938-06-15', 'Europe/Luxembourg');
    expect(() => fresh.resolveLocalToUtc('1938-06-15', '12:00', 'Europe/Luxembourg', { longitude: 6.13 })).not.toThrow();
  });

  it('prepares 1 January 1970, whose early wall times fall in 1969', async () => {
    const fresh = await import('./localToUtc?history-1970' as string) as typeof import('./localToUtc');
    await fresh.prepareLocalTime('1970-01-01', 'Asia/Tokyo');
    expect(fresh.resolveLocalToUtc('1970-01-01', '06:00', 'Asia/Tokyo', { longitude: 139.69 }).utc.toISOString())
      .toBe('1969-12-31T21:00:00.000Z');
  });

  it('reports a failed download as a ModuleLoadError, and does not remember it', async () => {
    vi.resetModules();
    let fail = true;
    vi.doMock('@zodiacs/engine/geo', async (importOriginal) => {
      const original = await importOriginal<typeof import('@zodiacs/engine/geo')>();
      return {
        ...original,
        prepareLocalTime: async (date: string, timeZone: string) => {
          if (fail) throw new TypeError('Failed to fetch dynamically imported module');
          return original.prepareLocalTime(date, timeZone);
        },
      };
    });
    const fresh = await import('./localToUtc');
    const { ModuleLoadError } = await import('../module-load');
    await expect(fresh.prepareLocalTime('1947-07-01', 'Europe/Stockholm')).rejects.toBeInstanceOf(ModuleLoadError);
    fail = false;
    await fresh.prepareLocalTime('1947-07-01', 'Europe/Stockholm');
    expect(fresh.resolveLocalToUtc('1947-07-01', '12:00', 'Europe/Stockholm', { longitude: 18.07 }).offsetMinutes).toBe(60);
    vi.doUnmock('@zodiacs/engine/geo');
    vi.resetModules();
  });

  it('raises no unhandled rejection when a caller stops waiting for a failed download', async () => {
    vi.resetModules();
    vi.doMock('@zodiacs/engine/geo', async (importOriginal) => ({
      ...await importOriginal<typeof import('@zodiacs/engine/geo')>(),
      prepareLocalTime: async () => { throw new TypeError('Failed to fetch dynamically imported module'); },
    }));
    const unhandled: unknown[] = [];
    const listener = (reason: unknown) => { unhandled.push(reason); };
    process.on('unhandledRejection', listener);
    try {
      const fresh = await import('./localToUtc');
      // Started early and never awaited, as the chart calculator does when its engine fails first.
      void fresh.prepareLocalTime('1947-07-01', 'Europe/Oslo');
      await new Promise((settle) => { setTimeout(settle, 50); });
      expect(unhandled).toEqual([]);
      // A caller that does wait still sees the failure.
      await expect(fresh.prepareLocalTime('1947-07-01', 'Europe/Oslo')).rejects.toThrow();
    } finally {
      process.off('unhandledRejection', listener);
      vi.doUnmock('@zodiacs/engine/geo');
      vi.resetModules();
    }
  });
});
