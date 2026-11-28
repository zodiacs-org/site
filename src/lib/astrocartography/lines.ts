/**
 * Astrocartography: where on Earth each planet sat on an angle at the moment
 * of birth. Pure geometry on the engine's equatorial positions, shared by the
 * /astrocartography/ page (which works them out in the browser) and the
 * get_astrocartography tool (which works them out on the server).
 *
 * At the birth instant a body at right ascension α and declination δ is:
 * - on the Midheaven (MC line, overhead) where the local sidereal time equals α,
 *   that is at east longitude α − GAST, for every latitude;
 * - on the IC line (underfoot) 180 degrees from it;
 * - rising (ASC line) where its hour angle is −H0 and setting (DSC line) where
 *   it is +H0, with cos H0 = −tan φ tan δ: east longitude α ∓ H0 − GAST.
 *   Where |tan φ tan δ| > 1 the body never rises or never sets that day, so the
 *   two lines meet and stop at the latitude where it only grazes the horizon.
 *
 * GAST is Greenwich apparent sidereal time in degrees: the right ascension of
 * the Midheaven at longitude 0. These are the geometric horizon and meridian
 * of the body's centre, without refraction, as astrocartography maps draw them.
 * No storage, network or logging.
 */

export const ACG_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
export type AcgBody = typeof ACG_BODIES[number];
export const ACG_ANGLES = ['ASC', 'DSC', 'MC', 'IC'] as const;
export type AcgAngle = typeof ACG_ANGLES[number];

/** A body's apparent geocentric right ascension and declination of date, degrees. */
export interface EquatorialBody { body: AcgBody; ra: number; dec: number }
export interface GeoPoint { lat: number; lon: number }

const DEG = Math.PI / 180;
export const EARTH_RADIUS_KM = 6371.0088;

