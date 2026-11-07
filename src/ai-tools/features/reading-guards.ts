/**
 * Shared limits for the coverage tools and the personal week in get_horoscope:
 * whether a birth date is under 18, and the house wording that would otherwise
 * pull a reading toward health or romance. get_compatibility gives no reading
 * at all when either birth date is under 18. Reading confidence has its own rule, in
 * ../reading-confidence.ts. Pure. Nothing here is stored or logged.
 */

/**
 * A birth date is under `years` on `today` (both YYYY-MM-DD) when that birthday has not arrived; a date after today
 * is too. The cutoff is today's month and day `years` earlier, compared as text, so on 29 February it stays
 * 29 February instead of rolling over to 1 March: someone born on 1 March is not yet a year older that day.
 */
export function isUnderAge(birthDate: string, today: string, years: number): boolean {
  return birthDate > `${String(Number(today.slice(0, 4)) - years).padStart(4, '0')}${today.slice(4)}`;
}

/** A birth date is under 18 on `today` (both YYYY-MM-DD) when the 18th birthday has not arrived. */
export function isUnder18(birthDate: string, today: string): boolean {
  return isUnderAge(birthDate, today, 18);
}

/**
 * A birth date is under 13 on `today` (both YYYY-MM-DD) when the 13th birthday has not arrived, or the date has not
 * come yet. Zodiacs is not directed at children under 13, so the hosted tools refuse such a date (../tools.ts).
 */
export function isUnder13(birthDate: string, today: string): boolean {
  return isUnderAge(birthDate, today, 13);
}

/** The sixth-house themes, without a health reading, so a line does not become medical advice. */
export function softenHealth(text: string): string {
  return text
    .replaceAll('routines, health, craft, and the daily load', 'routines, craft, and the shape of the day')
    .replaceAll('daily work, health routines, and responsibilities', 'daily work, upkeep, and responsibilities')
    .replaceAll('daily work, maintenance, health routines, service, and the systems that keep life functioning', 'daily work, maintenance, upkeep, and the systems that keep life functioning');
}

const MINOR_WORDS: [RegExp, string][] = [
  [/\bromantic\b/giu, 'personal'],
  [/\bromance\b/giu, 'play'],
  [/\battraction\b/giu, 'interest'],
  [/\bintimacy\b/giu, 'trust'],
  [/\bin love\b/giu, 'close'],
  [/\bsexual\b/giu, 'private'],
  [/\bchemistry\b/giu, 'pull'],
  [/\bway of loving\b/giu, 'way of caring'],
];

/** Romantic and attraction wording, left out of a reading for someone under 18. A capital stays a capital. */
export function softenMinor(text: string): string {
  return MINOR_WORDS.reduce((out, [pattern, word]) => out.replace(pattern, (match) => (match[0] === match[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word)), text);
}

export const MINOR_NOTE = 'This birth date is under 18, so romantic and attraction readings are left out.';
