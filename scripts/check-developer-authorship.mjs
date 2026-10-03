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

// Preserve the source guard's case-sensitive persona and anchor constructs.
// Keep the #editorial exception; Organization markup is valid.
const forbidden = [
  ['retired persona', /Rowan Vale/],
  ['retired editor anchor', /about\/#editor([^i]|$)/m],
];

// Inspect ordinary JSON-LD type values, including arrays and expanded schema IRIs.
// This is intentionally a type-value check, not a general JSON-LD processor.
function findPersonType(content) {
  for (const match of content.matchAll(/"@type"\s*:\s*("(?:\\.|[^"\\])*"|\[[^\]]*\])/g)) {
    try {
      const value = JSON.parse(match[1]);
      const types = Array.isArray(value) ? value : [value];
      if (types.some((type) => typeof type === 'string'
        && /^(?:https?:\/\/schema\.org\/)?Person$/.test(type))) return match;
    } catch {
      // Not an ordinary valid JSON type value.
    }
  }
  return null;
}

function findPersonMicrodata(content) {
  for (const match of content.matchAll(/\bitemtype\s*=\s*(["'])([\s\S]*?)\1/gi)) {
    if (match[2].split(/\s+/).some((type) => /^https?:\/\/schema\.org\/Person$/.test(type))) return match;
  }
  return null;
}

export async function checkDeveloperAuthorship(root) {
  const files = new Set();
  const errors = [];
  async function directory(path) {
    try {
      if ((await lstat(resolve(root, path))).isDirectory()) return true;
    } catch { /* Missing output is a gate failure too. */ }
    errors.push(`${path || '.'}: missing or non-regular documentation directory`);
    return false;
  }
  if (!await directory('')) return { files: [], errors };

  async function walk(path) {
    if (!await directory(path)) return;
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
  for (const tree of trees) {
    // Check intermediate directories too: api must not redirect api/v1 elsewhere.
    const parts = tree.split('/');
    let safe = true;
    for (let i = 1; i < parts.length; i++) {
      if (!await directory(parts.slice(0, i).join('/'))) { safe = false; break; }
    }
    if (safe) await walk(tree);
  }
  for (const path of ['llms.txt', 'llms-full.txt']) {
    try {
      if ((await lstat(resolve(root, path))).isFile()) files.add(path);
    } catch { /* The required-output check below reports this. */ }
  }
  for (const path of requiredDocuments) {
    if (!files.has(path) || (await lstat(resolve(root, path))).size === 0) {
      errors.push(`${path}: missing or empty required documentation output`);
    }
  }
  for (const path of [...files].sort()) {
    let content;
    try {
      content = await readFile(resolve(root, path), 'utf8');
    } catch {
      errors.push(`${path}: cannot read documentation output`);
      continue;
    }
    const matches = forbidden.map(([label, pattern]) => [label, pattern.exec(content)]);
    matches.push(['Person markup', findPersonType(content) ?? findPersonMicrodata(content)]);
    for (const [label, match] of matches) {
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
