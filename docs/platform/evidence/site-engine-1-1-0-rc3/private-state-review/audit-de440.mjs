/**
 * Read-only DE440 server-state inventory for engine 1.1.0-rc.3 (P4.1). The
 * rc.16 inventory (../../site-engine-rc16/private-state-review/) runs the
 * default backend; this takes the same snapshot of every top-level binding of
 * the compute bundle around requests that the backend `de440` answers from
 * the deploy's sealed pack, opened by the adapter's own opener. It also checks
 * that each request's DE440 source, whose pack reader and reducer hold
 * buffers and decoded records from the request's instants, is unreachable
 * once the response is written, and a positive control keeps one source and
 * reads the request's dates back out of it.
 *
 *   node --expose-gc audit-de440.mjs [PACK]
 *
 * PACK defaults to api/_compute/precision/de440-1790-2210.zeph, which
 * scripts/build-precision-pack.mjs builds. JSON goes to stdout. No production
 * file is changed; the observers exist only in in-memory module instances.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

assert.equal(typeof globalThis.gc, 'function', 'run with node --expose-gc');
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const require = createRequire(join(root, 'package.json'));
const bundlePath = 'api/_compute/compute.mjs';
const filename = join(root, bundlePath);
const source = readFileSync(filename, 'utf8');
const packPath = process.argv[2] ?? join(root, 'api/_compute/precision/de440-1790-2210.zeph');
const pack = new Uint8Array(readFileSync(packPath));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const { createLocalTimeModule } = await import(pathToFileURL(join(root, 'api/_compute/local-time.mjs')).href);

// The bundle's top-level bindings, found as the rc.16 inventory finds them.
const program = ts.createProgram([filename], { allowJs: true, noResolve: true, noLib: true });
const tree = program.getSourceFile(filename);
assert.ok(tree);
const names = [];
for (const statement of tree.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
}
function once(text, from, to) {
  assert.equal(text.split(from).length, 2, `instrumentation marker: ${from}`);
  return text.replace(from, to);
}
let instrumented = once(source, 'from "@vercel/firewall";', `from ${JSON.stringify(pathToFileURL(require.resolve('@vercel/firewall')).href)};`);
// Observers only: each pack reader and each reducer records a weak reference to itself.
instrumented = once(instrumented, '  constructor(u8, header2) {\n', '  constructor(u8, header2) {\n    auditInstances.push(["reader", new WeakRef(this)]);\n');
instrumented = once(instrumented, '  constructor(backend) {\n    this.backend = backend;\n', '  constructor(backend) {\n    auditInstances.push(["reducer", new WeakRef(this)]);\n    this.backend = backend;\n');
instrumented += `\nexport const auditInstances = [];
export function inspectAll() { return { ${names.join(', ')} }; }
export function inspectLifetime() { return { frame: last ?? null, pluto: Object.keys(pluto_cache), moon: CalcMoonCount, deltaTReset: DeltaT === deltaT, source }; }
`;
let serial = 0;
const load = () => import(`data:text/javascript;base64,${Buffer.from(`${instrumented}\n// Isolated module instance ${serial++}\n`).toString('base64')}`);
const clean = { frame: null, pluto: [], moon: 0, deltaTReset: true, source: null };

function snapshotOf(module) {
  return Object.fromEntries(Object.entries(module.inspectAll()).map(([name, value]) => [name, sha256(JSON.stringify(value, (_key, item) => {
    if (item instanceof Map || item instanceof Set) return [...item];
    if (item instanceof WeakMap) return '[weak map: source-reviewed, not enumerated]';
    if (item instanceof WeakSet) return '[weak set: source-reviewed, not enumerated]';
    if (typeof item === 'function') return `function:${item.toString()}`;
    return item === undefined ? '[undefined]' : item;
  }))]));
}
/** One request through a new handler, as api/_compute/handler.ts makes one: its own resolver, the adapter's opener. */
async function run(module, endpoint, body, options = {}) {
  const localTime = createLocalTimeModule();
  let output = null;
  const response = { statusCode: 0, setHeader() {}, end(text) { output = text ? JSON.parse(text) : null; } };
  try {
    const handler = module.createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed', ...options });
    await handler({ method: 'POST', query: { __zodiacs_compute: endpoint }, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, response);
  } finally {
    localTime.dispose();
  }
  return { status: response.statusCode, body: output };
}
async function settle(module) {
  for (let i = 0; i < 3; i += 1) {
    await delay(0);
    globalThis.gc();
  }
  return module.auditInstances.filter(([, ref]) => ref.deref() !== undefined).map(([kind]) => kind);
}

const module = await load();
const opener = module.de440FromFile(async () => pack);
let kept = null;
let keep = false;
const precision = async () => {
  const opened = await opener();
  if (keep) kept = opened;
  return opened;
};
const de440 = { precision };
const place = { latitude: -31.55537, longitude: 159.07735 };
// Initialize the input-independent tables before the baseline, as rc.16's
// inventory does: both branches of the time basis (the IERS table and the
// model), and with DE440 the nutation series and the receipt statements of
// both backends. Initializing immutable data is expected and is not a leak.
for (const backend of ['de440', 'astronomy-engine']) {
  assert.equal((await run(module, 'positions', { instants: ['2000-01-01T12:00:00Z', '2082-03-14T05:29:17Z'], backend }, de440)).status, 200);
}
const baseline = snapshotOf(module);
assert.deepEqual(await settle(module), []);
const cases = [];
async function observe(label, endpoint, body, options, status, check = () => {}) {
  const result = await run(module, endpoint, body, options);
  assert.equal(result.status, status, `${label}: ${JSON.stringify(result.body)?.slice(0, 300)}`);
  check(result);
  const lifetime = module.inspectLifetime();
  assert.deepEqual(lifetime, clean, label);
  const after = snapshotOf(module);
  const changedBindings = names.filter(name => baseline[name] !== after[name]);
  assert.deepEqual(changedBindings, [], label);
  const alive = await settle(module);
  assert.deepEqual(alive, [], `${label}: a DE440 reader or reducer outlived the request`);
  cases.push({ label, endpoint, status, changedBindings, lifetime: { ...lifetime, source: lifetime.source === null ? null : 'set' }, readersAndReducersAlive: alive.length });
  return result;
}
// The response and its receipt (the engine's, for a chart; the compute receipt otherwise) name the pack.
const isDe440 = ({ body }) => {
  assert.deepEqual(body.backend.ephemeris, { name: 'jpl-de440', version: sha256(pack) });
  assert.equal(body.backend.pack.sha256, sha256(pack));
  assert.deepEqual(body.receipt.engine.ephemeris, { name: 'jpl-de440', version: sha256(pack) });
  assert.equal(body.receipt.conventions.moonPosition, 'ephemeris-geocentric-moon;light-time;solar-deflection;relativistic-aberration');
};
const fresh = [];
for (const utc of ['1800-01-01T12:00:00.002Z', '2000-01-01T12:00:00Z', '2026-10-01T00:00:00Z', '2199-12-31T12:00:00.002Z']) {
  const body = { utc, ...place, backend: 'de440' };
  const warmed = await observe(`chart ${utc}`, 'chart', body, de440, 200, isDe440);
  // The same request in a new module instance: the whole response, receipt and cite included.
  const isolated = await load();
  assert.deepEqual(await run(isolated, 'chart', body, { precision: isolated.de440FromFile(async () => pack) }), warmed);
  fresh.push(utc);
}
const utc = '2082-03-14T05:29:17.001Z';
await observe('positions', 'positions', { instants: [utc, '1913-07-19T04:37:00Z'], backend: 'de440' }, de440, 200, isDe440);
await observe('events', 'events', { from: utc, to: '2082-03-16T05:29:17Z', bodies: ['Moon', 'Mercury'], backend: 'de440' }, de440, 200, isDe440);
await observe('sky-fact', 'sky-fact', { kind: 'phase', phase: 'full', date: '1913-07-19', zone: 'Australia/Lord_Howe', backend: 'de440' }, de440, 200, isDe440);
await observe('elections', 'elections', {
  from: '2026-12-09T00:00:00Z', to: '2026-12-12T00:00:00Z',
  conditions: [{ kind: 'phase', phase: 'waxing' }, { kind: 'void-of-course', not: true }, { kind: 'retrograde', body: 'Mercury', not: true }, { kind: 'angular', body: 'Jupiter' }],
  place: { latitude: 51.5072, longitude: -0.1276, houseSystem: 'placidus' }, backend: 'de440',
}, de440, 200, isDe440);
await observe('DE440 as the default', 'chart', { utc, ...place }, { ...de440, defaultBackend: 'de440' }, 200, isDe440);
// Refusals: before the backend is chosen, and after it has been opened.
await observe('refused: unknown backend', 'chart', { utc, ...place, backend: 'DE440' }, de440, 400);
await observe('refused: longitude', 'chart', { utc, latitude: 0, longitude: 181, backend: 'de440' }, de440, 400);
await observe('refused: too many instants', 'positions', { instants: Array(101).fill(utc), backend: 'de440' }, de440, 422);
await observe('refused: no pack', 'chart', { utc, ...place, backend: 'de440' }, { precision: async () => null }, 503);
await observe('fallback: no pack, DE440 the default', 'chart', { utc, ...place }, { precision: async () => null, defaultBackend: 'de440' }, 200,
  ({ body }) => assert.deepEqual(body.backend.fallback, { from: 'de440', reason: 'pack-unavailable' }));
// A failure inside the calculation, with the source in place: the engine's
// synchronous finally must put astronomy-engine back.
let calls = 0;
const failing = async () => {
  const opened = await opener();
  return { ephemeris: opened.ephemeris, pack: opened.pack, trueNode: (tt) => opened.trueNode(tt), place(body, tt) { calls += 1; if (calls > 5) throw new Error('synthetic DE440 failure'); return opened.place(body, tt); } };
};
await observe('failure inside the calculation', 'chart', { utc, ...place, backend: 'de440' }, { precision: failing }, 500);
assert.ok(calls > 5);

// Positive control: a source kept past its request still holds the request's dates.
keep = true;
const target = '2082-03-14T05:29:17.001Z';
assert.equal((await run(module, 'chart', { utc: target, ...place, backend: 'de440' }, de440)).status, 200);
keep = false;
// Read in a function of its own, so that nothing of this control keeps the reader afterwards.
function keptMoonRecord() {
  const readers = module.auditInstances.filter(([kind, ref]) => kind === 'reader' && ref.deref() !== undefined).map(([, ref]) => ref.deref());
  assert.equal(readers.length, 1, 'the kept source keeps its reader');
  const { cachedRecord, initEt, intervalSec } = readers[0].bodies.get('moon');
  return { cachedRecord, initEt, intervalSec };
}
const moon = keptMoonRecord();
assert.ok(moon.cachedRecord >= 0);
const recordStart = moon.initEt + moon.cachedRecord * moon.intervalSec;
const isoOfEt = (et) => new Date(Date.UTC(2000, 0, 1, 12) + (et - 69.184) * 1000).toISOString();
// TDB seconds past J2000 to within a few minutes: TT − UTC is about 69 s now and within a few minutes in 2082.
const requestEt = (Date.parse(target) - Date.UTC(2000, 0, 1, 12)) / 1000 + 69.184 + 69;
assert.ok(requestEt >= recordStart - 86400 && requestEt <= recordStart + moon.intervalSec + 86400, 'the kept reader holds the Moon record of the request');
const positiveControl = {
  request: target,
  keptMoonRecord: { index: moon.cachedRecord, from: isoOfEt(recordStart), to: isoOfEt(recordStart + moon.intervalSec), intervalDays: moon.intervalSec / 86400 },
  requestInsideKeptRecord: true,
};
kept = null;
assert.deepEqual(await settle(module), [], 'released once nothing keeps it');
assert.deepEqual(module.inspectLifetime(), clean);
assert.deepEqual(names.filter(name => baseline[name] !== snapshotOf(module)[name]), []);

console.log(JSON.stringify({
  schemaVersion: 1,
  node: process.version,
  source: { path: bundlePath, sha256: sha256(source) },
  pack: { sha256: sha256(pack), bytes: pack.byteLength },
  globalsObserved: names.length,
  cases,
  freshModuleChartsCompared: fresh,
  positiveControl,
  readersAndReducersCreated: module.auditInstances.length,
  limits: [
    'Finite same-runtime regression observation with the deploy pack, supplemented by source review; not a proof for every input.',
    'Reachability is observed through V8 weak references after forced garbage collection (--expose-gc); unreachable is not erased: freed memory is not cleared.',
    'Weak collections are not enumerated, and function snapshots cannot enumerate captured closures, as in the rc.16 inventory.',
    'No independent accuracy, secure memory erasure or production-performance claim.',
  ],
}, null, 2));
