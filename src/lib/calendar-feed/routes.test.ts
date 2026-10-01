import { createHash } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { CALENDAR_ROUTE_PARAMETER, config } from '../../../api/calendar/transits';
import { calendarToken } from '../../islands/CalendarSubscribe';
import { POSITION_BODY_ORDER } from '../share-positions';
import type { NatalTransitChart } from '../engine/transit-scan-core';
import { calendarFeedCacheTag, calendarFeedSecretHash, createCalendarFeedId, createCalendarFeedSecret } from './keys';
import {
  CALENDAR_FEED_BODY_MAX_BYTES,
  CALENDAR_FEED_CACHE_CONTROL,
  handleCalendarFeed,
  handleCalendarFeedCreate,
  handleCalendarFeedSweep,
  positionsCodeFromBody,
  purgeCalendarFeedCache,
  SWEEP_BATCH,
  SWEEP_MAX_BATCHES,
  type CalendarFeedDependencies,
} from './routes';
import { calendarFeedWriteOrigins, isAllowedCalendarFeedWrite } from './origin';
import { readCalendarFeedBody } from './body';
import { CALENDAR_FEED_ID_RE, CALENDAR_FEED_SECRET_RE, calendarFeedWebcalUrl } from './shared';

// Synthetic positions: no real birth.
const LONGITUDES = POSITION_BODY_ORDER.map((_, index) => Number(((index * 31.417) % 360).toFixed(3)));
const CODE = calendarToken({
  bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: LONGITUDES[index] })),
  angles: { asc: 12.34, mc: 281.9 },
  houseSystem: 'placidus',
  engineVersion: '1.0.0',
})!;
const FEED_ID = 'Zq3xPq0Jr9Vb_Tm2-Ka5sA';
const SECRET = `${'k'.repeat(42)}A`;
const SWEEP = 's'.repeat(40);
const ENV = {
  PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
  CALENDAR_FEED_SWEEP_SECRET: SWEEP,
  VERCEL_ENV: 'production',
};
const BROWSER = {
  origin: 'https://zodiacs.org',
  host: 'zodiacs.org',
  'content-type': 'application/json',
};
/** The raw body a browser sends: the route counts these bytes, not a parsed value. */
const BODY = JSON.stringify({ positions: CODE });

interface RpcCall { name: string; body: Record<string, unknown>; headers: Record<string, string> }

function supabase(reply: (name: string, body: Record<string, unknown>) => { status?: number; json: unknown }) {
  const calls: RpcCall[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const name = url.replace('https://project.supabase.co/rest/v1/rpc/', '');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ name, body, headers: init?.headers as Record<string, string> });
    const { status = 200, json } = reply(name, body);
    return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
  });
  return { calls, fetcher: fetcher as unknown as typeof fetch };
}

function deps(overrides: Partial<CalendarFeedDependencies> = {}): CalendarFeedDependencies & { built: NatalTransitChart[]; purged: string[] } {
  const built: NatalTransitChart[] = [];
  const purged: string[] = [];
  return {
    env: ENV,
    fetcher: (() => { throw new Error('no network in this test'); }) as unknown as typeof fetch,
    now: () => new Date('2026-10-10T08:00:00Z'),
    readRateLimited: async () => false,
    writeRateLimited: async () => false,
    buildCalendar: (natal) => {
      built.push(natal);
      return 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n';
    },
    purge: async (tag) => { purged.push(tag); return 'purged'; },
    ...overrides,
    built,
    purged,
  };
}

function recorder() {
  return {
    statusCode: 0,
    body: '',
    headers: new Map<string, string>(),
    setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); },
    end(body = '') { this.body = body; },
    json() { return JSON.parse(this.body) as Record<string, unknown>; },
  };
}

/** Every console.error line a test causes. */
function errorLines(): string[] {
  const lines: string[] = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => { lines.push(args.map(String).join(' ')); });
  return lines;
}

/** Stored positions distinctive enough that finding one in a log line means it leaked. */
const LOGGED_POSITIONS = LONGITUDES.slice(1, 10).map(String);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('calendar failures keep arbitrary exception text out of logs', () => {
  const marker = 'SYNTHETIC_PRIVATE_CALENDAR_PAYLOAD';
  const requests = [
    ['creation', handleCalendarFeedCreate, { method: 'POST', headers: BROWSER, body: BODY }],
    ['read', handleCalendarFeed, { method: 'GET', query: { id: FEED_ID }, headers: {} }],
    ['removal', handleCalendarFeed, { method: 'DELETE', query: { id: FEED_ID }, headers: { ...BROWSER, authorization: `Bearer ${SECRET}` } }],
    ['sweep', handleCalendarFeedSweep, { method: 'POST', headers: { authorization: `Bearer ${SWEEP}` } }],
  ] as const;

  it.each(requests)('%s hides network and JSON parser errors', async (step, handle, request) => {
    const errors = errorLines();
    for (const fetcher of [
      async () => { throw new Error(`${marker} ${FEED_ID} ${CODE} ${SECRET} ${SWEEP}`); },
      async () => new Response(`${marker} ${FEED_ID} ${CODE}`, { status: 200 }),
    ]) {
      const res = recorder();
      await handle(request, res, deps({ fetcher: fetcher as typeof fetch }));
      expect(res.statusCode).toBe(503);
      expect(res.body).not.toContain(marker);
    }
    expect(errors).toEqual([`Calendar feed ${step} failed.`, `Calendar feed ${step} failed.`]);
  });

  it('hides a builder exception containing the private positions', async () => {
    const errors = errorLines();
    const { fetcher } = supabase(() => ({
      json: { outcome: 'ready', planets: LONGITUDES.slice(0, 10), ascendant: 12, midheaven: 281 },
    }));
    const res = recorder();
    await handleCalendarFeed(requests[1][2], res, deps({
      fetcher,
      buildCalendar: () => { throw new Error(`${marker} ${FEED_ID} ${LONGITUDES.join(',')}`); },
    }));
    expect(res.statusCode).toBe(500);
    expect(errors).toEqual(['Calendar feed build failed.']);
    expect(res.body).not.toContain(marker);
  });
});

