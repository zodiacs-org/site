import type { EventFamily, EventManifest, SkyEvent } from './types';

export const EVENTS_BASE = '/data/market-lens/events';
const FAMILIES = new Set<EventFamily>(['lunation', 'eclipse', 'station', 'retrograde', 'ingress', 'aspect']);
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const validInstant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function isEventManifest(value: unknown): value is EventManifest {
  if (!value || typeof value !== 'object') return false;
  const x = value as EventManifest;
  return x.schema === 1 && validInstant(x.generatedAt) && typeof x.engineVersion === 'string'
    && validInstant(x.coverage?.start) && validInstant(x.coverage?.end) && x.coverage.start < x.coverage.end
    && Array.isArray(x.months) && x.months.length <= 240 && x.months.every((month) => MONTH_PATTERN.test(month))
    && new Set(x.months).size === x.months.length && Array.isArray(x.supportedFamilies)
    && x.supportedFamilies.every((family) => FAMILIES.has(family))
    && Array.isArray(x.limitations) && x.limitations.every((text) => typeof text === 'string');
}

export function isSkyEvent(value: unknown): value is SkyEvent {
  if (!value || typeof value !== 'object') return false;
  const x = value as SkyEvent;
  return typeof x.id === 'string' && x.id.length > 0 && x.id.length < 240 && FAMILIES.has(x.family)
    && typeof x.subtype === 'string' && typeof x.title === 'string' && validInstant(x.at)
    && (x.end === undefined || x.end === null || (validInstant(x.end) && Date.parse(x.end) > Date.parse(x.at)))
    && Array.isArray(x.bodies) && x.bodies.length > 0 && x.bodies.every((body) => typeof body === 'string')
    && typeof x.interpretation === 'string' && typeof x.provenance?.catalog === 'string'
    && /^[a-f0-9]{64}$/.test(x.provenance.sha256) && typeof x.provenance.engineVersion === 'string'
    && typeof x.provenance.convention === 'string'
    && (x.linkedIds === undefined || (Array.isArray(x.linkedIds) && x.linkedIds.every((id) => typeof id === 'string')));
}

export async function loadEventManifest(signal?: AbortSignal): Promise<EventManifest> {
  const response = await fetch(`${EVENTS_BASE}/manifest.json`, { signal });
  if (!response.ok) throw new Error(`Sky catalog unavailable (${response.status}).`);
  const value: unknown = await response.json();
  if (!isEventManifest(value)) throw new Error('Sky catalog manifest is invalid.');
  return value;
}

export interface EventRange { start: string | number; end: string | number }
const milliseconds = (value: string | number): number => typeof value === 'number' ? value : Date.parse(value);

/** Range numbers are Unix milliseconds; start inclusive, end exclusive. */
export async function loadEvents(manifest: EventManifest, selection?: string[] | EventRange, signal?: AbortSignal): Promise<SkyEvent[]> {
  if (!isEventManifest(manifest)) throw new Error('Sky catalog manifest is invalid.');
  const range = selection && !Array.isArray(selection) ? { start: milliseconds(selection.start), end: milliseconds(selection.end) } : null;
  if (range && (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.start >= range.end)) throw new Error('Sky event range is invalid.');
  const months = Array.isArray(selection) ? [...new Set(selection)] : manifest.months.filter((month) => {
    if (!range) return true;
    const [year, mon] = month.split('-').map(Number);
    return Date.UTC(year, mon - 1, 1) < range.end && Date.UTC(year, mon, 1) > range.start;
  });
  if (months.some((month) => !manifest.months.includes(month))) throw new Error('Requested sky month is outside catalog coverage.');
  // Small batches keep a full-horizon fetch from flooding the network.
  const events: SkyEvent[] = [];
  for (let offset = 0; offset < months.length; offset += 6) {
    const shards = await Promise.all(months.slice(offset, offset + 6).map(async (month) => {
      const response = await fetch(`${EVENTS_BASE}/${month}.json`, { signal });
      if (!response.ok) throw new Error(`Sky month ${month} unavailable (${response.status}).`);
      const value: unknown = await response.json();
      if (!Array.isArray(value) || value.length > 1000 || !value.every(isSkyEvent) || value.some((event) => !event.at.startsWith(month))) throw new Error(`Sky month ${month} is invalid.`);
      return value as SkyEvent[];
    }));
    events.push(...shards.flat());
  }
  const ids = new Set<string>();
  for (const event of events) {
    if (ids.has(event.id)) throw new Error('Sky catalog contains duplicate event IDs.');
    ids.add(event.id);
  }
  return events.filter((event) => !range || (Date.parse(event.at) >= range.start && Date.parse(event.at) < range.end))
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

const instant = (event: SkyEvent | string | number): Date => new Date(typeof event === 'object' ? event.at : event);

export function formatEventTime(event: SkyEvent | string | number, timeZone: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' }).format(instant(event));
}

export function formatEventDate(event: SkyEvent | string | number, timeZone: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, { timeZone, year: 'numeric', month: 'short', day: 'numeric' }).format(instant(event));
}

/** IANA local civil date for calendar grouping; never infer it from UTC slicing. */
export function eventDay(event: SkyEvent | string | number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant(event));
  const value = (name: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === name)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function localMonth(event: SkyEvent | string | number, timeZone: string): string { return eventDay(event, timeZone).slice(0, 7); }

const icsText = (text: string): string => text.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const icsDate = (date: Date): string => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** RFC 5545 content lines are at most 75 UTF-8 octets, excluding CRLF. */
export function foldICSLine(line: string): string {
  const encoder = new TextEncoder();
  let current = ''; let length = 0; const lines = [];
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (length + bytes > 75) { lines.push(current); current = ' '; length = 1; }
    current += char; length += bytes;
  }
  lines.push(current);
  return lines.join('\r\n');
}

/** A one-minute calendar entry marks the exact instant, not a research window. */
export function eventICS(event: SkyEvent, generatedAt: Date = new Date()): string {
  const start = new Date(event.at);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(generatedAt.getTime())) throw new Error('Calendar event time is invalid.');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Zodiacs//Market Lens//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${encodeURIComponent(event.id)}@zodiacs.org`, `DTSTAMP:${icsDate(generatedAt)}`, `DTSTART:${icsDate(start)}`, 'DURATION:PT1M',
    `SUMMARY:${icsText(event.title)}`, `DESCRIPTION:${icsText(`Exact astronomical instant: ${event.at}. Traditional interpretation: ${event.interpretation} Source: ${event.provenance.catalog}. ${event.provenance.convention}`)}`,
    'TRANSP:TRANSPARENT', 'END:VEVENT', 'END:VCALENDAR'];
  return `${lines.map(foldICSLine).join('\r\n')}\r\n`;
}
