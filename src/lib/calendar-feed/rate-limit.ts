import { checkRateLimit } from '@vercel/firewall';

/**
 * Vercel Firewall rate-limit IDs; each needs a Firewall rule with the same ID
 * (docs/OWNER-SETUP-RUNBOOK.md §3). Vercel keeps the counters per region and,
 * by default, per client IP address.
 *
 * Reads: an older address (GET /api/calendar/transits) and a feed by its id
 * (GET /api/calendar/feeds/<id>). Calendar services fetch many subscribers'
 * feeds from a few shared addresses, so this counter is sized for them.
 */
export const TRANSIT_CALENDAR_RATE_LIMIT_ID = 'zodiacs-transit-calendar';

/**
 * Writes: making a feed (POST /api/calendar/feeds) and removing one
 * (DELETE /api/calendar/feeds/<id>). A read never counts here, so calendar
 * services cannot use up a person's writes, and this counter is sized so one
 * client cannot use up the database's shared hourly limit on new feeds.
 */
export const CALENDAR_FEED_WRITE_RATE_LIMIT_ID = 'zodiacs-calendar-feed-write';

async function firewallRateLimited(rateLimitId: string, req: any): Promise<boolean> {
  try {
    const result = await checkRateLimit(rateLimitId, { headers: req.headers });
    // An unprovisioned rule never blocks, and neither does a failed check.
    return result?.rateLimited === true && result?.error !== 'not-found';
  } catch {
    return false;
  }
}

/** Whether a calendar read (an older address, or a feed by its id) is over its limit. */
export function transitCalendarRateLimited(req: any): Promise<boolean> {
  return firewallRateLimited(TRANSIT_CALENDAR_RATE_LIMIT_ID, req);
}

/** Whether making or removing a feed is over its limit. */
export function calendarFeedWriteRateLimited(req: any): Promise<boolean> {
  return firewallRateLimited(CALENDAR_FEED_WRITE_RATE_LIMIT_ID, req);
}
