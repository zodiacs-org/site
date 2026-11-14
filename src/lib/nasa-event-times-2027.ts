/**
 * The times the 2027 event pages print for full Moons, eclipse peaks and the
 * edges of a retrograde's shadow, solved on NASA JPL Horizons (DE441) for
 * those pages (Linear ZOD-211). New Moons and other years are not listed and
 * keep the engine's instant.
 *
 * src/lib/nasa-instants.ts already gives the planets' sign changes, stations
 * and aspects from NASA. It leaves the Moon out because the engine's lunation
 * is within seconds of NASA's. Seconds are enough to move a printed minute:
 * the engine puts the full moon of 15 October 2027 at 13:46:59 UTC and
 * Horizons at 13:47:00. So the events those pages name are solved on Horizons
 * too, and src/data/nasa-event-times-2027.json keeps each instant beside the
 * engine instant it replaces. The queries, their SHA-256 and the method are in
 * docs/platform/evidence/event-pages-2027-20261113/.
 *
 * As with nasa-instants, the data files, a page's id and address, and its
 * publication receipt keep the engine's instant. Only what a page prints
 * changes, and an instant the table does not list comes back undefined.
 *
 * A row is matched by kind and by an engine instant within two minutes of the
 * one asked for, so a monthly catalog that words the same instant a few
 * milliseconds apart still finds its row.
 *
 * Build-side module: pages and libraries import it; islands must not.
 */
import table from '../data/nasa-event-times-2027.json';

interface LunationRow { type: 'full' | 'new'; engine: string; nasa: string }
interface EclipseRow { type: 'solar' | 'lunar'; engine: string; nasa: string }
interface ShadowRow { body: string; edge: 'pre' | 'post'; engine: string; nasa: string }

export interface NasaEventTimes2027 {
  schema: string;
  lunations: LunationRow[];
  eclipses: EclipseRow[];
  shadows: ShadowRow[];
}

export const NASA_EVENT_TIMES_2027 = table as unknown as NasaEventTimes2027;

/** Where these instants come from, for provenance lines. */
export const NASA_EVENT_TIMES_2027_SOURCE = 'NASA JPL Horizons (DE441), src/data/nasa-event-times-2027.json';

const MATCH_MS = 120_000;

function match<R extends { engine: string; nasa: string }>(rows: readonly R[], at: string): string | undefined {
  const wanted = Date.parse(at);
  if (!Number.isFinite(wanted)) return undefined;
  let best: R | undefined;
  let bestGap = MATCH_MS;
  for (const row of rows) {
    const gap = Math.abs(Date.parse(row.engine) - wanted);
    if (gap <= bestGap) {
      best = row;
      bestGap = gap;
    }
  }
  return best ? new Date(best.nasa).toISOString() : undefined;
}

/** NASA's instant for the full Moon the data files date at `at`. */
export function nasaLunationAt(type: string, at: string): string | undefined {
  return match(NASA_EVENT_TIMES_2027.lunations.filter((row) => row.type === type), at);
}

/** NASA's instant of greatest eclipse for the eclipse the data files peak at `at`. */
export function nasaEclipseAt(type: string, at: string): string | undefined {
  return match(NASA_EVENT_TIMES_2027.eclipses.filter((row) => row.type === type), at);
}

/** NASA's instant for the edge of a retrograde's shadow the data files date at `at`. */
export function nasaShadowAt(body: string, edge: 'pre' | 'post', at: string): string | undefined {
  return match(NASA_EVENT_TIMES_2027.shadows.filter((row) => row.body === body && row.edge === edge), at);
}
