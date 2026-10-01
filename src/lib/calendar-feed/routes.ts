/**
 * The routes of calendar feeds addressed by opaque ids, served by the one
 * calendar function (api/calendar/transits.ts) through vercel.json rewrites:
 *
 *   POST   /api/calendar/feeds        make a feed from a positions code
 *   GET    /api/calendar/feeds/<id>   the feed itself (text/calendar)
 *   DELETE /api/calendar/feeds/<id>   remove it, with its key as a bearer
 *   POST   /api/calendar/feed-sweep   the scheduled 12-month retention sweep
 *
 * Making and removing a feed count against the Firewall's write limit, and
 * serving one against the read limit (rate-limit.ts); the sweep counts
 * against neither. No request body, key, position or feed id is ever written
 * to a log line; the only thing any URL here carries is the random id.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { dangerouslyDeleteByTag } from '@vercel/functions';
import { requestHeader } from '../email/request.js';
import { bearer, hasExactJsonContentType } from '../invite/request.js';
import type { NatalTransitChart } from '../engine/transit-scan-core.js';
import { readCalendarFeedBody } from './body.js';
import { buildFeedCalendar, type CalendarBuildOptions } from './build.js';
import {
  calendarFeedCacheTag,
  calendarFeedSecretHash,
  createCalendarFeedId,
  createCalendarFeedSecret,
} from './keys.js';
import { isAllowedCalendarFeedWrite } from './origin.js';
import { feedPositionsFromCode, natalChartFromFeed } from './positions.js';
import { calendarFeedWriteRateLimited, transitCalendarRateLimited } from './rate-limit.js';
import { CALENDAR_FEED_ID_RE, calendarFeedPath } from './shared.js';
import {
  calendarFeedSweepSecret,
  canCreateCalendarFeeds,
  createCalendarFeedRecord,
  fetchCalendarFeedRecord,
  hasCalendarFeedStore,
  pruneCalendarFeedRecords,
  revokeCalendarFeedRecord,
} from './store.js';

export { CALENDAR_FEED_BODY_MAX_BYTES } from './body.js';

/**
 * A feed is cached by the CDN for an hour. Removing a feed asks the CDN to
 * clear its cached copies by tag; if that is unavailable or fails, or a fetch
 * already under way caches the feed again, the hour bounds how long a copy is
 * served.
 */
export const CALENDAR_FEED_CACHE_CONTROL = 'public, max-age=0, s-maxage=3600';

/** One sweep request deletes at most SWEEP_BATCH × SWEEP_MAX_BATCHES feeds. */
export const SWEEP_BATCH = 256;
export const SWEEP_MAX_BATCHES = 32;

/** What clearing a removed feed's cached copies came to. */
export type CalendarFeedPurge = 'purged' | 'unavailable';

export interface CalendarFeedDependencies {
  env: Record<string, unknown>;
  fetcher: typeof fetch;
  now: () => Date;
  /** Serving a feed: the read limit, TRANSIT_CALENDAR_RATE_LIMIT_ID. */
  readRateLimited: (req: any) => Promise<boolean>;
  /** Making or removing a feed: the write limit, CALENDAR_FEED_WRITE_RATE_LIMIT_ID. */
  writeRateLimited: (req: any) => Promise<boolean>;
  buildCalendar: (natal: NatalTransitChart, options: CalendarBuildOptions) => string;
  purge: (tag: string) => Promise<CalendarFeedPurge>;
}

const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');

type RequestContextHolder = { get?: () => { purge?: unknown } | undefined };

/**
 * Clears the CDN's copies of one feed. dangerouslyDeleteByTag resolves
 * without doing anything when the request context offers no purge API
 * (@vercel/functions 3.7.5, purge/index.js), so the context is looked up the
 * same way first, and that case is reported instead of passing for success.
 */
export async function purgeCalendarFeedCache(tag: string): Promise<CalendarFeedPurge> {
  const holder = (globalThis as unknown as Record<symbol, RequestContextHolder | undefined>)[REQUEST_CONTEXT];
  if (!holder?.get?.()?.purge) return 'unavailable';
  await dangerouslyDeleteByTag(tag);
  return 'purged';
}

export function calendarFeedDependencies(): CalendarFeedDependencies {
  return {
    env: process.env,
    fetcher: (input, init) => fetch(input, init),
    now: () => new Date(),
    readRateLimited: transitCalendarRateLimited,
    writeRateLimited: calendarFeedWriteRateLimited,
    buildCalendar: buildFeedCalendar,
    purge: purgeCalendarFeedCache,
  };
}

