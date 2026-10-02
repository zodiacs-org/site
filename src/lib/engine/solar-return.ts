/**
 * Solar returns. The instant is @zodiacs/engine's (`@zodiacs/engine/techniques`
 * since engine rc.16, which ported this module's search into the package): the
 * crossing solver at 1-day steps over ±200 days of `near`, the nearest return,
 * or over the 370 days before `at`, the latest. The site keeps two things of
 * its own: a return outside its reference span (1800–2200, reference-span.ts)
 * is refused, where the package returns it with a flag, and the chart is cast
 * by the site's adapter, as every chart here is.
 *
 * Only ever lazy-loaded beside full.ts: the package's search reads the same
 * ephemeris chunk, never an eager bundle.
 */
import {
  mostRecentSolarReturnInstant as engineMostRecentSolarReturnInstant,
  solarReturnInstant as engineSolarReturnInstant,
} from '@zodiacs/engine/techniques';
import { computeChart } from './full';
import { REFERENCE_SPAN_END_MS, REFERENCE_SPAN_START_MS } from './reference-span';
import type { Chart, HouseSystem } from './types';

/** The site shows no return outside its reference span; the package would flag one. */
function insideReferenceSpan(instant: Date, message: string): Date {
  const at = instant.getTime();
  if (!(at >= REFERENCE_SPAN_START_MS && at < REFERENCE_SPAN_END_MS)) throw new RangeError(message);
  return instant;
}

/**
 * The instant the transiting Sun returns to the natal Sun longitude nearest
 * to `near`. Scans ±200 days around `near` (a solar return is always within
 * ~183 days of any date) and picks the crossing closest to it.
 */
export function solarReturnInstant(natalSunLon: number, near: Date): Date {
  return insideReferenceSpan(engineSolarReturnInstant(natalSunLon, near), 'No solar return found in the scan window.');
}

/** The latest solar return at or before `at`, used for the birthday-year in progress. */
export function mostRecentSolarReturnInstant(natalSunLon: number, at: Date): Date {
  return insideReferenceSpan(
    engineMostRecentSolarReturnInstant(natalSunLon, at),
    'No previous solar return found in the scan window.',
  );
}

/**
 * The solar-return chart for the return nearest `near`. With a location the
 * chart carries angles and houses; without one it is planets-only
 * (angles/houses null), matching the Chart contract.
 */
export function solarReturnChart(
  natalSunLon: number,
  near: Date,
  location: { latitude: number; longitude: number } | null,
  houseSystem: HouseSystem,
  selection: 'nearest' | 'most-recent' = 'nearest',
): Chart {
  const utc = selection === 'most-recent'
    ? mostRecentSolarReturnInstant(natalSunLon, near)
    : solarReturnInstant(natalSunLon, near);
  return computeChart({
    utc,
    ...(location ?? {}),
    houseSystem,
    timeKnown: true,
  });
}
