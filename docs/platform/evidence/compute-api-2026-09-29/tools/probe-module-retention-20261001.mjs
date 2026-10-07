// Independent, local-only probe: copy committed bundles and expose read-only snapshots.
// No source/dependency edits and no network calls. All inputs are synthetic.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const out = mkdtempSync(resolve(tmpdir(), 'zodiacs-retention-'));
const revision = '9cfafa3e742de943062c9174338472781724a4b5';
const atRevision = path => execFileSync('git', ['show', `${revision}:${path}`], { cwd: root, encoding: 'utf8' });
const computeSource = atRevision('api/_compute/compute.mjs');
const localSource = atRevision('api/_compute/local-time.mjs');
const sdk = pathToFileURL(`${root}/node_modules/@vercel/firewall/dist/index.js`).href;
writeFileSync(`${out}/compute-inspected.mjs`, computeSource.replace('from "@vercel/firewall";', `from ${JSON.stringify(sdk)};`) + '\nexport function auditSnapshot() { return cache_e_tilt ? structuredClone(cache_e_tilt) : null; }\n');
writeFileSync(`${out}/local-time-inspected.mjs`, localSource + '\nexport function auditZoneKeys() { return { offset: [...offsetFormatters.keys()], wall: [...wallFormatters.keys()], histories: zoneHistories ? [...zoneHistories.keys()] : [] }; }\n');
writeFileSync(`${out}/time-basis.mjs`, atRevision('src/lib/engine/time-basis.mjs'));
const { timeBasis } = await import(pathToFileURL(`${out}/time-basis.mjs`).href);
const j2000 = Date.UTC(2000, 0, 1, 12);
function inverseTt(tt) { let utc = j2000 + tt * 86400000; for (let n = 0; n < 6; n++) utc += (tt - timeBasis(utc).ttDays) * 86400000; return new Date(Math.round(utc)).toISOString(); }
const compute = await import(pathToFileURL(`${out}/compute-inspected.mjs`).href);
const localTime = await import(pathToFileURL(`${out}/local-time-inspected.mjs`).href);
const handler = compute.createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' });
const globalsBefore = Reflect.ownKeys(globalThis).map(String).sort();
const snapshots = [{ label: 'before', tilt: compute.auditSnapshot(), zones: localTime.auditZoneKeys() }];
async function call(endpoint, body) {
  const bytes = Buffer.from(JSON.stringify(body));
  const req = Readable.from([bytes]);
  req.method = 'POST'; req.query = { __zodiacs_compute: endpoint };
  req.headers = { 'content-type': 'application/json', 'content-length': String(bytes.length) };
  const res = { setHeader() {}, end(text) { this.body = JSON.parse(text); } };
  await handler(req, res);
  if (res.statusCode !== 200) throw new Error(`Unexpected ${res.statusCode}`);
  await new Promise(resolve => setImmediate(resolve));
  return res.body;
}
// Warm the request-independent receipt conventions before the canary.
await call('positions', { instants: ['2000-01-01T12:00:00Z'] });
for (const utc of ['2071-11-23T11:58:09Z', '2082-03-14T05:29:17Z']) {
  const body = await call('chart', { utc, latitude: -31.55537, longitude: 159.07735 });
  const tilt = compute.auditSnapshot();
  snapshots.push({ label: 'after-chart', syntheticInput: utc, reconstructedUtcFromRetainedTtOnly: inverseTt(tilt.tt), reconstructionErrorMs: Date.parse(inverseTt(tilt.tt)) - Date.parse(utc), status: 200, tilt, tiltAsJ2000TT: new Date(Date.UTC(2000, 0, 1, 12) + tilt.tt * 86400000).toISOString(), responseDeltaTSeconds: body.result.deltaT.seconds, responseTimeScale: body.result.timeScale, zones: localTime.auditZoneKeys() });
}
await call('time', { local: { date: '1913-07-19', time: '04:37', zone: 'Australia/Lord_Howe' }, longitude: 159.07735 });
snapshots.push({ label: 'after-time', tilt: compute.auditSnapshot(), zones: localTime.auditZoneKeys() });
const globalsAfter = Reflect.ownKeys(globalThis).map(String).sort();
const report = { sourceCommit: '9cfafa3e742de943062c9174338472781724a4b5', node: process.version, computeSha256: createHash('sha256').update(computeSource).digest('hex'), localTimeSha256: createHash('sha256').update(localSource).digest('hex'), instrumentation: 'Only added read-only module-state snapshot functions; Firewall import resolves to installed SDK; limiter is an in-process allow stub; all synthetic input', networkCalls: 0, newGlobalNames: globalsAfter.filter(x => !globalsBefore.includes(x)), snapshots };
writeFileSync(`${out}/module-retention.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
