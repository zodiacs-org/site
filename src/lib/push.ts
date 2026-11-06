export const PUSH_PREFERENCE_KEY = 'zodiacs.push.v1';

export type PushPreference = 'offered' | 'dismissed' | 'subscribed';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readPushPreference(storage: StorageLike): PushPreference | null {
  try {
    const value = storage.getItem(PUSH_PREFERENCE_KEY);
    return value === 'offered' || value === 'dismissed' || value === 'subscribed'
      ? value
      : null;
  } catch {
    return null;
  }
}

/** Claims the one-time affordance without requesting permission or registering a worker. */
export function claimPushPrompt(storage: StorageLike): boolean {
  try {
    if (storage.getItem(PUSH_PREFERENCE_KEY)) return false;
    storage.setItem(PUSH_PREFERENCE_KEY, 'offered');
    return true;
  } catch {
    return false;
  }
}

export function setPushPreference(storage: StorageLike, value: PushPreference): void {
  try {
    storage.setItem(PUSH_PREFERENCE_KEY, value);
  } catch {
    // A browser that blocks storage can still manage its native permission.
  }
}

export function isIosDevice(userAgent: string): boolean {
  return /\b(?:iPhone|iPad|iPod)\b/.test(userAgent)
    || (/\bMacintosh\b/.test(userAgent) && /\bMobile\//.test(userAgent));
}

export function isStandaloneDisplay(
  navigatorLike: { standalone?: boolean },
  matchMediaLike: (query: string) => { matches: boolean },
): boolean {
  return navigatorLike.standalone === true || matchMediaLike('(display-mode: standalone)').matches;
}

/** Convert the URL-safe VAPID public key to the bytes PushManager expects. */
export function vapidKeyBytes(value: string): ArrayBuffer {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * The streams one browser push subscription can carry: Sky Alerts and the
 * Moon journal's new and full Moon reminders. The server keeps one row per
 * browser endpoint with a flag for each, so turning one off never silences
 * the other, and the browser's subscription is dropped only when neither is
 * left.
 */
export type PushTopic = 'sky' | 'lunation';
export interface PushTopicStatus {
  sky: boolean;
  lunation: boolean;
}

export const PUSH_API_PATH = '/api/push/subscribe';

/** The `topics` object of a status answer, or null when the answer has none. */
export function parseTopicStatus(value: unknown): PushTopicStatus | null {
  const topics = (value as { topics?: unknown } | null)?.topics;
  if (!topics || typeof topics !== 'object') return null;
  const { sky, lunation } = topics as Record<string, unknown>;
  if (typeof sky !== 'boolean' || typeof lunation !== 'boolean') return null;
  return { sky, lunation };
}

export type PushFetch = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

/**
 * Ask the site which streams this browser's endpoint carries. Sends only the
 * endpoint. Null when the server answers without topics (a deployment from
 * before topics), which callers read as the old single stream.
 */
export async function fetchTopicStatus(endpoint: string, fetchImpl: PushFetch = fetch): Promise<PushTopicStatus | null> {
  const response = await fetchImpl(PUSH_API_PATH, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'status', endpoint }),
  });
  if (!response.ok) throw new Error(`push status ${response.status}`);
  return parseTopicStatus(await response.json().catch(() => null));
}

/**
 * Turn one stream off on the server. Resolves to true when the browser's
 * subscription still carries the other stream and must be kept.
 */
export async function leavePushTopic(endpoint: string, topic: PushTopic, fetchImpl: PushFetch = fetch): Promise<boolean> {
  const response = await fetchImpl(PUSH_API_PATH, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, topic }),
  });
  if (!response.ok) throw new Error(`unsubscribe endpoint ${response.status}`);
  const body = await response.json().catch(() => null) as { remaining?: unknown } | null;
  return body?.remaining === true;
}
