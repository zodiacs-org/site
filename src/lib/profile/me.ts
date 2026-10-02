/**
 * "Your page" settings: the name the profile shows for the chart marked as
 * yours (its initial stands in for a picture). A sibling store to the
 * saved-charts profile (the schema there stays untouched): nothing here is
 * a chart, and none of it is sent anywhere.
 *
 * Every write dispatches `zodiacs:me` on window (the `zodiacs:profile`
 * convention) so the page header and the navigation stay in step. Reads
 * and writes pass the same fail-closed account boundary as saved charts,
 * and the key rides the account hand-off with them.
 */
import { profileAccessAllowed } from '../account-v2/profile-access-reader';
import { ME_KEY } from './page-keys';
import { cleanProfilePhoto } from './photo';

export { ME_KEY };
/** Matches the name limit of shared chart links and saved comparisons. */
export const DISPLAY_NAME_MAX = 24;

export interface MeSettings {
  version: 1;
  /** The name shown on your page and on a card you send; null means none chosen. */
  displayName: string | null;
  /** Optional device-local photo; backups carry it, shared cards and chart sync do not. */
  photo?: string;
  /** The keep-this-page-close note was dismissed on this device. */
  keepCloseDismissed: boolean;
}

export const DEFAULT_ME: MeSettings = Object.freeze({
  version: 1,
  displayName: null,
  keepCloseDismissed: false,
}) as MeSettings;

/**
 * Names are free text from this device or from someone else's link. Drop
 * control and invisible formatting characters (including bidirectional
 * overrides, which can make a name read backwards), collapse whitespace,
 * and cap the length in code points.
 */
export function cleanDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!cleaned) return null;
  return Array.from(cleaned).slice(0, DISPLAY_NAME_MAX).join('').trim() || null;
}

/** Storage is user-writable: rebuild a settings object from known fields only. */
export function parseMe(raw: string | null): MeSettings {
  if (!raw) return { ...DEFAULT_ME };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_ME };
    const record = parsed as Record<string, unknown>;
    if (record.version !== 1) return { ...DEFAULT_ME };
    return {
      version: 1,
      displayName: cleanDisplayName(record.displayName),
      ...(cleanProfilePhoto(record.photo) ? { photo: cleanProfilePhoto(record.photo)! } : {}),
      keepCloseDismissed: record.keepCloseDismissed === true,
    };
  } catch {
    return { ...DEFAULT_ME };
  }
}

export function loadMe(): MeSettings {
  if (!profileAccessAllowed()) return { ...DEFAULT_ME };
  try {
    return parseMe(localStorage.getItem(ME_KEY));
  } catch {
    return { ...DEFAULT_ME };
  }
}

/** Merge a change into the stored settings. False when storage refused it. */
export function saveMe(patch: Partial<Omit<MeSettings, 'version'>>): boolean {
  if (!profileAccessAllowed()) return false;
  const current = loadMe();
  const next = parseMe(JSON.stringify({
    ...current,
    ...patch,
    version: 1,
    displayName: patch.displayName === undefined ? current.displayName : cleanDisplayName(patch.displayName),
  }));
  try {
    const isDefault = JSON.stringify(next) === JSON.stringify(DEFAULT_ME);
    if (isDefault) localStorage.removeItem(ME_KEY);
    else localStorage.setItem(ME_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('zodiacs:me', { detail: next }));
    return true;
  } catch {
    return false; // storage full / private mode — callers surface a notice
  }
}

/** Automatic chart names end in the birth date; they are labels, not names. */
export function isAutomaticChartName(name: string): boolean {
  return /·\s*\d{4}-\d{2}-\d{2}\s*$/u.test(name);
}

/**
 * The name your page greets you by: the one you chose, else a chart name
 * you typed yourself. An automatic chart name carries the birth date, so it
 * is never used as a person's name.
 */
export function resolvedDisplayName(me: MeSettings, selfChartName: string | null): string | null {
  if (me.displayName) return me.displayName;
  if (!selfChartName || isAutomaticChartName(selfChartName)) return null;
  return cleanDisplayName(selfChartName.split('·')[0]);
}
