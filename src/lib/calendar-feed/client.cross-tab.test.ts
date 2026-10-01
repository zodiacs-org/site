import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CALENDAR_FEEDS_STORAGE_KEY, CALENDAR_FEED_STORAGE_FENCE_KEY, createCalendarFeed, readAvailableCalendarFeeds,
  readKeptCalendarFeeds, watchCalendarFeeds, calendarFeedClearEpoch,
} from './client';
import { clearAllZodiacsDataFromDevice } from '../account-v2/profile-boundary';
import { ACCOUNT_V2_PROFILE_LOCK_NAME, runExclusiveAccountProfileTransition } from '../account-v2/profile-lease';

// Two independently activated browser documents share storage and Web Locks.
// Storage events are deliberately not delivered unless a test dispatches one.
class SharedStorage {
  values = new Map<string, string>();
  refuseReads = false;
  refuseWrites = false;
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) {
    if (this.refuseReads) throw new Error('Reads refused');
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.refuseWrites) throw new Error('Writes refused');
    this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
}

type LockOptions = { mode: 'shared' | 'exclusive'; signal?: AbortSignal };
class Locks {
  private queues = new Map<string, Array<() => void>>();
  private active = new Map<string, number>();
  private exclusive = new Set<string>();
  waiting(name: string) { return this.queues.get(name)?.length ?? 0; }
  request<T>(name: string, options: LockOptions, run: (lock: unknown) => T | Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queue = this.queues.get(name) ?? [];
      this.queues.set(name, queue);
      const attempt = () => {
        if (options.signal?.aborted) { reject(new Error('Aborted')); return; }
        if (this.exclusive.has(name) || (options.mode === 'exclusive' && (this.active.get(name) ?? 0) > 0)) {
          queue.push(attempt); return;
        }
        this.active.set(name, (this.active.get(name) ?? 0) + 1);
        if (options.mode === 'exclusive') this.exclusive.add(name);
        void Promise.resolve().then(() => run({ name, mode: options.mode })).then(resolve, reject).finally(() => {
          this.active.set(name, this.active.get(name)! - 1);
          if (options.mode === 'exclusive') this.exclusive.delete(name);
          queue.splice(0).forEach((next) => next());
        });
      };
      attempt();
    });
  }
}
const ID = 'Zq3xPq0Jr9Vb_Tm2-Ka5sA';
const SECRET = `${'k'.repeat(42)}A`;
const fixture = { id: ID, url: `https://zodiacs.org/api/calendar/feeds/${ID}`, secret: SECRET };
const response = () => new Response(JSON.stringify(fixture), { status: 201 });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
let storage: SharedStorage;
let locks: Locks;
let first: ReturnType<typeof tab>;
let second: ReturnType<typeof tab>;
function tab() {
  const navigator = { onLine: true, locks };
  const local = Object.create(storage) as SharedStorage;
  return {
    document: new EventTarget(), navigator, storage: local,
    window: Object.assign(new EventTarget(), { localStorage: local, navigator }),
  };
}
function activate(context: ReturnType<typeof tab>) {
  vi.stubGlobal('window', context.window);
  vi.stubGlobal('document', context.document);
  vi.stubGlobal('localStorage', context.storage);
  vi.stubGlobal('navigator', context.navigator);
}
async function clearInSecondTab() {
  activate(second);
  const result = await runExclusiveAccountProfileTransition(second.storage, () =>
    clearAllZodiacsDataFromDevice(second.storage, new SharedStorage()), locks);
  expect(result).toMatchObject({ ok: true, value: { ok: true } });
}
beforeEach(() => {
  storage = new SharedStorage(); locks = new Locks(); first = tab(); second = tab(); activate(first);
});
afterEach(() => vi.unstubAllGlobals());

