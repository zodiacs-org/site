/**
 * Where a body IS and IS NOT inside the deflection profile's supported
 * domain, over a requested interval, decided once and reusable.
 *
 * ## The measurement this exists because of
 *
 * `tools/measure/cost-baseline.mjs` attributes each cell of a deflected
 * search to the reason it was created. On Saturn's 300-day window -- one
 * solar conjunction, 61x the of-date rung -- 98.9 per cent of the
 * evaluations and 3,966 of the 3,978 cells are cells that exist only
 * because some ancestor's elongation enclosure straddled the five-degree
 * floor. The event search was spending itself answering a question that
 * has nothing to do with the longitude it was asked about.
 *
 * It is worth being precise about what that 98.9 per cent is and is not.
 * It is not "cells that failed the domain test". A cell created by a
 * boundary split can land wholly inside the supported domain and then run
 * the entire pipeline -- frame, aberration, projection, exclusion and
 * monotone tests. The figure is the work CAUSED by boundary bisection,
 * which is the work a partition can remove, which is why it is the figure
 * that was measured.
 *
 * ## What makes this cheaper than the search that used to do it
 *
 * Three things, and only the third is an algorithm change:
 *
 * 1. **A smaller cell.** `cos(elongation) = -(e . d)/|d|` needs the
 *    observer's position, the target's position over the emission window,
 *    and the Sun's position at RECEPTION. It does not need the Sun at
 *    emission, the deflection itself, the derivative chain, the frame
 *    rotation, the aberration, or the projection onto the longitude
 *    basis. A classification cell builds three enclosures where a search
 *    cell builds four and then does trigonometry on them.
 *
 * 2. **One light-time derivation per seed, not per cell.** The search
 *    re-solves `tau` at every cell. The partition solves it once per
 *    record-boundary seed and lets the children inherit it, which is
 *    sound rather than convenient: the seed's interval was built as
 *    `[tau(mid) - slope*half - err, tau(mid) + slope*half + err]` from a
 *    bound on `|tau'|` over the WHOLE seed, so it contains `tau(t)` for
 *    every `t` in the seed and therefore for every `t` in any descendant.
 *    A child inherits a looser interval than it could derive, never a
 *    tighter one, and looser is the safe direction: it widens the
 *    emission window, which widens the target enclosure, which can only
 *    turn a decision into a non-decision.
 *
 * 3. **A declared boundary tolerance instead of the enclosure floor.**
 *    The search bisects a straddling cell to one second because it has no
 *    other way to dispose of it. The partition stops at a tolerance the
 *    caller declares, and reports what is left as BOUNDARY -- neither
 *    admitted nor excluded. That is not a weaker answer dressed up; it is
 *    the honest one, and section 6 of the brief asks for exactly it.
 *
 * ## The definition is shared, not copied
 *
 * `elongationCosInterval` and `classifyElongationCos` live in
 * `deflection.mjs` and are called from both here and `deflectInterval`.
 * An admissibility pass computing its own slightly different elongation
 * would certify spans the deflection then refuses, and the refusal would
 * arrive after the completeness claim was made.
 *
 * ## What a partition does NOT depend on
 *
 * The requested longitude. Nothing in this file accepts one, which is how
 * the independence is established rather than asserted -- the reuse in
 * section 5 of the brief rests on it, and a function that cannot see a
 * quantity cannot depend on it.
 *
 * It DOES depend on the pack, the body, the observer, the profile
 * version, the time convention, the interval and the tolerances. Those
 * are the cache identity, and `partitionKey` builds it.
 */
import { fail, PrecisionError } from './errors.mjs';
import * as I from './interval.mjs';
import {
  DEFLECTION_PROFILE, MIN_ELONGATION_RAD, COS_MIN_ELONGATION_GUARD, COS_MIN_ELONGATION_EXCLUDE,
  elongationCosInterval, elongationCosCentred, classifyElongationCos,
} from './deflection.mjs';
import { ABS_ERR } from './trig.mjs';
import {
  C_KM_S, targetWeights, observerWeights, mergedWeights, withinOneRecord, stateEnclosure, solveTau, coverage,
} from './retarded.mjs';
import { enter, leave, charge, setLabel } from './instrument.mjs';

/**
 * The one version number: the operation's contract and its cache keys.
 *
 * 2 since the merged-weight geocentric vector and the centred cosine
 * (PARTITION-EVALUATION-V2.md). A version-1 plan answers the same
 * question, but with different spans, so it is a different proof and its
 * key does not match.
 */
export const PARTITION_CONTRACT_ID = 'zodiacs-domain-partition/2';

/**
 * Every numerical choice the spans depend on beyond the request itself,
 * named, so a cached plan from a build that made another choice is
 * refused rather than trusted (audit finding alpha-search-partition-5).
 * Its fingerprint is in every key, and the light-time derivation below
 * reads its three factors from here rather than from literals.
 */
export const NUMERICS_POLICY = Object.freeze({
  contract: PARTITION_CONTRACT_ID,
  geocentricVector: 'the split enclosure r_T(t - tau) - r_O(t), met with the merged-weight one [r_T(t) - r_O(t)] + [r_T(t - tau) - r_T(t)] where the target is one polynomial over its emission times',
  cosElongation: 'the interval form, met with the centred form where every series it rests on is one polynomial over the half-open cell',
  minElongationRad: MIN_ELONGATION_RAD,
  cosGuard: COS_MIN_ELONGATION_GUARD,
  cosExclude: COS_MIN_ELONGATION_EXCLUDE,
  intervalPad: I.PAD,
  trigAbsErr: ABS_ERR,
  clenshawRoundoff: '4 n^2 u sum|c_k|',
  speedOfLightKmS: C_KM_S,
  solveTauContraction: 0.5,
  crudeWindowHalfWidths: 1.2,
  crudeWindowPadSec: 1,
  tauWideningFraction: 0.25,
  lightTimeTightening: '[max(T.lo, |d|.lo/c), min(T.hi, |d|.hi/c)] on every cell',
  seeds: 'the record edges of the target, observer and Sun series',
});

