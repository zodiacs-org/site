import { describe, expect, it, vi } from 'vitest';
import { fetchRows, formatReport, parseDays, serviceRequest, windowStart } from './guide-feedback-report.mjs';

const ENV = { PUBLIC_SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-value-long-enough' };
const NOW = new Date('2026-11-06T09:00:00Z');

describe('Guide feedback report', () => {
  it('reads 7 or 30 days, nothing else', () => {
    expect(parseDays([])).toBe(7);
    expect(parseDays(['--days', '30'])).toBe(30);
    expect(() => parseDays(['--days', '365'])).toThrow(/7 or 30/u);
    expect(windowStart(NOW, 7)).toBe('2026-10-31');
    expect(windowStart(NOW, 30)).toBe('2026-10-08');
  });

  it('asks Supabase read only, for the window, with the service role from the environment', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([{ day: '2026-11-05', vote: 'up', votes: 3 }]), { status: 200 }));
    const rows = await fetchRows({ env: ENV, fetcher, now: NOW, days: 7 });
    expect(rows).toEqual([{ day: '2026-11-05', vote: 'up', votes: 3 }]);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/rest/v1/guide_feedback_daily?select=day%2Cvote%2Cvotes&day=gte.2026-10-31&order=day.asc');
    expect(init.method).toBeUndefined();
    expect(init.headers.apikey).toBe(ENV.SUPABASE_SERVICE_ROLE_KEY);
  });

  it('refuses to run without a project URL or key, and never puts the key in a message', async () => {
    expect(() => serviceRequest({})).toThrow(/PUBLIC_SUPABASE_URL/u);
    expect(() => serviceRequest({ PUBLIC_SUPABASE_URL: ENV.PUBLIC_SUPABASE_URL })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/u);
    const fetcher = vi.fn(async () => new Response('denied', { status: 401 }));
    const failure = await fetchRows({ env: ENV, fetcher, now: NOW }).catch((error) => error);
    expect(failure.message).toMatch(/401/u);
    expect(failure.message).not.toContain(ENV.SUPABASE_SERVICE_ROLE_KEY);
    expect(failure.message).not.toContain('example.supabase.co');
  });

  it('prints every day of the window with its up and down counts and the totals', () => {
    const text = formatReport([
      { day: '2026-11-05', vote: 'up', votes: 3 },
      { day: '2026-11-05', vote: 'down', votes: 1 },
      { day: '2026-11-06', vote: 'up', votes: '2' },
      { day: '2026-11-06', vote: 'sideways', votes: 9 },
    ], NOW, 7);
    const lines = text.split('\n');
    expect(lines[0]).toBe('Guide answer votes, last 7 UTC days');
    expect(lines.filter((line) => /^\d{4}-\d{2}-\d{2} /u.test(line))).toHaveLength(7);
    expect(text).toContain('2026-10-31     0     0');
    expect(text).toContain('2026-11-05     3     1');
    expect(text).toContain('2026-11-06     2     0');
    expect(text).toContain('Total          5     1');
    expect(text).toContain('Up share   83% of 6 votes');
    expect(formatReport([], NOW, 7)).toContain('No votes in this window.');
    expect(text).not.toMatch(/[–—]/u);
  });
});
