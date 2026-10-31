// Review B's findings B-1, B-2, B-3, B-4 and B-5 of the earlier version 2
// (bundle: docs/platform/evidence/precision-partition-v2/review/REVIEW-B.md),
// coded exactly as that review's reproduction, review/repro/findings.mjs
// ("B-1 to B-8" block), pointed at any tree. Synthetic pack only
// (the tree's own examples/synthetic-pack.mjs).
//   node review-b-plan-checks.mjs --tree=/path/to/examples/precision-alpha
// Post hoc and unscored: no rule of any version scores these checks.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const arg = process.argv.find((a) => a.startsWith('--tree='));
if (!arg) { process.stderr.write('--tree=DIR is required\n'); process.exit(2); }
const TREE = pathToFileURL(resolve(arg.slice('--tree='.length))).href.replace(/\/$/, '');
const G = await import(`${TREE}/test/tier-a/_geometry.mjs`);
const { openPackFromBytes } = await import(`${TREE}/src/index.mjs`);
const { buildSyntheticPack } = await import(`${TREE}/examples/synthetic-pack.mjs`);
const DP = await import(`${TREE}/src/core/domain-partition.mjs`);
const PS = await import(`${TREE}/src/core/partitioned-search.mjs`);
const { DAY } = G;
const out = {};
const line = (id, x) => { out[id] = x; };
const attempt = (f) => { try { return { ok: f() }; } catch (e) { return { threw: e.code ?? e.name, message: String(e.message).slice(0, 140) }; } };
const rt = await openPackFromBytes(await buildSyntheticPack());
const eph = rt.ephemeris;
const MARS = { body: 'Mars', fromTdbSec: -38 * DAY, toTdbSec: 38 * DAY };
const copy = (p) => JSON.parse(JSON.stringify(p));
const run = (over) => PS.searchDeflectedOverPartition(eph, { ...MARS, targetDeg: 95, ...over });
const whole = DP.partitionDomain(eph, MARS);
{
  const a = copy(whole);
  a.execution.status = 'budget-exhausted'; a.execution.finished = false;
  const r = attempt(() => run({ plan: a, acceptImportedPlan: true, acceptPartialPlan: true }));
  line('B-2', r.ok ? { accepted: true, finished: r.ok.execution.finished, overRequest: r.ok.completeness.overRequest } : r);
}
{
  const b = copy(whole);
  const [[lo, hi]] = b.admissible; const m = (lo + hi) / 2;
  b.admissible = [[lo, m]]; b.unprocessed = [[m, hi]];
  const r = attempt(() => run({ plan: b, acceptImportedPlan: true, acceptPartialPlan: true }));
  line('B-1', r.ok ? { accepted: true, finished: r.ok.execution.finished, unprocessedSec: r.ok.accounting.unprocessedSec } : r);
}
{
  const c = copy(whole);
  delete c.execution;
  line('B-5', attempt(() => run({ plan: c, acceptImportedPlan: true, acceptPartialPlan: true }).execution.status));
}
{
  const cancelled = DP.partitionDomain(eph, { ...MARS, signal: { aborted: true } });
  line('B-3', attempt(() => run({ plan: cancelled, acceptPartialPlan: true, tauPadFactor: 64, bogusOption: 1 }).execution.status));
}
{
  const o = {};
  for (const [k, v] of [['maxEvaluations', 0], ['relightWidthRatio', -3], ['tauPadFloorSec', -1]]) {
    const r = attempt(() => DP.partitionDomain(eph, { body: 'Venus', fromTdbSec: -DAY, toTdbSec: DAY, [k]: v }));
    o[`${k}=${v}`] = r.ok ? { accepted: true, status: r.ok.execution.status, evaluations: r.ok.execution.evaluations } : r;
  }
  line('B-4', o);
}
rt.dispose?.();
process.stdout.write(`${JSON.stringify({ tree: arg.slice('--tree='.length), ...out }, null, 1)}\n`);
