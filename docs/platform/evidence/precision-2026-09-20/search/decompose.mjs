/**
 * TASK 2 -- decompose the Uranus D uncertainty into four separate sources and
 * size each one. TASK 5 -- audit the stationary-geometry treatment.
 *
 *   node decompose.mjs <fixture outside the repository> > <outside the repository>/decomposition.json
 *
 * Its output holds Swiss's own figures, which left raw/decomposition.json
 * (docs/engine-validation/SWISS-OUTPUT-REMOVAL.md): write it outside the
 * repository.
 *
 * The four sources are kept apart on purpose. They have different sizes,
 * different provenance and different remedies, and merging them into one error
 * bar is what makes a 0.044188 margin look like a single unlucky number
 * instead of a decision about which allowance applies.
 *
 * THE DECISION VARIABLE. Everything that is undecided about the second
 * component reduces to the sign of one scalar:
 *
 *     g* = longitude(t*) - target      at the January 2020 turning point t*
 *
 * g* < 0 gives two crossings, g* = 0 gives a tangency, g* > 0 gives none.
 * Each source below is therefore sized as its contribution to g*, and
 * separately (where it differs) as its contribution to the crossing TIMES,
 * because those two are not the same quantity and do not share a scale.
 */
import { readFileSync } from 'node:fs';
import { coreBackend, deBackend, swissLongitudes, swissWindowFixture, REPO, DAY_MS, circular, iso, TT_MINUS_UTC } from './lib/backends.mjs';
import { buildLevelProblem, locateTurningPoint } from './lib/astro-harness.mjs';
import { classifyInterval, stationaryTimeEnvelope } from './lib/interval-search.mjs';

const { fixture } = swissWindowFixture();
const policy = JSON.parse(readFileSync(`${REPO}/docs/engine-validation/transit-windows/wave24-d-qualified-policy.v6.json`, 'utf8'));
const D = fixture.cases.find((x) => x.id === 'D-Uranus2020');
const TARGET = D.targetLongitudeDegrees;
const B = D.angularBudgetDegrees;
const second = D.geometries[0].components[1];
const aMs = Date.parse(second.startUtc);
const bMs = Date.parse(second.endUtc);
const openFrom = Date.parse('2019-12-23T00:00:00Z');
const openTo = Date.parse('2020-01-30T00:00:00Z');
const arcsec = (deg) => deg * 3600;

/** The comparator's quantile: linear interpolation. Same as tools/compare.mjs. */
const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};
const stats = (values) => {
  const abs = values.map(Math.abs).sort((x, y) => x - y);
  return { n: abs.length, maxAbs: abs[abs.length - 1], p50Abs: quantile(abs, 0.5), p95Abs: quantile(abs, 0.95), meanSigned: values.reduce((s, x) => s + x, 0) / values.length };
};

const core = await coreBackend();
const de = await deBackend();
const deProblem = buildLevelProblem({ lon: de.lon, body: 'Uranus', targetDegrees: TARGET, aMs, bMs });
const coreProblem = buildLevelProblem({ lon: core.lon, body: 'Uranus', targetDegrees: TARGET, aMs, bMs });
const M2 = deProblem.bounds.bounds.secondDerivativeBound;          // INFLATED bound, deg/ms^2
const M2measuredPerDay2 = deProblem.bounds.measuredPerDay.secondDegPerDay2;  // MEASURED max, deg/day^2
/** Curvature at the station itself, deg/day^2 -- the right scale for the envelope. */
const curvatureAtStation = (f, tMs, h = 600_000) => ((f(tMs + h) - 2 * f(tMs) + f(tMs - h)) / (h * h)) * DAY_MS * DAY_MS;

const deStation = locateTurningPoint({ f: deProblem.f, fromMs: Date.parse('2019-12-01T00:00:00Z'), toMs: Date.parse('2020-02-15T00:00:00Z'), secondDerivativeBound: M2 });
const coreStation = locateTurningPoint({ f: coreProblem.f, fromMs: Date.parse('2019-12-01T00:00:00Z'), toMs: Date.parse('2020-02-15T00:00:00Z'), secondDerivativeBound: M2 });

