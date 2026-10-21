// What a site serves of the conventions registry (R44), against the registry a commit holds.
// Run from a clone of zodiacs-org/site that contains <commit>:
//   node conventions-check.mjs <alias.json|-> <40-hex commit> <out.json> [base URL]
// alias.json holds what Vercel reported for the zodiacs.org alias and its deployment just before: deploymentId,
// aliasUpdatedAt, readyState, target, githubCommitSha; nothing else is read from it. With an alias file the first
// check passes only when that deployment is READY in production and built from a commit that contains <commit>.
// Then, against the registry at <commit>:
// - the page is served and every id has its anchor there, with a link to its own address;
// - Chromium, opening each id's address (the page's URL with the id as its fragment), lands on that id's entry;
// - a made-up id's address lands on nothing (the browser check can fail);
// - registry.json is the registry with each id's address, and the Markdown twin has exactly one entry for every id;
// - the developer index, the conformance page, llms.txt and the sitemap link to it.
// With CONVENTIONS_CHECK_CONTROL=renamed-id it expects the registry with its first id renamed, a control that must fail
// exactly the checks that read the ids.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Chromium comes from the clone this runs in, as the site's own drives find it.
const require = createRequire(join(process.cwd(), 'package.json'));
const { chromium } = require('playwright-core');
const { findChromium, STABLE_CHROMIUM_ARGS } = await import(pathToFileURL(join(process.cwd(), 'tests/visual/browser.mjs')).href);

const [aliasPath, commit, out, base = 'https://zodiacs.org'] = process.argv.slice(2);
if (!aliasPath || !/^[0-9a-f]{40}$/u.test(commit ?? '') || !out) {
  throw new Error('usage: conventions-check.mjs <alias.json|-> <40-hex commit> <out.json> [base URL]');
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` · ${JSON.stringify(detail).slice(0, 600)}`}`);
};
async function get(path) {
  try {
    const response = await fetch(`${base}${path}`, { redirect: 'manual', headers: { 'User-Agent': 'zodiacs-programme-check' } });
    return { status: response.status, type: response.headers.get('content-type'), bytes: Buffer.from(await response.arrayBuffer()) };
  } catch (error) {
    return { status: 0, type: null, bytes: Buffer.alloc(0), error: String(error) };
  }
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const decode = (text) => text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/giu, (whole, dec, hex, name) => {
  if (dec) return String.fromCodePoint(Number(dec));
  if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[name.toLowerCase()] ?? whole;
});

const registry = JSON.parse(git('show', `${commit}:src/data/conventions/registry.json`));
const control = process.env.CONVENTIONS_CHECK_CONTROL ?? null;
if (control === 'renamed-id') {
  const first = registry.namespaces[0].entries[0];
  first.id = `${first.id}-control`;
  first.value = `${first.value}-control`;
} else if (control !== null) {
  throw new Error(`Unknown control ${control}`);
}
const ids = registry.namespaces.flatMap((space) => space.entries.map((entry) => entry.id));
const address = (id) => `${registry.base}#${encodeURI(id)}`;
const source = { commit, version: registry.version, ids: ids.length, namespaces: registry.namespaces.length, control };

let deployment = null;
if (aliasPath !== '-') {
  const raw = JSON.parse(await readFile(aliasPath, 'utf8'));
  deployment = Object.fromEntries(['deploymentId', 'aliasUpdatedAt', 'readyState', 'target', 'githubCommitSha'].map((key) => [key, raw[key]]));
  let containsCommit = false;
  try {
    git('merge-base', '--is-ancestor', commit, deployment.githubCommitSha);
    containsCommit = true;
  } catch {}
  check('the zodiacs.org alias names a READY production deployment built from a commit that contains the registry\'s commit',
    deployment.readyState === 'READY' && deployment.target === 'production' && containsCommit, { deployment, containsCommit });
}

const page = await get('/developers/conventions/');
const html = page.bytes.toString('utf8');
check('/developers/conventions/ is served as HTML', page.status === 200 && /text\/html/u.test(page.type ?? ''), { status: page.status, type: page.type });
const anchors = [...html.matchAll(/\sid="([^"]*)"/gu)].map((match) => decode(match[1]));
const anchorCounts = new Map();
for (const anchor of anchors) anchorCounts.set(anchor, (anchorCounts.get(anchor) ?? 0) + 1);
const unanchored = ids.filter((id) => anchorCounts.get(id) !== 1);
check(`every one of the ${ids.length} ids has exactly one anchor on the page`, page.status === 200 && unanchored.length === 0,
  { unanchored: unanchored.length, sample: unanchored.slice(0, 3) });
