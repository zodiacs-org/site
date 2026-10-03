import { lstat, readdir, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Served documentation only: never walk repository docs/evidence or archives.
// /developers/ and both llms files link the SDK and the static sky API,
// including OpenAPI, schemas, self-describing JSON and Markdown twins.
const trees = ['developers', 'sdk', 'api/v1'];
const documentExtensions = new Set(['.html', '.md', '.txt', '.json']);
export const requiredDocuments = [
  ...['', 'compare/', 'compute/', 'conformance/', 'engine/', 'examples/',
    'mcp/', 'precision-preview/', 'support/'].map((route) => `developers/${route}index.html`),
  'sdk/index.html', 'sdk/examples/simastry-aura/index.html',
  'sdk/engine/index.html', 'sdk/engine/modules.html',
  'llms.txt', 'llms-full.txt', 'api/v1/llms.txt', 'api/v1/index.json',
  'api/v1/openapi.json', 'api/v1/sky/today.md', 'api/v1/sky/upcoming.md',
];

// Same case-sensitive constructs as Site Check's existing src grep.
// Keep the #editorial exception; Organization markup is valid.
const forbidden = [
  ['retired persona', /Rowan Vale/],
  ['retired editor anchor', /about\/#editor([^i]|$)/m],
  ['Person markup', /"@type"\s*:\s*"Person"/],
];

export async function checkDeveloperAuthorship(root) {
  const files = new Set(['llms.txt', 'llms-full.txt']);
  const errors = [];
  for (const path of requiredDocuments) {
    try {
      const stat = await lstat(resolve(root, path));
      if (!stat.isFile() || stat.size === 0) throw new Error('not a nonempty regular file');
    } catch {
      errors.push(`${path}: missing or empty required documentation output`);
    }
  }
  async function walk(path) {
    let entries;
    try {
      entries = await readdir(resolve(root, path), { withFileTypes: true });
    } catch {
      errors.push(`${path}: cannot read documentation directory`);
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) errors.push(`${child}: unexpected documentation symlink`);
      else if (entry.isDirectory()) await walk(child);
      else if (entry.isFile() && documentExtensions.has(extname(entry.name))) files.add(child);
    }
  }
  for (const tree of trees) await walk(tree);
  for (const path of [...files].sort()) {
    let content;
    try {
      content = await readFile(resolve(root, path), 'utf8');
    } catch {
      errors.push(`${path}: cannot read documentation output`);
      continue;
    }
    for (const [label, pattern] of forbidden) {
      const match = pattern.exec(content);
      if (match) {
        const line = content.slice(0, match.index).split('\n').length;
        errors.push(`${path}:${line}: ${label}`);
      }
    }
  }
  return { files: [...files].sort(), errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? fileURLToPath(new URL('../dist', import.meta.url)));
  const { files, errors } = await checkDeveloperAuthorship(root);
  if (errors.length) {
    console.error(`Developer authorship: FAIL\n${errors.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Developer authorship: PASS (${files.length} documentation files in ${root})`);
  }
}
