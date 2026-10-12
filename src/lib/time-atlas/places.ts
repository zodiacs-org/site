/**
 * The places the time atlas lists, by id, without the atlas itself: the
 * request parser names them, and a bundle that parses requests but never
 * reads the atlas, such as the developer plugin's, does not carry it. The
 * tests hold the list to src/data/time-atlas/places.json.
 */
export const ATLAS_PLACE_IDS = Object.freeze([
  'fr-paris', 'fr-brest', 'fr-nantes', 'fr-bordeaux', 'fr-rouen', 'fr-toulouse', 'fr-lyon', 'fr-marseille',
  'fr-nice', 'fr-ajaccio', 'fr-strasbourg', 'fr-metz',
  'us-new-york', 'us-baltimore', 'us-washington', 'us-providence', 'us-indianapolis', 'us-louisville',
  'us-chicago', 'us-saint-paul', 'us-minneapolis',
] as const);
export type AtlasPlaceId = typeof ATLAS_PLACE_IDS[number];

/** The atlas's version and the wall times it covers, as its manifest gives them. */
export const ATLAS_VERSION = '0.1.0';
export const ATLAS_WINDOW = Object.freeze({ from: '1870-01-01T00:00:00', to: '1920-01-01T00:00:00' } as const);
