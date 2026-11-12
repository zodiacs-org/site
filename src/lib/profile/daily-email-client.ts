import { profileAccessAllowed } from '../account-v2/profile-access-reader';
import { accountSyncV2Enabled } from '../account-v2/feature-flags';

type Fetcher = typeof fetch;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAILY_CHART_SELECTION_KEY = 'zodiacs.daily-chart-selection.v1';

export interface DailyChartPreference {
  enabled: boolean;
  pending: boolean;
  paused: boolean;
  requiresConfirmation: boolean;
  chartId: string | null;
  timezone: string | null;
  confirmedAt: string | null;
  maskedEmail: string | null;
}

export interface DailyChartPreferenceInput {
  chartId: string;
  timezone: string;
}

export interface DailyChartPreferenceMutation {
  ok: true;
  pending: boolean;
  requestId?: string;
}

export class DailyChartPreferenceError extends Error {
  constructor(public readonly status: number) {
    super(`Daily chart preference request failed (${status}).`);
    this.name = 'DailyChartPreferenceError';
  }
}

function bearerHeaders(accessToken: string, json = false): Record<string, string> {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new DailyChartPreferenceError(response.status);
  const value = await response.json() as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DailyChartPreferenceError(502);
  }
  return value as Record<string, unknown>;
}

/**
 * Talks only to the first-party preference endpoint. The browser's Supabase
 * access token authenticates the account; no service credential crosses into
 * the island or this client helper.
 */
export async function getDailyChartPreference(
  accessToken: string,
  fetcher: Fetcher = fetch,
): Promise<DailyChartPreference> {
  const response = await fetcher('/api/email/chart-preference', {
    method: 'GET',
    credentials: 'same-origin',
    headers: bearerHeaders(accessToken),
  });
  const value = await responseJson(response);
  const enabled = value.enabled === true;
  const pending = value.pending === true;
  const paused = value.paused === true;
  const requiresConfirmation = value.requiresConfirmation === true;
  const chartId = typeof value.chartId === 'string' && UUID.test(value.chartId)
    ? value.chartId
    : value.chartId === null ? null : undefined;
  const timezone = typeof value.timezone === 'string' ? value.timezone : null;
  const confirmedAt = typeof value.confirmedAt === 'string' ? value.confirmedAt : null;
  const maskedEmail = typeof value.maskedEmail === 'string' ? value.maskedEmail : null;
  if (value.enabled === false && !pending && !paused && !requiresConfirmation) {
    return {
      enabled: false,
      pending: false,
      paused: false,
      requiresConfirmation: false,
      chartId: null,
      timezone: null,
      confirmedAt: null,
      maskedEmail,
    };
  }
  if (pending && !enabled && !paused && !requiresConfirmation && chartId && timezone) {
    return {
      enabled: false,
      pending: true,
      paused: false,
      requiresConfirmation: false,
      chartId,
      timezone,
      confirmedAt: null,
      maskedEmail,
    };
  }
  if (enabled && !pending && !requiresConfirmation && timezone && confirmedAt
    && ((paused && chartId === null) || (!paused && typeof chartId === 'string'))) {
    return {
      enabled: true,
      pending: false,
      paused,
      requiresConfirmation: false,
      chartId,
      timezone,
      confirmedAt,
      maskedEmail,
    };
  }
  if (!enabled && !pending && requiresConfirmation && timezone && confirmedAt
    && ((paused && chartId === null) || (!paused && typeof chartId === 'string'))) {
    return {
      enabled: false,
      pending: false,
      paused,
      requiresConfirmation: true,
      chartId,
      timezone,
      confirmedAt,
      maskedEmail: null,
    };
  }
  throw new DailyChartPreferenceError(502);
}

export async function setDailyChartPreference(
  accessToken: string,
  input: DailyChartPreferenceInput,
  fetcher: Fetcher = fetch,
): Promise<DailyChartPreferenceMutation> {
  const response = await fetcher('/api/email/chart-preference', {
    method: 'POST',
    credentials: 'same-origin',
    headers: bearerHeaders(accessToken, true),
    body: JSON.stringify(input),
  });
  const value = await responseJson(response);
  if (value.ok !== true || typeof value.pending !== 'boolean') {
    throw new DailyChartPreferenceError(502);
  }
  return {
    ok: true,
    pending: value.pending,
    ...(typeof value.requestId === 'string' ? { requestId: value.requestId } : {}),
  };
}

/** Reissues only the server's current pending request; no chart choice crosses from this surface. */
export async function resendDailyChartPreference(
  accessToken: string,
  fetcher: Fetcher = fetch,
): Promise<DailyChartPreferenceMutation> {
  const response = await fetcher('/api/email/chart-preference', {
    method: 'POST',
    credentials: 'same-origin',
    headers: bearerHeaders(accessToken, true),
    body: JSON.stringify({ action: 'resend' }),
  });
  const value = await responseJson(response);
  if (value.ok !== true || value.pending !== true) {
    throw new DailyChartPreferenceError(502);
  }
  return {
    ok: true,
    pending: true,
    ...(typeof value.requestId === 'string' ? { requestId: value.requestId } : {}),
  };
}

export async function deleteDailyChartPreference(
  accessToken: string,
  fetcher: Fetcher = fetch,
): Promise<void> {
  const response = await fetcher('/api/email/chart-preference', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: bearerHeaders(accessToken),
  });
  const value = await responseJson(response);
  if (value.ok !== true) throw new DailyChartPreferenceError(502);
}

