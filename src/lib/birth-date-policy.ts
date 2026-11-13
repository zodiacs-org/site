/**
 * Which birth dates the site's chart forms refuse (the 9 November 2026 audit,
 * Decision C). Zodiacs is not directed at children under 13, so a form that
 * builds a person's chart from a birth date refuses one less than 13 years
 * ago, and a date that has not happened yet gets its own sentence.
 *
 * "Today" is the calendar date at UTC-12, the earliest date anywhere on
 * Earth, so nobody is accepted before their 13th birthday in any time zone.
 * The cost, stated in the audit, is that the check accepts a person up to 26
 * hours after their 13th birthday begins locally (at UTC+14). A date is in
 * the future only after the calendar date at UTC+14, the latest date
 * anywhere, so a baby born today anywhere is told about age, not about the
 * year.
 *
 * Callers pass the Gregorian civil date the chart is computed from: a Julian
 * (Old Style) entry is checked after it is converted.
 *
 * The two sentences are English only until reviewed translations exist;
 * localized pages mark them with lang="en" (birthDateRefusalLang).
 */

export type BirthDateRefusal = 'under_13' | 'future_birth_date';

export const UNDER_13_SENTENCE =
  "Zodiacs is for people 13 and over, so it doesn't read charts for birth dates less than 13 years ago.";
export const FUTURE_BIRTH_DATE_SENTENCE =
  "That birth date hasn't happened yet. Check the year and try again.";

const HOUR_MS = 3_600_000;
const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const MINIMUM_AGE = 13;

function civilDateAt(now: Date, offsetHours: number): string {
  return new Date(now.getTime() + offsetHours * HOUR_MS).toISOString().slice(0, 10);
}

/** The calendar date at UTC-12, the earliest date anywhere on Earth (YYYY-MM-DD). */
export function earliestToday(now: Date = new Date()): string {
  return civilDateAt(now, -12);
}

/** The calendar date at UTC+14, the latest date anywhere on Earth (YYYY-MM-DD). */
export function latestToday(now: Date = new Date()): string {
  return civilDateAt(now, 14);
}

/**
 * Why a Gregorian birth date (YYYY-MM-DD) is refused, or null when it may be
 * read. A malformed date is left to the form's own validation and returns
 * null. Someone born on 29 February turns 13 on 1 March in a year without
 * one, because the comparison is on the date's text.
 */
export function birthDateRefusal(birthDate: string, now: Date = new Date()): BirthDateRefusal | null {
  if (typeof birthDate !== 'string' || !CIVIL_DATE.test(birthDate)) return null;
  if (birthDate > latestToday(now)) return 'future_birth_date';
  const today = earliestToday(now);
  const thirteenYearsBefore = `${String(Number(today.slice(0, 4)) - MINIMUM_AGE).padStart(4, '0')}${today.slice(4)}`;
  return birthDate > thirteenYearsBefore ? 'under_13' : null;
}

/** The sentence a form shows for a refusal, exactly as the audit wrote it. */
export function birthDateRefusalText(refusal: BirthDateRefusal): string {
  return refusal === 'under_13' ? UNDER_13_SENTENCE : FUTURE_BIRTH_DATE_SENTENCE;
}

/**
 * The lang attribute for an error area: 'en' when it shows one of the two
 * English sentences, so a localized page marks them as English.
 */
export function birthDateRefusalLang(message: string | null | undefined): 'en' | undefined {
  return message === UNDER_13_SENTENCE || message === FUTURE_BIRTH_DATE_SENTENCE ? 'en' : undefined;
}
