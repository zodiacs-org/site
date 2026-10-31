/**
 * HOLDOUT DRIVER (post hoc, unscored). A copy of
 * tools/measure/partition-evaluation.mjs (SHA-256 1b41c4bb..., identical in
 * the #860 head tree and the version-1 tree) changed ONLY as listed here;
 * `driver-vs-harness.diff` beside this file is the exact diff.
 *
 *   node holdout-driver.mjs --pack=/path/to.zeph --cases=/path/to/run.json \
 *        --head=/path/to/head/precision-alpha --v1=/path/to/v1/precision-alpha \
 *        --out=file.json --label=holdout-1912 [--case=F2] [--repeat=4]
 *
 * Changes from the harness:
 *  1. The code under test is imported from --head (default: the #860 export)
 *     by absolute path, instead of '../../src', because this file does not
 *     live in that tree. Version 1 is imported from --v1 the same way.
 *  2. The cases are TAKEN from an earlier run's run.json (--cases), not
 *     redrawn: id, body, window and target exactly as recorded there. The
 *     record's own case-list digest is recomputed and checked, every window
 *     is checked to lie inside the pack's coverage and inside the records of
 *     every series the case uses, and `from`/`to` are checked against the
 *     harness's own tdb() of the recorded ISO dates.
 *  3. In the same invocation, version 1 (--v1) runs its plain deflected
 *     search and its partitioned path on every case, on its own opening of
 *     the same pack, with the same budgets. Those results are recorded under
 *     `v1` per case and in `additional`; they feed none of #860's targets.
 *  4. Extra raw output per case (`spans`, `p2.allProbes`, `refRoots`), so
 *     the record-join check can be done afterwards without re-running.
 *  5. An `additional` block after #860's report: the earlier rule's P-4
 *     (version 1's unpartitioned search in this invocation as the
 *     denominator, as PARTITION-EVALUATION-V2.md of the bundle section 7
 *     words it), the earlier rule's P-8, and the derived-class cross-check.
 *  Nothing in #860's scoring (P-1 to P-7, the verdict) is changed.
 *
 * Original header follows.
 *
 * The partition evaluation, by PARTITION-EVALUATION.md sections 5, 6 and 7.
 *
 *   node tools/measure/partition-evaluation.mjs --pack=/path/to.zeph \
 *        [--out=file.json] [--epoch=1975-01-01T00:00:00Z] [--case=F2]
 *        [--repeat=4] [--label=regression]
 *
 * Every threshold here is quoted from that document, which was committed
 * before the tuning began. Nothing in this file may quietly disagree with
 * it: where a number appears below, the section it comes from is named.
 *
 * The same construction serves the regression corpus (epoch 1975-01-01,
 * section 8 of DEFLECTION-EVALUATION.md) and the fresh holdout (epoch
 * 2007-03-15, section 7 here). The epoch is the ONLY declared difference.
 *
 * Research tool. Not in the published archive and not in the site build.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { loadavg, cpus } from 'node:os';
const STARTED_AT = new Date().toISOString();
const LOAD_AT_START = loadavg();

const args = new Map();
for (const a of process.argv.slice(2)) { const [k, v] = a.split('='); args.set(k.replace(/^--/, ''), v ?? true); }
const SCRATCH = '<scratch>/p45';
const HEAD = args.get('head') ?? `${SCRATCH}/prior-versions/head/examples/precision-alpha`;
const V1 = args.get('v1') ?? `${SCRATCH}/v1/examples/precision-alpha`;
const CASES_FILE = args.get('cases');
if (!CASES_FILE) { process.stderr.write('--cases is required\n'); process.exit(2); }
const { openPackFile } = await import(`${HEAD}/src/node.mjs`);
const { makeDeflectedReference } = await import(`${HEAD}/test/tier-b/_deflected-reference.mjs`);
const { searchDeflectedLongitude } = await import(`${HEAD}/src/core/retarded-search.mjs`);
const { searchDeflectedOverPartition } = await import(`${HEAD}/src/core/partitioned-search.mjs`);
const { partitionDomain, PARTITION_DEFAULTS } = await import(`${HEAD}/src/core/domain-partition.mjs`);
const { DEFLECTION_PROFILE } = await import(`${HEAD}/src/core/deflection.mjs`);
const V1M = {
  node: await import(`${V1}/src/node.mjs`),
  retarded: await import(`${V1}/src/core/retarded-search.mjs`),
  partitioned: await import(`${V1}/src/core/partitioned-search.mjs`),
  partition: await import(`${V1}/src/core/domain-partition.mjs`),
  deflection: await import(`${V1}/src/core/deflection.mjs`),
};
const CASE_RECORD = JSON.parse(readFileSync(CASES_FILE, 'utf8'));
const PACK = args.get('pack');
const OUT = args.get('out') ?? null;
const EPOCH = CASE_RECORD.epoch;
const ONE = args.get('case') ?? null;
const REPEAT = Number(args.get('repeat') ?? 4);
const LABEL = args.get('label') ?? (EPOCH.startsWith('1975') ? 'regression' : 'holdout');
if (!PACK) { process.stderr.write('--pack is required\n'); process.exit(2); }
if (LABEL === 'regression') { process.stderr.write('this driver runs earlier holdouts only; --label must not be regression\n'); process.exit(2); }

const DAY = 86400;
const J2000_UTC = Date.UTC(2000, 0, 1, 12);
const tdb = (iso) => (Date.parse(iso) - J2000_UTC) / 1000 + 69.184;
const plus = (iso, days) => `${new Date(Date.parse(iso) + days * DAY * 1000).toISOString().slice(0, 10)}T00:00:00Z`;

// ---------------------------------------------------- the frozen constants
/** DEFLECTION-EVALUATION.md section 6, unchanged and not reset anywhere. */
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const STEP = { Moon: 300, Mercury: 900, Venus: 1800, Sun: 1800, Mars: 1800, Jupiter: 3600, Saturn: 3600, Uranus: 3600, Neptune: 3600, Pluto: 3600 };
const ROOT_TOLERANCE_SEC = 1e-3;
const MATCH_WINDOW_SEC = 1;
const WALL_CLOCK_BUDGET_MS = 300000;
/** PARTITION-EVALUATION.md section 3. One allowance for the whole request. */
const MAX_EVALUATIONS = 4_000_000;
const MAX_CELLS = 400_000;
/** PARTITION-EVALUATION.md section 4, frozen before any target was written. */
const BOUNDARY_TOLERANCE_SEC = PARTITION_DEFAULTS.boundaryToleranceSec;
const RELIGHT_WIDTH_RATIO = PARTITION_DEFAULTS.relightWidthRatio;
/** PARTITION-EVALUATION.md section 6, each with the baseline it came from. */
const P2_APPROACH_DEG = 0.5;
const P3_BOUNDARY_FRACTION = 0.01;
const P4_FACTOR = 4;
const P5_FACTOR = 2;
const P7_ORIGINAL_SCORE = 6;
/**
 * Section 6 names these cases by id, for the regression corpus only. The
 * holdout's windows are different windows, so the names cannot carry over;
 * the derived rule below is used there and is reported as derived.
 */
