/**
 * Reader levels: one page, three depths (docs/LEVELS.md).
 *
 * A reader picks how well they know astrology once, on their first visit, or
 * anytime from the level switch. The choice lives in this browser only
 * (localStorage), never in a link and never on a server. Pages stay one
 * address with the full content in the HTML, so search engines and readers
 * without JavaScript see every depth; the level only decides what is open.
 *
 * Mark markup with data-depth="intermediate" (shown from Intermediate up),
 * data-depth="advanced" (Advanced only) or data-depth-only="beginner"
 * (Beginner only). Nothing is hidden until <LevelSwitch /> has set
 * html[data-level] on the page.
 */

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_STORAGE_KEY = 'zodiacs-level';
export const LEVEL_ASKED_KEY = 'zodiacs-level-asked';
export const LEVEL_EVENT = 'zodiacs:level';
export const DEFAULT_LEVEL: Level = 'beginner';

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value);
}

/** True when `level` is at least `min`: advanced includes intermediate. */
export function atLeast(level: Level, min: Level): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(min);
}

/** The level a page has applied, or null on a page without levels. */
export function pageLevel(): Level | null {
  if (typeof document === 'undefined') return null;
  const value = document.documentElement.getAttribute('data-level');
  return isLevel(value) ? value : null;
}

/** Calls back with the page level now and whenever the reader switches. */
export function onLevel(callback: (level: Level | null) => void): () => void {
  callback(pageLevel());
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ level?: unknown }>).detail;
    callback(isLevel(detail?.level) ? detail.level : pageLevel());
  };
  window.addEventListener(LEVEL_EVENT, listener);
  return () => window.removeEventListener(LEVEL_EVENT, listener);
}
