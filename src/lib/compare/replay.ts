/**
 * The local recalculation the comparison uses to promote a guess to a
 * demonstration. Kept in its own module so the page can load without an engine
 * and pull this in only when a comparison actually needs it.
 */
import { ENGINE_VERSION, natalChart } from '@zodiacs/engine';
import type { Replay, ReplayRequest, ReplayResult } from './diff';

interface ChartShape {
  readonly angles: Record<string, number> | null;
  readonly bodies: readonly { readonly body: string; readonly lon: number }[];
  readonly houses: { readonly cusps?: readonly number[] } | null;
}

export const engineVersion: string = ENGINE_VERSION;

export const replay: Replay = (request: ReplayRequest): ReplayResult | null => {
  try {
    const chart = natalChart({
      utc: request.utc,
      latitude: request.latitude,
      longitude: request.longitude,
      houseSystem: request.houseSystem,
      // A time-unknown receipt has no angles and no houses. Replaying it as
      // though the time were known would invent a chart the receipt never
      // described, and then offer it as evidence about that receipt.
      timeKnown: request.timeKnown,
      // The same goes for a pinned ΔT: without it this is a different chart.
      ...(request.deltaT === undefined ? {} : { deltaT: request.deltaT }),
      // …and for the scale the instant is on (engine 0.1.1-rc.15 on): the same
      // digits read on UTC are another moment.
      ...(request.timeScale === undefined ? {} : { timeScale: request.timeScale }),
    } as Parameters<typeof natalChart>[0]) as unknown as ChartShape;
    return { angles: chart.angles, bodies: chart.bodies, cusps: chart.houses?.cusps ?? null };
  } catch {
    // A replay that cannot run leaves the explanation a hypothesis, which is
    // the honest outcome; it must never fail the comparison itself.
    return null;
  }
};
