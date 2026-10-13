import { LOCALE_META, type Locale } from './core';

export { TECHNICAL_OFFSET_LOCALE, TECHNICAL_WALL_LOCALE } from '../time/technical-locales';

export function intlLocale(locale: Locale): string {
  return LOCALE_META[locale].intlLocale;
}

/**
 * Brazilian Portuguese writes the first of a month as an ordinal, "1º de
 * novembro", where Intl prints "1 de novembro". src/lib/edition-freshness.ts
 * applies the same rule to the edition's date label.
 */
export function withFirstDayOrdinal(locale: Locale, text: string): string {
  return locale === 'pt' ? text.replace(/(^|\D)1 de (?=\p{L})/u, '$11º de ') : text;
}

export function formatDate(
  locale: Locale,
  value: Date | string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return withFirstDayOrdinal(locale, date.toLocaleDateString(intlLocale(locale), options));
}

export function formatTime(
  locale: Locale,
  value: Date | string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleTimeString(intlLocale(locale), options);
}

export function formatDateTime(
  locale: Locale,
  value: Date | string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return withFirstDayOrdinal(locale, new Intl.DateTimeFormat(intlLocale(locale), options).format(date));
}

export function formatShortDate(locale: Locale, value: Date | string): string {
  return formatDate(locale, value, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
