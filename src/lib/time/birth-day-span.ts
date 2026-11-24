/**
 * The whole span of an untimed birth date on the birthplace clock, for the
 * /retrogrades/for-you/ page and get_retrograde_for_me alike: a placement
 * counts as definite only if it holds from the first instant the clock showed
 * that date up to, not including, the next local midnight, so the seconds of
 * 23:59 count (the Sun entered Gemini at 23:59:28 on 20 May 1972 in Lagos).
 *
 * The local-time resolver reads a repeated wall time at its earlier pass and
 * moves a skipped one forward by the jump. Read naively, 00:00 and 23:59 are
 * then not always the ends of the day: Gaza's clocks went back from 00:00 on
 * 17 October 2003 to 23:00 on the 16th, so the 16th's 23:59 came twice and
 * its day ran an hour past the first one. Here the last minute is read at its
 * later pass, and a minute the clocks skipped at either end is passed over
 * for the nearest one they showed. Pure: no network, storage or logging.
 */

/**
 * One wall time as a resolver reads it: dst-gap when skipped, dst-fold when repeated, with the size of the change
 * either as the site resolver gives it (jumpMinutes) or as the engine's does (the transition's two offsets).
 */
export interface WallReading {
  utc: Date;
  flags: readonly string[];
  jumpMinutes?: number | null | undefined;
  /** The instant of the clock change, as the site resolver gives it with a jump. */
  transitionAt?: Date | undefined;
  jump?: unknown;
  transition?: { at?: string; offsetBeforeMinutes: number; offsetAfterMinutes: number } | null | undefined;
}

/** A local-time resolver: the site's (src/lib/time/localToUtc.ts) or the compute API's (src/lib/compute-api/local-time.ts). */
export type WallResolver = (date: string, time: string, timeZone: string, options?: { longitude?: number }) => WallReading;

const DAY_MINUTES = 24 * 60;
const hhmm = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const jumpOf = (wall: WallReading) => wall.jumpMinutes
  ?? (wall.jump && wall.transition ? Math.abs(wall.transition.offsetAfterMinutes - wall.transition.offsetBeforeMinutes) : null);

/** The last millisecond before the next local midnight, so the span reads every second of its last minute. */
const LAST_INSTANT_MS = 60_000 - 1;

/** The instant of the clock change behind a skipped wall time, from either resolver's reading, or null. */
const changeAt = (wall: WallReading): number | null => {
  if (wall.transitionAt instanceof Date) return wall.transitionAt.getTime();
  const at = wall.jump && wall.transition?.at ? Date.parse(wall.transition.at) : Number.NaN;
  return Number.isFinite(at) ? at : null;
};

/**
 * The first and last instant of the date on the zone's clock (with the birthplace's longitude for its local mean
 * time, when given): the first minute at its earlier pass, and the last millisecond of the last minute at its later
 * one, which is the instant before the next local midnight (or before the jump, when the clocks skip from the end of
 * this date). A clock change need not fall on a whole minute (Amsterdam's clocks went from 00:00:00 to 00:00:28
 * on 1 July 1937, at 22:40:28 UTC on the 30th), so where a skipped minute borders the day the span starts or ends at
 * the change itself, as the resolver gives it, and a whole minute is the fallback only where the resolver gives no
 * instant. The caller awaits
 * prepareLocalTime(date, zone) first, as for any call of the resolver. A date the clock skipped whole is refused
 * before this is asked (src/lib/vedic-signs/clock.ts, skippedWholeDate); here it falls back to its 00:00 and 23:59.
 */
export function birthDaySpan(date: string, zone: string, longitude: number | undefined, resolve: WallResolver): [Date, Date] {
  const read = (time: string) => (longitude !== undefined ? resolve(date, time, zone, { longitude }) : resolve(date, time, zone));
  let first = 0;
  let start = read(hhmm(first));
  let skippedStart: WallReading | null = null;
  while (start.flags.includes('dst-gap') && first < DAY_MINUTES - 1) {
    skippedStart = start;
    start = read(hhmm(++first));
  }
  let last = DAY_MINUTES - 1;
  let end = read(hhmm(last));
  let skippedEnd: WallReading | null = null;
  while (end.flags.includes('dst-gap') && last > first) {
    skippedEnd = end;
    end = read(hhmm(--last));
  }
  if (start.flags.includes('dst-gap')) return [read('00:00').utc, new Date(read('23:59').utc.getTime() + LAST_INSTANT_MS)];
  const jump = end.flags.includes('dst-fold') ? jumpOf(end) : null;
  let startMs = start.utc.getTime();
  let endMs = end.utc.getTime() + (jump ? jump * 60_000 : 0) + LAST_INSTANT_MS;
  // The clocks moved on at the change, within the minute before the first one they showed (or within the minute
  // after the last one): a change outside that minute is not this gap's, and the whole minute stands.
  const opened = skippedStart ? changeAt(skippedStart) : null;
  if (opened !== null && opened <= startMs && opened > startMs - 60_000) startMs = opened;
  const closed = skippedEnd && !jump ? changeAt(skippedEnd) : null;
  if (closed !== null && closed > end.utc.getTime() && closed <= end.utc.getTime() + 60_000) endMs = closed - 1;
  return [new Date(startMs), new Date(endMs)];
}