describe('making a calendar feed', () => {
  it('stores only the planets and whole-degree angles and returns the id, its address and the key once', async () => {
    const { calls, fetcher } = supabase((_name, body) => ({ json: { outcome: 'created', id: body.candidate_id, created_at: '2026-10-10T08:00:00Z' } }));
    const res = recorder();
    await handleCalendarFeedCreate(
      { method: 'POST', headers: { ...BROWSER, 'content-length': String(Buffer.byteLength(BODY)) }, body: BODY },
      res,
      deps({ fetcher }),
    );

    expect(res.statusCode).toBe(201);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const reply = res.json();
    expect(Object.keys(reply).sort()).toEqual(['id', 'secret', 'url']);
    expect(reply.id).toMatch(CALENDAR_FEED_ID_RE);
    expect(reply.secret).toMatch(CALENDAR_FEED_SECRET_RE);
    expect(reply.url).toBe(`https://zodiacs.org/api/calendar/feeds/${reply.id}`);
    expect(calendarFeedWebcalUrl(String(reply.url))).toBe(`webcal://zodiacs.org/api/calendar/feeds/${reply.id}`);

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('create_calendar_feed');
    expect(calls[0].headers.Authorization).toBe('Bearer service-role-test-key');
    expect(calls[0].body).toEqual({
      candidate_id: reply.id,
      candidate_secret_hash: createHash('sha256').update(String(reply.secret)).digest('hex'),
      candidate_planets: LONGITUDES.slice(0, 10),
      candidate_ascendant: 12,
      candidate_midheaven: 281,
    });
    // The key itself never reaches the database.
    expect(JSON.stringify(calls[0].body)).not.toContain(String(reply.secret));
  });

  it('makes a feed without angles for a chart without a birth time', async () => {
    const untimed = calendarToken({
      bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: LONGITUDES[index] })),
      angles: null,
      houseSystem: 'whole',
      engineVersion: '1.0.0',
    })!;
    const { calls, fetcher } = supabase((_name, body) => ({ json: { outcome: 'created', id: body.candidate_id } }));
    const res = recorder();
    await handleCalendarFeedCreate({ method: 'POST', headers: BROWSER, body: JSON.stringify({ positions: untimed }) }, res, deps({ fetcher }));
    expect(res.statusCode).toBe(201);
    expect(calls[0].body.candidate_ascendant).toBeNull();
    expect(calls[0].body.candidate_midheaven).toBeNull();
  });

  it('refuses other methods, other origins, other content types, large bodies and anything but one positions code', async () => {
    const cases: [Record<string, unknown>, number, string][] = [
      [{ method: 'GET', headers: BROWSER, body: BODY }, 405, 'method'],
      [{ method: 'POST', headers: { ...BROWSER, origin: 'https://example.com' }, body: BODY }, 403, 'forbidden'],
      [{ method: 'POST', headers: { host: 'zodiacs.org', 'content-type': 'application/json' }, body: BODY }, 403, 'forbidden'],
      [{ method: 'POST', headers: { ...BROWSER, 'content-type': 'text/plain' }, body: BODY }, 415, 'json_required'],
      [{ method: 'POST', headers: { ...BROWSER, 'content-length': String(CALENDAR_FEED_BODY_MAX_BYTES + 1) }, body: BODY }, 413, 'too_large'],
      [{ method: 'POST', headers: BROWSER, body: JSON.stringify({ positions: CODE, padding: 'x'.repeat(CALENDAR_FEED_BODY_MAX_BYTES) }) }, 413, 'too_large'],
      // Whitespace a parser would drop still counts: these are the bytes sent.
      [{ method: 'POST', headers: BROWSER, body: `${BODY}${' '.repeat(CALENDAR_FEED_BODY_MAX_BYTES)}` }, 413, 'too_large'],
      [{ method: 'POST', headers: BROWSER, body: JSON.stringify({ positions: CODE, name: 'Someone' }) }, 400, 'invalid_positions'],
      [{ method: 'POST', headers: BROWSER, body: JSON.stringify({ positions: '2.invalid' }) }, 400, 'invalid_positions'],
      [{ method: 'POST', headers: BROWSER, body: JSON.stringify({ date: '1990-01-01', time: '12:00' }) }, 400, 'invalid_positions'],
      [{ method: 'POST', headers: BROWSER, body: '{not json' }, 400, 'invalid_positions'],
      [{ method: 'POST', headers: BROWSER, body: JSON.stringify([CODE]) }, 400, 'invalid_positions'],
      // A value some parser already made is never trusted: its raw size is unknown.
      [{ method: 'POST', headers: BROWSER, body: { positions: CODE } }, 400, 'invalid_positions'],
      [{ method: 'POST', headers: BROWSER, get body() { throw new SyntaxError('Invalid JSON'); } }, 400, 'invalid_positions'],
    ];
    for (const [req, status, error] of cases) {
      const res = recorder();
      const fetcher = vi.fn();
      await handleCalendarFeedCreate(req, res, deps({ fetcher: fetcher as unknown as typeof fetch }));
      expect([res.statusCode, res.json().error]).toEqual([status, error]);
      expect(fetcher).not.toHaveBeenCalled();
    }
  });

  it('counts the bytes of a chunked body as they arrive, without a declared length', async () => {
    const stream = (chunks: string[], headers: Record<string, string> = BROWSER) => Object.assign(
      Readable.from(chunks.map((chunk) => Buffer.from(chunk, 'utf8'))),
      { method: 'POST', headers },
    );
    const half = Math.ceil(BODY.length / 2);
    const made = supabase((_name, body) => ({ json: { outcome: 'created', id: body.candidate_id } }));
    const ok = recorder();
    await handleCalendarFeedCreate(stream([BODY.slice(0, half), BODY.slice(half)]), ok, deps({ fetcher: made.fetcher }));
    expect(ok.statusCode).toBe(201);
    expect(made.calls).toHaveLength(1);

    for (const chunks of [
      [BODY, ' '.repeat(CALENDAR_FEED_BODY_MAX_BYTES)],
      Array.from({ length: 5 }, () => 'x'.repeat(120)),
    ]) {
      const fetcher = vi.fn();
      const res = recorder();
      await handleCalendarFeedCreate(stream(chunks), res, deps({ fetcher: fetcher as unknown as typeof fetch }));
      expect([res.statusCode, res.json().error]).toEqual([413, 'too_large']);
      expect(fetcher).not.toHaveBeenCalled();
    }
  });

  it('counts the raw bytes of the request stream and never reads req.body, which Vercel parses only when read', async () => {
    let parsed = 0;
    const request = (body: string) => {
      const stream = Object.assign(Readable.from([Buffer.from(body, 'utf8')]), { method: 'POST', headers: BROWSER });
      Object.defineProperty(stream, 'body', {
        get() {
          parsed += 1;
          return JSON.parse(body) as unknown;
        },
      });
      return stream;
    };
    const made = supabase((_name, body) => ({ json: { outcome: 'created', id: body.candidate_id } }));
    const ok = recorder();
    await handleCalendarFeedCreate(request(BODY), ok, deps({ fetcher: made.fetcher }));
    expect(ok.statusCode).toBe(201);
    // Whitespace a parser would drop still counts against the limit.
    const fetcher = vi.fn();
    const large = recorder();
    await handleCalendarFeedCreate(request(`${BODY}${' '.repeat(CALENDAR_FEED_BODY_MAX_BYTES)}`), large,
      deps({ fetcher: fetcher as unknown as typeof fetch }));
    expect([large.statusCode, large.json().error]).toEqual([413, 'too_large']);
    expect(fetcher).not.toHaveBeenCalled();
    expect(parsed).toBe(0);
  });

  it('reads a body Vercel replays after the request ended, and fails closed on one already consumed', async () => {
    // Vercel's restoreBody replays the buffered bytes to data/end listeners
    // attached after the request itself has ended.
    const replayed = new PassThrough();
    const headers = { ...BROWSER };
    Object.assign(replayed, { headers, complete: true });
    const replay = replayed.on.bind(replayed);
    let scheduled = false;
    Object.assign(replayed, {
      on(event: string, listener: (...args: unknown[]) => void) {
        replay(event, listener);
        if (event === 'data' && !scheduled) {
          scheduled = true;
          queueMicrotask(() => replayed.end(Buffer.from(BODY, 'utf8')));
        }
        return replayed;
      },
    });
    expect(await readCalendarFeedBody(replayed)).toEqual({ ok: true, text: BODY });

    const consumed = new PassThrough();
    consumed.end();
    consumed.resume();
    await new Promise((resolve) => consumed.once('end', resolve));
    expect(await readCalendarFeedBody(Object.assign(consumed, { headers }))).toEqual({ ok: false, status: 400 });
  });

  it('is rate limited with the write counter, and unavailable without the store', async () => {
    const limited = recorder();
    await handleCalendarFeedCreate({ method: 'POST', headers: BROWSER, body: BODY }, limited,
      deps({ writeRateLimited: async () => true }));
    expect(limited.statusCode).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');

    const unconfigured = recorder();
    await handleCalendarFeedCreate({ method: 'POST', headers: BROWSER, body: BODY }, unconfigured,
      deps({ env: { VERCEL_ENV: 'production' } }));
    expect(unconfigured.statusCode).toBe(503);
  });

  it('makes no feed unless the sweep that deletes feeds after 12 months is configured too', async () => {
    const { PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERCEL_ENV } = ENV;
    const store = { PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERCEL_ENV };
    for (const env of [
      store,
      { ...store, CALENDAR_FEED_SWEEP_SECRET: '' },
      { ...store, CALENDAR_FEED_SWEEP_SECRET: 's'.repeat(31) },
      { ...store, CALENDAR_FEED_SWEEP_SECRET: `  ${'s'.repeat(31)}  ` },
      { CALENDAR_FEED_SWEEP_SECRET: SWEEP, VERCEL_ENV },
    ]) {
      const fetcher = vi.fn();
      const res = recorder();
      await handleCalendarFeedCreate({ method: 'POST', headers: BROWSER, body: BODY }, res,
        deps({ env, fetcher: fetcher as unknown as typeof fetch }));
      expect([res.statusCode, res.json()]).toEqual([503, { error: 'unavailable' }]);
      expect(fetcher).not.toHaveBeenCalled();
    }

    const { fetcher } = supabase((_name, body) => ({ json: { outcome: 'created', id: body.candidate_id } }));
    const res = recorder();
    await handleCalendarFeedCreate({ method: 'POST', headers: BROWSER, body: BODY }, res,
      deps({ env: { ...store, CALENDAR_FEED_SWEEP_SECRET: 's'.repeat(32) }, fetcher }));
    expect(res.statusCode).toBe(201);
  });

  it('answers 503, and says only that in its log, when 500 feeds were made in the last hour', async () => {
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args.map(String).join(' ')); });
    const { calls, fetcher } = supabase(() => ({ json: { outcome: 'busy' } }));
    const res = recorder();
    await handleCalendarFeedCreate({ method: 'POST', headers: BROWSER, body: BODY }, res, deps({ fetcher }));
    expect([res.statusCode, res.json()]).toEqual([503, { error: 'unavailable' }]);
    expect(calls).toHaveLength(1);
    expect(errors).toEqual(['Calendar feed creation refused: 500 feeds were made in the last hour.']);
  });

  it('tries a second id if the first is taken, and never replaces a feed', async () => {
    const outcomes = ['id_conflict', 'created'];
    const { calls, fetcher } = supabase((_name, body) => ({ json: { outcome: outcomes.shift(), id: body.candidate_id } }));
    const res = recorder();
    await handleCalendarFeedCreate({ method: 'POST', headers: BROWSER, body: BODY }, res, deps({ fetcher }));
    expect(res.statusCode).toBe(201);
    expect(calls).toHaveLength(2);
    expect(calls[0].body.candidate_id).not.toBe(calls[1].body.candidate_id);
    expect(res.json().id).toBe(calls[1].body.candidate_id);
  });

  it('logs a failure without the request, the positions or the key', async () => {
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args.map(String).join(' ')); });
    const { fetcher } = supabase(() => ({ status: 500, json: { message: 'boom' } }));
    const res = recorder();
    await handleCalendarFeedCreate({ method: 'POST', headers: BROWSER, body: BODY }, res, deps({ fetcher }));
    expect(res.statusCode).toBe(503);
    expect(errors).toEqual(['Calendar feed creation failed.']);
    for (const line of errors) {
      expect(line).not.toContain(CODE);
      expect(line).not.toContain(String(LONGITUDES[1]));
    }
  });
});

