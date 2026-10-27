/**
 * Whether each public entry point of the 1.1.0-rc.1 archive loads the same code
 * as 1.0.0's. For every `dist/*.js` entry named in the package exports, it
 * follows the static relative imports to the entry's file closure in both
 * archives and compares the closures' files after replacing each archive's
 * quoted version literal and its hashed chunk names with placeholders, and
 * each file's import statements with the sorted names they bind: as a set, so
 * that chunks the bundler reordered still pair. An entry the earlier
 * archive lacks is reported as new, and a differing entry with the files that
 * differ. Reads both archives in memory; extracts nothing. 1.0.0's tool
 * (site-engine-1-0-0/tools/), with those changes.
 *
 *   node docs/platform/evidence/site-engine-1-1-0-rc1/tools/compare-entry-graphs.mjs \
 *     vendor/zodiacs-engine-1.0.0.tgz vendor/zodiacs-engine-1.1.0-rc.1.tgz
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
// The bundler orders a file's imports by chunk name, which the hash decides, so
// the import statements are taken out and compared as the sorted names they bind.
const IMPORT_STATEMENT = /^import\s*(?:\{[^}]*\}\s*from\s*)?["']\.\/[^"']+\.js["'];\n?/gmu;
function normalise(text, version, chunks) {
  let out = text.replaceAll(`"${version}"`, '"<version>"');
  for (const name of chunks) out = out.replaceAll(name, '<chunk>');
  const bound = [];
  out = out.replace(IMPORT_STATEMENT, (statement) => {
    bound.push(...(/\{([^}]*)\}/u.exec(statement)?.[1].split(',').map((name) => name.trim()).filter(Boolean) ?? []));
    return '';
  });
  return `${bound.sort().join(', ')}\n${out}`;
}

const entries = Object.entries(after.manifest.exports)
  .map(([key, value]) => [key, typeof value === 'string' ? value : value.import ?? value.default])
  .filter(([, target]) => typeof target === 'string' && target.endsWith('.js'))
  .map(([key, target]) => [key, target.replace(/^\.\//u, '')]);
const beforeChunks = chunkNames(before.files);
const afterChunks = chunkNames(after.files);
const lines = [];
const differing = [];
const added = [];
const bytes = (files, list) => list.reduce((sum, path) => sum + files.get(path).length, 0);
for (const [key, target] of entries) {
  const a = closure(after.files, target);
  if (!before.files.has(target)) {
    added.push(key);
    lines.push(`${key} (${target}): new entry (${a.length} files, ${bytes(after.files, a)} bytes: ${a.join(', ')})`);
    continue;
  }
  const b = closure(before.files, target);
  const text = (files, path, version, chunks) => normalise(files.get(path).toString('utf8'), version, chunks);
  const beforeTexts = new Map(b.map((path) => [text(before.files, path, before.manifest.version, beforeChunks), path]));
  const afterTexts = new Map(a.map((path) => [text(after.files, path, after.manifest.version, afterChunks), path]));
  const onlyAfter = [...afterTexts].filter(([code]) => !beforeTexts.has(code)).map(([, path]) => path);
  const onlyBefore = [...beforeTexts].filter(([code]) => !afterTexts.has(code)).map(([, path]) => path);
  const same = onlyAfter.length === 0 && onlyBefore.length === 0;
  const reordered = !same || a.some((path, index) => afterTexts.get(text(after.files, path, after.manifest.version, afterChunks)) !== a[index])
    ? '' : a.map((path) => text(after.files, path, after.manifest.version, afterChunks)).some((code, index) => code !== text(before.files, b[index], before.manifest.version, beforeChunks)) ? ', chunks reordered' : '';
  if (!same) differing.push(key);
  const renamed = a.filter((path) => !b.includes(path)).length;
  lines.push(`${key} (${target}): ${same ? 'same code' : `DIFFERS: ${b.length - onlyBefore.length} files the same, changed or new ${onlyAfter.join(', ')}, changed or gone ${onlyBefore.join(', ') || 'none'}`} (${b.length} files, ${bytes(before.files, b)} bytes; ${a.length} files, ${bytes(after.files, a)} bytes; ${renamed} renamed${reordered})`);
}
console.log(`${before.manifest.version} -> ${after.manifest.version}: each entry's static import closure, its files compared as a set after replacing the quoted version literal and hashed chunk names, imports compared by the names they bind.`);
for (const line of lines) console.log(line);
console.log(`${entries.length - added.length - differing.length} of ${entries.length} entry points load the same code apart from the version string, chunk names and chunk order; ${differing.length ? `${differing.join(', ')} load${differing.length === 1 ? 's' : ''} different code` : 'none loads different code'}; new: ${added.join(', ') || 'none'}.`);