/** A short label for NUMERICS_POLICY, as the key carries it. */
export const NUMERICS_FINGERPRINT = fingerprint(JSON.stringify(NUMERICS_POLICY));

/** What this operation promises, for the result's metadata. */
export const PARTITION_CONTRACT = Object.freeze({
  operation: 'the subintervals of a requested interval over which one body is PROVED inside, and PROVED outside, the solar-elongation floor of a deflection profile -- with the residue between them reported rather than assigned',
  profile: DEFLECTION_PROFILE.id,
  quantity: 'cos(elongation) = -(e_hat . d)/|d|, with e the Sun-to-observer vector at RECEPTION and d the light-time-corrected observer-to-source vector. The same expression the deflection itself tests, called from the same function.',
  timeScale: 'TDB seconds past J2000, in and out. No conversion happens here.',
  independentOf: 'the requested longitude, structurally: this operation never receives one',
  endpointConvention: 'spans are half-open [lo, hi) and tile the request in order, except the last, which is closed at the requested end. Adjacent spans of the same class are merged. The union is exactly the request; no instant belongs to two spans.',
  classes: Object.freeze({
    admissible: 'PROVED: the elongation is at or above the floor at every instant of this span',
    excluded: 'PROVED: the elongation is below the floor at every instant, so no subdivision and no budget reaches it',
    boundary: 'NOT PROVED either way. The transition lies in here, and it is reported rather than rounded into a neighbour.',
    unprocessed: 'not examined at all, because the budget ran out or the caller cancelled. NOT the same as excluded.',
  }),
});

/** The tuning this operation accepts, and what each knob means. */
export const PARTITION_DEFAULTS = Object.freeze({
  /**
   * How narrow a straddling span must get before it is given up on and
   * reported as boundary. NOT an accuracy claim about the transition
   * instant: the true crossing lies somewhere in the reported span, and
   * the span's width is the whole of what is known.
   */
  boundaryToleranceSec: 60,
  /**
   * How far a span may shrink below the span its light-time interval was
   * derived on before the interval is derived again.
   *
   * Inheriting is sound at any ratio -- a parent's interval contains a
   * child's true light-time -- but it is not free: the inherited interval
   * was sized for the parent's width, so it widens the child's emission
   * window far beyond what the child needs, which loosens the target
   * enclosure and so the elongation enclosure. Measured on Mercury with
   * unbounded inheritance: 17.4 days of a 300-day window came back
   * BOUNDARY, in roughly 35,000 slivers, because the elongation could not
   * be bounded inside a floor it was nowhere near. Re-deriving at 1/8
   * costs one solve per three subdivisions and removes that.
   */
  relightWidthRatio: 8,
  maxEvaluations: 4_000_000,
  maxCells: 400_000,
  maxTauWidenings: 6,
  tauPadFloorSec: 1e-6,
});

/**
 * The identity a cached partition must match before it may be reused.
 *
 * Everything here changes what the answer MEANS. A partition computed
 * against a different pack, a different body, a different profile version
 * or a different boundary tolerance is a different answer to a different
 * question, and reusing it would be reusing a proof of something else.
 *
 * The pack's digest is in here, not its path: two files at one path over
 * time are two packs, and a path is not an identity.
 */
export function partitionKey({
  packDigest, packStructure, observer, body, fromTdbSec, toTdbSec,
  boundaryToleranceSec, relightWidthRatio, maxTauWidenings, tauPadFloorSec, profile,
}) {
  return [
    PARTITION_CONTRACT_ID,
    NUMERICS_FINGERPRINT,
    profile ?? DEFLECTION_PROFILE.id,
    packDigest ?? 'no-digest',
    packStructure ?? 'no-structure',
    observer ?? 'no-observer',
    body,
    'tdb',
    fromTdbSec,
    toTdbSec,
    boundaryToleranceSec,
    relightWidthRatio,
    maxTauWidenings,
    tauPadFloorSec,
  ].join('|');
}

/**
 * A pack's numerical identity, read from the pack itself.
 *
 * The digest identifies the BYTES and is the strong form. This is the
 * weaker companion for a runtime that was handed no digest: the segment
 * layout and the proven error bounds of every body the partition reads.
 * Those are what the enclosures are built from, so a pack that differs in
 * any of them gives a different partition for the same request.
 *
 * Its limit, stated rather than left to be discovered: two packs with the
 * same layout and the same proven bounds but DIFFERENT COEFFICIENTS have
 * the same fingerprint. Only the digest separates those, which is why a
 * partition built without one records that its identity is weaker.
 */
export function packFingerprint(eph) {
  const parts = [`observer=${eph.observer ?? 'unknown'}`, `emrat=${eph.emrat ?? 'unknown'}`];
  const names = [...eph.bodies.keys()].sort();
  for (const name of names) {
    const sb = eph.bodies.get(name);
    parts.push([
      name, sb.initEt, sb.intervalSec, sb.nrec, sb.ncoef,
      sb.provenPosKm, sb.provenVelKmS,
    ].join(':'));
  }
  return fingerprint(parts.join(';'));
}

/**
 * A short, stable label for a long string. Two 32-bit FNV-1a passes with
 * different offset bases, printed as one 16-character hex string.
 *
 * What it is for: telling two DIFFERENT packs apart by accident -- a
 * mismatched cache, a stale file, the wrong runtime. What it is NOT: a
 * security boundary. It is not cryptographic and a determined forger can
 * collide it in seconds. The trust anchor for an imported partition is
 * the pack DIGEST, and a partition built without one records its identity
 * as `structure-only` for exactly that reason.
 */
function fingerprint(text) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x85ebca6b) >>> 0;
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

/**
 * Plans this runtime built, in this process, in this heap.
 *
 * A plan is a PROOF, and a JSON object shaped like one is not. The key
 * cannot tell them apart: it is a non-cryptographic fingerprint recomputed
 * locally from the live pack, so anything that can call `partitionKey` can
 * produce a matching one, and a partial write or a schema change that drops
 * a span list leaves the header intact.
 *
 * Membership of this set is the only evidence a plan can carry that this
 * runtime derived it. It does not survive serialization -- which is the
 * point: a plan that came back from a cache, a file or a worker message is
 * an IMPORT, and `assertPartitionUsable` treats it as one.
 */
