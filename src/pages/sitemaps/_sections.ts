/**
 * The section sitemaps under /sitemaps/ split the one list /sitemap.xml
 * carries, so Search Console can report indexing section by section. Each
 * sitemap.xml location belongs to exactly one section: locale-prefixed
 * locations to their locale, deeper paths to the section their first segments
 * name, and the rest (homes, section hubs, tools, legal and other top-level
 * pages) to core. Paths are matched by segment, not by literal route, so this
 * module names no route of its own. The leading underscore keeps Astro from
 * building it as a page.
 */
export const SITEMAP_SECTIONS = [
  'core',
  'birthdays',
  'compatibility',
  'learn',
  'horoscopes',
  'sky-events',
  'people',
  'terminal',
  'chinese-zodiac',
  'numerology',
  'developers',
  'es',
  'pt',
  'fr',
  'it',
  'ru',
] as const;

export type SitemapSection = (typeof SITEMAP_SECTIONS)[number];

/** The protocol's limit on the locations one sitemap may list. */
export const SITEMAP_URL_LIMIT = 50_000;

const LOCALE_SECTIONS: ReadonlySet<string> = new Set<SitemapSection>(['es', 'pt', 'fr', 'it', 'ru']);

/** First path segment → section, for paths deeper than one segment. */
const FIRST_SEGMENT_SECTIONS: ReadonlyMap<string, SitemapSection> = new Map<string, SitemapSection>([
  ['birthday', 'birthdays'],
  ['compatibility', 'compatibility'],
  ['learn', 'learn'],
  ['horoscopes', 'horoscopes'],
  ['new-moon', 'sky-events'],
  ['full-moon', 'sky-events'],
  ['eclipses', 'sky-events'],
  ['events', 'sky-events'],
  ['sky-calendar', 'sky-events'],
  // The events publication's dated retrograde pages and the year calendars.
  ['mercury-retrograde', 'sky-events'],
  ['venus-retrograde', 'sky-events'],
  ['mars-retrograde', 'sky-events'],
  ['full-moon-calendar', 'sky-events'],
  ['people', 'people'],
  ['terminal', 'terminal'],
  ['numerology', 'numerology'],
  ['developers', 'developers'],
]);

export function sitemapSectionPath(section: SitemapSection): string {
  return `/sitemaps/${section}.xml`;
}

/** The one section a sitemap location (a site path such as `/learn/houses/`) belongs to. */
export function sitemapSection(path: string): SitemapSection {
  const segments = path.split(/[?#]/u)[0].split('/').filter(Boolean);
  const [first, second] = segments;
  if (first && LOCALE_SECTIONS.has(first)) return first as SitemapSection;
  if (segments.length < 2) return 'core';
  if (first === 'learn' && second === 'chinese-zodiac') return 'chinese-zodiac';
  return FIRST_SEGMENT_SECTIONS.get(first) ?? 'core';
}

/** Splits entries by section, keeping sitemap.xml's order within each. Every section is present, empty or not. */
export function partitionSitemap<T extends { loc: string }>(entries: readonly T[]): Map<SitemapSection, T[]> {
  const sections = new Map<SitemapSection, T[]>(SITEMAP_SECTIONS.map((section) => [section, []]));
  for (const entry of entries) sections.get(sitemapSection(entry.loc))!.push(entry);
  return sections;
}
