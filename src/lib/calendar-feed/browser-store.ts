/** Calendar capabilities only. Importing this module opens no database. */
import type { KeptCalendarFeed } from './client';

export const CALENDAR_FEED_DATABASE_NAME = 'zodiacs.calendar-feeds.v1';
/** Advisory notifications only; the database is the sole write authority. */
export const CALENDAR_FEED_CHANGE_CHANNEL = 'zodiacs-calendar-feeds-v1';
export const CALENDAR_FEED_OBJECT_STORE = 'state';
export const CALENDAR_FEED_STATE_KEY = 'current';
const VERSION = 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CalendarFeedSnapshot {
  fence: string | null;
  feeds: KeptCalendarFeed[];
}
export type CalendarFeedStoreResult =
  | { status: 'ready'; snapshot: CalendarFeedSnapshot }
  | { status: 'unavailable' };
export type CalendarFeedStoreMutationResult = CalendarFeedStoreResult
  | { status: 'cancelled'; snapshot: CalendarFeedSnapshot };

export interface CalendarFeedStore {
  read(): Promise<CalendarFeedStoreResult>;
  establish(expectedFence: string | null, isCurrent: () => boolean): Promise<CalendarFeedStoreMutationResult>;
  commit(fence: string, feed: KeptCalendarFeed, isCurrent: () => boolean, removed?: ReadonlySet<string>): Promise<CalendarFeedStoreMutationResult>;
  remove(id: string): Promise<CalendarFeedStoreResult>;
  clear(): Promise<boolean>;
}

interface Options {
  /** Captured from the owning document, never looked up from a browser global. */
  indexedDB: IDBFactory | null | undefined;
  validateFeed: (value: unknown) => KeptCalendarFeed | null;
  randomUUID: () => string;
}
const empty = (): CalendarFeedSnapshot => ({ fence: null, feeds: [] });
const unavailable = (): CalendarFeedStoreResult => ({ status: 'unavailable' });
type OpenResult = { status: 'ready'; database: IDBDatabase } | { status: 'absent' } | { status: 'unavailable' };
type Operation = (snapshot: CalendarFeedSnapshot, store: IDBObjectStore,
  cancel: (snapshot: CalendarFeedSnapshot) => void) => CalendarFeedStoreMutationResult;

/**
 * Each operation opens its own short-lived connection and uses one transaction
 * for the canonical row. IndexedDB serializes read/modify/write across documents;
 * a localStorage read protected by Web Locks does not provide that guarantee.
 * The caller never holds a transaction while waiting for the network.
 */
