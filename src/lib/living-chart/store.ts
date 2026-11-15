import { profileAccessAllowed } from '../account-v2/profile-access-reader';
import { ensureProfileWriteAccess } from '../account-v2/profile-access-request';
import { ACCOUNT_V2_PROFILE_LEASE_REVOKE_KEY, isAccountV2Id } from '../account-v2/storage-identity';
import { ACCOUNT_V2_PROFILE_REVOKE_EVENT } from '../account-v2/profile-lease';
import {
  livingChartOwnerKey,
  readLivingChartGuestOwnerScope,
  resolveLivingChartOwnerScope,
} from './owner';
import {
  MAX_ACTIVE_LIVING_MOMENTS,
  normalizeLivingMomentNote,
  parseLivingMoment,
  createLivingMomentRecord,
} from './schema';
import {
  LIVING_CHART_FORECAST_SCHEMA,
  LIVING_CHART_EXPORT_SCHEMA,
  LIVING_CHART_MOMENT_SCHEMA,
  type CreateLivingMomentInput,
  type LivingChartChangeDetail,
  type LivingChartExportV1,
  type LivingChartOwnerScope,
  type LivingMomentV1,
  type UpdateLivingMomentInput,
} from './types';

export const LIVING_CHART_CHANGE_EVENT = 'zodiacs:living-chart';
export const LIVING_CHART_DATABASE_NAME = 'zodiacs-living-chart-v1';
export const LIVING_CHART_CLEAR_REQUEST_KEY = 'zodiacs.living-chart.clear-request.v1';
export const LIVING_CHART_CHANGE_PULSE_KEY = 'zodiacs.living-chart.change-pulse.v1';

const DATABASE_VERSION = 1;
const MOMENT_STORE = 'moments';
const OWNER_INDEX = 'ownerKey';
let authenticatedAccountOwnerId: string | null = null;
let accountAuthorityMode: 'inactive' | 'checking' | 'verified' | 'signed_out' = 'inactive';

export function lockLivingChartAccountOwners(): void {
  if (accountAuthorityMode !== 'inactive') return;
  authenticatedAccountOwnerId = null;
  accountAuthorityMode = 'checking';
  defaultStore?.close();
}

/**
 * Ephemeral authority established only after Supabase returns the current
 * authenticated user. It is intentionally never persisted; sign-out and
 * access invalidation close the IndexedDB handle before clearing it.
 */
export function setLivingChartAuthenticatedAccountOwner(accountId: string | null): boolean {
  if (accountId !== null && !isAccountV2Id(accountId)) return false;
  const nextAccountId = accountId?.toLowerCase() ?? null;
  const nextMode = nextAccountId === null ? 'signed_out' : 'verified';
  const unchanged = accountAuthorityMode === nextMode
    && authenticatedAccountOwnerId === nextAccountId;
  // The initial lock already closed any account-authorized handle. While the
  // auth check runs, guest reads and writes are allowed; settling that check
  // as signed out keeps the same guest authority and must not abort an
  // IndexedDB transaction that started in the meantime.
  const completedGuestCheck = accountAuthorityMode === 'checking'
    && nextMode === 'signed_out';
  authenticatedAccountOwnerId = nextAccountId;
  accountAuthorityMode = nextMode;
  if (!unchanged && !completedGuestCheck) defaultStore?.close();
  return true;
}

interface StoredLivingMoment {
  storageKey: string;
  ownerKey: string;
  momentId: string;
  value: unknown;
}

export interface LivingChartAdapterPut {
  id: string;
  value: unknown;
}

export interface LivingChartAdapterMutation<T> {
  result: T;
  put?: LivingChartAdapterPut;
  /** Removes one record in the same owner-scoped transaction as the read. */
  deleteId?: string;
}

export interface LivingChartImportResult {
  imported: number;
  alreadyPresent: number;
  conflicts: number;
}

/** Async and transactional so production IndexedDB and deterministic tests share one contract. */
export interface LivingChartAsyncAdapter {
  readAll(ownerKey: string): Promise<unknown[]>;
  mutate<T>(
    ownerKey: string,
    operation: (records: unknown[]) => LivingChartAdapterMutation<T>,
  ): Promise<T>;
  clear(ownerKey: string): Promise<void>;
  clearAll(): Promise<void>;
  close?(): void;
}

function requestFailure(): Error {
  return new Error('living-chart-storage-unavailable');
}

