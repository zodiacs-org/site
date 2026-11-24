/**
 * The instant an untimed birth is read at, for the /vedic-signs/ page and the
 * get_vedic_signs tool alike: local noon, when the birthplace clock showed it
 * on the birth date. A clock that left the date early can skip its noon, and
 * the resolver then moves noon forward by the jump, off the date: Manila went
 * from the American to the Asian side of the date line at the end of 1844, and
 * kept 31 December for about three seconds. The reading then takes the middle
 * of the date's span, the stretch the day's two ends were read from, so its
 * names come from the same day that settles them. Pure.
 */
export function untimedInstant(noon: Date, span: readonly [Date, Date]): Date {
  const at = noon.getTime();
  const start = span[0].getTime();
  const end = span[1].getTime();
  return at >= start && at <= end ? noon : new Date(Math.floor((start + end) / 2));
}
