/**
 * Chebyshev fitting and evaluation for the compiler.
 *
 * Everything works in position/state VECTORS (km, km/s) in the kernel's own
 * J2000 equatorial frame. No angle is ever fitted, so there is no wrapped-angle
 * artifact to reason about; angles are formed only at the very end of the
 * reduction, from vectors.
 *
 * ## Why the cosines are computed here (compiler 2.0.0)
 *
 * Compiler 1.x took every node and every DCT weight from `Math.cos`, which
 * ECMAScript leaves "implementation-approximated". The same kernel compiled
 * by the same 1.1.0 source gave payload SHA-256 `0a218764...` on the audit's
 * machine and `0c7e1c93...` on an arm64 Mac running Node 22.22.2: the fitted
 * coefficients differed in their last bits, and some quantised integers moved
 * with them. `cosPi` below uses only `+`, `-`, `*` and `/` on doubles, after
 * an exact integer reduction, so every IEEE-754 engine computes the same
 * bits and the payload digest is a property of the kernel and the settings
 * alone. It is not more accurate than `Math.cos`; it is the same everywhere.
 */

/**
 * cos(pi * num / den) for integers num >= 0 and den >= 1, from arithmetic
 * alone. The argument is reduced in integers (exact), folded into [0, pi/4]
 * by the symmetries of the cosine, and the reduced value goes through a
 * Taylor polynomial whose truncation error is below 4e-26 there.
 */
export function cosPi(num, den) {
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den) || num < 0 || den < 1) {
    throw new RangeError(`cosPi needs integers num >= 0 and den >= 1, got ${num}/${den}`);
  }
  // Work in units of pi / (4 den): the octant boundaries are then integers.
  const full = 8 * den;
  let r = (4 * num) % full;                  // angle in [0, 2 pi)
  if (r > full / 2) r = full - r;            // cos(2 pi - x) = cos x
  let sign = 1;
  if (r > full / 4) { r = full / 2 - r; sign = -1; }   // cos(pi - x) = -cos x
  if (r > full / 8) {
    // cos(x) = sin(pi/2 - x), and pi/2 - x lies in [0, pi/4)
    return sign * sinSmall((Math.PI * (full / 4 - r)) / full * 2);
  }
  return sign * cosSmall((Math.PI * r) / full * 2);
}

/** sin x for |x| <= pi/4: Taylor to x^23, Horner, fixed order. */
function sinSmall(x) {
  const x2 = x * x;
  let p = SIN_COEF[0];
  for (let i = 1; i < SIN_COEF.length; i += 1) p = p * x2 + SIN_COEF[i];
  return p * x;
}

/** cos x for |x| <= pi/4: Taylor to x^22, Horner, fixed order. */
function cosSmall(x) {
  const x2 = x * x;
  let p = COS_COEF[0];
  for (let i = 1; i < COS_COEF.length; i += 1) p = p * x2 + COS_COEF[i];
  return p;
}

// (-1)^k / (2k+1)! and (-1)^k / (2k)! for k = 11 down to 0, in the order
// Horner consumes them. The first omitted terms, x^25/25! and x^24/24! at
// x = pi/4, are below 2e-28 and 6e-26.
const SIN_COEF = [
  -1 / 25852016738884976640000, 1 / 51090942171709440000, -1 / 121645100408832000,
  1 / 355687428096000, -1 / 1307674368000, 1 / 6227020800, -1 / 39916800,
  1 / 362880, -1 / 5040, 1 / 120, -1 / 6, 1,
];
const COS_COEF = [
  -1 / 1124000727777607680000, 1 / 2432902008176640000, -1 / 6402373705728000,
  1 / 20922789888000, -1 / 87178291200, 1 / 479001600, -1 / 3628800,
  1 / 40320, -1 / 720, 1 / 24, -1 / 2, 1,
];

const NODE_CACHE = new Map();
const DCT_CACHE = new Map();

/** Chebyshev-Gauss nodes on [-1,1], descending, as the DCT-II convention wants. */
export function chebNodes(m) {
  let x = NODE_CACHE.get(m);
  if (!x) {
    x = new Float64Array(m);
    for (let j = 0; j < m; j += 1) x[j] = cosPi(2 * j + 1, 2 * m);
    NODE_CACHE.set(m, x);
  }
  return x;
}

/** cos(pi k (j + 1/2) / m) for k, j < m, row-major by k. */
function dctTable(m) {
  let t = DCT_CACHE.get(m);
  if (!t) {
    t = new Float64Array(m * m);
    for (let k = 0; k < m; k += 1) {
      for (let j = 0; j < m; j += 1) t[k * m + j] = cosPi(k * (2 * j + 1), 2 * m);
    }
    DCT_CACHE.set(m, t);
  }
  return t;
}

/**
 * Coefficients of the degree-(m-1) Chebyshev interpolant through f at the m
 * Chebyshev-Gauss nodes. `f` is sampled as f[j] for node j.
 * Convention matches SPK type 2: p(tau) = sum_k c_k T_k(tau), c_0 NOT halved.
 */
export function chebFit(fvals, m) {
  const c = new Float64Array(m);
  const t = dctTable(m);
  for (let k = 0; k < m; k += 1) {
    let s = 0;
    for (let j = 0; j < m; j += 1) s += fvals[j] * t[k * m + j];
    c[k] = (2 / m) * s;
  }
  c[0] *= 0.5;
  return c;
}

/** Clenshaw evaluation of sum_k c_k T_k(tau) over c[off..off+n-1]. */
export function clenshaw(c, off, n, tau) {
  let b1 = 0; let b2 = 0;
  const t2 = 2 * tau;
  for (let k = n - 1; k >= 1; k -= 1) {
    const b0 = t2 * b1 - b2 + c[off + k];
    b2 = b1; b1 = b0;
  }
  return tau * b1 - b2 + c[off];
}

/** Clenshaw for value and d/dtau together. */
export function clenshawD(c, off, n, tau, out) {
  let b1 = 0; let b2 = 0; let d1 = 0; let d2 = 0;
  const t2 = 2 * tau;
  for (let k = n - 1; k >= 1; k -= 1) {
    const b0 = t2 * b1 - b2 + c[off + k];
    const d0 = t2 * d1 - d2 + 2 * b1;
    b2 = b1; b1 = b0; d2 = d1; d1 = d0;
  }
  out[0] = tau * b1 - b2 + c[off];
  out[1] = b1 + tau * d1 - d2;
  return out;
}
