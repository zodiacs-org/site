/**
 * The chart an image of a chart draws while its birth details are hidden, for
 * the images share-card does not draw itself (aspect-pattern and explorer
 * section images): share-card's imageChart, loaded on demand with the
 * renderer. With a birth time, the bodies and aspects at the UTC instant
 * rounded to the whole minute and the angles at the middle of their whole
 * degree, with whole-sign houses only; without one, the sky at 12:00 UTC on
 * the birth date, the Moon's sign unknown and its aspects left out.
 */
import type { Chart } from './engine/types';
import { loadModule } from './module-load';

export interface ChartImageSource {
  chart: Chart;
  /** The civil birth date, which an image of a chart without a birth time needs. */
  birthDate?: string;
}

export async function chartForImage(source: ChartImageSource): Promise<Chart> {
  const { imageChart } = await loadModule(() => import('./share-card'));
  return imageChart(source.chart, source.birthDate);
}
