/**
 * validated-retarded-geometric: a fixed-longitude crossing of the
 * light-time-corrected direction to a body, in a fixed ecliptic frame --
 * the ICRS equator rotated by the J2000 mean obliquity, which is 23.1 mas
 * from the J2000 mean equinox; see `frame` and `frameNote` -- with
 * completeness established rather than assumed.
 *
 * This is NOT apparent-of-date astrology and must not be read as a more
 * accurate answer to the same question `empirical-apparent` answers. It
 * adds exactly one correction to `validated-geometric` -- Newtonian
 * reception light-time -- and still omits stellar aberration,
 * gravitational deflection, Shapiro delay, precession and nutation into
 * the frame of date, the IAU 2006 ICRS frame bias, topocentric parallax
 * and refraction. Those omissions are on the result object, by name.
 *
 * The scalar that is searched is a projection, not an angle:
 *
 *     f(t) = sin(L) x - cos(L) (cos(e) y + sin(e) z)
 *     g(t) = cos(L) x + sin(L) (cos(e) y + sin(e) z)
 *
 * with (x, y, z) = d(t), the light-time-corrected geocentric vector. f
 * vanishes on the whole line through the target longitude and its
 * antipode; g > 0 picks the requested direction. No wrapped angle appears
 * anywhere, so no small-difference-at-sampled-endpoints assumption is
 * needed and the 96-turn aliasing failure has nothing to act on.
 *
 * Time in and out is TDB seconds past J2000, stated as such: SPK
 * coefficients are indexed by TDB, and folding an unbounded TT or UTC
 * conversion into a proof would make the proof about something else.
 *
 * Environment-neutral: no `node:` imports, no clock.
 */
import { fail, PrecisionError } from './errors.mjs';
import { BARYCENTRE_NOT_CENTRE } from './ephemeris.mjs';
import { buildResult, SUPPORT, EXTERNAL_UNCERTAINTY as OUTSIDE } from './result.mjs';
import {
  C_KM_S, targetWeights, observerWeights, mergedWeights, withinOneRecord, stateEnclosure, solveTau, coverage,
} from './retarded.mjs';
import { aberrateInterval } from './aberration.mjs';
import { deflectInterval, DEFLECTION_PROFILE, MIN_ELONGATION_RAD } from './deflection.mjs';
import { frameMatrixInterval, matApplyI, ttCenturiesInterval, FRAMES, TIME_MODEL } from './frame-of-date.mjs';
import { sinCos } from './trig.mjs';
import * as I from './interval.mjs';
import { enter, leave, charge, setLabel } from './instrument.mjs';

/** Arcseconds to radians, and seconds in a Julian century -- the frame's units. */
const DAS2R = Math.PI / (180 * 3600);
const CENTURY_SEC = 36525 * 86400;

const DAY = 86400;
const J2000_JD = 2451545.0;
const DEG = Math.PI / 180;
/** IAU 2006 mean obliquity at J2000, arcseconds. A constant, which is the point. */
const EPS0_ARCSEC = 84381.406;
const COS_E = Math.cos((EPS0_ARCSEC / 3600) * DEG);
const SIN_E = Math.sin((EPS0_ARCSEC / 3600) * DEG);

