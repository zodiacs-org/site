import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transform } from 'esbuild';
import { describe, expect, it } from 'vitest';

/*
 * Inspect the actual private state of the generated server modules, rather
 * than globalThis's property names. Test-only read access and references keep
 * request runtimes reachable for inspection; production has neither. Nothing
 * changes a computation or cleanup. The positive control bypasses only the
 * newly added cleanup, reproducing the old handler's retained exact TT.
 */
const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const require = createRequire(import.meta.url);

function once(source: string, from: string, to: string): string {
  expect(source.split(from).length, `instrumentation marker: ${from}`).toBe(2);
  return source.replace(from, to);
}

describe('compute API private module lifetime', () => {
  it('clears exact instants and selected caches on success, refusal and failure, without racing another resolver', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'compute-private-state-'));
    try {
      let compute = read('api/_compute/compute.mjs');
      compute = once(compute, 'from "@vercel/firewall";', `from ${JSON.stringify(pathToFileURL(require.resolve('@vercel/firewall')).href)};`);
      compute += `\nexport function auditEngineState() { return { frame: last ? structuredClone(last) : null, deltaTReset: DeltaT === deltaT, moonCalls: CalcMoonCount, plutoSegments: Object.keys(pluto_cache) }; }
export { createComputeApiHandler as auditUnwrappedHandler };
export let auditFailFrame = false;
export function auditSetFrameFailure(value) { auditFailFrame = value; }
`;
      compute = once(compute, '  return last;\n}', '  if (auditFailFrame) throw new Error(\"synthetic ephemeris failure\");\n  return last;\n}');
      writeFileSync(join(directory, 'compute.mjs'), compute);
      let local = read('api/_compute/local-time.mjs');
      local = once(local, 'return localTimeModule;', 'auditRuntimes.push(localTimeModule); return localTimeModule;');
      local = once(local, 'dispose() {', `
auditState() { return { offset: [...offsetFormatters.keys()], wall: [...wallFormatters.keys()], histories: zoneHistories ? [...zoneHistories.keys()] : [], pending: zoneHistoryLoads ? [...zoneHistoryLoads.keys()] : [] }; },
async prepareLocalTime(...args) { await prepareLocalTime(...args); if (auditAfterPrepare) await auditAfterPrepare(...args); },
dispose() {`);
      local += '\nexport const auditRuntimes = [];\nexport let auditAfterPrepare = null;\nexport function auditPause(fn) { auditAfterPrepare = fn; }\n';
      writeFileSync(join(directory, 'local-time.mjs'), local);
      // Real adapter, compiled without bundling, with the two inspected modules
      // beside it exactly as they are in the packaged function.
      const adapter = await transform(read('api/_compute/handler.ts'), { loader: 'ts', format: 'esm', target: 'node22' });
      writeFileSync(join(directory, 'handler.mjs'), adapter.code);
      const basis = pathToFileURL(join(root, 'src/lib/engine/time-basis.mjs')).href;
      writeFileSync(join(directory, 'run.mjs'), `
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import handler from './handler.mjs';
import { createComputeApiHandler, auditUnwrappedHandler, auditEngineState, auditSetFrameFailure } from './compute.mjs';
import { createLocalTimeModule, auditRuntimes, auditPause } from './local-time.mjs';
import { timeBasis } from ${JSON.stringify(basis)};
process.env.NODE_ENV = 'production';
let firewall = 204;
globalThis.fetch = async () => new Response(null, { status: firewall });
const utc = '2082-03-14T05:29:17Z';
const chart = { utc, latitude: -31.55537, longitude: 159.07735 };
const localChart = { local: { date: '1913-07-19', time: '04:37', zone: 'Australia/Lord_Howe' }, latitude: -31.55537, longitude: 159.07735 };
const empty = { offset: [], wall: [], histories: [], pending: [] };
const engineEmpty = () => assert.deepEqual(auditEngineState(), { frame: null, deltaTReset: true, moonCalls: 0, plutoSegments: [] });
const allEmpty = () => { engineEmpty(); for (const runtime of auditRuntimes) assert.deepEqual(runtime.auditState(), empty); };
async function run(entry, endpoint, body, extra = {}) {
  const bytes = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  const req = Readable.from([bytes]);
  req.method = extra.method ?? 'POST';
  req.query = { __zodiacs_compute: endpoint };
  req.headers = { host: 'zodiacs.org', 'x-real-ip': '203.0.113.7', 'content-type': 'application/json', 'content-length': String(bytes.length) };
  const res = { statusCode: 0, setHeader() {}, end(text) { this.text = text; extra.onEnd?.(); } };
  await entry(req, res);
  return { status: res.statusCode, body: res.text ? JSON.parse(res.text) : null };
}
if (process.argv[2] === 'fresh') {
  const { endpoint, body } = JSON.parse(process.argv[3]);
  const result = await run(handler, endpoint, body);
  allEmpty();
  console.log(JSON.stringify(result));
  process.exit(0);
}
function fresh(endpoint, body) {
  const result = spawnSync(process.execPath, ['--no-experimental-detect-module', process.argv[1], 'fresh', JSON.stringify({ endpoint, body })], { encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
const options = { localTime: createLocalTimeModule(), env: {}, rateLimit: async () => 'allowed' };
const old = auditUnwrappedHandler(options);
// Prime the input-independent receipt conventions, then retain a new canary.
await run(old, 'positions', { instants: ['2000-01-01T12:00:00Z'] });
const oldResult = await run(old, 'chart', chart);
const retained = auditEngineState();
assert.notEqual(retained.frame, null);
assert.ok(retained.plutoSegments.length > 0);
assert.ok(retained.moonCalls > 0);
let reconstructed = Date.UTC(2000, 0, 1, 12) + retained.frame.tt * 86400000;
for (let n = 0; n < 6; n++) reconstructed += (retained.frame.tt - timeBasis(reconstructed).ttDays) * 86400000;
// The last frame is the positive central-difference node sample, 0.25
// day after the request. Undo that documented sample offset to recover UTC.
assert.equal(Math.round(reconstructed) - 0.25 * 86400000, Date.parse(utc));
assert.equal(retained.frame.rows.length, 9);
assert.deepEqual(Object.keys(retained.frame.tilt), ['dpsi', 'deps', 'mobl', 'tobl', 'ee']);
// Same computation, new lifetime boundary. Inspect active state to ensure the
// observer reads the real caches, then prove cleanup after return.
const updated = await run(handler, 'chart', chart, { onEnd() { assert.notEqual(auditEngineState().frame, null); } });
assert.deepEqual(updated, oldResult);
allEmpty();
const inputs = {
  chart: localChart,
  houses: localChart,
  positions: { instants: [utc] },
  events: { from: utc, to: '2082-03-16T05:29:17Z', bodies: ['Moon', 'Mercury'] },
  time: { local: localChart.local, longitude: localChart.longitude },
  'sky-fact': { kind: 'phase', phase: 'full', date: '1913-07-19', zone: 'Australia/Lord_Howe' },
};
for (const [endpoint, body] of Object.entries(inputs)) {
  const result = await run(handler, endpoint, body);
  assert.equal(result.status, 200, endpoint);
  assert.equal(result.body.backend.name, '@zodiacs/engine');
  assert.equal(result.body.receipt.engine.name, '@zodiacs/engine');
  allEmpty();
  // Same-runtime fresh process, exact response comparison including receipt
  // and cite digest. This is regression parity, not independent accuracy.
  assert.deepEqual(result, fresh(endpoint, body), endpoint + ' fresh process');
}
for (const instant of ['1800-01-01T12:00:00.002Z', '2082-03-14T05:29:17.002Z', '2199-12-31T12:00:00.002Z']) {
  const body = { ...chart, utc: instant };
  assert.deepEqual(await run(handler, 'chart', body), fresh('chart', body));
  allEmpty();
}
// An engine failure after filling its frame must still restore DeltaT and
// clear both caches through the adapter's outer finally.
auditSetFrameFailure(true);
assert.equal((await run(handler, 'chart', chart)).status, 500);
allEmpty();
auditSetFrameFailure(false);
for (const [endpoint, body, extra, status] of [
  ['chart', chart, { method: 'GET' }, 405],
  ['chart', '{', {}, 400],
  ['chart', { ...localChart, longitude: 181 }, {}, 400],
  ['positions', { instants: Array(101).fill(utc) }, {}, 422],
]) {
  assert.equal((await run(handler, endpoint, body, extra)).status, status);
  allEmpty();
}
for (const status of [429, 404, 502]) {
  firewall = status;
  assert.equal((await run(handler, 'chart', localChart)).status, status === 429 ? 429 : 503);
  allEmpty();
}
firewall = 204;
// A resolver failure after its maps have been populated still disposes them.
auditPause(async () => { throw new Error('synthetic resolver failure'); });
assert.equal((await run(handler, 'chart', localChart)).status, 500);
allEmpty();
auditPause(null);
// The response writer can fail outside the handler's refusal catch.
await assert.rejects(() => run(handler, 'chart', localChart, { onEnd() { throw new Error('synthetic response failure'); } }), /synthetic response failure/);
allEmpty();
// Hold one fully prepared historical resolver while another request completes.
// A shared-map cleanup used to risk destroying the first request's history.
const firstBody = { local: { date: '1880-06-15', time: '12:00', zone: 'Europe/Paris' }, longitude: -4.4861 };
const expected = await run(handler, 'time', firstBody);
let release, ready;
const prepared = new Promise(resolve => { ready = resolve; });
const resume = new Promise(resolve => { release = resolve; });
auditPause(async (_date, zone) => { if (zone === 'Europe/Paris') { ready(); await resume; } });
const firstIndex = auditRuntimes.length;
const first = run(handler, 'time', firstBody);
await prepared;
assert.ok(auditRuntimes[firstIndex].auditState().histories.includes('europe/paris'));
const second = await run(handler, 'chart', localChart);
assert.equal(second.status, 200);
engineEmpty();
assert.deepEqual(auditRuntimes.at(-1).auditState(), empty);
assert.ok(auditRuntimes[firstIndex].auditState().histories.includes('europe/paris'));
release();
assert.deepEqual(await first, expected);
auditPause(null);
allEmpty();
console.log(JSON.stringify({ positiveControl: 'exact UTC recovered from pre-cleanup module state', endpoints: Object.keys(inputs), refusalAndFailureCleanup: true, interleavedResolverParity: true, freshProcessResponses: 9, engineExceptionCleanup: true, isolatedRuntimes: auditRuntimes.length }));
`);
      const result = spawnSync(process.execPath, ['--no-experimental-detect-module', join(directory, 'run.mjs')], {
        cwd: root, encoding: 'utf8', timeout: 60_000,
      });
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ refusalAndFailureCleanup: true, interleavedResolverParity: true });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 90_000);
});