const NATIVE_PLANS = new WeakSet();

/** True if this exact object was produced by `partitionDomain` here. */
export function isNativePlan(plan) {
  return typeof plan === 'object' && plan !== null && NATIVE_PLANS.has(plan);
}

/**
 * Is this span list one this operation could have produced -- sorted,
 * non-empty, strictly increasing, and inside `[a, b]`?
 *
 * Structure only. It cannot tell a true verdict from a false one; nothing
 * short of recomputing can. What it catches is corruption: a truncated
 * write, a reordered array, a span that leaked outside the request.
 */
function wellFormedSpans(spans, a, b) {
  if (!Array.isArray(spans)) return 'is not an array';
  let prev = -Infinity;
  for (const span of spans) {
    if (!Array.isArray(span) || span.length !== 2) return 'holds something that is not a [from, to] pair';
    const [lo, hi] = span;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 'holds a non-finite endpoint';
    if (!(hi > lo)) return 'holds a span that does not run forwards';
    if (lo < a - 1e-6 || hi > b + 1e-6) return `holds ${lo} .. ${hi}, which is outside the requested ${a} .. ${b}`;
    if (lo < prev - 1e-6) return 'is not sorted';
    prev = hi;
  }
  return null;
}

/**
 * Check a plan's four span lists against each other and against the
 * request: each well formed, pairwise disjoint, and tiling `[a, b]`
 * exactly.
 *
 * Returns null when they hold, or a sentence saying what does not.
 */
export function validatePlanSpans(plan, a, b) {
  const lists = [['admissible', plan.admissible], ['excluded', plan.excluded],
    ['boundary', plan.boundary], ['unprocessed', plan.unprocessed]];
  for (const [name, spans] of lists) {
    const why = wellFormedSpans(spans, a, b);
    if (why !== null) return `its ${name} list ${why}`;
  }
  const all = [];
  for (const [name, spans] of lists) for (const [lo, hi] of spans) all.push({ lo, hi, name });
  all.sort((x, y) => x.lo - y.lo);
  for (let i = 1; i < all.length; i += 1) {
    if (all[i].lo < all[i - 1].hi - 1e-6) {
      return `its ${all[i - 1].name} and ${all[i].name} spans overlap at ${all[i].lo}, so some instant carries two verdicts`;
    }
  }
  const covered = all.reduce((n, x) => n + (x.hi - x.lo), 0);
  if (Math.abs(covered - (b - a)) > 1e-6) {
    return `its four classes cover ${covered} seconds of a ${b - a}-second request, so they do not tile it`;
  }
  return null;
}

/** Merge touching or overlapping spans of one class. Sorted, disjoint out. */
function coalesce(spans) {
  const sorted = [...spans].sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [lo, hi] of sorted) {
    const last = out[out.length - 1];
    if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
    else out.push([lo, hi]);
  }
  return out;
}

/**
 * One classification cell: the whole of what the domain test needs and
 * nothing else.
 *
 * Returns `{ verdict, cosElongation }`, or `{ verdict: 'indeterminate' }`
 * with a reason when the geometry itself is not established over the span
 * -- a target on the observer, an observer at the centre of the Sun, or a
 * window the records do not cover. Indeterminate is NOT excluded, and the
 * caller must not turn it into one.
 */
