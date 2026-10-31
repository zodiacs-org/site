/**
 * The smallest interval arithmetic this package needs, and nothing more.
 *
 * Every operation returns an interval that CONTAINS the true result. The
 * endpoints are computed in ordinary double arithmetic rather than with
 * directed rounding, which JavaScript does not offer, so each result is
 * then widened by a relative slack of a few units in the last place. That
 * slack is stated rather than hidden: it is `PAD` below, and it is many
 * orders of magnitude smaller than the Chebyshev evaluation allowances
 * these intervals are combined with, so it never decides anything.
 *
 * Environment-neutral: no `node:` imports, no clock.
 */
import { fail } from './errors.mjs';
import { UNIT_ROUNDOFF } from './cheb.mjs';

/** Relative widening applied after every operation, covering the missing directed rounding. */
export const PAD = 8 * UNIT_ROUNDOFF;

const widen = (lo, hi) => ({
  lo: lo - Math.abs(lo) * PAD,
  hi: hi + Math.abs(hi) * PAD,
});

/** An interval from two numbers, in either order. */
export const iv = (a, b = a) => widen(Math.min(a, b), Math.max(a, b));
/** A point, widened by a stated absolute allowance. */
export const around = (x, allowance) => widen(x - Math.abs(allowance), x + Math.abs(allowance));

export const add = (a, b) => widen(a.lo + b.lo, a.hi + b.hi);
export const sub = (a, b) => widen(a.lo - b.hi, a.hi - b.lo);
export const neg = (a) => ({ lo: -a.hi, hi: -a.lo });

export function mul(a, b) {
  const p = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi];
  return widen(Math.min(...p), Math.max(...p));
}

export function scale(a, s) {
  return s >= 0 ? widen(a.lo * s, a.hi * s) : widen(a.hi * s, a.lo * s);
}

/** Refuses a denominator that straddles zero: there is no finite enclosure. */
export function div(a, b) {
  if (b.lo <= 0 && b.hi >= 0) {
    fail('enclosure-too-weak', `a denominator interval [${b.lo}, ${b.hi}] contains zero, so the quotient has no finite bound`, { denominator: b });
  }
  return mul(a, widen(1 / b.hi, 1 / b.lo));
}

/**
 * The square root of an interval, for the reciprocal Lorentz factor.
 *
 * REFUSES a negative lower end rather than clamping it to zero. A clamp
 * would turn "the enclosure says |v| may exceed c" into a quiet answer, and
 * the whole point of the subluminal check upstream is that such a cell is
 * reported, not smoothed over. A lower end of exactly zero is fine: the
 * square root is still defined there, it is only the derivative that is not,
 * and the callers that divide by this check `lo > 0` themselves.
 *
 * `Math.sqrt` is the one transcendental-looking operation IEEE-754 requires
 * to be correctly rounded, so each endpoint is within half an ulp before
 * PAD's eight units widen it. The same reason `norm` below uses it.
 */
export function sqrt(a) {
  if (!(a.lo >= 0)) {
    fail('enclosure-too-weak', `an interval [${a.lo}, ${a.hi}] reaching below zero has no real square root`, { operand: a });
  }
  return widen(Math.sqrt(a.lo), Math.sqrt(a.hi));
}

/** The largest |x| over the interval. */
export const mag = (a) => Math.max(Math.abs(a.lo), Math.abs(a.hi));
/** The smallest |x| over the interval; zero when it straddles. */
export const mig = (a) => (a.lo <= 0 && a.hi >= 0 ? 0 : Math.min(Math.abs(a.lo), Math.abs(a.hi)));
export const width = (a) => a.hi - a.lo;
export const contains = (outer, inner) => inner.lo >= outer.lo && inner.hi <= outer.hi;
export const hull = (a, b) => (a === null ? b : widen(Math.min(a.lo, b.lo), Math.max(a.hi, b.hi)));
/**
 * The common part of two enclosures of the SAME quantity. Both contain it,
 * so their intersection does, and needs no widening. Null when they do not
 * meet, which can only mean one of them is wrong; the caller says so.
 */
export function meet(a, b) {
  const lo = Math.max(a.lo, b.lo);
  const hi = Math.min(a.hi, b.hi);
  return lo <= hi ? { lo, hi } : null;
}

// ------------------------------------------------------------- 3-vectors
export const vAdd = (a, b) => [add(a[0], b[0]), add(a[1], b[1]), add(a[2], b[2])];
export const vSub = (a, b) => [sub(a[0], b[0]), sub(a[1], b[1]), sub(a[2], b[2])];
export const vScale = (a, s) => [scale(a[0], s), scale(a[1], s), scale(a[2], s)];
/** Componentwise multiply by one interval scalar. */
export const vMulI = (a, s) => [mul(a[0], s), mul(a[1], s), mul(a[2], s)];
export const vHull = (a, b) => (a === null ? b : [hull(a[0], b[0]), hull(a[1], b[1]), hull(a[2], b[2])]);
/** `meet` per component; null if any component's two enclosures do not meet. */
export function vMeet(a, b) {
  const out = [meet(a[0], b[0]), meet(a[1], b[1]), meet(a[2], b[2])];
  return out.every((x) => x !== null) ? out : null;
}
export const dot = (a, b) => add(add(mul(a[0], b[0]), mul(a[1], b[1])), mul(a[2], b[2]));

/**
 * The cross product, componentwise, with no attempt to be clever.
 *
 * Each component is a difference of two products, so where the two nearly
 * cancel -- two nearly parallel or nearly antiparallel vectors -- the
 * result is wide in RELATIVE terms. That is not a defect of this routine
 * but a true statement about what the inputs determine, and the callers
 * that care (solar deflection near conjunction) test the resulting
 * enclosure rather than assuming it is tight.
 */
export const cross = (a, b) => [
  sub(mul(a[1], b[2]), mul(a[2], b[1])),
  sub(mul(a[2], b[0]), mul(a[0], b[2])),
  sub(mul(a[0], b[1]), mul(a[1], b[0])),
];

/**
 * [min |v|, max |v|] over the vector interval. Both ends are true.
 *
 * `sqrt` of the sum of squares, not `Math.hypot`: see the note in
 * frames.mjs. `sqrt` is correctly rounded and agrees between engines;
 * `hypot` is neither, and a bound that moves with the engine is not a
 * bound. Each square carries at most one ulp of relative error and the
 * two sums one each, which `sqrt` then halves, so PAD's eight units
 * covers the whole chain with room to spare. Overflow is not a concern
 * at these magnitudes -- kilometres, so the squares reach about 1e20
 * against a double's 1.8e308.
 */
export function norm(v) {
  const sq = (x) => x * x;
  const hi = Math.sqrt(sq(mag(v[0])) + sq(mag(v[1])) + sq(mag(v[2])));
  const lo = Math.sqrt(sq(mig(v[0])) + sq(mig(v[1])) + sq(mig(v[2])));
  return widen(lo, hi);
}

/** The largest |v| a vector interval allows, as a plain number. */
export const vMag = (v) => norm(v).hi;
