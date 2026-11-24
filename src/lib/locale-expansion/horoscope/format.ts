import type { ExpansionLocale } from './types';

const INTL: Record<ExpansionLocale, string> = { es: 'es-ES', pt: 'pt-BR', fr: 'fr-FR', it: 'it-IT', ru: 'ru-RU' };

const noon = (day: string) => new Date(day.length === 10 ? `${day}T12:00:00Z` : day);

/** French writes the first of the month as an ordinal: "1er novembre". */
const firstOrdinal = (locale: ExpansionLocale, text: string) => (locale === 'fr' ? text.replace(/^1 /u, '1er ') : text);

/** "9 de noviembre", "9 novembre"; always the UTC calendar day. */
export function dayMonth(locale: ExpansionLocale, at: string): string {
  return firstOrdinal(locale, new Intl.DateTimeFormat(INTL[locale], { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(noon(at)));
}

export function dayMonthYear(locale: ExpansionLocale, at: string): string {
  return firstOrdinal(locale, new Intl.DateTimeFormat(INTL[locale], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(noon(at)));
}

export function weekday(locale: ExpansionLocale, at: string): string {
  return new Intl.DateTimeFormat(INTL[locale], { weekday: 'long', timeZone: 'UTC' }).format(noon(at));
}

/** "noviembre de 2026", as the locale writes a month. */
export function monthYear(locale: ExpansionLocale, month: string): string {
  return new Intl.DateTimeFormat(INTL[locale], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(noon(`${month}-15`));
}

export function monthName(locale: ExpansionLocale, month: number): string {
  const mm = String(month).padStart(2, '0');
  return new Intl.DateTimeFormat(INTL[locale], { month: 'long', timeZone: 'UTC' }).format(noon(`2026-${mm}-15`));
}

/** "07:02 UTC" */
export function utcClock(at: string): string {
  return `${at.slice(11, 16)} UTC`;
}

export const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Pick a variant deterministically, so a sign's copy is stable from build to build. */
export function pick<T>(items: readonly T[], ...keys: number[]): T {
  const n = keys.reduce((sum, key) => sum + key, 0);
  return items[((n % items.length) + items.length) % items.length];
}
