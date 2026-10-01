import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vercel/firewall', () => ({ checkRateLimit: vi.fn() }));

import { checkRateLimit } from '@vercel/firewall';
import handler, { CALENDAR_ROUTE_PARAMETER } from '../../../api/calendar/transits';
import { calendarToken } from '../../islands/CalendarSubscribe';
import { POSITION_BODY_ORDER } from '../share-positions';
import {
  CALENDAR_FEED_WRITE_RATE_LIMIT_ID,
  calendarFeedWriteRateLimited,
  TRANSIT_CALENDAR_RATE_LIMIT_ID,
  transitCalendarRateLimited,
} from './rate-limit';

const check = vi.mocked(checkRateLimit);

// Synthetic positions: no real birth.
const CODE = calendarToken({
  bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: Number(((index * 29.083) % 360).toFixed(3)) })),
  angles: { asc: 101.2, mc: 12.8 },
  houseSystem: 'placidus',
  engineVersion: '1.0.0',
})!;
const FEED_ID = 'Zq3xPq0Jr9Vb_Tm2-Ka5sA';
const SITE = { origin: 'https://zodiacs.org', host: 'zodiacs.org', 'x-real-ip': '203.0.113.7' };

function recorder() {
  return {
    statusCode: 0,
    body: '',
    headers: new Map<string, string>(),
    setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); },
    end(body = '') { this.body = body; },
  };
}

/**
 * Every calendar route, as vercel.json rewrites it to the one function. The
 * older address carries a code the function refuses after its rate-limit
 * check, so no test here waits for a calendar to be built.
 */
const ROUTES = {
  olderAddress: () => ({ method: 'GET', query: { token: '2.not-a-code' }, headers: SITE }),
  feed: () => ({ method: 'GET', query: { [CALENDAR_ROUTE_PARAMETER]: 'feed', id: FEED_ID }, headers: SITE }),
  create: () => ({
    method: 'POST',
    query: { [CALENDAR_ROUTE_PARAMETER]: 'create' },
    headers: { ...SITE, 'content-type': 'application/json' },
    body: JSON.stringify({ positions: CODE }),
  }),
  removal: () => ({
    method: 'DELETE',
    query: { [CALENDAR_ROUTE_PARAMETER]: 'feed', id: FEED_ID },
    headers: { ...SITE, authorization: `Bearer ${'k'.repeat(42)}A` },
  }),
  sweep: () => ({
    method: 'POST',
    query: { [CALENDAR_ROUTE_PARAMETER]: 'sweep' },
    headers: { authorization: `Bearer ${'s'.repeat(40)}` },
  }),
} as const;

