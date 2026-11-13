/**
 * Ranges in words for the six published locales: "Mar 3 to Apr 1",
 * "del 3 mar al 1 abr", "du 3 mars au 1 avr.", "dall'8 al 12 mag",
 * "со 2 мар по 9 апр". Pages print these instead of a dash between two
 * values. `days` endpoints begin with a day number (formatShortDate output in
 * day-first locales); `plain` endpoints are degrees or years.
 */
import { requireCatalogLocale, type CatalogLocale, type Locale } from './i18n/core.js';

export type RangeKind = 'days' | 'plain';

/** Italian elides the article before a day read with a vowel: l'1, l'8, l'11. */
const italianDay = (preposition: 'da' | 'a', value: string): string => (
  /^(?:1|8|11)(?!\d)/u.test(value) ? `${preposition === 'da' ? 'dall’' : 'all’'}${value}` : `${preposition === 'da' ? 'dal' : 'al'} ${value}`
);

/** Russian takes "со" before второго (2): "со 2 мар", but "с 12 мар". */
const russianFrom = (value: string): string => (/^2(?!\d)/u.test(value) ? `со ${value}` : `с ${value}`);

const DAYS: Record<CatalogLocale, (from: string, to: string) => string> = {
  en: (from, to) => `${from} to ${to}`,
  es: (from, to) => `del ${from} al ${to}`,
  pt: (from, to) => `de ${from} a ${to}`,
  fr: (from, to) => `du ${from} au ${to}`,
  it: (from, to) => `${italianDay('da', from)} ${italianDay('a', to)}`,
  ru: (from, to) => `${russianFrom(from)} по ${to}`,
};

const PLAIN: Record<CatalogLocale, (from: string, to: string) => string> = {
  en: (from, to) => `${from} to ${to}`,
  es: (from, to) => `de ${from} a ${to}`,
  pt: (from, to) => `de ${from} a ${to}`,
  fr: (from, to) => `de ${from} à ${to}`,
  it: (from, to) => `da ${from} a ${to}`,
  ru: (from, to) => `от ${from} до ${to}`,
};

/** A closed range in words. */
export function rangeWords(locale: Locale, from: string, to: string, kind: RangeKind = 'days'): string {
  const catalog = requireCatalogLocale(locale);
  return (kind === 'days' ? DAYS : PLAIN)[catalog](from, to);
}

const UNTIL: Record<CatalogLocale, (to: string) => string> = {
  en: (to) => `until ${to}`,
  es: (to) => `hasta el ${to}`,
  pt: (to) => `até ${to}`,
  fr: (to) => `jusqu’au ${to}`,
  it: (to) => `fino ${italianDay('a', to)}`,
  ru: (to) => `по ${to}`,
};

const SINCE: Record<CatalogLocale, (from: string) => string> = {
  en: (from) => `from ${from}`,
  es: (from) => `desde el ${from}`,
  pt: (from) => `desde ${from}`,
  fr: (from) => `depuis le ${from}`,
  it: (from) => italianDay('da', from),
  ru: (from) => russianFrom(from),
};

/**
 * A range whose start is named by a phrase ("already retrograde as 2026
 * begins"): "ya retrógrado al comenzar 2026, hasta el 12 feb 2026".
 */
export function phraseUntil(locale: Locale, phrase: string, to: string): string {
  return `${phrase}, ${UNTIL[requireCatalogLocale(locale)](to)}`;
}

/** A range whose end is named by a phrase ("ongoing"): "desde el 3 oct 2026, en curso". */
export function sincePhrase(locale: Locale, from: string, phrase: string): string {
  return `${SINCE[requireCatalogLocale(locale)](from)}, ${phrase}`;
}
