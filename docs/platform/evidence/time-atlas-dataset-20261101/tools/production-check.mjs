#!/usr/bin/env node
/*
 * What a site serves of the time atlas dataset (B3.c), against what a commit
 * holds. Run from a clone of zodiacs-org/site that contains <commit>:
 *
 *   node production-check.mjs <alias.json|-> <40-hex commit> <out.json> [base URL]
 *   TIME_ATLAS_CHECK_CONTROL=<name>[,<name>...] node production-check.mjs ...
 *
 * alias.json holds what Vercel reported for the zodiacs.org alias and its
 * deployment: deploymentId, aliasUpdatedAt, readyState, target and
 * githubCommitSha, and nothing else is read from it; "-" is a local run, with
 * no alias and no check 1. The base defaults to https://zodiacs.org.
 *
 * Every expected byte comes from `git show <commit>:<path>`, and every
 * expectation about the page from scripts/check-time-atlas.mjs as <commit>
 * holds it, which this imports from a copy of that blob. Requests do not
 * follow redirects and are not served from a cache; digests are of the
 * decoded bodies. The checks (the preregistration's production record):
 *
 *   1      the alias names a READY production deployment whose commit is
 *          <commit> or contains it (not run locally);
 *   2      /developers/time-atlas/ answers 200 as text/html;
 *   3      the page holds the viewer's content, no excerpt, no en or em dash,
 *          nothing it should not load, and a target for every in-page link
 *          (the page check's "viewer" part);
 *   4      the page holds the licence and attribution text and its Dataset
 *          markup (the "licence" part);
 *   5      the page holds the correction text with its three links (the
 *          "corrections" part), and the form's definition at engine main on
 *          raw.githubusercontent.com is named "Atlas correction";
 *   6..22  each atlas file answers 200 with its media type (and charset=utf-8
 *          on zodiacs.org), and its body has the index's SHA-256 and the
 *          bytes <commit> holds for it and the engine repository holds at
 *          7307665b, read from raw.githubusercontent.com;
 *   23     files.json answers 200 as application/json with the bytes
 *          <commit> holds for it;
 *   24     /developers/ links the page, sitemap.xml lists it with a lastmod,
 *          and llms.txt and llms-full.txt give its address.
 *
 * Controls, each of which must fail exactly its check: one-byte (README.md
 * expected with its last byte changed) and engine-c4e70330 (the engine's
 * bytes read at c4e70330, where README.md differs) fail README.md's check;
 * row-removed, tzdb-offset, explanation-removed, label-removed and
 * excerpt-inserted change the fetched page and fail check 3;
 * geonames-changes fails check 4; form-link-removed fails check 5. Several
 * controls, comma-separated, write one run each into one report.
 *
 * It writes { schema, base, control, commit, deployment, readAt, passed, of,
 * checks }, each check { name, ok, detail }, or with several controls
 * { schema, base, commit, deployment, readAt, runs } with one such record per
 * control, and exits 1 when a check fails.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SCHEMA = 'zodiacs.time-atlas-production.v1';
const PRODUCTION = 'https://zodiacs.org';
const ENGINE_PIN = '7307665bdbc432269fdac006104f661be16000bc';
const ENGINE_CONTROL = 'c4e70330751b17f6ebd6322958c270f09f93d3a3';
const RAW = 'https://raw.githubusercontent.com/zodiacs-org/engine';
const FORM_DEFINITION = `${RAW}/main/.github/ISSUE_TEMPLATE/atlas-correction.yml`;
const FORM_URL = 'https://github.com/zodiacs-org/engine/issues/new?template=atlas-correction.yml';
const PUBLISHED = 'public/developers/time-atlas/0.1.0';
const SERVED = '/developers/time-atlas/0.1.0';
const PAGE = '/developers/time-atlas/';
const REFERENCE = '/developers/sky-benchmark/';
const CONTROLS = Object.freeze([
  'one-byte', 'engine-c4e70330', 'row-removed', 'tzdb-offset', 'explanation-removed', 'label-removed', 'excerpt-inserted',
  'geonames-changes', 'form-link-removed',
]);

const [aliasPath, commit, out, base = PRODUCTION] = process.argv.slice(2);
if (!aliasPath || !/^[0-9a-f]{40}$/u.test(commit ?? '') || !out) {
  throw new Error('usage: node production-check.mjs <alias.json|-> <40-hex commit> <out.json> [base URL]');
}
const controls = (process.env.TIME_ATLAS_CHECK_CONTROL ?? '').split(',').map((name) => name.trim()).filter(Boolean);
for (const name of controls) if (!CONTROLS.includes(name)) throw new Error(`unknown control ${name}; the controls are ${CONTROLS.join(', ')}`);
const onProduction = base === PRODUCTION;

const git = (...args) => execFileSync('git', args, { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
const show = (path) => git('show', `${commit}:${path}`);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const html = (text) => String(text).replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;');
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

// The page check as <commit> holds it: a plain module that imports only Node's own.
const scratch = mkdtempSync(join(tmpdir(), 'time-atlas-check-'));
let check;
try {
  writeFileSync(join(scratch, 'check-time-atlas.mjs'), show('scripts/check-time-atlas.mjs'));
  check = await import(pathToFileURL(join(scratch, 'check-time-atlas.mjs')).href);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

/** A published file's bytes at <commit>: under public/, or under src/data/time-atlas/ for a data file served from there. */
function published(path) {
  try {
    return show(`${PUBLISHED}/${path}`);
  } catch (error) {
    if (path.startsWith('data/')) return show(`src/data/time-atlas/${path.slice('data/'.length)}`);
    throw error;
  }
}

