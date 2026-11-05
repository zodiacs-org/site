/**
 * Projection maths for the ecliptic seen in three dimensions.
 *
 * A birth chart is a direction map: it records where each body sat as seen
 * from one point on Earth, and the flat wheel draws only half of that —
 * ecliptic longitude. The other half, ecliptic latitude, is computed for
 * every chart and then discarded at draw time. Over 1930–2030 that discards
 * up to 17.7° for Pluto, 8.0° for Venus and 5.3° for the Moon, while the Sun
 * stays at exactly 0° because the Sun is what defines the plane.
 *
 * Bodies are placed on a unit sphere, not at true distance. Distance would
 * put Pluto some fifteen thousand times further out than the Moon and show
 * nothing; direction is also the only thing the chart itself claims to
 * measure. Callers should say so rather than implying a scale model.
 *
 * Pure geometry — no ephemeris import, so this module stays outside the
 * astronomy-engine bundle boundary.
 */

export interface Vec3 { x: number; y: number; z: number }

export interface Projected {
  x: number;
  y: number;
  /** Larger is nearer the viewer; for painter's-algorithm ordering. */
  depth: number;
}

export interface EclipticPoint { lon: number; lat: number }

const RAD = Math.PI / 180;

/** Mean inclination of the Moon's orbit to the ecliptic, degrees. */
export const MOON_INCLINATION = 5.145;

/**
 * Obliquity of the ecliptic: the tilt between the Earth's equator and its
 * orbit, and so between the celestial equator and the ecliptic. The two
 * circles cross at the equinoxes, which is why 0° Aries is where it is.
 */
export const OBLIQUITY = 23.4392911;

/**
 * Greatest Sun–node elongation that still admits a solar eclipse. Beyond it
 * the new Moon passes too far above or below the ecliptic to cover the Sun.
 */
export const SOLAR_ECLIPSE_LIMIT = 18.5;

/** Ecliptic direction to a unit vector; +z is ecliptic north. */
export function eclipticToVec(lon: number, lat: number): Vec3 {
  const l = lon * RAD;
  const b = lat * RAD;
  const cosB = Math.cos(b);
  return { x: cosB * Math.cos(l), y: cosB * Math.sin(l), z: Math.sin(b) };
}

/**
 * Spin about the ecliptic pole, then tilt the pole toward the viewer.
 *
 * tilt 0 looks straight down the pole and recovers the familiar flat wheel
 * exactly: latitude becomes pure depth and every body sits on the ring.
 * tilt 90 is edge-on, where latitude reads as height and nothing else.
 */
export function orient(v: Vec3, spinDeg: number, tiltDeg: number): Vec3 {
  const s = spinDeg * RAD;
  const t = tiltDeg * RAD;

  const x1 = v.x * Math.cos(s) - v.y * Math.sin(s);
  const y1 = v.x * Math.sin(s) + v.y * Math.cos(s);
  const z1 = v.z;

  return {
    x: x1,
    y: y1 * Math.cos(t) + z1 * Math.sin(t),
    z: -y1 * Math.sin(t) + z1 * Math.cos(t),
  };
}

/** Orthographic projection into SVG coordinates, where y grows downward. */
export function project(v: Vec3, cx: number, cy: number, radius: number): Projected {
  return { x: cx + radius * v.x, y: cy - radius * v.y, depth: v.z };
}

/** Direction straight to screen, in one step. */
export function place(
  lon: number,
  lat: number,
  spin: number,
  tilt: number,
  cx: number,
  cy: number,
  radius: number,
): Projected {
  return project(orient(eclipticToVec(lon, lat), spin, tilt), cx, cy, radius);
}

/**
 * A great circle inclined to the ecliptic, ascending at `nodeLon` — the
 * Moon's path, when handed the chart's own North Node longitude.
 *
 * Parametrised by argument of latitude u, the angle travelled from the
 * ascending node, so u = 0 and u = 180 land exactly on the nodes and
 * |latitude| peaks at the inclination.
 */
