/**
 * The browser half of the Year Ahead Score: the natal longitudes from the
 * vendored engine and the year scored against the slow planets' real motion.
 * Only ever lazy-loaded (beside engine/full.ts), so no page pays for the
 * ephemeris until someone asks for a score. Nothing leaves the device.
 */
import { bodyLongitude, computeChart } from '../engine/full';
import { scoreYear, type NatalPoints, type SlowPlanet, type YearScore } from './core';

export function natalPoints(utc: Date, timeKnown: boolean): { natal: NatalPoints; sunLon: number } {
  const chart = computeChart({ utc, houseSystem: 'whole', timeKnown });
  const lon = (body: string) => chart.bodies.find((row) => row.body === body)!.lon;
  return { natal: { Sun: lon('Sun'), Moon: timeKnown ? lon('Moon') : null, Mercury: lon('Mercury'), Venus: lon('Venus'), Mars: lon('Mars') }, sunLon: lon('Sun') };
}

export function scoreBirth(utc: Date, timeKnown: boolean, start: Date): { year: YearScore; sunLon: number } {
  const { natal, sunLon } = natalPoints(utc, timeKnown);
  return { year: scoreYear(natal, (body: SlowPlanet, date: Date) => bodyLongitude(body, date), start), sunLon };
}
