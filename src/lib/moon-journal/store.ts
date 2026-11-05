/**
 * The Moon journal's storage: one JSON record in this browser's localStorage,
 * under a key no sync, backup or analytics code reads. Every access is wrapped:
 * a private window, a blocked site-data setting or a full quota gives a result
 * the page can explain, never an exception. Nothing here makes a request.
 */
import type { JournalEntry, SignSlug } from './types';
import { SIGN_SLUGS } from './types';

export const MOON_JOURNAL_KEY = 'zodiacs:moon-journal:v1';
const PROBE_KEY = 'zodiacs:moon-journal:probe';
/** A generous ceiling for one note, so one paste cannot fill the quota. */
export const MAX_ENTRY_LENGTH = 10_000;

/** The slice of the Web Storage API the journal uses. */
export interface JournalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StorageState = 'ok' | 'blocked';
export type WriteResult = { ok: true } | { ok: false; reason: 'blocked' | 'full' };

interface Stored {
  version: 1;
  entries: JournalEntry[];
}

/** The browser's localStorage, or null when even reaching it throws. */
export function browserStorage(): JournalStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Whether this storage really keeps a value: some browsers expose it and then refuse writes. */
export function probeStorage(storage: JournalStorage | null): StorageState {
  if (!storage) return 'blocked';
  try {
    storage.setItem(PROBE_KEY, '1');
    const kept = storage.getItem(PROBE_KEY) === '1';
    storage.removeItem(PROBE_KEY);
    return kept ? 'ok' : 'blocked';
  } catch {
    return 'blocked';
  }
}

const isSign = (value: unknown): value is SignSlug => typeof value === 'string' && (SIGN_SLUGS as readonly string[]).includes(value);

function validEntry(value: unknown): value is JournalEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string'
    && (entry.phase === 'new' || entry.phase === 'full')
    && isSign(entry.sign)
    && typeof entry.at === 'string' && Number.isFinite(Date.parse(entry.at))
    && typeof entry.prompt === 'string'
    && typeof entry.text === 'string'
    && typeof entry.savedAt === 'string';
}

/** Newest lunation first. */
export function sortEntries(entries: readonly JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

/** Every saved entry, newest first; an empty list when nothing is stored or it cannot be read. */
export function readEntries(storage: JournalStorage | null): JournalEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(MOON_JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (!parsed || !Array.isArray(parsed.entries)) return [];
    const byId = new Map<string, JournalEntry>();
    for (const entry of parsed.entries) if (validEntry(entry)) byId.set(entry.id, entry);
    return sortEntries([...byId.values()]);
  } catch {
    return [];
  }
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, code } = error as { name?: string; code?: number };
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

/** Store the whole list. An empty list removes the record altogether. */
export function writeEntries(storage: JournalStorage | null, entries: readonly JournalEntry[]): WriteResult {
  if (!storage) return { ok: false, reason: 'blocked' };
  try {
    if (entries.length === 0) {
      storage.removeItem(MOON_JOURNAL_KEY);
    } else {
      const stored: Stored = { version: 1, entries: sortEntries(entries) };
      storage.setItem(MOON_JOURNAL_KEY, JSON.stringify(stored));
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: isQuotaError(error) ? 'full' : 'blocked' };
  }
}

/** The list with one entry added or replaced (by lunation id). Empty text removes it. */
export function upsertEntry(entries: readonly JournalEntry[], entry: JournalEntry): JournalEntry[] {
  const text = entry.text.slice(0, MAX_ENTRY_LENGTH);
  const rest = entries.filter((existing) => existing.id !== entry.id);
  if (!text.trim()) return sortEntries(rest);
  return sortEntries([...rest, { ...entry, text }]);
}

/** The list without one entry. */
export function removeEntry(entries: readonly JournalEntry[], id: string): JournalEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

/** Remove the journal and its probe from this device. */
export function deleteEverything(storage: JournalStorage | null): WriteResult {
  if (!storage) return { ok: false, reason: 'blocked' };
  try {
    storage.removeItem(MOON_JOURNAL_KEY);
    storage.removeItem(PROBE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'blocked' };
  }
}