export const RETARDED_CONTRACT = Object.freeze({
  operation: 'geometric ecliptic longitude of one body CORRECTED FOR RECEPTION LIGHT-TIME, in the fixed ecliptic of the ICRS equator (see frame and frameNote), reaching a given value',
  frame: 'ecliptic-of-the-icrs-equator',
  frameNote: 'The ICRS equator rotated by the IAU 2006 mean obliquity at J2000 (84381.406 arcsec). This is NOT the J2000 mean equinox: the IAU 2006 ICRS frame bias, a fixed rotation of 23.1 mas, is not applied. Measured against Swiss Ephemeris in J2000, the difference is a rotation of |omega| = 23.111 mas fitted at 99.9 per cent of variance, matching the published bias (xi0 -16.617, eta0 -6.819, dalpha0 -14.6 mas) to 0.16 per cent. It projects onto ecliptic longitude as about 7.7 mas on average. The label used to read j2000-mean-ecliptic, which overstated it.',
  origin: 'geocentric',
  timeScale: 'TDB seconds past J2000, in and out. No TT or UTC conversion happens inside this operation.',
  lightTime: 'Newtonian reception: tau = |r_target(t - tau) - r_observer(t)| / c, with the OBSERVER at reception time t and the target at emission time t - tau. Solved as a verified contraction, not by iterating until two values agree.',
  c: C_KM_S,
  applied: Object.freeze(['reception light-time (Newtonian, one-way, target retarded, observer not)']),
  notApplied: Object.freeze([
    'stellar (annual) aberration: the observer\'s velocity does not enter the direction',
    'gravitational light deflection, by the Sun and by the planets',
    'Shapiro (relativistic) delay: the light-time here is the Newtonian straight-line one',
    'precession and nutation: the frame is fixed, not of date',
    'the IAU 2006 ICRS frame bias: the frame is the ecliptic of the ICRS equator, a fixed 23.1 mas from the J2000 mean equinox (see frameNote)',
    'topocentric parallax and atmospheric refraction: the observer is the geocentre',
  ]),
  comparableTo: 'SPICE aberration correction "LT" (converged, so closer to "CN" than to a single iteration), observer 399, with no stellar-aberration term. NOT comparable with "CN+S" or with an apparent place of date. On the frame: this operation rotates the ICRS equator by the IAU 2006 obliquity 84381.406 arcsec and applies no frame bias. SPICE ECLIPJ2000 is the nearest built-in frame but is not asserted here to use the same obliquity constant -- check the value your toolkit rotates by before treating a residual at the tens-of-mas level as a disagreement about positions.',
  bodies: Object.freeze(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']),
  barycentreNotCentre: BARYCENTRE_NOT_CENTRE,
});

/**
 * `validated-retarded-aberrated`: the same quantity with the observer's own
 * motion applied on top. One more correction, named, and nothing else
 * changed -- same frame, same time scale, same bodies, same data.
 */
export const ABERRATED_CONTRACT = Object.freeze({
  operation: 'geometric ecliptic longitude of one body CORRECTED FOR RECEPTION LIGHT-TIME AND STELLAR ABERRATION, in the fixed ecliptic of the ICRS equator (see frame and frameNote), reaching a given value',
  frame: RETARDED_CONTRACT.frame,
  frameNote: RETARDED_CONTRACT.frameNote,
  origin: RETARDED_CONTRACT.origin,
  timeScale: RETARDED_CONTRACT.timeScale,
  lightTime: RETARDED_CONTRACT.lightTime,
  aberration: 'Stellar (annual) aberration, special-relativistic: Expr. (7.40) of the Explanatory Supplement, the same expression ERFA eraAb implements. The observer velocity is taken at RECEPTION time t and is NOT retarded. The Klioner solar-potential term eraAb also carries is NOT applied; measured at 4.046e-7 arcsec for an Earth-like observer at 1 au.',
  c: C_KM_S,
  applied: Object.freeze([
    'reception light-time (Newtonian, one-way, target retarded, observer not)',
    'stellar (annual) aberration (special-relativistic, observer velocity at reception, geocentric)',
  ]),
  notApplied: Object.freeze([
    'gravitational light deflection by the Sun',
    'the Klioner solar-potential term inside the aberration itself: about 0.4 microarcsecond',
    'Shapiro (relativistic) delay: the light-time here is the Newtonian straight-line one',
    'precession and nutation: the frame is fixed, not of date',
    'the IAU 2006 ICRS frame bias: the frame is the ecliptic of the ICRS equator, a fixed 23.1 mas from the J2000 mean equinox (see frameNote)',
    'topocentric parallax, diurnal aberration and atmospheric refraction: the observer is the geocentre',
  ]),
  comparableTo: 'SPICE aberration correction "CN+S", observer 399, as a documented model rather than an asserted identity: SPICE\'s stellar-aberration term is not asserted here to be this expression. NOT an apparent place of date -- deflection, precession, nutation and the frame bias are all still absent. On the frame, the same caution as the light-time mode: check the obliquity constant your toolkit rotates by before reading a tens-of-mas residual as a disagreement about positions.',
  bodies: RETARDED_CONTRACT.bodies,
  barycentreNotCentre: BARYCENTRE_NOT_CENTRE,
});

/**
 * `validated-retarded-aberrated-of-date`: the same corrected direction,
 * expressed in the frame a chart actually uses.
 *
 * NOT an apparent place, and the name says so. An apparent place needs
 * gravitational deflection and the rest of the list below; this adds a
 * frame rotation and nothing else.
 */
/**
 * The range over which the frame MODELS claim to represent the sky:
 * 1900-01-01 to 2100-01-01, TDB seconds past J2000.
 *
 * It is ERFA `nut00b.c`'s own span -- the one over which it bounds the
 * pole at a milliarcsecond. Outside it the search still runs and still
 * returns proven enclosures ABOUT THE MODEL AS IMPLEMENTED; what lapses
 * is the claim that the model is the sky. The result says which, rather
 * than refusing, because refusing would make the two of-date rungs
 * disagree about what a window means.
 */
export const OF_DATE_MODEL_RANGE_TDB_SEC = Object.freeze([-3155716800, 3155716800]);

export const OF_DATE_CONTRACT = Object.freeze({
  operation: 'geometric ecliptic longitude of one body CORRECTED FOR RECEPTION LIGHT-TIME AND STELLAR ABERRATION, in the ECLIPTIC OF DATE with its origin at the TRUE EQUINOX OF DATE (see frame and frameNote), reaching a given value',
  frame: FRAMES.trueEquinoxOfDate,
  frameNote: 'Input axes ICRS/GCRS equatorial. Output plane the ecliptic of date -- the MEAN ecliptic of date, because nutation is a motion of the equator and not of the ecliptic; "true ecliptic" is not a thing this construction produces and the phrase is not used. Longitude origin the TRUE equinox of date, because the nutation in longitude is applied; drop it and the origin is the mean equinox of date, which is the other rung, separated by the nutation in longitude -- up to about 19 arcsec, and periodically near zero. Chain: R3(-(psib + dpsi)) R1(phib) R3(gamb), the IAU 2006 Fukushima-Williams angles with frame bias included, plus IAU 2000B nutation adjusted to P03. The obliquity cancels out of the ecliptic projection exactly, so the nutation in OBLIQUITY does not enter this frame at all. This is the same frame, from the same constants, that the released apparent reducer projects into.',
  origin: 'geocentric',
  timeScale: 'TDB seconds past J2000 in and out. The FRAME needs TT, and the conversion is a stated model: see timeModel. The two existing modes need no conversion because their frame is fixed.',
  timeModel: TIME_MODEL,
  supportedRange: 'TDB seconds past J2000 in [-3155716800, +3155716800], i.e. 1900-01-01 to 2100-01-01, intersected with the pack\'s own coverage. That is IAU 2000B\'s own span. Outside it the search still returns proven enclosures about the model as implemented; what lapses is the claim that the model represents the sky, and every result says which side of the line it is on.',
  models: 'IAU 2006 precession with frame bias (Fukushima-Williams, the eraPfw06 angles); IAU 2000B nutation (77 luni-solar terms, McCarthy & Luzum 2003, carrying the Luzum 2001 "rigorous" planetary-bias pair -0.000135"/+0.000388"), adjusted to P03 per Wallace & Capitaine 2006. THAT PAIRING IS NOT ONE ERFA OR SOFA SHIPS: their IAU 2006 chain is 2000A-based (eraNut06a, eraPnm06a) and there is no eraNut06b or eraPnm06b in the library at all. It is this repository\'s own released choice, reproduced here so the experimental chain and the released reducer are the same model rather than two. The P03 adjustment is applied for the same reason, and on 2000B it is formal rather than material: measured at most 16.5 microarcsec in dpsi and 11.9 in deps over 1995-2050, against the 0.0027" by which 2000B itself differs from 2000A. A reference used to check this must use the SAME pair: a 2000A reference differs from it by a MODEL, not by a defect.',
  evaluation: 'Trigonometry from src/core/trig.mjs, a Cody-Waite reduction and Taylor polynomial using only +, - and *. Declared absolute error bound 4e-15, derived term by term in that module\'s header -- an ANALYSIS, not a machine-checked proof. test/tier-a/trig.nodetest.mjs measures the realised error against a 70-digit BigInt reference over 40,656 arguments, including every quadrant boundary of the reduction and the two doubles either side: worst 1.484e-16 on sin and 1.330e-16 on cos. Math.sin is not used: ECMAScript does not bound its error, so an enclosure built on it would not be a bound, and it does not promise the same bits in two engines.',
  c: C_KM_S,
  applied: Object.freeze([
    'reception light-time (Newtonian, one-way, target retarded, observer not)',
    'stellar (annual) aberration (special-relativistic, observer velocity at reception, geocentric)',
    'IAU 2006 frame bias and precession, and IAU 2000B nutation in longitude, into the ecliptic of date with the true equinox of date as origin',
  ]),
  notApplied: Object.freeze([
    'gravitational light deflection, by the Sun and by the planets',
    'the Klioner solar-potential term inside the aberration itself: about 0.4 microarcsecond',
    'Shapiro (relativistic) delay: the light-time here is the Newtonian straight-line one',
    'topocentric parallax, diurnal aberration and atmospheric refraction: the observer is the geocentre',
    'the difference between IAU 2000B and IAU 2000A nutation. Measured on this repository\'s own corpus that is at most 0.0027" of ecliptic longitude (n = 15,010 body-epochs, 1850-2150) and 0.0035" in the nutation in longitude itself (n = 1,964 epochs, same span): docs/platform/evidence/precision-2026-09-20/numerics/RESULTS.md, sections 1 and 2. ERFA nut00b.c quotes 1 milliarcsec, but that is a POLE accuracy over 1900-2100, not a longitude-component difference, and the two numbers are not interchangeable',
    'any correction beyond the three applied: this is NOT an apparent place and must not be read as one',
  ]),
  sources: 'IAU SOFA Issue 2023-10-11 and its ERFA equivalent, liberfa v2.0.1 (tagged 2023-10-13). The 2000B series is from src/nut00b.c, the aberration expression from src/ab.c, and the test vectors in test/tier-a/frame-of-date.nodetest.mjs are copied from src/t_erfa_c.c at that tag, at the tolerances ERFA itself declares.',
  relationToErfa: 'The MEAN rung of this frame IS eraEcm06\'s frame. eraEcm06 is R1(eraObl06) . eraPmat06, which by the obliquity cancellation equals R3(-psib) R1(phib) R3(gamb) -- this module\'s mean rung -- and the published t_ecm06 3x3 matrix is reproduced to 1e-14 and lies inside the interval enclosure everywhere. The TRUE-equinox rung, the one THIS mode uses, is NOT any ERFA routine: eraEcm06, eraEceq06 and eraEqec06 are all mean-equinox, and ERFA ships no true-equinox ecliptic matrix. That rung is checked by construction, by its separation from the mean rung -- the nutation in longitude, up to about 19 arcsec and periodically near zero, three orders from the 23 mas frame bias it must not be confused with -- and against the released reducer -- not against a published matrix, because none exists to check it against.',
  comparableTo: 'the frame of an apparent place, with the apparent place\'s other corrections still missing. Against an almanac the remaining difference is dominated by gravitational deflection (up to about 1.7 arcsec near the Sun, under 0.01 arcsec away from it) and by whatever the almanac does topocentrically. Against SPICE, no built-in aberration correction matches this profile.',
  bodies: RETARDED_CONTRACT.bodies,
  barycentreNotCentre: BARYCENTRE_NOT_CENTRE,
});

/**
 * `validated-retarded-aberrated-deflected-of-date`. Rung 5.
 *
 * One correction more than the of-date mode: gravitational light bending
 * by the Sun. Still NOT an apparent place, and the name does not say it
 * is; `notApplied` lists what remains absent on every result.
 *
 * The one structural difference from every mode below it: this one has a
 * RESTRICTED DOMAIN. Inside five degrees of the Sun it declines to answer,
 * and a search crossing that region comes back with `excluded` spans, no
 * completeness claim over the request, and an event list that is a lower
 * bound rather than a total.
 */
export const DEFLECTED_CONTRACT = Object.freeze({
  operation: 'geometric ecliptic longitude of one body CORRECTED FOR RECEPTION LIGHT-TIME, SOLAR GRAVITATIONAL LIGHT DEFLECTION AND STELLAR ABERRATION, in the ECLIPTIC OF DATE with its origin at the TRUE EQUINOX OF DATE, reaching a given value',
  frame: OF_DATE_CONTRACT.frame,
  frameNote: OF_DATE_CONTRACT.frameNote,
  origin: 'geocentric',
  timeScale: OF_DATE_CONTRACT.timeScale,
  timeModel: TIME_MODEL,
  supportedRange: OF_DATE_CONTRACT.supportedRange,
  deflectionProfile: DEFLECTION_PROFILE,
  supportedDomain: `Solar elongation at least ${MIN_ELONGATION_RAD / DEG} degrees, over the WHOLE of any cell the search accepts. The floor is tested as cos(elongation) <= cos(floor) on an enclosure, so it holds at every instant rather than at sampled ones. Inside it the search excludes rather than guesses: see accounting.excluded and accounting.excludedNote. DEFLECTION-PROFILE.md section 7 gives the four boundaries the floor is set against -- they are four different boundaries -- and section 11 what verifying the transformation established.`,
  order: 'light-time -> deflection -> aberration -> frame. Coordinate direction to natural direction to proper direction to the ecliptic of date, which is the order DEFLECTION-PROFILE.md section 4 fixes and the order ERFA\'s own apparent-place chain uses.',
  models: `${OF_DATE_CONTRACT.models} DEFLECTION: ERFA eraLd with bm = 1, at FINITE source distance -- q is the real Sun-to-source direction at emission, NOT eraLdsun's q = p distant-star approximation, which for a planet is wrong by up to 1.5554 arcsec at 0.3 degrees of elongation. Pinned to liberfa src/ld.c, and reproduced bit for bit on 358 geometries against that source compiled and run.`,
  evaluation: OF_DATE_CONTRACT.evaluation,
  c: C_KM_S,
  applied: Object.freeze([
    'reception light-time (Newtonian, one-way, target retarded, observer not)',
    'solar gravitational light deflection (first order, finite source distance, Sun only)',
    'stellar (annual) aberration (special-relativistic, observer velocity at reception, geocentric)',
    'IAU 2006 frame bias and precession, and IAU 2000B nutation in longitude, into the ecliptic of date with the true equinox of date as origin',
  ]),
  notApplied: Object.freeze([
    'gravitational deflection by any body other than the Sun: Jupiter reaches about 0.017 arcsec at its limb and is not modelled here',
    'the second-order term eraLd itself omits. A property of the MODEL, not of this implementation: measured against an independent ray integration at 2.08e-3 arcsec at 0.3 degrees of elongation, 4.23e-7 at 5 degrees, 4.97e-8 at 10. It is the reason the supported domain stops where it does',
    'the Klioner solar-potential term inside the aberration, about 0.4 microarcsecond. A DIFFERENT term in a different transformation, and it stays off -- enabling it to match an ERFA comparison would be a silent model change',
    'Shapiro (relativistic) delay: the light-time here is the Newtonian straight-line one',
    'topocentric parallax, diurnal aberration and atmospheric refraction: the observer is the geocentre',
    'any correction beyond the four applied: this is NOT an apparent place and must not be read as one',
  ]),
  sources: OF_DATE_CONTRACT.sources,
  relationToErfa: 'The deflection is eraLd\'s arithmetic exactly -- 1074 of 1074 output components bit-identical to the pinned source compiled and run -- but NOT eraLdsun\'s geometry, which substitutes the observed direction for the Sun-to-source one. The frame rung is as the of-date contract describes it. No ERFA routine computes this combination end to end, and none is claimed to.',
  comparableTo: 'the frame AND the deflection of an apparent place, with the Shapiro delay, planetary deflection and everything topocentric still missing. NOTHING HERE HAS BEEN COMPARED WITH AN ALMANAC, so no bound on that difference is offered: an earlier version of this field said it "should be well under 0.01 arcsec", which was an expectation dressed as a result, and is false for the Moon in any case -- the topocentric parallax this mode omits reaches about a degree there. What can be said is what is still absent, and the dominant remaining term away from the Sun is whatever the almanac does topocentrically. Near the Sun this mode declines to answer rather than closing any gap.',
  bodies: RETARDED_CONTRACT.bodies,
  barycentreNotCentre: BARYCENTRE_NOT_CENTRE,
});

export const RETARDED_DEFAULTS = Object.freeze({
  /** Subdivision floor, seconds of TDB. Below this a cell stays open. */
  minWidthSec: 1e-4,
  maxEvaluations: 4_000_000,
  maxCells: 400_000,
  /** How many times the candidate light-time interval may be widened before giving up on a cell. */
  maxTauWidenings: 6,
  /**
   * Below this width, a cell whose ENCLOSURES could not be established is
   * reported unresolved instead of being split again.
   *
   * Root isolation has its own, much finer floor. These are different
   * questions: a cell that cannot be excluded needs bisecting, but a cell
   * where the target passes through the observer is telling you about the
   * geometry and no amount of halving changes that. Without this the
   * degenerate case took 65 seconds to subdivide two days down to a
   * ten-thousandth of a second and then say the obvious.
   */
  enclosureFloorSec: 1,
  /**
   * A floor, in seconds, added to each side of the candidate light-time
   * interval. (A `tauPadFactor` sat here, documented as a multiple of the
   * solver's error bound, and nothing read it: passing 1e-9 or 1e9 changed
   * nothing. Removed rather than kept as an option that does nothing, so
   * passing it is now an unknown option, refused.)
   */
  tauPadFloorSec: 1e-6,
});

/**
 * Establish a light-time interval that holds for EVERY reception time in
 * the cell, and the enclosures that follow from it.
 *
 * Returns null when the conditions cannot be established, with the reason.
 */
/**
 * The deflector geometry a cell hands `deflectInterval`, as one rule in
 * one place.
 *
 * Two things here are easy to get wrong and were, for a while, checkable
 * nowhere:
 *
 * 1. **The epochs differ on purpose.** `e` and `em` come from the Sun at
 *    RECEPTION, `q` from the Sun at EMISSION. `DEFLECTION-PROFILE.md`
 *    section 2 measures the simpler reception-for-both at 1.96e-5 arcsec
 *    against 3.13e-10 for this split, and the split is nearly free once
 *    the emission window exists.
 * 2. **`q` is differentiated with respect to RECEPTION time**, so it
 *    carries the `(1 - dtau/dt)` factor and `e` does not. `deflection.mjs`
 *    makes that the caller's contract precisely so the chain rule is not
 *    hidden inside a routine that cannot see the light-time.
 *
 * Both were invisible to every search-level test: the enclosure is two
 * orders of magnitude wider than either error, so a result cannot expose
 * the difference. Extracting the rule is what makes it testable at all --
 * `deflected-search.nodetest.mjs` checks it against a finite-difference
 * reference on an analytic moving-Sun geometry, where both ARE separable.
 *
 * `oneMinus` is the `1 - dtau/dt` the light-time block already
 * established; recomputing it here would be a second place for it to
 * drift.
 */
export function deflectorGeometry(O, R, sunRec, sunEm, oneMinus) {
  return {
    eRaw: I.vSub(O.pos, sunRec.pos),
    eRawDot: I.vSub(O.vel, sunRec.vel),
    qRaw: I.vSub(R.pos, sunEm.pos),
    qRawDot: I.vMulI(I.vSub(R.vel, sunEm.vel), oneMinus),
  };
}

/**
 * The geocentric vector of one cell from MERGED weights, where the target
 * and the observer share a stored series, or null.
 *
 *   d(t) = [r_T(t) - r_O(t)] + [r_T(t - tau) - r_T(t)]
 *   r_T(t - tau) - r_T(t) = -tau v_T(t) + (tau^2/2) a_T(xi),  xi in [t - tau, t]
 *
 * with tau in T, which the caller has already proved contains the light-
 * time over the whole cell. Also the relative velocity
 * v_T(t - tau) - v_O(t) = [v_T(t) - v_O(t)] + [v_T(t - tau) - v_T(t)],
 * the second term within tau_max max|a_T|.
 *
 * Null, and the cell keeps the split form alone, where no series is
 * shared (nothing cancels, so nothing is gained), where the emission
 * times cross a record boundary of the target (the records are separate
 * fits and do not join smoothly, and the Taylor step needs one
 * polynomial), or where the records do not cover them.
 */
function mergedRetardation(eph, targets, observer, t0, t1, T, spend) {
  if (![...targets.keys()].some((name) => observer.has(name))) return null;
  // Only the Taylor step needs smoothness, of the target over every
  // emission time the cell reaches; the same-instant term is enclosed
  // record by record like any other.
  if (!withinOneRecord(eph, targets, t0 - T.hi, t1)) return null;
  const merged = mergedWeights(targets, observer);
  try {
    const tau = I.iv(T.lo, T.hi);
    const A = stateEnclosure(eph, merged, t0, t1, spend);
    const W = stateEnclosure(eph, targets, t0 - T.hi, t1, spend);
    const d = I.vAdd(I.vAdd(A.pos, I.vMulI(W.vel, I.neg(tau))), I.vScale(W.acc, (T.hi * T.hi) / 2));
    const vRel = I.vAdd(A.vel, I.vScale(W.acc, T.hi));
    return { d, vRel };
  } catch (error) {
    if (error instanceof PrecisionError && error.code === 'out-of-coverage') return null;
    throw error;
  }
}

function retardedCell(eph, targets, observer, lambdaDeg, t0, t1, spend, p, aberration = false, ofDate = false, frameProvider = null, deflection = false, sunWeights = null, control = {}) {
  const L = lambdaDeg * DEG;
  const wF = [Math.sin(L), -Math.cos(L) * COS_E, -Math.cos(L) * SIN_E];
  const wG = [Math.cos(L), Math.sin(L) * COS_E, Math.sin(L) * SIN_E];

  // The OBSERVER's enclosures, behind the same guard the target's already
  // had. They did not have it, and the asymmetry cost the whole search: a
  // window one second outside the observer's records -- 99.99% of it
  // inside coverage -- raised `out-of-coverage` out of
  // `searchAberratedLongitude` entirely, so every cell already decided was
  // discarded and the caller got an exception instead of a result with
  // one edge cell unresolved. The loop's own catch handles only
  // `budget-exhausted` and `cancelled`, by design, so nothing downstream
  // was going to catch this. Exactly the escape the target side carries a
  // note about, and exactly the one `aberrateInterval`'s header argues
  // against, on the other body.
  let O;
  let oPoint;
  const mid = (t0 + t1) / 2;
  const observerToken = enter('observer-enclosure');
  try {
    O = stateEnclosure(eph, observer, t0, t1, spend);
    // A first light-time, solved at the cell's ends, to centre the
    // candidate interval. This is a STARTING POINT and nothing is proved
    // from it.
    oPoint = stateEnclosure(eph, observer, mid, mid, spend).pos.map((x) => (x.lo + x.hi) / 2);
  } catch (error) {
    leave(observerToken);
    if (error instanceof PrecisionError && error.code === 'out-of-coverage') {
      return { ok: false, retry: true, why: `the observer's records do not cover ${t0} .. ${t1} s TDB` };
    }
    throw error;
  }
  leave(observerToken);
  const lightTimeToken = enter('light-time');
  const rough = solveTau(eph, targets, mid, oPoint, 0.5, spend);
  if (rough.leftCoverage) {
    // The point iteration walked off the stored records. Two very
    // different things do that, and the cell has to say which: a target
    // whose speed bound is at or above c, where the map is not a
    // contraction and the iterates run away; or a genuine edge of the
    // pack, where the light-time reaches back past the first record.
    //
    // Bound the speed over the records the iteration actually reached
    // and let that decide. Only the first is hopeless -- the speed bound
    // is `sum |c_k|` of a record's differentiated series, so halving a
    // cell inside that record cannot lower it -- and only the second is
    // worth subdividing.
    const [covLo, covHi] = coverage(eph, targets);
    // The intersection of what the iteration visited with what the pack
    // stores. It can be EMPTY -- a reception window past the target's last
    // record while the observer still has one puts every emission time
    // outside -- and probing an inverted window used to raise
    // `unsupported-option` from inside a path whose whole job is to return
    // a typed refusal. That is the same escape L7 was about.
    const probeLo = Math.max(covLo, Math.min(t0 - rough.tau, t0));
    const probeHi = Math.min(covHi, t1);
    if (!(probeHi >= probeLo)) {
      return { ok: false, retry: false, why: `every emission time for this cell lies outside the stored records ${covLo} .. ${covHi} s TDB` };
    }
    const vProbe = I.vMag(stateEnclosure(eph, targets, probeLo, probeHi, spend).vel);
    if (!(vProbe < C_KM_S)) {
      return { ok: false, retry: false, why: `the target's speed bound over ${probeLo} .. ${probeHi} s TDB is ${vProbe.toFixed(3)} km/s, which is not below c, so the light-time iteration is not a contraction and its iterates leave the stored records` };
    }
    return { ok: false, retry: true, why: `the light-time iteration from this cell reaches outside the stored records ${covLo} .. ${covHi} s TDB` };
  }

  // The first candidate is DERIVED, not guessed. tau varies across the
  // cell at |tau'| <= (|v_T| + |v_O|)/(c - |v_T|), so over a half-width
  // `half` it can move by that much; the solver's own error at the
  // midpoint adds a little more.
  //
  // The first version used a flat 1e-3 of the cell width instead. On an
  // eight-day record that is 345 s against a true variation near 69 s,
  // and when the check failed anyway it quadrupled the pad -- the event
  // on Mars came back with a light-time interval of [0, 2563] s for a
  // quantity near 700 s. A loose tau interval widens the emission
  // window, which loosens the target enclosure, which forces more
  // subdivision; it is the first thing worth tightening.
  const half = (t1 - t0) / 2;
  let crude;
  try {
    crude = stateEnclosure(eph, targets, t0 - rough.tau - 1.2 * half - 1, t1 - rough.tau + 1.2 * half + 1, spend);
  } catch (error) {
    // The same condition the emission-window call below already handles.
    // Left unhandled, this threw out of the whole search for any window
    // within about 1.2 seed half-widths of the pack's edge -- up to
    // nineteen days on a record-seeded pack -- so a window 99% inside
    // coverage returned nothing at all instead of a result with the edge
    // cells unresolved.
    if (error instanceof PrecisionError && error.code === 'out-of-coverage') {
      return { ok: false, retry: true, why: `the speed-bound window for this cell reaches outside the stored records` };
    }
    throw error;
  }
  const vT = I.vMag(crude.vel);
  const vO = I.vMag(O.vel);
  if (!(vT < C_KM_S)) {
    // Not worth subdividing: the speed bound comes from sum|c_k| of the
    // record's differentiated series, so it is a property of the record
    // and halving a cell inside one does not lower it. Splitting anyway
    // turned a one-line answer into 130,000 cells.
    return { ok: false, retry: false, why: `the target's speed bound over the emission window is ${vT.toFixed(3)} km/s, which is not below c, so the light-time iteration is not a contraction here` };
  }
  const tauSlope = (vT + vO) / (C_KM_S - vT);
  let T = {
    lo: Math.max(0, rough.tau - tauSlope * half - rough.errorSec - p.tauPadFloorSec),
    hi: rough.tau + tauSlope * half + rough.errorSec + p.tauPadFloorSec,
  };

  leave(lightTimeToken);

  for (let attempt = 0; attempt <= p.maxTauWidenings; attempt += 1) {
    const emitLo = t0 - T.hi;
    const emitHi = t1 - T.lo;
    let R;
    const targetToken = enter('target-enclosure');
    try {
      R = stateEnclosure(eph, targets, emitLo, emitHi, spend);
    } catch (error) {
      leave(targetToken);
      if (error instanceof PrecisionError && error.code === 'out-of-coverage') {
        return { ok: false, retry: true, why: `the emission window ${emitLo} .. ${emitHi} s TDB reaches outside the stored records` };
      }
      throw error;
    }
    leave(targetToken);

    // The contraction factor, from the pack's own differentiated series.
    // Not an assumed universal speed ceiling.
    const vMax = I.vMag(R.vel);
    const k = vMax / C_KM_S;
    if (!(k < 1)) {
      return { ok: false, retry: false, why: `the target's speed bound over the emission window is ${vMax.toFixed(3)} km/s, which is not below c, so the light-time iteration is not a contraction here` };
    }

    let D = I.vSub(R.pos, O.pos);
    // Where the target and the observer share a stored series -- the Moon
    // seen from the geocentre, both carrying the EMB -- the split form
    // above encloses that series twice, at two instants, and cancels
    // nothing: 5,852 km over a 60-second Moon cell where the vector moves
    // 58 km. The merged form encloses r_T(t) - r_O(t) as one weight map
    // and adds the retardation r_T(t - tau) - r_T(t) by Taylor about t
    // (see `localGeometry` in domain-partition.mjs, the same argument).
    // Both contain d(t); the cell keeps their intersection. Only where a
    // series is shared, so every other body's cells are bit for bit what
    // they were.
    const shared = mergedRetardation(eph, targets, observer, t0, t1, T, spend);
    if (shared) {
      D = I.vMeet(D, shared.d);
      if (D === null) {
        return { ok: false, retry: false, why: 'the split and merged enclosures of the geocentric vector do not meet, so one of them is wrong; nothing is decided here' };
      }
    }
    const dist = I.norm(D);
    if (!(dist.lo > 0)) {
      return { ok: false, retry: true, why: 'the target and the observer cannot be shown to be separated over this cell, so the direction is undefined' };
    }
    const phi = { lo: dist.lo / C_KM_S, hi: dist.hi / C_KM_S };
    if (!I.contains(T, phi)) {
      // Inflate to the hull of the candidate and its image, plus a
      // quarter. Phi is a strong contraction in tau, so this converges in
      // a step or two; multiplying a blind pad by four did not.
      const lo = Math.min(T.lo, phi.lo);
      const hi = Math.max(T.hi, phi.hi);
      const grow = 0.25 * (hi - lo) + p.tauPadFloorSec;
      T = { lo: Math.max(0, lo - grow), hi: hi + grow };
      continue;
    }

    // Self-mapping holds on T and the map is a contraction, so for every
    // reception time in this cell there is exactly one light-time in T,
    // and d(t) lies in D.
    const u = [I.div(D[0], dist), I.div(D[1], dist), I.div(D[2], dist)];
    let vRel = I.vSub(R.vel, O.vel);
    // v_T(t - tau) - v_O(t) = [v_T(t) - v_O(t)] + [v_T(t - tau) - v_T(t)],
    // the second within tau_max max|a_T|: the merged form again.
    if (shared) vRel = I.vMeet(vRel, shared.vRel) ?? vRel;
    const num = I.dot(u, vRel);
    const den = I.add(I.iv(C_KM_S), I.dot(u, R.vel));
    if (den.lo <= 0) return { ok: false, retry: true, why: 'the light-time derivative denominator cannot be bounded away from zero' };
    const tauDot = I.div(num, den);

    const oneMinus = I.sub(I.iv(1), tauDot);
    let dDot = I.vSub(I.vMulI(R.vel, oneMinus), O.vel);
    // d' = [v_T(t - tau) - v_O(t)] - v_T(t - tau) tau', the same quantity.
    if (shared) dDot = I.vMeet(dDot, I.vSub(vRel, I.vMulI(R.vel, tauDot))) ?? dDot;

    // ---------------------------------------------- solar deflection
    // Between light-time and aberration, which is the order
    // DEFLECTION-PROFILE.md section 4 fixes: coordinate direction ->
    // natural direction -> proper direction -> frame.
    let dIn = D;
    let dInDot = dDot;
    let distIn = dist;
    let deflectionReport = null;
    if (deflection) {
      let sunRec;
      let sunEm;
      const sunToken = enter('sun-enclosure');
      try {
        // The Sun at RECEPTION for e and em, and at EMISSION for q. Two
        // different epochs on purpose -- the profile's section 2 measures
        // the simpler reception-for-both at 1.96e-5 arcsec against
        // 3.13e-10 for this split, and the whole point of the split is
        // that it is nearly free once the emission window already exists.
        sunRec = stateEnclosure(eph, sunWeights, t0, t1, spend);
        sunEm = stateEnclosure(eph, sunWeights, emitLo, emitHi, spend);
      } catch (error) {
        leave(sunToken);
        if (error instanceof PrecisionError && error.code === 'out-of-coverage') {
          return { ok: false, retry: true, why: `the Sun's records do not cover this cell's reception or emission window: ${error.message}` };
        }
        throw error;
      }
      leave(sunToken);
      const deflectToken = enter('deflection');
      const { eRaw, eRawDot, qRaw, qRawDot } = deflectorGeometry(O, R, sunRec, sunEm, oneMinus);
      const df = deflectInterval(D, dDot, dist, eRaw, eRawDot, qRaw, qRawDot, control);
      leave(deflectToken);
      if (!df.ok) {
        return {
          ok: false,
          retry: df.retry === true,
          excluded: df.excluded === true,
          // Carried, not re-derived. Without this the subdivision loop
          // cannot tell a cell bisecting toward the domain floor from one
          // bisecting because its enclosures are loose, and the first
          // measurement made with it said 98.9% `loose-enclosure` and no
          // `domain-boundary` at all on a window that contains a
          // conjunction -- which was the flag going missing, not the
          // geometry.
          domainStraddle: df.domainStraddle === true,
          cosElongation: df.cosElongation ?? null,
          why: df.why,
        };
      }
      // The length is the DEFLECTED one. `d -> D` is a linear map, not a
      // rescaling, so `dist` does not carry over; see `deflectInterval`.
      dIn = df.D;
      dInDot = df.DDot;
      distIn = df.dist;
      deflectionReport = {
        tanDeflection: df.tanDeflection,
        cosElongation: df.cosElongation,
        qdqpe: df.qdqpe,
        limiterThreshold: df.limiterThreshold,
        emAu: df.emAu,
      };
    }

    const proj = (w, v) => I.add(I.add(I.scale(v[0], w[0]), I.scale(v[1], w[1])), I.scale(v[2], w[2]));
    const common = {
      ok: true,
      deflection: deflectionReport,
      tauInterval: T,
      contraction: k,
      emission: [emitLo, emitHi],
      distanceKm: dist,
      widenings: attempt,
    };

    if (aberration) {
      // The observer's velocity and acceleration in units of c, at
      // RECEPTION time -- O, not R, and not retarded. Dividing by c is a
      // rounded multiply that `vScale`'s widening covers.
      //
      // Returning here rather than below is not only tidiness: the
      // second-derivative block the light-time mode needs costs an
      // interval division, two multiplies and six vector operations per
      // cell, and the aberrated mode discards every one of them.
      const vc = I.vScale(O.vel, 1 / C_KM_S);
      const vcDot = I.vScale(O.acc, 1 / C_KM_S);
      const abToken = enter('aberration');
      const ab = aberrateInterval(dIn, dInDot, distIn, vc, vcDot);
      leave(abToken);
      // `ab.retry` is the transformation's own verdict on whether a
      // narrower cell could help: an enclosure that merely straddles the
      // domain edge can be tightened, an observer above c at every instant
      // of the cell cannot. Passing it through rather than assuming `true`
      // is what keeps the hopeless case to one refusal instead of two
      // hundred thousand.
      if (!ab.ok) return { ok: false, retry: ab.retry === true, why: ab.why };

      if (ofDate) {
        // Q(t) = R(t) P(t), and Q' = R' P dt/dtau + R P'. Three things
        // the chain rule needs and one of them is easy to drop: R' is
        // per TT CENTURY while the search's variable is TDB seconds, so
        // dt/dtau belongs on the R' term and nowhere else. Rotating P'
        // alone would be the derivative of a different function, and
        // freezing R at the cell midpoint would not be an of-date search.
        let frame;
        let clock;
        const frameToken = enter('frame');
        try {
          frame = frameProvider({ lo: t0, hi: t1 });
          clock = frame.clock;
        } catch (error) {
          leave(frameToken);
          if (error instanceof PrecisionError) {
            // An angle too large for the argument reduction does not
            // shrink when the cell does: it is set by the epoch, not the
            // width, so bisecting toward the enclosure floor spends the
            // budget to reach a verdict already available on the first
            // cell. Same reasoning as the superluminal speed bound below,
            // and the same disposition. Everything else the provider can
            // raise is about the cell and is worth another split.
            const hopeless = error.code === 'out-of-coverage';
            return { ok: false, retry: !hopeless, why: error.message };
          }
          throw error;
        }
        leave(frameToken);
        const Q = matApplyI(frame.R, ab.P);
        const QDot = [0, 1, 2].map((i) => I.add(
          I.mul(I.add(I.add(I.mul(frame.Rdot[i][0], ab.P[0]), I.mul(frame.Rdot[i][1], ab.P[1])), I.mul(frame.Rdot[i][2], ab.P[2])), clock.dtdTdb),
          I.add(I.add(I.mul(frame.R[i][0], ab.PDot[0]), I.mul(frame.R[i][1], ab.PDot[1])), I.mul(frame.R[i][2], ab.PDot[2])),
        ));
        // In the rotated frame the projection weights carry no obliquity:
        // the frame has already done that rotation, and doing it twice is
        // the mistake this separation exists to prevent.
        //
        // And they come from the VALIDATED trigonometry, not from
        // `Math.sin`. The two earlier modes use `Math.sin` for their
        // weights (above) and keep doing so -- they are released, and a
        // last-ulp change to a shipped mode's roots is not worth making --
        // but this mode's whole claim is that no unspecified host
        // function enters it. Review found the contract saying "Math.sin
        // is not used" while these two lines used it; the fix is the code,
        // not the sentence. `L` is at most 2*pi, inside MAX_ARG.
        const wL = sinCos(L);
        const dF = [wL.s, -wL.c, 0];
        const dG = [wL.c, wL.s, 0];
        const qNorm = I.norm(Q);
        if (!(qNorm.lo > 0)) {
          return { ok: false, retry: true, why: 'the rotated direction cannot be bounded away from zero length over this cell' };
        }
        return {
          ...common,
          observerSpeedOverC: ab.speed,
          frameAngles: frame.angles,
          tdbMinusTtSec: clock ? clock.tdbMinusTtSec : null,
          f: proj(dF, Q),
          g: proj(dG, Q),
          fDotEnclosure: proj(dF, QDot),
          M1: I.mag(proj(dF, QDot)),
          M2: null,
        };
      }

      return {
        ...common,
        observerSpeedOverC: ab.speed,
        f: proj(wF, ab.P),
        g: proj(wG, ab.P),
        // The interval-wide derivative of the projection, over the WHOLE
        // cell. The retarded mode pairs a midpoint value with a
        // second-derivative Lipschitz constant; that route needs |F''|,
        // which needs the observer's JERK, which the stored series are not
        // differentiated to. `0 not in [F']` establishes strict
        // monotonicity over the cell directly and needs nothing further.
        fDotEnclosure: proj(wF, ab.PDot),
        M1: I.mag(proj(wF, ab.PDot)),
        M2: null,
      };
    }

    // Second derivative, through the same implicit equation.
    const dDotMag = I.vMag(dDot);
    const uDotBound = (2 * dDotMag) / dist.lo;
    const uDot = [I.iv(-uDotBound, uDotBound), I.iv(-uDotBound, uDotBound), I.iv(-uDotBound, uDotBound)];
    const aRel = I.vSub(I.vMulI(R.acc, oneMinus), O.acc);
    const numDot = I.add(I.dot(uDot, vRel), I.dot(u, aRel));
    const denDot = I.add(I.dot(uDot, R.vel), I.dot(u, I.vMulI(R.acc, oneMinus)));
    const tauDotDot = I.div(I.sub(I.mul(numDot, den), I.mul(num, denDot)), I.mul(den, den));
    const dDotDot = I.vSub(
      I.vSub(I.vMulI(R.acc, I.mul(oneMinus, oneMinus)), I.vMulI(R.vel, tauDotDot)),
      O.acc,
    );

    return {
      ...common,
      f: proj(wF, D),
      g: proj(wG, D),
      fDot: proj(wF, dDot),
      M1: I.mag(proj(wF, dDot)),
      M2: I.mag(proj(wF, dDotDot)),
    };
  }
  return { ok: false, retry: true, why: `the light-time interval could not be shown to map into itself after ${p.maxTauWidenings + 1} attempts` };
}

/**
 * The one search loop. Both modes run it; they differ only in which
 * enclosures the cell builder hands back, which is the point -- a second
 * copy of a subdivision loop is a second place for the exclusion test to
 * drift away from the monotone test.
 *
 * @param {import('./ephemeris.mjs').Ephemeris} eph
 * @param {object} spec {body, targetDeg, fromTdbSec, toTdbSec, signal?, ...tuning}
 * @param {{aberration: boolean, mode: string, contract: object, kind: string}} shape
 */
/** How many cells of a run are examined for a reason, and how many reasons are kept. */
const REASON_SAMPLE_CELLS = 200;
const REASON_LIMIT = 4;

/**
 * Adjacent spans, joined.
 *
 * Subdivision produces cells that share endpoints exactly, so a region the
 * search cannot close comes back as a run of touching slivers rather than
 * as one span. Measured on a conjunction crossing: 1093 excluded cells and
 * 145 unresolved ones, which are 1 excluded run and 2 unresolved runs -- a
 * list of 1238 entries describing three intervals.
 *
 * This changes the PRESENTATION and not the set: the union is identical,
 * and `cells` on each run keeps the count that was merged away.
 *
 * ## Reasons are SAMPLED, and the reason they are
 *
 * Most refusal messages embed the cell's own numbers -- an emission window,
 * a speed bound, a pair of endpoints -- so over a long run nearly every
 * cell carries a distinct string. A first version collected them all,
 * deduplicating with `Array.prototype.includes`, which is quadratic in the
 * number of cells in a run. On the case that found it, one released test
 * file went from 9.9 seconds to 331. Nothing was wrong with the answers;
 * the cost was entirely in assembling a message.
 *
 * So: at most `REASON_LIMIT` distinct reasons, taken from the first
 * `REASON_SAMPLE_CELLS` cells of the run, and the result says that is what
 * they are. A reader who needs every one has `cells` and can narrow the
 * window.
 */
export function mergeSpans(list) {
  const sorted = [...list].sort((x, y) => x.fromTdbSec - y.fromTdbSec);
  const runs = [];
  for (const span of sorted) {
    const last = runs[runs.length - 1];
    if (last && span.fromTdbSec <= last.toTdbSec) {
      last.toTdbSec = Math.max(last.toTdbSec, span.toTdbSec);
      last.cells += 1;
      if (last.cells <= REASON_SAMPLE_CELLS && !last.seen.has(span.why)) {
        last.seen.add(span.why);
        if (last.whys.length < REASON_LIMIT) last.whys.push(span.why);
      }
    } else {
      runs.push({
        fromTdbSec: span.fromTdbSec,
        toTdbSec: span.toTdbSec,
        cells: 1,
        whys: [span.why],
        seen: new Set([span.why]),
      });
    }
  }
  return runs.map((r) => ({
    fromTtDays: r.fromTdbSec / DAY,
    toTtDays: r.toTdbSec / DAY,
    fromTdbSec: r.fromTdbSec,
    toTdbSec: r.toTdbSec,
    cells: r.cells,
    why: r.whys.length === 1
      ? r.whys[0]
      : `${r.whys.length}${r.seen.size > r.whys.length ? `+ of ${r.seen.size}` : ''} reasons, sampled from the first ${Math.min(r.cells, REASON_SAMPLE_CELLS)} of ${r.cells} adjacent cells: ${r.whys.join(' | ')}`,
    reasonsAreSampled: r.cells > 1,
  }));
}

/**
 * What was actually DECIDED: [a, b] with the gap spans removed and the
 * remainder merged.
 *
 * Only meaningful on a finished run. A run stopped by the budget or a
 * cancellation still has cells on its stack that were never visited, and
 * those are neither decided nor recorded anywhere -- so the caller gets
 * `null` rather than a list that would read as "everything else was
 * covered". That is the same overclaim `processedTdbSec` already avoids by
 * going empty, stated once here instead of twice.
 */
function decidedSpans(a, b, gaps) {
  const sorted = gaps.map((g) => [g.fromTdbSec, g.toTdbSec]).sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const [lo, hi] of sorted) {
    const last = merged[merged.length - 1];
    if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }
  const out = [];
  let cursor = a;
  for (const [lo, hi] of merged) {
    if (lo > cursor) out.push([cursor, lo]);
    cursor = Math.max(cursor, hi);
  }
  if (cursor < b) out.push([cursor, b]);
  return out;
}

