/**
 * Deterministic request/transaction test double for calendar persistence.
 * It models rollback and shared transaction ordering, not a browser renderer's
 * storage implementation. Real IndexedDB/cross-renderer behavior is tested in CI.
 */
import {
  CALENDAR_FEED_DATABASE_NAME, CALENDAR_FEED_OBJECT_STORE, CALENDAR_FEED_STATE_KEY,
} from '../../src/lib/calendar-feed/browser-store';

type Handler = ((event: Event) => void) | null;
interface Request {
  result?: unknown;
  error: DOMException | null;
  onsuccess: Handler;
  onerror: Handler;
}
interface OpenRequest extends Request {
  onblocked: Handler;
  onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null;
  transaction: { abort: () => void } | null;
}
const request = (): Request => ({ error: null, onsuccess: null, onerror: null });
const error = () => new DOMException('Synthetic IndexedDB fault.', 'AbortError');
const turn = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const cloneRows = (rows: Map<IDBValidKey, unknown>) => new Map([...rows].map(([key, value]) => [key, structuredClone(value)]));

export class CalendarIdbBackend {
  exists = false;
  version = 1;
  stores = new Set<string>([CALENDAR_FEED_OBJECT_STORE]);
  rows = new Map<IDBValidKey, unknown>();
  private tail: Promise<void> = Promise.resolve();

  seed(value: unknown): void {
    this.exists = true;
    this.rows.set(CALENDAR_FEED_STATE_KEY, structuredClone(value));
  }
  state(): unknown { return structuredClone(this.rows.get(CALENDAR_FEED_STATE_KEY)); }
  serial(work: () => Promise<void>): void {
    this.tail = this.tail.then(work);
  }
  async idle(): Promise<void> {
    // Work may enqueue a transaction in a resolved open's continuation.
    let tail: Promise<void>;
    do { tail = this.tail; await tail; await turn(); } while (tail !== this.tail);
  }
}

export class CalendarIdbFactory {
  faults = { open: false, openError: false, read: false, write: false, abort: false, blocked: false, transaction: false, upgrade: false };
  holdCompletion = false;
  beforeComplete: (() => void) | null = null;
  opens = 0;
  transactions = 0;
  closes = 0;
  writes = 0;
  upgrades = 0;
  private blocked: (() => void)[] = [];
  private completions: (() => void)[] = [];
  readonly indexedDB: IDBFactory;

  constructor(readonly backend = new CalendarIdbBackend()) {
    this.indexedDB = { open: (name: string, version?: number) => this.open(name, version) } as IDBFactory;
  }

  releaseBlocked(): void { for (const resume of this.blocked.splice(0)) resume(); }
  completeTransactions(): void { for (const resume of this.completions.splice(0)) resume(); }

  private open(name: string, _version?: number): IDBOpenDBRequest {
    this.opens++;
    if (name !== CALENDAR_FEED_DATABASE_NAME) throw new Error('Unexpected database');
    if (this.faults.open) throw error();
    const opened: OpenRequest = { ...request(), onblocked: null, onupgradeneeded: null, transaction: null };
    const run = () => this.backend.serial(async () => {
      await turn();
      if (this.faults.openError) {
        opened.error = error();
        opened.onerror?.(new Event('error'));
        return;
      }
      let aborted = false;
      let closed = false;
      const database = {
        version: this.backend.version,
        objectStoreNames: {
          get length() { return factory.backend.stores.size; },
          contains: (store: string) => this.backend.stores.has(store),
        },
        onversionchange: null,
        close: () => { if (!closed) { closed = true; this.closes++; } },
        createObjectStore: (store: string) => { this.backend.stores.add(store); return {}; },
        transaction: (store: string, mode: IDBTransactionMode) => {
          if (closed || this.faults.transaction || !this.backend.stores.has(store)) throw error();
          this.transactions++;
          return this.transaction(mode);
        },
      };
      const factory = this;
      opened.result = database;
      if (!this.backend.exists) {
        this.upgrades++;
        opened.transaction = { abort: () => { aborted = true; } };
        opened.onupgradeneeded?.({ oldVersion: 0 } as IDBVersionChangeEvent);
        await turn();
        if (this.faults.upgrade) aborted = true;
        if (aborted) {
          opened.error = error();
          opened.onerror?.(new Event('error'));
          return;
        }
        this.backend.exists = true;
      }
      opened.transaction = null;
      opened.onsuccess?.(new Event('success'));
    });
    if (this.faults.blocked) {
      queueMicrotask(() => opened.onblocked?.(new Event('blocked')));
      this.blocked.push(run);
    } else run();
    return opened as unknown as IDBOpenDBRequest;
  }

  private transaction(mode: IDBTransactionMode): IDBTransaction {
    let aborted = false;
    let finished = false;
    let rows: Map<IDBValidKey, unknown>;
    let releaseCompletion: (() => void) | null = null;
    const jobs: { request: Request; action: () => unknown }[] = [];
    const enqueue = (action: () => unknown) => {
      if (aborted || finished) throw error();
      const next = request();
      jobs.push({ request: next, action });
      return next;
    };
    const writable = () => { if (mode !== 'readwrite' || this.faults.write) throw error(); this.writes++; };
    const store = {
      get: (key: IDBValidKey) => enqueue(() => {
        if (this.faults.read) throw error();
        return structuredClone(rows.get(key));
      }),
      put: (value: unknown, key: IDBValidKey) => {
        // Native IDB captures the value when the request is queued.
        const captured = structuredClone(value);
        return enqueue(() => { writable(); rows.set(key, captured); return key; });
      },
      clear: () => enqueue(() => { writable(); rows.clear(); return undefined; }),
    };
    const transaction = {
      error: null as DOMException | null,
      oncomplete: null as Handler,
      onabort: null as Handler,
      onerror: null as Handler,
      objectStore: (name: string) => {
        if (name !== CALENDAR_FEED_OBJECT_STORE) throw error();
        return store;
      },
      abort: () => {
        if (finished) throw error();
        aborted = true;
        releaseCompletion?.();
      },
    };
    this.backend.serial(async () => {
      rows = cloneRows(this.backend.rows);
      await turn();
      while (!aborted && jobs.length) {
        const next = jobs.shift()!;
        try {
          next.request.result = next.action();
          next.request.onsuccess?.(new Event('success'));
        } catch {
          next.request.error = error();
          transaction.error = next.request.error;
          next.request.onerror?.(new Event('error'));
          transaction.onerror?.(new Event('error'));
          aborted = true;
        }
        await turn();
      }
      if (!aborted) {
        this.beforeComplete?.();
        if (this.holdCompletion) await new Promise<void>((resolve) => {
          releaseCompletion = resolve;
          this.completions.push(resolve);
        });
      }
      if (this.faults.abort) aborted = true;
      finished = true;
      if (aborted) transaction.onabort?.(new Event('abort'));
      else {
        if (mode === 'readwrite') this.backend.rows = rows;
        transaction.oncomplete?.(new Event('complete'));
      }
    });
    return transaction as unknown as IDBTransaction;
  }
}