describe('serving a calendar feed by its id', () => {
  it('notes the fetch, builds from the stored positions and lets the CDN keep it for an hour under the feed tag', async () => {
    const { calls, fetcher } = supabase(() => ({
      json: { outcome: 'ready', planets: LONGITUDES.slice(0, 10), ascendant: 12, midheaven: 281 },
    }));
    const d = deps({ fetcher });
    const res = recorder();
    await handleCalendarFeed({ method: 'GET', query: { id: FEED_ID }, headers: {} }, res, d);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
    expect(res.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe(CALENDAR_FEED_CACHE_CONTROL);
    expect(CALENDAR_FEED_CACHE_CONTROL).toBe('public, max-age=0, s-maxage=3600');
    expect(res.headers.get('vercel-cache-tag')).toBe(`calendar-feed-${FEED_ID}`);
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive');
    expect(calls).toEqual([expect.objectContaining({ name: 'fetch_calendar_feed', body: { candidate_id: FEED_ID } })]);
    expect(d.built).toEqual([{
      bodies: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
        .map((body, index) => ({ body, lon: LONGITUDES[index] })),
      angles: { asc: 12.5, mc: 281.5 },
    }]);
  });

  it('answers 404 for an unknown or removed id and for anything that is not an id', async () => {
    const { calls, fetcher } = supabase(() => ({ json: { outcome: 'not_found' } }));
    for (const id of [FEED_ID, 'short', `${FEED_ID}x`, 'Zq3xPq0Jr9Vb_Tm2-Ka5sB', undefined, [FEED_ID]]) {
      const res = recorder();
      await handleCalendarFeed({ method: 'GET', query: { id }, headers: {} }, res, deps({ fetcher }));
      expect(res.statusCode).toBe(404);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.body).toBe('There is no calendar at this address.');
    }
    expect(calls).toHaveLength(1);
  });

  it('refuses other methods and is rate limited', async () => {
    const put = recorder();
    await handleCalendarFeed({ method: 'PUT', query: { id: FEED_ID }, headers: {} }, put, deps());
    expect(put.statusCode).toBe(405);
    expect(put.headers.get('allow')).toBe('GET, DELETE');
    const limited = recorder();
    await handleCalendarFeed({ method: 'GET', query: { id: FEED_ID }, headers: {} }, limited, deps({ readRateLimited: async () => true }));
    expect(limited.statusCode).toBe(429);
  });

  it('fails closed when the store answers something unexpected', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetcher } = supabase(() => ({ json: { outcome: 'ready', planets: [1, 2, 3], ascendant: null, midheaven: null } }));
    const res = recorder();
    await handleCalendarFeed({ method: 'GET', query: { id: FEED_ID }, headers: {} }, res, deps({ fetcher }));
    expect(res.statusCode).toBe(503);
  });

  it('logs a failed read without the feed id or any position the store sent', async () => {
    const errors = errorLines();
    for (const reply of [
      { status: 500, json: { message: `nothing for ${FEED_ID}` } },
      // A row the feed cannot use: its positions must not reach the log either.
      { json: { outcome: 'ready', planets: LONGITUDES.slice(0, 9), ascendant: 12, midheaven: 281 } },
    ]) {
      const { fetcher } = supabase(() => reply);
      const res = recorder();
      await handleCalendarFeed({ method: 'GET', query: { id: FEED_ID }, headers: {} }, res, deps({ fetcher }));
      expect([res.statusCode, res.body]).toEqual([503, 'The calendar is unavailable right now.']);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
    expect(errors).toEqual([
      'Calendar feed read failed.',
      'Calendar feed read failed.',
    ]);
    for (const line of errors) {
      expect(line).not.toContain(FEED_ID);
      for (const position of LOGGED_POSITIONS) expect(line).not.toContain(position);
    }
  });

  it('logs a failed build without the feed id or its positions, and lets nothing cache the failure', async () => {
    const errors = errorLines();
    const { fetcher } = supabase(() => ({
      json: { outcome: 'ready', planets: LONGITUDES.slice(0, 10), ascendant: 12, midheaven: 281 },
    }));
    const res = recorder();
    await handleCalendarFeed({ method: 'GET', query: { id: FEED_ID }, headers: {} }, res, deps({
      fetcher,
      buildCalendar: () => { throw new RangeError('Transit longitudes must be finite.'); },
    }));
    expect([res.statusCode, res.body]).toEqual([500, 'Could not build the transit calendar.']);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.has('vercel-cache-tag')).toBe(false);
    expect(errors).toEqual(['Calendar feed build failed.']);
    for (const line of errors) {
      expect(line).not.toContain(FEED_ID);
      for (const position of LOGGED_POSITIONS) expect(line).not.toContain(position);
    }
  });
});

