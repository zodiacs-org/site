/** Shared shapes for the Moon journal. Nothing here leaves the device. */

export type SignSlug =
  | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo'
  | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

export const SIGN_SLUGS: readonly SignSlug[] = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

/** One new or full Moon from the committed sky data, with its sign. */
export interface Lunation {
  type: 'new' | 'full';
  /** Exact instant, UTC ISO. */
  at: string;
  sign: SignSlug;
}

/** One journal entry, written at one lunation. */
export interface JournalEntry {
  /** The lunation it belongs to, e.g. 'new-2026-11-09' (UTC day). */
  id: string;
  phase: 'new' | 'full';
  sign: SignSlug;
  /** The lunation's exact instant, UTC ISO. */
  at: string;
  /** The question shown when it was written. */
  prompt: string;
  text: string;
  /** When the entry was last saved, ISO. Local only. */
  savedAt: string;
}