/** IndexedDB keeps each owner in one indexed namespace and makes cap checks + writes atomic. */
export class IndexedDbLivingChartAdapter implements LivingChartAsyncAdapter {
  private database: Promise<IDBDatabase> | null = null;
  private openGeneration = 0;

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    const generation = ++this.openGeneration;
    let pending!: Promise<IDBDatabase>;
    pending = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(requestFailure());
        return;
      }
      const request = indexedDB.open(LIVING_CHART_DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.objectStoreNames.contains(MOMENT_STORE)
          ? request.transaction!.objectStore(MOMENT_STORE)
          : database.createObjectStore(MOMENT_STORE, { keyPath: 'storageKey' });
        if (!store.indexNames.contains(OWNER_INDEX)) {
          store.createIndex(OWNER_INDEX, OWNER_INDEX, { unique: false });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (this.database !== pending || this.openGeneration !== generation) {
          database.close();
          reject(requestFailure());
          return;
        }
        database.onversionchange = () => {
          database.close();
          if (this.database === pending && this.openGeneration === generation) {
            this.database = null;
            this.openGeneration += 1;
          }
        };
        resolve(database);
      };
      request.onerror = () => reject(request.error ?? requestFailure());
      // A blocked open is not terminal in IndexedDB. Reject this generation,
      // then close a late success instead of leaking an unreachable handle.
      request.onblocked = () => reject(requestFailure());
    });
    this.database = pending;
    void pending.catch(() => {
      if (this.database === pending && this.openGeneration === generation) {
        this.database = null;
      }
    });
    return pending;
  }

  async readAll(ownerKey: string): Promise<unknown[]> {
    const database = await this.open();
    return new Promise<unknown[]>((resolve, reject) => {
      const transaction = database.transaction(MOMENT_STORE, 'readonly');
      const request = transaction.objectStore(MOMENT_STORE).index(OWNER_INDEX).getAll(ownerKey);
      request.onsuccess = () => {
        const rows = request.result as StoredLivingMoment[];
        resolve(rows.map((row) => row.value));
      };
      request.onerror = () => reject(request.error ?? requestFailure());
      transaction.onabort = () => reject(transaction.error ?? requestFailure());
    });
  }

  async mutate<T>(
    ownerKey: string,
    operation: (records: unknown[]) => LivingChartAdapterMutation<T>,
  ): Promise<T> {
    const database = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(MOMENT_STORE, 'readwrite');
      const store = transaction.objectStore(MOMENT_STORE);
      const request = store.index(OWNER_INDEX).getAll(ownerKey);
      let mutation: LivingChartAdapterMutation<T> | null = null;
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : requestFailure());
      };
      request.onsuccess = () => {
        try {
          const rows = request.result as StoredLivingMoment[];
          mutation = operation(rows.map((row) => row.value));
          if (mutation.put && mutation.deleteId) throw requestFailure();
          if (mutation.put) {
            if (!isAccountV2Id(mutation.put.id)) throw requestFailure();
            const momentId = mutation.put.id.toLowerCase();
            store.put({
              storageKey: `${ownerKey}:${momentId}`,
              ownerKey,
              momentId,
              value: mutation.put.value,
            } satisfies StoredLivingMoment);
          } else if (mutation.deleteId) {
            if (!isAccountV2Id(mutation.deleteId)) throw requestFailure();
            store.delete(`${ownerKey}:${mutation.deleteId.toLowerCase()}`);
          }
        } catch (error) {
          transaction.abort();
          fail(error);
        }
      };
      request.onerror = () => fail(request.error ?? requestFailure());
      transaction.onabort = () => fail(transaction.error ?? requestFailure());
      transaction.onerror = () => fail(transaction.error ?? requestFailure());
      transaction.oncomplete = () => {
        if (settled) return;
        if (!mutation) {
          fail(requestFailure());
          return;
        }
        settled = true;
        resolve(mutation.result);
      };
    });
  }

  async clear(ownerKey: string): Promise<void> {
    const database = await this.open();
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(MOMENT_STORE, 'readwrite');
      const index = transaction.objectStore(MOMENT_STORE).index(OWNER_INDEX);
      const request = index.openKeyCursor(IDBKeyRange.only(ownerKey));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        transaction.objectStore(MOMENT_STORE).delete(cursor.primaryKey);
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? requestFailure());
      transaction.onabort = () => reject(transaction.error ?? requestFailure());
      transaction.onerror = () => reject(transaction.error ?? requestFailure());
      transaction.oncomplete = () => resolve();
    });
  }

  async clearAll(): Promise<void> {
    const database = await this.open();
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(MOMENT_STORE, 'readwrite');
      const request = transaction.objectStore(MOMENT_STORE).clear();
      request.onerror = () => reject(request.error ?? requestFailure());
      transaction.onabort = () => reject(transaction.error ?? requestFailure());
      transaction.onerror = () => reject(transaction.error ?? requestFailure());
      transaction.oncomplete = () => resolve();
    });
  }

  close(): void {
    const current = this.database;
    this.database = null;
    this.openGeneration += 1;
    void current?.then((database) => database.close()).catch(() => {});
  }
}

export interface LivingChartStoreOptions {
  adapter?: LivingChartAsyncAdapter;
  accessAllowed?: () => boolean;
  /** Injectable owner authority; production resolves the active local vault. */
  ownerAllowed?: (owner: LivingChartOwnerScope) => boolean;
  now?: () => Date;
  randomUUID?: () => string;
  dispatch?: (detail: LivingChartChangeDetail) => void;
}

function defaultRandomUUID(): string {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : '';
}

function dispatchLivingChartEvent(detail: LivingChartChangeDetail): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    if (typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent<LivingChartChangeDetail>(LIVING_CHART_CHANGE_EVENT, { detail }));
      return;
    }
    const event = new Event(LIVING_CHART_CHANGE_EVENT);
    Object.defineProperty(event, 'detail', { value: detail });
    window.dispatchEvent(event);
  } catch {
    // Storage remains authoritative when an isolated event target is unavailable.
  }
}

function dispatchLivingChartChange(detail: LivingChartChangeDetail): void {
  // Same-origin tabs receive only a random pulse. They re-resolve their own
  // authorized vault; no owner identifier, note, forecast, or record id crosses
  // the localStorage boundary.
  if (detail.operation === 'create'
    || detail.operation === 'update'
    || detail.operation === 'delete') {
    const storage = browserLocalStorage();
    const eventId = defaultRandomUUID();
    if (storage && isAccountV2Id(eventId)) {
      try {
        storage.setItem(LIVING_CHART_CHANGE_PULSE_KEY, JSON.stringify({
          version: 1,
          eventId: eventId.toLowerCase(),
        }));
      } catch {
        // The same-tab event remains sufficient when localStorage is full.
      }
    }
  }
  dispatchLivingChartEvent(detail);
}

function sameOwner(left: LivingChartOwnerScope, right: LivingChartOwnerScope): boolean {
  return livingChartOwnerKey(left) !== null
    && livingChartOwnerKey(left) === livingChartOwnerKey(right);
}

function parseOwnerRecords(
  values: unknown[],
  owner: LivingChartOwnerScope,
): LivingMomentV1[] | null {
  const parsed: LivingMomentV1[] = [];
  for (const value of values) {
    const moment = parseLivingMoment(value);
    if (!moment || !sameOwner(moment.owner, owner)) return null;
    parsed.push(moment);
  }
  return new Set(parsed.map((moment) => moment.id)).size === parsed.length ? parsed : null;
}

function conflictCopyFromRemote(moment: LivingMomentV1, serverRevision: number) {
  return {
    serverRevision,
    primaryChartId: moment.primaryChartId,
    occurredAt: moment.occurredAt,
    timePrecision: moment.timePrecision,
    ...(moment.category === undefined ? {} : { category: moment.category }),
    ...(moment.note === undefined ? {} : { note: moment.note }),
    forecast: moment.forecast,
    reflectionQuestionId: moment.reflectionQuestionId,
    createdAt: moment.createdAt,
    updatedAt: moment.updatedAt,
  };
}

const REDACTED_CHART_ID = '00000000-0000-4000-8000-000000000000';
const REDACTED_INSTANT = '1970-01-01T00:00:00.000Z';

/**
 * A pending account delete needs only an owner, id, and optimistic-concurrency
 * metadata. The v1 codec still requires content fields, so they are replaced
 * with fixed non-user placeholders before the IndexedDB transaction commits.
 */