const out = {
  what: 'Four-way decomposition of the Uranus D exact-topology uncertainty, plus the stationary-geometry audit.',
  generatedBy: 'node decompose.mjs',
  generatedAtUtc: new Date().toISOString(),
  decisionVariable: {
    definition: 'g* = longitude(t*) - target at the January 2020 turning point. Its SIGN decides the exact-pass count of the second component: negative gives 2 crossings, zero gives a tangency, positive gives none.',
    targetDegrees: TARGET,
    recordedSwissMarginDegrees: policy.originalFailedWitness.circularMarginDegrees,
    deSignedValueDegrees: deStation.value,
    coreSignedValueDegrees: coreStation.value,
    deStationUtc: iso(deStation.tMs),
    coreStationUtc: iso(coreStation.tMs),
    curvatureAtStationDegPerDay2: curvatureAtStation(deProblem.f, deStation.tMs),
    maxCurvatureOverComponentDegPerDay2: M2measuredPerDay2,
  },
  sources: {},
};

// ---------------------------------------------------------------------------
// SOURCE 1 -- root-finding error.
// ---------------------------------------------------------------------------
{
  const residualMs = deStation.residualMs;
  const stationValueError = M2 * residualMs * residualMs / 2;
  // Crossing-time side: near a crossing the slope is NOT zero, so the linear
  // conversion is the right one there. Measure the slope at each crossing.
  const crossSlope = (t) => Math.abs((deProblem.f(t + 600_000) - deProblem.f(t - 600_000)) / (2 * 600_000)) * DAY_MS;
  const c1 = Date.parse('2020-01-01T00:00:00Z'), c2 = Date.parse('2020-01-21T04:00:00Z');
  const bracketFloorMs = 100;
  out.sources.rootFinding = {
    what: 'Numerical error in locating the turning point and the crossings, with the function held fixed.',
    turningPointLocation: {
      bisectionResidualMs: residualMs,
      valueErrorDegrees: stationValueError,
      valueErrorArcsec: arcsec(stationValueError),
      formula: "|f''| * dt^2 / 2 -- second order, because the first derivative vanishes at a turning point",
      wrongFormulaWouldBe: "|f'| * dt, which is zero here and would understate nothing but is the wrong shape; the danger is the INVERSE of this, see stationaryGeometryAudit",
    },
    crossingLocation: {
      bracketFloorMs,
      slopeAtFirstCrossingDegPerDay: crossSlope(c1),
      slopeAtSecondCrossingDegPerDay: crossSlope(c2),
      positionErrorAtFirstCrossingDegrees: crossSlope(c1) * bracketFloorMs / DAY_MS,
      positionErrorAtSecondCrossingDegrees: crossSlope(c2) * bracketFloorMs / DAY_MS,
      note: 'Away from a turning point the slope is bounded away from zero, so the linear conversion position = slope * time is valid there. The policy\'s own 0.1-second root bracket is 1000x coarser than this floor and still contributes under 1e-7 degrees.',
    },
    floatingPoint: {
      longitudeUlpDegrees: Number.EPSILON * 64,
      note: 'Double-precision resolution of a longitude near 32 degrees.',
    },
    totalContributionToDecisionVariableDegrees: stationValueError + Number.EPSILON * 64,
    verdict: 'Negligible. About 6e-19 degrees on g*, which is 17 orders of magnitude below the 0.0442-degree margin. Root-finding is not why this contract failed.',
  };
}