/** A longitude in (−180, 180]. */
export function wrapLongitude(lon: number): number {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

/** The east longitude of a body's Midheaven line. */
export function mcLongitude(body: Pick<EquatorialBody, 'ra'>, gast: number): number {
  return wrapLongitude(body.ra - gast);
}

/**
 * Where a body rises (ASC) or sets (DSC) at one latitude, or null where it is
 * circumpolar or never rises there.
 */
export function horizonLongitude(body: Pick<EquatorialBody, 'ra' | 'dec'>, gast: number, latitude: number, angle: 'ASC' | 'DSC'): number | null {
  const x = -Math.tan(latitude * DEG) * Math.tan(body.dec * DEG);
  if (!Number.isFinite(x) || Math.abs(x) > 1 + 1e-12) return null;
  const h0 = Math.acos(Math.max(-1, Math.min(1, x))) / DEG;
  return wrapLongitude(body.ra + (angle === 'ASC' ? -h0 : h0) - gast);
}

/**
 * The rising or setting line as a polyline, parametrised by the hour angle so
 * the steep ends near the grazing latitude are sampled as finely as the rest:
 * at hour angle H, tan φ = −cos H / tan δ. Points beyond ±maxLatitude are left
 * out. A body on the equator (δ = 0) rises along a meridian: the line is then
 * that meridian.
 *
 * With a small declination the line is nearly a meridian, and one step of hour
 * angle crosses many degrees of latitude around the equator (about cot δ times
 * the step): close to an equinox the Sun's whole line falls between two steps,
 * past ±maxLatitude. Every stretch of latitude the hour-angle samples leave
 * wider than one step is filled in by latitude, every stepDegrees, so the line
 * is kept whole however small the declination.
 */
export function horizonLine(body: Pick<EquatorialBody, 'ra' | 'dec'>, gast: number, angle: 'ASC' | 'DSC', stepDegrees = 0.5, maxLatitude = 85): GeoPoint[] {
  const points: GeoPoint[] = [];
  if (Math.abs(Math.tan(body.dec * DEG)) < 1e-9) {
    const lon = wrapLongitude(body.ra + (angle === 'ASC' ? -90 : 90) - gast);
    for (let lat = -maxLatitude; lat <= maxLatitude + 1e-9; lat += stepDegrees) points.push({ lat, lon });
    return points;
  }
  // Include the grazing endpoints (h = 0 and h = 180) where the rising and setting lines meet at |lat| = 90 - |dec|.
  const pushAtHourAngle = (h: number) => {
    const lat = Math.atan(-Math.cos(h * DEG) / Math.tan(body.dec * DEG)) / DEG;
    if (Math.abs(lat) > maxLatitude) return;
    points.push({ lat, lon: wrapLongitude(body.ra + (angle === 'ASC' ? -h : h) - gast) });
  };
  pushAtHourAngle(0);
  for (let h = stepDegrees / 2; h < 180; h += stepDegrees) pushAtHourAngle(h);
  pushAtHourAngle(180);
  points.sort((a, b) => a.lat - b.lat);
  // The latitude is monotonic in the hour angle, so the line runs in order of latitude; fill the wide gaps.
  const filled: GeoPoint[] = [];
  const fill = (from: number, to: number) => {
    if (to - from <= stepDegrees) return;
    for (let k = Math.max(0, Math.floor((from + maxLatitude) / stepDegrees)); ; k += 1) {
      const lat = -maxLatitude + k * stepDegrees;
      if (lat >= to || lat > maxLatitude + 1e-9) break;
      if (lat <= from) continue;
      const lon = horizonLongitude(body, gast, lat, angle);
      if (lon !== null) filled.push({ lat, lon });
    }
  };
  let previous = -maxLatitude - stepDegrees;
  for (const point of points) { fill(previous, point.lat); filled.push(point); previous = point.lat; }
  fill(previous, maxLatitude + stepDegrees);
  return filled;
}

export interface BodyLines {
  body: AcgBody;
  /** East longitudes of the MC and IC lines, degrees in (−180, 180]. */
  mc: number;
  ic: number;
  asc: GeoPoint[];
  dsc: GeoPoint[];
}

export function mapLines(bodies: readonly EquatorialBody[], gast: number, stepDegrees = 0.5): BodyLines[] {
  return bodies.map((body) => {
    const mc = mcLongitude(body, gast);
    return { body: body.body, mc, ic: wrapLongitude(mc + 180), asc: horizonLine(body, gast, 'ASC', stepDegrees), dsc: horizonLine(body, gast, 'DSC', stepDegrees) };
  });
}

/** Great-circle distance, km. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distance from a place to a meridian line (pole to pole at one longitude):
 * asin(|sin Δλ| cos φ) of arc when the meridian is on the place's side of the
 * globe, else the arc to the nearer pole.
 */
export function distanceToMeridianKm(place: GeoPoint, longitude: number): number {
  const dLon = (longitude - place.lon) * DEG;
  if (Math.cos(dLon) < 0) return (90 - Math.abs(place.lat)) * DEG * EARTH_RADIUS_KM;
  return Math.asin(Math.min(1, Math.abs(Math.sin(dLon)) * Math.cos(place.lat * DEG))) * EARTH_RADIUS_KM;
}

/**
 * Distance from a place to a polyline, km: the nearest sampled point, refined along its two neighbouring segments.
 * A segment that crosses the date line (one end near 180, the other near -180) is unwrapped first, so it is
 * measured along its own short span and not across the whole map.
 */
export function distanceToPolylineKm(place: GeoPoint, line: readonly GeoPoint[]): number {
  if (!line.length) return Infinity;
  let best = Infinity;
  let at = 0;
  line.forEach((point, index) => { const d = distanceKm(place, point); if (d < best) { best = d; at = index; } });
  for (const neighbour of [at - 1, at + 1]) {
    const other = line[neighbour];
    if (!other) continue;
    const from = line[at];
    // The neighbour's longitude, taken the short way round from this point's (it may pass 180 or -180).
    const otherLon = from.lon + wrapLongitude(other.lon - from.lon);
    // Golden-section search along the segment, in plate carrée, which is fine at half-degree spacing.
    let lo = 0;
    let hi = 1;
    const at_ = (t: number) => distanceKm(place, { lat: from.lat + (other.lat - from.lat) * t, lon: from.lon + (otherLon - from.lon) * t });
    for (let i = 0; i < 30; i += 1) {
      const m1 = lo + (hi - lo) * 0.382;
      const m2 = lo + (hi - lo) * 0.618;
      if (at_(m1) < at_(m2)) hi = m2; else lo = m1;
    }
    best = Math.min(best, at_((lo + hi) / 2));
  }
  return best;
}

/** Whether a line lies east or west of a place, along its parallel; null for a horizon line that does not reach its latitude. */
function sideOf(place: GeoPoint, lineLongitude: number | null): 'east' | 'west' | null {
  if (lineLongitude === null) return null;
  return wrapLongitude(lineLongitude - place.lon) >= 0 ? 'east' : 'west';
}

export interface LineDistance {
  body: AcgBody;
  angle: AcgAngle;
  km: number;
  /** Which way the line is along the place's own latitude, when it reaches it. */
  side: 'east' | 'west' | null;
}

/** Every line's distance from a place, nearest first. */
export function lineDistances(place: GeoPoint, bodies: readonly EquatorialBody[], gast: number): LineDistance[] {
  const rows: LineDistance[] = [];
  for (const body of bodies) {
    const mc = mcLongitude(body, gast);
    const ic = wrapLongitude(mc + 180);
    rows.push({ body: body.body, angle: 'MC', km: distanceToMeridianKm(place, mc), side: sideOf(place, mc) });
    rows.push({ body: body.body, angle: 'IC', km: distanceToMeridianKm(place, ic), side: sideOf(place, ic) });
    for (const angle of ['ASC', 'DSC'] as const) {
      rows.push({ body: body.body, angle, km: distanceToPolylineKm(place, horizonLine(body, gast, angle, 0.25, 89.9)), side: sideOf(place, horizonLongitude(body, gast, place.lat, angle)) });
    }
  }
  return rows.sort((a, b) => a.km - b.km || ACG_BODIES.indexOf(a.body) - ACG_BODIES.indexOf(b.body) || ACG_ANGLES.indexOf(a.angle) - ACG_ANGLES.indexOf(b.angle));
}

/**
 * How strongly a line is traditionally felt at a distance. Astrocartographers
 * mostly work within about 300 km (roughly 3 degrees) of a line, and treat it
 * as fading out by about 800 km.
 */
export const STRONG_KM = 300;
export const NOTICEABLE_KM = 800;
export function strengthOf(km: number): 'strong' | 'noticeable' | 'faint' {
  return km <= STRONG_KM ? 'strong' : km <= NOTICEABLE_KM ? 'noticeable' : 'faint';
}

/**
 * Right ascension and declination from apparent ecliptic longitude and
 * latitude of date and the obliquity: the conversion the browser page uses on
 * the chart engine's ecliptic positions, so it needs no second ephemeris.
 */
export function eclipticToEquatorial(lon: number, lat: number, obliquity: number): { ra: number; dec: number } {
  const l = lon * DEG;
  const b = lat * DEG;
  const e = obliquity * DEG;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)) / DEG;
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)) / DEG;
  return { ra: ((ra % 360) + 360) % 360, dec };
}

/** The right ascension of a Midheaven from its ecliptic longitude: on longitude 0 that is GAST. */
export function ramcFromMc(mc: number, obliquity: number): number {
  const ra = Math.atan2(Math.sin(mc * DEG) * Math.cos(obliquity * DEG), Math.cos(mc * DEG)) / DEG;
  return ((ra % 360) + 360) % 360;
}