describe('cross-document calendar erasure fencing', () => {
  it.each(['dropped', 'delayed'])('does not restore a fresh pending feed after another tab clears data with %s signals', async (signals) => {
    const pending = deferred<Response>();
    const started = vi.fn(() => pending.promise);
    const request = createCalendarFeed('synthetic-positions', started as typeof fetch);
    await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
    await clearInSecondTab();
    activate(first);
    pending.resolve(response());
    expect(await request).toEqual({ state: 'cancelled' });
    expect(readKeptCalendarFeeds()).toEqual([]);
    expect(readAvailableCalendarFeeds()).toEqual([]);
    if (signals === 'delayed') first.window.dispatchEvent(Object.assign(new Event('storage'), { key: null }));
    expect(storage.getItem(CALENDAR_FEEDS_STORAGE_KEY)).toBeNull();
  });

  it('reconciles cached keys on an unmounted offline document before remount, without an event', async () => {
    const made = await createCalendarFeed('synthetic-positions', (async () => response()) as typeof fetch);
    expect(made.state).toBe('created');
    const stop = watchCalendarFeeds(vi.fn());
    stop();
    first.navigator.onLine = false;
    await clearInSecondTab();
    activate(first);
    expect(readAvailableCalendarFeeds()).toEqual([]);
  });

  it('clears cached keys when a BFCache document resumes after missed signals', async () => {
    await createCalendarFeed('synthetic-positions', (async () => response()) as typeof fetch);
    const observer = vi.fn();
    watchCalendarFeeds(observer);
    first.window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }));
    await clearInSecondTab();
    activate(first);
    const previous = observer.mock.calls.length;
    first.window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    expect(observer.mock.calls.length).toBeGreaterThan(previous);
    expect(readAvailableCalendarFeeds()).toEqual([]);
  });

  it('fences a still-mounted callback before delayed storage events are delivered', async () => {
    await createCalendarFeed('synthetic-positions', (async () => response()) as typeof fetch);
    const epoch = calendarFeedClearEpoch();
    await clearInSecondTab();
    activate(first);
    expect(calendarFeedClearEpoch()).toBeGreaterThan(epoch);
  });

  it('rejects an absent-to-new-random fence without losing a legitimate post-clear feed', async () => {
    const pending = deferred<Response>();
    const started = vi.fn(() => pending.promise);
    const old = createCalendarFeed('old-synthetic-positions', started as typeof fetch);
    await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
    const fence = storage.getItem(CALENDAR_FEED_STORAGE_FENCE_KEY);
    expect(fence).toBeTruthy();
    await clearInSecondTab();
    expect(storage.getItem(CALENDAR_FEED_STORAGE_FENCE_KEY)).toBeNull();
    const id = 'Ab3xPq0Jr9Vb_Tm2-Ka5sQ';
    const fresh = await createCalendarFeed('new-synthetic-positions', (async () => new Response(JSON.stringify({
      ...fixture, id, url: `https://zodiacs.org/api/calendar/feeds/${id}`,
    }), { status: 201 })) as typeof fetch);
    expect(fresh.state === 'created' && fresh.kept).toBe(true);
    expect(storage.getItem(CALENDAR_FEED_STORAGE_FENCE_KEY)).not.toBe(fence);
    activate(first);
    pending.resolve(response());
    expect(await old).toEqual({ state: 'cancelled' });
    expect(readKeptCalendarFeeds().map((feed) => feed.id)).toEqual([id]);
  });

  it.each(['reads', 'writes', 'locks'])('never upgrades an unfenced request after %s recover', async (fault) => {
    if (fault === 'reads') first.storage.refuseReads = true;
    if (fault === 'writes') first.storage.refuseWrites = true;
    if (fault === 'locks') vi.stubGlobal('navigator', { onLine: true });
    const pending = deferred<Response>();
    const started = vi.fn(() => pending.promise);
    const request = createCalendarFeed('synthetic-positions', started as typeof fetch);
    await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
    first.storage.refuseReads = false; first.storage.refuseWrites = false;
    await clearInSecondTab();
    activate(first);
    pending.resolve(response());
    const result = await request;
    expect(result.state === 'created' && result.kept).toBe(false);
    expect(readKeptCalendarFeeds()).toEqual([]);
    expect(storage.getItem(CALENDAR_FEED_STORAGE_FENCE_KEY)).toBeNull();
    // No erasure was observable in this never-fenced document. Preserve only
    // its volatile removal key, rather than pretending it can be kept safely.
    expect(readAvailableCalendarFeeds()).toHaveLength(1);
  });

  it('does not retry persistence after a final read refusal clears', async () => {
    const pending = deferred<Response>();
    const started = vi.fn(() => pending.promise);
    const request = createCalendarFeed('synthetic-positions', started as typeof fetch);
    await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
    first.storage.refuseReads = true;
    pending.resolve(response());
    const result = await request;
    expect(result.state === 'created' && result.kept).toBe(false);
    first.storage.refuseReads = false;
    first.window.dispatchEvent(new Event('focus'));
    expect(readAvailableCalendarFeeds()).toHaveLength(1);
    expect(readKeptCalendarFeeds()).toEqual([]);
  });

  it('does not overwrite older keys when only the feed-record read is refused', async () => {
    await createCalendarFeed('first-synthetic-positions', (async () => response()) as typeof fetch);
    const before = storage.getItem(CALENDAR_FEEDS_STORAGE_KEY);
    const original = first.storage.getItem.bind(first.storage);
    first.storage.getItem = (key) => {
      if (key === CALENDAR_FEEDS_STORAGE_KEY) throw new Error('Feed-record read refused');
      return original(key);
    };
    const id = 'Ab3xPq0Jr9Vb_Tm2-Ka5sQ';
    const result = await createCalendarFeed('second-synthetic-positions', (async () => new Response(JSON.stringify({
      ...fixture, id, url: `https://zodiacs.org/api/calendar/feeds/${id}`,
    }), { status: 201 })) as typeof fetch);
    expect(result.state === 'created' && result.kept).toBe(false);
    expect(storage.getItem(CALENDAR_FEEDS_STORAGE_KEY)).toBe(before);
    first.storage.getItem = original;
    expect(readAvailableCalendarFeeds()).toHaveLength(2);
    expect(readKeptCalendarFeeds().map((feed) => feed.id)).toEqual([ID]);
  });

  it('never persists an earlier unfenced volatile feed during a later successful subscribe', async () => {
    first.storage.refuseWrites = true;
    await createCalendarFeed('synthetic-positions', (async () => response()) as typeof fetch);
    first.storage.refuseWrites = false;
    const id = 'Ab3xPq0Jr9Vb_Tm2-Ka5sQ';
    await createCalendarFeed('new-synthetic-positions', (async () => new Response(JSON.stringify({
      ...fixture, id, url: `https://zodiacs.org/api/calendar/feeds/${id}`,
    }), { status: 201 })) as typeof fetch);
    expect(readAvailableCalendarFeeds()).toHaveLength(2);
    expect(readKeptCalendarFeeds().map((feed) => feed.id)).toEqual([id]);
  });

  it('waits for exclusive clear before the final compare-and-write', async () => {
    const pending = deferred<Response>();
    const started = vi.fn(() => pending.promise);
    const request = createCalendarFeed('synthetic-positions', started as typeof fetch);
    await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
    activate(second);
    const entered = deferred<void>();
    const release = deferred<void>();
    const clearing = runExclusiveAccountProfileTransition(second.storage, async () => {
      entered.resolve();
      await release.promise;
      activate(second);
      return clearAllZodiacsDataFromDevice(second.storage, new SharedStorage());
    }, locks);
    await entered.promise;
    activate(first);
    pending.resolve(response());
    await vi.waitFor(() => expect(locks.waiting(ACCOUNT_V2_PROFILE_LOCK_NAME)).toBeGreaterThan(0));
    expect(storage.getItem(CALENDAR_FEEDS_STORAGE_KEY)).toBeNull();
    release.resolve();
    expect(await clearing).toMatchObject({ ok: true, value: { ok: true } });
    activate(first);
    expect(await request).toEqual({ state: 'cancelled' });
    expect(storage.getItem(CALENDAR_FEEDS_STORAGE_KEY)).toBeNull();
  });

  it('does not recreate a vanished fence when an old preflight was queued behind clear-all', async () => {
    await createCalendarFeed('synthetic-positions', (async () => response()) as typeof fetch);
    activate(second);
    const entered = deferred<void>(); const release = deferred<void>();
    const clearing = runExclusiveAccountProfileTransition(second.storage, async () => {
      entered.resolve(); await release.promise; activate(second);
      return clearAllZodiacsDataFromDevice(second.storage, new SharedStorage());
    }, locks);
    await entered.promise;
    activate(first);
    const fetcher = vi.fn(async () => response());
    const request = createCalendarFeed('another-synthetic-positions', fetcher as typeof fetch);
    await vi.waitFor(() => expect(locks.waiting(ACCOUNT_V2_PROFILE_LOCK_NAME)).toBeGreaterThan(0));
    expect(fetcher).not.toHaveBeenCalled();
    release.resolve(); await clearing;
    activate(first);
    expect(await request).toEqual({ state: 'cancelled' });
    expect(fetcher).not.toHaveBeenCalled();
    expect([...storage.values.keys()].filter((key) => key.startsWith('zodiacs.calendar'))).toEqual([]);
  });

  it('starts a fresh never-fenced request only after an already-held clear releases its lock', async () => {
    activate(second);
    const entered = deferred<void>(); const release = deferred<void>();
    const clearing = runExclusiveAccountProfileTransition(second.storage, async () => {
      entered.resolve(); await release.promise; activate(second);
      return clearAllZodiacsDataFromDevice(second.storage, new SharedStorage());
    }, locks);
    await entered.promise;
    activate(first);
    const fetcher = vi.fn(async () => response());
    const request = createCalendarFeed('fresh-synthetic-positions', fetcher as typeof fetch);
    await vi.waitFor(() => expect(locks.waiting(ACCOUNT_V2_PROFILE_LOCK_NAME)).toBeGreaterThan(0));
    expect(fetcher).not.toHaveBeenCalled();
    expect(storage.getItem(CALENDAR_FEED_STORAGE_FENCE_KEY)).toBeNull();
    release.resolve();
    expect(await clearing).toMatchObject({ ok: true, value: { ok: true } });
    activate(first);
    const result = await request;
    expect(result.state === 'created' && result.kept).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('keeps both legitimate simultaneous subscriptions under the storage commit lock', async () => {
    const one = deferred<Response>(); const two = deferred<Response>();
    const firstStarted = vi.fn(() => one.promise); const secondStarted = vi.fn(() => two.promise);
    const firstRequest = createCalendarFeed('first-synthetic-positions', firstStarted as typeof fetch);
    activate(second);
    const secondRequest = createCalendarFeed('second-synthetic-positions', secondStarted as typeof fetch);
    await vi.waitFor(() => {
      expect(firstStarted).toHaveBeenCalledOnce(); expect(secondStarted).toHaveBeenCalledOnce();
    });
    const id = 'Ab3xPq0Jr9Vb_Tm2-Ka5sQ';
    one.resolve(response());
    two.resolve(new Response(JSON.stringify({ ...fixture, id, url: `https://zodiacs.org/api/calendar/feeds/${id}` }), { status: 201 }));
    const results = await Promise.all([firstRequest, secondRequest]);
    expect(results.every((result) => result.state === 'created' && result.kept)).toBe(true);
    expect(readKeptCalendarFeeds().map((feed) => feed.id).sort()).toEqual([ID, id].sort());
    const marker = storage.getItem(CALENDAR_FEED_STORAGE_FENCE_KEY)!;
    expect(marker).toMatch(/^[0-9a-f-]{36}$/);
    expect(marker).not.toContain(ID);
    expect(marker).not.toContain(SECRET);
    expect(marker).not.toContain('positions');
  });

  it('never creates a fence from a getter or an offline subscribe', async () => {
    readAvailableCalendarFeeds(); calendarFeedClearEpoch(); watchCalendarFeeds(vi.fn());
    expect(storage.getItem(CALENDAR_FEED_STORAGE_FENCE_KEY)).toBeNull();
    first.navigator.onLine = false;
    const fetcher = vi.fn(async () => response());
    expect(await createCalendarFeed('synthetic-positions', fetcher as typeof fetch)).toEqual({ state: 'offline' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(storage.getItem(CALENDAR_FEED_STORAGE_FENCE_KEY)).toBeNull();
  });
});