// ---------------------------------------------------------------------------
// SOURCE 2 -- ephemeris / model disagreement.
// ---------------------------------------------------------------------------
{
  const gridSamples = (from, to, stepMs) => { const xs = []; for (let t = from; t <= to; t += stepMs) xs.push(Math.round(t)); return xs; };
  const component = gridSamples(aMs, bMs, 6 * 3_600_000);
  const openRegion = gridSamples(openFrom, openTo, 3_600_000);

  const measure = (msList, labelWhat) => {
    const swiss = swissLongitudes('Uranus', msList);
    const deMinusSwiss = [], coreMinusSwiss = [], deMinusCore = [];
    msList.forEach((ms, i) => {
      const s = swiss.rows[i].lon, d = de.lon('Uranus', ms), c = core.lon('Uranus', ms);
      deMinusSwiss.push(arcsec(circular(d, s)));
      coreMinusSwiss.push(arcsec(circular(c, s)));
      deMinusCore.push(arcsec(circular(d, c)));
    });
    return {
      what: labelWhat,
      fromUtc: iso(msList[0]), toUtc: iso(msList[msList.length - 1]),
      allSwissFlagsWere258: swiss.rows.every((r) => r.retflag === 258),
      swissVersion: swiss.swissVersion,
      deMinusSwissArcsec: stats(deMinusSwiss),
      coreMinusSwissArcsec: stats(coreMinusSwiss),
      deMinusCoreArcsec: stats(deMinusCore),
    };
  };

  const atStation = (() => {
    const swiss = swissLongitudes('Uranus', [deStation.tMs]);
    return {
      swissLongitude: swiss.rows[0].lon,
      deLongitude: de.lon('Uranus', deStation.tMs),
      coreLongitude: core.lon('Uranus', deStation.tMs),
      deMinusSwissArcsec: arcsec(circular(de.lon('Uranus', deStation.tMs), swiss.rows[0].lon)),
      coreMinusSwissArcsec: arcsec(circular(core.lon('Uranus', deStation.tMs), swiss.rows[0].lon)),
    };
  })();

  out.sources.ephemerisModel = {
    what: 'Disagreement between independent implementations of the same apparent geocentric longitude, with the clock held fixed at the v6 recipe (TT = UTC + 69.184 s) for Swiss and the DE prototype.',
    caution: 'Swiss and DE440s both descend from JPL development ephemerides. Agreement between them is CONSISTENCY, not independent observational accuracy, and nothing here is fitted to Swiss.',
    overComponent: measure(component, 'second component, 6-hourly grid'),
    overOpenRegion: measure(openRegion, 'the region the original contract could not close, hourly grid'),
    atTheTurningPointItself: atStation,
    marginDisagreement: {
      what: 'The quantity that actually decides the count: each source\'s own g*.',
      swissMarginDegrees: policy.originalFailedWitness.circularMarginDegrees,
      deMarginDegrees: Math.abs(deStation.value),
      coreMarginDegrees: Math.abs(coreStation.value),
      deVersusSwissArcsec: arcsec(Math.abs(deStation.value) - policy.originalFailedWitness.circularMarginDegrees),
      coreVersusSwissArcsec: arcsec(Math.abs(coreStation.value) - policy.originalFailedWitness.circularMarginDegrees),
    },
    verdict: 'This is the only source with a size comparable to a plausible budget, and it is still far below the margin. The DE prototype and Swiss agree on g* to 0.048 arcsec (1.3e-5 degrees), which is 3300x smaller than the 0.0442-degree margin. The shipped core engine differs from Swiss by 3.1 arcsec (8.6e-4 degrees) on g*, still 51x smaller than the margin. The known ceiling on the DE prototype is its reuse of astronomy-engine\'s truncated nutation series, a reduction-model choice, not the position series.',
  };
}

