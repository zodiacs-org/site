import type { ChartFlag, HouseSystem } from '../../lib/engine/types';
import type { TransitWindow, WindowTransitBody } from '../../lib/engine/transit-window-core';
import type { SkyEvent } from './types';

export interface PersonalContact {
  sourceId: string;
  sourceUpdatedAt?: string;
  window: TransitWindow;
  transitLongitude: number;
  natalLongitude: number;
  separation: number;
  phase: 'applying' | 'exact' | 'separating' | 'stationary / uncertain';
  natalHouse: number | null;
  transitHouse: number | null;
  orb: number;
}
export interface PersonalResult {
  sourceId: string;
  houseSystem: HouseSystem | null;
  flags: ChartFlag[];
  timeReliable: boolean;
  events: SkyEvent[];
  houses: { house: number; natal: string[]; transit: string[] }[];
  outlook?: { date: string; score: number; contributions: { id: string; body: string; aspect: string; separation: number; weight: number; contribution: number; house: number | null }[] }[];
}
export const PERSONAL_BODIES: WindowTransitBody[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
export const SIGN_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const degreeLabel = (longitude: number) => `${SIGN_NAMES[Math.floor(longitude / 30)]} ${(longitude % 30).toFixed(2)}°`;
export const HOUSE_THEMES: Record<number, string> = { 2: 'Resources, budget and what you can afford to risk', 5: 'Speculation, experimentation and appetite for risk', 8: 'Shared resources, leverage and obligations' };
export function reliableTime(timeKnown: boolean, flags: readonly ChartFlag[]): boolean {
  return timeKnown && !flags.some(flag => ['no-time', 'dst-gap', 'dst-fold', 'outside-reference-span'].includes(flag));
}
export function sourceRevision(chart: { id: string; updatedAt: string; birth: unknown; summary: unknown }): string {
  // Memory-only invalidation token, never exported, logged, persisted or sent.
  return JSON.stringify([chart.id, chart.updatedAt, chart.birth, chart.summary]);
}