export function inclinedCircle(
  nodeLon: number,
  inclination = MOON_INCLINATION,
  stepDeg = 4,
): EclipticPoint[] {
  const i = inclination * RAD;
  const points: EclipticPoint[] = [];
  for (let u = 0; u <= 360; u += stepDeg) {
    const ur = u * RAD;
    const lat = Math.asin(Math.sin(i) * Math.sin(ur)) / RAD;
    const lon = nodeLon + Math.atan2(Math.cos(i) * Math.sin(ur), Math.cos(ur)) / RAD;
    points.push({ lon: norm360(lon), lat });
  }
  return points;
}

export function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Split a projected curve where it passes behind the sphere, so the far half
 * can be drawn faintly and the near half solid. Without this a wireframe
 * globe reads as a flat tangle of ellipses rather than an object.
 */
export function splitByDepth(
  points: Projected[],
): { front: boolean; points: Projected[] }[] {
  const runs: { front: boolean; points: Projected[] }[] = [];
  let current: { front: boolean; points: Projected[] } | null = null;

  for (const point of points) {
    const front = point.depth >= 0;
    if (!current || current.front !== front) {
      // Carry the crossing point into both runs so the halves meet.
      if (current) current.points.push(point);
      current = { front, points: current ? [current.points[current.points.length - 1], point] : [point] };
      runs.push(current);
    } else {
      current.points.push(point);
    }
  }
  return runs.filter((run) => run.points.length > 1);
}

