import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { WeeklyAuthorization } from './chart-edition';
import {
  buildWeeklyDigestRequestEnvelope,
  createWeeklyDigestResendRequest,
  sendWeeklyDigestEnvelope,
  WeeklyDigestProviderAbortError,
  type WeeklyDigestEmail,
  type WeeklyDigestRequestEnvelope,
} from './delivery';
import {
  dispatchWeeklyWithRecheck,
  replayWeeklyRecovery,
  WeeklyChartRejectedError,
  weeklyDispatchRecheck,
  WeeklyDispatchRecheckError,
  weeklyRejectedRelease,
  type WeeklyDispatchRecheck,
  type WeeklyRejectedRelease,
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
  const releaseRejected = vi.fn(async (): Promise<WeeklyRejectedRelease> => {
    if (db.status !== 'dispatching') return 'missing';
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
    releaseRejected,
    apiKey: 'resend_test_key',
    request,
  });
  return { db, posts, sleep, request, recheck, releaseRejected, reauthorize, dispatch };
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

  it('sends nothing, releases the delivery and stops when the recheck cannot be read', async () => {
    const queue = weeklyQueue({});
    queue.recheck.mockRejectedValueOnce(new Error('database down'));
    await expect(queue.dispatch()).rejects.toMatchObject({
      name: 'WeeklyDispatchRecheckError',
      release: 'released',
    });
    expect(queue.posts).toEqual([]);
    expect(queue.reauthorize).not.toHaveBeenCalled();
    // Nothing was accepted, so it is not left in dispatching for the unchecked replay.
    expect(queue.db.status).toBe('reserved');
  });

  it('releases a chart edition whose recheck fails after a 429, with one chart POST', async () => {
    const queue = weeklyQueue({
      responses: [() => Response.json({ name: 'rate_limit_exceeded', statusCode: 429 }, { status: 429 })],
    });
    queue.sleep.mockImplementation(async () => undefined);
    queue.recheck
      .mockImplementationOnce(async () => 'dispatch')
      .mockRejectedValueOnce(new Error('database down'));
    const error = await queue.dispatch().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WeeklyDispatchRecheckError);
    expect(error).toMatchObject({ release: 'released' });
    expect(queue.posts).toEqual([{ edition: 'chart', to: '1@example.com', status: 429 }]);
    expect(queue.db.status).toBe('reserved');
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
    await expect(replayWeeklyRecovery({
      envelope: prepare({ userId: PERSON, edition: 'chart' }).envelope,
      recheck,
      apiKey: 'resend_test_key',
      request,
    })).resolves.toEqual({ kind: 'withdrawn', recheck: 'reconciliation' });
    expect(posts).toHaveLength(1);
    expect(recheck).toHaveBeenCalledOnce();
  });

  it('accepts only the recheck and release answers the database defines', () => {
    for (const answer of ['dispatch', 'released', 'cancelled', 'reconciliation', 'missing']) {
      expect(weeklyDispatchRecheck(answer)).toBe(answer);
    }
    for (const answer of [null, true, 'sent', '']) {
      expect(() => weeklyDispatchRecheck(answer)).toThrow('invalid result');
    }
    for (const answer of ['released', 'cancelled', 'missing']) {
      expect(weeklyRejectedRelease(answer)).toBe(answer);
    }
    for (const answer of [null, 'dispatch', 'reconciliation', '']) {
      expect(() => weeklyRejectedRelease(answer)).toThrow('invalid result');
    }
  });

  it('is wired into the weekly sender for new deliveries and recovery retries', async () => {
    const sender = await readFile(resolve(process.cwd(), 'scripts/send-weekly-digest.ts'), 'utf8');
    expect(sender).toContain("supabase.rpc('weekly_digest_dispatch_recheck_v1'");
    expect(sender).toContain('dispatched = await dispatchWeeklyWithRecheck({');
    expect(sender).toContain('isChartEdition: (current) => current.charts.length > 0,');
    expect(sender).toContain("supabase.rpc('weekly_digest_release_rejected_v1'");
    expect(sender).toContain('releaseRejected: () => releaseRejectedWeeklyDelivery(');
    expect(sender).toContain('replayed = await replayWeeklyRecovery({');
    expect(sender).toContain('if (error instanceof WeeklyChartRejectedError) releasedProviderBatch(error);');
    // The replay exception lives in one place, used only by recovery.
    expect(sender).not.toContain('fromAttempt');
    expect(sender).not.toContain('sendWeeklyDigestEnvelope(');
    expect(sender).not.toContain('sendAndFinalize(');
  });
});