function sendJson(res: any, status: number, body: Record<string, unknown>): void {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.end(JSON.stringify(body));
}

function sendText(res: any, status: number, type: string, body: string, cache: string): void {
  res.statusCode = status;
  res.setHeader('Cache-Control', cache);
  res.setHeader('Content-Type', `${type}; charset=utf-8`);
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.end(body);
}

/**
 * Logs only a fixed failure stage. Network, JSON parser and builder exceptions
 * may contain stored positions, an address, or a capability; never log them.
 */
function logFailure(step: 'creation' | 'read' | 'build' | 'removal' | 'sweep'): void {
  console.error(`Calendar feed ${step} failed.`);
}

/** The positions code of `{"positions": "<code>"}`, and nothing else. */
export function positionsCodeFromBody(body: unknown): string | null {
  let value = body;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'positions') return null;
  const code = (value as { positions: unknown }).positions;
  return typeof code === 'string' ? code : null;
}

function feedIdFromQuery(req: any): string | null {
  const id = req.query?.id;
  return typeof id === 'string' && CALENDAR_FEED_ID_RE.test(id) ? id : null;
}

/** The page's own origin; isAllowedCalendarFeedWrite has checked it is this host. */
function requestOrigin(req: any): string {
  return new URL(requestHeader(req, 'origin') || requestHeader(req, 'referer')).origin;
}

export async function handleCalendarFeedCreate(
  req: any,
  res: any,
  deps: CalendarFeedDependencies = calendarFeedDependencies(),
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'method' });
    return;
  }
  if (!isAllowedCalendarFeedWrite(req, deps.env)) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }
  if (!hasExactJsonContentType(req)) {
    sendJson(res, 415, { error: 'json_required' });
    return;
  }
  const read = await readCalendarFeedBody(req);
  if (read.ok === false && read.status === 413) {
    sendJson(res, 413, { error: 'too_large' });
    return;
  }
  if (await deps.writeRateLimited(req)) {
    res.setHeader('Retry-After', '60');
    sendJson(res, 429, { error: 'rate_limited' });
    return;
  }
  const positions = read.ok ? feedPositionsFromCode(positionsCodeFromBody(read.text)) : null;
  if (!positions) {
    sendJson(res, 400, { error: 'invalid_positions' });
    return;
  }
  // No feed is made unless the daily sweep that deletes it can run.
  if (!canCreateCalendarFeeds(deps.env)) {
    sendJson(res, 503, { error: 'unavailable' });
    return;
  }

  try {
    // Two attempts: a repeated 128-bit id is not expected, but it is refused
    // rather than replacing a feed.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const id = createCalendarFeedId();
      const secret = createCalendarFeedSecret();
      const outcome = await createCalendarFeedRecord(
        id,
        calendarFeedSecretHash(secret)!,
        positions,
        deps.env,
        deps.fetcher,
      );
      if (outcome === 'created') {
        // The key leaves the server here, once; only its digest was stored.
        sendJson(res, 201, { id, url: `${requestOrigin(req)}${calendarFeedPath(id)}`, secret });
        return;
      }
      if (outcome === 'invalid') {
        sendJson(res, 400, { error: 'invalid_positions' });
        return;
      }
      if (outcome === 'busy') {
        console.error('Calendar feed creation refused: 500 feeds were made in the last hour.');
        sendJson(res, 503, { error: 'unavailable' });
        return;
      }
    }
    sendJson(res, 503, { error: 'unavailable' });
  } catch {
    logFailure('creation');
    sendJson(res, 503, { error: 'unavailable' });
  }
}

