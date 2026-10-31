/**
 * Solar gravitational light deflection: the pointwise transformation.
 *
 * Profile `zodiacs-deflected-of-date/1`. `DEFLECTION-PROFILE.md` is the
 * specification and was written before this file; where the two differ the
 * document is wrong and should be corrected, not this.
 *
 * ## What this is
 *
 * Given the light-time-corrected vector from observer to source, and the
 * Sun's position at each end of the ray, this returns the NATURAL
 * direction: where the source would be seen if the observer were at rest.
 * `aberration.mjs` takes it from there.
 *
 *     w = SRS / em / max(q . (q + e), dlim)
 *     D = d + w * (d x (e x q))
 *
 * which is ERFA's `eraLd` with `bm = 1`, pinned at
 * `tools/measure/erfa-deflection/ld.c`, sha256 affa41a6028f8f2e...
 *
 * ## Three things that are easy to get wrong
 *
 * **`d` is not normalised and must not be.** `eraLd` is LINEAR in its `p`:
 * `D = (I - w[e x q]_x) d`, because `w` depends only on `q`, `e`, `em` and
 * `dlim`. So rescaling `d` by `k` rescales `D` by the same `k`.
 *
 * The domain of that argument is `k > 0`, and the restriction is not
 * cosmetic: `k < 0` reverses `D` too, which moves a longitude by 180
 * degrees and flips the sign of every projection. The search's vector is
 * positive by construction (it is a light-time-corrected separation scaled
 * by a positive factor), and the tests assert both halves -- that `k > 0`
 * leaves the direction fixed and that `k < 0` does not.
 *
 * In floating point the rescaling is EXACT only for powers of two, where
 * every product and sum scales by the same exponent shift; for a general
 * `k` both sides round differently and the two agree to within a few ulps
 * instead. The tests separate those two claims rather than asserting the
 * stronger one everywhere. The property is ERFA's own, not an artefact of
 * this transliteration: the fixture carries `eraLd` run on the raw `d` and
 * on `unit(d)` separately, and the compiled reference is itself linear to
 * 2.75e-16 relative across all 358 cases.
 *
 * **`q` and `e` are normalised and must be.** They are not scale-free.
 * Rescaling `q` by a factor `lam` while leaving its direction alone
 * multiplies the deflection by `(1 + c) / (lam + c)`, `c = q_hat . e_hat`,
 * so the relative error it induces is `(1 - lam) / (lam + c)`. Since
 * `1 + c = 1 - cos(chi)` is about `chi^2 / 2` near conjunction, a fixed
 * relative error in `|q|` is amplified by roughly `2 / chi^2`: at
 * `lam = 1.0001` and a source at 5.2 au it costs 1.8162 per cent of the
 * deflection at 5 degrees of elongation (1.421e-3 arcsec of 0.078215) and
 * 83.6912 per cent at 0.3 degrees (1.092 arcsec of 1.304493). The two
 * square roots are not optional and there is no rearrangement that avoids
 * them. Tested against that law, not against a threshold.
 *
 * **This is finite-distance, not `eraLdsun`.** `eraLdsun` calls
 * `eraLd(1, p, p, e, em, dlim)` -- passing `p` for `q`, the distant-star
 * approximation. For a planet that is wrong by up to 1.5554 arcsec (Venus,
 * 0.3 degrees elongation, near branch). `q` here is the real Sun-to-source
 * direction at emission.
 *
 * ## What the limiter is
 *
 * `dlim` is `phi^2 / 2`, where `phi` is the angular separation at which
 * limiting BEGINS (`ld.c` Note 4). Below it the deflection is artificially
 * reduced toward zero -- so the limiter does not bound the error, it
 * replaces the model with a convention that goes the wrong way.
 *
 * It is NOT an error cap. A comment in `reduce.mjs` says ERFA's `dlim`
 * "silently caps the deflection at roughly a tenth of an arcsecond"; the
 * actual peak under `dlim = 1e-6` is 5.7586 arcsec, 57.6 times that and
 * 3.29 times a limb-grazing ray's 1.7512 arcsec. That comment is about the
 * released reducer and is left alone there; it is not repeated here.
 *
 * The supported domain below is set so the limiter NEVER fires inside it.
 * `limiterActive` is reported anyway, and if it is ever true the result is
 * outside the domain and says so.
 */
import { fail } from './errors.mjs';
import * as I from './interval.mjs';
import { sinCos, ABS_ERR } from './trig.mjs';
import { enter, leave } from './instrument.mjs';

/** Schwarzschild radius of the Sun divided by the au, radians. ERFA_SRS. */
export const SRS = 1.97412574336e-8;

/** IAU 2012 astronomical unit, km, exactly as the package's other modules use it. */
export const AU_KM = 1.495978707e8;

