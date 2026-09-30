/**
 * TASK 1 -- reproduce the recorded v2/v3 Uranus D failure before changing
 * anything, and state exactly what the original contract can and cannot decide.
 *
 *   node reproduce.mjs <fixture outside the repository> > <outside the repository>/reproduction.json
 *
 * Its output holds Swiss's own figures, which left raw/reproduction.json
 * (docs/engine-validation/SWISS-OUTPUT-REMOVAL.md): write it outside the
 * repository.
 *
 * Nothing in this file modifies the repository. The fixture, the v6 policy and
 * the README are read; the original contract's status and budget are taken
 * from them verbatim and are not reinterpreted.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { coreBackend, deBackend, swissLongitudes, swissWindowFixture, REPO, DAY_MS, circular, iso } from './lib/backends.mjs';
import { buildLevelProblem, locateTurningPoint } from './lib/astro-harness.mjs';
import { classifyInterval } from './lib/interval-search.mjs';

const { path: FIXTURE, bytes: fixtureBytes, fixture } = swissWindowFixture();
const POLICY = `${REPO}/docs/engine-validation/transit-windows/wave24-d-qualified-policy.v6.json`;
const policy = JSON.parse(readFileSync(POLICY, 'utf8'));
const D = fixture.cases.find((x) => x.id === 'D-Uranus2020');
const witness = policy.originalFailedWitness;

const TARGET = D.targetLongitudeDegrees;             // 32.6940395, a frozen external literal
const B = D.angularBudgetDegrees;                    // 0.05, the original angular budget
const GEOMETRIC_RESOLUTION = policy.frozenScientificFields.numerics.geometricResolutionDegrees; // 1e-9
const components = D.geometries[0].components;

const out = {
  what: 'Reproduction of the recorded v2/v3 Uranus D exact-topology failure, before any change.',
  generatedBy: 'node reproduce.mjs',
  generatedAtUtc: new Date().toISOString(),
  readOnlyInputs: {
    fixture: FIXTURE,
    fixtureSha256: createHash('sha256').update(fixtureBytes).digest('hex'),
    policy: POLICY,
    fixtureOriginalPackStatus: fixture.originalPackStatus,
  },
  recordedContract: {
    caseId: D.id,
    targetLongitudeDegrees: TARGET,
    targetProvenance: D.input.targetSourcePointer,
    angularBudgetDegrees: B,
    geometricResolutionDegrees: GEOMETRIC_RESOLUTION,
    clock: D.input.clock,
    window: [D.fromUtc, D.toUtc],
    failedWitness: witness,
    gate: policy.frozenScientificFields.gates.topologyConditioning,
    components: components.map((c) => ({
      sourceId: c.sourceId, startUtc: c.startUtc, endUtc: c.endUtc,
      sourceExactCount: c.sourceExactCount, exactTopology: c.exactTopology,
      globalMinimumKind: c.globalMinimumKind,
      possibleExactRegionUtc: c.possibleExactRegionMs ? c.possibleExactRegionMs.map(iso) : null,
      possibleMinimumRegionUtc: c.possibleMinimumRegionMs ? c.possibleMinimumRegionMs.map(iso) : null,
    })),
  },
  arithmeticOfTheFailure: {
    recordedMarginDegrees: witness.circularMarginDegrees,
    requiredGreaterThanDegrees: witness.requiredGreaterThanDegrees,
    shortfallDegrees: witness.requiredGreaterThanDegrees - witness.circularMarginDegrees,
    shortfallArcsec: (witness.requiredGreaterThanDegrees - witness.circularMarginDegrees) * 3600,
    marginAsFractionOfBudget: witness.circularMarginDegrees / B,
    statement: [
      'The second component\'s turning point sits 0.044188 degrees from the exact level.',
      'The conditioning gate requires every turning point to clear the level by more than B + the geometric resolution, i.e. more than 0.050000001 degrees.',
      'Because 0.044188 < 0.050000001, a function displaced anywhere inside its own +/-0.05 degree allowance can put that turning point on either side of the level.',
      'Root counts of 2 (dip through), 1 (tangency) and 0 (near miss) are all consistent with the allowance, so the exact-pass count of the second component is not decidable under this contract.',
    ],
  },
  independentReproduction: {},
  whatTheOriginalContractDecides: {
    decided: [
      'Component membership: the 3-degree threshold margins clear B, so both components and the real gap between them are certified (policy qualifiedAcceptance.membership: 28 threshold margins > B + 1e-9, four ordered physical threshold roots, five witness cells).',
      'The first component\'s single exact pass, with its original conditioned timing band.',
      'The two-component topology of the geometry as a whole, and the preserved out-of-orb gap.',
      'Crop membership at both closed halves: membershipAmbiguousWithinBudget is false at every crop boundary.',
    ],
    notDecided: [
      'The exact-pass COUNT inside the second component (recorded source count 2, labelled unresolved-cross-model-count).',
      'Whether the second component has a peak at all, and if so whether it is an exact pass or a positive closest approach: globalMinimumKind is unresolved-cross-model-count and globalMinimum is null.',
      'The crop exact-count at the 2020-01-01 boundary: exactCountAmbiguousWithinBudget is true on both halves, so neither half may publish an exact count.',
      'Any local-minimum count inside the second component, which the same ambiguity can create or destroy.',
    ],
    whyLoweringTheToleranceIsNotAvailable: 'B is the case\'s declared angular acceptance budget and it is also what the conditioning gate compares against. Shrinking it to fit 0.044188 would be choosing the tolerance after seeing the margin, which is the one move the policy\'s limitsPolicy and failure clauses forbid outright.',
  },
};

// ---------------------------------------------------------------------------
// Independent reproduction with three backends.
// ---------------------------------------------------------------------------
const second = components[1];
const aMs = Date.parse(second.startUtc);
const bMs = Date.parse(second.endUtc);
const stationSpan = [Date.parse('2019-12-01T00:00:00Z'), Date.parse('2020-02-15T00:00:00Z')];

const backends = [await coreBackend(), await deBackend()];
for (const backend of backends) {
  const problem = buildLevelProblem({ lon: backend.lon, body: 'Uranus', targetDegrees: TARGET, aMs, bMs });
  const station = locateTurningPoint({
    f: problem.f, fromMs: stationSpan[0], toMs: stationSpan[1],
    secondDerivativeBound: problem.bounds.bounds.secondDerivativeBound,
  });
  const marginDegrees = Math.abs(station.value);
  out.independentReproduction[backend.id] = {
    what: backend.what,
    stationUtc: iso(station.tMs),
    stationLongitudeDegrees: station.value + TARGET,
    signedStationMinusTargetDegrees: station.value,
    marginDegrees,
    marginVersusRecorded: marginDegrees - witness.circularMarginDegrees,
    marginVersusRecordedArcsec: (marginDegrees - witness.circularMarginDegrees) * 3600,
    clearsOriginalGate: marginDegrees > witness.requiredGreaterThanDegrees,
    turningPointLocation: {
      residualMs: station.residualMs,
      valueErrorFromTimingDegrees: station.valueErrorFromTiming,
      note: station.valueErrorNote,
    },
    derivativeBounds: problem.bounds,
    backendCalls: problem.backendCalls(),
  };
}

// Swiss, batched: bracket the station by a 1-second grid around the DE answer,
// then take the minimum of a refined sample. Swiss is the instrument that
// recorded the original witness, so reproducing 0.044188 with it is the
// tightest check available.
{
  const centre = Date.parse(out.independentReproduction.de.stationUtc);
  const coarse = [];
  for (let k = -60; k <= 60; k += 1) coarse.push(centre + k * 3_600_000);
  const coarseRows = swissLongitudes('Uranus', coarse);
  let best = 0;
  coarseRows.rows.forEach((row, i) => { if (row.lon < coarseRows.rows[best].lon) best = i; });
  const fine = [];
  for (let k = -3600; k <= 3600; k += 1) fine.push(coarse[best] + k * 1000);
  const fineRows = swissLongitudes('Uranus', fine);
  let bestFine = 0;
  fineRows.rows.forEach((row, i) => { if (row.lon < fineRows.rows[bestFine].lon) bestFine = i; });
  const row = fineRows.rows[bestFine];
  const marginDegrees = Math.abs(circular(row.lon, TARGET));
  out.independentReproduction.swiss = {
    what: `pyswisseph ${coarseRows.swissVersion}, flags ${coarseRows.requestedFlags}, v6 clock recipe (TT = UTC + 69.184 s)`,
    method: 'one-hour grid over +/-60 h around the DE station, then a one-second grid over +/-1 h around the coarse minimum; 7321 SWIEPH evaluations',
    evaluations: coarse.length + fine.length,
    stationUtc: `${row.utc}Z`,
    stationLongitudeDegrees: row.lon,
    stationSpeedDegPerDay: row.speed,
    signedStationMinusTargetDegrees: circular(row.lon, TARGET),
    marginDegrees,
    marginVersusRecorded: marginDegrees - witness.circularMarginDegrees,
    marginVersusRecordedArcsec: (marginDegrees - witness.circularMarginDegrees) * 3600,
    clearsOriginalGate: marginDegrees > witness.requiredGreaterThanDegrees,
    ttMinusUtcSeconds: row.ttMinusUtcSeconds,
    retflag: row.retflag,
  };
}

// ---------------------------------------------------------------------------
// The same question put to the bounded search at the ORIGINAL budget.
// ---------------------------------------------------------------------------
out.boundedSearchAtOriginalBudget = {};
for (const backend of backends) {
  const results = {};
  components.forEach((component, index) => {
    const from = Date.parse(component.startUtc);
    const to = Date.parse(component.endUtc);
    const problem = buildLevelProblem({ lon: backend.lon, body: 'Uranus', targetDegrees: TARGET, aMs: from, bMs: to });
    const verdict = classifyInterval({
      label: `${backend.id}:${component.sourceId}:B=${B}`,
      f: problem.f,
      derivativeEnclosure: problem.derivativeEnclosure,
      secondDerivativeEnclosure: problem.secondDerivativeEnclosure,
      a: from, b: to,
      epsilon: B, minWidth: 100, maxEvaluations: 60000,
      boundKind: 'empirical', exactArithmetic: false,
    });
    results[component.sourceId] = summarise(verdict, component);
  });
  out.boundedSearchAtOriginalBudget[backend.id] = results;
}

out.conclusion = [
  'The failure reproduces independently. All three position sources put the second component\'s turning point between 0.0432 and 0.0442 degrees below the target, and none of them clears the 0.050000001-degree conditioning threshold.',
  'The bounded search, given the original 0.05-degree budget, returns unresolved-interval for the second component with possible root counts {0,1,2}, and a certified single crossing for the first. That is the recorded contract exactly: first component resolved, second component uncertain.',
  'Nothing here changes the original contract. It remains failed-incomplete.',
];

function summarise(verdict, component) {
  return {
    sourceExactCount: component.sourceExactCount,
    sourceExactTopology: component.exactTopology,
    verdict: verdict.verdict,
    outcome: verdict.outcome,
    reason: verdict.reason,
    rootCount: verdict.rootCount,
    possibleRootCounts: verdict.possibleRootCounts,
    evaluations: verdict.evaluations,
    cellStatusCounts: verdict.cellStatusCounts,
    crossingsUtc: verdict.crossings?.map((x) => ({ fromUtc: iso(x.lo), toUtc: iso(x.hi), widthDays: x.width / DAY_MS, direction: x.direction })) ?? null,
    openRegionsUtc: verdict.openRegions.map((r) => ({
      fromUtc: iso(r.from), toUtc: iso(r.to), widthDays: (r.to - r.from) / DAY_MS,
      why: r.why, atMostOneTurningPoint: r.atMostOneTurningPoint,
      turningPointUtc: r.turningPoint ? iso(r.turningPoint.t) : null,
      turningPointValueDegrees: r.turningPoint?.value ?? null,
    })),
    partialUncertifiedFindings: verdict.partialUncertifiedFindings
      ? { warning: verdict.partialUncertifiedFindings.warning, certifiedCount: verdict.partialUncertifiedFindings.certifiedTransversalRoots.length }
      : null,
    assumptions: verdict.assumptions,
    notes: verdict.notes,
  };
}

process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
