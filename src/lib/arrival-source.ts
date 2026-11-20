/**
 * Which kind of link opened this browser tab, for the growth tests' counts
 * (docs/ANALYTICS.md, "Growth test events").
 *
 * A link the site gives out may end in `?ref=` and one word from a closed list
 * (ARRIVAL_REF_VALUES). The inline script in src/layouts/Base.astro takes
 * `ref` off the address as the page opens, before any module runs, and keeps
 * the word in session storage only when it is on the list, so it lasts for
 * this tab and is gone when the tab closes. Nothing else from the link is
 * kept, no free string is ever stored, and no identifier is created.
 * `readArrivalSource()` answers `direct` when no listed word is kept.
 *
 * `assistant_arrival` is unchanged: Base still counts it from
 * `window.zodiacsArrival` for `chatgpt` and `assistant` alone.
 */
import { ARRIVAL_REF_VALUES, ARRIVAL_SOURCE_VALUES } from './analytics-config.mjs';

export type ArrivalRef = 'video' | 'chatgpt' | 'assistant' | 'card' | 'app' | 'note';
export type ArrivalSource = 'direct' | ArrivalRef;

export const ARRIVAL_REFS = ARRIVAL_REF_VALUES as readonly ArrivalRef[];
export const ARRIVAL_SOURCES = ARRIVAL_SOURCE_VALUES as readonly ArrivalSource[];

/** The session storage key Base.astro writes and this module reads. */
export const ARRIVAL_SOURCE_SESSION_KEY = 'zodiacs.arrival-source.v1';

type SessionStore = Pick<Storage, 'getItem' | 'setItem'>;

export function isArrivalRef(value: unknown): value is ArrivalRef {
  return typeof value === 'string' && (ARRIVAL_REFS as readonly string[]).includes(value);
}

/** The listed `ref` word in a query string, or null for none or any other word. */
export function arrivalRefFrom(search: string): ArrivalRef | null {
  let ref: string | null;
  try {
    ref = new URLSearchParams(search).get('ref');
  } catch {
    return null;
  }
  return isArrivalRef(ref) ? ref : null;
}

function sessionStore(): SessionStore | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Keeps the listed `ref` word of `search` for this tab. A word off the list,
 * or no `ref`, leaves what the tab already holds. Returns the word kept.
 */
export function rememberArrivalRef(
  search: string,
  store: SessionStore | null = sessionStore(),
): ArrivalRef | null {
  const ref = arrivalRefFrom(search);
  if (!ref || !store) return null;
  try {
    store.setItem(ARRIVAL_SOURCE_SESSION_KEY, ref);
  } catch {
    return null;
  }
  return ref;
}

/** The arrival source for an event's `source` property: a listed word or `direct`. */
export function readArrivalSource(store: SessionStore | null = sessionStore()): ArrivalSource {
  if (!store) return 'direct';
  let kept: string | null = null;
  try {
    kept = store.getItem(ARRIVAL_SOURCE_SESSION_KEY);
  } catch {
    return 'direct';
  }
  return isArrivalRef(kept) ? kept : 'direct';
}
