// Review A's finding A-1 of the earlier version 2 (bundle:
// docs/platform/evidence/precision-partition-v2/review/REVIEW-A.md, A-1),
// with the sweep exactly as `review/repro/findings.mjs` (A-1 block) codes it,
// pointed at any tree of the package. Synthetic packs only (the tree's own
// test/tier-a/_geometry.mjs packOf): a target crossing the line of sight
// near an emission-time record join at 3 days, the next record offset by
// `step` km; the truth is the pack's own piecewise-linear function.
//   node review-a1-sweep.mjs --tree=/path/to/examples/precision-alpha
// Post hoc and unscored: no rule of any version scores this sweep.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const arg = process.argv.find((a) => a.startsWith('--tree='));
if (!arg) { process.stderr.write('--tree=DIR is required\n'); process.exit(2); }
const TREE = pathToFileURL(resolve(arg.slice('--tree='.length))).href.replace(/\/$/, '');
const G = await import(`${TREE}/test/tier-a/_geometry.mjs`);
const RS = await import(`${TREE}/src/core/retarded-search.mjs`);
const { C_KM_S } = await import(`${TREE}/src/core/retarded.mjs`);
const { packOf, AT_REST, DAY, CE, SE } = G;
const X0 = 1e8;
const TAU0 = X0 / C_KM_S;
const out = { tree: arg.slice('--tree='.length), rungs: {} };
for (const [name, fn] of [['retarded', RS.searchRetardedLongitude], ['aberrated', RS.searchAberratedLongitude]]) {
  let fixtures = 0; let missedWhileEstablished = 0; let eventWithoutRootAtJump = 0; let established = 0; let declined = 0;
  const missedRows = [];
  for (const step of [0.07, 1, -0.07, -1]) {
    for (const eps of [-10, -1, -0.1, -1e-2, -1e-3, -1e-4, 1e-4, 1e-3, 1e-2, 0.1, 1, 10]) {
      const J = 3 * DAY;
      const r0 = J + eps;
      const eph = packOf((t) => { const p = (t - r0) + (t >= J ? step : 0); return [X0, p * CE, p * SE]; }, AT_REST.observer);
      const r = fn(eph, { body: 'Mars', targetDeg: 0, fromTdbSec: J - 2000, toTdbSec: J + 3000 });
      fixtures += 1;
      const roots = [];
      if (r0 < J) roots.push(eps);
      if (r0 - step >= J) roots.push(eps - step);
      const at = r.events.map((e) => (e.bracketTdbSec[0] + e.bracketTdbSec[1]) / 2 - TAU0 - J);
      const allFound = roots.every((x) => at.some((y) => Math.abs(y - x) < 2e-3));
      if (r.completeness.established) established += 1; else declined += 1;
      if (!allFound && r.completeness.established) { missedWhileEstablished += 1; missedRows.push({ step, eps, roots, foundAt: at.map((y) => +y.toFixed(4)) }); }
      if (at.some((y) => Math.abs(y) < 2e-3) && !roots.some((x) => Math.abs(x) < 2e-3)) eventWithoutRootAtJump += 1;
    }
  }
  out.rungs[name] = { fixtures, missedWhileEstablished, eventWithoutRootAtJump, established, declined, missedRows };
}
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
