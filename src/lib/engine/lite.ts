/**
 * Dependency-free low-precision Sun/Moon — the homepage's entire
 * astronomy budget. Meeus-style truncated series, within 0.017° (Sun) and
 * 0.365° (Moon) of the full engine from 1900 to 2100, sampled every 0.37
 * day: plenty for a ticker and a moon-phase dial, never used for charts
 * (the calculators load the full engine).
 */

const DEG = Math.PI / 180;
const norm = (d: number) => ((d % 360) + 360) % 360;

/** Days since J2000.0 (2000-01-01T12:00Z) for a JS Date. */
export function daysSinceJ2000(date: Date): number {
  return (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400_000;
}

/** Apparent-ish geocentric solar ecliptic longitude, degrees. */
export function sunLongitude(date: Date): number {
  const n = daysSinceJ2000(date);
  const L = 280.460 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * DEG;
  return norm(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
}

/** Low-precision geocentric lunar ecliptic longitude, degrees (within about 0.4°). */
export function moonLongitude(date: Date): number {
  const n = daysSinceJ2000(date);
  const Lp = 218.316 + 13.176396 * n;      // mean longitude
  const M = (134.963 + 13.064993 * n) * DEG;   // mean anomaly
  const Ms = (357.528 + 0.9856003 * n) * DEG;  // solar mean anomaly
  const D = (297.850 + 12.190749 * n) * DEG;   // mean elongation
  const F = (93.272 + 13.229350 * n) * DEG;    // argument of latitude
  const lon =
    Lp
    + 6.289 * Math.sin(M)
    + 1.274 * Math.sin(2 * D - M)
    + 0.658 * Math.sin(2 * D)
    + 0.214 * Math.sin(2 * M)
    - 0.186 * Math.sin(Ms)
    - 0.114 * Math.sin(2 * F);
  return norm(lon);
}

/** Phase angle 0–360 (0 = new, 180 = full). */
export function moonPhaseAngle(date: Date): number {
  return norm(moonLongitude(date) - sunLongitude(date));
}

/** Illuminated fraction 0–1 (from the phase angle — UI precision). */
export function moonIllumination(date: Date): number {
  return (1 - Math.cos(moonPhaseAngle(date) * DEG)) / 2;
}

export type MoonPhaseName =
  | 'New Moon' | 'Waxing Crescent' | 'First Quarter' | 'Waxing Gibbous'
  | 'Full Moon' | 'Waning Gibbous' | 'Last Quarter' | 'Waning Crescent';

export function moonPhaseName(date: Date): MoonPhaseName {
  return moonPhaseNameFromAngle(moonPhaseAngle(date));
}

/** New and Full Moon: the lit fraction is under 3%, or over 97%. */
export const MOON_PHASE_NEW_ILLUMINATION = 0.03;
/** First and Last Quarter: within 12° of elongation (about a day) of 90° or 270°. */
export const MOON_PHASE_QUARTER_DEGREES = 12;

/** Standard phase names for an already-normalized phase angle in [0, 360).
 * New Moon and Full Moon only while the lit fraction is under 3% or over 97%
 * (about a day and a half either side of the exact moment), the quarters only
 * within 12° of 90° and 270°, and the crescents and gibbous phases in between.
 * The lit fraction is the one the engine's moonPhase reports for the same
 * angle, so a name never contradicts the illumination printed beside it.
 * Classify the retained value directly: normalizing again can round across a
 * category boundary. This function does not calculate or modify an angle.
 */
export function moonPhaseNameFromAngle(a: number): MoonPhaseName {
  const lit = (1 - Math.cos(a * Math.PI / 180)) / 2;
  if (lit < MOON_PHASE_NEW_ILLUMINATION) return 'New Moon';
  if (lit > 1 - MOON_PHASE_NEW_ILLUMINATION) return 'Full Moon';
  if (Math.abs(a - 90) <= MOON_PHASE_QUARTER_DEGREES) return 'First Quarter';
  if (Math.abs(a - 270) <= MOON_PHASE_QUARTER_DEGREES) return 'Last Quarter';
  if (a < 90) return 'Waxing Crescent';
  if (a < 180) return 'Waxing Gibbous';
  if (a < 270) return 'Waning Gibbous';
  return 'Waning Crescent';
}
