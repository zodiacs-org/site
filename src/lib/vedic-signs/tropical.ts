/**
 * The first half of the Vedic signs: the chart engine's tropical Sun, Moon
 * and rising degree of date at the birth instant (and, for an untimed birth,
 * at both ends of the birth day). It runs the site's one natal calculation
 * (../engine/full), so on the /vedic-signs/ page it loads as every chart page
 * loads the engine, on the main thread; only the sidereal half
 * (./sidereal) runs in the page's worker. The get_vedic_signs tool runs both
 * halves through ./compute. Pure: no network, storage or logging.
 */
import { computeChart } from '../engine/full';
import { computeAngles } from '../engine/houses';
import { trueObliquity } from '../engine/obliquity';
import { isGeographicPole } from '../geo/coordinates';
import type { VedicSignsInstants } from './compute';

/** Tropical longitudes of date at one instant; the ascendant only with a birth time and place. */
export interface TropicalMoment {
  utc: Date;
  sun: number;
  moon: number;
  asc: number | null;
}

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
/** Sidereal hours per solar minute (360.98564736629 deg/day / 15 / 1440), for +/-1 minute rising-sign cusp checks. */
const SIDEREAL_HOURS_PER_MIN = 1.002737909350795 / 60;

/** Signed shortest angular step from a to b in (-180, 180]. */
const signedStep = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;
/** Initial offsets in minutes across [-1 min, +1 min]; large steps are adaptively bisected. */
const INITIAL_SWEEP_MINUTES = [-1, -0.5, 0, 0.5, 1] as const;
const MAX_STEP_DEG = 20;
const MAX_BISECT_DEPTH = 10;

export interface RisingBracket {
  /** Ascendant samples ordered from -1 min to +1 min, refined so continuous segments stay within 20 deg per step. */
  samples: number[];
  /** True only when |latitude| >= 90 - obliquity (inside or on the polar circle), where a true 180-deg flip can occur. */
  polarCircle: boolean;
}

export interface TropicalMoments {
  timeKnown: boolean;
  placed: boolean;
  atGeographicPole: boolean;
  at: TropicalMoment;
  /** For an untimed birth, the moments at the ends of the birth day; otherwise null. */
  ends: TropicalMoment[] | null;
  /** For a timed placed birth, adaptively refined tropical ascendant samples across birthUtc +/- 1 minute. */
  risingBracket?: RisingBracket | null;
}

function risingPrecisionBracket(
  utc: Date,
  mc: number,
  place: { latitude: number; longitude: number },
  polarAngles: boolean,
): RisingBracket {
  const rawObliquity = trueObliquity(utc);
  const polarCircle = polarAngles;
  // Keep the sweep's obliquity on the exact same side of 90 - |lat| as the chart engine's polar-angles flag.
  const threshold = 90 - Math.abs(place.latitude);
  const obliquity = polarAngles
    ? Math.max(rawObliquity, threshold + 1e-9)
    : Math.min(rawObliquity, threshold - 1e-9);
  const mcRad = mc * DEG;
  const epsRad = obliquity * DEG;
  const ramcDeg = ((Math.atan2(Math.sin(mcRad) * Math.cos(epsRad), Math.cos(mcRad)) * RAD) + 360) % 360;
  const gastHours = ((((ramcDeg - place.longitude) % 360) + 360) % 360) / 15;
  const ascAt = (minutes: number) => computeAngles({
    gastHours: (((gastHours + minutes * SIDEREAL_HOURS_PER_MIN) % 24) + 24) % 24,
    latitude: place.latitude,
    longitude: place.longitude,
    obliquity,
  }).asc;

  // Include exact critical RAMC instants (90° and 270°, where the ecliptic meets/grazes the polar horizon)
  // when they fall inside [-1 min, +1 min], so narrow near-polar spikes or double flips are never stepped over.
  const ramcDegPerMin = SIDEREAL_HOURS_PER_MIN * 15;
  const seedTimes: number[] = [...INITIAL_SWEEP_MINUTES];
  for (const targetRamc of [90, 270]) {
    const tCrit = signedStep(ramcDeg, targetRamc) / ramcDegPerMin;
    if (tCrit > -1 && tCrit < 1) seedTimes.push(tCrit);
  }
  seedTimes.sort((a, b) => a - b);
  const sweepTimes = seedTimes.filter((t, i) => i === 0 || t - seedTimes[i - 1] > 1e-9);

  const samples: number[] = [];
  const appendSegment = (t0: number, a0: number, t1: number, a1: number, depth: number) => {
    if (Math.abs(signedStep(a0, a1)) > MAX_STEP_DEG && depth < MAX_BISECT_DEPTH) {
      const tm = (t0 + t1) / 2;
      const am = ascAt(tm);
      appendSegment(t0, a0, tm, am, depth + 1);
      appendSegment(tm, am, t1, a1, depth + 1);
      return;
    }
    samples.push(a1);
  };

  let prevT: number = sweepTimes[0];
  let prevA = ascAt(prevT);
  samples.push(prevA);
  for (let i = 1; i < sweepTimes.length; i++) {
    const nextT = sweepTimes[i];
    const nextA = ascAt(nextT);
    appendSegment(prevT, prevA, nextT, nextA, 0);
    prevT = nextT;
    prevA = nextA;
  }
  return { samples, polarCircle };
}

function tropicalAt(utc: Date, place: { latitude: number; longitude: number } | null, timeKnown: boolean): { moment: TropicalMoment; mc: number | null; polarAngles: boolean } {
  const chart = computeChart({ utc, ...(place ?? {}), houseSystem: 'whole', timeKnown });
  const lon = (name: string) => chart.bodies.find((row) => row.body === name)!.lon;
  const angles = timeKnown && place && chart.angles ? chart.angles : null;
  return {
    moment: { utc, sun: lon('Sun'), moon: lon('Moon'), asc: angles ? angles.asc : null },
    mc: angles ? angles.mc : null,
    polarAngles: chart.flags.includes('polar-angles'),
  };
}

export function tropicalMoments(input: Omit<VedicSignsInstants, 'ayanamsa'>): TropicalMoments {
  const place = input.latitude !== undefined && input.longitude !== undefined ? { latitude: input.latitude, longitude: input.longitude } : null;
  // At a geographic pole the local east direction is undefined. Keep the geocentric positions.
  const atGeographicPole = place !== null && isGeographicPole(place.latitude);
  const activePlace = atGeographicPole ? null : place;
  const { moment: at, mc, polarAngles } = tropicalAt(input.birthUtc, activePlace, input.timeKnown);
  const risingBracket = input.timeKnown && activePlace && at.asc !== null && mc !== null
    ? risingPrecisionBracket(input.birthUtc, mc, activePlace, polarAngles)
    : null;
  const ends = input.timeKnown ? null : (input.dayEnds ?? []).map((end) => tropicalAt(end, null, false).moment);
  return { timeKnown: input.timeKnown, placed: place !== null, atGeographicPole, at, ends: ends && ends.length ? ends : null, risingBracket };
}