const links = new Set([...html.matchAll(/\shref="(#[^"]*)"/gu)].map((match) => decode(match[1])));
const unlinked = ids.filter((id) => !links.has(`#${encodeURI(id)}`));
check('every id links to its own address on the page', page.status === 200 && unlinked.length === 0, { unlinked: unlinked.length, sample: unlinked.slice(0, 3) });

// Chromium opens each id's address as a reader would, and must land on that id's entry.
const landed = [];
const missed = [];
let madeUp = null;
if (page.status === 200) {
  const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  try {
    const tab = await browser.newPage();
    const pageUrl = `${base}/developers/conventions/`;
    for (const id of ids) {
      await tab.goto(`${pageUrl}#${encodeURI(id)}`, { waitUntil: 'load' });
      const target = await tab.evaluate(() => document.querySelector(':target')?.id ?? null);
      (target === id ? landed : missed).push(target === id ? id : { id, target });
    }
    await tab.goto(`${pageUrl}#${encodeURI('zodiac:not-a-convention')}`, { waitUntil: 'load' });
    madeUp = await tab.evaluate(() => document.querySelector(':target')?.id ?? null);
  } finally {
    await browser.close();
  }
}
check(`Chromium lands on each id's entry from its address (${landed.length} of ${ids.length})`, landed.length === ids.length,
  { missed: missed.length, sample: missed.slice(0, 3) });
check('control: a made-up id\'s address lands on no entry', page.status === 200 && madeUp === null, { madeUp, status: page.status });

const json = await get('/developers/conventions/registry.json');
let served = null;
try { served = JSON.parse(json.bytes.toString('utf8')); } catch {}
const servedEntries = served?.namespaces?.flatMap((space) => space.entries) ?? [];
const expected = { ...registry, namespaces: registry.namespaces.map((space) => ({ ...space, entries: space.entries.map((entry) => ({ ...entry, uri: address(entry.id) })) })) };
check('registry.json is the commit\'s registry, with every id\'s address', json.status === 200 && JSON.stringify(served) === JSON.stringify(expected),
  { status: json.status, type: json.type, served: servedEntries.length });

const twin = await get('/developers/conventions.md');
const markdown = twin.bytes.toString('utf8');
// Each entry is a list item that opens with its id in code, "- `zodiac:tropical`: ...". Whole ids, not substrings: house:equal
// is part of house:equal-mc, and nutation:iau2000b of a longer nutation id.
const entryCounts = new Map();
for (const [, id] of markdown.matchAll(/^- `([^`]+)`:/gmu)) entryCounts.set(id, (entryCounts.get(id) ?? 0) + 1);
const unnamed = ids.filter((id) => entryCounts.get(id) !== 1);
check('the Markdown twin has exactly one entry for every id', twin.status === 200 && unnamed.length === 0,
  { status: twin.status, unnamed: unnamed.length, sample: unnamed.slice(0, 3), entries: entryCounts.size });

const index = await get('/developers/');
check('the developer index links to the registry', index.status === 200 && index.bytes.toString('utf8').includes('href="/developers/conventions/"'), { status: index.status });
const conformance = await get('/developers/conformance/');
check('the conformance page links its kinds to the registry', conformance.status === 200 && conformance.bytes.toString('utf8').includes('href="/developers/conventions/#ns-kind"'), { status: conformance.status });
const llms = await get('/llms.txt');
check('llms.txt lists the registry', llms.status === 200 && llms.bytes.toString('utf8').includes('https://zodiacs.org/developers/conventions/'), { status: llms.status });
const sitemap = await get('/sitemap.xml');
const entry = sitemap.bytes.toString('utf8').match(/<url>\s*<loc>https:\/\/zodiacs\.org\/developers\/conventions\/<\/loc>([\s\S]*?)<\/url>/u);
check('the sitemap lists the page with its date', sitemap.status === 200 && Boolean(entry) && entry[1].includes(`<lastmod>${registry.version}`), { status: sitemap.status, listed: Boolean(entry) });

const record = {
  checkedAt: new Date().toISOString(),
  base,
  deployment,
  registry: source,
  served: {
    page: { status: page.status, sha256: sha256(page.bytes), anchors: ids.length - unanchored.length },
    browser: { landed: landed.length, missed: missed.length, madeUp },
    json: { status: json.status, sha256: sha256(json.bytes), entries: servedEntries.length },
    markdown: { status: twin.status, sha256: sha256(twin.bytes) },
  },
  results,
  passed: results.filter((result) => result.ok).length,
  failed: results.filter((result) => !result.ok).length,
};
await writeFile(out, `${JSON.stringify(record, null, 2)}\n`);
console.log(`${record.passed} passed, ${record.failed} failed`);
process.exitCode = record.failed ? 1 : 0;
