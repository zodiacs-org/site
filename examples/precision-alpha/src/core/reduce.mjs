/**
 * Apparent-place reduction. ONE implementation, shared by every environment
 * and by every measurement configuration.
 *
 * It talks to a backend through a two-method interface, so the same numerical
 * rules run over the compact pack (`Ephemeris`) and over the uncompressed
 * research kernel reader without a second copy of the physics:
 *
 *   backend.state(body, et, out6) -> out6   barycentric ICRF km, km/s at TDB
 *                                           seconds past J2000
 *   backend.covers(et)            -> boolean
 *
 * Every modelling choice is an explicit switch. `PROTOTYPE` reproduces the
 * earlier prototype's conventions exactly, `CORRECTED` is what this package
 * ships; the four-configuration measurement runs this same file with both.
 *
 * Positions come from a JPL DE kernel. Precession, nutation and frame bias
 * come from the published IAU series (see `./nutation.mjs` for provenance).
 * Nothing here is derived from Swiss Ephemeris code, data or output.
 *
 * Environment-neutral: no `node:` imports, no `Buffer`, no filesystem.
 */
import { fail } from './errors.mjs';
import { npbMatrix, apply, equToEcl, eclipticLonLatDeg } from './frames.mjs';
import { BARYCENTRE_NOT_CENTRE } from './ephemeris.mjs';

const AU_KM = 149597870.700;
const LIGHT_TIME_AU = 499.004783836;          // seconds per au, IAU 2009
const C_KM_S = AU_KM / LIGHT_TIME_AU;
const DAY = 86400;
/** Half the step of the central difference that gives the Earth-Moon barycentre's acceleration, seconds. */
const LUNAR_ACCELERATION_STEP_SEC = 60;
/** Schwarzschild radius of the Sun divided by the astronomical unit, radians. */
const SRS = 1.97412574336e-8;

/**
 * Exactly what this reduction supports. Anything not named here is out of
 * contract, and `apparent()` refuses an unknown body or option rather than
 * quietly doing something else.
 */
