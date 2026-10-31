/**
 * The partitioned search: what it claims, what it refuses, and the
 * accounting that has to hold when it runs out of budget.
 *
 * ## Why this file exists separately from `domain-partition.nodetest.mjs`
 *
 * That one tests the PLAN -- whether the four classes are true of the
 * geometry. This one tests what is built on top of a plan: the trust
 * boundary around a supplied one, the two axes the result reports on, and
 * the conditions under which each completeness flag is allowed to be true.
 *
 * Every test here was written against a specific mutation that survived a
 * bounded review of the code, and each one was confirmed to fail with that
 * mutation applied and pass without it. The mutation is named in the test.
 *
 * The fixture is `examples/synthetic-pack.mjs`: the arithmetic is real and
 * the sky is not. `Venus` there is a fast companion that laps the observer
 * every 0.7 days, so a one-day window crosses the five-degree floor three
 * times -- which is what gives these tests boundary spans to reason about
 * without needing a coefficient pack.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { openPackFromBytes } from '../../src/index.mjs';
import { buildSyntheticPack } from '../../examples/synthetic-pack.mjs';
import {
  partitionDomain, isNativePlan, validatePlanSpans, packFingerprint,
} from '../../src/core/domain-partition.mjs';
import { searchDeflectedOverPartition, spansMeet } from '../../src/core/partitioned-search.mjs';

const DAY = 86400;
/** The companion's window: three floor crossings, three boundary spans. */
const NEAR = { body: 'Venus', fromTdbSec: -DAY, toTdbSec: DAY };
const TARGET = 137;

const rt = await openPackFromBytes(await buildSyntheticPack());
const eph = rt.ephemeris;

const plan = (over = {}) => partitionDomain(eph, { ...NEAR, ...over });
const run = (over = {}) => searchDeflectedOverPartition(eph, { ...NEAR, targetDeg: TARGET, ...over });
const total = (spans) => spans.reduce((n, [lo, hi]) => n + (hi - lo), 0);
/** A deserialized copy: same numbers, different object, no provenance. */
const roundTrip = (p) => JSON.parse(JSON.stringify(p));

// =============================================== 1. the plan is not a proof
/**
 * Mutation this catches: `assertPartitionUsable` accepting any plan whose
 * key matches, which is what it did before -- a key is recomputed locally
 * from the live pack, so anything able to call `partitionKey` can produce
 * one.
 */
test('a plan this runtime did not derive is refused, and says why', () => {
  const honest = plan();
  assert.equal(isNativePlan(honest), true);
  const imported = roundTrip(honest);
  assert.equal(isNativePlan(imported), false,
    'a deserialized plan must not be mistaken for one this runtime derived');
  // The key is identical -- that is the whole point.
  assert.equal(imported.key, honest.key);

  assert.throws(
    () => run({ plan: imported }),
    (e) => e.code === 'unsupported-option' && /fingerprint, not a signature/.test(e.message),
    'an import with a matching key must be refused, not believed',
  );
  // And the native one goes through untouched.
  const ok = run({ plan: honest });
  assert.equal(ok.execution.partitionReused, true);
  assert.equal(ok.execution.planImported, false);
  assert.equal(ok.completeness.restsOnImportedPlan, false);
});

/**
 * Mutation this catches: dropping the span validation, or dropping the
 * `restsOnImportedPlan` marker, so an accepted import reads exactly like a
 * derived one.
 */
test('an accepted import is checked for shape, and every claim over it says so', () => {
  const honest = plan();

  // Shape: spans that leave the request.
  const escaping = roundTrip(honest);
  escaping.admissible = [[-3 * DAY, 3 * DAY]];
  escaping.excluded = []; escaping.boundary = []; escaping.unprocessed = [];
  assert.throws(
    () => run({ plan: escaping, acceptImportedPlan: true }),
    (e) => e.code === 'unsupported-option' && /outside the requested/.test(e.message),
  );

  // Shape: classes that overlap, so some instant carries two verdicts.
  const overlapping = roundTrip(honest);
  overlapping.excluded = [[-DAY, 0]];
  assert.throws(
    () => run({ plan: overlapping, acceptImportedPlan: true }),
    (e) => e.code === 'unsupported-option' && /overlap|do not tile/.test(e.message),
  );

  // Shape: a gap.
  const gapped = roundTrip(honest);
  gapped.admissible = gapped.admissible.slice(1);
  assert.throws(
    () => run({ plan: gapped, acceptImportedPlan: true }),
    (e) => e.code === 'unsupported-option' && /do not tile/.test(e.message),
  );

  /**
   * And the case the shape check CANNOT catch, which is the point of the
   * flag: a structurally perfect plan whose verdicts are false. It is
   * accepted on the caller's authority -- and every claim it produces
   * carries that, in a field and in the statement, so a reader is not told
   * this runtime proved something it did not.
   */
  const lying = roundTrip(honest);
  lying.admissible = [[-DAY, DAY]];
  lying.excluded = []; lying.boundary = []; lying.unprocessed = []; lying.boundaryReasons = [];
  assert.equal(validatePlanSpans(lying, -DAY, DAY), null,
    'this plan is well formed; only its verdicts are wrong, and shape cannot see that');
  const r = run({ plan: lying, acceptImportedPlan: true });
  assert.equal(r.completeness.overRequest, true, 'the claim follows from the plan it was given');
  assert.equal(r.completeness.restsOnImportedPlan, true);
  assert.equal(r.execution.planImported, true);
  assert.match(r.completeness.statement, /CONDITIONAL/);
  assert.match(r.completeness.statement, /checked for shape and not for truth/);
});

