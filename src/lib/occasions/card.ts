/**
 * One occasion card from a date, an optional local time and an optional
 * place: the sky, the evening at the place, and the card's words. Runs in
 * the browser (behind the lazy engine import) and in the MCP runtime alike.
 * Nothing is stored; the card is a function of its inputs.
 */
import { offsetAt, prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';
import { eveningSky, type EveningSky } from './evening';
import type { OccasionKind } from './kinds';
import { OCCASION_WORDS, sunMoonLine } from './lines';
import { skyAt, type OccasionSkyFacts } from './sky';

/** The engine's reference years, as the site's other tools use them. */
export const OCCASION_MIN_YEAR = 1800;
export const OCCASION_MAX_YEAR = 2199;
const DAY = 86_400_000;

export interface OccasionInput {
  occasion: OccasionKind;
  /** YYYY-MM-DD, local to the place (or UTC without one). */
  date: string;
  /** HH:MM local, or null when the time does not matter or is not known. */
  time: string | null;
  /** The place's IANA zone; required with a time or a place. */
  timeZone: string | null;
  place: { name: string; latitude: number; longitude: number } | null;
}

export interface OccasionCard {
  input: OccasionInput;
  instant: string;
  sky: OccasionSkyFacts;
  /** Without a time, the Moon's sign at the start and end of the local day when it changes. */
  moonSignChange: { from: string; to: string } | null;
  evening: EveningSky | null;
  words: { title: string; interpretation: string; closing: string };
}

export function validOccasionDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return year >= OCCASION_MIN_YEAR && year <= OCCASION_MAX_YEAR
    && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/** Local midnight of `date` in `timeZone`, or UTC midnight without one. */
function dayStart(date: string, timeZone: string | null): Date {
  const [year, month, day] = date.split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  if (!timeZone) return new Date(utcMidnight);
  return new Date(utcMidnight - offsetAt(timeZone, utcMidnight + DAY / 2) * 60_000);
}

export async function occasionCard(input: OccasionInput): Promise<OccasionCard> {
  if (!validOccasionDate(input.date)) {
    throw new RangeError(`The date must be a real date from ${OCCASION_MIN_YEAR} to ${OCCASION_MAX_YEAR}.`);
  }
  if (input.time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/u.test(input.time)) throw new RangeError('The time must be HH:MM.');
  if ((input.time !== null || input.place !== null) && !input.timeZone) {
    throw new RangeError('A time or a place needs its time zone.');
  }

  let instant: Date;
  if (input.time !== null && input.timeZone) {
    await prepareLocalTime(input.date, input.timeZone);
    instant = resolveLocalToUtc(
      input.date,
      input.time,
      input.timeZone,
      input.place ? { longitude: input.place.longitude } : {},
    ).utc;
  } else {
    instant = new Date(dayStart(input.date, input.timeZone).getTime() + DAY / 2);
  }

  const sky = skyAt(instant);
  let moonSignChange: OccasionCard['moonSignChange'] = null;
  if (input.time === null) {
    const start = dayStart(input.date, input.timeZone);
    const moonAt = (at: Date) => skyAt(at).bodies.find((row) => row.body === 'Moon')!.sign;
    const from = moonAt(start);
    const to = moonAt(new Date(start.getTime() + DAY - 60_000));
    if (from !== to) moonSignChange = { from, to };
  }

  const evening = input.place && input.timeZone
    ? eveningSky(
      { latitude: input.place.latitude, longitude: input.place.longitude },
      input.date,
      Math.round(offsetAt(input.timeZone, dayStart(input.date, input.timeZone).getTime() + DAY / 2)),
    )
    : null;

  const sign = (body: string) => sky.bodies.find((row) => row.body === body)!.sign;
  const words = OCCASION_WORDS[input.occasion];
  return {
    input,
    instant: instant.toISOString(),
    sky,
    moonSignChange,
    evening,
    words: {
      title: words.title,
      interpretation: sunMoonLine(sign('Sun'), sign('Moon')),
      closing: words.closing,
    },
  };
}
