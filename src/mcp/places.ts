/**
 * search_places: the site's birthplace search over the GeoNames index its
 * calculators read (public/data/cities/, which scripts/build-cities.mjs builds
 * from GeoNames cities15000, every place of 15,000 people or more, CC BY 4.0),
 * ranked as the site ranks it (src/lib/geo/rank.ts). The index is built into
 * the bundle: a search opens no file and makes no request, and the query
 * leaves this process only in the reply.
 */
import { z } from 'zod';
import { foldedQuery, rankCities, shardKey, type CityIndex, type Row } from '../lib/geo/rank';
import index from '../../public/data/cities/index.json';
import shardDigits from '../../public/data/cities/0.json';
import shardA from '../../public/data/cities/a.json';
import shardB from '../../public/data/cities/b.json';
import shardC from '../../public/data/cities/c.json';
import shardD from '../../public/data/cities/d.json';
import shardE from '../../public/data/cities/e.json';
import shardF from '../../public/data/cities/f.json';
import shardG from '../../public/data/cities/g.json';
import shardH from '../../public/data/cities/h.json';
import shardI from '../../public/data/cities/i.json';
import shardJ from '../../public/data/cities/j.json';
import shardK from '../../public/data/cities/k.json';
import shardL from '../../public/data/cities/l.json';
import shardM from '../../public/data/cities/m.json';
import shardN from '../../public/data/cities/n.json';
import shardO from '../../public/data/cities/o.json';
import shardP from '../../public/data/cities/p.json';
import shardQ from '../../public/data/cities/q.json';
import shardR from '../../public/data/cities/r.json';
import shardS from '../../public/data/cities/s.json';
import shardT from '../../public/data/cities/t.json';
import shardU from '../../public/data/cities/u.json';
import shardV from '../../public/data/cities/v.json';
import shardW from '../../public/data/cities/w.json';
import shardX from '../../public/data/cities/x.json';
import shardY from '../../public/data/cities/y.json';
import shardZ from '../../public/data/cities/z.json';
import { bounded } from './bounds';
import { citeFor, placesReceipt } from './cite';
import { PLACES_DEFAULT, PLACES_MAX, PLACES_SOURCE, PLACE_QUERY_CHARS } from './places-source';
import type { ToolOutcome } from './tools';

/** A shard as scripts/build-cities.mjs writes it; the tests check every row's shape. */
const rows = (shard: unknown) => shard as readonly Row[];

/** Each shard of the index, by the first letter of the names in it; `0` holds the rest. */
export const PLACE_SHARDS: Readonly<Record<string, readonly Row[]>> = Object.freeze({
  '0': rows(shardDigits),
  a: rows(shardA),
  b: rows(shardB),
  c: rows(shardC),
  d: rows(shardD),
  e: rows(shardE),
  f: rows(shardF),
  g: rows(shardG),
  h: rows(shardH),
  i: rows(shardI),
  j: rows(shardJ),
  k: rows(shardK),
  l: rows(shardL),
  m: rows(shardM),
  n: rows(shardN),
  o: rows(shardO),
  p: rows(shardP),
  q: rows(shardQ),
  r: rows(shardR),
  s: rows(shardS),
  t: rows(shardT),
  u: rows(shardU),
  v: rows(shardV),
  w: rows(shardW),
  x: rows(shardX),
  y: rows(shardY),
  z: rows(shardZ),
});

export { PLACES_SOURCE, PLACE_QUERY_CHARS, PLACES_DEFAULT, PLACES_MAX } from './places-source';

export const PLACES_INPUT = z.strictObject({
  query: z.string().max(PLACE_QUERY_CHARS)
    .describe('A place name or its start, in any letter case, with or without accents; two characters or more. Places whose names start with it come first, then, from three characters, places whose names begin with the same letter and contain it, each in order of population.'),
  limit: z.number().int().min(1).max(PLACES_MAX).optional()
    .describe(`How many places, 1 to ${PLACES_MAX}; ${PLACES_DEFAULT} when omitted, as the site's search lists.`),
});

const cityIndex = index as CityIndex;

export function searchPlaces(args: z.infer<typeof PLACES_INPUT>): ToolOutcome {
  const q = foldedQuery(args.query);
  const rows = q === null ? [] : PLACE_SHARDS[shardKey(q)] ?? [];
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
