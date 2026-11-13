/**
 * Dates on the sign-season pages, in the page's language. English keeps the
 * en-US forms the pages were published with; the translations use the
 * site's own formatter (src/lib/i18n/dates.ts, which writes Portuguese
 * firsts as "1º de"), and French firsts as "1er".
 */
import { formatDate } from '../i18n/dates';
import type { SeasonLocale } from './copy';

export function seasonDate(locale: SeasonLocale, iso: string, options: Intl.DateTimeFormatOptions): string {
  if (locale === 'en') return new Intl.DateTimeFormat('en-US', options).format(new Date(iso));
  const text = formatDate(locale, iso, options);
  return locale === 'fr' ? text.replace(/(^|\s)1 (?=\p{L})/u, '$11er ') : text;
}

/** A UTC clock time, 24-hour: "14:05". */
export function seasonUtcTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(new Date(iso));
}

/** "November 22, 2026, 14:35 UTC" in the page's language. */
export function seasonUtcStamp(locale: SeasonLocale, iso: string): string {
  const date = seasonDate(locale, iso, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${date}, ${seasonUtcTime(iso)} UTC`;
}
