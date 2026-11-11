/**
 * The browser half of the Year Ahead Score: the natal longitudes from the
 * vendored engine and the year scored against the slow planets' real motion.
 * Only ever lazy-loaded (beside engine/full.ts), so no page pays for the
 * ephemeris until someone asks for a score. Nothing leaves the device.
 */
import { bodyLongitude, computeChart } from '../engine/full';
import { scoreYear, type NatalPoints, type YearScore } from './core';
import { birthDayRange, cachedLongitude, type ScoreRange } from './range';

export function natalPoints(utc: Date, timeKnown: boolean): { natal: NatalPoints; sunLon: number } {
  const chart = computeChart({ utc, houseSystem: 'whole', timeKnown });
  const lon = (body: string) => chart.bodies.find((row) => row.body === body)!.lon;
  return { natal: { Sun: lon('Sun'), Moon: timeKnown ? lon('Moon') : null, Mercury: lon('Mercury'), Venus: lon('Venus'), Mars: lon('Mars') }, sunLon: lon('Sun') };
}

/** The Sun's longitude at an instant, from the same chart the score reads (for src/lib/sun-settled.ts). */
export function sunLonAt(utc: Date): number {
  return natalPoints(utc, false).sunLon;
}

/**
 * The score for a birth instant. For an untimed birth, pass the birth day's
 * two ends (src/lib/year-score/range.ts, birthDayEnds) to get the range the
 * score can take across that day as well; otherwise `range` is null and the
 * answer is the same as without it.
 */
export function scoreBirth(utc: Date, timeKnown: boolean, start: Date, untimedDay?: readonly [Date, Date]): { year: YearScore; sunLon: number; range: ScoreRange | null } {
  const { natal, sunLon } = natalPoints(utc, timeKnown);
  const longitudeAt = cachedLongitude(bodyLongitude);
  const year = scoreYear(natal, longitudeAt, start);
  const range = !timeKnown && untimedDay ? birthDayRange(natal, (at) => natalPoints(at, false).natal, untimedDay, longitudeAt, start) : null;
  return { year, sunLon, range };
}
