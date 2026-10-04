import type { SaturnReturnResult } from '../engine/returns';
/** Count UTC calendar days, not rounded durations. Repeated passes stay distinct. */
export function saturnCountdown(result: Pick<SaturnReturnResult, 'seasons'>, now: Date): { at: Date; days: number } | null {
  if (!Number.isFinite(now.getTime())) throw new RangeError('Invalid countdown clock');
  const next = result.seasons.flatMap((season) => season.crossings)
    .filter((crossing) => crossing.at.getTime() >= now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
  if (!next) return null;
  const utcDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return { at: next.at, days: (utcDay(next.at) - utcDay(now)) / 86_400_000 };
}
