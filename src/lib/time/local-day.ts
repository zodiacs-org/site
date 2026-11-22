/**
 * A local calendar date as real time on one zone's clock. A clock can show a
 * date twice (Apia lived 4 July 1892 twice when it moved to the American date)
 * or never show it (Apia went from 29 to 31 December 2011). The resolver
 * (./localToUtc.ts, or the engine's own through the compute API's module) reads
 * a repeated wall time at its earlier pass unless asked for the later one, and
 * moves a skipped one forward by the jump, so neither the first nor the last
 * minute of a date alone says where the date starts and ends.
 *
 * Pure: it reads the resolutions it is given and resolves nothing itself.
 */

/** What this module needs of a resolved wall time. */
export interface WallResolution {
  utc: Date;
  /** Minutes east at the resolved instant; fractional on a local mean time. */
  offsetMinutes: number;
}

/** The rest of a date's last minute, so the span runs to 23:59:59. */
const LAST_MINUTE_MS = 59_000;

/**
 * Whether a resolved wall time sits on the date asked for (YYYY-MM-DD). A wall
 * time in a gap moves forward by the jump, so a date the clock skipped
 * resolves onto a later one.
 */
export function readsOnDate(date: string, resolution: WallResolution): boolean {
  const wall = resolution.utc.getTime() + Math.round(resolution.offsetMinutes * 60_000);
  return new Date(wall).toISOString().slice(0, 10) === date;
}

/**
 * The real-time extent of a local date: from the earlier pass of its 00:00 to
 * the end (23:59:59) of the later pass of its 23:59, so a date the clock showed
 * twice is covered whole; null when the clock skipped the date. `first` is the
 * date's 00:00 resolved with the earlier fold (the resolver's default), `last`
 * its 23:59 resolved with the later fold.
 */
export function localDaySpan(date: string, first: WallResolution, last: WallResolution): [Date, Date] | null {
  if (!readsOnDate(date, first)) return null;
  return [first.utc, new Date(last.utc.getTime() + LAST_MINUTE_MS)];
}
