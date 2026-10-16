/**
 * The last day the shared horoscope page template changed what every reading
 * page shows (2026-10-16: labels set in the sans, the kicker moved under the
 * headline as a dateline, and dash punctuation). A reading page last changed
 * on the later of its own reading date and this one; the sitemap and
 * scripts/check-dist.mjs both read it from here.
 */
export const HOROSCOPE_TEMPLATE_LASTMOD = '2026-10-16';

/** The later of two YYYY-MM-DD dates. */
export function laterDate(left, right) {
  return left > right ? left : right;
}
