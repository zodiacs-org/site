/**
 * Compact summary of the two post hoc holdout runs and the join checks.
 * Reads only JSON already written in this folder and the bundle's records.
 * Ratios are rounded DOWN to two decimals and boundary shares UP to three
 * significant figures, as the existing records do.
 *
 *   node summarise.mjs --out=summary.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = new Map();
for (const a of process.argv.slice(2)) { const [k, v] = a.split('='); args.set(k.replace(/^--/, ''), v ?? true); }
const HERE = new URL('.', import.meta.url).pathname;
const BUNDLE = '<moon-enclosure-export>/docs/platform/evidence';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const floor2 = (x) => Math.floor(x * 100) / 100;
const ceilSig3 = (x) => {
  if (x === 0) return 0;
  const e = Math.floor(Math.log10(Math.abs(x))) - 2;
  const f = 10 ** e;
  return Number((Math.ceil(x / f - 1e-9) * f).toPrecision(3));
};

const holdouts = [
  { id: 'holdout-1912', earlierName: 'bundle version 2 holdout (seed 0xc3c7ac8f, windows from 1912-12-12)', run: `${HERE}holdout-1912-run.json`, joins: `${HERE}joins-1912.json`, earlier: `${BUNDLE}/precision-partition-v2/holdout/run.json`, earlierVersions: ['v1', 'v2'] },
  { id: 'holdout-2103', earlierName: 'bundle version 3 holdout (seed 0x4e1bbb5d, windows from 2103-01-23)', run: `${HERE}holdout-2103-run.json`, joins: `${HERE}joins-2103.json`, earlier: `${BUNDLE}/precision-partition-v3/holdout/run.json`, earlierVersions: ['v1', 'v2', 'v3'] },
];

const out = { tool: 'summarise.mjs', postHoc: 'post hoc and unscored for #860: both holdouts were opened by earlier versions', holdouts: [] };
for (const h of holdouts) {
  const run = read(h.run);
  const joins = read(h.joins);
  const earlier = read(h.earlier);
  const t = run.targets;
  const a = run.additional;
  const live = run.cases.filter((r) => !r.skipped);
  const moon = live.filter((r) => r.body === 'Moon');
  const p4worst = t.P4.perCase.reduce((w, x) => (x.ratio < (w?.ratio ?? Infinity) ? x : w), null);
  const e4worst = a.earlierRuleP4.perCase.reduce((w, x) => (x.ratio < (w?.ratio ?? Infinity) ? x : w), null);
  const e4worstFinite = a.earlierRuleP4.perCase.filter((x) => !x.ratioIsLowerBound).reduce((w, x) => (x.ratio < (w?.ratio ?? Infinity) ? x : w), null);
  // version 1 on this pack against version 1 in the earlier record (its pack)
  const v1Compare = live.map((r) => {
    const e = earlier.runs[r.id].v1;
    return {
      id: r.id,
      plainHere: r.v1.baseline.evaluations,
      plainRecorded: e.base.evaluations,
      partitionedHere: r.v1.partition.evaluations,
      partitionedRecorded: e.part.evaluations,
      plainEqual: r.v1.baseline.evaluations === e.base.evaluations,
      partitionedEqual: r.v1.partition.evaluations === e.part.evaluations,
    };
  });
  const summary = {
    id: h.id,
    earlierName: h.earlierName,
    caseSource: h.earlier,
    caseListDigest: a.caseListCheck,
    cases: live.length,
    skipped: run.cases.filter((r) => r.skipped).length,
    windowsChecked: a.caseChecks.every((c) => c.insidePackCoverage && c.insideRecordsOfEverySeriesUsed && c.fromMatchesTdbOfIso && c.toMatchesTdbOfIso),
    v1rule: {
      P1: { pass: t.P1.pass, moon: t.P1.now },
      P2: { pass: t.P2.pass, spansProbed: t.P2.spansProbed, failures: t.P2.failures, failing: t.P2.worstCases },
      P3: { pass: t.P3.pass, worstCase: t.P3.worst?.id, worstFraction: t.P3.worst?.fraction, worstPercentRoundedUp: ceilSig3((t.P3.worst?.fraction ?? 0) * 100) },
      P4: {
        pass: t.P4.pass,
        basis: t.P4.basis,
        cases: t.P4.perCase.length,
        failures: t.P4.perCase.filter((x) => !x.pass).map((x) => x.id),
        worst: p4worst ? { id: p4worst.id, body: p4worst.body, baseline: p4worst.baseline, cold: p4worst.cold, ratioRoundedDown: floor2(p4worst.ratio) } : null,
        perCase: t.P4.perCase.map((x) => ({ id: x.id, body: x.body, baseline: x.baseline, cold: x.cold, ratioRoundedDown: floor2(x.ratio), pass: x.pass })),
      },
      P5: { pass: t.P5.pass, perCase: t.P5.perCase.map((x) => ({ id: x.id, body: x.body, baseline: x.baseline, cold: x.cold, ratioRoundedDown: floor2(x.ratio), pass: x.pass })) },
      P6: { pass: t.P6.pass, baselineEventsInAdmissible: t.P6.baselineEventsInAdmissible, lost: t.P6.lost, everyMatchedRootBracketed: t.P6.everyMatchedRootBracketed, worstDeltaSec: t.P6.worstDeltaSec, noCompletenessOverExcludedRequest: t.P6.noCompletenessOverExcludedRequest, noExhaustivenessWithLiveBoundary: t.P6.noExhaustivenessWithLiveBoundary },
      P7: { reportedNotScored: true, unpartitioned: t.P7.originalRuleOnBaseline, partitioned: t.P7.originalRuleOnPartitionedPath, denominator: t.P7.denominator, agree: t.P7.agree, newMetricExhaustiveOverAdmissible: t.P7.newMetricExhaustiveOverAdmissible },
      harnessVerdict: run.verdict.summary,
    },
    v2rule: { pass: a.v2Rule.pass, perCase: a.v2Rule.perCase },
    earlierRuleP4: {
      pass: a.earlierRuleP4.pass,
      cases: a.earlierRuleP4.perCase.length,
      failures: a.earlierRuleP4.perCase.filter((x) => !x.pass).map((x) => x.id),
      worst: e4worst ? { id: e4worst.id, denominator: e4worst.denominatorV1Unpartitioned, denominatorStatus: e4worst.denominatorStatus, cold: e4worst.cold, ratioRoundedDown: floor2(e4worst.ratio), lowerBound: e4worst.ratioIsLowerBound } : null,
      worstAgainstAFinishedDenominator: e4worstFinite ? { id: e4worstFinite.id, denominator: e4worstFinite.denominatorV1Unpartitioned, cold: e4worstFinite.cold, ratioRoundedDown: floor2(e4worstFinite.ratio) } : null,
      moon: a.earlierRuleP4.perCase.filter((x) => x.body === 'Moon').map((x) => ({ id: x.id, denominator: x.denominatorV1Unpartitioned, denominatorStatus: x.denominatorStatus, cold: x.cold, ratioRoundedDown: floor2(x.ratio), lowerBound: x.ratioIsLowerBound })),
      perCase: a.earlierRuleP4.perCase.map((x) => ({ id: x.id, denominator: x.denominatorV1Unpartitioned, denominatorStatus: x.denominatorStatus, cold: x.cold, ratioRoundedDown: floor2(x.ratio), pass: x.pass })),
    },
    earlierRuleP5: { pass: a.earlierRuleP5.pass, perCase: a.earlierRuleP5.perCase },
    earlierRuleP8: { pass: a.earlierRuleP8.pass, now: a.earlierRuleP8.now, originalRuntime: a.earlierRuleP8.originalRuntime },
    derivedClassesAgreeWithV1: a.derivedClassCrossCheck.every((x) => x.agree),
    moonBoundary: moon.map((r) => ({ id: r.id, boundarySec: r.partition.boundarySec, boundarySpans: r.partition.boundarySpans, percentRoundedUp: ceilSig3(r.p3.boundaryFraction * 100) })),
    joins: joins.windows.map((w) => ({
      window: w.windowIso,
      floorCrossings: w.floorCrossings.length,
      moonJoins: w.recordJoins[0].joins.map((j) => ({ at: j.tdbIso, nearestFloorCrossingMinusJoinSec: j.nearestFloorCrossingMinusJoinSec, withinHalfDay: j.withinHalfDayOfFloorCrossing, elongationAtJoinDeg: j.elongationAtJoinDeg })),
      otherJoins: w.recordJoins.slice(1).flatMap((jl) => jl.joins.map((j) => ({ series: jl.series, at: j.tdbIso, nearestFloorCrossingMinusJoinSec: j.nearestFloorCrossingMinusJoinSec, withinHalfDay: j.withinHalfDayOfFloorCrossing, elongationAtJoinDeg: j.elongationAtJoinDeg }))),
      perCase: Object.fromEntries(Object.entries(w.perCase).map(([id, pc]) => [id, {
        boundarySpans: pc.boundarySpans.length,
        boundarySpansWithoutAFloorCrossing: pc.boundarySpans.filter((x) => !x.floorCrossingInside).map((x) => ({ span: x.span, lengthSec: x.lengthSec, closestApproachDeg: x.closestApproachDeg, joins: x.joinsWithin2sOfSpan })),
        selectedJoins: pc.selectedJoins.map((s) => ({
          scope: s.scope,
          at: s.join.tdbIso,
          nearestFloorCrossingMinusJoinSec: s.join.nearestFloorCrossingMinusJoinSec,
          elongationAtJoinDeg: s.join.elongationAtJoinDeg,
          spans: s.spans.map((x) => ({ source: x.source, span: x.span, lengthSec: x.lengthSec, fromJoinSec: [x.startMinusJoinSec, x.endMinusJoinSec], closestApproachDeg: x.closestApproachDeg, elongationDeg: [x.minElongationDeg, x.maxElongationDeg], p2Pass: x.p2Pass, neighbours: x.neighbours ? { before: x.neighbours.before?.class, after: x.neighbours.after?.class } : undefined })),
          earlier: s.earlier ? Object.fromEntries(Object.entries(s.earlier).map(([v, l]) => [v, l.map((x) => ({ source: x.source, lengthSec: x.lengthSec, fromJoinSec: [x.startMinusJoinSec, x.endMinusJoinSec], closestApproachDeg: x.closestApproachDeg }))])) : null,
        })),
      }])),
    })),
    versionOneHereVersusEarlierRecord: {
      note: 'version 1 run here on the 1.1.0 pack against the same code recorded on the earlier 1.0.0 pack; not a rule, a check of #860 section 3\'s claim that the packs are interchangeable for these figures',
      allPartitionedEqual: v1Compare.every((x) => x.partitionedEqual),
      allPlainEqual: v1Compare.every((x) => x.plainEqual),
      differing: v1Compare.filter((x) => !x.plainEqual || !x.partitionedEqual),
    },
    /**
     * NOT ASKED, reported because the data were already in hand: the
     * analogue on these cases of #860's V-4, which its rule defines on the
     * regression corpus's F1 to F10 only. Plain deflected search, version 1
     * against #860, same pack, same invocation.
     */
    v4AnalogueOnHoldout: live.map((r) => {
      const v2t = r.eventList.baseline.map((e) => e.tdbSec);
      const v1t = r.v1.baseline.eventTimes;
      return {
        id: r.id,
        body: r.body,
        v1Status: r.v1.baseline.status,
        v1Events: v1t.length,
        v2Events: v2t.length,
        v1EventsLostByV2Within1e3s: v1t.filter((t) => !v2t.some((u) => Math.abs(u - t) <= 1e-3)).length,
        eventTimesBitIdentical: v2t.length === v1t.length && v2t.every((t, i) => Object.is(t, v1t[i])),
        evaluationsIdentical: r.baseline.evaluations === r.v1.baseline.evaluations,
      };
    }),
  };
  summary.v4AnalogueSummary = {
    nonMoonBitIdenticalWithIdenticalEvaluations: summary.v4AnalogueOnHoldout.filter((x) => x.body !== 'Moon').every((x) => x.eventTimesBitIdentical && x.evaluationsIdentical),
    v1EventsLost: summary.v4AnalogueOnHoldout.reduce((n, x) => n + x.v1EventsLostByV2Within1e3s, 0),
  };
  out.holdouts.push(summary);
}
writeFileSync(args.get('out') ?? `${HERE}summary.json`, `${JSON.stringify(out, null, 2)}\n`);
for (const s of out.holdouts) {
  process.stdout.write(`${s.id}: harness verdict ${s.v1rule.harnessVerdict}\n`);
  process.stdout.write(`  P1 ${s.v1rule.P1.pass} P2 ${s.v1rule.P2.pass} (${s.v1rule.P2.failures} of ${s.v1rule.P2.spansProbed}) P3 ${s.v1rule.P3.pass} (${s.v1rule.P3.worstCase} ${s.v1rule.P3.worstPercentRoundedUp} %) P4 ${s.v1rule.P4.pass} (worst ${s.v1rule.P4.worst?.id} ${s.v1rule.P4.worst?.ratioRoundedDown}x) P5 ${s.v1rule.P5.pass} P6 ${s.v1rule.P6.pass} P7 ${s.v1rule.P7.unpartitioned}/${s.v1rule.P7.denominator} and ${s.v1rule.P7.partitioned}/${s.v1rule.P7.denominator}\n`);
  process.stdout.write(`  V-2 ${s.v2rule.pass}; earlier P-4 ${s.earlierRuleP4.pass} (worst ${s.earlierRuleP4.worst?.id} ${s.earlierRuleP4.worst?.ratioRoundedDown}x${s.earlierRuleP4.worst?.lowerBound ? ' lower bound' : ''}; worst finished denominator ${s.earlierRuleP4.worstAgainstAFinishedDenominator?.id} ${s.earlierRuleP4.worstAgainstAFinishedDenominator?.ratioRoundedDown}x); earlier P-8 ${s.earlierRuleP8.pass}\n`);
  process.stdout.write(`  v1 here vs recorded: partitioned all equal ${s.versionOneHereVersusEarlierRecord.allPartitionedEqual}, plain all equal ${s.versionOneHereVersusEarlierRecord.allPlainEqual}, differing ${JSON.stringify(s.versionOneHereVersusEarlierRecord.differing.map((x) => [x.id, x.plainHere - x.plainRecorded, x.partitionedHere - x.partitionedRecorded]))}\n`);
}
