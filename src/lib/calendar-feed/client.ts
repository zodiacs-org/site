/**
 * The page's side of calendar feeds addressed by opaque ids. Nothing is
 * stored, here or on the server, until the person subscribes. Subscribing
 * sends the chart's positions code once, in the body of a POST; the server
 * answers with the feed's id, its address and the key that removes it.
 *
 * This browser keeps, for each feed it made, the id, the address (which lets
 * anyone who has it read the calendar), the key that removes the feed and
 * when it was made, and nothing about the chart. They sit under one
 * `zodiacs.` key like the site's other local records. Removing a feed here
 * removes its entry; otherwise they stay until the site's data is cleared
 * (signing out with "clear all Zodiacs data" does that too, and says that a
 * calendar can then be removed only by email), even after the server has
 * deleted the feed. There is no limit on how many are kept, so a key is never
 * dropped to make room.
 */
import {
  CALENDAR_FEED_ID_RE,
  CALENDAR_FEED_SECRET_RE,
  CALENDAR_FEEDS_PATH,
  calendarFeedPath,
  calendarFeedWebcalUrl,
} from './shared';
import { ACCOUNT_V2_PROFILE_LOCK_NAME } from '../account-v2/profile-lease';
import { ACCOUNT_V2_PROFILE_LEASE_REVOKE_KEY } from '../account-v2/storage-identity';

export const CALENDAR_FEEDS_STORAGE_KEY = 'zodiacs.calendar-feeds.v1';
/** Content-free; established only on an explicit subscribe and removed by clear-all. */
export const CALENDAR_FEED_STORAGE_FENCE_KEY = 'zodiacs.calendar-feeds.fence.v1';
const CALENDAR_FEED_STORAGE_LOCK_NAME = 'zodiacs-calendar-feed-storage-v1';
type FeedStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface KeptCalendarFeed {
  id: string;
  /** The feed's https address. */
  url: string;
  /** The key that removes the feed; the server keeps only its digest. */
  secret: string;
  /** Epoch milliseconds. */
  madeAt: number;
}

export type CreateCalendarFeedResult =
  | { state: 'created'; feed: KeptCalendarFeed; kept: boolean }
  | { state: 'rate-limited' | 'unavailable' | 'offline' | 'busy' | 'cancelled' };

export type RemoveCalendarFeedResult = 'removed' | 'unavailable' | 'offline' | 'busy';

interface CalendarFeedSession {
  feeds: Map<string, KeptCalendarFeed>;
  removed: Set<string>;
  pending: string | null;
  listeners: Set<() => void>;
  storageEpoch: number;
  clearEpoch: number;
  active: boolean;
  storage: () => FeedStorage | undefined;
  locks: LockManager | null;
  fence: string | null | undefined;
}

function storageFor(session: CalendarFeedSession | null): FeedStorage | undefined {
  try { return session ? session.storage() : localStorage; } catch { return undefined; }
}

function readFence(storage: FeedStorage | undefined): string | null | undefined {
  try { return storage?.getItem(CALENDAR_FEED_STORAGE_FENCE_KEY); } catch { return undefined; }
}

function clearSession(session: CalendarFeedSession): void {
  session.clearEpoch += 1;
  session.feeds.clear();
  session.removed.clear();
  notify(session);
}

/** Read the source of truth, never a delayed event's old/newValue. No writes. */
function reconcileFence(session: CalendarFeedSession): void {
  const fence = readFence(storageFor(session));
  if (fence === undefined) return;
  const erased = session.fence != null && fence !== session.fence;
  session.fence = fence;
  if (erased) clearSession(session);
}

