import type { HouseSystem } from '../engine/types';
import type { City } from '../geo/search';
import { loadProfile } from './read-store';
import type { SavedChart } from './schema';

export interface ProfileChartRunInput {
  date: string;
  time: string;
  timeKnown: boolean;
  city: City;
  houseSystem: HouseSystem;
  subjectMode: 'self' | 'other';
  name?: string;
}

/** Resolve only within the profile already admitted by the synchronous access guard. */
export function profileChartRunInput(
  charts: SavedChart[],
  chartId: string,
): ProfileChartRunInput | null {
  const chart = charts.find((candidate) => candidate.id === chartId);
  const place = chart?.birth.place;
  if (!chart || !place) return null;
  return {
    date: chart.birth.date,
    time: chart.birth.time ?? '',
    timeKnown: chart.birth.timeKnown,
    city: { ...place, pop: 0 },
    houseSystem: chart.summary.houseSystem,
    // Only an explicit classification can grant the one-tap self-save path.
    // Legacy, unclassified charts remain in the safer people/naming flow.
    subjectMode: chart.relationship === 'self' ? 'self' : 'other',
    name: chart.name,
  };
}

export function loadProfileChartRunInput(chartId: string): ProfileChartRunInput | null {
  return profileChartRunInput(loadProfile().charts, chartId);
}

/** The admitted saved chart, even when it has no birthplace and cannot be run yet. */
export function loadProfileChart(chartId: string): SavedChart | null {
  return loadProfile().charts.find((candidate) => candidate.id === chartId) ?? null;
}