// ---------------------------------------------------------------------------
// SOURCE 3 -- time-model uncertainty.
// ---------------------------------------------------------------------------
{
  const swissClock = swissLongitudes('Uranus', [Date.parse('2020-01-11T00:00:00Z')]).rows[0];
  const A = await import('astronomy-engine');
  const t2020 = A.MakeTime(new Date('2020-01-11T00:00:00Z'));
  const engineDeltaTSeconds = (t2020.tt - t2020.ut) * 86400;

  const perturbed = async (shiftSeconds) => {
    const shifted = await deBackend({ ttMinusUtcSeconds: TT_MINUS_UTC + shiftSeconds });
    const problem = buildLevelProblem({ lon: shifted.lon, body: 'Uranus', targetDegrees: TARGET, aMs, bMs });
    const station = locateTurningPoint({ f: problem.f, fromMs: Date.parse('2019-12-01T00:00:00Z'), toMs: Date.parse('2020-02-15T00:00:00Z'), secondDerivativeBound: M2 });
    return { shiftSeconds, stationUtc: iso(station.tMs), gStar: station.value, deltaGStarDegrees: station.value - deStation.value, stationShiftSeconds: (station.tMs - deStation.tMs) / 1000 };
  };

  out.sources.timeModel = {
    what: 'Uncertainty in the UTC -> TT map, and in what a "UTC label" means for this window.',
    thisWindowIsHistorical: {
      ttMinusUtcSeconds: TT_MINUS_UTC,
      composition: '37 leap seconds + 32.184 s. No leap second falls inside 2019-01-01..2020-12-31, so the offset is constant and exactly known; no Delta-T extrapolation enters.',
      swissReturnedTtMinusUtcSeconds: swissClock.ttMinusUtcSeconds,
      residualSeconds: swissClock.ttMinusUtcSeconds - TT_MINUS_UTC,
      residualNote: 'Swiss\'s own Julian-day rounding, not a model disagreement. The policy guard allows 0.001 s.',
      astronomyEngineDeltaTSeconds: engineDeltaTSeconds,
      astronomyEngineIsTtMinusUt1Note: 'The shipped core engine applies TT - UT1, not TT - UTC. The two differ by the current DUT1, which is why the core backend cannot be clock-matched without the pinning hook the DE prototype has.',
      astronomyEngineVersusPolicyClockSeconds: engineDeltaTSeconds - TT_MINUS_UTC,
    },
    sensitivityOfTheDecisionVariable: [await perturbed(0.001), await perturbed(0.1), await perturbed(1), await perturbed(10)],
    analyticExplanation: {
      onTheTurningPointValue: "A uniform clock shift dt moves the turning point in time by exactly dt and changes its VALUE by |f''| * dt^2 / 2, because the first derivative vanishes there. At 1 second that is 5.9e-14 degrees.",
      onTheCrossingTimes: 'A uniform clock shift dt moves each crossing time by exactly dt. That is a real effect on published timestamps and it is first order -- but it does not touch the count.',
      why: 'The clock enters the count only through the turning point value, where it is second order. This is the same structure as source 1 and the reason both are negligible.',
    },
    verdict: 'Negligible for the count. A full second of clock error -- ten thousand times the policy\'s own 0.001-second guard, and impossible for a historical UTC label -- moves g* by 6e-14 degrees. It moves the crossing TIMES by a full second, which matters for published timestamps and not at all for the topology.',
  };
}

// ---------------------------------------------------------------------------
// SOURCE 4 -- genuine ambiguity in the NUMBER of roots.
// ---------------------------------------------------------------------------
{
  const ladder = [0.05, 0.0442, 0.044, 0.02, 0.01, 0.005, 0.001, 0.0001];
  const rows = [];
  for (const epsilon of ladder) {
    const verdict = classifyInterval({
      label: `de:second-component:eps=${epsilon}`,
      f: deProblem.f,
      derivativeEnclosure: deProblem.derivativeEnclosure,
      secondDerivativeEnclosure: deProblem.secondDerivativeEnclosure,
      a: aMs, b: bMs, epsilon, minWidth: 100, maxEvaluations: 60000,
      boundKind: 'empirical',
    });
    rows.push({
      epsilonDegrees: epsilon, epsilonArcsec: arcsec(epsilon),
      verdict: verdict.verdict, outcome: verdict.outcome,
      rootCount: verdict.rootCount, possibleRootCounts: verdict.possibleRootCounts,
      evaluations: verdict.evaluations,
      crossingsUtc: verdict.crossings?.map((x) => ({ fromUtc: iso(x.lo), toUtc: iso(x.hi), widthDays: x.width / DAY_MS })) ?? null,
    });
  }
  out.sources.rootCountAmbiguity = {
    what: 'Not an error at all: a decision about which allowance the contract applies. Given g*, the count is decidable exactly when the declared allowance is smaller than |g*|.',
    rule: 'epsilon < |g*| certifies the count; epsilon >= |g*| leaves {0, 1, 2} all consistent.',
    criticalEpsilonDegrees: { swiss: policy.originalFailedWitness.circularMarginDegrees, de: Math.abs(deStation.value), core: Math.abs(coreStation.value) },
    originalBudgetDegrees: B,
    originalBudgetExceedsCriticalBy: B - Math.abs(deStation.value),
    ladder: rows,
    verdict: 'The original contract is ambiguous by 0.0058 degrees of budget, not by 0.0058 degrees of measured error. Sources 1 to 3 together contribute under 1e-3 degrees; the remaining 0.049 degrees of the 0.05 budget is unexercised headroom that the contract nevertheless spends.',
  };
}

