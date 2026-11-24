/**
 * The whole span of an untimed birth date on the birthplace clock, for the
 * /retrogrades/for-you/ page and get_retrograde_for_me alike: a placement
 * counts as definite only if it holds from the first minute the clock showed
 * that date to the last.
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
  jump?: unknown;
  transition?: { offsetBeforeMinutes: number; offsetAfterMinutes: number } | null | undefined;
}

/** A local-time resolver: the site's (src/lib/time/localToUtc.ts) or the compute API's (src/lib/compute-api/local-time.ts). */
export type WallResolver = (date: string, time: string, timeZone: string, options?: { longitude?: number }) => WallReading;

const DAY_MINUTES = 24 * 60;
const hhmm = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const jumpOf = (wall: WallReading) => wall.jumpMinutes
  ?? (wall.jump && wall.transition ? Math.abs(wall.transition.offsetAfterMinutes - wall.transition.offsetBeforeMinutes) : null);

/**
 * The first and last minute of the date on the zone's clock (with the birthplace's longitude for its local mean
 * time, when given): the first at its earlier pass, the last at its later one. The caller awaits
 * prepareLocalTime(date, zone) first, as for any call of the resolver. A date the clock skipped whole is refused
 * before this is asked (src/lib/vedic-signs/clock.ts, skippedWholeDate); here it falls back to its 00:00 and 23:59.
 */
export function birthDaySpan(date: string, zone: string, longitude: number | undefined, resolve: WallResolver): [Date, Date] {
  const read = (time: string) => (longitude !== undefined ? resolve(date, time, zone, { longitude }) : resolve(date, time, zone));
  let first = 0;
  let start = read(hhmm(first));
  while (start.flags.includes('dst-gap') && first < DAY_MINUTES - 1) start = read(hhmm(++first));
  let last = DAY_MINUTES - 1;
  let end = read(hhmm(last));
  while (end.flags.includes('dst-gap') && last > first) end = read(hhmm(--last));
  if (start.flags.includes('dst-gap')) return [read('00:00').utc, read('23:59').utc];
  const jump = end.flags.includes('dst-fold') ? jumpOf(end) : null;
  return [start.utc, new Date(end.utc.getTime() + (jump ? jump * 60_000 : 0))];
}
