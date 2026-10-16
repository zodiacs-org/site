/** Source-controlled editorial owners; rebuilding is not a content revision.
 * Dates preserve the reviewed sitemap baseline, except /learn/: Search's
 * September 5 content revision (034ee2f) supersedes its August 23 receipt;
 * the October 16 design sweep (labels and dash punctuation) dates them all.
 * No reliable first-publication receipt is available for these pages.
 */
const animals = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig'];
const locales = ['en', 'es', 'pt', 'fr', 'it'];
export const EDITORIAL_METADATA = Object.freeze(Object.fromEntries([
  ...[
    ['/learn/', '2026-10-16'],
    ['/learn/houses/', '2026-10-16'],
    ['/learn/planets/', '2026-10-16'],
    ['/learn/aspects/', '2026-10-16'],
    ['/learn/placements/', '2026-10-16'],
  ].map(([path, modified]) => [path, Object.freeze({ type: 'CollectionPage', modified })]),
  ...locales.flatMap((locale) => ['', ...animals.map((animal) => `${animal}/`)].map((suffix) => [
    `${locale === 'en' ? '' : `/${locale}`}/learn/chinese-zodiac/${suffix}`,
    Object.freeze({ type: 'Article', modified: '2026-10-16' }),
  ])),
]));

/** @param {string} path */
export function editorialMetadata(path) {
  const owner = EDITORIAL_METADATA[path];
  if (!owner) throw new Error(`Missing editorial metadata owner: ${path}`);
  return owner;
}

/** @param {string} path */
export function editorialDates(path) {
  return { dateModified: `${editorialMetadata(path).modified}T00:00:00.000Z` };
}
