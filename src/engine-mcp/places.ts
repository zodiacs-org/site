/**
 * search_places for /mcp/engine: the site's birthplace search over the
 * GeoNames index its calculators read (public/data/cities/, built by
 * scripts/build-cities.mjs from GeoNames cities15000, CC BY 4.0), ranked as
 * the site ranks it (src/lib/geo/rank.ts). The local stdio adapter's
 * search_places (src/mcp/places.ts) reads the same files; this module loads
 * only the index and the one shard a query needs, with import attributes the
 * Vercel runtime accepts.
 */
import { z } from 'zod';
import { foldedQuery, queryRows, rankCities, shardKey, type CityIndex, type Row } from '../lib/geo/rank.js';
import { PLACES_DEFAULT, PLACES_MAX, PLACES_SOURCE, PLACE_QUERY_CHARS } from '../mcp/places-source.js';

const SHARDS: Readonly<Record<string, () => Promise<{ default: unknown }>>> = Object.freeze({
  '0': () => import('../../public/data/cities/0.json', { with: { type: 'json' } }),
  'a': () => import('../../public/data/cities/a.json', { with: { type: 'json' } }),
  'b': () => import('../../public/data/cities/b.json', { with: { type: 'json' } }),
  'c': () => import('../../public/data/cities/c.json', { with: { type: 'json' } }),
  'd': () => import('../../public/data/cities/d.json', { with: { type: 'json' } }),
  'e': () => import('../../public/data/cities/e.json', { with: { type: 'json' } }),
  'f': () => import('../../public/data/cities/f.json', { with: { type: 'json' } }),
  'g': () => import('../../public/data/cities/g.json', { with: { type: 'json' } }),
  'h': () => import('../../public/data/cities/h.json', { with: { type: 'json' } }),
  'i': () => import('../../public/data/cities/i.json', { with: { type: 'json' } }),
  'j': () => import('../../public/data/cities/j.json', { with: { type: 'json' } }),
  'k': () => import('../../public/data/cities/k.json', { with: { type: 'json' } }),
  'l': () => import('../../public/data/cities/l.json', { with: { type: 'json' } }),
  'm': () => import('../../public/data/cities/m.json', { with: { type: 'json' } }),
  'n': () => import('../../public/data/cities/n.json', { with: { type: 'json' } }),
  'o': () => import('../../public/data/cities/o.json', { with: { type: 'json' } }),
  'p': () => import('../../public/data/cities/p.json', { with: { type: 'json' } }),
  'q': () => import('../../public/data/cities/q.json', { with: { type: 'json' } }),
  'r': () => import('../../public/data/cities/r.json', { with: { type: 'json' } }),
  's': () => import('../../public/data/cities/s.json', { with: { type: 'json' } }),
  't': () => import('../../public/data/cities/t.json', { with: { type: 'json' } }),
  'u': () => import('../../public/data/cities/u.json', { with: { type: 'json' } }),
  'v': () => import('../../public/data/cities/v.json', { with: { type: 'json' } }),
  'w': () => import('../../public/data/cities/w.json', { with: { type: 'json' } }),
  'x': () => import('../../public/data/cities/x.json', { with: { type: 'json' } }),
  'y': () => import('../../public/data/cities/y.json', { with: { type: 'json' } }),
  'z': () => import('../../public/data/cities/z.json', { with: { type: 'json' } }),
});

export const PLACES_INPUT = z.strictObject({
  query: z.string().max(PLACE_QUERY_CHARS)
    .describe('A place name or its start, as GeoNames writes it or in its ASCII spelling (Zürich, Zurich or Zuerich), in any letter case, with or without accents; two characters or more. Places whose names start with it come first, then, from three characters, places whose names begin with the same letter and contain it, each in order of population.'),
  limit: z.number().int().min(1).max(PLACES_MAX).optional()
    .describe(`How many places, 1 to ${PLACES_MAX}; ${PLACES_DEFAULT} when omitted.`),
});

export const PLACES_OUTPUT = z.strictObject({
  places: z.array(z.strictObject({
    name: z.string(),
    admin1: z.string().describe('The region, as GeoNames names its first-level division; empty where it has none.'),
    country: z.string(),
    latitude: z.number().describe('Degrees north, rounded to 0.01° as the index stores it.'),
    longitude: z.number().describe('Degrees east, rounded to 0.01° as the index stores it.'),
    timeZone: z.string().describe('The place\'s IANA time zone, for resolve_civil_time and reading_facts.'),
    population: z.number().int().nonnegative(),
  })).max(PLACES_MAX),
  source: z.strictObject({ source: z.string(), licence: z.string(), url: z.string(), rows: z.number().int() })
    .describe('The index searched: GeoNames cities15000, every place of 15,000 people or more, under CC BY 4.0.'),
});

export { PLACES_SOURCE };

let index: Promise<CityIndex> | undefined;

export async function searchPlaces(args: z.infer<typeof PLACES_INPUT>): Promise<z.infer<typeof PLACES_OUTPUT>> {
  const q = foldedQuery(args.query);
  let places: z.infer<typeof PLACES_OUTPUT>['places'] = [];
  if (q !== null) {
    const key = shardKey(q);
    index ??= import('../../public/data/cities/index.json', { with: { type: 'json' } }).then((m) => m.default as unknown as CityIndex);
    const cities = await index;
    const load = SHARDS[key];
    const shard = load ? (await load()).default as readonly Row[] : [];
    places = rankCities(cities, queryRows(cities, shard, key), q, args.limit ?? PLACES_DEFAULT).map((city) => ({
      name: city.name, admin1: city.admin1, country: city.country,
      latitude: city.lat, longitude: city.lon, timeZone: city.tz, population: city.pop,
    }));
  }
  return { places, source: { ...PLACES_SOURCE } };
}
