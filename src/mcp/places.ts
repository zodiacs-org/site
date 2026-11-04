/**
 * search_places: the site's birthplace search over the GeoNames index its
 * calculators read (public/data/cities/, which scripts/build-cities.mjs builds
 * from GeoNames cities15000, every place of 15,000 people or more, CC BY 4.0),
 * ranked as the site ranks it (src/lib/geo/rank.ts). The index is built into
 * the bundle: a search opens no file and makes no request, and the query
 * leaves this process only in the reply.
 */
import { z } from 'zod';
import { foldedQuery, queryRows, rankCities, shardKey, type CityIndex } from '../lib/geo/rank';
import { PLACE_SHARDS } from '../lib/geo/place-shards';
import index from '../../public/data/cities/index.json';
import { bounded } from './bounds';
import { citeFor, placesReceipt } from './cite';
import { PLACES_DEFAULT, PLACES_MAX, PLACES_SOURCE, PLACE_QUERY_CHARS } from './places-source';
import type { ToolOutcome } from './tools';

export { PLACE_SHARDS } from '../lib/geo/place-shards';

export { PLACES_SOURCE, PLACE_QUERY_CHARS, PLACES_DEFAULT, PLACES_MAX } from './places-source';

export const PLACES_INPUT = z.strictObject({
  query: z.string().max(PLACE_QUERY_CHARS)
    .describe('A place name or its start, as GeoNames writes it or in its ASCII spelling (Zürich, Zurich or Zuerich), in any letter case, with or without accents and apostrophes; two characters or more. Places whose names start with it come first, then, from three characters, places whose names begin with the same letter and contain it, each in order of population.'),
  limit: z.number().int().min(1).max(PLACES_MAX).optional()
    .describe(`How many places, 1 to ${PLACES_MAX}; ${PLACES_DEFAULT} when omitted, as the site's search lists.`),
});

/** The index as scripts/build-cities.mjs and scripts/build-cities-also.ts write it; the tests check its rows. */
const cityIndex = index as unknown as CityIndex;

export function searchPlaces(args: z.infer<typeof PLACES_INPUT>): ToolOutcome {
  const q = foldedQuery(args.query);
  const rows = q === null ? [] : queryRows(cityIndex, PLACE_SHARDS[shardKey(q)] ?? [], shardKey(q));
  const places = q === null ? [] : rankCities(cityIndex, rows, q, args.limit ?? PLACES_DEFAULT).map((city) => ({
    name: city.name,
    admin1: city.admin1,
    country: city.country,
    latitude: city.lat,
    longitude: city.lon,
    timeZone: city.tz,
    population: city.pop,
  }));
  const { source, licence, rows: count } = PLACES_SOURCE;
  const receipt = placesReceipt({ source, licence, rows: count });
  return bounded({ places, source: { ...PLACES_SOURCE }, receipt, cite: citeFor('search_places', receipt) });
}
