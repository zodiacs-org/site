import { signForLongitude } from '../signs';
import { settledSignIndex } from '../profile/settled-signs';
import { SIGNS } from '../signs';
import type { Chart } from '../engine/types';

/** No birth inputs or imagined angles in the public matching index. */
export interface TwinPerson { slug: string; name: string; sun: string; moon: string | null }
export interface TwinMatch { person: TwinPerson; sun: boolean; moon: boolean; count: 1 | 2 }
export function twinSigns(chart: Pick<Chart, 'bodies' | 'input'>): { sun: string | null; moon: string | null } {
  const sun = chart.bodies.find((body) => body.body === 'Sun');
  const moon = chart.bodies.find((body) => body.body === 'Moon');
  const index = sun ? settledSignIndex('Sun', sun.lon, chart.input.timeKnown) : null;
  return { sun: index === null ? null : SIGNS[index].slug, moon: chart.input.timeKnown && moon && Number.isFinite(moon.lon) ? signForLongitude(moon.lon).slug : null };
}
export function matchTwins(signs: { sun: string | null; moon: string | null }, directory: readonly TwinPerson[]): TwinMatch[] {
  return directory.flatMap((person): TwinMatch[] => {
    const sun = signs.sun !== null && person.sun === signs.sun;
    const moon = signs.moon !== null && person.moon !== null && person.moon === signs.moon;
    return sun || moon ? [{ person, sun, moon, count: sun && moon ? 2 : 1 }] : [];
  }).sort((a, b) => b.count - a.count || a.person.name.localeCompare(b.person.name, 'en') || a.person.slug.localeCompare(b.person.slug));
}
