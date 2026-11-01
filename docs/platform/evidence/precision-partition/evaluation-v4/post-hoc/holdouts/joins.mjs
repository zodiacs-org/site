/**
 * The record-join check, post hoc and unscored, on the output of
 * holdout-driver.mjs.
 *
 *   node joins.mjs --run=holdout-1912-run.json --pack=... [--head=...] \
 *        [--earlier=<bundle run.json>] [--earlierVersion=v2] --out=joins-1912.json
 *
 * For each Moon case of the run:
 *  1. The record joins of the Moon's stored series ('moon') inside the
 *     window, from the pack's record structure (initEt + k * intervalSec):
 *     times only, no coefficient is read or printed. The EMB ('emb') and Sun
 *     ('sun') series' joins are listed too, as a supplement beyond the ask.
 *  2. The floor crossings, found independently through the tier-B deflected
 *     reference: elongation sampled every 300 s (the harness's Moon STEP)
 *     over the window, each sign change of (elongation - 5 deg) bisected to
 *     1e-3 s. Two crossings closer than one step could be missed; the step
 *     is reported.
 *  3. Every join within 0.5 day (43,200 s) of a floor crossing, plus the
 *     1915-08-11 00:00 TDB join by name wherever it lies in a window.
 *  4. For each such join, every boundary or unresolved span within one day
 *     (86,400 s) of it, from #860's partitioned path (plan boundary spans,
 *     and the subsearches' unresolved spans) and #860's plain deflected
 *     search (unresolved runs): its length, its position against the join,
 *     and its distance from the floor sampled exactly as P-2 samples it (65
 *     instants, lo + (hi - lo) k / 64, min |elongation - 5 deg|), with the
 *     min and max elongation of those samples beside it. The neighbouring
 *     plan spans' classes are given so a span inside an excluded run can be
 *     told from a transition.
 *  5. Where --earlier is given, the same spans from that earlier run's
 *     record (its own pack), for side-by-side reading.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = new Map();
for (const a of process.argv.slice(2)) { const [k, v] = a.split('='); args.set(k.replace(/^--/, ''), v ?? true); }
const SCRATCH = '<scratch>/p45';
const HEAD = args.get('head') ?? `${SCRATCH}/prior-versions/head/examples/precision-alpha`;
const RUN = JSON.parse(readFileSync(args.get('run'), 'utf8'));
const PACK = args.get('pack');
const OUT = args.get('out');
const EARLIER = args.get('earlier') ? JSON.parse(readFileSync(args.get('earlier'), 'utf8')) : null;
const EARLIER_VERSIONS = (args.get('earlierVersions') ?? 'v1,v2').split(',');

const { openPackFile } = await import(`${HEAD}/src/node.mjs`);
const { makeDeflectedReference } = await import(`${HEAD}/test/tier-b/_deflected-reference.mjs`);
const { DEFLECTION_PROFILE } = await import(`${HEAD}/src/core/deflection.mjs`);
const rt = await openPackFile(PACK);
const eph = rt.ephemeris;
const ref = makeDeflectedReference(eph);
if (rt.integrity.computedDigest !== RUN.packDigest) throw new Error('not the pack the run used');

const FLOOR = DEFLECTION_PROFILE.minElongationDeg;
const DAY = 86400;
const HALF_DAY = 43200;
const STEP_SEC = 300;
const P2_APPROACH_DEG = 0.5;
const DECISIVE_JOIN = -2663236800; // 1915-08-11 00:00:00 TDB
const J2000_TDB_MS = Date.UTC(2000, 0, 1, 12);
const tdbIso = (t) => `${new Date(J2000_TDB_MS + t * 1000).toISOString().replace('.000Z', '')} TDB`;

/** P-2 exactly as the harness samples it, plus the extremes it saw. */
function probe(body, [lo, hi]) {
  const n = 64;
  let best = Infinity; let min = Infinity; let max = -Infinity; let refusals = 0;
  for (let k = 0; k <= n; k += 1) {
    const t = lo + ((hi - lo) * k) / n;
    const el = ref.elongationDeg(body, t);
    if (el === null) { refusals += 1; continue; }
    best = Math.min(best, Math.abs(el - FLOOR));
    min = Math.min(min, el); max = Math.max(max, el);
  }
  return {
    closestApproachDeg: Number.isFinite(best) ? best : null,
    p2Pass: Number.isFinite(best) && best <= P2_APPROACH_DEG,
    minElongationDeg: Number.isFinite(min) ? min : null,
    maxElongationDeg: Number.isFinite(max) ? max : null,
    refusals,
    samples: n + 1 - refusals,
  };
}

