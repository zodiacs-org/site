/**
 * The positions a shared code carries (share-positions-noon.ts), with the
 * browser engine, both loaded on demand. They live apart from
 * share-positions.ts so that the codec, which the calendar function also
 * imports, never reaches the browser engine, and pages that load the codec up
 * front carry neither. Wherever a chart has just been computed the engine is
 * already loaded.
 */
import type { PositionsShareInput } from './share-positions';

/** untimedSharedPositions: a chart without a birth time, at 12:00 UTC on its date. */
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

/**
 * timedSharedPositions: a chart with a birth time, at its UTC instant rounded
 * to the whole minute. The engine loads only when the instant has seconds
 * (before standard time); otherwise the chart's own positions come back.
 */
export async function loadTimedSharedPositions(
  chart: PositionsShareInput,
  utc: Date | string,
): Promise<PositionsShareInput | null> {
  const { onWholeMinute, timedSharedPositions } = await import('./share-positions-noon');
  if (onWholeMinute(utc)) return chart;
  const { computeBodies } = await import('./engine/full');
  return timedSharedPositions(chart, utc, computeBodies);
}
