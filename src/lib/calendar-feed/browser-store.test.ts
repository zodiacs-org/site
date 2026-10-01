import { describe, expect, it, vi } from 'vitest';
import { CalendarIdbBackend, CalendarIdbFactory } from '../../../tests/helpers/calendar-idb';
import type { KeptCalendarFeed } from './client';
import {
  CALENDAR_FEED_OBJECT_STORE, CALENDAR_FEED_STATE_KEY,
  clearCalendarFeedStore, createCalendarFeedStore,
} from './browser-store';

const FENCE = '10000000-0000-4000-8000-000000000001';
const NEXT_FENCE = '20000000-0000-4000-8000-000000000002';
const current = () => true;
const feed = (number = 1): KeptCalendarFeed => ({
  id: `feed-${number}`, url: `https://zodiacs.org/api/calendar/feeds/feed-${number}`,
  secret: `synthetic-secret-${number}`, madeAt: number,
});
function validateFeed(value: unknown): KeptCalendarFeed | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as KeptCalendarFeed;
  return typeof item.id === 'string' && /^feed-\d+$/.test(item.id)
    && typeof item.url === 'string' && typeof item.secret === 'string'
    && typeof item.madeAt === 'number' && Number.isFinite(item.madeAt) ? item : null;
}
function setup(backend = new CalendarIdbBackend(), uuid = FENCE) {
  const factory = new CalendarIdbFactory(backend);
  const randomUUID = vi.fn(() => uuid);
  const store = createCalendarFeedStore({ indexedDB: factory.indexedDB, validateFeed, randomUUID });
  return { factory, store, backend, randomUUID };
}
const ready = (fence: string | null = null, feeds: KeptCalendarFeed[] = []) => ({ status: 'ready', snapshot: { fence, feeds } });
const cancelled = (fence: string | null = null, feeds: KeptCalendarFeed[] = []) => ({ status: 'cancelled', snapshot: { fence, feeds } });

