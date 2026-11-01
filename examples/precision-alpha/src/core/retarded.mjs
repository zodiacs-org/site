/**
 * Newtonian reception light-time, with enclosures that are true of the
 * stored polynomial.
 *
 * The quantity. For a RECEPTION time t, the target is taken at its
 * EMISSION time and the observer at the reception time:
 *
 *     tau = | r_T(t - tau) - r_O(t) | / c
 *     d(t) = r_T(t - tau(t)) - r_O(t)
 *
 * The observer is NOT evaluated at t - tau. Retarding both ends -- which
 * is what happens if a single geocentric vector is formed first and then
 * shifted -- is a different and wrong quantity, and it is the mistake
 * this file exists to avoid. The two sums are kept apart throughout:
 * `targetWeights` and `observerWeights` never merge across two instants.
 * `mergedWeights` merges them at ONE instant, `r_T(t) - r_O(t)`, which is
 * a true quantity; the retardation `r_T(t - tau) - r_T(t)` is then added
 * as a term of its own (`domain-partition.mjs`).
 *
 * Time is TDB seconds past J2000, which is what SPK coefficients are
 * indexed by. No TT or UTC conversion happens anywhere in here; a
 * conversion with an unbounded error has no place inside a proof.
 *
 * What is established, and how:
 *
 *   EXISTENCE AND UNIQUENESS come from Banach, not from two iterates
 *   agreeing. Phi(tau) = |r_T(t - tau) - r_O(t)|/c has
 *   Phi'(tau) = -(u . v_T(t - tau))/c, so |Phi'| <= max|v_T|/c over the
 *   emission interval -- and max|v_T| is taken from `sum |c_k|` of the
 *   differentiated series, which is true of the polynomial. The
 *   self-mapping Phi(T) subset T is then CHECKED on a candidate interval
 *   T rather than assumed, and a failure is reported, not widened away
 *   forever.
 *
 *   THE DERIVATIVE comes through the implicit equation:
 *
 *     tau' = u . (v_T - v_O) / (c + u . v_T)
 *     d'   = v_T(t - tau) (1 - tau') - v_O(t)
 *
 *   not from rotating a geometric velocity.
 *
 *   SEGMENT CROSSINGS are handled by walking every record the emission
 *   interval touches and taking the union of the per-record enclosures.
 *   Nothing is clamped into one record and nothing is extrapolated past
 *   the stored data.
 *
 * Environment-neutral: no `node:` imports, no clock.
 */
import { fail } from './errors.mjs';
import { seriesBounds, evalCheb } from './cheb.mjs';
import { PACK_NAME } from './ephemeris.mjs';
import * as I from './interval.mjs';

/** IAU 1976 speed of light, km/s. Exact by definition of the metre. */
export const C_KM_S = 299792.458;

/**
 * Which stored series make up the TARGET's barycentric vector, and with
 * what weight. Deliberately separate from the observer: see the header.
 */
export function targetWeights(eph, body) {
  const m = new Map();
  const add = (name, w) => {
    const b = eph.bodies.get(name);
    if (!b) fail('unknown-body', `this pack does not contain ${name}`);
    m.set(name, (m.get(name) ?? 0) + w);
    if (b.frame === 'sun') m.set('sun', (m.get('sun') ?? 0) + w);
  };
  if (body === 'Sun') add('sun', 1);
  else if (body === 'Moon') { add('emb', 1); add('moon', 1); }
  else if (body === 'Earth') { add('emb', 1); add('moon', -eph.k); }
  else {
    const key = PACK_NAME[body];
    if (!key) fail('unknown-body', `${body} is not in the retarded contract`);
    add(key, 1);
  }
  for (const [k, v] of [...m]) if (v === 0) m.delete(k);
  return m;
}

/** The observer: the geocentre, Earth = EMB - Moon/EMRAT. */
export function observerWeights(eph) {
  if (eph.k === undefined) fail('bad-header', 'pack carries no EMRAT, so the geocentre cannot be formed');
  const m = new Map([['emb', 1], ['moon', -eph.k]]);
  for (const [k, v] of [...m]) if (v === 0) m.delete(k);
  return m;
}

/**
 * The target minus the observer AT THE SAME INSTANT, as one weight map:
 * each stored series once, with the two weights added.
 *
 * Enclosing the target and the observer separately and subtracting loses
 * every term they share. For the Moon seen from the geocentre the EMB is
 * in both, and the difference is the Moon series alone with weight
 * `1 + 1/EMRAT`; enclosed apart, the EMB's 30 km/s enters twice and
 * cancels in nothing, which over a 60-second cell made the geocentric
 * vector 100 to 300 times wider than its true variation. The geometric
 * mode's `contributions()` merged these weights from the start.
 */
export function mergedWeights(targets, observer) {
  const m = new Map(targets);
  for (const [name, w] of observer) m.set(name, (m.get(name) ?? 0) - w);
  for (const [k, v] of [...m]) if (v === 0) m.delete(k);
  return m;
}

