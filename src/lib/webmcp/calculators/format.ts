/** How the calculator tools state a result: longitudes as numbers, with the sign and the page's own label. */
import { ENGINE_VERSION } from '../../engine/types';
import { degreeInSign, formatLongitude, signForLongitude } from '../../signs';

export interface Position {
  /** Tropical ecliptic longitude, degrees 0–360, cut (not rounded) to four decimals. */
  longitude: number;
  sign: string;
  /** Degrees into the sign, 0–30, cut to four decimals. */
  degreeInSign: number;
  /** As the page prints it, such as "15°23′ Aries". */
  label: string;
}

/** Cut to four decimals, as the pages cut a degree to its minute: a value just under a sign's end stays in that sign. */
export const cut = (value: number) => Math.floor(value * 1e4) / 1e4;

/** Rounded to four decimals, as orbs, latitudes and speeds are stated; a value that rounds to zero is 0, never -0. */
export const fixed = (value: number) => Number(value.toFixed(4)) || 0;

export function position(longitude: number): Position {
  return {
    longitude: cut(longitude),
    sign: signForLongitude(longitude).name,
    degreeInSign: cut(degreeInSign(longitude)),
    label: formatLongitude(longitude),
  };
}

export const ENGINE = Object.freeze({ name: '@zodiacs/engine', version: ENGINE_VERSION });

export const pageUrl = (path: string) => `https://zodiacs.org${path}`;
