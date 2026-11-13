/**
 * The website birthday pages' degrees, read from src/data/birthdays-precise.json
 * (four decimals) instead of birthdays.json (0.01°, about 36″), so a page's
 * arcminute is the truncated minute of the computed longitude and not of a
 * rounded copy. birthdays.json and src/lib/birthdays.ts stay as they are
 * because the AI tools and the published developer plugin bundle them; this
 * module is site only. Both files come from scripts/build-birthdays.mjs.
 */
import birthdays from '../data/birthdays.json';
import precise from '../data/birthdays-precise.json';
import { decanSpan, type BirthdayEntry } from './birthdays';
import { formatLongitude } from './signs';

type PreciseDay = { lonMin: number; lonMax: number; nowLon: number };
const PRECISE = precise.days as Record<string, PreciseDay>;
const ROUNDED = birthdays.days as Record<string, BirthdayEntry>;

/** The date's entry with its three longitudes at full stored precision. */
export function preciseBirthdayEntry(slug: string, entry: BirthdayEntry): BirthdayEntry {
  const p = PRECISE[slug];
  if (!p) throw new Error(`No precise degrees for ${slug}; rerun scripts/build-birthdays.mjs`);
  return { ...entry, lonMin: p.lonMin, lonMax: p.lonMax, now: { ...entry.now, lon: p.nowLon } };
}

/**
 * Degrees from the date's noon-UTC span to the nearest sign boundary, floored
 * to a tenth so that "at least N°" is never more than the computed margin.
 */
export function boundaryMargin(entry: BirthdayEntry): number {
  const norm = (lon: number) => ((lon % 360) + 360) % 360;
  const inLo = norm(entry.lonMin) % 30;
  const inHi = norm(entry.lonMax) % 30;
  return Math.floor(Math.min(inLo, 30 - inHi) * 10 + 1e-9) / 10;
}

/** The rounded margin the pages printed before 7 November 2026. */
function roundedMargin(entry: BirthdayEntry): number {
  const norm = (lon: number) => ((lon % 360) + 360) % 360;
  return Math.round(Math.min(norm(entry.lonMin) % 30, 30 - (norm(entry.lonMax) % 30)) * 10) / 10;
}

/** The date in force since the pages read the precise degrees. */
export const BIRTHDAY_PRECISE_DEGREES_MODIFIED_AT = '2026-11-07T00:00:00.000Z';

/** Whether the page for this date prints or draws anything differently than it did from birthdays.json. */
export function birthdayDegreesChanged(slug: string): boolean {
  const before = ROUNDED[slug];
  if (!before) return false;
  const after = preciseBirthdayEntry(slug, before);
  // The dial draws the span from lonMin and lonMax, so any change there redraws it.
  if (after.lonMin !== before.lonMin || after.lonMax !== before.lonMax) return true;
  const shown = (e: BirthdayEntry) => [formatLongitude(e.lonMin), formatLongitude(e.lonMax), formatLongitude(e.now.lon)].join('|');
  if (shown(before) !== shown(after)) return true;
  if (!before.sign) return false;
  const decans = (e: BirthdayEntry) => { const d = decanSpan(e); return `${d.lo}-${d.hi}`; };
  return roundedMargin(before) !== boundaryMargin(after) || decans(before) !== decans(after);
}
