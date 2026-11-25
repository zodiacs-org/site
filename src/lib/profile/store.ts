/**
 * localStorage-backed profile store. Every write dispatches
 * `zodiacs:profile` on window so the nav glyph and any open islands
 * stay in sync without a framework store.
 */
import { MAX_CHARTS, PROFILE_KEY } from './schema';
import type { Profile, SavedChart, SavedChartRelationship } from './schema';
import { clearChartDeletion, recordChartDeletion } from './deletions';
import { accountSyncV2Enabled } from '../account-v2/feature-flags';
import { profileAccessAllowed } from '../account-v2/profile-access-reader';
import { loadProfile } from './read-store';
import { SIGN_SLUGS } from '../signs';

export { loadProfile } from './read-store';

const YEAR_AHEAD_CACHE_KEY = 'zodiacs.yearahead.v1';
export const PROFILE_SUN_SIGN_KEY = 'zodiacs:today-sun-sign:v1';
const ACCOUNT_SYNC_V2_ENABLED = accountSyncV2Enabled();

interface PersistOptions {
  sync?: boolean;
}

export type StoredChartIdentity = Pick<SavedChart, 'birth'> & {
  summary: Pick<SavedChart['summary'], 'houseSystem'>;
};

function isSunSign(value: string | null): value is string {
  return value !== null && SIGN_SLUGS.includes(value);
}

/** Read the lightweight Sun-sign preference shared by guides and Today. */
export function loadProfileSunSign(): string | null {
  if (!profileAccessAllowed()) return null;
  try {
    const value = localStorage.getItem(PROFILE_SUN_SIGN_KEY);
    return isSunSign(value) ? value : null;
  } catch {
    return null;
  }
}

/** Store a Sun-sign preference without fabricating a saved birth chart. */
export function setProfileSunSign(sign: string): boolean {
  if (!isSunSign(sign) || !profileAccessAllowed()) return false;
  try {
    localStorage.setItem(PROFILE_SUN_SIGN_KEY, sign);
    window.dispatchEvent(new CustomEvent('zodiacs:profile-sun-sign', { detail: { sign } }));
    return true;
  } catch {
    return false;
  }
}

function queueCloudSync() {
  if (typeof window === 'undefined') return;
  // V2 is selection-only. Never fall through to the legacy "upload every
  // local chart" path when the gated account foundation is enabled.
  if (ACCOUNT_SYNC_V2_ENABLED) return;
  // Build-time gate: without Supabase env the sync chunk (and the
  // supabase-js dependency inside it) is never even fetched.
  if (!import.meta.env.PUBLIC_SUPABASE_URL) return;
  import('./sync')
    .then(({ scheduleCloudSync }) => scheduleCloudSync())
    .catch(() => {});
}

function persist(profile: Profile, options: PersistOptions = { sync: true }): boolean {
  if (!profileAccessAllowed()) return false;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent('zodiacs:profile', { detail: profile }));
    if (options.sync !== false) queueCloudSync();
    return true;
  } catch {
    return false; // storage full / private mode — callers surface a notice
  }
}

export function replaceProfile(profile: Profile): boolean {
  const ok = persist(profile, { sync: false });
  if (ok) pruneYearAheadCacheExcept(new Set(profile.charts.map((chart) => chart.id)));
  return ok;
}

function sameStoredInput(a: StoredChartIdentity, b: StoredChartIdentity): boolean {
  const aPlace = a.birth.place;
  const bPlace = b.birth.place;
  return a.birth.date === b.birth.date &&
    a.birth.time === b.birth.time &&
    aPlace !== null &&
    bPlace !== null &&
    aPlace.lat === bPlace.lat &&
    aPlace.lon === bPlace.lon &&
    a.summary.houseSystem === b.summary.houseSystem;
}

export function findMatchingChart(chart: StoredChartIdentity): SavedChart | null {
  return loadProfile().charts.find((candidate) => sameStoredInput(candidate, chart)) ?? null;
}

