/**
 * Classical essential dignities: the tradition's map of where each planet
 * works with the grain (domicile, exaltation) or against it (detriment,
 * fall). Defined for the seven classical planets only; Uranus, Neptune, and
 * Pluto entered the story after the system was built, and this site doesn't
 * retrofit them.
 *
 * Since engine 1.1.0-rc.2 the table is the engine's own, from
 * `@zodiacs/engine/lite`, which loads no ephemeris. Where the engine refuses
 * a name that is not one of its bodies, or a sign that is not a lowercase
 * sign name, with a RangeError, this module answers as the site always has:
 * no dignity, an empty list, or false.
 */
import {
  dignitiesFor as packageDignitiesFor,
  dignityFor as packageDignityFor,
  hasClassicalDignities as packageHasClassicalDignities,
} from '@zodiacs/engine/lite';

export type Dignity = 'domicile' | 'exaltation' | 'detriment' | 'fall';

type PackageBody = Parameters<typeof packageDignityFor>[0];
type PackageSign = Parameters<typeof packageDignityFor>[1];

/** One-line glosses in the house voice, rendered next to the label. */
export const DIGNITY_GLOSS: Record<Dignity, string> = {
  domicile: 'the planet in its own sign, running on home rules',
  exaltation: 'the tradition’s honored-guest placement, working at its best',
  detriment: 'the planet opposite its home, working against the grain',
  fall: 'the tradition’s uphill placement, strength earned rather than given',
};

/** The engine's answer, or the neutral one where it refuses its input. */
function orNeutral<T>(answer: () => T, neutral: T): T {
  try {
    return answer();
  } catch (error) {
    if (error instanceof RangeError) return neutral;
    throw error;
  }
}

/**
 * The classical dignity of a planet in a sign, or null when neutral or
 * when the planet carries no classical dignities (the outer three).
 * Exaltation and fall outrank domicile and detriment only where they
 * overlap (Mercury in Virgo reads as exaltation, its stronger title there).
 */
export function dignityFor(planet: string, signSlug: string): Dignity | null {
  return orNeutral(() => packageDignityFor(planet as PackageBody, signSlug as PackageSign), null);
}

/** True for the seven planets the classical system covers. */
export function hasClassicalDignities(planet: string): boolean {
  return orNeutral(() => packageHasClassicalDignities(planet as PackageBody), false);
}

/** All four-table labels, without changing the legacy single-label contract. */
export function dignitiesFor(planet: string, signSlug: string): readonly Dignity[] {
  return orNeutral(() => [...packageDignitiesFor(planet as PackageBody, signSlug as PackageSign)], []);
}
