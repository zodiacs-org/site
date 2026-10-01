/**
 * The page's side of calendar feeds addressed by opaque ids. Nothing is
 * stored, here or on the server, until the person subscribes. Subscribing
 * sends the chart's positions code once, in the body of a POST; the server
 * answers with the feed's id, its address and the key that removes it.
 *
 * This browser keeps, for each feed it made, the id, the address (which lets
 * anyone who has it read the calendar), the key that removes the feed and
 * when it was made, and nothing about the chart. A dedicated IndexedDB
 * transaction keeps the removable fence and these records together. Removing a feed here
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
import {
  CALENDAR_FEED_CHANGE_CHANNEL, createCalendarFeedStore,
  type CalendarFeedSnapshot,
} from './browser-store';

// Retired pre-release localStorage names are kept only for erasure checks.
export const CALENDAR_FEEDS_STORAGE_KEY = 'zodiacs.calendar-feeds.v1';
export const CALENDAR_FEED_STORAGE_FENCE_KEY = 'zodiacs.calendar-feeds.fence.v1';
const CALENDAR_FEED_STORAGE_LOCK_NAME = 'zodiacs-calendar-feed-storage-v1';
export type CalendarFeedStorageState = 'loading' | 'ready' | 'unavailable';

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
  kept: Map<string, KeptCalendarFeed>;
  removed: Set<string>;
  pending: string | null;
  listeners: Set<() => void>;
  clearEpoch: number;
  storageEpoch: number;
  readEpoch: number;
  active: boolean;
  store: ReturnType<typeof createCalendarFeedStore>;
  storageState: CalendarFeedStorageState;
  locks: LockManager | null;
  channel: BroadcastChannel | null;
  fence: string | null | undefined;
}

function clearSession(session: CalendarFeedSession): void {
  session.clearEpoch += 1;
  session.readEpoch += 1;
  session.feeds.clear();
  session.kept.clear();
  session.removed.clear();
}

function acceptSnapshot(session: CalendarFeedSession, snapshot: CalendarFeedSnapshot): void {
  if (session.fence != null && snapshot.fence !== session.fence) clearSession(session);
  session.fence = snapshot.fence;
  session.kept = new Map(snapshot.feeds.map((feed) => [feed.id, feed]));
  // Once the canonical store confirms a key, it is no longer a volatile
  // fallback. A later authoritative removal must not be hidden by an echo.
  snapshot.feeds.forEach((feed) => session.feeds.delete(feed.id));
  session.storageState = 'ready';
}

// Only the canonical IndexedDB transaction authorizes persistence. These maps
// are document-lifetime view snapshots and volatile recovery, never a second
// durable authority or a source for automatically writing old keys back.
const sessions = new WeakMap<Document, CalendarFeedSession>();
function feedSession(): CalendarFeedSession | null {
  if (typeof document === 'undefined') return null;
  let session = sessions.get(document);
  if (!session) {
    const ownerWindow = window;
    let indexedDB: IDBFactory | undefined;
    let locks: LockManager | null = null;
    let channel: BroadcastChannel | null = null;
    try { indexedDB = ownerWindow.indexedDB; } catch { /* Volatile recovery only. */ }
    try { locks = ownerWindow.navigator?.locks ?? navigator.locks ?? null; } catch { /* Volatile recovery only. */ }
    try { channel = ownerWindow.BroadcastChannel ? new ownerWindow.BroadcastChannel(CALENDAR_FEED_CHANGE_CHANNEL) : null; } catch { /* Focus refresh remains available. */ }
    session = {
      feeds: new Map(), kept: new Map(), removed: new Set(), pending: null, listeners: new Set(),
      clearEpoch: 0, storageEpoch: 0, readEpoch: 0, active: true, locks, channel, fence: undefined, storageState: 'loading',
      store: createCalendarFeedStore({ indexedDB, validateFeed: keptFeed, randomUUID: () => crypto.randomUUID() }),
    };
    sessions.set(document, session);
    const current = session;
    ownerWindow.addEventListener('zodiacs:profile-lease-revoke', () => { current.storageEpoch += 1; });
    ownerWindow.addEventListener('storage', (event) => {
      if (event.key === ACCOUNT_V2_PROFILE_LEASE_REVOKE_KEY) current.storageEpoch += 1;
    });
    ownerWindow.addEventListener('zodiacs:calendar-feeds-cleared', () => {
      clearSession(current);
      current.fence = null;
      current.storageState = 'ready';
      notify(current);
    });
    const refresh = () => { void refreshSession(current); };
    if (channel) channel.onmessage = (event) => { if (event.data === 'changed') refresh(); };
    ownerWindow.addEventListener('pageshow', refresh);
    ownerWindow.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    ownerWindow.addEventListener('pagehide', (event) => {
      if (event.persisted) return;
      current.active = false;
      current.readEpoch += 1;
      current.feeds.clear();
      current.kept.clear();
      current.listeners.clear();
      current.channel?.close();
    });
    void refreshSession(current);
  }
  return session;
}

/** Only local transactions are locked; an offline POST cannot block erasure. */
async function withFeedStorageLock<T>(
  session: CalendarFeedSession | null,
  commit: () => T | Promise<T>,
  unavailable: () => T | Promise<T>,
): Promise<T> {
  if (!session?.locks) return unavailable();
  try {
    return await session.locks.request(ACCOUNT_V2_PROFILE_LOCK_NAME, { mode: 'shared' }, () =>
      session.locks!.request(CALENDAR_FEED_STORAGE_LOCK_NAME, { mode: 'exclusive' }, commit));
  } catch {
    return unavailable();
  }
}