export const CONTRACT = Object.freeze({
  bodies: Object.freeze(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']),
  /** Named routes that are a planetary-SYSTEM barycentre, not the body centre. */
  barycentreNotCentre: BARYCENTRE_NOT_CENTRE,
  /** What `apparent()` returns. */
  coordinates: 'apparent geocentric ecliptic longitude and latitude of date (degrees), true equinox and equator of date, plus the geometric geocentric distance in km',
  /**
   * Velocity is available from the backend as the analytic Chebyshev
   * derivative (km/s, barycentric ICRF). The reduction itself uses it for the
   * observer, and `apparent()` reports no apparent angular rate: the search
   * differentiates longitude numerically over the reduction as a whole,
   * because an apparent rate consistent with light-time and aberration is not
   * simply the state derivative rotated.
   */
  velocities: 'barycentric ICRF state derivative (km/s) from the backend; no apparent angular rate is reported',
  corrections: Object.freeze([
    'TDB-TT (two-term Astronomical Almanac form, |error| < 30 us)',
    'light-time iteration to a caller-set tolerance',
    'gravitational light deflection by the Sun (eraLd form)',
    'annual aberration (special-relativistic, or first-order as a switch)',
    'IAU 2000 frame bias ICRF -> dynamical mean equinox of J2000',
    'IAU 2006 precession (Fukushima-Williams, eraPfw06/eraFw2m)',
    'IAU 2000B nutation, 77 published luni-solar terms, adjusted to P03',
  ]),
  notModelled: Object.freeze([
    'diurnal (topocentric) parallax and diurnal aberration: the observer is the geocentre',
    'atmospheric refraction',
    'deflection by any body other than the Sun',
    'Delta-T: the caller supplies TT, not UTC',
    'physical body centres for Mars outward (see barycentreNotCentre)',
  ]),
  /**
   * Barycentric POSITION is deliberately outside the contract, and this is
   * the reason rather than an oversight. The compression work declared a
   * 0.2 km target on the barycentric Moon and missed it: sampled 0.165 km,
   * but PROVEN 0.449 km, and the target is on the bound. The geocentric
   * path is a different quantity and is inside the target (0.00946 km
   * sampled, 0.0224 km proven), because the EMB term cancels against the
   * observer -- not because two independent errors happened to be small.
   * Earth and Moon come from the same two stored bodies through the pack's
   * EMRAT, so their errors are correlated and no geocentric bound may be
   * built by adding them as if they were not.
   */
  barycentricPositionExcluded: Object.freeze({
    excluded: true,
    target: '0.2 km on the barycentric Moon (PREREGISTRATION.md T6)',
    recordedSampledKm: 0.165,
    recordedProvenBoundKm: 0.449,
    verdict: 'target missed on the proven bound; barycentric position is not offered',
    source: 'docs/platform/evidence/precision-2026-09-20/compiler/RESULTS.md, candidate D',
  }),
});

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
// Not Math.hypot: see the note in frames.mjs on cross-engine reproducibility.
const norm = (v) => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
const scale = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
const unit = (v) => scale(v, 1 / norm(v));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** What this package ships. */
export const CORRECTED = Object.freeze({
  nutation: '2000b',             // published 77-term IAU 2000B
  bias: true,                    // ICRF -> dynamical J2000 frame bias
  aberration: 'full',            // 'none' | 'first' | 'full'
  deflection: 'sun',             // 'none' | 'sun'
  timescale: 'tdb',              // 'tt' treats TT as TDB, as the prototype does
  observerVelocity: 'analytic',  // 'analytic' | 'central60' | 'central600'
  lightTimeIters: 12,
  lightTimeTolSec: 1e-11,
  deflectionLimit: 1e-14,
});
/** The earlier prototype's contract, for a like-for-like baseline. */
export const PROTOTYPE = Object.freeze({
  nutation: 'ae', bias: false, aberration: 'first', deflection: 'none',
  timescale: 'tt', observerVelocity: 'central60', lightTimeIters: 5, lightTimeTolSec: 1e-9,
  deflectionLimit: 1e-14,
});

const OPTION_VALUES = {
  nutation: ['2000b', 'ae', 'none'],
  aberration: ['full', 'first', 'none'],
  deflection: ['sun', 'none'],
  timescale: ['tdb', 'tt'],
  observerVelocity: ['analytic', 'central60', 'central600'],
};

function resolveOptions(options) {
  const o = { ...CORRECTED, ...options };
  for (const key of Object.keys(o)) {
    if (!(key in CORRECTED)) fail('unsupported-option', `unknown reduction option ${key}`);
  }
  for (const [key, allowed] of Object.entries(OPTION_VALUES)) {
    if (!allowed.includes(o[key])) {
      fail('unsupported-option', `${key} must be one of ${allowed.join(', ')}, got ${JSON.stringify(o[key])}`);
    }
  }
  if (typeof o.bias !== 'boolean') fail('unsupported-option', 'bias must be a boolean');
  for (const key of ['lightTimeIters', 'lightTimeTolSec', 'deflectionLimit']) {
    if (!Number.isFinite(o[key]) || o[key] <= 0) fail('unsupported-option', `${key} must be a positive finite number`);
  }
  if (!Number.isInteger(o.lightTimeIters) || o.lightTimeIters > 1000) {
    fail('unsupported-option', 'lightTimeIters must be an integer <= 1000');
  }
  return o;
}

/** TDB - TT, seconds. Two-term Astronomical-Almanac form; |error| < 30 us. */
export function tdbMinusTt(jdTt) {
  const g = (357.53 + 0.9856003 * (jdTt - 2451545.0)) * Math.PI / 180;
  const l = (246.11 + 0.90251792 * (jdTt - 2451545.0)) * Math.PI / 180;
  return 0.001658 * Math.sin(g) + 0.000014 * Math.sin(2 * g) + 0.0000224 * Math.sin(l);
}

export class Reducer {
  /** @param {{state: Function, covers: Function}} backend */
  constructor(backend) {
    if (!backend || typeof backend.state !== 'function' || typeof backend.covers !== 'function') {
      fail('unsupported-option', 'backend must provide state(body, et, out) and covers(et)');
    }
    this.backend = backend;
    this.a = new Float64Array(6);
    this.b = new Float64Array(6);
    this.c = new Float64Array(6);
    this.emb = new Float64Array(6);
    this.moon = new Float64Array(6);
    this.earth = new Float64Array(6);
  }

  /**
   * For the geocentric Moon (P4.1's preregistration; audit finding
   * alpha-reduction-math-8): the Earth relative to the Earth-Moon barycentre
   * at et, and the barycentre's velocity and its acceleration there, the
   * acceleration as a central difference of the velocity over +-60 s.
   */
  #lunarBasis(et) {
    this.backend.lunar(et + LUNAR_ACCELERATION_STEP_SEC, this.emb, this.moon, this.earth);
    const after = [this.emb[3], this.emb[4], this.emb[5]];
    this.backend.lunar(et - LUNAR_ACCELERATION_STEP_SEC, this.emb, this.moon, this.earth);
    const before = [this.emb[3], this.emb[4], this.emb[5]];
    this.backend.lunar(et, this.emb, this.moon, this.earth);
    const span = 2 * LUNAR_ACCELERATION_STEP_SEC;
    return {
      earth: [this.earth[0], this.earth[1], this.earth[2]],
      embVelocity: [this.emb[3], this.emb[4], this.emb[5]],
      embAcceleration: [(after[0] - before[0]) / span, (after[1] - before[1]) / span, (after[2] - before[2]) / span],
    };
  }

  /**
   * MoonRelEMB(emission) - EarthRelEMB(et) + [EMB(emission) - EMB(et)], the
   * bracket as -v tau + a tau^2 / 2, so the barycentre's 30 km/s never
   * multiplies the rounding of the double et - tau.
   */
  #geocentricMoon(emission, tau, basis) {
    this.backend.lunar(emission, this.emb, this.moon, this.earth);
    const m = [this.moon[0], this.moon[1], this.moon[2]];
    const v = basis.embVelocity;
    const acc = basis.embAcceleration;
    const e = basis.earth;
    return [
      m[0] - e[0] + (-v[0] * tau + 0.5 * acc[0] * tau * tau),
      m[1] - e[1] + (-v[1] * tau + 0.5 * acc[1] * tau * tau),
      m[2] - e[2] + (-v[2] * tau + 0.5 * acc[2] * tau * tau),
    ];
  }

  #pos(body, et, buf) {
    this.backend.state(body, et, buf);
    return [buf[0], buf[1], buf[2]];
  }

  #velCentral(body, et, h) {
    const a = this.#pos(body, et - h, this.b);
    const b = this.#pos(body, et + h, this.c);
    return [(b[0] - a[0]) / (2 * h), (b[1] - a[1]) / (2 * h), (b[2] - a[2]) / (2 * h)];
  }

  /**
   * Apparent geocentric place of `body` at `ttDays` (TT days past J2000 —
   * Delta-T is the caller's problem), with full diagnostics.
   *
   * `options.offsetKm` adds a constant km vector to the target's barycentric
   * position at the EMISSION epoch. It exists so a planetary-system barycentre
   * can be turned into a body centre by a satellite ephemeris and the two
   * differenced through identical code; it is not part of the shipped contract.
   */
  apparent(body, ttDays, options = {}) {
    const { offsetKm, ...rest } = options;
    if (offsetKm !== undefined && (!Array.isArray(offsetKm) || offsetKm.length !== 3 || !offsetKm.every(Number.isFinite))) {
      fail('unsupported-option', 'offsetKm must be three finite numbers');
    }
    const o = resolveOptions(rest);
    if (!CONTRACT.bodies.includes(body)) fail('unknown-body', `${body} is not in this reduction's contract`);
    if (!Number.isFinite(ttDays)) fail('bad-instant', 'ttDays must be a finite number');

    const jdTt = ttDays + 2451545.0;
    const et = o.timescale === 'tdb' ? ttDays * DAY + tdbMinusTt(jdTt) : ttDays * DAY;
    const t = ttDays / 36525;

    if (!this.backend.covers(et)) {
      fail('out-of-coverage', 'the requested instant is outside the pack\'s coverage', { et });
    }

    const target = (e) => {
      const v = this.#pos(body, e, this.a);
      return offsetKm ? addv(v, offsetKm) : v;
    };

    this.backend.state('Earth', et, this.b);
    const observer = [this.b[0], this.b[1], this.b[2]];
    let observerVel;
    if (o.observerVelocity === 'analytic') observerVel = [this.b[3], this.b[4], this.b[5]];
    else observerVel = this.#velCentral('Earth', et, o.observerVelocity === 'central600' ? 600 : 60);

    // The Moon, from a backend that gives the Earth-Moon system's parts, is
    // formed from them (#geocentricMoon); every other target as before.
    const lunar = body === 'Moon' && offsetKm === undefined && typeof this.backend.lunar === 'function'
      ? this.#lunarBasis(et) : null;
    const geoAt = (tau) => (lunar ? this.#geocentricMoon(et - tau, tau, lunar) : sub(target(et - tau), observer));

    // Light-time iteration.
    let tau = 0;
    let geo = geoAt(0);
    let iters = 0;
    let converged = false;
    for (let i = 0; i < o.lightTimeIters; i += 1) {
      iters = i + 1;
      const next = (norm(geo) / AU_KM) * LIGHT_TIME_AU;
      if (Math.abs(next - tau) < o.lightTimeTolSec) { tau = next; converged = true; break; }
      tau = next;
      if (!this.backend.covers(et - tau)) {
        fail('out-of-coverage', 'the light-time lookback reaches outside the pack\'s coverage', { et: et - tau });
      }
      geo = geoAt(tau);
    }
    const geometric = geo;
    const distKm = norm(geo);

    // Gravitational light deflection by the Sun (eraLd form).
    let p = unit(geo);
    let limited = false;
    if (o.deflection === 'sun' && body !== 'Sun') {
      const sunAtRecv = this.#pos('Sun', et, this.c);
      const eVec = sub(observer, sunAtRecv);            // Sun -> observer
      const emAu = norm(eVec) / AU_KM;
      const e = unit(eVec);
      // Sun -> source, at the emission time the light-time iteration found.
      const sunAtEmit = this.#pos('Sun', et - tau, this.c);
      const q = unit(sub(addv(observer, geo), sunAtEmit));
      // q.(q+e) collapses towards zero as the ray grazes the Sun. ERFA's
      // eraLdsun clamps it at 1e-6, which silently caps the deflection at
      // roughly a tenth of an arcsecond. The clamp is kept (the formula
      // diverges) but set far below the solar limb, and the caller is told
      // when it bound.
      const qdqpe = dot(q, addv(q, e));
      const dlim = o.deflectionLimit;
      limited = qdqpe < dlim;
      const w = SRS / emAu / Math.max(qdqpe, dlim);
      const peq = cross(p, cross(e, q));
      p = unit(addv(p, scale(peq, w)));
    }

    // Annual aberration.
    if (o.aberration !== 'none') {
      const v = scale(observerVel, 1 / C_KM_S);         // v/c
      if (o.aberration === 'first') {
        p = unit(addv(p, v));
      } else {
        // Special-relativistic form (eraAb, without the gravitational-potential
        // bm1 refinement beyond 1/sqrt(1-v^2)).
        const v2 = dot(v, v);
        const bm1 = Math.sqrt(1 - v2);
        const pdv = dot(p, v);
        const w1 = 1 + pdv / (1 + bm1);
        const r = [0, 0, 0];
        for (let i = 0; i < 3; i += 1) r[i] = (bm1 * p[i] + w1 * v[i]) / (1 + pdv);
        p = unit(r);
      }
    }

    // A place that is not finite is a geometry this reduction cannot
    // describe -- the target on the observer, or the Sun on the observer
    // with deflection on -- and it must say so with a code rather than
    // hand back a NaN for something downstream to trip over.
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2]) || !Number.isFinite(distKm)) {
      fail('bad-geometry',
        `${body} has no determinable direction at this instant: the geometry is degenerate (a separation of zero, or the Sun on the observer with deflection enabled)`,
        { distKm, deflection: o.deflection });
    }

    const { matrix, epsTrue, dpsiArcsec, depsArcsec } = npbMatrix(t, { nutation: o.nutation, bias: o.bias });
    const ecl = equToEcl(apply(matrix, p), epsTrue);
    const { lon, lat } = eclipticLonLatDeg(ecl);
    return {
      body,
      isSystemBarycentre: BARYCENTRE_NOT_CENTRE.includes(body),
      lon,
      lat,
      distKm,
      lightTimeSec: tau,
      lightTimeIters: iters,
      lightTimeConverged: converged,
      deflectionLimiterBound: limited,
      emissionEt: et - tau,
      dpsiArcsec,
      depsArcsec,
      geometric,
    };
  }

  /** Apparent geocentric ecliptic longitude in degrees — the search's scalar. */
  longitude(body, ttDays, options) {
    return this.apparent(body, ttDays, options).lon;
  }
}
