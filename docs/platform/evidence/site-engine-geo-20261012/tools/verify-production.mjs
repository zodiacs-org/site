/**
 * After the merge deploys: what canonical production serves for the site's
 * adoption of @zodiacs/engine/geo.
 *
 * - The resolver files: every file of a local build of the merge that holds the
 *   engine's zone histories (tzdb-2025c-NN), its resolver, or the site's adapter
 *   to it, served byte for byte, and each history file carrying the engine
 *   package's own data.
 * - The site's own resolver is gone: the files of the build before the merge
 *   that held it (its birthplace clock, history loader and mean-time table)
 *   are no longer served.
 * - The pages and files that describe the change, the MCP adapter it ships, and
 *   the compute API's own documented pre-1970 time request, sent once.
 *
 * Which deployment the zodiacs.org alias names, and its commit, is read before
 * and after this run through the Vercel connector and passed in as JSON
 * (ALIAS_BEFORE, ALIAS_AFTER). Prints JSON; exits non-zero on any failed check.
 *
 *   EXPECTED_COMMIT=<merge commit> ALIAS_BEFORE='{…}' \
 *     node verify-production.mjs <checkout of the merge> <dist of the merge> <dist of the base> > out.json
 *   ALIAS_AFTER='{…}' node verify-production.mjs --after out.json
 *
 * With --before in place of EXPECTED_COMMIT, the same files are read from the
 * production that precedes the merge, as the control: the engine's files are
 * not served yet and the site's own are.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const BASE = 'https://zodiacs.org';
const TZDB_SHA256 = '4aa79e4effee53fc4029ffe5f6ebe97937282ebcdf386d5d2da91ce84142f957';
const ENGINE_MARKERS = ['ZoneHistoryNotLoadedError', TZDB_SHA256];
const SITE_RESOLVER = /^(?:birthplace-clock|tz-history-load|tz-lmt)\.[A-Za-z0-9_-]+\.js$/u;
const HISTORY = /^tzdb-2025c-(\d{2})-[A-Z0-9]+\.[A-Za-z0-9_-]+\.js$/u;

const complete = (read, name) => {
  assert.ok(read && typeof read.deploymentId === 'string' && /^dpl_[A-Za-z0-9]+$/u.test(read.deploymentId),
    `${name} must name the deployment the alias points at`);
  assert.ok(Number.isInteger(read.aliasUpdatedAt) && read.aliasUpdatedAt > 0, `${name} must carry the alias's updatedAt`);
  return read;
};
if (process.argv[2] === '--after') {
  const record = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  const after = complete(JSON.parse(process.env.ALIAS_AFTER ?? 'null'), 'ALIAS_AFTER');
  complete(record.alias.before, 'the recorded ALIAS_BEFORE');
  record.alias.after = after;
  record.checks.push({ ...after, name: 'alias unchanged during the checks', ok: after.deploymentId === record.alias.before.deploymentId
    && after.aliasUpdatedAt === record.alias.before.aliasUpdatedAt });
  record.ok = record.checks.every((item) => item.ok);
  console.log(JSON.stringify(record, null, 2));
  if (!record.ok) process.exitCode = 1;
  process.exit();
}

const control = process.argv[2] === '--before';
const [rootArg, mergeDistArg, baseDistArg] = process.argv.slice(control ? 3 : 2);
const root = resolve(rootArg ?? '.');
const mergeDist = resolve(mergeDistArg ?? 'dist');
const baseDist = resolve(baseDistArg ?? '');
const expected = process.env.EXPECTED_COMMIT ?? '';
if (!control) assert.match(expected, /^[0-9a-f]{40}$/u, 'EXPECTED_COMMIT must be the full merge commit');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const mcp = JSON.parse(readFileSync(resolve(root, 'public/examples/mcp-server.json'), 'utf8'));
const examples = JSON.parse(readFileSync(resolve(root, 'src/lib/compute-api/examples.json'), 'utf8'));

async function get(path) {
  const response = await fetch(BASE + path, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30000) });
  return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
}
const checks = [];
const check = (name, ok, detail = {}) => checks.push({ ...detail, name, ok: Boolean(ok) });
const alias = control ? null : complete(JSON.parse(process.env.ALIAS_BEFORE ?? 'null'), 'ALIAS_BEFORE');
if (alias) {
  check('alias names a READY production deployment of the merge', alias.readyState === 'READY' && alias.target === 'production'
    && alias.githubCommitSha === expected, alias);
}

// The engine package's own history data: the value each tzdb-2025c-NN module exports.
// The site's build writes the same data as JSON.parse of a template literal, the
// package as JSON.parse of a quoted string, so the values are compared, not the text.
const engineDir = resolve(root, 'node_modules/@zodiacs/engine/dist');
const historyOf = async (path) => (await import(pathToFileURL(path).href)).default;
const engineHistories = new Map(await Promise.all(readdirSync(engineDir)
  .flatMap((name) => {
    const index = name.match(/^tzdb-2025c-(\d{2})-[A-Z0-9]+\.js$/u)?.[1];
    return index ? [historyOf(resolve(engineDir, name)).then((value) => [index, value])] : [];
  })));
assert.equal(engineHistories.size, 16, 'the engine package ships 16 history files');

// The resolver files of the merge's build, and what production serves at each path.
const assets = resolve(mergeDist, '_astro');
const resolverFiles = readdirSync(assets).filter((name) => name.endsWith('.js')).sort()
  .filter((name) => HISTORY.test(name) || ENGINE_MARKERS.some((marker) => readFileSync(resolve(assets, name), 'utf8').includes(marker)));
const histories = resolverFiles.filter((name) => HISTORY.test(name));
const served = [];
for (const name of resolverFiles) {
  const local = readFileSync(resolve(assets, name));
  const { status, bytes } = await get(`/_astro/${name}`);
  const index = name.match(HISTORY)?.[1];
  served.push({
    path: `/_astro/${name}`, status, bytes: bytes.length, sha256: sha256(bytes), localSha256: sha256(local),
    // The served bytes are the local file's (the check below), so its value is the served one.
    ...(index ? { engineData: status === 200 && sha256(bytes) === sha256(local)
      && isDeepStrictEqual(await historyOf(resolve(assets, name)), engineHistories.get(index)) } : {}),
  });
}
const identical = served.filter((file) => file.status === 200 && file.sha256 === file.localSha256);
check(`the build's ${resolverFiles.length} resolver files are served byte for byte`,
  histories.length === 16 && resolverFiles.length > 16 && identical.length === resolverFiles.length,
  { histories: histories.length, files: resolverFiles.length, identical: identical.length, served });
check('each served history file carries the engine package\'s tzdb 2025c data',
  served.filter((file) => file.engineData === true).length === 16, { matching: served.filter((file) => file.engineData === true).length });

// The site's own resolver, as the build before the merge split it.
const retired = readdirSync(resolve(baseDist, '_astro')).filter((name) => SITE_RESOLVER.test(name)).sort();
const gone = [];
for (const name of retired) gone.push({ path: `/_astro/${name}`, status: (await get(`/_astro/${name}`)).status });
check(`the site's own resolver files of the base build (${retired.length}) are not served`,
  retired.length === 3 && gone.every((file) => file.status === 404), { files: gone });

// Pages are compared as text, with tags removed and spaces collapsed.
const text = (bytes) => bytes.toString('utf8').replace(/<[^>]+>/gu, '').replace(/&#39;|&apos;/gu, "'").replace(/&quot;/gu, '"')
  .replace(/&amp;/gu, '&').replace(/\s+/gu, ' ');
for (const [path, needles] of [
  ['/developers/compute/', [
    'It reads the local time with @zodiacs/engine/geo, the resolver the birth chart calculator uses too',
    "without one the mean time of the zone's reference city",
    'which the engine ships, with or without a longitude, and zoneHistory is pinned',
  ]],
  ['/developers/mcp/', [mcp.version, mcp.sha256]],
  ['/llms.txt', [`(\`zodiacs-mcp-server\` ${mcp.version} over stdio`]],
  ['/llms-full.txt', [`\`zodiacs-mcp-server\` candidate version ${mcp.version} puts the same engine`]],
]) {
  const { status, bytes } = await get(path);
  const body = path.endsWith('.txt') ? bytes.toString('utf8') : text(bytes);
  const missing = needles.filter((needle) => !body.includes(needle));
  check(`${path} describes the adoption`, status === 200 && missing.length === 0, { status, missing });
}
const sitemap = await get('/sitemap.xml');
const lastmod = (loc) => sitemap.bytes.toString('utf8').match(new RegExp(`<loc>${BASE}${loc}</loc>[\\s\\S]*?<lastmod>([^<]+)</lastmod>`, 'u'))?.[1] ?? null;
const dates = Object.fromEntries(['/developers/compute/', '/developers/mcp/'].map((loc) => [loc, lastmod(loc)]));
check('the sitemap dates both pages 2026-10-12', sitemap.status === 200 && Object.values(dates).every((date) => date === '2026-10-12'),
  { status: sitemap.status, dates });

const manifest = await get('/examples/mcp-server.json');
check('MCP manifest is the committed one', manifest.status === 200 && manifest.bytes.toString('utf8') === readFileSync(resolve(root, 'public/examples/mcp-server.json'), 'utf8'),
  { status: manifest.status, sha256: sha256(manifest.bytes) });
const archive = await get(`/examples/${mcp.file}`);
check(`MCP adapter ${mcp.version} has the manifest digest`, archive.status === 200 && sha256(archive.bytes) === mcp.sha256 && archive.bytes.length === mcp.bytes,
  { status: archive.status, bytes: archive.bytes.length, sha256: sha256(archive.bytes) });

// The compute API's own documented pre-1970 time request (src/lib/compute-api/examples.ts, time.pinned):
// a wall time in Stockholm in 1947, no person's data. The answer must be the documented one, apart
// from the runtime's own tzdb release and the citation digest that covers it.
const documented = examples.success.time.pinned;
assert.match(readFileSync(resolve(root, 'src/lib/compute-api/examples.ts'), 'utf8'),
  /body: \{ local: \{ date: '1947-07-01', time: '12:00', zone: 'Europe\/Stockholm' \}, longitude: 18\.07 \}/u, 'the documented example is unchanged');
const response = await fetch(BASE + '/api/v1/time', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ local: { date: '1947-07-01', time: '12:00', zone: 'Europe/Stockholm' }, longitude: 18.07 }),
  cache: 'no-store', signal: AbortSignal.timeout(30000),
});
const answer = await response.json().catch(() => null);
const comparable = (value) => {
  if (!value) return null;
  const copy = structuredClone(value);
  delete copy.receipt?.timeResolution?.runtimeTzdb;
  delete copy.cite?.receipt;
  return copy;
};
check('the compute API reads 1947 Stockholm with @zodiacs/engine/geo, as documented', response.status === 200
  && JSON.stringify(comparable(answer)) === JSON.stringify(comparable(documented)),
  { status: response.status, result: answer?.result ?? null, timeResolution: answer?.receipt?.timeResolution ?? null });

const ok = checks.every((item) => item.ok);
console.log(JSON.stringify({ schema: 'zodiacs.engine-geo-production.v1', base: BASE, control, expectedCommit: expected || null,
  checkedAt: new Date().toISOString(), ...(alias ? { alias: { before: alias } } : {}), ok, checks }, null, 2));
if (!ok) process.exitCode = 1;