function redactedTechnicalTombstone(
  current: LivingMomentV1,
  revision: number,
  baseRevision: number,
  deletedAt: string,
): LivingMomentV1 | null {
  return parseLivingMoment({
    schema: LIVING_CHART_MOMENT_SCHEMA,
    id: current.id,
    owner: current.owner,
    primaryChartId: REDACTED_CHART_ID,
    occurredAt: REDACTED_INSTANT,
    timePrecision: 'exact',
    category: 'other',
    forecast: {
      schema: LIVING_CHART_FORECAST_SCHEMA,
      editionDate: '1970-01-01',
      chartId: REDACTED_CHART_ID,
      source: 'quiet',
      generatorVersion: 'deleted',
      capturedAt: REDACTED_INSTANT,
      lines: [{ id: 'deleted', text: 'Deleted', receipt: 'Deleted' }],
    },
    reflectionQuestionId: 'deleted',
    revision,
    baseRevision,
    syncState: 'deleted',
    createdAt: REDACTED_INSTANT,
    updatedAt: deletedAt,
    deletedAt,
  });
}

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

export class LivingChartStore {
  readonly adapter: LivingChartAsyncAdapter;
  private readonly accessAllowed: () => boolean;
  private readonly ownerAllowed: (owner: LivingChartOwnerScope) => boolean;
  private readonly now: () => Date;
  private readonly randomUUID: () => string;
  private readonly dispatch: (detail: LivingChartChangeDetail) => void;

  constructor(options: LivingChartStoreOptions = {}) {
    this.adapter = options.adapter ?? new IndexedDbLivingChartAdapter();
    this.accessAllowed = options.accessAllowed ?? profileAccessAllowed;
    this.ownerAllowed = options.ownerAllowed ?? ((owner) => {
      const current = resolveLivingChartOwnerScope({ accessAllowed: this.accessAllowed });
      if (owner.kind === 'account') {
        if (accountAuthorityMode === 'verified') return owner.accountId === authenticatedAccountOwnerId;
        if (accountAuthorityMode !== 'inactive') return false;
      }
      if (owner.kind === 'guest' && accountAuthorityMode !== 'inactive') {
        if (accountAuthorityMode === 'verified') return false;
        const guest = readLivingChartGuestOwnerScope();
        return guest !== null && sameOwner(guest, owner);
      }
      return current !== null && sameOwner(current, owner);
    });
    this.now = options.now ?? (() => new Date());
    this.randomUUID = options.randomUUID ?? defaultRandomUUID;
    this.dispatch = options.dispatch ?? dispatchLivingChartChange;
  }

  private accessIsAllowed(): boolean {
    try {
      return this.accessAllowed();
    } catch {
      return false;
    }
  }

  private ownerAccessAllowed(owner: LivingChartOwnerScope): boolean {
    if (!this.accessIsAllowed()) return false;
    try {
      return this.ownerAllowed(owner);
    } catch {
      return false;
    }
  }

  private allowedOwner(owner: LivingChartOwnerScope): string | null {
    if (!this.ownerAccessAllowed(owner)) return null;
    return livingChartOwnerKey(owner);
  }

  private async readOwnerRecords(owner: LivingChartOwnerScope): Promise<LivingMomentV1[] | null> {
    const ownerKey = this.allowedOwner(owner);
    if (!ownerKey) return null;
    try {
      const values = await this.adapter.readAll(ownerKey);
      if (!this.ownerAccessAllowed(owner)) return null;
      return parseOwnerRecords(values, owner);
    } catch {
      return null;
    }
  }