describe('removing a calendar feed', () => {
  const removal = (headers: Record<string, string>) => ({
    method: 'DELETE',
    query: { id: FEED_ID },
    headers: { origin: 'https://zodiacs.org', host: 'zodiacs.org', ...headers },
  });

  it('removes the feed with its key, sending only the key digest, and clears the cached copies', async () => {
    const errors = vi.spyOn(console, 'error');
    const { calls, fetcher } = supabase(() => ({ json: { outcome: 'revoked' } }));
    const d = deps({ fetcher });
    const res = recorder();
    await handleCalendarFeed(removal({ authorization: `Bearer ${SECRET}` }), res, d);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ removed: true });
    expect(calls).toEqual([expect.objectContaining({
      name: 'revoke_calendar_feed',
      body: { candidate_id: FEED_ID, candidate_secret_hash: calendarFeedSecretHash(SECRET) },
    })]);
    expect(JSON.stringify(calls)).not.toContain(SECRET);
    expect(d.purged).toEqual([calendarFeedCacheTag(FEED_ID)]);
    expect(errors).not.toHaveBeenCalled();
  });

  it('answers 404, and clears nothing, for a wrong key, a missing key or an unknown id', async () => {
    const { calls, fetcher } = supabase(() => ({ json: { outcome: 'not_found' } }));
    const d = deps({ fetcher });
    const attempts: Record<string, string>[] = [
      { authorization: `Bearer ${'x'.repeat(42)}A` },
      {},
      { authorization: 'Bearer short' },
      { authorization: SECRET },
    ];
    for (const headers of attempts) {
      const res = recorder();
      await handleCalendarFeed(removal(headers), res, d);
      expect(res.statusCode).toBe(404);
    }
    expect(calls).toHaveLength(1);
    expect(d.purged).toEqual([]);
  });

  it('accepts a removal only from the site itself', async () => {
    const res = recorder();
    const fetcher = vi.fn();
    await handleCalendarFeed(removal({ origin: 'https://example.com', authorization: `Bearer ${SECRET}` }), res,
      deps({ fetcher: fetcher as unknown as typeof fetch }));
    expect(res.statusCode).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('logs a failed removal without the feed id or its key, and clears nothing', async () => {
    const errors = errorLines();
    const d = deps();
    for (const reply of [
      { status: 500, json: { message: `nothing for ${FEED_ID}` } },
      { json: { outcome: 'removed', id: FEED_ID } },
    ]) {
      const { fetcher } = supabase(() => reply);
      const res = recorder();
      await handleCalendarFeed(removal({ authorization: `Bearer ${SECRET}` }), res, { ...d, fetcher });
      expect([res.statusCode, res.json()]).toEqual([503, { error: 'unavailable' }]);
    }
    expect(d.purged).toEqual([]);
    expect(errors).toEqual([
      'Calendar feed removal failed.',
      'Calendar feed removal failed.',
    ]);
    for (const line of errors) {
      expect(line).not.toContain(FEED_ID);
      expect(line).not.toContain(SECRET);
      expect(line).not.toContain(String(calendarFeedSecretHash(SECRET)));
    }
  });

  it('still reports the removal when clearing the cache fails or is unavailable, and logs that without the feed', async () => {
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args.map(String).join(' ')); });
    const { fetcher } = supabase(() => ({ json: { outcome: 'revoked' } }));
    for (const purge of [
      async (): Promise<never> => { throw new Error(`purge failed for ${calendarFeedCacheTag(FEED_ID)}`); },
      async () => 'unavailable' as const,
    ]) {
      const res = recorder();
      await handleCalendarFeed(removal({ authorization: `Bearer ${SECRET}` }), res, deps({ fetcher, purge }));
      expect([res.statusCode, res.json()]).toEqual([200, { removed: true }]);
    }
    expect(errors).toEqual([
      'Calendar feed cache clearing failed: the CDN can serve a removed feed for up to an hour.',
      'Calendar feed cache clearing unavailable: the CDN can serve a removed feed for up to an hour.',
    ]);
    for (const line of errors) {
      expect(line).not.toContain(FEED_ID);
      expect(line).not.toContain(SECRET);
    }
  });

  it('tells a purge that did nothing from one that cleared the tag', async () => {
    const context = Symbol.for('@vercel/request-context');
    const scope = globalThis as unknown as Record<symbol, unknown>;
    const saved = scope[context];
    try {
      delete scope[context];
      expect(await purgeCalendarFeedCache(calendarFeedCacheTag(FEED_ID))).toBe('unavailable');
      scope[context] = { get: () => ({}) };
      expect(await purgeCalendarFeedCache(calendarFeedCacheTag(FEED_ID))).toBe('unavailable');
      const dangerouslyDeleteByTag = vi.fn(async () => {});
      scope[context] = { get: () => ({ purge: { dangerouslyDeleteByTag } }) };
      expect(await purgeCalendarFeedCache(calendarFeedCacheTag(FEED_ID))).toBe('purged');
      expect(dangerouslyDeleteByTag).toHaveBeenCalledWith(`calendar-feed-${FEED_ID}`, undefined);
    } finally {
      if (saved === undefined) delete scope[context];
      else scope[context] = saved;
    }
  });
});