const NAMED_CONJUNCTION_HEAVY = ['F2', 'A2', 'F3', 'F7'];
const NAMED_NO_CONJUNCTION = ['F6', 'F1', 'F10'];
/**
 * The derived rule, for a corpus whose case ids section 6 could not name.
 *
 * A case has NO conjunction only when the partition proved the whole
 * window admissible: nothing excluded, nothing boundary, nothing left
 * unprocessed. Anything else is conjunction-heavy.
 *
 * An earlier version keyed only on `excludedSec > 0`, which put the MOON
 * in the conjunction-free bucket -- the partition proves nothing excluded
 * on a Moon window, because at sixty seconds the elongation enclosure is
 * wider than the gap between a 0.38-degree closest approach and the floor,
 * so the whole conjunction comes back as boundary. Filing the hardest
 * conjunction case in the corpus as conjunction-free, and then scoring it
 * against the no-regression target instead of the reduction target, would
 * have been a bucketing that flattered the result. Boundary width is
 * evidence of a conjunction, not evidence of its absence.
 *
 * It reads the DOMAIN axis only. An earlier version also keyed on
 * `unprocessedSec`, which at the time held unsearched admissible spans as
 * well as unclassified ones, so a case whose SUBSEARCH was starved would
 * have been filed as conjunction-heavy on the strength of a budget
 * failure. Whether a window holds a conjunction is a fact about the sky,
 * not about the allowance.
 *
 * It is checked against the ids section 6 names, and any disagreement is
 * reported rather than resolved in favour of either.
 */
const derivedClass = (row) => (
  row.partition.excludedSec > 0 || row.partition.boundarySec > 0
    ? 'conjunction-heavy'
    : 'no-conjunction');

const rt = await openPackFile(PACK);
const eph = rt.ephemeris;
const ref = makeDeflectedReference(eph);
const packDigest = rt.integrity?.computedDigest ?? null;
if (!packDigest) { process.stderr.write("the pack did not report a computed digest; a partition key without one is not an identity\n"); process.exit(2); }

// ------------------------------------------- version 1, the same pack
const rtV1 = await V1M.node.openPackFile(PACK);
const ephV1 = rtV1.ephemeris;
const packDigestV1 = rtV1.integrity?.computedDigest ?? null;
if (packDigestV1 !== packDigest) { process.stderr.write(`the two trees compute different container digests: ${packDigest} vs ${packDigestV1}\n`); process.exit(2); }

// ------------------------------------------------------------- the cases
/**
 * CHANGED: taken from the earlier run's record, not redrawn. The record's
 * `cases` array is the list its `caseListDigest` was computed over (the
 * bundle harness: sha256(JSON.stringify(caseList))), so the digest is
 * recomputed here first: a mismatch would mean this is not the list that
 * run opened.
 */
const sha256 = (x) => createHash('sha256').update(x).digest('hex');
const recordedList = CASE_RECORD.cases;
const caseListCheck = {
  file: CASES_FILE,
  recordedDigest: CASE_RECORD.caseListDigest ?? null,
  recomputedDigest: sha256(JSON.stringify(recordedList)),
};
caseListCheck.ok = caseListCheck.recordedDigest === caseListCheck.recomputedDigest;
if (!caseListCheck.ok) { process.stderr.write(`the case list does not match its recorded digest: ${JSON.stringify(caseListCheck)}\n`); process.exit(2); }
const { targetWeights, observerWeights, coverage: seriesCoverage } = await import(`${HEAD}/src/core/retarded.mjs`);
const CASES = [];
const caseChecks = [];
for (const c of recordedList) {
  if (c.skipped) { CASES.push({ id: c.id, body: c.body, fromIso: c.fromIso, toIso: c.toIso, skipped: c.skipped }); continue; }
  const series = c.id.startsWith('F') ? 'main' : 'antipode';
  const used = new Map([...targetWeights(eph, c.body), ...observerWeights(eph), ...targetWeights(eph, 'Sun')]);
  const [recLo, recHi] = seriesCoverage(eph, used);
  const check = {
    id: c.id,
    body: c.body,
    fromIso: c.fromIso,
    toIso: c.toIso,
    from: c.from,
    to: c.to,
    fromMatchesTdbOfIso: Object.is(c.from, tdb(c.fromIso)),
    toMatchesTdbOfIso: Object.is(c.to, tdb(c.toIso)),
    insidePackCoverage: c.from >= eph.coverage.startEtSecTdb && c.to <= eph.coverage.stopEtSecTdb,
    // A day of margin before the window for the emission times (light-time
    // is seconds for the Moon, hours for Pluto).
    insideRecordsOfEverySeriesUsed: c.from - DAY >= recLo && c.to <= recHi,
    seriesUsed: [...used.keys()],
    recordsTdbSec: [recLo, recHi],
  };
  caseChecks.push(check);
  if (!(check.fromMatchesTdbOfIso && check.toMatchesTdbOfIso && check.insidePackCoverage && check.insideRecordsOfEverySeriesUsed)) {
    process.stderr.write(`a recorded case fails its checks: ${JSON.stringify(check)}\n`); process.exit(2);
  }
  CASES.push({ id: c.id, series, body: c.body, from: c.from, to: c.to, fromIso: c.fromIso, toIso: c.toIso, targetDeg: c.targetDeg });
}

