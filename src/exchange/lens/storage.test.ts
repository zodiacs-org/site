import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareAndSaveStore, createIndexedDBBackend, createJournalEntry, emptyStore, exportStore, importStore, LENS_DATABASE_NAME, LensConflictError, LensStorageError, MAX_IMPORT_BYTES, readStore, saveStore, updateJournalEntry, validateStore } from './storage';
import type { LensStorageBackend, LensStore } from './storage';
import type { WatchRule } from './types';

const START = '2026-10-01T00:00:00.000Z';
const NEXT = '2026-10-01T00:01:00.000Z';
const journalInput = {
  instrument: 'BTC-USD' as const, eventIds: ['event-one'], horizonHours: 24,
  method: 'TA + astrology' as const, hypothesis: 'Price may revisit support.',
  plan: 'Record my conditions before the session.', outcome: '',
};
const makeEntry = () => createJournalEntry(journalInput, { at: START, id: 'journal-one' });
const makeRule = (): WatchRule => ({
  id: 'rule-one', version: 1, instrument: 'BTC-USD', interval: '1h',
  condition: 'rsi-cross-up', threshold: 50, family: 'lunation',
  windowHours: 6, enabled: true, createdAt: START,
});
const makeStore = (): LensStore => ({ ...emptyStore(), entries: [makeEntry()], rules: [makeRule()], seenMatches: ['reminder-one'] });

afterEach(() => vi.unstubAllGlobals());

describe('private journal revision history', () => {
  it('preserves the initial hypothesis and every subsequent text snapshot', () => {
    const original = makeEntry();
    const revised = updateJournalEntry(original, { hypothesis: 'Revised expectation.', outcome: 'Support did not hold.' }, { at: NEXT });
    expect(original.hypothesis).toBe(journalInput.hypothesis);
    expect(original.revisions).toHaveLength(1);
    expect(revised.createdAt).toBe(START);
    expect(revised.updatedAt).toBe(NEXT);
    expect(revised.revisions).toEqual([
      { at: START, hypothesis: journalInput.hypothesis, plan: journalInput.plan, outcome: '' },
      { at: NEXT, hypothesis: 'Revised expectation.', plan: journalInput.plan, outcome: 'Support did not hold.' },
    ]);
  });

  it('avoids empty revisions and rejects backdated edits or changes to fixed methodology', () => {
    expect(updateJournalEntry(makeEntry(), { outcome: '' }, { at: NEXT })).toEqual(makeEntry());
    expect(() => updateJournalEntry(makeEntry(), { outcome: 'changed' }, { at: START })).toThrow('must follow');
    expect(() => updateJournalEntry(makeEntry(), { method: 'TA only' } as never, { at: NEXT })).toThrow('original instrument');
  });

  it('rejects inconsistent or unrecorded histories on import', () => {
    const store = makeStore();
    store.entries[0].hypothesis = 'Silently rewritten';
    expect(() => importStore(JSON.stringify(store))).toThrow('latest journal text');
    const noOriginal = makeStore();
    noOriginal.entries[0].revisions = [];
    expect(() => validateStore(noOriginal)).toThrow('original creation');
  });
});

