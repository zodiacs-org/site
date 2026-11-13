/**
 * The "Updated" date each of these pages prints near its top, one constant
 * per page. The same value is the page's JSON-LD dateModified and its sitemap
 * lastmod (src/pages/sitemap.xml.ts), so the three never disagree. Move a
 * constant only when that page's content changes; a rebuild is not an update.
 *
 * 13 November 2026: times in five zones, the longer question lists and the
 * line on how the times are checked (Linear ZOD-180).
 *
 * 14 November 2026: the full moon and eclipse year pages print the instants
 * solved on NASA JPL Horizons, as each event's own page does (Linear ZOD-211).
 * Two printed minutes moved: the full moon of 15 October 2027 reads 13:47 UTC
 * and the eclipse of 18 July 2027 peaks at 16:02 UTC.
 */
export const MERCURY_RETROGRADE_2027_UPDATED = '2026-11-13';
export const FULL_MOON_CALENDAR_2027_UPDATED = '2026-11-14';
export const ECLIPSES_2027_UPDATED = '2026-11-14';
export const BIRTHDAY_HUB_UPDATED = '2026-11-13';
/** The template every /birthday/{month}-{day}/ page shares. */
export const BIRTHDAY_DAY_UPDATED = '2026-11-13';

/** The JSON-LD form of a date-only constant. */
export function updatedIso(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) throw new Error(`Not a date: ${day}`);
  return `${day}T00:00:00.000Z`;
}

/** "November 13, 2026", the way the English pages print dates. */
export function updatedLabel(day: string): string {
  return new Date(updatedIso(day)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