async function refreshSession(session: CalendarFeedSession): Promise<KeptCalendarFeed[] | null> {
  const readEpoch = ++session.readEpoch;
  return withFeedStorageLock(session, async () => {
    const result = await session.store.read();
    if (session.active && session.readEpoch === readEpoch) {
      if (result.status === 'ready') acceptSnapshot(session, result.snapshot);
      else session.storageState = 'unavailable';
      notify(session);
    }
    // Explicit reads receive their own transaction's result, even if a newer
    // refresh owns the view cache. They must never return a stale cache instead.
    return result.status === 'ready' ? result.snapshot.feeds : null;
  }, () => {
    if (session.active && session.readEpoch === readEpoch) {
      session.storageState = 'unavailable';
      notify(session);
    }
    return null;
  });
}

function announce(session: CalendarFeedSession): void {
  try { session.channel?.postMessage('changed'); } catch { /* Advisory only. */ }
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
  // A first hydration already owns a fresh read. A completed snapshot needs a
  // new read on reattachment, even when every cross-document signal was missed.
  if (session && session.storageState !== 'loading') {
    session.storageState = 'loading';
    notify(session);
    void refreshSession(session);
  }
  return () => { session?.listeners.delete(listener); };
}

/** Stored snapshot plus capabilities retained only until this document is left. */
export function readAvailableCalendarFeeds(): KeptCalendarFeed[] {
  const session = feedSession();
  const feeds = new Map(session?.kept ?? []);
  session?.feeds.forEach((feed, id) => feeds.set(id, feed));
  session?.removed.forEach((id) => feeds.delete(id));
  return [...feeds.values()].sort((a, b) => b.madeAt - a.madeAt);
}

export function calendarFeedStorageState(): CalendarFeedStorageState {
  return feedSession()?.storageState ?? 'unavailable';
}

/** These keys are removable here but will be lost when this document is left. */
export function hasUnstoredCalendarFeeds(): boolean {
  const stored = feedSession()?.kept ?? new Map<string, KeptCalendarFeed>();
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

/** Fresh canonical records; storageState distinguishes refusal from an empty store. */
export async function readKeptCalendarFeeds(): Promise<KeptCalendarFeed[]> {
  const session = feedSession();
  if (!session) return [];
  return await refreshSession(session) ?? [];
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
  const clearEpoch = session?.clearEpoch;
  const storageEpoch = session?.storageEpoch;
  if (session) session.pending = 'adding';
  notify(session);
  try {
    let fence: string | null = null;
    let cancelled = false;
    if (session) await withFeedStorageLock(session, async () => {
      const result = await session.store.establish(session.fence ?? null, () => session.active && session.clearEpoch === clearEpoch);
      session.readEpoch += 1;
      if (result.status === 'unavailable') session.storageState = 'unavailable';
      else {
        acceptSnapshot(session, result.snapshot);
        cancelled = result.status === 'cancelled';
        if (!cancelled) fence = result.snapshot.fence;
      }
    }, () => { session.storageState = 'unavailable'; });
    if (cancelled || (session && (!session.active || session.clearEpoch !== clearEpoch))) return { state: 'cancelled' };
    return await requestCalendarFeed(code, fetcher, session, clearEpoch, storageEpoch, fence);
  } finally {
    if (session) session.pending = null;
    notify(session);
  }
}

async function requestCalendarFeed(
  code: string,
  fetcher: typeof fetch,
  session: CalendarFeedSession | null,
  clearEpoch: number | undefined,
  storageEpoch: number | undefined,
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
  const stillCurrent = () => !session || (session.active && session.clearEpoch === clearEpoch);
  const volatile = (): CreateCalendarFeedResult => {
    if (!stillCurrent()) return { state: 'cancelled' };
    session?.feeds.set(feed.id, feed);
    return { state: 'created', feed, kept: false };
  };
  return withFeedStorageLock(session, async () => {
    if (!session || !stillCurrent()) return { state: 'cancelled' };
    // A request without a committed preflight fence never gains permission to
    // persist later, even when IndexedDB becomes available before its reply.
    const mayStore = fence !== null && session.storageEpoch === storageEpoch;
    const result = !mayStore
      ? await session.store.read()
      : await session.store.commit(fence, feed, stillCurrent, session.removed);
    session.readEpoch += 1;
    if (result.status === 'unavailable') {
      session.storageState = 'unavailable';
      return volatile();
    }
    acceptSnapshot(session, result.snapshot);
    if (result.status === 'cancelled' || !stillCurrent()) return { state: 'cancelled' };
    if (mayStore) session.feeds.delete(feed.id);
    else session.feeds.set(feed.id, feed);
    if (mayStore) announce(session);
    return { state: 'created', feed, kept: mayStore };
  }, volatile);

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
      if (session) await withFeedStorageLock(session, async () => {
        const result = await session.store.remove(feed.id);
        session.readEpoch += 1;
        if (result.status === 'ready') { acceptSnapshot(session, result.snapshot); announce(session); }
        else session.storageState = 'unavailable';
      }, () => {});
      if (session) {
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