/**
 * Solar radius, km. IAU 2015 Resolution B3 nominal value.
 *
 * Stated because it moves the answer: 696000 puts the apparent limb at
 * 959.64 arcsec from 1 au and 695700 puts it at 959.23, and a domain test
 * that does not say which radius it used is not reproducible.
 */
export const SOLAR_RADIUS_KM = 6.957e5;

const DEG = Math.PI / 180;
const ARCSEC = Math.PI / (180 * 3600);

/**
 * The supported domain, as an elongation floor.
 *
 * Five degrees. `DEFLECTION-PROFILE.md` section 7 justifies it against four
 * boundaries that are NOT the same boundary; the binding ones are that it
 * is 18.45x the LARGEST apparent solar radius (975.53" at perihelion,
 * not the 959.23" at 1 au) and 61.7x the widest limiter
 * threshold, and that `eraLd`'s own omitted second-order term is a measured
 * 4.23e-7 arcsec there against 2.08e-3 arcsec at 0.3 degrees.
 */
export const MIN_ELONGATION_RAD = 5 * DEG;

/**
 * A rigorous LOWER bound on cos(MIN_ELONGATION_RAD), for the domain guard.
 *
 * The guard admits a cell only when `cos(elongation).hi <= this`. Using a
 * value below the true cosine makes that test stricter, so the error can
 * only reject a cell that was inside the domain and never admit one that
 * was outside. `sinCos` is the package's own validated cosine rather than
 * `Math.cos`, which ECMAScript leaves implementation-defined, and `ABS_ERR`
 * is its stated absolute bound.
 *
 * The cost of the conservatism is 4e-15 of cosine, which at five degrees is
 * 4.6e-14 radians -- about 1e-8 arcsec of elongation.
 */
export const COS_MIN_ELONGATION_GUARD = sinCos(5 * (Math.PI / 180)).c - ABS_ERR;

/**
 * A rigorous UPPER bound on cos(MIN_ELONGATION_RAD), for the EXCLUSION
 * verdict -- which is a different test needing the opposite rounding.
 *
 * Admitting a cell asks "is the elongation at least five degrees at every
 * instant?", and errs safely by using a cosine that may be too small.
 * Excluding one asks the opposite: "is it below five degrees at every
 * instant, so that no subdivision will ever help?" That needs
 * `cos(elongation).lo > cos(5 degrees)`, and a bound that may be too SMALL
 * makes it too easy to satisfy -- a cell whose minimum elongation sits in
 * the 4e-15 window just above five degrees could be reported as outside
 * the domain "at every instant" with `retry: false`, when part of it was
 * inside.
 *
 * For one release both tests shared `COS_MIN_ELONGATION_GUARD`. The
 * top-level verdict was safe either way -- the mode declined marginally
 * more than it had to -- but the excluded/unresolved classification and
 * the sentence attached to it were wrong at that margin, and those two are
 * the distinction this whole profile rests on. The window is far below any
 * test's resolution, so this is an argument rather than a measurement, and
 * it is the argument the two bounds exist to make.
 */
export const COS_MIN_ELONGATION_EXCLUDE = sinCos(5 * (Math.PI / 180)).c + ABS_ERR;

/**
 * The cosine of the solar elongation, over an interval. ONE definition.
 *
 * The observer sees the Sun along `-e`, so `cos(elongation) = -(e . d)/|d|`
 * with `e` the UNIT Sun-to-observer vector and `d` the light-time-corrected
 * observer-to-source vector. No inverse trigonometry: `cos` is decreasing
 * on [0, pi], so every comparison the domain needs is a comparison of
 * cosines, and `Math.acos` is implementation-defined anyway.
 *
 * This is exported, and `deflectInterval` calls it rather than inlining
 * it, because a second consumer now exists: `domain-partition.mjs`
 * classifies admissibility WITHOUT running the deflection. Two expressions
 * of one definition, kept in step by review, is exactly the drift this
 * profile cannot afford -- an admissibility pass that computed a slightly
 * different elongation would certify spans the deflection would then
 * refuse, and the refusal would arrive after the completeness claim.
 *
 * So the sharing is the guarantee. `deflection.nodetest.mjs` asserts that
 * the partition and the deflection agree BIT FOR BIT on the same geometry,
 * which is a check that this function is the only definition, not that two
 * definitions happen to agree today.
 *
 * @param {{lo:number,hi:number}[]} e     UNIT Sun -> observer, per component
 * @param {{lo:number,hi:number}[]} d     observer -> source, light-time corrected
 * @param {{lo:number,hi:number}}   dist  an enclosure of |d|
 */
export function elongationCosInterval(e, d, dist) {
  return I.neg(I.div(I.dot(e, d), dist));
}

