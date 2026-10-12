/**
 * The birthplace search's ranking over the sharded GeoNames index
 * (public/data/cities/, scripts/build-cities.mjs), without the loading:
 * search.ts fetches the files in the browser, and the local MCP adapter's
 * search_places reads the same files built into its bundle. Import-free.
 */

export interface City {
  name: string;
  admin1: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
  pop: number;
}

export interface CityIndex {
  tz: string[];
  admin1: string[];
  countries: string[];
  shards: string[];
}

/** [name, asciiOrZero, admin1Idx, countryIdx, lat100, lon100, tzIdx, pop]; scripts/build-cities.mjs. */
export type Row = [string, string | 0, number, number, number, number, number, number];

export const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** The folded query, or null when it is too short to search. */
export function foldedQuery(query: string): string | null {
  const q = fold(query.trim());
  return q[1] ? q : null;
}

/** The shard a folded query reads: its first letter, or `0` for anything else. */
export function shardKey(q: string): string {
  return /^[a-z]/.test(q) ? q[0] : '0';
}

/**
 * Names that start with the query first, then, for three characters or more,
 * names that contain it; each in the shard's order, which is by population.
 */
export function rankCities(index: CityIndex, rows: readonly Row[], q: string, limit: number): City[] {
  const starts: Row[] = [];
  const contains: Row[] = [];
  for (const row of rows) {
    const ascii = fold(row[1] === 0 ? row[0] : row[1]);
    const match = ascii.indexOf(q);
    // `indexOf` is 0 for a prefix and -1 (whose bitwise complement is 0)
    // for no match, so one lookup serves both result tiers.
    if (!match) starts.push(row);
    else if (q[2] && ~match) contains.push(row);
    if (starts.length >= limit * 3) break;
  }

  // Rows are population-sorted within the shard already.
  return [...starts, ...contains].slice(0, limit).map((r) => ({
    name: r[0],
    admin1: index.admin1[r[2]] ?? '',
    country: index.countries[r[3]] ?? '',
    lat: r[4] / 100,
    lon: r[5] / 100,
    tz: index.tz[r[6]],
    pop: r[7],
  }));
}