describe('canonical calendar IndexedDB transactions', () => {
  it('imports/constructs without opening storage, and reads an absent database without creating one', async () => {
    const { store, backend, factory, randomUUID } = setup();
    expect(factory.opens).toBe(0);
    expect(await store.read()).toEqual(ready());
    expect(backend.exists).toBe(false);
    expect(backend.rows.size).toBe(0);
    expect(factory.transactions).toBe(0);
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it('does not create storage or fences for absent removal, clear, cancelled admission, or old admission', async () => {
    const { store, backend, randomUUID } = setup();
    expect(await store.remove('feed-1')).toEqual(ready());
    expect(await store.clear()).toBe(true);
    expect(await store.establish(null, () => false)).toEqual(cancelled());
    expect(await store.establish(FENCE, current)).toEqual(cancelled());
    expect(await store.commit(FENCE, feed(), current)).toEqual(cancelled());
    expect(backend.exists).toBe(false);
    expect(backend.rows.size).toBe(0);
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it('serializes simultaneous initial subscriptions around one canonical fence', async () => {
    const one = setup();
    const two = setup(one.backend, NEXT_FENCE);
    const results = await Promise.all([one.store.establish(null, current), two.store.establish(null, current)]);
    expect(results).toEqual([ready(FENCE), ready(FENCE)]);
    expect(one.randomUUID).toHaveBeenCalledOnce();
    expect(two.randomUUID).not.toHaveBeenCalled();
    expect(one.backend.state()).toEqual({ fence: FENCE, feeds: [] });
    expect(await two.store.establish(FENCE, current)).toEqual(ready(FENCE));
    expect(two.randomUUID).not.toHaveBeenCalled();
  });

  it('atomically merges concurrent commits across factories without an eviction limit', async () => {
    const one = setup();
    const two = setup(one.backend);
    await one.store.establish(null, current);
    const values = Array.from({ length: 75 }, (_, index) => feed(index));
    const results = await Promise.all(values.map((value, index) => (index % 2 ? one : two).store.commit(FENCE, value, current)));
    expect(results.every((result) => result.status === 'ready')).toBe(true);
    expect(await one.store.read()).toEqual(ready(FENCE, values.reverse()));
    expect((one.backend.state() as { feeds: unknown[] }).feeds).toHaveLength(75);
  });

  it('atomically retries confirmed removals during a new commit without deleting unrelated keys', async () => {
    const { store, backend } = setup();
    backend.seed({ fence: FENCE, feeds: [feed(), feed(2), feed(3)] });
    const removed = new Set(['feed-1']);
    const pending = store.commit(FENCE, feed(4), current, removed);
    removed.add('feed-2');
    expect(await pending).toEqual(ready(FENCE, [feed(4), feed(3), feed(2)]));
    expect(backend.state()).toEqual({ fence: FENCE, feeds: [feed(4), feed(3), feed(2)] });
    // The explicitly supplied new capability wins, even if that id had been
    // removed before. The set only filters prior canonical records.
    expect(await store.commit(FENCE, feed(5), current, new Set(['feed-5'])))
      .toEqual(ready(FENCE, [feed(5), feed(4), feed(3), feed(2)]));
  });

  it('rejects missing/replaced fences and never restores an old fence after clear', async () => {
    const one = setup();
    const two = setup(one.backend, NEXT_FENCE);
    await one.store.establish(null, current);
    await one.store.commit(FENCE, feed(), current);
    expect(await two.store.clear()).toBe(true);
    expect(one.backend.rows.size).toBe(0);
    expect(await one.store.commit(FENCE, feed(2), current)).toEqual(cancelled());
    expect(await one.store.establish(FENCE, current)).toEqual(cancelled());
    expect(one.backend.rows.size).toBe(0);
    await two.store.establish(null, current);
    expect(await one.store.commit(FENCE, feed(2), current)).toEqual(cancelled(NEXT_FENCE));
    expect(await one.store.establish(FENCE, current)).toEqual(cancelled(NEXT_FENCE));
    expect(await one.store.commit('', feed(2), current)).toEqual(cancelled(NEXT_FENCE));
    expect(await two.store.read()).toEqual(ready(NEXT_FENCE));
  });

  it('rejects revoked admission/commit guards without changing the canonical row', async () => {
    const { store, backend } = setup();
    backend.seed({ fence: FENCE, feeds: [feed()] });
    expect(await store.establish(FENCE, () => false)).toEqual(cancelled(FENCE, [feed()]));
    expect(await store.commit(FENCE, feed(2), () => false)).toEqual(cancelled(FENCE, [feed()]));
    expect(await store.commit(FENCE, feed(2), () => { throw new Error('revoked'); })).toEqual(cancelled(FENCE, [feed()]));
    expect(backend.state()).toEqual({ fence: FENCE, feeds: [feed()] });
  });

  it('rolls back a provisional put if the guard is revoked before its request succeeds', async () => {
    const { store, backend } = setup();
    backend.seed({ fence: FENCE, feeds: [feed()] });
    let checks = 0;
    expect(await store.commit(FENCE, feed(2), () => ++checks === 1)).toEqual(cancelled(FENCE, [feed()]));
    expect(backend.state()).toEqual({ fence: FENCE, feeds: [feed()] });
  });

  it('waits for transaction completion instead of reporting request success', async () => {
    const { store, factory, backend } = setup();
    backend.seed({ fence: FENCE, feeds: [] });
    factory.holdCompletion = true;
    const beforeComplete = vi.fn();
    factory.beforeComplete = beforeComplete;
    const done = vi.fn();
    const committing = store.commit(FENCE, feed(), current).then((result) => { done(); return result; });
    await vi.waitFor(() => expect(beforeComplete).toHaveBeenCalledOnce());
    expect(done).not.toHaveBeenCalled();
    expect(backend.state()).toEqual({ fence: FENCE, feeds: [] });
    factory.completeTransactions();
    expect(await committing).toEqual(ready(FENCE, [feed()]));
    expect(backend.state()).toEqual({ fence: FENCE, feeds: [feed()] });
  });

  it('rolls back a failed transaction after successful requests', async () => {
    const { store, factory, backend } = setup();
    backend.seed({ fence: FENCE, feeds: [feed()] });
    factory.faults.abort = true;
    expect(await store.commit(FENCE, feed(2), current)).toEqual({ status: 'unavailable' });
    expect(backend.state()).toEqual({ fence: FENCE, feeds: [feed()] });
    expect(await store.remove('feed-1')).toEqual({ status: 'unavailable' });
    expect(await store.clear()).toBe(false);
    expect(backend.state()).toEqual({ fence: FENCE, feeds: [feed()] });
  });

  it('removes only the selected feed, preserves its fence, and clears every row with no retained marker', async () => {
    const { store, factory, backend } = setup();
    backend.seed({ fence: FENCE, feeds: [feed(), feed(2)] });
    backend.rows.set('unexpected-row', { positions: 'synthetic-chart-data' });
    expect(await store.remove('feed-1')).toEqual(ready(FENCE, [feed(2)]));
    expect(backend.rows.has('unexpected-row')).toBe(true);
    expect(await clearCalendarFeedStore(factory.indexedDB)).toBe(true);
    expect(backend.exists).toBe(true);
    expect(backend.rows.size).toBe(0);
    expect(await store.read()).toEqual(ready());
    expect([...backend.stores]).toEqual([CALENDAR_FEED_OBJECT_STORE]);
  });

  it('sanitizes malformed rows, duplicate IDs and extra fields without persisting during reads', async () => {
    const { store, backend, factory } = setup();
    const raw = { fence: FENCE, positions: 'never-keep', feeds: [
      null, 42, [], {}, { ...feed(), madeAt: NaN }, { ...feed(), positions: 'never-keep', chart: { birth: 'never-keep' } },
      feed(2), { ...feed(2), madeAt: 3 },
    ] };
    backend.seed(raw);
    const expected = [{ ...feed(2), madeAt: 3 }, feed()];
    expect(await store.read()).toEqual(ready(FENCE, expected));
    expect(factory.writes).toBe(0);
    expect(backend.state()).toEqual(raw);
    expect(await store.commit(FENCE, { ...feed(4), positions: 'never-keep' } as KeptCalendarFeed, current))
      .toEqual(ready(FENCE, [feed(4), ...expected]));
    expect(JSON.stringify(backend.state())).not.toContain('never-keep');
    expect(Object.keys(backend.state() as object)).toEqual(['fence', 'feeds']);
  });

  it.each([null, [], 42, 'broken', { fence: 4, feeds: 'broken' }])('treats malformed state %j as an empty snapshot', async (value) => {
    const { store, backend } = setup();
    backend.seed(value);
    expect(await store.read()).toEqual(ready());
  });

  it('keeps valid feed capabilities if only the fence is malformed', async () => {
    const { store, backend } = setup();
    backend.seed({ fence: 'chart-data-is-not-a-fence', feeds: [feed()] });
    expect(await store.read()).toEqual(ready(null, [feed()]));
    expect(await store.establish(null, current)).toEqual(ready(FENCE, [feed()]));
  });

  it('validates and copies input before waiting, and refuses invalid input without a transaction', async () => {
    const { store, backend, factory } = setup();
    backend.seed({ fence: FENCE, feeds: [] });
    const source = feed();
    const pending = store.commit(FENCE, source, current);
    source.id = 'feed-2';
    source.secret = 'changed';
    expect(await pending).toEqual(ready(FENCE, [feed()]));
    const transactions = factory.transactions;
    expect(await store.commit(FENCE, {} as KeptCalendarFeed, current)).toEqual({ status: 'unavailable' });
    expect(factory.transactions).toBe(transactions);
  });

  it.each(['read', 'write', 'transaction'] as const)('reports %s failure without changing existing state', async (fault) => {
    const { store, factory, backend } = setup();
    const prior = { fence: FENCE, feeds: [feed()] };
    backend.seed(prior);
    factory.faults[fault] = true;
    expect(await store.commit(FENCE, feed(2), current)).toEqual({ status: 'unavailable' });
    expect(await store.clear()).toBe(false);
    expect(backend.state()).toEqual(prior);
  });

  it('reports unavailable storage and synchronous open failure honestly', async () => {
    const absent = createCalendarFeedStore({ indexedDB: undefined, validateFeed, randomUUID: () => FENCE });
    expect(await absent.read()).toEqual({ status: 'unavailable' });
    expect(await absent.clear()).toBe(false);
    const { store, factory } = setup();
    factory.faults.open = true;
    expect(await store.read()).toEqual({ status: 'unavailable' });
    expect(await store.establish(null, current)).toEqual({ status: 'unavailable' });
    expect(await store.clear()).toBe(false);
  });

  it('reports asynchronous open errors without claiming an absent or writable database', async () => {
    const { store, factory, backend } = setup();
    factory.faults.openError = true;
    expect(await store.read()).toEqual({ status: 'unavailable' });
    expect(await store.establish(null, current)).toEqual({ status: 'unavailable' });
    expect(await store.clear()).toBe(false);
    expect(backend.exists).toBe(false);
    expect(factory.transactions).toBe(0);
  });

  it('reports an aborted creation as unavailable and cannot claim a kept fence', async () => {
    const { store, factory, backend } = setup();
    factory.faults.upgrade = true;
    expect(await store.establish(null, current)).toEqual({ status: 'unavailable' });
    expect(backend.exists).toBe(false);
    expect(backend.rows.size).toBe(0);
  });

  it('does not create schema or write after a blocked open has already fallen back', async () => {
    const { store, factory, backend } = setup();
    factory.faults.blocked = true;
    expect(await store.establish(null, current)).toEqual({ status: 'unavailable' });
    factory.releaseBlocked();
    await backend.idle();
    expect(backend.exists).toBe(false);
    expect(factory.transactions).toBe(0);
    expect(factory.writes).toBe(0);
  });

  it('closes late successful blocked opens, with no delayed write or clear', async () => {
    const { store, factory, backend } = setup();
    backend.seed({ fence: FENCE, feeds: [feed()] });
    factory.faults.blocked = true;
    expect(await store.commit(FENCE, feed(2), current)).toEqual({ status: 'unavailable' });
    expect(await store.clear()).toBe(false);
    factory.releaseBlocked();
    await backend.idle();
    expect(factory.closes).toBe(2);
    expect(factory.transactions).toBe(0);
    expect(backend.state()).toEqual({ fence: FENCE, feeds: [feed()] });
  });

  it('refuses unsupported schemas without clearing or adding rows', async () => {
    const { store, backend } = setup();
    backend.seed({ fence: FENCE, feeds: [feed()] });
    backend.stores.add('unrelated');
    expect(await store.read()).toEqual({ status: 'unavailable' });
    expect(await store.clear()).toBe(false);
    expect(backend.rows.has(CALENDAR_FEED_STATE_KEY)).toBe(true);
  });

  it('refuses invalid UUID generation instead of persisting arbitrary data', async () => {
    const { store, backend } = setup(new CalendarIdbBackend(), 'synthetic-chart-code');
    expect(await store.establish(null, current)).toEqual({ status: 'unavailable' });
    expect(backend.rows.size).toBe(0);
  });
});
