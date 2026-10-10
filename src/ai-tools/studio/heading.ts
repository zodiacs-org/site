import type { StudioInput } from './model';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "14 March 1992", from a calendar date as the person entered it. */
export function birthDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** "9:30 am", from a clock time as the person entered it. */
export function birthClock(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
}

export interface ChartHeading {
  /** "14 March 1992 · 9:30 am · London, England, United Kingdom" or "14 March 1992 · Birth time unknown". */
  text: string;
  /** For the <time> element: the calculated instant, or only the date when the time is unknown. */
  dateTime: string;
}

/** The labelled example: 12:00 UTC on 15 June 1990 was 1:00 pm in London (heading.test.ts checks it). */
export const EXAMPLE_HEADING: ChartHeading = { text: '15 June 1990 · 1:00 pm · London', dateTime: '1990-06-15T12:00:00.000Z' };

/**
 * The chart's header in plain words, from what the person entered: the local
 * date and clock time when they started from local time, otherwise the date
 * and time they typed in UTC, and the place they chose, if any.
 */
export function chartHeading(input: StudioInput, instantUtc: string): ChartHeading {
  const local = input.timeKnown ? input.local?.resolution : undefined;
  const parts = !input.timeKnown ? [birthDate(input.date), 'Birth time unknown']
    : local ? [birthDate(local.date), birthClock(local.time)]
      : [birthDate(input.date), `${birthClock(input.time)} UTC`];
  if (input.place) parts.push(input.place);
  return { text: parts.join(' · '), dateTime: input.timeKnown ? instantUtc : input.date };
}
