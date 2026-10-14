// A1.c and B3.b in production, after #742 merges. Run from a clone that has the merge commit:
//   node production-check.mjs <merge commit> <alias.json> [--control] > production.json
// alias.json holds what Vercel reported for the zodiacs.org alias and its deployment just before:
// deploymentId, aliasUpdatedAt, readyState, target, githubCommitSha; nothing else is read from it.
// Each check compares what zodiacs.org serves with the merge commit's own files:
// - the MCP adapter's manifest, byte for byte, and its rc.24 archive by the manifest's size and digest;
// - the place index (public/data/cities/index.json), byte for byte, with its `also` list (F-94);
// - the compute API's time endpoint, which resolve_birth_time runs, on its documented examples
//   (src/lib/compute-api/examples.json): a skipped wall time, a date written in the Julian calendar
//   with its calendar note, and a place of the time atlas read beside tzdb with the atlas's
//   uncertainty flag. Each answer must be the documented one, apart from the receipt field that names
//   the runtime's own tzdb release and the citation digest that covers it;
// - the atlas place's rules, from #742's reviews: tzdb reads the place on its own longitude (from the
//   commit's places.json) when none is sent, so Brest in 1880 agrees with the atlas within a second;
//   another longitude is refused at /longitude, a place outside local.zone at /atlasPlace and another
//   country at /country, each with the parser's own sentence.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BASE = 'https://zodiacs.org';
const [commit, aliasPath, flag] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/u.test(commit ?? '') || !aliasPath || (flag !== undefined && flag !== '--control')) {
  throw new Error('usage: production-check.mjs <40-hex commit> <alias.json> [--control]');
}
const control = flag === '--control';
const raw = JSON.parse(readFileSync(aliasPath, 'utf8'));
const alias = Object.fromEntries(['deploymentId', 'aliasUpdatedAt', 'readyState', 'target', 'githubCommitSha'].map((key) => [key, raw[key]]));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const show = (path) => execFileSync('git', ['show', `${commit}:${path}`], { maxBuffer: 256 * 1024 * 1024 });
const get = async (path) => {
  const response = await fetch(BASE + path, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30000) });
  return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
};

const checks = [];
const check = (name, ok, detail = {}) => checks.push({ ...detail, name, ok: Boolean(ok) });
check('the zodiacs.org alias names a READY production deployment built from the commit',
  alias.readyState === 'READY' && alias.target === 'production' && alias.githubCommitSha === commit, alias);

const manifestBytes = show('public/examples/mcp-server.json');
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const servedManifest = await get('/examples/mcp-server.json');
check("the MCP adapter's manifest is the commit's, byte for byte", servedManifest.status === 200 && servedManifest.bytes.equals(manifestBytes),
  { status: servedManifest.status, sha256: sha256(servedManifest.bytes), version: manifest.version });
const archive = await get(`/examples/${manifest.file}`);
check(`the MCP adapter ${manifest.version} archive has the manifest's size and digest`,
  archive.status === 200 && archive.bytes.length === manifest.bytes && sha256(archive.bytes) === manifest.sha256,
  { status: archive.status, bytes: archive.bytes.length, sha256: sha256(archive.bytes), supersedes: JSON.parse(show('examples/mcp-server/candidate.json').toString('utf8')).supersedes });

// The place index the site's search and search_places read, with the places filed under another letter (F-94).
const indexBytes = show('public/data/cities/index.json');
const servedIndex = await get('/data/cities/index.json');
check("the place index is the commit's, byte for byte, with its list of places filed under another letter",
  servedIndex.status === 200 && servedIndex.bytes.equals(indexBytes) && Object.keys(JSON.parse(indexBytes.toString('utf8')).also ?? {}).length > 0,
  { status: servedIndex.status, sha256: sha256(servedIndex.bytes) });