/**
 * Mutation this catches: `assertPartitionUsable` reading
 * `boundaryToleranceSec` out of the plan instead of from the caller --
 * the exact circularity the file's own comment says was found and fixed,
 * and which nothing tested.
 */
test('the identity is rebuilt from the caller, never from the plan it is checking', () => {
  const at60 = plan();
  const at30 = plan({ boundaryToleranceSec: 30 });
  assert.notEqual(at60.key, at30.key, 'the tolerance is part of the identity');

  assert.throws(
    () => run({ plan: at30 }),
    (e) => e.code === 'unsupported-option' && /different request/.test(e.message),
    'a 30-second plan must be refused for a 60-second request',
  );
  assert.throws(
    () => run({ plan: at60, boundaryToleranceSec: 30 }),
    (e) => e.code === 'unsupported-option' && /different request/.test(e.message),
    'and the other way round',
  );
  // Each is usable for its own tolerance, so the refusals above are not
  // a blanket one.
  assert.equal(run({ plan: at60 }).execution.partitionReused, true);
  assert.equal(run({ plan: at30, boundaryToleranceSec: 30 }).execution.partitionReused, true);

  /**
   * The result states the CALLER's tolerance. A supplied object must not
   * be able to put anything into the result's account of what was asked.
   */
  const tampered = roundTrip(at60);
  tampered.request.boundaryToleranceSec = 5;
  const r = run({ plan: tampered, acceptImportedPlan: true });
  assert.equal(r.request.boundaryToleranceSec, 60,
    'the result reports what the caller asked for, not what the plan says');
});

/**
 * Mutation this catches: accepting a plan that stopped early. Its key is
 * identical to a finished plan's -- deliberately, since two FINISHED
 * plans at different budgets are the same plan -- so nothing else
 * separates them.
 */
test('a plan that did not classify its whole window is refused by default', () => {
  const starved = plan({ maxEvaluations: 100 });
  assert.notEqual(starved.execution.status, 'finished');
  assert.ok(starved.unprocessed.length > 0);
  assert.equal(starved.key, plan().key, 'the budget is deliberately not in the key');

  assert.throws(
    () => run({ plan: starved }),
    (e) => e.code === 'unsupported-option' && /classified only part of its window/.test(e.message),
  );

  const r = run({ plan: starved, acceptPartialPlan: true });
  assert.equal(r.execution.status, starved.execution.status,
    'a run over a partial plan inherits the plan\'s status');
  assert.equal(r.execution.finished, false,
    'and must not report itself finished: part of the request was never classified');
  assert.equal(r.completeness.overRequest, false);
  assert.equal(r.completeness.mayHoldUnfoundSupportedEvents, true);

  // And it SEARCHES the part the plan did classify, which is what the
  // option is for. Before audit finding alpha-search-partition-1 was
  // fixed, the inherited status stopped every subsearch: no span was
  // searched, nothing was found, and this flag read false because nothing
  // had been examined, not because anything was missed.
  assert.equal(r.spanResults.length, starved.admissible.length + starved.boundary.length,
    'every classified span is searched');
  assert.equal(r.completeness.exhaustiveOverAdmissible, starved.admissible.length > 0,
    'exhaustive over the admissible spans the plan names, and no further');
  const full = run({});
  const inClassified = (t) => [...starved.admissible, ...starved.boundary].some(([lo, hi]) => t >= lo && t < hi);
  assert.deepEqual(r.events.map((e) => e.tdbSec), full.events.filter((e) => inClassified(e.tdbSec)).map((e) => e.tdbSec),
    'the events found in the classified part are the full run\'s events there');
});