async function serveCalendarFeed(req: any, res: any, deps: CalendarFeedDependencies): Promise<void> {
  if (await deps.readRateLimited(req)) {
    res.setHeader('Retry-After', '60');
    sendText(res, 429, 'text/plain', 'Rate limited', 'no-store');
    return;
  }
  const id = feedIdFromQuery(req);
  if (!id) {
    sendText(res, 404, 'text/plain', 'There is no calendar at this address.', 'no-store');
    return;
  }
  if (!hasCalendarFeedStore(deps.env)) {
    sendText(res, 503, 'text/plain', 'The calendar is unavailable right now.', 'no-store');
    return;
  }

  let positions;
  try {
    positions = await fetchCalendarFeedRecord(id, deps.env, deps.fetcher);
  } catch {
    logFailure('read');
    sendText(res, 503, 'text/plain', 'The calendar is unavailable right now.', 'no-store');
    return;
  }
  if (!positions) {
    sendText(res, 404, 'text/plain', 'There is no calendar at this address.', 'no-store');
    return;
  }

  try {
    const calendar = deps.buildCalendar(natalChartFromFeed(positions), { generatedAt: deps.now() });
    res.setHeader('Content-Disposition', 'inline; filename="zodiacs-transits.ics"');
    res.setHeader('Vercel-Cache-Tag', calendarFeedCacheTag(id));
    sendText(res, 200, 'text/calendar', calendar, CALENDAR_FEED_CACHE_CONTROL);
  } catch {
    logFailure('build');
    sendText(res, 500, 'text/plain', 'Could not build the transit calendar.', 'no-store');
  }
}

async function removeCalendarFeed(req: any, res: any, deps: CalendarFeedDependencies): Promise<void> {
  if (!isAllowedCalendarFeedWrite(req, deps.env)) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }
  if (await deps.writeRateLimited(req)) {
    res.setHeader('Retry-After', '60');
    sendJson(res, 429, { error: 'rate_limited' });
    return;
  }
  const id = feedIdFromQuery(req);
  const secretHash = calendarFeedSecretHash(bearer(req));
  if (!id || !secretHash) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }
  if (!hasCalendarFeedStore(deps.env)) {
    sendJson(res, 503, { error: 'unavailable' });
    return;
  }

  try {
    const outcome = await revokeCalendarFeedRecord(id, secretHash, deps.env, deps.fetcher);
    if (outcome === 'not_found') {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }
  } catch {
    logFailure('removal');
    sendJson(res, 503, { error: 'unavailable' });
    return;
  }
  let purge: CalendarFeedPurge | 'failed';
  try {
    purge = await deps.purge(calendarFeedCacheTag(id));
  } catch {
    purge = 'failed';
  }
  if (purge !== 'purged') {
    // The record is gone, and a cached copy lasts at most
    // CALENDAR_FEED_CACHE_CONTROL's hour. The line names no feed, and the
    // error is left out because it could carry the cache tag, which holds
    // the id.
    console.error(`Calendar feed cache clearing ${purge === 'unavailable' ? 'unavailable' : 'failed'}: `
      + 'the CDN can serve a removed feed for up to an hour.');
  }
  sendJson(res, 200, { removed: true });
}

export async function handleCalendarFeed(
  req: any,
  res: any,
  deps: CalendarFeedDependencies = calendarFeedDependencies(),
): Promise<void> {
  if (req.method === 'GET') {
    await serveCalendarFeed(req, res, deps);
    return;
  }
  if (req.method === 'DELETE') {
    await removeCalendarFeed(req, res, deps);
    return;
  }
  res.setHeader('Allow', 'GET, DELETE');
  sendText(res, 405, 'text/plain', 'Method not allowed', 'no-store');
}

/**
 * Compares digests of the presented and the expected secret, which have the
 * same length whatever was presented, so the time taken says nothing about
 * the secret's length or its first differing byte.
 */
function sweepSecretMatches(candidate: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(candidate), digest(expected));
}

export async function handleCalendarFeedSweep(
  req: any,
  res: any,
  deps: CalendarFeedDependencies = calendarFeedDependencies(),
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'method' });
    return;
  }
  const expected = calendarFeedSweepSecret(deps.env);
  if (!hasCalendarFeedStore(deps.env)
    || !expected
    || !sweepSecretMatches(bearer(req), expected)) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }
  try {
    let pruned = 0;
    let batches = 0;
    let last = 0;
    while (batches < SWEEP_MAX_BATCHES) {
      last = await pruneCalendarFeedRecords(SWEEP_BATCH, deps.env, deps.fetcher);
      pruned += last;
      batches += 1;
      if (last < SWEEP_BATCH) break;
    }
    // A full last batch means the request stopped at its cap with feeds that
    // may still be due; the workflow calls again while `more` is true.
    sendJson(res, 200, { pruned, batches, more: last === SWEEP_BATCH });
  } catch {
    logFailure('sweep');
    sendJson(res, 503, { error: 'unavailable' });
  }
}
