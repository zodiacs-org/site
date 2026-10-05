import type { Chart } from '../engine/types';
import type { NatalPoint } from '../engine/transit-scan-shared';
/** Explicitly selected scope; never count Moon or angles for unknown time. */
export function wrappedTargets(chart: Chart): NatalPoint[] {
  return chart.input.timeKnown ? ['Sun', 'Moon', ...(chart.angles ? ['ASC' as const] : [])] : ['Sun'];
}
export function wrappedWindow(year: number): { from: Date; to: Date } {
  if (!Number.isInteger(year) || year < 1800 || year > 2199) throw new RangeError('Year outside reference span');
  return { from: new Date(Date.UTC(year, 0, 1) - 1), to: new Date(Date.UTC(year + 1, 0, 1) - 1) };
}
