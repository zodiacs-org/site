/**
 * Submit-time checks for the shared birth fields, the same pattern as the
 * birth chart form: each missing or impossible field gets its own message,
 * `BirthFields` marks it `aria-invalid` and links the message, and focus goes
 * to the first field that needs attention. Submit buttons stay enabled so
 * keyboard and screen-reader users can reach them and hear what is missing.
 */
import { t, type CatalogLocale as Locale } from '../lib/i18n';

export interface BirthFieldIds {
  date: string;
  time?: string;
  place?: string;
}

export interface BirthFieldValues {
  date: string;
  /** Checked only when `requireTime` is set, the time is known and an id is given. */
  time?: string;
  timeKnown?: boolean;
  requireTime?: boolean;
  /** Checked only when a place id is given. */
  city?: unknown;
}

export interface BirthFieldMessages {
  dateError?: string;
  timeError?: string;
  placeError?: string;
  /** The id of the first field with a message, in reading order. */
  first?: string;
}

/** A date the field holds but the chart cannot use: outside its min and max, or unreadable. */
function dateOutOfRange(id: string): boolean {
  const input = typeof document === 'undefined' ? null : document.getElementById?.(id) as HTMLInputElement | null;
  return input?.validity?.valid === false;
}

/** The message for a lone date field that is not a birth date (any date at all), or undefined. */
export function dateMessage(locale: Locale, id: string, date: string): string | undefined {
  return date === '' ? t(locale, 'dateRequired') : dateOutOfRange(id) ? t(locale, 'dateRange') : undefined;
}

/** Wording for a form about someone else, where the catalog's "your" would be wrong. */
export interface BirthFieldWords {
  dateRequired: string;
  timeRequired: string;
  place: string;
}

/** The messages for the birth fields as they stand; empty when they are complete. */
export function birthFieldMessages(
  locale: Locale, ids: BirthFieldIds, values: BirthFieldValues, words?: BirthFieldWords,
): BirthFieldMessages {
  const messages: BirthFieldMessages = {};
  if (values.date === '') messages.dateError = words?.dateRequired ?? t(locale, 'birthDateRequired');
  else if (dateOutOfRange(ids.date)) messages.dateError = t(locale, 'birthDateRange');
  if (ids.time && values.requireTime && values.timeKnown !== false && !values.time) {
    messages.timeError = words?.timeRequired ?? t(locale, 'birthTimeRequired');
  }
  if (ids.place && !values.city) messages.placeError = words?.place ?? t(locale, 'placePickHint');
  messages.first = messages.dateError ? ids.date
    : messages.timeError ? ids.time
      : messages.placeError ? ids.place : undefined;
  return messages;
}

/** Moves focus to a field after the render that marks it. */
export function focusField(id: string | undefined): void {
  if (!id || typeof requestAnimationFrame !== 'function') return;
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}
