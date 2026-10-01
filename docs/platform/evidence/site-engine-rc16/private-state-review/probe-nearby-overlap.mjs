/**
 * Read-only +1 ms regression probe against the actual rc.16 compute bundle.
 * Fresh here means a separately instantiated in-memory ESM module in the
 * same Node process. The Vitest private-state suite separately uses fresh OS
 * processes for nine exact response comparisons.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const require = createRequire(join(root, 'package.json'));
const bundlePath = 'api/_compute/compute.mjs';
const source = readFileSync(join(root, bundlePath), 'utf8');
const sha256 = value => createHash('sha256').update(value).digest('hex');
function once(text, from, to) {
  assert.equal(text.split(from).length, 2, `instrumentation marker: ${from}`);
  return text.replace(from, to);
}
const rewritten = once(source, 'from "@vercel/firewall";', `from ${JSON.stringify(pathToFileURL(require.resolve('@vercel/firewall')).href)};`);
let serial = 0;
async function make(clean = true) {
  const entry = clean ? rewritten : once(rewritten, 'createStatelessComputeApiHandler as createComputeApiHandler', 'createComputeApiHandler');
  const instrumented = `${entry}\n// Isolated module instance ${serial++}
export function inspectLifetime() { return { frame: last ? structuredClone(last) : null, pluto: Object.keys(pluto_cache), moon: CalcMoonCount, deltaTReset: DeltaT === deltaT }; }
export function basisForAudit(ms) { return timeBasis(ms); }
`;
  const module = await import(`data:text/javascript;base64,${Buffer.from(instrumented).toString('base64')}`);
  return { ...module, handler: module.createComputeApiHandler({ localTime: {}, env: {}, rateLimit: async () => 'allowed' }) };
}
async function run(module, body) {
  let output;
  const response = { setHeader() {}, end(text) { output = JSON.parse(text); } };
  await module.handler({ method: 'POST', query: { __zodiacs_compute: 'chart' }, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, response);
  assert.equal(response.statusCode, 200);
  return output;
}
const preceding = { utc: '2082-03-14T05:29:17.000Z', latitude: -31.55537, longitude: 159.07735 };
const target = { ...preceding, utc: '2082-03-14T05:29:17.001Z' };
const unwrapped = await make(false);
await run(unwrapped, preceding);
const warmed = await run(unwrapped, target);
const retained = unwrapped.inspectLifetime();
assert.ok(retained.frame && retained.pluto.length && retained.moon > 0);
let sampleMs = Date.UTC(2000, 0, 1, 12) + retained.frame.tt * 86400000;
for (let iteration = 0; iteration < 6; iteration++) sampleMs += (retained.frame.tt - unwrapped.basisForAudit(sampleMs).ttDays) * 86400000;
const recoveredRequestMs = Math.round(sampleMs) - 0.25 * 86400000;
assert.equal(recoveredRequestMs, Date.parse(target.utc));

const fresh = await run(await make(false), target);
const clean = await make();
await run(clean, preceding);
const sequential = await run(clean, target);
const overlapping = await make();
const completionStates = [];
const observed = body => run(overlapping, body).then(result => {
  const state = overlapping.inspectLifetime();
  assert.deepEqual(state, { frame: null, pluto: [], moon: 0, deltaTReset: true });
  completionStates.push(state);
  return result;
});
const answers = await Promise.all([observed(preceding), observed(target)]);
assert.deepEqual(warmed, fresh);
assert.deepEqual(sequential, fresh);
assert.deepEqual(answers[1], fresh);
console.log(JSON.stringify({
  schemaVersion: 1,
  node: process.version,
  source: { path: bundlePath, sha256: sha256(source) },
  preceding,
  target,
  positiveControl: {
    retainedFrame: retained.frame,
    retainedPlutoSegments: retained.pluto,
    retainedAggregateMoonCalls: retained.moon,
    deltaTReset: retained.deltaTReset,
    knownSampleOffsetDays: 0.25,
    recoveredRequestUtc: new Date(recoveredRequestMs).toISOString(),
  },
  unwrappedWarmedEqualsFreshIsolatedModule: true,
  cleanedSequentialEqualsFreshIsolatedModule: true,
  cleanedOverlappingEqualsFreshIsolatedModule: true,
  fullNumericalResponseReceiptAndCiteCompared: true,
  completionStates,
  limits: [
    'One synthetic +1 ms pair in one Node runtime; no claim of universal bitwise history independence.',
    'Fresh modules here share one process; nine fresh-process comparisons are in the independent focused Vitest run.',
    'No rounding normalization, tolerance, field removal or receipt-digest removal was applied to full-response equality.',
    'Recovered UTC uses binary64 TT inversion rounded to the API millisecond resolution and subtracts the documented +0.25-day node sample.',
    'The rc.15 aggregate Moon counter was already documented as a non-time diagnostic. Resetting it is a bounded tightening, not discovery of a new critical time leak.',
    'No independent accuracy, secure memory erasure or production-performance claim.',
  ],
}, null, 2));
