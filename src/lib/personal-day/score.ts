/**
 * The personal day's ranking, shared by the /your-day/ page and the
 * get_personal_day tool (src/ai-tools/personal/personal-day.ts): the orb each
 * moving body is read to, and the score that orders the contacts.
 *
 *   score = MOVER_WEIGHT[mover] x POINT_WEIGHT[point] x ASPECT_WEIGHT[aspect]
 *           x (tightness + (exact today ? EXACT_BONUS : 0))
 *   tightness = max(0, 1 - orb / maxOrb), orb measured at midday
 *
 * The slow planets weigh most because their contacts last; the Moon weighs
 * least but is often the day's trigger, so an exact lunar contact still
 * climbs through the bonus. The natal Sun, Moon, rising degree and
 * Midheaven weigh most of the chart's points. Pure: no engine, no network.
 */
import type { NatalPoint, TransitBody } from '../engine/transit-scan-shared';
import type { AspectType } from '../engine/types';

/** How many contacts are listed, highest score first. */
export const PERSONAL_DAY_LIMIT = 8;

/** Widest orb, in degrees, for each moving body's conjunction, square, trine and opposition. */
export const DAY_ORB: Readonly<Record<TransitBody, number>> = {
  Moon: 6, Sun: 3, Mercury: 3, Venus: 3, Mars: 3, Jupiter: 2, Saturn: 2, Uranus: 2, Neptune: 2, Pluto: 2,
};
/** A sextile is the weakest major aspect, so its orb is two thirds of the others. */
export const SEXTILE_ORB_SHARE = 2 / 3;
export const maxOrb = (mover: TransitBody, aspect: AspectType) => DAY_ORB[mover] * (aspect === 'sextile' ? SEXTILE_ORB_SHARE : 1);

/** How much a contact from each moving body counts: slow planets most, the Moon least. */
export const MOVER_WEIGHT: Readonly<Record<TransitBody, number>> = {
  Pluto: 10, Neptune: 9, Uranus: 9, Saturn: 8, Jupiter: 7, Mars: 6, Sun: 5, Venus: 5, Mercury: 4, Moon: 3,
};
/** How much each natal point counts: the lights and the angles most. */
export const POINT_WEIGHT: Readonly<Record<NatalPoint, number>> = {
  Sun: 10, Moon: 10, ASC: 10, MC: 9, Venus: 7, Mars: 7, Mercury: 6, Jupiter: 5, Saturn: 5, Uranus: 3, Neptune: 3, Pluto: 3,
};
/** How much each aspect counts: the conjunction most, the sextile least. */
export const ASPECT_WEIGHT: Readonly<Record<AspectType, number>> = {
  conjunction: 1, opposition: 0.85, square: 0.85, trine: 0.7, sextile: 0.55,
};
/** Added to tightness when the contact is exact during the local day. */
export const EXACT_BONUS = 0.75;
export const ASPECT_ANGLE: Readonly<Record<AspectType, number>> = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };

/** The score of one contact, rounded to two decimals. */
export function dayScore(mover: TransitBody, point: NatalPoint, aspect: AspectType, orb: number, exactToday: boolean): number {
  const tightness = Math.max(0, 1 - orb / maxOrb(mover, aspect));
  return Math.round(MOVER_WEIGHT[mover] * POINT_WEIGHT[point] * ASPECT_WEIGHT[aspect] * (tightness + (exactToday ? EXACT_BONUS : 0)) * 100) / 100;
}

/** The distance, 0 to 180 degrees, between two longitudes. */
export const separation = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
/** Degrees from an exact aspect between two longitudes. */
export const orbOf = (moverLon: number, pointLon: number, aspect: AspectType) => Math.abs(separation(moverLon, pointLon) - ASPECT_ANGLE[aspect]);

const POINT_NAME: Partial<Record<NatalPoint, string>> = { ASC: 'rising degree', MC: 'Midheaven' };
/** "Sun", "rising degree", "Midheaven". */
export const pointName = (point: NatalPoint) => POINT_NAME[point] ?? point;

/**
 * Each moving body's hue on the page and the share card: the sign it rules,
 * as the astrocartography map colours its lines (the Sun Leo, the Moon
 * Cancer, Mars Aries, Pluto Scorpio, and so on).
 */
export const BODY_SIGN: Readonly<Record<TransitBody, 'leo' | 'cancer' | 'gemini' | 'taurus' | 'aries' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces' | 'scorpio'>> = {
  Sun: 'leo', Moon: 'cancer', Mercury: 'gemini', Venus: 'taurus', Mars: 'aries',
  Jupiter: 'sagittarius', Saturn: 'capricorn', Uranus: 'aquarius', Neptune: 'pisces', Pluto: 'scorpio',
};
