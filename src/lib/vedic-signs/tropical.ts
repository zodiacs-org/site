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
import type { VedicSignsInstants } from './compute';

/** Tropical longitudes of date at one instant; the ascendant only with a birth time and place. */
export interface TropicalMoment {
  utc: Date;
  sun: number;
  moon: number;
  asc: number | null;
}

export interface TropicalMoments {
  timeKnown: boolean;
  placed: boolean;
  at: TropicalMoment;
  /** For an untimed birth, the moments at the ends of the birth day; otherwise null. */
  ends: TropicalMoment[] | null;
}

function tropicalAt(utc: Date, place: { latitude: number; longitude: number } | null, timeKnown: boolean): TropicalMoment {
  const chart = computeChart({ utc, ...(place ?? {}), houseSystem: 'whole', timeKnown });
  const lon = (name: string) => chart.bodies.find((row) => row.body === name)!.lon;
  return { utc, sun: lon('Sun'), moon: lon('Moon'), asc: timeKnown && place && chart.angles ? chart.angles.asc : null };
}

export function tropicalMoments(input: Omit<VedicSignsInstants, 'ayanamsa'>): TropicalMoments {
  const place = input.latitude !== undefined && input.longitude !== undefined ? { latitude: input.latitude, longitude: input.longitude } : null;
  const at = tropicalAt(input.birthUtc, place, input.timeKnown);
  const ends = input.timeKnown ? null : (input.dayEnds ?? []).map((end) => tropicalAt(end, null, false));
  return { timeKnown: input.timeKnown, placed: place !== null, at, ends: ends && ends.length ? ends : null };
}
