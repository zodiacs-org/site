/**
 * Declination aspects: the family a chart wheel cannot draw.
 *
 * The wheel measures one angle, ecliptic longitude, the position round the
 * zodiac. Declination measures a different one: how far north or south of
 * the celestial equator a body actually stands. The two are independent
 * enough that a pair can sit a third of the sky apart in longitude and
 * still ride the same declination circle, at the same height above the
 * equator, crossing the sky together night after night.
 *
 * Traditional practice reads that as a conjunction in all but name (a
 * parallel), and reads the mirrored case, equal declinations on opposite
 * sides of the equator, as an opposition (a contraparallel).
 *
 * Since engine 1.1.0-rc.2 the arithmetic is the engine's own, from
 * `@zodiacs/engine/lite`, which loads no ephemeris; this module keeps the
 * site's names, shapes and default obliquity over it. Positions come from
 * the chart already; nothing here computes one.
 */
import {
  DEFAULT_DECLINATION_ORB_POLICY,
  declinationOf as packageDeclinationOf,
  declinationOrb as packageDeclinationOrb,
  declinationsForBodies,
  findDeclinationAspects as packageFindDeclinationAspects,
} from '@zodiacs/engine/lite';
import { OBLIQUITY } from './wheel/ecliptic3d';

/**
 * Declination aspects are held to a tight orb: a degree is already wide
 * for a measurement that only spans 23.4 degrees either side of the equator
 * for the Sun. The luminaries carry the wider allowance, the same way they
 * do for longitude aspects. Both orbs are inclusive.
 */
export const DECLINATION_ORB = DEFAULT_DECLINATION_ORB_POLICY.orb;
export const DECLINATION_ORB_LUMINARY = DEFAULT_DECLINATION_ORB_POLICY.luminaryOrb;

export type DeclinationAspectType = 'parallel' | 'contraparallel';

export interface DeclinationBody {
  body: string;
  lon: number;
  lat: number;
}

export interface DeclinationAspect {
  a: string;
  b: string;
  type: DeclinationAspectType;
  /** Degrees from exact. */
  orb: number;
  /** Declination of each body, north positive. */
  decA: number;
  decB: number;
  /** The pair's ecliptic separation: what the flat wheel shows instead. */
  separation: number;
}

/** A body's declination, and whether it stands beyond the Sun's bounds. */
export interface DeclinationMark {
  body: string;
  /** Degrees, north positive. */
  dec: number;
  /**
   * Beyond the obliquity, strictly. A body labelled exactly Sun stays inside
   * while its ecliptic latitude is within 0.001 degrees, by the engine's
   * convention: the Sun itself only grazes the bound at a solstice.
   */
  outOfBounds: boolean;
}

/** The orb this pair is allowed, widened when a luminary is involved. */
export function declinationOrb(a: string, b: string): number {
  return packageDeclinationOrb(a, b);
}

/**
 * Declination: the angle north or south of the celestial equator, which is
 * a different measurement from ecliptic latitude and the one that decides
 * whether a body is out of bounds.
 */
export function declinationOf(lonDeg: number, latDeg: number, obliquityDeg = OBLIQUITY): number {
  return packageDeclinationOf(lonDeg, latDeg, obliquityDeg);
}

/**
 * Every parallel and contraparallel among the bodies handed in, tightest
 * first.
 *
 * Which of the two a pair forms is the smaller of the two distances: the
 * difference of the declinations when they share a side of the equator, and
 * their sum when they oppose. The two are equal only when one body sits
 * exactly on the equator, which is its own mirror and so takes no side; that
 * reading is called a parallel. The engine decides each inclusion, type and
 * order exactly on the declinations, and refuses with a RangeError a body
 * named twice or a position that is not a finite number.
 */
export function findDeclinationAspects(
  bodies: readonly DeclinationBody[],
  obliquityDeg = OBLIQUITY,
): DeclinationAspect[] {
  return packageFindDeclinationAspects(bodies, obliquityDeg)
    .map(({ a, b, type, orb, decA, decB, separation }) => ({ a, b, type, orb, decA, decB, separation }));
}

/** Each body's declination and bounds flag, in the order handed in. */
export function declinationRows(
  bodies: readonly DeclinationBody[],
  obliquityDeg = OBLIQUITY,
): DeclinationMark[] {
  return declinationsForBodies(bodies, obliquityDeg).rows
    .map(({ body, dec, outOfBounds }) => ({ body, dec, outOfBounds }));
}
