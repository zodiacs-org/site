/**
 * The event pages' countdown, as plain arithmetic over two instants. It
 * imports nothing, so the small script that ticks it in the browser carries
 * no catalog, no engine and no data: the exact moments are already printed
 * on the page as attributes.
 */

export interface CountdownMoment {
  /** Short label for the moment, e.g. 'Full moon, exact'. */
  label: string;
  /** Exact instant, UTC ISO. */
  at: string;
}

export interface CountdownParts {
  /** True once the moment has passed. */
  past: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Whole milliseconds between now and the moment, always zero or more. */
  totalMs: number;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Days, hours, minutes and seconds between now and a moment, either side. */
export function countdownParts(atMs: number, nowMs: number): CountdownParts {
  const delta = atMs - nowMs;
  const past = delta <= 0;
  const totalMs = Math.abs(delta);
  // Count down in whole seconds that have not yet run out, so the clock
  // reads 0 0 0 0 exactly at the moment and never shows a negative value.
  const total = past ? Math.floor(totalMs / SECOND) : Math.ceil(totalMs / SECOND);
  return {
    past,
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
    totalMs,
  };
}

/** The first moment still ahead of now, or null when every one has passed. */
export function nextMoment<T extends CountdownMoment>(moments: readonly T[], nowMs: number): T | null {
  const ahead = moments
    .filter((moment) => Date.parse(moment.at) > nowMs)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return ahead[0] ?? null;
}

/** The latest moment already past, or null when none has happened yet. */
export function lastMoment<T extends CountdownMoment>(moments: readonly T[], nowMs: number): T | null {
  const behind = moments
    .filter((moment) => Date.parse(moment.at) <= nowMs)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return behind[0] ?? null;
}

/** 'less than a day ago', '1 day ago', '12 days ago': how long ago a moment passed. */
export function sinceLabel(atMs: number, nowMs: number): string {
  const days = Math.floor(Math.max(0, nowMs - atMs) / DAY);
  if (days === 0) return 'less than a day ago';
  if (days === 1) return '1 day ago';
  return `${days.toLocaleString('en-US')} days ago`;
}

/** Two digits for the clock cells: 7 → '07'. Days keep their own width. */
export function pad2(value: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(2, '0');
}

/** The exact moment in the reader's own time zone, read from the browser. */
export function localMomentLabel(atIso: string, timeZone?: string): string {
  const date = new Date(atIso);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  };
  const text = new Intl.DateTimeFormat('en-US', options).format(date);
  let zone = timeZone;
  try {
    zone = zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    zone = undefined;
  }
  return zone ? `${text} (${zone.replace(/_/g, ' ')})` : text;
}
