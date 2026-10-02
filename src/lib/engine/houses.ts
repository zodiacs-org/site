/**
 * Site-compatible house and angle API backed by @zodiacs/engine.
 * The lightweight internal math entry contains no astronomical ephemeris.
 */
import {
  computeAngles as engineComputeAngles,
  computeHouses as engineComputeHouses,
  meanObliquity,
  normalizeLongitude,
  placidusCusps as enginePlacidusCusps,
  ramcOf as engineRamcOf,
  wholeSignCusps,
} from '@zodiacs/engine/internal/math';
import type { AngleInput } from '@zodiacs/engine/internal/math';

import { siteHouses } from './chart-adapter';
import type { Angles, Houses, HouseSystem } from './types';

export type { AngleInput };
export { meanObliquity, wholeSignCusps };

/** Normalize an angle to [0, 360). Retained for existing site consumers. */
export const norm = normalizeLongitude;

export function ramcOf(input: Pick<AngleInput, 'gastHours' | 'longitude'>): number {
  return engineRamcOf(input);
}

export function computeAngles(input: AngleInput): Angles {
  return engineComputeAngles(input);
}

export function placidusCusps(input: AngleInput, angles: Angles): number[] | null {
  return enginePlacidusCusps(input, angles);
}

export function computeHouses(
  system: HouseSystem,
  input: AngleInput,
  angles: Angles,
): { houses: Houses; fellBack: boolean } {
  const result = engineComputeHouses(system, input, angles);
  return { ...result, houses: siteHouses(result.houses) };
}

/** House index (1–12) of an ecliptic longitude given cusp longitudes. */
export { houseOf } from '@zodiacs/engine/internal/math';
