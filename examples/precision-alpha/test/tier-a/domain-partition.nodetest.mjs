/**
 * The domain partition: what it proves, what it declines to prove, and the
 * direction its conservatism points.
 *
 * ## Where the expected answers come from
 *
 * Nowhere near `partitionDomain`. Every fixture in this file is a geometry
 * built so that the solar elongation is an explicit function of time, and
 * every expected entry and exit instant is either that function solved in
 * closed form or bisected out of an independent reference that shares no
 * code with the operation under test. A test whose expectation came from
 * the operation's own output would pass for a partition that had lost a
 * crossing, which is the one failure the classification cannot afford.
 *
 * The trick that makes the closed forms exact is a target at a CONSTANT
 * distance from a stationary observer. The light-time is then `L/c`
 * exactly -- a fixed point the iteration reaches and does not move from --
 * so the elongation at reception time `t` is exactly the swing angle at
 * `t - L/c`, with no residual light-time approximation hiding inside the
 * expectation. The swing angle is whatever this file chooses it to be, so
 * the crossings, the tangencies and the double passages are placed rather
 * than discovered. `_geometry.mjs`'s own `tauExact` is used to CHECK that
 * claim before any case relies on it.
 *
 * Two fixtures are deliberately not of that shape: `CONJUNCTION` is
 * `heliocentricPair` through a real solar conjunction, where both bodies
 * move, the light-time is eleven minutes and varies, and the crossings can
 * only be bisected numerically; and `DRIFTING_SUN` puts the Sun somewhere
 * other than the barycentre, which is the only way to tell the reception
 * Sun in `e = O - S` from a constant.
 *
 * ## What this file can and cannot establish
 *
 * Section 8 of `PARTITION-EVALUATION.md` says it plainly: a classification
 * is a claim about every instant of a span and a test is a claim about the
 * instants it sampled. What is established here is that the conservative
 * bounds point the way they are supposed to, that the four classes tile
 * the request, that the operation never converts an undecidable geometry
 * into a verdict, and that the metamorphic relations the caching story
 * rests on hold. The soundness argument lives in `domain-partition.mjs`
 * and these are corroboration of it.
 *
 * ## One thing this file found
 *
 * `boundaryReasons` carried an `out-of-coverage` refusal for a window the
 * records do not cover, exactly as the header promised -- but only along
 * the path where `solveTau` noticed first. The sibling shape, where the
 * OBSERVER's records fall short, escaped `deriveLightTime` as a thrown
 * `PrecisionError`, because its first `stateEnclosure` calls sat in a
 * `try`/`finally` with no `catch` and `partitionDomain`'s own handler
 * takes only `budget-exhausted` and `cancelled`. One gap in the records,
 * reported two ways depending on whose records ran out. Both shapes are
 * answers now, and the test below asserts both.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from './_geometry.mjs';
import {
  partitionDomain, partitionKey, PARTITION_DEFAULTS, PARTITION_CONTRACT,
  NUMERICS_POLICY, NUMERICS_FINGERPRINT,
} from '../../src/core/domain-partition.mjs';
import {
  MIN_ELONGATION_RAD, COS_MIN_ELONGATION_GUARD, COS_MIN_ELONGATION_EXCLUDE,
  classifyElongationCos, DEFLECTION_PROFILE,
} from '../../src/core/deflection.mjs';
import { C_KM_S } from '../../src/core/retarded.mjs';
import { setInstrumentSink } from '../../src/core/instrument.mjs';

const D = 86400;
const DEG = Math.PI / 180;
/** The floor as a cosine. `cos` decreases, so BELOW the floor is ABOVE this. */
const COS_FLOOR = Math.cos(MIN_ELONGATION_RAD);
const BODY = 'Mars';

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Not Math.hypot: the same cross-engine rounding note the core modules carry.
const { sub3, norm3 } = G;

// ========================================================= the reference
/**
 * `cos(elongation)` at one instant, from the geometry's own functions.
 *
 * The same DEFINITION the profile uses -- `-(e_hat . d)/|d|`, `e` from the
 * Sun to the observer at reception, `d` light-time corrected -- evaluated
 * pointwise in doubles rather than over intervals. It shares no line with
 * `elongationCosInterval`; the light-time comes from `_geometry.mjs`'s
 * `tauExact`, which iterates to a fixed point and owes the solver nothing.
 */
function cosElongationExact(geom, t) {
  const O = geom.observer(t);
  const d = sub3(geom.target(t - G.tauExact(geom.target, geom.observer, t)), O);
  const e = sub3(O, geom.sun(t));
  return -dot3(e, d) / (norm3(e) * norm3(d));
}

const elongationDegExact = (geom, t) => (
  Math.acos(Math.max(-1, Math.min(1, cosElongationExact(geom, t)))) / DEG
);

