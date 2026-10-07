import { settledSignIndex } from '../profile/settled-signs';
import type { Chart } from '../engine/types';
import { signForLongitude, type Element } from '../signs';

export type GroupRole = Element | 'blend';
export interface GroupReading {
  role: GroupRole;
  counts: Record<Element, number>;
  total: number;
  winningCount: number;
  placements: { body: string; sign: string; element: Element }[];
}

/** Equal weights, with no arbitrary tie-break and no angles from unknown times. */
export function groupReading(chart: Pick<Chart, 'bodies' | 'angles' | 'input'>): GroupReading {
  const counts = { fire: 0, earth: 0, air: 0, water: 0 };
  const wanted = new Set(['Sun', 'Mercury', 'Venus', 'Mars', ...(chart.input.timeKnown ? ['Moon'] : [])]);
  const placements: GroupReading['placements'] = [];
  for (const body of chart.bodies) {
    if (!wanted.has(body.body) || !Number.isFinite(body.lon)) continue;
    if (settledSignIndex(body.body, body.lon, chart.input.timeKnown) === null) continue;
    const sign = signForLongitude(body.lon);
    counts[sign.element] += 1;
    placements.push({ body: body.body, sign: sign.slug, element: sign.element });
  }
  if (chart.input.timeKnown && chart.angles && Number.isFinite(chart.angles.asc)) {
    const sign = signForLongitude(chart.angles.asc);
    counts[sign.element] += 1;
    placements.push({ body: 'Rising', sign: sign.slug, element: sign.element });
  }
  const winningCount = Math.max(...Object.values(counts));
  const winners = (Object.keys(counts) as Element[]).filter((element) => counts[element] === winningCount);
  return { role: winners.length === 1 && winningCount > 0 ? winners[0] : 'blend', counts, total: placements.length, winningCount, placements };
}

export function validGroupSize(count: number): boolean { return Number.isInteger(count) && count >= 3 && count <= 8; }

export const ROLE_KEYS = { fire: 'roleFire', earth: 'roleEarth', air: 'roleAir', water: 'roleWater', blend: 'roleBlend' } as const;
export const ROLE_READ_KEYS = { fire: 'fireRead', earth: 'earthRead', air: 'airRead', water: 'waterRead', blend: 'blendRead' } as const;
export const ROLE_HUES: Record<GroupRole, string> = { fire: '#DE8E79', earth: '#B9D4BE', air: '#B29DD0', water: '#B6D4E4', blend: '#EEF1F7' };
