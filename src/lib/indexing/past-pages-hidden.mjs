/**
 * Past moon, eclipse and event pages hidden from search (Linear ZOD-221,
 * decision J, Dias, 14 November 2026): a thin page about a date already past,
 * with no Search Console impressions in the last 90 days, is marked noindex
 * and leaves the sitemaps. A past page that still gets search traffic stays.
 *
 * The list is src/data/indexing/past-pages-hidden.json. A page listed there
 * stays built and linked at its address; it renders `noindex, follow`, and
 * the sitemap, the section sitemaps and the search index leave it out.
 * check-dist holds the built site to the list. Nothing is deleted and no
 * redirect replaces a page, so taking an address off the list restores it.
 *
 * Plain JavaScript so the Node check scripts read the same rules as the pages.
 */

/** The four page families the list may name, each with its UTC date. */
const PAST_PAGE_PATH = /^\/(?:(?:full-moon|new-moon|eclipses)\/(\d{4}-\d{2}-\d{2})|events\/[a-z0-9]+(?:-[a-z0-9]+)*-(\d{4}-\d{2}-\d{2}))\/$/u;

/** The UTC date in a moon, eclipse or event page's address, or undefined. */
export function pastPageDate(path) {
  const match = PAST_PAGE_PATH.exec(String(path));
  const day = match?.[1] ?? match?.[2];
  if (!day) return undefined;
  const parsed = Date.parse(`${day}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === day ? day : undefined;
}

/**
 * What is wrong with a hidden-pages list: an entry that is not a moon,
 * eclipse or event page address, a page whose date is not before `today`
 * (YYYY-MM-DD; an upcoming page is never hidden), a page the site does not
 * publish, or a repeat.
 */
export function pastPagesHiddenFailures(paths, { today, publishedPaths }) {
  if (!Array.isArray(paths)) return ['past-pages-hidden: "paths" must be a list'];
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(today ?? '')) return [`past-pages-hidden: no date to compare with (${today})`];
  const failures = [];
  const seen = new Set();
  for (const path of paths) {
    if (seen.has(path)) failures.push(`past-pages-hidden: ${path} is listed twice`);
    seen.add(path);
    const day = pastPageDate(path);
    if (!day) {
      failures.push(`past-pages-hidden: ${path} is not a moon, eclipse or event page address`);
      continue;
    }
    if (day >= today) failures.push(`past-pages-hidden: ${path} is not past on ${today}; only past pages may be hidden`);
    if (publishedPaths && !publishedPaths.has(path)) failures.push(`past-pages-hidden: ${path} is not a published page`);
  }
  return failures;
}

/** A lookup over a hidden-pages list. */
export function pastPagesHidden(paths) {
  const hidden = new Set(paths);
  return (path) => hidden.has(path);
}