/** Floor crossings by the reference, independent of every enclosure. */
function floorCrossings(body, a, b) {
  const g = (t) => { const el = ref.elongationDeg(body, t); return el === null ? null : el - FLOOR; };
  const out = [];
  let refusals = 0;
  let pt = a; let pg = g(a);
  const n = Math.ceil((b - a) / STEP_SEC);
  for (let i = 1; i <= n; i += 1) {
    const t = i === n ? b : a + i * STEP_SEC;
    const cg = g(t);
    if (cg === null || pg === null) { refusals += 1; pt = t; pg = cg; continue; }
    if (pg === 0) out.push({ tdbSec: pt, direction: 'touch' });
    else if (Math.sign(cg) !== Math.sign(pg) && cg !== 0) {
      let lo = pt; let hi = t; let glo = pg;
      while (hi - lo > 1e-3) {
        const m = (lo + hi) / 2;
        if (!(m > lo && m < hi)) break;
        const gm = g(m);
        if (gm === null) break;
        if (Math.sign(gm) === Math.sign(glo)) { lo = m; glo = gm; } else hi = m;
      }
      out.push({ tdbSec: (lo + hi) / 2, bracketTdbSec: [lo, hi], direction: pg > 0 ? 'ingress (elongation falls below the floor)' : 'egress (elongation rises above the floor)' });
    }
    pt = t; pg = cg;
  }
  return { crossings: out, stepSec: STEP_SEC, samples: n + 1, refusals };
}

function joinsOf(series, a, b) {
  const s = eph.bodies.get(series);
  const out = [];
  const first = Math.ceil((a - s.initEt) / s.intervalSec);
  for (let k = first; ; k += 1) {
    const t = s.initEt + k * s.intervalSec;
    if (t >= b) break;
    if (t > a) out.push({ series, recordIndexStartingHere: k, tdbSec: t, tdbIso: tdbIso(t) });
  }
  return { series, recordLengthSec: s.intervalSec, joins: out };
}

/** Which plan class is on each side of a span. */
function neighbours(plan, [lo, hi]) {
  const all = [];
  for (const cls of ['admissible', 'excluded', 'boundary', 'unprocessed']) for (const s of plan[cls] ?? []) all.push({ cls, s });
  all.sort((x, y) => x.s[0] - y.s[0]);
  const before = all.filter((x) => x.s[1] <= lo).pop() ?? null;
  const after = all.find((x) => x.s[0] >= hi) ?? null;
  return {
    before: before ? { class: before.cls, span: before.s, adjacent: before.s[1] === lo } : null,
    after: after ? { class: after.cls, span: after.s, adjacent: after.s[0] === hi } : null,
  };
}

const near = (span, J, reach) => span[0] <= J + reach && span[1] >= J - reach;
function describeSpan(body, span, J, extra = {}) {
  return {
    ...extra,
    span,
    spanIso: [tdbIso(span[0]), tdbIso(span[1])],
    lengthSec: span[1] - span[0],
    startMinusJoinSec: span[0] - J,
    endMinusJoinSec: span[1] - J,
    containsJoin: span[0] <= J && J <= span[1],
    touchesJoin: span[0] === J || span[1] === J,
    ...probe(body, span),
  };
}

