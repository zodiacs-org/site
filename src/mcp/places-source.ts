/**
 * What search_places reads and returns at most, without the index itself:
 * the capabilities reply and the output schemas name these, and a bundle
 * that imports them, such as the developer plugin's, does not carry the index.
 * places.ts holds the shards; its tests hold `rows` to the index.
 */
export const PLACES_SOURCE = Object.freeze({
  source: 'GeoNames cities15000',
  licence: 'CC BY 4.0',
  url: 'https://www.geonames.org/',
  rows: 33_934,
} as const);

export const PLACE_QUERY_CHARS = 64;
/** As many places as the site's birthplace search lists. */
export const PLACES_DEFAULT = 8;
export const PLACES_MAX = 20;