export function createCalendarFeedStore({ indexedDB, validateFeed, randomUUID }: Options): CalendarFeedStore {
  function feed(value: unknown): KeptCalendarFeed | null {
    try {
      const parsed = validateFeed(value);
      // Always project the four allowed fields, even if a validator returns its
      // input. Chart data and unrelated properties never enter this database.
      return parsed && { id: parsed.id, url: parsed.url, secret: parsed.secret, madeAt: parsed.madeAt };
    } catch { return null; }
  }

  function snapshot(value: unknown): CalendarFeedSnapshot {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return empty();
    const row = value as Record<string, unknown>;
    const feeds = new Map<string, KeptCalendarFeed>();
    if (Array.isArray(row.feeds)) {
      for (const candidate of row.feeds) {
        const parsed = feed(candidate);
        if (parsed) feeds.set(parsed.id, parsed);
      }
    }
    return {
      fence: typeof row.fence === 'string' && UUID.test(row.fence) ? row.fence : null,
      feeds: [...feeds.values()].sort((a, b) => b.madeAt - a.madeAt),
    };
  }

  function open(create: boolean): Promise<OpenResult> {
    return new Promise((resolve) => {
      if (!indexedDB) { resolve({ status: 'unavailable' }); return; }
      let request: IDBOpenDBRequest;
      let settled = false;
      let absent = false;
      const finish = (result: OpenResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      try { request = indexedDB.open(CALENDAR_FEED_DATABASE_NAME, VERSION); }
      catch { finish({ status: 'unavailable' }); return; }
      request.onblocked = () => {
        // An open request cannot be cancelled while blocked. Every later handler
        // checks settled; late upgrades abort and late connections close.
        finish({ status: 'unavailable' });
      };
      request.onerror = () => finish({ status: absent ? 'absent' : 'unavailable' });
      request.onupgradeneeded = (event) => {
        if (settled || !create || event.oldVersion !== 0) {
          absent = !settled && !create && event.oldVersion === 0;
          try { request.transaction!.abort(); }
          catch { finish({ status: 'unavailable' }); }
          return;
        }
        try { request.result.createObjectStore(CALENDAR_FEED_OBJECT_STORE); }
        catch {
          try { request.transaction?.abort(); } catch { /* Open will fail. */ }
          finish({ status: 'unavailable' });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (settled || absent) { database.close(); return; }
        if (database.version !== VERSION || database.objectStoreNames.length !== 1
          || !database.objectStoreNames.contains(CALENDAR_FEED_OBJECT_STORE)) {
          database.close();
          finish({ status: 'unavailable' });
          return;
        }
        database.onversionchange = () => database.close();
        finish({ status: 'ready', database });
      };
    });
  }

  async function execute(mode: IDBTransactionMode, create: boolean, operation: Operation,
    absentResult: () => CalendarFeedStoreMutationResult): Promise<CalendarFeedStoreMutationResult> {
    const opened = await open(create);
    if (opened.status === 'unavailable') return unavailable();
    if (opened.status === 'absent') return absentResult();
    const database = opened.database;
    return new Promise((resolve) => {
      let transaction: IDBTransaction;
      try { transaction = database.transaction(CALENDAR_FEED_OBJECT_STORE, mode); }
      catch { database.close(); resolve(unavailable()); return; }
      let result: CalendarFeedStoreMutationResult = unavailable();
      let settled = false;
      let cancelled: CalendarFeedSnapshot | null = null;
      const finish = (value: CalendarFeedStoreMutationResult) => {
        if (settled) return;
        settled = true;
        database.close();
        resolve(value);
      };
      const fail = () => {
        if (settled) return;
        try { transaction.abort(); } catch { /* Already aborted. */ }
        finish(unavailable());
      };
      const cancel = (current: CalendarFeedSnapshot) => {
        cancelled = current;
        // A guard may be revoked after a put request succeeds. Abort rolls back
        // that provisional write; success is reported only by oncomplete.
        try { transaction.abort(); }
        catch { fail(); }
      };
      transaction.onabort = () => finish(cancelled ? { status: 'cancelled', snapshot: cancelled } : unavailable());
      transaction.onerror = fail;
      transaction.oncomplete = () => finish(result);
      try {
        const store = transaction.objectStore(CALENDAR_FEED_OBJECT_STORE);
        const request = store.get(CALENDAR_FEED_STATE_KEY);
        request.onerror = fail;
        request.onsuccess = () => {
          if (settled) return;
          try { result = operation(snapshot(request.result), store, cancel); }
          catch { fail(); }
        };
      } catch { fail(); }
    });
  }

  const readyEmpty = (): CalendarFeedStoreResult => ({ status: 'ready', snapshot: empty() });
  const current = (isCurrent: () => boolean): boolean => {
    try { return isCurrent(); } catch { return false; }
  };
  function put(store: IDBObjectStore, next: CalendarFeedSnapshot, prior: CalendarFeedSnapshot,
    isCurrent: () => boolean, cancel: (snapshot: CalendarFeedSnapshot) => void): void {
    const request = store.put(next, CALENDAR_FEED_STATE_KEY);
    request.onsuccess = () => { if (!current(isCurrent)) cancel(prior); };
    // Request errors bubble to the transaction and fail the whole operation.
  }

  return {
    read: () => execute('readonly', false, (value) => ({ status: 'ready', snapshot: value }), readyEmpty) as Promise<CalendarFeedStoreResult>,
    establish(expectedFence, isCurrent) {
      return execute('readwrite', expectedFence === null && current(isCurrent), (value, store, cancel) => {
        if (!current(isCurrent) || (expectedFence !== null && expectedFence !== value.fence)) {
          return { status: 'cancelled', snapshot: value };
        }
        if (value.fence !== null) return { status: 'ready', snapshot: value };
        const fence = randomUUID();
        if (!UUID.test(fence)) throw new Error('Invalid calendar fence.');
        if (!current(isCurrent)) return { status: 'cancelled', snapshot: value };
        const next = { fence, feeds: value.feeds };
        put(store, next, value, isCurrent, cancel);
        return { status: 'ready', snapshot: next };
      }, () => ({ status: 'cancelled', snapshot: empty() }));
    },
    commit(fence, value, isCurrent, removed) {
      // Copy validated input before any await: callers cannot mutate a queued
      // commit into a different capability or attach chart data later.
      const parsed = feed(value);
      const omitted = new Set(removed);
      if (!parsed) return Promise.resolve(unavailable());
      return execute('readwrite', false, (value, store, cancel) => {
        if (!current(isCurrent) || !fence || value.fence !== fence) return { status: 'cancelled', snapshot: value };
        const feeds = new Map(value.feeds.filter((entry) => !omitted.has(entry.id)).map((entry) => [entry.id, entry]));
        feeds.set(parsed.id, parsed);
        const next = { fence, feeds: [...feeds.values()].sort((a, b) => b.madeAt - a.madeAt) };
        put(store, next, value, isCurrent, cancel);
        return { status: 'ready', snapshot: next };
      }, () => ({ status: 'cancelled', snapshot: empty() }));
    },
    remove(id) {
      return execute('readwrite', false, (value, store) => {
        const next = { fence: value.fence, feeds: value.feeds.filter((entry) => entry.id !== id) };
        if (next.feeds.length !== value.feeds.length) store.put(next, CALENDAR_FEED_STATE_KEY);
        return { status: 'ready', snapshot: next };
      }, readyEmpty) as Promise<CalendarFeedStoreResult>;
    },
    async clear() {
      const result = await execute('readwrite', false, (_value, store) => {
        // Delete every row, including malformed/unknown ones, and retain no
        // fence or post-clear marker. The empty schema itself is harmless.
        store.clear();
        return readyEmpty();
      }, readyEmpty);
      return result.status === 'ready';
    },
  };
}

/** Erasure needs no feed parser and introduces no client runtime dependency. */
export function clearCalendarFeedStore(indexedDB: IDBFactory | null | undefined): Promise<boolean> {
  return createCalendarFeedStore({
    indexedDB, validateFeed: () => null,
    randomUUID: () => { throw new Error('Erasure cannot establish a calendar fence.'); },
  }).clear();
}
