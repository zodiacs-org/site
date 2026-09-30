import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { prepareLocalTime, resolveLocalToUtc } from './localToUtc';
import { canonicalZoneName } from './zone-names';

/*
 * Intl reads a zone name in any letter case. The resolver must too: its
 * local mean time table was once read case-sensitively, so america/new_york
 * skipped the birthplace's mean time that America/New_York applied, and a
 * birth in Buffalo in 1870 moved by 19½ minutes. Its formatter caches grew
 * with every name a caller sent and were never freed; they now hold at most
 * 1,024 formatters each, and the compute API passes the resolver only a
 * name's tzdb spelling, which the API's own tests count.
 */

const lmt = JSON.parse(readFileSync(new URL('../../data/tz-lmt.json', import.meta.url), 'utf8')) as {
  eras: Record<string, number>;
  offsets: Record<string, number>;
};
const HISTORY = new URL('../../data/tz-history/2025c/', import.meta.url);

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

  it('gives every zone with a local mean time era the same instant lower-cased and upper-cased', async () => {
    let tested = 0;
    const differences: string[] = [];
    for (const [zone, end] of Object.entries(lmt.eras)) {
      // Asia/Hanoi is in the table from backzone, but not in the runtime's Intl data.
      if (!intlAccepts(zone)) continue;
      // Two years before the era ended, 5° east of the zone's own mean-time meridian.
      const day = new Date(end * 1000 - 2 * 365.25 * 86_400_000);
      if (day.getUTCFullYear() < 1800) continue;
      const date = day.toISOString().slice(0, 10);
      const meridian = Object.prototype.hasOwnProperty.call(lmt.offsets, zone) ? lmt.offsets[zone] / 240 : 0;
      const longitude = Math.max(-180, Math.min(180, meridian + 5));
      const exact = await resolved(date, '12:00', zone, longitude);
      for (const spelling of [zone.toLowerCase(), zone.toUpperCase()]) {
        const other = await resolved(date, '12:00', spelling, longitude);
        if (JSON.stringify(other) !== JSON.stringify(exact)) differences.push(`${zone} ${date} as ${spelling}`);
      }
      tested += 1;
    }
    expect(tested).toBe(518);
    expect(differences).toEqual([]);
  }, 120_000);

  it('keeps at most 1,024 formatters of each kind, whatever names a caller sends', () => {
    // Every formatter the resolver builds is stored with Map.prototype.set:
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
        resolveLocalToUtc('2000-01-01', '12:00', zone);
      }
    } finally {
      spy.mockRestore();
    }
    // The caches reached the limit and never passed it.
    expect(most).toBe(1024);
    // A name Intl refuses is never stored.
    expect(() => resolveLocalToUtc('2000-01-01', '12:00', 'Europe/Atlantis')).toThrow(RangeError);
  });
});

describe('canonicalZoneName', () => {
  const pinned = readdirSync(HISTORY).filter((name) => /^\d{2}\.json$/u.test(name))
    .flatMap((name) => Object.keys(JSON.parse(readFileSync(new URL(name, HISTORY), 'utf8')).zones));
  const excluded = Object.keys(JSON.parse(readFileSync(new URL('excluded.json', HISTORY), 'utf8')).excluded);
  const names = [...new Set([...Intl.supportedValuesOf('timeZone'), ...Object.keys(lmt.eras), ...pinned, ...excluded])];

  it('gives the tzdb spelling of a name written in any letter case', async () => {
    expect(await canonicalZoneName('america/new_york')).toBe('America/New_York');
    expect(await canonicalZoneName('EUROPE/PARIS')).toBe('Europe/Paris');
    expect(await canonicalZoneName('us/eastern')).toBe('US/Eastern');
    expect(await canonicalZoneName('asia/kolkata')).toBe('Asia/Kolkata');
    expect(await canonicalZoneName('america/argentina/comodrivadavia')).toBe('America/Argentina/ComodRivadavia');
    expect(await canonicalZoneName('ZULU')).toBe('Zulu');
    expect(await canonicalZoneName('wet')).toBe('WET');
  });

  it('maps every name of the runtime, the local mean time table and the pinned release to itself, and no two differ only in case', async () => {
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