async function get(url) {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      cache: 'no-store',
      headers: { 'User-Agent': 'zodiacs-programme-check (time atlas)', 'Cache-Control': 'no-cache' },
    });
    return {
      status: response.status,
      type: response.headers.get('content-type'),
      cors: response.headers.get('access-control-allow-origin'),
      bytes: Buffer.from(await response.arrayBuffer()),
    };
  } catch (error) {
    return { status: 0, type: null, cors: null, bytes: Buffer.alloc(0), error: String(error) };
  }
}

const MEDIA_TYPES = { '.json': 'application/json', '.md': 'text/markdown', '.txt': 'text/plain' };
/** Whether a content-type is the file's media type, with charset=utf-8 as well on zodiacs.org. */
function typed(type, path) {
  const wanted = MEDIA_TYPES[path.slice(path.lastIndexOf('.'))];
  const [essence, ...parameters] = String(type ?? '').toLowerCase().split(';').map((part) => part.trim());
  return essence === wanted && (!onProduction || parameters.includes('charset=utf-8'));
}

// What <commit> holds, read once.
const indexBytes = published('files.json');
const index = JSON.parse(indexBytes.toString('utf8'));
const data = Object.fromEntries(check.TIME_ATLAS_DATA_FILES.map((name) => [name, JSON.parse(published(`data/${name}`).toString('utf8'))]));
const differences = JSON.parse(published('tzdb/differences.json').toString('utf8'));
const report = published('TZDB-DIFFERENCES.md').toString('utf8');

let deployment = null;
let containsCommit = false;
if (aliasPath !== '-') {
  const raw = JSON.parse(readFileSync(aliasPath, 'utf8'));
  deployment = Object.fromEntries(['deploymentId', 'aliasUpdatedAt', 'readyState', 'target', 'githubCommitSha'].map((key) => [key, raw[key] ?? null]));
  try {
    git('merge-base', '--is-ancestor', commit, String(deployment.githubCommitSha));
    containsCommit = true;
  } catch { /* not an ancestor, or an object this clone does not have */ }
}

// The served page, the reference page and the documents that point to the page, fetched once for every run.
const page = await get(`${base}${PAGE}`);
const reference = await get(`${base}${REFERENCE}`);
const form = await get(FORM_DEFINITION);
const files = [];
for (const file of index.files) files.push({ file, served: await get(`${base}${SERVED}/${file.path}`) });
const servedIndex = await get(`${base}${SERVED}/files.json`);
const hub = await get(`${base}/developers/`);
const sitemap = await get(`${base}/sitemap.xml`);
const llms = await get(`${base}/llms.txt`);
const llmsFull = await get(`${base}/llms-full.txt`);
const engineBytes = new Map();
for (const engine of new Set([ENGINE_PIN, ...(controls.includes('engine-c4e70330') ? [ENGINE_CONTROL] : [])])) {
  for (const file of index.files) engineBytes.set(`${engine}:${file.source}`, await get(`${RAW}/${engine}/${file.source}`));
}

