/**
 * A result an assistant saved to someone's Zodiacs account, where no page can
 * reopen it from its address, links to its page with only the saved result's
 * digest after the # (`/birth-chart/#saved=<16 hex>`, `/occasions/#saved=<16 hex>`,
 * `/compatibility/<pair>/#saved=<16 hex>`, `/horoscopes/#week=<date>&saved=<16 hex>`,
 * written by src/ai-tools/accounts/save.ts). The saved_pages table keeps each
 * kind's link on its own page, so the link cannot point at the profile itself.
 * Instead, every page such a link can name (the birth chart, occasions,
 * compatibility and sign-pair pages, and the horoscopes hub) sends it on to the
 * profile's saved list (`SAVED_RESULT_FORWARD`, inline in the page's head),
 * which opens the saved result for the signed-in person. No link carries a
 * birth detail.
 */

/** The digest a saved link carries, or null: `saved=` followed by 16 lower-case hex digits. */
const SAVED_DIGEST = /(?:^#|[#&])saved=([0-9a-f]{16})(?:&|$)/u;

/** The saved result's digest in a link's fragment (or a whole href), or null. */
export function savedResultDigest(fragmentOrHref: string): string | null {
  const hash = fragmentOrHref.includes('#') ? fragmentOrHref.slice(fragmentOrHref.indexOf('#')) : fragmentOrHref;
  return SAVED_DIGEST.exec(hash)?.[1] ?? null;
}

/** The profile's saved list, opened at one saved result. */
export function savedResultProfileHref(digest: string): string {
  return `/profile/#saved=${digest}`;
}

/**
 * The page a saved link names, for "Explore more on Zodiacs": without a
 * saved= fragment, which would only lead back to the profile.
 */
export function savedResultExploreHref(href: string): string {
  return savedResultDigest(href) ? href.slice(0, href.indexOf('#')) || href : href;
}

/**
 * The inline script the pages a saved link names run first (before anything
 * paints): a #saved= link goes on to the profile's saved list. It runs in its
 * own function, so it leaves no global behind. Kept here, with the pattern
 * above, so the pages and the tests use the same words.
 */
export const SAVED_RESULT_FORWARD = "(function () { var saved = /(?:^#|[#&])saved=([0-9a-f]{16})(?:&|$)/.exec(location.hash); if (saved) location.replace('/profile/#saved=' + saved[1]); })();";