describe('the retention sweep', () => {
  it('answers 404 unless the sweep secret is provisioned and presented', async () => {
    const fetcher = vi.fn();
    for (const [env, authorization] of [
      [{ ...ENV, CALENDAR_FEED_SWEEP_SECRET: '' }, `Bearer ${SWEEP}`],
      [{ ...ENV, CALENDAR_FEED_SWEEP_SECRET: 'too-short' }, 'Bearer too-short'],
      [ENV, `Bearer ${'t'.repeat(40)}`],
      [ENV, `Bearer ${SWEEP.slice(0, -1)}`],
      [ENV, `Bearer ${SWEEP}s`],
      [ENV, `Bearer ${'t'.repeat(4096)}`],
      [ENV, ''],
    ] as const) {
      const res = recorder();
      await handleCalendarFeedSweep({ method: 'POST', headers: { authorization } }, res,
        deps({ env, fetcher: fetcher as unknown as typeof fetch }));
      expect(res.statusCode).toBe(404);
    }
    expect(fetcher).not.toHaveBeenCalled();
    const get = recorder();
    await handleCalendarFeedSweep({ method: 'GET', headers: { authorization: `Bearer ${SWEEP}` } }, get, deps());
    expect(get.statusCode).toBe(405);
  });

  it('prunes in batches until a batch comes back short', async () => {
    const batches = [256, 256, 7];
    const { calls, fetcher } = supabase(() => ({ json: { pruned: batches.shift() } }));
    const res = recorder();
    await handleCalendarFeedSweep({ method: 'POST', headers: { authorization: `Bearer ${SWEEP}` } }, res, deps({ fetcher }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ pruned: 519, batches: 3, more: false });
    expect(calls.map((call) => [call.name, call.body])).toEqual([
      ['prune_calendar_feeds', { candidate_limit: 256 }],
      ['prune_calendar_feeds', { candidate_limit: 256 }],
      ['prune_calendar_feeds', { candidate_limit: 256 }],
    ]);
  });

  it('says when it stopped at its cap with feeds possibly still due', async () => {
    const { calls, fetcher } = supabase(() => ({ json: { pruned: SWEEP_BATCH } }));
    const res = recorder();
    await handleCalendarFeedSweep({ method: 'POST', headers: { authorization: `Bearer ${SWEEP}` } }, res, deps({ fetcher }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ pruned: SWEEP_BATCH * SWEEP_MAX_BATCHES, batches: SWEEP_MAX_BATCHES, more: true });
    expect(calls).toHaveLength(SWEEP_MAX_BATCHES);
  });

  it('logs a failed sweep without its secret, and a refused one not at all', async () => {
    const errors = errorLines();
    for (const reply of [
      { status: 500, json: { message: 'boom' } },
      { json: { pruned: -1 } },
    ]) {
      const { fetcher } = supabase(() => reply);
      const res = recorder();
      await handleCalendarFeedSweep({ method: 'POST', headers: { authorization: `Bearer ${SWEEP}` } }, res, deps({ fetcher }));
      expect([res.statusCode, res.json()]).toEqual([503, { error: 'unavailable' }]);
    }
    const refused = recorder();
    await handleCalendarFeedSweep({ method: 'POST', headers: { authorization: `Bearer ${SWEEP}x` } }, refused, deps());
    expect(refused.statusCode).toBe(404);
    expect(errors).toEqual([
      'Calendar feed sweep failed.',
      'Calendar feed sweep failed.',
    ]);
    for (const line of errors) {
      expect(line).not.toContain(SWEEP);
      expect(line).not.toContain('Bearer');
    }
  });
});