function spansNearJoin(row, J) {
  const body = row.body;
  const plan = row.spans.partition;
  const out = [];
  for (const s of plan.boundary) if (near(s, J, DAY)) out.push(describeSpan(body, s, J, { source: '#860 partitioned path: plan boundary span', neighbours: neighbours(plan, s) }));
  for (const u of plan.unresolved) if (near(u.span, J, DAY)) out.push(describeSpan(body, u.span, J, { source: `#860 partitioned path: unresolved span of a subsearch (domain ${u.domain})`, cells: u.cells, why: u.why }));
  for (const u of row.spans.baseline.unresolved) if (near(u.span, J, DAY)) out.push(describeSpan(body, u.span, J, { source: '#860 plain deflected search: unresolved run', cells: u.cells, why: u.why }));
  return out.sort((x, y) => x.span[0] - y.span[0]);
}

function earlierSpansNearJoin(caseId, body, J) {
  if (!EARLIER) return null;
  const out = {};
  for (const v of EARLIER_VERSIONS) {
    const r = EARLIER.runs?.[caseId]?.[v];
    if (!r) continue;
    const list = [];
    for (const s of r.part?.plan?.boundary ?? []) if (near(s, J, DAY)) list.push(describeSpan(body, s, J, { source: `earlier ${v} partitioned path: plan boundary span (its own pack, compiler 1.0.0)` }));
    for (const s of r.base?.unresolved ?? []) if (near(s, J, DAY)) list.push(describeSpan(body, s, J, { source: `earlier ${v} plain search: unresolved run (its own pack)` }));
    out[v] = list.sort((x, y) => x.span[0] - y.span[0]);
  }
  return out;
}

const result = {
  tool: 'joins.mjs',
  postHoc: 'post hoc and unscored: these holdouts were opened by earlier versions and are previously seen data for #860.',
  run: args.get('run'),
  label: RUN.label,
  packDigest: RUN.packDigest,
  floorDeg: FLOOR,
  method: {
    joins: 'record edges initEt + k * intervalSec of the stored series, strictly inside the window; times only',
    crossings: `tier-B deflected reference, elongation every ${STEP_SEC} s, sign changes of (elongation - ${FLOOR}) bisected to 1e-3 s`,
    selection: 'Moon-series joins within 43,200 s of a reference floor crossing, plus the 1915-08-11 00:00 TDB join wherever it lies in a window',
    spans: 'boundary or unresolved spans meeting [J - 86,400 s, J + 86,400 s]',
    p2: '65 samples, lo + (hi - lo) k / 64, min |elongation - 5 deg|, as the harness approachesFloor does',
  },
  windows: [],
};