// An island can disappear while its POST is still running. Keep approved
// capabilities for this document, never chart codes or a server/SSR singleton.
// A reload (including clear-all's reload) gets a new document and no fallback.
const sessions = new WeakMap<Document, CalendarFeedSession>();
function feedSession(): CalendarFeedSession | null {
  if (typeof document === 'undefined') return null;
  let session = sessions.get(document);
  if (!session) {
    const ownerWindow = window;
    const storage = () => {
      try { return ownerWindow.localStorage; } catch { return undefined; }
    };
    let locks: LockManager | null = null;
    try { locks = navigator.locks ?? null; } catch { /* Memory-only recovery remains available. */ }
    session = {
      feeds: new Map(), removed: new Set(), pending: null, listeners: new Set(),
      storageEpoch: 0, clearEpoch: 0, active: true, storage, locks, fence: readFence(storage()),
    };
    sessions.set(document, session);
    const current = session;
    // Clear-all revokes leases before clearing storage, then awaits sign-out
    // before reloading. A pre-transition request must not refill that storage.
    window.addEventListener('zodiacs:profile-lease-revoke', () => { current.storageEpoch += 1; });
    window.addEventListener('zodiacs:calendar-feeds-cleared', () => {
      current.fence = readFence(storageFor(current));
      clearSession(current);
    });
    window.addEventListener('storage', (event) => {
      if (event.key === ACCOUNT_V2_PROFILE_LEASE_REVOKE_KEY) current.storageEpoch += 1;
      if (event.key === null || event.key === CALENDAR_FEED_STORAGE_FENCE_KEY) reconcileFence(current);
    });
    window.addEventListener('pageshow', () => reconcileFence(current));
    window.addEventListener('focus', () => reconcileFence(current));
    document.addEventListener('visibilitychange', () => reconcileFence(current));
    window.addEventListener('pagehide', (event) => {
      if (event.persisted) return;
      current.active = false;
      current.feeds.clear();
      current.listeners.clear();
    });
  }
  reconcileFence(session);
  return session;
}

/** Only the local compare/write is locked; an offline POST cannot block erasure. */
async function withFeedStorageLock<T>(
  session: CalendarFeedSession | null,
  commit: () => T,
  unavailable: () => T,
): Promise<T> {
  if (!session) return commit();
  const locks = session.locks;
  if (!locks) return unavailable();
  try {
    return await locks.request(ACCOUNT_V2_PROFILE_LOCK_NAME, { mode: 'shared' }, () =>
      locks.request(CALENDAR_FEED_STORAGE_LOCK_NAME, { mode: 'exclusive' }, commit));
  } catch {
    return unavailable();
  }
}

function establishFence(session: CalendarFeedSession, clearEpoch: number): string | null {
  reconcileFence(session);
  if (!session.active || session.clearEpoch !== clearEpoch) return null;
  const storage = storageFor(session);
  let fence = readFence(storage);
  if (!storage || fence === undefined) return null;
  if (fence === null) {
    try {
      fence = crypto.randomUUID();
      storage.setItem(CALENDAR_FEED_STORAGE_FENCE_KEY, fence);
      if (readFence(storage) !== fence) return null;
    } catch { return null; }
  }
  session.fence = fence;
  return fence;
}

function notify(session: CalendarFeedSession | null): void {
  session?.listeners.forEach((listener) => {
    try { listener(); } catch { console.error('Calendar view could not be refreshed.'); }
  });
}

/** Live request ownership is shared by every island in this document. */
export function calendarFeedRequestPending(): string | null {
  return feedSession()?.pending ?? null;
}

/** Fences view callbacks already queued when explicit local erasure happens. */
export function calendarFeedClearEpoch(): number {
  return feedSession()?.clearEpoch ?? 0;
}

/** Observe late completions even when a different island started the request. */
export function watchCalendarFeeds(listener: () => void): () => void {
  const session = feedSession();
  session?.listeners.add(listener);
  return () => { session?.listeners.delete(listener); };
}

/** Stored feeds plus capabilities retained only until this document is left. */
export function readAvailableCalendarFeeds(): KeptCalendarFeed[] {
  const session = feedSession();
  const feeds = new Map(readStoredFeeds(storageFor(session)).map((feed) => [feed.id, feed]));
  session?.feeds.forEach((feed, id) => feeds.set(id, feed));
  session?.removed.forEach((id) => feeds.delete(id));
  return [...feeds.values()].sort((a, b) => b.madeAt - a.madeAt);
}

