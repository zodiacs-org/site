/**
 * Dynamic chart-engine boundary.
 *
 * The implementation lives in the exact vendored @zodiacs/engine package;
 * this adapter preserves the site's established data shape while keeping the
 * ephemeris behind the existing `import('../engine/full')` split point.
 */
import {
  bodyLongitude as engineBodyLongitude,
  computeBodies as engineComputeBodies,
  computeChart as engineComputeChart,
  longitudeSpeed as engineLongitudeSpeed,
} from '@zodiacs/engine/internal';

import { adaptBody, adaptChart } from './chart-adapter';
import type { BodyName, BodyPosition, Chart, ChartInput } from './types';

/** Scanner-oriented single-body primitive; intentionally not a public SDK API. */
export function bodyLongitude(name: BodyName, date: Date): number {
  return engineBodyLongitude(name, date);
}

/** Longitude speed in degrees/day by central difference: ±0.001 day, ±0.25 day for the true node. */
export function longitudeSpeed(name: BodyName, date: Date): number {
  return engineLongitudeSpeed(name, date);
}

export function computeBodies(date: Date): BodyPosition[] {
  return engineComputeBodies(date).map(adaptBody);
}

export function computeChart(input: ChartInput): Chart {
  return adaptChart(engineComputeChart(input), input);
}

/** The worker loads this same compiled boundary. */
export const browserEngineModuleUrl = import.meta.url;
export async function birthWindow(input: import('@zodiacs/engine/window').BirthWindowInput) {
  const windowEngine = await import('@zodiacs/engine/window');
  return windowEngine.birthWindow(input);
}
