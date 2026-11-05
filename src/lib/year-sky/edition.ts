/**
 * "Your 2027 sky": the calendar-year edition's fixed facts. Engine-free and
 * storage-free, so the page, the worker and the tests share one year.
 *
 * The year is a UTC calendar year. A moment exact in the first or last hours
 * of the year can fall on the neighbouring local date; the calendar file
 * writes each all-day event on the reader's own local date.
 */

/** The year this edition reads. A later edition changes this and its route. */
export const EDITION_YEAR = 2027;

/** The English route. Other locales add their prefix in front of it. */
export const EDITION_PATH = '/your-2027-sky/';

export interface YearWindow {
  /** 1 January, 00:00 UTC. */
  from: Date;
  /** 1 January of the next year, 00:00 UTC (exclusive). */
  to: Date;
}

export function yearWindow(year: number = EDITION_YEAR): YearWindow {
  if (!Number.isInteger(year) || year < 1800 || year > 2198) throw new RangeError('Year outside the reference span.');
  return { from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year + 1, 0, 1)) };
}

export function inYear(iso: string, year: number = EDITION_YEAR): boolean {
  const at = Date.parse(iso);
  const { from, to } = yearWindow(year);
  return Number.isFinite(at) && at >= from.getTime() && at < to.getTime();
}

/** The four quarters the page is organised by: 0 is January to March. */
export type Quarter = 0 | 1 | 2 | 3;
export const QUARTERS: readonly Quarter[] = [0, 1, 2, 3];

export function quarterOf(iso: string): Quarter {
  return Math.floor(new Date(iso).getUTCMonth() / 3) as Quarter;
}

/** UTC month index (0 to 11) of an instant. */
export function monthOf(iso: string): number {
  return new Date(iso).getUTCMonth();
}
