/**
 * Numerics review. Where is #860's worst regression P-2 span? Its committed
 * record (regression-run-v2.json) gives the worst approach, 0.33625742337004727
 * deg on F2, but no span positions; the record report reads its
 * widestBoundarySec (42.1875) as the widest boundary span, and the holdouts
 * report places a 42.19 s span after the EMB join of 1978-04-08.
 *
 * This reruns ONLY #860's cold partitioned path on F2 of the regression
 * corpus (development data, 1975 series; not a holdout), with the harness's
 * exact arguments, on the pack #860 evaluated on, checks its counts against
 * the committed record, and probes every boundary span as approachesFloor
 * does (65 instants through #860's tier-B deflected reference). About
 * 0.3 million evaluations. Prints times and angles only, never a coefficient.
 *
 *   nice -n 10 node check-regression-f2-join.mjs > regression-f2-join.json
 */
import { readFileSync } from 'node:fs';

const SCR = '<scratch>';
const SP = `${SCR}/p45/prior-versions`;
const HEAD = `${SP}/head/examples/precision-alpha`;
const PACK = `${SCR}/p42/base/D-de440s.sealed.zeph`;
const committed = JSON.parse(readFileSync(`${SP}/head/docs/platform/evidence/precision-partition/evaluation-v2/regression-run-v2.json`, 'utf8'));
const { openPackFile } = await import(`${HEAD}/src/node.mjs`);
const { makeDeflectedReference } = await import(`${HEAD}/test/tier-b/_deflected-reference.mjs`);
const { searchDeflectedOverPartition } = await import(`${HEAD}/src/core/partitioned-search.mjs`);
const { DEFLECTION_PROFILE } = await import(`${HEAD}/src/core/deflection.mjs`);

const rt = await openPackFile(PACK);
const eph = rt.ephemeris;
const ref = makeDeflectedReference(eph);
const packDigest = rt.integrity.computedDigest;
if (packDigest !== committed.packDigest) throw new Error(`pack ${packDigest} is not the committed run's ${committed.packDigest}`);
const DAY = 86400;
const J2000_UTC = Date.UTC(2000, 0, 1, 12);
const tdb = (iso) => (Date.parse(iso) - J2000_UTC) / 1000 + 69.184;
const c = committed.cases.find((x) => x.id === 'F2');
const from = tdb(c.from); const to = tdb(c.to);
const spec = { body: 'Moon', targetDeg: c.targetDeg, fromTdbSec: from, toTdbSec: to };
const part = searchDeflectedOverPartition(eph, {
  ...spec, packDigest, boundaryToleranceSec: committed.knobs.boundaryToleranceSec, relightWidthRatio: committed.knobs.relightWidthRatio,
  maxEvaluations: committed.budgets.maxEvaluations, maxCells: committed.budgets.maxCells,
});
function approachesFloor(lo, hi) {
  let best = Infinity; let at = null; let mn = Infinity; let mx = -Infinity;
  for (let k = 0; k <= 64; k += 1) {
    const t = lo + ((hi - lo) * k) / 64;
    const el = ref.elongationDeg('Moon', t);
    if (el === null) continue;
    const d = Math.abs(el - DEFLECTION_PROFILE.minElongationDeg);
    if (d < best) { best = d; at = t; }
    mn = Math.min(mn, el); mx = Math.max(mx, el);
  }
  return { closestApproachDeg: best, atTdbSec: at, minElDeg: mn, maxElDeg: mx };
}
const J2000_TDB_MS = Date.UTC(2000, 0, 1, 12);
const iso = (t) => `${new Date(J2000_TDB_MS + t * 1000).toISOString()} TDB`;
const series = (name) => eph.bodies.get(name);
const joinsNear = (t) => ['moon', 'emb', 'sun'].map((n) => { const s = series(n); const k = Math.round((t - s.initEt) / s.intervalSec); const j = s.initEt + k * s.intervalSec; return { series: n, join: j, joinIso: iso(j), offsetSec: t - j }; }).filter((x) => Math.abs(x.offsetSec) <= 120);
const probes = part.plan.boundary.map(([lo, hi]) => ({ span: [lo, hi], widthSec: hi - lo, isoLo: iso(lo), ...approachesFloor(lo, hi), joinsWithin120sOfStart: joinsNear(lo), joinsWithin120sOfEnd: joinsNear(hi) }));
const worst = probes.reduce((m, p) => (p.closestApproachDeg > m.closestApproachDeg ? p : m), { closestApproachDeg: -1 });
const cp = c.partition;
process.stdout.write(`${JSON.stringify({
  postHoc: 'regression corpus F2 (development data), #860 code, rerun only to locate the worst P-2 span; unscored',
  reproducesCommitted: {
    evaluations: [part.execution.evaluations, cp.evaluations], partitionEvaluations: [part.execution.partitionEvaluations, cp.partitionEvaluations], cells: [part.execution.cells, cp.cells],
    boundarySec: [part.accounting.boundarySec, cp.boundarySec], boundarySpans: [part.plan.boundary.length, cp.boundarySpans], widestBoundarySecField: [part.plan.diagnostics?.widestBoundarySec ?? null, cp.widestBoundarySec],
    worstP2: [worst.closestApproachDeg, c.p2.worstClosestApproachDeg],
  },
  widestCoalescedBoundarySpanSec: Math.max(...probes.map((p) => p.widthSec)),
  boundarySpanWidthsSec: probes.map((p) => p.widthSec),
  worst,
  spansWithAJoinAtAnEnd: probes.filter((p) => p.joinsWithin120sOfStart.length || p.joinsWithin120sOfEnd.length),
}, null, 1)}\n`);