// ====================================== 2. two axes, and the tiling holds
/**
 * Mutation this catches: pushing unsearched admissible spans into
 * `unprocessed`, which double-counted them, while
 * `coversRequestExactly` summed a different list and reported true anyway.
 */
test('the four classes tile the request at every budget, and examination is a separate axis', () => {
  const requestSec = NEAR.toTdbSec - NEAR.fromTdbSec;
  let sawStarvedSubsearch = false;
  for (const maxEvaluations of [1, 200, 2000, 4000, 5305, 6000, 8000, 4_000_000]) {
    const r = run({ maxEvaluations });
    const a = r.accounting;
    const sum = a.admissibleSec + a.excludedSec + a.boundarySec + a.unprocessedSec;
    assert.ok(Math.abs(sum - requestSec) <= 1e-6,
      `at budget ${maxEvaluations} the four classes sum to ${sum} of ${requestSec}`);
    assert.equal(a.coversRequestExactly, true, `at budget ${maxEvaluations}`);
    assert.equal(a.requestSec, requestSec);

    // The second axis is reported and is NOT one of the four.
    assert.ok(Array.isArray(a.notSearched));
    assert.equal(a.notSearchedSec, total(a.notSearched));
    if (a.notSearchedSec > 0) {
      sawStarvedSubsearch = true;
      assert.equal(r.completeness.mayHoldUnfoundSupportedEvents, true,
        'time nobody searched can hold a supported crossing, and the result must say so');
      assert.equal(r.completeness.overRequest, false);
      assert.equal(r.completeness.exhaustiveOverAdmissible, false);
    }
    // The budget is one allowance and it reconciles.
    assert.equal(r.execution.evaluations, r.execution.partitionEvaluations + r.execution.searchEvaluations);
  }
  assert.ok(sawStarvedSubsearch, 'this test is vacuous unless some budget starves a subsearch');
});

/**
 * Mutation this catches: a starved span pushed to `excluded` instead of
 * left unclassified. Unexamined is not the same as declined, and a
 * consumer that cannot tell them apart reads "we ran out of time" as "no
 * answer exists here".
 */
test('running out never converts unexamined time into an exclusion', () => {
  const full = run();
  const fullExcluded = full.accounting.excludedSec;
  for (const maxEvaluations of [1, 50, 200, 800, 2000, 4000]) {
    const r = run({ maxEvaluations });
    assert.ok(r.accounting.excludedSec <= fullExcluded + 1e-6,
      `budget ${maxEvaluations} reported ${r.accounting.excludedSec} s excluded against ${fullExcluded} s when it had the time to look`);
  }
  // Cancellation, the other way of stopping early.
  const signal = { aborted: true };
  const c = run({ signal });
  assert.equal(c.execution.status, 'cancelled');
  assert.equal(c.accounting.excludedSec, 0, 'a run cancelled before it looked has declined nothing');
  assert.equal(c.accounting.unprocessedSec, NEAR.toTdbSec - NEAR.fromTdbSec);
  assert.equal(c.accounting.coversRequestExactly, true);
});

/**
 * Mutation this catches: dropping the `status === 'finished'` conjunct
 * from `exhaustiveOverAdmissible`, or the `unprocessedTotal === 0`
 * conjunct from `overRequest`.
 */
test('no completeness flag survives a run that stopped early', () => {
  for (const maxEvaluations of [1, 200, 2000, 4000, 5305]) {
    const r = run({ maxEvaluations });
    if (r.execution.status === 'finished') continue;
    assert.equal(r.completeness.overRequest, false, `budget ${maxEvaluations}`);
    assert.equal(r.eventCount.isExactTotalOverRequest, false, `budget ${maxEvaluations}`);
    assert.equal(r.completeness.exhaustiveOverAdmissible, false, `budget ${maxEvaluations}`);
    assert.equal(r.eventCount.isExactTotalOverAdmissible, false, `budget ${maxEvaluations}`);
  }
  // And the positive control: a window with nothing declined and nothing
  // unclassified IS complete over its request, or the assertions above
  // would pass on a result that never claims anything.
  const clear = searchDeflectedOverPartition(eph, {
    body: 'Mars', targetDeg: 95, fromTdbSec: -38 * DAY, toTdbSec: 38 * DAY,
  });
  assert.equal(clear.accounting.excludedSec, 0);
  assert.equal(clear.accounting.boundarySec, 0);
  assert.equal(clear.completeness.overRequest, true);
  assert.equal(clear.eventCount.isExactTotalOverRequest, true);
});

