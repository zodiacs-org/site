/**
 * One short line per sign for each of the big three, for the shareable
 * "big three" card of each sign. Written per language, not translated:
 * one plain sentence, 80 characters or fewer, no dashes, no promises about
 * fate, health, money or relationships.
 */
export type BigThreeLines = Record<
  'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo' | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces',
  { sun: string; moon: string; rising: string }
>;
