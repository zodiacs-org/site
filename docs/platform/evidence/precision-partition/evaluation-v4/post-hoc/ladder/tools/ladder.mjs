/**
 * The earlier attempt's ten-case ladder (bundle branch moon-enclosure,
 * examples/precision-alpha/PARTITION-EVALUATION-V2.md section 3b), run on
 * version 1 (the original runtime) and on PR #860's code, on one pack, and
 * scored by that rule's E-1, E-2 (ten-case part) and E-3 (ten-case part)
 * with its section 5 definitions.
 *
 *   node ladder.mjs --pack=FILE --v1=DIR --v2=DIR --committed=FILE \
 *        --bundle-run=FILE --corpus-v4=FILE --out=DIR [--only=F1,...]
 *
 * --v1 and --v2 are precision-alpha trees: v1 is the original runtime,
 * v2 is #860's head. The construction of the F cases and of the five
 * rungs, the same-event rule, the same-count check and the apparent()
 * grid are copied from the bundle's tools/measure/partition-evaluation-v2.mjs
 * (lines 255-285, 497-541, 600-666, 828-856 and 895-939 of that file);
 * where this tool differs from it, the difference is named in DEVIATIONS
 * below and written into run.json.
 *
 * Research tool for one review. It writes only under --out.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { cpus, loadavg } from 'node:os';

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const PACK = args.get('pack');
const V1 = args.get('v1')?.replace(/\/$/, '');
const V2 = args.get('v2')?.replace(/\/$/, '');
const COMMITTED = args.get('committed');
const BUNDLE_RUN = args.get('bundle-run');
const CORPUS_V4 = args.get('corpus-v4');
const OUT = args.get('out');
const ONLY = args.get('only') ? args.get('only').split(',') : null;
if (!PACK || !V1 || !V2 || !COMMITTED || !BUNDLE_RUN || !CORPUS_V4 || !OUT) {
  process.stderr.write('usage: --pack=FILE --v1=DIR --v2=DIR --committed=FILE --bundle-run=FILE --corpus-v4=FILE --out=DIR [--only=F1,...]\n');
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });
const log = (s) => process.stderr.write(`${s}\n`);
const startedAt = new Date().toISOString();
const loadAtStart = loadavg();

const DEVIATIONS = [
  'The pack is the one #860 evaluated on (container 9856b50f, payload 0c7e1c93, compiler 1.1.0 on this Mac), not the pack the earlier rule fixes in its section 2 (container 4cc6f85a, payload 0a218764, compiler 1.0.0). The earlier harness refuses any other pack and stops; this tool checks the pack against the 9856b50f digests instead, and compares its version 1 numbers with the version 1 numbers the earlier run recorded on its own pack, so the effect of the pack is measured rather than assumed.',
  'Section 2 also requires the original runtime to reproduce the committed twenty-case run case for case before anything is compared. The twenty cases are not this label\'s task and were not run, so that precondition is not checked here.',
  '"v2" in the earlier rule means the bundle\'s own version 2 code. Here the same rule is applied with #860\'s code in that place.',
  'The earlier harness verifies the original tree blob by blob against 23dd8cb7 at start; this label does that in provenance.json (read-only git ls-tree), for the src directory and the deflected reference, not for the whole package directory.',
  'The deflected rung is run here directly with the whole-request budgets (4,000,000 evaluations, 400,000 cells). The earlier harness reused its twenty-case baseline run for it, which is the same call with the same arguments.',
  'The F windows and targets are the earlier holdouts\' (1975-01-01 epoch). For #860\'s code they are previously seen data, so everything here is post hoc and unscored.',
];

// ------------------------------------------------ frozen, as in the harness
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const STEP = { Moon: 300, Mercury: 900, Venus: 1800, Sun: 1800, Mars: 1800, Jupiter: 3600, Saturn: 3600, Uranus: 3600, Neptune: 3600, Pluto: 3600 };
const REGRESSION_EPOCH = '1975-01-01T00:00:00Z';
const MAX_EVALUATIONS = 4_000_000;
const MAX_CELLS = 400_000;
const WALL_CLOCK_BUDGET_MS = 300_000;
const ROOT_TOLERANCE_SEC = 1e-3;
const MATCH_WINDOW_SEC = 1;
const PACK_EXPECTED = Object.freeze({
  containerDigest: '9856b50ffebfa06c39f81d941fa7b63e99b9376e88bb1fadefe4be5f7e5a3355',
  payloadPrefix: '0c7e1c93',
});
const DAY = 86400;
const J2000_UTC = Date.UTC(2000, 0, 1, 12);
const tdb = (iso) => (Date.parse(iso) - J2000_UTC) / 1000 + 69.184;
const plus = (iso, days) => `${new Date(Date.parse(iso) + days * DAY * 1000).toISOString().slice(0, 10)}T00:00:00Z`;
const sha256 = (x) => createHash('sha256').update(x).digest('hex');
const now = () => performance.now();

function stop(reason, detail) {
  writeFileSync(join(OUT, 'run.json'), `${JSON.stringify({ tool: 'ladder.mjs', startedAt, stoppedAt: new Date().toISOString(), stopped: reason, detail }, null, 1)}\n`);
  log(`STOPPED: ${reason}`);
  process.exit(3);
}

// ---------------------------------------------------------- both trees
const load = async (root) => ({
  node: await import(`${root}/src/node.mjs`),
  retarded: await import(`${root}/src/core/retarded-search.mjs`),
  validated: await import(`${root}/src/core/validated-search.mjs`),
  deflection: await import(`${root}/src/core/deflection.mjs`),
  reference: await import(`${root}/test/tier-b/_deflected-reference.mjs`),
});
const M = { v1: await load(V1), v2: await load(V2) };

// ---------------------------------------------------------------- pack
const packBytes = readFileSync(PACK);
const rt = { v1: await M.v1.node.openPackFile(PACK), v2: await M.v2.node.openPackFile(PACK) };
const payloadOffset = new DataView(packBytes.buffer, packBytes.byteOffset, packBytes.byteLength).getUint32(12, true);
const payloadEnd = rt.v2.header.payloadEndOffset;
const pack = {
  path: PACK,
  bytes: packBytes.length,
  fileSha256: sha256(packBytes),
  payloadSha256: sha256(packBytes.subarray(payloadOffset, payloadEnd)),
  headerPayloadSha256: rt.v2.header.payloadSha256 ?? null,
  containerDigest: { v1: rt.v1.integrity.computedDigest, v2: rt.v2.integrity.computedDigest },
  compiler: rt.v2.header.compiler?.version ?? null,
  coverage: rt.v2.coverage,
  expected: PACK_EXPECTED,
};
pack.ok = pack.containerDigest.v1 === PACK_EXPECTED.containerDigest
  && pack.containerDigest.v2 === PACK_EXPECTED.containerDigest
  && pack.payloadSha256.startsWith(PACK_EXPECTED.payloadPrefix)
  && pack.headerPayloadSha256 === pack.payloadSha256;
if (!pack.ok) stop('the pack is not #860\'s pack', pack);
log(`pack verified: container ${pack.containerDigest.v2.slice(0, 8)}, payload ${pack.payloadSha256.slice(0, 8)}, file ${pack.fileSha256.slice(0, 8)}, ${pack.bytes} bytes, compiler ${pack.compiler}`);
const eph = { v1: rt.v1.ephemeris, v2: rt.v2.ephemeris };

// ------------------------------------------------- what may not differ
const frozen = {};
for (const v of ['v1', 'v2']) {
  frozen[v] = {
    retardedBudgets: { maxEvaluations: M[v].retarded.RETARDED_DEFAULTS.maxEvaluations, maxCells: M[v].retarded.RETARDED_DEFAULTS.maxCells },
    validatedDefaults: { ...M[v].validated.VALIDATED_DEFAULTS },
    retardedDefaults: { ...M[v].retarded.RETARDED_DEFAULTS },
    profile: M[v].deflection.DEFLECTION_PROFILE,
  };
}
const frozenProblems = [];
for (const v of ['v1', 'v2']) {
  const f = frozen[v];
  if (f.retardedBudgets.maxEvaluations !== MAX_EVALUATIONS || f.retardedBudgets.maxCells !== MAX_CELLS) frozenProblems.push(`${v}: the package's retarded-family budgets are not 4,000,000 and 400,000`);
}
if (JSON.stringify(frozen.v1.profile) !== JSON.stringify(frozen.v2.profile)) frozenProblems.push('the deflection profile differs between the trees');
if (frozen.v2.profile.minElongationDeg !== 5) frozenProblems.push('the floor is not five degrees');
if (frozenProblems.length) stop('something the earlier rule freezes differs', frozenProblems);

// ------------------------------------------------------------ the cases
const committed = JSON.parse(readFileSync(COMMITTED, 'utf8'));
const committedTarget = new Map(committed.cases.map((c) => [c.id, c.targetDeg]));
const ref = { v1: M.v1.reference.makeDeflectedReference(eph.v1), v2: M.v2.reference.makeDeflectedReference(eph.v2) };
const CASES = [];
const targetAgreement = [];
for (let i = 0; i < BODIES.length; i += 1) {
  const body = BODIES[i];
  const fromIso = plus(REGRESSION_EPOCH, 900 * i);
  const toIso = plus(fromIso, 300);
  const from = tdb(fromIso);
  const to = tdb(toIso);
  const lon = ref.v1.lonDeg(body, (from + to) / 2);
  const lon2 = ref.v2.lonDeg(body, (from + to) / 2);
  if (lon === null) stop('the reference refuses a midpoint', { body, fromIso });
  const targetDeg = Number(lon.toFixed(6));
  const id = `F${i + 1}`;
  targetAgreement.push({ id, body, targetDeg, treesAgree: Object.is(lon, lon2), committed: committedTarget.get(id) ?? null, equalsCommitted: Object.is(committedTarget.get(id), targetDeg) });
  CASES.push({ id, body, from, to, fromIso, toIso, targetDeg });
}
if (!targetAgreement.every((x) => x.treesAgree && x.equalsCommitted)) stop('the F targets are not the committed ones, or the trees disagree', targetAgreement);
for (const c of CASES) if (c.from < pack.coverage.startEtSecTdb || c.to > pack.coverage.stopEtSecTdb) stop('a window lies outside the pack', c);
const LIVE = CASES.filter((c) => ONLY === null || ONLY.includes(c.id));
log(`cases: ${LIVE.map((c) => `${c.id} ${c.body} ${c.targetDeg}`).join('; ')}`);

// --------------------------------------------- identities (section 5)
const tdbIdentity = (e) => ({ tdbSec: e.tdbSec, bracketTdbSec: [...e.bracketTdbSec], kind: e.kind ?? null, direction: e.direction ?? null });
const ttIdentity = (e) => ({ ttDays: e.ttDays, bracketTtDays: [...e.bracketTtDays], kind: e.kind ?? null, direction: e.direction ?? null });
const asSec = (e) => (e.ttDays !== undefined
  ? { t: e.ttDays * DAY, lo: e.bracketTtDays[0] * DAY, hi: e.bracketTtDays[1] * DAY }
  : { t: e.tdbSec, lo: e.bracketTdbSec[0], hi: e.bracketTdbSec[1] });
const same = (a, b) => (Array.isArray(a) && Array.isArray(b)
  ? a.length === b.length && a.every((x, i) => Object.is(x, b[i]))
  : Object.is(a, b));
const identityKeys = (e) => Object.keys(e);
const bitIdentical = (a, b) => identityKeys(a).length === identityKeys(b).length && identityKeys(a).every((k) => same(a[k], b[k]));

/** Section 5's same-event rule, as the earlier harness implements it. */
function compareEvents(e1, e2, { rootsOfV1 = new Map(), allowance = 0 } = {}) {
  const a = e1.map(asSec);
  const b = e2.map(asSec);
  const candidates = [];
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      const d = Math.abs(a[i].t - b[j].t);
      if (d <= MATCH_WINDOW_SEC) candidates.push({ i, j, d });
    }
  }
  candidates.sort((x, y) => x.d - y.d || x.i - y.i || x.j - y.j);
  const seenI = new Map();
  for (const c of candidates) seenI.set(c.i, (seenI.get(c.i) ?? 0) + 1);
  const takenI = new Set(); const takenJ = new Set();
  const pairs = [];
  for (const c of candidates) {
    if (takenI.has(c.i) || takenJ.has(c.j)) continue;
    takenI.add(c.i); takenJ.add(c.j);
    const overlaps = b[c.j].lo <= a[c.i].hi + ROOT_TOLERANCE_SEC && a[c.i].lo - ROOT_TOLERANCE_SEC <= b[c.j].hi;
    const roots = rootsOfV1.get(c.i) ?? [];
    const rootsInside = roots.every((r) => b[c.j].lo - allowance <= r && r <= b[c.j].hi + allowance);
    pairs.push({ v1: c.i, v2: c.j, d: c.d, overlaps, rootsChecked: roots.length, rootsInside, sameEvent: overlaps && rootsInside, bitIdentical: bitIdentical(e1[c.i], e2[c.j]) });
  }
  const sameOf = new Set(pairs.filter((p) => p.sameEvent).map((p) => p.v1));
  const lost = a.map((x, i) => ({ i, t: x.t })).filter(({ i }) => !sameOf.has(i));
  return {
    v1: a.length, v2: b.length, pairs: pairs.length, sameEventPairs: sameOf.size,
    lost: lost.length, lostAt: lost.map((x) => x.t),
    ambiguousPairing: [...seenI.values()].some((n) => n > 1),
    bitIdenticalPairs: pairs.filter((p) => p.bitIdentical).length,
    pairDetail: pairs,
  };
}

