// The same state the route integration reads in astro.config.mjs (shell
// environment, not .env files), so pages, routes and sitemap never skew.
export {
  NATAL_ASPECT_PAIRS,
  /** Complete publication record: indexable, in the sitemap. */
  natalAspectsPublished,
  /** Published, or a local review build with PUBLIC_NATAL_ASPECTS_PREVIEW=1. */
  natalAspectsEnabled,
} from '../../scripts/natal-aspects-policy.mjs';
export type NatalAspectPair = 'sun-moon' | 'moon-venus' | 'venus-mars';

export const NATAL_PAIR_SUMMARIES: Record<NatalAspectPair, { name: string; summary: string }> = {
  'sun-moon': { name: 'Sun-Moon', summary: 'Purpose and habit: what a person sets out to do beside what settles them.' },
  'moon-venus': { name: 'Moon-Venus', summary: 'Comfort and taste: what soothes a person beside what they find pleasing.' },
  'venus-mars': { name: 'Venus-Mars', summary: 'Attraction and drive: what a person values beside how they go after it.' },
};

const VERBS: Record<string, string> = {
  conjunction: 'conjunct', sextile: 'sextile', square: 'square', trine: 'trine', opposition: 'opposite',
};

/** "Sun square Moon in a birth chart": the exact contextual heading for one geometry. */
export function natalPairHeading(pair: NatalAspectPair, geometry: string): string {
  const [a, b] = pair.split('-').map((body) => body[0].toUpperCase() + body.slice(1));
  return `${a} ${VERBS[geometry]} ${b} in a birth chart`;
}
