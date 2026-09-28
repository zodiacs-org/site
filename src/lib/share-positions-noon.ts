/**
 * The positions shared for a chart without a birth time. Kept apart from
 * share-positions.ts, which pages load up front for the codec, because only
 * the makers of a shared code need them.
 */
import type { PositionsShareInput } from './share-positions.js';

/**
 * The instant the code of a chart without a birth time is made at: 12:00 UTC
 * on the chart's civil birth date (YYYY-MM-DD, Gregorian), or null when the
 * date is not one.
 *
 * Such a chart is computed at 12:00 local time at the birthplace. That noon
 * falls at a different instant in every time zone, and before standard time
 * at a different instant for every longitude (the birthplace's own mean
 * time), and the bodies at 0.001° give the instant to a few seconds. So the
 * chart's own positions would give a recipient the birthplace's UTC offset,
 * or before standard time its longitude to a few kilometres. Noon UTC
 * depends on the date alone, so a code made at it says nothing about the
 * place. The Moon then sits up to about 9° from where the chart shows it,
 * which is why a chart without a birth time never states the Moon's sign.
 */
export function sharedReferenceInstant(date: string): Date | null {
  const match = typeof date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const instant = new Date(Date.UTC(year, month - 1, day, 12));
  return instant.getUTCFullYear() === year
    && instant.getUTCMonth() === month - 1
    && instant.getUTCDate() === day ? instant : null;
}

/**
 * The positions the code of a chart without a birth time carries: the twelve
 * bodies at sharedReferenceInstant(date), from the caller's ephemeris, and no
 * angles. Null when the date is not one.
 */
export function untimedSharedPositions(
  chart: Pick<PositionsShareInput, 'houseSystem' | 'engineVersion'>,
  date: string,
  bodiesAt: (utc: Date) => PositionsShareInput['bodies'],
): PositionsShareInput | null {
  const utc = sharedReferenceInstant(date);
  if (!utc) return null;
  return {
    bodies: bodiesAt(utc),
    angles: null,
    houseSystem: chart.houseSystem,
    engineVersion: chart.engineVersion,
  };
}