/**
 * The same cosine over a span, in CENTRED form: its enclosure at the
 * span's midpoint, plus the most it can move from there.
 *
 * It is the same quantity, not a second definition: the midpoint value is
 * `elongationCosInterval` itself, on enclosures of `e` and `d` at one
 * instant. What changes is how the span is covered. The interval form
 * above composes span-wide enclosures of `e` and `d`, and because `d`
 * appears in the numerator and the denominator and each product is
 * enclosed on its own, it measured about 2,900 times the cosine's true
 * variation over a 60-second Moon cell, whatever the cell's width. The
 * mean-value form below has the true variation's own scaling.
 *
 * The rate. Write g = e . d/|d| = cos(E), E the angle between the unit
 * vectors. Then g' = e' . dh + e . dh', with dh = d/|d|, e' perpendicular
 * to e and dh' perpendicular to dh. So e' . dh = e' . (dh - (dh . e) e)
 * and e . dh' = (e - (e . dh) dh) . dh', and both bracketed vectors have
 * length sin E. Hence |g'| <= (|e'| + |dh'|) sin E, with |e'| <= |u'|/|u|
 * for e = u/|u| and |dh'| <= |d'|/|d|. The caller supplies
 * `rate >= |e'| + |dh'|` over the whole span; sin E is bounded here from
 * `cosOver`, an enclosure of the cosine over the same span.
 *
 * Sound only where e and d are differentiable across the span: the
 * caller must not use it over a window that crosses a record boundary of
 * any series it rests on (`withinOneRecord`).
 *
 * @param {{lo:number,hi:number}}   cosMid  the cosine's enclosure at the midpoint
 * @param {{lo:number,hi:number}}   cosOver an enclosure of the cosine over the span
 * @param {number} rate  an upper bound on |e'| + |dh'| over the span, 1/s
 * @param {number} half  the largest distance from the midpoint to an end, s
 */
export function elongationCosCentred(cosMid, cosOver, rate, half) {
  if (!(rate >= 0) || !(half >= 0) || !Number.isFinite(rate) || !Number.isFinite(half)) return null;
  // The smallest |cos| over the span bounds sin E from above. The interval
  // form can exceed [-1, 1]; the true cosine cannot.
  const m = I.mig({ lo: Math.max(cosOver.lo, -1), hi: Math.min(cosOver.hi, 1) });
  const s2 = I.sub(I.iv(1), I.mul(I.iv(m), I.iv(m)));
  const sinMax = Math.min(1, Math.sqrt(Math.max(0, s2.hi)) * (1 + 2 * I.PAD));
  const reach = rate * half * sinMax * (1 + 4 * I.PAD);
  return I.add(cosMid, I.iv(-reach, reach));
}

/**
 * The verdict the floor gives on an elongation-cosine enclosure.
 *
 * Three answers, and the two bounds that decide them are DIFFERENT
 * constants pointing in opposite directions -- admitting needs a lower
 * bound on cos(5 degrees) and excluding needs an upper one. Sharing one
 * constant between them was a real defect, caught in review, and putting
 * the pair in one function is how it stays fixed: a caller cannot pick the
 * wrong bound because a caller does not pick.
 */
export function classifyElongationCos(cosPhi) {
  if (cosPhi.hi <= COS_MIN_ELONGATION_GUARD) return 'admissible';
  if (cosPhi.lo > COS_MIN_ELONGATION_EXCLUDE) return 'excluded';
  return 'boundary';
}

/** What the profile declares about itself, for the result's metadata. */
export const DEFLECTION_PROFILE = Object.freeze({
  id: 'zodiacs-deflected-of-date/1',
  deflectors: Object.freeze(['Sun']),
  form: 'eraLd with bm = 1, finite-distance source geometry (q is the real Sun-to-source direction at emission, NOT eraLdsun\'s q = p distant-star approximation)',
  srs: SRS,
  solarRadiusKm: SOLAR_RADIUS_KM,
  limiter: 'dlim = 1e-6 / max(em^2, 1), ERFA eraLdsun\'s own. dlim is phi^2/2, the angular separation at which limiting BEGINS -- not an error cap. Below it the deflection is artificially reduced toward zero. The supported domain is set so it never fires inside it; limiterActive is reported regardless.',
  minElongationDeg: 5,
  epochs: 'e and em from the observer and Sun at RECEPTION; q from the source and Sun at EMISSION. ld.c Note 3 prefers the deflector at the ray\'s closest approach; the split used here is within 3.13e-10 arcsec of that, against 1.96e-5 arcsec for the simpler reception-for-both.',
  notApplied: Object.freeze([
    'deflection by any body other than the Sun',
    'the second-order term eraLd itself omits: a measured 2.08e-3 arcsec at 0.3 deg elongation, 4.23e-7 arcsec at 5 deg, 4.97e-8 arcsec at 10 deg, against an independent ray integration. A property of the MODEL, not of this implementation',
    'the Klioner solar-potential term inside the aberration, which is a DIFFERENT term in a different transformation and stays off',
    'Shapiro (relativistic) delay',
    'topocentric parallax, diurnal aberration, refraction',
  ]),
});

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
/**
 * `Math.sqrt` of the sum of squares, never `Math.hypot` -- the core-wide
 * rule, stated in `frames.mjs`: `sqrt` is correctly rounded and agrees
 * between engines, `hypot` is neither.
 *
 * It is observable here and not merely a principle. ERFA leaves
 * normalisation to the caller, so the norm routine is part of this
 * module's contract rather than the reference's. Generating the comparison
 * fixture with `hypot` instead put 14 of 792 components up to 4 ulp away
 * from the compiled `eraLd`; with `sqrt` all 792 are bit-identical.
 */
