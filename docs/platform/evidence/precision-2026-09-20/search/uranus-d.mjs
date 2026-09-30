/**
 * TASK 6 -- attempt the real Uranus D case with the DE prototype backend, and
 * say honestly whether it is resolvable.
 *
 *   node uranus-d.mjs <fixture outside the repository> > <outside the repository>/uranus-d.json
 *
 * It reads raw/decomposition.json beside it. Its output holds Swiss's own
 * figures, which left raw/uranus-d.json
 * (docs/engine-validation/SWISS-OUTPUT-REMOVAL.md): write it outside the
 * repository.
 *
 * THE HARD RULE, restated so it governs this file.
 *
 * The original v2/v3 Uranus D exact-topology contract is `failed-incomplete`
 * and stays that way. This file does not lower its 0.05-degree budget, weaken
 * its policy, relabel a missing pass, or offer a denser scan as a resolution.
 * It declares a SEPARATE, explicitly versioned contract with a DIFFERENT
 * backend and a SEPARATELY ARGUED budget, and reports what that contract can
 * and cannot certify. The original outcome is untouched and is re-asserted in
 * the output.
 *
 * WHY A NEW CONTRACT IS LEGITIMATE HERE. The original budget B = 0.05 degrees
 * did two jobs at once: it was the acceptance tolerance for matching product
 * timings to source values, AND it was the model-disagreement allowance the
 * topology-conditioning gate compared against. Those are different quantities.
 * A new contract that measures the second one instead of inheriting the first
 * is not a weakened version of the old contract; it is a different question
 * asked of a different instrument.
 *
 * WHY THE BUDGET IS NOT FITTED. It is built bottom-up from measured terms and
 * then rounded UP to a round number, before being compared with the margin it
 * would have to beat. The robustness sweep at the end shows the verdict is
 * unchanged across a 440-fold range of budgets, so no particular choice inside
 * that range is doing any work.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { coreBackend, deBackend, swissLongitudes, swissWindowFixture, KERNEL, REPO, DAY_MS, circular, iso, TT_MINUS_UTC } from './lib/backends.mjs';
import { buildLevelProblem, locateTurningPoint } from './lib/astro-harness.mjs';
import { classifyInterval } from './lib/interval-search.mjs';

const { fixture } = swissWindowFixture();
const policy = JSON.parse(readFileSync(`${REPO}/docs/engine-validation/transit-windows/wave24-d-qualified-policy.v6.json`, 'utf8'));
const decomposition = JSON.parse(readFileSync(new URL('./raw/decomposition.json', import.meta.url), 'utf8'));
const D = fixture.cases.find((x) => x.id === 'D-Uranus2020');
const TARGET = D.targetLongitudeDegrees;
const ORIGINAL_B = D.angularBudgetDegrees;
const windowFrom = Date.parse(D.fromUtc);
const windowTo = Date.parse(D.toUtc);
const arcsec = (deg) => deg * 3600;
const started = Date.now();

// ---------------------------------------------------------------------------
// The new contract, declared as data before any of it is exercised.
// ---------------------------------------------------------------------------
const measuredTerms = [
  {
    term: 'implementation disagreement on the decision variable g*',
    degrees: Math.abs(decomposition.sources.ephemerisModel.marginDisagreement.deVersusSwissArcsec) / 3600,
    denominator: 'one station, located independently by each of the DE prototype and Swiss with the clock held at TT = UTC + 69.184 s',
    source: 'raw/decomposition.json sources.ephemerisModel.marginDisagreement.deVersusSwissArcsec',
  },
  {
    term: 'implementation disagreement, worst case over the undecided region',
    degrees: decomposition.sources.ephemerisModel.overOpenRegion.deMinusSwissArcsec.maxAbs / 3600,
    denominator: `n = ${decomposition.sources.ephemerisModel.overOpenRegion.deMinusSwissArcsec.n}, hourly grid over 2019-12-23..2020-01-30`,
    source: 'raw/decomposition.json sources.ephemerisModel.overOpenRegion.deMinusSwissArcsec.maxAbs',
  },
  {
    term: 'implementation disagreement, worst case over the whole component',
    degrees: decomposition.sources.ephemerisModel.overComponent.deMinusSwissArcsec.maxAbs / 3600,
    denominator: `n = ${decomposition.sources.ephemerisModel.overComponent.deMinusSwissArcsec.n}, 6-hourly grid over the 193-day component`,
    source: 'raw/decomposition.json sources.ephemerisModel.overComponent.deMinusSwissArcsec.maxAbs',
  },
  {
    term: 'target literal rounding',
    degrees: 5e-8,
    denominator: 'the frozen Horizons literal is given as 32.6940395, so its last place is 1e-7 degrees',
    source: 'fixture D.targetLongitudeDegrees',
  },
  {
    term: 'clock, at a full second of error (10^4 times the policy guard)',
    degrees: 6e-14,
    denominator: 'pinned-TT perturbation, measured',
    source: 'raw/decomposition.json sources.timeModel.sensitivityOfTheDecisionVariable',
  },
  {
    term: 'root-finding and floating point',
    degrees: 1.5e-14,
    denominator: '1 ms bisection residual and the double-precision ULP of a longitude near 32 degrees',
    source: 'raw/decomposition.json sources.rootFinding',
  },
];
const largestMeasuredTerm = Math.max(...measuredTerms.map((x) => x.degrees));
const sumOfMeasuredTerms = measuredTerms.reduce((s, x) => s + x.degrees, 0);
const EPSILON_S1 = 0.001;

const contract = {
  id: 'transit-window-search-s1',
  version: 1,
  declaredOnUtc: '2026-09-20',
  status: 'declared-and-exercised-in-this-track-only',
  relationshipToTheOriginal: {
    originalPackStatus: fixture.originalPackStatus,
    statement: 'This contract neither supersedes nor reopens the v2/v3 original pack or the v6 qualified acquisition. The original Uranus D exact-topology contract remains failed-incomplete at its own 0.05-degree budget, with its recorded 0.044188-degree witness intact. Nothing here may be cited as clearing it.',
    whatIsDifferent: [
      'A different position backend: DE440s read directly through the repository prototype, rather than astronomy-engine\'s series.',
      'A budget that covers model DISAGREEMENT only, measured, instead of inheriting the acceptance tolerance.',
      'A different method: interval reasoning with derivative enclosures, which can certify the absence of a root, rather than a sampling grid, which cannot.',
    ],
  },
  backend: {
    positions: 'docs/platform/evidence/swiss-benchmark/prototype/apparent.mjs over DE440s',
    kernel: KERNEL,
    kernelSha256: createHash('sha256').update(readFileSync(KERNEL)).digest('hex'),
    reduction: 'light-time iteration, first-order annual aberration, astronomy-engine Rotation_EQJ_ECT into the true ecliptic of date',
    statedOmission: 'gravitational light deflection is not applied. At Uranus\'s January 2020 elongation the deflection is about 0.008 arcsec, which is inside the measured DE-versus-Swiss disagreement rather than additional to it, because Swiss does apply it.',
    clock: `UTC -> TT pinned at ${TT_MINUS_UTC} s, matching the v6 policy recipe exactly`,
  },
  budget: {
    epsilonDegrees: EPSILON_S1,
    epsilonArcsec: arcsec(EPSILON_S1),
    appliesTo: 'topology conditioning only: the allowance within which a turning-point value or an interval-endpoint value is treated as undecided',
    doesNotApplyTo: 'acceptance of product timings against source bands, which is a separate question this contract does not ask',
    derivation: {
      order: 'The terms below were measured first, summed, and then rounded UP to one milli-degree. The margin they would have to beat was not consulted while choosing the number.',
      measuredTerms,
      largestMeasuredTermDegrees: largestMeasuredTerm,
      sumOfMeasuredTermsDegrees: sumOfMeasuredTerms,
      marginOverLargestTerm: EPSILON_S1 / largestMeasuredTerm,
      marginOverSum: EPSILON_S1 / sumOfMeasuredTerms,
    },
    honestLimits: [
      'Swiss and DE440s both descend from JPL development ephemerides. Their agreement is CONSISTENCY between two implementations, not independent observational accuracy, and a common-mode error in DE itself is not bounded by any of this.',
      'Every term is a SAMPLED maximum over a declared finite grid for this one case. None of them is a proven bound, and none generalises to another body, epoch or geometry without being re-measured.',
      'The derivative enclosures that make the completeness claim possible are themselves empirical: they hold if the declared curvature bounds hold, which was measured on a 401-point grid and inflated tenfold.',
      'Swiss is used only as an instrument. No budget, bound or verdict here is fitted to make Swiss and the prototype agree; the budget is set well above their measured disagreement, which is the opposite operation.',
    ],
  },
  certifies: [
    'the number of exact passes of the moving longitude through the target level, over a declared closed interval',
    'an epsilon bracket for each certified root, being the set of instants at which the modelled longitude is within epsilon of the level',
    'the explicit refusal cases: an undecided turning point, an undecided interval endpoint, or an exhausted evaluation budget',
  ],
  doesNotCertify: [
    'a point timestamp for any pass: only the epsilon bracket is meaningful',
    'anything about the original pack, its receipts, or its failed witness',
    'any count in a cropped view whose boundary falls inside an epsilon bracket -- see the crop results below',
  ],
};

// ---------------------------------------------------------------------------
// Exercise the contract.
// ---------------------------------------------------------------------------
const de = await deBackend();
const core = await coreBackend();
const out = {
  what: 'The real Uranus D case, attempted with the DE prototype backend under an explicitly new contract.',
  generatedBy: 'node uranus-d.mjs',
  generatedAtUtc: new Date().toISOString(),
  originalContractRestated: {
    status: fixture.originalPackStatus,
    marginDegrees: policy.originalFailedWitness.circularMarginDegrees,
    budgetDegrees: ORIGINAL_B,
    verdict: 'failed-incomplete, unchanged by anything in this file',
  },
  contract,
  results: {},
};

const runLevel = ({ backend, label, level, from, to, epsilon }) => {
  const problem = buildLevelProblem({ lon: backend.lon, body: 'Uranus', targetDegrees: level, aMs: from, bMs: to });
  const verdict = classifyInterval({
    label, f: problem.f,
    derivativeEnclosure: problem.derivativeEnclosure,
    secondDerivativeEnclosure: problem.secondDerivativeEnclosure,
    a: from, b: to, epsilon, minWidth: 100, maxEvaluations: 60000,
    boundKind: 'empirical', exactArithmetic: false,
  });
  return {
    label, levelDegrees: level, fromUtc: iso(from), toUtc: iso(to), epsilonDegrees: epsilon,
    verdict: verdict.verdict, outcome: verdict.outcome, reason: verdict.reason,
    rootCount: verdict.rootCount, possibleRootCounts: verdict.possibleRootCounts,
    crossings: verdict.crossings?.map((x) => ({
      bracketFromUtc: iso(x.lo), bracketToUtc: iso(x.hi), bracketWidthDays: x.width / DAY_MS,
      centreUtc: iso(x.centre), direction: x.direction, transversal: x.transversal, atIntervalEdge: x.atIntervalEdge ?? false,
    })) ?? null,
    openRegions: verdict.openRegions.map((r) => ({ fromUtc: iso(r.from), toUtc: iso(r.to), why: r.why, atMostOneTurningPoint: r.atMostOneTurningPoint })),
    endpointValueDegrees: verdict.endpointValues,
    evaluations: verdict.evaluations,
    backendCalls: problem.backendCalls(),
    cellStatusCounts: verdict.cellStatusCounts,
    assumptions: verdict.assumptions,
    notes: verdict.notes,
  };
};

// 1. The exact level over the whole declared query window.
out.results.fullWindowExactLevel = runLevel({
  backend: de, label: 'de:full-window:exact-level', level: TARGET,
  from: windowFrom, to: windowTo, epsilon: EPSILON_S1,
});

// 2. The exact level over each recorded component.
out.results.perComponentExactLevel = D.geometries[0].components.map((component) => ({
  sourceId: component.sourceId,
  recordedSourceExactCount: component.sourceExactCount,
  recordedExactTopology: component.exactTopology,
  ...runLevel({
    backend: de, label: `de:${component.sourceId}:exact-level`, level: TARGET,
    from: Date.parse(component.startUtc), to: Date.parse(component.endUtc), epsilon: EPSILON_S1,
  }),
}));

// 3. The membership thresholds, target +/- 3 degrees, over the whole window.
out.results.membershipThresholds = [TARGET - 3, TARGET + 3].map((level) => runLevel({
  backend: de, label: `de:full-window:threshold-${level === TARGET - 3 ? 'minus3' : 'plus3'}`,
  level, from: windowFrom, to: windowTo, epsilon: EPSILON_S1,
}));

// 4. The two closed crop halves. The 2020-01-01 boundary is the interesting one.
{
  const halves = D.crops.map((crop) => ({
    label: crop.label,
    recordedBoundaryOrbDegrees: crop.boundaries.map((x) => x.orbDegrees),
    recordedExactCountAmbiguous: crop.boundaries.map((x) => x.exactCountAmbiguousWithinBudget),
    ...runLevel({
      backend: de, label: `de:crop-${crop.label}:exact-level`, level: TARGET,
      from: Date.parse(crop.fromUtc), to: Date.parse(crop.toUtc), epsilon: EPSILON_S1,
    }),
  }));
  const boundaryMs = Date.parse('2020-01-01T00:00:00Z');
  const problem = buildLevelProblem({ lon: de.lon, body: 'Uranus', targetDegrees: TARGET, aMs: windowFrom, bMs: windowTo });
  const swissAtBoundary = swissLongitudes('Uranus', [boundaryMs]).rows[0];
  const swissOffset = circular(swissAtBoundary.lon, TARGET);
  const deOffset = problem.f(boundaryMs);
  const slopeDegPerDay = Math.abs((problem.f(boundaryMs + 600_000) - problem.f(boundaryMs - 600_000)) / (2 * 600_000)) * DAY_MS;
  const regionDisagreementArcsec = decomposition.sources.ephemerisModel.overOpenRegion.deMinusSwissArcsec.maxAbs;
  out.results.crops = {
    halves,
    theBoundaryEvent: {
      boundaryUtc: '2020-01-01T00:00:00.000Z',
      deOffsetFromLevelDegrees: deOffset,
      deOffsetFromLevelArcsec: arcsec(deOffset),
      swissOffsetFromLevelDegrees: swissOffset,
      swissOffsetFromLevelArcsec: arcsec(swissOffset),
      recordedCropBoundaryOrbDegrees: D.crops[0].boundaries[1].orbDegrees,
      deMinusSwissAtTheBoundaryArcsec: arcsec(deOffset - swissOffset),
      slopeAtTheBoundaryDegPerDay: slopeDegPerDay,
      rootOffsetFromBoundarySecondsDe: deOffset / (slopeDegPerDay / 86400),
      rootOffsetFromBoundarySecondsSwiss: swissOffset / (slopeDegPerDay / 86400),
      epsilonBracketHalfWidthDays: EPSILON_S1 / slopeDegPerDay,
      epsilonNeededToDecideWhichSideDegrees: Math.min(Math.abs(deOffset), Math.abs(swissOffset)),
      measuredInterModelDisagreementOverTheRegionDegrees: regionDisagreementArcsec / 3600,
      sideIsDecidableAtThisEpsilon: Math.abs(deOffset) > regionDisagreementArcsec / 3600,
      finding: [
        'An exact pass sits essentially on the crop boundary. The DE prototype puts Uranus 0.00098 arcsec from the target at 2020-01-01T00:00:00Z, which is 2.7 seconds of Uranus motion; Swiss puts it 0.0455 arcsec away, which is 125 seconds. Both agree the pass falls just AFTER the boundary, and the fixture records the same Swiss value as the crop boundary orb, 1.2636e-5 degrees.',
        'The two instruments disagree about that offset by 0.0446 arcsec, which is the ordinary scale of their disagreement over this region (max 0.109 arcsec, n = 913). Deciding which SIDE of the boundary the pass falls on therefore needs an epsilon below the disagreement between the two best instruments available. No budget anyone can justify today is that small.',
        'So the search returns boundary-event for both closed halves. Each closed half legitimately owns the pass, which is why both report a count of 2 and why the two counts must be deduplicated by root identity to the full-window count of 3 rather than summed to 4. That is the v6 policy\'s own queryDomain rule, arrived at independently.',
        'What is NOT certified is the exclusive, half-open assignment of the pass to one half. The recorded exactCountAmbiguousWithinBudget flags on both halves therefore survive the stronger backend -- but the reason can now be stated in arcseconds instead of left inside an allowance.',
        'This is the boundary-event verdict appearing in real data rather than in a test function.',
      ],
    },
  };
}

// 5. Robustness: does the verdict depend on the particular budget, or on the backend?
{
  const sweep = [];
  for (const epsilon of [1e-5, 5e-5, 1e-4, 5e-4, 1e-3, 5e-3, 1e-2, 2e-2, 4e-2, 0.0441, 0.0442, 0.045, 0.05]) {
    for (const backend of [de, core]) {
      const r = runLevel({
        backend, label: `${backend.id}:second-component:eps=${epsilon}`, level: TARGET,
        from: Date.parse(D.geometries[0].components[1].startUtc),
        to: Date.parse(D.geometries[0].components[1].endUtc),
        epsilon,
      });
      sweep.push({ backend: backend.id, epsilonDegrees: epsilon, epsilonArcsec: arcsec(epsilon), verdict: r.verdict, rootCount: r.rootCount, possibleRootCounts: r.possibleRootCounts, evaluations: r.evaluations });
    }
  }
  const perBackend = (id) => {
    const two = sweep.filter((x) => x.backend === id && x.rootCount === 2).map((x) => x.epsilonDegrees);
    return { smallestCertifyingTwo: Math.min(...two), largestCertifyingTwo: Math.max(...two), ratio: Math.max(...two) / Math.min(...two) };
  };
  const epsilons = [...new Set(sweep.map((x) => x.epsilonDegrees))];
  const bothCertifyTwo = epsilons.filter((e) => sweep.filter((x) => x.epsilonDegrees === e).every((x) => x.rootCount === 2));
  out.results.robustness = {
    what: 'The second component\'s exact-pass count as a function of the declared budget, on both backends.',
    sweep,
    perBackend: { de: perBackend('de'), core: perBackend('core') },
    bothBackendsAgreeOnTwo: {
      smallestDegrees: Math.min(...bothCertifyTwo),
      largestDegrees: Math.max(...bothCertifyTwo),
      ratio: Math.max(...bothCertifyTwo) / Math.min(...bothCertifyTwo),
    },
    reading: [
      'Both backends certify the same count of 2 for every budget from 1e-5 to 0.04 degrees, a 4000-fold range. The chosen 0.001 sits in the middle of it, so the verdict is not an artefact of the number picked.',
      'The two backends part company only in the narrow band between their own turning-point margins: 0.043326 degrees for the shipped core engine and 0.044175 for the DE prototype. At epsilon = 0.0441 the DE backend still certifies 2 while the core backend already refuses. That 0.00085-degree band IS the inter-model disagreement, displayed as a disagreement about decidability rather than about a position.',
      'At and above 0.0442 -- which includes the original 0.05 -- both backends return unresolved-interval with possible counts {0,1,2}, exactly as the original contract recorded.',
    ],
  };
}

// 6. What the second component's peak is, under the new contract.
{
  const second = D.geometries[0].components[1];
  const problem = buildLevelProblem({ lon: de.lon, body: 'Uranus', targetDegrees: TARGET, aMs: Date.parse(second.startUtc), bMs: Date.parse(second.endUtc) });
  const station = locateTurningPoint({ f: problem.f, fromMs: Date.parse('2019-12-01T00:00:00Z'), toMs: Date.parse('2020-02-15T00:00:00Z'), secondDerivativeBound: problem.bounds.bounds.secondDerivativeBound });
  out.results.secondComponentPeak = {
    recordedGlobalMinimumKind: second.globalMinimumKind,
    recordedGlobalMinimum: second.globalMinimum,
    underThisContract: {
      kind: 'exact',
      why: 'With two certified transversal crossings the minimum of the circular distance is zero and is attained twice, at the two passes. There is no positive closest-approach peak in this component, and the January turning point is a local MAXIMUM of the circular distance between the two passes, not a minimum of it.',
      turningPointUtc: iso(station.tMs),
      turningPointSignedOffsetDegrees: station.value,
      localMaximumOfCircularDistanceDegrees: Math.abs(station.value),
    },
    stillNotCertified: 'A single peak instant. Two passes means two exact instants, each known only to its epsilon bracket; collapsing them into one peak would be the fabrication the original policy forbids.',
  };
}

out.answer = {
  question: 'Is Uranus D resolvable under a justified new contract, or still genuinely uncertain?',
  resolvable: 'partly',
  resolved: [
    'the exact-pass COUNT of the second component: 2',
    'the exact-pass COUNT over the full declared query window: 3',
    'the exact-pass COUNT of the first component: 1, which the original contract had already decided',
    'the four ordered physical threshold roots: one crossing of target-3 and three of target+3, matching the v6 policy\'s own membership count',
    'that the second component has no positive closest-approach peak at all: the January turning point is a local MAXIMUM of the circular distance, sitting between the two passes',
  ],
  stillNotResolved: [
    'which side of the 2020-01-01T00:00:00Z crop boundary the second pass falls on. Both instruments place it just after the boundary, but they disagree about the offset by 0.045 arcsec -- the ordinary scale of their disagreement -- while the offset itself is 0.001 arcsec (DE) to 0.045 arcsec (Swiss). Deciding the side needs an epsilon below the disagreement between the two best instruments available.',
    'therefore the EXCLUSIVE, half-open exact-pass counts of the two crop halves. Each closed half owns the pass, so both report 2, and the two must be deduplicated by root identity to the full-window 3 rather than summed to 4.',
    'a point timestamp for any pass. Only the epsilon brackets are meaningful: 50 minutes wide for the April 2019 pass, and 5.5 hours wide for each of the two January 2020 passes, which are slow because they happen near a station.',
  ],
  statement: [
    'Under transit-window-search-s1 -- DE440s positions, a 0.001-degree topology budget argued from measured disagreement, and interval reasoning with derivative enclosures -- the second component has exactly two exact passes and the whole query window has exactly three.',
    'The verdict is stable across a 4000-fold range of budgets on BOTH backends, so it does not depend on the budget chosen. The two backends part company only inside the 0.00085-degree band between their own turning-point margins, which is the inter-model disagreement showing itself as a disagreement about decidability.',
    'It remains conditional on an empirical derivative bound and on two implementations that share a JPL ancestry. It is a certified count under a declared model allowance, not a proven statement about the sky.',
    'The original v2/v3 contract is still failed-incomplete at its own budget. Its 0.044188-degree witness is reproduced here to 0.048 arcsec by a completely independent position source, which strengthens the original record rather than overturning it.',
  ],
  elapsedSeconds: (Date.now() - started) / 1000,
};

process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
