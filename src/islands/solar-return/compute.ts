import { computeBodies, computeChart } from '../../lib/engine/full';
import { solarReturnChart, solarReturnInstant } from '../../lib/engine/solar-return';
import type { Chart, HouseSystem } from '../../lib/engine/types';
import { sharedReferenceInstant, sharedTimedInstant } from '../../lib/share-positions-noon';
import { resolveLocalToUtc } from '../../lib/time/localToUtc';
import { parseCivilDate } from '../../lib/time/civil-date';
import { readsOnDate } from '../../lib/time/local-day';
import { birthDayEnvelope, settledSunSign } from '../../lib/sun-settled';
import { earliestToday } from '../../lib/birth-date-policy';
import { SkippedBirthDateError, SkippedBirthTimeError, birthTimeOnClock } from '../../lib/vedic-signs/clock';
import { isUnderAge } from '../../lib/reading-guards';

export { prepareLocalTime } from '../../lib/time/localToUtc';

export class ReturnYearNotAfterBirthError extends RangeError {
  constructor() {
    super('Choose a return year after the birth year.');
    this.name = 'ReturnYearNotAfterBirthError';
  }
}

export interface SolarReturnPlace {
  name: string;
  lat: number;
  lon: number;
  tz: string;
}

export interface SolarReturnComputeInput {
  birthDate: string;
  birthTime: string | null;
  timeKnown: boolean;
  birthplace: SolarReturnPlace | null;
  savedSunLon: number | null;
  /** A saved chart's UTC instant, when its Sun stands in for a birthplace (savedSunLon). */
  savedUtc?: string | null;
  houseSystem: HouseSystem;
  castLocation: SolarReturnPlace | null;
  year: 'current' | number;
}

export interface SolarReturnResultData {
  chart: Chart;
  /**
   * The return an image and a calendar file show: found from the natal Sun at
   * the birth instant rounded to the whole minute, as a chart's link carries
   * it. Absent when that is `chart` itself. Before standard time the birth
   * instant has the birthplace's mean-time seconds, and the return found from
   * them gives them back.
   */
  shared?: Chart;
  returnYear: number;
  /**
   * The natal Sun's sign index when the birth settles it, else null: an untimed
   * birth day that starts and ends in different signs, on the birthplace clock
   * or, without one, on every clock (src/lib/sun-settled.ts). Absent: not
   * checked, so an untimed chart's Sun sign is not shared.
   */
  sunSign?: number | null;
  noTime: boolean;
  noPlace: boolean;
  /** True when the cast location is a geographic pole, where the rising sign and houses are undefined. */
  atPole?: boolean;
  /** Set when a repeated DST-fold birth time was read at its earlier occurrence. */
  clockLimit?: string;
  /** True when the birth date is under 18 today (UTC-12), so romance and attraction wording stays softened. */
  under18?: boolean;
}

