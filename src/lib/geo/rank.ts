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
  /** Under each first letter, the places filed under another whose name begins with it (filedElsewhere). */
  also?: Record<string, Row[]>;
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
 * places are filed under another letter than one of their names begins with:
 * GeoNames writes Đ as GJ in some Vietnamese and Croatian ASCII names (Đồng
 * Hới, GJong Hoi), begins some ASCII names with an apostrophe (‘Ibrī, 'Ibri,
 * filed under `0`), and gives a few places names in two languages (Donostia /
 * San Sebastián). For each first letter, these rows, by population: the index
 * lists them as `also` (scripts/build-cities-also.ts), and a query reads them
 * with its letter's shard, so either name finds a place.
 */
export function filedElsewhere(shards: Readonly<Record<string, readonly Row[]>>): Record<string, Row[]> {
  const also: Record<string, Row[]> = {};
  for (const key of Object.keys(shards).sort()) {
    for (const row of shards[key]) {
      const letters = new Set((row[1] === 0 ? [row[0]] : [row[0], row[1]]).map((name) => shardKey(fold(name))));
      for (const letter of letters) if (letter !== key) (also[letter] ??= []).push(row);
    }
  }
  for (const rows of Object.values(also)) rows.sort((a, b) => b[7] - a[7]);
  return Object.fromEntries(Object.keys(also).sort().map((letter) => [letter, also[letter]]));
}

/** Rows of several lists in one order by population, as each list's rows are. */
export function byPopulation(lists: readonly (readonly Row[])[]): readonly Row[] {
  return lists.length === 1 ? lists[0] : lists.flat().sort((a, b) => b[7] - a[7]);
}

/** The rows a query reads: its letter's shard, and the places the index lists under the letter as `also`. */
export function queryRows(index: CityIndex, shard: readonly Row[], key: string): readonly Row[] {
  const also = index.also?.[key];
  return also?.length ? byPopulation([shard, also]) : shard;
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

  // The rows are in population order already (queryRows merges a shard and its `also`).
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