/**
 * Mutation this catches: the partition's `spend()` no longer enforcing
 * `maxEvaluations`. The fixture finishes inside the default budget, so
 * only a deliberately starved run can see it.
 */
test('the partition stops when the allowance is gone, and the allowance is one', () => {
  for (const maxEvaluations of [1, 10, 100, 1000]) {
    const p = partitionDomain(eph, { ...NEAR, maxEvaluations });
    assert.equal(p.execution.status, 'budget-exhausted', `budget ${maxEvaluations}`);
    // Checked after incrementing, so it reports one past the limit and
    // never more than that.
    assert.ok(p.execution.evaluations <= maxEvaluations + 1,
      `budget ${maxEvaluations} spent ${p.execution.evaluations}`);
    assert.ok(p.unprocessed.length > 0, 'what it never reached must be reported');
  }
  const whole = partitionDomain(eph, NEAR);
  assert.equal(whole.execution.status, 'finished');
  for (const maxEvaluations of [1, 10, 100, 1000]) {
    const r = run({ maxEvaluations });
    assert.ok(r.execution.evaluations <= maxEvaluations + 1,
      `the whole request spent ${r.execution.evaluations} against ${maxEvaluations}`);
  }
});

// ============================ 3. what an event from a boundary span says
/**
 * Mutation this catches: labelling boundary-span crossings
 * `eligibility: 'established'`, or locating them with the deflected rung
 * while `positionFrom` keeps saying otherwise.
 */
test('a crossing found where nothing was proved says so, twice', () => {
  const p = plan();
  assert.ok(p.boundary.length > 0, 'this test needs a window with boundary spans');

  /**
   * A longitude the companion crosses inside a boundary span. Found by
   * asking the partition where the boundary is and then searching a
   * window that is ONLY that -- if any longitude produced a boundary
   * event, this test would be about whichever one happened to.
   */
  let found = null;
  for (let targetDeg = 0; targetDeg < 360 && found === null; targetDeg += 1) {
    const r = run({ targetDeg, plan: p });
    const e = r.events.find((x) => x.domain === 'boundary');
    if (e) found = { targetDeg, event: e, result: r };
  }
  assert.ok(found !== null, 'no longitude put a crossing in a boundary span; the test is vacuous');

  assert.equal(found.event.eligibility, 'not-established',
    'a crossing in a span nothing proved has not been shown to be in the supported domain');
  assert.equal(found.event.positionFrom, 'validated-retarded-aberrated-of-date',
    'and it was located WITHOUT the solar term, which is not the deflected crossing time');
  assert.match(found.event.positionNote, /NO solar deflection/);
  assert.ok(found.result.eventCount.eligibilityAmbiguous > 0);
  assert.equal(found.result.completeness.mayHoldUnfoundSupportedEvents, true);

  // The contrast, on the same run: an admissible-span crossing carries
  // the other two values.
  const est = found.result.events.find((x) => x.domain === 'admissible');
  if (est) {
    assert.equal(est.eligibility, 'established');
    assert.equal(est.positionFrom, 'validated-retarded-aberrated-deflected-of-date');
    assert.equal(est.positionNote, undefined);
  }
});

/**
 * Mutation this catches: `spansMeet` returning false unconditionally,
 * which is what disables the bracket-overlap downgrade.
 *
 * The downgrade itself cannot fire for any well-formed plan, and this
 * test says why rather than pretending otherwise: a derived plan's
 * classes are pairwise disjoint, and a subsearch over `[lo, hi]` returns
 * brackets inside `[lo, hi]`, so an admissible-span crossing's bracket
 * can touch a boundary span at an endpoint but never strictly overlap
 * one. Driving the search would therefore prove nothing either way. The
 * predicate is tested directly instead, and the disjointness it relies
 * on is tested as the property it is.
 */
