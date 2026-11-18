/**
 * A result an assistant saved to someone's Zodiacs account, where no page can
 * reopen it from its address, links to its page with only the saved row's id
 * after the # (`/birth-chart/#saved=<id>`, `/occasions/#saved=<id>`,
 * `/compatibility/<pair>/#saved=<id>`, `/horoscopes/#week=<date>&saved=<id>`,
 * written by src/ai-tools/accounts/save.ts). The id is the saved_pages row's
 * own id, a random UUID: it is not worked out from the saved result, so it
 * gives nothing back about it. The saved_pages table keeps each kind's link on
 * its own page, so the link cannot point at the profile itself. Instead,
 * every page such a link can name (the birth chart, occasions, compatibility
 * and sign-pair pages, and the horoscopes hub) sends it on to the profile's
 * saved list (`SAVED_RESULT_FORWARD`, inline in the page's head), which opens
 * the saved result for the signed-in person. No link carries a birth detail.
 *
 * Links written before November 2026 carried 16 hex digits taken from a digest
 * of the saved result instead. Those values are retired: the stored links were
 * rewritten to the row id, and an old value is sent on to the plain profile
 * page, where it opens nothing.
 */

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** The id a saved link carries, or null: `saved=` followed by a lower-case UUID. */
const SAVED_ID = new RegExp(`(?:^#|[#&])saved=(${UUID})(?:&|$)`, 'u');

/** Any saved= value a link carries, the retired 16 hex digits included. */
const ANY_SAVED = new RegExp(`(?:^#|[#&])saved=(${UUID}|[0-9a-f]{16})(?:&|$)`, 'u');

const fragmentOf = (fragmentOrHref: string) => (fragmentOrHref.includes('#') ? fragmentOrHref.slice(fragmentOrHref.indexOf('#')) : fragmentOrHref);

/** The saved row's id in a link's fragment (or a whole href), or null. A retired 16 hex value is null. */
export function savedResultId(fragmentOrHref: string): string | null {
  return SAVED_ID.exec(fragmentOf(fragmentOrHref))?.[1] ?? null;
}

/** The profile's saved list, opened at one saved result. */
export function savedResultProfileHref(id: string): string {
  return `/profile/#saved=${id}`;
}

/**
 * The page a saved link names, for "Explore more on Zodiacs": without a
 * saved= fragment, which would only lead back to the profile.
 */
export function savedResultExploreHref(href: string): string {
  return ANY_SAVED.test(fragmentOf(href)) ? href.slice(0, href.indexOf('#')) || href : href;
}

/**
 * The inline script the pages a saved link names run first (before anything
 * paints): a #saved=<id> link goes on to the profile's saved list, and a
 * retired 16 hex value goes to the plain profile page without it. It runs in
 * its own function, so it leaves no global behind. Kept here, with the
 * patterns above, so the pages and the tests use the same words.
 */
export const SAVED_RESULT_FORWARD = `(function () { var saved = /${ANY_SAVED.source}/.exec(location.hash); if (saved) location.replace(saved[1].length === 16 ? '/profile/' : '/profile/#saved=' + saved[1]); })();`;