/**
 * Whether every series in the map is ONE polynomial over the window from
 * `a` to `b`, by the same index walk `stateEnclosure` uses.
 *
 * The stored records are separate fits, and two neighbours disagree where
 * they meet (0.07 km measured), so a weighted sum is not continuous across
 * a record boundary. A mean-value or Taylor argument over a window that
 * crosses one is not an argument: the callers that use one ask this first
 * and fall back to the per-record hull when the answer is no.
 *
 * `halfOpen` reads the window as [a, b): it may end exactly where a
 * record does, because the instant b itself is not in it. That is the
 * partition's own endpoint convention (`PARTITION_CONTRACT`), and without
 * it every cell that ends on a record boundary, which the record-edge
 * seeds make common, was refused the centred form.
 */
export function withinOneRecord(eph, weights, a, b, { halfOpen = false } = {}) {
  for (const name of weights.keys()) {
    const s = eph.bodies.get(name);
    if (!s) return false;
    let first = Math.min(s.nrec - 1, Math.max(0, Math.floor((a - s.initEt) / s.intervalSec)));
    while (first > 0 && s.initEt + first * s.intervalSec > a) first -= 1;
    while (first < s.nrec - 1 && s.initEt + (first + 1) * s.intervalSec <= a) first += 1;
    const end = s.initEt + (first + 1) * s.intervalSec;
    if (halfOpen ? b > end : (b >= end && first < s.nrec - 1) || b > end) return false;
  }
  return true;
}

/**
 * Position, velocity and acceleration enclosures for one weighted sum of
 * stored series over [a, b] TDB seconds.
 *
 * Every record the window touches is visited and the results unioned. A
 * window that reaches outside the stored records is REFUSED: `sum |c_k|`
 * bounds a Chebyshev series only for |tau| <= 1, so outside the record
 * the bound this whole file rests on is not a bound.
 */
export function stateEnclosure(eph, weights, a, b, spend) {
  if (!(b >= a)) fail('unsupported-option', 'the window must have b >= a');
  let pos = null;
  let vel = null;
  let acc = null;
  for (const [name, w] of weights) {
    const s = eph.bodies.get(name);
    if (!s) fail('unknown-body', `this pack does not contain ${name}`);
    const span = s.nrec * s.intervalSec;
    if (a < s.initEt || b > s.initEt + span) {
      fail('out-of-coverage',
        `${name} has records from ${s.initEt} to ${s.initEt + span} s TDB; the window ${a} .. ${b} reaches outside them`,
        { name, window: [a, b], recordSpanEtSec: [s.initEt, s.initEt + span] });
    }
    // `a - s.initEt` is a rounded subtraction and can land exactly on a
    // record boundary when `a` is strictly below it, so the floor picks
    // the NEXT record and the sliver of [a, b] below the boundary is
    // walked by nothing -- while seriesAt, asked for a time its record
    // does not hold, evaluates at |tau| slightly above 1, exactly where
    // `sum |c_k|` stops bounding the series. Measured on the shipped
    // pack: 22.5 m outside the returned enclosure, at essentially every
    // record boundary of every body. Step back onto the record that
    // really contains the endpoint.
    let first = Math.min(s.nrec - 1, Math.max(0, Math.floor((a - s.initEt) / s.intervalSec)));
    while (first > 0 && s.initEt + first * s.intervalSec > a) first -= 1;
    let last = Math.min(s.nrec - 1, Math.max(0, Math.floor((b - s.initEt) / s.intervalSec)));
    while (last < s.nrec - 1 && s.initEt + (last + 1) * s.intervalSec <= b) last += 1;
    let p = null;
    let v = null;
    let ac = null;
    for (let index = first; index <= last; index += 1) {
      const lo = Math.max(a, s.initEt + index * s.intervalSec);
      const hi = Math.min(b, s.initEt + (index + 1) * s.intervalSec);
      if (!(hi >= lo)) continue;
      if (spend) spend();
      const mid = (lo + hi) / 2;
      // Address the record by INDEX, not by re-deriving it from `mid`.
      // The loop already knows which record this sub-window belongs to;
      // asking `seriesAt` for the record at `mid` re-runs the same
      // rounded division, and when the sub-window is an ulp wide against
      // a record boundary `mid` rounds ONTO the boundary and comes back
      // with the neighbouring record. The two records disagree at their
      // shared boundary by far more than the mean-value allowance -- 0.07
      // km measured -- so the "enclosure" then excluded the very value it
      // was built to contain. A record's own centre is unambiguously
      // inside it.
      const ser = eph.seriesAt(name, s.initEt + (index + 0.5) * s.intervalSec);
      // The mean-value enclosure below is centred on `mid`, so its
      // half-width must be the true distance from `mid` to the far end,
      // not (hi - lo) / 2: `lo + hi` rounds, so the computed midpoint is
      // off-centre and the cheaper expression understates the reach.
      // Same defect as the search's lever arm, same fix.
      const half = Math.max(hi - mid, mid - lo);
      const tau = (mid - ser.mid) / ser.radius;
      const pp = [];
      const vv = [];
      const aa = [];
      for (let comp = 0; comp < 3; comp += 1) {
        const bnd = seriesBounds(ser.coefficients, ser.ncoef, comp * ser.ncoef, ser.radius);
        const value = evalCheb(ser.coefficients, ser.ncoef, tau, comp * ser.ncoef);
        const slope = evalCheb(bnd.d1, ser.ncoef, tau, 0) / ser.radius;
        // Mean-value enclosures over the sub-window, from bounds that are
        // true of the series, plus that evaluation's own roundoff.
        pp.push(I.around(value, bnd.maxAbsFirst * half + bnd.roundoff));
        vv.push(I.around(slope, bnd.maxAbsSecond * half + bnd.roundoffFirst));
        // Acceleration gets the plain sum|c_k| bound: it only ever feeds a
        // second-derivative allowance, where looseness costs cell size and
        // not correctness.
        aa.push(I.iv(-bnd.maxAbsSecond, bnd.maxAbsSecond));
      }
      p = I.vHull(p, pp);
      v = I.vHull(v, vv);
      ac = I.vHull(ac, aa);
    }
    if (p === null) fail('enclosure-too-weak', `no record of ${name} covers ${a} .. ${b}`);
    pos = pos === null ? I.vScale(p, w) : I.vAdd(pos, I.vScale(p, w));
    vel = vel === null ? I.vScale(v, w) : I.vAdd(vel, I.vScale(v, w));
    acc = acc === null ? I.vScale(ac, w) : I.vAdd(acc, I.vScale(ac, w));
  }
  return { pos, vel, acc };
}

