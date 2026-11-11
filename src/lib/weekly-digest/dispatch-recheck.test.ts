import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { WeeklyAuthorization } from './chart-edition';
import {
  buildWeeklyDigestRequestEnvelope,
  createWeeklyDigestResendRequest,
  sendWeeklyDigestEnvelope,
  type WeeklyDigestEmail,
  type WeeklyDigestRequestEnvelope,
} from './delivery';
import {
  dispatchWeeklyWithRecheck,
  weeklyAttemptGuard,
  weeklyDispatchRecheck,
  WeeklyDispatchRecheckError,
  type WeeklyDispatchRecheck,
} from './dispatch-recheck';

const WEEK = '2026-07-13';
const PERSON = '10000000-0000-4000-8000-000000000001';
const OTHER = '10000000-0000-4000-8000-000000000002';

type Edition = 'chart' | 'sky';
interface Recipient { userId: string; edition: Edition }
interface Prepared { envelope: WeeklyDigestRequestEnvelope }

const email = (userId: string, edition: Edition): WeeklyDigestEmail => ({
  apiKey: 'resend_test_key',
  from: 'Zodiacs.org <hello@zodiacs.org>',
  to: `${userId.slice(-1)}@example.com`,
  subject: `Your ${edition} edition`,
  text: `${edition} text`,
  html: `<p>${edition} html</p>`,
  unsubscribe: 'https://zodiacs.org/api/unsubscribe?token=test',
  weekStart: WEEK,
  userId,
});
const prepare = (recipient: Recipient): Prepared => ({
  envelope: buildWeeklyDigestRequestEnvelope(email(recipient.userId, recipient.edition)),
});

/**
 * The real weekly provider queue and envelope send; only fetch, the clock and
 * the database are stand-ins. The database holds the account's current
 * edition and the delivery's state, as weekly_digest_dispatch_recheck_v1 and
 * the authorization see them. Chart emails are withdrawn while the chart
 * edition waits in the queue.
 */
function weeklyQueue({
  responses = [],
  rebuildAuthorized = true,
}: {
  responses?: Array<() => Response>;
  rebuildAuthorized?: boolean;
}) {
  const db = { edition: 'chart' as Edition, authorized: 'chart' as Edition, status: 'dispatching' };
  let time = 1_000;
  const posts: Array<{ edition: string; to: string; status?: number }> = [];
  const queued = [...responses];
  const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { subject: string; to: string[] };
    const response = (queued.shift() ?? (() => Response.json({ id: `receipt-${posts.length + 1}` })))();
    posts.push({ edition: body.subject.split(' ')[1]!, to: body.to[0]!, status: response.status });
    return response;
  });
  const sleep = vi.fn(async (milliseconds: number) => {
    time += milliseconds;
    db.edition = 'sky';
  });
  const request = createWeeklyDigestResendRequest(fetcher as typeof fetch, {
    now: () => time,
    sleep,
    minIntervalMs: 250,
    maxRetries: 3,
    timeoutSignal: () => new AbortController().signal,
  });
  const recheck = vi.fn(async (): Promise<WeeklyDispatchRecheck> => {
    if (db.status !== 'dispatching') return 'missing';
    if (db.edition === db.authorized) return 'dispatch';
    db.status = 'reserved';
    return 'released';
  });
  const reauthorize = vi.fn(async (): Promise<WeeklyAuthorization<Recipient, Prepared>> => {
    if (!rebuildAuthorized || db.status !== 'reserved') return { authorized: false };
    const recipient = { userId: PERSON, edition: db.edition };
    db.authorized = db.edition;
    db.status = 'dispatching';
    return { authorized: true, recipient, prepared: prepare(recipient) };
  });
  const chart = { userId: PERSON, edition: 'chart' as Edition };
  const dispatch = () => dispatchWeeklyWithRecheck<Recipient, Prepared>({
    authorized: { recipient: chart, prepared: prepare(chart) },
    reauthorize,
    isChartEdition: (recipient) => recipient.edition === 'chart',
    recheck,
    apiKey: 'resend_test_key',
    request,
  });
  return { db, posts, sleep, request, recheck, reauthorize, dispatch };
}

