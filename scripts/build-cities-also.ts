/**
 * Lists in public/data/cities/index.json, as `also`, under each first letter,
 * the places the index files under another letter whose GeoNames name or ASCII
 * name begins with it once folded as the search folds a query
 * (filedElsewhere, src/lib/geo/rank.ts). The search reads them with the shard
 * of the query's letter, so either name finds a place without another shard.
 * scripts/build-cities.mjs runs it after writing the shards; with --check it
 * fails when the committed index differs.
 *
 *   npm run data:cities:also [-- --check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { filedElsewhere, type Row } from '../src/lib/geo/rank';

const dir = new URL('../public/data/cities/', import.meta.url);
const committed = readFileSync(new URL('index.json', dir), 'utf8');
const { also: _also, ...index } = JSON.parse(committed) as { shards: string[]; also?: unknown };
const shards = Object.fromEntries(index.shards.map((key) => [key, JSON.parse(readFileSync(new URL(`${key}.json`, dir), 'utf8')) as Row[]]));
const also = filedElsewhere(shards);
const text = JSON.stringify({ ...index, also });
const rows = Object.values(also).reduce((sum, list) => sum + list.length, 0);
if (process.argv.includes('--check')) {
  if (text !== committed) {
    console.error('build-cities-also: public/data/cities/index.json differs; run npm run data:cities:also');
    process.exit(1);
  }
  console.log(`build-cities-also: up to date (${rows} rows under ${Object.keys(also).length} letters)`);
} else {
  writeFileSync(new URL('index.json', dir), text);
  console.log(`build-cities-also: wrote index.json (${rows} rows under ${Object.keys(also).length} letters)`);
}
