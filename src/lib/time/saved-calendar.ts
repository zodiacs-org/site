/**
 * Calendar provenance and birth-time confirmation helpers shared across
 * calculators, profile handoffs, and saved-chart refresh. Kept out of
 * `localToUtc.ts` so routes that only resolve fresh times (`/big-three/`)
 * do not carry saved-chart calendar provenance helpers in their initial bundle.
 */

/**
 * Whether a chart's birth time is confirmed for time-sensitive transit points
 * (natal Moon, Ascendant, Midheaven, and calendar subscriptions). When the
 * device's time-zone data disagrees with our historical table, treat the time
 * as unconfirmed for those points even if the user supplied one.
 */
export function hasConfirmedBirthTime(timeKnown: boolean, flags: readonly string[]): boolean {
  return timeKnown && !flags.includes('host-zone-data-differs');
}

/** Dates on which `@zodiacs/engine` accepts `calendar-unknown` (matching its receipt gate). */
export function calendarUnknownCanApply(date: string): boolean {
  return date >= '1582-10-05' && date <= '1918-02-26';
}

/** Whether a saved summary explicitly recorded calendar-checked flags against the date as written. */
export function hasVerifiedSavedCalendarFlags(
  savedSummary: { calendarChecked?: boolean },
): boolean {
  return savedSummary.calendarChecked === true;
}

/**
 * When reopening a chart whose summary carries explicit calendar-checked
 * provenance, preserve its saved `calendar-unknown` flag instead of
 * recomputing it from the stored Gregorian date (which does not record whether
 * the user entered Old Style), ignoring any stale flag outside the changeover
 * span. For pre-patch, legacy, or reconstructed summaries without
 * `calendarChecked`, keep the freshly reconstructed flag within the span.
 */
export function preserveSavedCalendarUnknown<T extends string>(
  recomputedFlags: readonly T[],
  savedSummary: { flags?: readonly string[]; calendarChecked?: boolean },
  birthDate?: string,
): (T | 'calendar-unknown')[] {
  const validForDate = birthDate === undefined || calendarUnknownCanApply(birthDate);
  if (!hasVerifiedSavedCalendarFlags(savedSummary)) {
    return validForDate ? [...recomputedFlags] : recomputedFlags.filter((flag) => flag !== 'calendar-unknown');
  }
  const without = recomputedFlags.filter((flag) => flag !== 'calendar-unknown');
  return validForDate && savedSummary.flags?.includes('calendar-unknown')
    ? [...without, 'calendar-unknown']
    : without;
}
