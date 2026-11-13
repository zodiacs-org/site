import type { City } from '../geo/search';
import type { Chart } from '../engine/types';
import type { EngineModule } from '../hooks/useEngine';
import type { CatalogLocale } from '../i18n/core';
import { birthDateForChart, type CalendarChoice } from '../../islands/BirthFields';
import { prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';
import { birthDateRefusal, birthDateRefusalText, type BirthDateRefusal } from '../birth-date-policy';

/**
 * A birth date the site does not read (under 13, or still to come), found
 * after a Julian entry is converted to its Gregorian date. The forms check the
 * typed date before calling calculateEntry; this is the check on the converted
 * date, thrown before any time zone or engine work.
 */
export class BirthDateRefusedError extends RangeError {
  readonly refusal: BirthDateRefusal;
  constructor(refusal: BirthDateRefusal) {
    super(birthDateRefusalText(refusal));
    this.name = 'BirthDateRefusedError';
    this.refusal = refusal;
  }
}

/** The refusal sentence when a calculation stopped on a refused birth date, otherwise null. */
export function entryRefusalMessage(cause: unknown): string | null {
  return cause instanceof BirthDateRefusedError ? cause.message : null;
}

export interface ChartEntry { id: number; name: string; date: string; time: string; timeKnown: boolean; city: City | null; calendar: CalendarChoice }
export const emptyEntry = (id: number): ChartEntry => ({ id, name: '', date: '', time: '', timeKnown: true, city: null, calendar: 'gregorian' });
export function entryReady(entry: ChartEntry): boolean { return Boolean(entry.date && entry.city && (!entry.timeKnown || entry.time)); }

export async function calculateEntry(entry: ChartEntry, engine: EngineModule, locale: CatalogLocale): Promise<{ chart: Chart; date: string }> {
  if (!entryReady(entry)) throw new RangeError('missing entry');
  const civil = await birthDateForChart(locale, entry.date, entry.calendar);
  if ('error' in civil) throw new RangeError(civil.error);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(civil.date) || civil.date < '1800-01-01' || civil.date > '2199-12-31') throw new RangeError('date out of range');
  const refusal = birthDateRefusal(civil.date);
  if (refusal) throw new BirthDateRefusedError(refusal);
  await prepareLocalTime(civil.date, entry.city!.tz);
  const resolved = resolveLocalToUtc(civil.date, entry.timeKnown ? entry.time : '12:00', entry.city!.tz, { longitude: entry.city!.lon });
  const chart = engine.computeChart({ utc: resolved.utc, latitude: entry.city!.lat, longitude: entry.city!.lon, houseSystem: 'whole', timeKnown: entry.timeKnown, flags: resolved.flags });
  return { chart, date: civil.date };
}
