/**
 * A local calendar date as real time on one zone's clock. A clock can show a
 * date twice (Apia lived 4 July 1892 twice when it moved to the American date),
 * never show it (Apia went from 29 to 31 December 2011), or jump into or out
 * of it partway (St. John's moved its clocks from 23:00 on 2 May 1920 straight
 * to 00:00 on 3 May). The resolver (./localToUtc.ts, or the engine's own
 * through the compute API's module) reads a repeated wall time at its earlier
 * pass unless asked for the later one, and moves a skipped one forward by the
 * jump, so neither the first nor the last minute of a date alone says where
 * the date starts and ends: where the clock reaches the date's 00:00 and the
 * next date's 00:00 does, and where it last shows the date's 23:59.
 *
 * Pure: it resolves wall times only through the resolver it is given.
 */

/** What this module needs of a resolved wall time. */
export interface WallResolution {
  utc: Date;
  /** Minutes east at the resolved instant; fractional on a local mean time. */
  offsetMinutes: number;
  /** "dst-gap" marks a wall time the clock skipped, moved forward by the jump. */
  flags: readonly string[];
}

/**
 * A wall time (YYYY-MM-DD, HH:MM) on the one clock the span is read on, at
 * the pass asked for. The date can be the day before or after the one asked
 * about, so the clock must be prepared for those too where they need it.
 */
export type WallResolver = (date: string, time: string, fold: 'earlier' | 'later') => WallResolution;

const SECOND = 1_000;
const MINUTE = 60_000;
const DAY = 86_400_000;

/** The rest of a date's last minute, so the span runs to 23:59:59. */
const LAST_MINUTE_MS = 59_000;

/** A resolution's wall time, as milliseconds of a UTC clock showing it. */
function wallOf(resolution: WallResolution): number {
  return resolution.utc.getTime() + Math.round(resolution.offsetMinutes * MINUTE);
}

/**
 * Whether a resolved wall time sits on the date asked for (YYYY-MM-DD). A wall
 * time in a gap moves forward by the jump, so a date the clock skipped
 * resolves onto a later one.
 */
export function readsOnDate(date: string, resolution: WallResolution): boolean {
  return new Date(wallOf(resolution)).toISOString().slice(0, 10) === date;
}

/**
 * The instant the clock first reaches a whole-minute wall time, given as
 * milliseconds of a UTC clock showing it: where it first shows it, or, when
 * it jumped over it, where the jump happened. A wall time in a gap is read at
 * the offset before the jump, so the gap's first minute, found by halving the
 * minutes back over one jump's length, read at that offset is the jump.
 */
function reaches(wall: number, resolve: WallResolver): number {
  const at = (minute: number) => {
    const iso = new Date(minute).toISOString();
    return resolve(iso.slice(0, 10), iso.slice(11, 16), 'earlier');
  };
  const here = at(wall);
  if (!here.flags.includes('dst-gap')) return here.utc.getTime();
  const before = wall - here.utc.getTime();
  const inThisGap = (minute: number) => {
    const resolution = at(minute);
    return resolution.flags.includes('dst-gap') && Math.abs(minute - resolution.utc.getTime() - before) < SECOND;
  };
  const jumpMinutes = Math.max(0, Math.ceil((Math.round(here.offsetMinutes * MINUTE) - before) / MINUTE));
  let outside = wall - jumpMinutes * MINUTE;
  let inside = wall;
  // A jump that does not end on a whole minute can leave this minute in the gap too.
  if (inThisGap(outside)) return outside - before;
  while (inside - outside > MINUTE) {
    const middle = outside + Math.floor((inside - outside) / MINUTE / 2) * MINUTE;
    if (inThisGap(middle)) inside = middle;
    else outside = middle;
  }
  return inside - before;
}

/**
 * The real-time extent of a local date (YYYY-MM-DD), both ends inclusive to
 * the second: from where the clock first reaches its 00:00 to the second
 * before it reaches the next date's 00:00, or to the end (23:59:59) of the
 * later pass of its 23:59 when the clock turned back over midnight and showed
 * the date again after that; null when the clock skipped the date.
 */
export function localDaySpan(date: string, resolve: WallResolver): [Date, Date] | null {
  if (!readsOnDate(date, resolve(date, '00:00', 'earlier'))) return null;
  const midnight = Date.parse(`${date}T00:00:00Z`);
  const start = reaches(midnight, resolve);
  let end = reaches(midnight + DAY, resolve) - SECOND;
  const last = resolve(date, '23:59', 'later');
  if (!last.flags.includes('dst-gap')) end = Math.max(end, last.utc.getTime() + LAST_MINUTE_MS);
  return [new Date(start), new Date(end)];
}
