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
export type ProfileChartEditInput = Omit<ProfileChartRunInput, 'city'> & { city: City | null };

/** Resolve only within the profile already admitted by the synchronous access guard. */
export function profileChartRunInput(
  charts: SavedChart[],
  chartId: string,
): ProfileChartRunInput | null {
  const input = profileChartEditInput(charts, chartId);
  return input?.city ? { ...input, city: input.city } : null;
}

/** Populate the shared editor even when only the birthplace is missing. */
export function profileChartEditInput(charts: SavedChart[], chartId: string): ProfileChartEditInput | null {
  const chart = charts.find((candidate) => candidate.id === chartId);
  const place = chart?.birth.place;
  if (!chart) return null;
  return {
    date: chart.birth.date,
    time: chart.birth.time ?? '',
    timeKnown: chart.birth.timeKnown,
    city: place ? { ...place, pop: 0 } : null,
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

export function loadProfileChartEditInput(chartId: string): ProfileChartEditInput | null {
  return profileChartEditInput(loadProfile().charts, chartId);
}
