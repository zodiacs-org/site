/**
 * The ephemeris a tool reads when it must give the answer its website page
 * gives. The site's browser bundle computes on astronomy-engine
 * (scripts/lib/browser-engine.mjs takes the DE440 pack out of it), while the
 * hosted runtime's default is the DE440 pack; the two differ by around an
 * arcsecond, which is enough to put a birth near a cusp in different signs
 * (20 April 1970 at 12:15 UTC: 29.99998° on astronomy-engine, 30.00007° on
 * DE440).
 *
 * Each call here switches the engine's default to astronomy-engine for one
 * synchronous calculation and restores the one before, whatever happens, so
 * no other calculation (no other tool, nor this one's own station search past
 * the published data) ever runs on it: nothing awaits in between. The engine
 * keeps no position cache across the switch (its frame cache depends only on
 * the time, and the DE440 records stay its own), and no second copy of the
 * engine is bundled. src/ai-tools/personal/page-ephemeris.test.ts holds these
 * to the page's numbers.
 *
 * Server only: the browser reads the same positions through
 * src/lib/engine/full.ts with no switch. Pure.
 */
import { defaultEphemeris, setDefaultEphemeris } from '@zodiacs/engine';
import { bodyLongitude, computeChart } from '../../lib/engine/full.js';
import type { BodyName, Chart, ChartInput } from '../../lib/engine/types';

/** Run one synchronous calculation on astronomy-engine, then restore the engine's default. */
export function onPageEphemeris<T>(run: () => T): T {
  const before = defaultEphemeris().name;
  setDefaultEphemeris('astronomy-engine');
  try {
    const value = run();
    if (typeof (value as { then?: unknown } | null)?.then === 'function') throw new TypeError('onPageEphemeris runs synchronous calculations only');
    return value;
  } finally {
    setDefaultEphemeris(before);
  }
}

/** The chart the page casts for the same input (src/lib/engine/full.ts computeChart in the browser). */
export function pageChart(input: ChartInput): Chart {
  return onPageEphemeris(() => computeChart(input));
}

/** One body's longitude as the page reads it (src/lib/engine/full.ts bodyLongitude in the browser), memoised per call. */
export function pageLongitudes(): (body: BodyName | string, at: Date) => number {
  const seen = new Map<string, number>();
  return (body, at) => {
    const key = `${body} ${at.getTime()}`;
    let lon = seen.get(key);
    if (lon === undefined) {
      lon = onPageEphemeris(() => bodyLongitude(body as BodyName, at));
      seen.set(key, lon);
    }
    return lon;
  };
}
