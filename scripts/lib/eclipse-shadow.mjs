/**
 * The Moon's shadow axis on the Earth, for scripts/build-eclipse-visibility.mjs
 * and its test: the point where the line from the Sun's centre through the
 * Moon's centre meets the Earth's ellipsoid, built exactly as astronomy-engine
 * builds its greatest-eclipse point (MoonShadow and GeoidIntersect, which it
 * does not export), so it can be asked for at any instant.
 *
 * It installs the engine's clock (../lib/deltat-install.mjs, the same file) first, as every
 * direct importer of astronomy-engine does.
 */
import '../lib/deltat-install.mjs';
import { Body, GeoMoon, GeoVector, KM_PER_AU, RotateVector, Rotation_EQJ_EQD, SiderealTime } from 'astronomy-engine';

export const EARTH_FLATTENING = 0.996647180302104; // astronomy-engine's b/a
export const EARTH_EQUATORIAL_RADIUS_KM = 6378.1366;
const DEG = Math.PI / 180;

/** Where the shadow axis meets the Earth at `time` (an AstroTime), or null when it misses. */
export function shadowAxisPoint(time) {
  const s = GeoVector(Body.Sun, time, true);
  const m = GeoMoon(time);
  const rot = Rotation_EQJ_EQD(time);
  // The axis runs from the Sun through the Moon; e is the lunacentric Earth.
  const v = RotateVector(rot, { x: m.x - s.x, y: m.y - s.y, z: m.z - s.z, t: time });
  const e = RotateVector(rot, { x: -m.x, y: -m.y, z: -m.z, t: time });
  // Kilometres, with z dilated so that the Earth becomes a sphere.
  const vx = v.x * KM_PER_AU, vy = v.y * KM_PER_AU, vz = (v.z * KM_PER_AU) / EARTH_FLATTENING;
  const ex = e.x * KM_PER_AU, ey = e.y * KM_PER_AU, ez = (e.z * KM_PER_AU) / EARTH_FLATTENING;
  const A = vx * vx + vy * vy + vz * vz;
  const B = -2 * (vx * ex + vy * ey + vz * ez);
  const C = ex * ex + ey * ey + ez * ez - EARTH_EQUATORIAL_RADIUS_KM ** 2;
  const radic = B * B - 4 * A * C;
  if (!(radic > 0)) return null;
  // The nearer intersection, on the day side.
  const u = (-B - Math.sqrt(radic)) / (2 * A);
  const px = u * vx - ex, py = u * vy - ey, pz = (u * vz - ez) * EARTH_FLATTENING;
  const proj = Math.hypot(px, py) * EARTH_FLATTENING * EARTH_FLATTENING;
  const lat = proj === 0 ? (pz > 0 ? 90 : -90) : Math.atan(pz / proj) / DEG;
  let lon = (Math.atan2(py, px) / DEG - 15 * SiderealTime(time)) % 360;
  if (lon <= -180) lon += 360;
  else if (lon > 180) lon -= 360;
  return { lat, lon };
}

/** Earth-fixed geocentric position of a place at sea level, in km. */
export function earthFixed(lat, lon) {
  const phi = lat * DEG;
  const e2 = 1 - EARTH_FLATTENING * EARTH_FLATTENING;
  const n = EARTH_EQUATORIAL_RADIUS_KM / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  return [n * Math.cos(phi) * Math.cos(lon * DEG), n * Math.cos(phi) * Math.sin(lon * DEG), n * (1 - e2) * Math.sin(phi)];
}