  async list(
    owner: LivingChartOwnerScope,
    options: { includeDeleted?: boolean } = {},
  ): Promise<LivingMomentV1[]> {
    const records = await this.readOwnerRecords(owner);
    if (!records) return [];
    return records
      .filter((moment) => options.includeDeleted === true || moment.syncState !== 'deleted')
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)
        || right.createdAt.localeCompare(left.createdAt)
        || right.id.localeCompare(left.id));
  }

  async get(owner: LivingChartOwnerScope, id: string): Promise<LivingMomentV1 | null> {
    if (!isAccountV2Id(id)) return null;
    const moments = await this.list(owner, { includeDeleted: true });
    if (!this.ownerAccessAllowed(owner)) return null;
    return moments.find((moment) => moment.id === id.toLowerCase()) ?? null;
  }

  async create(
    owner: LivingChartOwnerScope,
    input: CreateLivingMomentInput,
  ): Promise<LivingMomentV1 | null> {
    const ownerKey = this.allowedOwner(owner);
    if (!ownerKey) return null;
    const id = input.id ?? this.randomUUID();
    const timestamp = this.now().toISOString();
    const candidate = createLivingMomentRecord(owner, input, id, timestamp);
    if (!candidate) return null;
    try {
      const saved = await this.adapter.mutate<LivingMomentV1 | null>(ownerKey, (values) => {
        if (!this.ownerAccessAllowed(owner)) return { result: null };
        const records = parseOwnerRecords(values, owner);
        if (!records
          || records.some((moment) => moment.id === candidate.id)
          || records.filter((moment) => moment.syncState !== 'deleted').length >= MAX_ACTIVE_LIVING_MOMENTS) {
          return { result: null };
        }
        return { result: candidate, put: { id: candidate.id, value: candidate } };
      });
      if (!saved || !this.ownerAccessAllowed(owner)) return null;
      this.dispatch({ operation: 'create', owner: saved.owner, momentId: saved.id });
      return saved;
    } catch {
      return null;
    }
  }

  async update(
    owner: LivingChartOwnerScope,
    id: string,
    patch: UpdateLivingMomentInput,
  ): Promise<LivingMomentV1 | null> {
    const ownerKey = this.allowedOwner(owner);
    if (!ownerKey || !isAccountV2Id(id) || !patch || typeof patch !== 'object') return null;
    const normalizedNote = hasOwn(patch, 'note') ? normalizeLivingMomentNote(patch.note) : undefined;
    if (normalizedNote === null) return null;
    const timestamp = this.now().toISOString();
    try {
      const saved = await this.adapter.mutate<LivingMomentV1 | null>(ownerKey, (values) => {
        if (!this.ownerAccessAllowed(owner)) return { result: null };
        const records = parseOwnerRecords(values, owner);
        const current = records?.find((moment) => moment.id === id.toLowerCase());
        if (!current || current.syncState === 'deleted') return { result: null };
        const raw: Record<string, unknown> = {
          ...current,
          primaryChartId: patch.primaryChartId ?? current.primaryChartId,
          occurredAt: patch.occurredAt ?? current.occurredAt,
          timePrecision: patch.timePrecision ?? current.timePrecision,
          forecast: patch.forecast ?? current.forecast,
          reflectionQuestionId: patch.reflectionQuestionId ?? current.reflectionQuestionId,
          revision: current.revision + 1,
          syncState: current.syncState === 'synced' ? 'queued' : current.syncState,
          updatedAt: timestamp,
        };
        if (hasOwn(patch, 'category')) {
          if (patch.category === undefined) delete raw.category;
          else raw.category = patch.category;
        }
        if (hasOwn(patch, 'note')) {
          if (normalizedNote === undefined) delete raw.note;
          else raw.note = normalizedNote;
        }
        const next = parseLivingMoment(raw);
        return next
          ? { result: next, put: { id: next.id, value: next } }
          : { result: null };
      });
      if (!saved || !this.ownerAccessAllowed(owner)) return null;
      this.dispatch({ operation: 'update', owner: saved.owner, momentId: saved.id });
      return saved;
    } catch {
      return null;
    }
  }

  async softDelete(owner: LivingChartOwnerScope, id: string): Promise<boolean> {
    const ownerKey = this.allowedOwner(owner);
    if (!ownerKey || !isAccountV2Id(id)) return false;
    const timestamp = this.now().toISOString();
    try {
      const result = await this.adapter.mutate<{ ok: boolean; changed: boolean }>(ownerKey, (values) => {
        if (!this.ownerAccessAllowed(owner)) return { result: { ok: false, changed: false } };
        const records = parseOwnerRecords(values, owner);
        const current = records?.find((moment) => moment.id === id.toLowerCase());
        if (!current) return { result: { ok: false, changed: false } };
        if (current.syncState === 'deleted') return { result: { ok: true, changed: false } };
        if (owner.kind === 'guest') {
          return {
            result: { ok: true, changed: true },
            deleteId: current.id,
          };
        }
        const next = redactedTechnicalTombstone(
          current,
          current.revision + 1,
          current.baseRevision,
          timestamp,
        );
        return next
          ? { result: { ok: true, changed: true }, put: { id: next.id, value: next } }
          : { result: { ok: false, changed: false } };
      });
      if (!result.ok || !this.ownerAccessAllowed(owner)) return false;
      if (result.changed) this.dispatch({ operation: 'delete', owner, momentId: id.toLowerCase() });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Applies a server acknowledgement without losing an edit made while the
   * request was in flight. A newer local edit remains queued against the
   * newly confirmed server revision.
   */
  async acknowledgeSync(
    owner: LivingChartOwnerScope,
    id: string,
    expectedRevision: number,
    serverRevision: number,
  ): Promise<LivingMomentV1 | null> {
    const ownerKey = this.allowedOwner(owner);
    if (!ownerKey
      || !isAccountV2Id(id)
      || !Number.isSafeInteger(expectedRevision)
      || expectedRevision < 1
      || !Number.isSafeInteger(serverRevision)
      || serverRevision < 1) return null;
    try {
      const saved = await this.adapter.mutate<LivingMomentV1 | null>(ownerKey, (values) => {
        if (!this.ownerAccessAllowed(owner)) return { result: null };
        const records = parseOwnerRecords(values, owner);
        const current = records?.find((moment) => moment.id === id.toLowerCase());
        if (!current) return { result: null };
        if (current.syncState === 'deleted') {
          // A durable server delete means the content-free local outbox marker
          // has completed its only job and can be physically removed.
          return { result: current, deleteId: current.id };
        }
        const next = parseLivingMoment({
          ...current,
          baseRevision: serverRevision,
          syncState: current.revision === expectedRevision ? 'synced' : 'queued',
        });
        return next
          ? { result: next, put: { id: next.id, value: next } }
          : { result: null };
      });
      if (!saved || !this.ownerAccessAllowed(owner)) return null;
      this.dispatch({ operation: 'sync', owner, momentId: saved.id });
      return saved;
    } catch {
      return null;
    }
  }

  /** Preserves the device copy and records the revision needed for an explicit retry. */
  async markSyncConflict(
    owner: LivingChartOwnerScope,
    id: string,
    serverRevision: number,
  ): Promise<LivingMomentV1 | null> {
    const ownerKey = this.allowedOwner(owner);
    if (!ownerKey
      || !isAccountV2Id(id)
      || !Number.isSafeInteger(serverRevision)
      || serverRevision < 1) return null;
    try {
      const saved = await this.adapter.mutate<LivingMomentV1 | null>(ownerKey, (values) => {
        if (!this.ownerAccessAllowed(owner)) return { result: null };
        const records = parseOwnerRecords(values, owner);
        const current = records?.find((moment) => moment.id === id.toLowerCase());
        if (!current) return { result: null };
        const next = parseLivingMoment({
          ...current,
          baseRevision: serverRevision,
          syncState: current.syncState === 'deleted' ? 'deleted' : 'conflict',
        });
        return next
          ? { result: next, put: { id: next.id, value: next } }
          : { result: null };
      });
      if (!saved || !this.ownerAccessAllowed(owner)) return null;
      this.dispatch({ operation: 'sync', owner, momentId: saved.id });
      return saved;
    } catch {
      return null;
    }
  }

  /** Explicitly chooses the device copy after a conflict; it is never automatic. */
  async retryConflict(
    owner: LivingChartOwnerScope,
    id: string,
    resolution: 'device' | 'cloud',
  ): Promise<LivingMomentV1 | null> {
    const ownerKey = this.allowedOwner(owner);
    if (!ownerKey || !isAccountV2Id(id)) return null;
    try {
      const saved = await this.adapter.mutate<LivingMomentV1 | null>(ownerKey, (values) => {
        if (!this.ownerAccessAllowed(owner)) return { result: null };
        const records = parseOwnerRecords(values, owner);
        const current = records?.find((moment) => moment.id === id.toLowerCase());
        if (!current || current.syncState !== 'conflict' || !current.conflictCopy) return { result: null };
        const raw: Record<string, unknown> = resolution === 'device'
          ? { ...current, syncState: 'queued' }
          : {
              ...current,
              primaryChartId: current.conflictCopy.primaryChartId,
              occurredAt: current.conflictCopy.occurredAt,
              timePrecision: current.conflictCopy.timePrecision,
              category: current.conflictCopy.category,
              note: current.conflictCopy.note,
              forecast: current.conflictCopy.forecast,
              reflectionQuestionId: current.conflictCopy.reflectionQuestionId,
              baseRevision: current.conflictCopy.serverRevision,
              syncState: 'synced',
              createdAt: current.conflictCopy.createdAt,
              updatedAt: current.conflictCopy.updatedAt,
            };
        delete raw.conflictCopy;
        if (raw.category === undefined) delete raw.category;
        if (raw.note === undefined) delete raw.note;
        const next = parseLivingMoment(raw);
        return next
          ? { result: next, put: { id: next.id, value: next } }
          : { result: null };
      });
      if (!saved || !this.ownerAccessAllowed(owner)) return null;
      this.dispatch({ operation: 'sync', owner, momentId: saved.id });
      return saved;
    } catch {
      return null;
    }
  }

  /**
   * Merges a remote record into the local cache. Unsynced device work wins by
   * becoming a visible conflict; remote data is never allowed to erase it.
   */
  async cacheRemote(
    owner: LivingChartOwnerScope,
    remote: LivingMomentV1,
    serverRevision: number,
  ): Promise<'applied' | 'unchanged' | 'conflict' | 'failed'> {
    const ownerKey = this.allowedOwner(owner);
    if (!ownerKey
      || !sameOwner(remote.owner, owner)
      || !Number.isSafeInteger(serverRevision)
      || serverRevision < 1) return 'failed';
    try {
      const result = await this.adapter.mutate<'applied' | 'unchanged' | 'conflict' | 'failed'>(ownerKey, (values) => {
        if (!this.ownerAccessAllowed(owner)) return { result: 'failed' };
        const records = parseOwnerRecords(values, owner);
        if (!records) return { result: 'failed' };
        const current = records.find((moment) => moment.id === remote.id);
        if (current
          && current.baseRevision >= serverRevision
          && !(current.syncState === 'conflict' && !current.conflictCopy)) return { result: 'unchanged' };
        if (current && current.syncState !== 'synced') {
          const conflict = parseLivingMoment({
            ...current,
            baseRevision: serverRevision,
            syncState: current.syncState === 'deleted' ? 'deleted' : 'conflict',
            ...(current.syncState === 'deleted'
              ? {}
              : { conflictCopy: conflictCopyFromRemote(remote, serverRevision) }),
          });
          return conflict
            ? { result: 'conflict', put: { id: conflict.id, value: conflict } }
            : { result: 'failed' };
        }
        const canonical = parseLivingMoment({
          ...remote,
          owner,
          baseRevision: serverRevision,
          syncState: remote.syncState === 'deleted' ? 'deleted' : 'synced',
        });
        return canonical
          ? { result: 'applied', put: { id: canonical.id, value: canonical } }
          : { result: 'failed' };
      });
      if (!this.ownerAccessAllowed(owner)) return 'failed';
      if (result === 'applied' || result === 'conflict') {
        this.dispatch({ operation: 'sync', owner, momentId: remote.id });
      }
      return result;
    } catch {
      return 'failed';
    }
  }

  async cacheRemoteDeletion(
    owner: LivingChartOwnerScope,
    id: string,
    serverRevision: number,
    deletedAt: string,
  ): Promise<'applied' | 'unchanged' | 'conflict' | 'failed'> {
    const parsedDeletedAt = new Date(deletedAt);
    const ownerKey = this.allowedOwner(owner);
    if (!ownerKey
      || !isAccountV2Id(id)
      || !Number.isSafeInteger(serverRevision)
      || serverRevision < 1
      || !Number.isFinite(parsedDeletedAt.getTime())
      || parsedDeletedAt.toISOString() !== deletedAt) return 'failed';
    try {
      const result = await this.adapter.mutate<'applied' | 'unchanged' | 'conflict' | 'failed'>(ownerKey, (values) => {
        if (!this.ownerAccessAllowed(owner)) return { result: 'failed' };
        const records = parseOwnerRecords(values, owner);
        if (!records) return { result: 'failed' };
        const current = records.find((moment) => moment.id === id.toLowerCase());
        // A tombstone wins even at the same terminal revision. Only a strictly
        // newer local server receipt can make this snapshot row stale.
        if (!current || current.baseRevision > serverRevision) return { result: 'unchanged' };
        return {
          result: 'applied',
          deleteId: current.id,
        };
      });
      if (!this.ownerAccessAllowed(owner)) return 'failed';
      if (result === 'applied') {
        this.dispatch({ operation: 'sync', owner, momentId: id.toLowerCase() });
      }
      return result;
    } catch {
      return 'failed';
    }
  }

  /** Authoritative deletion-wins path for a stale put, including pruned tombstones. */
  async acceptRemoteDeletion(
    owner: LivingChartOwnerScope,
    id: string,
    serverRevision: number,
  ): Promise<boolean> {
    const ownerKey = this.allowedOwner(owner);
    if (!ownerKey
      || !isAccountV2Id(id)
      || !Number.isSafeInteger(serverRevision)
      || serverRevision < 1) return false;
    try {
      const saved = await this.adapter.mutate<boolean>(ownerKey, (values) => {
        if (!this.ownerAccessAllowed(owner)) return { result: false };
        const records = parseOwnerRecords(values, owner);
        const current = records?.find((moment) => moment.id === id.toLowerCase());
        if (!current) return { result: true };
        return { result: true, deleteId: current.id };
      });
      if (!saved || !this.ownerAccessAllowed(owner)) return false;
      this.dispatch({ operation: 'sync', owner, momentId: id.toLowerCase() });
      return true;
    } catch {
      return false;
    }
  }

  async clearOwner(owner: LivingChartOwnerScope): Promise<boolean> {
    const ownerKey = this.allowedOwner(owner);
    if (!ownerKey) return false;
    try {
      await this.adapter.clear(ownerKey);
      if (!this.ownerAccessAllowed(owner)) return false;
      this.dispatch({ operation: 'clear', owner, momentId: null });
      return true;
    } catch {
      return false;
    }
  }

  /** Keeps device copies after consent withdrawal while forgetting cloud revisions. */
  async resetSyncState(owner: LivingChartOwnerScope): Promise<boolean> {
    const ownerKey = this.allowedOwner(owner);
    if (!ownerKey) return false;
    try {
      const records = await this.readOwnerRecords(owner);
      if (!records) return false;
      for (const current of records) {
        if (current.syncState === 'deleted') {
          const removed = await this.adapter.mutate<boolean>(ownerKey, () => ({
            result: true,
            deleteId: current.id,
          }));
          if (!removed || !this.ownerAccessAllowed(owner)) return false;
          continue;
        }
        const raw: Record<string, unknown> = {
          ...current,
          baseRevision: 0,
          syncState: 'local',
        };
        delete raw.conflictCopy;
        const next = parseLivingMoment(raw);
        if (!next) return false;
        const saved = await this.adapter.mutate<boolean>(ownerKey, () => ({
          result: true,
          put: { id: next.id, value: next },
        }));
        if (!saved || !this.ownerAccessAllowed(owner)) return false;
      }
      this.dispatch({ operation: 'sync', owner, momentId: null });
      return true;
    } catch {
      return false;
    }
  }

  async clearAll(): Promise<boolean> {
    if (!this.accessIsAllowed()) return false;
    try {
      await this.adapter.clearAll();
      if (!this.accessIsAllowed()) return false;
      this.dispatch({ operation: 'clear', owner: null, momentId: null });
      return true;
    } catch {
      return false;
    }
  }

  async export(
    owner: LivingChartOwnerScope,
    format: 'json' | 'markdown',
  ): Promise<string | null> {
    if (format !== 'json' && format !== 'markdown') return null;
    const records = await this.readOwnerRecords(owner);
    if (!records || !this.ownerAccessAllowed(owner)) return null;
    const moments = records
      .filter((moment) => moment.syncState !== 'deleted')
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)
        || right.createdAt.localeCompare(left.createdAt)
        || right.id.localeCompare(left.id));
    const exportedAt = this.now().toISOString();
    if (format === 'markdown') return markdownExport(exportedAt, moments);
    const payload: LivingChartExportV1 = {
      schema: LIVING_CHART_EXPORT_SCHEMA,
      exportedAt,
      ownerKind: owner.kind,
      moments: moments.map((moment) => {
        const { owner: _owner, baseRevision: _base, syncState: _sync, deletedAt: _deleted, ...portable } = moment;
        return portable;
      }),
    };
    return JSON.stringify(payload, null, 2);
  }

  close(): void {
    this.adapter.close?.();
  }
}

