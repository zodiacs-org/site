/**
 * "Save to your profile": a signed-in person can keep a compatibility
 * reading or an occasion card on their profile as a link back to the page.
 * The links are stored with the account (public.saved_pages, owner-only by
 * row-level security), so they open on any device the person signs in on.
 *
 * This module is pure and does not load the Supabase library: pages decide
 * what to show from the build flag and from whether a session is stored.
 * The flag is off in the committed state; the table's migration has to be
 * applied in production before it is switched on.
 */

export const ACCOUNT_SAVES_PUBLIC_FLAG = 'PUBLIC_ACCOUNT_SAVES_ENABLED';

export interface AccountSavesPublicEnv {
  PUBLIC_ACCOUNT_SAVES_ENABLED?: string;
}

export function accountSavesEnabled(
  env: AccountSavesPublicEnv = {
    PUBLIC_ACCOUNT_SAVES_ENABLED: import.meta.env.PUBLIC_ACCOUNT_SAVES_ENABLED,
  },
): boolean {
  return env.PUBLIC_ACCOUNT_SAVES_ENABLED === '1';
}

/** What the site itself saves; a browser can write only these. */
export const SAVED_PAGE_KINDS = ['compatibility', 'occasion'] as const;
/**
 * What the profile lists: also the charts and weekly forecasts an assistant
 * saved through Zodiacs' save tool (source 'assistant'), which only the
 * server writes. See docs/platform/zodiacs-ai/ACCOUNTS.md.
 */
export const LISTED_PAGE_KINDS = [...SAVED_PAGE_KINDS, 'chart', 'week'] as const;
export type SavedPageKind = (typeof LISTED_PAGE_KINDS)[number];
export type SavedPageSource = 'site' | 'assistant';
export const SAVED_PAGE_SUMMARY_MAX = 600;

export const SAVED_PAGE_TITLE_MAX = 160;
export const SAVED_PAGE_HREF_MAX = 2048;
export const MAX_SAVED_PAGES = 100;

/** Where each kind of saved page lives; mirrored by the table's check constraint. */
const KIND_PATHS: Readonly<Record<SavedPageKind, RegExp>> = Object.freeze({
  compatibility: /^\/(?:[a-z]{2}\/)?compatibility\//u,
  occasion: /^\/occasions\//u,
  chart: /^\/(?:birth-chart|people)\//u,
  week: /^\/horoscopes\//u,
});

export const SAVED_PAGE_KIND_LABELS: Readonly<Record<SavedPageKind, string>> = Object.freeze({
  compatibility: 'Compatibility',
  occasion: 'Occasion card',
  chart: 'Birth chart',
  week: 'Your week',
});

export interface SavedPageDraft {
  kind: SavedPageKind;
  title: string;
  /** A same-site path with its query and fragment, e.g. `/occasions/#o=wedding&d=…`. */
  href: string;
}

export interface SavedPage extends SavedPageDraft {
  id: string;
  savedAt: string;
  /** 'assistant' for what an assistant saved through Zodiacs' save tool. */
  source: SavedPageSource;
  /** The assistant save's one-line summary, plain text; null for the site's own saves. */
  summary: string | null;
}

function isKind(value: unknown, kinds: readonly string[] = SAVED_PAGE_KINDS): value is SavedPageKind {
  return typeof value === 'string' && kinds.includes(value);
}

export function cleanSavedPageTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const title = value.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/gu, ' ').trim();
  if (!title) return null;
  const points = [...title];
  return points.length > SAVED_PAGE_TITLE_MAX ? `${points.slice(0, SAVED_PAGE_TITLE_MAX - 1).join('').trimEnd()}…` : title;
}

/**
 * The stored form of a link: a same-site path, never a full address. An
 * absolute URL is accepted only when its origin is `origin`.
 */
export function savedPageHref(kind: SavedPageKind, value: unknown, origin?: string): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  let path = value;
  if (!value.startsWith('/')) {
    if (!origin) return null;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.origin !== origin) return null;
    path = `${url.pathname}${url.search}${url.hash}`;
  }
  if (path.startsWith('//') || path.includes('\\')) return null;
  if (/[\s\p{Cc}]/u.test(path)) return null;
  if (path.length > SAVED_PAGE_HREF_MAX) return null;
  return KIND_PATHS[kind].test(path) ? path : null;
}

export function savedPageDraft(raw: unknown, origin?: string, kinds: readonly string[] = SAVED_PAGE_KINDS): SavedPageDraft | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (!isKind(record.kind, kinds)) return null;
  const title = cleanSavedPageTitle(record.title);
  const href = savedPageHref(record.kind, record.href, origin);
  return title && href ? { kind: record.kind, title, href } : null;
}

