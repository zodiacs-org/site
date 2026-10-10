/**
 * Classical sign dignities from the carried package, with the site's labels.
 * The adapter accepts legacy string inputs: an unknown planet or sign remains
 * neutral rather than escaping as the package's malformed-input refusal.
 */
import {
  dignitiesFor as packageDignitiesFor,
  dignityFor as packageDignityFor,
  hasClassicalDignities as packageHasClassicalDignities,
} from '@zodiacs/engine/techniques';
import type { BodyName, ZodiacSign } from '@zodiacs/engine';
import { SIGN_SLUGS } from './signs';

export type Dignity = 'domicile' | 'exaltation' | 'detriment' | 'fall';

/** One-line glosses in the house voice, rendered next to the label. */
export const DIGNITY_GLOSS: Record<Dignity, string> = {
  domicile: 'the planet in its own sign, running on home rules',
  exaltation: 'the tradition’s honored-guest placement, working at its best',
  detriment: 'the planet opposite its home, working against the grain',
  fall: 'the tradition’s uphill placement, strength earned rather than given',
};


/** True for the seven classical planets, including no inherited object keys. */
export function hasClassicalDignities(planet: string): boolean {
  try { return packageHasClassicalDignities(planet as BodyName); }
  catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

/** Legacy single label, including exaltation over domicile for Mercury in Virgo. */
export function dignityFor(planet: string, signSlug: string): Dignity | null {
  if (!hasClassicalDignities(planet) || !SIGN_SLUGS.includes(signSlug)) return null;
  return packageDignityFor(planet as BodyName, signSlug as ZodiacSign);
}

/** All labels in package order, without changing the legacy single-label contract. */
export function dignitiesFor(planet: string, signSlug: string): readonly Dignity[] {
  if (!hasClassicalDignities(planet) || !SIGN_SLUGS.includes(signSlug)) return [];
  return packageDignitiesFor(planet as BodyName, signSlug as ZodiacSign);
}
