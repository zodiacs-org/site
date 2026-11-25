/**
 * The instant an untimed birth is read at, for the /vedic-signs/ page and the
 * get_vedic_signs tool alike: local noon, when the birthplace clock showed it
 * on the birth date. A clock that left the date early can skip its noon, and
 * the resolver then moves noon forward by the jump, off the date: Manila went
 * from the American to the Asian side of the date line at the end of 1844, and
 * kept 31 December for about three seconds. A clock can also skip noon itself
 * and stay on the date (Khartoum, 15 January 2000, when 12:00 became 13:00):
 * the resolver flags that noon "dst-gap" and reads it at the time the clock
 * jumped to, which the clock never showed as noon. In both cases the reading
 * takes the middle of the date's span, the stretch the day's two ends were
 * read from, so its names come from the same day that settles them. Pure.
 */
export function untimedInstant(noon: Date, span: readonly [Date, Date], noonFlags: readonly string[]): Date {
  const at = noon.getTime();
  const start = span[0].getTime();
  const end = span[1].getTime();
  const shown = !noonFlags.includes('dst-gap') && at >= start && at <= end;
  return shown ? noon : new Date(Math.floor((start + end) / 2));
}
