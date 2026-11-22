/**
 * A local calendar date as real time on one zone's clock. A clock can show a
 * date twice (Apia lived 4 July 1892 twice when it moved to the American date),
 * never show it (Apia went from 29 to 31 December 2011), or jump into or out
 * of it partway (St. John's moved its clocks from 23:00 on 2 May 1920 straight
 * to 00:00 on 3 May). A clock can also change within a minute: Accra left
 * local mean time at 00:00:52 UTC on 2 November 1915, and at a longitude of
 * 0.25 degrees west a birthplace clock then went from 23:59:52 on 1 November
 * to 00:00:52 on 2 November. The resolver (./localToUtc.ts, or the engine's
 * own through the compute API's module) reads a repeated wall time at its
 * earlier pass unless asked for the later one, moves a skipped one forward by
 * the jump, and gives the instant of the clock change behind either, to the
 * millisecond. A date runs from where the clock first reaches its 00:00 to
 * where it last reaches the next date's 00:00, and those are read from that
 * instant whenever a midnight was skipped or repeated, never from whole
 * minutes.
 *
 * Pure: it resolves wall times only through the resolver it is given.
 */

/** What this module needs of a resolved wall time. */
export interface WallResolution {
  utc: Date;
  /** Minutes east at the resolved instant; fractional on a local mean time. */
  offsetMinutes: number;
  /** "dst-gap" marks a wall time the clock skipped, moved forward by the jump; "dst-fold" one it showed twice. */
  flags: readonly string[];
  /**
   * The clock change behind a skipped or repeated wall time: its instant (UTC,
   * ISO 8601, to the millisecond) and the offset after it. The engine gives it
   * for every gap and fold.
   */
  transition?: { at: string; offsetAfterMinutes: number } | null;
}

/**
 * A wall time (YYYY-MM-DD, HH:MM) on the one clock the span is read on, at
 * the pass asked for. The span reads the date asked about and the day after,
 * so the clock must be prepared for both where they need it.
 */
export type WallResolver = (date: string, time: string, fold: 'earlier' | 'later') => WallResolution;

const SECOND = 1_000;
const MINUTE = 60_000;
const DAY = 86_400_000;

const skipped = (resolution: WallResolution) => resolution.flags.includes('dst-gap');
const repeated = (resolution: WallResolution) => resolution.flags.includes('dst-fold');

/** The clock change behind a skipped or repeated wall time: its instant and, as a UTC clock's milliseconds, the wall time the clock showed right after it. */
function changeBehind(resolution: WallResolution): { at: number; wallAfter: number } {
  const transition = resolution.transition;
  if (!transition) throw new Error('The resolver gave no clock change for a skipped or repeated wall time.');
  const at = Date.parse(transition.at);
  return { at, wallAfter: at + Math.round(transition.offsetAfterMinutes * MINUTE) };
}

/** A resolution's wall time, as milliseconds of a UTC clock showing it. */
function wallOf(resolution: WallResolution): number {
  return resolution.utc.getTime() + Math.round(resolution.offsetMinutes * MINUTE);
}

/**
 * Whether a resolved wall time sits on the date asked for (YYYY-MM-DD). For a
 * wall time the clock skipped, that is the date the clock landed on when it
 * jumped: a date it skipped whole resolves onto a later one.
 */
export function readsOnDate(date: string, resolution: WallResolution): boolean {
  const wall = skipped(resolution) && resolution.transition ? changeBehind(resolution).wallAfter : wallOf(resolution);
  return new Date(wall).toISOString().slice(0, 10) === date;
}

/** Midnight of a YYYY-MM-DD date, as milliseconds of a UTC clock showing it. */
function midnightOf(date: string): number {
  const at = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(at)) throw new RangeError('A local date must be a real YYYY-MM-DD date.');
  return at;
}

/** The date after a YYYY-MM-DD date. */
function dateAfter(date: string): string {
  const next = new Date(midnightOf(date) + DAY).toISOString();
  if (!/^\d{4}-/u.test(next)) throw new RangeError('A local date must be before 9999-12-31.');
  return next.slice(0, 10);
}

/**
 * Where the clock last reaches a date's 00:00, which is where the day before
 * last ends: the instant the clock jumped over it; or, when the clock showed
 * it twice, its later pass if the clock turned back to a wall time before it
 * (the day before shows again until then), else its first pass (the clock
 * turned back to this very midnight, as Apia did on 4 July 1892, and the day
 * before ended at the first).
 */
function lastReach(date: string, resolve: WallResolver): number {
  const resolution = resolve(date, '00:00', 'later');
  if (skipped(resolution)) return changeBehind(resolution).at;
  if (!repeated(resolution) || changeBehind(resolution).wallAfter < midnightOf(date)) return resolution.utc.getTime();
  return resolve(date, '00:00', 'earlier').utc.getTime();
}

/**
 * The real-time extent of a local date (YYYY-MM-DD), both ends inclusive to
 * the second: from where the clock first reaches its 00:00 (or jumps over it
 * into the date) to the second before it last reaches the next date's 00:00
 * (or jumps over it), so a date the clock turned back into after midnight is
 * covered to its last pass; null when the clock skipped the date.
 */
export function localDaySpan(date: string, resolve: WallResolver): [Date, Date] | null {
  const midnight = resolve(date, '00:00', 'earlier');
  if (!readsOnDate(date, midnight)) return null;
  // The clock first reaches the date's 00:00 at its first pass, or where it jumped over it.
  const start = skipped(midnight) ? changeBehind(midnight).at : midnight.utc.getTime();
  const end = lastReach(dateAfter(date), resolve) - SECOND;
  return [new Date(start), new Date(end)];
}
