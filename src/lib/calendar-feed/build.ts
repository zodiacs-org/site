/**
 * The subscribed transit calendar, built on the server from a natal chart of
 * planets and whole-degree angles: from 31 days before the refresh to 183
 * days after it. Both kinds of feed address use it, so a stored feed and the
 * positions code it was made from give the same calendar.
 */
import { scanTransitContacts } from '../engine/transit-scan-server.js';
import type { NatalTransitChart } from '../engine/transit-scan-core.js';
import { serializeTransitContacts, type CalendarNotice } from '../ical.js';

const DAY = 86_400_000;
const BACK_DAYS = 31;
const AHEAD_DAYS = 183;

export interface CalendarBuildOptions {
  generatedAt?: Date | string;
  /** Focused windows are exposed for deterministic contract tests only. */
  from?: Date;
  to?: Date;
  /** One all-day event before the contacts (the request to subscribe again). */
  notice?: CalendarNotice;
}

function validDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

/** The angles must already be at the middle of their whole degree. */
export function buildFeedCalendar(
  natal: NatalTransitChart,
  options: CalendarBuildOptions = {},
): string {
  const generatedAt = options.generatedAt == null
    ? new Date()
    : new Date(options.generatedAt);
  if (!validDate(generatedAt)) throw new RangeError('Invalid calendar receipt time.');

  const from = options.from ?? new Date(generatedAt.getTime() - BACK_DAYS * DAY);
  const to = options.to ?? new Date(generatedAt.getTime() + AHEAD_DAYS * DAY);
  if (!validDate(from) || !validDate(to) || from.getTime() > to.getTime()) {
    throw new RangeError('Invalid transit calendar window.');
  }

  const contacts = scanTransitContacts(natal, from, to);
  return serializeTransitContacts(contacts, {
    generatedAt,
    calendarName: 'Zodiacs.org transit contacts',
    natalAngles: 'whole-degree',
    ...(options.notice ? { notice: options.notice } : {}),
  });
}