function runSearch(eph, spec, shape) {
  const {
    aberration, ofDate = false, deflection = false, mode, contract, kind,
    frameProvider = iauFrameProvider, control = {},
  } = shape;
  const { body, targetDeg, fromTdbSec, toTdbSec, signal = null, ...tuning } = spec;
  for (const k of Object.keys(tuning)) {
    if (!(k in RETARDED_DEFAULTS)) fail('unsupported-option', `unknown retarded-search option ${k}`);
  }
  const p = { ...RETARDED_DEFAULTS, ...tuning };
  if (!contract.bodies.includes(body)) fail('unknown-body', `${body} is not in the ${aberration ? 'aberrated' : 'retarded'} contract`);
  for (const [k, v] of [['targetDeg', targetDeg], ['fromTdbSec', fromTdbSec], ['toTdbSec', toTdbSec]]) {
    if (!Number.isFinite(v)) fail('unsupported-option', `${k} must be a finite number`);
  }
  if (!(toTdbSec > fromTdbSec)) fail('unsupported-option', 'toTdbSec must be after fromTdbSec');
  for (const [k, v] of Object.entries(p)) if (!Number.isFinite(v) || v <= 0) fail('unsupported-option', `${k} must be positive and finite`);

  const lambda = ((targetDeg % 360) + 360) % 360;
  const a = fromTdbSec;
  const b = toTdbSec;
  const targets = targetWeights(eph, body);
  const observer = observerWeights(eph);
  // Resolved once. A pack without a Sun cannot support the deflected mode
  // at all, and finding that out on the first cell rather than per cell is
  // the difference between one typed refusal and one per subdivision.
  const sunWeights = deflection ? targetWeights(eph, 'Sun') : null;
  /**
   * The Sun does not deflect its own light.
   *
   * `DEFLECTION-PROFILE.md` section 2 says so and `reduce.mjs` already
   * skips it; this is where the search does. It has to be decided from the
   * BODY rather than per cell, because a cell cannot tell the two cases
   * apart: when the target is the Sun, `q = R - S` is a difference of the
   * same enclosure with itself, which interval arithmetic gives as
   * `[-w, +w]` and not as zero. Its lower bound on |q| is exactly 0 at
   * every width, so `deflectInterval` refuses and asks to be subdivided,
   * and the subdivision never converges. Measured before this skip
   * existed: the Sun over a 300-day window opened 153,842 cells in 76
   * seconds and returned nothing, where the of-date mode answers in 75 ms.
   *
   * A narrower cell CAN resolve a different body passing near the Sun's
   * centre, so the per-cell refusal stays retryable. Only the structural
   * case is decided here.
   */
  const deflectorIsTarget = deflection && body === 'Sun';
  const applyDeflection = deflection && !deflectorIsTarget;

  let evaluations = 0;
  const spend = () => {
    if (signal && signal.aborted) throw new PrecisionError('cancelled', 'the search was cancelled', { evaluations });
    evaluations += 1;
    // The same unit the budget counts, attributed to the phase in force.
    // One null check when no sink is installed.
    charge('evaluations');
    if (evaluations > p.maxEvaluations) fail('budget-exhausted', `the evaluation budget of ${p.maxEvaluations} was spent`, { evaluations });
  };

  const events = [];
  const unresolved = [];
  /**
   * Spans the MODE declines to answer for, as opposed to spans it failed
   * to decide. Only the deflected mode produces any: its supported domain
   * has an elongation floor, and a cell wholly inside it is outside the
   * profile, not merely hard. Kept apart from `unresolved` because the
   * two call for different things -- one is a reason to subdivide or
   * raise the budget, the other is a reason to stop -- and because a
   * result that merged them would report a domain refusal as a numerical
   * shortfall.
   */
  const excluded = [];
  /**
   * File a cell the enclosures could not close, into the RIGHT list.
   *
   * One helper because there are four places that do this and the
   * distinction is the one the deflected contract rests on: an excluded
   * span is a span this profile has no answer for at any resolution, an
   * unresolved one is a span this run did not settle. Three of the four
   * sites used to push straight into `unresolved` without looking at
   * `excluded`, so a domain refusal arriving through the bracket or the
   * endpoint evaluations would have been filed as a numerical shortfall,
   * carrying "no subdivision changes that" inside `accounting.unresolved`.
   *
   * Not reachable on any fixture here -- the enclosing cell has already
   * passed the domain test over a superset of the bracket -- which is
   * exactly why it is worth closing rather than leaving to a comment.
   */
  const file = (cell, lo, hi) => {
    (cell.excluded === true ? excluded : unresolved).push({ fromTdbSec: lo, toTdbSec: hi, why: cell.why });
  };
  let cells = 0;
  let status = 'finished';
  let reason = null;
  let worstContraction = 0;
  let widestTauSec = 0;
  let widestEmissionSec = 0;
  let worstObserverSpeedOverC = 0;
  /** The largest deflection any accepted cell admitted, and where the geometry came closest to the floor. */
  let widestDeflectionArcsec = 0;
  let maxCosElongation = -Infinity;
  /** How far the limiter was from firing: min over cells of q.(q+e) / dlim. Above 1 everywhere, or the cell was refused. */
  let tightestLimiterMargin = Infinity;
  /**
   * The widest the frame's own nutation-in-longitude enclosure grew on
   * any accepted cell, arcseconds. A frame enclosure is only useful while
   * it is narrow relative to the longitude the search is resolving, and a
   * result that does not report it is hiding the one number that says
   * whether the of-date rung cost anything.
   */
  let widestFrameSpan = 0;
  /**
   * The WIDTH of the cell that produced `widestFrameSpan`, seconds.
   *
   * Reporting the span without it invites the reading that the interval
   * nutation is loose on any cell. It is not: the span grows with the
   * cell, and the widest accepted cell on a 300-day window is tens of
   * days, not one. A results document written from the span alone said
   * "three arcseconds on a day-wide cell", which was wrong by a factor of
   * about thirty in the width. The number now travels with its cell.
   */
  let widestFrameSpanCellSec = 0;
  /**
   * The frame's own rate in ecliptic longitude, arcsec per TDB second, and
   * the TDB-TT values the run actually used.
   *
   * The rate is what turns the time model's 3e-5 s into an angle. Without
   * it the conversion approximation cannot be reported in the same units
   * as the thing it perturbs, and a reader is left to guess whether it
   * matters. Taken from |d(psib + dpsi)/dt| over the accepted cells, which
   * is the derivative the frame chain already computed.
   */
  let worstPsiRateArcsecPerSec = 0;
  let tdbMinusTtLo = Infinity;
  let tdbMinusTtHi = -Infinity;
  /**
   * Every cell whose enclosures were established feeds this, not only the
   * subdivision cells: the midpoint and endpoint evaluations and the
   * bracket cell are accepted cells too, and a figure that skipped them
   * would be an upper bound over less of the interval than its own note
   * claims.
   */
  /**
   * Cell evaluations, and how many had the deflection applied.
   *
   * `retardedCell` is reached from three places -- the subdivision loop,
   * the pointwise evaluator the bisection uses, and the bracket enclosure
   * -- and all three run through here. Two of them were once left without
   * the deflection arguments, so the roots were isolated on a different
   * function from the one the cells were proved monotone on. Counting both
   * sides turns that from something a reader has to notice into something
   * the result states.
   */
  let cellEvaluations = 0;
  let deflectedCellEvaluations = 0;
  const noteObserverSpeed = (c) => {
    if (c && c.ok) {
      cellEvaluations += 1;
      if (c.deflection) deflectedCellEvaluations += 1;
    }
    if (c && c.ok && c.observerSpeedOverC) {
      worstObserverSpeedOverC = Math.max(worstObserverSpeedOverC, c.observerSpeedOverC.hi);
    }
  };

  // Every evaluation of the root function goes through here, and it must
  // be the SAME function the cells were proved monotone on. It was not:
  // this and the bracket call below were left without the deflection
  // arguments, so the exclusion and monotone tests ran on the deflected
  // direction while the bisection that actually located each root ran on
  // the undeflected one. The search reported the of-date times, bit for
  // bit, under the deflected mode's name -- and worse than a wrong time,
  // a bracket found on one function inside a cell proved monotone for
  // another is not the enclosure the completeness claim rests on.
  //
  // The reason it was invisible: the events looked exactly right, because
  // they were exactly the events of a mode that works.
  const at = (t) => {
    const c = retardedCell(eph, targets, observer, lambda, t, t, spend, p, aberration, ofDate, frameProvider, applyDeflection, sunWeights, control);
    noteObserverSpeed(c);
    return c;
  };

  // Seed at the record boundaries of every contributing series, the way
  // the geometric mode does. One cell spanning a year is hopeless: the
  // mean-value position enclosure over it covers the whole orbit, the
  // difference straddles zero in every component, and the very first
  // thing that fails is "the target and the observer cannot be shown to
  // be separated". Measured on Mars over 2019: one cell, 22 evaluations,
  // nothing established. Record-length seeds start where the enclosures
  // are already tight enough to mean something.
  const seeds = [];
  {
    const edges = new Set([a, b]);
    for (const name of new Set([...targets.keys(), ...observer.keys()])) {
      const sb = eph.bodies.get(name);
      const first = Math.floor((a - sb.initEt) / sb.intervalSec);
      const last = Math.floor((b - sb.initEt) / sb.intervalSec);
      for (let i = Math.max(0, first); i <= Math.min(sb.nrec - 1, last + 1); i += 1) {
        const e = sb.initEt + i * sb.intervalSec;
        if (e > a && e < b) edges.add(e);
      }
    }
    const sorted = [...edges].sort((x, y) => x - y);
    for (let i = sorted.length - 1; i >= 1; i -= 1) seeds.push([sorted[i - 1], sorted[i]]);
  }

  try {
    const stack = seeds;
    while (stack.length) {
      const [lo, hi, why] = stack.pop();
      setLabel(why ?? 'seed');
      cells += 1;
      charge('cells');
      if (cells > p.maxCells) fail('budget-exhausted', `the retarded search passed ${p.maxCells} cells`, { cells });
      const m = (lo + hi) / 2;
      // NOT (hi - lo) / 2. `hi - lo` is exact by Sterbenz but `lo + hi`
      // rounds, so the computed midpoint sits off-centre by up to
      // ulp(m)/2 and the true lever arm max|x - m| over [lo, hi] exceeds
      // (hi - lo) / 2 by that much. On a two-ulp cell that is a third of
      // the half-width, and the exclusion test below then excludes a
      // real root: measured, a crafted cell at t = 5e11 s returned
      // `proven, isExactTotal, 0 events` over an interval whose crossing
      // the same solver brackets when the window moves by a millisecond.
      // Taking the larger of the two actual distances is exact and free.
      const w = Math.max(hi - m, m - lo);

      const cell = retardedCell(eph, targets, observer, lambda, lo, hi, spend, p, aberration, ofDate, frameProvider, applyDeflection, sunWeights, control);
      if (!cell.ok) {
        // A cell too wide for its own enclosures is a cell to split, not
        // a cell to give up on -- down to the enclosure floor, past which
        // the failure is about the geometry rather than the width.
        if (cell.retry && hi - lo > p.enclosureFloorSec) {
          // The one split whose reason the partition work is about: a cell
          // whose elongation enclosure straddles the floor is bisecting
          // toward a DOMAIN boundary, and a cell whose enclosures are
          // merely loose is bisecting toward resolution. They cost the
          // same and they are not the same problem, so the stack carries
          // which it is.
          const tag = cell.domainStraddle === true ? 'domain-boundary' : 'loose-enclosure';
          stack.push([m, hi, tag], [lo, m, tag]);
          continue;
        }
        file(cell, lo, hi);
        continue;
      }
      worstContraction = Math.max(worstContraction, cell.contraction);
      widestTauSec = Math.max(widestTauSec, cell.tauInterval.hi - cell.tauInterval.lo);
      widestEmissionSec = Math.max(widestEmissionSec, cell.emission[1] - cell.emission[0]);
      noteObserverSpeed(cell);
      if (cell.deflection) {
        widestDeflectionArcsec = Math.max(widestDeflectionArcsec, cell.deflection.tanDeflection.hi * (180 * 3600) / Math.PI);
        maxCosElongation = Math.max(maxCosElongation, cell.deflection.cosElongation.hi);
        tightestLimiterMargin = Math.min(tightestLimiterMargin, cell.deflection.qdqpe.lo / cell.deflection.limiterThreshold);
      }
      if (cell.frameAngles && cell.frameAngles.dpsi) {
        const span = cell.frameAngles.dpsi.hi - cell.frameAngles.dpsi.lo;
        if (span > widestFrameSpan) { widestFrameSpan = span; widestFrameSpanCellSec = hi - lo; }
        // psiDot is radians per TT CENTURY, the variable the polynomial and
        // the nutation series are both written in.
        worstPsiRateArcsecPerSec = Math.max(
          worstPsiRateArcsecPerSec,
          I.mag(cell.frameAngles.psiDot) / DAS2R / CENTURY_SEC,
        );
      }
      if (cell.tdbMinusTtSec) {
        tdbMinusTtLo = Math.min(tdbMinusTtLo, cell.tdbMinusTtSec.lo);
        tdbMinusTtHi = Math.max(tdbMinusTtHi, cell.tdbMinusTtSec.hi);
      }

      // 1. Exclusion. The midpoint enclosure already carries every error.
      const fm = at(m);
      if (!fm.ok) {
        if (fm.retry && hi - lo > p.enclosureFloorSec) {
          const tag = fm.domainStraddle === true ? 'domain-boundary' : 'loose-enclosure';
          stack.push([m, hi, tag], [lo, m, tag]);
          continue;
        }
        file(fm, lo, hi);
        continue;
      }
      if (I.mig(fm.f) > cell.M1 * w) continue;

      // 2. Monotone. Two routes to the same conclusion, and which one is
      // available depends on how far the stored series can be
      // differentiated. The light-time mode pairs the midpoint derivative
      // with a Lipschitz constant for it, which needs |f''| and so the
      // target's acceleration. The aberrated mode's F'' would need the
      // OBSERVER's jerk as well, which the pack is not differentiated to,
      // so it establishes monotonicity the direct way instead: an
      // interval-wide enclosure of F' that excludes zero. Both are sound;
      // neither is a relaxation of the other.
      //
      // Keyed off `aberration`, NOT off whether `fDotEnclosure` happens to
      // be set. The aberrated branch sets `M2: null` beside it, and
      // `null * w` is 0, so an edit that ever left `fDotEnclosure` out of
      // an aberrated cell would silently fall through to
      // `I.mig(fm.fDot) > 0` -- a condition on ONE POINT, which does not
      // establish monotonicity over a cell and would close a cell holding
      // two roots. The flag cannot be absent, and the assertion below
      // means the Lipschitz route can never run without its constant.
      if (!aberration && !Number.isFinite(cell.M2)) {
        fail('enclosure-too-weak', 'the monotone test needs a finite second-derivative bound', { cell: [lo, hi] });
      }
      const monotone = aberration
        ? I.mig(cell.fDotEnclosure) > 0
        : I.mig(fm.fDot) > cell.M2 * w;
      if (monotone) {
        const flo = at(lo);
        const fhi = at(hi);
        if (!flo.ok || !fhi.ok) { file(flo.ok ? fhi : flo, lo, hi); continue; }
        const sgn = (x) => (x.lo > 0 ? 1 : x.hi < 0 ? -1 : 0);
        const sLo = sgn(flo.f);
        const sHi = sgn(fhi.f);
        if (sLo === 0 || sHi === 0) {
          // The sign at an endpoint is inside the enclosure's own width, so
          // it is not known. Declining keeps the exact total honest.
          unresolved.push({ fromTdbSec: lo, toTdbSec: hi, why: 'an endpoint value could not be separated from zero, so its sign is not established' });
          continue;
        }
        if (sLo === sHi) continue;                       // monotone, no sign change, no root

        let a2 = lo; let b2 = hi; let sa = sLo;
        while (b2 - a2 > p.minWidthSec) {
          const mm = (a2 + b2) / 2;
          if (!(mm > a2 && mm < b2)) break;
          const fmm = at(mm);
          if (!fmm.ok) break;
          const s = sgn(fmm.f);
          if (s === 0) break;                            // narrowed into the noise; the bracket stands
          if (s === sa) { a2 = mm; sa = s; } else b2 = mm;
        }
        // The half-plane, with its own enclosure over the bracket.
        const br = retardedCell(eph, targets, observer, lambda, a2, b2, spend, p, aberration, ofDate, frameProvider, applyDeflection, sunWeights, control);
        noteObserverSpeed(br);
        if (!br.ok) { file(br, a2, b2); continue; }
        if (br.g.lo <= 0) {
          if (br.g.hi < 0) continue;                     // the antipode, not the requested direction
          unresolved.push({ fromTdbSec: a2, toTdbSec: b2, why: 'the half-plane projection could not be shown non-zero over this bracket, so the direction is not determined here' });
          continue;
        }
        const mm = (a2 + b2) / 2;
        events.push({
          tdbSec: mm,
          ttDaysIfTdbIsTt: mm / DAY,
          jdTdb: mm / DAY + J2000_JD,
          bracketTdbSec: [a2, b2],
          bracketWidthSec: b2 - a2,
          kind: 'transversal',
      // NOT `f increasing`. f = sin(L) x - cos(L) (cos(e) y + sin(e) z) is
      // R sin(L - lambda), so df/dlambda = -R cos(L - lambda), which is
      // -R at the crossing: f FALLS as the longitude rises. Reporting the
      // sign of f's own change labelled every event backwards. Measured on
      // the retrograde fixture before the fix: the crossing at day -58.53,
      // where the aberrated longitude runs 94.99825 -> 95.00175 over ten
      // minutes, came back `decreasing`.
          direction: sHi > sLo ? 'decreasing' : 'increasing',
          lightTimeSec: br.tauInterval,
          halfPlaneMarginKm: br.g.lo,
          distanceKm: [br.distanceKm.lo, br.distanceKm.hi],
        });
        continue;
      }

      // 3. Neither test closed it.
      if (hi - lo <= p.minWidthSec) {
        unresolved.push({ fromTdbSec: lo, toTdbSec: hi, why: 'neither the exclusion nor the monotone test closed this cell at the subdivision floor' });
        continue;
      }
      // Neither test closed it: a resolution question, not a domain one.
      stack.push([m, hi, 'not-yet-monotone'], [lo, m, 'not-yet-monotone']);
    }
  } catch (error) {
    if (error instanceof PrecisionError && (error.code === 'budget-exhausted' || error.code === 'cancelled')) {
      status = error.code;
      reason = error.message;
    } else throw error;
  }

  events.sort((x, y) => x.tdbSec - y.tdbSec);
  excluded.sort((x, y) => x.fromTdbSec - y.fromTdbSec);
  // An excluded span leaves the request partly uncovered just as surely as
  // an unresolved one. `buildResult`'s invariant 8 enforces the same thing
  // structurally, so this and that cannot drift apart silently.
  const accounted = status === 'finished' && unresolved.length === 0 && excluded.length === 0;
  // Computed once. Both the span list and the fraction need it, and on a
  // run with many open cells the sort is not free.
  const decided = status === 'finished' ? decidedSpans(a, b, [...unresolved, ...excluded]) : null;
  const excludedRuns = mergeSpans(excluded);

  // One noun for the thing the search is complete ABOUT, so no sentence
  // below can say "light-time-corrected" while the aberrated mode is
  // running. The earlier contract defect in this package was exactly that:
  // a description left behind when the quantity moved.
  const corrected = applyDeflection
    ? 'light-time-, solar-deflection- and aberration-corrected, in the ecliptic of date with the true equinox of date as origin,'
    : ofDate
    ? 'light-time- and aberration-corrected, in the ecliptic of date with the true equinox of date as origin,'
    : aberration
      ? 'light-time- and aberration-corrected'
      : 'light-time-corrected';

  /**
   * The same rule applied to the CONTRACT, which `request` spreads.
   *
   * `corrected` above keeps `completeness.statement` honest on the
   * deflector-as-target path, and for one release `request` did not
   * follow: a Sun result carried `operation: '... CORRECTED FOR RECEPTION
   * LIGHT-TIME, SOLAR GRAVITATIONAL LIGHT DEFLECTION AND STELLAR
   * ABERRATION ...'` and `applied[1]: 'solar gravitational light
   * deflection'` beside `diagnostics.deflection.appliedToThisBody: false`
   * and a widest deflection of exactly zero. Two sentences about one
   * quantity, and the wrong one is the sentence `experimental.mjs` tells
   * consumers to read before comparing anything with an almanac.
   *
   * What the Sun path actually computes IS the of-date rung, so it
   * carries the of-date rung's description. The deflection metadata
   * stays: a caller needs to know which mode answered, and
   * `deflectionNotApplied` says in one field why the description is the
   * rung below the mode's name.
   */
  const effectiveContract = deflectorIsTarget
    ? {
      ...contract,
      operation: OF_DATE_CONTRACT.operation,
      applied: OF_DATE_CONTRACT.applied,
      notApplied: OF_DATE_CONTRACT.notApplied,
      comparableTo: OF_DATE_CONTRACT.comparableTo,
      deflectionNotApplied: 'the target IS the deflector, so no deflection was applied and this contract describes the of-date rung. diagnostics.deflection.notAppliedBecause has the reason.',
    }
    : contract;

  return buildResult({
    mode,
    request: {
      kind,
      body,
      targetDeg,
      normalisedTargetDeg: lambda,
      isSystemBarycentre: BARYCENTRE_NOT_CENTRE.includes(body),
      ...effectiveContract,
    },
    events,
    interval: {
      requestedTdbSec: [a, b],
      requestedTtDays: [a / DAY, b / DAY],
      requestedSpanDays: (b - a) / DAY,
      processedTdbSec: accounted ? [[a, b]] : [],
      processedSpanDays: accounted ? (b - a) / DAY : 0,
      processedFraction: accounted ? 1 : 0,
      // What was decided, span by span, rather than one Boolean about the
      // whole window. For a mode with a restricted domain this is the
      // useful field: the request can be mostly decided and partly
      // declined, and `processedTdbSec` going empty says only that it was
      // not all decided, not which parts were.
      decidedTdbSec: decided,
      decidedFraction: decided === null
        ? null
        : decided.reduce((acc, [lo, hi]) => acc + (hi - lo), 0) / (b - a),
      cells,
      subdivisionFloorSec: p.minWidthSec,
      units: 'TDB seconds past J2000, in and out',
    },
    execution: {
      status,
      finished: status === 'finished',
      evaluations,
      maxEvaluations: p.maxEvaluations,
      cells,
      reason,
    },
    accounting: {
      allIntervalsAccountedFor: accounted,
      unresolved: mergeSpans(unresolved),
      unresolvedCells: unresolved.length,
      excluded: excludedRuns,
      excludedCells: excluded.length,
      excludedNote: deflection
        ? `Spans this profile DECLINES to answer for, not spans it failed to decide. ${DEFLECTION_PROFILE.id} supports solar elongations of at least ${MIN_ELONGATION_RAD / DEG} degrees; inside that floor the first-order deflection model's own omitted second-order term grows past what the correction is worth, the limiter threshold and the solar disc are both nearby, and a finite answer there is not an observable direction. No subdivision and no budget reaches them. Any crossing inside an excluded span is neither found nor ruled out, so the event list is NOT exhaustive over the requested window -- only over the decided spans.`
        : 'this mode has no restricted domain, so nothing is ever excluded',
      note: accounted
        ? `every cell left by the exclusion test or the monotone test, both from enclosures that follow from bounds true of the stored polynomial and a verified light-time contraction${aberration ? ', with the observer-motion transformation applied over the whole cell rather than at sampled instants' : ''}${applyDeflection ? ', and the solar deflection applied over the whole cell with the limiter proved inactive on each' : ''}`
        : `at least one cell could not be closed, its light-time interval could not be established${excluded.length > 0 ? `, or it fell inside this profile's supported-domain floor (${excludedRuns.length} span${excludedRuns.length === 1 ? '' : 's'})` : ''}`,
    },
    completeness: {
      established: accounted,
      support: accounted ? SUPPORT.proven : SUPPORT.none,
      statement: !accounted && excluded.length > 0
        ? `Nothing about completeness over the requested interval: ${excludedRuns.length} span${excludedRuns.length === 1 ? '' : 's'} fell inside this profile's supported-domain floor and were not examined. The events listed were isolated on the decided spans and are a lower bound over the request, not a total.`
        : accounted
        ? `Every crossing of the requested longitude by the ${corrected} direction, for the function this pack defines, over the requested interval. The light-time is a verified contraction, not an iteration that stopped changing.${aberration ? ' The aberration is applied to an enclosure of the direction over each whole cell, so no crossing can hide between samples of it.' : ''}`
        : 'Nothing about completeness was established.',
      conditionalOn: [],
    },
    assumptions: [],
    eventCount: {
      found: events.length,
      isExactTotal: accounted,
      lowerBound: events.length,
      upperBound: accounted ? events.length : null,
      support: accounted ? SUPPORT.proven : SUPPORT.none,
      conditionalTotal: null,
      conditionalPossibleTotals: null,
      note: accounted
        ? `exact for the ${aberration ? 'retarded and aberrated' : 'retarded'} function this pack defines`
        : 'a lower bound: what was isolated, with at least one region undecided',
    },
    uncertainty: {
      numerical: {
        subdivisionFloorSec: p.minWidthSec,
        worstContractionFactor: worstContraction,
        widestLightTimeIntervalSec: widestTauSec,
        widestEmissionWindowSec: widestEmissionSec,
        ...(aberration ? { worstObserverSpeedOverC } : {}),
        note: `The contraction factor is max|v_target|/c over the emission window, taken from sum|c_k| of the differentiated stored series. Below 1 it gives existence, uniqueness and an a-posteriori error bound by Banach.${aberration ? ' worstObserverSpeedOverC is the largest |v_observer|/c the enclosure of ANY cell this run established admitted -- subdivision cells, the midpoint and endpoint evaluations and the bracket cells alike, including cells the exclusion test then discarded, so it is an upper bound over more of the interval than the reported events; the transformation needs it below 1, and a cell where it could not be shown below 1 is refused, not approximated.' : ''}`,
      },
      ...(ofDate
        ? {
          /**
           * The three sources `OF-DATE-PREREGISTRATION.md` section 5 keeps
           * apart. They are NOT summed: a reader can shrink the first by
           * spending more, cannot shrink the second at all without changing
           * the declared model, and cannot bound the third from inside this
           * package. One combined number would hide which is which.
           */
          timeScale: {
            implementationNumerical: {
              bounded: true,
              widestFrameAngleSpanArcsec: widestFrameSpan,
              widestFrameAngleCellSec: widestFrameSpanCellSec,
              what: 'the proven width of the frame\'s own enclosure over a cell, arcsec of nutation in longitude, with the width of the cell that produced it -- the span grows with the cell and means nothing without it',
            },
            conversionApproximation: {
              bounded: true,
              model: TIME_MODEL.name,
              statedModelErrorSec: TIME_MODEL.statedModelErrorSec,
              tdbMinusTtUsedSec: Number.isFinite(tdbMinusTtLo) ? [tdbMinusTtLo, tdbMinusTtHi] : null,
              frameRateBoundArcsecPerSec: worstPsiRateArcsecPerSec,
              inducedLongitudeArcsec: worstPsiRateArcsecPerSec * TIME_MODEL.statedModelErrorSec,
              what: 'the declared TDB-TT model error carried into longitude through a BOUND on the frame\'s rate. A property of the model, not of this code: tightening the intervals cannot tighten it.',
              rateNote: 'frameRateBoundArcsecPerSec is the interval ENCLOSURE of d(psib + dpsi)/dt over the widest cell, not the instantaneous rate. On a wide cell it is the sum of 77 term-derivative bounds and runs well above the real rate -- around 137 arcsec/yr against an actual order of 1. It errs conservative, so the induced figure above is an upper bound; it is named as a bound because an earlier name read like a physical rate.',
            },
            externalTimeModel: {
              bounded: false,
              what: 'that the pack\'s time argument is whatever its producer meant by it, and that the TDB-TT series is itself an approximation to a relation defined by a solar-system model',
              note: 'outside this package entirely; stated, never bounded here',
            },
          },
        }
        : {}),
      ...(deflection
        ? {
          /**
           * Kept apart for the same reason the time-scale sources are.
           * The first shrinks if a caller spends more; the second and
           * third do not move without changing the declared model; the
           * fourth is not bounded here at all. Summing them would hide
           * which is which.
           */
          deflection: {
            implementationNumerical: {
              bounded: true,
              widestDeflectionArcsec,
              tightestLimiterMarginRatio: Number.isFinite(tightestLimiterMargin) ? tightestLimiterMargin : null,
              what: 'the enclosure of the deflection over a cell, and how far q.(q+e) stayed above the limiter threshold. A ratio at or below 1 would mean the clamp could not be shown inactive, and such a cell is refused rather than differentiated through.',
            },
            modelOmission: {
              bounded: true,
              secondOrderArcsecAt5Deg: 4.23e-7,
              secondOrderArcsecAt10Deg: 4.97e-8,
              what: 'the second-order term eraLd itself omits, measured against an independent ray integration. A property of the MODEL, not of this code: tightening the intervals cannot tighten it, and it is the reason the supported domain stops at five degrees.',
            },
            deflectorSet: {
              bounded: true,
              deflectors: DEFLECTION_PROFILE.deflectors,
              what: 'only the Sun deflects here. Jupiter reaches about 0.017 arcsec at its own limb and is not modelled; neither is any other body.',
            },
            externalPhysical: {
              bounded: false,
              what: 'that a first-order Schwarzschild deflection by a single body represents what a telescope would see, and that the pack\'s positions are the ones the real bodies had',
              note: 'outside this package entirely; stated, never bounded here',
            },
          },
        }
        : {}),
      ...OUTSIDE,
    },
    diagnostics: {
      lightTime: {
        model: contract.lightTime,
        cKmPerSec: C_KM_S,
        worstContractionFactor: worstContraction,
      },
      ...(ofDate
        ? {
          frameOfDate: {
            frame: contract.frame,
            models: contract.models,
            evaluation: contract.evaluation,
            timeModel: contract.timeModel,
            obliquityEntersTheProjection: false,
            widestFrameAngleSpanArcsec: widestFrameSpan,
            widestFrameAngleCellSec: widestFrameSpanCellSec,
            supportedRange: contract.supportedRange,
            modelRangeTdbSec: OF_DATE_MODEL_RANGE_TDB_SEC,
            requestWithinModelRange: a >= OF_DATE_MODEL_RANGE_TDB_SEC[0] && b <= OF_DATE_MODEL_RANGE_TDB_SEC[1],
            outsideModelRangeMeans: 'the enclosures still hold about the model as implemented; the claim that the model represents the sky does not',
          },
        }
        : {}),
      ...(aberration
        ? {
          aberration: {
            model: contract.aberration,
            potentialTermApplied: false,
            observerRetarded: false,
            monotonicity: 'an interval enclosure of F\' over the whole cell that excludes zero, not a midpoint derivative against a second-derivative bound',
            worstObserverSpeedOverC,
          },
        }
        : {}),
      ...(deflection
        ? {
          deflection: {
            profile: DEFLECTION_PROFILE.id,
            form: DEFLECTION_PROFILE.form,
            epochs: DEFLECTION_PROFILE.epochs,
            limiter: DEFLECTION_PROFILE.limiter,
            order: contract.order,
            supportedDomain: contract.supportedDomain,
            minElongationDeg: MIN_ELONGATION_RAD / DEG,
            // An ENCLOSURE's upper bound over the cells of this run, not a
            // value at an instant, and it can exceed the largest deflection
            // the domain actually admits: 0.094847 arcsec from the closed
            // form against 0.161 reported on a case whose cells reach the
            // floor, where `e x q` is closest to cancelling and the
            // enclosure is therefore loosest. Named here because the field
            // reads like a measurement and is not one.
            widestDeflectionArcsec,
            widestDeflectionIsAnEnclosureUpperBound: true,
            // The domain verdict as the code actually takes it: a cosine,
            // from `sinCos` and four arithmetic operations. Comparable
            // between engines, which the degrees below are not.
            closestElongationCos: Number.isFinite(maxCosElongation) ? maxCosElongation : null,
            // Reporting only, and NOT comparable across engines:
            // `Math.acos` is implementation-defined in ECMAScript. The
            // DOMAIN test is the cosine above, which needs no inverse
            // trigonometry; this is the same number in the unit a reader
            // thinks in.
            closestElongationDeg: Number.isFinite(maxCosElongation)
              ? (Math.acos(Math.min(1, Math.max(-1, maxCosElongation))) * 180) / Math.PI
              : null,
            closestElongationIsAReport: true,
            tightestLimiterMarginRatio: Number.isFinite(tightestLimiterMargin) ? tightestLimiterMargin : null,
            appliedToThisBody: applyDeflection,
            control: Object.keys(control).length === 0 ? null : { ...control },
            notAppliedBecause: deflectorIsTarget
              ? 'the target IS the deflector: the Sun does not deflect its own light, and the formula is degenerate there. DEFLECTION-PROFILE.md section 2. This result is the of-date one; the mode name is kept so the ladder stays comparable, and this field is how a reader tells.'
              : null,
            lengthRecomputedAfterDeflection: true,
            cellEvaluations,
            deflectedCellEvaluations,
            everyCellEvaluationDeflected: cellEvaluations === deflectedCellEvaluations,
            excludedSpans: excludedRuns.length,
            excludedCells: excluded.length,
          },
        }
        : {}),
      notApplied: effectiveContract.notApplied,
    },
  });
}