/** The served page with one control's change made to it; throws when the change finds nothing to change. */
function controlledPage(text, control) {
  const changed = (() => {
    if (control === 'row-removed') return text.replace(/<tr id="[^"]+" data-result="differs"[^>]*>[\s\S]*?<\/tr>/u, '');
    if (control === 'tzdb-offset') {
      const first = differences.differences[0];
      const row = /<tr id="[^"]+" data-result="differs"[^>]*>[\s\S]*?<\/tr>/u.exec(text);
      if (!row) return text;
      const shown = `${first.tzdbOffset} ${first.tzdbAbbreviation}`;
      const other = `${first.tzdbOffset.slice(0, -1)}${first.tzdbOffset.endsWith('1') ? '2' : '1'} ${first.tzdbAbbreviation}`;
      return text.slice(0, row.index) + row[0].replace(html(shown), html(other)) + text.slice(row.index + row[0].length);
    }
    if (control === 'explanation-removed') return text.replace(/<section id="[^"]+"[^>]*\bdata-explanation-section\b[^>]*>[\s\S]*?<\/section>/u, '');
    if (control === 'label-removed') return text.replace(/<strong\b[^>]*>Finding about tzdb 2025c, not sent to the tz project:<\/strong>/u, '');
    if (control === 'excerpt-inserted') {
      const source = data['citations-fr.json'].citations.find((entry) => entry.id === 'fr-jo-1891-03-15-law');
      return text.replace(/(<li id="cite-fr-jo-1891-03-15-law"[^>]*>)/u, `$1<q lang="fr">${html(source.excerpt).replace(/\$/gu, '$$$$')}</q>`);
    }
    if (control === 'geonames-changes') {
      const changes = html(data['atlas.json'].longitudeSource.changes);
      const attribution = /<p data-attribution\b[^>]*>[\s\S]*?<\/p>/u.exec(text);
      if (!attribution || !attribution[0].includes(changes)) return text;
      const altered = attribution[0].replace(changes, changes.replace('copied unchanged', 'copied'));
      return text.slice(0, attribution.index) + altered + text.slice(attribution.index + attribution[0].length);
    }
    if (control === 'form-link-removed') {
      return text.replace(new RegExp(`<a\\b[^>]*\\bhref="${escapeRegExp(html(FORM_URL))}"[^>]*>(Atlas correction issue)<\\/a>`, 'u'), '$1');
    }
    return text;
  })();
  if (changed === text) throw new Error(`control ${control}: nothing on the page to change`);
  return changed;
}

