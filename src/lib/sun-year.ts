/**
 * Which Sun's year the sign guides' ring shows (src/components/guide/SunYearPlate.astro):
 * always the equinox-to-equinox year that contains the edition date `now`,
 * so the Sun mark falls inside it on every sign's page. The page sign's arc
 * is that sign's season within this year, whether it is already past, under
 * way or still ahead; `next` is the sign's next season to start, given only
 * when the drawn one is past.
 */
import { signSeasonFocus, sunSeasons } from './seasons/windows';
import type { SeasonWindow } from './seasons/clock';

export type SunYearTense = 'past' | 'under-way' | 'ahead';

export interface SunYearView {
  /** The twelve seasons from the March equinox at or before `now`. */
  year: readonly SeasonWindow[];
  /** The page sign's season within that year. */
  mine: SeasonWindow;
  tense: SunYearTense;
  /** The sign's next season to start, when `mine` is past; null otherwise or when unpublished. */
  next: SeasonWindow | null;
}

/** Null when the published table does not cover the year that contains `now`. */
export function sunYearView(
  slug: string,
  now: Date,
  seasons: readonly SeasonWindow[] = sunSeasons(),
): SunYearView | null {
  const at = now.getTime();
  let first = -1;
  for (let i = 0; i < seasons.length; i += 1) {
    if (Date.parse(seasons[i].start) > at) break;
    if (seasons[i].sign === 'aries') first = i;
  }
  if (first < 0) return null;
  const year = seasons.slice(first, first + 12);
  if (year.length !== 12 || at >= Date.parse(year[11].end)) return null;
  const mine = year.find((window) => window.sign === slug);
  if (!mine) return null;
  const tense: SunYearTense = Date.parse(mine.end) <= at
    ? 'past'
    : Date.parse(mine.start) <= at ? 'under-way' : 'ahead';
  const upcoming = tense === 'past' ? signSeasonFocus(slug, now) : null;
  const next = upcoming && upcoming.phase === 'upcoming' ? upcoming.window : null;
  return { year, mine, tense, next };
}
