/**
 * The one age gate for a birth date an assistant sends, failing closed. Every tool that refuses a child's birth date
 * before it names any other field (AGE_FIRST_TOOLS, ./tools.ts) reads it, on the direct tool and on the hosted server,
 * so the generated bundles (api/_ai/runtime.mjs, integrations/generated/sky-watch.mjs) carry this one copy.
 *
 * A birth date is read only to decide; it is never stored, logged or echoed back.
 */
import { birthDateRefusal } from '../lib/birth-date-policy';
import { NATAL_MIN_YEAR } from './features/natal-chart';

/** What a birth date allows before anything else about the call is read. */
export type BirthDateAgeGate = 'ADULT' | 'UNDER_13' | 'NEEDS_DATE';

/** English month names and their three letter abbreviations (and Sept), lower case, as month numbers. */
const MONTH_NUMBERS: ReadonlyMap<string, number> = new Map(
  ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
    .flatMap((name, index) => [[name, index + 1], [name.slice(0, 3), index + 1], ...(name === 'september' ? [['sept', index + 1]] : [])] as [string, number][]),
);

/** One reading of a written date: a year, a month and a day, before it is checked against the calendar. */
interface Reading { year: number; month: number; day: number }

/** A day or a month: one or two digits. */
const SHORT_RUN = /^\d{1,2}$/u;

/** The years a run of digits can name: itself when four digits long, 19YY and 20YY when two (a 20YY still to come included); none otherwise. */
function yearsOfRun(run: string): number[] {
  if (/^\d{4}$/u.test(run)) return [Number(run)];
  if (/^\d{2}$/u.test(run)) return [1900 + Number(run), 2000 + Number(run)];
  return [];
}

/** The readings with this year run, month run and day run, or none when the month or the day is not one or two digits. */
function readingsOf(yearRun: string, monthRun: string, dayRun: string): Reading[] {
  if (!SHORT_RUN.test(monthRun) || !SHORT_RUN.test(dayRun)) return [];
  return yearsOfRun(yearRun).map((year) => ({ year, month: Number(monthRun), day: Number(dayRun) }));
}

/**
 * Every reading of a written date, in all four field orders.
 * - Three runs of digits, each pair separated by -, /, . or spaces (spaces around a separator allowed): year, month,
 *   day; year, day, month; day, month, year; and month, day, year. Each order whose day and month have one or two
 *   digits and whose year has two or four is read.
 * - An English month name or its three letter abbreviation, in any case and in any of the three places, with two
 *   numbers: either number the day (one or two digits, an ordinal ending allowed) and the other the year (two or four
 *   digits). Commas, full stops, hyphens, slashes, spaces and "of" may come between the parts.
 * - A year of two digits is read as both 19YY and 20YY.
 * Anything else has no reading.
 */
function writtenDateReadings(text: string): Reading[] {
  const numeric = /^(\d+)\s*(?:[-/.]|\s)\s*(\d+)\s*(?:[-/.]|\s)\s*(\d+)$/u.exec(text);
  if (numeric) {
    const [, a, b, c] = numeric;
    return [...readingsOf(a, b, c), ...readingsOf(a, c, b), ...readingsOf(c, b, a), ...readingsOf(c, a, b)];
  }
  if (!/^[\p{L}\d].*[\p{L}\d]$/u.test(text)) return [];
  const words = text.toLowerCase().split(/[\s,./-]+/u).filter((word) => word !== 'of');
  const monthAt = words.findIndex((word) => MONTH_NUMBERS.has(word));
  if (words.length !== 3 || monthAt < 0) return [];
  const month = String(MONTH_NUMBERS.get(words[monthAt])!);
  const numbers = words.filter((_, index) => index !== monthAt).map((word) => /^(\d+)(st|nd|rd|th)?$/u.exec(word));
  if (numbers.some((match) => !match)) return [];
  const [first, second] = numbers as RegExpExecArray[];
  const readings: Reading[] = [];
  // Either number can be the day and the other the year; a year carries no ordinal ending.
  for (const [day, year] of [[first, second], [second, first]]) if (!year[2]) readings.push(...readingsOf(year[1], month, day[1]));
  return readings;
}

/** YYYY-MM-DD when the year (from NATAL_MIN_YEAR on), month and day make a real Gregorian calendar day, otherwise null. */
function calendarDay({ year, month, day }: Reading): string | null {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  if (year < NATAL_MIN_YEAR || day > daysInMonth) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The age gate for a birth date as sent, failing closed. The text (spaces around it removed, at most 64 characters)
 * is read in every way writtenDateReadings knows, and a reading counts when its month is 1 to 12 and its day 1 to 31.
 * - UNDER_13 when any reading is a real calendar day that src/lib/birth-date-policy.ts refuses: less than 13 years
 *   before today at UTC-12, or still to come at UTC+14 (a 20YY reading still to come included).
 * - ADULT only when there is a reading and every reading is a real calendar day from NATAL_MIN_YEAR on, 13 years or
 *   more before today at UTC-12.
 * - NEEDS_DATE for everything else: no value, a value that is not text, text with no reading (empty, partial,
 *   unreadable, a time or other words with it), or a reading that is not a real day (1990-02-30, 31/04/1990) or is
 *   before NATAL_MIN_YEAR. The birth date alone is then asked for again, with a four digit year.
 */
export function birthDateAgeGate(value: unknown, now: Date): BirthDateAgeGate {
  if (typeof value !== 'string' || value.length > 64) return 'NEEDS_DATE';
  const days = writtenDateReadings(value.trim())
    .filter(({ month, day }) => month >= 1 && month <= 12 && day >= 1 && day <= 31)
    .map(calendarDay);
  if (days.some((day) => day !== null && birthDateRefusal(day, now) !== null)) return 'UNDER_13';
  return days.length > 0 && days.every((day) => day !== null) ? 'ADULT' : 'NEEDS_DATE';
}
