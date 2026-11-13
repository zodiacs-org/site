/**
 * The occasions the site's picker (src/islands/OccasionSky.tsx) offers.
 *
 * A new baby and a coming of age were taken out of the picker on 2026-11-12
 * (owner's decision): nothing on the site is aimed at or about children. Their
 * kinds stay in kinds.ts, with their card words, so the assistant runtime's
 * bytes do not move and an old link still has something to resolve: a link or
 * saved page naming one opens the picker with HIDDEN_OCCASION_NOTICE and makes
 * no card.
 */
import { OCCASION_KINDS, type OccasionKind } from './kinds';

/** The occasions the picker no longer offers. */
export const HIDDEN_OCCASION_KINDS: ReadonlySet<string> = new Set<OccasionKind>(['baby', 'coming-of-age']);

/** The picker's occasions, in kinds.ts order. */
export const PICKER_OCCASION_KINDS: readonly OccasionKind[] = Object.freeze(
  OCCASION_KINDS.filter((kind) => !HIDDEN_OCCASION_KINDS.has(kind)),
);

/** The one line an old link to a hidden occasion opens with. */
export const HIDDEN_OCCASION_NOTICE = 'This page no longer makes a card for a new baby or a coming of age. Choose another occasion to make a card.';

/** Whether a link's occasion is one the picker no longer offers. */
export function isHiddenOccasion(occasion: string | null | undefined): boolean {
  return typeof occasion === 'string' && HIDDEN_OCCASION_KINDS.has(occasion);
}
