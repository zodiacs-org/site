import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const directory = resolve(root, 'dist');
const rows = readdirSync(directory, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(?:m?js|cjs|css|wasm)$/u.test(entry.name))
  .map((entry) => resolve(entry.parentPath, entry.name));
rows.push(
  resolve(root, 'integrations/generated/chart-studio.mjs'),
  resolve(root, 'integrations/generated/horoscopes.mjs'),
  resolve(root, 'integrations/generated/occasions.mjs'),
  resolve(root, 'integrations/generated/readings.mjs'),
  resolve(root, 'integrations/generated/readings-sky-events.mjs'),
);
const sizes = rows.map((path) => {
  const data = readFileSync(path);
  const name = relative(root, path);
  return [name, data.length, gzipSync(data).length];
}).sort((a, b) => a[0].localeCompare(b[0]));
console.log('Path\tBytes\tGzip bytes');
for (const row of sizes) console.log(row.join('\t'));
