/**
 * Calendar addresses made before opaque feed ids carry a positions code in
 * their query string. The owner's decision of 2026-09-28 (§2) keeps them
 * working for 60 days from the release of opaque ids. During those days
 * their calendar carries one extra event asking the subscriber to subscribe
 * again; after them the address answers 410 Gone.
 *
 * SET IN THE RELEASE COMMIT, here and nowhere else: the UTC day
 * ('YYYY-MM-DD') on which the release that brings opaque feed ids reaches
 * production. While it is null, older addresses are served as they always
 * were, without the event, and do not expire, so the privacy pages' sentences
 * on the 60 days are untrue; legacy-window-copy.test.ts fails until it is set.
 */
import type { CalendarNotice } from '../ical.js';

export const LEGACY_FEED_WINDOW_START: string | null = '2026-10-01';

export const LEGACY_FEED_WINDOW_DAYS = 60;

const DAY = 86_400_000;
const UTC_DAY = /^(\d{4})-(\d{2})-(\d{2})$/u;

export type LegacyFeedPhase =
  | { phase: 'open' }
  | { phase: 'window'; endsAt: Date }
  | { phase: 'gone'; endedAt: Date };

/** The instant the window opens: 00:00 UTC on the given day. */
export function legacyFeedWindowOpens(start: string): Date {
  const match = UTC_DAY.exec(start);
  const opens = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!opens || !Number.isFinite(opens.getTime()) || opens.toISOString().slice(0, 10) !== start) {
    throw new RangeError('The older-address window must start on a UTC day written YYYY-MM-DD.');
  }
  return opens;
}

/** The first instant at which an older address answers 410: 60 days after the window opens. */
export function legacyFeedWindowEnd(start: string | null = LEGACY_FEED_WINDOW_START): Date | null {
  if (start === null) return null;
  return new Date(legacyFeedWindowOpens(start).getTime() + LEGACY_FEED_WINDOW_DAYS * DAY);
}

export function legacyFeedPhase(
  now: Date,
  start: string | null = LEGACY_FEED_WINDOW_START,
): LegacyFeedPhase {
  if (start === null) return { phase: 'open' };
  const opens = legacyFeedWindowOpens(start);
  const ends = new Date(opens.getTime() + LEGACY_FEED_WINDOW_DAYS * DAY);
  if (now.getTime() < opens.getTime()) return { phase: 'open' };
  if (now.getTime() < ends.getTime()) return { phase: 'window', endsAt: ends };
  return { phase: 'gone', endedAt: ends };
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function utcDayLabel(value: Date): string {
  return `${value.getUTCDate()} ${MONTHS[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
}

/**
 * Where to subscribe again. The birth chart page offers a calendar for every
 * chart (ChartCalculator, full mode); the Transits page only for a chart
 * with a birth time (TransitTracker sets no calendar without one).
 */
export const RESUBSCRIBE_URL = 'https://zodiacs.org/birth-chart/';
export const RESUBSCRIBE_TIMED_URL = 'https://zodiacs.org/transits/';

const WHERE_TO_SUBSCRIBE = `on the birth chart page, ${RESUBSCRIBE_URL}, or, if your chart has a birth time, on the Transits page, ${RESUBSCRIBE_TIMED_URL}`;

/**
 * The one extra event: an all-day event on the day of the refresh, so it
 * sits where the subscriber is looking. Its identifier is the end date, so
 * a refresh moves the same event rather than adding another.
 */
export function resubscribeNotice(generatedAt: Date, endsAt: Date): CalendarNotice {
  return {
    id: `resubscribe-${endsAt.toISOString().slice(0, 10)}`,
    day: generatedAt,
    summary: 'Subscribe to your Zodiacs.org transit calendar again',
    description: `This calendar's address carries your chart's positions, so it stops working at the start of ${utcDayLabel(endsAt)}, UTC. The site now gives each calendar a random address that carries nothing else. To keep these dates, add the calendar again ${WHERE_TO_SUBSCRIBE}, then remove this one.`,
    url: RESUBSCRIBE_URL,
  };
}

/** The body of the 410 an older address answers once the window has closed. */
export const LEGACY_FEED_GONE_TEXT = `This calendar address no longer works. It carried your chart's positions, so the site replaced it with addresses that carry only a random id. To keep your transit dates, subscribe again ${WHERE_TO_SUBSCRIBE}.`;