const rateLimited = () => Response.json(
  { name: 'rate_limit_exceeded', statusCode: 429, message: 'slow down' },
  { status: 429, headers: { 'Retry-After': '1' } },
);

/**
 * One account's weekly delivery across sender runs, as the database functions
 * move it: issue and authorization from current content
 * (weekly_digest_issue_v1, weekly_digest_authorized_v1), the recheck
 * (weekly_digest_dispatch_recheck_v1), the release of a definitively rejected
 * dispatch (weekly_digest_release_rejected_v1), the recovery claim, which
 * takes only a row still in dispatching (weekly_digest_recover_v1), and the
 * prune of a stale reservation (weekly_digest_prune_v1).
 */
function deliveryStore() {
  const db = {
    edition: 'chart' as Edition,
    authorized: null as Edition | null,
    status: 'none' as 'none' | 'reserved' | 'dispatching' | 'sent' | 'reconciliation',
    recovered: false,
    envelope: null as WeeklyDigestRequestEnvelope | null,
  };
  const authorize = (): WeeklyAuthorization<Recipient, Prepared> => {
    if (db.status !== 'reserved') return { authorized: false };
    const recipient = { userId: PERSON, edition: db.edition };
    const prepared = prepare(recipient);
    db.authorized = db.edition;
    db.envelope = prepared.envelope;
    db.status = 'dispatching';
    return { authorized: true, recipient, prepared };
  };
  return {
    db,
    reserve() {
      if (db.status !== 'none') return false;
      db.status = 'reserved';
      return true;
    },
    authorize,
    reauthorize: vi.fn(async () => authorize()),
    recheck: vi.fn(async (): Promise<WeeklyDispatchRecheck> => {
      if (db.status !== 'dispatching') return 'missing';
      if (db.edition === db.authorized) return 'dispatch';
      db.envelope = null;
      if (db.recovered) {
        db.status = 'reconciliation';
        return 'reconciliation';
      }
      db.status = 'reserved';
      return 'released';
    }),
    releaseRejected: vi.fn(async (): Promise<WeeklyRejectedRelease> => {
      if (db.status !== 'dispatching' || db.recovered) return 'missing';
      db.status = 'reserved';
      db.envelope = null;
      return 'released';
    }),
    recover(): WeeklyDigestRequestEnvelope | null {
      if (db.status !== 'dispatching' || !db.envelope) return null;
      if (db.edition !== db.authorized) {
        db.status = 'reconciliation';
        return null;
      }
      db.recovered = true;
      return db.envelope;
    },
    prune() {
      if (db.status === 'reserved') db.status = 'none';
    },
  };
}

/** The real weekly provider queue for one run; fetch and the clock are stand-ins. */
function senderRun(responses: Array<() => Response>, onWait: () => void = () => undefined) {
  let time = 1_000;
  const posts: Array<{ edition: string; to: string; status: number }> = [];
  const queued = [...responses];
  const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { subject: string; to: string[] };
    const response = (queued.shift() ?? (() => Response.json({ id: `receipt-${posts.length + 1}` })))();
    posts.push({ edition: body.subject.split(' ')[1]!, to: body.to[0]!, status: response.status });
    return response;
  });
  const sleep = vi.fn(async (milliseconds: number) => {
    time += milliseconds;
    onWait();
  });
  const request = createWeeklyDigestResendRequest(fetcher as typeof fetch, {
    now: () => time,
    sleep,
    minIntervalMs: 250,
    maxRetries: 3,
    timeoutSignal: () => new AbortController().signal,
  });
  return { posts, sleep, request };
}

