import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

function pages(root) {
  return new Map(readdirSync(root, { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
    .map(entry => resolve(entry.parentPath, entry.name))
    .map(path => [relative(root, path), statSync(path).size]));
}

const beforeRoot = resolve(process.argv[2]);
const afterRoot = resolve(process.argv[3]);
const before = pages(beforeRoot);
const after = pages(afterRoot);
const matched = [...after].filter(([path]) => before.has(path));
const changes = matched.map(([path, bytesAfter]) => {
  const bytesBefore = before.get(path);
  return { path, bytesBefore, bytesAfter, difference: bytesAfter - bytesBefore };
}).sort((a, b) => b.difference - a.difference);
const top = changes.slice(0, 10).map(change => ({
  ...change,
  gzipBefore: gzipSync(readFileSync(resolve(beforeRoot, change.path))).length,
  gzipAfter: gzipSync(readFileSync(resolve(afterRoot, change.path))).length,
}));
console.log(JSON.stringify({ before: before.size, after: after.size, matched: matched.length, largestIncreases: top }, null, 2));
