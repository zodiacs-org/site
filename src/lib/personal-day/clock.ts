/**
 * Dates and clock times on a zone's clock, for the personal day: plain Intl,
 * no engine, so the /your-day/ page can show its default day before the
 * calculation loads.
 */
const DAY = 86_400_000;

/** The calendar date of an instant on a zone's clock, as YYYY-MM-DD. */
export function dateOn(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** "Tue 3 Nov 2026" on a zone's clock. */
export function dayLabel(at: Date | string, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(new Date(at)).map((part) => [part.type, part.value]));
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
}

/** HH:MM on a zone's clock. */
export const clockTime = (at: Date, timeZone: string) => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
/** The next calendar date, YYYY-MM-DD. */
export const nextDate = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
/** The calendar date `days` after (or before) a YYYY-MM-DD date. */
export const shiftDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
/** Whole days from one YYYY-MM-DD date to another. */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