/** These keys are removable here but will be lost when this document is left. */
export function hasUnstoredCalendarFeeds(): boolean {
  const stored = new Set(readKeptCalendarFeeds().map((feed) => feed.id));
  return readAvailableCalendarFeeds().some((feed) => !stored.has(feed.id));
}

/** A stored or returned feed; anything else in the record, such as an older chart digest, is dropped. */
function keptFeed(value: unknown): KeptCalendarFeed | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string'
    || !CALENDAR_FEED_ID_RE.test(row.id)
    || typeof row.secret !== 'string'
    || !CALENDAR_FEED_SECRET_RE.test(row.secret)
    || typeof row.url !== 'string'
    || calendarFeedWebcalUrl(row.url) === null
    || !row.url.endsWith(calendarFeedPath(row.id))
    || typeof row.madeAt !== 'number'
    || !Number.isFinite(row.madeAt)) return null;
  return { id: row.id, url: row.url, secret: row.secret, madeAt: row.madeAt };
}

/** The feeds this browser made, newest first; malformed entries are dropped. */
export function readKeptCalendarFeeds(): KeptCalendarFeed[] {
  return readStoredFeeds(storageFor(null));
}

function readStoredFeeds(storage: FeedStorage | undefined): KeptCalendarFeed[] {
  return readFeedSnapshot(storage) ?? [];
}

/** A failed read must not be mistaken for an empty record when writing. */
function readFeedSnapshot(storage: FeedStorage | undefined): KeptCalendarFeed[] | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CALENDAR_FEEDS_STORAGE_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) return [];
    const feeds = (value as { feeds?: unknown }).feeds;
    if (!Array.isArray(feeds)) return [];
    return feeds
      .map(keptFeed)
      .filter((feed): feed is KeptCalendarFeed => feed !== null)
      .sort((a, b) => b.madeAt - a.madeAt);
  } catch {
    return null;
  }
}

function writeKeptCalendarFeeds(feeds: KeptCalendarFeed[], storage: FeedStorage | undefined): boolean {
  if (!storage) return false;
  try {
    if (feeds.length === 0) storage.removeItem(CALENDAR_FEEDS_STORAGE_KEY);
    else storage.setItem(CALENDAR_FEEDS_STORAGE_KEY, JSON.stringify({ version: 1, feeds }));
    return true;
  } catch {
    return false;
  }
}

function forgetCalendarFeed(id: string, storage: FeedStorage | undefined): void {
  const kept = readFeedSnapshot(storage);
  if (!kept) return;
  const rest = kept.filter((feed) => feed.id !== id);
  if (rest.length !== kept.length) writeKeptCalendarFeeds(rest, storage);
}

function offline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Makes a feed from the positions code and keeps its key in this browser.
 * `kept` is false when the key could not safely be stored in this browser.
 */
