/**
 * A RECONSTRUCTION, not a trace of the run: why #860's partition leaves
 * [J, J + 42.1875 s] boundary at the Moon's record join J = 1915-08-11
 * 00:00 TDB. It re-does, for three 42.1875-second cells at the join, the
 * steps of `classifyCell` and `localGeometry` in #860's
 * src/core/domain-partition.mjs, with #860's own exported functions
 * (stateEnclosure, withinOneRecord, mergedWeights, elongationCosInterval,
 * elongationCosCentred, classifyElongationCos). Those two functions are
 * not exported, so their logic is copied here line for line.
 *
 * One input differs from the run: the light-time interval T. The run used
 * an interval inherited and tightened down the bisection; here T is the
 * tier-B reference's light-time at the cell's ends and midpoint, padded by
 * 1e-3 s each side, which contains the true light-time (it varies by
 * microseconds over a cell) and is wider than the run's. A wider T can
 * only widen the enclosures. Prints derived widths only, no coefficient.
 *
 *   node mechanism.mjs --pack=... [--head=...] --out=mechanism-1915.json
 */
import { writeFileSync } from 'node:fs';

const args = new Map();
for (const a of process.argv.slice(2)) { const [k, v] = a.split('='); args.set(k.replace(/^--/, ''), v ?? true); }
const SCRATCH = '<scratch>/p45';
const HEAD = args.get('head') ?? `${SCRATCH}/prior-versions/head/examples/precision-alpha`;
const { openPackFile } = await import(`${HEAD}/src/node.mjs`);
const I = await import(`${HEAD}/src/core/interval.mjs`);
const R = await import(`${HEAD}/src/core/retarded.mjs`);
const D = await import(`${HEAD}/src/core/deflection.mjs`);
const { makeDeflectedReference } = await import(`${HEAD}/test/tier-b/_deflected-reference.mjs`);

const rt = await openPackFile(args.get('pack'));
const eph = rt.ephemeris;
const ref = makeDeflectedReference(eph);
const J = -2663236800;
const W = 42.1875;
const windowEnd = -2643537530.816; // the F2/A2 window's end; no cell here reaches it

const targets = R.targetWeights(eph, 'Moon');
const observer = R.observerWeights(eph);
const merged = R.mergedWeights(targets, observer);
const sun = R.targetWeights(eph, 'Sun');
const spend = () => {};

function lightTime(lo, hi) {
  const taus = [lo, (lo + hi) / 2, hi].map((t) => ref.direction('Moon', t).tau);
  return { lo: Math.min(...taus) - 1e-3, hi: Math.max(...taus) + 1e-3 };
}

