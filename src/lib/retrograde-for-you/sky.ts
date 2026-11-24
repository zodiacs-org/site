/**
 * Retrograde loops from the committed sky data (src/data/sky.json), the same
 * windows the /retrogrades/ page lists: each one's stations and the shadow on
 * either side, as scripts/build-sky.mjs computed them. The stations' longitudes
 * come from the caller (the page reads them from the chart engine on the
 * device). Pure: no network, storage or logging.
 */
import type { LoopSet, RetrogradeLoop, RetrogradePlanet } from './reading';

export interface SkyRetrograde {
  planet: string;
  from: string;
  to: string | null;
  preShadowStart?: string | null;
  postShadowEnd?: string | null;
}

export interface SkySpan { from: string; to: string; retrogrades: readonly SkyRetrograde[] }

const time = (value: string) => Date.parse(value);

/** The planet's windows that the data holds whole: a window that opens at the data's first instant was clamped, not stationed. */
function wholeWindows(planet: RetrogradePlanet, sky: SkySpan): SkyRetrograde[] {
  return sky.retrogrades
    .filter((entry) => entry.planet === planet && entry.to && entry.from !== sky.from)
    .sort((left, right) => time(left.from) - time(right.from));
}

/**
 * The first instant the data settles where the planet stands: the start of its first whole window's pre-shadow (its
 * retrograde station when the data gives no pre-shadow). Before it, a loop that turned direct before the data begins
 * could still be in its post-shadow, or a clamped window still running, and the data holds neither; from it on, the
 * data holds the loop in progress or the one before, since one loop's shadows never overlap the next one's. Null when
 * the data holds no whole window for the planet.
 */
export function skyCoverageStart(planet: RetrogradePlanet, sky: SkySpan): Date | null {
  const first = wholeWindows(planet, sky)[0];
  if (!first) return null;
  const start = Math.max(time(sky.from), time(first.preShadowStart ?? first.from));
  return new Date(start);
}

/**
 * The loop a planet is in at `now`, else its next one, with the one before.
 * When the data holds no later loop but the last one's post-shadow is still
 * running, `current` is null and `previous` is that loop. Null when `now` is
 * before the data settles where the planet stands (skyCoverageStart), or when
 * the data ends before the next loop begins (or before the current one ends),
 * so the page can say so rather than guess.
 */
export function loopsFromSky(planet: RetrogradePlanet, now: Date, sky: SkySpan, lonAt: (planet: RetrogradePlanet, at: Date) => number): LoopSet | null {
  const at = now.getTime();
  const covered = skyCoverageStart(planet, sky);
  if (!covered || at < covered.getTime()) return null;
  const windows = wholeWindows(planet, sky);
  const toLoop = (entry: SkyRetrograde): RetrogradeLoop => {
    const retro = new Date(entry.from);
    const direct = new Date(entry.to!);
    return {
      planet,
      stationRetrograde: { at: retro, lon: lonAt(planet, retro) },
      stationDirect: { at: direct, lon: lonAt(planet, direct) },
      preShadowStart: entry.preShadowStart ? new Date(entry.preShadowStart) : null,
      postShadowEnd: entry.postShadowEnd ? new Date(entry.postShadowEnd) : null,
    };
  };
  const inside = windows.findIndex((entry) => time(entry.from) <= at && time(entry.to!) > at);
  if (inside >= 0) return { current: toLoop(windows[inside]), previous: null, retrogradeNow: true };
  const next = windows.findIndex((entry) => time(entry.from) > at);
  if (next < 0) {
    const last = windows.at(-1);
    return last?.postShadowEnd && time(last.postShadowEnd) > at ? { current: null, previous: toLoop(last), retrogradeNow: false } : null;
  }
  return { current: toLoop(windows[next]), previous: next > 0 ? toLoop(windows[next - 1]) : null, retrogradeNow: false };
}

/** The last instant the data covers: the page cannot speak past it. */
export const skyEnds = (sky: Pick<SkySpan, 'to'>) => new Date(sky.to);
