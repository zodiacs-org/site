/**
 * A birth time the birthplace clock skipped or showed twice, for the
 * /vedic-signs/ page and the get_vedic_signs tool alike.
 *
 * The local-time resolver moves a skipped wall time forward by the jump and
 * reads a repeated one at its earlier pass, and says so in its flags
 * ("dst-gap", "dst-fold"). A skipped time never happened on that clock: St.
 * John's went from 23:00 on 2 May 1920 straight to 00:00 on 3 May, so 23:59
 * on 2 May would be read as 00:59 on 3 May, a different day with a different
 * Moon. It is refused, with a sentence that names no value. A repeated time
 * is read, and the reading says which pass it used. A date-only reading uses
 * neither: its day is read whole. A date the clock skipped whole (Kwajalein
 * went from 20 to 22 August 1993) has no day to read, so it is refused too,
 * never read as the next date. Pure: no network, storage or logging.
 */

export const SKIPPED_BIRTH_TIME = 'That birth time never showed on the birthplace clock: the clocks jumped past it that day. Check the birth time.';
export const REPEATED_BIRTH_TIME = 'The birthplace clock showed that birth time twice that day, when the clocks went back. This reading uses the first of the two.';
export const SKIPPED_BIRTH_DATE = 'That date never showed on the birthplace clock: the clocks jumped past the whole day. Check the birth date.';

/** A birth time the birthplace clock skipped: refused, never moved onto another time. */
export class SkippedBirthTimeError extends RangeError {
  constructor() {
    super(SKIPPED_BIRTH_TIME);
    this.name = 'SkippedBirthTimeError';
  }
}

/** A birth date the birthplace clock skipped whole: refused, never read as the date the clock jumped to. */
export class SkippedBirthDateError extends RangeError {
  constructor() {
    super(SKIPPED_BIRTH_DATE);
    this.name = 'SkippedBirthDateError';
  }
}

/**
 * Whether the birthplace clock skipped a whole date, from the resolver's
 * reading of that date's 00:00: a skipped wall time is moved forward by the
 * jump, so when the clock jumped past the whole date its 00:00 lands, at the
 * offset after the jump, on a later date.
 */
export function skippedWholeDate(date: string, midnight: { utc: Date; offsetMinutes: number; flags: readonly string[] }): boolean {
  if (!midnight.flags.includes('dst-gap')) return false;
  const wall = new Date(midnight.utc.getTime() + Math.round(midnight.offsetMinutes * 60_000));
  return wall.toISOString().slice(0, 10) !== date;
}

/** What a timed birth's clock flags mean: skipped (refuse), or the limit for a repeated time, or nothing. */
export function birthTimeOnClock(flags: readonly string[], timeKnown: boolean): { skipped: boolean; limit: string | null } {
  if (!timeKnown) return { skipped: false, limit: null };
  if (flags.includes('dst-gap')) return { skipped: true, limit: null };
  return { skipped: false, limit: flags.includes('dst-fold') ? REPEATED_BIRTH_TIME : null };
}

/** A reading with the repeated-time limit first, when there is one. */
export function withClockLimit<R extends { limits: string[] }>(reading: R, limit: string | null): R {
  return limit ? { ...reading, limits: [limit, ...reading.limits] } : reading;
}
