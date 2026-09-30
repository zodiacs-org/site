import { beforeAll, describe, expect, it } from 'vitest';
import lmtTable from '../../data/tz-lmt.json';
import { offsetAt, prepareLocalTime, resolveLocalToUtc } from './localToUtc';
import { loadZoneHistory } from './tz-history-load';

/*
 * A town on its zone's own reference meridian keeps the zone's clock. So at
 * every era end where the host's history agrees with the table and with the
 * pinned history (the same mean time before, a change at the same instant,
 * no second change within 36 hours, and the same offsets for three days
 * either side), resolving with the zone's own mean-time longitude must give
 * exactly what resolving without a longitude gives: the same instant, offset
 * and flags, for every wall time around the change. Wall minutes are checked
 * one by one across the jump and an hour either side, and every two hours
 * elsewhere within 26 hours of the end. Only the reading with a longitude
 * says which clock it was: `lmt` there, before the era ended, and never
 * without one, which cannot tell the zone's mean time from a legal clock at the
 * same offset.
 */
const table = lmtTable as unknown as {
  eras: Record<string, number>;
  offsets: Record<string, number>;
  dateLine: Record<string, [number, number][]>;
};

/** The zone's mean time in seconds just before its era ended, from the table. */
function eraSeconds(zone: string, endMs: number): number {
  const lines = table.dateLine[zone];
  if (lines) for (const [until, offset] of lines) if (endMs - 1 < until * 1000) return offset;
  return table.offsets[zone];
}

function supported(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function wallParts(ms: number): [string, string] {
  const iso = new Date(ms).toISOString();
  return [iso.slice(0, 10), iso.slice(11, 16)];
}

const zones = Object.keys(table.eras).filter(supported);
let agreeing: string[] = [];

describe('the birthplace clock on its zone\'s own meridian', () => {
  beforeAll(async () => {
    agreeing = [];
    for (const zone of zones) {
      await prepareLocalTime('1800-01-01', zone);
      const history = await loadZoneHistory(zone);
      if (!history) continue;
      const endMs = table.eras[zone] * 1000;
      const before = offsetAt(zone, endMs - 1);
      const after = offsetAt(zone, endMs);
      if (Math.round(before * 60) !== eraSeconds(zone, endMs) || after === before
        || offsetAt(zone, endMs + 36 * 3_600_000) !== after) continue;
      let pinnedAgrees = true;
      for (let t = endMs - 3 * 86_400_000; t <= endMs + 3 * 86_400_000 && pinnedAgrees; t += 10 * 60_000) {
        let index = 0;
        while (index < history.t.length && history.t[index] * 1000 <= t) index += 1;
        const host = Math.round(offsetAt(zone, t) * 60);
        pinnedAgrees = (history.o[index] ?? host) === host;
      }
      if (pinnedAgrees) agreeing.push(zone);
    }
  }, 120_000);

  it('covers most era ends', () => {
    expect(agreeing.length).toBeGreaterThan(300);
  });

  it('matches the zone clock at every era end where the host agrees with the table', () => {
    const failures: string[] = [];
    let checked = 0;
    let jumps = 0;
    for (const zone of agreeing) {
      const endMs = table.eras[zone] * 1000;
      const seconds = eraSeconds(zone, endMs);
      // The same mean time, on the side of the date line a longitude can name.
      const longitude = (Math.abs(seconds) > 43_200 ? seconds - Math.sign(seconds) * 86_400 : seconds) / 240;
      const walls = [endMs + seconds * 1000, endMs + Math.round(offsetAt(zone, endMs) * 60_000)];
      const low = Math.floor((Math.min(...walls) - 3_600_000) / 60_000) * 60_000;
      const high = Math.max(...walls) + 3_600_000;
      const times = new Set<number>();
      for (let wall = low; wall <= high; wall += 60_000) times.add(wall);
      for (let wall = low - 26 * 3_600_000; wall <= high + 26 * 3_600_000; wall += 2 * 3_600_000) times.add(wall);
      for (const wall of times) {
        const [date, time] = wallParts(wall);
        const zoneClock = resolveLocalToUtc(date, time, zone);
        const ownMeridian = resolveLocalToUtc(date, time, zone, { longitude });
        checked += 1;
        if (zoneClock.flags.some((flag) => flag === 'dst-gap' || flag === 'dst-fold')) jumps += 1;
        const jumpsOnly = (flags: readonly string[]) => flags.filter((flag) => flag !== 'lmt').join();
        if (ownMeridian.utc.getTime() !== zoneClock.utc.getTime()
          || Math.abs(ownMeridian.offsetMinutes - zoneClock.offsetMinutes) > 1e-9
          || jumpsOnly(ownMeridian.flags) !== jumpsOnly(zoneClock.flags)
          || zoneClock.flags.includes('lmt')
          || ownMeridian.flags.includes('lmt') !== (ownMeridian.utc.getTime() < endMs)) {
          failures.push(`${zone} ${date} ${time}: ${ownMeridian.utc.toISOString()} [${ownMeridian.flags}] `
            + `where the zone clock gives ${zoneClock.utc.toISOString()} [${zoneClock.flags}]`);
        }
      }
    }
    // On Node 22.22 (ICU 78.2): 338 of 518 zones, 54,858 wall times, 5,214 of them gaps or folds.
    expect(checked).toBeGreaterThan(50_000);
    expect(jumps).toBeGreaterThan(5_000);
    expect(failures.slice(0, 5)).toEqual([]);
  }, 300_000);
});
