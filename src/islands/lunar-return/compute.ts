import { lunarReturnChart } from '../../lib/engine/lunar-return';
import type { Chart, HouseSystem } from '../../lib/engine/types';
import { sharedTimedInstant } from '../../lib/share-positions-noon';
import { resolveLocalToUtc } from '../../lib/time/localToUtc';

export { prepareLocalTime } from '../../lib/time/localToUtc';

export interface LunarReturnPlace { name: string; lat: number; lon: number; tz: string }
export interface LunarReturnComputeInput {
  birthDate: string;
  birthTime: string | null;
  timeKnown: boolean;
  birthplace: LunarReturnPlace | null;
  houseSystem: HouseSystem;
  castLocation: LunarReturnPlace | null;
}
export interface LunarReturnResultData {
  chart: Chart;
  /**
   * The return an image and a calendar file show: found from the natal Moon
   * at the birth instant rounded to the whole minute, as a chart's link
   * carries it. Absent when that is `chart` itself. Before standard time the
   * birth instant has the birthplace's mean-time seconds, and the return found
   * from them gives them back.
   */
  shared?: Chart;
  /** Captured once by submit; retries retain this instant. */
  referenceUtc: string;
  natalTimeFlags: ReadonlyArray<'lmt'>;
  /** Read on the birthplace's own mean time, even at a whole-minute offset. */
  natalLocalMeanTime: boolean;
}

/** Resolve original birth input afresh. A summary or cached Moon is never an input. */
export function computeLunarReturn(input: LunarReturnComputeInput, reference: Date): LunarReturnResultData {
  if (input.timeKnown !== true || !input.birthTime) {
    throw new RangeError('A known birth time is needed. Enter the time from your birth record to calculate a lunar return.');
  }
  if (!input.birthplace || typeof input.birthplace.tz !== 'string' || !input.birthplace.tz.trim()) {
    throw new RangeError('Choose a birthplace with a known timezone before calculating a lunar return.');
  }
  const resolved = resolveLocalToUtc(input.birthDate, input.birthTime, input.birthplace.tz, { longitude: input.birthplace.lon });
  if (resolved.flags.includes('dst-gap') || resolved.flags.includes('dst-fold')) {
    throw new RangeError('This local birth time is skipped or repeated by a clock change. Check the original birth record before calculating.');
  }
  const natal = {
    latitude: input.birthplace.lat, longitude: input.birthplace.lon,
    houseSystem: input.houseSystem, timeKnown: true as const, flags: resolved.flags,
  };
  const cast = input.castLocation
    ? { latitude: input.castLocation.lat, longitude: input.castLocation.lon }
    : undefined;
  const chart = lunarReturnChart({ ...natal, utc: resolved.utc }, reference, cast);
  const minute = sharedTimedInstant(resolved.utc)!;
  return {
    chart,
    ...(minute.getTime() !== resolved.utc.getTime() ? { shared: lunarReturnChart({ ...natal, utc: minute }, reference, cast) } : {}),
    referenceUtc: reference.toISOString(),
    natalTimeFlags: resolved.flags.filter((flag): flag is 'lmt' => flag === 'lmt'),
    natalLocalMeanTime: resolved.localMeanTime !== undefined,
  };
}
