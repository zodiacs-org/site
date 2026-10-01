/**
 * Transit calendar feeds addressed by random opaque ids (owner decision of
 * 2026-09-28, §2). What the server and the page share: the routes, and the
 * shapes of a feed id and of the key that removes a feed. Neither carries
 * anything about a chart or a birth.
 */

/** POST creates a feed; `/api/calendar/feeds/<id>` serves it (GET) and removes it (DELETE). */
export const CALENDAR_FEEDS_PATH = '/api/calendar/feeds';

/** 16 random bytes as unpadded base64url; the last character carries two bits. */
export const CALENDAR_FEED_ID_RE = /^[A-Za-z0-9_-]{21}[AQgw]$/u;

/** 32 random bytes as unpadded base64url; the last character carries four bits. */
export const CALENDAR_FEED_SECRET_RE = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;

/** A feed is deleted after this many months without a fetch. */
export const CALENDAR_FEED_RETENTION_MONTHS = 12;

export function calendarFeedPath(id: string): string {
  return `${CALENDAR_FEEDS_PATH}/${id}`;
}

/**
 * The webcal:// form of a feed's https address, which calendar apps open to
 * subscribe. Only an https address of a feed converts.
 */
export function calendarFeedWebcalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const id = parsed.pathname.slice(CALENDAR_FEEDS_PATH.length + 1);
    if (parsed.protocol !== 'https:'
      || parsed.search
      || parsed.hash
      || parsed.pathname !== calendarFeedPath(id)
      || !CALENDAR_FEED_ID_RE.test(id)) return null;
    return `webcal://${parsed.host}${parsed.pathname}`;
  } catch {
    return null;
  }
}