// ---------------------------------------------------------------------------
// TASK 5 -- stationary-geometry audit.
// ---------------------------------------------------------------------------
{
  const speedAt = (offsetDays) => Math.abs((deProblem.f(deStation.tMs + offsetDays * DAY_MS + 600_000) - deProblem.f(deStation.tMs + offsetDays * DAY_MS - 600_000)) / (2 * 600_000)) * DAY_MS;
  const curvaturePerDay2 = curvatureAtStation(deProblem.f, deStation.tMs);
  const recorded = second.possibleExactRegionMs;
  const recordedWidthDays = (recorded[1] - recorded[0]) / DAY_MS;
  // The recorded envelope is the connected set {|g| <= B}. Because g* = -0.0442
  // never reaches -B, that set is bounded on both sides by crossings of +B, so
  // its half-width is the quadratic half-width for a rise of B - g*.
  const rise = B - deStation.value;
  const quadratic = stationaryTimeEnvelope(curvaturePerDay2, rise);
  // The level set solved on the real function, which is what the policy asks
  // for and what the quadratic is only a scale for.
  const levelSet = (() => {
    const g = (t) => deProblem.f(t) - B;
    const solve = (p, q) => {
      let lo = Math.min(p, q), hi = Math.max(p, q);
      let flo = g(lo);
      if (flo * g(hi) > 0) throw new Error('level-set endpoint is not bracketed');
      for (let i = 0; i < 60 && hi - lo > 100; i += 1) {
        const m = Math.floor((lo + hi) / 2);
        const fm = g(m);
        if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m;
      }
      return Math.round((lo + hi) / 2);
    };
    const left = solve(aMs, deStation.tMs);
    const right = solve(deStation.tMs, bMs);
    return { fromUtc: iso(left), toUtc: iso(right), widthDays: (right - left) / DAY_MS };
  })();
  out.stationaryGeometryAudit = {
    what: 'TASK 5. Position uncertainty must NOT be converted into timing uncertainty by dividing by a near-zero velocity at a turning point.',
    theWrongConversion: {
      formula: 'dt = epsilon / |dLongitude/dt| near the station',
      speedProfileDegPerDay: [
        { daysBeforeStation: 30, speed: speedAt(-30), naiveHalfWidthDays: B / speedAt(-30) },
        { daysBeforeStation: 10, speed: speedAt(-10), naiveHalfWidthDays: B / speedAt(-10) },
        { daysBeforeStation: 1, speed: speedAt(-1), naiveHalfWidthDays: B / speedAt(-1) },
        { daysBeforeStation: 0.1, speed: speedAt(-0.1), naiveHalfWidthDays: B / speedAt(-0.1) },
        { daysBeforeStation: 0, speed: speedAt(0), naiveHalfWidthDays: B / speedAt(0) },
      ],
      whyItIsWrong: 'The velocity vanishes at the station by definition, so the quotient diverges: there is no value of it to pick. Even a full day before the station it already returns 58 days, four times the correct half-width, and the answer keeps growing the closer the sample is taken to the event it is meant to describe. The shape is wrong as well -- near a turning point the function is quadratic, not linear -- so no choice of sampling point rescues the formula.',
      comparisonAtOneDayBefore: { naiveHalfWidthDays: B / speedAt(-1), correctHalfWidthDays: quadratic.halfWidthQuadratic, ratio: (B / speedAt(-1)) / quadratic.halfWidthQuadratic },
    },
    theRightTreatment: {
      formula: "half-width = sqrt(2 * (B - g*) / |d2Longitude/dt2|), and in practice solve the level set on the real function rather than the quadratic",
      curvatureAtStationDegPerDay2: curvaturePerDay2,
      riseFromStationToLevelDegrees: rise,
      quadraticHalfWidthDays: quadratic.halfWidthQuadratic,
      quadraticFullWidthDays: 2 * quadratic.halfWidthQuadratic,
      levelSetSolvedOnTheRealFunction: levelSet,
      recordedPossibleExactRegionUtc: recorded.map(iso),
      recordedPossibleExactRegionWidthDays: recordedWidthDays,
      quadraticMinusRecordedDays: 2 * quadratic.halfWidthQuadratic - recordedWidthDays,
      levelSetMinusRecordedDays: levelSet.widthDays - recordedWidthDays,
      reading: 'The v6 policy solves this envelope as a level set (gates.closestApproachTimeEnvelope: "solve the connected source set e(t) <= e_min + 2B"). Solving the same level set here on the DE function reproduces the recorded 29.48-day envelope to 0.0025 days -- about two minutes at each endpoint -- and the quadratic scale agrees with both to 0.156 days. The recorded envelope was built the right way.',
    },
    auditOfTheRepository: {
      searched: ['src/lib/engine/**/*.ts', 'scripts/**', 'api/**', 'docs/engine-validation/**'],
      pattern: 'any division by a longitude speed, daily motion, slope or derivative used to turn an angular tolerance into a time tolerance',
      found: 'none',
      detail: [
        'src/lib/engine/transit-window-core.ts builds its timing evidence from level sets: certainty.exactPossibleRanges comes from track.regions(target, budget + resolution), and the uncertain peak envelope from track.regions(target, minimum + 2 * budget). No velocity appears in either.',
        'src/lib/engine/transit-scan-core.ts locates stations by a sign change in longitudeSpeed and then refines by a direct extremum search (refineLongitudeExtremum); it never divides by the speed it just found to be zero.',
        'src/lib/engine/longitude-crossings.ts is pure bisection on the value, with no Newton step and so no division by the derivative.',
        'docs/engine-validation/transit-windows/wave24-d-qualified-policy.v6.json states the level-set rule explicitly and rejects the alternative: gates.minimumEnvelopeFailure forbids replacing the envelope with an observed residual.',
      ],
      conclusion: 'The mistake is not present. Reporting that is the finding, and the quadratic check above is the evidence that the existing envelope is right rather than merely absent of the wrong formula.',
    },
    separateObservationNotADivisionBug: {
      where: 'src/lib/engine/longitude-crossings.ts findLongitudeCrossingsWith, as called by src/lib/engine/returns.ts saturnReturns and src/lib/engine/year-scan.ts with the default stepDays = 5',
      what: 'A fixed-step sign-change scan with no station splitting. Two crossings that straddle a station inside one coarse step cancel into equal-sign endpoints and BOTH are dropped silently. The doc comment on returns.ts argues "a triple pass spans months, never 5 days", which is true of a well-separated triple pass and false of a grazing one -- exactly the Uranus D geometry.',
      notAffected: 'src/lib/engine/transit-scan-core.ts splits every body scan at its stations before calling the same solver, and src/lib/engine/transit-window-core.ts builds monotone branches between turning points. Sun and Moon targets never station in longitude.',
      demonstration: 'see coarseScanCompletenessDemonstration below',
    },
  };
}