export function createLivingChartStore(options: LivingChartStoreOptions = {}): LivingChartStore {
  return new LivingChartStore(options);
}

const defaultAdapter = new IndexedDbLivingChartAdapter();
const defaultStore = new LivingChartStore({ adapter: defaultAdapter });

export function listLivingMoments(
  owner: LivingChartOwnerScope,
  options: { includeDeleted?: boolean } = {},
): Promise<LivingMomentV1[]> {
  return defaultStore.list(owner, options);
}

export function getLivingMoment(
  owner: LivingChartOwnerScope,
  id: string,
): Promise<LivingMomentV1 | null> {
  return defaultStore.get(owner, id);
}

/**
 * The three moment edits a person makes wait for this tab's account access
 * decision first (profile-access-request.ts). The store still refuses unless
 * access and the owner check pass; a bootstrap that cannot start leaves the
 * edit unmade, reported like any other failed edit.
 */
async function livingChartWriteMayProceed(): Promise<boolean> {
  return await ensureProfileWriteAccess() !== 'unavailable';
}

export async function createLivingMoment(
  owner: LivingChartOwnerScope,
  input: CreateLivingMomentInput,
): Promise<LivingMomentV1 | null> {
  if (!await livingChartWriteMayProceed()) return null;
  return defaultStore.create(owner, input);
}