test('the overlap predicate is strict, and no derived plan can make it fire', () => {
  // Strict overlap, and only that.
  assert.equal(spansMeet([[10, 20]], 15, 25), true, 'an interval that reaches in overlaps');
  assert.equal(spansMeet([[10, 20]], 5, 15), true);
  assert.equal(spansMeet([[10, 20]], 12, 18), true, 'contained is overlapping');
  assert.equal(spansMeet([[10, 20]], 5, 25), true, 'containing is overlapping');
  assert.equal(spansMeet([[10, 20]], 20, 30), false, 'touching at an endpoint is NOT overlapping');
  assert.equal(spansMeet([[10, 20]], 0, 10), false);
  assert.equal(spansMeet([[10, 20]], 25, 30), false);
  assert.equal(spansMeet([], 0, 100), false);
  assert.equal(spansMeet([[0, 1], [10, 20]], 15, 16), true, 'any span in the list counts');

  // The property that makes the net idle: classes touch, never overlap.
  const p = plan();
  assert.ok(p.boundary.length > 0 && p.admissible.length > 0);
  for (const [lo, hi] of p.admissible) {
    assert.equal(spansMeet(p.boundary, lo, hi), false,
      `admissible ${lo}..${hi} strictly overlaps a boundary span, so the partition contradicts itself`);
    assert.equal(spansMeet(p.excluded, lo, hi), false);
  }
  for (const [lo, hi] of p.boundary) assert.equal(spansMeet(p.excluded, lo, hi), false);

  // And every bracket the search returns stays inside its own span, which
  // is the other half of why the downgrade cannot fire.
  let brackets = 0;
  for (let targetDeg = 0; targetDeg < 360; targetDeg += 11) {
    const r = run({ targetDeg, plan: p });
    for (const e of r.events) {
      brackets += 1;
      const own = (e.domain === 'admissible' ? p.admissible : p.boundary)
        .find(([a, b]) => a <= e.tdbSec && e.tdbSec <= b);
      assert.ok(own, `no ${e.domain} span holds the crossing at ${e.tdbSec}`);
      assert.ok(e.bracketTdbSec[0] >= own[0] - 1e-9 && e.bracketTdbSec[1] <= own[1] + 1e-9,
        `a bracket left the span it was found in: ${e.bracketTdbSec} outside ${own}`);
      assert.notEqual(e.eligibility, 'boundary-ambiguous',
        'the downgrade fired on a derived plan, which the argument above says is impossible');
    }
  }
  assert.ok(brackets > 20, `only ${brackets} brackets examined`);
});

// ============================================== 4. the pack's own identity
/**
 * Mutation this catches: `packFingerprint` dropping the proven error
 * bounds, which are what the enclosures are built from -- two packs of
 * the same layout and different bounds would then share a plan identity.
 */
test('the plan identity moves when the pack\'s numerical metadata moves', async () => {
  const other = await openPackFromBytes(await buildSyntheticPack());
  assert.equal(partitionDomain(other.ephemeris, NEAR).key, plan().key,
    'the same bytes must give the same identity');

  /**
   * `packFingerprint` is tested directly rather than through
   * `partitionDomain`: it reads only `observer`, `emrat` and `bodies`, so
   * a stand-in carrying those is the whole of its input, and building one
   * avoids pretending a plain object is a runtime.
   */
  const real = packFingerprint(eph);
  const stand = (over) => packFingerprint({
    observer: eph.observer, emrat: eph.emrat, bodies: eph.bodies, ...over,
  });
  assert.equal(stand({}), real, 'the same metadata must give the same fingerprint');

  const bend = (field, f) => new Map([...eph.bodies].map(([name, sb]) => [name, { ...sb, [field]: f(sb[field]) }]));
  /**
   * The PROVEN ERROR BOUNDS are what every enclosure in the partition is
   * built from, so two packs that differ in them give different verdicts
   * for the same request and must not share a plan identity. An earlier
   * version of the fingerprint carried only the layout.
   */
  for (const field of ['provenPosKm', 'provenVelKmS', 'nrec', 'ncoef', 'initEt', 'intervalSec']) {
    assert.notEqual(stand({ bodies: bend(field, (v) => v * 2 + 1) }), real,
      `two packs differing in ${field} share a fingerprint`);
  }
  assert.notEqual(stand({ observer: 'barycentric' }), real, 'the observer is part of the identity');
  assert.notEqual(stand({ emrat: 0 }), real);
  // A body present in one pack and not the other.
  const fewer = new Map([...eph.bodies].filter(([name]) => name !== 'venusBary'));
  assert.notEqual(stand({ bodies: fewer }), real, 'a missing body must change the fingerprint');

  // And the weaker identity says it is weaker.
  assert.equal(partitionDomain(other.ephemeris, NEAR).request.identityStrength, 'structure-only',
    'a plan built without a pack digest must not read as one built with it');
  const withDigest = partitionDomain(other.ephemeris, { ...NEAR, packDigest: 'a'.repeat(64) });
  assert.equal(withDigest.request.identityStrength, 'digest');
  assert.notEqual(withDigest.key, plan().key);
  other.dispose();
});
