/**
 * The Sun's seasons from the committed Sun ingress table
 * (src/data/sun-ingresses.json, `node scripts/build-sun-ingresses.mjs`):
 * every closed window the Sun spends in a sign, to a fraction of a second,
 * every season that begins from 2026 through 2040. The season pages read this table
 * rather than ingresses.json, whose Sun horizon ends in mid 2029 and which
 * the AI runtime bundles byte for byte.
 */
import sunTable from '../../data/sun-ingresses.json';
import { SIGNS } from '../signs';
import { seasonFocus, type SeasonFocus, type SeasonWindow } from './clock';

interface IngressWindow {
  sign: string;
  from: string;
  to: string;
}

const SUN_WINDOWS: readonly SeasonWindow[] = Object.freeze(
  (sunTable.windows as IngressWindow[])
    .map((row) => Object.freeze({ sign: row.sign, start: row.from, end: row.to }))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
);

/** Every published Sun season, in order. */
export function sunSeasons(): readonly SeasonWindow[] {
  return SUN_WINDOWS;
}

/** Every published season of one sign, in order. */
export function seasonWindowsFor(slug: string): SeasonWindow[] {
  if (!SIGNS.some((sign) => sign.slug === slug)) throw new Error(`unknown sign ${slug}`);
  return SUN_WINDOWS.filter((window) => window.sign === slug);
}

/** The season under way at `now`, if the table covers it. */
export function currentSunSeason(now: Date): SeasonWindow | null {
  const focus = seasonFocus(SUN_WINDOWS, now);
  return focus?.phase === 'under-way' ? focus.window : null;
}

/** The season a sign's page leads with at `now`: under way, or next. */
export function signSeasonFocus(slug: string, now: Date): SeasonFocus | null {
  return seasonFocus(seasonWindowsFor(slug), now);
}

/**
 * The house of a reader's solar chart (whole signs counted from their Sun
 * sign) that a season's sign falls in: 1 for their own season, 2 for the
 * sign after theirs, and so on round to 12 for the sign before.
 */
export function solarHouse(seasonSlug: string, readerSlug: string): number {
  const season = SIGNS.findIndex((sign) => sign.slug === seasonSlug);
  const reader = SIGNS.findIndex((sign) => sign.slug === readerSlug);
  if (season < 0 || reader < 0) throw new Error('unknown sign');
  return ((season - reader + 12) % 12) + 1;
}