beforeEach(() => {
  check.mockReset();
  check.mockResolvedValue({ rateLimited: false });
  // Production, with no store: every route stops before the database.
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  vi.stubEnv('CALENDAR_FEED_SWEEP_SECRET', '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function idsChecked(route: keyof typeof ROUTES): Promise<string[]> {
  check.mockClear();
  await handler(ROUTES[route](), recorder());
  return check.mock.calls.map(([id]) => id);
}

describe('the calendar function\'s Firewall rate-limit IDs', () => {
  it('names one ID for reads and another for making and removing feeds', () => {
    expect(TRANSIT_CALENDAR_RATE_LIMIT_ID).toBe('zodiacs-transit-calendar');
    expect(CALENDAR_FEED_WRITE_RATE_LIMIT_ID).toBe('zodiacs-calendar-feed-write');
  });

  it('counts every GET against the read ID only, never the write ID', async () => {
    expect(await idsChecked('olderAddress')).toEqual([TRANSIT_CALENDAR_RATE_LIMIT_ID]);
    expect(await idsChecked('feed')).toEqual([TRANSIT_CALENDAR_RATE_LIMIT_ID]);
    // However the request looks, a GET never touches the write counter.
    for (const query of [{}, { id: 'not-an-id' }, { id: FEED_ID, token: CODE }]) {
      check.mockClear();
      await handler({ method: 'GET', query: { [CALENDAR_ROUTE_PARAMETER]: 'feed', ...query }, headers: SITE }, recorder());
      expect(check.mock.calls.map(([id]) => id)).not.toContain(CALENDAR_FEED_WRITE_RATE_LIMIT_ID);
    }
  });

  it('counts making and removing a feed against the write ID only, and the sweep against neither', async () => {
    expect(await idsChecked('create')).toEqual([CALENDAR_FEED_WRITE_RATE_LIMIT_ID]);
    expect(await idsChecked('removal')).toEqual([CALENDAR_FEED_WRITE_RATE_LIMIT_ID]);
    expect(await idsChecked('sweep')).toEqual([]);
  });

  it('passes the request headers, so the Firewall counts by the client address', async () => {
    const request = ROUTES.create();
    await handler(request, recorder());
    expect(check).toHaveBeenCalledWith(CALENDAR_FEED_WRITE_RATE_LIMIT_ID, { headers: request.headers });
  });

  it('answers 429 with Retry-After when the matching rule is over its limit', async () => {
    check.mockImplementation(async (id) => ({ rateLimited: id === CALENDAR_FEED_WRITE_RATE_LIMIT_ID }));
    for (const route of ['create', 'removal'] as const) {
      const res = recorder();
      await handler(ROUTES[route](), res);
      expect([res.statusCode, res.headers.get('retry-after')], route).toEqual([429, '60']);
    }
    // Reads go on while the write rule is exhausted.
    for (const route of ['olderAddress', 'feed'] as const) {
      const res = recorder();
      await handler(ROUTES[route](), res);
      expect(res.statusCode, route).not.toBe(429);
    }

    check.mockImplementation(async (id) => ({ rateLimited: id === TRANSIT_CALENDAR_RATE_LIMIT_ID }));
    for (const route of ['olderAddress', 'feed'] as const) {
      const res = recorder();
      await handler(ROUTES[route](), res);
      expect([res.statusCode, res.headers.get('retry-after')], route).toEqual([429, '60']);
    }
    for (const route of ['create', 'removal'] as const) {
      const res = recorder();
      await handler(ROUTES[route](), res);
      expect(res.statusCode, route).not.toBe(429);
    }
  });
});

describe('a rule that is not provisioned or cannot be checked', () => {
  const request = { headers: SITE };

  it('lets the request through, for either ID, exactly as before the split', async () => {
    for (const limited of [transitCalendarRateLimited, calendarFeedWriteRateLimited]) {
      for (const result of [
        { rateLimited: false, error: 'not-found' as const },
        // A missing rule never blocks, whatever else the answer says.
        { rateLimited: true, error: 'not-found' as const },
        { rateLimited: false },
        undefined,
      ]) {
        check.mockResolvedValueOnce(result as never);
        expect(await limited(request), JSON.stringify(result)).toBe(false);
      }
      check.mockRejectedValueOnce(new Error('Could not determine rate limit key.'));
      expect(await limited(request)).toBe(false);
    }
  });

  it('blocks only when a provisioned rule says so', async () => {
    for (const limited of [transitCalendarRateLimited, calendarFeedWriteRateLimited]) {
      for (const result of [{ rateLimited: true }, { rateLimited: true, error: 'blocked' as const }]) {
        check.mockResolvedValueOnce(result);
        expect(await limited(request), JSON.stringify(result)).toBe(true);
      }
    }
  });

  it('lets every route through while neither rule exists', async () => {
    check.mockResolvedValue({ rateLimited: false, error: 'not-found' });
    for (const route of Object.keys(ROUTES) as (keyof typeof ROUTES)[]) {
      const res = recorder();
      await handler(ROUTES[route](), res);
      expect(res.statusCode, route).not.toBe(429);
    }
  });
});