/** Pauses/cancels the daily preference before its selected chart is removed. */
export async function pauseDailyChartPreferenceForDeletion(
  accessToken: string,
  chartId: string,
  fetcher: Fetcher = fetch,
): Promise<{
  outcome: 'paused' | 'cancelled' | 'not-selected';
  selectedChartId: string | null;
}> {
  if (!UUID.test(chartId)) throw new DailyChartPreferenceError(400);
  const response = await fetcher('/api/email/chart-preference', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: bearerHeaders(accessToken, true),
    body: JSON.stringify({ chartId }),
  });
  const value = await responseJson(response);
  const selectedChartId = typeof value.selectedChartId === 'string' && UUID.test(value.selectedChartId)
    ? value.selectedChartId
    : value.selectedChartId === null ? null : undefined;
  if (value.ok !== true
    || typeof value.paused !== 'boolean'
    || typeof value.cancelled !== 'boolean'
    || selectedChartId === undefined) {
    throw new DailyChartPreferenceError(502);
  }
  if (value.paused && value.cancelled) throw new DailyChartPreferenceError(502);
  const outcome = value.paused ? 'paused' : value.cancelled ? 'cancelled' : 'not-selected';
  if (outcome !== 'not-selected' && selectedChartId !== null) {
    throw new DailyChartPreferenceError(502);
  }
  return { outcome, selectedChartId };
}

/**
 * Remembers the one chart this device last saw selected for daily email. This
 * UUID is already present in the local profile and carries no email or token.
 * Keeping it while signed out lets deletion fail honestly until the account can
 * prove the server preference was paused; it never grants enrollment authority.
 */
export function rememberDailyChartSelection(chartId: string | null): void {
  if (!profileAccessAllowed()) return;
  try {
    if (chartId && UUID.test(chartId)) localStorage.setItem(DAILY_CHART_SELECTION_KEY, chartId);
    else localStorage.removeItem(DAILY_CHART_SELECTION_KEY);
  } catch {
    // Storage can be unavailable; the server-owned foreign key remains the
    // final guard when a signed-in cloud deletion syncs.
  }
}

export function rememberedDailyChartSelection(): string | null {
  if (!profileAccessAllowed()) return null;
  try {
    const chartId = localStorage.getItem(DAILY_CHART_SELECTION_KEY);
    return chartId && UUID.test(chartId) ? chartId : null;
  } catch {
    return null;
  }
}

/**
 * Returns only chart ids that the signed-in account holds in the cloud.
 * Device-only local charts never become eligible merely because they are
 * visible elsewhere on the profile page.
 *
 * With account sync v2 on, that is the one encrypted self chart this browser
 * has synced for this account (local sync metadata, ids only); the retired
 * v1 table (public.charts) is never read. The server still decides, from the
 * chart_sync and chart_emails consents, whether the chart may be used.
 */
export async function getSyncedChartIds(userId: string): Promise<string[]> {
  if (!UUID.test(userId)) return [];
  if (accountSyncV2Enabled()) return accountV2SyncedChartIds(userId);
  const { getSupabaseClient } = await import('../supabase/client');
  const client = getSupabaseClient();
  if (!client || !UUID.test(userId)) return [];
  const { data, error } = await client
    .from('charts')
    .select('id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string' && UUID.test(id));
}

async function accountV2SyncedChartIds(userId: string): Promise<string[]> {
  if (!profileAccessAllowed()) return [];
  const [{ getAccountV2BrowserStorage }, { readAccountSyncMetadata }] = await Promise.all([
    import('../account-v2/browser-storage'),
    import('../account-v2/local-state'),
  ]);
  const storage = getAccountV2BrowserStorage();
  if (!storage) return [];
  const result = readAccountSyncMetadata(storage.local, userId);
  if (result.status !== 'ready') return [];
  return result.metadata.charts
    .filter((chart) => chart.selectedForSync && chart.serverRevision > 0 && UUID.test(chart.chartId))
    .map((chart) => chart.chartId);
}

/** First letter + ellipsis + domain, as specified by the Phase 3 copy deck. */
export function maskDailyEmail(email: string | null | undefined): string {
  if (!email) return '…';
  const [local, domain, ...rest] = email.trim().split('@');
  if (!local || !domain || rest.length > 0) return '…';
  return `${local[0]}…@${domain}`;
}

export function isBrowserIanaTimezone(value: string): boolean {
  if (!value || value.trim() !== value || value.length > 255) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function browserTimezoneChoices(extra: readonly string[] = []): string[] {
  const supportedValuesOf = (Intl as typeof Intl & {
    supportedValuesOf?: (key: 'timeZone') => string[];
  }).supportedValuesOf;
  const candidates = supportedValuesOf
    ? supportedValuesOf('timeZone')
    : [
      'America/Chicago',
      'America/Los_Angeles',
      'America/Mexico_City',
      'America/New_York',
      'Asia/Bangkok',
      'Asia/Tokyo',
      'Australia/Sydney',
      'Europe/Lisbon',
      'Europe/London',
      'Europe/Paris',
    ];
  return Array.from(new Set(['UTC', ...extra, ...candidates]))
    .filter(isBrowserIanaTimezone);
}