/** Shortest separation between two longitudes, 0–180. */
export function separation(a: number, b: number): number {
  const d = Math.abs(norm360(a) - norm360(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * How close the Sun sits to the line of nodes, and whether that is close
 * enough for an eclipse season. Eclipses happen at the nodes and nowhere
 * else, which is the one fact the flat wheel can never show.
 */
export function eclipseProximity(sunLon: number, nodeLon: number): {
  /** Degrees from the nearer node. */
  degrees: number;
  possible: boolean;
} {
  const degrees = Math.min(
    separation(sunLon, nodeLon),
    separation(sunLon, nodeLon + 180),
  );
  return { degrees, possible: degrees <= SOLAR_ECLIPSE_LIMIT };
}

/* ── The observer's sky ──────────────────────────────────────────────
 *
 * Everything above describes where the bodies are. What follows describes
 * where the *observer* stood, which is what turns a sky map into a birth
 * chart: the horizon at that minute and place, and the declination bounds
 * the Sun itself never passes.
 *
 * Still closed-form, still no ephemeris — these depend on the Earth's
 * rotation and tilt, not on where the planets went.
 */

/** Milliseconds at J2000.0 (2000-01-01 12:00 UT). */
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const MS_PER_DAY = 86_400_000;

/**
 * Julian centuries since J2000.0.
 *
 * UTC stands in for UT1 here. They differ by under 0.9 s by definition,
 * which reaches the ascendant as under 0.004° — far below anything this
 * drawing can show.
 */
export function julianCenturies(utcMs: number): number {
  return (utcMs - J2000_MS) / (MS_PER_DAY * 36525);
}

/**
 * Greenwich mean sidereal time in hours, 0–24.
 *
 * Sidereal time runs about four minutes a day faster than clock time,
 * which is the whole reason the ascendant sweeps the zodiac while the
 * planets stay put. Callers that want apparent sidereal time are off by
 * the equation of the equinoxes — at most ~1.1 s, or 0.005° of ascendant.
 */
export function gmstHours(utcMs: number): number {
  const days = (utcMs - J2000_MS) / MS_PER_DAY;
  const hours = 18.697374558 + 24.06570982441908 * days;
  return ((hours % 24) + 24) % 24;
}

/** A unit vector back to the ecliptic direction it came from. */
export function vecToEcliptic(v: Vec3): EclipticPoint {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return {
    lon: norm360(Math.atan2(v.y, v.x) / RAD),
    lat: Math.asin(Math.max(-1, Math.min(1, v.z / length))) / RAD,
  };
}

/**
 * Equatorial direction to ecliptic. The same rotation as the ecliptic →
 * equatorial one, taken the other way (ε negated).
 */
export function equatorialToEcliptic(
  raDeg: number,
  decDeg: number,
  obliquityDeg = OBLIQUITY,
): EclipticPoint {
  const a = raDeg * RAD;
  const d = decDeg * RAD;
  const e = obliquityDeg * RAD;
  const sinLat = Math.sin(d) * Math.cos(e) - Math.cos(d) * Math.sin(e) * Math.sin(a);
  const y = Math.sin(d) * Math.sin(e) + Math.cos(d) * Math.cos(e) * Math.sin(a);
  const x = Math.cos(d) * Math.cos(a);
  return {
    lon: norm360(Math.atan2(y, x) / RAD),
    lat: Math.asin(Math.max(-1, Math.min(1, sinLat))) / RAD,
  };
}

/**
 * The point directly overhead at a given local sidereal time and
 * geographic latitude: right ascension equal to the meridian's, declination
 * equal to the observer's latitude. Everything about the horizon follows
 * from it.
 */
export function zenithOf(
  ramcDeg: number,
  latitudeDeg: number,
  obliquityDeg = OBLIQUITY,
): EclipticPoint {
  return equatorialToEcliptic(ramcDeg, latitudeDeg, obliquityDeg);
}

/**
 * How high a direction sits above the horizon, in degrees. Negative is
 * below — which is how a chart knows whether the Sun had set.
 */
export function altitudeOf(
  lonDeg: number,
  latDeg: number,
  zenith: EclipticPoint,
): number {
  const d = eclipticToVec(lonDeg, latDeg);
  const z = eclipticToVec(zenith.lon, zenith.lat);
  const dot = d.x * z.x + d.y * z.y + d.z * z.z;
  return Math.asin(Math.max(-1, Math.min(1, dot))) / RAD;
}

/**
 * The horizon: every direction exactly 90° from the zenith. Where this
 * circle cuts the ecliptic on the eastern side is the ascendant, which is
 * the whole reason a birth chart needs a time and a place.
 */
export function horizonCircle(
  zenith: EclipticPoint,
  stepDeg = 3,
): EclipticPoint[] {
  const z = eclipticToVec(zenith.lon, zenith.lat);
  // Any seed not parallel to the zenith; swapped near the pole to stay stable.
  const seed: Vec3 = Math.abs(z.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };

  const ux = seed.y * z.z - seed.z * z.y;
  const uy = seed.z * z.x - seed.x * z.z;
  const uz = seed.x * z.y - seed.y * z.x;
  const un = Math.hypot(ux, uy, uz) || 1;
  const u: Vec3 = { x: ux / un, y: uy / un, z: uz / un };

  const w: Vec3 = {
    x: z.y * u.z - z.z * u.y,
    y: z.z * u.x - z.x * u.z,
    z: z.x * u.y - z.y * u.x,
  };

  const points: EclipticPoint[] = [];
  for (let t = 0; t <= 360; t += stepDeg) {
    const r = t * RAD;
    const c = Math.cos(r);
    const s = Math.sin(r);
    points.push(vecToEcliptic({
      x: u.x * c + w.x * s,
      y: u.y * c + w.y * s,
      z: u.z * c + w.z * s,
    }));
  }
  return points;
}

/**
 * A small circle of constant declination. Drawn at ±ε these are the
 * celestial tropics — the furthest north and south the Sun ever reaches,
 * and so the bounds a body has to exceed to be called out of bounds.
 */
export function declinationCircle(
  declinationDeg: number,
  obliquityDeg = OBLIQUITY,
  stepDeg = 3,
): EclipticPoint[] {
  const points: EclipticPoint[] = [];
  for (let ra = 0; ra <= 360; ra += stepDeg) {
    points.push(equatorialToEcliptic(ra, declinationDeg, obliquityDeg));
  }
  return points;
}
