/**
 * One occasion card from a date, an optional local time and an optional
 * place: the sky, the evening at the place, and the card's words. Runs in
 * the browser (behind the lazy engine import) and in the MCP runtime alike.
 * Nothing is stored; the card is a function of its inputs.
 */
import { prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';
import { eveningSky, type EveningSky } from './evening';
import type { OccasionKind } from './kinds';
import { OCCASION_WORDS, sunMoonLine } from './lines';
import { skyAt, type OccasionSkyFacts } from './sky';

/** The engine's reference years, as the site's other tools use them. */
export const OCCASION_MIN_YEAR = 1800;
export const OCCASION_MAX_YEAR = 2199;

export interface OccasionInput {
  occasion: OccasionKind;
  /** YYYY-MM-DD, local to the place (or UTC without one). */
  date: string;
  /** HH:MM local, or null when the time does not matter or is not known. */
  time: string | null;
  /** The place's IANA zone; required with a time or a place. */
  timeZone: string | null;
  place: { name: string; lat: number; lon: number } | null;
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

/**
 * A local clock time on `date` at the place as an instant, through the
 * site's pinned zone history; with a place, its longitude settles the
 * offset before standard time (local mean time).
 */
async function localInstant(date: string, time: string, timeZone: string, place: OccasionInput['place']): Promise<Date> {
  await prepareLocalTime(date, timeZone);
  return (place
    ? resolveLocalToUtc(date, time, timeZone, { longitude: place.lon })
    : resolveLocalToUtc(date, time, timeZone)).utc;
}

/** A clock time on `date` read as UTC, for a card without a time zone. */
function utcInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00Z`);
}

export async function occasionCard(input: OccasionInput): Promise<OccasionCard> {
  if (!validOccasionDate(input.date)) {
    throw new RangeError(`The date must be a real date from ${OCCASION_MIN_YEAR} to ${OCCASION_MAX_YEAR}.`);
  }
  if (input.time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/u.test(input.time)) throw new RangeError('The time must be HH:MM.');
  if ((input.time !== null || input.place !== null) && !input.timeZone) {
    throw new RangeError('A time or a place needs its time zone.');
  }
  const { date, timeZone, place } = input;
  const at = (time: string) => (timeZone ? localInstant(date, time, timeZone, place) : Promise.resolve(utcInstant(date, time)));

  // Without a time, the card stands for local noon.
  const instant = await at(input.time ?? '12:00');

  const sky = skyAt(instant);
  let moonSignChange: OccasionCard['moonSignChange'] = null;
  if (input.time === null) {
    const moonAt = (when: Date) => skyAt(when).bodies.find((row) => row.body === 'Moon')!.sign;
    const from = moonAt(await at('00:00'));
    const to = moonAt(await at('23:59'));
    if (from !== to) moonSignChange = { from, to };
  }

  let evening: EveningSky | null = null;
  if (place && timeZone) {
    // The place's offset from UTC at local noon, as the pinned history gives it.
    const noon = await at('12:00');
    const offsetMinutes = Math.round((utcInstant(date, '12:00').getTime() - noon.getTime()) / 60_000);
    evening = eveningSky({ latitude: place.lat, longitude: place.lon }, date, offsetMinutes);
  }

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
