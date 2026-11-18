/**
 * Which full Moons the site calls a supermoon (owner decision, 12 November
 * 2026): the rule most published lists use, Richard Nolle's. A full Moon is a
 * supermoon when its geocentric distance is within 10% of that orbit's
 * perigee to apogee range, measured from the perigee:
 *
 *   distance - perigee <= 0.10 * (apogee - perigee)
 *
 * The numbers come from src/data/moon-distances.json, which holds each new
 * and full Moon's distance with the perigee and apogee on each side and names
 * no rule itself.
 *
 * - The perigee is the one nearest the full Moon in time, before or after it
 *   (the earlier one on an exact tie).
 * - The apogee is the nearer in distance of the two either side of the full
 *   Moon, which gives the smaller range and so the stricter test. Both
 *   apogees agree on every full Moon from 2026 to 2030 but one: the 13
 *   December 2027 full Moon is 10.1% with the nearer apogee and 9.9% with the
 *   farther, so it is not marked.
 * - New Moons are never marked, whatever their distance.
 *
 * Pure: no clock, no environment, no network.
 */
import moonDistances from '../data/moon-distances.json';

/** The rule as the JSON feed states it. */
export const SUPERMOON_RULE = 'within 10% of the perigee to apogee range';

interface Apsis { at: string; distanceKm: number }

/** One row of src/data/moon-distances.json. */
export interface MoonDistanceLunation {
  type: string;
  at: string;
  distanceKm: number;
  perigee: { before: Apsis; after: Apsis };
  apogee: { before: Apsis; after: Apsis };
}

export interface Supermoon {
  /** The Moon's distance at the full Moon, whole km. */
  distanceKm: number;
  rule: typeof SUPERMOON_RULE;
  /** The perigee and apogee the rule measured against. */
  perigee: Apsis;
  apogee: Apsis;
}

/** The full Moon's supermoon facts under the site's rule, or null when it is not one (or is a new Moon). */
export function supermoon(lunation: MoonDistanceLunation): Supermoon | null {
  if (lunation.type !== 'full') return null;
  const at = Date.parse(lunation.at);
  const { before, after } = lunation.perigee;
  const perigee = at - Date.parse(before.at) <= Date.parse(after.at) - at ? before : after;
  const apogee = lunation.apogee.before.distanceKm <= lunation.apogee.after.distanceKm
    ? lunation.apogee.before
    : lunation.apogee.after;
  const range = apogee.distanceKm - perigee.distanceKm;
  if (!(range > 0)) throw new Error(`supermoon: no perigee to apogee range at ${lunation.at}`);
  // Whole km on both sides, so compare in integers: 10 * (d - p) <= range.
  if (10 * (lunation.distanceKm - perigee.distanceKm) > range) return null;
  return {
    distanceKm: lunation.distanceKm,
    rule: SUPERMOON_RULE,
    perigee: { at: perigee.at, distanceKm: perigee.distanceKm },
    apogee: { at: apogee.at, distanceKm: apogee.distanceKm },
  };
}

const lunations = moonDistances.lunations as MoonDistanceLunation[];
const byKey = new Map(lunations.map((lunation) => [`${lunation.type}|${lunation.at}`, lunation] as const));

/** The moon-distances.json row of a catalog lunation, by its type and its sky.json instant. */
export function moonDistanceLunation(type: string, at: string): MoonDistanceLunation | undefined {
  return byKey.get(`${type}|${at}`);
}

/** Every row of moon-distances.json, in order. */
export function moonDistanceLunations(): readonly MoonDistanceLunation[] {
  return lunations;
}