export async function updateLivingMoment(
  owner: LivingChartOwnerScope,
  id: string,
  patch: UpdateLivingMomentInput,
): Promise<LivingMomentV1 | null> {
  if (!await livingChartWriteMayProceed()) return null;
  return defaultStore.update(owner, id, patch);
}

export async function deleteLivingMoment(
  owner: LivingChartOwnerScope,
  id: string,
): Promise<boolean> {
  if (!await livingChartWriteMayProceed()) return false;
  return defaultStore.softDelete(owner, id);
}

export function acknowledgeLivingMomentSync(
  owner: LivingChartOwnerScope,
  id: string,
  expectedRevision: number,
  serverRevision: number,
): Promise<LivingMomentV1 | null> {
  return defaultStore.acknowledgeSync(owner, id, expectedRevision, serverRevision);
}

export function markLivingMomentSyncConflict(
  owner: LivingChartOwnerScope,
  id: string,
  serverRevision: number,
): Promise<LivingMomentV1 | null> {
  return defaultStore.markSyncConflict(owner, id, serverRevision);
}

export function retryLivingMomentConflict(
  owner: LivingChartOwnerScope,
  id: string,
  resolution: 'device' | 'cloud',
): Promise<LivingMomentV1 | null> {
  return defaultStore.retryConflict(owner, id, resolution);
}

export function cacheRemoteLivingMoment(
  owner: LivingChartOwnerScope,
  remote: LivingMomentV1,
  serverRevision: number,
): Promise<'applied' | 'unchanged' | 'conflict' | 'failed'> {
  return defaultStore.cacheRemote(owner, remote, serverRevision);
}

export function cacheRemoteLivingMomentDeletion(
  owner: LivingChartOwnerScope,
  id: string,
  serverRevision: number,
  deletedAt: string,
): Promise<'applied' | 'unchanged' | 'conflict' | 'failed'> {
  return defaultStore.cacheRemoteDeletion(owner, id, serverRevision, deletedAt);
}

export function acceptLivingMomentRemoteDeletion(
  owner: LivingChartOwnerScope,
  id: string,
  serverRevision: number,
): Promise<boolean> {
  return defaultStore.acceptRemoteDeletion(owner, id, serverRevision);
}

function samePortableMoment(left: LivingMomentV1, right: LivingMomentV1): boolean {
  const portable = (moment: LivingMomentV1) => ({
    id: moment.id,
    primaryChartId: moment.primaryChartId,
    occurredAt: moment.occurredAt,
    timePrecision: moment.timePrecision,
    category: moment.category,
    note: moment.note,
    forecast: moment.forecast,
    reflectionQuestionId: moment.reflectionQuestionId,
    createdAt: moment.createdAt,
  });
  return JSON.stringify(portable(left)) === JSON.stringify(portable(right));
}

function accountOwnerIsAuthorized(
  owner: Extract<LivingChartOwnerScope, { kind: 'account' }>,
): boolean {
  if (!profileAccessAllowed()) return false;
  if (accountAuthorityMode === 'verified') return authenticatedAccountOwnerId === owner.accountId;
  if (accountAuthorityMode !== 'inactive') return false;
  const local = resolveLivingChartOwnerScope();
  return local !== null && sameOwner(local, owner);
}

