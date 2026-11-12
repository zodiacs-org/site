/**
 * The link a compatibility reading is saved to the profile as: the sign pair
 * page for the two Sun signs on screen (`/compatibility/<a>-<b>/`), or the
 * compatibility page when either Sun sign is unsettled. It carries no birth
 * details, no names, no fragment and no query, and its title names only the
 * two signs. Two saves of the same sign pair are the same saved page.
 */
import { pairSlug } from '../pair-slug';
import { SIGNS } from '../signs';
import type { SavedPageDraft } from './saved-pages-config';

const signName = (slug: string | null): string | null => (slug ? SIGNS.find((sign) => sign.slug === slug)?.name ?? null : null);

export function comparisonSavedPage(signA: string | null, signB: string | null): SavedPageDraft {
  const nameA = signName(signA);
  const nameB = signName(signB);
  if (!nameA || !nameB) {
    return { kind: 'compatibility', title: 'Compatibility reading', href: '/compatibility/' };
  }
  return {
    kind: 'compatibility',
    title: `${nameA} and ${nameB} · compatibility`,
    href: `/compatibility/${pairSlug(signA!, signB!)}/`,
  };
}
