/**
 * Secondary progressions, computed by the engine package since 0.1.1-rc.12:
 * one tropical year (365.2422 days) of life maps to one day after birth,
 * counted in UTC milliseconds, and the progressed positions are the engine's
 * positions at that instant. The package validates both dates and throws a
 * RangeError outside its ephemeris span.
 *
 * This module only keeps the site's body shape (no sign or degree fields) and
 * stays behind ChartLens's dynamic import, so /birth-chart/ never loads it up
 * front. Progressed ANGLES (ASC/MC) are deliberately not computed — they
 * require a house-progression convention (Naibod, solar-arc MC, …) we have not
 * adopted, and faking one would misstate what was computed.
 */
import {
  PROGRESSION_DAYS_PER_YEAR,
  progressedBodies as packageProgressedBodies,
  progressedInstant as packageProgressedInstant,
} from '@zodiacs/engine';
import { adaptBody } from './chart-adapter';
import type { BodyPosition } from './types';

export { PROGRESSION_DAYS_PER_YEAR };

/** The progressed instant: `birthUtc` plus one day per tropical year lived to `target`. */
export function progressedInstant(birthUtc: Date, target: Date): Date {
  return packageProgressedInstant(birthUtc, target);
}

/** Progressed positions for `target`: ten bodies and the two true lunar nodes, no angles. */
export function progressedBodies(birthUtc: Date, target: Date): BodyPosition[] {
  return packageProgressedBodies(birthUtc, target).map(adaptBody);
}
