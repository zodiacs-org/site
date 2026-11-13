/**
 * Sign-season timing that runs in the browser as well as at build time: which
 * window a page should show at a given moment, how far through it the Sun is,
 * and the countdown's parts. It imports no data, so the season pages' client
 * script stays small; the windows themselves come from windows.ts at build
 * time and travel to the page as a data attribute.
 */

/** One Sun season: the instants (ISO, UTC) the Sun enters and leaves a sign. */
export interface SeasonWindow {
  sign: string;
  start: string;
  end: string;
}

export type SeasonPhase = 'upcoming' | 'under-way';

export interface SeasonFocus {
  window: SeasonWindow;
  phase: SeasonPhase;
}

/**
 * The window a season page is about at `now`: the one under way, or the next
 * to start. Null once the published windows run out.
 */
export function seasonFocus(windows: readonly SeasonWindow[], now: Date): SeasonFocus | null {
  const at = now.getTime();
  const sorted = [...windows].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  for (const window of sorted) {
    const start = Date.parse(window.start);
    const end = Date.parse(window.end);
    if (end <= at) continue;
    return { window, phase: start <= at ? 'under-way' : 'upcoming' };
  }
  return null;
}

/** How far through its season the Sun is at `now`, from 0 to 1. */
export function seasonProgress(window: SeasonWindow, now: Date): number {
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  if (!(end > start)) return 0;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** A span in whole days, hours, minutes and seconds; never negative. */
export function countdownParts(ms: number): CountdownParts {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

/** The moment the countdown runs to: the Sun's entry while upcoming, its exit while under way. */
export function countdownTarget(focus: SeasonFocus): Date {
  return new Date(focus.phase === 'upcoming' ? focus.window.start : focus.window.end);
}

/** The season's length in whole days, as the page states it. */
export function seasonLengthDays(window: SeasonWindow): number {
  return Math.round((Date.parse(window.end) - Date.parse(window.start)) / 86_400_000);
}
