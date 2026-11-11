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
    // Nothing was accepted, so it is rebuilt by the next run rather than replayed.
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

  it('rechecks a recovery replay before its first attempt, not only its retries', async () => {
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
    expect(posts).toEqual([]);
    expect(recheck).toHaveBeenCalledOnce();
  });

  it('sends nothing for a recovery replay whose first recheck cannot be read', async () => {
    let time = 0;
    const fetcher = vi.fn(async () => Response.json({ id: 'receipt' }));
    const request = createWeeklyDigestResendRequest(fetcher as typeof fetch, {
      now: () => time,
      sleep: async (milliseconds) => { time += milliseconds; },
      timeoutSignal: () => new AbortController().signal,
    });
    await expect(replayWeeklyRecovery({
      envelope: prepare({ userId: PERSON, edition: 'chart' }).envelope,
      recheck: async () => { throw new Error('database down'); },
      apiKey: 'resend_test_key',
      request,
    })).rejects.toBeInstanceOf(WeeklyDispatchRecheckError);
    expect(fetcher).not.toHaveBeenCalled();
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
    // No unchecked replay exists: the guard has no attempt to skip.
    expect(sender).not.toContain('fromAttempt');
    const library = await readFile(resolve(process.cwd(), 'src/lib/weekly-digest/dispatch-recheck.ts'), 'utf8');
    expect(library).not.toContain('fromAttempt');
    expect(library).not.toMatch(/beforeAttempt\(attempt\)/);
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
  it('is released after exhausted 429s, so recovery finds nothing to replay', async () => {
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

  it('reports a release that could not be made, and its recovery sends no chart after a withdrawal during pacing', async () => {
    const store = deliveryStore();
    store.releaseRejected.mockRejectedValueOnce(new Error('database down'));
    const { run, error } = await exhaustedChartRun(store);
    expect(error).toBeInstanceOf(WeeklyChartRejectedError);
    expect(error).toMatchObject({ release: 'failed' });
    expect(run.posts).toHaveLength(4);
    // Left in dispatching with its envelope; the next run's recovery claims
    // it while the account is still eligible.
    expect(store.db.status).toBe('dispatching');
    const envelope = store.recover();
    expect(envelope).not.toBeNull();
    if (!envelope) throw new Error('fixture must be claimed');

    // Chart emails are withdrawn while the replay waits for pacing behind
    // another recovered delivery.
    const recovery = senderRun([], () => {
      store.db.edition = 'sky';
    });
    await sendWeeklyDigestEnvelope(prepare({ userId: OTHER, edition: 'sky' }).envelope, 'resend_test_key', recovery.request);
    store.recheck.mockClear();
    const outcome = await replayWeeklyRecovery({
      envelope,
      recheck: store.recheck,
      apiKey: 'resend_test_key',
      request: recovery.request,
    });
    expect(recovery.sleep).toHaveBeenCalledWith(250);
    expect(outcome).toEqual({ kind: 'withdrawn', recheck: 'reconciliation' });
    expect(recovery.posts.filter((post) => post.edition === 'chart')).toEqual([]);
    expect(store.recheck).toHaveBeenCalledOnce();
    expect(store.db).toMatchObject({ status: 'reconciliation', envelope: null });
  });

  it('sends no chart from recovery when the recheck and the release both failed and nothing was ever posted', async () => {
    const store = deliveryStore();
    store.reserve();
    const authorized = store.authorize();
    if (!authorized.authorized) throw new Error('fixture must authorize');
    store.recheck.mockRejectedValueOnce(new Error('database down'));
    store.releaseRejected.mockRejectedValueOnce(new Error('database down'));
    const first = senderRun([]);
    const error = await dispatchStored(store, first, authorized).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WeeklyDispatchRecheckError);
    expect(error).toMatchObject({ release: 'failed' });
    // Zero original POSTs, yet the row is still dispatching with its envelope.
    expect(first.posts).toEqual([]);
    expect(store.db.status).toBe('dispatching');
    const envelope = store.recover();
    if (!envelope) throw new Error('fixture must be claimed');

    const recovery = senderRun([], () => {
      store.db.edition = 'sky';
    });
    await sendWeeklyDigestEnvelope(prepare({ userId: OTHER, edition: 'sky' }).envelope, 'resend_test_key', recovery.request);
    const outcome = await replayWeeklyRecovery({
      envelope,
      recheck: store.recheck,
      apiKey: 'resend_test_key',
      request: recovery.request,
    });
    expect(outcome).toEqual({ kind: 'withdrawn', recheck: 'reconciliation' });
    expect(recovery.posts.filter((post) => post.edition === 'chart')).toEqual([]);
    expect(store.db.status).toBe('reconciliation');
  });

  it('replays a recovered chart edition that is still eligible, after rechecking it', async () => {
    const store = deliveryStore();
    store.releaseRejected.mockRejectedValueOnce(new Error('database down'));
    await exhaustedChartRun(store);
    const envelope = store.recover();
    if (!envelope) throw new Error('fixture must be claimed');
    store.recheck.mockClear();
    const recovery = senderRun([]);
    const outcome = await replayWeeklyRecovery({
      envelope,
      recheck: store.recheck,
      apiKey: 'resend_test_key',
      request: recovery.request,
    });
    expect(outcome).toMatchObject({ kind: 'provider', result: { kind: 'sent' } });
    expect(recovery.posts).toEqual([{ edition: 'chart', to: '1@example.com', status: 200 }]);
    expect(store.recheck).toHaveBeenCalledOnce();
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
    // Every attempt rechecked, the first included.
    expect(run.posts).toHaveLength(4);
    expect(store.recheck).toHaveBeenCalledTimes(4);
    expect(store.db.status).toBe('dispatching');
  });
});

describe('weekly recovery is default-deny for unchecked replay', () => {
  const unavailable = () => Response.json({ name: 'application_error', statusCode: 503 }, { status: 503 });
  const conflict = () => Response.json({ name: 'concurrent_idempotent_requests', statusCode: 409 }, { status: 409 });
  const unauthorized = () => Response.json({ name: 'missing_api_key', statusCode: 401 }, { status: 401 });
  const reset = (): Response => { throw new Error('connection reset'); };

  /**
   * Every way a delivery can be left in dispatching for recovery: an
   * ambiguous outcome after a POST (the original may have been accepted), and
   * every failed cleanup of a definitive rejection or a failed recheck,
   * including one with zero original POSTs.
   */
  const states: Array<{
    name: string;
    responses: Array<() => Response>;
    recheckFails?: 'first' | 'second';
    releaseFails?: boolean;
    originalPosts: number;
  }> = [
    // The fetch stand-in throws before a response is recorded, so it counts no POST.
    { name: 'transport failure', responses: [reset], originalPosts: 0 },
    { name: '503 after a POST', responses: [unavailable], originalPosts: 1 },
    { name: '409 after a POST', responses: [conflict], originalPosts: 1 },
    { name: '429 then 503', responses: [rateLimited, unavailable], originalPosts: 2 },
    { name: 'exhausted 429s, release failed', responses: [rateLimited, rateLimited, rateLimited, rateLimited], releaseFails: true, originalPosts: 4 },
    { name: 'definitive 401, release failed', responses: [unauthorized], releaseFails: true, originalPosts: 1 },
    { name: 'initial recheck failed, release failed', responses: [], recheckFails: 'first', releaseFails: true, originalPosts: 0 },
    { name: 'recheck failed after a 429, release failed', responses: [rateLimited], recheckFails: 'second', releaseFails: true, originalPosts: 1 },
  ];
  const withdrawals = ['before-claim', 'pacing', 'backoff', 'recheck-unreadable', 'none'] as const;

  it.each(states.flatMap((state) => withdrawals.map((withdrawal) => [state.name, withdrawal, state] as const)))(
    '%s, withdrawal %s: no chart POST after the withdrawal, and none without a recheck',
    async (_name, withdrawal, state) => {
      const store = deliveryStore();
      store.reserve();
      const authorized = store.authorize();
      if (!authorized.authorized) throw new Error('fixture must authorize');
      if (state.recheckFails === 'first') store.recheck.mockRejectedValueOnce(new Error('database down'));
      if (state.recheckFails === 'second') {
        store.recheck
          .mockImplementationOnce(async () => 'dispatch')
          .mockRejectedValueOnce(new Error('database down'));
      }
      if (state.releaseFails) store.releaseRejected.mockRejectedValueOnce(new Error('database down'));
      const original = senderRun(state.responses);
      await dispatchStored(store, original, authorized).catch(() => undefined);
      expect(original.posts).toHaveLength(state.originalPosts);
      // Every such state is left in dispatching with its sealed envelope.
      expect(store.db.status).toBe('dispatching');

      // The recovery run, with weekly_digest_dispatch_recheck_v1 as it answers
      // a recovered row. Each POST must follow a recheck that answered dispatch.
      let withdrawn = false;
      let armed = false;
      const withdraw = () => {
        withdrawn = true;
        store.db.edition = 'sky';
      };
      const recheck = vi.fn(async (): Promise<WeeklyDispatchRecheck> => {
        if (withdrawal === 'recheck-unreadable') throw new Error('database down');
        if (store.db.status !== 'dispatching') return 'missing';
        if (store.db.edition === store.db.authorized) {
          armed = true;
          return 'dispatch';
        }
        store.db.envelope = null;
        store.db.status = 'reconciliation';
        return 'reconciliation';
      });
      if (withdrawal === 'before-claim') withdraw();
      const envelope = store.recover();
      if (!envelope) {
        expect(withdrawal).toBe('before-claim');
        expect(store.db.status).toBe('reconciliation');
        return;
      }
      let waits = 0;
      const recovery = senderRun(withdrawal === 'backoff' ? [rateLimited] : [], () => {
        waits += 1;
        if ((withdrawal === 'pacing' || withdrawal === 'backoff') && waits === 1) withdraw();
      });
      if (withdrawal === 'pacing') {
        await sendWeeklyDigestEnvelope(prepare({ userId: OTHER, edition: 'sky' }).envelope, 'resend_test_key', recovery.request);
      }
      const replayed: Array<{ edition: string; afterWithdrawal: boolean; rechecked: boolean }> = [];
      const postsBefore = recovery.posts.length;
      const tracked: typeof recovery.request = async (input, init, control) => recovery.request(input, init, {
        async beforeAttempt(attempt) {
          const allowed = control?.beforeAttempt ? await control.beforeAttempt(attempt) : true;
          if (allowed) {
            replayed.push({ edition: 'chart', afterWithdrawal: withdrawn, rechecked: armed });
            armed = false;
          }
          return allowed;
        },
      });
      const outcome = await replayWeeklyRecovery({
        envelope,
        recheck,
        apiKey: 'resend_test_key',
        request: tracked,
      }).catch((caught: unknown) => caught);

      const chartPosts = recovery.posts.slice(postsBefore).filter((post) => post.edition === 'chart');
      expect(chartPosts).toHaveLength(replayed.length);
      // The sender keeps no durable "sent, outcome unknown" record, so the set
      // of envelopes allowed an unchecked replay is empty: whatever the
      // original outcome, no chart POST follows a withdrawal, and every chart
      // POST of the replay followed a recheck that answered dispatch.
      expect(replayed.filter((post) => post.afterWithdrawal)).toEqual([]);
      expect(replayed.every((post) => post.rechecked)).toBe(true);
      expect(recheck.mock.calls.length).toBeGreaterThanOrEqual(replayed.length);
      if (withdrawal === 'none') {
        expect(outcome).toMatchObject({ kind: 'provider', result: { kind: 'sent' } });
        expect(chartPosts).toHaveLength(1);
      } else if (withdrawal === 'recheck-unreadable') {
        expect(outcome).toBeInstanceOf(WeeklyDispatchRecheckError);
        expect(chartPosts).toEqual([]);
      } else {
        expect(outcome).toEqual({ kind: 'withdrawn', recheck: 'reconciliation' });
        expect(store.db).toMatchObject({ status: 'reconciliation', envelope: null });
        // Only the backoff case reached a POST, the one answered with 429 before the withdrawal.
        expect(chartPosts.map((post) => post.status)).toEqual(withdrawal === 'backoff' ? [429] : []);
      }
    },
  );
});
