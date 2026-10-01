import { CalendarIdbBackend, CalendarIdbFactory } from '../../../tests/helpers/calendar-idb';
import type { KeptCalendarFeed } from './client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCalendarFeed, readAvailableCalendarFeeds,
  readKeptCalendarFeeds, watchCalendarFeeds, calendarFeedClearEpoch, removeCalendarFeed,
} from './client';
import { clearAllZodiacsDataFromDevice } from '../account-v2/profile-boundary';
import { ACCOUNT_V2_PROFILE_LOCK_NAME, runExclusiveAccountProfileTransition } from '../account-v2/profile-lease';

// Two independently activated documents share canonical IndexedDB and Web Locks.
// Per-document factory failures are isolated. Advisory events may be dropped.
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
let backend: CalendarIdbBackend;
const canonical = () => backend.state() as { fence: string; feeds: KeptCalendarFeed[] } | undefined;
let locks: Locks;
let first: ReturnType<typeof tab>;
let second: ReturnType<typeof tab>;
function tab() {
  const navigator = { onLine: true, locks: locks as Locks | undefined };
  const factory = new CalendarIdbFactory(backend);
  const local = Object.create(storage) as SharedStorage;
  return {
    document: new EventTarget(), navigator, storage: local, factory,
    window: Object.assign(new EventTarget(), { localStorage: local, navigator, indexedDB: factory.indexedDB }),
  };
}
function activate(context: ReturnType<typeof tab>) {
  vi.stubGlobal('window', context.window);
  vi.stubGlobal('document', context.document);
  vi.stubGlobal('localStorage', context.storage);
  vi.stubGlobal('navigator', context.navigator);
  vi.stubGlobal('indexedDB', context.factory.indexedDB);
}
async function clearInSecondTab() {
  activate(second);
  const result = await runExclusiveAccountProfileTransition(second.storage, () =>
    clearAllZodiacsDataFromDevice(second.storage, new SharedStorage()), locks);
  expect(result).toMatchObject({ ok: true, value: { ok: true } });
}
beforeEach(() => {
  storage = new SharedStorage(); backend = new CalendarIdbBackend(); locks = new Locks(); first = tab(); second = tab(); activate(first);
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
    expect(await readKeptCalendarFeeds()).toEqual([]);
    expect(readAvailableCalendarFeeds()).toEqual([]);
    if (signals === 'delayed') first.window.dispatchEvent(Object.assign(new Event('storage'), { key: null }));
    expect((canonical()?.feeds ?? [])).toEqual([]);
  });

  it.each(['write', 'abort', 'blocked'] as const)('reports a failed clear with %s refusal and preserves canonical keys', async (fault) => {
    await createCalendarFeed('synthetic-positions', (async () => response()) as typeof fetch);
    const before = backend.state();
    activate(second);
    second.factory.faults[fault] = true;
    const cleared = vi.fn();
    second.window.addEventListener('zodiacs:calendar-feeds-cleared', cleared);
    const result = await runExclusiveAccountProfileTransition(second.storage, () =>
      clearAllZodiacsDataFromDevice(second.storage, new SharedStorage()), locks);
    expect(result).toMatchObject({ ok: true, value: { ok: false } });
    expect(cleared).not.toHaveBeenCalled();
    expect(backend.state()).toEqual(before);
    second.factory.faults[fault] = false;
    second.factory.releaseBlocked();
    await backend.idle();
    expect(backend.state()).toEqual(before);
    activate(first);
    expect((await readKeptCalendarFeeds()).map((feed) => feed.id)).toEqual([ID]);
    await clearInSecondTab();
    expect(backend.rows.size).toBe(0);
  });

  it('reconciles cached keys on an unmounted offline document before remount, without an event', async () => {
    const made = await createCalendarFeed('synthetic-positions', (async () => response()) as typeof fetch);
    expect(made.state).toBe('created');
    const stop = watchCalendarFeeds(vi.fn());
    stop();
    first.navigator.onLine = false;
    await clearInSecondTab();
    activate(first);
    const remount = watchCalendarFeeds(vi.fn());
    await vi.waitFor(() => expect(readAvailableCalendarFeeds()).toEqual([]));
    remount();
  });

  it('drops an authoritative removal from another document without retaining a durable echo', async () => {
    await createCalendarFeed('synthetic-positions', (async () => response()) as typeof fetch);
    activate(second);
    const [feed] = await readKeptCalendarFeeds();
    expect(await removeCalendarFeed(feed, (async () => new Response('{"removed":true}', { status: 200 })) as typeof fetch)).toBe('removed');
    activate(first);
    first.window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(readAvailableCalendarFeeds()).toEqual([]));
    expect(canonical()?.feeds).toEqual([]);
  });

  it('keeps a genuinely volatile key when a later durable record is removed in another document', async () => {
    first.factory.faults.write = true;
    const volatile = await createCalendarFeed('volatile-positions', (async () => response()) as typeof fetch);
    expect(volatile.state === 'created' && volatile.kept).toBe(false);
    first.factory.faults.write = false;
    const id = 'Ab3xPq0Jr9Vb_Tm2-Ka5sQ';
    await createCalendarFeed('durable-positions', (async () => new Response(JSON.stringify({
      ...fixture, id, url: `https://zodiacs.org/api/calendar/feeds/${id}`,
    }), { status: 201 })) as typeof fetch);
    expect(readAvailableCalendarFeeds()).toHaveLength(2);
    activate(second);
    const [feed] = await readKeptCalendarFeeds();
    expect(feed.id).toBe(id);
    await removeCalendarFeed(feed, (async () => new Response('{"removed":true}', { status: 200 })) as typeof fetch);
    activate(first);
    first.window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(readAvailableCalendarFeeds().map((feed) => feed.id)).toEqual([ID]));
    expect(canonical()?.feeds).toEqual([]);
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
    await vi.waitFor(() => expect(observer.mock.calls.length).toBeGreaterThan(previous));
    expect(readAvailableCalendarFeeds()).toEqual([]);
  });

  it('fences a still-mounted callback before delayed storage events are delivered', async () => {
    await createCalendarFeed('synthetic-positions', (async () => response()) as typeof fetch);
    const epoch = calendarFeedClearEpoch();
    await clearInSecondTab();
    activate(first);
    await readKeptCalendarFeeds();
    expect(calendarFeedClearEpoch()).toBeGreaterThan(epoch);
  });

  it('rejects an absent-to-new-random fence without losing a legitimate post-clear feed', async () => {
    const pending = deferred<Response>();
    const started = vi.fn(() => pending.promise);
    const old = createCalendarFeed('old-synthetic-positions', started as typeof fetch);
    await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
    const fence = (canonical()?.fence ?? null);
    expect(fence).toBeTruthy();
    await clearInSecondTab();
    expect((canonical()?.fence ?? null)).toBeNull();
    const id = 'Ab3xPq0Jr9Vb_Tm2-Ka5sQ';
    const fresh = await createCalendarFeed('new-synthetic-positions', (async () => new Response(JSON.stringify({
      ...fixture, id, url: `https://zodiacs.org/api/calendar/feeds/${id}`,
    }), { status: 201 })) as typeof fetch);
    expect(fresh.state === 'created' && fresh.kept).toBe(true);
    expect((canonical()?.fence ?? null)).not.toBe(fence);
    activate(first);
    pending.resolve(response());
    expect(await old).toEqual({ state: 'cancelled' });
    expect((await readKeptCalendarFeeds()).map((feed) => feed.id)).toEqual([id]);
  });

  it.each(['reads', 'writes', 'locks'])('never upgrades an unfenced request after %s recover', async (fault) => {
    if (fault === 'reads') first.factory.faults.read = true;
    if (fault === 'writes') first.factory.faults.write = true;
    if (fault === 'locks') first.navigator.locks = undefined;
    const pending = deferred<Response>();
    const started = vi.fn(() => pending.promise);
    const request = createCalendarFeed('synthetic-positions', started as typeof fetch);
    await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
    first.factory.faults.read = false; first.factory.faults.write = false;
    await clearInSecondTab();
    activate(first);
    pending.resolve(response());
    const result = await request;
    expect(result.state === 'created' && result.kept).toBe(false);
    expect(await readKeptCalendarFeeds()).toEqual([]);
    expect((canonical()?.fence ?? null)).toBeNull();
    // No erasure was observable in this never-fenced document. Preserve only
    // its volatile removal key, rather than pretending it can be kept safely.
    expect(readAvailableCalendarFeeds()).toHaveLength(1);
  });

  it('does not retry persistence after a final read refusal clears', async () => {
    const pending = deferred<Response>();
    const started = vi.fn(() => pending.promise);
    const request = createCalendarFeed('synthetic-positions', started as typeof fetch);
    await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
    first.factory.faults.read = true;
    pending.resolve(response());
    const result = await request;
    expect(result.state === 'created' && result.kept).toBe(false);
    first.factory.faults.read = false;
    first.window.dispatchEvent(new Event('focus'));
    expect(readAvailableCalendarFeeds()).toHaveLength(1);
    expect(await readKeptCalendarFeeds()).toEqual([]);
  });

  it('does not overwrite older keys when only the feed-record read is refused', async () => {
    await createCalendarFeed('first-synthetic-positions', (async () => response()) as typeof fetch);
    const before = backend.state();
    first.factory.faults.read = true;
    const id = 'Ab3xPq0Jr9Vb_Tm2-Ka5sQ';
    const result = await createCalendarFeed('second-synthetic-positions', (async () => new Response(JSON.stringify({
      ...fixture, id, url: `https://zodiacs.org/api/calendar/feeds/${id}`,
    }), { status: 201 })) as typeof fetch);
    expect(result.state === 'created' && result.kept).toBe(false);
    expect(backend.state()).toEqual(before);
    first.factory.faults.read = false;
    expect(readAvailableCalendarFeeds()).toHaveLength(2);
    expect((await readKeptCalendarFeeds()).map((feed) => feed.id)).toEqual([ID]);
  });

  it('never persists an earlier unfenced volatile feed during a later successful subscribe', async () => {
    first.factory.faults.write = true;
    await createCalendarFeed('synthetic-positions', (async () => response()) as typeof fetch);
    first.factory.faults.write = false;
    const id = 'Ab3xPq0Jr9Vb_Tm2-Ka5sQ';
    await createCalendarFeed('new-synthetic-positions', (async () => new Response(JSON.stringify({
      ...fixture, id, url: `https://zodiacs.org/api/calendar/feeds/${id}`,
    }), { status: 201 })) as typeof fetch);
    expect(readAvailableCalendarFeeds()).toHaveLength(2);
    expect((await readKeptCalendarFeeds()).map((feed) => feed.id)).toEqual([id]);
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
    expect((canonical()?.feeds ?? [])).toEqual([]);
    release.resolve();
    expect(await clearing).toMatchObject({ ok: true, value: { ok: true } });
    activate(first);
    expect(await request).toEqual({ state: 'cancelled' });
    expect((canonical()?.feeds ?? [])).toEqual([]);
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
    expect(backend.rows.size).toBe(0);
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
    expect((canonical()?.fence ?? null)).toBeNull();
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
    expect((await readKeptCalendarFeeds()).map((feed) => feed.id).sort()).toEqual([ID, id].sort());
    const marker = (canonical()?.fence ?? null)!;
    expect(marker).toMatch(/^[0-9a-f-]{36}$/);
    expect(marker).not.toContain(ID);
    expect(marker).not.toContain(SECRET);
    expect(marker).not.toContain('positions');
  });

  it('never creates a fence from a getter or an offline subscribe', async () => {
    readAvailableCalendarFeeds(); calendarFeedClearEpoch(); watchCalendarFeeds(vi.fn());
    expect((canonical()?.fence ?? null)).toBeNull();
    first.navigator.onLine = false;
    const fetcher = vi.fn(async () => response());
    expect(await createCalendarFeed('synthetic-positions', fetcher as typeof fetch)).toEqual({ state: 'offline' });
    expect(fetcher).not.toHaveBeenCalled();
    expect((canonical()?.fence ?? null)).toBeNull();
    await readKeptCalendarFeeds();
    expect(backend.exists).toBe(false);
  });
});
