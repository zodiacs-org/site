/*
 * Bundles the draft WebMCP modules to stable URLs. Base.astro feature-detects
 * the browser API before importing the registration module, so these files
 * remain outside every initial Astro module closure.
 *
 * - webmcp-register.js: the tools' descriptors and Search (under 8 KB gzip).
 * - webmcp-calculators.js: the calculations behind the calculator pages'
 *   tools, with the engine they share with the pages. Only a call to a
 *   calculator tool loads it.
 */
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundles = [
  {
    entry: 'src/lib/webmcp/register.ts',
    outfile: 'dist/assets/webmcp-register.js',
    maxGzipBytes: 8 * 1024,
  },
  {
    entry: 'src/lib/webmcp/calculator-runtime.ts',
    outfile: 'dist/assets/webmcp-calculators.js',
    maxGzipBytes: 512 * 1024,
  },
];

for (const { entry, outfile, maxGzipBytes } of bundles) {
  await build({
    entryPoints: [resolve(repo, entry)],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    // The registration module imports the calculations by URL, at run time.
    external: ['/assets/*'],
    outfile: resolve(repo, outfile),
  });
  const bytes = await readFile(resolve(repo, outfile));
  const gzipBytes = gzipSync(bytes, { level: 9 }).byteLength;
  const name = outfile.split('/').at(-1);
  if (gzipBytes >= maxGzipBytes) {
    throw new Error(`${name} is ${(gzipBytes / 1024).toFixed(1)} KB gzip; limit is under ${maxGzipBytes / 1024} KB`);
  }
  console.log(`webmcp: ${outfile} · ${(bytes.byteLength / 1024).toFixed(1)} KB raw · ${(gzipBytes / 1024).toFixed(1)} KB gzip`);
}
