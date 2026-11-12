/**
 * The range a Year Ahead Score can take across a birth day whose time is
 * unknown. A date-only chart is cast for midday, but across one birth day the
 * Sun moves about a degree and Mercury up to two, and a slow planet that sits
 * near a natal point all year turns a degree of natal shift into a different
 * weight for the whole year. So the score of an untimed birth is read at five
 * instants across the day as well as at midday, and the lowest and highest are
 * shown beside the midday headline.
 *
 * Pure and engine-free, like core.ts: the caller injects the natal chart for
 * an instant, the slow planets' longitudes and, with a birthplace, its own
 * local-time resolver (prepared first, as CLAUDE.md requires). Nothing here
 * sees a place or keeps a birth detail.
 */
import { birthDayEnvelope } from '../sun-settled';
import { scoreYear, type LongitudeAt, type NatalPoints, type SlowPlanet } from './core';

const HOUR = 3_600_000;

export interface ScoreRange {
  low: number;
  high: number;
}

/** The lowest and highest score a set of candidate natal charts gives for the same window. */
export function scoreRange(natals: readonly NatalPoints[], longitudeAt: LongitudeAt, start: Date): ScoreRange {
  const scores = natals.map((natal) => scoreYear(natal, longitudeAt, start).score);
  return { low: Math.min(...scores), high: Math.max(...scores) };
}

/** Five instants across a birth day whose time is unknown: its two ends, the middle and the quarter points. */
export function birthDaySamples(earliest: Date, latest: Date): Date[] {
  const span = latest.getTime() - earliest.getTime();
  return [0, 0.25, 0.5, 0.75, 1].map((part) => new Date(earliest.getTime() + span * part));
}

/**
 * Every clock's version of a date (YYYY-MM-DD) when the birthplace is not
 * known: from 14 hours before its UTC midnight (UTC+14 starts the day first)
 * to 12 hours after 23:59 UTC (UTC-12 ends it last). One definition, in
 * src/lib/sun-settled.ts, re-exported here for this module's importers.
 */
export { birthDayEnvelope };

/**
 * The two ends of an untimed birth day.
 *
 * - `local` undefined (no birthplace): the envelope of every clock's version
 *   of the date.
 * - `local` the birthplace's 00:00 and 23:59 on the birth date, which the
 *   caller resolves with its own resolver right after `prepareLocalTime` (a
 *   midnight a clock change skipped resolves to the day's first real
 *   instant): those two instants.
 * - `local` null (the caller's resolver could not place either end), or two
 *   instants out of order: the midday instant minus and plus 12 hours.
 */
export function birthDayEnds(date: string, midday: Date, local?: readonly [Date, Date] | null): [Date, Date] {
  if (local === undefined) return birthDayEnvelope(date);
  if (local && Number.isFinite(local[0].getTime()) && Number.isFinite(local[1].getTime()) && local[0] < local[1]) return [local[0], local[1]];
  return [new Date(midday.getTime() - 12 * HOUR), new Date(midday.getTime() + 12 * HOUR)];
}

/** The slow planets' longitudes with each (planet, instant) worked out once, so a second chart for the same window costs only arithmetic. */
export function cachedLongitude(longitudeAt: LongitudeAt): LongitudeAt {
  const cache = new Map<string, number>();
  return (body: SlowPlanet, date: Date) => {
    const key = `${body}|${date.getTime()}`;
    let value = cache.get(key);
    if (value === undefined) { value = longitudeAt(body, date); cache.set(key, value); }
    return value;
  };
}

/**
 * The range of an untimed birth's score: the midday chart (the headline, so
 * the headline always lies inside the range) and the five samples across the
 * birth day's ends. Pass a cached `longitudeAt` so the six charts share one
 * pass over the slow planets.
 */
export function birthDayRange(midday: NatalPoints, natalAt: (utc: Date) => NatalPoints, ends: readonly [Date, Date], longitudeAt: LongitudeAt, start: Date): ScoreRange {
  return scoreRange([midday, ...birthDaySamples(ends[0], ends[1]).map(natalAt)], longitudeAt, start);
}

/** Whether a range is wide enough to show: 0.3 or more on the one-decimal scale. */
export function rangeWorthShowing(range: ScoreRange | null): range is ScoreRange {
  return range !== null && Math.round((range.high - range.low) * 10) >= 3;
}

/** The untimed note for a person's own birth. It points to the range only when the range is shown, so the two stay in step. */
export const UNTIMED_NOTE_WITH_RANGE = 'No birth time was given, so the chart is cast for midday and the Moon is left out. The score can move with the birth time; the range shows by how much.';
export const UNTIMED_NOTE = 'No birth time was given, so the chart is cast for midday and the Moon is left out. The score can move with the birth time.';

export function untimedScoreNote(range: ScoreRange | null): string {
  return rangeWorthShowing(range) ? UNTIMED_NOTE_WITH_RANGE : UNTIMED_NOTE;
}
