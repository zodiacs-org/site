/*
 * Reports and, with --fail, enforces gzip budgets for the built site's
 * route-level JavaScript closures. Run after `npm run build`:
 *
 *   node scripts/report-bundles.mjs
 *   node scripts/report-bundles.mjs --fail
 *
 * A route closure starts with module/preload and Astro-island references in
 * its built HTML, then follows static ESM imports recursively. Dynamic imports
 * intentionally stay outside the initial closure (notably engine/full.ts).
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(repo, 'dist');
const chunkDir = resolve(dist, '_astro');
const enforce = process.argv.includes('--fail');
const failures = [];
const fail = (message) => failures.push(message);

function kb(bytes) {
  return (bytes / 1024).toFixed(1);
}

function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i'))
    ?.slice(1)
    .find((value) => value !== undefined) ?? null;
}

async function walk(dir, accept) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path, accept));
    else if (accept(path)) out.push(path);
  }
  return out;
}

function publicPath(path) {
  return `/${relative(dist, path).split(sep).join('/')}`;
}

function localJsPath(specifier, basePath) {
  let url;
  try {
    url = new URL(specifier, `https://zodiacs.org${basePath}`);
  } catch {
    return null;
  }
  if (url.origin !== 'https://zodiacs.org' || !url.pathname.endsWith('.js')) return null;
  return url.pathname;
}

// Built Vite chunks put each static import/export at the start of the file or
// immediately after a semicolon. The negative parenthesis class excludes
// import(), including Vite's lazy dependency maps.
function staticImportSpecifiers(source) {
  const found = [];
  const patterns = [
    /(?:^|[;\n])\s*import\s*(?!\s*\()(?:(?:[^"'();]*?)\bfrom\s*)?["']([^"']+)["']/gm,
    /(?:^|[;\n])\s*export(?:[^"'();]*?)\bfrom\s*["']([^"']+)["']/gm,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

// Erased types do not load the engine. Window runtime loading belongs to full.ts.
function runtimeWindowImport(source, fileName) {
  const frontmatter=fileName.endsWith('.astro')?/^---\r?\n([\s\S]*?)\r?\n---/.exec(source):null;
  const tree=ts.createSourceFile(fileName,frontmatter?frontmatter[1]:source,ts.ScriptTarget.Latest,false,fileName.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  let found=false;
  const target=node=>node&&ts.isStringLiteralLike(node)&&node.text==='@zodiacs/engine/window';
  const visit=node=>{
    if(ts.isImportDeclaration(node)&&target(node.moduleSpecifier)){
      const clause=node.importClause,named=clause?.namedBindings;
      const onlyTypes=clause?.isTypeOnly||(!clause?.name&&named&&ts.isNamedImports(named)&&named.elements.length>0&&named.elements.every(item=>item.isTypeOnly));
      if(!onlyTypes)found=true;
    }else if(ts.isExportDeclaration(node)&&target(node.moduleSpecifier)){
      const onlyTypes=node.isTypeOnly||(node.exportClause&&ts.isNamedExports(node.exportClause)&&node.exportClause.elements.length>0&&node.exportClause.elements.every(item=>item.isTypeOnly));
      if(!onlyTypes)found=true;
    }else if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&target(node.arguments[0]))found=true;
    ts.forEachChild(node,visit);
  };
  visit(tree);return found;
}

// Built JavaScript needs syntax-aware closure discovery: side-effect imports
// may contain whitespace/comments and shared engine modules may be re-exported.
function staticJavaScriptImports(source) {
  const tree = ts.createSourceFile('chunk.js', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  return tree.statements.flatMap((node) =>
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)
      ? [node.moduleSpecifier.text] : []);
}

function htmlModuleRoots(html, route) {
  const roots = new Set();
  const add = (specifier) => {
    const path = specifier && localJsPath(specifier, route);
    if (path) roots.add(path);
  };

  for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
    const tag = match[0];
    if ((attr(tag, 'type') ?? '').toLowerCase() === 'module') add(attr(tag, 'src'));
  }

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rels = (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
    const isModulePreload = rels.includes('modulepreload');
    const isScriptPreload = rels.includes('preload') && (attr(tag, 'as') ?? '').toLowerCase() === 'script';
    if (isModulePreload || isScriptPreload) add(attr(tag, 'href'));
  }

  // Astro islands load these two module entrypoints from the inline hydration
  // runtime, so they are initial route roots even though they are attributes.
  for (const match of html.matchAll(/<astro-island\b[^>]*>/gi)) {
    add(attr(match[0], 'component-url'));
    add(attr(match[0], 'renderer-url'));
  }

  // Keep hand-authored inline modules measurable too.
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const tag = `<script${match[1]}>`;
    if ((attr(tag, 'type') ?? '').toLowerCase() !== 'module') continue;
    for (const specifier of staticJavaScriptImports(match[2])) add(specifier);
  }

  return roots;
}

function routeHtmlPath(route) {
  const url = new URL(route, 'https://zodiacs.org');
  if (url.origin !== 'https://zodiacs.org' || !url.pathname.startsWith('/')) {
    throw new Error(`invalid budget route: ${route}`);
  }
  if (url.pathname === '/') return resolve(dist, 'index.html');
  const path = resolve(dist, url.pathname.replace(/^\//, ''));
  if (!path.startsWith(dist)) throw new Error(`budget route escapes dist: ${route}`);
  return url.pathname.endsWith('/') ? resolve(path, 'index.html') : path;
}

let budgets;
try {
  budgets = JSON.parse(await readFile(resolve(repo, 'budgets.json'), 'utf8'));
} catch (error) {
  console.error(`report-bundles: cannot read budgets.json (${error.message})`);
  process.exit(1);
}

const routeBudgets = Object.entries(budgets).filter(([key]) => key.startsWith('/'));
for (const [key, value] of Object.entries(budgets)) {
  if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
    fail(`budgets.json: ${key} must be a finite, non-negative number`);
  }
}
for (const required of ['/', '/birth-chart/', '/registry/collection/', '/aries/', 'chunk-max', 'engine-chunk']) {
  if (!(required in budgets)) fail(`budgets.json: missing ${required}`);
}

let chunkFiles;
try {
  chunkFiles = await walk(chunkDir, (path) => extname(path) === '.js');
} catch {
  console.error('report-bundles: no dist/_astro directory; run `npm run build` first.');
  process.exit(enforce ? 1 : 0);
}

const chunks = new Map();
for (const path of chunkFiles) {
  const source = await readFile(path, 'utf8');
  chunks.set(publicPath(path), {
    source,
    gzip: gzipSync(source, { level: 9 }).length,
  });
}

function routeClosure(roots, route) {
  const closure = new Set();
  const visit = (path, importer = route) => {
    if (closure.has(path)) return;
    const chunk = chunks.get(path);
    if (!chunk) {
      fail(`${route}: ${importer} references missing local chunk ${path}`);
      return;
    }
    closure.add(path);
    for (const specifier of staticJavaScriptImports(chunk.source)) {
      const dependency = localJsPath(specifier, path);
      if (dependency) visit(dependency, path);
    }
  };
  for (const root of roots) visit(root);
  return closure;
}

const routeRows = [];
for (const [route, limit] of routeBudgets) {
  let html;
  try {
    html = await readFile(routeHtmlPath(route), 'utf8');
  } catch {
    fail(`${route}: built HTML not found`);
    routeRows.push({ route, limit, gzip: 0, closure: new Set() });
    continue;
  }
  const closure = routeClosure(htmlModuleRoots(html, route), route);
  const gzip = [...closure].reduce((sum, path) => sum + chunks.get(path).gzip, 0);
  routeRows.push({ route, limit, gzip, closure });
  if (gzip > limit * 1024) {
    fail(`${route}: ${kb(gzip)} KB gz exceeds ${limit} KB`);
  }
}

const chunkRows = [...chunks.entries()]
  .map(([path, data]) => ({ ...data, path }))
  .sort((a, b) => b.gzip - a.gzip);
const largestChunk = chunkRows[0];
if (largestChunk && largestChunk.gzip > budgets['chunk-max'] * 1024) {
  fail(`chunk-max: ${largestChunk.path} is ${kb(largestChunk.gzip)} KB gz (limit ${budgets['chunk-max']} KB)`);
}

const engineChunks = chunkRows.filter(({ path }) => /\/_astro\/full\.[^/]+\.js$/.test(path));
const engineChunk = engineChunks[0];
const engineClosure = engineChunk ? routeClosure([engineChunk.path], "engine-chunk") : new Set();
const engineGzip = [...engineClosure].reduce((sum, path) => sum + chunks.get(path).gzip, 0);
if (engineChunks.length !== 1) {
  fail(`engine-chunk: expected one full.*.js chunk, found ${engineChunks.length}`);
} else if (engineGzip > budgets['engine-chunk'] * 1024) {
  fail(`engine-chunk: ${engineChunk.path} is ${kb(engineGzip)} KB gz (static closure) (limit ${budgets['engine-chunk']} KB)`);
}

// Browser production source must consume the vendored engine package and keep
// its ephemeris behind one local dynamic-import boundary. The one exact
// server-only adapter may select astronomy-engine's CommonJS export because
// Vercel externalizes that dual-mode dependency. Tests may also import it
// directly to construct independent reference vectors.
const sourceFiles = await walk(resolve(repo, 'src'), (path) =>
  ['.astro', '.js', '.mjs', '.ts', '.tsx'].includes(extname(path))
  && !/\.(?:test|spec)\.[^.]+$/.test(path));
const directVendorImporters = [];
const engineInternalImporters = [];
const engineMathImporters = [];
const windowRuntimeImporters = [];
for (const path of sourceFiles) {
  const source = await readFile(path, 'utf8');
  const specifiers = staticImportSpecifiers(source);
  const relativePath = relative(repo, path).split(sep).join('/');
  const hasVendorImport = specifiers.includes('astronomy-engine')
    || /\brequire\(\s*["']astronomy-engine["']\s*\)/.test(source);
  if (hasVendorImport) directVendorImporters.push(relativePath);
  if (specifiers.includes('@zodiacs/engine/internal')) engineInternalImporters.push(relativePath);
  if (specifiers.includes('@zodiacs/engine/internal/math')) engineMathImporters.push(relativePath);
  if(runtimeWindowImport(source,relativePath))windowRuntimeImporters.push(relativePath);
}
const allowedDirectVendorImporters = ['src/lib/engine/server-ephemeris.ts'];
directVendorImporters.sort();
if (
  directVendorImporters.length !== allowedDirectVendorImporters.length
  || directVendorImporters.some((path, index) => path !== allowedDirectVendorImporters[index])
) {
  fail(`engine source isolation: expected only ${allowedDirectVendorImporters.join(', ')} to import astronomy-engine directly; found ${directVendorImporters.join(', ') || 'none'}`);
}
const allowedEngineImporter = 'src/lib/engine/full.ts';
if (engineInternalImporters.length !== 1 || engineInternalImporters[0] !== allowedEngineImporter) {
  fail(`engine source isolation: expected only ${allowedEngineImporter} to import @zodiacs/engine/internal; found ${engineInternalImporters.join(', ') || 'none'}`);
}
if(windowRuntimeImporters.some(path=>path!==allowedEngineImporter)){
  fail(`engine source isolation: window runtime must use ${allowedEngineImporter}; found ${windowRuntimeImporters.join(', ')}`);
}
const allowedMathImporters = [
  'src/lib/engine/aspects.ts',
  'src/lib/engine/houses.ts',
  'src/lib/engine/types.ts',
];
engineMathImporters.sort();
if (
  engineMathImporters.length !== allowedMathImporters.length
  || engineMathImporters.some((path, index) => path !== allowedMathImporters[index])
) {
  fail(`engine math isolation: expected ${allowedMathImporters.join(', ')}; found ${engineMathImporters.join(', ') || 'none'}`);
}

const homepage = routeRows.find(({ route }) => route === '/');
const registryAura = routeRows.find(({ route }) => route === '/registry/collection/');
const engineMarkers = ['Value is not boolean:', 'Light-travel time solver did not converge'];
const homepageMarkerChunks = homepage
  ? [...homepage.closure].filter((path) => engineMarkers.some((marker) => chunks.get(path).source.includes(marker)))
  : [];
// The receipt's inert ephemeris name is data, not a browser dependency. Parse
// actual module-loading syntax so comments/strings cannot impersonate imports.
function hasExternalEphemerisImport(source) {
  const tree = ts.createSourceFile('chunk.js', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  const unwrap = (node) => {
    while (node && ts.isParenthesizedExpression(node)) node = node.expression;
    return node;
  };
  const vendor = (value) => {
    const node = unwrap(value);
    return node && ts.isStringLiteralLike(node) && node.text.includes('astronomy-engine');
  };
  let found = false;
  const visit = (node) => {
    if (found) return;
    const expression = ts.isCallExpression(node) ? unwrap(node.expression) : null;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && vendor(node.moduleSpecifier)) {
      found = true;
    } else if (ts.isCallExpression(node)
      && (expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(expression) && expression.text === 'require'))
      && vendor(node.arguments[0])) {
      found = true;
    } else ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}
const serverOnlyMarkerChunks = chunkRows
  .filter(({ source }) => ['node:module', 'createRequire'].some((marker) => source.includes(marker))
    || hasExternalEphemerisImport(source))
  .map(({ path }) => path);
const escapedEngineMarkerChunks=chunkRows.filter(({path,source})=>!engineClosure.has(path)&&engineMarkers.some(marker=>source.includes(marker))).map(({path})=>path);
if(escapedEngineMarkerChunks.length)fail(`worker/browser engine isolation: ephemeris marker outside the full static closure: ${escapedEngineMarkerChunks.join(', ')}`);
if (homepageMarkerChunks.length) {
  fail(`homepage engine isolation: engine marker found in ${homepageMarkerChunks.join(', ')}`);
}
if (serverOnlyMarkerChunks.length) {
  fail(`browser engine isolation: server-only import marker found in ${serverOnlyMarkerChunks.join(', ')}`);
}
if (engineChunk && !engineMarkers.every((marker) => [...engineClosure].some((path) => chunks.get(path).source.includes(marker)))) {
  fail(`engine marker fingerprint missing from static closure of ${engineChunk.path}`);
}

if (registryAura) {
  const auraSource = [...registryAura.closure].map((path) => chunks.get(path).source).join('\n');
  const forbiddenAuraMarkers = [
    '@zodiacs/sdk',
    'signMessage',
    'signTransaction',
    'sendTransaction',
    'wallet_addEthereumChain',
    'wallet_switchEthereumChain',
    'eth_sendTransaction',
    'personal_sign',
    'eth_signTypedData',
  ];
  const found = forbiddenAuraMarkers.filter((marker) => auraSource.includes(marker));
  if (found.length) fail(`Registry Collection client boundary contains forbidden markers: ${found.join(', ')}`);
  if ([...registryAura.closure].some((path) => /\/_astro\/full\.[^/]+\.js$/.test(path)
    || engineMarkers.some((marker) => chunks.get(path).source.includes(marker)))) {
    fail('Registry Collection eagerly loads the full astronomy engine chunk');
  }
}

console.log('route gzip sizes (initial transitive local JS):');
for (const row of routeRows) {
  console.log(`  ${row.route.padEnd(16)} ${kb(row.gzip).padStart(6)} KB / ${String(row.limit).padStart(4)} KB  (${row.closure.size} chunks)`);
}
console.log('chunk gates:');
if (largestChunk) {
  console.log(`  ${'chunk-max'.padEnd(16)} ${kb(largestChunk.gzip).padStart(6)} KB / ${String(budgets['chunk-max']).padStart(4)} KB  (${largestChunk.path})`);
}
if (engineChunk) {
  console.log(`  ${'engine-chunk'.padEnd(16)} ${kb(engineGzip).padStart(6)} KB / ${String(budgets['engine-chunk']).padStart(4)} KB  (${engineChunk.path}; ${engineClosure.size} static chunks)`);
}
const sourceBoundaryClear = directVendorImporters.length === allowedDirectVendorImporters.length
  && directVendorImporters.every((path, index) => path === allowedDirectVendorImporters[index])
  && engineInternalImporters.length === 1
  && engineInternalImporters[0] === allowedEngineImporter
  && windowRuntimeImporters.every(path=>path===allowedEngineImporter);
console.log(`engine isolation: package boundary ${sourceBoundaryClear ? 'clear' : 'failed'}; homepage markers ${homepageMarkerChunks.length ? 'found' : 'clear'}`);

if (failures.length) {
  const label = enforce ? 'failures' : 'warnings';
  console.error(`report-bundles: ${failures.length} ${label}`);
  for (const message of failures) console.error(`  - ${message}`);
  if (enforce) process.exit(1);
} else {
  console.log(`report-bundles: ${enforce ? 'budgets pass' : 'within budgets'}`);
}