function dispatchStored(
  store: ReturnType<typeof deliveryStore>,
  run: ReturnType<typeof senderRun>,
  authorized: { recipient: Recipient; prepared: Prepared },
) {
  return dispatchWeeklyWithRecheck<Recipient, Prepared>({
    authorized,
    reauthorize: store.reauthorize,
    isChartEdition: (recipient) => recipient.edition === 'chart',
    recheck: store.recheck,
    releaseRejected: store.releaseRejected,
    apiKey: 'resend_test_key',
    request: run.request,
  });
}

/** A first run whose chart edition the provider rejects with 429 four times. */
async function exhaustedChartRun(store: ReturnType<typeof deliveryStore>) {
  expect(store.reserve()).toBe(true);
  const authorized = store.authorize();
  if (!authorized.authorized) throw new Error('fixture must authorize');
  const run = senderRun([rateLimited, rateLimited, rateLimited, rateLimited]);
  const error = await dispatchStored(store, run, authorized).catch((caught: unknown) => caught);
  return { run, error };
}

describe('a weekly chart edition the provider definitively rejected', () => {
  it('is released after exhausted 429s, so recovery never replays it unchecked', async () => {
    const store = deliveryStore();
    const { run, error } = await exhaustedChartRun(store);
    expect(error).toBeInstanceOf(WeeklyChartRejectedError);
    expect(error).toMatchObject({
      release: 'released',
      abort: { reason: 'provider-response', status: 429, code: 'rate_limit_exceeded', definitive: true },
    });
    // Four explicit 429s, each attempt rechecked first; nothing accepted.
    expect(run.posts).toEqual(Array.from({ length: 4 }, () => ({ edition: 'chart', to: '1@example.com', status: 429 })));
    expect(store.recheck).toHaveBeenCalledTimes(4);
    expect(store.releaseRejected).toHaveBeenCalledOnce();
    expect(store.db).toMatchObject({ status: 'reserved', envelope: null });
    // The next run's recovery claim finds nothing to replay.
    expect(store.recover()).toBeNull();
  });

  it('sends no chart after chart emails are withdrawn during the next run\'s pacing wait', async () => {
    for (const rebuildAuthorized of [true, false]) {
      const store = deliveryStore();
      const { error } = await exhaustedChartRun(store);
      expect(error).toBeInstanceOf(WeeklyChartRejectedError);

      // Next run: recovery first (nothing to claim), then the stale
      // reservation is pruned and the account is a candidate again. Its
      // content still holds the chart, so the chart edition is authorized.
      expect(store.recover()).toBeNull();
      store.prune();
      expect(store.reserve()).toBe(true);
      const authorized = store.authorize();
      expect(authorized).toMatchObject({ authorized: true, recipient: { edition: 'chart' } });
      if (!authorized.authorized) throw new Error('fixture must authorize');
      if (!rebuildAuthorized) store.reauthorize.mockResolvedValueOnce({ authorized: false });

      // Chart emails are withdrawn while the chart edition waits for pacing
      // behind another recipient's email.
      const next = senderRun([], () => {
        store.db.edition = 'sky';
      });
      await sendWeeklyDigestEnvelope(prepare({ userId: OTHER, edition: 'sky' }).envelope, 'resend_test_key', next.request);
      const outcome = await dispatchStored(store, next, authorized);

      expect(next.sleep).toHaveBeenCalledWith(250);
      expect(next.posts.filter((post) => post.edition === 'chart')).toEqual([]);
      if (rebuildAuthorized) {
        expect(outcome).toMatchObject({ kind: 'provider', result: { kind: 'sent' }, recipient: { edition: 'sky' } });
        expect(next.posts).toEqual([
          { edition: 'sky', to: '2@example.com', status: 200 },
          { edition: 'sky', to: '1@example.com', status: 200 },
        ]);
      } else {
        expect(outcome).toEqual({ kind: 'withdrawn', recheck: 'released' });
        expect(next.posts).toHaveLength(1);
      }
    }
  });

  it('sends no chart after chart emails are withdrawn during a 429 backoff of the next run', async () => {
    const store = deliveryStore();
    await exhaustedChartRun(store);
    store.prune();
    store.reserve();
    const authorized = store.authorize();
    if (!authorized.authorized) throw new Error('fixture must authorize');
    const next = senderRun([rateLimited], () => {
      store.db.edition = 'sky';
    });
    const outcome = await dispatchStored(store, next, authorized);
    expect(next.posts).toEqual([
      { edition: 'chart', to: '1@example.com', status: 429 },
      { edition: 'sky', to: '1@example.com', status: 200 },
    ]);
    expect(outcome).toMatchObject({ kind: 'provider', recipient: { edition: 'sky' } });
  });

  it('leaves an ambiguous outcome for the recovery replay and never releases it', async () => {
    for (const last of [
      () => Response.json({ name: 'application_error', statusCode: 503 }, { status: 503 }),
      () => Response.json({ name: 'concurrent_idempotent_requests', statusCode: 409 }, { status: 409 }),
      () => { throw new Error('connection reset'); },
    ]) {
      const store = deliveryStore();
      store.reserve();
      const authorized = store.authorize();
      if (!authorized.authorized) throw new Error('fixture must authorize');
      const run = senderRun([rateLimited, last]);
      const error = await dispatchStored(store, run, authorized).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(WeeklyDigestProviderAbortError);
      expect(error).toMatchObject({ definitive: false });
      expect(store.releaseRejected).not.toHaveBeenCalled();
      expect(store.db.status).toBe('dispatching');
      expect(store.recover()).not.toBeNull();
    }
  });

  it('does not release a sky edition, which holds no chart', async () => {
    const store = deliveryStore();
    store.db.edition = 'sky';
    store.reserve();
    const authorized = store.authorize();
    if (!authorized.authorized) throw new Error('fixture must authorize');
    const run = senderRun([rateLimited, rateLimited, rateLimited, rateLimited]);
    const error = await dispatchStored(store, run, authorized).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WeeklyDigestProviderAbortError);
    expect(error).toMatchObject({ definitive: true });
    expect(store.recheck).not.toHaveBeenCalled();
    expect(store.releaseRejected).not.toHaveBeenCalled();
    expect(store.db.status).toBe('dispatching');
  });

  it('reports a release that could not be made', async () => {
    const store = deliveryStore();
    store.releaseRejected.mockRejectedValueOnce(new Error('database down'));
    const { error } = await exhaustedChartRun(store);
    expect(error).toBeInstanceOf(WeeklyChartRejectedError);
    expect(error).toMatchObject({ release: 'failed' });
  });

  it('never releases a recovery replay, whatever the provider answers it', async () => {
    const store = deliveryStore();
    store.reserve();
    store.authorize();
    const envelope = store.recover();
    if (!envelope) throw new Error('fixture must be claimed');
    const run = senderRun([rateLimited, rateLimited, rateLimited, rateLimited]);
    const error = await replayWeeklyRecovery({
      envelope,
      recheck: store.recheck,
      apiKey: 'resend_test_key',
      request: run.request,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WeeklyDigestProviderAbortError);
    expect(store.releaseRejected).not.toHaveBeenCalled();
    // First attempt unchecked (the ambiguous replay exception), then each retry.
    expect(store.recheck).toHaveBeenCalledTimes(3);
    expect(store.db.status).toBe('dispatching');
  });
});
