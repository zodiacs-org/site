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

/** Each place's tzdb zone, as the atlas's places.json gives it: the zone a request naming the place must use. */
export const ATLAS_PLACE_ZONES: Readonly<Record<AtlasPlaceId, string>> = Object.freeze({
  'fr-paris': 'Europe/Paris', 'fr-brest': 'Europe/Paris', 'fr-nantes': 'Europe/Paris', 'fr-bordeaux': 'Europe/Paris',
  'fr-rouen': 'Europe/Paris', 'fr-toulouse': 'Europe/Paris', 'fr-lyon': 'Europe/Paris', 'fr-marseille': 'Europe/Paris',
  'fr-nice': 'Europe/Paris', 'fr-ajaccio': 'Europe/Paris', 'fr-strasbourg': 'Europe/Paris', 'fr-metz': 'Europe/Paris',
  'us-new-york': 'America/New_York', 'us-baltimore': 'America/New_York', 'us-washington': 'America/New_York',
  'us-providence': 'America/New_York', 'us-indianapolis': 'America/Indiana/Indianapolis',
  'us-louisville': 'America/Kentucky/Louisville', 'us-chicago': 'America/Chicago', 'us-saint-paul': 'America/Chicago',
  'us-minneapolis': 'America/Chicago',
});

/** The atlas's version and the wall times it covers, as its manifest gives them. */
export const ATLAS_VERSION = '0.1.0';
export const ATLAS_WINDOW = Object.freeze({ from: '1870-01-01T00:00:00', to: '1920-01-01T00:00:00' } as const);
