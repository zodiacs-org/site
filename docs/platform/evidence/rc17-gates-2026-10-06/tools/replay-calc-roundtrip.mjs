/*
 * Replays the engine's calc round-trip fixtures against the engine the site
 * installs (the vendored rc.17 archive): each request, and each result's
 * receipt request, must give the fixture's result with the same keys and
 * every number within 1e-12 of it, relative to the number above 1 and
 * absolute below. The fixture is read from an engine checkout, not copied here; its
 * SHA-256 must be the one at rc.17's source commit, aae419c, which engine
 * main (782b496) carries unchanged. rc.16's tool, in
 * ../../rc16-gates-2026-10-04/tools/, which also counts the zodiac each
 * request names. Prints counts only, and exits 1 on any mismatch. Synthetic
 * instants and places only.
 *
 *   node docs/platform/evidence/rc17-gates-2026-10-06/tools/replay-calc-roundtrip.mjs \
 *     <engine checkout>/src/fixtures/calc-roundtrip.json \
 *     > docs/platform/evidence/rc17-gates-2026-10-06/results/calc-roundtrip-replay.json
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ENGINE_VERSION } from '@zodiacs/engine';
import * as calcEntry from '@zodiacs/engine/calc';

const FIXTURE_SHA256 = '3512922defa52d6d6ed43e5e7c6381236e05a69e0717a2d7d398cc9d13a02a81';
const bytes = readFileSync(process.argv[2]);
const digest = createHash('sha256').update(bytes).digest('hex');
if (digest !== FIXTURE_SHA256) throw new Error(`fixture SHA-256 ${digest}, expected ${FIXTURE_SHA256}`);
const { cases } = JSON.parse(bytes.toString('utf8'));
const run = { calc: calcEntry.calc, houses: calcEntry.houses, events: calcEntry.events, chart: calcEntry.chart };

let worst = 0;
const mismatches = [];
function compare(actual, expected, path) {
  if (typeof expected === 'number' && typeof actual === 'number') {
    const difference = Math.abs(actual - expected) / Math.max(1, Math.abs(expected));
    worst = Math.max(worst, difference);
    if (difference > 1e-12) mismatches.push(path);
    return;
  }
  if (expected !== null && typeof expected === 'object' && actual !== null && typeof actual === 'object') {
    if (Object.keys(actual).sort().join() !== Object.keys(expected).sort().join()) mismatches.push(`${path} keys`);
    for (const [key, value] of Object.entries(expected)) compare(actual[key], value, `${path}.${key}`);
    return;
  }
  if (actual !== expected) mismatches.push(path);
}

const byFunction = {};
const zodiacs = {};
const refusals = {};
const frames = new Set();
const centers = new Set();
const corrections = new Set();
let receiptReplays = 0;
for (const [index, fixture] of cases.entries()) {
  byFunction[fixture.function] = (byFunction[fixture.function] ?? 0) + 1;
  // tropical, a built-in ayanamsa's name, or "caller's" for a caller's own definition
  const sidereal = fixture.request.zodiac?.sidereal;
  const zodiac = sidereal === undefined ? 'tropical' : typeof sidereal === 'string' ? `sidereal ${sidereal}` : "sidereal, caller's";
  zodiacs[zodiac] = (zodiacs[zodiac] ?? 0) + 1;
  compare(JSON.parse(JSON.stringify(run[fixture.function](fixture.request))), fixture.result, `case ${index}`);
  if (fixture.result.receipt) {
    receiptReplays += 1;
    const replayed = run[fixture.function](JSON.parse(JSON.stringify(fixture.result.receipt.request)));
    compare(JSON.parse(JSON.stringify(replayed)), fixture.result, `case ${index} receipt`);
  }
  if (fixture.result.status === 'refused') refusals[fixture.result.reason] = (refusals[fixture.result.reason] ?? 0) + 1;
  if (fixture.function === 'calc' && fixture.result.status === 'ok') {
    const request = fixture.result.receipt.request;
    frames.add(request.frame);
    centers.add(typeof request.center === 'string' ? request.center : 'topocentric');
    corrections.add(request.flags.correction);
  }
}

const record = {
  schema: 'zodiacs.calc-roundtrip-replay.v1',
  fixture: { path: 'src/fixtures/calc-roundtrip.json', sha256: FIXTURE_SHA256, engineCommits: ['aae419c05b77455b9e8f03ca11ee273b446f7d02', '782b4963a8575fa8d81c602a36285f65fb9ae9bb'] },
  engine: ENGINE_VERSION,
  cases: cases.length,
  byFunction,
  zodiacs,
  receiptReplays,
  refusals,
  frames: [...frames].sort(),
  centers: [...centers].sort(),
  corrections: [...corrections].sort(),
  tolerance: 'the same keys, and each number within 1e-12 of the fixture\'s, relative above 1 and absolute below',
  worstRelativeDifference: worst,
  mismatches: mismatches.length,
};
process.stdout.write(`${JSON.stringify(record, null, 1)}\n`);
if (mismatches.length > 0) process.exitCode = 1;