/** Section 5 sense 2, unamended, and under amendment A-1. */
function sameCountCheck(e1, e2) {
  const unamended = e1.length === e2.length && e1.every((x, i) => bitIdentical(x, e2[i]));
  let amended = e1.length === e2.length;
  let nested = 0;
  if (amended) {
    for (let i = 0; i < e1.length; i += 1) {
      const x = e1[i]; const y = e2[i];
      const labels = ['kind', 'direction', 'domain', 'eligibility'].every((k) => Object.is(x[k], y[k]));
      const bx = asSec(x); const by = asSec(y);
      const inside = bx.lo <= by.lo && by.hi <= bx.hi;
      if (!(labels && inside)) amended = false;
      if (inside) nested += 1;
    }
  }
  const bitIdenticalEvents = Math.min(e1.length, e2.length) === 0 ? 0 : e1.filter((x, i) => i < e2.length && bitIdentical(x, e2[i])).length;
  return { events: e1.length, v2Events: e2.length, unamended, amended, nestedEvents: nested, bitIdenticalEvents };
}

/** The task's own lost-event test (#860's V-4 wording): within 1e-3 s, same direction. */
function simpleLost(e1, e2) {
  const a = e1.map((e) => ({ ...asSec(e), direction: e.direction }));
  const b = e2.map((e) => ({ ...asSec(e), direction: e.direction }));
  const lost = a.filter((x) => !b.some((y) => Math.abs(y.t - x.t) <= ROOT_TOLERANCE_SEC && y.direction === x.direction));
  return { lost: lost.length, lostAt: lost.map((x) => x.t) };
}

