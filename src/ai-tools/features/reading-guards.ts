/**
 * Shared limits for the coverage tools and get_compatibility: whether a birth
 * date is under 18, and the house wording that would otherwise pull a reading
 * toward health or romance. Reading confidence has its own rule, in
 * ../reading-confidence.ts. Pure. Nothing here is stored or logged.
 */

/** A birth date is under 18 on `today` (both YYYY-MM-DD) when the 18th birthday has not arrived. */
export function isUnder18(birthDate: string, today: string): boolean {
  const [year, month, day] = today.split('-').map(Number);
  const cutoff = new Date(Date.UTC(year - 18, month - 1, day));
  return birthDate > cutoff.toISOString().slice(0, 10);
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
];

/** Romantic and attraction wording, left out of a reading for someone under 18. A capital stays a capital. */
export function softenMinor(text: string): string {
  return MINOR_WORDS.reduce((out, [pattern, word]) => out.replace(pattern, (match) => (match[0] === match[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word)), text);
}

export const MINOR_NOTE = 'This birth date is under 18, so romantic and attraction readings are left out.';