describe('the two Firewall counters', () => {
  const removal = { method: 'DELETE', query: { id: FEED_ID }, headers: { origin: 'https://zodiacs.org', host: 'zodiacs.org', authorization: `Bearer ${SECRET}` } };

  it('makes and removes feeds under the write counter and never consults the read counter', async () => {
    const readRateLimited = vi.fn(async () => true);
    const made = supabase((_name, body) => ({ json: { outcome: 'created', id: body.candidate_id } }));
    const create = recorder();
    await handleCalendarFeedCreate({ method: 'POST', headers: BROWSER, body: BODY }, create,
      deps({ fetcher: made.fetcher, readRateLimited }));
    expect(create.statusCode).toBe(201);
    const revoked = supabase(() => ({ json: { outcome: 'revoked' } }));
    const remove = recorder();
    await handleCalendarFeed(removal, remove, deps({ fetcher: revoked.fetcher, readRateLimited }));
    expect([remove.statusCode, remove.json()]).toEqual([200, { removed: true }]);
    expect(readRateLimited).not.toHaveBeenCalled();

    for (const [handle, request] of [
      [handleCalendarFeedCreate, { method: 'POST', headers: BROWSER, body: BODY }],
      [handleCalendarFeed, removal],
    ] as const) {
      const writeRateLimited = vi.fn(async () => true);
      const fetcher = vi.fn();
      const res = recorder();
      await handle(request, res, deps({ fetcher: fetcher as unknown as typeof fetch, writeRateLimited }));
      expect([res.statusCode, res.json(), res.headers.get('retry-after')]).toEqual([429, { error: 'rate_limited' }, '60']);
      expect(writeRateLimited).toHaveBeenCalledOnce();
      expect(fetcher).not.toHaveBeenCalled();
    }
  });

  it('serves feeds under the read counter: a GET never counts against the write counter', async () => {
    const writeRateLimited = vi.fn(async () => true);
    const { fetcher } = supabase((_name, body) => (body.candidate_id === FEED_ID
      ? { json: { outcome: 'ready', planets: LONGITUDES.slice(0, 10), ascendant: 12, midheaven: 281 } }
      : { json: { outcome: 'not_found' } }));
    for (const [id, status] of [[FEED_ID, 200], ['Zq3xPq0Jr9Vb_Tm2-Ka5sB', 404], ['not-an-id', 404]] as const) {
      const res = recorder();
      await handleCalendarFeed({ method: 'GET', query: { id }, headers: {} }, res, deps({ fetcher, writeRateLimited }));
      expect(res.statusCode, id).toBe(status);
    }
    expect(writeRateLimited).not.toHaveBeenCalled();

    const readRateLimited = vi.fn(async () => true);
    const limited = recorder();
    await handleCalendarFeed({ method: 'GET', query: { id: FEED_ID }, headers: {} }, limited, deps({ readRateLimited, writeRateLimited }));
    expect([limited.statusCode, limited.headers.get('retry-after')]).toEqual([429, '60']);
    expect(readRateLimited).toHaveBeenCalledOnce();
    expect(writeRateLimited).not.toHaveBeenCalled();
  });

  it('counts the sweep against neither counter', async () => {
    const readRateLimited = vi.fn(async () => true);
    const writeRateLimited = vi.fn(async () => true);
    const { fetcher } = supabase(() => ({ json: { pruned: 0 } }));
    const res = recorder();
    await handleCalendarFeedSweep({ method: 'POST', headers: { authorization: `Bearer ${SWEEP}` } }, res,
      deps({ fetcher, readRateLimited, writeRateLimited }));
    expect(res.statusCode).toBe(200);
    expect(readRateLimited).not.toHaveBeenCalled();
    expect(writeRateLimited).not.toHaveBeenCalled();
  });
});

