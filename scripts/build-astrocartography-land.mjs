#!/usr/bin/env node
/**
 * The dots the /astrocartography/ map draws its land with: every 2-degree cell
 * of latitude and longitude that holds a town or city in the GeoNames place
 * index the site already ships (public/data/cities/, CC BY 4.0), so the map
 * shows where people live and needs no map tiles, no third-party data and no
 * network. Writes src/data/astrocartography-land.json; --check fails on drift.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';

const CELL = 2;
const root = new URL('../', import.meta.url);
const target = new URL('src/data/astrocartography-land.json', root);
const folder = new URL('public/data/cities/', root);
const cells = new Set();
for (const name of (await readdir(folder)).filter((file) => file.endsWith('.json') && file !== 'index.json').sort()) {
  for (const row of JSON.parse(await readFile(new URL(name, folder), 'utf8'))) {
    // Rows store latitude and longitude in hundredths of a degree at [4] and [5].
    const lat = Math.floor((row[4] / 100 + 90) / CELL);
    const lon = Math.floor((row[5] / 100 + 180) / CELL);
    cells.add(lat * 1000 + lon);
  }
}
const sorted = [...cells].sort((a, b) => a - b);
const output = `${JSON.stringify({ source: 'GeoNames cities15000 via public/data/cities (CC BY 4.0)', cellDegrees: CELL, cells: sorted.map((key) => [Math.floor(key / 1000), key % 1000]) })}\n`;
if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8').catch(() => '');
  if (current !== output) { console.error('src/data/astrocartography-land.json is stale; run node scripts/build-astrocartography-land.mjs'); process.exit(1); }
  console.log(`Verified src/data/astrocartography-land.json (${sorted.length} cells)`);
} else {
  await writeFile(target, output);
  console.log(`Built src/data/astrocartography-land.json (${sorted.length} cells, ${output.length} bytes)`);
}
