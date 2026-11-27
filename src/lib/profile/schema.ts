/**
 * The local-first saved-charts profile. Birth input is the source of truth
 * (lossless recompute forever); `summary` is a render cache stamped with
 * the engine version. UUID ids make the Phase-2 Supabase sync an
 * idempotent bulk upsert — do not change shapes casually.
 */
import type { ChartFlag, HouseSystem } from '../engine/types';

export const PROFILE_KEY = 'zodiacs.profile.v1';
export const MAX_CHARTS = 40;

export interface SavedPlace {
  name: string;
  admin1: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
}

export interface SavedBodySummary {
  body: string;
  lon: number;
  retrograde: boolean;
}

export type SavedChartRelationship = 'self' | 'other';

export interface SavedChart {
  id: string;
  name: string;
  /** Explicit owner relationship. Missing means a legacy chart not yet classified. */
  relationship?: SavedChartRelationship;
  createdAt: string;
  updatedAt: string;
  birth: {
    date: string;           // YYYY-MM-DD
    time: string | null;    // HH:MM, null when unknown
    timeKnown: boolean;
    place: SavedPlace | null;
  };
  summary: {
    engineVersion: string;
    utcISO: string;
    houseSystem: HouseSystem;
    bodies: SavedBodySummary[];
    angles: { asc: number; mc: number } | null;
    flags: ChartFlag[];
    /** True when `flags` were computed against the date as written (Gregorian or Old Style). */
    calendarChecked?: true;
  };
}

export interface Profile {
  version: 1;
  settings: { houseSystem: HouseSystem };
  charts: SavedChart[];
}

export const EMPTY_PROFILE: Profile = {
  version: 1,
  settings: { houseSystem: 'whole' },
  charts: [],
};