/**
 * `validated-retarded-geometric`. Light-time only; the observer's own motion
 * does not enter the direction. Unchanged by the aberrated mode's arrival.
 */
export function searchRetardedLongitude(eph, spec = {}) {
  return runSearch(eph, spec, {
    aberration: false,
    mode: 'validated-retarded-geometric',
    contract: RETARDED_CONTRACT,
    kind: 'retarded-geometric-longitude',
  });
}

/**
 * `validated-retarded-aberrated`. Light-time AND the observer's motion.
 *
 * Not an apparent place: deflection, the Shapiro delay, precession,
 * nutation, the frame bias and everything topocentric are all still absent,
 * and `notApplied` on every result lists them by name. The name says what
 * it computes, which is the whole reason it is not called
 * `validated-apparent-of-date`.
 */
export function searchAberratedLongitude(eph, spec = {}) {
  return runSearch(eph, spec, {
    aberration: true,
    mode: 'validated-retarded-aberrated',
    contract: ABERRATED_CONTRACT,
    kind: 'retarded-aberrated-longitude',
  });
}

/**
 * The frame this mode means: the IAU chain over the cell's own TDB
 * interval, with the time-scale conversion it needs.
 *
 * A FUNCTION rather than a hard call, because seven of the cases
 * `OF-DATE-PREREGISTRATION.md` section 6 declares are about what the
 * search does with a frame whose behaviour is known in closed form -- an
 * identity, a constant rotation, one turning at a fixed rate, one
 * oscillating. Those cannot be written against the real IAU frame, whose
 * truth is exactly as hard to establish as the thing under test.
 */
