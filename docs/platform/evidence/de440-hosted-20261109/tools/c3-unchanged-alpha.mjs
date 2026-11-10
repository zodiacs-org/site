/**
 * Check C3 of PREREGISTRATION.md, run once in S2: rule (viii)'s gate applied
 * to the research runtime as it stands before any change of this unit (its
 * `Reducer` with `CORRECTED`, over the raw de440.bsp through
 * `tools/spk-backend.mjs`), against the chain's places in
 * ../oracles/erfa-places.json. The preregistration expects the gate to fail
 * for the Moon here (the geocentric Moon's epoch rounding, audit finding
 * alpha-reduction-math-8); if it does not, the oracle is at fault.
 *
 *   node docs/platform/evidence/de440-hosted-20261109/tools/c3-unchanged-alpha.mjs <de440.bsp>
 *
 * Writes ../oracles/c3-unchanged-alpha.json: per body, the largest angular
 * difference and the number of rows over 1e-6 arcsec.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORRECTED, Reducer } from '../../../../../examples/precision-alpha/src/core/reduce.mjs';
import { SpkBackend } from '../../../../../examples/precision-alpha/tools/spk-backend.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLES = join(HERE, '..', 'oracles');
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const GATE_ARCSEC = 1e-6;
const RAD = Math.PI / 180;

const kernel = process.argv[2];
const kernelSha = createHash('sha256').update(readFileSync(kernel)).digest('hex');
if (kernelSha !== 'a4ce9bf9b3282becc9f4b2ac3cebe03a2ae7599981aabd7265fd8482fff7c4b5') throw new Error(`not de440.bsp: ${kernelSha}`);
const places = JSON.parse(readFileSync(join(ORACLES, 'erfa-places.json'), 'utf8'));
const reducer = new Reducer(new SpkBackend(kernel));

const unit = (lon, lat) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
function angleArcsec(a, b) {
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return Math.atan2(Math.hypot(...c), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / RAD * 3600;
}

const byBody = {};
for (const row of places.rows) {
  const ttDays = (row.ttMs - J2000_MS) / 86_400_000;
  const r = reducer.apparent(row.body, ttDays, CORRECTED);
  const d = angleArcsec(unit(r.lon, r.lat), unit(Number(row.lon), Number(row.lat)));
  const b = (byBody[row.body] ??= { rows: 0, maxArcsec: 0, over: 0 });
  b.rows += 1;
  b.maxArcsec = Math.max(b.maxArcsec, d);
  if (d > GATE_ARCSEC) b.over += 1;
}
const moonFails = byBody.Moon.over > 0;
const out = {
  check: 'C3, PREREGISTRATION.md: rule (viii) on the unchanged research runtime, run once in S2',
  runtime: 'examples/precision-alpha (unchanged), Reducer with CORRECTED, over de440.bsp through tools/spk-backend.mjs',
  kernelSha256: kernelSha,
  oracle: { file: 'oracles/erfa-places.json', sha256: createHash('sha256').update(readFileSync(join(ORACLES, 'erfa-places.json'))).digest('hex') },
  node: process.version,
  gateArcsec: GATE_ARCSEC,
  byBody,
  expectation: 'the gate fails for the Moon',
  outcome: moonFails ? 'as expected: the gate fails for the Moon' : 'NOT as expected: the oracle is at fault (stop and repair, a departure)',
};
writeFileSync(join(ORACLES, 'c3-unchanged-alpha.json'), `${JSON.stringify(out, null, 1)}\n`);
console.log(out.outcome);
for (const [body, b] of Object.entries(byBody)) console.log(`${body.padEnd(8)} max ${b.maxArcsec.toExponential(3)} arcsec, over the gate ${b.over} of ${b.rows}`);