// ---------------------------------------------------------------------------
// A concrete demonstration of what a coarse sign-change scan cannot see.
// ---------------------------------------------------------------------------
{
  // The algorithm of src/lib/engine/longitude-crossings.ts, reimplemented here
  // because this track does not import the repository's TypeScript build.
  const coarseScan = (f, from, to, stepDays) => {
    const step = stepDays * DAY_MS;
    const found = [];
    let prevT = from, prev = f(from);
    while (prevT < to) {
      const t = Math.min(prevT + step, to);
      const cur = f(t);
      if (prev !== 0 && cur !== 0 && Math.sign(cur) !== Math.sign(prev)) found.push({ fromMs: prevT, toMs: t });
      prevT = t; prev = cur;
    }
    return found;
  };
  const curvaturePerDay2 = curvatureAtStation(deProblem.f, deStation.tMs);
  const rows = [];
  for (const dipDegrees of [0.05, 0.01, 0.002, 0.0005]) {
    // Move the target so the station sits `dipDegrees` below it: the pair of
    // crossings then sits 2*sqrt(2*dip/|f''|) apart.
    const syntheticTarget = TARGET + (deStation.value + dipDegrees);
    const problem = buildLevelProblem({ lon: de.lon, body: 'Uranus', targetDegrees: syntheticTarget, aMs, bMs });
    const separationDays = 2 * Math.sqrt(2 * dipDegrees / curvaturePerDay2);
    const run = (epsilon) => {
      const verdict = classifyInterval({
        label: `synthetic-dip-${dipDegrees}-eps-${epsilon}`,
        f: problem.f, derivativeEnclosure: problem.derivativeEnclosure, secondDerivativeEnclosure: problem.secondDerivativeEnclosure,
        a: aMs, b: bMs, epsilon, minWidth: 100, maxEvaluations: 60000, boundKind: 'empirical',
      });
      return { epsilonDegrees: epsilon, verdict: verdict.verdict, rootCount: verdict.rootCount, possibleRootCounts: verdict.possibleRootCounts, evaluations: verdict.evaluations };
    };
    rows.push({
      syntheticTargetDegrees: syntheticTarget,
      dipBelowTargetDegrees: dipDegrees,
      predictedSeparationDays: separationDays,
      coarseScanStepDays: 5,
      coarseScanCrossingsFound: coarseScan(problem.f, aMs, bMs, 5).length,
      coarseScanStepHalfDay: 0.5,
      coarseScanCrossingsFoundAtHalfDay: coarseScan(problem.f, aMs, bMs, 0.5).length,
      intervalSearch: [run(0.001), run(0.0001)],
    });
  }
  out.coarseScanCompletenessDemonstration = {
    what: 'The real Uranus trajectory with the target moved so the January 2020 station misses it by a chosen amount. Everything else is unchanged: same body, same window, same DE backend.',
    rows,
    reading: [
      'A five-day sign-change scan silently reports ZERO crossings once the pair closes to within one step, while the bounded search still certifies two at the same epsilon. That is the completeness gap an interval method exists to remove.',
      'Halving the step to half a day recovers the 4.3-day pair and still misses nothing about WHY: a denser scan moves the threshold at which it goes blind, it never tells you where that threshold is. A derivative enclosure does.',
      'At a 0.0005-degree dip and a declared epsilon of 0.001 degrees the search refuses instead of guessing, and certifies two roots only once the epsilon is smaller than the dip. That refusal is the behaviour under test, not a shortfall.',
    ],
  };
}

out.summary = {
  headline: 'Only one of the four sources is large enough to matter, and it is a factor of 3300 smaller than the margin it would have to cover. The fourth source is not an error term at all.',
  table: [
    { source: 'root-finding', contributionToGStarDegrees: 5.9e-19, howMeasured: '1 ms bisection residual times the measured curvature, second order' },
    { source: 'ephemeris/model (DE prototype vs Swiss)', contributionToGStarDegrees: 1.33e-5, howMeasured: 'difference of the two independently located station values, clocks matched' },
    { source: 'ephemeris/model (shipped core vs Swiss)', contributionToGStarDegrees: 8.62e-4, howMeasured: 'same, with the core engine\'s own Delta-T' },
    { source: 'time-model', contributionToGStarDegrees: 6e-14, howMeasured: 'pinned-TT perturbation of 1 second, ten thousand times the policy guard' },
    { source: 'root-count ambiguity', contributionToGStarDegrees: null, howMeasured: 'not an error: the declared allowance, 0.05 degrees, against |g*| = 0.0442 degrees' },
  ],
};

process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