describe('versioned workspace backup', () => {
  it('round-trips a complete backup, including plain note text and reminder deduplication', () => {
    const store = makeStore();
    store.entries[0] = createJournalEntry({ ...journalInput, hypothesis: '<script>never rendered as HTML</script>\nPrivate note' }, { at: START, id: 'journal-one' });
    const result = importStore(exportStore(store, NEXT));
    expect(result.store).toEqual(store);
    expect(result.importedEntries).toBe(1);
    expect(result.importedRules).toBe(1);
    expect(result.conflicts).toEqual([]);
    expect(importStore(exportStore(store, NEXT), store).store).toEqual(store);
  });

  it('preserves local records and reports contradictory imported copies under deterministic IDs', () => {
    const local = makeStore();
    const incoming = makeStore();
    incoming.entries[0] = updateJournalEntry(incoming.entries[0], { outcome: 'A different outcome.' }, { at: NEXT });
    incoming.rules[0].threshold = 60;
    const result = importStore(exportStore(incoming, NEXT), local);
    expect(local.entries).toHaveLength(1);
    expect(result.store.entries[0]).toEqual(local.entries[0]);
    expect(result.store.entries[1].id).toBe('journal-one:import:1');
    expect(result.store.rules[1].id).toBe('rule-one:import:1');
    expect(result.conflicts.map(conflict => conflict.kind)).toEqual(['rule', 'entry']);
    const repeated = importStore(exportStore(incoming, NEXT), result.store);
    expect(repeated.importedEntries).toBe(0);
    expect(repeated.importedRules).toBe(0);
    expect(repeated.store).toEqual(result.store);
  });

  it('rejects unsupported schemas, poisoned fields, oversized files, and duplicate IDs', () => {
    expect(() => importStore('{')).toThrow('valid Market Lens JSON');
    expect(() => importStore(JSON.stringify({ ...emptyStore(), schema: 99 }))).toThrow('schema version');
    expect(() => importStore('{"schema":1,"rules":[],"entries":[],"seenMatches":[],"__proto__":{"polluted":true}}')).toThrow('unsupported fields');
    expect(() => importStore(' '.repeat(MAX_IMPORT_BYTES + 1))).toThrow('bytes');
    const store = makeStore();
    store.rules.push(makeRule());
    expect(() => importStore(JSON.stringify(store))).toThrow('Rule IDs must be unique');
  });

  it('validates enum, numeric, timestamp and text boundaries before writing', () => {
    const invalidRule = (value: unknown) => ({ ...makeStore(), rules: [{ ...makeRule(), ...value as object }] });
    expect(() => validateStore(invalidRule({ threshold: NaN }))).toThrow('finite number');
    expect(() => validateStore(invalidRule({ threshold: 101 }))).toThrow('RSI threshold');
    expect(() => validateStore(invalidRule({ interval: '4h' }))).toThrow('Interval');
    expect(() => validateStore(invalidRule({ windowHours: 721 }))).toThrow('Research window');
    expect(() => validateStore(invalidRule({ createdAt: '2026-02-30T00:00:00Z' }))).toThrow('real calendar instant');
    expect(() => createJournalEntry({ ...journalInput, hypothesis: 'a'.repeat(5_001) }, { at: START, id: 'one' })).toThrow('5000 characters');
    expect(() => createJournalEntry({ ...journalInput, eventIds: ['https://secret.example/note'] }, { at: START, id: 'one' })).toThrow('Event ID');
    expect(() => createJournalEntry({ ...journalInput, outcome: '\u0000hidden' }, { at: START, id: 'one' })).toThrow('control characters');
  });

  it('canonicalizes equivalent ISO timestamps and does not mutate caller objects', () => {
    const source = makeStore();
    source.rules[0].createdAt = '2026-10-01T00:00:00Z';
    expect(validateStore(source).rules[0].createdAt).toBe(START);
    expect(source.rules[0].createdAt).toBe('2026-10-01T00:00:00Z');
  });
});

describe('storage failure boundaries', () => {
  it('reads and commits through an injected backend without network requests', async () => {
    let saved: unknown;
    const backend: LensStorageBackend = { read: async () => saved, write: async value => { saved = structuredClone(value); } };
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await readStore(backend)).toEqual(emptyStore());
    await saveStore(makeStore(), backend);
    expect(await readStore(backend)).toEqual(makeStore());
    expect(fetch).not.toHaveBeenCalled();
  });

  it('leaves corrupt saved data untouched and never substitutes a fresh empty store', async () => {
    const write = vi.fn();
    const backend = { read: async () => ({ schema: 99 }), write };
    await expect(readStore(backend)).rejects.toThrow('left unchanged');
    expect(write).not.toHaveBeenCalled();
  });

  it('rejects unavailable storage and propagates quota errors without pretending to save', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(readStore()).rejects.toBeInstanceOf(LensStorageError);
    const backend = { read: async () => undefined, write: async () => { throw new Error('QuotaExceededError'); } };
    await expect(saveStore(makeStore(), backend)).rejects.toThrow('QuotaExceededError');
  });

  it('opens only its dedicated database, waits for commit, and closes every connection', async () => {
    const fake = fakeIndexedDB();
    const backend = createIndexedDBBackend(fake.factory);
    await saveStore(makeStore(), backend);
    expect(await readStore(backend)).toEqual(makeStore());
    expect(fake.opened).toEqual([LENS_DATABASE_NAME, LENS_DATABASE_NAME]);
    expect(fake.closed()).toBe(2);
    expect(fake.commits()).toBe(2);
  });

  it('rejects a transaction that aborts after a successful write request', async () => {
    const fake = fakeIndexedDB(true);
    await expect(saveStore(makeStore(), createIndexedDBBackend(fake.factory))).rejects.toThrow('did not save');
    expect(fake.closed()).toBe(1);
    expect(fake.commits()).toBe(0);
  });

  it('reports a blocked opening and closes a later successful connection', async () => {
    const close = vi.fn();
    let request: Record<string, any>;
    const factory = {
      open() {
        request = { result: { close } };
        queueMicrotask(() => request.onblocked());
        return request;
      },
    } as unknown as IDBFactory;
    await expect(readStore(createIndexedDBBackend(factory))).rejects.toThrow('storage permissions');
    request!.onsuccess();
    expect(close).toHaveBeenCalledOnce();
  });

  it('atomically rejects a stale parallel client rather than losing either tab\'s saved work', async () => {
    const fake = fakeIndexedDB();
    const first = createIndexedDBBackend(fake.factory);
    const second = createIndexedDBBackend(fake.factory);
    const [expectedA, expectedB] = await Promise.all([readStore(first), readStore(second)]);
    const nextA = { ...expectedA, entries: [makeEntry()] };
    const nextB = { ...expectedB, rules: [makeRule()] };
    const results = await Promise.allSettled([
      compareAndSaveStore(expectedA, nextA, first),
      compareAndSaveStore(expectedB, nextB, second),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    const rejected = results[1] as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(LensConflictError);
    expect(await readStore(second)).toEqual(nextA);
    // The second tab reloads and can explicitly retry its draft against the
    // current snapshot, preserving the first tab's journal entry.
    const reloaded = await readStore(second);
    await compareAndSaveStore(reloaded, { ...reloaded, rules: nextB.rules }, second);
    expect(await readStore(first)).toEqual({ ...nextA, rules: [makeRule()] });
  });

  it('does not resurrect deleted entries from a stale tab or write over corrupted storage', async () => {
    const fake = fakeIndexedDB();
    const backend = createIndexedDBBackend(fake.factory);
    await saveStore(makeStore(), backend);
    await compareAndSaveStore(makeStore(), emptyStore(), backend);
    await expect(compareAndSaveStore(makeStore(), makeStore(), backend)).rejects.toBeInstanceOf(LensConflictError);
    expect(await readStore(backend)).toEqual(emptyStore());
    await backend.write({ schema: 99 } as never);
    await expect(compareAndSaveStore(emptyStore(), makeStore(), backend)).rejects.toThrow('left unchanged');
    expect(await backend.read()).toEqual({ schema: 99 });
  });

  it('requires atomic backend support and propagates an abort during a conditional write', async () => {
    const write = vi.fn();
    const read = vi.fn(async () => undefined);
    await expect(compareAndSaveStore(emptyStore(), makeStore(), { read, write })).rejects.toThrow('cannot save atomically');
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    const fake = fakeIndexedDB(true);
    await expect(compareAndSaveStore(emptyStore(), makeStore(), createIndexedDBBackend(fake.factory))).rejects.toThrow('did not save');
    expect(fake.commits()).toBe(0);
  });
});

