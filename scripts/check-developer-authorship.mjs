import { lstat, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Served documentation only: never walk repository docs/evidence or archives.
// /developers/ and both llms files link the SDK and the static sky API,
// including OpenAPI, schemas, self-describing JSON and Markdown twins;
// /widgets/ gives embed code, and /examples/ holds the MCP manifests and notices.
// Every regular file in these trees is read, whatever its extension; a file with a
// NUL byte in its first 8 KiB is binary (an image, a font, an archive) and skipped.
const trees = ['developers', 'sdk', 'api/v1', 'widgets', 'examples'];
const rootDocuments = ['llms.txt', 'llms-full.txt', 'assets/README.md'];
const developerGuides = JSON.parse(await readFile(
  new URL('../src/data/developer-guides.json', import.meta.url), 'utf8',
));
if (!Array.isArray(developerGuides)
  || developerGuides.some((guide) => !/^[a-z][a-z0-9-]*$/.test(guide.slug))
  || new Set(developerGuides.map((guide) => guide.slug)).size !== developerGuides.length) {
  throw new Error('Invalid developer guide catalogue');
}
export const generatedDeveloperDocuments = Object.freeze({
  'docs/[...guide].astro': [
    'developers/docs/index.html',
    ...developerGuides.map((guide) => `developers/docs/${guide.slug}/index.html`),
  ],
  'docs/[guide].md.ts': [
    'developers/docs/index.md',
    ...developerGuides.map((guide) => `developers/docs/${guide.slug}.md`),
  ],
});

export const requiredDocuments = [
  ...Object.values(generatedDeveloperDocuments).flat(),
  ...['', 'ai/', 'compare/', 'compute/', 'conformance/', 'engine/', 'examples/',
    'mcp/', 'precision-preview/', 'sky-benchmark/', 'support/'].map((route) => `developers/${route}index.html`),
  'developers/engine/reference/index.html', 'developers/engine/reference/modules.html',
  'developers/engine/reference/provenance.json',
  'developers/engine/reference/release/LICENSE.txt',
  'developers/engine/reference/release/LICENSING.txt',
  'developers/engine/reference/release/NOTICE.txt',
  'developers/engine/reference/release/README.txt',
  'sdk/index.html', 'sdk/examples/simastry-aura/index.html',
  'sdk/engine/index.html', 'sdk/engine/modules.html',
  'llms.txt', 'llms-full.txt', 'api/v1/llms.txt', 'api/v1/index.json',
  'api/v1/openapi.json', 'api/v1/sky/today.md', 'api/v1/sky/upcoming.md',
  'widgets/index.html', 'examples/mcp-server.json',
];

// These detectors look for accidental reintroduction of the retired authorship
// signals in text a person or an agent reads. They are pattern scanners, not
// HTML, JSON-LD or JavaScript parsers. A repeat that could otherwise run on
// without a match is bounded (the persona's gaps, the about page's query, a type
// array) or stops at a delimiter (a bracket, a quote, the end of a line), so
// repeated starts do not make a scan quadratic.

// The persona in any letter case: its two words apart by up to sixteen gaps a
// page can render as one (white space, as generated pages wrap prose between
// words; a non-breaking, zero-width or soft-hyphen character; an HTML entity; a
// JSON or JavaScript escape; an inline tag), or joined by nothing, a hyphen, an
// underscore or a dot, as a slug, a file name, an address or a handle writes
// them; or inverted, "Vale, Rowan", as a citation writes them.
const GAP = String.raw`(?:\s|[\u00ad\u200b-\u200d\u2060]|&(?:[a-z]{2,8}|#\d{1,7}|#x[0-9a-f]{1,6});|\\(?:u[0-9a-f]{4}|x[0-9a-f]{2}|[nrt])|<[^<>\n]{0,200}>)`;
const PERSONA = new RegExp(String.raw`Rowan(?:${GAP}|[-_.]){0,16}Vale|Vale${GAP}{0,16},${GAP}{0,16}Rowan`, 'gi');

// The editor anchor however the about page and its fragment are written: a
// trailing slash or index.html, ./ segments, JSON-escaped slashes, a query of up
// to 512 characters, a # written as an entity, and a percent-encoded fragment.
// /about#editor redirects to /about/#editor with its fragment; #editorial is the
// current anchor and stays allowed.
const ABOUT_FRAGMENT = /about(?:\\?\/(?:\.\\?\/){0,8}(?:index\.html)?)?(?:\?[^#\s"'<>]{0,512})?(?:#|&#0*35;|&#[xX]0*23;|&num;)([^\s"'<>#]{0,64})/g;

function firstMatch(pattern, content) {
  pattern.lastIndex = 0;
  return pattern.exec(content);
}

export function findPersona(content) {
  return firstMatch(PERSONA, content);
}

export function findEditorAnchor(content) {
  for (const match of content.matchAll(ABOUT_FRAGMENT)) {
    let fragment = match[1];
    try { fragment = decodeURIComponent(fragment); } catch { /* keep it as written */ }
    if (/^editor(?!i)/.test(fragment)) return match;
  }
  return null;
}

/** The text checks both guards run, each reporting its first match. */
export const textChecks = [
  ['retired persona', findPersona],
  ['retired editor anchor', findEditorAnchor],
];

const PERSON = /^(?:(?:https?:\/\/schema\.org\/)|schema:)?Person$/;
const quoted = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
// A quoted value as JSON or JavaScript reads it: "\u0050erson" is Person. An
// escape beyond U+10FFFF is not a character and is left as written.
const unescape = (text) => text
  .replace(/\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})/g, (whole, braced, four) => {
    const code = parseInt(braced ?? four, 16);
    return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  })
  .replace(/\\(.)/g, '$1');

// Ordinary JSON-LD type values, including arrays and expanded schema IRIs: the
// key quoted or bare, escaped as "\u0040type" or computed as ['@type'], followed
// by : or =, and a quoted value or an array of up to 4,096 characters that holds
// no other bracket. A type-value check, not a JSON-LD processor.
const TYPE_PATTERN = new RegExp(String.raw`(?:(["'\x60]?)(?:@|\\u0040)type\1|\[\s*(["'\x60])(?:@|\\u0040)type\2\s*\])\s*[:=]\s*((["'\x60])(?:\\.|(?!\4)[^\\\n])*\4|\[[^\][]{0,4096}\])`, 'g');

export function findPersonTypes(content) {
  const found = [];
  for (const match of content.matchAll(TYPE_PATTERN)) {
    const values = match[3].startsWith('[')
      ? [...match[3].matchAll(quoted)].map((item) => item[2])
      : [match[3].slice(1, -1)];
    if (values.some((type) => PERSON.test(unescape(type)))) found.push(match);
  }
  return found;
}

// Microdata itemtype and RDFa typeof, quoted either way or bare.
const TYPE_ATTRIBUTE = /\b(?:itemtype|typeof)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;

export function findPersonAttribute(content) {
  for (const match of content.matchAll(TYPE_ATTRIBUTE)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value.split(/\s+/).some((type) => PERSON.test(type))) return match;
  }
  return null;
}