const norm = (a) => Math.sqrt(dot(a, a));

/** The limiter for an observer `emAu` from the deflector. ERFA eraLdsun's. */
export const deflectionLimit = (emAu) => 1e-6 / Math.max(emAu * emAu, 1);

/**
 * Where this geometry sits relative to the four boundaries of section 7.
 *
 * They are four different boundaries and the code keeps them apart:
 * the model is defined wherever phi > 0; the limiter is active below its
 * own threshold; the line of sight is obstructed below the APPARENT solar
 * radius, which is not a constant -- it runs 943.5 to 975.5 arcsec over a
 * year as the Earth's distance changes; and the supported domain is
 * narrower than all of them.
 *
 * @param {number[]} d     observer -> source, light-time corrected, any length
 * @param {number[]} eVec  Sun -> observer at reception, km, any length
 */
export function deflectionDomain(d, eVec) {
  const dn = norm(d);
  const en = norm(eVec);
  if (!(dn > 0) || !(en > 0)) {
    return {
      supported: false,
      reason: 'degenerate',
      detail: 'the source is on the observer, or the observer is at the centre of the Sun',
    };
  }
  // Elongation: the angle at the OBSERVER between the Sun and the source.
  // The observer sees the Sun along -eVec.
  const toSun = [-eVec[0], -eVec[1], -eVec[2]];
  // atan2 of the cross and dot magnitudes, which is well conditioned at
  // both ends, unlike acos of a dot.
  const elongationRad = Math.atan2(norm(cross(toSun, d)), dot(toSun, d));
  const emAu = en / AU_KM;
  const apparentSolarRadiusRad = Math.asin(Math.min(1, SOLAR_RADIUS_KM / en));
  const limiterThresholdRad = 2 * Math.asin(Math.sqrt(deflectionLimit(emAu) / 2));
  return {
    supported: elongationRad >= MIN_ELONGATION_RAD,
    reason: elongationRad >= MIN_ELONGATION_RAD ? null : 'elongation-below-floor',
    elongationRad,
    elongationDeg: elongationRad / DEG,
    elongationArcsec: elongationRad / ARCSEC,
    emAu,
    apparentSolarRadiusArcsec: apparentSolarRadiusRad / ARCSEC,
    limiterThresholdArcsec: limiterThresholdRad / ARCSEC,
    minElongationArcsec: MIN_ELONGATION_RAD / ARCSEC,
    obstructed: elongationRad < apparentSolarRadiusRad,
    withinLimiter: elongationRad < limiterThresholdRad,
  };
}

/**
 * Apply solar deflection to a light-time-corrected vector.
 *
 * @param {number[]} d     observer -> source, light-time corrected, km.
 *                         NOT normalised, and the result carries its length.
 * @param {number[]} eVec  Sun -> observer at RECEPTION, km
 * @param {number[]} qVec  Sun -> source at EMISSION, km
 * @param {{enforceDomain?: boolean}} [opts]
 * @returns {{D: number[], u: number[], w: number, qdqpe: number,
 *            limiterActive: boolean, emAu: number, domain: object}}
 *          `u` is the perturbation, `D - d`. It is returned because
 *          recovering it by subtracting is a catastrophic cancellation --
 *          see `deflectionAngleOf`.
 */
export function deflect(d, eVec, qVec, opts = {}) {
  const { enforceDomain = true } = opts;
  const en = norm(eVec);
  const qn = norm(qVec);
  if (!(en > 0)) fail('bad-geometry', 'the observer is at the centre of the deflecting body');
  if (!(qn > 0)) fail('bad-geometry', 'the source is at the centre of the deflecting body');
  if (!(norm(d) > 0)) fail('bad-geometry', 'the source is on the observer');

  const domain = deflectionDomain(d, eVec);
  if (enforceDomain && !domain.supported) {
    fail('out-of-domain',
      `solar elongation ${domain.elongationArcsec === undefined ? '(degenerate)' : domain.elongationArcsec.toFixed(3)} arcsec is inside the ${domain.minElongationArcsec ?? 18000} arcsec floor this profile supports`
      + `${domain.obstructed ? '; the line of sight is obstructed by the solar disc' : ''}`
      + `${domain.withinLimiter ? '; the deflection limiter would be active' : ''}`,
      { domain });
  }

  // q and e MUST be unit. d must not be touched.
  const e = [eVec[0] / en, eVec[1] / en, eVec[2] / en];
  const q = [qVec[0] / qn, qVec[1] / qn, qVec[2] / qn];
  const emAu = en / AU_KM;

  const qdqpe = dot(q, [q[0] + e[0], q[1] + e[1], q[2] + e[2]]);
  const dlim = deflectionLimit(emAu);
  const limiterActive = qdqpe < dlim;
  const w = SRS / emAu / Math.max(qdqpe, dlim);

  const eq = cross(e, q);
  const deq = cross(d, eq);
  // Hoisted rather than inlined into `D` so the perturbation survives for
  // `deflectionAngleOf`. ECMAScript rounds every operation individually --
  // there is no FMA contraction to lose -- so `D` is bit-identical either
  // way, which the fixture comparison would catch if it were not.
  const u = [w * deq[0], w * deq[1], w * deq[2]];
  return {
    D: [d[0] + u[0], d[1] + u[1], d[2] + u[2]],
    u,
    w,
    qdqpe,
    dlim,
    limiterActive,
    emAu,
    domain,
  };
}