/** Minimal contract fake exercises commit/abort ordering, not IndexedDB internals. */
function fakeIndexedDB(abortWrite = false) {
  let saved: unknown;
  let closeCount = 0;
  let commitCount = 0;
  const opened: string[] = [];
  const pendingTransactions: Array<() => void> = [];
  let transactionActive = false;
  const startNextTransaction = () => {
    if (transactionActive || !pendingTransactions.length) return;
    transactionActive = true;
    const start = pendingTransactions.shift()!;
    queueMicrotask(start);
  };
  const factory = {
    open(name: string) {
      opened.push(name);
      const database = {
        objectStoreNames: { contains: () => true },
        close: () => { closeCount += 1; },
        transaction(_store: string, mode: string) {
          const transaction: Record<string, any> = { error: abortWrite ? new Error('quota') : null };
          const requests: Array<{ request: Record<string, any>; write: boolean; value?: unknown }> = [];
          let staged: unknown;
          let didWrite = false;
          let aborted = false;
          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            if (aborted || (didWrite && abortWrite)) transaction.onabort?.();
            else {
              if (didWrite) saved = structuredClone(staged);
              commitCount += 1;
              transaction.oncomplete?.();
            }
            transactionActive = false;
            startNextTransaction();
          };
          const process = () => {
            if (finished) return;
            if (aborted || requests.length === 0) { finish(); return; }
            const operation = requests.shift()!;
            if (operation.write) { staged = operation.value; didWrite = true; }
            operation.request.result = operation.write ? 'snapshot' : structuredClone(didWrite ? staged : saved);
            operation.request.onsuccess?.();
            queueMicrotask(process);
          };
          transaction.abort = () => { aborted = true; };
          transaction.objectStore = () => ({
            get() { return request(false); },
            put(value: unknown) { return request(true, value); },
          });
          function request(write: boolean, value?: unknown) {
            if (write && mode !== 'readwrite') throw new Error('Readonly transaction');
            const req: Record<string, any> = {};
            requests.push({ request: req, write, value });
            return req;
          }
          pendingTransactions.push(process);
          startNextTransaction();
          return transaction;
        },
      };
      const req: Record<string, any> = { result: database };
      queueMicrotask(() => req.onsuccess?.());
      return req;
    },
  } as unknown as IDBFactory;
  return { factory, opened, closed: () => closeCount, commits: () => commitCount };
}
