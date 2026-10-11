/**
 * Whether each public entry point of the 1.0.0 archive loads the same code as
 * 1.0.0-rc.2's. For every `dist/*.js` entry named in the package exports, it
 * follows the static relative imports to the entry's file closure in both
 * archives, pairs the files by their place in the graph, and compares their
 * bytes after replacing each archive's quoted version literal and its hashed
 * chunk names with placeholders. Reads both archives in memory; extracts nothing.
 *
 *   node docs/platform/evidence/site-engine-1-0-0/tools/compare-entry-graphs.mjs \
 *     vendor/zodiacs-engine-1.0.0-rc.2.tgz vendor/zodiacs-engine-1.0.0.tgz
 */
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { readPackageArchive } from '../../../../../scripts/verify-platform-starter.mjs';

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) throw new Error('usage: compare-entry-graphs.mjs <before.tgz> <after.tgz>');
const load = (path) => {
  const files = readPackageArchive(readFileSync(path));
  const manifest = JSON.parse(files.get('package.json').toString('utf8'));
  return { files, manifest };
};
const before = load(beforePath);
const after = load(afterPath);

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.\/[^"']+\.js)["']/gu;
function closure(files, entry) {
  const order = [];
  const seen = new Set();
  const visit = (path) => {
    if (seen.has(path)) return;
    seen.add(path);
    const bytes = files.get(path);
    if (!bytes) throw new Error(`missing ${path}`);
    order.push(path);
    for (const match of bytes.toString('utf8').matchAll(IMPORT)) visit(posix.join(posix.dirname(path), match[1]));
  };
  visit(entry);
  return order;
}
const chunkNames = (files) => [...files.keys()].filter((path) => /^dist\/chunk-[A-Z0-9]+\.js$/u.test(path)).map((path) => posix.basename(path, '.js'));
// Only the quoted version literal is replaced: 1.0.0's own messages also say
// "lowercase since 1.0.0." in both archives, which is code, not the version.
function normalise(text, version, chunks) {
  let out = text.replaceAll(`"${version}"`, '"<version>"');
  for (const name of chunks) out = out.replaceAll(name, '<chunk>');
  return out;
}

const entries = Object.entries(after.manifest.exports)
  .map(([key, value]) => [key, typeof value === 'string' ? value : value.import ?? value.default])
  .filter(([, target]) => typeof target === 'string' && target.endsWith('.js'))
  .map(([key, target]) => [key, target.replace(/^\.\//u, '')]);
const beforeChunks = chunkNames(before.files);
const afterChunks = chunkNames(after.files);
const lines = [];
let allSame = true;
for (const [key, target] of entries) {
  const b = closure(before.files, target);
  const a = closure(after.files, target);
  const bytes = (files, list) => list.reduce((sum, path) => sum + files.get(path).length, 0);
  const same = a.length === b.length && a.every((path, index) =>
    normalise(after.files.get(path).toString('utf8'), after.manifest.version, afterChunks)
      === normalise(before.files.get(b[index]).toString('utf8'), before.manifest.version, beforeChunks));
  const renamed = a.filter((path, index) => path !== b[index]).length;
  allSame &&= same;
  lines.push(`${key} (${target}): ${same ? 'same code' : 'DIFFERS'} (${b.length} files, ${bytes(before.files, b)} bytes; ${a.length} files, ${bytes(after.files, a)} bytes; ${renamed} renamed)`);
}
console.log(`${before.manifest.version} -> ${after.manifest.version}: each entry's static import closure, compared file by file in graph order after replacing the quoted version literal and hashed chunk names.`);
for (const line of lines) console.log(line);
console.log(allSame ? 'Every entry point loads the same code apart from the version string and chunk names.' : 'At least one entry point loads different code.');
if (!allSame) process.exitCode = 1;
