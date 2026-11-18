import { describe, expect, it, vi } from 'vitest';
import {
  DAILY_EMAIL_USER_AGENT,
  ResendRequestWithdrawnError,
  createRateLimitedResendRequest,
} from './resend-request';

describe('rate-limited Resend request queue', () => {
  it('adds the required user agent and deterministically paces sequential calls', async () => {
    let time = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => { time += milliseconds; });
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const request = createRateLimitedResendRequest(fetcher, {
      now: () => time,
      sleep,
      minIntervalMs: 250,
    });
    await request('https://api.resend.com/segments');
    await request('https://api.resend.com/segments');
    expect(sleep).toHaveBeenCalledWith(250);
    const headers = fetcher.mock.calls[0][1].headers as Headers;
    expect(headers.get('user-agent')).toBe(DAILY_EMAIL_USER_AGENT);
  });

  it('honors Retry-After for bounded 429 retries and then succeeds', async () => {
    let time = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => { time += milliseconds; });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('slow down', {
        status: 429,
        headers: { 'Retry-After': '2' },
      }))
      .mockResolvedValueOnce(new Response('{"id":"ok"}', { status: 200 }));
    const request = createRateLimitedResendRequest(fetcher, {
      now: () => time,
      sleep,
      minIntervalMs: 250,
      maxRetries: 2,
    });
    await expect(request('https://api.resend.com/emails')).resolves.toMatchObject({ status: 200 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it('stops after the configured retry count', async () => {
    let time = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => { time += milliseconds; });
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 429 }));
    const request = createRateLimitedResendRequest(fetcher, {
      now: () => time,
      sleep,
      maxRetries: 1,
    });
    await expect(request('https://api.resend.com/emails')).resolves.toMatchObject({ status: 429 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('per-attempt guard', () => {
  it('runs after the pacing wait, immediately before the attempt, and sends nothing once it declines', async () => {
    let time = 1_000;
    const order: string[] = [];
    let allow = true;
    const sleep = vi.fn(async (milliseconds: number) => {
      order.push(`sleep:${milliseconds}`);
      time += milliseconds;
      allow = false;
    });
    const fetcher = vi.fn(async (input: string | URL) => {
      order.push(`fetch:${String(input)}`);
      return new Response('{}', { status: 200 });
    });
    const request = createRateLimitedResendRequest(fetcher as typeof fetch, {
      now: () => time,
      sleep,
      minIntervalMs: 250,
    });
    const guard = vi.fn(async (attempt: number) => {
      order.push(`guard:${attempt}`);
      return allow;
    });
    await request('https://api.resend.com/first');
    const second = request('https://api.resend.com/second', { method: 'POST' }, { beforeAttempt: guard });
    await expect(second).rejects.toBeInstanceOf(ResendRequestWithdrawnError);
    await expect(second).rejects.toMatchObject({ outcome: 'withdrawn', attempt: 0 });
    expect(order).toEqual(['fetch:https://api.resend.com/first', 'sleep:250', 'guard:0']);
    // The queue keeps working for the next request.
    await expect(request('https://api.resend.com/third')).resolves.toMatchObject({ status: 200 });
  });

  it('is asked again before every retry after a 429', async () => {
    let time = 1_000;
    const decisions = [true, true, false];
    const sleep = vi.fn(async (milliseconds: number) => { time += milliseconds; });
    const fetcher = vi.fn().mockImplementation(async () => new Response('', { status: 429 }));
    const request = createRateLimitedResendRequest(fetcher, {
      now: () => time,
      sleep,
      maxRetries: 3,
    });
    const guard = vi.fn(async (_attempt: number) => decisions.shift() ?? false);
    await expect(request('https://api.resend.com/emails', { method: 'POST' }, { beforeAttempt: guard }))
      .rejects.toMatchObject({ outcome: 'withdrawn', attempt: 2 });
    expect(guard.mock.calls.map(([attempt]) => attempt)).toEqual([0, 1, 2]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('sends nothing when the guard throws', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const request = createRateLimitedResendRequest(fetcher, { sleep: async () => {} });
    const failure = new Error('lookup failed');
    await expect(request('https://api.resend.com/emails', { method: 'POST' }, {
      beforeAttempt: async () => { throw failure; },
    })).rejects.toBe(failure);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
