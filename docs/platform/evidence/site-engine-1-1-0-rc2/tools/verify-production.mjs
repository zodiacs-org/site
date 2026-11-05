/**
 * After the merge deploys: what canonical production serves for the engine
 * 1.1.0-rc.2 adoption, every check that ../PRODUCTION-CHECKS.md names before
 * any production run. Adapted from 1.1.0-rc.1's tool
 * (../../site-engine-1-1-0-rc1/tools/verify-production.mjs): its eleven checks
 * (R1 to R11, with the pages' rc.2 wording), lite D1 to D3, time-bands C9, the
 * varga check V1 and time-entry S3b. S3a is named there and not run.
 *
 *   node docs/platform/evidence/site-engine-1-1-0-rc2/tools/verify-production.mjs \
 *     <alias.json> <40-hex merge commit> <out.json> [--local-dist <dir>] [--control] [base URL]
 *
 * Run from a clone of zodiacs-org/site that contains the merge commit, with
 * the merge checked out and its dependencies installed: the expected values
 * are read from the merge commit (`git show`), never from a working tree, and
 * S3b compares production's time records with timeBasis from the vendored
 * @zodiacs/engine/time that the checkout resolves.
 *
 * - <alias.json>: the alias read through the Vercel connector just before the
 *   run; only deploymentId, aliasUpdatedAt, readyState, target and
 *   githubCommitSha are read from it, as 1.1.0-rc.1's tool reads them.
 * - --local-dist <dir>: the dist folder of a local build of the merge commit
 *   with production's flags (site-check.yml's production-flags-build
 *   environment, the three _SECRET stand-ins at 32 characters or more), for
 *   D2's byte-for-byte comparison. Without it D2 fails.
 * - --control: the run on the deployment that served the site before the
 *   merge. Every check with a control must then fail, and the exit code is 0
 *   only if each does. R10 has no control (it reads the merge commit). S3b
 *   fails there on the version; its time records are recorded, not judged
 *   (F-53's parity, S1, found them equal to rc.2's).
 *
 * D2 and D3 find production's own chunks: from the module roots of
 * /birth-chart/ and /compatibility/ (module scripts, module preloads and
 * Astro islands' component and renderer URLs, as scripts/report-bundles.mjs
 * reads them), every quoted reference to a chunk under /_astro/ is followed,
 * static or dynamic, until the EclipticView, RelationshipWheel and
 * ChartCalculator chunks and the engine chunk (full.*.js) are found. Each
 * closure is then the chunk and its static imports (syntax-aware, as
 * report-bundles.mjs takes them), which leaves out the engine chunk, a
 * dynamic import. The compute API is sent the documented positions request
 * once, for R11 and S3b, and S3b's control request once: two POSTs in all,
 * neither carrying a person's data. Exits non-zero on any failed check, or,
 * with --control, on any control that passes.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';

const args = process.argv.slice(2);
const takeFlag = (name) => {
  const index = args.indexOf(name);
  if (index < 0) return false;
  args.splice(index, 1);
  return true;
};
const takeOption = (name) => {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const [, value] = args.splice(index, 2);
  return value ?? null;
};
const controlRun = takeFlag('--control');
const localDist = takeOption('--local-dist');
const [aliasPath, merge, out, base = 'https://zodiacs.org'] = args;
if (!aliasPath || !/^[0-9a-f]{40}$/u.test(merge ?? '') || !out) {
  throw new Error('usage: verify-production.mjs <alias.json> <40-hex merge commit> <out.json> [--local-dist <dir>] [--control] [base URL]');
}

const git = (...gitArgs) => execFileSync('git', gitArgs, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const atMerge = (path) => git('show', `${merge}:${path}`);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const decode = (text) => text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/giu, (whole, dec, hex, name) => {
  if (dec) return String.fromCodePoint(Number(dec));
  if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[name.toLowerCase()] ?? whole;
});
let requests = 0;
async function get(path) {
  requests += 1;
  try {
    const response = await fetch(base + path, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30000),
      headers: { 'User-Agent': 'zodiacs-programme-check' } });
    return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
  } catch (error) {
    return { status: 0, bytes: Buffer.alloc(0), error: String(error) };
  }
}
async function post(path, body) {
  requests += 1;
  try {
    const response = await fetch(base + path, {
      method: 'POST', headers: { 'content-type': 'application/json', 'User-Agent': 'zodiacs-programme-check' }, body: JSON.stringify(body),
      cache: 'no-store', signal: AbortSignal.timeout(30000),
    });
    return { status: response.status, json: await response.json().catch(() => null) };
  } catch (error) {
    return { status: 0, json: null, error: String(error) };
  }
}

const candidate = JSON.parse(atMerge('src/data/platform-engine-candidate.json'));
const mcp = JSON.parse(atMerge('public/examples/mcp-server.json'));
const version = candidate.version;

const checks = [];
// Detail first, so no field it carries can replace the check's id, name or result.
const check = (id, name, ok, detail = {}, { hasControl = true } = {}) => {
  checks.push({ ...detail, id, name, hasControl, ok: Boolean(ok) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id} ${name}${ok ? '' : ` · ${JSON.stringify(detail).slice(0, 400)}`}`);
};

// ---- R1 and D1: the alias ----
const raw = JSON.parse(await readFile(aliasPath, 'utf8'));
const deployment = Object.fromEntries(['deploymentId', 'aliasUpdatedAt', 'readyState', 'target', 'githubCommitSha'].map((key) => [key, raw[key]]));
let containsMerge = false;
try {
  git('merge-base', '--is-ancestor', merge, deployment.githubCommitSha);
  containsMerge = true;
} catch {}
const aliasOk = deployment.readyState === 'READY' && deployment.target === 'production' && containsMerge;
const aliasDetail = { containsMerge, builtFromMerge: deployment.githubCommitSha === merge };
check('R1', 'the zodiacs.org alias names a READY production deployment built from the merge commit or a commit that contains it', aliasOk, aliasDetail);
check('D1', 'lite D1: the alias, as R1', aliasOk, aliasDetail);

// ---- R2 to R6: the candidate wording, from the merge's pages ----
for (const [id, path, needles] of [
  ['R2', '/developers/engine/', [`This revision vendors ${version}, a release candidate that is not on npm.`,
    'records 1.0.0 under latest', 'npm install @zodiacs/engine@1.0.0 installs 1.0.0', candidate.sha256]],
  ['R3', '/developers/support/', [`This revision vendors the ${version} archive below, a release candidate that is not on npm.`,
    'records 1.0.0 under latest', 'npm install @zodiacs/engine@1.0.0 installs 1.0.0', candidate.sha256]],
  ['R4', '/developers/mcp/', [`The engine (@zodiacs/engine ${version})`, `zodiacs-mcp-server ${mcp.version}`, mcp.sha256]],
  ['R5', '/llms.txt', [`\`@zodiacs/engine\` ${version}, MIT`, 'a release candidate that npm does not carry', 'npm\'s `latest` is 1.0.0',
    `\`zodiacs-mcp-server\` ${mcp.version}`]],
  ['R6', '/llms-full.txt', [`\`@zodiacs/engine\` version ${version}, a release candidate after 1.0.0`,
    'records 1.0.0, the first stable release, under `latest`', `\`zodiacs-mcp-server\` candidate version ${mcp.version}`]],
]) {
  const { status, bytes } = await get(path);
  // Pages are compared as text: tags, which carry Astro's scoped attributes, are removed and entities decoded.
  const text = path.endsWith('.txt') ? bytes.toString('utf8') : decode(bytes.toString('utf8').replace(/<[^>]+>/gu, ''));
  const missing = needles.filter((needle) => !text.includes(needle));
  check(id, `${path} names engine ${version} as a candidate npm does not carry`, status === 200 && missing.length === 0,
    { status, sha256: sha256(bytes), missing });
}

// ---- R7 to R9: the reference's provenance, the MCP manifest and archive ----
const provenance = await get('/developers/engine/reference/provenance.json');
let reference = null;
try { reference = JSON.parse(provenance.bytes.toString('utf8')); } catch {}
check('R7', `TypeDoc provenance names ${version} and its archive`, provenance.status === 200 && reference?.version === version
  && reference?.sha256 === candidate.sha256 && reference?.sourceCommit === candidate.sourceCommit && reference?.license === 'MIT AND CC-BY-4.0',
  { status: provenance.status, version: reference?.version ?? null, sha256: sha256(provenance.bytes) });
const manifest = await get('/examples/mcp-server.json');
let served = null;
try { served = JSON.parse(manifest.bytes.toString('utf8')); } catch {}
check('R8', 'MCP manifest is the merge\'s', manifest.status === 200 && JSON.stringify(served) === JSON.stringify(mcp),
  { status: manifest.status, version: served?.version ?? null });
const archive = await get(`/examples/${mcp.file}`);
check('R9', `MCP archive ${mcp.version} has the manifest's digest`, archive.status === 200 && sha256(archive.bytes) === mcp.sha256 && archive.bytes.length === mcp.bytes,
  { status: archive.status, bytes: archive.bytes.length, sha256: sha256(archive.bytes) });

// ---- R10, R11 and S3b: the compute API's documented positions request, and S3b's control request ----
// The documented example (src/lib/compute-api/examples.ts, positions.two): two instants and three bodies, no person's data.
const INSTANTS = ['2026-09-29T12:00:00Z', '2026-12-31T00:00:00-05:00'];
const LATER = ['2026-09-29T12:00:00.001Z', '2026-12-31T00:00:00.001-05:00'];
const body = { instants: INSTANTS, bodies: ['Sun', 'Moon', 'Mercury'] };
const documented = /instants: \['2026-09-29T12:00:00Z', '2026-12-31T00:00:00-05:00'\], bodies: \['Sun', 'Moon', 'Mercury'\]/u
  .test(atMerge('src/lib/compute-api/examples.ts'));
check('R10', 'the documented positions example is the one sent', documented, {}, { hasControl: false });
const answer = await post('/api/v1/positions', body);
const ids = answer.json?.receipt?.conventionIds;
const onVersion = (json) => json?.backend?.version === version && json?.receipt?.engine?.version === version;
check('R11', `compute API answers on engine ${version}, with the receipt's convention ids`, answer.status === 200 && onVersion(answer.json)
  && Array.isArray(ids) && ids.length > 0,
  { status: answer.status, backend: answer.json?.backend?.version ?? null, receiptEngine: answer.json?.receipt?.engine?.version ?? null, conventionIds: Array.isArray(ids) ? ids.length : null });

const { timeBasis } = await import('@zodiacs/engine/time');
const records = (json) => (json?.result?.instants ?? []).map(({ instant, deltaT, timeScale }) => ({ instant, deltaT, timeScale }));
const expected = INSTANTS.map((instant) => {
  const basis = timeBasis(Date.parse(instant), 'utc');
  return { deltaT: basis.deltaT, timeScale: basis.timeScale };
});
const sameAsExpected = (rows) => rows.length === expected.length && rows.every((row, index) =>
  JSON.stringify(row.deltaT) === JSON.stringify(expected[index].deltaT) && JSON.stringify(row.timeScale) === JSON.stringify(expected[index].timeScale));
const differsFromExpected = (rows) => rows.length === expected.length && rows.every((row, index) =>
  JSON.stringify(row.deltaT) !== JSON.stringify(expected[index].deltaT) || JSON.stringify(row.timeScale) !== JSON.stringify(expected[index].timeScale));
const later = await post('/api/v1/positions', { ...body, instants: LATER });
const answered = records(answer.json);
const answeredLater = records(later.json);
// Over a millisecond deltaT.seconds does not move at its stored precision; timeScale.ut1MinusUtc and both sigmas do.
check('S3b', `compute API time records equal timeBasis from the vendored @zodiacs/engine/time on ${version}, and the request 1 ms later differs`,
  answer.status === 200 && onVersion(answer.json) && sameAsExpected(answered) && later.status === 200 && differsFromExpected(answeredLater),
  {
    status: answer.status,
    backend: answer.json?.backend?.version ?? null,
    recordsEqualTimeBasis: sameAsExpected(answered),
    controlRequest: { instants: LATER, status: later.status, recordsDifferFromTimeBasisAtTheOriginalInstants: differsFromExpected(answeredLater) },
    records: answered,
    expected,
  });

// ---- D2, D3, C9 and V1 ----
const VIEWS = [
  { view: 'EclipticView', texts: ['declination bodies must be a standard array.', 'sunAltitude must be from -90 to 90 degrees.'] },
  { view: 'RelationshipWheel', texts: [' must be an array of { body, lon }.'] },
  { view: 'ChartCalculator', texts: ['sign must be a lowercase zodiac sign name.'] },
];
const MARKERS = ['Value is not boolean:', 'Light-travel time solver did not converge'];
const START_PAGES = ['/birth-chart/', '/compatibility/'];
const CHUNK = /^\/_astro\/([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]{8}\.js$/u;

function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find((value) => value !== undefined) ?? null;
}
function astroPath(specifier, from) {
  let url;
  try {
    url = new URL(specifier, `https://zodiacs.org${from}`);
  } catch {
    return null;
  }
  return url.origin === 'https://zodiacs.org' && url.pathname.startsWith('/_astro/') && url.pathname.endsWith('.js') ? url.pathname : null;
}
function htmlRoots(html, page) {
  const roots = [];
  const add = (specifier) => {
    const path = specifier && astroPath(specifier, page);
    if (path) roots.push(path);
  };
  for (const match of html.matchAll(/<script\b[^>]*>/giu)) if ((attr(match[0], 'type') ?? '').toLowerCase() === 'module') add(attr(match[0], 'src'));
  for (const match of html.matchAll(/<link\b[^>]*>/giu)) {
    const rels = (attr(match[0], 'rel') ?? '').toLowerCase().split(/\s+/u);
    if (rels.includes('modulepreload') || (rels.includes('preload') && (attr(match[0], 'as') ?? '').toLowerCase() === 'script')) add(attr(match[0], 'href'));
  }
  for (const match of html.matchAll(/<astro-island\b[^>]*>/giu)) {
    add(attr(match[0], 'component-url'));
    add(attr(match[0], 'renderer-url'));
  }
  return roots;
}
// Static imports and re-exports only, read with the TypeScript parser (scripts/report-bundles.mjs's staticJavaScriptImports).
function staticImports(source) {
  const tree = ts.createSourceFile('chunk.js', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  return tree.statements.flatMap((node) => (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
    && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier) ? [node.moduleSpecifier.text] : []);
}
// Every quoted chunk path, static or dynamic: "./x.js", `./x.js` and Vite's dependency lists' "_astro/x.js".
function references(source, from) {
  const found = [];
  for (const match of source.matchAll(/["'`]((?:\.\/|\/?_astro\/)[A-Za-z0-9_.-]+\.js)["'`]/gu)) {
    const spec = match[1];
    const path = spec.startsWith('./') ? astroPath(spec, from) : astroPath(spec.startsWith('/') ? spec : `/${spec}`, from);
    if (path) found.push(path);
  }
  return found;
}

const productionCache = new Map();
async function productionChunk(path) {
  if (!productionCache.has(path)) productionCache.set(path, await get(path));
  return productionCache.get(path);
}
async function findProductionChunks(names) {
  const found = {};
  const seen = new Set();
  const queue = [];
  for (const page of START_PAGES) {
    const { status, bytes } = await get(page);
    if (status === 200) queue.push(...htmlRoots(bytes.toString('utf8'), page));
  }
  while (queue.length && Object.keys(found).length < names.length && seen.size < 600) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    const name = CHUNK.exec(path)?.[1];
    if (name && names.includes(name) && !found[name]) found[name] = path;
    const { status, bytes } = await productionChunk(path);
    if (status !== 200) continue;
    for (const next of references(bytes.toString('utf8'), path)) if (!seen.has(next)) queue.push(next);
  }
  return { found, followed: seen.size };
}
async function closureOf(root, read) {
  const files = new Map();
  const missing = [];
  const visit = async (path) => {
    if (files.has(path)) return;
    const bytes = await read(path);
    files.set(path, bytes);
    if (!bytes) {
      missing.push(path);
      return;
    }
    for (const spec of staticImports(bytes.toString('utf8'))) {
      const dependency = astroPath(spec, path);
      if (dependency) await visit(dependency);
    }
  };
  await visit(root);
  return { files, missing };
}
const readProduction = async (path) => {
  const { status, bytes } = await productionChunk(path);
  return status === 200 ? bytes : null;
};
const readLocal = async (path) => {
  try {
    return await readFile(join(localDist, path));
  } catch {
    return null;
  }
};
async function localChunk(name) {
  const names = (await readdir(join(localDist, '_astro'))).filter((file) => CHUNK.exec(`/_astro/${file}`)?.[1] === name);
  return names.length === 1 ? `/_astro/${names[0]}` : null;
}

const { found, followed } = await findProductionChunks([...VIEWS.map(({ view }) => view), 'full']);
for (const { view, texts } of VIEWS) {
  const path = found[view] ?? null;
  const production = path ? await closureOf(path, readProduction) : { files: new Map(), missing: [] };
  const text = [...production.files.values()].filter(Boolean).map((bytes) => bytes.toString('utf8')).join('\n');
  const markers = MARKERS.filter((marker) => text.includes(marker));
  const textsFound = texts.filter((needle) => text.includes(needle));
  let equalToLocal = false;
  let local = null;
  if (localDist && path) {
    const localPath = await localChunk(view);
    if (localPath) {
      const closure = await closureOf(localPath, readLocal);
      const paths = (files) => [...files.keys()].sort();
      equalToLocal = closure.missing.length === 0 && production.missing.length === 0
        && JSON.stringify(paths(closure.files)) === JSON.stringify(paths(production.files))
        && [...closure.files].every(([file, bytes]) => production.files.get(file)?.equals(bytes));
      local = { chunk: localPath, files: closure.files.size };
    }
  }
  const bytes = [...production.files.values()].filter(Boolean).reduce((sum, item) => sum + item.length, 0);
  check('D2', `lite D2: the ${view} closure equals the local build of the merge byte for byte, holds neither ephemeris marker and holds its lite texts`,
    Boolean(path) && production.missing.length === 0 && equalToLocal && markers.length === 0 && textsFound.length === texts.length,
    { view, chunk: path, files: production.files.size, bytes, missing: production.missing, local, equalToLocal, markers, texts: Object.fromEntries(texts.map((needle) => [needle, textsFound.includes(needle)])) });
}
const engineChunk = found.full ?? null;
const engine = engineChunk ? await closureOf(engineChunk, readProduction) : { files: new Map(), missing: [] };
const engineText = [...engine.files.values()].filter(Boolean).map((bytes) => bytes.toString('utf8')).join('\n');
const quoted = (value) => new RegExp(`["'\`]${value.replaceAll('.', '\\.')}["'\`]`, 'u').test(engineText);
const namesVersion = Boolean(engineChunk) && engine.missing.length === 0 && quoted(version);
check('D3', `lite D3: the engine chunk names ${version}`, namesVersion,
  { chunk: engineChunk, files: engine.files.size, missing: engine.missing, names: { [version]: quoted(version), '1.1.0-rc.1': quoted('1.1.0-rc.1') } });
const registry = await get('/developers/conventions/registry.json');
check('C9', 'time-bands C9: /developers/conventions/registry.json names time-band:first-order (for the record)',
  registry.status === 200 && registry.bytes.toString('utf8').includes('"time-band:first-order"'), { status: registry.status, sha256: sha256(registry.bytes) });
const varga = await get('/developers/engine/reference/functions/vedic.vargaSensitivity.html');
check('V1', 'the varga check: the reference serves functions/vedic.vargaSensitivity.html, and the engine chunk names the version (D3)',
  varga.status === 200 && namesVersion, { status: varga.status, engineChunkNamesVersion: namesVersion });

const withControl = checks.filter((item) => item.hasControl);
const record = {
  schema: 'zodiacs.engine-1-1-0-rc2-production.v1',
  checkedAt: new Date().toISOString(),
  run: controlRun ? 'control: the deployment before the merge; every check with a control must fail' : 'production: every check must pass',
  base,
  merge,
  deployment,
  candidate: { version, sha256: candidate.sha256, sourceCommit: candidate.sourceCommit },
  mcp: { version: mcp.version, sha256: mcp.sha256 },
  localDist: localDist ? 'given' : null,
  chunksFound: { ...found, followed },
  requests,
  checks,
  passed: checks.filter((item) => item.ok).length,
  failed: checks.filter((item) => !item.ok).length,
  ...(controlRun ? { controlsThatPassed: withControl.filter((item) => item.ok).map((item) => `${item.id} ${item.name}`) } : {}),
};
await writeFile(out, `${JSON.stringify(record, null, 2)}\n`);
console.log(`${record.passed} passed, ${record.failed} failed${controlRun ? `; controls that passed: ${record.controlsThatPassed.length}` : ''}; ${requests} requests`);
process.exitCode = controlRun ? (record.controlsThatPassed.length ? 1 : 0) : (record.failed ? 1 : 0);