/** Returns the active guest entries available for an explicit account import. */
export async function countImportableGuestLivingMoments(
  accountOwner: Extract<LivingChartOwnerScope, { kind: 'account' }>,
): Promise<number> {
  const guest = readLivingChartGuestOwnerScope();
  if (!accountOwnerIsAuthorized(accountOwner)
    || !guest
    || !profileAccessAllowed()) return 0;
  const guestKey = livingChartOwnerKey(guest);
  const accountKey = livingChartOwnerKey(accountOwner);
  if (!guestKey || !accountKey) return 0;
  try {
    const source = parseOwnerRecords(await defaultAdapter.readAll(guestKey), guest);
    const target = parseOwnerRecords(await defaultAdapter.readAll(accountKey), accountOwner);
    if (!accountOwnerIsAuthorized(accountOwner) || !source || !target) return 0;
    return source.filter((moment) => moment.syncState !== 'deleted' && !target.some((candidate) => (
      candidate.id === moment.id && samePortableMoment(candidate, {
        ...moment,
        owner: accountOwner,
      })
    ))).length;
  } catch {
    return 0;
  }
}

/**
 * Copies the old guest vault only after the signed-in person asks. Stable
 * moment IDs make retries idempotent; differing same-ID content is preserved
 * as a conflict instead of being overwritten.
 */
export async function importGuestLivingMomentsToAccount(
  accountOwner: Extract<LivingChartOwnerScope, { kind: 'account' }>,
  options: { momentId?: string } = {},
): Promise<LivingChartImportResult | null> {
  const guest = readLivingChartGuestOwnerScope();
  if (!accountOwnerIsAuthorized(accountOwner)
    || !guest
    || !profileAccessAllowed()) return null;
  const guestKey = livingChartOwnerKey(guest);
  const accountKey = livingChartOwnerKey(accountOwner);
  if (!guestKey || !accountKey) return null;
  try {
    const source = parseOwnerRecords(await defaultAdapter.readAll(guestKey), guest);
    if (!source || !accountOwnerIsAuthorized(accountOwner)) return null;
    const result: LivingChartImportResult = { imported: 0, alreadyPresent: 0, conflicts: 0 };
    for (const guestMoment of source) {
      if (guestMoment.syncState === 'deleted') continue;
      if (options.momentId && guestMoment.id !== options.momentId.toLowerCase()) continue;
      const outcome = await defaultAdapter.mutate<'imported' | 'present' | 'conflict' | 'failed'>(accountKey, (values) => {
        if (!profileAccessAllowed()) return { result: 'failed' };
        if (!accountOwnerIsAuthorized(accountOwner)) return { result: 'failed' };
        const records = parseOwnerRecords(values, accountOwner);
        if (!records) return { result: 'failed' };
        const existing = records.find((moment) => moment.id === guestMoment.id);
        const imported = parseLivingMoment({
          ...guestMoment,
          owner: accountOwner,
          baseRevision: 0,
          syncState: 'local',
          deletedAt: null,
        });
        if (!imported) return { result: 'failed' };
        if (existing) {
          return { result: samePortableMoment(existing, imported) ? 'present' : 'conflict' };
        }
        const activeCount = records.filter((moment) => moment.syncState !== 'deleted').length;
        return activeCount >= MAX_ACTIVE_LIVING_MOMENTS
          ? { result: 'failed' }
          : { result: 'imported', put: { id: imported.id, value: imported } };
      });
      if (outcome === 'failed') return null;
      if (outcome === 'imported') result.imported += 1;
      else if (outcome === 'present') result.alreadyPresent += 1;
      else result.conflicts += 1;
    }
    if (!profileAccessAllowed()) return null;
    if (result.imported > 0) {
      dispatchLivingChartChange({ operation: 'import', owner: accountOwner, momentId: null });
    }
    return result;
  } catch {
    return null;
  }
}

export function clearLivingChartOwner(owner: LivingChartOwnerScope): Promise<boolean> {
  return defaultStore.clearOwner(owner);
}

export function resetLivingChartSyncState(owner: LivingChartOwnerScope): Promise<boolean> {
  return defaultStore.resetSyncState(owner);
}

export function clearAllLivingChartData(): Promise<boolean> {
  return defaultStore.clearAll();
}

function categoryLabel(category: LivingMomentV1['category']): string {
  if (!category) return '';
  return category === 'relationships'
    ? 'Relationships'
    : category === 'wellbeing'
      ? 'Wellbeing'
      : `${category[0]?.toUpperCase() ?? ''}${category.slice(1)}`;
}

function markdownQuote(value: string): string {
  return value.split('\n').map((line) => `> ${line}`).join('\n');
}

function markdownExport(exportedAt: string, moments: LivingMomentV1[]): string {
  const sections = moments.map((moment) => {
    const metadata = [moment.timePrecision.replace('_', ' '), categoryLabel(moment.category)]
      .filter(Boolean)
      .join(' · ');
    const forecast = moment.forecast.lines.map((line) => (
      `- ${line.text}\n  - Receipt: ${line.receipt}`
    )).join('\n');
    return [
      `## ${moment.occurredAt}`,
      metadata ? `_${metadata}_` : '',
      moment.note ? markdownQuote(moment.note) : '',
      '### Forecast saved with this moment',
      forecast,
      `Reflection prompt: ${moment.reflectionQuestionId}`,
    ].filter(Boolean).join('\n\n');
  });
  return [
    '# Living Chart',
    `Exported ${exportedAt}`,
    ...sections,
    '',
  ].join('\n\n');
}

export async function exportLivingChart(
  owner: LivingChartOwnerScope,
  format: 'json' | 'markdown',
): Promise<string | null> {
  return defaultStore.export(owner, format);
}

export function subscribeLivingChart(
  listener: (detail: LivingChartChangeDetail) => void,
): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
  const onChange = (event: Event) => {
    const detail = (event as CustomEvent<LivingChartChangeDetail>).detail;
    if (detail) listener(detail);
  };
  window.addEventListener(LIVING_CHART_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(LIVING_CHART_CHANGE_EVENT, onChange);
}

export function invalidateLivingChartAccess(): void {
  authenticatedAccountOwnerId = null;
  accountAuthorityMode = 'signed_out';
  defaultStore.close();
  dispatchLivingChartChange({ operation: 'invalidate', owner: null, momentId: null });
}

