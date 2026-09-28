/**
 * untimedSharedPositions with the browser engine, both loaded on demand. It
 * lives apart from share-positions.ts so that the codec, which the calendar
 * function also imports, never reaches the browser engine, and pages that
 * load the codec up front do not carry the noon positions. Wherever a chart
 * has just been computed the engine is already loaded.
 */
import type { PositionsShareInput } from './share-positions';

export async function loadUntimedSharedPositions(
  chart: Pick<PositionsShareInput, 'houseSystem' | 'engineVersion'>,
  date: string,
): Promise<PositionsShareInput | null> {
  const [{ computeBodies }, { untimedSharedPositions }] = await Promise.all([
    import('./engine/full'),
    import('./share-positions-noon'),
  ]);
  return untimedSharedPositions(chart, date, computeBodies);
}