/** Whether these bytes are text: no NUL byte in the first 8 KiB. */
export function isText(bytes) {
  return !bytes.subarray(0, 8192).includes(0);
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
      else if (entry.isFile()) files.add(child);
      else errors.push(`${child}: unexpected non-regular documentation entry`);
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
  for (const path of rootDocuments) {
    let info;
    try {
      info = await lstat(resolve(root, path));
    } catch { continue; /* The required-output check below reports a required one. */ }
    if (info.isFile()) files.add(path);
    else errors.push(`${path}: unexpected ${info.isSymbolicLink() ? 'documentation symlink' : 'non-regular documentation entry'}`);
  }
  for (const path of requiredDocuments) {
    if (!files.has(path) || (await lstat(resolve(root, path))).size === 0) {
      errors.push(`${path}: missing or empty required documentation output`);
    }
  }
  const scanned = [];
  for (const path of [...files].sort()) {
    let bytes;
    try {
      bytes = await readFile(resolve(root, path));
    } catch {
      errors.push(`${path}: cannot read documentation output`);
      continue;
    }
    if (!isText(bytes)) continue;
    scanned.push(path);
    const content = bytes.toString('utf8');
    const matches = textChecks.map(([label, find]) => [label, find(content)]);
    matches.push(['Person markup', findPersonTypes(content)[0] ?? findPersonAttribute(content)]);
    for (const [label, match] of matches) {
      if (match) {
        const line = content.slice(0, match.index).split('\n').length;
        errors.push(`${path}:${line}: ${label}`);
      }
    }
  }
  return { files: scanned, errors };
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
