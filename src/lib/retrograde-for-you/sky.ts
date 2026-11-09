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

/**
 * The loop a planet is in at `now`, else its next one, with the one before.
 * Null when the data ends before the next loop begins (or before the current
 * one ends), so the page can say so rather than guess.
 */
export function loopsFromSky(planet: RetrogradePlanet, now: Date, sky: SkySpan, lonAt: (planet: RetrogradePlanet, at: Date) => number): LoopSet | null {
  const at = now.getTime();
  // A window that opens at the data's first instant was clamped, not stationed.
  const windows = sky.retrogrades
    .filter((entry) => entry.planet === planet && entry.to && entry.from !== sky.from)
    .sort((left, right) => time(left.from) - time(right.from));
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
  if (next < 0) return null;
  return { current: toLoop(windows[next]), previous: next > 0 ? toLoop(windows[next - 1]) : null, retrogradeNow: false };
}

/** The last instant the data covers: the page cannot speak past it. */
export const skyEnds = (sky: Pick<SkySpan, 'to'>) => new Date(sky.to);