// --------------------------------------------------------------- helpers
const total = (spans) => spans.reduce((a, [lo, hi]) => a + (hi - lo), 0);
const inAny = (t, spans) => spans.some(([lo, hi]) => t >= lo && t <= hi);

/**
 * P-2, applied to one boundary span. The partition's own enclosure is not
 * consulted: the elongation is sampled INDEPENDENTLY, through the tier-b
 * reference, and the question is how close to the floor it ever comes.
 *
 * A span that never approaches the floor is a failure of the partition --
 * it would mean the classifier stopped bisecting somewhere the geometry
 * gave it no reason to.
 */
function approachesFloor(body, [lo, hi]) {
  const floor = DEFLECTION_PROFILE.minElongationDeg;
  const n = 64;
  let best = Infinity;
  let refusals = 0;
  for (let k = 0; k <= n; k += 1) {
    const t = lo + ((hi - lo) * k) / n;
    const el = ref.elongationDeg(body, t);
    if (el === null) { refusals += 1; continue; }
    best = Math.min(best, Math.abs(el - floor));
  }
  return { closestApproachDeg: Number.isFinite(best) ? best : null, refusals, samples: n + 1 - refusals };
}

/** Greedy nearest-pair matching, the same rule section 4 of the holdout uses. */
function match(events, roots) {
  const candidates = [];
  for (let i = 0; i < events.length; i += 1) {
    for (let j = 0; j < roots.length; j += 1) {
      const d = Math.abs(events[i].tdbSec - roots[j]);
      if (d <= MATCH_WINDOW_SEC) candidates.push({ i, j, d });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  const takenI = new Set(); const takenJ = new Set();
  const matched = [];
  for (const c of candidates) {
    if (takenI.has(c.i) || takenJ.has(c.j)) continue;
    takenI.add(c.i); takenJ.add(c.j);
    const e = events[c.i];
    matched.push({
      tdbSec: e.tdbSec,
      referenceTdbSec: roots[c.j],
      deltaSec: e.tdbSec - roots[c.j],
      bracketed: e.bracketTdbSec[0] <= roots[c.j] && roots[c.j] <= e.bracketTdbSec[1],
    });
  }
  return { matched, unmatchedEvents: events.filter((_, i) => !takenI.has(i)), unmatchedRoots: roots.filter((_, j) => !takenJ.has(j)) };
}

// ----------------------------------------------------------------- the run
const rows = [];
const scanCache = new Map();
for (const c of CASES) {
  if (ONE && c.id !== ONE) continue;
  if (c.skipped) { rows.push({ id: c.id, body: c.body, skipped: c.skipped }); continue; }
  const spec = { body: c.body, targetDeg: c.targetDeg, fromTdbSec: c.from, toTdbSec: c.to };

  // --- the baseline: the ORIGINAL search, unchanged, same budget
  const t0 = Date.now();
  const base = searchDeflectedLongitude(eph, { ...spec, maxEvaluations: MAX_EVALUATIONS, maxCells: MAX_CELLS });
  const baseMs = Date.now() - t0;

  // --- the partitioned path, COLD: partition cost charged to this request
  const t1 = Date.now();
  const part = searchDeflectedOverPartition(eph, {
    ...spec,
    packDigest,
    boundaryToleranceSec: BOUNDARY_TOLERANCE_SEC,
    relightWidthRatio: RELIGHT_WIDTH_RATIO,
    maxEvaluations: MAX_EVALUATIONS,
    maxCells: MAX_CELLS,
  });
  const partMs = Date.now() - t1;

  // --- ADDED: version 1 in the same invocation, same pack, same budgets.
  // Feeds none of #860's targets; the earlier rule's P-4 denominator.
  const t1a = Date.now();
  const v1Base = V1M.retarded.searchDeflectedLongitude(ephV1, { ...spec, maxEvaluations: MAX_EVALUATIONS, maxCells: MAX_CELLS });
  const v1BaseMs = Date.now() - t1a;
  const t1b = Date.now();
  const v1Part = V1M.partitioned.searchDeflectedOverPartition(ephV1, {
    ...spec,
    packDigest: packDigestV1,
    boundaryToleranceSec: BOUNDARY_TOLERANCE_SEC,
    relightWidthRatio: RELIGHT_WIDTH_RATIO,
    maxEvaluations: MAX_EVALUATIONS,
    maxCells: MAX_CELLS,
  });
  const v1PartMs = Date.now() - t1b;

  // --- the independent reference, for bracketing and for P-6
  const scanKey = `${c.body}|${c.targetDeg}|${c.from}|${c.to}`;
  if (!scanCache.has(scanKey)) scanCache.set(scanKey, ref.crossings(c.body, c.targetDeg, c.from, c.to, STEP[c.body]));
  const scan = scanCache.get(scanKey);

  // --- P-2: every boundary span must come within 0.5 deg of the floor
  const boundaryProbes = part.plan.boundary.map((s) => ({ span: s, widthSec: s[1] - s[0], ...approachesFloor(c.body, s) }));
  const p2Failures = boundaryProbes.filter((p) => p.closestApproachDeg === null || p.closestApproachDeg > P2_APPROACH_DEG);

  // --- P-3: total boundary width against the requested window
  const requestSec = c.to - c.from;
  const boundaryFraction = part.accounting.boundarySec / requestSec;

  // --- P-6: every baseline event inside a PROVED-ADMISSIBLE span found again
  const adm = part.plan.admissible;
  const baseInAdmissible = base.events.filter((e) => inAny(e.tdbSec, adm));
  const refound = baseInAdmissible.filter((e) => part.events.some((q) => Math.abs(q.tdbSec - e.tdbSec) <= MATCH_WINDOW_SEC));
  const lost = baseInAdmissible.filter((e) => !refound.includes(e));
  const m = match(part.events, scan.roots);
  const rootsInAdmissible = scan.roots.filter((t) => inAny(t, adm));
  const matchedInAdmissible = m.matched.filter((x) => inAny(x.referenceTdbSec, adm));

  rows.push({
    id: c.id,
    series: c.series,
    body: c.body,
    from: c.fromIso,
    to: c.toIso,
    targetDeg: c.targetDeg,
    requestDays: requestSec / DAY,
    baseline: {
      status: base.execution.status,
      established: base.completeness.established,
      events: base.events.length,
      evaluations: base.execution.evaluations,
      cells: base.execution.cells,
      ms: baseMs,
      withinWallClock: baseMs <= WALL_CLOCK_BUDGET_MS,
      excludedSpanDays: base.accounting.excluded.reduce((a, x) => a + (x.toTdbSec - x.fromTdbSec), 0) / DAY,
      unresolvedRuns: base.accounting.unresolved.length,
    },
    partition: {
      status: part.execution.status,
      finished: part.execution.finished,
      reason: part.execution.reason,
      events: part.events.length,
      eligibilityEstablished: part.eventCount.eligibilityEstablished,
      eligibilityAmbiguous: part.eventCount.eligibilityAmbiguous,
      overRequest: part.completeness.overRequest,
      exhaustiveOverAdmissible: part.completeness.exhaustiveOverAdmissible,
      mayHoldUnfoundSupportedEvents: part.completeness.mayHoldUnfoundSupportedEvents,
      evaluations: part.execution.evaluations,
      partitionEvaluations: part.execution.partitionEvaluations,
      searchEvaluations: part.execution.searchEvaluations,
      cells: part.execution.cells,
      ms: partMs,
      withinWallClock: partMs <= WALL_CLOCK_BUDGET_MS,
      admissibleSec: part.accounting.admissibleSec,
      excludedSec: part.accounting.excludedSec,
      boundarySec: part.accounting.boundarySec,
      unprocessedSec: part.accounting.unprocessedSec,
      notSearchedSec: part.accounting.notSearchedSec,
      admissibleNotFullyExaminedSec: part.accounting.admissibleNotFullyExaminedSec,
      planImported: part.execution.planImported,
      coversRequestExactly: part.accounting.coversRequestExactly,
      admissibleSpans: adm.length,
      excludedSpans: part.plan.excluded.length,
      boundarySpans: part.plan.boundary.length,
      narrowestBoundarySec: part.plan.diagnostics.narrowestBoundarySec,
      widestBoundarySec: part.plan.diagnostics.widestBoundarySec,
    },
    reference: {
      roots: scan.roots.length,
      samples: scan.samples,
      stepSec: scan.stepSec,
      refusals: scan.refusals,
      rootsInAdmissible: rootsInAdmissible.length,
    },
    correspondence: {
      matched: m.matched.length,
      matchedInAdmissible: matchedInAdmissible.length,
      worstDeltaSec: m.matched.reduce((a, x) => Math.max(a, Math.abs(x.deltaSec)), 0),
      everyMatchedRootBracketed: m.matched.every((x) => x.bracketed),
      withinRootTolerance: m.matched.every((x) => Math.abs(x.deltaSec) <= ROOT_TOLERANCE_SEC) || null,
      unmatchedPartitionEvents: m.unmatchedEvents.length,
      unmatchedReferenceRootsInAdmissible: rootsInAdmissible.length - matchedInAdmissible.length,
    },
    p2: {
      boundarySpansProbed: boundaryProbes.length,
      worstClosestApproachDeg: boundaryProbes.reduce((a, p) => Math.max(a, p.closestApproachDeg ?? Infinity), 0),
      failures: p2Failures.length,
      failingSpans: p2Failures.slice(0, 5).map((p) => ({ span: p.span, widthSec: p.widthSec, closestApproachDeg: p.closestApproachDeg })),
    },
    p3: { boundaryFraction, limit: P3_BOUNDARY_FRACTION, pass: boundaryFraction <= P3_BOUNDARY_FRACTION },
    p6: {
      baselineEventsInAdmissible: baseInAdmissible.length,
      refound: refound.length,
      lost: lost.length,
      lostAt: lost.map((e) => e.tdbSec),
      claimsNoCompletenessOverExcludedRequest: !(part.completeness.overRequest && part.accounting.excludedSec > 0),
      /**
       * The first version of this compared `mayHoldUnfoundSupportedEvents`
       * with `undefined`, which the runtime never returns, so the whole
       * expression was always true and the field could not detect
       * anything. It shipped in the evidence under a name that reads as a
       * criterion. This is the per-case form of the aggregate below: an
       * exhaustiveness claim standing beside unsearched or unclassified
       * time must also carry the warning that something may be hiding
       * there.
       */
      claimsNoExhaustivenessWithLiveBoundary: !(
        part.completeness.exhaustiveOverAdmissible
        && (part.accounting.boundarySec > 0
          || part.accounting.unprocessedSec > 0
          || (part.accounting.notSearchedSec ?? 0) > 0)
        && part.completeness.mayHoldUnfoundSupportedEvents !== true
      ),
    },
    ratio: base.execution.evaluations / Math.max(1, part.execution.evaluations),
    /**
     * A baseline that stopped on its budget did not report a COST, it
     * reported a ceiling. The ratio above is then a lower bound on the
     * true factor, and P-4 is scored on it literally anyway: the
     * preregistration knew these two cases were exhausted when it set the
     * target, so re-reading the denominator now would be changing the
     * rule after seeing the result. The annotation is commentary beside
     * the score, not a substitute for it.
     */
    ratioIsLowerBound: base.execution.status !== 'finished',
    derivedClass: null,
    // ---- ADDED: raw output for the record-join check. No target reads it.
    spans: {
      baseline: {
        excluded: base.accounting.excluded.map((x) => [x.fromTdbSec, x.toTdbSec]),
        unresolved: base.accounting.unresolved.map((x) => ({ span: [x.fromTdbSec, x.toTdbSec], cells: x.cells ?? null, why: x.why ?? null })),
      },
      partition: {
        admissible: part.plan.admissible,
        excluded: part.plan.excluded,
        boundary: part.plan.boundary,
        unprocessed: part.plan.unprocessed,
        unresolved: part.accounting.unresolved.map((u) => ({ span: [u.fromTdbSec, u.toTdbSec], domain: u.domain ?? null, cells: u.cells ?? null, why: u.why ?? null })),
        notSearched: part.accounting.notSearched ?? null,
        admissibleNotFullyExamined: part.accounting.admissibleNotFullyExamined ?? null,
      },
      partitionDiagnostics: part.plan.diagnostics,
    },
    p2AllProbes: boundaryProbes,
    refRoots: scan.roots,
    eventList: {
      baseline: base.events.map((e) => ({ tdbSec: e.tdbSec, bracketTdbSec: e.bracketTdbSec, kind: e.kind ?? null, direction: e.direction ?? null })),
      partition: part.events.map((e) => ({ tdbSec: e.tdbSec, bracketTdbSec: e.bracketTdbSec, kind: e.kind ?? null, direction: e.direction ?? null, domain: e.domain ?? null, eligibility: e.eligibility ?? null })),
    },
    v1: {
      baseline: {
        status: v1Base.execution.status,
        established: v1Base.completeness.established,
        events: v1Base.events.length,
        evaluations: v1Base.execution.evaluations,
        cells: v1Base.execution.cells,
        ms: v1BaseMs,
        excludedSpanDays: v1Base.accounting.excluded.reduce((a, x) => a + (x.toTdbSec - x.fromTdbSec), 0) / DAY,
        unresolvedRuns: v1Base.accounting.unresolved.length,
        eventTimes: v1Base.events.map((e) => e.tdbSec),
      },
      partition: {
        status: v1Part.execution.status,
        finished: v1Part.execution.finished,
        events: v1Part.events.length,
        overRequest: v1Part.completeness.overRequest,
        exhaustiveOverAdmissible: v1Part.completeness.exhaustiveOverAdmissible,
        evaluations: v1Part.execution.evaluations,
        partitionEvaluations: v1Part.execution.partitionEvaluations,
        searchEvaluations: v1Part.execution.searchEvaluations,
        cells: v1Part.execution.cells,
        ms: v1PartMs,
        admissibleSec: v1Part.accounting.admissibleSec,
        excludedSec: v1Part.accounting.excludedSec,
        boundarySec: v1Part.accounting.boundarySec,
        unprocessedSec: v1Part.accounting.unprocessedSec,
        boundarySpans: v1Part.plan.boundary.length,
        derivedClass: v1Part.accounting.excludedSec > 0 || v1Part.accounting.boundarySec > 0 ? 'conjunction-heavy' : 'no-conjunction',
      },
    },
  });
  process.stderr.write(`${c.id} ${c.body}: baseline ${base.execution.evaluations} (${base.execution.status}) -> partition ${part.execution.evaluations} (${part.execution.status}), ${(base.execution.evaluations / Math.max(1, part.execution.evaluations)).toFixed(2)}x | v1 baseline ${v1Base.execution.evaluations} (${v1Base.execution.status}), v1 partition ${v1Part.execution.evaluations} (${v1Part.execution.status})\n`);
}
for (const r of rows) if (!r.skipped) r.derivedClass = derivedClass(r);

// ------------------------------------------- section 5: cold vs repeated
/**
 * The same partition answering several longitudes. The partition is paid
 * for ONCE; each longitude is a separate request with its own budget, and
 * the baseline is run on the same longitudes so the break-even is computed
 * rather than estimated.
 */
const longitudesFor = (t) => Array.from({ length: REPEAT }, (_, k) => Number((((t + 90 * k) % 360 + 360) % 360).toFixed(6)));
const repeated = [];
for (const c of CASES) {
  if (ONE && c.id !== ONE) continue;
  if (c.skipped || c.series !== 'main') continue;
  const targets = longitudesFor(c.targetDeg);
  const tp = Date.now();
  const plan = partitionDomain(eph, {
    body: c.body,
    fromTdbSec: c.from,
    toTdbSec: c.to,
    boundaryToleranceSec: BOUNDARY_TOLERANCE_SEC,
    relightWidthRatio: RELIGHT_WIDTH_RATIO,
    packDigest,
    maxEvaluations: MAX_EVALUATIONS,
    maxCells: MAX_CELLS,
  });
  const planMs = Date.now() - tp;
  let warmEval = 0; let warmMs = 0; let baseEval = 0; let baseMs = 0; let reusedAll = true;
  for (const targetDeg of targets) {
    const spec = { body: c.body, targetDeg, fromTdbSec: c.from, toTdbSec: c.to };
    const t2 = Date.now();
    const q = searchDeflectedOverPartition(eph, { ...spec, plan, packDigest, maxEvaluations: MAX_EVALUATIONS, maxCells: MAX_CELLS });
    warmMs += Date.now() - t2;
    warmEval += q.execution.evaluations;
    if (!q.execution.partitionReused) reusedAll = false;
    const t3 = Date.now();
    const bq = searchDeflectedLongitude(eph, { ...spec, maxEvaluations: MAX_EVALUATIONS, maxCells: MAX_CELLS });
    baseMs += Date.now() - t3;
    baseEval += bq.execution.evaluations;
  }
  const perQueryWarm = warmEval / targets.length;
  const perQueryBase = baseEval / targets.length;
  const saving = perQueryBase - perQueryWarm;
  repeated.push({
    id: c.id,
    body: c.body,
    longitudes: targets,
    partitionEvaluations: plan.execution.evaluations,
    partitionMs: planMs,
    partitionReusedEveryQuery: reusedAll,
    perQueryWarmEvaluations: perQueryWarm,
    perQueryBaselineEvaluations: perQueryBase,
    warmTotalEvaluations: warmEval,
    baselineTotalEvaluations: baseEval,
    warmMs,
    baselineMs: baseMs,
    /**
     * n such that partition + n*warm < n*baseline. Null when a single
     * query already costs more warm than baseline -- there is then no n,
     * and reporting a number would invent one.
     */
    breakEvenQueries: saving > 0 ? Math.floor(plan.execution.evaluations / saving) + 1 : null,
    breakEvenNote: saving > 0 ? null : 'no break-even: a warm query costs at least as much as a baseline query on this case',
  });
  process.stderr.write(`${c.id} repeated: plan ${plan.execution.evaluations}, warm ${perQueryWarm.toFixed(0)}/query vs baseline ${perQueryBase.toFixed(0)}/query\n`);
}

// ------------------------------------------------------- section 6 scoring
const live = rows.filter((r) => !r.skipped);
const named = (ids) => live.filter((r) => ids.includes(r.id));
const useNames = LABEL === 'regression' && !ONE;
const heavy = useNames ? named(NAMED_CONJUNCTION_HEAVY) : live.filter((r) => r.derivedClass === 'conjunction-heavy');
const light = useNames ? named(NAMED_NO_CONJUNCTION) : live.filter((r) => r.derivedClass === 'no-conjunction');

const moon = live.filter((r) => r.body === 'Moon');
const p1 = {
  target: 'both Moon cases reach finished within the unchanged 4,000,000-evaluation whole-request budget',
  baseline: moon.map((r) => ({ id: r.id, status: r.baseline.status, evaluations: r.baseline.evaluations })),
  now: moon.map((r) => ({ id: r.id, status: r.partition.status, evaluations: r.partition.evaluations, events: r.partition.events })),
  pass: moon.length === 0 ? null : moon.every((r) => r.partition.status === 'finished' && r.partition.evaluations <= MAX_EVALUATIONS),
  notScored: moon.length === 0 ? 'no Moon case in this run' : null,
};
const p2 = {
  target: `every reported boundary span comes within ${P2_APPROACH_DEG} degrees of the ${DEFLECTION_PROFILE.minElongationDeg}-degree floor`,
  spansProbed: live.reduce((a, r) => a + r.p2.boundarySpansProbed, 0),
  failures: live.reduce((a, r) => a + r.p2.failures, 0),
  worstCases: live.filter((r) => r.p2.failures > 0).map((r) => ({ id: r.id, failures: r.p2.failures, failingSpans: r.p2.failingSpans })),
  pass: live.every((r) => r.p2.failures === 0),
};
const p3 = {
  target: `total boundary width at most ${P3_BOUNDARY_FRACTION * 100}% of the requested window`,
  worst: live.reduce((a, r) => (r.p3.boundaryFraction > (a?.fraction ?? -1) ? { id: r.id, body: r.body, fraction: r.p3.boundaryFraction } : a), null),
  perCase: live.map((r) => ({ id: r.id, fraction: r.p3.boundaryFraction, pass: r.p3.pass })),
  failures: live.filter((r) => !r.p3.pass).map((r) => ({ id: r.id, fraction: r.p3.boundaryFraction })),
  pass: live.every((r) => r.p3.pass),
};
/**
 * Section 6 names case ids; the derived rule above is what a corpus with
 * different windows has to use instead. Where both apply they must agree,
 * and a disagreement is printed rather than settled silently.
 */
const derivedAgreesWithNames = {
  checked: useNames,
  conjunctionHeavy: NAMED_CONJUNCTION_HEAVY.map((id) => {
    const r = live.find((x) => x.id === id);
    return { id, named: 'conjunction-heavy', derived: r ? r.derivedClass : null, agrees: r ? r.derivedClass === 'conjunction-heavy' : null };
  }),
  noConjunction: NAMED_NO_CONJUNCTION.map((id) => {
    const r = live.find((x) => x.id === id);
    return { id, named: 'no-conjunction', derived: r ? r.derivedClass : null, agrees: r ? r.derivedClass === 'no-conjunction' : null };
  }),
};
derivedAgreesWithNames.allAgree = !useNames ? null
  : [...derivedAgreesWithNames.conjunctionHeavy, ...derivedAgreesWithNames.noConjunction].every((x) => x.agrees === true);

const p4 = {
  target: `cold end-to-end evaluations at most 1/${P4_FACTOR} of the baseline on every conjunction-heavy case`,
  basis: useNames ? `the case ids section 6 names: ${NAMED_CONJUNCTION_HEAVY.join(', ')}` : 'derived: the partition proves some of the window excluded',
  perCase: heavy.map((r) => ({
    id: r.id, body: r.body, baseline: r.baseline.evaluations, baselineStatus: r.baseline.status,
    cold: r.partition.evaluations, ratio: r.ratio, ratioIsLowerBound: r.ratioIsLowerBound,
    pass: r.ratio >= P4_FACTOR,
  })),
  againstATruncatedBaseline: heavy.filter((r) => r.ratioIsLowerBound).map((r) => r.id),
  againstATruncatedBaselineNote: 'the denominator on these is the 4,000,000 budget ceiling, not a measured cost: the baseline never finished, so the true factor is unknown and at least the ratio shown. Scored literally regardless.',
  pass: heavy.length === 0 ? null : heavy.every((r) => r.ratio >= P4_FACTOR),
  notScored: heavy.length === 0 ? 'no conjunction-heavy case in this run' : null,
};
const p5 = {
  target: `cold end-to-end evaluations at most ${P5_FACTOR}x the baseline on every case with no conjunction`,
  basis: useNames ? `the case ids section 6 names: ${NAMED_NO_CONJUNCTION.join(', ')}` : 'derived: the partition proves none of the window excluded',
  perCase: light.map((r) => ({ id: r.id, body: r.body, baseline: r.baseline.evaluations, cold: r.partition.evaluations, ratio: r.ratio, pass: r.partition.evaluations <= P5_FACTOR * r.baseline.evaluations })),
  pass: light.length === 0 ? null : light.every((r) => r.partition.evaluations <= P5_FACTOR * r.baseline.evaluations),
  notScored: light.length === 0 ? 'no conjunction-free case in this run' : null,
};
const p6 = {
  target: 'no baseline event inside a proved-admissible span is lost; no claim is stronger than what was proved',
  baselineEventsInAdmissible: live.reduce((a, r) => a + r.p6.baselineEventsInAdmissible, 0),
  lost: live.reduce((a, r) => a + r.p6.lost, 0),
  lostCases: live.filter((r) => r.p6.lost > 0).map((r) => ({ id: r.id, lostAt: r.p6.lostAt })),
  everyMatchedRootBracketed: live.every((r) => r.correspondence.everyMatchedRootBracketed),
  worstDeltaSec: live.reduce((a, r) => Math.max(a, r.correspondence.worstDeltaSec), 0),
  withinRootTolerance: live.every((r) => r.correspondence.worstDeltaSec <= ROOT_TOLERANCE_SEC),
  noCompletenessOverExcludedRequest: live.every((r) => r.p6.claimsNoCompletenessOverExcludedRequest),
  noExhaustivenessWithLiveBoundary: live.every((r) => r.p6.claimsNoExhaustivenessWithLiveBoundary),
  pass: null,
};
p6.pass = p6.lost === 0
  && p6.everyMatchedRootBracketed
  && p6.withinRootTolerance
  && p6.noCompletenessOverExcludedRequest
  && p6.noExhaustivenessWithLiveBoundary;

const originalScore = live.filter((r) => r.baseline.established).length;
const partitionScore = live.filter((r) => r.partition.overRequest).length;
const p7 = {
  target: `the original full-window completeness score, by the original rule, over the same cases; ${P7_ORIGINAL_SCORE} of 20 on the regression corpus`,
  denominator: live.length,
  originalRuleOnBaseline: originalScore,
  originalRuleOnPartitionedPath: partitionScore,
  agree: originalScore === partitionScore,
  disagreements: live.filter((r) => r.baseline.established !== r.partition.overRequest).map((r) => ({ id: r.id, baseline: r.baseline.established, partitioned: r.partition.overRequest })),
  newMetricExhaustiveOverAdmissible: live.filter((r) => r.partition.exhaustiveOverAdmissible).length,
  newMetricNote: 'a DIFFERENT claim with its own denominator: exhaustive over the spans the partition proves admissible, not over the request',
  /**
   * Both halves. The first version scored only `originalScore`, which is
   * a property of the UNPARTITIONED rung -- so the partitioned path could
   * have scored five of twenty, populated `disagreements`, and P-7 would
   * still have passed. The regression P-7 exists to catch is the
   * partitioned path being weaker by the original rule, so the agreement
   * is part of the gate.
   *
   * This is a strictly harder condition than the preregistration's
   * sentence, added after seeing the run: it can only turn a pass into a
   * failure, never the other way, and on both corpora `agree` is true, so
   * no verdict moved when it was added.
   */
  pass: LABEL === 'regression' && !ONE
    ? originalScore === P7_ORIGINAL_SCORE && originalScore === partitionScore
    : null,
  passNote: LABEL === 'regression' && !ONE ? null : 'the 6-of-20 figure is a property of the regression corpus; on any other corpus the score is reported, not scored',
};

const report = {
  tool: 'partition-evaluation',
  rule: 'PARTITION-EVALUATION.md sections 5, 6 and 7',
  label: LABEL,
  epoch: EPOCH,
  pack: PACK,
  packDigest,
  profile: DEFLECTION_PROFILE,
  knobs: { boundaryToleranceSec: BOUNDARY_TOLERANCE_SEC, relightWidthRatio: RELIGHT_WIDTH_RATIO, amended: false },
  budgets: { maxEvaluations: MAX_EVALUATIONS, maxCells: MAX_CELLS, wallClockMs: WALL_CLOCK_BUDGET_MS, rootToleranceSec: ROOT_TOLERANCE_SEC, matchWindowSec: MATCH_WINDOW_SEC },
  cases: rows,
  repeated,
  targets: { P1: p1, P2: p2, P3: p3, P4: p4, P5: p5, P6: p6, P7: p7 },
  derivedAgreesWithNames,
  verdict: {
    /**
     * Section 6: failing P-1 or P-6 fails the whole thing. A target that
     * this run did not SCORE -- because `--case` left it with no cases --
     * is null, and null is not a failure. A filtered run is partial by
     * construction and says so rather than borrowing a verdict.
     */
    fatal: p1.pass === false || p6.pass === false,
    partial: [p2, p3, p4, p5].some((x) => x.pass === false),
    notScored: Object.entries({ P1: p1, P2: p2, P3: p3, P4: p4, P5: p5, P6: p6, P7: p7 })
      .filter(([, x]) => x.pass === null).map(([k]) => k),
    filtered: ONE !== null,
    summary: null,
  },
};
report.verdict.summary = report.verdict.filtered
  ? `PARTIAL RUN (--case=${ONE}): not the declared evaluation, and no verdict is claimed from it`
  : report.verdict.fatal
  ? 'FAIL: P-1 or P-6 did not hold, and section 6 makes either fatal'
  : (report.verdict.partial
    ? 'PARTIAL: P-1 and P-6 hold; at least one of P-2..P-5 does not, and is recorded with its measured number'
    : 'PASS: every declared target held');

// ------------------------------------------------- ADDED: not #860's targets
/**
 * Everything below is outside #860's rule and changes nothing above.
 *
 * The earlier rule (bundle PARTITION-EVALUATION-V2.md section 7): on a
 * holdout, P-4 and P-5 take their denominators from the ORIGINAL runtime's
 * unpartitioned search on the same case, run in the same invocation; the
 * conjunction-heavy cases are derived from the partition under test
 * (excluded or boundary time > 0) and cross-checked against the version-1
 * partition's classes. Its harness also required the partitioned run to
 * have finished. P-8: the unpartitioned deflected Moon search, with the
 * package defaults (4,000,000 / 400,000, the budgets used here), reaches
 * `finished` on F2 and A2.
 */
const earlierRatio = (r) => r.v1.baseline.evaluations / Math.max(1, r.partition.evaluations);
const additional = {
  postHoc: 'These holdouts were opened by earlier versions (bundle branch moon-enclosure). For #860\'s code they are previously seen data: everything in this file is post hoc and unscored.',
  node: process.version,
  startedAt: STARTED_AT,
  finishedAt: new Date().toISOString(),
  cpus: cpus().length,
  loadAverage: { atStart: LOAD_AT_START, atEnd: loadavg() },
  wallClockNote: 'Wall times are secondary and not scored; the machine was shared with other work and the run was under nice -n 10. Evaluations and cells are deterministic.',
  head: HEAD,
  v1: V1,
  caseListCheck,
  caseChecks,
  packDigestV1: packDigestV1,
  earlierRuleP4: {
    target: 'cold end-to-end evaluations of the partitioned path at most 1/4 of the ORIGINAL runtime\'s unpartitioned search on the same case (this invocation), on every derived conjunction-heavy case; the partitioned run must have finished',
    basis: 'derived from the #860 partition: excluded or boundary time > 0',
    perCase: live.filter((r) => r.derivedClass === 'conjunction-heavy').map((r) => ({
      id: r.id,
      body: r.body,
      denominatorV1Unpartitioned: r.v1.baseline.evaluations,
      denominatorStatus: r.v1.baseline.status,
      cold: r.partition.evaluations,
      coldStatus: r.partition.status,
      ratio: earlierRatio(r),
      ratioIsLowerBound: r.v1.baseline.status !== 'finished',
      pass: r.partition.status === 'finished' && earlierRatio(r) >= P4_FACTOR,
    })),
  },
  earlierRuleP5: {
    target: 'cold evaluations at most twice the ORIGINAL runtime\'s unpartitioned search, on every derived conjunction-free case (reported beside P-4; the task asked for P-4 and P-8)',
    perCase: live.filter((r) => r.derivedClass === 'no-conjunction').map((r) => ({
      id: r.id, body: r.body, denominatorV1Unpartitioned: r.v1.baseline.evaluations, cold: r.partition.evaluations,
      pass: r.partition.status === 'finished' && r.partition.evaluations <= P5_FACTOR * r.v1.baseline.evaluations,
    })),
  },
  earlierRuleP8: {
    target: 'the unpartitioned deflected search (#860 code), package-default budgets, reaches finished on both Moon cases',
    now: moon.map((r) => ({ id: r.id, status: r.baseline.status, evaluations: r.baseline.evaluations, cells: r.baseline.cells, events: r.baseline.events })),
    originalRuntime: moon.map((r) => ({ id: r.id, status: r.v1.baseline.status, evaluations: r.v1.baseline.evaluations, cells: r.v1.baseline.cells, events: r.v1.baseline.events })),
  },
  v2Rule: {
    target: 'V-2: on F2 and A2 both the partitioned search and the plain deflected search reach finished within 4,000,000 evaluations',
    perCase: moon.map((r) => ({
      id: r.id,
      partitioned: { status: r.partition.status, evaluations: r.partition.evaluations },
      plain: { status: r.baseline.status, evaluations: r.baseline.evaluations },
      pass: r.partition.status === 'finished' && r.partition.evaluations <= MAX_EVALUATIONS
        && r.baseline.status === 'finished' && r.baseline.evaluations <= MAX_EVALUATIONS,
    })),
  },
  derivedClassCrossCheck: live.map((r) => ({ id: r.id, head: r.derivedClass, v1: r.v1.partition.derivedClass, agree: r.derivedClass === r.v1.partition.derivedClass })),
};
additional.earlierRuleP4.pass = additional.earlierRuleP4.perCase.length === 0 ? null : additional.earlierRuleP4.perCase.every((x) => x.pass);
additional.earlierRuleP5.pass = additional.earlierRuleP5.perCase.length === 0 ? null : additional.earlierRuleP5.perCase.every((x) => x.pass);
additional.earlierRuleP8.pass = moon.length === 0 ? null : moon.every((r) => r.baseline.status === 'finished');
additional.v2Rule.pass = moon.length === 0 ? null : additional.v2Rule.perCase.every((x) => x.pass);
report.additional = additional;

if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`); }
process.stdout.write(`${JSON.stringify(report.targets, null, 2)}\n${report.verdict.summary}\n`);
process.stdout.write(`ADDED (not #860's targets): earlier-rule P-4 ${additional.earlierRuleP4.pass}, earlier-rule P-5 ${additional.earlierRuleP5.pass}, earlier-rule P-8 ${additional.earlierRuleP8.pass}, V-2 ${additional.v2Rule.pass}, derived classes agree ${additional.derivedClassCrossCheck.every((x) => x.agree)}\n`);
