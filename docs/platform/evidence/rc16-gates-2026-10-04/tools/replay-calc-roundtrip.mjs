/*
 * Replays the engine's calc round-trip fixtures against the engine the site
 * installs (the vendored rc.16 archive): each request, and each result's
 * receipt request, must give the fixture's result to a relative 1e-12 and the
 * same keys. The fixture is read from an engine checkout, not copied here; its
 * SHA-256 must be the one at engine commit 23660f5 (and the release, ddbbaa0).
 * Prints counts only. Synthetic instants and places only.
 *
 *   node tools/replay-calc-roundtrip.mjs <engine checkout>/src/fixtures/calc-roundtrip.json > results/calc-roundtrip-replay.json
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ENGINE_VERSION } from '@zodiacs/engine';
import * as calcEntry from '@zodiacs/engine/calc';

const FIXTURE_SHA256 = 'b56ba1cf93f0cb0ac5a9abe0e3158fd7ddf222ab09726c66c65dc79eb687e874';
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
const refusals = {};
const frames = new Set();
const centers = new Set();
const corrections = new Set();
let receiptReplays = 0;
for (const [index, fixture] of cases.entries()) {
  byFunction[fixture.function] = (byFunction[fixture.function] ?? 0) + 1;
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
  fixture: { path: 'src/fixtures/calc-roundtrip.json', sha256: FIXTURE_SHA256, engineCommits: ['ddbbaa0b1d21e16834722f81e8708816849c6726', '23660f509fd9552d596966419fc982544fe06019'] },
  engine: ENGINE_VERSION,
  cases: cases.length,
  byFunction,
  receiptReplays,
  refusals,
  frames: [...frames].sort(),
  centers: [...centers].sort(),
  corrections: [...corrections].sort(),
  tolerance: 'relative 1e-12, and the same keys',
  worstRelativeDifference: worst,
  mismatches: mismatches.length,
};
process.stdout.write(`${JSON.stringify(record, null, 1)}\n`);