function classifyCell(ctx, lo, hi) {
  const { eph, targets, observer, sun, spend, T } = ctx;
  let O;
  let R;
  let S;
  const token = enter('partition-enclosures');
  try {
    O = stateEnclosure(eph, observer, lo, hi, spend);
    // The emission window, from the seed's inherited light-time interval.
    R = stateEnclosure(eph, targets, lo - T.hi, hi - T.lo, spend);
    S = stateEnclosure(eph, sun, lo, hi, spend);
  } catch (error) {
    leave(token);
    if (error instanceof PrecisionError && error.code === 'out-of-coverage') {
      return { verdict: 'indeterminate', retry: true, why: `the records do not cover ${lo} .. ${hi} s TDB, or the emission window it implies: ${error.message}` };
    }
    throw error;
  }
  const local = localGeometry(ctx, lo, hi);
  leave(token);

  const test = enter('partition-domain-test');
  let d = I.vSub(R.pos, O.pos);
  if (local) {
    // Two enclosures of the same vector; the truth is in both.
    d = I.vMeet(d, local.d);
    if (d === null) {
      leave(test);
      return { verdict: 'indeterminate', retry: false, why: 'the split and merged enclosures of the geocentric vector do not meet, so one of them is wrong; nothing is decided here' };
    }
  }
  const dist = I.norm(d);
  if (!(dist.lo > 0)) {
    leave(test);
    return { verdict: 'indeterminate', retry: true, why: 'the target and the observer cannot be shown to be separated over this span, so the direction is undefined' };
  }
  const eRaw = I.vSub(O.pos, S.pos);
  const en = I.norm(eRaw);
  if (!(en.lo > 0)) {
    leave(test);
    return { verdict: 'indeterminate', retry: true, why: 'the observer cannot be bounded away from the centre of the Sun over this span, so the deflector geometry is undefined' };
  }
  const e = [I.div(eRaw[0], en), I.div(eRaw[1], en), I.div(eRaw[2], en)];
  let cosElongation = elongationCosInterval(e, d, dist);
  let form = 'interval';
  if (local && local.cosMid) {
    /**
     * The centred form, and the rate it needs: an upper bound on
     * |e'| + |dh'| over this span (see `elongationCosCentred`).
     *
     * |e'| <= |u'|/|u| for e = u/|u|, u = r_O - r_Sun, from the velocity
     * enclosures over the span. |dh'| <= |d'|/|d|, and with
     * d(t) = r_T(t - tau(t)) - r_O(t),
     *
     *   d' = [v_T(t) - v_O(t)] + [v_T(t - tau) - v_T(t)] - v_T(t - tau) tau'
     *
     * so |d'| <= max|v_T - v_O| (the merged series' own velocity bound)
     * + tau_max max|a_T| + max|v_T| max|tau'|, with
     * |tau'| <= (|v_T| + |v_O|)/(c - |v_T|), the bound `deriveLightTime`
     * already rests on. Every term is an upper bound over the windows the
     * span and its emission times reach, which `localGeometry` checked lie
     * inside one record of every series.
     */
    const vT = I.vMag(local.W.vel);
    const vO = I.vMag(O.vel);
    if (vT < C_KM_S) {
      const tauRate = (vT + vO) / (C_KM_S - vT);
      const dDot = I.vMag(local.A.vel) + T.hi * I.vMag(local.W.acc) + vT * tauRate;
      const rate = (I.vMag(I.vSub(O.vel, S.vel)) / en.lo + dDot / dist.lo) * (1 + 8 * I.PAD);
      const centred = elongationCosCentred(local.cosMid, cosElongation, rate, local.half);
      if (centred) {
        const both = I.meet(cosElongation, centred);
        if (both === null) {
          leave(test);
          return { verdict: 'indeterminate', retry: false, why: 'the interval and centred enclosures of cos(elongation) do not meet, so one of them is wrong; nothing is decided here' };
        }
        cosElongation = both;
        form = 'centred';
      }
    }
  }
  leave(test);
  /**
   * A tighter light-time interval, for free, from work already done.
   *
   * `dist` encloses `|d(t)|` for every `t` in this span, and `tau(t) =
   * |d(t)|/c` exactly, so `[dist.lo/c, dist.hi/c]` contains `tau(t)`
   * throughout -- a PROVED interval, not an estimate, and usually far
   * narrower than the one inherited from an ancestor sized for a much
   * wider span. Intersecting the two keeps whichever is tighter at each
   * end and stays sound because `tau(t)` is in both.
   *
   * This is what makes re-deriving from `solveTau` mostly unnecessary:
   * the light-time tightens as the bisection descends, at no cost in
   * ephemeris calls, and `solveTau` was 39 to 54 per cent of the search's
   * evaluations.
   */
  const tightened = {
    lo: Math.max(T.lo, dist.lo / C_KM_S),
    hi: Math.min(T.hi, dist.hi / C_KM_S),
  };
  const tightenedIsUsable = tightened.hi >= tightened.lo;
  const usable = tightenedIsUsable ? tightened : T;
  return {
    verdict: classifyElongationCos(cosElongation),
    cosElongation,
    form,
    T: usable,
    /**
     * Whether `T` above was derived on THIS span or inherited unchanged.
     *
     * The caller uses it to decide what width to record the interval
     * against, and an earlier version tested `out.T` for truthiness --
     * which is always true here, including in the fallback branch where
     * `usable === T` is the inherited interval. That recorded an
     * inherited interval as freshly derived and suppressed the next three
     * relights. The fallback is only reachable if an enclosure is already
     * unsound (both intervals contain tau(t), so their intersection is
     * non-empty), but the flag should say what happened rather than what
     * is usually true.
     */
    tightened: tightenedIsUsable,
  };
}

/**
 * The geocentric vector from MERGED weights, and the geometry at the
 * span's midpoint, for the centred form (version 2 of this partition).
 *
 *   d(t) = [r_T(t) - r_O(t)] + [r_T(t - tau) - r_T(t)]
 *
 * The first bracket is one weight map at one instant (`mergedWeights`):
 * for the Moon, the Moon series alone with weight 1 + 1/EMRAT, since the
 * EMB is in both ends and cancels exactly. The second is the retardation,
 * by Taylor with remainder about t:
 *
 *   r_T(t - tau) - r_T(t) = -tau v_T(t) + (tau^2 / 2) a_T(xi)
 *
 * with tau in the inherited interval T and xi in [t - tau, t], so inside
 * [lo - T.hi, hi]. The split form `r_T(t - tau) - r_O(t)` enclosed apart
 * carried the EMB's 30 km/s twice: 5,852 km wide over a 60-second Moon
 * cell against a true variation of 58 km at most, measured in the audit,
 * where the merged form is a few times the true variation.
 *
 * Returns null, and the caller keeps the split form alone, wherever the
 * argument does not hold: a window crossing a record boundary of any
 * series used (the stored records are separate fits and do not join
 * smoothly), or one the records do not cover.
 */
function localGeometry(ctx, lo, hi) {
  const { eph, targets, observer, sun, merged, spend, T, windowEnd } = ctx;
  // Spans are half-open, so a cell need not reach the record its end
  // touches; the last one is closed at the request's end, and so is this.
  const halfOpen = hi < windowEnd;
  const one = (weights, a, b) => withinOneRecord(eph, weights, a, b, { halfOpen });
  if (!(
    one(targets, lo - T.hi, hi)
    && one(merged, lo, hi)
    && one(observer, lo, hi)
    && one(sun, lo, hi)
  )) return null;
  try {
    const tau = I.iv(T.lo, T.hi);
    const A = stateEnclosure(eph, merged, lo, hi, spend);
    const W = stateEnclosure(eph, targets, lo - T.hi, hi, spend);
    const retard = (vel) => I.vAdd(I.vMulI(vel, I.neg(tau)), I.vScale(W.acc, (T.hi * T.hi) / 2));
    const d = I.vAdd(A.pos, retard(W.vel));

    const mid = (lo + hi) / 2;
    const half = Math.max(hi - mid, mid - lo);
    const Am = stateEnclosure(eph, merged, mid, mid, spend);
    const Vm = stateEnclosure(eph, targets, mid, mid, spend);
    const Om = stateEnclosure(eph, observer, mid, mid, spend);
    const Sm = stateEnclosure(eph, sun, mid, mid, spend);
    const dMid = I.vAdd(Am.pos, retard(Vm.vel));
    const distMid = I.norm(dMid);
    const uMid = I.vSub(Om.pos, Sm.pos);
    const enMid = I.norm(uMid);
    const cosMid = distMid.lo > 0 && enMid.lo > 0
      ? elongationCosInterval([I.div(uMid[0], enMid), I.div(uMid[1], enMid), I.div(uMid[2], enMid)], dMid, distMid)
      : null;
    return { d, A, W, cosMid, half };
  } catch (error) {
    if (error instanceof PrecisionError && error.code === 'out-of-coverage') return null;
    throw error;
  }
}