export function iauFrameProvider(tdbInterval) {
  const clock = ttCenturiesInterval(tdbInterval);
  const { R, Rdot, angles } = frameMatrixInterval(clock.t);
  return { R, Rdot, angles, clock };
}

/**
 * The of-date search with a frame supplied by the caller.
 *
 * Deliberately NOT re-exported from `experimental.mjs`: a consumer that
 * could pass its own rotation could make the mode report a longitude in
 * a frame the result object then misdescribes. This exists for the
 * synthetic cases and for tests, and it is the same code path the real
 * mode takes -- injecting the frame is the only difference.
 */
export function searchOfDateLongitudeWithFrame(eph, spec, frameProvider) {
  if (typeof frameProvider !== 'function') fail('unsupported-option', 'a frame provider must be a function');
  return runSearch(eph, spec, {
    aberration: true,
    ofDate: true,
    frameProvider,
    mode: 'validated-retarded-aberrated-of-date',
    contract: OF_DATE_CONTRACT,
    kind: 'retarded-aberrated-of-date-longitude',
  });
}

/**
 * `validated-retarded-aberrated-of-date`. Light-time, the observer's
 * motion, AND the date-dependent frame.
 *
 * Still not an apparent place: gravitational deflection, the Shapiro
 * delay and everything topocentric are absent, and `notApplied` on every
 * result says so. What this adds over the aberrated mode is the FRAME --
 * the same one the released reducer projects into, from the same
 * constants -- so the longitude it reports is measured from the true
 * equinox of date rather than from a fixed direction 2000 years of
 * precession away.
 */