/** Closes decrypted access promptly on same-tab and cross-tab profile revocation. */
export function installLivingChartAccessInvalidation(): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
  const onRevoke = () => invalidateLivingChartAccess();
  const onProfileAccess = () => {
    if (!profileAccessAllowed()) invalidateLivingChartAccess();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === ACCOUNT_V2_PROFILE_LEASE_REVOKE_KEY) {
      invalidateLivingChartAccess();
      return;
    }
    if (event.key === LIVING_CHART_CLEAR_REQUEST_KEY && event.newValue !== null) {
      // The durable marker carries the authorization captured by the profile
      // boundary. Clearing returns no data, so it must also recover while the
      // shared read lease is revoked.
      void drainLivingChartClearRequest({ boundaryAuthorized: true });
      return;
    }
    if (event.key === LIVING_CHART_CHANGE_PULSE_KEY && event.newValue !== null) {
      defaultStore.close();
      dispatchLivingChartEvent({ operation: 'invalidate', owner: null, momentId: null });
    }
  };
  window.addEventListener(ACCOUNT_V2_PROFILE_REVOKE_EVENT, onRevoke);
  window.addEventListener('zodiacs:profile-access', onProfileAccess);
  window.addEventListener('storage', onStorage);
  // A prior tab or page lifecycle may have ended after recording the marker
  // but before IndexedDB became available. Resume it on the next mount.
  void drainLivingChartClearRequest({ boundaryAuthorized: true });
  return () => {
    window.removeEventListener(ACCOUNT_V2_PROFILE_REVOKE_EVENT, onRevoke);
    window.removeEventListener('zodiacs:profile-access', onProfileAccess);
    window.removeEventListener('storage', onStorage);
  };
}

type LivingChartClearTarget = 'all' | string;

interface LivingChartClearRequest {
  version: 2;
  requestId: string;
  targets: LivingChartClearTarget[];
}

const MAX_PENDING_CLEAR_TARGETS = 128;
const MAX_CLEAR_REQUEST_BYTES = 8 * 1024;

function browserLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function validClearTarget(value: unknown): value is LivingChartClearTarget {
  if (value === 'all') return true;
  if (typeof value !== 'string') return false;
  const separator = value.indexOf(':');
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  return (kind === 'guest' || kind === 'account') && isAccountV2Id(id);
}

function parseClearRequest(value: string | null): LivingChartClearRequest | null {
  if (value === null || new TextEncoder().encode(value).byteLength > MAX_CLEAR_REQUEST_BYTES) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const row = parsed as Record<string, unknown>;
    if (!isAccountV2Id(row.requestId)) return null;
    // Accept the original single-target marker so pending deletions recorded
    // by an older page survive a deployment and are upgraded on the next write.
    if (row.version === 1
      && Object.keys(row).sort().join(',') === 'requestId,target,version'
      && validClearTarget(row.target)) {
      return { version: 2, requestId: row.requestId, targets: [row.target] };
    }
    if (row.version !== 2
      || Object.keys(row).sort().join(',') !== 'requestId,targets,version'
      || !Array.isArray(row.targets)
      || row.targets.length < 1
      || row.targets.length > MAX_PENDING_CLEAR_TARGETS
      || row.targets.some((target) => !validClearTarget(target))) return null;
    const targets = [...new Set(row.targets as LivingChartClearTarget[])];
    if (targets.length !== row.targets.length
      || (targets.includes('all') && targets.length !== 1)) return null;
    return { version: 2, requestId: row.requestId, targets };
  } catch {
    return null;
  }
}

async function executeClearRequest(
  request: LivingChartClearRequest,
  storage: Storage,
): Promise<boolean> {
  try {
    for (const target of request.targets) {
      if (target === 'all') {
        await defaultAdapter.clearAll();
        break;
      }
      await defaultAdapter.clear(target);
    }
    const current = parseClearRequest(storage.getItem(LIVING_CHART_CLEAR_REQUEST_KEY));
    if (current?.requestId === request.requestId) {
      storage.removeItem(LIVING_CHART_CLEAR_REQUEST_KEY);
    }
    dispatchLivingChartChange({ operation: 'clear', owner: null, momentId: null });
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronous hook for an exclusive profile-boundary transition. Authorization
 * is checked before a content-free durable request is recorded; the captured
 * clear then returns no private data and can finish after the lease is revoked.
 */
export function requestLivingChartClear(
  target: LivingChartOwnerScope | 'all',
  options: { boundaryAuthorized?: boolean } = {},
): boolean {
  // The exclusive profile-boundary callback runs after shared read leases have
  // yielded, so its access reader is intentionally false. This override can
  // only erase an explicitly named local vault and never returns its contents.
  if (options.boundaryAuthorized !== true && !profileAccessAllowed()) return false;
  const storage = browserLocalStorage();
  const requestId = defaultRandomUUID();
  const targetKey = target === 'all' ? 'all' : livingChartOwnerKey(target);
  if (!storage || !isAccountV2Id(requestId) || !targetKey) return false;
  let existing: LivingChartClearRequest | null;
  try {
    existing = parseClearRequest(storage.getItem(LIVING_CHART_CLEAR_REQUEST_KEY));
  } catch {
    return false;
  }
  const targets = targetKey === 'all' || existing?.targets.includes('all')
    ? ['all']
    : [...new Set([...(existing?.targets ?? []), targetKey])];
  if (targets.length > MAX_PENDING_CLEAR_TARGETS) return false;
  const request: LivingChartClearRequest = {
    version: 2,
    requestId: requestId.toLowerCase(),
    targets,
  };
  const serialized = JSON.stringify(request);
  try {
    storage.setItem(LIVING_CHART_CLEAR_REQUEST_KEY, serialized);
    if (storage.getItem(LIVING_CHART_CLEAR_REQUEST_KEY) !== serialized) return false;
  } catch {
    return false;
  }
  invalidateLivingChartAccess();
  void executeClearRequest(request, storage);
  return true;
}

export async function drainLivingChartClearRequest(
  options: { boundaryAuthorized?: boolean } = {},
): Promise<boolean> {
  if (options.boundaryAuthorized !== true && !profileAccessAllowed()) return false;
  const storage = browserLocalStorage();
  if (!storage) return false;
  let request: LivingChartClearRequest | null;
  try {
    const raw = storage.getItem(LIVING_CHART_CLEAR_REQUEST_KEY);
    if (raw === null) return true;
    request = parseClearRequest(raw);
  } catch {
    return false;
  }
  if (!request) return false;
  invalidateLivingChartAccess();
  return executeClearRequest(request, storage);
}