export function saveChart(
  chart: SavedChart,
  options: { explicitName?: string; relationship?: SavedChartRelationship } = {},
): 'saved' | 'updated' | 'full' | 'error' {
  const profile = loadProfile();
  const explicitName = options.explicitName?.trim() || undefined;
  let existing = profile.charts.findIndex((c) => c.id === chart.id);
  if (existing < 0) {
    existing = profile.charts.findIndex((candidate) => sameStoredInput(candidate, chart));
  }
  if (existing >= 0) {
    const saved = profile.charts[existing];
    const relationship = options.relationship ?? chart.relationship ?? saved.relationship;
    const sameCalendarContext = saved.birth.date === chart.birth.date
      && saved.birth.place?.tz.toLowerCase() === chart.birth.place?.tz.toLowerCase();
    const keepCheckedCalendar = !chart.summary.calendarChecked
      && saved.summary.calendarChecked === true
      && sameCalendarContext;
    const mergedSummary: SavedChart['summary'] = keepCheckedCalendar
      ? {
          ...chart.summary,
          flags: saved.summary.flags.includes('calendar-unknown')
            ? [...chart.summary.flags.filter((flag) => flag !== 'calendar-unknown'), 'calendar-unknown' as const]
            : chart.summary.flags.filter((flag) => flag !== 'calendar-unknown'),
          calendarChecked: true as const,
        }
      : chart.summary;
    const updated = {
      ...chart,
      summary: mergedSummary,
      id: saved.id,
      name: explicitName ?? saved.name,
      createdAt: saved.createdAt,
      updatedAt: new Date().toISOString(),
      ...(relationship ? { relationship } : {}),
    };
    profile.charts[existing] = updated;
    if (relationship === 'self') {
      profile.charts = profile.charts.map((candidate) => candidate.id === updated.id
        ? candidate
        : { ...candidate, relationship: 'other' });
    }
    if (!persist(profile)) return 'error';
    clearChartDeletion(updated.id);
    return 'updated';
  }
  if (profile.charts.length >= MAX_CHARTS) return 'full';
  const relationship = options.relationship ?? chart.relationship;
  const inserted = {
    ...chart,
    ...(explicitName ? { name: explicitName } : {}),
    ...(relationship ? { relationship } : {}),
  };
  if (relationship === 'self') {
    profile.charts = profile.charts.map((candidate) => ({
      ...candidate,
      relationship: 'other',
    }));
  }
  profile.charts.unshift(inserted);
  if (!persist(profile)) return 'error';
  clearChartDeletion(inserted.id);
  return 'saved';
}

export interface ChartSummaryUpdate {
  id: string;
  /** The stored instant the recomputed summary replaces. */
  utcISO: string;
  /** Optional snapshot of the stored summary that was refreshed. */
  previousSummary?: SavedChart['summary'];
  summary: SavedChart['summary'];
}

/**
 * Replaces recomputed summaries in one write: one `zodiacs:profile` event and
 * one cloud sync for the batch. Each applies only while the stored chart still
 * has its id and the instant it was recomputed from, so a chart saved again in
 * the meantime keeps its own summary. Birth input, name and timestamps stay as
 * they are: a recomputed cache is not an edit, and a new updatedAt would change
 * which chart reads as the newest. Returns the ids it replaced.
 */
export function updateChartSummaries(updates: readonly ChartSummaryUpdate[]): string[] {
  const profile = loadProfile();
  const replaced: string[] = [];
  profile.charts = profile.charts.map((chart) => {
    const update = updates.find((candidate) => candidate.id === chart.id);
    if (
      !update
      || chart.summary.utcISO !== update.utcISO
      || (update.previousSummary && JSON.stringify(chart.summary) !== JSON.stringify(update.previousSummary))
    ) return chart;
    replaced.push(chart.id);
    return { ...chart, summary: update.summary };
  });
  if (replaced.length === 0 || !persist(profile)) return [];
  return replaced;
}

/** Makes one saved chart the canonical self chart and classifies every other chart as other. */
export function markPrimarySelfChart(id: string): boolean {
  const profile = loadProfile();
  if (!profile.charts.some((chart) => chart.id === id)) return false;
  profile.charts = profile.charts.map((chart) => ({
    ...chart,
    relationship: chart.id === id ? 'self' : 'other',
    updatedAt: chart.id === id ? new Date().toISOString() : chart.updatedAt,
  }));
  return persist(profile);
}

export function getPrimarySelfChart(): SavedChart | null {
  const selfCharts = loadProfile().charts.filter((chart) => chart.relationship === 'self');
  return selfCharts.length === 1 ? selfCharts[0]! : null;
}

function pruneYearAheadCacheEntries(shouldRemove: (id: string) => boolean): void {
  if (!profileAccessAllowed()) return;
  try {
    const raw = localStorage.getItem(YEAR_AHEAD_CACHE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    const cache = parsed as Record<string, unknown>;
    let changed = false;
    for (const id of Object.keys(cache)) {
      if (!shouldRemove(id)) continue;
      delete cache[id];
      changed = true;
    }
    if (changed && profileAccessAllowed()) {
      localStorage.setItem(YEAR_AHEAD_CACHE_KEY, JSON.stringify(cache));
    }
  } catch {
    // The profile deletion is authoritative; this derived cache is best-effort.
  }
}

function pruneYearAheadCache(id: string): void {
  pruneYearAheadCacheEntries((candidate) => candidate === id);
}

function pruneYearAheadCacheExcept(chartIds: Set<string>): void {
  pruneYearAheadCacheEntries((candidate) => !chartIds.has(candidate));
}

export function deleteChart(id: string): boolean {
  const profile = loadProfile();
  const existed = profile.charts.some((c) => c.id === id);
  profile.charts = profile.charts.filter((c) => c.id !== id);
  const ok = persist(profile, { sync: false });
  if (ok && existed) {
    pruneYearAheadCache(id);
    recordChartDeletion(id);
    queueCloudSync();
  }
  return ok;
}

export function renameChart(id: string, name: string): boolean {
  const profile = loadProfile();
  const chart = profile.charts.find((c) => c.id === id);
  if (!chart) return false;
  chart.name = name;
  chart.updatedAt = new Date().toISOString();
  return persist(profile);
}

export function setHouseSystem(houseSystem: Profile['settings']['houseSystem']): void {
  const profile = loadProfile();
  profile.settings.houseSystem = houseSystem;
  persist(profile);
}