const examples = JSON.parse(show('src/lib/compute-api/examples.json').toString('utf8'));
const source = show('src/lib/compute-api/examples.ts').toString('utf8');
const comparable = (value) => {
  if (!value) return null;
  const copy = structuredClone(value);
  delete copy.receipt?.timeResolution?.runtimeTzdb;
  delete copy.cite?.receipt;
  return copy;
};
const requests = {
  gap: { local: { date: '2026-03-29', time: '02:30', zone: 'Europe/Paris' } },
  julian: { local: { date: '1917-10-25', time: '12:00', zone: 'Europe/Moscow' }, calendar: 'julian', country: 'RU' },
  atlas: { local: { date: '1916-06-01', time: '12:00', zone: 'Europe/Paris' }, atlasPlace: 'fr-strasbourg' },
};
const sourceText = {
  gap: "body: { local: { date: '2026-03-29', time: '02:30', zone: 'Europe/Paris' } }",
  julian: "body: { local: { date: '1917-10-25', time: '12:00', zone: 'Europe/Moscow' }, calendar: 'julian', country: 'RU' }",
  atlas: "body: { local: { date: '1916-06-01', time: '12:00', zone: 'Europe/Paris' }, atlasPlace: 'fr-strasbourg' }",
};
const names = {
  gap: 'a wall time the spring clock change skipped, flagged dst-gap',
  julian: 'a date written in the Julian calendar, converted, with the calendar note for its country',
  atlas: "a place of the time atlas, read beside tzdb with the atlas's rule, uncertainty flag and citations",
};
for (const key of ['gap', 'julian', 'atlas']) {
  const documented = examples.success.time[key];
  const response = await fetch(`${BASE}/api/v1/time`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requests[key]),
    cache: 'no-store', signal: AbortSignal.timeout(30000),
  });
  const answer = await response.json().catch(() => null);
  check(`the compute API's time endpoint answers ${names[key]}, as documented`,
    source.includes(sourceText[key]) && response.status === 200 && JSON.stringify(comparable(answer)) === JSON.stringify(comparable(documented)),
    { status: response.status, documentedRequest: source.includes(sourceText[key]), flags: answer?.result?.flags ?? null,
      atlas: key === 'atlas' ? (answer?.result?.atlas ? { secondsFromTzdb: answer.result.atlas.secondsFromTzdb ?? null } : null) : undefined });
}

const post = async (body) => {
  const response = await fetch(`${BASE}/api/v1/time`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    cache: 'no-store', signal: AbortSignal.timeout(30000),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
};
const brest = { local: { date: '1880-06-01', time: '12:00', zone: 'Europe/Paris' }, atlasPlace: 'fr-brest' };
const brestLongitude = JSON.parse(show('src/data/time-atlas/places.json').toString('utf8')).places.find((place) => place.id === 'fr-brest').longitude;
const read = await post(brest);
check("tzdb reads an atlas place on the place's own longitude when none is sent: Brest in 1880 agrees with the atlas within a second",
  read.status === 200 && read.json?.result?.localMeanTime?.longitude === brestLongitude && Math.abs(read.json?.result?.atlas?.secondsFromTzdb ?? Infinity) < 1,
  { status: read.status, longitude: read.json?.result?.localMeanTime?.longitude ?? null, secondsFromTzdb: read.json?.result?.atlas?.secondsFromTzdb ?? null });
const refusals = [
  ["another town's longitude with an atlas place is refused at /longitude", { ...brest, longitude: 2.35 }, '/longitude',
    "With atlasPlace, must be the place's own longitude, to 0.01°, or be left out, when the place's own is used."],
  ['an atlas place outside local.zone is refused at /atlasPlace', { local: { date: '1900-06-01', time: '12:00', zone: 'Europe/Paris' }, atlasPlace: 'us-new-york' }, '/atlasPlace',
    "Must be a place of the time atlas in local.zone, so that the atlas and tzdb read the same place's clock."],
  ["another country than the atlas place's is refused at /country", { local: { date: '1917-06-01', time: '12:00', zone: 'Europe/Paris' }, country: 'RU', atlasPlace: 'fr-paris' }, '/country',
    "With atlasPlace, must be the place's own country, FR or US, or be left out, so that the calendar history is that place's."],
];
for (const [name, body, pointer, message] of refusals) {
  const refused = await post(body);
  const error = refused.json?.error ?? null;
  check(name, refused.status === 400 && error?.code === 'invalid-request' && error?.pointer === pointer && error?.message === message,
    { status: refused.status, code: error?.code ?? null, pointer: error?.pointer ?? null, message: error?.message ?? null });
}

const passed = checks.filter((item) => item.ok).length;
console.log(JSON.stringify({ schema: 'zodiacs.birth-time-tools-production.v1', base: BASE, control, expectedCommit: commit, readAt: new Date().toISOString(), passed, of: checks.length, checks }, null, 2));
if (!control && passed !== checks.length) process.exitCode = 1;
