import { readsOnDate, type WallResolution } from '../time/local-day';
import {
  SKIPPED_BIRTH_DATE,
  SKIPPED_BIRTH_TIME,
  SkippedBirthDateError,
  SkippedBirthTimeError,
  birthTimeOnClock,
} from '../vedic-signs/clock';

export { SKIPPED_BIRTH_DATE, SKIPPED_BIRTH_TIME, SkippedBirthDateError, SkippedBirthTimeError };

export interface YearScoreBirthClock {
  prepareLocalTime(date: string, zone: string): Promise<void>;
  resolveLocalToUtc(date: string, time: string, zone: string, options?: { longitude?: number }): WallResolution;
}

/**
 * Resolves a Year Ahead Score birth date/time on the birthplace clock, refusing
 * skipped birth dates and DST-gap birth times and noting repeated DST-fold times.
 * Shared by /year-score/ and get_year_score so both paths follow the same clock rules.
 */
export async function resolveYearScoreBirth(
  birthDate: string,
  time: string | null,
  timeZone: string | null,
  clock: YearScoreBirthClock,
  longitude?: number,
): Promise<{ utc: Date; clockLimit: string | null }> {
  if (!timeZone) return { utc: new Date(`${birthDate}T12:00:00Z`), clockLimit: null };
  await clock.prepareLocalTime(birthDate, timeZone);
  const wall = (localTime: string) =>
    (longitude !== undefined ? clock.resolveLocalToUtc(birthDate, localTime, timeZone, { longitude }) : clock.resolveLocalToUtc(birthDate, localTime, timeZone));
  if (!readsOnDate(birthDate, wall('00:00'))) throw new SkippedBirthDateError();
  const resolved = wall(time ?? '12:00');
  const onClock = birthTimeOnClock(resolved.flags, time !== null);
  if (onClock.skipped) throw new SkippedBirthTimeError();
  return { utc: resolved.utc, clockLimit: onClock.limit };
}
