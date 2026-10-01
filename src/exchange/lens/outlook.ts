import type { WindowNatalChart, WindowTransitBody } from '../../lib/engine/transit-window-core';
import { houseOf } from '../../lib/engine/houses';
export const OUTLOOK_MODEL = { version: 'interpretive-astrology/1', base: 50, sample: '12:00 UTC on the labelled date', thresholds: { challenging: 30, supportive: 70 }, aspects: { conjunction: 0, sextile: 1, square: -2, trine: 2, opposition: -2 }, bodyWeights: { Sun: 1, Moon: 0.5, Mercury: 1, Venus: 1, Mars: 1, Jupiter: 1.5, Saturn: 1.5, Uranus: 1, Neptune: 1, Pluto: 1 }, relevantHouseMultiplier: 1.25 } as const;
const offsets = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
export interface OutlookDay { date: string; score: number; contributions: { id: string; body: string; aspect: string; separation: number; weight: number; contribution: number; house: number | null }[] }
export function computeOutlookDay(natal: WindowNatalChart, cusps: number[] | null, date: string, bodies: readonly WindowTransitBody[], orb: number, longitude: (body: WindowTransitBody, date: Date) => number): OutlookDay {
  const when = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(when.getTime()) || !Number.isFinite(orb) || orb < 0.5 || orb > 3) throw new Error('Outlook date or orb is invalid.');
  const points = [...natal.bodies, ...(natal.angles ? [{ body: 'ASC', lon: natal.angles.asc }, { body: 'MC', lon: natal.angles.mc }] : [])];
  const contributions: OutlookDay['contributions'] = [];
  for (const body of bodies) {
    const lon = longitude(body, when);
    if (!Number.isFinite(lon)) throw new Error('Outlook ephemeris failed.');
    for (const point of points) for (const [aspect, target] of Object.entries(offsets)) {
      const separation = Math.abs(Math.abs(((lon - point.lon + 540) % 360) - 180) - target);
      if (separation > orb) continue;
      const house = cusps ? houseOf(point.lon, cusps) : null;
      const weight = OUTLOOK_MODEL.aspects[aspect as keyof typeof offsets] * OUTLOOK_MODEL.bodyWeights[body] * (house && [2, 5, 8].includes(house) ? OUTLOOK_MODEL.relevantHouseMultiplier : 1);
      contributions.push({ id: `${body}:${aspect}:${point.body}`, body, aspect, separation, weight, contribution: weight * (1 - separation / orb), house });
    }
  }
  return { date, score: Math.round(Math.max(0, Math.min(100, OUTLOOK_MODEL.base + contributions.reduce((sum, row) => sum + row.contribution, 0))) * 10) / 10, contributions };
}
export const outlookLabel = (score: number) => score >= OUTLOOK_MODEL.thresholds.supportive ? 'supportive' : score <= OUTLOOK_MODEL.thresholds.challenging ? 'challenging' : 'mixed';
