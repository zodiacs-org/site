#!/usr/bin/env node
/**
 * Writes the profile access bootstrap's hashed chunk URL into the inline
 * presence loader of every built page (postbuild, first step), and verifies
 * the result. See src/lib/account-v2/profile-access-loader.mjs.
 *
 * Astro renders the loader before Vite has named the chunk, so a page carries
 * PROFILE_ACCESS_CHUNK_PLACEHOLDER. This step finds the one chunk Vite emitted
 * for src/lib/account-v2/profile-access-autostart.ts, checks that the save-path
 * loader's dynamic import points at that same file (so the inline loader and a
 * save share one module and one bootstrap), and replaces the placeholder.
 * It fails the build when a page needs the URL and the chunk is missing,
 * ambiguous or not the one the save path imports, and `--check` (run again by
 * check-dist) fails if any page still holds the placeholder or names a file
 * that is not that chunk.
 *
 *   node scripts/stamp-profile-access-loader.mjs          # stamp, then verify
 *   node scripts/stamp-profile-access-loader.mjs --check  # verify only
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  PROFILE_ACCESS_CHUNK_PATTERN,
  PROFILE_ACCESS_CHUNK_PLACEHOLDER,
  PROFILE_ACCESS_LOADER_ATTRIBUTE,
} from '../src/lib/account-v2/profile-access-loader.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_PREFIX = '/_astro/';
const LOADER_SCRIPT = new RegExp(
  `<script\\b[^>]*\\b${PROFILE_ACCESS_LOADER_ATTRIBUTE}\\b[^>]*>([\\s\\S]*?)</script>`,
  'gu',
);

async function htmlFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.isFile() && entry.name.endsWith('.html') ? [path] : [];
  }));
  return nested.flat();
}

/**
 * The emitted chunk, and whether the save path's dynamic import names it.
 * @param {string} dist
 * @returns {Promise<{ name: string | null, problems: string[] }>}
 */
export async function findProfileAccessChunk(dist) {
  const assets = resolve(dist, '_astro');
  let names = [];
  try {
    names = (await readdir(assets)).filter((name) => name.endsWith('.js'));
  } catch {
    return { name: null, problems: ['dist/_astro is missing'] };
  }
  const candidates = names.filter((name) => PROFILE_ACCESS_CHUNK_PATTERN.test(name));
  if (candidates.length !== 1) {
    return {
      name: null,
      problems: [`expected exactly one profile-access-autostart chunk in dist/_astro, found ${candidates.length}`],
    };
  }
  const [name] = candidates;
  const importedBy = [];
  for (const other of names) {
    if (other === name) continue;
    const source = await readFile(resolve(assets, other), 'utf8');
    if (['"', "'", '`'].some((quote) => source.includes(`${quote}./${name}${quote}`))) importedBy.push(other);
  }
  return {
    name,
    problems: importedBy.length === 0
      ? [`no built chunk imports ${name}; the save path and the inline loader would not share it`]
      : [],
  };
}

/**
 * Problems with the stamped pages (empty when every loader is right).
 * @param {string} dist
 * @param {string | null} chunkName
 */
export async function profileAccessLoaderProblems(dist, chunkName) {
  const problems = [];
  const expected = chunkName ? `${ASSET_PREFIX}${chunkName}` : null;
  for (const file of await htmlFiles(dist)) {
    const html = await readFile(file, 'utf8');
    const page = file.slice(dist.length + 1);
    if (html.includes(PROFILE_ACCESS_CHUNK_PLACEHOLDER)) {
      problems.push(`${page}: the profile access loader was never stamped`);
    }
    for (const match of html.matchAll(LOADER_SCRIPT)) {
      const urls = [...match[1].matchAll(/"(\/_astro\/[^"]+)"/gu)].map((url) => url[1]);
      if (urls.length !== 1) {
        problems.push(`${page}: the profile access loader names ${urls.length} chunk URLs`);
        continue;
      }
      const [url] = urls;
      if (!expected || url !== expected) {
        problems.push(`${page}: the profile access loader imports ${url}, not ${expected ?? 'a built chunk'}`);
      } else if (!existsSync(resolve(dist, url.slice(1)))) {
        problems.push(`${page}: ${url} does not exist`);
      }
    }
  }
  return problems;
}

/** True when any built page carries the loader or its placeholder (account sync v2 on). */
async function pagesNeedChunk(dist) {
  for (const file of await htmlFiles(dist)) {
    const html = await readFile(file, 'utf8');
    if (html.includes(PROFILE_ACCESS_CHUNK_PLACEHOLDER) || html.includes(PROFILE_ACCESS_LOADER_ATTRIBUTE)) return true;
  }
  return false;
}

/**
 * The whole verification check-dist runs: when any page carries the loader,
 * the chunk must be the one the save path imports AND every page must name
 * it. Either kind of problem fails on its own.
 * @param {string} dist
 * @returns {Promise<{ needed: boolean, chunkName: string | null, problems: string[] }>}
 */
export async function verifyProfileAccessLoader(dist) {
  if (!await pagesNeedChunk(dist)) return { needed: false, chunkName: null, problems: [] };
  const chunk = await findProfileAccessChunk(dist);
  const pages = await profileAccessLoaderProblems(dist, chunk.name);
  return { needed: true, chunkName: chunk.name, problems: [...chunk.problems, ...pages] };
}

/** Stamps every page; returns the number of pages changed. */
export async function stampProfileAccessLoader(dist, chunkName) {
  const url = `${ASSET_PREFIX}${chunkName}`;
  let stamped = 0;
  for (const file of await htmlFiles(dist)) {
    const html = await readFile(file, 'utf8');
    if (!html.includes(PROFILE_ACCESS_CHUNK_PLACEHOLDER)) continue;
    await writeFile(file, html.split(PROFILE_ACCESS_CHUNK_PLACEHOLDER).join(url));
    stamped += 1;
  }
  return stamped;
}

async function main() {
  const dist = resolve(repo, 'dist');
  const checkOnly = process.argv.includes('--check');
  if (!await pagesNeedChunk(dist)) {
    console.log('stamp-profile-access-loader: no page carries the loader (account sync v2 off)');
    return;
  }
  const chunk = await findProfileAccessChunk(dist);
  if (chunk.problems.length || !chunk.name) {
    for (const problem of chunk.problems) console.error(`stamp-profile-access-loader: ${problem}`);
    process.exit(1);
  }
  if (!checkOnly) {
    const stamped = await stampProfileAccessLoader(dist, chunk.name);
    console.log(`stamp-profile-access-loader: ${ASSET_PREFIX}${chunk.name} written into ${stamped} pages`);
  }
  const { problems } = await verifyProfileAccessLoader(dist);
  if (problems.length) {
    console.error(`stamp-profile-access-loader: ${problems.length} problem(s)`);
    for (const problem of problems.slice(0, 20)) console.error(`  ✗ ${problem}`);
    process.exit(1);
  }
  if (checkOnly) console.log(`stamp-profile-access-loader: every loader imports ${ASSET_PREFIX}${chunk.name}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