function run(control) {
  const checks = [];
  const record = (name, ok, detail) => {
    checks.push({ name, ok: Boolean(ok), detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `: ${JSON.stringify(detail).slice(0, 500)}`}`);
  };
  if (control) console.log(`-- control ${control}`);

  if (deployment) {
    record(`1 the zodiacs.org alias names a READY production deployment that is or contains ${commit.slice(0, 8)}`,
      deployment.readyState === 'READY' && deployment.target === 'production' && containsCommit, { deployment, containsCommit });
  }
  record(`2 ${PAGE} answers 200 as text/html`, page.status === 200 && /^text\/html\b/iu.test(page.type ?? ''), { status: page.status, type: page.type });

  const pageText = page.bytes.toString('utf8');
  const checkedPage = control && !['one-byte', 'engine-c4e70330'].includes(control) ? controlledPage(pageText, control) : pageText;
  let problems;
  try {
    problems = page.status === 200 && reference.status === 200
      ? check.timeAtlasPageProblems({ page: checkedPage, reference: reference.bytes.toString('utf8'), index: indexBytes.toString('utf8'), data, differences, report })
      : [`viewer: page ${page.status}, reference ${reference.status}`, `licence: page ${page.status}`, `corrections: page ${page.status}`];
  } catch (error) {
    problems = [`viewer: the check threw: ${error.message}`, 'licence: not checked', 'corrections: not checked'];
  }
  const part = (name) => problems.filter((problem) => problem.startsWith(`${name}: `));
  record('3 the page holds the viewer: the base, the 23 comparisons, every period, each difference with its explanation, the explanations and findings, the sources, the rules, the files; no excerpt, no en or em dash, nothing more to run or load, a target for every link',
    part('viewer').length === 0, { sha256: sha256(page.bytes), bytes: page.bytes.length, problems: part('viewer').slice(0, 12), more: Math.max(0, part('viewer').length - 12) });
  record('4 the page holds the licence and attribution text and its Dataset markup', part('licence').length === 0, { problems: part('licence') });
  const formNamed = form.status === 200 && /^name: Atlas correction\s*$/mu.test(form.bytes.toString('utf8'));
  record('5 the page holds the correction text with its three links, and the form at engine main is named "Atlas correction"',
    part('corrections').length === 0 && formNamed, { problems: part('corrections'), form: { status: form.status, named: formNamed } });

  const engine = control === 'engine-c4e70330' ? ENGINE_CONTROL : ENGINE_PIN;
  files.forEach(({ file, served }, at) => {
    let expected = published(file.path);
    if (control === 'one-byte' && file.path === 'README.md') {
      expected = Buffer.from(expected);
      expected[expected.length - 1] ^= 1;
    }
    const upstream = engineBytes.get(`${engine}:${file.source}`);
    const digest = sha256(served.bytes);
    const ok = served.status === 200 && typed(served.type, file.path) && digest === file.sha256
      && served.bytes.equals(expected) && upstream.status === 200 && upstream.bytes.equals(served.bytes);
    record(`${6 + at} ${SERVED}/${file.path} answers 200 as ${MEDIA_TYPES[file.path.slice(file.path.lastIndexOf('.'))]} with the bytes of ${commit.slice(0, 8)} and of the engine at ${engine.slice(0, 8)}`, ok, {
      status: served.status, type: served.type, sha256: digest, indexed: file.sha256 === digest,
      sameAsCommit: served.bytes.equals(expected), engine: { commit: engine, status: upstream.status, same: upstream.bytes.equals(served.bytes) },
      accessControlAllowOrigin: served.cors,
    });
  });
  record(`23 ${SERVED}/files.json answers 200 as application/json with the bytes of ${commit.slice(0, 8)}`,
    servedIndex.status === 200 && typed(servedIndex.type, 'files.json') && servedIndex.bytes.equals(indexBytes),
    { status: servedIndex.status, type: servedIndex.type, sha256: sha256(servedIndex.bytes), same: servedIndex.bytes.equals(indexBytes) });

  const pageUrl = `${PRODUCTION}${PAGE}`;
  const listed = /<url>\s*<loc>https:\/\/zodiacs\.org\/developers\/time-atlas\/<\/loc>([\s\S]*?)<\/url>/u.exec(sitemap.bytes.toString('utf8'));
  const lastmod = listed ? /<lastmod>(\d{4}-\d{2}-\d{2})/u.exec(listed[1])?.[1] ?? null : null;
  const linkedFromHub = hub.status === 200 && hub.bytes.toString('utf8').includes(`href="${PAGE}"`);
  const inLlms = llms.status === 200 && llms.bytes.toString('utf8').includes(pageUrl);
  const inLlmsFull = llmsFull.status === 200 && llmsFull.bytes.toString('utf8').includes(pageUrl);
  record('24 /developers/ links the page, sitemap.xml lists it with a lastmod, and llms.txt and llms-full.txt give its address',
    linkedFromHub && Boolean(lastmod) && inLlms && inLlmsFull,
    { linkedFromHub, sitemap: { status: sitemap.status, listed: Boolean(listed), lastmod }, llms: inLlms, llmsFull: inLlmsFull });

  const passed = checks.filter((entry) => entry.ok).length;
  console.log(`${control ? `control ${control}: ` : ''}${passed} of ${checks.length} passed`);
  return { control: control ?? null, passed, of: checks.length, checks };
}

const readAt = new Date().toISOString();
const runs = controls.length ? controls.map(run) : [run(null)];
const output = runs.length === 1
  ? { schema: SCHEMA, base, control: runs[0].control, commit, deployment, readAt, passed: runs[0].passed, of: runs[0].of, checks: runs[0].checks }
  : { schema: SCHEMA, base, commit, deployment, readAt, runs };
writeFileSync(out, `${JSON.stringify(output, null, 2)}\n`);
if (runs.some((entry) => entry.passed !== entry.of)) process.exitCode = 1;