/**
 * The light-time interval for a span, derived once and inherited by every
 * descendant of the span it was derived on.
 *
 * The same derivation `retardedCell` uses, and for the same reason: a flat
 * pad is either too loose (a wide emission window loosens the target
 * enclosure, which costs cells) or unsound. `tau' <= (|v_T| + |v_O|)/(c -
 * |v_T|)` over the span, so over a half-width `half` the light-time can
 * move by that much, plus the solver's own error at the midpoint.
 *
 * It can FAIL on a wide span, and the first version of this file treated
 * that as a verdict about the domain. It is not. Mercury over a 32-day
 * record moves more than an astronomical unit, so the mean-value position
 * enclosure is wide enough that `|d|` cannot be bounded away from zero and
 * the derivation has nothing to work with -- which says nothing whatever
 * about the elongation. Measured cost of that mistake: 196.8 of Mercury's
 * 300 days came back BOUNDARY, five whole records wide. The caller
 * subdivides and tries again, which is what the search does with the same
 * condition.
 */
function deriveLightTime(ctx, lo, hi) {
  const { eph, targets, observer, spend, p } = ctx;
  const mid = (lo + hi) / 2;
  const half = (hi - lo) / 2;
  const token = enter('partition-light-time');
  try {
    const O = stateEnclosure(eph, observer, lo, hi, spend);
    const oPoint = stateEnclosure(eph, observer, mid, mid, spend).pos.map((x) => (x.lo + x.hi) / 2);
    const rough = solveTau(eph, targets, mid, oPoint, NUMERICS_POLICY.solveTauContraction, spend);
    if (rough.leftCoverage) {
      const [covLo, covHi] = coverage(eph, targets);
      return { ok: false, retry: true, why: `the light-time iteration from ${lo} .. ${hi} s TDB reaches outside the stored records ${covLo} .. ${covHi} s TDB` };
    }
    const reach = NUMERICS_POLICY.crudeWindowHalfWidths * half + NUMERICS_POLICY.crudeWindowPadSec;
    const crude = stateEnclosure(eph, targets, lo - rough.tau - reach, hi - rough.tau + reach, spend);
    const vT = I.vMag(crude.vel);
    const vO = I.vMag(O.vel);
    if (!(vT < C_KM_S)) {
      return { ok: false, retry: false, why: `the target's speed bound over the emission window is ${vT.toFixed(3)} km/s, which is not below c, so the light-time iteration is not a contraction here` };
    }
    const slope = (vT + vO) / (C_KM_S - vT);
    let T = {
      lo: Math.max(0, rough.tau - slope * half - rough.errorSec - p.tauPadFloorSec),
      hi: rough.tau + slope * half + rough.errorSec + p.tauPadFloorSec,
    };
    // The same widening the search does, and the same reason: the first
    // candidate is derived from a speed bound over a WIDER window than the
    // emission window it then implies, so it is normally conservative --
    // but "normally" is not "always", and the contraction is checked on
    // the window actually used.
    for (let attempt = 0; attempt <= p.maxTauWidenings; attempt += 1) {
      let R;
      try {
        R = stateEnclosure(eph, targets, lo - T.hi, hi - T.lo, spend);
      } catch (error) {
        if (error instanceof PrecisionError && error.code === 'out-of-coverage') {
          return { ok: false, retry: true, why: `the emission window ${lo - T.hi} .. ${hi - T.lo} s TDB reaches outside the stored records` };
        }
        throw error;
      }
      const vMax = I.vMag(R.vel);
      if (!(vMax < C_KM_S)) {
        return { ok: false, retry: false, why: `the target's speed bound over the emission window is ${vMax.toFixed(3)} km/s, which is not below c` };
      }
      const D = I.vSub(R.pos, O.pos);
      const dist = I.norm(D);
      if (!(dist.lo > 0)) {
        return { ok: false, retry: true, why: 'the target and the observer cannot be shown to be separated over this seed' };
      }
      // The self-mapping check, exactly as `retardedCell` does it: the
      // image of T under the light-time map must lie inside T. With the
      // contraction above, Banach then gives one light-time per reception
      // time, inside T.
      const phi = { lo: dist.lo / C_KM_S, hi: dist.hi / C_KM_S };
      if (I.contains(T, phi)) return { ok: true, T, widenings: attempt };
      // Hull plus a quarter. `phi` is a strong contraction in tau, so this
      // closes in a step or two; a bare hull crawls and a blind multiple
      // overshoots.
      const lo2 = Math.min(T.lo, phi.lo);
      const hi2 = Math.max(T.hi, phi.hi);
      const grow = NUMERICS_POLICY.tauWideningFraction * (hi2 - lo2) + p.tauPadFloorSec;
      T = { lo: Math.max(0, lo2 - grow), hi: hi2 + grow };
    }
    return { ok: false, retry: true, why: `the light-time interval for ${lo} .. ${hi} s TDB did not close after ${p.maxTauWidenings} widenings` };
  } catch (error) {
    /**
     * Missing coverage is an ANSWER here, not an exception, and it has to
     * be the same answer whichever enclosure notices first.
     *
     * The widening loop below already converted an out-of-coverage
     * emission window into a typed refusal, but the OBSERVER's enclosures
     * and `solveTau` sit above it and threw straight past
     * `partitionDomain`'s handler, which takes only `budget-exhausted` and
     * `cancelled`. So a window the target's records covered and the
     * observer's did not came back as a thrown error while the mirror-image
     * window came back as a boundary span with a reason. One shape of the
     * same gap, reported two ways.
     */
    if (error instanceof PrecisionError && error.code === 'out-of-coverage') {
      return { ok: false, retry: true, why: `the records do not cover ${lo} .. ${hi} s TDB, or the light-time window it implies: ${error.message}` };
    }
    throw error;
  } finally {
    leave(token);
  }
}

