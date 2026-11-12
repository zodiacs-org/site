/**
 * Pages about babies and children, hidden on 12 November 2026 (owner's
 * decision, 10:15 Asia/Bangkok): nothing on the site is aimed at or about
 * children in navigation, sitemaps or internal links. The pages stay built
 * and reachable at their addresses, marked noindex and nofollow; they are
 * left out of the sitemap, the tools hub, the Almanac's list and feed, the
 * assistant's site guide and llms.txt. Nothing here is deleted, and no
 * redirect replaces them.
 *
 * Plain JavaScript so the Node check scripts read the same list as the pages.
 */

/** The baby zodiac calculator, in every language it is published in. */
export const HIDDEN_BABY_ZODIAC_PATHS = Object.freeze([
  '/baby-zodiac/',
  '/es/baby-zodiac/',
  '/pt/baby-zodiac/',
  '/fr/baby-zodiac/',
  '/it/baby-zodiac/',
  '/ru/baby-zodiac/',
]);

/** Almanac articles about reading a child's chart, by slug. */
export const HIDDEN_ALMANAC_SLUGS = Object.freeze(['reading-a-childs-chart']);

/** Every hidden page's address. */
export const HIDDEN_CHILD_PAGE_PATHS = Object.freeze([
  ...HIDDEN_BABY_ZODIAC_PATHS,
  '/occasions/baby-shower/',
  ...HIDDEN_ALMANAC_SLUGS.map((slug) => `/almanac/${slug}/`),
]);

const HIDDEN = new Set(HIDDEN_CHILD_PAGE_PATHS);

/** Whether a page address is one of the hidden child pages. */
export function isHiddenChildPage(path) {
  return HIDDEN.has(path);
}

/** Whether an Almanac entry, by its slug, is hidden. */
export function isHiddenAlmanacSlug(slug) {
  return HIDDEN_ALMANAC_SLUGS.includes(slug);
}