describe('the calendar function', () => {
  it('declares bodyParser: false, a Next.js option that Vercel\'s Node.js runtime ignores', () => {
    // The byte count rests on the raw reader, which never reads req.body
    // (see "counts the raw bytes of the request stream" above).
    expect(config).toEqual({ api: { bodyParser: false } });
  });

  it('sends each rewritten route to its handler and anything else to the older addresses', async () => {
    expect(CALENDAR_ROUTE_PARAMETER).toBe('__zodiacs_calendar_route');
    const create = recorder();
    await handler({ method: 'GET', query: { [CALENDAR_ROUTE_PARAMETER]: 'create' }, headers: {} }, create);
    expect([create.statusCode, create.headers.get('allow')]).toEqual([405, 'POST']);
    const feed = recorder();
    await handler({ method: 'POST', query: { [CALENDAR_ROUTE_PARAMETER]: 'feed', id: FEED_ID }, headers: {} }, feed);
    expect([feed.statusCode, feed.headers.get('allow')]).toEqual([405, 'GET, DELETE']);
    const sweep = recorder();
    await handler({ method: 'GET', query: { [CALENDAR_ROUTE_PARAMETER]: 'sweep' }, headers: {} }, sweep);
    expect([sweep.statusCode, sweep.headers.get('allow')]).toEqual([405, 'POST']);
    const older = recorder();
    await handler({ method: 'POST', query: {}, headers: {} }, older);
    expect([older.statusCode, older.headers.get('allow')]).toEqual([405, 'GET']);
  });
});

describe('feed ids and keys', () => {
  it('draws 128-bit ids and 256-bit keys, and keeps only a key digest', () => {
    const ids = new Set(Array.from({ length: 64 }, createCalendarFeedId));
    const secrets = new Set(Array.from({ length: 64 }, createCalendarFeedSecret));
    expect(ids.size).toBe(64);
    expect(secrets.size).toBe(64);
    for (const id of ids) {
      expect(id).toMatch(CALENDAR_FEED_ID_RE);
      expect(Buffer.from(id, 'base64url')).toHaveLength(16);
    }
    for (const secret of secrets) {
      expect(secret).toMatch(CALENDAR_FEED_SECRET_RE);
      expect(Buffer.from(secret, 'base64url')).toHaveLength(32);
      expect(calendarFeedSecretHash(secret)).toBe(createHash('sha256').update(secret).digest('hex'));
    }
    expect(calendarFeedSecretHash('short')).toBeNull();
    expect(calendarFeedSecretHash(undefined)).toBeNull();
  });

  it('puts nothing but the id in a feed address', () => {
    expect(calendarFeedWebcalUrl(`https://zodiacs.org/api/calendar/feeds/${FEED_ID}`))
      .toBe(`webcal://zodiacs.org/api/calendar/feeds/${FEED_ID}`);
    for (const url of [
      `http://zodiacs.org/api/calendar/feeds/${FEED_ID}`,
      `https://zodiacs.org/api/calendar/feeds/${FEED_ID}?token=${CODE}`,
      `https://zodiacs.org/api/calendar/feeds/${FEED_ID}#x`,
      `https://zodiacs.org/api/calendar/transits?token=${CODE}`,
      'https://zodiacs.org/api/calendar/feeds/short',
      'not a url',
    ]) {
      expect(calendarFeedWebcalUrl(url)).toBeNull();
    }
  });

  it('reads exactly one positions code from a body', () => {
    expect(positionsCodeFromBody({ positions: CODE })).toBe(CODE);
    expect(positionsCodeFromBody(JSON.stringify({ positions: CODE }))).toBe(CODE);
    for (const body of [null, undefined, '', 'x', [], {}, { positions: 1 }, { positions: CODE, extra: true }]) {
      expect(positionsCodeFromBody(body)).toBeNull();
    }
  });
});