// ---------------------------------- the correspondence (DEFLECTION-EVALUATION.md section 4)
const inAny = (t, spans) => spans.some(([lo, hi]) => t >= lo && t <= hi);
function correspond(events, refRoots, s) {
  const classify = (t) => {
    if (s.decided === null) return 'undecided-run';
    if (inAny(t, s.decided)) return 'decided';
    if (inAny(t, s.excluded)) return 'excluded';
    if (inAny(t, s.unresolved)) return 'unresolved';
    return 'unclassified';
  };
  const cls = refRoots.map(classify);
  const unfinished = s.decided === null;
  const matchable = refRoots.map((t, j) => ({ t, j })).filter((_, j) => unfinished || cls[j] === 'decided');
  const candidates = [];
  for (let i = 0; i < events.length; i += 1) {
    for (const { t, j } of matchable) {
      const d = Math.abs(events[i].tdbSec - t);
      if (d <= MATCH_WINDOW_SEC) candidates.push({ i, j, d });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  const seenI = new Map(); const seenJ = new Map();
  for (const c of candidates) { seenI.set(c.i, (seenI.get(c.i) ?? 0) + 1); seenJ.set(c.j, (seenJ.get(c.j) ?? 0) + 1); }
  const takenI = new Set(); const takenJ = new Set();
  const matched = [];
  for (const c of candidates) {
    if (takenI.has(c.i) || takenJ.has(c.j)) continue;
    takenI.add(c.i); takenJ.add(c.j);
    const e = events[c.i];
    matched.push({ event: c.i, root: c.j, tdbSec: e.tdbSec, referenceTdbSec: refRoots[c.j], deltaSec: e.tdbSec - refRoots[c.j], bracketed: e.bracketTdbSec[0] <= refRoots[c.j] && refRoots[c.j] <= e.bracketTdbSec[1] });
  }
  const missed = refRoots.filter((_, j) => (unfinished || cls[j] === 'decided') && !takenJ.has(j));
  const notExamined = unfinished ? [] : refRoots.map((t, j) => ({ tdbSec: t, span: cls[j] })).filter((x) => x.span !== 'decided');
  const extra = events.filter((_, i) => !takenI.has(i)).map((e) => e.tdbSec);
  return {
    matched, missed, extra, notExamined,
    ambiguousPairing: [...seenI.values(), ...seenJ.values()].some((n) => n > 1),
    runUnfinished: unfinished,
    identities: {
      referenceAccountedFor: matched.length + missed.length + notExamined.length === refRoots.length,
      eventsAccountedFor: matched.length + extra.length === events.length,
    },
  };
}

// ------------------------------------------------- whole-result identity
function deepSame(a, b) {
  if (typeof a === 'number' || typeof b === 'number') return Object.is(a, b);
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (ArrayBuffer.isView(a) || Array.isArray(a)) {
    if (!(ArrayBuffer.isView(b) || Array.isArray(b)) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!deepSame(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a).sort(); const kb = Object.keys(b).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => deepSame(a[k], b[k]));
}
const short = (x) => { const s = JSON.stringify(x, exact); return s === undefined ? String(x) : s.length > 160 ? `${s.slice(0, 160)}...` : s; };
function diffPaths(a, b, path = '', out = [], limit = 25) {
  if (out.length >= limit) return out;
  const bothObj = a !== null && b !== null && typeof a === 'object' && typeof b === 'object';
  if (!bothObj) { if (!deepSame(a, b)) out.push({ path: path || '(root)', v1: short(a), v2: short(b) }); return out; }
  const arr = (x) => ArrayBuffer.isView(x) || Array.isArray(x);
  if (arr(a) || arr(b)) {
    if (!(arr(a) && arr(b))) { out.push({ path, v1: short(a), v2: short(b) }); return out; }
    if (a.length !== b.length) out.push({ path: `${path}.length`, v1: a.length, v2: b.length });
    for (let i = 0; i < Math.min(a.length, b.length) && out.length < limit; i += 1) diffPaths(a[i], b[i], `${path}[${i}]`, out, limit);
    return out;
  }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const k of keys) {
    if (out.length >= limit) break;
    if (!(k in a) || !(k in b)) { out.push({ path: `${path}.${k}`, v1: k in a ? short(a[k]) : '(absent)', v2: k in b ? short(b[k]) : '(absent)' }); continue; }
    diffPaths(a[k], b[k], `${path}.${k}`, out, limit);
  }
  return out;
}
/** JSON that keeps every double exactly: -0, NaN and the infinities are tagged, typed arrays become arrays. */
function exact(k, v) {
  if (typeof v === 'number') {
    if (Object.is(v, -0)) return { $num: '-0' };
    if (!Number.isFinite(v)) return { $num: String(v) };
    return v;
  }
  if (ArrayBuffer.isView(v)) return Array.from(v);
  return v;
}

// ---------------------------------------------------------------- rungs
const RUNGS = ['geometric', 'retarded', 'aberrated', 'ofDate', 'deflected'];
const RUNG_NAMES = {
  geometric: 'validated-geometric',
  retarded: 'validated-retarded-geometric',
  aberrated: 'validated-retarded-aberrated',
  ofDate: 'validated-retarded-aberrated-of-date',
  deflected: 'validated-retarded-aberrated-deflected-of-date',
};
const threw = (e) => ({ threw: { code: e?.code ?? null, message: String(e?.message ?? e).slice(0, 300) } });
function runRung(v, rung, c) {
  const spec = { body: c.body, targetDeg: c.targetDeg, fromTdbSec: c.from, toTdbSec: c.to };
  const t = now();
  try {
    let r;
    // Section 3b: rung 1 takes TT days, as the deflection holdout's harness gives it them.
    if (rung === 'geometric') r = M[v].validated.searchGeometricLongitude(eph[v], { body: c.body, targetDeg: c.targetDeg, fromTtDays: c.from / DAY, toTtDays: c.to / DAY });
    else if (rung === 'retarded') r = M[v].retarded.searchRetardedLongitude(eph[v], spec);
    else if (rung === 'aberrated') r = M[v].retarded.searchAberratedLongitude(eph[v], spec);
    else if (rung === 'ofDate') r = M[v].retarded.searchOfDateLongitude(eph[v], spec);
    else r = M[v].retarded.searchDeflectedLongitude(eph[v], { ...spec, maxEvaluations: MAX_EVALUATIONS, maxCells: MAX_CELLS });
    return { r, ms: now() - t };
  } catch (e) { return { ...threw(e), ms: now() - t }; }
}
const spanOf = (x) => (x.fromTtDays !== undefined ? [x.fromTtDays * DAY, x.toTtDays * DAY] : [x.fromTdbSec, x.toTdbSec]);
function summarise(rung, run) {
  if (run.threw) return { threw: run.threw, ms: run.ms };
  const { r, ms } = run;
  return {
    mode: r.mode,
    status: r.execution.status,
    finished: r.execution.finished,
    reason: r.execution.reason ?? null,
    established: r.completeness.established,
    support: r.completeness.support,
    isExactTotal: r.eventCount.isExactTotal,
    found: r.eventCount.found,
    lowerBound: r.eventCount.lowerBound,
    upperBound: r.eventCount.upperBound,
    evaluations: r.execution.evaluations,
    maxEvaluations: r.execution.maxEvaluations,
    cells: r.execution.cells,
    ms,
    withinWallClock: ms <= WALL_CLOCK_BUDGET_MS,
    unresolvedRuns: r.accounting.unresolved.length,
    unresolved: r.accounting.unresolved.map(spanOf),
    excludedRuns: (r.accounting.excluded ?? []).length,
    excluded: (r.accounting.excluded ?? []).map(spanOf),
    decidedFraction: r.interval?.decidedFraction ?? null,
    events: r.events.map(rung === 'geometric' ? ttIdentity : tdbIdentity),
    eventsFull: JSON.parse(JSON.stringify(r.events, exact)),
  };
}

// ------------------------------------------------------------- the run
const fullOut = { v1: [], v2: [] };
const referenceScans = {};
const ladder = [];
for (const c of LIVE) {
  const row = { id: c.id, body: c.body, targetDeg: c.targetDeg, fromIso: c.fromIso, toIso: c.toIso, fromTdbSec: c.from, toTdbSec: c.to, rungs: {} };
  // The reference roots the deflected rung's same-event test needs (harness lines 470-476 and 561-564).
  let t = now();
  const scan = ref.v1.crossings(c.body, c.targetDeg, c.from, c.to, STEP[c.body]);
  referenceScans[c.id] = { body: c.body, targetDeg: c.targetDeg, stepSec: scan.stepSec, samples: scan.samples, refusals: scan.refusals, roots: scan.roots, ms: now() - t };
  log(`${c.id} ${c.body}: reference scan ${scan.roots.length} roots, ${scan.samples} samples, ${scan.refusals} refusals, ${((now() - t) / 1000).toFixed(1)} s`);
  for (const rung of RUNGS) {
    const run1 = runRung('v1', rung, c);
    const run2 = runRung('v2', rung, c);
    const x = summarise(rung, run1);
    const y = summarise(rung, run2);
    const both = !x.threw && !y.threw;
    const rootsOfV1 = new Map();
    let correspondence = null;
    if (rung === 'deflected') {
      const corrOf = (run) => {
        const r = run.r;
        return correspond(r.events.map(tdbIdentity), scan.roots, {
          decided: r.interval.decidedTdbSec ?? null,
          excluded: r.accounting.excluded.map(spanOf),
          unresolved: r.accounting.unresolved.map(spanOf),
        });
      };
      correspondence = {};
      if (!x.threw) {
        const k = corrOf(run1);
        for (const m of k.matched) rootsOfV1.set(m.event, [m.referenceTdbSec]);
        correspondence.v1 = { matched: k.matched.length, missed: k.missed.length, extra: k.extra.length, notExamined: k.notExamined.length, runUnfinished: k.runUnfinished, ambiguousPairing: k.ambiguousPairing, identities: k.identities, worstDeltaSec: k.matched.reduce((mx, z) => Math.max(mx, Math.abs(z.deltaSec)), 0), everyMatchedRootBracketed: k.matched.every((z) => z.bracketed), matchedDetail: k.matched, missedAt: k.missed, extraAt: k.extra };
      }
      if (!y.threw) {
        const k = corrOf(run2);
        correspondence.v2 = { matched: k.matched.length, missed: k.missed.length, extra: k.extra.length, notExamined: k.notExamined.length, runUnfinished: k.runUnfinished, ambiguousPairing: k.ambiguousPairing, identities: k.identities, worstDeltaSec: k.matched.reduce((mx, z) => Math.max(mx, Math.abs(z.deltaSec)), 0), everyMatchedRootBracketed: k.matched.every((z) => z.bracketed), matchedDetail: k.matched, missedAt: k.missed, extraAt: k.extra };
      }
    }
    const sameCounts = both && x.evaluations === y.evaluations && x.cells === y.cells;
    const fullIdentical = both && deepSame(run1.r, run2.r);
    row.rungs[rung] = {
      rungName: RUNG_NAMES[rung],
      v1: x,
      v2: y,
      comparison: both ? compareEvents(x.events, y.events, { rootsOfV1, allowance: 0 }) : { lost: x.threw ? 0 : x.events.length, v2Threw: y.threw ?? null, v1Threw: x.threw ?? null },
      simpleLost: both ? simpleLost(x.events, y.events) : null,
      sameCounts,
      sameCount: sameCounts ? sameCountCheck(x.events, y.events) : null,
      bothEstablished: both && x.established && y.established,
      countsEqualWhereBothEstablished: !both || !(x.established && y.established) || x.events.length === y.events.length,
      identity: both ? {
        evaluationsEqual: x.evaluations === y.evaluations,
        cellsEqual: x.cells === y.cells,
        statusEqual: x.status === y.status,
        establishedEqual: x.established === y.established,
        eventIdentitiesEqual: x.events.length === y.events.length && x.events.every((e, i) => bitIdentical(e, y.events[i])),
        wholeResultIdentical: fullIdentical,
        wholeResultDifferences: fullIdentical ? [] : diffPaths(run1.r, run2.r),
      } : null,
      correspondence,
    };
    for (const [v, run] of [['v1', run1], ['v2', run2]]) {
      fullOut[v].push(JSON.stringify({ id: c.id, body: c.body, rung, rungName: RUNG_NAMES[rung], ms: run.ms, threw: run.threw ?? null, result: run.r ?? null }, exact));
    }
    const f = (s) => (s.threw ? `threw ${s.threw.code}` : `${s.status}${s.established ? ' established' : ''} ${s.evaluations} ev ${s.cells} cells ${s.events.length} ev'ts`);
    log(`  ${c.id} ${rung}: v1 ${f(x)} | v2 ${f(y)} | lost ${row.rungs[rung].comparison.lost} | whole result identical ${fullIdentical}`);
  }
  ladder.push(row);
}

// ------------------------------------- section 5 sense 1: apparent() on a grid
function apparentGrid(v, windows) {
  const out = [];
  for (const [from, to] of windows) {
    for (let k = 0; k < 10; k += 1) {
      const ttDays = (from + ((to - from) * (k + 0.5)) / 10) / DAY;
      for (const body of BODIES) {
        try { out.push({ body, ttDays, value: rt[v].apparent(body, ttDays) }); } catch (e) { out.push({ body, ttDays, ...threw(e) }); }
      }
    }
  }
  return out;
}
const gridWindows = LIVE.map((c) => [c.from, c.to]);
const grid1 = apparentGrid('v1', gridWindows);
const grid2 = apparentGrid('v2', gridWindows);
const gridDiffers = grid1.map((x, i) => ({ i, body: x.body, ttDays: x.ttDays, same: deepSame(x, grid2[i]) })).filter((x) => !x.same);
const apparentCheck = {
  windows: gridWindows.length,
  instants: gridWindows.length * 10,
  calls: grid1.length,
  threw: grid1.filter((x) => x.threw).length + grid2.filter((x) => x.threw).length,
  differing: gridDiffers.length,
  firstDiffering: gridDiffers.slice(0, 5),
  digestV1: sha256(JSON.stringify(grid1)),
  digestV2: sha256(JSON.stringify(grid2)),
  pass: grid1.length === grid2.length && gridDiffers.length === 0,
};
log(`apparent() grid: ${apparentCheck.calls} calls per tree, ${apparentCheck.differing} differ`);

// ------------------------------------------------------- the E rules, ten-case parts
const cellsOf = () => ladder.flatMap((row) => RUNGS.map((rung) => ({ id: row.id, body: row.body, rung, x: row.rungs[rung] })));
const all = cellsOf();
const E1 = {
  rule: 'section 6 E-1, the ten-case corpus part: no v1 event lost (section 5), in any rung; a rung that threw on either side is a failure (harness, review B-16)',
  eventsLost: all.reduce((n, z) => n + z.x.comparison.lost, 0),
  where: all.filter((z) => z.x.comparison.lost > 0).map((z) => ({ id: z.id, rung: z.rung, lost: z.x.comparison.lost, lostAt: z.x.comparison.lostAt })),
  threw: all.filter((z) => z.x.v1.threw || z.x.v2.threw).map((z) => `${z.id} ${z.rung}`),
  ambiguousPairings: all.filter((z) => z.x.comparison.ambiguousPairing).map((z) => `${z.id} ${z.rung}`),
  taskDefinitionLost: all.reduce((n, z) => n + (z.x.simpleLost?.lost ?? 0), 0),
  taskDefinitionWhere: all.filter((z) => (z.x.simpleLost?.lost ?? 0) > 0).map((z) => ({ id: z.id, rung: z.rung, ...z.x.simpleLost })),
};
E1.pass = E1.eventsLost === 0 && E1.threw.length === 0;
const E2 = {
  rule: 'section 6 E-2, second bullet: on the ten-case corpus, wherever v1 and v2 both establish completeness for a (case, rung), their event counts are equal',
  bothEstablished: all.filter((z) => z.x.bothEstablished).map((z) => `${z.id} ${z.rung}`),
  unequal: all.filter((z) => !z.x.countsEqualWhereBothEstablished).map((z) => ({ id: z.id, rung: z.rung, v1: z.x.v1.events.length, v2: z.x.v2.events.length })),
};
E2.pass = E2.unequal.length === 0;
const sameCountSets = all.filter((z) => z.x.sameCounts).map((z) => ({ id: z.id, rung: z.rung, ...z.x.sameCount }));
const E3 = {
  rule: 'section 6 E-3, section 5 sense 2 on the ten-case corpus (unamended, and under the appended amendment A-1), with sense 1 (the apparent() grid over the ten F windows) beside it',
  sense2: {
    sameCountResults: sameCountSets.length,
    differentCountResults: all.filter((z) => !z.x.sameCounts).map((z) => `${z.id} ${z.rung}`),
    unamendedFailures: sameCountSets.filter((z) => !z.unamended),
    amendedFailures: sameCountSets.filter((z) => !z.amended),
    eventsInSameCountResults: sameCountSets.reduce((n, z) => n + z.events, 0),
    bitIdenticalEventsInSameCountResults: sameCountSets.reduce((n, z) => n + z.bitIdenticalEvents, 0),
  },
  sense1: apparentCheck,
};
E3.sense2.passUnamended = E3.sense2.unamendedFailures.length === 0;
E3.sense2.passAmendedA1 = E3.sense2.amendedFailures.length === 0;
E3.passUnamended = E3.sense1.pass && E3.sense2.passUnamended;
E3.passAmendedA1 = E3.sense1.pass && E3.sense2.passAmendedA1;

// ------------------------------------------- every body but the Moon, bit for bit
const nonMoon = all.filter((z) => z.body !== 'Moon');
const nonMoonCheck = {
  claim: '#860: the search changes only cells whose target and observer share a stored series, so every other body must be identical, evaluation counts included',
  results: nonMoon.length,
  wholeResultIdentical: nonMoon.filter((z) => z.x.identity?.wholeResultIdentical).length,
  countsAndEventsIdentical: nonMoon.filter((z) => z.x.identity && z.x.identity.evaluationsEqual && z.x.identity.cellsEqual && z.x.identity.statusEqual && z.x.identity.establishedEqual && z.x.identity.eventIdentitiesEqual).length,
  failures: nonMoon.filter((z) => !z.x.identity?.wholeResultIdentical).map((z) => ({ id: z.id, rung: z.rung, identity: z.x.identity })),
};
nonMoonCheck.pass = nonMoonCheck.failures.length === 0;

// ------------------------------------------------------ per-rung table
const perRung = RUNGS.map((rung) => {
  const zs = all.filter((z) => z.rung === rung);
  const moon = zs.find((z) => z.body === 'Moon');
  return {
    rung: RUNG_NAMES[rung],
    key: rung,
    lostEvents: zs.reduce((n, z) => n + z.x.comparison.lost, 0),
    lostEventsTaskDefinition: zs.reduce((n, z) => n + (z.x.simpleLost?.lost ?? 0), 0),
    countMismatches: zs.filter((z) => !z.x.countsEqualWhereBothEstablished).length,
    bothEstablished: zs.filter((z) => z.x.bothEstablished).length,
    sameCountResults: zs.filter((z) => z.x.sameCounts).length,
    unamendedE3Failures: zs.filter((z) => z.x.sameCounts && !z.x.sameCount.unamended).length,
    amendedE3Failures: zs.filter((z) => z.x.sameCounts && !z.x.sameCount.amended).length,
    nonMoonBitIdentical: zs.filter((z) => z.body !== 'Moon').every((z) => z.x.identity?.wholeResultIdentical),
    moon: moon ? {
      v1: moon.x.v1.threw ? moon.x.v1 : { status: moon.x.v1.status, established: moon.x.v1.established, evaluations: moon.x.v1.evaluations, cells: moon.x.v1.cells, events: moon.x.v1.events.length },
      v2: moon.x.v2.threw ? moon.x.v2 : { status: moon.x.v2.status, established: moon.x.v2.established, evaluations: moon.x.v2.evaluations, cells: moon.x.v2.cells, events: moon.x.v2.events.length },
      lost: moon.x.comparison.lost,
      sameEventPairs: moon.x.comparison.sameEventPairs,
      bitIdenticalPairs: moon.x.comparison.bitIdenticalPairs,
      wholeResultIdentical: moon.x.identity?.wholeResultIdentical ?? null,
    } : null,
  };
});

// ----------------------- the pack's effect on version 1, and #860's own V-4
const bundleRun = JSON.parse(readFileSync(BUNDLE_RUN, 'utf8'));
const recordedV1 = new Map(bundleRun.ladder.map((row) => [row.id, row.rungs]));
const packEffectOnV1 = all.map((z) => {
  const was = recordedV1.get(z.id)?.[z.rung]?.v1;
  const is = z.x.v1;
  if (!was || was.threw || is.threw) return { id: z.id, rung: z.rung, comparable: false };
  const eventsIdentical = was.events.length === is.events.length && was.events.every((e, i) => bitIdentical(e, is.events[i]));
  return {
    id: z.id, rung: z.rung, comparable: true,
    recordedOnPack4cc6f85a: { status: was.status, established: was.established, evaluations: was.evaluations, cells: was.cells, events: was.events.length },
    thisPack9856b50f: { status: is.status, established: is.established, evaluations: is.evaluations, cells: is.cells, events: is.events.length },
    countsEqual: was.evaluations === is.evaluations && was.cells === is.cells,
    eventCountEqual: was.events.length === is.events.length,
    eventsBitIdentical: eventsIdentical,
    sameEventLost: compareEvents(was.events, is.events).lost,
  };
});
const corpusV4 = JSON.parse(readFileSync(CORPUS_V4, 'utf8'));
const v4Reproduction = corpusV4.rows.filter((r) => LIVE.some((c) => c.id === r.id)).map((r) => {
  const z = all.find((q) => q.id === r.id && q.rung === 'deflected');
  const ev = (list) => list.map((e) => ({ tdbSec: e.tdbSec, bracketTdbSec: e.bracketTdbSec, direction: e.direction }));
  const match = (rec, mine) => !mine.threw && rec.status === mine.status && rec.established === mine.established && rec.evaluations === mine.evaluations
    && JSON.stringify(ev(rec.events)) === JSON.stringify(ev(mine.events));
  return { id: r.id, v1Reproduced: match(r.v1, z.x.v1), v2Reproduced: match(r.v2, z.x.v2) };
});

// ------------------------------------------------------------ write
const record = {
  tool: 'results/ladder/tools/ladder.mjs',
  label: 'ladder',
  rule: 'bundle examples/precision-alpha/PARTITION-EVALUATION-V2.md (dfa19aa9) section 3b (corpus), section 5 (identity, same event, bit-identical) and section 6 E-1, E-2 second bullet, E-3; with A-1 appended before that rule\'s run',
  scored: false,
  scoredNote: 'Post hoc and unscored. The F windows are the earlier holdouts\' windows, opened by earlier versions; for #860\'s code they are previously seen data.',
  filtered: ONLY,
  deviations: DEVIATIONS,
  startedAt,
  finishedAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  cpus: cpus().length,
  loadAverage: { atStart: loadAtStart, atEnd: loadavg() },
  trees: { v1: V1, v2: V2 },
  pack,
  frozen,
  budgets: {
    geometric: 'package default (VALIDATED_DEFAULTS), as the earlier harness passes none for rung 1',
    retardedAberratedOfDate: 'package defaults (RETARDED_DEFAULTS), checked equal to 4,000,000 evaluations and 400,000 cells in both trees',
    deflected: { maxEvaluations: MAX_EVALUATIONS, maxCells: MAX_CELLS },
    wallClockMs: WALL_CLOCK_BUDGET_MS, rootToleranceSec: ROOT_TOLERANCE_SEC, matchWindowSec: MATCH_WINDOW_SEC,
  },
  cases: LIVE.map(({ id, body, fromIso, toIso, from, to, targetDeg }) => ({ id, body, fromIso, toIso, fromTdbSec: from, toTdbSec: to, targetDeg })),
  targetAgreement,
  scores: { E1, E2, E3, nonMoonCheck },
  perRung,
  packEffectOnV1,
  v4Reproduction,
};
writeFileSync(join(OUT, 'run.json'), `${JSON.stringify(record, exact, 1)}\n`);
writeFileSync(join(OUT, 'ladder.json'), `${JSON.stringify({ note: 'per (case, rung): both trees\' summaries with events and brackets, and every comparison', ladder }, exact, 1)}\n`);
writeFileSync(join(OUT, 'reference-scans.json'), `${JSON.stringify({ note: 'deflected reference (test/tier-b/_deflected-reference.mjs of the v1 tree) crossings per F case, the roots the deflected rung\'s same-event test checks', referenceScans }, exact, 1)}\n`);
for (const v of ['v1', 'v2']) {
  const name = `full-results-${v === 'v1' ? 'v1' : 'pr860'}.ndjson.gz`;
  writeFileSync(join(OUT, name), gzipSync(Buffer.from(`${fullOut[v].join('\n')}\n`)));
}
log(`E-1 ${E1.pass ? 'PASS' : 'FAIL'}: ${E1.eventsLost} lost (task definition: ${E1.taskDefinitionLost}), threw ${E1.threw.length}`);
log(`E-2 (ten-case) ${E2.pass ? 'PASS' : 'FAIL'}: ${E2.unequal.length} unequal of ${E2.bothEstablished.length} both-established`);
log(`E-3 (ten-case) sense 2 unamended ${E3.sense2.passUnamended ? 'PASS' : 'FAIL'}, A-1 ${E3.sense2.passAmendedA1 ? 'PASS' : 'FAIL'} over ${E3.sense2.sameCountResults} same-count results; sense 1 ${E3.sense1.pass ? 'PASS' : 'FAIL'}`);
log(`non-Moon whole-result identity: ${nonMoonCheck.wholeResultIdentical} of ${nonMoonCheck.results}`);
rt.v1.dispose();
rt.v2.dispose();