/** Bisect the one crossing of the floor known to lie in [lo, hi]. */
function crossingBetween(geom, lo, hi) {
  const f = (t) => cosElongationExact(geom, t) - COS_FLOOR;
  let a = lo;
  let b = hi;
  let fa = f(a);
  assert.ok(Math.sign(fa) !== Math.sign(f(b)), `no floor crossing is bracketed by ${lo} .. ${hi}`);
  for (let i = 0; i < 300; i += 1) {
    const m = (a + b) / 2;
    if (!(m > a && m < b)) break;
    const fm = f(m);
    if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}

/**
 * Every maximal interval of [from, to] on which the elongation is BELOW
 * the floor, by sampling then bisection.
 *
 * This is the method the package exists to replace and its completeness is
 * not established: a passage narrower than the sample spacing is invisible
 * to it. It is used the one way that is sound -- to say where a passage
 * IS, so the partition's spans can be checked against something it did not
 * compute -- and every call site states the count the geometry demands so
 * a missed passage is a failed assertion rather than a quiet agreement.
 */
function belowFloorSpans(geom, from, to, samples) {
  const f = (t) => cosElongationExact(geom, t) - COS_FLOOR;
  const edges = [];
  let pt = from;
  let pv = f(from);
  for (let i = 1; i <= samples; i += 1) {
    const t = from + ((to - from) * i) / samples;
    const cv = f(t);
    if (pv !== 0 && cv !== 0 && Math.sign(cv) !== Math.sign(pv)) edges.push(crossingBetween(geom, pt, t));
    pt = t;
    pv = cv;
  }
  const marks = [from, ...edges, to];
  const out = [];
  for (let i = 1; i < marks.length; i += 1) {
    if (f((marks[i - 1] + marks[i]) / 2) > 0) out.push([marks[i - 1], marks[i]]);
  }
  return { spans: out, crossings: edges };
}

// ======================================================== the geometries
const OBSERVER_KM = 1.495978707e8;
/** A Moon-like standoff: close enough that `L/c` is a second and a third. */
const COMPANION_KM = 4.0e5;
const TAU_SEC = COMPANION_KM / C_KM_S;

/**
 * A stationary observer one astronomical unit from the barycentre, with a
 * companion at a FIXED distance swinging through the anti-Sun direction by
 * a chosen angle.
 *
 * Why it is built this way rather than out of `heliocentricPair`: the
 * elongation of that pair is a transcendental function of two orbital
 * phases and its floor crossings can only be found numerically, so a case
 * built on it can check WHERE the partition put a crossing but not place
 * one on purpose. Here the swing angle IS the elongation, so a tangency, a
 * double passage or a transition at the very edge of the request can be
 * constructed rather than hunted for.
 *
 * With the observer at rest and the target at constant range, `|d|` is
 * `offsetKm` at every instant, so the light-time is `offsetKm / c` exactly
 * and the elongation at reception `t` is exactly `|theta(t - tau)|`. The
 * first test checks that claim against `tauExact` before anything relies
 * on it.
 */
function swingGeometry(theta, { offsetKm = COMPANION_KM, sun = () => [0, 0, 0] } = {}) {
  const O = G.atEclipticLongitude(0, OBSERVER_KM);
  return {
    theta,
    offsetKm,
    tauSec: offsetKm / C_KM_S,
    sun,
    observer: () => O,
    target: (t) => {
      const u = G.atEclipticLongitude(Math.PI + theta(t), offsetKm);
      return [O[0] + u[0], O[1] + u[1], O[2] + u[2]];
    },
  };
}

/**
 * LINEAR -- one entry and one exit, at instants that need no solver.
 *
 * `theta = RHO * s` reaches the floor at `s = +-5 deg / RHO`, so the
 * passage is `(tau - HALF_PASSAGE, tau + HALF_PASSAGE)` and nothing but
 * arithmetic was needed to say so.
 */
const HALF_PASSAGE_SEC = 7200;
const RHO = MIN_ELONGATION_RAD / HALF_PASSAGE_SEC;
const LINEAR = swingGeometry((s) => RHO * s);
const LINEAR_ENTRY = TAU_SEC - HALF_PASSAGE_SEC;
const LINEAR_EXIT = TAU_SEC + HALF_PASSAGE_SEC;
const LINEAR_BELOW = [[LINEAR_ENTRY, LINEAR_EXIT]];
const LINEAR_EPH = G.packOf(LINEAR.target, LINEAR.observer, {
  intervalSec: 3600, initEt: -12 * 3600, nrec: 24,
});
const LINEAR_WIN = [-14400, 14400];

/**
 * DOUBLE -- two passages with a narrow bump of daylight between them.
 *
 * `theta = FLOOR + A (s^2 - P^2)(s^2 - Q^2)` is above the floor for
 * `|s| < P`, below it for `P < |s| < Q` and above it again beyond `Q`. So
 * `P` sets the GAP and `Q - P` sets the width of each passage, and the two
 * are tuned independently -- which a single well-shaped dip cannot do.
 * `A` is fixed so the deepest point of each passage is an elongation of
 * exactly zero, which keeps `theta` non-negative and so keeps the
 * elongation equal to `theta` rather than to its absolute value.
 *
 * The gap is 80 s against a 30 s boundary tolerance: under three
 * tolerances, which is the case the merge has to survive.
 */
const DBL_P = 40;
const DBL_Q = 400;
const DBL_A = MIN_ELONGATION_RAD / (((DBL_Q * DBL_Q - DBL_P * DBL_P) / 2) ** 2);
const DOUBLE = swingGeometry(
  (s) => MIN_ELONGATION_RAD + DBL_A * (s * s - DBL_P * DBL_P) * (s * s - DBL_Q * DBL_Q),
);
const DOUBLE_BELOW = [
  [TAU_SEC - DBL_Q, TAU_SEC - DBL_P],
  [TAU_SEC + DBL_P, TAU_SEC + DBL_Q],
];
const DOUBLE_EPH = G.packOf(DOUBLE.target, DOUBLE.observer, {
  intervalSec: 120, initEt: -600, nrec: 10,
});
const DOUBLE_WIN = [-480, 480];
const DOUBLE_TOLERANCE = 30;

/**
 * TANGENT -- the elongation falls to 5.05 degrees and turns round.
 *
 * No instant of this window is below the floor, so there is nothing to
 * exclude and an excluded span here would be a false proof rather than a
 * conservative one. The 0.05 degree clearance is deliberately far below
 * what the enclosures can resolve over a record, so the partition cannot
 * decide the turning region either -- which is the second half of the
 * case: it must say BOUNDARY, not admissible.
 */
const TANGENT_CLEARANCE = 0.05 * DEG;
const TANGENT_CURVATURE = (20 * DEG) / (3600 * 3600);
const TANGENT = swingGeometry(
  (s) => MIN_ELONGATION_RAD + TANGENT_CLEARANCE + TANGENT_CURVATURE * s * s,
);
const TANGENT_EPH = G.packOf(TANGENT.target, TANGENT.observer, {
  intervalSec: 900, initEt: -5400, nrec: 12,
});
const TANGENT_WIN = [-3600, 3600];

/**
 * CONJUNCTION -- `heliocentricPair` carried through a real solar
 * conjunction, with nothing arranged.
 *
 * Both bodies move, the light-time is about eleven minutes and changes
 * through the window, and the record-wide seeds are a day across. The
 * metamorphic cases run here rather than on the constructed geometries
 * because the relations they check are about the CELL LATTICE -- seeds,
 * bisection, light-time inheritance -- and a geometry whose enclosures are
 * trivially tight would not exercise it.
 */
const CONJUNCTION = G.heliocentricPair({ targetPhase: -Math.PI / 2 });
CONJUNCTION.sun = () => [0, 0, 0];
const CONJUNCTION_EPH = G.packOf(CONJUNCTION.target, CONJUNCTION.observer, {
  nrec: 142, initEt: -71 * D,
});
const CONJUNCTION_WIN = [-70 * D, 70 * D];

/**
 * DRIFTING_SUN -- the same linear swing, with the Sun somewhere other than
 * the barycentre.
 *
 * `packOf` leaves the Sun at the origin by default, and with the observer
 * one au from the origin that makes `e = O - S` equal to `O` -- so a
 * partition that never read the Sun at all would agree with one that did,
 * on every other fixture in this file. Here the Sun drifts across the
 * observer's sky and `e` turns with it, which moves both floor crossings
 * by about a thousand seconds against a boundary span under two hundred
 * wide. 300 km/s is not the Sun's barycentric speed, which is about 12
 * m/s; it is chosen to put the effect well above the width of the spans
 * the assertions compare, and it is named here rather than passed off as
 * physical.
 */
const SUN_DRIFT_KM_S = 300;
const SUN_DRIFT_DIR = G.atEclipticLongitude(Math.PI / 2, 1);
const sunDriftPath = (t) => [
  SUN_DRIFT_KM_S * t * SUN_DRIFT_DIR[0],
  SUN_DRIFT_KM_S * t * SUN_DRIFT_DIR[1],
  SUN_DRIFT_KM_S * t * SUN_DRIFT_DIR[2],
];
const DRIFTING_SUN = swingGeometry((s) => RHO * s, { sun: sunDriftPath });
const DRIFTING_SUN_EPH = G.packOf(DRIFTING_SUN.target, DRIFTING_SUN.observer, {
  intervalSec: 3600, initEt: -8 * 3600, nrec: 16, sunFn: sunDriftPath,
});
const DRIFTING_SUN_WIN = [-14400, 14400];

// ========================================================== the helpers
const spanTotal = (spans) => spans.reduce((acc, [lo, hi]) => acc + (hi - lo), 0);
const sortSpans = (spans) => [...spans].sort((x, y) => x[0] - y[0]);
const CLASSES = (r) => [
  ['admissible', r.admissible], ['excluded', r.excluded],
  ['boundary', r.boundary], ['unprocessed', r.unprocessed],
];

/**
 * THE coverage check, used by every finished case in this file.
 *
 * The contract's endpoint convention is that the four classes tile the
 * request in order, that adjacent spans of one class are merged, and that
 * no instant belongs to two spans. All three are checked here rather than
 * restated per case: a partition that drops a sliver, double-counts one,
 * or reports a span outside the window it was asked about fails whichever
 * case happens to be running.
 *
 * `1e-6` on the total is the figure section 3 of `PARTITION-EVALUATION.md`
 * uses for the same quantity; the spans themselves are exact halves of
 * exact seeds, so the slack is for the arithmetic and not for a tolerance.
 */
function assertTilesRequest(r, from, to, note) {
  for (const [name, list] of CLASSES(r)) {
    let prev = -Infinity;
    for (const [lo, hi] of list) {
      assert.ok(hi > lo, `${note}: ${name} span ${lo} .. ${hi} is empty or backwards`);
      assert.ok(lo >= from - 1e-9 && hi <= to + 1e-9,
        `${note}: ${name} span ${lo} .. ${hi} leaves the request ${from} .. ${to}`);
      assert.ok(lo > prev,
        `${note}: ${name} spans ${prev} and ${lo} are out of order or unmerged`);
      prev = hi;
    }
  }
  const all = sortSpans(CLASSES(r).flatMap(([, list]) => list));
  for (let i = 1; i < all.length; i += 1) {
    assert.ok(all[i][0] >= all[i - 1][1] - 1e-9,
      `${note}: ${all[i - 1]} and ${all[i]} overlap; no instant may belong to two classes`);
  }
  const total = spanTotal(all);
  assert.ok(Math.abs(total - (to - from)) <= 1e-6,
    `${note}: the four classes cover ${total} s of a ${to - from} s request, a gap or overlap of ${total - (to - from)} s`);
}

/**
 * THE ownership check: the conservative direction, asserted as a
 * containment and never as an equality.
 *
 * `excluded` claims the elongation is below the floor at EVERY instant of
 * the span, so every excluded span must sit inside a true below-floor
 * interval. `admissible` claims the opposite, so no admissible span may
 * overlap one at all. Neither is required to REACH the transition: the
 * residue between them is what `boundary` is for, and demanding equality
 * here would be demanding that a stopping rule resolve an instant it
 * declared it would not.
 */
function assertOwnership(r, below, note) {
  for (const [lo, hi] of r.excluded) {
    const host = below.find(([a, b]) => lo >= a - 1e-9 && hi <= b + 1e-9);
    assert.ok(host,
      `${note}: excluded ${lo} .. ${hi} is not inside any below-floor interval ${JSON.stringify(below)}`);
  }
  for (const [lo, hi] of r.admissible) {
    for (const [a, b] of below) {
      const overlap = Math.min(hi, b) - Math.max(lo, a);
      assert.ok(overlap <= 1e-9,
        `${note}: admissible ${lo} .. ${hi} overlaps the below-floor interval ${a} .. ${b} by ${overlap} s`);
    }
  }
}

/** Every true crossing inside the request must lie in a boundary span. */
function assertCrossingsAreOwnedByBoundary(r, crossings, note) {
  assert.ok(crossings.length > 0, `${note}: no crossing to own, so this check is vacuous`);
  for (const t of crossings) {
    const owner = r.boundary.find(([lo, hi]) => t >= lo - 1e-9 && t <= hi + 1e-9);
    assert.ok(owner,
      `${note}: the crossing at ${t} s TDB is in no boundary span; boundary is ${JSON.stringify(r.boundary)}`);
  }
}

/** A signal that turns on after `n` reads. Cancellation partway, exactly. */
function abortAfter(n) {
  let reads = 0;
  return { get aborted() { reads += 1; return reads > n; } };
}

/** A - union(B), for the metamorphic cases. */
function subtractSpans(A, B) {
  let out = A.map((s) => [...s]);
  for (const [c, d] of B) {
    const next = [];
    for (const [a, b] of out) {
      if (d <= a || c >= b) { next.push([a, b]); continue; }
      if (a < c) next.push([a, Math.min(b, c)]);
      if (b > d) next.push([Math.max(a, d), b]);
    }
    out = next;
  }
  return out.filter(([a, b]) => b - a > 1e-6);
}

const overlapTotal = (A, B) => {
  let s = 0;
  for (const [a, b] of A) for (const [c, d] of B) s += Math.max(0, Math.min(b, d) - Math.max(a, c));
  return s;
};

/** Merge touching spans, so two halves' lists can be compared with one's. */
function coalesceSpans(spans) {
  const out = [];
  for (const [lo, hi] of sortSpans(spans)) {
    const last = out[out.length - 1];
    if (last && lo <= last[1] + 1e-9) last[1] = Math.max(last[1], hi);
    else out.push([lo, hi]);
  }
  return out;
}

// ===================================================== the fixtures first
test('the fixtures are the geometries they claim to be', () => {
  // Every case below reads its expected instants off these constructions.
  // If the construction is not what the comment says, the cases that use
  // it agree with the partition about a geometry neither of them has.

  // 1. The constant-range trick. |d| is the standoff at every instant, so
  //    the light-time is L/c and the elongation at t is the swing angle at
  //    t - L/c. Checked against `tauExact`, which iterates rather than
  //    assuming, and against the elongation the reference computes.
  for (const t of [-9000, -1234.5, 0, 777, 13000]) {
    const tau = G.tauExact(LINEAR.target, LINEAR.observer, t);
    assert.ok(Math.abs(tau - TAU_SEC) < 1e-12,
      `the light-time at ${t} is ${tau} s, not the constant ${TAU_SEC} s the closed forms assume`);
    const predicted = Math.abs(LINEAR.theta(t - TAU_SEC)) / DEG;
    assert.ok(Math.abs(elongationDegExact(LINEAR, t) - predicted) < 1e-9,
      `the elongation at ${t} is ${elongationDegExact(LINEAR, t)} deg against a predicted ${predicted}`);
  }
  assert.ok(TAU_SEC > 1, 'a light-time of zero would make the constructions blind to it');

  // 2. LINEAR's crossings, closed form against independent bisection.
  assert.ok(Math.abs(elongationDegExact(LINEAR, LINEAR_ENTRY) - 5) < 1e-12);
  assert.ok(Math.abs(elongationDegExact(LINEAR, LINEAR_EXIT) - 5) < 1e-12);
  const lin = belowFloorSpans(LINEAR, LINEAR_WIN[0], LINEAR_WIN[1], 4000);
  assert.equal(lin.crossings.length, 2, 'LINEAR must cross the floor exactly twice');
  assert.ok(Math.abs(lin.crossings[0] - LINEAR_ENTRY) < 1e-6);
  assert.ok(Math.abs(lin.crossings[1] - LINEAR_EXIT) < 1e-6);

  // 3. DOUBLE really has TWO passages and a gap under three boundary
  //    tolerances, and its swing angle never turns negative -- if it did,
  //    the elongation would be |theta| and the passage boundaries would
  //    not be where the closed form puts them.
  const dbl = belowFloorSpans(DOUBLE, DOUBLE_WIN[0], DOUBLE_WIN[1], 20000);
  assert.equal(dbl.spans.length, 2, `DOUBLE has ${dbl.spans.length} passages, not two`);
  for (let i = 0; i < 2; i += 1) {
    assert.ok(Math.abs(dbl.spans[i][0] - DOUBLE_BELOW[i][0]) < 1e-6);
    assert.ok(Math.abs(dbl.spans[i][1] - DOUBLE_BELOW[i][1]) < 1e-6);
  }
  const gap = DOUBLE_BELOW[1][0] - DOUBLE_BELOW[0][1];
  assert.ok(gap === 2 * DBL_P && gap < 3 * DOUBLE_TOLERANCE,
    `the gap between the passages is ${gap} s against a ${DOUBLE_TOLERANCE} s tolerance`);
  let worstTheta = Infinity;
  for (let s = -DBL_Q; s <= DBL_Q; s += 1) worstTheta = Math.min(worstTheta, DOUBLE.theta(s));
  assert.ok(worstTheta >= 0, `DOUBLE's swing angle reaches ${worstTheta} rad, so the elongation is not theta`);
  // and the bump between them really is above the floor, or there is one
  // passage and the case is about nothing
  assert.ok(elongationDegExact(DOUBLE, TAU_SEC) > 5,
    'the bump between the two passages must clear the floor');

  // 4. TANGENT touches and turns. No instant below the floor.
  const tan = belowFloorSpans(TANGENT, TANGENT_WIN[0], TANGENT_WIN[1], 20000);
  assert.equal(tan.crossings.length, 0, 'TANGENT must not cross the floor at all');
  assert.equal(tan.spans.length, 0);
  const closest = elongationDegExact(TANGENT, TAU_SEC);
  assert.ok(closest > 5 && closest < 5.1,
    `TANGENT's closest approach is ${closest} deg; it must graze the floor, not ignore it`);

  // 5. CONJUNCTION really passes through conjunction, and only once.
  const conj = belowFloorSpans(CONJUNCTION, CONJUNCTION_WIN[0], CONJUNCTION_WIN[1], 8000);
  assert.equal(conj.spans.length, 1, 'the conjunction fixture must have exactly one passage');
  assert.ok(elongationDegExact(CONJUNCTION, 0) < 0.1,
    `the conjunction fixture only reaches ${elongationDegExact(CONJUNCTION, 0)} deg`);

  // 6. DRIFTING_SUN's Sun is not at the barycentre, and moving it moves
  //    the crossings by far more than the spans the assertions compare.
  const drift = belowFloorSpans(DRIFTING_SUN, DRIFTING_SUN_WIN[0], DRIFTING_SUN_WIN[1], 4000);
  assert.equal(drift.crossings.length, 2);
  const shifted = Math.abs(drift.crossings[0] - LINEAR_ENTRY);
  assert.ok(shifted > 800,
    `putting the Sun back at the barycentre would move the entry crossing by only ${shifted} s;`
    + ' this fixture cannot show that the Sun is read');
  assert.ok(norm3(sunDriftPath(DRIFTING_SUN_WIN[1])) > 1e6, 'the fixture Sun must actually move');
});

// ================================================ 1. a known entry and exit
test('a known entry and a known exit: the partition owns only what it proved', () => {
  // The conservative-ownership direction, and it is asserted AS a
  // direction. `excluded` must sit strictly inside the true passage --
  // never reaching the transition, because a stopping rule cannot -- and
  // the two true crossings must fall in boundary spans, because that is
  // where the operation says the residue goes. Equality would be the
  // wrong assertion: it would fail the moment the tolerance was loosened,
  // and it would pass for an implementation that rounded the transition
  // into whichever neighbour was nearer.
  const r = partitionDomain(LINEAR_EPH, {
    body: BODY, fromTdbSec: LINEAR_WIN[0], toTdbSec: LINEAR_WIN[1],
  });
  assert.equal(r.execution.status, 'finished');
  assert.equal(r.unprocessed.length, 0, 'a finished run examined everything');
  assertTilesRequest(r, LINEAR_WIN[0], LINEAR_WIN[1], 'LINEAR');
  assertOwnership(r, LINEAR_BELOW, 'LINEAR');
  assertCrossingsAreOwnedByBoundary(r, [LINEAR_ENTRY, LINEAR_EXIT], 'LINEAR');

  // Non-vacuity, three ways. A run that excluded nothing, admitted
  // nothing, or left no boundary would satisfy the containments above
  // without having answered anything.
  assert.equal(r.excluded.length, 1, `${r.excluded.length} excluded runs for one passage`);
  assert.equal(r.admissible.length, 2, 'the window is admissible either side of the passage');
  assert.equal(r.boundary.length, 2, 'one boundary run per transition');

  // STRICTLY inside, with the margins named. The partition may not claim
  // the transition instants themselves.
  const [exLo, exHi] = r.excluded[0];
  assert.ok(exLo > LINEAR_ENTRY,
    `the excluded span starts at ${exLo}, at or before the true entry ${LINEAR_ENTRY}`);
  assert.ok(exHi < LINEAR_EXIT,
    `the excluded span ends at ${exHi}, at or after the true exit ${LINEAR_EXIT}`);

  // And the residue is bounded rather than unbounded: a partition that
  // reported the whole window as boundary would satisfy every containment
  // above. Section 6 of PARTITION-EVALUATION.md asks for 1 per cent of
  // the request; this is the same quantity at five times that bar, since
  // the figure being pinned here is "the residue is small", not the
  // released threshold.
  const residue = spanTotal(r.boundary) / (LINEAR_WIN[1] - LINEAR_WIN[0]);
  assert.ok(residue < 0.05, `${(residue * 100).toFixed(2)} per cent of the request came back boundary`);

  // The diagnostic that describes the admitted region is a BOUND, and the
  // contract says so. An enclosure's upper bound on the cosine cannot be
  // below a cosine the function actually takes on an admitted span.
  let sampledMaxCos = -Infinity;
  for (const [lo, hi] of r.admissible) {
    for (let t = lo; t <= hi; t += 60) sampledMaxCos = Math.max(sampledMaxCos, cosElongationExact(LINEAR, t));
  }
  assert.ok(r.diagnostics.closestAdmissibleCos >= sampledMaxCos,
    `the reported ${r.diagnostics.closestAdmissibleCos} is below a sampled ${sampledMaxCos}`);
  assert.equal(r.diagnostics.closestAdmissibleCosIsALowerBoundOnElongation, true);
});

// ====================================================== 2. two close passages
test('two passages two boundary tolerances apart stay two', () => {
  // The merge in `coalesce` joins spans that touch. Two passages 80 s
  // apart, with a boundary tolerance of 30 s, are close enough that a
  // merge keyed on anything looser than "these spans actually touch"
  // would swallow the daylight between them and report one conjunction
  // where the geometry has two. That is not a cosmetic difference: the
  // span between them is above the floor, so an event there is inside the
  // supported domain and a merged excluded run would discard it.
  const r = partitionDomain(DOUBLE_EPH, {
    body: BODY, fromTdbSec: DOUBLE_WIN[0], toTdbSec: DOUBLE_WIN[1],
    boundaryToleranceSec: DOUBLE_TOLERANCE,
  });
  assert.equal(r.execution.status, 'finished');
  assertTilesRequest(r, DOUBLE_WIN[0], DOUBLE_WIN[1], 'DOUBLE');
  assertOwnership(r, DOUBLE_BELOW, 'DOUBLE');

  assert.equal(r.excluded.length, 2,
    `${r.excluded.length} excluded runs for two passages: ${JSON.stringify(r.excluded)}`);
  // One excluded run inside each passage, and neither reaching across.
  for (let i = 0; i < 2; i += 1) {
    const [lo, hi] = r.excluded[i];
    assert.ok(lo > DOUBLE_BELOW[i][0] && hi < DOUBLE_BELOW[i][1],
      `excluded run ${i} is ${lo} .. ${hi}, not strictly inside ${JSON.stringify(DOUBLE_BELOW[i])}`);
  }
  // The gap between the two excluded runs must contain the bump, which is
  // the instant the merge would have had to cross.
  const daylight = [r.excluded[0][1], r.excluded[1][0]];
  assert.ok(TAU_SEC > daylight[0] && TAU_SEC < daylight[1],
    `the bump at ${TAU_SEC} s is not between the two excluded runs ${JSON.stringify(daylight)}`);
  assert.ok(elongationDegExact(DOUBLE, TAU_SEC) > 5);
  assertCrossingsAreOwnedByBoundary(
    r, [DOUBLE_BELOW[0][0], DOUBLE_BELOW[0][1], DOUBLE_BELOW[1][0], DOUBLE_BELOW[1][1]], 'DOUBLE',
  );
});

// ============================================================ 3. a tangency
test('a tangency that never crosses excludes nothing, and does not pretend to admit', () => {
  // The elongation falls to 5.05 degrees and turns round, so no instant of
  // this window is outside the supported domain. An excluded span here
  // would be a false proof: the profile would decline a window it in fact
  // covers, and the search running on the partition would never look at it.
  //
  // The other half matters as much. 0.05 degrees is far below what the
  // enclosures resolve over a record, so the turning region cannot be
  // ADMITTED either, and the honest answer is boundary. An implementation
  // that fell back on the nearer neighbour would pass the first assertion
  // and fail this one.
  const r = partitionDomain(TANGENT_EPH, {
    body: BODY, fromTdbSec: TANGENT_WIN[0], toTdbSec: TANGENT_WIN[1],
  });
  assert.equal(r.execution.status, 'finished');
  assertTilesRequest(r, TANGENT_WIN[0], TANGENT_WIN[1], 'TANGENT');
  assert.equal(r.excluded.length, 0,
    `a window that never reaches the floor excluded ${JSON.stringify(r.excluded)}`);
  assert.equal(spanTotal(r.excluded), 0);

  assert.ok(r.boundary.length >= 1, 'the turning region cannot be decided, so it must be reported');
  const owner = r.boundary.find(([lo, hi]) => TAU_SEC >= lo && TAU_SEC <= hi);
  assert.ok(owner, `the closest approach at ${TAU_SEC} s is not in a boundary span`);
  for (const [lo, hi] of r.admissible) {
    assert.ok(TAU_SEC < lo || TAU_SEC > hi,
      'the closest approach must not be admitted: the enclosures cannot resolve 0.05 degrees here');
  }
  // and the case is not vacuous in the other direction either -- the ends
  // of the window, at 25 degrees, must be admitted
  assert.ok(spanTotal(r.admissible) > 0.5 * (TANGENT_WIN[1] - TANGENT_WIN[0]),
    'most of a window this far from the floor should be admissible');
});

// ================================================= 4. wholly in, wholly out
test('a window wholly inside the domain is one admissible span and nothing else', () => {
  // Seven and a half to ten degrees throughout: nothing to exclude, and
  // nothing the enclosures cannot settle. The assertion is deliberately
  // exact -- one span, equal to the request -- because this is the case
  // where "no boundary" is achievable, and a partition that left slivers
  // here would be leaving them everywhere.
  const win = [-14400, -10800];
  for (let t = win[0]; t <= win[1]; t += 60) {
    assert.ok(elongationDegExact(LINEAR, t) > 5,
      `t = ${t} has elongation ${elongationDegExact(LINEAR, t)} deg`);
  }
  const r = partitionDomain(LINEAR_EPH, { body: BODY, fromTdbSec: win[0], toTdbSec: win[1] });
  assert.equal(r.execution.status, 'finished');
  assertTilesRequest(r, win[0], win[1], 'INSIDE');
  assert.deepEqual(r.admissible, [win]);
  assert.deepEqual(r.excluded, []);
  assert.deepEqual(r.boundary, []);
  assert.deepEqual(r.unprocessed, []);
  assert.deepEqual(r.boundaryReasons, []);
});

test('a window wholly below the floor is excluded, and admits nothing', () => {
  // The mirror case, and the one that separates `excluded` from
  // `unprocessed`: there is no transition inside this window, so there is
  // nothing to leave unresolved, and `excluded` is the only reason the
  // request is not covered by admissible spans.
  const win = [-3600, 3600];
  for (let t = win[0]; t <= win[1]; t += 60) {
    assert.ok(elongationDegExact(LINEAR, t) < 5,
      `t = ${t} has elongation ${elongationDegExact(LINEAR, t)} deg`);
  }
  const r = partitionDomain(LINEAR_EPH, { body: BODY, fromTdbSec: win[0], toTdbSec: win[1] });
  assert.equal(r.execution.status, 'finished');
  assertTilesRequest(r, win[0], win[1], 'OUTSIDE');
  assertOwnership(r, LINEAR_BELOW, 'OUTSIDE');
  assert.deepEqual(r.admissible, [], 'no instant of this window is inside the domain');
  assert.deepEqual(r.unprocessed, []);
  assert.ok(spanTotal(r.excluded) >= 0.99 * (win[1] - win[0]),
    `excluded covers ${spanTotal(r.excluded)} s of a ${win[1] - win[0]} s window`);
  assert.equal(r.diagnostics.closestAdmissibleCos, null,
    'nothing was admitted, so there is no admitted-region bound to report');
});

// ============================================ 5. a transition at the edge
test('a request that begins at the floor, and one that ends at it', () => {
  // The transition at the very boundary of the request, where an
  // off-by-one in the seed construction or the endpoint convention would
  // show. Coverage still has to be exact, and ownership still has to point
  // the same way: the request edge is the true crossing, so nothing either
  // side of it may be claimed as proved.
  const cases = [
    ['BEGINS-AT-FLOOR', LINEAR_ENTRY, LINEAR_ENTRY + HALF_PASSAGE_SEC, LINEAR_ENTRY],
    ['ENDS-AT-FLOOR', LINEAR_EXIT - HALF_PASSAGE_SEC, LINEAR_EXIT, LINEAR_EXIT],
  ];
  for (const [note, from, to, edge] of cases) {
    assert.ok(Math.abs(elongationDegExact(LINEAR, edge) - 5) < 1e-9,
      `${note}: the request edge ${edge} is not a floor crossing`);
    const r = partitionDomain(LINEAR_EPH, { body: BODY, fromTdbSec: from, toTdbSec: to });
    assert.equal(r.execution.status, 'finished', note);
    assertTilesRequest(r, from, to, note);
    assertOwnership(r, LINEAR_BELOW, note);
    // The crossing sits on the request edge, so the span that owns it must
    // be a boundary span that reaches that edge.
    const owner = r.boundary.find(([lo, hi]) => edge >= lo - 1e-9 && edge <= hi + 1e-9);
    assert.ok(owner, `${note}: the edge crossing at ${edge} is in no boundary span`);
    assert.ok(owner[0] === from || owner[1] === to,
      `${note}: the boundary span ${JSON.stringify(owner)} does not reach the request edge`);
    // The interior is below the floor and must be excluded, not admitted.
    assert.deepEqual(r.admissible, [], `${note}: nothing inside this window is above the floor`);
    assert.ok(spanTotal(r.excluded) > 0.9 * (to - from), note);
  }
});

// ========================================= 6. coverage, disjointness, order
test('the four classes tile the request, on every finished geometry in this file', () => {
  // `assertTilesRequest` runs inside every case above and below. This one
  // exists so the check has a name of its own and a case that would show
  // it failing on its own: it runs the same invariant across every
  // fixture, including the ones whose cases are about something else, and
  // at three boundary tolerances so the cell lattice is different each
  // time.
  const runs = [
    ['LINEAR', LINEAR_EPH, LINEAR_WIN],
    ['DOUBLE', DOUBLE_EPH, DOUBLE_WIN],
    ['TANGENT', TANGENT_EPH, TANGENT_WIN],
    ['DRIFTING_SUN', DRIFTING_SUN_EPH, DRIFTING_SUN_WIN],
    ['CONJUNCTION', CONJUNCTION_EPH, CONJUNCTION_WIN],
  ];
  let checked = 0;
  for (const [note, eph, win] of runs) {
    for (const tol of [15, 60, 600]) {
      const r = partitionDomain(eph, {
        body: BODY, fromTdbSec: win[0], toTdbSec: win[1], boundaryToleranceSec: tol,
      });
      assert.equal(r.execution.status, 'finished', `${note} at ${tol} s`);
      assertTilesRequest(r, win[0], win[1], `${note} at ${tol} s`);
      checked += 1;
    }
  }
  assert.equal(checked, 15, 'the sweep must actually have run');
});

// ============================================ 7. the two conservative bounds
test('the two conservative bounds point in opposite directions and are not interchangeable', () => {
  // Admitting a cell asks "is the elongation at least five degrees at
  // every instant?" and errs safely with a cosine that may be too SMALL.
  // Excluding one asks the opposite and needs a cosine that may be too
  // LARGE. The two constants bracket the true cosine, in that order.
  assert.ok(COS_MIN_ELONGATION_GUARD < COS_MIN_ELONGATION_EXCLUDE,
    `the guard ${COS_MIN_ELONGATION_GUARD} is not below the exclusion bound ${COS_MIN_ELONGATION_EXCLUDE}`);
  assert.ok(COS_MIN_ELONGATION_GUARD < COS_FLOOR && COS_FLOOR <= COS_MIN_ELONGATION_EXCLUDE,
    'the pair must bracket the true cosine of the floor, or one of them is on the wrong side');

  // No enclosure can be admitted AND excluded. This is not a coincidence
  // of the current values: `hi <= GUARD` and `lo > EXCLUDE` together give
  // `lo > EXCLUDE > GUARD >= hi`, which no interval with `lo <= hi`
  // satisfies. Checked across the whole range including the two bounds
  // themselves and the sliver between them.
  const probes = [
    { lo: -1, hi: -1 }, { lo: -1, hi: 1 }, { lo: 0.5, hi: 0.6 },
    { lo: COS_MIN_ELONGATION_GUARD, hi: COS_MIN_ELONGATION_GUARD },
    { lo: COS_FLOOR, hi: COS_FLOOR },
    { lo: COS_MIN_ELONGATION_EXCLUDE, hi: COS_MIN_ELONGATION_EXCLUDE },
    { lo: COS_MIN_ELONGATION_GUARD, hi: COS_MIN_ELONGATION_EXCLUDE },
    { lo: 0.999999, hi: 1 },
  ];
  for (const c of probes) {
    const verdict = classifyElongationCos(c);
    assert.ok(['admissible', 'excluded', 'boundary'].includes(verdict), verdict);
    const admits = c.hi <= COS_MIN_ELONGATION_GUARD;
    const excludes = c.lo > COS_MIN_ELONGATION_EXCLUDE;
    assert.ok(!(admits && excludes),
      `${JSON.stringify(c)} satisfies both the admit and the exclude test`);
    assert.equal(verdict, admits ? 'admissible' : (excludes ? 'excluded' : 'boundary'));
  }

  // And the pair is not interchangeable. A classifier with the constants
  // swapped -- the exclusion bound guarding admission and the guard
  // deciding exclusion -- is written out here rather than described, and
  // put to the one interval that separates them: an elongation exactly at
  // the floor.
  const swapped = (c) => {
    if (c.hi <= COS_MIN_ELONGATION_EXCLUDE) return 'admissible';
    if (c.lo > COS_MIN_ELONGATION_GUARD) return 'excluded';
    return 'boundary';
  };
  const atTheFloor = { lo: COS_FLOOR, hi: COS_FLOOR };
  assert.equal(classifyElongationCos(atTheFloor), 'boundary',
    'a cell sitting exactly on the floor is not proved either way');
  assert.equal(swapped(atTheFloor), 'admissible',
    'with the constants swapped the same cell would be ADMITTED, which is the defect the pair exists to prevent');
  assert.notEqual(classifyElongationCos(atTheFloor), swapped(atTheFloor));

  // Worse than a different verdict: swapped, the two tests OVERLAP, so an
  // interval between the bounds satisfies both and the answer depends on
  // which `if` is written first rather than on the geometry.
  const swappedAdmits = atTheFloor.hi <= COS_MIN_ELONGATION_EXCLUDE;
  const swappedExcludes = atTheFloor.lo > COS_MIN_ELONGATION_GUARD;
  assert.ok(swappedAdmits && swappedExcludes,
    'the point of the ordering is that swapping it makes the two tests satisfiable together');

  // The profile the partition reports is the profile these bounds are for.
  assert.equal(DEFLECTION_PROFILE.minElongationDeg, MIN_ELONGATION_RAD / DEG);
  assert.equal(PARTITION_CONTRACT.profile, DEFLECTION_PROFILE.id);
});

// ======================================================= 8. degenerate geometry
test('a geometry that cannot be decided comes back boundary with a reason, not excluded', () => {
  // Two degeneracies that are NOT domain verdicts, and the distinction is
  // the whole point: an undecidable geometry reported as excluded would be
  // a proof the run never made, and a thrown error would discard every
  // cell already decided. `boundaryToleranceSec` is the width of the
  // window so the refusal is reported at once rather than bisected 2^k
  // times into identical slivers.
  const cases = [
    [
      'the target sitting on the observer',
      G.packOf(LINEAR.observer, LINEAR.observer, { intervalSec: 3600, initEt: -7200, nrec: 6 }),
      /cannot be shown to be separated/,
    ],
    [
      'an observer that cannot be bounded away from the Sun',
      G.packOf(LINEAR.target, () => [0, 0, 0], { intervalSec: 3600, initEt: -7200, nrec: 6 }),
      /bounded away from the centre of the Sun/,
    ],
  ];
  for (const [note, eph, why] of cases) {
    let r;
    assert.doesNotThrow(() => {
      r = partitionDomain(eph, {
        body: BODY, fromTdbSec: 0, toTdbSec: 3600, boundaryToleranceSec: 3600,
      });
    }, `${note}: a geometry it cannot decide is an answer, not an exception`);
    assert.equal(r.execution.status, 'finished', note);
    assertTilesRequest(r, 0, 3600, note);
    assert.deepEqual(r.excluded, [], `${note}: an undecidable geometry is NOT outside the domain`);
    assert.deepEqual(r.admissible, [], `${note}: nor is it inside it`);
    assert.deepEqual(r.boundary, [[0, 3600]], note);
    assert.equal(r.boundaryReasons.length, 1, note);
    assert.match(r.boundaryReasons[0].why, why, note);
    assert.equal(r.boundaryReasons[0].fromTdbSec, 0);
    assert.equal(r.boundaryReasons[0].toTdbSec, 3600);
  }
});

// ========================================================= 9. missing coverage
test('a window the records do not cover is an answer, not an exception', () => {
  // The header of `domain-partition.mjs` lists "a window the records do
  // not cover" among the things that come back indeterminate, and
  // `classifyCell` catches `out-of-coverage` to make it so. That holds
  // along the path where the light-time iteration notices first: the
  // target's records stop before the observer's, `solveTau` walks off the
  // end, and the seed is reported as boundary with the records named.
  const shortTarget = G.packOf(LINEAR.target, LINEAR.observer, {
    intervalSec: 3600, initEt: -7200, nrec: 16, targetRecords: 4,
  });
  const win = [3 * 3600, 6 * 3600];
  let r;
  assert.doesNotThrow(() => {
    r = partitionDomain(shortTarget, {
      body: BODY, fromTdbSec: win[0], toTdbSec: win[1], boundaryToleranceSec: 3600,
    });
  }, 'a window past the target records must be reported, not raised');
  assert.equal(r.execution.status, 'finished');
  assertTilesRequest(r, win[0], win[1], 'SHORT-TARGET');
  assert.deepEqual(r.excluded, [],
    'outside coverage is not outside the DOMAIN; the two must never be conflated');
  assert.deepEqual(r.admissible, []);
  assert.equal(spanTotal(r.boundary), win[1] - win[0]);
  assert.ok(r.boundaryReasons.length > 0);
  assert.match(r.boundaryReasons[0].why, /stored records|do not cover/);

  // THE SIBLING SHAPE, WHICH USED TO BE A DEFECT.
  //
  // When it is the OBSERVER's records that fall short, the first
  // `stateEnclosure` in `deriveLightTime` raises `out-of-coverage`. That
  // call used to sit in a try/finally with no catch, while
  // `partitionDomain`'s own handler takes only `budget-exhausted` and
  // `cancelled` -- so the window escaped as an exception and discarded
  // every seed already decided, while the mirror-image window above came
  // back as a boundary span with a reason. One gap, reported two ways.
  //
  // `deriveLightTime` now converts it the same way, so BOTH shapes are
  // answers. The window is boundary, the reason names the records, and
  // nothing is excluded: outside coverage is not outside the domain.
  const shortAll = G.packOf(LINEAR.target, LINEAR.observer, {
    intervalSec: 3600, initEt: -7200, nrec: 6,
  });
  const far = [1e9, 1e9 + 3600];
  let q;
  assert.doesNotThrow(() => {
    q = partitionDomain(shortAll, {
      body: BODY, fromTdbSec: far[0], toTdbSec: far[1], boundaryToleranceSec: 3600,
    });
  }, 'a window past the OBSERVER records must be reported, not raised');
  assert.equal(q.execution.status, 'finished');
  assertTilesRequest(q, far[0], far[1], 'SHORT-OBSERVER');
  assert.deepEqual(q.excluded, [],
    'outside coverage is not outside the DOMAIN; the two must never be conflated');
  assert.deepEqual(q.admissible, []);
  assert.equal(spanTotal(q.boundary), far[1] - far[0]);
  assert.ok(q.boundaryReasons.length > 0);
  assert.match(q.boundaryReasons[0].why, /do not cover|outside/);
});

/**
 * A request wholly outside the records is answered ONCE, not bisected.
 *
 * `deriveLightTime` reports out-of-coverage as retryable, which is right
 * where a window partly overlaps the records -- narrowing finds the
 * covered part. Where nothing is covered the retry is unconditional, and
 * the bisection used to run to the boundary tolerance and spend the whole
 * cell budget having evaluated nothing, because the enclosures throw
 * before they reach `spend`. The answer was conservative either way; what
 * was wrong was the cost, and a status that said `budget-exhausted` where
 * the honest word is "not covered".
 */
test('a request wholly outside the records costs nothing and says which it is', () => {
  const pack = G.packOf(LINEAR.target, LINEAR.observer, {
    intervalSec: 3600, initEt: 0, nrec: 4,
  });
  const far = [1e12, 2e12];
  const r = partitionDomain(pack, { body: BODY, fromTdbSec: far[0], toTdbSec: far[1] });

  assert.equal(r.execution.status, 'finished',
    'a request this operation can answer is finished, even when the answer is "not here"');
  assert.equal(r.execution.cells, 0, 'nothing is worth subdividing when nothing is covered');
  assert.equal(r.execution.evaluations, 0);
  assert.equal(r.diagnostics.whollyOutsideCoverage, true);
  assert.deepEqual(r.diagnostics.coverageTdbSec, [0, 4 * 3600]);

  // BOUNDARY, never excluded: outside the records is outside what this
  // pack can answer, which is not the same as outside the domain.
  assert.deepEqual(r.excluded, []);
  assert.deepEqual(r.admissible, []);
  assert.deepEqual(r.boundary, [far]);
  assert.equal(r.boundaryReasons.length, 1);
  assert.match(r.boundaryReasons[0].why, /wholly outside the stored records/);
  assertTilesRequest(r, far[0], far[1], 'WHOLLY-UNCOVERED');

  /**
   * And the shortcut must not swallow a window that PARTLY overlaps: that
   * one still has something to find, and finding it is the retry's job.
   */
  const straddling = partitionDomain(pack, { body: BODY, fromTdbSec: 2 * 3600, toTdbSec: 6 * 3600 });
  assert.notEqual(straddling.diagnostics.whollyOutsideCoverage, true);
  assert.ok(straddling.execution.cells > 0,
    'a window overlapping coverage must still be subdivided');
  assertTilesRequest(straddling, 2 * 3600, 6 * 3600, 'STRADDLING');

  // Touching the edge from outside is outside.
  const abutting = partitionDomain(pack, { body: BODY, fromTdbSec: 4 * 3600, toTdbSec: 8 * 3600 });
  assert.equal(abutting.diagnostics.whollyOutsideCoverage, true);
  assert.equal(abutting.execution.cells, 0);
});

// ============================================================ 10. no Sun
test('a pack with no Sun is refused once, before any cell', () => {
  // The elongation needs the Sun at reception, so a pack without one
  // cannot be partitioned at all. `partitionDomain` resolves the Sun's
  // weights before the seed loop opens, which is what makes the refusal
  // cost one error rather than one per subdivision -- and nothing could
  // check that while `packOf` always emitted a Sun. `omitSun` exists so it
  // can, and the instrumentation sink counts what the refusal cost.
  const noSun = G.packOf(LINEAR.target, LINEAR.observer, {
    intervalSec: 3600, initEt: -12 * 3600, nrec: 24, omitSun: true,
  });
  let cellsCharged = 0;
  let evaluationsCharged = 0;
  const previous = setInstrumentSink({
    mark: (phase, what, amount) => {
      if (what === 'cells') cellsCharged += amount;
      if (what === 'evaluations') evaluationsCharged += amount;
    },
  });
  try {
    assert.throws(
      () => partitionDomain(noSun, {
        body: BODY, fromTdbSec: LINEAR_WIN[0], toTdbSec: LINEAR_WIN[1],
      }),
      (e) => e.code === 'unknown-body' && /sun/i.test(e.message),
      'a pack with no Sun must refuse the partition',
    );
    assert.equal(cellsCharged, 0,
      `the refusal opened ${cellsCharged} cells; it must arrive before the seed loop`);
    assert.equal(evaluationsCharged, 0,
      `the refusal spent ${evaluationsCharged} evaluations before giving up`);
  } finally {
    setInstrumentSink(previous);
  }
  // The control: the SAME pack with a Sun partitions the same window into
  // many cells, so the zero above is about the refusal and not about a
  // window that would have been cheap anyway.
  const withSun = partitionDomain(LINEAR_EPH, {
    body: BODY, fromTdbSec: LINEAR_WIN[0], toTdbSec: LINEAR_WIN[1],
  });
  assert.ok(withSun.execution.cells > 10, `${withSun.execution.cells} cells in the control`);
  assert.ok(withSun.execution.evaluations > 10);
});

// ======================================================== 11. cancellation
test('a cancelled run reports what it never examined, and does not call it excluded', () => {
  // `unprocessed` is the class that exists so a run can say "I did not
  // look" without saying "there is nothing there". Folding it into
  // `excluded` would turn a budget failure into a claim about the
  // geometry, which is the one confusion the four classes are for.
  const full = partitionDomain(LINEAR_EPH, {
    body: BODY, fromTdbSec: LINEAR_WIN[0], toTdbSec: LINEAR_WIN[1],
  });
  assert.equal(full.execution.status, 'finished');

  let sawWork = 0;
  for (const after of [1, 60, 120, 300, 500]) {
    const note = `cancelled after ${after}`;
    const r = partitionDomain(LINEAR_EPH, {
      body: BODY, fromTdbSec: LINEAR_WIN[0], toTdbSec: LINEAR_WIN[1], signal: abortAfter(after),
    });
    assert.equal(r.execution.status, 'cancelled', note);
    assert.equal(r.execution.finished, false, note);
    assert.match(r.execution.reason, /cancel/i, note);
    assert.ok(r.unprocessed.length > 0, `${note}: a cancelled run left nothing unprocessed`);

    // Whatever it DID decide is still sound: an aborted run may prove
    // less, never something different. Checked against the geometry, not
    // against the complete run, so a cancellation that corrupted a verdict
    // could not hide behind a matching mistake in the full partition.
    assertOwnership(r, LINEAR_BELOW, note);

    // And the region it never examined is not claimed by any verdict.
    for (const [name, list] of CLASSES(r)) {
      if (name === 'unprocessed') continue;
      assert.equal(overlapTotal([...list], r.unprocessed), 0,
        `${note}: ${name} overlaps the unprocessed region`);
    }
    assert.equal(overlapTotal(r.excluded, r.unprocessed), 0,
      `${note}: unprocessed time was reported as excluded`);

    // Coverage stays EXACT through a cancellation, which is the part that
    // is easy to get wrong: the loop pops a cell off the stack before it
    // works on it, so at the instant `spend` raises `cancelled` that cell
    // is on neither the stack -- which becomes `unprocessed` -- nor in any
    // verdict list. It has to be put back, or the four classes tile the
    // request minus one cell and a caller adding up the spans is quietly
    // short. `assertTilesRequest` is the same check every finished case
    // runs; a cancelled run gets no weaker version of it.
    assertTilesRequest(r, LINEAR_WIN[0], LINEAR_WIN[1], note);
    if (spanTotal(r.admissible) + spanTotal(r.excluded) > 0) sawWork += 1;
  }
  assert.ok(sawWork > 0,
    'every cancellation stopped before deciding anything, so the soundness checks above were vacuous');

  // Budget exhaustion is the same answer by a different route, and must
  // be reported the same way rather than as a finished partition.
  const broke = partitionDomain(LINEAR_EPH, {
    body: BODY, fromTdbSec: LINEAR_WIN[0], toTdbSec: LINEAR_WIN[1], maxCells: 5,
  });
  assert.equal(broke.execution.status, 'budget-exhausted');
  assert.equal(broke.execution.finished, false);
  assert.ok(broke.unprocessed.length > 0);
  assertTilesRequest(broke, LINEAR_WIN[0], LINEAR_WIN[1], 'budget-exhausted');
  assertOwnership(broke, LINEAR_BELOW, 'budget-exhausted');
  assert.equal(overlapTotal(broke.excluded, broke.unprocessed), 0);
  // A budget failure is about the RUN, not about the geometry: nothing it
  // did not reach may be described as outside the domain.
  assert.ok(spanTotal(broke.unprocessed) > 0.5 * (LINEAR_WIN[1] - LINEAR_WIN[0]),
    'a five-cell budget should leave most of the window unexamined');
});

// ========================================= 12. whole against adjacent halves
test('a partition of two halves against a partition of the whole', () => {
  // Splitting a request in two changes the CELL LATTICE, not the geometry.
  // Where the seam lands on a record boundary the seeds are identical and
  // so is every verdict; where it lands inside a record it splits exactly
  // one seed, and only cells descended from that seed can come out
  // differently. Both halves are sound whatever the seam does, so the
  // relations worth asserting are these and not equality:
  //
  //  (a) at a record boundary: the two halves' spans, joined at the seam,
  //      ARE the whole's -- exactly.
  //  (b) anywhere else: no contradiction. A half may upgrade something the
  //      whole left as boundary, because its cells are narrower and its
  //      enclosures tighter, but it may never admit what the whole
  //      excluded or exclude what the whole admitted. Those are proofs,
  //      and two proofs of opposite facts about one instant cannot both be
  //      sound.
  //  (c) anywhere else: anything the whole proved and the halves did not
  //      lies inside the record the seam fell in. Every other seed is
  //      shared between the runs and a shared seed cannot answer
  //      differently.
  //
  // Equality would be the wrong relation for (b): it would fail on any
  // seam that tightens an enclosure, which is most of them, and it would
  // be asserting that a stopping rule is insensitive to where it stops.
  const spec = { body: BODY, fromTdbSec: CONJUNCTION_WIN[0], toTdbSec: CONJUNCTION_WIN[1] };
  const whole = partitionDomain(CONJUNCTION_EPH, spec);
  const truth = belowFloorSpans(CONJUNCTION, CONJUNCTION_WIN[0], CONJUNCTION_WIN[1], 8000);
  assertOwnership(whole, truth.spans, 'CONJUNCTION whole');

  // (a) seams on record boundaries: exact agreement, span for span.
  for (const mDays of [-40, -18, 0, 5, 40]) {
    const m = mDays * D;
    const note = `record-boundary seam at ${mDays} d`;
    const A = partitionDomain(CONJUNCTION_EPH, { ...spec, toTdbSec: m });
    const B = partitionDomain(CONJUNCTION_EPH, { ...spec, fromTdbSec: m });
    assertTilesRequest(A, CONJUNCTION_WIN[0], m, `${note} (left)`);
    assertTilesRequest(B, m, CONJUNCTION_WIN[1], `${note} (right)`);
    for (const key of ['admissible', 'excluded', 'boundary']) {
      assert.deepEqual(coalesceSpans([...A[key], ...B[key]]), coalesceSpans(whole[key]),
        `${note}: ${key} differs, but the seeds either side of a record boundary are identical`);
    }
  }

  // (b) and (c) on a seam inside a record, placed at the exit crossing --
  // the worst case, where both halves must give up on the transition they
  // now share an endpoint with.
  const m = 17.93 * D;
  assert.ok(Math.abs(m / D - Math.round(m / D)) > 0.01, 'the seam must be inside a record, not on one');
  const A = partitionDomain(CONJUNCTION_EPH, { ...spec, toTdbSec: m });
  const B = partitionDomain(CONJUNCTION_EPH, { ...spec, fromTdbSec: m });
  assertTilesRequest(A, CONJUNCTION_WIN[0], m, 'interior seam (left)');
  assertTilesRequest(B, m, CONJUNCTION_WIN[1], 'interior seam (right)');
  assertOwnership(A, truth.spans, 'interior seam (left)');
  assertOwnership(B, truth.spans, 'interior seam (right)');

  const admHalves = coalesceSpans([...A.admissible, ...B.admissible]);
  const excHalves = coalesceSpans([...A.excluded, ...B.excluded]);
  // (b) no contradictions, either way round.
  assert.equal(overlapTotal(admHalves, whole.excluded), 0,
    'a half admitted time the whole proved to be outside the domain');
  assert.equal(overlapTotal(excHalves, whole.admissible), 0,
    'a half excluded time the whole proved to be inside the domain');
  // Equivalently: everything the halves claim, the whole either claimed
  // the same way or left as residue.
  assert.equal(overlapTotal(admHalves, whole.boundary) + overlapTotal(admHalves, whole.admissible),
    spanTotal(admHalves),
    'the halves admitted time the whole neither admitted nor left open');

  // (c) what the halves failed to recover is confined to the split record.
  const lost = [
    ...subtractSpans(whole.admissible, admHalves),
    ...subtractSpans(whole.excluded, excHalves),
  ];
  for (const [lo, hi] of lost) {
    assert.ok(Math.max(Math.abs(lo - m), Math.abs(hi - m)) <= D + 1e-6,
      `the halves lost ${lo} .. ${hi}, which is more than one record from the seam at ${m}`);
  }
  // Non-vacuity: this seam really does change something, so (b) and (c)
  // are not being satisfied by two identical runs.
  const gained = [
    ...subtractSpans(admHalves, whole.admissible),
    ...subtractSpans(excHalves, whole.excluded),
  ];
  assert.ok(lost.length + gained.length > 0,
    'the interior seam changed nothing at all, so this case checked two copies of one run');
});

// ==================================================== 13. tolerance monotonicity
test('a tighter boundary tolerance only ever proves more', () => {
  // `boundaryToleranceSec` governs one thing: whether an undecided cell is
  // bisected again or given up on. It is consulted AFTER the verdict, so
  // the cell tree of a tighter run contains the cell tree of a looser one
  // -- every cell the looser run admitted or excluded is reached and
  // decided the same way, and the tighter run additionally descends into
  // what the looser one abandoned.
  //
  // So the relation is containment, in this direction: admissible(tight)
  // covers admissible(loose) and excluded(tight) covers excluded(loose).
  // A violation would mean tightening the stopping rule had INVENTED
  // admissibility somewhere the looser run had already proved otherwise,
  // or lost a proof it had already made -- and the second of those is the
  // one a caching layer would silently rely on.
  const cases = [
    ['LINEAR', LINEAR_EPH, LINEAR_WIN, LINEAR_BELOW],
    ['DOUBLE', DOUBLE_EPH, DOUBLE_WIN, DOUBLE_BELOW],
    ['CONJUNCTION', CONJUNCTION_EPH, CONJUNCTION_WIN, null],
  ];
  for (const [note, eph, win, below] of cases) {
    const truth = below
      ?? belowFloorSpans(eph === CONJUNCTION_EPH ? CONJUNCTION : LINEAR, win[0], win[1], 8000).spans;
    const tolerances = [3600, 600, 60, 15];
    const runs = tolerances.map((tol) => partitionDomain(eph, {
      body: BODY, fromTdbSec: win[0], toTdbSec: win[1], boundaryToleranceSec: tol,
    }));
    for (let i = 0; i < runs.length; i += 1) {
      assert.equal(runs[i].execution.status, 'finished', `${note} at ${tolerances[i]} s`);
      assertTilesRequest(runs[i], win[0], win[1], `${note} at ${tolerances[i]} s`);
      assertOwnership(runs[i], truth, `${note} at ${tolerances[i]} s`);
    }
    for (let i = 1; i < runs.length; i += 1) {
      const loose = runs[i - 1];
      const tight = runs[i];
      const lostAdmissible = subtractSpans(loose.admissible, tight.admissible);
      const lostExcluded = subtractSpans(loose.excluded, tight.excluded);
      assert.deepEqual(lostAdmissible, [],
        `${note}: tightening from ${tolerances[i - 1]} s to ${tolerances[i]} s gave up admissibility`
        + ` over ${JSON.stringify(lostAdmissible)} that the looser run had proved`);
      assert.deepEqual(lostExcluded, [],
        `${note}: tightening from ${tolerances[i - 1]} s to ${tolerances[i]} s gave up an exclusion`
        + ` over ${JSON.stringify(lostExcluded)}`);
      // The residue shrinks, which is the whole reason to tighten.
      assert.ok(spanTotal(tight.boundary) <= spanTotal(loose.boundary) + 1e-9,
        `${note}: the boundary total grew from ${spanTotal(loose.boundary)} to ${spanTotal(tight.boundary)}`);
    }
    // Non-vacuity: the tolerance must actually be doing something on this
    // fixture, or the containments above hold between identical runs.
    assert.ok(spanTotal(runs[runs.length - 1].boundary) < spanTotal(runs[0].boundary),
      `${note}: the tolerance changed nothing, so the monotonicity is vacuous here`);
  }
});

// ====================================================== 14. repeat stability
test('the same request twice is the same answer, span for span', () => {
  // Determinism is what makes a partition cacheable at all: a key that
  // identifies a computation whose result moves between runs identifies
  // nothing. Asserted as exact equality of doubles, not as agreement to a
  // tolerance -- there is no arithmetic here that could legitimately
  // differ between two calls on one pack.
  const spec = {
    body: BODY, fromTdbSec: CONJUNCTION_WIN[0], toTdbSec: CONJUNCTION_WIN[1],
    boundaryToleranceSec: 120, packDigest: 'sha256-fixture',
  };
  const first = partitionDomain(CONJUNCTION_EPH, spec);
  const second = partitionDomain(CONJUNCTION_EPH, spec);
  assert.deepEqual(second.admissible, first.admissible);
  assert.deepEqual(second.excluded, first.excluded);
  assert.deepEqual(second.boundary, first.boundary);
  assert.deepEqual(second.unprocessed, first.unprocessed);
  assert.deepEqual(second.boundaryReasons, first.boundaryReasons);
  assert.equal(second.key, first.key);
  assert.equal(second.execution.evaluations, first.execution.evaluations);
  assert.equal(second.execution.cells, first.execution.cells);
  assert.deepEqual(second.diagnostics, first.diagnostics);
  assert.ok(first.admissible.length > 0 && first.excluded.length > 0,
    'a stability case over an empty answer establishes nothing');
});

// ============================================================== 15. the key
test('the key changes when the question changes', () => {
  // The identity a cached partition must match before it may be reused.
  // Each field is varied ALONE, because a key that happened to change
  // whenever two things changed together would pass a joint test and
  // still allow a reuse across a single difference that matters.
  const base = {
    packDigest: 'sha256-aaaa',
    packStructure: 'structure-aaaa',
    observer: 'geocentre',
    body: BODY,
    fromTdbSec: -1000,
    toTdbSec: 1000,
    boundaryToleranceSec: 60,
    relightWidthRatio: PARTITION_DEFAULTS.relightWidthRatio,
    maxTauWidenings: PARTITION_DEFAULTS.maxTauWidenings,
    tauPadFloorSec: PARTITION_DEFAULTS.tauPadFloorSec,
    profile: DEFLECTION_PROFILE.id,
  };
  const reference = partitionKey(base);
  assert.equal(partitionKey({ ...base }), reference, 'the key must be a function of its inputs alone');

  const variations = {
    packDigest: 'sha256-bbbb',
    body: 'Jupiter',
    fromTdbSec: -1001,
    toTdbSec: 1001,
    boundaryToleranceSec: 61,
    profile: 'zodiacs-deflected-of-date/2',
  };
  for (const [field, value] of Object.entries(variations)) {
    assert.notEqual(partitionKey({ ...base, [field]: value }), reference,
      `two partitions differing only in ${field} share a key, so one could be reused for the other`);
  }
  // A missing digest must not silently equal a present one.
  assert.notEqual(partitionKey({ ...base, packDigest: null }), reference);
  assert.notEqual(partitionKey({ ...base, packDigest: undefined }), reference);
  // An omitted profile falls back to the current one rather than to
  // nothing, so a caller who leaves it out gets today's identity.
  assert.equal(partitionKey({ ...base, profile: undefined }),
    partitionKey({ ...base, profile: DEFLECTION_PROFILE.id }));

  // End to end, where it is the operation rather than the helper that has
  // to carry the identity: the same request answered against two packs of
  // DIFFERENT record structure is a different proof, and must not be
  // reusable under one key. This is the check that survives the identity
  // growing new fields.
  const coarse = G.packOf(CONJUNCTION.target, CONJUNCTION.observer, { nrec: 142, initEt: -71 * D });
  const fine = G.packOf(CONJUNCTION.target, CONJUNCTION.observer, {
    nrec: 284, initEt: -71 * D, intervalSec: D / 2,
  });
  const spec = { body: BODY, fromTdbSec: -2 * D, toTdbSec: 2 * D };
  const onCoarse = partitionDomain(coarse, spec);
  const onFine = partitionDomain(fine, spec);
  assert.notEqual(onCoarse.key, onFine.key, 'two packs of different structure share a partition key');
  assert.equal(onCoarse.contract, 'zodiacs-domain-partition/2');
  assert.ok(onCoarse.key.startsWith(`zodiacs-domain-partition/2|${NUMERICS_FINGERPRINT}|`),
    `the key must name the contract and the numerical policy it belongs to: ${onCoarse.key}`);
  assert.equal(onCoarse.request.identity.numerics, NUMERICS_FINGERPRINT);
  // The window, the body and the tolerance, through the operation.
  // `Moon` rather than a body this synthetic pack has no series for: the
  // point is a key that separates two answerable requests, and an
  // unanswerable one would be refused before a key existed.
  const vary = [
    { fromTdbSec: -3 * D }, { toTdbSec: 3 * D }, { body: 'Moon' },
    { boundaryToleranceSec: 30 }, { packDigest: 'sha256-cccc' },
    { relightWidthRatio: PARTITION_DEFAULTS.relightWidthRatio * 2 },
  ];
  for (const change of vary) {
    const changed = partitionDomain(coarse, { ...spec, ...change });
    assert.notEqual(changed.key, onCoarse.key,
      `changing ${Object.keys(change)[0]} left the key alone`);
  }
});

// ================================== the deflector as target: the one exception
test('the numerical policy is in the key, so a plan from another policy does not pass for this one', () => {
  // Audit finding alpha-search-partition-5: constants that move spans were
  // not in the key, so a plan built under another choice of them passed the
  // key check. The policy is one frozen object, its fingerprint is a key
  // component, and changing any field changes the fingerprint.
  assert.ok(Object.isFrozen(NUMERICS_POLICY));
  assert.equal(NUMERICS_POLICY.contract, 'zodiacs-domain-partition/2');
  const base = {
    packDigest: 'sha256-aaaa', packStructure: 'structure-aaaa', observer: 'geocentre', body: BODY,
    fromTdbSec: -1000, toTdbSec: 1000, boundaryToleranceSec: 60,
    relightWidthRatio: PARTITION_DEFAULTS.relightWidthRatio, maxTauWidenings: PARTITION_DEFAULTS.maxTauWidenings,
    tauPadFloorSec: PARTITION_DEFAULTS.tauPadFloorSec, profile: DEFLECTION_PROFILE.id,
  };
  assert.equal(partitionKey(base).split('|')[1], NUMERICS_FINGERPRINT);
  assert.match(NUMERICS_FINGERPRINT, /^[0-9a-f]{16}$/);
});

test('the deflector as target is admitted whole, and only by that rule', () => {
  // A body does not bend its own light, so the profile applies no
  // deflection to the Sun and the elongation floor that restricts every
  // other body restricts nothing here. Without the exception the partition
  // computes the elongation of the Sun from the Sun, gets the +1 the
  // geometry demands, and reports the entire request as EXCLUDED -- a
  // window the search in fact answers over, declared one it declines.
  //
  // The cheapness is part of the contract, not a side effect: the answer
  // is reached before any seed, so it costs nothing at all.
  assert.deepEqual(DEFLECTION_PROFILE.deflectors, ['Sun'],
    'this case is about the profile\'s deflector list; if it grew, it needs more cases');
  const win = [-14400, 14400];
  const r = partitionDomain(LINEAR_EPH, { body: 'Sun', fromTdbSec: win[0], toTdbSec: win[1] });
  assert.equal(r.execution.status, 'finished');
  assertTilesRequest(r, win[0], win[1], 'SUN');
  assert.deepEqual(r.admissible, [win], 'the whole request is inside the supported domain');
  assert.deepEqual(r.excluded, []);
  assert.deepEqual(r.boundary, []);
  assert.deepEqual(r.unprocessed, []);
  assert.deepEqual(r.boundaryReasons, []);
  assert.equal(r.execution.evaluations, 0, 'the exception is reached before any enclosure is built');
  assert.equal(r.execution.cells, 0, 'the exception is reached before any cell is opened');
  assert.equal(r.diagnostics.deflectorIsTarget, true);
  assert.match(r.diagnostics.deflectorIsTargetWhy, /no deflection is applied to it/);
  // It still carries an identity, so a Sun partition is cached as one
  // answer among others rather than as an unkeyed special case.
  assert.equal(r.contract, 'zodiacs-domain-partition/2');
  assert.ok(r.key.includes('|Sun|'), `the key must name the body: ${r.key}`);

  // NOT REACHABLE BY ACCIDENT. Every other body on the same pack and the
  // same window goes through the ordinary path, says so, and here reaches
  // a verdict the exception would have overwritten.
  const mars = partitionDomain(LINEAR_EPH, { body: BODY, fromTdbSec: win[0], toTdbSec: win[1] });
  assert.equal(mars.diagnostics.deflectorIsTarget, false);
  assert.equal(mars.diagnostics.deflectorIsTargetWhy, null);
  assert.ok(mars.execution.cells > 0, 'the ordinary path must actually open cells');
  assert.ok(mars.excluded.length > 0,
    'the control must exclude something, or the exception is indistinguishable from the ordinary answer');
  assert.notDeepEqual(mars.admissible, [win]);
  assert.notEqual(mars.key, r.key);

  // The exception is about the DOMAIN, and it is not an exemption from
  // the pack. An earlier version returned before anything looked at the
  // Sun, so a Sun-target request on a Sun-less pack came back "the whole
  // window is admissible" -- contradicting this file's own header, which
  // says such a pack is refused here rather than answered, and deferring
  // the refusal to a subsearch whose caller does not catch it. A malformed
  // request is still a malformed request when the answer would have been
  // easy.
  const noSun = G.packOf(LINEAR.target, LINEAR.observer, {
    intervalSec: 3600, initEt: -12 * 3600, nrec: 24, omitSun: true,
  });
  assert.throws(
    () => partitionDomain(noSun, { body: 'Sun', fromTdbSec: -3600, toTdbSec: 3600 }),
    (e) => e.code === 'unknown-body' && /sun/i.test(e.message),
    'a pack with no Sun must be refused for the Sun as for any other body',
  );

  // And what the shortcut DOES return says why it is admissible, rather
  // than borrowing the shared contract's sentence about an elongation
  // above the floor -- which for the deflector itself is identically zero.
  assert.match(r.request.classes.admissible, /deflector of this profile/);
  assert.match(r.request.classes.admissible, /identically zero/);
  assert.equal(r.request.classes.excluded, PARTITION_CONTRACT.classes.excluded,
    'only the one class whose description would be false is replaced');
});

// ================================= the Sun is read, and read at reception
test('the Sun\'s own position is read, and a barycentric Sun cannot show that', () => {
  // `packOf` leaves the Sun at the origin unless asked otherwise, which
  // makes `e = O - S` equal to the observer's own barycentric vector --
  // so every other fixture in this file would agree with an implementation
  // that never opened the Sun's series at all. This one moves it.
  //
  // The fixture property is established first and in both directions: the
  // crossings really move when the Sun is put back at the barycentre, and
  // they move by far more than the width of the boundary spans the
  // ownership assertion compares. Otherwise the case would be satisfied by
  // the blunder it exists to catch.
  const truth = belowFloorSpans(DRIFTING_SUN, DRIFTING_SUN_WIN[0], DRIFTING_SUN_WIN[1], 4000);
  assert.equal(truth.spans.length, 1);
  assert.equal(truth.crossings.length, 2);
  const r = partitionDomain(DRIFTING_SUN_EPH, {
    body: BODY, fromTdbSec: DRIFTING_SUN_WIN[0], toTdbSec: DRIFTING_SUN_WIN[1],
  });
  assert.equal(r.execution.status, 'finished');
  assertTilesRequest(r, DRIFTING_SUN_WIN[0], DRIFTING_SUN_WIN[1], 'DRIFTING_SUN');
  assertOwnership(r, truth.spans, 'DRIFTING_SUN');
  assertCrossingsAreOwnedByBoundary(r, truth.crossings, 'DRIFTING_SUN');
  assert.equal(r.excluded.length, 1);
  assert.equal(r.admissible.length, 2);

  // The blunder, measured rather than imagined: an implementation that
  // read `e` as the observer's barycentric vector would be answering about
  // a passage whose entry is more than a thousand seconds away, and the
  // widest boundary span here is under two hundred. So the crossings it
  // would report lie in this run's ADMISSIBLE spans, and the ownership
  // assertion above has a side.
  const barycentric = { ...DRIFTING_SUN, sun: () => [0, 0, 0] };
  const wrong = belowFloorSpans(barycentric, DRIFTING_SUN_WIN[0], DRIFTING_SUN_WIN[1], 4000);
  assert.equal(wrong.crossings.length, 2);
  const shift = Math.abs(wrong.crossings[0] - truth.crossings[0]);
  assert.ok(shift > 4 * (r.diagnostics.widestBoundarySec ?? 0),
    `the blunder would move the entry crossing by ${shift} s against boundary spans`
    + ` ${r.diagnostics.widestBoundarySec} s wide; this fixture cannot separate them`);
  for (const t of wrong.crossings) {
    assert.ok(r.admissible.some(([lo, hi]) => t >= lo && t <= hi),
      `the barycentric-Sun crossing at ${t} s should fall in a span this run ADMITTED`);
  }
});
