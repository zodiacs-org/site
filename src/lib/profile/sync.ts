import { isAuthSessionMissingError, type Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase/client';
import { loadChartDeletions, recordChartDeletion, replaceChartDeletions } from './deletions';
import { mergeSyncState } from './merge';
import { removeStoredAuthSession } from './saved-pages-config';
import { loadProfile, replaceProfile } from './store';
import type { RemoteChartSnapshot, RemoteDeletionSnapshot } from './merge';
import { accountSyncV2Enabled } from '../account-v2/feature-flags';

interface RemoteChartDbRow {
  id: string;
  payload: unknown;
  updated_at: string | null;
}

interface RemoteDeletionDbRow {
  id: string;
  deleted_at: string | null;
}

let timer: number | undefined;
/** Chart ids the last successful read found in the account; null before any read. */
let accountChartIds: ReadonlySet<string> | null = null;
let inFlight: Promise<boolean> | null = null;
const ACCOUNT_SYNC_V2_ENABLED = accountSyncV2Enabled();

export { isSupabaseConfigured };

/**
 * Chart sync is paused: this module reads the charts an account already
 * holds, merges them into the device, and carries removals (chart ids and
 * times only) to the account. It never sends a chart's contents. Charts
 * saved after the pause stay on the device.
 */
export const CHART_UPLOAD_PAUSED = true;

/** 'paused': the last read-and-delete pass succeeded; nothing was uploaded. */
export type ChartSaveStatus = 'local' | 'syncing' | 'synced' | 'paused' | 'error';
let chartSaveStatus: ChartSaveStatus = 'local';
export function getChartSaveStatus(): ChartSaveStatus { return chartSaveStatus; }
function announceSaveStatus(status: ChartSaveStatus): void {
  chartSaveStatus = status;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('zodiacs:chart-save-status', { detail: status }));
}

/**
 * Whether the last successful read found this chart in the account. Features
 * that need a chart row in the account (the daily chart email, invitations)
 * are offered only for such a chart while chart sync is paused.
 */
export function chartFoundInAccount(id: string): boolean {
  return accountChartIds?.has(id) ?? false;
}

/** The chart ids the last successful read found in the account (empty before any read). */
export function accountChartIdsFromLastRead(): string[] {
  return accountChartIds ? [...accountChartIds] : [];
}

export async function getSyncSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error && !isAuthSessionMissingError(error)) throw error;
  return data.session ?? null;
}

export function onSyncAuthChange(callback: (session: Session | null) => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    if (!session) accountChartIds = null;
    callback(session);
    if (session && !ACCOUNT_SYNC_V2_ENABLED) scheduleCloudSync(0);
  });
  return () => data.subscription.unsubscribe();
}

export async function sendMagicLink(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, message: 'Profile sync is not configured yet.' };
  const redirectTo = `${window.location.origin}/profile/`;
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function signOutOfSync(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
  accountChartIds = null;
}

/** Removes only this browser session; other signed-in devices remain active. */
export async function signOutOfSyncLocal(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw error;
  accountChartIds = null;
}

/**
 * After signOutOfSyncLocal failed (offline, timeout, 5xx), Supabase keeps the
 * session. This removes it from the browser anyway, so a reload does not sign
 * back in. The server still honours the refresh token until it expires, but
 * this device no longer holds it. True only when no stored session remains.
 */
export function forgetLocalSyncSession(): boolean {
  try {
    getSupabaseClient()?.auth.stopAutoRefresh().catch(() => {});
  } catch {
    // Removing the stored session below is what signs this device out.
  }
  accountChartIds = null;
  return removeStoredAuthSession();
}

export { getDigestOptIn, setDigestOptIn } from './digest-preference';

export function scheduleCloudSync(delay = 500): void {
  if (ACCOUNT_SYNC_V2_ENABLED) return;
  if (!isSupabaseConfigured() || typeof window === 'undefined') return;
  announceSaveStatus('syncing');
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void syncNow().catch(() => {});
  }, delay);
}

export async function deleteRemoteChart(id: string): Promise<void> {
  if (!recordChartDeletion(id)) return;
  await syncNow();
}

export async function syncNow(): Promise<boolean> {
  if (ACCOUNT_SYNC_V2_ENABLED) return false;
  if (inFlight) return inFlight;
  announceSaveStatus('syncing');
  inFlight = syncProfile().then(ok => {
    announceSaveStatus(ok ? 'paused' : 'local');
    return ok;
  }).catch(error => {
    announceSaveStatus('error');
    throw error;
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function syncProfile(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return false;

  const local = loadProfile();
  const localDeletions = loadChartDeletions();
  const { data: remoteProfile, error: profileError } = await client
    .from('profiles')
    .select('settings')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  const { data: remoteCharts, error: chartsError } = await client
    .from('charts')
    .select('id,payload,updated_at')
    .eq('user_id', userData.user.id);
  if (chartsError) throw chartsError;

  const { data: remoteDeletions, error: deletionsError } = await client
    .from('chart_deletions')
    .select('id,deleted_at')
    .eq('user_id', userData.user.id);
  if (deletionsError) throw deletionsError;

  const merged = mergeSyncState({
    localProfile: local,
    remoteSettings: remoteProfile?.settings,
    remoteCharts: (remoteCharts ?? []).map(toRemoteChartSnapshot),
    localDeletions,
    remoteDeletions: (remoteDeletions ?? []).map(toRemoteDeletionSnapshot),
  });
  replaceProfile(merged.profile);
  replaceChartDeletions(merged.deletions);

  const now = new Date().toISOString();
  const { error: upsertProfileError } = await client
    .from('profiles')
    .upsert({
      user_id: userData.user.id,
      settings: merged.profile.settings,
      updated_at: now,
    }, { onConflict: 'user_id' });
  if (upsertProfileError) throw upsertProfileError;

  // Chart sync is paused (CHART_UPLOAD_PAUSED): no chart contents are sent.
  // Charts stay on this device; the account keeps only what it held before.

  if (merged.deletions.length > 0) {
    const { error: upsertDeletionsError } = await client
      .from('chart_deletions')
      .upsert(merged.deletions.map((deletion) => ({
        id: deletion.id,
        user_id: userData.user.id,
        deleted_at: deletion.deletedAt,
      })), { onConflict: 'user_id,id' });
    if (upsertDeletionsError) throw upsertDeletionsError;
  }

  if (merged.deletedChartIds.length > 0) {
    const { error: deleteChartsError } = await client
      .from('charts')
      .delete()
      .eq('user_id', userData.user.id)
      .in('id', merged.deletedChartIds);
    if (deleteChartsError) throw deleteChartsError;
  }

  const removed = new Set(merged.deletedChartIds);
  accountChartIds = new Set((remoteCharts ?? [])
    .map((row) => (row as RemoteChartDbRow).id)
    .filter((id): id is string => typeof id === 'string' && !removed.has(id)));

  // Data-free completion signal for optional account-aware surfaces. They
  // must re-read the account only after the pass has fully succeeded.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('zodiacs:profile-synced'));
  }

  return true;
}

function toRemoteChartSnapshot(row: RemoteChartDbRow): RemoteChartSnapshot {
  return {
    id: row.id,
    payload: row.payload,
    updatedAt: row.updated_at,
  };
}

function toRemoteDeletionSnapshot(row: RemoteDeletionDbRow): RemoteDeletionSnapshot {
  return {
    id: row.id,
    deletedAt: row.deleted_at,
  };
}