export function searchOfDateLongitude(eph, spec = {}) {
  return runSearch(eph, spec, {
    aberration: true,
    ofDate: true,
    mode: 'validated-retarded-aberrated-of-date',
    contract: OF_DATE_CONTRACT,
    kind: 'retarded-aberrated-of-date-longitude',
  });
}

/**
 * `validated-retarded-aberrated-deflected-of-date`. Light-time, SOLAR
 * DEFLECTION, the observer's motion, and the date-dependent frame.
 *
 * The first mode in this package with a restricted domain. Read
 * `accounting.excluded` before reading `events`: a run that crossed the
 * five-degree floor returns a list that is a lower bound over the
 * requested window, not a total, and `completeness.established` is false
 * to say so. `interval.decidedTdbSec` gives the spans the list IS
 * exhaustive over.
 *
 * Requires a pack containing the Sun. Without one this refuses with
 * `unknown-body` on the first cell rather than per cell.
 */
export function searchDeflectedLongitude(eph, spec = {}) {
  return runSearch(eph, spec, {
    aberration: true,
    ofDate: true,
    deflection: true,
    mode: 'validated-retarded-aberrated-deflected-of-date',
    contract: DEFLECTED_CONTRACT,
    kind: 'retarded-aberrated-deflected-of-date-longitude',
  });
}