/**
 * Partition `[fromTdbSec, toTdbSec]` into proved-admissible, proved-
 * excluded, boundary and unprocessed spans for one body.
 *
 * Never throws for a geometry it cannot decide: that is an answer, and it
 * comes back as `boundary` with a reason. It DOES throw for a malformed
 * request -- an unknown body, a backwards window, a pack with no Sun --
 * because those are not answers.
 */
export function partitionDomain(eph, spec = {}) {
  const {
    body,
    fromTdbSec,
    toTdbSec,
    signal = null,
    packDigest = null,
    ...tuning
  } = spec;
  if (typeof body !== 'string') fail('unsupported-option', 'a body is required');
  const p = { ...PARTITION_DEFAULTS, ...tuning };
  for (const k of Object.keys(tuning)) {
    if (!(k in PARTITION_DEFAULTS)) fail('unsupported-option', `unknown partition option ${k}`);
  }
  const a = Number(fromTdbSec);
  const b = Number(toTdbSec);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !(b > a)) {
    fail('unsupported-option', 'the window must be finite with toTdbSec after fromTdbSec');
  }
  if (!(p.boundaryToleranceSec > 0)) fail('unsupported-option', 'boundaryToleranceSec must be positive');

  /**
   * The identity this partition will be cached and reused under, built
   * once. It names everything that changes the answer, so a plan carrying
   * it is a proof about exactly this question and no other.
   */
  const identity = {
    packDigest: packDigest ?? null,
    packStructure: packFingerprint(eph),
    observer: eph.observer ?? 'unknown',
    body,
    fromTdbSec: a,
    toTdbSec: b,
    boundaryToleranceSec: p.boundaryToleranceSec,
    relightWidthRatio: p.relightWidthRatio,
    maxTauWidenings: p.maxTauWidenings,
    tauPadFloorSec: p.tauPadFloorSec,
    profile: DEFLECTION_PROFILE.id,
    numerics: NUMERICS_FINGERPRINT,
  };
  /**
   * Weaker without a digest, and it says so rather than reading as an
   * identity it is not. A caller reusing a `structure-only` plan is
   * trusting that two packs of identical layout and identical proven
   * bounds hold identical coefficients, which nothing here checks.
   */
  const identityStrength = packDigest ? 'digest' : 'structure-only';
  const key = partitionKey(identity);

  /**
   * The deflector as the target -- the profile's own exception, mirrored
   * here rather than rediscovered.
   *
   * `searchDeflectedLongitude` applies NO deflection when the body being
   * searched for is the deflector itself: a body does not bend its own
   * light, and the elongation of the Sun from the Sun is zero, which is a
   * degeneracy rather than a near-conjunction. So the profile answers a
   * Sun-target request over the WHOLE window, and the elongation floor
   * that restricts every other body restricts nothing here.
   *
   * Without this the partition computes cos(elongation) of the Sun from
   * the Sun, gets the +1 that geometry demands, and declares the entire
   * request EXCLUDED -- a span the profile in fact answers for, reported
   * as one it declines. Measured on F1/A1 of the regression corpus, that
   * cost 72,108 evaluations against the search's 635 and returned an
   * excluded window where the search returns two events. It is a
   * correctness failure first and a cost failure second.
   *
   * The shortcut is about the DOMAIN only. Whether the pack covers the
   * window is a different question, and one the subsearch answers for
   * every body including this one.
   */
  if (DEFLECTION_PROFILE.deflectors.includes(body)) {
    /**
     * Resolved before the shortcut, and thrown away. The docstring above
     * promises that a pack with no Sun is REFUSED here rather than
     * answered, and the shortcut used to return before anything looked --
     * so a Sun-target request on a Sun-less pack came back "the whole
     * window is admissible" and the refusal arrived a layer later, out of
     * the subsearch, as an exception `searchDeflectedOverPartition` does
     * not catch. The elongation this operation is about is measured from
     * the Sun; a pack without one cannot answer for any body, this one
     * included.
     */
    targetWeights(eph, 'Sun');
    return native({
      contract: PARTITION_CONTRACT_ID,
      key,
      request: {
        body,
        windowTdbSec: [a, b],
        boundaryToleranceSec: p.boundaryToleranceSec,
        profile: DEFLECTION_PROFILE.id,
        minElongationDeg: DEFLECTION_PROFILE.minElongationDeg,
        identity,
        identityStrength,
        ...PARTITION_CONTRACT,
        /**
         * The shared contract's `classes.admissible` reads "the
         * elongation is at or above the floor at every instant", and for
         * the deflector itself the elongation is identically ZERO. The
         * span is admissible for a different reason -- the floor does not
         * apply -- so the class description is replaced rather than left
         * to assert something false of this very result.
         */
        classes: Object.freeze({
          ...PARTITION_CONTRACT.classes,
          admissible: `${body} is a deflector of this profile, so no deflection is applied to it and the elongation floor does not apply. The whole window is inside the supported domain, and NOT because the elongation is above the floor -- it is identically zero.`,
        }),
        coverageNote: 'This is a claim about the DOMAIN only. Whether the pack covers the window is a separate question, and the subsearch answers it for this body as for any other.',
      },
      admissible: [[a, b]],
      excluded: [],
      boundary: [],
      unprocessed: [],
      boundaryReasons: [],
      execution: {
        status: 'finished', finished: true, reason: null,
        evaluations: 0, cells: 0, maxEvaluations: p.maxEvaluations, maxCells: p.maxCells,
      },
      diagnostics: {
        seeds: 0,
        widestTauWidenings: 0,
        lightTimeDerivations: 0,
        narrowestBoundarySec: null,
        widestBoundarySec: null,
        closestAdmissibleCos: null,
        closestAdmissibleCosIsALowerBoundOnElongation: true,
        deflectorIsTarget: true,
        deflectorIsTargetWhy: `${body} is a deflector of ${DEFLECTION_PROFILE.id}; no deflection is applied to it, so the elongation floor restricts nothing and the whole window is inside the supported domain`,
      },
    });
  }

  const targets = targetWeights(eph, body);
  const observer = observerWeights(eph);
  const merged = mergedWeights(targets, observer);
  // Resolved ONCE, before any cell, so a pack with no Sun costs one
  // refusal rather than one per cell.
  const sun = targetWeights(eph, 'Sun');

  let evaluations = 0;
  let cells = 0;
  let status = 'finished';
  let reason = null;
  const spend = () => {
    if (signal && signal.aborted) throw new PrecisionError('cancelled', 'the partition was cancelled', { evaluations });
    evaluations += 1;
    charge('evaluations');
    if (evaluations > p.maxEvaluations) fail('budget-exhausted', `the partition's evaluation budget of ${p.maxEvaluations} was spent`, { evaluations });
  };

  const admissible = [];
  const excluded = [];
  const boundary = [];
  /** Spans that were on the stack when the budget ran out. */
  let unprocessed = [];
  const reasons = [];
  let narrowestBoundarySec = Infinity;
  let widestBoundarySec = 0;
  let closestAdmissibleCos = -Infinity;
  let widestTauWidenings = 0;
  let relights = 0;
  /** Cells whose cosine came from the centred form, and from the interval form alone. */
  let centredCells = 0;
  let intervalCells = 0;

  /**
   * A request that lies WHOLLY outside the records is answered once.
   *
   * `deriveLightTime` reports an out-of-coverage window as retryable,
   * which is right where a window partly overlaps the records: narrowing
   * finds the part that is covered. Where nothing is covered there is
   * nothing to find, and the retry is unconditional -- measured on a
   * pack covering 8,000 seconds asked about a 10^12-second window, the
   * bisection ran 34 levels toward the 60-second tolerance and spent the
   * whole 400,000-cell budget before stopping, having evaluated nothing
   * (the enclosures throw before they reach `spend`).
   *
   * The answer was conservative either way -- boundary and unprocessed,
   * never a verdict -- so this is about cost, and about a status that
   * said `budget-exhausted` where the honest word is "not covered".
   */
  {
    const [covLo, covHi] = coverage(eph, new Map([...targets, ...observer, ...sun]));
    if (b <= covLo || a >= covHi) {
      const why = `the request ${a} .. ${b} s TDB lies wholly outside the stored records ${covLo} .. ${covHi} s TDB, so no part of it can be classified`;
      return native({
        contract: PARTITION_CONTRACT_ID,
        key,
        request: {
          body,
          windowTdbSec: [a, b],
          boundaryToleranceSec: p.boundaryToleranceSec,
          profile: DEFLECTION_PROFILE.id,
          minElongationDeg: DEFLECTION_PROFILE.minElongationDeg,
          identity,
          identityStrength,
          ...PARTITION_CONTRACT,
        },
        admissible: [],
        excluded: [],
        boundary: [[a, b]],
        unprocessed: [],
        boundaryReasons: [{ fromTdbSec: a, toTdbSec: b, why }],
        execution: {
          status: 'finished', finished: true, reason: null,
          evaluations: 0, cells: 0, maxEvaluations: p.maxEvaluations, maxCells: p.maxCells,
        },
        diagnostics: {
          seeds: 0,
          widestTauWidenings: 0,
          lightTimeDerivations: 0,
          narrowestBoundarySec: b - a,
          widestBoundarySec: b - a,
          closestAdmissibleCos: null,
          closestAdmissibleCosIsALowerBoundOnElongation: true,
          deflectorIsTarget: false,
          deflectorIsTargetWhy: null,
          /**
           * BOUNDARY, not excluded: outside the records is outside what
           * this pack can answer, which is a different thing from outside
           * the profile's supported domain. Conflating them would report
           * a missing file as a physical exclusion.
           */
          whollyOutsideCoverage: true,
          coverageTdbSec: [covLo, covHi],
        },
      });
    }
  }

  // Seeds at record boundaries, as the search does: one cell spanning a
  // year has an enclosure covering the whole orbit and decides nothing.
  const seeds = [];
  {
    const edges = new Set([a, b]);
    for (const name of new Set([...targets.keys(), ...observer.keys(), ...sun.keys()])) {
      const sb = eph.bodies.get(name);
      if (!sb) continue;
      const first = Math.floor((a - sb.initEt) / sb.intervalSec);
      const last = Math.floor((b - sb.initEt) / sb.intervalSec);
      for (let i = Math.max(0, first); i <= Math.min(sb.nrec - 1, last + 1); i += 1) {
        const e = sb.initEt + i * sb.intervalSec;
        if (e > a && e < b) edges.add(e);
      }
    }
    const sorted = [...edges].sort((x, y) => x - y);
    for (let i = 1; i < sorted.length; i += 1) seeds.push([sorted[i - 1], sorted[i]]);
  }

  const stack = [];
  /**
   * The cell that has been popped and is being worked on. It belongs to
   * neither the stack nor any output list while that is true, so an
   * exception thrown mid-classification would drop it: measured on a
   * Saturn window starved during partitioning, 0.02 days of a 300-day
   * request went into no class at all and the four classes stopped tiling
   * the request. Tracked here so the catch can put it back.
   */
  let inFlight = null;
  try {
    // A seed carries no light-time yet. Deriving one costs an iteration
    // and several enclosures, and on a wide span it can fail for reasons
    // that have nothing to do with the domain -- so it is done lazily, at
    // whatever width it first succeeds, and inherited from there down.
    for (let i = seeds.length - 1; i >= 0; i -= 1) stack.push({ lo: seeds[i][0], hi: seeds[i][1], T: null, tw: Infinity });

    const ctx = { eph, targets, observer, sun, merged, spend, p, windowEnd: b };
    while (stack.length) {
      const cell = stack.pop();
      inFlight = cell;
      setLabel(cell.T === null ? 'partition-light-time-pending' : 'partition-cell');
      cells += 1;
      charge('cells');
      if (cells > p.maxCells) fail('budget-exhausted', `the partition passed ${p.maxCells} cells`, { cells });
      const { lo, hi } = cell;
      let { T, tw } = cell;
      // Stale by width: inherited from a span this one is now a small
      // fraction of, so the emission window it implies is far wider than
      // this span needs. Sound either way; re-derived because loose costs
      // decisions.
      if (T !== null && hi - lo < tw / p.relightWidthRatio) { T = null; relights += 1; }
      if (T === null) {
        const lt = deriveLightTime(ctx, lo, hi);
        if (!lt.ok) {
          // Not a domain verdict. Narrow and try again while that is
          // worth doing; otherwise this span is boundary, with the reason
          // recorded so a reader can see it was the light-time and not
          // the elongation.
          if (lt.retry && hi - lo > p.boundaryToleranceSec) {
            const m0 = (lo + hi) / 2;
            if (m0 > lo && m0 < hi) {
              stack.push({ lo: m0, hi, T: null, tw: Infinity }, { lo, hi: m0, T: null, tw: Infinity });
              inFlight = null;
              continue;
            }
          }
          boundary.push([lo, hi]);
          reasons.push({ fromTdbSec: lo, toTdbSec: hi, why: lt.why });
          narrowestBoundarySec = Math.min(narrowestBoundarySec, hi - lo);
          widestBoundarySec = Math.max(widestBoundarySec, hi - lo);
          inFlight = null;
          continue;
        }
        T = lt.T;
        tw = hi - lo;
        widestTauWidenings = Math.max(widestTauWidenings, lt.widenings);
      }
      const out = classifyCell({ ...ctx, T }, lo, hi);
      if (out.form === 'centred') centredCells += 1;
      else if (out.form === 'interval') intervalCells += 1;
      if (out.verdict === 'admissible') {
        admissible.push([lo, hi]);
        closestAdmissibleCos = Math.max(closestAdmissibleCos, out.cosElongation.hi);
        inFlight = null;
        continue;
      }
      if (out.verdict === 'excluded') { excluded.push([lo, hi]); inFlight = null; continue; }
      // Boundary or indeterminate: bisect while it is worth it.
      if (hi - lo > p.boundaryToleranceSec) {
        const m = (lo + hi) / 2;
        // Guard against a width that no longer halves in floating point.
        if (m > lo && m < hi) {
          // The children inherit the TIGHTENED interval the
          // classification just proved, not the one this cell was handed.
          // Both contain tau(t) over this span and therefore over either
          // half; the tighter one narrows the emission window, which
          // narrows the target enclosure, which is the difference between
          // a child that decides and one that does not.
          const Tc = out.T ?? T;
          // `tw` is "the width of the span this light-time interval came
          // from", and with the tightening above it came from THIS one:
          // `classifyCell` proved `[dist.lo/c, dist.hi/c]` over this span
          // and intersected it with what was inherited. So the staleness
          // the relight knob exists to catch is no longer manufactured,
          // and the knob keeps its declared meaning rather than firing on
          // an interval that is not in fact stale.
          const twc = out.tightened ? hi - lo : tw;
          stack.push({ lo: m, hi, T: Tc, tw: twc }, { lo, hi: m, T: Tc, tw: twc });
          inFlight = null;
          continue;
        }
      }
      boundary.push([lo, hi]);
      if (out.why) reasons.push({ fromTdbSec: lo, toTdbSec: hi, why: out.why });
      narrowestBoundarySec = Math.min(narrowestBoundarySec, hi - lo);
      widestBoundarySec = Math.max(widestBoundarySec, hi - lo);
      inFlight = null;
    }
  } catch (error) {
    if (error instanceof PrecisionError && (error.code === 'budget-exhausted' || error.code === 'cancelled')) {
      status = error.code;
      reason = error.message;
      // Everything still on the stack was never examined. It is
      // UNPROCESSED -- not excluded, not boundary, not admissible. Marking
      // it any of those would be claiming a verdict the run never reached.
      unprocessed = coalesce([...stack, ...(inFlight ? [inFlight] : [])].map((c) => [c.lo, c.hi]));
    } else {
      throw error;
    }
  }

  const adm = coalesce(admissible);
  const exc = coalesce(excluded);
  const bnd = coalesce(boundary);
  const unp = coalesce(unprocessed);

  return native({
    contract: PARTITION_CONTRACT_ID,
    key,
    request: {
      body,
      windowTdbSec: [a, b],
      boundaryToleranceSec: p.boundaryToleranceSec,
      profile: DEFLECTION_PROFILE.id,
      minElongationDeg: DEFLECTION_PROFILE.minElongationDeg,
      identity,
      identityStrength,
      ...PARTITION_CONTRACT,
    },
    admissible: adm,
    excluded: exc,
    boundary: bnd,
    unprocessed: unp,
    boundaryReasons: reasons,
    execution: {
      status,
      finished: status === 'finished',
      reason,
      evaluations,
      cells,
      maxEvaluations: p.maxEvaluations,
      maxCells: p.maxCells,
    },
    diagnostics: {
      seeds: seeds.length,
      centredCells,
      intervalCells,
      widestTauWidenings,
      lightTimeDerivations: relights,
      narrowestBoundarySec: Number.isFinite(narrowestBoundarySec) ? narrowestBoundarySec : null,
      widestBoundarySec: widestBoundarySec || null,
      /**
       * The largest cos(elongation) any ADMITTED span's enclosure allowed:
       * a rigorous LOWER bound on how close to the floor the admitted
       * region came, and not the closest approach itself. An enclosure
       * bound is not an observed minimum.
       */
      closestAdmissibleCos: Number.isFinite(closestAdmissibleCos) ? closestAdmissibleCos : null,
      closestAdmissibleCosIsALowerBoundOnElongation: true,
      deflectorIsTarget: false,
      deflectorIsTargetWhy: null,
    },
  });
}

/** Record that this runtime built this plan, and hand it back. */
function native(plan) {
  NATIVE_PLANS.add(plan);
  return plan;
}
