/**
 * Lunar returns. The instant is @zodiacs/engine's (`@zodiacs/engine/techniques`
 * since engine rc.16, which ported this module's search into the package): the
 * first crossing of the natal Moon's longitude in (after, after + 40 days], at
 * 6-hour steps. The site keeps its own contract around it: a reference that
 * leaves a full 40-day scan inside the supported dates, a known and
 * unambiguous birth time, a birthplace, its two house systems, and the chart
 * cast by the site's adapter, as every chart here is.
 *
 * Only ever lazy-loaded beside full.ts: the package's search reads the same
 * ephemeris chunk, never an eager bundle.
 */
import { lunarReturnInstant as engineLunarReturnInstant } from '@zodiacs/engine/techniques';
import { bodyLongitude, computeChart } from './full';
import type { Chart, ChartInput } from './types';

/** The package's scan contract, which the site's policy file records. */
export { LUNAR_RETURN_HORIZON_DAYS, LUNAR_RETURN_STEP_DAYS } from '@zodiacs/engine/techniques';
export const LUNAR_RETURN_MIN_UTC = '1800-01-02T00:00:00.000Z';
export const LUNAR_RETURN_MAX_UTC = '2199-12-31T23:59:59.999Z';
export const LUNAR_RETURN_MAX_AFTER_UTC = '2199-11-21T23:59:59.999Z';

const MIN_MS = Date.parse(LUNAR_RETURN_MIN_UTC);
const MAX_MS = Date.parse(LUNAR_RETURN_MAX_UTC);
const MAX_AFTER_MS = Date.parse(LUNAR_RETURN_MAX_AFTER_UTC);

export interface LunarReturnLocation {
  latitude: number;
  longitude: number;
}

function validDate(date: Date, label: string): number {
  const milliseconds = date instanceof Date ? date.getTime() : NaN;
  if (!Number.isFinite(milliseconds)) throw new RangeError(`${label} must be a valid date.`);
  return milliseconds;
}

function validReference(afterUtc: Date): number {
  const after = validDate(afterUtc, 'The reference instant');
  if (after < MIN_MS || after > MAX_AFTER_MS) {
    throw new RangeError('The reference instant must allow a full 40-day scan within the supported dates.');
  }
  return after;
}

function validLocation(location: Partial<LunarReturnLocation>, label: string): LunarReturnLocation {
  const { latitude, longitude } = location;
  if (latitude == null || longitude == null
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new RangeError(`${label} needs valid latitude and longitude.`);
  }
  return { latitude, longitude };
}

function moonLongitude(date: Date): number {
  const longitude = bodyLongitude('Moon', date);
  if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360) {
    throw new RangeError('The Moon position could not be calculated.');
  }
  return longitude;
}

/**
 * First geocentric tropical Moon crossing in (afterUtc, afterUtc + 40 days].
 * `natalMoonLongitude` is a numeric longitude of date, without advancing the
 * natal frame or substituting phase/mean-period arithmetic. Date is numeric
 * transport; distant epochs do not carry an exact civil-UTC accuracy claim.
 */
export function lunarReturnInstant(natalMoonLongitude: number, afterUtc: Date): Date {
  if (!Number.isFinite(natalMoonLongitude)) throw new RangeError('The natal Moon longitude must be finite.');
  const after = validReference(afterUtc);
  return engineLunarReturnInstant(natalMoonLongitude, new Date(after));
}

/**
 * Derive the target from complete resolved natal input and cast its next
 * return. The caller owns IANA resolution and must pass its flags; folds,
 * gaps, unknown time and missing place are rejected, including noon caches.
 * Location changes the returned houses/angles, never the geocentric event.
 */
export function lunarReturnChart(
  natal: ChartInput,
  afterUtc: Date,
  location?: LunarReturnLocation,
): Chart {
  if (natal.timeKnown !== true || natal.flags?.some((flag) =>
    flag === 'no-time' || flag === 'dst-gap' || flag === 'dst-fold')) {
    throw new RangeError('A known, unambiguous birth time is required for a lunar return.');
  }
  const birth = validDate(natal.utc, 'The birth instant');
  const after = validReference(afterUtc);
  if (birth < MIN_MS || birth > MAX_MS || birth > after) {
    throw new RangeError('The birth instant must be within the supported dates and no later than the reference.');
  }
  const birthplace = validLocation(natal, 'The birthplace');
  const castLocation = validLocation(location ?? birthplace, 'The return location');
  if (natal.houseSystem !== 'whole' && natal.houseSystem !== 'placidus') {
    throw new RangeError('Choose a supported house system.');
  }
  const utc = lunarReturnInstant(moonLongitude(new Date(birth)), new Date(after));
  return computeChart({ utc, ...castLocation, houseSystem: natal.houseSystem, timeKnown: true });
}
