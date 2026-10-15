/**
 * The best-rated days for an occasion in a window of up to 92 days: every
 * day is rated with rateOccasionDate's reading (./date-score.ts) at the
 * same local time (or local noon), and the three highest come back with
 * their strongest reasons. The sky is computed once per day. It ranks days
 * by astrology's reading of them; it never promises how a day will go.
 * Pure apart from the injected local-time resolver.
 */
import { validOccasionDate, OCCASION_MAX_YEAR, OCCASION_MIN_YEAR, type OccasionClock } from './card';
import { weighOccasionDate } from './date-score';
import type { OccasionKind } from './kinds';
import { skyAt } from './sky';

/** The longest window searched, in days, counting both ends: the event search's own bound. */
export const BEST_DAYS_MAX_WINDOW = 92;
/** How many days come back. */
export const BEST_DAYS_COUNT = 3;
/** How many reasons each day carries, strongest first. */
export const BEST_DAY_REASONS = 3;

export interface BestDaysInput {
  occasion: OccasionKind;
  /** First and last day of the window, YYYY-MM-DD, both included. */
  from: string;
  to: string;
  /** HH:MM on the local clock, or null for local noon (noon UTC without a zone). */
  time: string | null;
  timeZone: string | null;
  /** The place's longitude, for local mean time before standard time. */
  longitude: number | null;
}

export interface BestDay {
  date: string;
  score: number;
  verdict: string;
  reasons: string[];
}

export interface BestDays {
  from: string;
  to: string;
  days: number;
  best: BestDay[];
}

const DAY = 86_400_000;
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;
const dateOf = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);

/** Days in the window, both ends included; throws RangeError for a window the search cannot take. */
export function bestDaysWindow(from: string, to: string): number {
  if (!validOccasionDate(from) || !validOccasionDate(to)) {
    throw new RangeError(`The search window must run between real dates from ${OCCASION_MIN_YEAR} to ${OCCASION_MAX_YEAR}.`);
  }
  const days = dayNumber(to) - dayNumber(from) + 1;
  if (days < 1) throw new RangeError('The search window must end on or after the day it starts.');
  if (days > BEST_DAYS_MAX_WINDOW) throw new RangeError(`The search window is at most ${BEST_DAYS_MAX_WINDOW} days.`);
  return days;
}

/**
 * Rate every day from `from` to `to` and return the three best: highest
 * score first, earlier day first on a tie.
 */
export async function bestDays(input: BestDaysInput, clock: OccasionClock): Promise<BestDays> {
  const days = bestDaysWindow(input.from, input.to);
  if (input.time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/u.test(input.time)) throw new RangeError('The time must be HH:MM.');
  if (input.time !== null && !input.timeZone) throw new RangeError('A time needs its time zone.');
  const time = input.time ?? '12:00';
  const start = dayNumber(input.from);
  const rated: (BestDay & { order: number })[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = dateOf(start + offset);
    let instant: Date;
    if (input.timeZone) {
      await clock.prepareLocalTime(date, input.timeZone);
      instant = (input.longitude !== null
        ? clock.resolveLocalToUtc(date, time, input.timeZone, { longitude: input.longitude })
        : clock.resolveLocalToUtc(date, time, input.timeZone)).utc;
    } else {
      instant = new Date(`${date}T${time}:00Z`);
    }
    const { score, verdict, weighed } = weighOccasionDate(input.occasion, skyAt(instant));
    const reasons = weighed
      .map((item, index) => ({ ...item, index }))
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points) || a.index - b.index)
      .slice(0, BEST_DAY_REASONS)
      .map((item) => item.reason);
    rated.push({ date, score, verdict, reasons, order: offset });
  }
  const best = rated
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, BEST_DAYS_COUNT)
    .map(({ order: _order, ...day }) => day);
  return { from: input.from, to: input.to, days, best };
}
