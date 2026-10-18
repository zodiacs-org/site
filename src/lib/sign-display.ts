/**
 * Reader-facing wording for the canonical sign table. The table in signs.ts
 * keeps its data strings ('Mar 21 – Apr 19') because the daily publication's
 * provenance hash covers that file; pages render these helpers instead.
 * Nothing in the daily or horoscope publication imports this module.
 */
import { requireCatalogLocale, type CatalogLocale } from './i18n/core.js';
import { signBySlug, signDates, type DisplayLocale, type Sign } from './signs';

/** The separator between the two days in every signDates() table string. */
const RANGE_SEPARATOR = ' – ';

const RANGE_WORDS: Record<CatalogLocale, (from: string, to: string) => string> = {
  en: (from, to) => `${from} to ${to}`,
  es: (from, to) => `del ${from} al ${to}`,
  pt: (from, to) => `de ${from} a ${to}`,
  fr: (from, to) => `du ${from} au ${to}`,
  it: (from, to) => `dal ${from} al ${to}`,
  ru: (from, to) => `с ${from} по ${to}`,
};

/** 'Mar 21 to Apr 19', 'del 21 mar al 19 abr', 'с 21 мар по 19 апр'. */
export function signDateRange(sign: Sign | string, locale: DisplayLocale = 'en'): string {
  const dates = signDates(sign, locale);
  const days = dates.split(RANGE_SEPARATOR);
  if (days.length !== 2) return dates;
  return RANGE_WORDS[requireCatalogLocale(locale)](days[0], days[1]);
}

/** English essences whose table wording carries a dash; same words, plain punctuation. */
export const SIGN_TAGLINE_OVERRIDES: Readonly<Record<string, string>> = {
  aries: 'First out of the gate. Direct, fast, unafraid to start.',
};

/** The one-line English essence as pages print it. */
export function signTagline(sign: Sign | string): string {
  const resolved = typeof sign === 'string' ? signBySlug(sign) : sign;
  return SIGN_TAGLINE_OVERRIDES[resolved.slug] ?? resolved.essence;
}
