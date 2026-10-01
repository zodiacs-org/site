// Vercel serverless function for the subscribable transit calendar.
//
// A subscription made today is a stored feed addressed by a random id (owner
// decision of 2026-09-28, §2): vercel.json rewrites /api/calendar/feeds and
// /api/calendar/feeds/<id> here, and src/lib/calendar-feed/routes.ts makes,
// serves and removes those feeds. Their URL carries only the id.
//
// An address made before then carries the positions-only v2 share code in
// its query: body longitudes to 0.001° plus ASC/MC. The code has no name,
// birth date, time, place, or coordinates field, but its positions still
// give the birth date and time. Such addresses keep working for 60 days from
// the release of feed ids, with one event asking the subscriber to subscribe
// again, and then answer 410 Gone (src/lib/calendar-feed/legacy-window.ts).
import { decodePositionsLink, wholeDegreeAngles } from '../../src/lib/share-positions.js';
import { buildFeedCalendar, type CalendarBuildOptions } from '../../src/lib/calendar-feed/build.js';
import {
  LEGACY_FEED_GONE_TEXT,
  LEGACY_FEED_WINDOW_START,
  legacyFeedPhase,
  resubscribeNotice,
} from '../../src/lib/calendar-feed/legacy-window.js';
import { transitCalendarRateLimited } from '../../src/lib/calendar-feed/rate-limit.js';
import {
  handleCalendarFeed,
  handleCalendarFeedCreate,
  handleCalendarFeedSweep,
} from '../../src/lib/calendar-feed/routes.js';

export {
  CALENDAR_FEED_WRITE_RATE_LIMIT_ID,
  TRANSIT_CALENDAR_RATE_LIMIT_ID,
} from '../../src/lib/calendar-feed/rate-limit.js';

/**
 * bodyParser is a Next.js API-route option; Vercel's Node.js runtime ignores
 * it. That runtime parses `req.body` only when code reads it, and no route
 * here does: making a feed reads the raw bytes of the request stream and
 * refuses a body past 512 bytes (src/lib/calendar-feed/body.ts), and every
 * other route reads no body. The option is kept for a runtime that honours it.
 */
export const config = {
  api: { bodyParser: false },
};

/**
 * Build the feed from the same v2 token used by chart share links. ASC and MC
 * are taken to the whole degree whatever the token carries, so a subscription
 * made before the site rounded them stops listing exact angle contacts at its
 * next refresh.
 */
export function buildTransitCalendar(
  token: string,
  options: CalendarBuildOptions = {},
): string {
  const chart = decodePositionsLink(token);
  if (!chart) throw new RangeError('Invalid positions-only chart token.');
  const angles = chart.angles ? wholeDegreeAngles(chart.angles) : null;
  return buildFeedCalendar({ bodies: chart.bodies, angles }, options);
}

function send(res: any, status: number, type: string, body: string, cache: string): void {
  res.statusCode = status;
  res.setHeader('Cache-Control', cache);
  res.setHeader('Content-Type', `${type}; charset=utf-8`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(body);
}

const LEGACY_SHARED_MAX_AGE = 21_600;
const LEGACY_STALE_WHILE_REVALIDATE = 43_200;

/**
 * The shared-cache policy of an older address: six hours, and twelve more
 * while it revalidates, but never past the end of its window, so the cache
 * cannot serve it once it answers 410.
 */
export function legacyFeedCacheControl(now: Date, endsAt: Date | null): string {
  const left = endsAt === null
    ? Number.POSITIVE_INFINITY
    : Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000));
  const maxAge = Math.min(LEGACY_SHARED_MAX_AGE, left);
  const stale = Math.min(LEGACY_STALE_WHILE_REVALIDATE, left - maxAge);
  return `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${stale}`;
}

/** Once the window has closed, an older address is gone for good. */
const LEGACY_GONE_CACHE_CONTROL = 'public, max-age=86400';

type TransitCalendarBuilder = (token: string, options?: CalendarBuildOptions) => string;

export interface LegacyFeedOptions {
  now?: () => Date;
  /** The release day the window opens on; LEGACY_FEED_WINDOW_START unless a test sets it. */
  windowStart?: string | null;
}

export async function handleTransitCalendar(
  req: any,
  res: any,
  buildCalendar: TransitCalendarBuilder = buildTransitCalendar,
  options: LegacyFeedOptions = {},
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    send(res, 405, 'text/plain', 'Method not allowed', 'no-store');
    return;
  }
  if (await transitCalendarRateLimited(req)) {
    res.setHeader('Retry-After', '60');
    send(res, 429, 'text/plain', 'Rate limited', 'no-store');
    return;
  }

  const token = typeof req.query?.token === 'string' ? req.query.token : '';
  if (!token) {
    send(res, 400, 'text/plain', 'A positions-only chart token is required.', 'no-store');
    return;
  }

  const now = options.now?.() ?? new Date();
  const window = legacyFeedPhase(
    now,
    options.windowStart === undefined ? LEGACY_FEED_WINDOW_START : options.windowStart,
  );
  if (window.phase === 'gone') {
    send(res, 410, 'text/plain', LEGACY_FEED_GONE_TEXT, LEGACY_GONE_CACHE_CONTROL);
    return;
  }

  try {
    const calendar = buildCalendar(token, window.phase === 'window'
      ? { generatedAt: now, notice: resubscribeNotice(now, window.endsAt) }
      : { generatedAt: now });
    res.setHeader('Content-Disposition', 'inline; filename="zodiacs-transits.ics"');
    send(
      res,
      200,
      'text/calendar',
      calendar,
      legacyFeedCacheControl(now, window.phase === 'window' ? window.endsAt : null),
    );
  } catch (error) {
    if (error instanceof RangeError && error.message.includes('token')) {
      send(res, 400, 'text/plain', 'Invalid positions-only chart token.', 'no-store');
      return;
    }
    // Exceptions may echo a positions token; the failure stage is sufficient.
    console.error('Transit calendar build failed.');
    send(res, 500, 'text/plain', 'Could not build the transit calendar.', 'no-store');
  }
}

/** vercel.json sets this on the rewrites of the feed routes. */
export const CALENDAR_ROUTE_PARAMETER = '__zodiacs_calendar_route';

export default async function handler(req: any, res: any): Promise<void> {
  const route = req.query?.[CALENDAR_ROUTE_PARAMETER];
  if (route === 'create') return handleCalendarFeedCreate(req, res);
  if (route === 'feed') return handleCalendarFeed(req, res);
  if (route === 'sweep') return handleCalendarFeedSweep(req, res);
  return handleTransitCalendar(req, res);
}
