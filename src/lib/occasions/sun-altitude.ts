/**
 * The Sun's geometric altitude for an observer, and the instant it passes a
 * given altitude, for golden hour and civil dusk. The engine's sky module
 * gives rises, sets and transits but no altitude at an instant, so this uses
 * Meeus's low-precision solar coordinates (Astronomical Algorithms, ch. 25:
 * about 0.01° in longitude) and the IAU 1982 sidereal time (ch. 12). An
 * altitude error of 0.01° moves a crossing by a few seconds, well under the
 * minute these times are shown to. Pure arithmetic, so it runs the same in
 * the browser and on the server. Altitudes are geometric (unrefracted), the
 * usual convention for twilight.
 */

const RAD = Math.PI / 180;
const J2000 = 2_451_545;
const DAY = 86_400_000;

function julianDay(at: Date): number {
  return at.getTime() / DAY + 2_440_587.5;
}

/** The Sun's apparent right ascension and declination, degrees. */
export function sunEquatorial(at: Date): { rightAscension: number; declination: number } {
  const t = (julianDay(at) - J2000) / 36_525;
  const meanLongitude = 280.46646 + 36_000.76983 * t + 0.0003032 * t * t;
  const meanAnomaly = (357.52911 + 35_999.05029 * t - 0.0001537 * t * t) * RAD;
  const centre = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(meanAnomaly)
    + (0.019993 - 0.000101 * t) * Math.sin(2 * meanAnomaly)
    + 0.000289 * Math.sin(3 * meanAnomaly);
  const node = (125.04 - 1934.136 * t) * RAD;
  const longitude = (meanLongitude + centre - 0.00569 - 0.00478 * Math.sin(node)) * RAD;
  const obliquity = (23.439291 - 0.0130042 * t + 0.00256 * Math.cos(node)) * RAD;
  return {
    rightAscension: Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude)) / RAD,
    declination: Math.asin(Math.sin(obliquity) * Math.sin(longitude)) / RAD,
  };
}

/** Greenwich mean sidereal time, degrees (IAU 1982). */
function siderealTime(at: Date): number {
  const days = julianDay(at) - J2000;
  const t = days / 36_525;
  return 280.46061837 + 360.98564736629 * days + 0.000387933 * t * t - (t * t * t) / 38_710_000;
}

/** The Sun's geometric altitude in degrees for an observer at `latitude`, `longitude` (east positive). */
export function sunAltitude(at: Date, latitude: number, longitude: number): number {
  const { rightAscension, declination } = sunEquatorial(at);
  const hourAngle = (siderealTime(at) + longitude - rightAscension) * RAD;
  const phi = latitude * RAD;
  const delta = declination * RAD;
  return Math.asin(Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle)) / RAD;
}

/**
 * The instant in [from, to] when the Sun, descending through the whole
 * interval, passes `altitude`; null when it does not cross it there. The
 * caller brackets a descent, such as upper transit to lower transit.
 */
export function sunDescendsThrough(
  altitude: number,
  from: Date,
  to: Date,
  latitude: number,
  longitude: number,
): Date | null {
  let lo = from.getTime();
  let hi = to.getTime();
  const above = (ms: number) => sunAltitude(new Date(ms), latitude, longitude) > altitude;
  if (!(hi > lo) || !above(lo) || above(hi)) return null;
  while (hi - lo > 1_000) {
    const mid = (lo + hi) / 2;
    if (above(mid)) lo = mid;
    else hi = mid;
  }
  return new Date(Math.round((lo + hi) / 2));
}
