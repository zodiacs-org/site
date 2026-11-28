/*
 * Emits the public sky data API into dist/api/v1/ — JSON payloads, JSON
 * Schemas, the OpenAPI document, the agent guide, and the Markdown twins.
 * Runs through vite-node after `astro build` so it can share the site's own
 * sign table and formatting helpers. Everything is a reshaping of committed
 * src/data sources; nothing here computes astronomy.
 *
 * Writes into dist only: no committed output, so no drift gate. index.json is
 * the deploy contract; check-dist walks every endpoint and document it lists
 * and fails the build if one is missing.
 */
import '../src/lib/engine/server-de440.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSkyApiSources } from '../src/lib/sky-api/sources.ts';
import { buildSkyApi } from '../src/lib/sky-api/files.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function writeSkyApi({
  root = repo,
  outputRoot = resolve(repo, 'dist'),
  generatedAt = new Date().toISOString(),
} = {}) {
  const sources = await loadSkyApiSources(root);
  const build = buildSkyApi(sources, { generatedAt });
  for (const [relPath, content] of build.files) {
    const target = resolve(outputRoot, 'api/v1', relPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  return build;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const build = await writeSkyApi();
  console.log(
    `sky-api: dist/api/v1 · ${build.files.size} files · years ${build.transitYears.at(0)}–${build.transitYears.at(-1)}`
    + ` · eclipses through ${build.eclipseYears.at(-1)}`,
  );
}
