/**
 * The last day the shared horoscope page template changed what every reading
 * page shows (2026-11-06: the planets' ingress, station and aspect times are
 * NASA JPL's, src/lib/nasa-instants.ts; 2026-11-02: the 2026 yearly reading
 * joined each page's "More for" list; before it, 2026-10-16: labels set in the sans, the kicker moved
 * under the headline as a dateline, and dash punctuation). A reading page last changed
 * on the later of its own reading date and this one; the sitemap and
 * scripts/check-dist.mjs both read it from here.
 */
export const HOROSCOPE_TEMPLATE_LASTMOD = '2026-11-06';

/** The later of two YYYY-MM-DD dates. */
export function laterDate(left, right) {
  return left > right ? left : right;
}
