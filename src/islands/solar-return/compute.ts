import { computeBodies, computeChart } from '../../lib/engine/full';
import { solarReturnChart, solarReturnInstant } from '../../lib/engine/solar-return';
import type { Chart, HouseSystem } from '../../lib/engine/types';
import { sharedReferenceInstant, sharedTimedInstant } from '../../lib/share-positions-noon';
import { resolveLocalToUtc } from '../../lib/time/localToUtc';

export { prepareLocalTime } from '../../lib/time/localToUtc';

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
  noTime: boolean;
  noPlace: boolean;
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
  let natalSunLon = input.timeKnown ? input.savedSunLon : untimedNatalSunLon(input.birthDate);
  // The natal Sun a shared image starts from: at the whole minute (see `shared`).
  let sharedSunLon = natalSunLon;
  if (natalSunLon != null && input.timeKnown && input.savedUtc) {
    const saved = new Date(input.savedUtc);
    const minute = sharedTimedInstant(saved);
    if (minute && minute.getTime() !== saved.getTime()) sharedSunLon = sunAt(minute);
  }
  if (natalSunLon == null) {
    if (!input.birthplace) throw new Error('A birthplace is required.');
    const resolved = resolveLocalToUtc(
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

  const returnYear = input.year === 'current'
    ? currentReturnYear(natalSunLon, input.birthDate, now)
    : input.year;
  const near = nearForReturnYear(returnYear, input.birthDate);
  const location = input.timeKnown && input.birthplace && input.castLocation
    ? { latitude: input.castLocation.lat, longitude: input.castLocation.lon }
    : null;
  const chart = solarReturnChart(natalSunLon, near, location, input.houseSystem);
  return {
    chart,
    ...(sharedSunLon !== natalSunLon ? { shared: solarReturnChart(sharedSunLon, near, location, input.houseSystem) } : {}),
    returnYear,
    noTime: !input.timeKnown,
    noPlace: input.birthplace == null,
  };
}