/** A database row, trusted no further than the draft rules. */
export function parseSavedPageRow(raw: unknown): SavedPage | null {
  const draft = savedPageDraft(raw, undefined, LISTED_PAGE_KINDS);
  if (!draft) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== 'string' || !/^[0-9a-f-]{36}$/iu.test(record.id)) return null;
  if (typeof record.saved_at !== 'string' || Number.isNaN(Date.parse(record.saved_at))) return null;
  const source: SavedPageSource = record.source === 'assistant' ? 'assistant' : 'site';
  // Only the server writes chart and week rows; a site row of either kind is not trusted.
  if (source === 'site' && !isKind(draft.kind)) return null;
  const summary = source === 'assistant' && typeof record.summary === 'string'
    ? record.summary.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, SAVED_PAGE_SUMMARY_MAX) || null
    : null;
  return { ...draft, id: record.id, savedAt: record.saved_at, source, summary };
}

/*
 * "Sign in to save": the page being saved waits on this device while the
 * person signs in, then the profile saves it. One item, kept for a day.
 */
export const PENDING_SAVE_KEY = 'zodiacs.account-saves.pending.v1';
export const PENDING_SAVE_TTL_MS = 24 * 60 * 60 * 1000;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function stashPendingSave(
  draft: SavedPageDraft,
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
): boolean {
  const clean = savedPageDraft(draft);
  if (!clean || !storage) return false;
  try {
    storage.setItem(PENDING_SAVE_KEY, JSON.stringify({ ...clean, at: now }));
    return true;
  } catch {
    return false;
  }
}

function readPending(raw: string | null, now: number): SavedPageDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const at = typeof parsed.at === 'number' ? parsed.at : NaN;
    if (!Number.isFinite(at) || at > now || now - at > PENDING_SAVE_TTL_MS) return null;
    return savedPageDraft(parsed);
  } catch {
    return null;
  }
}

/** The waiting item, left in place (for the signed-out profile's note). */
export function peekPendingSave(
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
): SavedPageDraft | null {
  if (!storage) return null;
  try {
    return readPending(storage.getItem(PENDING_SAVE_KEY), now);
  } catch {
    return null;
  }
}

/** Returns the waiting item once, and removes it whatever its state. */
export function takePendingSave(
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
): SavedPageDraft | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(PENDING_SAVE_KEY);
    storage.removeItem(PENDING_SAVE_KEY);
  } catch {
    return null;
  }
  return readPending(raw, now);
}

/**
 * Saves the waiting item with `save` and removes it only once it is saved (or
 * was already), so a full profile or a failed request does not lose it.
 */
export async function settlePendingSave<Outcome extends string>(
  save: (draft: SavedPageDraft) => Promise<Outcome>,
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
): Promise<{ draft: SavedPageDraft; outcome: Outcome | 'error' } | null> {
  const draft = peekPendingSave(now, storage);
  if (!draft) return null;
  let outcome: Outcome | 'error';
  try {
    outcome = await save(draft);
  } catch {
    outcome = 'error';
  }
  if (outcome === 'saved' || outcome === 'exists') takePendingSave(now, storage);
  return { draft, outcome };
}

/** The project ref Supabase names its browser storage after (the URL's first label). */
export function supabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

/** Supabase's default browser storage entry: `sb-<project ref>-auth-` and the session's name. */
const SUPABASE_SESSION_ENTRY = /^sb-([a-z0-9-]+)-auth-token$/u;

/** Supabase's default storage key for a project URL, found among the stored keys. */
export function supabaseAuthStorageKey(url: string | undefined, keys: Iterable<string>): string | null {
  const ref = supabaseProjectRef(url);
  if (!ref) return null;
  for (const key of keys) {
    if (SUPABASE_SESSION_ENTRY.exec(key)?.[1] === ref) return key;
  }
  return null;
}

function storageKeys(storage: Pick<Storage, 'key' | 'length'>): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null) keys.push(key);
  }
  return keys;
}

/**
 * Whether this browser holds a Supabase session, read without loading the
 * library. It only chooses which prompt to show; saving asks Supabase.
 */
export function hasStoredAuthSession(
  storage: Pick<Storage, 'getItem' | 'key' | 'length'> | null = defaultStorage(),
  url: string | undefined = import.meta.env.PUBLIC_SUPABASE_URL,
): boolean {
  if (!storage) return false;
  try {
    const key = supabaseAuthStorageKey(url, storageKeys(storage));
    if (!key) return false;
    const raw = storage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    return Boolean(parsed && typeof parsed === 'object'
      && (typeof parsed.refresh_token === 'string' || typeof parsed.access_token === 'string'));
  } catch {
    return false;
  }
}

/** Where "Sign in to save" goes: the sign-in panel on the profile. */
export const SIGN_IN_TO_SAVE_HREF = '/profile/#profile-sync';
