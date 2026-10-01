import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

import { createHash, timingSafeEqual } from 'node:crypto';
import { handleCalendarFeedSweep, type CalendarFeedDependencies } from './routes';

const SWEEP = 's'.repeat(40);
const compare = vi.mocked(timingSafeEqual);

function deps(): CalendarFeedDependencies {
  return {
    env: {
      PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
      CALENDAR_FEED_SWEEP_SECRET: SWEEP,
    },
    fetcher: (async () => new Response(JSON.stringify({ pruned: 0 }), { status: 200 })) as typeof fetch,
    now: () => new Date('2026-10-10T08:00:00Z'),
    readRateLimited: async () => false,
    writeRateLimited: async () => false,
    buildCalendar: () => '',
    purge: async () => 'purged',
  };
}

function recorder() {
  return {
    statusCode: 0,
    setHeader() {},
    end() {},
  };
}

afterEach(() => {
  compare.mockClear();
});

describe('the sweep secret', () => {
  it('is compared as two SHA-256 digests in constant time, whatever length was presented', async () => {
    const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
    for (const [presented, status] of [
      [SWEEP, 200],
      [`${SWEEP.slice(0, -1)}t`, 404],
      [SWEEP.slice(0, -1), 404],
      [`${SWEEP}s`, 404],
      ['t'.repeat(4096), 404],
      ['', 404],
    ] as const) {
      compare.mockClear();
      const res = recorder();
      await handleCalendarFeedSweep({ method: 'POST', headers: { authorization: `Bearer ${presented}` } }, res, deps());
      expect(res.statusCode, presented.slice(0, 12)).toBe(status);
      expect(compare).toHaveBeenCalledOnce();
      const [candidate, expected] = compare.mock.calls[0] as unknown as [Buffer, Buffer];
      expect([candidate.byteLength, expected.byteLength]).toEqual([32, 32]);
      expect(candidate.equals(digest(presented))).toBe(true);
      expect(expected.equals(digest(SWEEP))).toBe(true);
    }
  });
});