describe('where feeds may be made and removed from', () => {
  const request = (origin: string | undefined, host: string) => ({
    headers: { ...(origin === undefined ? {} : { origin }), host },
  });

  it('takes only zodiacs.org and www.zodiacs.org in production', () => {
    const env = { VERCEL_ENV: 'production', VERCEL_URL: 'zodiacs-org-abc123-zodiacsofficial.vercel.app' };
    expect(isAllowedCalendarFeedWrite(request('https://zodiacs.org', 'zodiacs.org'), env)).toBe(true);
    expect(isAllowedCalendarFeedWrite(request('https://www.zodiacs.org', 'www.zodiacs.org'), env)).toBe(true);
    expect(isAllowedCalendarFeedWrite({ headers: { referer: 'https://zodiacs.org/transits/', host: 'zodiacs.org' } }, env)).toBe(true);
    for (const [origin, host] of [
      ['https://zodiacs-org-abc123-zodiacsofficial.vercel.app', 'zodiacs-org-abc123-zodiacsofficial.vercel.app'],
      ['https://other-preview-zodiacsofficial.vercel.app', 'other-preview-zodiacsofficial.vercel.app'],
      ['http://zodiacs.org', 'zodiacs.org'],
      ['https://zodiacs.org', 'www.zodiacs.org'],
      ['https://example.com', 'zodiacs.org'],
      ['http://localhost:3000', 'localhost:3000'],
      ['null', 'zodiacs.org'],
      [undefined, 'zodiacs.org'],
    ] as const) {
      expect(isAllowedCalendarFeedWrite(request(origin, host), env), `${origin} → ${host}`).toBe(false);
    }
  });

  it('takes only its own addresses on a preview', () => {
    const env = {
      VERCEL_ENV: 'preview',
      VERCEL_URL: 'zodiacs-org-abc123-zodiacsofficial.vercel.app',
      VERCEL_BRANCH_URL: 'zodiacs-org-git-feed-ids-zodiacsofficial.vercel.app',
    };
    expect(calendarFeedWriteOrigins(env).origins).toEqual([
      'https://zodiacs-org-abc123-zodiacsofficial.vercel.app',
      'https://zodiacs-org-git-feed-ids-zodiacsofficial.vercel.app',
    ]);
    for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) {
      expect(isAllowedCalendarFeedWrite(request(`https://${host}`, host), env)).toBe(true);
    }
    for (const [origin, host] of [
      ['https://zodiacs-org-old-branch-zodiacsofficial.vercel.app', 'zodiacs-org-old-branch-zodiacsofficial.vercel.app'],
      ['https://zodiacs.org', 'zodiacs.org'],
      [`http://${env.VERCEL_URL}`, env.VERCEL_URL],
      ['http://localhost:3000', 'localhost:3000'],
    ] as const) {
      expect(isAllowedCalendarFeedWrite(request(origin, host), env), origin).toBe(false);
    }
    expect(isAllowedCalendarFeedWrite(request(`https://${env.VERCEL_URL}`, env.VERCEL_URL), { VERCEL_ENV: 'preview' }))
      .toBe(false);
  });

  it('takes only localhost in development, and nothing where the environment is unknown', () => {
    const development = { VERCEL_ENV: 'development' };
    for (const [origin, host] of [
      ['http://localhost:3000', 'localhost:3000'],
      ['http://127.0.0.1:3000', '127.0.0.1:3000'],
      ['http://[::1]:3000', '[::1]:3000'],
    ]) {
      expect(isAllowedCalendarFeedWrite(request(origin, host), development), origin).toBe(true);
    }
    expect(isAllowedCalendarFeedWrite(request('https://zodiacs.org', 'zodiacs.org'), development)).toBe(false);
    for (const env of [{}, { VERCEL_ENV: 'staging' }]) {
      expect(isAllowedCalendarFeedWrite(request('https://zodiacs.org', 'zodiacs.org'), env)).toBe(false);
      expect(isAllowedCalendarFeedWrite(request('http://localhost:3000', 'localhost:3000'), env)).toBe(false);
    }
  });

  it('applies the same rule to making and to removing a feed', async () => {
    const preview = { ...ENV, VERCEL_ENV: 'preview', VERCEL_URL: 'zodiacs-org-abc123-zodiacsofficial.vercel.app' };
    const other = 'https://zodiacs-org-old-branch-zodiacsofficial.vercel.app';
    const fetcher = vi.fn();
    const make = recorder();
    await handleCalendarFeedCreate(
      { method: 'POST', headers: { ...BROWSER, origin: other, host: new URL(other).host }, body: BODY },
      make,
      deps({ env: preview, fetcher: fetcher as unknown as typeof fetch }),
    );
    const remove = recorder();
    await handleCalendarFeed(
      { method: 'DELETE', query: { id: FEED_ID }, headers: { origin: other, host: new URL(other).host, authorization: `Bearer ${SECRET}` } },
      remove,
      deps({ env: preview, fetcher: fetcher as unknown as typeof fetch }),
    );
    expect([make.statusCode, remove.statusCode]).toEqual([403, 403]);
    expect(fetcher).not.toHaveBeenCalled();

    const own = `https://${preview.VERCEL_URL}`;
    const { calls, fetcher: store } = supabase(() => ({ json: { outcome: 'revoked' } }));
    const removed = recorder();
    await handleCalendarFeed(
      { method: 'DELETE', query: { id: FEED_ID }, headers: { origin: own, host: preview.VERCEL_URL, authorization: `Bearer ${SECRET}` } },
      removed,
      deps({ env: preview, fetcher: store }),
    );
    expect(removed.statusCode).toBe(200);
    expect(calls).toHaveLength(1);
  });
});