const moonRows = RUN.cases.filter((r) => r.body === 'Moon' && !r.skipped);
const byWindow = new Map();
for (const r of moonRows) {
  const key = `${r.from}|${r.to}`;
  if (!byWindow.has(key)) byWindow.set(key, []);
  byWindow.get(key).push(r);
}
for (const [, rows] of byWindow) {
  const r0 = rows[0];
  const caseRec = RUN.additional.caseChecks.find((c) => c.id === r0.id);
  const a = caseRec.from; const b = caseRec.to;
  const fc = floorCrossings('Moon', a, b);
  const joinLists = ['moon', 'emb', 'sun'].map((s) => joinsOf(s, a, b));
  const w = {
    cases: rows.map((r) => r.id),
    window: [a, b],
    windowIso: [r0.from, r0.to],
    floorCrossings: fc.crossings.map((x) => ({ ...x, tdbIso: tdbIso(x.tdbSec) })),
    floorCrossingScan: { stepSec: fc.stepSec, samples: fc.samples, refusals: fc.refusals },
    recordJoins: joinLists,
    perCase: {},
  };
  // the partition is the same for F2 and A2 (it never sees the target); check rather than assume
  w.partitionIdenticalAcrossCases = rows.every((r) => JSON.stringify(r.spans.partition.boundary) === JSON.stringify(r0.spans.partition.boundary)
    && JSON.stringify(r.spans.partition.excluded) === JSON.stringify(r0.spans.partition.excluded));
  for (const jl of joinLists) {
    for (const j of jl.joins) {
      const dists = fc.crossings.map((x) => x.tdbSec - j.tdbSec);
      const nearest = dists.reduce((m, d) => (Math.abs(d) < Math.abs(m) ? d : m), Infinity);
      j.nearestFloorCrossingMinusJoinSec = Number.isFinite(nearest) ? nearest : null;
      j.withinHalfDayOfFloorCrossing = Number.isFinite(nearest) && Math.abs(nearest) <= HALF_DAY;
      j.elongationAtJoinDeg = ref.elongationDeg('Moon', j.tdbSec);
      j.isDecisiveJoin = j.tdbSec === DECISIVE_JOIN;
      const el = j.elongationAtJoinDeg;
      j.insideFloorAtJoin = el !== null && el < FLOOR;
    }
  }
  for (const r of rows) {
    const selected = [];
    for (const jl of joinLists) {
      for (const j of jl.joins) {
        if (!(j.withinHalfDayOfFloorCrossing || j.isDecisiveJoin)) continue;
        selected.push({
          scope: jl.series === 'moon' ? 'asked: a Moon record join' : `supplement beyond the ask: a ${jl.series} record join`,
          join: j,
          spans: spansNearJoin(r, j.tdbSec),
          earlier: earlierSpansNearJoin(r.id, r.body, j.tdbSec),
        });
      }
    }
    // Every boundary span of the case, classified against the reference crossings.
    const allBoundary = r.spans.partition.boundary.map((s) => {
      const inside = fc.crossings.filter((x) => x.tdbSec >= s[0] && x.tdbSec <= s[1]);
      const joinsTouching = joinLists.flatMap((jl) => jl.joins.filter((j) => j.tdbSec >= s[0] - 2 && j.tdbSec <= s[1] + 2).map((j) => `${jl.series} ${j.tdbIso}`));
      return { span: s, lengthSec: s[1] - s[0], floorCrossingInside: inside.length > 0, joinsWithin2sOfSpan: joinsTouching, ...probe(r.body, s) };
    });
    w.perCase[r.id] = {
      selectedJoins: selected,
      boundarySpans: allBoundary,
      boundarySpansWithoutAFloorCrossing: allBoundary.filter((x) => !x.floorCrossingInside).length,
      p2FailuresByThisProbe: allBoundary.filter((x) => !x.p2Pass).length,
    };
  }
  result.windows.push(w);
}

writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
for (const w of result.windows) {
  process.stdout.write(`window ${w.windowIso.join(' .. ')}: ${w.floorCrossings.length} floor crossings; joins moon ${w.recordJoins[0].joins.length}, emb ${w.recordJoins[1].joins.length}, sun ${w.recordJoins[2].joins.length}; partition identical across cases: ${w.partitionIdenticalAcrossCases}\n`);
  for (const [id, pc] of Object.entries(w.perCase)) {
    process.stdout.write(` ${id}: ${pc.boundarySpans.length} boundary spans, ${pc.boundarySpansWithoutAFloorCrossing} without a floor crossing, ${pc.p2FailuresByThisProbe} beyond 0.5 deg\n`);
    for (const s of pc.selectedJoins) {
      process.stdout.write(`  ${s.scope}: ${s.join.tdbIso}, nearest crossing ${s.join.nearestFloorCrossingMinusJoinSec?.toFixed(0)} s, elongation at join ${s.join.elongationAtJoinDeg?.toFixed(4)} deg\n`);
      for (const x of s.spans) process.stdout.write(`    ${x.source}: ${x.lengthSec.toFixed(4)} s, [${x.startMinusJoinSec.toFixed(3)}, ${x.endMinusJoinSec.toFixed(3)}] s from the join, closest approach ${x.closestApproachDeg?.toFixed(6)} deg, elongation ${x.minElongationDeg?.toFixed(4)}..${x.maxElongationDeg?.toFixed(4)}\n`);
    }
  }
}
