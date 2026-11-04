/**
 * Shared limits for the unreleased coverage tools: how settled a forecast
 * date is, whether a birth date is under 18, and the house wording that
 * would otherwise pull a reading toward health or romance.
 * Pure. Nothing here is stored or logged.
 */

/** A birth date is under 18 on `today` (both YYYY-MM-DD) when the 18th birthday has not arrived. */
export function isUnder18(birthDate: string, today: string): boolean {
  const [year, month, day] = today.split('-').map(Number);
  const cutoff = new Date(Date.UTC(year - 18, month - 1, day));
  return birthDate > cutoff.toISOString().slice(0, 10);
}

/**
 * How settled a forecast's date is, from 0 to 100. It is not a chance that
 * a life event will happen. A current location's clock is the most settled;
 * a birthplace clock is used only when no current location was given; UTC
 * is the assumption when no zone was given at all.
 */
export function forecastConfidence(options: { clock: 'current' | 'birthplace' | 'utc'; timeKnown: boolean; point?: string }): number {
  if (options.clock === 'utc') return 64;
  const sensitive = options.point === 'Moon' || options.point === 'ASC' || options.point === 'MC' || options.point === 'rising degree' || options.point === 'Midheaven';
  if (options.clock === 'birthplace') return options.timeKnown ? (sensitive ? 76 : 80) : 70;
  if (!options.timeKnown) return 72;
  return sensitive ? 84 : 90;
}

/** The sentence the assistant reads with the line. */
export function withConfidence(line: string, confidence: number): string {
  return `${line} Confidence ${confidence}%.`;
}

/** The sixth-house themes, without a health reading, so a line does not become medical advice. */
export function softenHealth(text: string): string {
  return text
    .replaceAll('routines, health, craft, and the daily load', 'routines, craft, and the shape of the day')
    .replaceAll('daily work, health routines, and responsibilities', 'daily work, upkeep, and responsibilities')
    .replaceAll('daily work, maintenance, health routines, service, and the systems that keep life functioning', 'daily work, maintenance, upkeep, and the systems that keep life functioning');
}

/** Romantic and attraction wording, left out of a reading for someone under 18. */
export function softenMinor(text: string): string {
  return text
    .replace(/\bromantic\b/giu, 'personal')
    .replace(/\bromance\b/giu, 'play')
    .replace(/\battraction\b/giu, 'interest')
    .replace(/\bintimacy\b/giu, 'trust')
    .replace(/\bin love\b/giu, 'close')
    .replace(/\bsexual\b/giu, 'private')
    .replace(/\bchemistry\b/giu, 'pull');
}

export const MINOR_NOTE = 'This birth date is under 18, so romantic and attraction readings are left out.';
