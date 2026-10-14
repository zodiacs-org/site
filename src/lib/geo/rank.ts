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

/** Letters NFD leaves whole, written as GeoNames' ASCII names write them. */
const ASCII_LETTERS: Readonly<Record<string, string>> = {
  'ł': 'l', 'ø': 'o', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'æ': 'ae', 'œ': 'oe', 'ß': 'ss',
  'ı': 'i', 'ħ': 'h', 'ŧ': 't', 'ŋ': 'n', 'ĸ': 'k', 'ſ': 's', 'ŀ': 'l', 'ə': 'a',
};

/**
 * A name or a query as the search compares them: accents, letter case and
 * apostrophes set aside, dashes written as hyphens, and the letters NFD leaves
 * whole written in ASCII.
 */
export const fold = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[łøđðþæœßıħŧŋĸſŀə]/g, (letter) => ASCII_LETTERS[letter] ?? letter)
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/['`\u00b4\u02bb\u02bc\u2018\u2019]/g, '');

/** The folded query, or null when it is too short to search. */
export function foldedQuery(query: string): string | null {
  const q = fold(query.trim());
  return q[1] ? q : null;
}

/** The shard a folded query's first letter names: the letter, or `0` for anything else. */
export function shardKey(q: string): string {
  return /^[a-z]/.test(q) ? q[0] : '0';
}

/**
 * The index files a place under the first letter of its ASCII name, so a few
 * names that begin with these letters are filed under another: GeoNames writes
 * Đ as GJ in some Vietnamese and Croatian ASCII names (Đồng Hới, GJong Hoi),
 * and some ASCII names begin with an apostrophe (‘Ibrī, 'Ibri), filed under
 * `0`. rank.test.ts holds this table to the index.
 */
const ALSO_FILED_UNDER: Readonly<Record<string, readonly string[]>> = {
  a: ['0'], d: ['g'], e: ['0'], i: ['0'], s: ['0'], u: ['0'],
};

/** The shards a folded query reads: its first letter's, then those that file names beginning with it under another. */
export function shardKeys(q: string): string[] {
  const key = shardKey(q);
  return [key, ...(ALSO_FILED_UNDER[key] ?? [])];
}

/** The rows of the shards a query reads, in one order by population, as each shard's rows are. */
export function byPopulation(shards: readonly (readonly Row[])[]): readonly Row[] {
  return shards.length === 1 ? shards[0] : shards.flat().sort((a, b) => b[7] - a[7]);
}

const foldedRows = new WeakMap<Row, readonly [string, string]>();

/** A row's name and ASCII name, folded once. */
function foldedNames(row: Row): readonly [string, string] {
  let names = foldedRows.get(row);
  if (!names) {
    const name = fold(row[0]);
    names = [name, row[1] === 0 ? name : fold(row[1])];
    foldedRows.set(row, names);
  }
  return names;
}

/**
 * A place matches by its name or by its ASCII name (Zürich or Zuerich): names
 * that start with the query first, then, for three characters or more, names
 * that begin with the query's first letter and contain it; each in the order
 * of the rows, which is by population.
 */
export function rankCities(index: CityIndex, rows: readonly Row[], q: string, limit: number): City[] {
  const starts: Row[] = [];
  const contains: Row[] = [];
  for (const row of rows) {
    const [name, ascii] = foldedNames(row);
    if (name.startsWith(q) || ascii.startsWith(q)) starts.push(row);
    else if (q[2] && ((name[0] === q[0] && name.includes(q)) || (ascii[0] === q[0] && ascii.includes(q)))) contains.push(row);
    if (starts.length >= limit * 3) break;
  }

  // The rows are in population order already (byPopulation for several shards).
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
