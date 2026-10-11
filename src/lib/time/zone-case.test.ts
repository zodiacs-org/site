import { describe, expect, it, vi } from 'vitest';
import { resolveLocalToUtc as packageResolveLocalToUtc } from '@zodiacs/engine/geo';
import tzNames from '../../data/tz-names.json';
import { offsetAt, prepareLocalTime, resolveLocalToUtc } from './localToUtc';
import { canonicalZoneName } from './zone-names';

/*
 * Intl reads a zone name in any letter case. The resolver must too: the
 * site's local mean time table was once read case-sensitively, so
 * america/new_york skipped the birthplace's mean time that America/New_York
 * applied, and a birth in Buffalo in 1870 moved by 19½ minutes. The engine's
 * resolver, which the site now uses, reads names in any case as well.
 *
 * The site's own formatter caches (offsetAt, localDateContainsUtc) hold at
 * most 1,024 formatters each, whatever names a caller sends. The engine's
 * resolver keeps one formatter per name it is given, so a caller that takes a
 * name from outside maps it to its tzdb spelling first: the compute API does,
 * and its own tests count the names it passes.
 */

/** Every letter of a name flipped to the other case. */
function swapped(name: string): string {
  return [...name].map((letter) => (letter === letter.toLowerCase() ? letter.toUpperCase() : letter.toLowerCase())).join('');
}

function intlAccepts(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

async function resolved(date: string, time: string, zone: string, longitude: number) {
  await prepareLocalTime(date, zone);
  return resolveLocalToUtc(date, time, zone, { longitude });
}

describe('a zone name in any letter case', () => {
  it('resolves a birth in Buffalo in 1870 to the same instant, on the birthplace mean time', async () => {
    const exact = await resolved('1870-06-15', '12:00', 'America/New_York', -78.8784);
    expect(exact.utc.toISOString()).toBe('1870-06-15T17:15:31.000Z');
    expect(exact.flags).toEqual(['lmt']);
    for (const zone of ['america/new_york', 'AMERICA/NEW_YORK', 'America/NEW_york', swapped('America/New_York')]) {
      expect(await resolved('1870-06-15', '12:00', zone, -78.8784), zone).toEqual(exact);
    }
  });

  it('resolves a birth west of Paris in 1880 to the same instant, on the birthplace mean time', async () => {
    const exact = await resolved('1880-06-15', '12:00', 'Europe/Paris', -4.4861);
    expect(exact.utc.toISOString()).toBe('1880-06-15T12:17:57.000Z');
    expect(exact.localMeanTime).toEqual({ longitude: -4.4861, zoneOffsetMinutes: 9.35 });
    for (const zone of ['europe/paris', 'EUROPE/PARIS', swapped('Europe/Paris')]) {
      expect(await resolved('1880-06-15', '12:00', zone, -4.4861), zone).toEqual(exact);
    }
  });

  it('gives every tzdb zone the same instant lower-cased and upper-cased, on a birthplace mean time', async () => {
    let tested = 0;
    const differences: string[] = [];
    for (const zone of tzNames.names) {
      // Asia/Hanoi is in tzdata's backzone, but not in the runtime's Intl data.
      if (!intlAccepts(zone)) continue;
      await prepareLocalTime('1850-06-15', zone);
      // 5° east of the zone's own mean-time meridian, before most zones kept standard time.
      const meridian = packageResolveLocalToUtc('1800-06-15', '12:00', zone).offsetMinutes / 4;
      const longitude = Math.max(-180, Math.min(180, meridian + 5));
      const exact = await resolved('1850-06-15', '12:00', zone, longitude);
      for (const spelling of [zone.toLowerCase(), zone.toUpperCase()]) {
        const other = await resolved('1850-06-15', '12:00', spelling, longitude);
        if (JSON.stringify(other) !== JSON.stringify(exact)) differences.push(`${zone} as ${spelling}`);
      }
      tested += 1;
    }
    expect(tested).toBe(597);
    expect(differences).toEqual([]);
  }, 120_000);

  it('keeps at most 1,024 formatters of its own, whatever names a caller sends', () => {
    // Every formatter offsetAt builds is stored with Map.prototype.set:
    // record the size of each map a formatter is stored in.
    const set = Map.prototype.set;
    let most = 0;
    const spy = vi.spyOn(Map.prototype, 'set').mockImplementation(function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
      const map = set.call(this, key, value);
      if (value instanceof Intl.DateTimeFormat) most = Math.max(most, this.size);
      return map;
    });
    try {
      // Intl takes UTC offsets as names, 1,440 of them here; none is a zone the site uses.
      for (let minutes = 0; minutes < 24 * 60; minutes += 1) {
        const zone = `+${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
        offsetAt(zone, Date.UTC(2000, 0, 1, 12));
      }
    } finally {
      spy.mockRestore();
    }
    // The cache reached the limit and never passed it.
    expect(most).toBe(1024);
    // A name Intl refuses is never stored, and never reaches the engine.
    expect(() => resolveLocalToUtc('2000-01-01', '12:00', 'Europe/Atlantis')).toThrow(RangeError);
  });
});

describe('canonicalZoneName', () => {
  const names = [...new Set([...Intl.supportedValuesOf('timeZone'), ...tzNames.names])];

  it('gives the tzdb spelling of a name written in any letter case', async () => {
    expect(await canonicalZoneName('america/new_york')).toBe('America/New_York');
    expect(await canonicalZoneName('EUROPE/PARIS')).toBe('Europe/Paris');
    expect(await canonicalZoneName('us/eastern')).toBe('US/Eastern');
    expect(await canonicalZoneName('asia/kolkata')).toBe('Asia/Kolkata');
    expect(await canonicalZoneName('america/argentina/comodrivadavia')).toBe('America/Argentina/ComodRivadavia');
    expect(await canonicalZoneName('ZULU')).toBe('Zulu');
    expect(await canonicalZoneName('wet')).toBe('WET');
  });

  it('maps every name of the runtime and of tzdata 2025c with backzone to itself, and no two differ only in case', async () => {
    const keys = new Map<string, string>();
    for (const name of names) {
      const key = name.toLowerCase();
      expect(keys.get(key) ?? name, `${name} and ${keys.get(key)}`).toBe(name);
      keys.set(key, name);
      expect(await canonicalZoneName(name), name).toBe(name);
      expect(await canonicalZoneName(swapped(name)), name).toBe(name);
    }
    expect(names.length).toBeGreaterThan(590);
  });

  it('maps a name no table has to nothing, even where Intl would take it', async () => {
    for (const name of ['Europe/Atlantis', 'SystemV/AST4', 'US/Pacific-New', 'Canada/East-Saskatchewan', '+05:30', 'Etc/GMT+13', '', 'Europe/Kiev', 'x'.repeat(65)]) {
      expect(await canonicalZoneName(name), name).toBeNull();
    }
  });
});