/**
 * The deflection ANGLE between two directions, radians.
 *
 * `atan2(|a x b|, a . b)` rather than `acos` of a normalised dot: the
 * latter loses three digits at small angles, which was enough to put an
 * early measurement 0.3 per cent out at one arcsecond of separation.
 *
 * Use this to compare two INDEPENDENT directions. Do NOT use it to measure
 * how far `deflect` moved its input -- `deflectionAngleOf` does that, and
 * the reason is in its note.
 */
export function deflectionAngle(a, b) {
  return Math.atan2(norm(cross(a, b)), dot(a, b));
}

/**
 * How far `deflect` moved its input, radians, from the result it returned.
 *
 * `atan(|u| / |d|)`, using the perturbation directly. `u` is perpendicular
 * to `d` by construction (`u` is a multiple of `d x (e x q)`), so the two
 * legs are the opposite and adjacent sides of a right triangle and no
 * angle-between routine is needed.
 *
 * ## Why not `deflectionAngle(d, D)`
 *
 * Because `D = d + u` with `|u| / |d|` around 1e-10 to 1e-15 in this
 * regime, so forming `d x D` subtracts two nearly equal products and
 * throws away everything the answer is made of. The relative error of that
 * route is bounded by about `eps |d| / |u|`, which is 2.96e-6 at the
 * fixture's worst case; measured, it runs at about a fifteenth of that
 * bound (1.98e-7), and it put an earlier closed-form comparison 5.9e-8 out
 * and looked like a disagreement between two models when it was an
 * artefact of the measuring instrument. This route agrees with the
 * independent closed form to 3.95e-9 relative over all 358 fixture cases
 * -- 5.79e-13 over the ones inside the supported domain -- and to 1.5e-16,
 * one ulp, at the case where the other route showed 5.9e-8.
 *
 * Those five figures come from
 * `docs/platform/evidence/precision-deflection/pointwise/claims.json`,
 * which `tools/measure/erfa-deflection/measure-claims.mjs` regenerates.
 * They were stale here for one round -- the fixture grew from 264 cases to
 * 358 and nobody re-read this comment -- so read them against that file
 * rather than against this sentence.
 *
 * @param {number[]} d   the vector handed to `deflect`
 * @param {{u: number[]}} result  what `deflect` returned
 */
export function deflectionAngleOf(d, result) {
  return Math.atan(norm(result.u) / norm(d));
}

/**
 * The closed form: the deflection angle from `chi` alone, radians.
 *
 *     tan(delta) = (SRS / em) tan(chi / 2)
 *
 * with `chi` the SUN-CENTRED angle between source and observer. It shares
 * no code with `deflect` -- it never forms `d x (e x q)` and never touches
 * `d` at all -- so agreement between the two is a real check rather than a
 * restatement.
 *
 * ## Where it comes from, and what it assumes
 *
 * `deflect` returns `u = w (d x (e x q))` with `w = SRS / em / (1 + q.e)`,
 * and `u` is perpendicular to `d`, so `tan(delta) = |u| / |d|`. Now
 * `|d x (e x q)| = |d| |e x q| sin(angle(d, e x q))`, and `e x q` is
 * normal to the plane of `e` and `q`; so IF `d` lies in that plane the
 * sine is 1 and `|d x (e x q)| = |d| sin(chi)`. With
 * `q.(q + e) = 1 + cos(chi)` that gives
 * `tan(delta) = (SRS / em) sin(chi) / (1 + cos(chi))`, and the half-angle
 * identity finishes it.
 *
 * **The coplanarity is a real assumption and it is satisfied for real
 * geometry, not by luck.** `e` is Sun to observer and `q` is Sun to
 * source, so `d = |q| q_hat - |e| e_hat` is a linear combination of the
 * two and lies in their plane identically. The identity therefore holds at
 * finite source distance exactly as it does for a distant star; it is not
 * a small-angle or far-field approximation. It would fail for a `d` that
 * did not come from this geometry, and `deflect` would still compute the
 * model correctly for such a `d` -- that is why this is a separate
 * function and not an optimisation of that one.
 *
 * ## The atan
 *
 * `(SRS / em) tan(chi / 2)` is the TANGENT of the deflection, not the
 * deflection. Dropping the `atan` is harmless where the deflection is
 * small but reaches 1.41e-11 relative at the fixture's `chi = 179.69`
 * degrees; it is kept so the function returns an angle at every `chi`
 * rather than one that is only asymptotically an angle.
 *
 * This is NOT an independent model. It is the same `eraLd` first-order
 * model reached by a different algebraic route, so it checks the
 * arithmetic and the vector algebra, not the physics. The independent
 * check on the model itself is the ray integration in
 * `DEFLECTION-PROFILE.md` section 0.
 */
