/*
 * Builds the offline birthplace index used by the calculators' typeahead:
 *
 *   public/data/cities/index.json   — string tables (timezones, admin1,
 *                                     countries) + shard list, and, from
 *                                     scripts/build-cities-also.ts, the
 *                                     places filed under another letter
 *   public/data/cities/{a..z,0}.json — city rows sharded by first letter
 *
 * Source: GeoNames cities15000 (all cities with population ≥ 15,000),
 * admin1CodesASCII, and countryInfo. License: CC BY 4.0 — attribution is
 * rendered in the calculator footnote and the site footer.
 *
 * Row format (positional, compact):
 *   [name, asciiOrZero, admin1Idx, countryIdx, lat100, lon100, tzIdx, pop]
 *   - asciiOrZero: 0 when asciiname === name (the common case)
 *   - lat100/lon100: degrees × 100, rounded (≈1.1 km — far finer than a
 *     birth chart needs)
 *   - rows within a shard are sorted by population, descending
 *
 * Downloads land in .cache/ (gitignored). Output JSON is committed;
 * Vercel serves it with negotiated Brotli/gzip, so no pre-compression.
 *
 *   npm run data:cities
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = resolve(root, '.cache');
const outDir = resolve(root, 'public/data/cities');
await mkdir(cache, { recursive: true });
await mkdir(outDir, { recursive: true });

const BASE = 'https://download.geonames.org/export/dump';

async function download(name) {
  const dest = resolve(cache, name);
  try { await access(dest); console.log(`cache hit: ${name}`); return dest; } catch { /* fetch */ }
  // The GeoNames download server 503s under load — retry with backoff.
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    console.log(`downloading ${name} (attempt ${attempt}) …`);
    const res = await fetch(`${BASE}/${name}`, {
      headers: { 'user-agent': 'zodiacs.org build (site data pipeline)' },
    });
    if (res.ok) {
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return dest;
    }
    if (attempt === 5) throw new Error(`GeoNames download failed: ${name} (${res.status})`);
    await new Promise((r) => setTimeout(r, attempt * 4000));
  }
  return dest;
}

const zipPath = await download('cities15000.zip');
const admin1Path = await download('admin1CodesASCII.txt');
const countryPath = await download('countryInfo.txt');

// Extract the TSV from the zip (unzip if available, python3 fallback).
const txtPath = resolve(cache, 'cities15000.txt');
try { await access(txtPath); } catch {
  try {
    execFileSync('unzip', ['-o', zipPath, '-d', cache], { stdio: 'ignore' });
  } catch {
    execFileSync('python3', ['-m', 'zipfile', '-e', zipPath, cache], { stdio: 'ignore' });
  }
}

// ── String tables ─────────────────────────────────────────────────────
const admin1 = new Map(); // "US.CA" -> ascii name
for (const line of (await readFile(admin1Path, 'utf8')).split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [code, , ascii] = line.split('\t');
  if (code && ascii) admin1.set(code, ascii);
}

const countryName = new Map(); // "US" -> "United States"
for (const line of (await readFile(countryPath, 'utf8')).split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const cols = line.split('\t');
  if (cols[0] && cols[4]) countryName.set(cols[0], cols[4]);
}

// ── Parse cities ──────────────────────────────────────────────────────
const tzTable = [];
const tzIdx = new Map();
const admin1Table = [];
const admin1Idx = new Map();
const countryTable = [];
const countryIdx = new Map();

function intern(table, index, value) {
  if (!index.has(value)) { index.set(value, table.length); table.push(value); }
  return index.get(value);
}

function shardKey(ascii) {
  const c = ascii.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().charCodeAt(0);
  return c >= 97 && c <= 122 ? String.fromCharCode(c) : '0';
}

const shards = new Map(); // key -> rows
let count = 0;

for (const line of (await readFile(txtPath, 'utf8')).split('\n')) {
  if (!line) continue;
  const cols = line.split('\t');
  const name = cols[1];
  const ascii = cols[2] || name;
  const lat = Number(cols[4]);
  const lon = Number(cols[5]);
  const cc = cols[8];
  const a1code = cols[10];
  const pop = Number(cols[14]) || 0;
  const tz = cols[17];
  if (!name || !tz || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

  const a1name = admin1.get(`${cc}.${a1code}`) || '';
  const row = [
    name,
    ascii === name ? 0 : ascii,
    intern(admin1Table, admin1Idx, a1name),
    intern(countryTable, countryIdx, countryName.get(cc) || cc),
    Math.round(lat * 100),
    Math.round(lon * 100),
    intern(tzTable, tzIdx, tz),
    pop,
  ];
  const key = shardKey(ascii);
  if (!shards.has(key)) shards.set(key, []);
  shards.get(key).push(row);
  count += 1;
}

// ── Write output ──────────────────────────────────────────────────────
const shardKeys = [...shards.keys()].sort();
for (const key of shardKeys) {
  const rows = shards.get(key).sort((a, b) => b[7] - a[7]);
  await writeFile(resolve(outDir, `${key}.json`), JSON.stringify(rows));
}
await writeFile(
  resolve(outDir, 'index.json'),
  JSON.stringify({
    version: 1,
    source: 'GeoNames cities15000 (CC BY 4.0)',
    count,
    tz: tzTable,
    admin1: admin1Table,
    countries: countryTable,
    shards: shardKeys,
  })
);

execFileSync('npx', ['vite-node', '--script', 'scripts/build-cities-also.ts'], { cwd: root, stdio: 'inherit' });

console.log(`Done — ${count} cities across ${shardKeys.length} shards, ${tzTable.length} timezones.`);