export async function createCalendarFeed(
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<CreateCalendarFeedResult> {
  const session = feedSession();
  if (session?.pending) return { state: 'busy' };
  if (offline()) return { state: 'offline' };
  const storageEpoch = session?.storageEpoch;
  const clearEpoch = session?.clearEpoch;
  if (session) session.pending = 'adding';
  notify(session);
  try {
    const fence = session
      ? await withFeedStorageLock(session, () => establishFence(session, clearEpoch!), () => null)
      : null;
    if (session && (!session.active || session.clearEpoch !== clearEpoch)) return { state: 'cancelled' };
    return await requestCalendarFeed(code, fetcher, session, storageEpoch, clearEpoch, fence);
  } finally {
    if (session) session.pending = null;
    notify(session);
  }
}

async function requestCalendarFeed(
  code: string,
  fetcher: typeof fetch,
  session: CalendarFeedSession | null,
  storageEpoch: number | undefined,
  clearEpoch: number | undefined,
  fence: string | null,
): Promise<CreateCalendarFeedResult> {
  if (offline()) return { state: 'offline' };
  let reply: unknown;
  try {
    const response = await fetcher(CALENDAR_FEEDS_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions: code }),
    });
    if (response.status === 429) return { state: 'rate-limited' };
    if (response.status !== 201) return { state: 'unavailable' };
    reply = await response.json();
  } catch {
    return offline() ? { state: 'offline' } : { state: 'unavailable' };
  }
  const feed = keptFeed({
    ...(reply && typeof reply === 'object' ? reply : {}),
    madeAt: Date.now(),
  });
  if (!feed) return { state: 'unavailable' };
  const finish = (locked: boolean): CreateCalendarFeedResult => {
    if (session) reconcileFence(session);
    if (session && (!session.active || session.clearEpoch !== clearEpoch)) return { state: 'cancelled' };
    if (session?.active) session.feeds.set(feed.id, feed);
    const storage = storageFor(session);
    // A request born without a verified non-null fence stays memory-only even
    // if storage recovers. Never merge older volatile keys into persistence.
    const mayStore = !session || (locked && fence !== null && readFence(storage) === fence
      && session.storageEpoch === storageEpoch);
    const previous = mayStore ? readFeedSnapshot(storage) : null;
    const kept = previous !== null && writeKeptCalendarFeeds([feed, ...previous
      .filter((other) => other.id !== feed.id && !session?.removed.has(other.id))], storage);
    return { state: 'created', feed, kept };
  };
  return withFeedStorageLock(session, () => finish(true), () => finish(false));
}

/** The JSON body of a response, or undefined when it is not JSON. */
async function jsonBody(response: Response): Promise<unknown> {
  try {
    return JSON.parse(await response.text()) as unknown;
  } catch {
    return undefined;
  }
}

function isExactly(value: unknown, expected: Record<string, unknown>): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === Object.keys(expected).length
    && keys.every((key) => (value as Record<string, unknown>)[key] === expected[key]);
}

/**
 * Removes a feed with its key. The key is forgotten only when our API says
 * the feed is gone: 200 with {"removed":true}, or 404 with
 * {"error":"not_found"} for a feed it no longer has (removed already, or
 * deleted after 12 months without a fetch). Any other answer, such as a
 * proxy's or a platform's 404, keeps the key.
 */
export async function removeCalendarFeed(
  feed: KeptCalendarFeed,
  fetcher: typeof fetch = fetch,
): Promise<RemoveCalendarFeedResult> {
  const session = feedSession();
  if (session?.pending) return 'busy';
  if (session) session.pending = feed.id;
  notify(session);
  try {
    const result = await requestCalendarFeedRemoval(feed, fetcher);
    if (result === 'removed') {
      await withFeedStorageLock(session, () => forgetCalendarFeed(feed.id, storageFor(session)), () => {});
      if (session) {
        reconcileFence(session);
        session.feeds.delete(feed.id);
        session.removed.add(feed.id);
      }
    }
    return result;
  } finally {
    if (session) session.pending = null;
    notify(session);
  }
}

async function requestCalendarFeedRemoval(
  feed: KeptCalendarFeed,
  fetcher: typeof fetch,
): Promise<RemoveCalendarFeedResult> {
  if (offline()) return 'offline';
  let gone = false;
  try {
    const response = await fetcher(calendarFeedPath(feed.id), {
      method: 'DELETE',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', Authorization: `Bearer ${feed.secret}` },
    });
    if (response.status === 200) gone = isExactly(await jsonBody(response), { removed: true });
    else if (response.status === 404) gone = isExactly(await jsonBody(response), { error: 'not_found' });
  } catch {
    return offline() ? 'offline' : 'unavailable';
  }
  if (!gone) return 'unavailable';
  return 'removed';
}
