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

/** Each place's country, as the atlas's places.json gives it: the one whose calendar history a request may ask for with it. */
export const ATLAS_PLACE_COUNTRIES: Readonly<Record<AtlasPlaceId, string>> = Object.freeze({
  'fr-paris': 'FR',
  'fr-brest': 'FR',
  'fr-nantes': 'FR',
  'fr-bordeaux': 'FR',
  'fr-rouen': 'FR',
  'fr-toulouse': 'FR',
  'fr-lyon': 'FR',
  'fr-marseille': 'FR',
  'fr-nice': 'FR',
  'fr-ajaccio': 'FR',
  'fr-strasbourg': 'FR',
  'fr-metz': 'FR',
  'us-new-york': 'US',
  'us-baltimore': 'US',
  'us-washington': 'US',
  'us-providence': 'US',
  'us-indianapolis': 'US',
  'us-louisville': 'US',
  'us-chicago': 'US',
  'us-saint-paul': 'US',
  'us-minneapolis': 'US',
});

/** Each place's longitude, as the atlas's places.json gives it: the one its own mean time and tzdb's are read on. */
export const ATLAS_PLACE_LONGITUDES: Readonly<Record<AtlasPlaceId, number>> = Object.freeze({
  'fr-paris': 2.3488,
  'fr-brest': -4.48628,
  'fr-nantes': -1.55336,
  'fr-bordeaux': -0.58046,
  'fr-rouen': 1.09932,
  'fr-toulouse': 1.44367,
  'fr-lyon': 4.84789,
  'fr-marseille': 5.38107,
  'fr-nice': 7.26608,
  'fr-ajaccio': 8.73812,
  'fr-strasbourg': 7.74553,
  'fr-metz': 6.17269,
  'us-new-york': -74.00597,
  'us-baltimore': -76.61219,
  'us-washington': -77.03637,
  'us-providence': -71.41283,
  'us-indianapolis': -86.15804,
  'us-louisville': -85.75941,
  'us-chicago': -87.65005,
  'us-saint-paul': -93.09327,
  'us-minneapolis': -93.26384,
});

/** The atlas's version and the wall times it covers, as its manifest gives them. */
export const ATLAS_VERSION = '0.1.0';
export const ATLAS_WINDOW = Object.freeze({ from: '1870-01-01T00:00:00', to: '1920-01-01T00:00:00' } as const);