/**
 * The deflected search with the profile's two constants overridden.
 *
 * Deliberately NOT re-exported from `experimental.mjs`, for the same
 * reason `searchOfDateLongitudeWithFrame` is not: a consumer that could
 * set `srs` could make the mode report a deflection it did not apply while
 * the result still carried the deflected mode's name. It exists for the
 * CONTROL cases of `DEFLECTION-EVALUATION.md` section 5 -- zero deflecting
 * mass, and the distant-source approximation -- and it is the same code
 * path the real mode takes, with the override as the only difference.
 * Every result says what it was given, in
 * `diagnostics.deflection.control`.
 */
/**
 * The deflected search over a span whose supported-domain membership the
 * CALLER has already proved.
 *
 * Internal. Not exported from `experimental.mjs`, not reachable from any
 * public entry point, and sound only when the caller really has the proof
 * -- see `domainProvedByCaller` in `deflection.mjs` for what it skips and
 * what it does not.
 */
export function searchDeflectedLongitudeOnProvedDomain(eph, spec) {
  return runSearch(eph, spec, {
    aberration: true,
    ofDate: true,
    deflection: true,
    control: { domainProvedByCaller: true },
    mode: 'validated-retarded-aberrated-deflected-of-date',
    contract: DEFLECTED_CONTRACT,
    kind: 'retarded-aberrated-deflected-of-date-longitude',
  });
}

export function searchDeflectedLongitudeWithControl(eph, spec, control) {
  if (control === null || typeof control !== 'object') {
    fail('unsupported-option', 'a deflection control must be an object');
  }
  for (const k of Object.keys(control)) {
    // `domainProvedByCaller` is deliberately NOT here. It disables the
    // supported-domain gate, which is only sound with a proof in hand,
    // and this entry point cannot check for one. The partitioned search
    // sets it internally, having just produced that proof.
    if (!['srs', 'distantSource'].includes(k)) {
      fail('unsupported-option', `unknown deflection control ${k}`);
    }
  }
  if ('srs' in control && !(Number.isFinite(control.srs) && control.srs >= 0)) {
    fail('unsupported-option', 'srs must be a finite number at or above zero');
  }
  return runSearch(eph, spec, {
    aberration: true,
    ofDate: true,
    deflection: true,
    control,
    mode: 'validated-retarded-aberrated-deflected-of-date',
    contract: DEFLECTED_CONTRACT,
    kind: 'retarded-aberrated-deflected-of-date-longitude',
  });
}
