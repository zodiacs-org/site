/** RFC 5545 serialization for exact transit contacts. Engine-free. */
import type { TransitContact } from './engine/transit-scan';

const CRLF = '\r\n';
const MAX_CONTENT_LINE_OCTETS = 75;
const encoder = new TextEncoder();

export interface TransitCalendarOptions {
  /** Receipt time used for VEVENT DTSTAMP values. */
  generatedAt: Date | string;
  calendarName?: string;
  /**
   * 'whole-degree' when ASC and MC were taken to the whole degree, as in the
   * subscribed feed: contacts to them are then not called exact and are
   * given to the minute. Contacts to planets are unchanged.
   */
  natalAngles?: 'exact' | 'whole-degree';
  /**
   * One all-day event placed before the contacts, the same for every
   * subscriber: the request to subscribe again on an older feed address.
   */
  notice?: CalendarNotice;
}

/** An all-day message event. It carries nothing about the subscriber. */
export interface CalendarNotice {
  /** Stable identifier fragment, e.g. `resubscribe-2026-11-28`. */
  id: string;
  /** The UTC day the event sits on. */
  day: Date | string;
  summary: string;
  description: string;
  url?: string;
}

/** Escape an RFC 5545 TEXT value. */
export function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/** Fold one logical content line without splitting a UTF-8 code point. */
export function foldIcalLine(line: string): string {
  if (/\r|\n/.test(line)) throw new Error('iCalendar logical lines cannot contain raw newlines.');
  if (encoder.encode(line).byteLength <= MAX_CONTENT_LINE_OCTETS) return line;

  const physical: string[] = [];
  let current = '';
  for (const character of line) {
    if (encoder.encode(current + character).byteLength > MAX_CONTENT_LINE_OCTETS) {
      if (!current) throw new Error('Unable to fold iCalendar content line.');
      physical.push(current);
      current = ` ${character}`;
    } else {
      current += character;
    }
  }
  physical.push(current);
  return physical.join(CRLF);
}

export function formatIcalUtc(value: Date | string): string {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError(`Invalid UTC date-time: ${String(value)}`);
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** FNV-1a over the UTF-8 bytes, 32 bits, from the given offset basis. */
function fnv1a32(bytes: Uint8Array, basis: number): number {
  let hash = basis >>> 0;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash;
}

/**
 * A contact's UID: a hash of what its event already shows, its start as
 * DTSTART gives it (to the second) and its title, so the UID carries nothing
 * the event does not, and the same contact keeps its UID from one file or
 * refresh to the next. The UID once held the exact instant to the
 * millisecond, finer than DTSTART: in a file made from the exact chart, a
 * contact to the ascendant or midheaven then gave that angle to a millionth
 * of a degree.
 */
export function transitContactUid(contact: TransitContact): string {
  const shown = encoder.encode([
    formatIcalUtc(contact.exactUtc),
    contact.transitBody,
    contact.aspect,
    contact.natalPoint,
  ].join('|'));
  const hash = [0x811c9dc5, 0x050c5d1f]
    .map((basis) => fnv1a32(shown, basis).toString(16).padStart(8, '0'))
    .join('');
  return `transit-${hash}@zodiacs.org`;
}

function contactDescription(contact: TransitContact, exact: boolean): string {
  const iso = new Date(contact.exactUtc).toISOString();
  const utcMinute = `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
  const description = exact
    ? `Exact tropical transit contact. Time: ${utcMinute}.`
    : `Tropical transit contact. Natal angle to the whole degree. Time: ${utcMinute}.`;
  // Multi-hit groups get their window-scoped pass number. The cause is
  // deliberately not asserted: dual-target aspects can produce a second
  // pass for a fast body with no retrograde loop involved.
  return contact.passCount > 1
    ? `${description} Pass ${contact.pass} of ${contact.passCount}.`
    : description;
}

function eventLines(contact: TransitContact, dtstamp: string, exact: boolean): string[] {
  // Calling formatIcalUtc first keeps invalid input from reaching description.
  const dtstart = formatIcalUtc(contact.exactUtc);
  const summary = `Transiting ${contact.transitBody} ${contact.aspect} natal ${contact.natalPoint}`;
  return [
    'BEGIN:VEVENT',
    `UID:${transitContactUid(contact)}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    'DURATION:PT1M',
    'TRANSP:TRANSPARENT',
    `SUMMARY:${escapeIcalText(exact ? `${summary} (exact)` : summary)}`,
    `DESCRIPTION:${escapeIcalText(contactDescription(contact, exact))}`,
    'END:VEVENT',
  ];
}

function formatIcalDate(value: Date): string {
  return value.toISOString().slice(0, 10).replace(/-/g, '');
}

