/**
 * One calendar year of full Moons, for the plate on the full moon calendar
 * (src/components/moon/FullMoonYearPlate.astro): each full Moon's place in
 * the year, its distance and how large to draw it, the year's closest and
 * farthest, and which ones are supermoons under the site's rule
 * (src/lib/supermoon.ts, never a rule of its own).
 *
 * Distances are src/data/moon-distances.json's, through supermoon.ts. The
 * instants are the same sky.json instants the calendar's tables list.
 *
 * Pure: no clock, no environment, no network.
 */
import { SUPERMOON_RULE, moonDistanceLunations, supermoon, type MoonDistanceLunation } from './supermoon';

/**
 * The rule in a sentence, as the 2027 calendar's FAQ words it: the lib's
 * rule with the orbit named and the starting point stated.
 */
export const SUPERMOON_RULE_TEXT = `a full Moon ${SUPERMOON_RULE.replace('the perigee', "its orbit's perigee")}, measured from the perigee`;

/**
 * How much the drawing exaggerates the Moon's apparent size: a disc's
 * diameter goes with (1 / distance) to this power. At 1 it would be true to
 * life, where a whole year's sizes differ by about 14%, too little to see.
 */
export const DISC_EXAGGERATION = 4;

const fullRows = moonDistanceLunations().filter((row) => row.type === 'full');
const distances = fullRows.map((row) => row.distanceKm);
/** The nearest and farthest full Moon in the whole data, so every year shares one scale. */
export const DISTANCE_DOMAIN = { nearKm: Math.min(...distances), farKm: Math.max(...distances) } as const;

export interface FullMoonOfYear {
  /** The sky.json instant (ISO, UTC). */
  at: string;
  distanceKm: number;
  /** The sign the Moon stands in, when the caller gave one. */
  sign: string | null;
  /** Where the instant lies in the calendar year (UTC), 0 at 1 January 00:00, 1 at the next. */
  fraction: number;
  /** 1 for the nearest full Moon in the data, 0 for the farthest. */
  closeness: number;
  /** The disc's diameter as a multiple of the farthest full Moon's in the data (1 or more). */
  size: number;
  /** True apparent diameter relative to the farthest full Moon in the data. */
  apparent: number;
  /** Under supermoon(): true when it is one. */
  supermoon: boolean;
}

export interface FullMoonYear {
  year: number;
  moons: FullMoonOfYear[];
  closest: FullMoonOfYear;
  farthest: FullMoonOfYear;
  supermoons: FullMoonOfYear[];
  /** How much wider the closest full Moon of the year looks than the farthest, in percent, one decimal. */
  widerPercent: number;
}

/** The years the distance data covers in full (every full Moon of the calendar year). */
export function fullMoonYears(): number[] {
  const years = [...new Set(fullRows.map((row) => Number(row.at.slice(0, 4))))];
  return years.sort((a, b) => a - b);
}

/**
 * The full Moons of one calendar year (UTC). `signOf` gives the sign slug of
 * a sky.json instant, from the calendar's own table data.
 */
export function fullMoonYear(year: number, signOf: (at: string) => string | null | undefined = () => null): FullMoonYear | null {
  const rows: MoonDistanceLunation[] = fullRows.filter((row) => new Date(row.at).getUTCFullYear() === year);
  if (rows.length === 0) return null;
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const { nearKm, farKm } = DISTANCE_DOMAIN;
  const moons = rows.map((row): FullMoonOfYear => {
    const apparent = farKm / row.distanceKm;
    return {
      at: row.at,
      distanceKm: row.distanceKm,
      sign: signOf(row.at) ?? null,
      fraction: (Date.parse(row.at) - start) / (end - start),
      closeness: farKm === nearKm ? 1 : (farKm - row.distanceKm) / (farKm - nearKm),
      size: apparent ** DISC_EXAGGERATION,
      apparent,
      supermoon: supermoon(row) !== null,
    };
  });
  // The earlier on a tie, both ways.
  const closest = moons.reduce((a, b) => (b.distanceKm < a.distanceKm ? b : a));
  const farthest = moons.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));
  return {
    year,
    moons,
    closest,
    farthest,
    supermoons: moons.filter((moon) => moon.supermoon),
    widerPercent: Math.round((farthest.distanceKm / closest.distanceKm - 1) * 1000) / 10,
  };
}

/** A knot of the line through the full Moons: a time (ms), its closeness and the slope there (per ms). */
export interface CurveKnot { t: number; v: number; m: number }

// Every full Moon in the data as a knot, slopes by Fritsch and Carlson, so the
// line never swings past a full Moon's own value between two of them.
const knots: CurveKnot[] = (() => {
  const { nearKm, farKm } = DISTANCE_DOMAIN;
  const pts = fullRows.map((row) => ({ t: Date.parse(row.at), v: (farKm - row.distanceKm) / (farKm - nearKm), m: 0 }));
  const d = pts.slice(0, -1).map((p, i) => (pts[i + 1].v - p.v) / (pts[i + 1].t - p.t));
  pts.forEach((p, i) => {
    if (i === 0) p.m = d[0];
    else if (i === pts.length - 1) p.m = d[i - 1];
    else p.m = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  });
  d.forEach((dk, i) => {
    if (dk === 0) { pts[i].m = 0; pts[i + 1].m = 0; return; }
    const a = pts[i].m / dk;
    const b = pts[i + 1].m / dk;
    const s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); pts[i].m = tau * a * dk; pts[i + 1].m = tau * b * dk; }
  });
  return pts;
})();

/** The line's closeness and slope at time t; flat beyond the first and last full Moon in the data. */
function curveAt(t: number): CurveKnot {
  if (t <= knots[0].t) return { t, v: knots[0].v, m: 0 };
  const last = knots[knots.length - 1];
  if (t >= last.t) return { t, v: last.v, m: 0 };
  let k = 0;
  while (knots[k + 1].t < t) k += 1;
  const p = knots[k];
  const q = knots[k + 1];
  const h = q.t - p.t;
  const s = (t - p.t) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  const v = (2 * s3 - 3 * s2 + 1) * p.v + (s3 - 2 * s2 + s) * h * p.m + (-2 * s3 + 3 * s2) * q.v + (s3 - s2) * h * q.m;
  const dv = ((6 * s2 - 6 * s) * p.v + (3 * s2 - 4 * s + 1) * h * p.m + (-6 * s2 + 6 * s) * q.v + (3 * s2 - 2 * s) * h * q.m) / h;
  return { t, v, m: dv };
}

/**
 * The line through the full Moons from `from` to `to` (ms), as cubic Hermite
 * knots: the two ends and every full Moon between. Each span between two
 * knots is one cubic, the same curve the whole data gives, so a window that
 * ends where the next begins joins it exactly.
 */
export function closenessCurve(from: number, to: number): CurveKnot[] {
  const inner = knots.filter((k) => k.t > from && k.t < to);
  return [curveAt(from), ...inner, curveAt(to)];
}
