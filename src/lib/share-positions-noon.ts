/**
 * The positions a shared code carries for a chart computed on this device:
 * with a birth time, the bodies at the chart's UTC instant rounded to the
 * whole minute; without one, the bodies at 12:00 UTC on the birth date. Kept
 * apart from share-positions.ts, which pages load up front for the codec,
 * because only the makers of a shared code need them.
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

const MINUTE_MS = 60_000;

/**
 * The instant the code of a chart with a birth time is made at: the chart's
 * UTC instant rounded to the whole minute, or null when it is not a date.
 *
 * A birth time is entered to the minute, and since standard time every
 * zone's offset has been a whole number of minutes, so the chart's UTC
 * instant is already a whole minute and nothing changes. Before standard
 * time the chart keeps the birthplace's own mean time, four minutes of time
 * per degree of longitude, and the few zones whose legal offset had seconds
 * (Monrovia's −0:44:30 until 1972) did the same for the whole zone. The
 * seconds of the UTC instant then give the longitude to within a quarter
 * degree, and the bodies at 0.001° give those seconds to about ±3 s: strips
 * 2 to 3 km wide inside the band the midheaven's degree leaves. At the whole
 * minute the seconds say nothing. Rounding moves the instant by at most 30
 * seconds, in which the Moon moves at most 0.0054° (15.4° a day at its
 * fastest) and every other body far less; the angles stay the chart's own,
 * to the whole degree.
 */
export function sharedTimedInstant(utc: Date | string): Date | null {
  const ms = utc instanceof Date ? utc.getTime() : typeof utc === 'string' ? Date.parse(utc) : Number.NaN;
  return Number.isFinite(ms) ? new Date(Math.round(ms / MINUTE_MS) * MINUTE_MS) : null;
}

/** Whether the chart's UTC instant already falls on a whole minute. */
export function onWholeMinute(utc: Date | string): boolean {
  const minute = sharedTimedInstant(utc);
  return minute !== null && minute.getTime() === (utc instanceof Date ? utc.getTime() : Date.parse(utc));
}

/**
 * The positions the code of a chart with a birth time carries: the chart's
 * own when its UTC instant is a whole minute; otherwise the twelve bodies at
 * sharedTimedInstant(utc), from the caller's ephemeris, with the chart's
 * angles (a shared code keeps them to the whole degree). Null when utc is not
 * a date.
 */
export function timedSharedPositions(
  chart: PositionsShareInput,
  utc: Date | string,
  bodiesAt: (utc: Date) => PositionsShareInput['bodies'],
): PositionsShareInput | null {
  const minute = sharedTimedInstant(utc);
  if (!minute) return null;
  return onWholeMinute(utc) ? chart : { ...chart, bodies: bodiesAt(minute) };
}

/** A person in a two-chart picture, as the calculator knows them. */
export interface PicturePerson {
  bodies: readonly { body: string; lon: number }[];
  timeKnown: boolean;
  /** A chart with a birth time computed on this device: its UTC instant. */
  utc?: Date | string;
  /** A chart without a birth time computed on this device: its civil birth date. */
  untimedDate?: string;
}

/**
 * The bodies a two-chart picture (compatibility, composite) draws of one
 * person: those their link carries, so a picture shows no more of them than
 * the link. With a birth time, the bodies at the UTC instant rounded to the
 * whole minute (sharedTimedInstant). Without one, the sky at 12:00 UTC on the
 * birth date for a chart computed here (sharedReferenceInstant), since its own
 * bodies are noon at the birthplace, and in any case without the Moon, whose
 * sign such a chart never states. Positions that arrived in a link are already
 * what it carries. Only the bodies the person already has are drawn.
 */
export function pictureBodies(
  person: PicturePerson,
  bodiesAt: (utc: Date) => readonly { body: string; lon: number }[],
): { body: string; lon: number }[] {
  const names = new Set(person.bodies.map(({ body }) => body));
  const at = (utc: Date | null) => {
    if (!utc) throw new RangeError('a picture of a chart needs a valid instant or birth date');
    return bodiesAt(utc).filter(({ body }) => names.has(body));
  };
  const drawn = person.timeKnown
    ? person.utc !== undefined && !onWholeMinute(person.utc) ? at(sharedTimedInstant(person.utc)) : person.bodies
    : (person.untimedDate !== undefined ? at(sharedReferenceInstant(person.untimedDate)) : person.bodies)
      .filter(({ body }) => body !== 'Moon');
  return drawn.map(({ body, lon }) => ({ body, lon }));
}
