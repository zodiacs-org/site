/**
 * How the calculator tools read their input: strictly, field by field, as their schemas in calculator-tools.ts state
 * them. A reader returns the value, or undefined when the input does not match, so a tool can refuse with a fixed
 * sentence that repeats nothing it was given.
 */
import type { HouseSystem } from '../../engine/types';
import { parseCivilDate, parseCivilTime } from '../../time/civil-date';

/** The birth dates the pages take: their date fields run from 1800-01-01 through 2199-12-31. */
export const FIRST_DATE = '1800-01-01';
export const LAST_DATE = '2199-12-31';

export interface Place { latitude: number; longitude: number; timeZone: string }

/** A place as the pages hold one (src/lib/geo/rank.ts City): `lat`, `lon` and `tz`. */
export const asSite = (place: Place) => ({ lat: place.latitude, lon: place.longitude, tz: place.timeZone });

/** A birth as the pages take it: a date, a clock time when it is known (null when not), and a place. */
export interface Birth { date: string; time: string | null; place: Place }

export const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const onlyKeys = (value: Record<string, unknown>, keys: readonly string[]) => (
  Object.keys(value).every((key) => keys.includes(key))
);

/** A YYYY-MM-DD calendar date within the pages' range, or undefined. */
export function readDate(value: unknown, first = FIRST_DATE, last = LAST_DATE): string | undefined {
  return parseCivilDate(value) && (value as string) >= first && (value as string) <= last ? value as string : undefined;
}

/** An HH:MM clock time: null when absent, undefined when given and invalid. */
export function readTime(value: unknown): string | null | undefined {
  if (value === undefined) return null;
  return parseCivilTime(value) ? value as string : undefined;
}

function supportedZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** A place: null when absent, undefined when given and invalid. */
export function readPlace(value: unknown): Place | null | undefined {
  if (value === undefined) return null;
  if (!isRecord(value) || !onlyKeys(value, ['latitude', 'longitude', 'timeZone'])) return undefined;
  const { latitude, longitude, timeZone } = value;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90) return undefined;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return undefined;
  if (typeof timeZone !== 'string' || timeZone.length === 0 || timeZone.length > 64 || !supportedZone(timeZone)) return undefined;
  return { latitude, longitude, timeZone };
}

/**
 * A birth: { date, time?, place }, with a place always and a time when `timeRequired`. Undefined when the value does
 * not match.
 */
export function readBirth(value: unknown, { timeRequired = false } = {}): Birth | undefined {
  if (!isRecord(value) || !onlyKeys(value, ['date', 'time', 'place'])) return undefined;
  const date = readDate(value.date);
  const time = readTime(value.time);
  const place = readPlace(value.place);
  if (date === undefined || time === undefined || !place || (timeRequired && time === null)) return undefined;
  return { date, time, place };
}

/** The house system: the pages' whole-sign default when absent, undefined when given and invalid. */
export function readHouseSystem(value: unknown): HouseSystem | undefined {
  if (value === undefined) return 'whole';
  return value === 'whole' || value === 'placidus' ? value : undefined;
}

/**
 * An instant as an ISO 8601 UTC date-time (…Z) from 00:00 through 23:59, on a date from `first` through `last`: null
 * when absent, undefined when given and invalid. 24:00, which Date would roll into the next day, is refused rather
 * than rolled.
 */
export function readInstant(value: unknown, first = FIRST_DATE, last = LAST_DATE): Date | null | undefined {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?Z$/.test(value)) return undefined;
  if (!readDate(value.slice(0, 10), first, last)) return undefined;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? undefined : instant;
}