/** A point state of one weighted sum, for the pointwise evaluations. */
export function statePoint(eph, weights, t, spend) {
  const pos = [0, 0, 0];
  const vel = [0, 0, 0];
  for (const [name, w] of weights) {
    if (spend) spend();
    const ser = eph.seriesAt(name, t);
    const tau = (t - ser.mid) / ser.radius;
    for (let comp = 0; comp < 3; comp += 1) {
      const d1 = seriesBounds(ser.coefficients, ser.ncoef, comp * ser.ncoef, ser.radius).d1;
      pos[comp] += w * evalCheb(ser.coefficients, ser.ncoef, tau, comp * ser.ncoef);
      vel[comp] += (w * evalCheb(d1, ser.ncoef, tau, 0)) / ser.radius;
    }
  }
  return { pos, vel };
}

/**
 * The TDB interval over which every series in `weights` has records.
 *
 * The intersection, not the union: a weighted sum is only defined where
 * all of its terms are.
 */
export function coverage(eph, weights) {
  let lo = -Infinity;
  let hi = Infinity;
  for (const name of weights.keys()) {
    const s = eph.bodies.get(name);
    if (!s) fail('unknown-body', `this pack does not contain ${name}`);
    lo = Math.max(lo, s.initEt);
    hi = Math.min(hi, s.initEt + s.nrec * s.intervalSec);
  }
  return [lo, hi];
}

/**
 * Solve tau at ONE reception time, and say how far the answer can be from
 * the fixed point.
 *
 * The iteration count is not the argument. The returned `errorSec` is
 * Banach's a-posteriori bound, k/(1-k) times the last step, with k the
 * contraction factor the caller verified from the pack's own derivative
 * bound.
 *
 * When the map is NOT a contraction the iterates run away, and an iterate
 * that has run away asks the pack for a time it does not store. That is
 * reported as `leftCoverage`, not raised: a divergent iteration is a fact
 * about the geometry that the caller has to classify, and an exception
 * thrown from inside a starting-point heuristic would escape the search
 * entirely. `tau` is then the last iterate that stayed inside the
 * records, and `errorSec` means nothing.
 */
export function solveTau(eph, targets, t, observerPos, k, spend, maxIterations = 32) {
  const [covLo, covHi] = coverage(eph, targets);
  let tau = 0;
  let step = Infinity;
  let leftCoverage = false;
  for (let i = 0; i < maxIterations; i += 1) {
    const emit = t - tau;
    if (!(emit >= covLo && emit <= covHi)) { leftCoverage = true; break; }
    const { pos } = statePoint(eph, targets, emit, spend);
    const d = [pos[0] - observerPos[0], pos[1] - observerPos[1], pos[2] - observerPos[2]];
    // Not Math.hypot: see the note in frames.mjs on cross-engine rounding.
    const next = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) / C_KM_S;
    step = Math.abs(next - tau);
    tau = next;
    if (step === 0) break;
  }
  if (leftCoverage) return { tau, errorSec: Infinity, lastStepSec: step, leftCoverage: true };
  return { tau, errorSec: step === 0 ? 0 : (k / (1 - k)) * step, lastStepSec: step, leftCoverage: false };
}