function noticeLines(notice: CalendarNotice, dtstamp: string): string[] {
  const day = notice.day instanceof Date ? new Date(notice.day.getTime()) : new Date(notice.day);
  if (!Number.isFinite(day.getTime())) throw new RangeError(`Invalid notice day: ${String(notice.day)}`);
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const end = new Date(start.getTime() + 86_400_000);
  return [
    'BEGIN:VEVENT',
    `UID:notice-${slug(notice.id)}@zodiacs.org`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${formatIcalDate(start)}`,
    `DTEND;VALUE=DATE:${formatIcalDate(end)}`,
    'TRANSP:TRANSPARENT',
    `SUMMARY:${escapeIcalText(notice.summary)}`,
    `DESCRIPTION:${escapeIcalText(notice.description)}`,
    ...(notice.url ? [`URL:${notice.url}`] : []),
    'END:VEVENT',
  ];
}

/** Truncate an instant to its UTC minute, for a contact that is not exact. */
function truncateToMinute(value: string): string {
  formatIcalUtc(value);
  const time = new Date(value).getTime();
  return new Date(time - (((time % 60_000) + 60_000) % 60_000)).toISOString();
}

/**
 * Serialize one transit calendar. Input order does not affect event order or
 * UIDs; separate retrograde passes remain separate because their instants do.
 * Two contacts that would show the same start and title are one event.
 */
export function serializeTransitContacts(
  contacts: readonly TransitContact[],
  options: TransitCalendarOptions,
): string {
  if (contacts.length === 0) throw new RangeError('A transit calendar requires at least one contact.');
  const dtstamp = formatIcalUtc(options.generatedAt);
  const seen = new Set<string>();
  const prepared = contacts.map((contact) => {
    const exact = options.natalAngles !== 'whole-degree'
      || (contact.natalPoint !== 'ASC' && contact.natalPoint !== 'MC');
    const shown = exact ? contact : { ...contact, exactUtc: truncateToMinute(contact.exactUtc) };
    return { contact: shown, exact, dtstart: formatIcalUtc(shown.exactUtc), uid: transitContactUid(shown) };
  }).sort((a, b) =>
    a.dtstart.localeCompare(b.dtstart)
    || a.contact.transitBody.localeCompare(b.contact.transitBody)
    || a.contact.natalPoint.localeCompare(b.contact.natalPoint)
    || a.contact.aspect.localeCompare(b.contact.aspect)
    || a.contact.exactUtc.localeCompare(b.contact.exactUtc)
    || a.contact.pass - b.contact.pass)
    .filter(({ uid }) => {
      if (seen.has(uid)) return false;
      seen.add(uid);
      return true;
    });

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zodiacs.org//Transit Contacts 1.0//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcalText(options.calendarName ?? 'Zodiacs.org transit contacts')}`,
    ...(options.notice ? noticeLines(options.notice, dtstamp) : []),
    ...prepared.flatMap(({ contact, exact }) => eventLines(contact, dtstamp, exact)),
    'END:VCALENDAR',
  ];

  return lines.map(foldIcalLine).join(CRLF) + CRLF;
}

/**
 * A public sky event for a calendar: a lunation, an eclipse peak, or a
 * retrograde window. Everything here is the same for every reader; no
 * personal data can enter by construction.
 */
export interface SkyCalendarEvent {
  /** Stable identifier fragment, e.g. `full-moon-2027-01-22`. */
  id: string;
  start: Date | string;
  /** Omit for an instant (one minute); provide for a window such as a retrograde. */
  end?: Date | string;
  summary: string;
  description: string;
  /** Canonical page for the event. */
  url?: string;
}

function skyEventLines(event: SkyCalendarEvent, dtstamp: string): string[] {
  const dtstart = formatIcalUtc(event.start);
  return [
    'BEGIN:VEVENT',
    `UID:sky-${slug(event.id)}@zodiacs.org`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    event.end ? `DTEND:${formatIcalUtc(event.end)}` : 'DURATION:PT1M',
    'TRANSP:TRANSPARENT',
    `SUMMARY:${escapeIcalText(event.summary)}`,
    `DESCRIPTION:${escapeIcalText(event.description)}`,
    ...(event.url ? [`URL:${event.url}`] : []),
    'END:VEVENT',
  ];
}

/** Serialize a public sky-event calendar. Input order does not affect output order or UIDs. */
export function serializeSkyEvents(
  events: readonly SkyCalendarEvent[],
  options: TransitCalendarOptions,
): string {
  if (events.length === 0) throw new RangeError('A sky calendar requires at least one event.');
  const dtstamp = formatIcalUtc(options.generatedAt);
  const prepared = events
    .map((event) => ({ event, dtstart: formatIcalUtc(event.start) }))
    .sort((a, b) => a.dtstart.localeCompare(b.dtstart) || a.event.id.localeCompare(b.event.id));

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zodiacs.org//Sky Events 1.0//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcalText(options.calendarName ?? 'Zodiacs.org sky events')}`,
    ...prepared.flatMap(({ event }) => skyEventLines(event, dtstamp)),
    'END:VCALENDAR',
  ];

  return lines.map(foldIcalLine).join(CRLF) + CRLF;
}
