/**
 * "Add 2027 to my calendar": one RFC 5545 file built in the browser from the
 * moments on the page, handed to the browser as a download. There is no
 * subscription URL, because a URL would have to carry the birth details.
 *
 * What the file holds: each moment's dates as events (all-day on the
 * reader's local date, or one timed minute for an eclipse peak or a solar
 * return), a short description with the reading and its confidence, a link
 * back to the page, and a reminder the day before. No name, birth date, birth
 * time or birthplace enters it, and the file name is the same for everyone.
 */
import type { CatalogLocale } from '../i18n/core';
import { serializePersonalEvents, stableIcalUid, type PersonalCalendarEvent } from '../ical';
import { ALL_DAY_ALARM, TIMED_ALARM, localDate } from '../personal-calendar/events';
import { yearSkyWords } from './copy';
import { EDITION_YEAR } from './edition';
import type { YearMoment } from './types';

export const YEAR_SKY_CALENDAR_FILENAME = `zodiacs-${EDITION_YEAR}-sky.ics`;

export interface YearCalendarOptions {
  locale: CatalogLocale;
  /** IANA zone that sets the local date of all-day events (the reader's own). */
  timeZone: string;
  generatedAt: Date | string;
  /** Absolute link back to the page. */
  pageUrl: string;
}

function minute(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace('T', ' ');
}

/** Personal moments first; a shared-sky moment one of them stands in for is left out. */
export function calendarMoments(personal: readonly YearMoment[], general: readonly YearMoment[]): YearMoment[] {
  const replaced = new Set(personal.map((moment) => moment.replaces).filter(Boolean));
  return [...personal, ...general.filter((moment) => !replaced.has(moment.id))];
}

export function yearCalendarEvents(moments: readonly YearMoment[], options: YearCalendarOptions): PersonalCalendarEvent[] {
  const w = yearSkyWords(options.locale);
  return moments.flatMap((moment) => moment.dates.map((date): PersonalCalendarEvent => {
    const summary = date.label ? `${moment.title} · ${date.label}` : moment.title;
    const description = [
      moment.line,
      moment.detail,
      date.timed ? w.calendarExact.replace('{time}', minute(date.at)) : '',
      moment.confidence === null ? '' : `${w.confidence(moment.confidence)}. ${w.calendarForecast}`,
      w.calendarMore.replace('{url}', options.pageUrl),
    ].filter(Boolean).join('\n\n');
    const uid = stableIcalUid(`year-${moment.kind}`, [moment.id, date.at]);
    const base = { uid, summary, description, url: options.pageUrl };
    return date.timed
      ? { ...base, start: date.at, alarms: [{ trigger: TIMED_ALARM, description: summary }] }
      : { ...base, date: localDate(date.at, options.timeZone), alarms: [{ trigger: ALL_DAY_ALARM, description: summary }] };
  }));
}

/** The whole file, or null when there is nothing to put in it. */
export function yearCalendar(moments: readonly YearMoment[], options: YearCalendarOptions): string | null {
  const events = yearCalendarEvents(moments, options);
  if (!events.length) return null;
  return serializePersonalEvents(events, {
    generatedAt: options.generatedAt,
    calendarName: yearSkyWords(options.locale).calendarName,
  });
}
