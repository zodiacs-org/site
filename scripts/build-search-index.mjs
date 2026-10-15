/*
 * Builds dist/search-index.json after `astro build` — every indexable EN
 * page plus one entry per glossary term.
 *
 * MUST run under `vite-node --script` (see the build script in package.json,
 * or `npm run data:search-index`): it imports src/data/glossary.ts, whose
 * TypeScript import chain plain `node` cannot resolve. Do NOT "simplify" the
 * wiring to `node scripts/build-search-index.mjs` — it crashes, and if the
 * build script loses this step, production loses /search-index.json.
 */
import { gzipSync } from 'node:zlib';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GLOSSARY } from '../src/data/glossary.ts';
import {
  CURATED_WING_ENTRIES,
  extractPageMetadata,
  glossarySearchEntries,
  htmlFileToPath,
  inferSearchKind,
  isEnglishHtml,
  searchIndexShapeFailures,
  shouldIndexPath,
  sortSearchEntries,
  truncateAtWord,
} from './search-index-lib.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIST = resolve(repo, 'dist');
const MAX_GZIP_BYTES = 150 * 1024;

async function htmlFiles(dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...await htmlFiles(path));
    else if (entry.name.endsWith('.html')) output.push(path);
  }
  return output;
}

export async function buildSearchIndex({ distRoot = DEFAULT_DIST, minEntries = 400 } = {}) {
  const pageEntries = [];
  for (const file of await htmlFiles(distRoot)) {
    const path = htmlFileToPath(relative(distRoot, file));
    if (!shouldIndexPath(path)) continue;
    const html = await readFile(file, 'utf8');
    if (!isEnglishHtml(html)) continue;
    const metadata = extractPageMetadata(html);
    if (!metadata.searchable) continue;
    if (!metadata.title || !metadata.description) {
      throw new Error(`Search index metadata missing for ${path}`);
    }
    pageEntries.push({
      path,
      title: metadata.title,
      description: metadata.description,
      kind: inferSearchKind(path),
    });
  }

  let entries = sortSearchEntries([
    ...pageEntries,
    ...CURATED_WING_ENTRIES,
    ...glossarySearchEntries(GLOSSARY),
  ]);
  let json = JSON.stringify(entries);
  let gzipBytes = gzipSync(json, { level: 9 }).byteLength;
  let descriptionsTrimmed = false;

  if (gzipBytes >= MAX_GZIP_BYTES) {
    descriptionsTrimmed = true;
    entries = entries.map((entry) => ({
      ...entry,
      description: truncateAtWord(entry.description, 160),
    }));
    json = JSON.stringify(entries);
    gzipBytes = gzipSync(json, { level: 9 }).byteLength;
  }

  const shapeFailures = searchIndexShapeFailures(entries, { minEntries });
  if (shapeFailures.length) {
    throw new Error(`Search index is invalid: ${shapeFailures.join('; ')}`);
  }
  if (gzipBytes >= MAX_GZIP_BYTES) {
    throw new Error(`Search index is ${(gzipBytes / 1024).toFixed(1)} KB gzip; limit is 150 KB`);
  }

  await writeFile(resolve(distRoot, 'search-index.json'), `${json}\n`, 'utf8');
  console.log(
    `search-index: ${pageEntries.length} pages + ${CURATED_WING_ENTRIES.length} curated registry entries`
    + ` + ${GLOSSARY.length} terms = ${entries.length} entries`
    + ` · ${Buffer.byteLength(json)} bytes raw · ${(gzipBytes / 1024).toFixed(1)} KB gzip`
    + (descriptionsTrimmed ? ' · descriptions trimmed to 160 characters' : ''),
  );
  return { entries, gzipBytes, descriptionsTrimmed };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  await buildSearchIndex();
}
