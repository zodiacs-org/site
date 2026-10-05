// Vercel serverless function for a durable, subscribable transit calendar.
// The query carries the positions-only v2 share token: body longitudes to
// 0.001° plus ASC/MC. The token has no name, birth date, time, place, or
// coordinates field, but the positions still give the birth date and time.
import { checkRateLimit } from '@vercel/firewall';
import { scanTransitContacts } from '../../src/lib/engine/transit-scan-server.js';
import { serializeTransitContacts } from '../../src/lib/ical.js';
import { decodePositionsLink, wholeDegreeAngles } from '../../src/lib/share-positions.js';

const DAY = 86_400_000;
const BACK_DAYS = 31;
const AHEAD_DAYS = 183;

interface CalendarBuildOptions {
  generatedAt?: Date | string;
  /** Focused windows are exposed for deterministic contract tests only. */
  from?: Date;
  to?: Date;
}

function validDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

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

  const generatedAt = options.generatedAt == null
    ? new Date()
    : new Date(options.generatedAt);
  if (!validDate(generatedAt)) throw new RangeError('Invalid calendar receipt time.');

  const from = options.from ?? new Date(generatedAt.getTime() - BACK_DAYS * DAY);
  const to = options.to ?? new Date(generatedAt.getTime() + AHEAD_DAYS * DAY);
  if (!validDate(from) || !validDate(to) || from.getTime() > to.getTime()) {
    throw new RangeError('Invalid transit calendar window.');
  }

  const contacts = scanTransitContacts(
    { bodies: chart.bodies, angles },
    from,
    to,
  );
  return serializeTransitContacts(contacts, {
    generatedAt,
    calendarName: 'Zodiacs.org transit contacts',
    natalAngles: 'whole-degree',
  });
}

function send(res: any, status: number, type: string, body: string, cache: string): void {
  res.statusCode = status;
  res.setHeader('Cache-Control', cache);
  res.setHeader('Content-Type', `${type}; charset=utf-8`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(body);
}

type TransitCalendarBuilder = (token: string) => string;

/** Uses Vercel's per-region firewall counters; the matching WAF rule must use this exported ID. */
export const TRANSIT_CALENDAR_RATE_LIMIT_ID = 'zodiacs-transit-calendar';

async function transitCalendarRateLimited(req: any): Promise<boolean> {
  try {
    const result = await checkRateLimit(TRANSIT_CALENDAR_RATE_LIMIT_ID, { headers: req.headers });
    // CDN caching absorbs repeat tokens; the counter bounds an attacker
    // minting unlimited distinct tokens. An unprovisioned rule never blocks.
    return result?.rateLimited === true && result?.error !== 'not-found';
  } catch {
    return false;
  }
}

export async function handleTransitCalendar(
  req: any,
  res: any,
  buildCalendar: TransitCalendarBuilder = buildTransitCalendar,
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

  try {
    const calendar = buildCalendar(token);
    res.setHeader('Content-Disposition', 'inline; filename="zodiacs-transits.ics"');
    send(
      res,
      200,
      'text/calendar',
      calendar,
      'public, max-age=0, s-maxage=21600, stale-while-revalidate=43200',
    );
  } catch (error) {
    if (error instanceof RangeError && error.message.includes('token')) {
      send(res, 400, 'text/plain', 'Invalid positions-only chart token.', 'no-store');
      return;
    }
    console.error(error);
    send(res, 500, 'text/plain', 'Could not build the transit calendar.', 'no-store');
  }
}

export default async function handler(req: any, res: any): Promise<void> {
  // Retired: a positions token still contains personal birth information.
  // The Transits UI offers a browser-built .ics download instead.
  send(res, 410, 'text/plain', 'Personal calendar feeds are retired.', 'no-store');
}