describe('weekly chart edition recheck through the provider queue', () => {
  it('sends no chart email when chart emails are withdrawn during the initial pacing wait', async () => {
    for (const rebuildAuthorized of [true, false]) {
      const queue = weeklyQueue({ rebuildAuthorized });
      // A sky edition for someone else goes first, so the chart edition waits for pacing.
      await sendWeeklyDigestEnvelope(prepare({ userId: OTHER, edition: 'sky' }).envelope, 'resend_test_key', queue.request);
      const outcome = await queue.dispatch();
      expect(queue.sleep).toHaveBeenCalledWith(250);
      expect(queue.posts.filter((post) => post.edition === 'chart')).toEqual([]);
      if (rebuildAuthorized) {
        expect(outcome).toMatchObject({ kind: 'provider', result: { kind: 'sent' }, recipient: { edition: 'sky' } });
        expect(queue.posts.map((post) => `${post.edition}:${post.to}`)).toEqual(['sky:2@example.com', 'sky:1@example.com']);
      } else {
        expect(outcome).toEqual({ kind: 'withdrawn', recheck: 'released' });
        expect(queue.posts).toHaveLength(1);
        expect(queue.db.status).toBe('reserved');
      }
      expect(queue.recheck).toHaveBeenCalledOnce();
    }
  });

  it('sends no chart email when chart emails are withdrawn during a 429 backoff', async () => {
    for (const rebuildAuthorized of [true, false]) {
      const queue = weeklyQueue({
        responses: [() => Response.json(
          { name: 'rate_limit_exceeded', statusCode: 429, message: 'slow down' },
          { status: 429, headers: { 'Retry-After': '1' } },
        )],
        rebuildAuthorized,
      });
      const outcome = await queue.dispatch();
      expect(queue.sleep).toHaveBeenCalledWith(1_000);
      // The one chart POST is the attempt the provider rejected with 429.
      expect(queue.posts.filter((post) => post.edition === 'chart')).toEqual([
        { edition: 'chart', to: '1@example.com', status: 429 },
      ]);
      if (rebuildAuthorized) {
        expect(queue.posts.slice(1)).toEqual([{ edition: 'sky', to: '1@example.com', status: 200 }]);
        expect(outcome).toMatchObject({ kind: 'provider', result: { kind: 'sent' }, recipient: { edition: 'sky' } });
      } else {
        expect(queue.posts).toHaveLength(1);
        expect(outcome).toEqual({ kind: 'withdrawn', recheck: 'released' });
      }
      // Before the first POST and again after the backoff.
      expect(queue.recheck).toHaveBeenCalledTimes(2);
    }
  });

  it('keeps the chart edition through a 429 retry while it stays eligible', async () => {
    const queue = weeklyQueue({
      responses: [() => Response.json({ name: 'rate_limit_exceeded', statusCode: 429 }, { status: 429 })],
    });
    queue.sleep.mockImplementation(async () => undefined);
    const outcome = await queue.dispatch();
    expect(queue.posts.map((post) => post.edition)).toEqual(['chart', 'chart']);
    expect(outcome).toMatchObject({ kind: 'provider', result: { kind: 'sent' }, recipient: { edition: 'chart' } });
    expect(queue.recheck).toHaveBeenCalledTimes(2);
    expect(queue.reauthorize).not.toHaveBeenCalled();
  });

  it('sends nothing and stops when the recheck cannot be read', async () => {
    const queue = weeklyQueue({});
    queue.recheck.mockRejectedValueOnce(new Error('database down'));
    await expect(queue.dispatch()).rejects.toBeInstanceOf(WeeklyDispatchRecheckError);
    expect(queue.posts).toEqual([]);
    expect(queue.reauthorize).not.toHaveBeenCalled();
  });

  it('withdraws a rebuilt chart edition at most once more, then leaves it to be cancelled', async () => {
    const queue = weeklyQueue({});
    // The account keeps a chart edition, but its chart changes every time it is checked.
    queue.recheck.mockImplementation(async () => {
      queue.db.status = 'reserved';
      return 'released';
    });
    queue.reauthorize.mockImplementation(async () => {
      queue.db.status = 'dispatching';
      const recipient = { userId: PERSON, edition: 'chart' as Edition };
      return { authorized: true, recipient, prepared: prepare(recipient) };
    });
    await expect(queue.dispatch()).resolves.toEqual({ kind: 'withdrawn', recheck: 'released' });
    expect(queue.posts).toEqual([]);
    expect(queue.reauthorize).toHaveBeenCalledOnce();
  });

  it('lets a recovery replay make its first attempt and rechecks every retry', async () => {
    let time = 0;
    const posts: number[] = [];
    const fetcher = vi.fn(async () => {
      posts.push(posts.length);
      return Response.json({ name: 'rate_limit_exceeded', statusCode: 429 }, { status: 429 });
    });
    const request = createWeeklyDigestResendRequest(fetcher as typeof fetch, {
      now: () => time,
      sleep: async (milliseconds) => { time += milliseconds; },
      maxRetries: 3,
      timeoutSignal: () => new AbortController().signal,
    });
    const recheck = vi.fn(async (): Promise<WeeklyDispatchRecheck> => 'reconciliation');
    const guard = weeklyAttemptGuard(recheck, { fromAttempt: 1 });
    await expect(sendWeeklyDigestEnvelope(
      prepare({ userId: PERSON, edition: 'chart' }).envelope,
      'resend_test_key',
      request,
      guard.control,
    )).rejects.toMatchObject({ outcome: 'withdrawn', attempt: 1 });
    expect(posts).toHaveLength(1);
    expect(recheck).toHaveBeenCalledOnce();
    expect(guard.last()).toBe('reconciliation');
  });

  it('accepts only the recheck answers the database defines', () => {
    for (const answer of ['dispatch', 'released', 'cancelled', 'reconciliation', 'missing']) {
      expect(weeklyDispatchRecheck(answer)).toBe(answer);
    }
    for (const answer of [null, true, 'sent', '']) {
      expect(() => weeklyDispatchRecheck(answer)).toThrow('invalid result');
    }
  });

  it('is wired into the weekly sender for new deliveries and recovery retries', async () => {
    const sender = await readFile(resolve(process.cwd(), 'scripts/send-weekly-digest.ts'), 'utf8');
    expect(sender).toContain("supabase.rpc('weekly_digest_dispatch_recheck_v1'");
    expect(sender).toContain('dispatched = await dispatchWeeklyWithRecheck({');
    expect(sender).toContain('isChartEdition: (current) => current.charts.length > 0,');
    expect(sender).toContain('{ fromAttempt: 1 },');
    expect(sender).not.toContain('sendAndFinalize(');
  });
});