export function nearForReturnYear(year: number, birthDate: string): Date {
  const [, month, day] = birthDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function currentReturnYear(natalSunLon: number, birthDate: string, now: Date): number {
  const year = now.getUTCFullYear();
  const candidates = [year - 2, year - 1, year, year + 1]
    .map((label) => ({ label, instant: solarReturnInstant(natalSunLon, nearForReturnYear(label, birthDate)) }))
    .filter(({ instant }) => instant.getTime() <= now.getTime());
  if (!candidates.length) throw new Error('No governing solar return found.');
  return candidates.reduce((latest, candidate) => (
    candidate.instant.getTime() > latest.instant.getTime() ? candidate : latest
  )).label;
}

/**
 * The natal Sun of a chart without a birth time: the Sun at 12:00 UTC on the
 * birth date, as a shared code of such a chart carries the sky. Noon at the
 * birthplace depends on the place: the return found from it, as its image
 * printed it to the second, gave that noon to half a second, and even to the
 * minute it would give the birthplace's UTC offset, or before standard time
 * its longitude to a quarter of a degree.
 */
export function untimedNatalSunLon(birthDate: string): number {
  const noon = sharedReferenceInstant(birthDate);
  const sun = noon ? computeBodies(noon).find((body) => body.body === 'Sun') : undefined;
  if (!sun) throw new RangeError('Enter the birth date as a calendar date.');
  return sun.lon;
}

const sunAt = (utc: Date) => computeBodies(utc).find((body) => body.body === 'Sun')?.lon ?? null;

export function computeSolarReturn(input: SolarReturnComputeInput, now = new Date()): SolarReturnResultData {
  const parsedBirth = parseCivilDate(input.birthDate);
  if (!parsedBirth) throw new RangeError('Enter the birth date as a calendar date.');
  let clockLimit: string | undefined;
  let resolvedBirth: ReturnType<typeof resolveLocalToUtc> | null = null;
  let useSavedAdjustedInstant = false;
  if (input.birthplace) {
    if (!readsOnDate(input.birthDate, resolveLocalToUtc(input.birthDate, '00:00', input.birthplace.tz, { longitude: input.birthplace.lon }))) {
      if (input.timeKnown && input.savedUtc && Number.isFinite(Date.parse(input.savedUtc))) {
        useSavedAdjustedInstant = true;
        clockLimit = 'The birthplace clock skipped this saved birth date for a clock change; this return uses the adjusted moment saved with the chart.';
      } else {
        throw new SkippedBirthDateError();
      }
    } else if (input.timeKnown && input.birthTime) {
      resolvedBirth = resolveLocalToUtc(input.birthDate, input.birthTime, input.birthplace.tz, { longitude: input.birthplace.lon });
      const onClock = birthTimeOnClock(resolvedBirth.flags, true);
      if (onClock.skipped) {
        if (input.savedUtc && Number.isFinite(Date.parse(input.savedUtc))) {
          useSavedAdjustedInstant = true;
          clockLimit = 'The birthplace clock skipped this saved birth time for a clock change; this return uses the adjusted moment saved with the chart.';
        } else {
          throw new SkippedBirthTimeError();
        }
      } else {
        clockLimit = onClock.limit ?? undefined;
      }
    }
  }
  let natalSunLon = input.timeKnown ? input.savedSunLon : untimedNatalSunLon(input.birthDate);
  // The natal Sun a shared image starts from: at the whole minute (see `shared`).
  let sharedSunLon = natalSunLon;
  if (useSavedAdjustedInstant && input.savedUtc) {
    const saved = new Date(input.savedUtc);
    natalSunLon = sunAt(saved);
    const minute = sharedTimedInstant(saved);
    sharedSunLon = minute && minute.getTime() !== saved.getTime() ? sunAt(minute) : natalSunLon;
  } else if (natalSunLon != null && input.timeKnown && input.savedUtc) {
    const saved = new Date(input.savedUtc);
    const minute = sharedTimedInstant(saved);
    if (minute && minute.getTime() !== saved.getTime()) sharedSunLon = sunAt(minute);
  }
  if (natalSunLon == null) {
    if (!input.birthplace) throw new Error('A birthplace is required.');
    const resolved = resolvedBirth ?? resolveLocalToUtc(
      input.birthDate,
      input.timeKnown && input.birthTime ? input.birthTime : '12:00',
      input.birthplace.tz,
      { longitude: input.birthplace.lon },
    );
    const natal = computeChart({
      utc: resolved.utc,
      latitude: input.birthplace.lat,
      longitude: input.birthplace.lon,
      houseSystem: input.houseSystem,
      timeKnown: input.timeKnown,
      flags: resolved.flags,
    });
    natalSunLon = natal.bodies.find((body) => body.body === 'Sun')?.lon ?? null;
    const minute = sharedTimedInstant(resolved.utc)!;
    sharedSunLon = minute.getTime() === resolved.utc.getTime() ? natalSunLon : sunAt(minute);
  }
  if (natalSunLon == null || sharedSunLon == null) throw new Error('The saved chart has no Sun position.');

  if (input.year !== 'current' && (!Number.isInteger(input.year) || input.year <= parsedBirth.year)) {
    throw new ReturnYearNotAfterBirthError();
  }
  const returnYear = input.year === 'current'
    ? currentReturnYear(natalSunLon, input.birthDate, now)
    : input.year;
  const near = nearForReturnYear(returnYear, input.birthDate);
  // Use exact unrounded cast latitude here so full-precision callers (like WebMCP at 89.999 deg) keep their angles and houses.
  const atPole = Boolean(input.timeKnown && input.birthplace && input.castLocation && Math.abs(input.castLocation.lat) >= 90);
  const location = input.timeKnown && input.birthplace && input.castLocation && !atPole
    ? { latitude: input.castLocation.lat, longitude: input.castLocation.lon }
    : null;
  const chart = solarReturnChart(natalSunLon, near, location, input.houseSystem);
  // The calculator has awaited prepareLocalTime(input.birthDate, input.birthplace.tz) for the birthplace clock's 00:00 and 23:59.
  const dayEnds: readonly [Date, Date] | null = input.timeKnown ? null : input.birthplace
    ? [resolveLocalToUtc(input.birthDate, '00:00', input.birthplace.tz, { longitude: input.birthplace.lon }).utc, resolveLocalToUtc(input.birthDate, '23:59', input.birthplace.tz, { longitude: input.birthplace.lon }).utc]
    : birthDayEnvelope(input.birthDate);
  const sunSign = dayEnds ? settledSunSign(dayEnds, (at) => sunAt(at)!).sign : Math.floor((((natalSunLon % 360) + 360) % 360) / 30);
  const under18 = isUnderAge(input.birthDate, earliestToday(now), 18);
  return {
    chart,
    ...(sharedSunLon !== natalSunLon ? { shared: solarReturnChart(sharedSunLon, near, location, input.houseSystem) } : {}),
    returnYear,
    sunSign,
    noTime: !input.timeKnown,
    noPlace: input.birthplace == null,
    ...(atPole ? { atPole: true } : {}),
    ...(clockLimit ? { clockLimit } : {}),
    under18,
  };
}