export function deflectionAngleClosedForm(eVec, qVec) {
  const en = norm(eVec);
  const qn = norm(qVec);
  const e = [eVec[0] / en, eVec[1] / en, eVec[2] / en];
  const q = [qVec[0] / qn, qVec[1] / qn, qVec[2] / qn];
  const chi = Math.atan2(norm(cross(q, e)), dot(q, e));
  return Math.atan((SRS / (en / AU_KM)) * Math.tan(chi / 2));
}

// --------------------------------------------------------------- intervals

/**
 * The same transformation over an INTERVAL of reception times, together
 * with its first derivative, for the validated search.
 *
 * ## What the linearity buys, and what it does not
 *
 * `deflect` is linear in `d` (proved and measured in
 * `DEFLECTION-PROFILE.md` section 11.2), so the search's deliberately
 * unnormalised vector goes in as it stands: no rescaling, and no interval
 * division to make it a unit vector.
 *
 * **That licence does not extend to `q` and `e`.** They are not
 * scale-free -- section 11.3 gives the two laws and measures what getting
 * them wrong costs -- so both are normalised here, with the interval
 * division that implies, and both denominators are checked away from zero
 * rather than assumed positive.
 *
 * **Nor does it extend to `|d|` downstream.** The map from `d` to `D` is
 * linear but it is NOT a positive scalar multiple: it is
 * `(I - w[e x q]_x)`, a genuine linear map, so an enclosure of `|d|`
 * is not an enclosure of `|D|` and cannot be passed on as one. Aberration
 * takes the length as a separate argument and uses it inside
 * `S = |d| + (d.v)/(1 + bm1)`, so handing it the old length beside the new
 * vector would evaluate a function that is neither transformation. This
 * returns `dist` and `distDot` for `D`, recomputed.
 *
 * The size of that difference is not the reason to recompute, but it is
 * worth knowing: `u` is perpendicular to `d`, so `|D| = |d| sec(delta)`.
 * The largest deflection the supported domain allows is 0.094847 arcsec
 * -- five degrees of elongation, a distant source, the observer at
 * perihelion -- which puts `sec(delta) - 1` at 1.057e-13 and below.
 * Small enough to vanish into the same double at many geometries, and
 * still not the same number. The reason to recompute is structural.
 *
 * ## The derivatives, derived rather than differenced
 *
 *     en' = (E . E')/en          e' = (E' - e en')/en
 *     qn' = (Q . Q')/qn          q' = (Q' - q qn')/qn
 *     g   = q.(q + e)            g' = q'.(q + e) + q.(q' + e')
 *     den = em g                 den' = em' g + em g'
 *     w   = SRS/den              w'  = -SRS den'/den^2
 *     eq  = e x q                eq' = e' x q + e x q'
 *     x   = d x eq               x'  = d' x eq + d x eq'
 *     D   = d + w x              D'  = d' + w' x + w x'
 *
 * `Q` is the Sun-to-target vector at EMISSION and `Q'` is differentiated
 * with respect to RECEPTION time, so the caller supplies the
 * `(1 - dtau/dt)` factor; doing it here would hide a chain rule in a
 * routine that cannot see the light-time.
 *
 * ## The limiter is not differentiated -- it is excluded
 *
 * `w` above has no `max` in it, and that is a claim about this cell, not a
 * simplification. `dlim` is a clamp, so `w` is piecewise and its
 * derivative jumps across the threshold (measured in the tests). Rather
 * than differentiate through it, this REFUSES any cell whose `g` enclosure
 * is not provably above the largest `dlim` the cell admits. Inside the
 * supported domain that is never close -- five degrees of elongation puts
 * `g` about 3.8e-3 against a `dlim` of 1e-6 -- but it is checked on every
 * cell rather than inferred from the domain guard.
 *
 * ## Refusing rather than throwing, and excluded rather than unresolved
 *
 * Like `aberrateInterval`, every failure comes back as
 * `{ok: false, retry, why}` so the search can subdivide or record it. One
 * addition: `excluded: true` marks a cell the PROFILE declines to answer
 * for -- the geometry is inside the elongation floor -- as opposed to one
 * the arithmetic could not decide. The two must not be merged: a narrower
 * cell resolves the second and never the first, and a result that counted
 * an excluded span as covered would be claiming completeness over a region
 * where this profile has no answer at all.
 *
 * @param {{lo:number,hi:number}[]} d      observer -> target, light-time
 *                                         corrected, km. NOT normalised.
 * @param {{lo:number,hi:number}[]} dDot   its derivative, km/s
 * @param {{lo:number,hi:number}} dist     an enclosure of |d|, lo > 0
 * @param {{lo:number,hi:number}[]} eRaw   Sun -> observer at reception, km
 * @param {{lo:number,hi:number}[]} eRawDot  its derivative, km/s
 * @param {{lo:number,hi:number}[]} qRaw   Sun -> target at EMISSION, km
 * @param {{lo:number,hi:number}[]} qRawDot  d/dt(reception) of that, km/s
 * @param {{srs?: number, distantSource?: boolean}} [control]
 *        Two knobs the CONTROL cases need and nothing else may use.
 *        `srs: 0` makes `w` zero, so `D` is `d` and the whole rung reduces
 *        to the one below it -- the reduction control
 *        `DEFLECTION-EVALUATION.md` section 5 requires. `distantSource`
 *        substitutes the observed direction for the Sun-to-source one,
 *        which is `eraLdsun`'s approximation, so the cost of not making it
 *        can be measured at search level rather than only pointwise.
 *        Both default to the profile and neither is reachable from the
 *        experimental entry point.
 */