function cell(lo, hi) {
  const T = lightTime(lo, hi);
  const halfOpen = hi < windowEnd;
  const one = (w, a, b) => R.withinOneRecord(eph, w, a, b, { halfOpen });
  const eligibility = {
    targetOverEmissionTimes: one(targets, lo - T.hi, hi),
    mergedOverCell: one(merged, lo, hi),
    observerOverCell: one(observer, lo, hi),
    sunOverCell: one(sun, lo, hi),
  };
  const local = Object.values(eligibility).every(Boolean);
  // classifyCell: the split enclosure
  const O = R.stateEnclosure(eph, observer, lo, hi, spend);
  const Rr = R.stateEnclosure(eph, targets, lo - T.hi, hi - T.lo, spend);
  const S = R.stateEnclosure(eph, sun, lo, hi, spend);
  const dSplit = I.vSub(Rr.pos, O.pos);
  const eRaw = I.vSub(O.pos, S.pos);
  const en = I.norm(eRaw);
  const e = [I.div(eRaw[0], en), I.div(eRaw[1], en), I.div(eRaw[2], en)];
  const distSplit = I.norm(dSplit);
  const cosSplit = D.elongationCosInterval(e, dSplit, distSplit);
  const out = {
    cell: [lo, hi],
    cellFromJoinSec: [lo - J, hi - J],
    lightTimeSec: T,
    localGeometryEligible: local,
    eligibility,
    splitForm: {
      dWidthKm: Math.max(...dSplit.map((x) => x.hi - x.lo)),
      cosWidth: cosSplit.hi - cosSplit.lo,
      verdict: D.classifyElongationCos(cosSplit),
    },
    mergedAndCentred: null,
  };
  if (local) {
    // localGeometry, then the meet and the centred form, as classifyCell does
    const tau = I.iv(T.lo, T.hi);
    const A = R.stateEnclosure(eph, merged, lo, hi, spend);
    const Wt = R.stateEnclosure(eph, targets, lo - T.hi, hi, spend);
    const retard = (vel) => I.vAdd(I.vMulI(vel, I.neg(tau)), I.vScale(Wt.acc, (T.hi * T.hi) / 2));
    const dLocal = I.vAdd(A.pos, retard(Wt.vel));
    const mid = (lo + hi) / 2;
    const half = Math.max(hi - mid, mid - lo);
    const Am = R.stateEnclosure(eph, merged, mid, mid, spend);
    const Vm = R.stateEnclosure(eph, targets, mid, mid, spend);
    const Om = R.stateEnclosure(eph, observer, mid, mid, spend);
    const Sm = R.stateEnclosure(eph, sun, mid, mid, spend);
    const dMid = I.vAdd(Am.pos, retard(Vm.vel));
    const distMid = I.norm(dMid);
    const uMid = I.vSub(Om.pos, Sm.pos);
    const enMid = I.norm(uMid);
    const cosMid = D.elongationCosInterval([I.div(uMid[0], enMid), I.div(uMid[1], enMid), I.div(uMid[2], enMid)], dMid, distMid);
    const d = I.vMeet(dSplit, dLocal);
    const dist = I.norm(d);
    let cos = D.elongationCosInterval(e, d, dist);
    const vT = I.vMag(Wt.vel);
    const vO = I.vMag(O.vel);
    const tauRate = (vT + vO) / (R.C_KM_S - vT);
    const dDot = I.vMag(A.vel) + T.hi * I.vMag(Wt.acc) + vT * tauRate;
    const rate = (I.vMag(I.vSub(O.vel, S.vel)) / en.lo + dDot / dist.lo) * (1 + 8 * I.PAD);
    const centred = D.elongationCosCentred(cosMid, cos, rate, half);
    if (centred) cos = I.meet(cos, centred) ?? cos;
    out.mergedAndCentred = {
      dWidthKm: Math.max(...d.map((x) => x.hi - x.lo)),
      cosWidth: cos.hi - cos.lo,
      verdict: D.classifyElongationCos(cos),
    };
  }
  out.referenceElongationDeg = [lo, (lo + hi) / 2, hi].map((t) => ref.elongationDeg('Moon', t));
  out.cosFloorMarginAtMid = Math.cos((ref.elongationDeg('Moon', (lo + hi) / 2) * Math.PI) / 180) - Math.cos((5 * Math.PI) / 180);
  return out;
}

const result = {
  tool: 'mechanism.mjs',
  note: 'a reconstruction with #860\'s exported functions and a wider light-time interval than the run used; not a trace of the run',
  join: J,
  joinIso: '1915-08-11T00:00:00 TDB',
  moonRecordLengthSec: eph.bodies.get('moon').intervalSec,
  cellWidthSec: W,
  cells: [cell(J - 2 * W, J - W), cell(J - W, J), cell(J, J + W), cell(J + W, J + 2 * W)],
};
writeFileSync(args.get('out'), `${JSON.stringify(result, null, 2)}\n`);
for (const c of result.cells) {
  process.stdout.write(`[${c.cellFromJoinSec.map((x) => x.toFixed(4)).join(', ')}] s: local eligible ${c.localGeometryEligible} ${JSON.stringify(c.eligibility)}; split cos width ${c.splitForm.cosWidth.toExponential(3)} -> ${c.splitForm.verdict}; merged+centred ${c.mergedAndCentred ? `${c.mergedAndCentred.cosWidth.toExponential(3)} -> ${c.mergedAndCentred.verdict}` : 'refused'}; cos margin to floor at mid ${c.cosFloorMarginAtMid.toExponential(3)}\n`);
}
