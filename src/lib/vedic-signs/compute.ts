/**
 * The Vedic signs, from birth instants: the chart engine's tropical positions
 * (../engine/full), made sidereal at the boundary in ../engine/vedic, then the
 * reading (./reading). The /vedic-signs/ page runs this in the browser and the
 * get_vedic_signs tool on the server, with the same instants, so their answers
 * are the same. Carries the ephemeris: in the browser only the page's worker
 * (src/islands/vedic-signs/vedic.worker.ts) loads it. Pure: no network,
 * storage or logging.
 */
import { computeChart } from '../engine/full';
import { siderealMoment, type SiderealMoment } from '../engine/vedic';
import { vedicReading, type VedicReading } from './reading';
import type { VedicAyanamsa } from './wording';

export interface VedicSignsInstants {
  /** The birth instant, or local noon (UTC noon without a zone) for an untimed birth. */
  birthUtc: Date;
  timeKnown: boolean;
  /** The birthplace; with a birth time it adds the rising sign. */
  latitude?: number | undefined;
  longitude?: number | undefined;
  /** For an untimed birth, the two ends of the birth day; ignored with a birth time. */
  dayEnds?: readonly Date[] | undefined;
  ayanamsa: VedicAyanamsa;
}

function momentAt(utc: Date, place: { latitude: number; longitude: number } | null, timeKnown: boolean, ayanamsa: VedicAyanamsa): SiderealMoment {
  const chart = computeChart({ utc, ...(place ?? {}), houseSystem: 'whole', timeKnown });
  const lon = (name: string) => chart.bodies.find((row) => row.body === name)!.lon;
  return siderealMoment(utc, { sun: lon('Sun'), moon: lon('Moon'), asc: timeKnown && place && chart.angles ? chart.angles.asc : null }, ayanamsa);
}

export function computeVedicSigns(input: VedicSignsInstants): VedicReading {
  const place = input.latitude !== undefined && input.longitude !== undefined ? { latitude: input.latitude, longitude: input.longitude } : null;
  const at = momentAt(input.birthUtc, place, input.timeKnown, input.ayanamsa);
  const ends = input.timeKnown ? null : (input.dayEnds ?? []).map((end) => momentAt(end, null, false, input.ayanamsa));
  return vedicReading({ timeKnown: input.timeKnown, placed: place !== null, ayanamsa: input.ayanamsa, at, ends: ends && ends.length ? ends : null });
}