export function deflectInterval(d, dDot, dist, eRaw, eRawDot, qRaw, qRawDot, control = {}) {
  const { srs = SRS, distantSource = false, domainProvedByCaller = false } = control;
  if (!(dist.lo > 0)) {
    return { ok: false, retry: true, why: 'the target and the observer cannot be shown to be separated over this cell, so the direction to deflect is undefined' };
  }
  const en = I.norm(eRaw);
  if (!(en.lo > 0)) {
    return { ok: false, retry: true, why: 'the observer cannot be bounded away from the centre of the Sun over this cell, so the deflector geometry is undefined' };
  }
  // eraLdsun's approximation: the Sun-to-source direction replaced by the
  // observed one. Applied to the RAW vector, before normalisation, so the
  // only thing that changes is the direction `q` ends up pointing.
  const qSrc = distantSource ? d : qRaw;
  const qSrcDot = distantSource ? dDot : qRawDot;
  const qn = I.norm(qSrc);
  if (!(qn.lo > 0)) {
    return { ok: false, retry: true, why: 'the target cannot be bounded away from the centre of the Sun over this cell, so the deflector geometry is undefined' };
  }

  const enDot = I.div(I.dot(eRaw, eRawDot), en);
  const e = [I.div(eRaw[0], en), I.div(eRaw[1], en), I.div(eRaw[2], en)];
  const eDot = [0, 1, 2].map((i) => I.div(I.sub(eRawDot[i], I.mul(e[i], enDot)), en));

  const qnDot = I.div(I.dot(qSrc, qSrcDot), qn);
  const q = [I.div(qSrc[0], qn), I.div(qSrc[1], qn), I.div(qSrc[2], qn)];
  const qDot = [0, 1, 2].map((i) => I.div(I.sub(qSrcDot[i], I.mul(q[i], qnDot)), qn));

  // The supported domain, over the WHOLE cell and without an inverse
  // trigonometric function. The observer sees the Sun along -e, so
  // cos(elongation) = -(e . d)/|d|, and cos is decreasing on [0, pi]:
  // elongation >= floor everywhere is exactly cos(elongation) <= cos(floor)
  // everywhere.
  const domainToken = enter('domain-test');
  const cosPhi = elongationCosInterval(e, d, dist);
  leave(domainToken);
  /**
   * `domainProvedByCaller` skips the GATE, not the computation.
   *
   * ## What it is for
   *
   * Domain membership is a property of INSTANTS. A partition that has
   * proved `elongation >= floor` at every instant of a span has proved it
   * for every instant of every sub-span, so a search running inside that
   * span is re-deciding a settled question -- and paying for it. Measured:
   * on a 300-day Saturn window the deflected search spends 98.9 per cent
   * of its evaluations bisecting toward the floor, and 66.3 per cent even
   * on a control window with no conjunction in it, because the elongation
   * ENCLOSURE over a wide cell straddles the floor while the elongation
   * itself is nowhere near it.
   *
   * ## What it does NOT skip
   *
   * Every other guard. The limiter threshold below, the `q . (q + e)`
   * positivity, the observer-at-the-Sun and target-on-the-observer
   * refusals all still fire. This flag says one thing -- "the elongation
   * floor is already established here" -- and nothing else.
   *
   * ## Why it is named like a liability
   *
   * Because it is one. Passing it without a proof applies the deflection
   * outside the supported domain and returns a number where the profile
   * would have declined, and the result would look ordinary. It is not
   * reachable from any public entry point: `searchDeflectedLongitude` does
   * not accept it, `searchDeflectedLongitudeWithControl` rejects it by
   * name, and `partitioned-search.mjs` is the only caller in the package
   * that sets it -- immediately after proving what it asserts.
   * `deflected-search.nodetest.mjs` pins all three of those.
   */
  if (!domainProvedByCaller && !(cosPhi.hi <= COS_MIN_ELONGATION_GUARD)) {
    // Excluded and unresolved are different answers. If the enclosure lies
    // WHOLLY inside the floor, every instant of the cell is outside the
    // supported domain and no subdivision changes that -- the profile has
    // no answer here, and says so. If it merely straddles the floor, a
    // narrower cell can still land on one side.
    const wholly = cosPhi.lo > COS_MIN_ELONGATION_EXCLUDE;
    return {
      ok: false,
      retry: !wholly,
      excluded: wholly,
      // Named, not inferred from the message. The subdivision loop needs
      // to know that THIS retry is a domain boundary rather than a loose
      // enclosure, so the work spent bisecting toward the floor can be
      // attributed to the floor -- which is the measurement the whole
      // partition rests on.
      domainStraddle: !wholly,
      cosElongation: cosPhi,
      why: wholly
        ? `the solar elongation is inside this profile's ${MIN_ELONGATION_RAD / DEG} degree floor at every instant of this cell, so the deflection is outside the supported domain and no subdivision changes that`
        : `the solar elongation enclosure straddles this profile's ${MIN_ELONGATION_RAD / DEG} degree floor over this cell`,
    };
  }

  const em = I.scale(en, 1 / AU_KM);
  const emDot = I.scale(enDot, 1 / AU_KM);

  const g = I.dot(q, I.vAdd(q, e));
  const gDot = I.add(I.dot(qDot, I.vAdd(q, e)), I.dot(q, I.vAdd(qDot, eDot)));

  // The largest dlim this cell admits: dlim = 1e-6/max(em^2, 1) is
  // decreasing in em, so the smallest em gives the largest dlim. Taking
  // the largest makes the test below the strict one.
  const dlimHi = 1e-6 / Math.max(em.lo * em.lo, 1);
  if (!(g.lo > dlimHi)) {
    return {
      ok: false,
      retry: true,
      why: `q.(q+e) encloses ${g.lo} over this cell, which is not provably above the limiter threshold ${dlimHi}, so the clamp cannot be shown inactive and this profile will not differentiate through it`,
    };
  }

  const den = I.mul(em, g);
  if (!(den.lo > 0)) {
    return { ok: false, retry: true, why: 'the deflection denominator cannot be bounded away from zero over this cell' };
  }
  const denDot = I.add(I.mul(emDot, g), I.mul(em, gDot));
  const w = I.div(I.iv(srs), den);
  const wDot = I.neg(I.div(I.mul(I.iv(srs), denDot), I.mul(den, den)));

  const eq = I.cross(e, q);
  const eqDot = I.vAdd(I.cross(eDot, q), I.cross(e, qDot));
  const x = I.cross(d, eq);
  const xDot = I.vAdd(I.cross(dDot, eq), I.cross(d, eqDot));

  const u = I.vMulI(x, w);
  const uDot = I.vAdd(I.vMulI(x, wDot), I.vMulI(xDot, w));
  const D = I.vAdd(d, u);
  const DDot = I.vAdd(dDot, uDot);

  // Recomputed, not inherited. See the header: `d -> D` is a linear map,
  // not a positive rescaling, so `dist` does not carry over.
  const distOut = I.norm(D);
  if (!(distOut.lo > 0)) {
    return { ok: false, retry: true, why: 'the deflected direction cannot be bounded away from zero length over this cell' };
  }
  const distOutDot = I.div(I.dot(D, DDot), distOut);

  return {
    ok: true,
    D,
    DDot,
    // The perturbation and ITS derivative, returned for the same reason
    // the pointwise form returns `u`: recovering either by subtracting is
    // a catastrophic cancellation, `|u|/|d|` being around 1e-10 here. It
    // is also the only place the chain rule on `q` is visible -- `DDot` is
    // dominated by `dDot`, so an error in `qRawDot` moves it by about
    // 1e-12 relative and moves `uDot` by 1e-4.
    u,
    uDot,
    dist: distOut,
    distDot: distOutDot,
    // `u` is perpendicular to `d`, so this is the TANGENT of the deflection
    // angle and not the angle. At these magnitudes the two agree to about
    // 1e-13 relative, but the name says which one it is.
    tanDeflection: I.div(I.norm(u), dist),
    cosElongation: cosPhi,
    qdqpe: g,
    limiterThreshold: dlimHi,
    emAu: em,
    w,
  };
}
