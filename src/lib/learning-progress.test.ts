import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLearningProgressOwner, LEARNING_LOCK, LEARNING_STORAGE_KEY, LEGACY_LEARNING_KEY, type LearningEnvironment } from './learning-progress';

function harness() {
  const storage = new Map<string, string>();
  const queued: { signal: AbortSignal; run: () => void; resolve: () => void }[] = [];
  const write = vi.fn((key: string, value: string) => { storage.set(key, value); });
  const env: LearningEnvironment = {
    read: (key) => storage.get(key) ?? null,
    write,
    lock: vi.fn((name, signal, run) => {
      expect(name).toBe(LEARNING_LOCK);
      return new Promise<void>((resolve) => queued.push({ signal, run, resolve }));
    }),
  };
  const commit = () => { const item = queued.shift()!; item.run(); item.resolve(); return item; };
  const disk = () => JSON.parse(storage.get(LEARNING_STORAGE_KEY) ?? 'null');
  return { storage, queued, write, env, commit, disk };
}
afterEach(() => vi.useRealTimers());
describe('cooperating learning progress transactions', () => {
  it('reads latest disk inside each lock instead of overwriting another document', async () => {
    const h = harness(); const a = createLearningProgressOwner(h.env); const b = createLearningProgressOwner(h.env);
    const one = a.act({ type: 'start', id: 'aspects' }); const two = b.act({ type: 'start', id: 'big-three' });
    expect(h.write).not.toHaveBeenCalled(); h.commit(); h.commit();
    expect(await one).toBe(true); expect(await two).toBe(true);
    expect(h.disk()).toEqual({ version: 2, started: ['aspects', 'big-three'], completed: [] });
    a.refresh(); expect(a.snapshot()).toEqual(b.snapshot());
  });
  it('does not complete an unstarted lesson and preserves legacy visits as starts', async () => {
    const h = harness(); h.storage.set(LEGACY_LEARNING_KEY, JSON.stringify(['aspects']));
    const a = createLearningProgressOwner(h.env);
    const invalid = a.act({ type: 'complete', id: 'big-three' }); h.commit(); expect(await invalid).toBe(false);
    const valid = a.act({ type: 'complete', id: 'aspects' }); h.commit(); expect(await valid).toBe(true);
    expect(h.disk()).toEqual({ version: 2, started: ['aspects'], completed: ['aspects'] });
  });
  it('restart persists empty v2 and cannot resurrect v1; later completion needs a new start', async () => {
    const h = harness(); h.storage.set(LEGACY_LEARNING_KEY, '["big-three"]');
    const a = createLearningProgressOwner(h.env); const b = createLearningProgressOwner(h.env);
    const reset = a.act({ type: 'restart' }); const completion = b.act({ type: 'complete', id: 'big-three' });
    h.commit(); h.commit(); expect(await reset).toBe(true); expect(await completion).toBe(false);
    b.refresh(); expect(h.disk()).toEqual({ version: 2, started: [], completed: [] });
    expect(b.snapshot().started).toEqual([]);
  });
  it('documents the no-epoch limit: another-tab queued completion can follow a legitimate new start', async () => {
    const h = harness(); const a = createLearningProgressOwner(h.env); const b = createLearningProgressOwner(h.env);
    const reset = a.act({ type: 'restart' });
    const oldCompletion = b.act({ type: 'complete', id: 'big-three' });
    h.commit(); await reset;
    const start = a.act({ type: 'start', id: 'big-three' });
    // Acquisition order, not initiation order, is the transaction order.
    h.queued.reverse(); h.commit(); h.commit(); await start;
    expect(await oldCompletion).toBe(true); expect(h.disk().completed).toEqual(['big-three']);
  });
  it('invalidates same-document queued actions when restart commits', async () => {
    const h = harness(); const a = createLearningProgressOwner(h.env);
    const reset = a.act({ type: 'restart' }); const oldStart = a.act({ type: 'start', id: 'aspects' });
    h.commit(); h.commit(); expect(await reset).toBe(true); expect(await oldStart).toBe(false);
    expect(h.write).toHaveBeenCalledTimes(1);
  });
  it('rechecks private attempt and originating lifetime after lock acquisition', async () => {
    const h = harness(); const a = createLearningProgressOwner(h.env); let current = true;
    const action = a.act({ type: 'start', id: 'big-three' }, () => current); current = false;
    h.commit(); expect(await action).toBe(false); expect(h.write).not.toHaveBeenCalled();
  });
  it('times out at 1500ms, shares page-only state and never writes from late callbacks', async () => {
    vi.useFakeTimers(); const h = harness(); const a = createLearningProgressOwner(h.env);
    const action = a.act({ type: 'start', id: 'aspects' });
    await vi.advanceTimersByTimeAsync(1500); expect(await action).toBe(true);
    expect(h.queued[0].signal.aborted).toBe(true); h.commit();
    expect(h.write).not.toHaveBeenCalled(); expect(a.snapshot().pageOnly).toBe(true);
    h.storage.set(LEARNING_STORAGE_KEY, '{"version":2,"started":[],"completed":[]}'); a.refresh();
    expect(a.snapshot().started).toEqual(['aspects']);
    expect(await a.act({ type: 'complete', id: 'aspects' })).toBe(true);
    expect(a.snapshot().completed).toEqual(['aspects']);
  });
  it('does not resume other queued persistent writes after entering page-only mode', async () => {
    vi.useFakeTimers(); const h = harness(); const a = createLearningProgressOwner(h.env);
    const first = a.act({ type: 'start', id: 'big-three' }); await vi.advanceTimersByTimeAsync(1000);
    const second = a.act({ type: 'start', id: 'aspects' }); await vi.advanceTimersByTimeAsync(500);
    expect(await first).toBe(true); h.commit(); h.commit(); expect(await second).toBe(true);
    expect(h.write).not.toHaveBeenCalled(); expect(a.snapshot().started).toEqual(['aspects', 'big-three']);
  });
  it.each(['missing', 'denied', 'write'] as const)('uses truthful page-only fallback when coordination/storage is %s', async (failure) => {
    const h = harness(); h.storage.set(LEARNING_STORAGE_KEY, '{"version":2,"started":["big-three"],"completed":[]}');
    if (failure === 'missing') h.env.lock = undefined;
    if (failure === 'denied') h.env.lock = () => Promise.reject(new Error('denied'));
    if (failure === 'write') h.env.write = () => { throw new Error('blocked'); };
    const a = createLearningProgressOwner(h.env); const action = a.act({ type: 'complete', id: 'big-three' });
    if (failure === 'write') h.commit();
    expect(await action).toBe(true); expect(a.snapshot()).toEqual({ started: ['big-three'], completed: ['big-three'], pageOnly: true });
    expect(h.disk().completed).toEqual([]);
  });
  it('rechecks revoked private attempts before timeout fallback', async () => {
    vi.useFakeTimers(); const h = harness(); const a = createLearningProgressOwner(h.env); let current = true;
    const action = a.act({ type: 'start', id: 'big-three' }, () => current); current = false;
    await vi.advanceTimersByTimeAsync(1500); expect(await action).toBe(false); h.commit();
    expect(a.snapshot().started).toEqual([]); expect(h.write).not.toHaveBeenCalled();
  });
});
