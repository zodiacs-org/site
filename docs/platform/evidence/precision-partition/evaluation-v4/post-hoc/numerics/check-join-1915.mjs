/**
 * Numerics review, post hoc and unscored. The 1915-08-11 join finding,
 * recomputed from the 1912 run's raw output (plan spans and P-2 probes) and,
 * for the P-2 number only, re-sampled through #860's tier-B deflected
 * reference exactly as the harness's approachesFloor samples it (65 instants).
 * About 200 reference calls; no search, no partition. Prints derived angles
 * and times only, never a coefficient.
 *
 *   node check-join-1915.mjs > join-1915-check.json
 */
import { readFileSync } from 'node:fs';

const SCR = '<scratch>';
const SP = `${SCR}/p45/prior-versions`;
const HEAD = `${SP}/head/examples/precision-alpha`;
const PACK = `${SCR}/p42/base/D-de440s.sealed.zeph`;
const J = (f) => JSON.parse(readFileSync(f, 'utf8'));
const run = J(`${SP}/results/holdouts/holdout-1912-run.json`);
const pstruct = J(`${SP}/results/holdouts/pack-structure.json`);
const bundle = J(`${SP}/bundle/docs/platform/evidence/precision-partition-v2/holdout/run.json`);

const { openPackFile } = await import(`${HEAD}/src/node.mjs`);
const { makeDeflectedReference } = await import(`${HEAD}/test/tier-b/_deflected-reference.mjs`);
const rt = await openPackFile(PACK);
if (rt.integrity.computedDigest !== run.packDigest) throw new Error('pack differs from the run');
const ref = makeDeflectedReference(rt.ephemeris);

const JOIN = -2663236800;
const moon = pstruct.head.series.moon;
const k = (JOIN - moon.initEt) / moon.intervalSec;
const J2000 = Date.UTC(2000, 0, 1, 12);
const tdbIso = (t) => new Date(J2000 + t * 1000).toISOString();

function probe(body, [lo, hi]) {
  const n = 64; let best = Infinity; let mn = Infinity; let mx = -Infinity; let argBest = null; let refusals = 0; let monotoneUp = true; let prev = -Infinity;
  for (let i = 0; i <= n; i += 1) {
    const t = lo + ((hi - lo) * i) / n;
    const el = ref.elongationDeg(body, t);
    if (el === null) { refusals += 1; continue; }
    if (el < prev) monotoneUp = false; prev = el;
    const d = Math.abs(el - 5);
    if (d < best) { best = d; argBest = t; }
    mn = Math.min(mn, el); mx = Math.max(mx, el);
  }
  return { closestApproachDeg: best, atTdbSec: argBest, minElDeg: mn, maxElDeg: mx, monotoneIncreasing: monotoneUp, refusals };
}

const out = { postHoc: 'post hoc and unscored; the 1912 holdout is previously seen data for #860', join: JOIN, joinIso: tdbIso(JOIN), moonRecordIndex: k, isMoonRecordEdge: Number.isInteger(k), cases: {} };
for (const id of ['F2', 'A2']) {
  const c = run.cases.find((x) => x.id === id);
  const plan = c.spans.partition;
  const all = [];
  for (const cls of ['admissible', 'excluded', 'boundary', 'unprocessed']) for (const s of plan[cls]) all.push({ cls, s });
  all.sort((a, b) => a.s[0] - b.s[0]);
  let contiguous = all[0].s[0] === c.spans.partition.admissible.concat(c.spans.partition.excluded, c.spans.partition.boundary).reduce((m, s) => Math.min(m, s[0]), Infinity);
  for (let i = 1; i < all.length; i += 1) if (all[i].s[0] !== all[i - 1].s[1]) contiguous = false;
  const idx = all.findIndex((x) => x.s[0] <= JOIN && JOIN <= x.s[1] && x.cls === 'boundary');
  const hit = all[idx];
  const recorded = c.p2AllProbes.find((p) => p.span[0] === hit.s[0] && p.span[1] === hit.s[1]);
  const fresh = probe('Moon', hit.s);
  out.cases[id] = {
    planContiguous: contiguous,
    spansTouchingJoin: all.filter((x) => x.s[0] <= JOIN && JOIN <= x.s[1]).map((x) => ({ cls: x.cls, span: x.s })),
    joinSpan: hit.s, joinSpanWidthSec: hit.s[1] - hit.s[0], before: all[idx - 1].cls, beforeSpan: all[idx - 1].s, after: all[idx + 1].cls, afterSpan: all[idx + 1].s,
    recordedProbe: recorded,
    recomputedProbe: fresh,
    recordedEqualsRecomputed: Object.is(recorded.closestApproachDeg, fresh.closestApproachDeg),
    otherBoundaryWorstDeg: Math.max(...c.p2AllProbes.filter((p) => p !== recorded).map((p) => p.closestApproachDeg)),
  };
}
// the bundle's version 2 span at the same join, re-sampled on THIS pack through #860's reference
const bspan = bundle.rules.v2.P2.worstCases[0].failingSpans[0];
out.bundleV2 = { span: bspan.span, widthSec: bspan.widthSec, recordedOnItsPack: bspan.closestApproachDeg, resampledOnThisPack: probe('Moon', bspan.span) };
out.elongationAt = Object.fromEntries([-42.1875, 0, 42.1875, 84.375].map((d) => [String(d), ref.elongationDeg('Moon', JOIN + d)]));
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
