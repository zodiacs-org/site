import { loadChartEmailSources } from '../account-api/chart-sources.js';
import { normalizeEmail } from './input.js';

/** Shown wherever the daily chart email names its chart; never the private label. */
export const DAILY_CHART_EMAIL_CHART_NAME = 'your synced chart';

type Environment = Record<string, unknown>;
type Fetch = typeof fetch;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;

export interface AuthenticatedEmailUser {
  id: string;
  email: string;
}

export interface DailyChartPreference {
  chartId: string | null;
  recipientHash: string;
  confirmationTokenHash: string | null;
  timezone: string;
  confirmedAt: string | null;
  pending: boolean;
  paused: boolean;
}

export interface OwnedDailyChart {
  id: string;
  name: string;
}

export type DailyChartConfirmationSendClaim =
  | {
    outcome: 'claimed';
    claimedAt: string;
    retryAfterSeconds: 0;
  }
  | {
    outcome: 'capped_60s' | 'capped_24h';
    nextAllowedAt: string;
    retryAfterSeconds: number;
  };

function value(env: Environment, key: string): string {
  const candidate = env[key];
  return typeof candidate === 'string' ? candidate.trim() : '';
}

function supabaseOrigin(env: Environment): string {
  const url = new URL(value(env, 'PUBLIC_SUPABASE_URL'));
  if (url.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS.');
  return url.origin;
}

function serviceHeaders(env: Environment, prefer?: string): Record<string, string> {
  const serviceKey = value(env, 'SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function bearerToken(req: any): string {
  const raw = typeof req.get === 'function'
    ? req.get('authorization')
    : req.headers?.authorization;
  if (typeof raw !== 'string') return '';
  const match = /^Bearer\s+([^\s]+)$/i.exec(raw.trim());
  return match?.[1] ?? '';
}

function parseUser(value: unknown): AuthenticatedEmailUser | null {
  if (!value || typeof value !== 'object') return null;
  const outer = value as { user?: unknown };
  const record = outer.user && typeof outer.user === 'object'
    ? outer.user as { id?: unknown; email?: unknown }
    : value as { id?: unknown; email?: unknown };
  const email = normalizeEmail(record.email);
  return typeof record.id === 'string' && UUID.test(record.id) && email
    ? { id: record.id, email }
    : null;
}

/** Authenticates the browser JWT with Supabase Auth; service-role trust is never used here. */
export async function authenticateEmailUser(
  req: any,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<AuthenticatedEmailUser | null> {
  const token = bearerToken(req);
  const publishableKey = value(env, 'PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    || value(env, 'PUBLIC_SUPABASE_ANON_KEY');
  if (!token || !publishableKey) return null;
  const response = await fetcher(`${supabaseOrigin(env)}/auth/v1/user`, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Supabase user authentication failed (${response.status})`);
  return parseUser(await response.json());
}

export async function getAdminEmailUser(
  userId: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<AuthenticatedEmailUser | null> {
  if (!UUID.test(userId)) return null;
  const response = await fetcher(
    `${supabaseOrigin(env)}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    { headers: serviceHeaders(env) },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Supabase admin user lookup failed (${response.status})`);
  return parseUser(await response.json());
}

export async function chartBelongsToUser(
  userId: string,
  chartId: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<boolean> {
  return (await getOwnedDailyChart(userId, chartId, env, fetcher)) !== null;
}

/**
 * The daily chart email uses the account's encrypted v2 self chart, and only
 * while the account holds both chart_sync and chart_emails. The chart id must
 * be that chart's id. Nothing is decrypted here: the name shown in the
 * confirmation email and page is a fixed phrase, never the chart label, and
 * public.charts is never read.
 */
export async function getOwnedDailyChart(
  userId: string,
  chartId: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<OwnedDailyChart | null> {
  if (!UUID.test(userId) || !UUID.test(chartId)) return null;
  const sources = await loadChartEmailSources([userId], {
    supabaseUrl: value(env, 'PUBLIC_SUPABASE_URL'),
    serviceKey: value(env, 'SUPABASE_SERVICE_ROLE_KEY'),
    fetcher,
  });
  const source = sources.get(userId.toLowerCase());
  return source && source.chartId === chartId.toLowerCase()
    ? { id: source.chartId, name: DAILY_CHART_EMAIL_CHART_NAME }
    : null;
}

/**
 * Claims one durable confirmation-email attempt before any pending preference
 * or token is changed. The database owns both the exact rolling windows and
 * idempotency for a retried claim token; provider failure never refunds it.
 */
export async function claimDailyChartConfirmationSend(
  userId: string,
  claimToken: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<DailyChartConfirmationSendClaim> {
  if (!UUID.test(userId) || !UUID.test(claimToken)) {
    throw new Error('Daily chart confirmation claim identifiers are invalid.');
  }
  const input = `${supabaseOrigin(env)}/rest/v1/rpc/claim_daily_chart_confirmation_send`;
  const init = {
    method: 'POST',
    headers: serviceHeaders(env),
    body: JSON.stringify({
      candidate_user_id: userId,
      candidate_claim_token: claimToken,
    }),
  } satisfies RequestInit;
  let response: Response;
  try {
    response = await fetcher(input, init);
  } catch {
    // A transport can lose the committed response. Retry exactly once with
    // the same UUID; the RPC returns the original claim without double-counting.
    response = await fetcher(input, init);
  }
  if (!response.ok) {
    throw new Error(`Daily chart confirmation claim failed (${response.status})`);
  }
  const value = await response.json() as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Daily chart confirmation claim returned an invalid state.');
  }
  const row = value as {
    outcome?: unknown;
    claimed_at?: unknown;
    next_allowed_at?: unknown;
    retry_after_seconds?: unknown;
  };
  if (row.outcome === 'claimed'
    && typeof row.claimed_at === 'string'
    && Number.isFinite(Date.parse(row.claimed_at))
    && row.retry_after_seconds === 0) {
    return {
      outcome: 'claimed',
      claimedAt: row.claimed_at,
      retryAfterSeconds: 0,
    };
  }
  if ((row.outcome === 'capped_60s' || row.outcome === 'capped_24h')
    && typeof row.next_allowed_at === 'string'
    && Number.isFinite(Date.parse(row.next_allowed_at))
    && Number.isInteger(row.retry_after_seconds)
    && (row.retry_after_seconds as number) > 0
    && (row.retry_after_seconds as number) <= 86_400) {
    return {
      outcome: row.outcome,
      nextAllowedAt: row.next_allowed_at,
      retryAfterSeconds: row.retry_after_seconds as number,
    };
  }
  throw new Error('Daily chart confirmation claim returned an invalid state.');
}

export async function getDailyChartPreference(
  userId: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<DailyChartPreference | null> {
  const query = new URLSearchParams({
    select: 'chart_id,recipient_hash,confirmation_token_hash,timezone,confirmed_at',
    user_id: `eq.${userId}`,
    limit: '1',
  });
  const response = await fetcher(`${supabaseOrigin(env)}/rest/v1/daily_chart_preferences?${query}`, {
    headers: serviceHeaders(env),
  });
  if (!response.ok) throw new Error(`Daily chart preference lookup failed (${response.status})`);
  const body = await response.json() as unknown;
  if (!Array.isArray(body) || body.length === 0) return null;
  const row = body[0] as {
    chart_id?: unknown;
    recipient_hash?: unknown;
    confirmation_token_hash?: unknown;
    timezone?: unknown;
    confirmed_at?: unknown;
  };
  const chartId = row.chart_id === null || typeof row.chart_id === 'string'
    ? row.chart_id
    : undefined;
  const confirmedAt = row.confirmed_at === null || typeof row.confirmed_at === 'string'
    ? row.confirmed_at
    : undefined;
  const tokenHash = row.confirmation_token_hash === null
    || (typeof row.confirmation_token_hash === 'string' && HASH.test(row.confirmation_token_hash))
    ? row.confirmation_token_hash
    : undefined;
  return chartId !== undefined
    && confirmedAt !== undefined
    && tokenHash !== undefined
    && typeof row.recipient_hash === 'string'
    && HASH.test(row.recipient_hash)
    && typeof row.timezone === 'string'
    ? {
      chartId,
      recipientHash: row.recipient_hash,
      confirmationTokenHash: tokenHash,
      timezone: row.timezone,
      confirmedAt,
      pending: confirmedAt === null,
      paused: confirmedAt !== null && chartId === null,
    }
    : null;
}

export async function savePendingDailyChartPreference(
  userId: string,
  chartId: string,
  recipientHash: string,
  confirmationTokenHash: string,
  timezone: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<void> {
  const response = await fetcher(
    `${supabaseOrigin(env)}/rest/v1/daily_chart_preferences?on_conflict=user_id`,
    {
      method: 'POST',
      headers: serviceHeaders(env, 'resolution=merge-duplicates,return=minimal'),
      body: JSON.stringify({
        user_id: userId,
        chart_id: chartId,
        recipient_hash: recipientHash,
        confirmation_token_hash: confirmationTokenHash,
        timezone,
        confirmed_at: null,
      }),
    },
  );
  if (!response.ok) throw new Error(`Daily chart confirmation request write failed (${response.status})`);
}

/**
 * Replaces only the pending request the caller just inspected. A concurrent
 * confirmation, cancellation, deletion, or resend makes the conditional
 * update affect zero rows instead of silently changing a newer preference.
 */
export async function replacePendingDailyChartPreference(
  userId: string,
  previousConfirmationTokenHash: string,
  chartId: string,
  recipientHash: string,
  confirmationTokenHash: string,
  timezone: string,
  options: {
    notUpdatedAfter?: string;
    env?: Environment;
    fetcher?: Fetch;
  } = {},
): Promise<boolean> {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  if (!UUID.test(userId)
    || !UUID.test(chartId)
    || !HASH.test(previousConfirmationTokenHash)
    || !HASH.test(recipientHash)
    || !HASH.test(confirmationTokenHash)) {
    throw new Error('Pending daily chart replacement identifiers are invalid.');
  }
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    confirmation_token_hash: `eq.${previousConfirmationTokenHash}`,
    confirmed_at: 'is.null',
  });
  if (options.notUpdatedAfter) {
    const cutoff = new Date(options.notUpdatedAfter);
    if (!Number.isFinite(cutoff.getTime())) {
      throw new Error('Pending daily chart replacement cutoff is invalid.');
    }
    query.set('updated_at', `lte.${cutoff.toISOString()}`);
  }
  const response = await fetcher(
    `${supabaseOrigin(env)}/rest/v1/daily_chart_preferences?${query}`,
    {
      method: 'PATCH',
      headers: serviceHeaders(env, 'return=representation'),
      body: JSON.stringify({
        chart_id: chartId,
        recipient_hash: recipientHash,
        confirmation_token_hash: confirmationTokenHash,
        timezone,
      }),
    },
  );
  if (!response.ok) throw new Error(`Pending daily chart replacement failed (${response.status})`);
  const rows = await response.json() as unknown;
  return Array.isArray(rows) && rows.length === 1;
}

/**
 * Changes a confirmed chart preference only if the exact row inspected by the
 * request still exists. A concurrent stop, unsubscribe, or newer edit wins;
 * this update never recreates confirmed consent with an upsert.
 */
export async function updateConfirmedDailyChartPreference(
  userId: string,
  previousChartId: string | null,
  recipientHash: string,
  previousTimezone: string,
  confirmedAt: string,
  chartId: string,
  timezone: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<boolean> {
  if (!UUID.test(userId)
    || (previousChartId !== null && !UUID.test(previousChartId))
    || !UUID.test(chartId)
    || !HASH.test(recipientHash)
    || !previousTimezone
    || !timezone
    || !Number.isFinite(new Date(confirmedAt).getTime())) {
    throw new Error('Confirmed daily chart update identifiers are invalid.');
  }
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    chart_id: previousChartId === null ? 'is.null' : `eq.${previousChartId}`,
    recipient_hash: `eq.${recipientHash}`,
    confirmation_token_hash: 'is.null',
    timezone: `eq.${previousTimezone}`,
    confirmed_at: `eq.${confirmedAt}`,
  });
  const response = await fetcher(
    `${supabaseOrigin(env)}/rest/v1/daily_chart_preferences?${query}`,
    {
      method: 'PATCH',
      headers: serviceHeaders(env, 'return=representation'),
      body: JSON.stringify({ chart_id: chartId, timezone }),
    },
  );
  if (!response.ok) throw new Error(`Confirmed daily chart update failed (${response.status})`);
  const rows = await response.json() as unknown;
  return Array.isArray(rows) && rows.length === 1;
}

/**
 * Moves an exact confirmed preference to a fresh recipient's pending DOI.
 * A concurrent stop, unsubscribe, deletion, or edit affects the match and
 * therefore wins instead of being recreated by an upsert.
 */
export async function replaceConfirmedDailyChartPreferenceWithPending(
  userId: string,
  previousChartId: string | null,
  previousRecipientHash: string,
  previousTimezone: string,
  previousConfirmedAt: string,
  chartId: string,
  recipientHash: string,
  confirmationTokenHash: string,
  timezone: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<boolean> {
  if (!UUID.test(userId)
    || (previousChartId !== null && !UUID.test(previousChartId))
    || !UUID.test(chartId)
    || !HASH.test(previousRecipientHash)
    || !HASH.test(recipientHash)
    || !HASH.test(confirmationTokenHash)
    || !previousTimezone
    || !timezone
    || !Number.isFinite(new Date(previousConfirmedAt).getTime())) {
    throw new Error('Confirmed daily chart replacement identifiers are invalid.');
  }
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    chart_id: previousChartId === null ? 'is.null' : `eq.${previousChartId}`,
    recipient_hash: `eq.${previousRecipientHash}`,
    confirmation_token_hash: 'is.null',
    timezone: `eq.${previousTimezone}`,
    confirmed_at: `eq.${previousConfirmedAt}`,
  });
  const response = await fetcher(
    `${supabaseOrigin(env)}/rest/v1/daily_chart_preferences?${query}`,
    {
      method: 'PATCH',
      headers: serviceHeaders(env, 'return=representation'),
      body: JSON.stringify({
        chart_id: chartId,
        recipient_hash: recipientHash,
        confirmation_token_hash: confirmationTokenHash,
        timezone,
        confirmed_at: null,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Confirmed daily chart replacement failed (${response.status})`);
  }
  const rows = await response.json() as unknown;
  return Array.isArray(rows) && rows.length === 1;
}

export async function confirmDailyChartPreference(
  userId: string,
  chartId: string,
  recipientHash: string,
  timezone: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<void> {
  const response = await fetcher(
    `${supabaseOrigin(env)}/rest/v1/daily_chart_preferences?on_conflict=user_id`,
    {
      method: 'POST',
      headers: serviceHeaders(env, 'resolution=merge-duplicates,return=minimal'),
      body: JSON.stringify({
        user_id: userId,
        chart_id: chartId,
        recipient_hash: recipientHash,
        confirmation_token_hash: null,
        timezone,
        confirmed_at: new Date().toISOString(),
      }),
    },
  );
  if (!response.ok) throw new Error(`Daily chart preference write failed (${response.status})`);
}

/**
 * Consumes exactly the pending request that was inspected by the confirmation
 * handler. A cancellation, resend, chart deletion, or competing confirmation
 * makes the filtered update affect zero rows instead of reviving stale consent.
 */
export async function consumePendingDailyChartPreference(
  userId: string,
  chartId: string,
  recipientHash: string,
  confirmationTokenHash: string,
  timezone: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<boolean> {
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    chart_id: `eq.${chartId}`,
    recipient_hash: `eq.${recipientHash}`,
    confirmation_token_hash: `eq.${confirmationTokenHash}`,
    confirmed_at: 'is.null',
    timezone: `eq.${timezone}`,
  });
  const response = await fetcher(
    `${supabaseOrigin(env)}/rest/v1/daily_chart_preferences?${query}`,
    {
      method: 'PATCH',
      headers: serviceHeaders(env, 'return=representation'),
      body: JSON.stringify({
        confirmation_token_hash: null,
        confirmed_at: new Date().toISOString(),
      }),
    },
  );
  if (!response.ok) throw new Error(`Daily chart confirmation consume failed (${response.status})`);
  const rows = await response.json() as unknown;
  return Array.isArray(rows) && rows.length === 1;
}

/**
 * Pauses a confirmed personal brief before its selected chart is removed from
 * the device. The chart id filter prevents one tab from pausing a newer choice.
 */
export async function pauseDailyChartPreference(
  userId: string,
  chartId: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<boolean> {
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    chart_id: `eq.${chartId}`,
    confirmed_at: 'not.is.null',
  });
  const response = await fetcher(
    `${supabaseOrigin(env)}/rest/v1/daily_chart_preferences?${query}`,
    {
      method: 'PATCH',
      headers: serviceHeaders(env, 'return=representation'),
      body: JSON.stringify({ chart_id: null }),
    },
  );
  if (!response.ok) throw new Error(`Daily chart preference pause failed (${response.status})`);
  const rows = await response.json() as unknown;
  return Array.isArray(rows) && rows.length === 1;
}

export type DailyChartDeletionOutcome = 'paused' | 'cancelled' | 'not_selected';
export interface DailyChartDeletionResult {
  outcome: DailyChartDeletionOutcome;
  selectedChartId: string | null;
}

/**
 * Atomically pauses confirmed consent or cancels pending consent for the chart
 * being deleted. The database transaction serializes against confirmation so
 * the browser never receives success while a matching preference survives.
 */
export async function pauseOrCancelDailyChartForDeletion(
  userId: string,
  chartId: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<DailyChartDeletionResult> {
  if (!UUID.test(userId) || !UUID.test(chartId)) {
    throw new Error('Daily chart deletion identifiers are invalid.');
  }
  const response = await fetcher(
    `${supabaseOrigin(env)}/rest/v1/rpc/pause_or_cancel_daily_chart_for_deletion`,
    {
      method: 'POST',
      headers: serviceHeaders(env),
      body: JSON.stringify({
        candidate_user_id: userId,
        candidate_chart_id: chartId,
      }),
    },
  );
  if (!response.ok) throw new Error(`Daily chart deletion guard failed (${response.status})`);
  const value = await response.json() as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Daily chart deletion guard returned an invalid state.');
  }
  const row = value as { outcome?: unknown; selected_chart_id?: unknown };
  const outcome = row.outcome;
  const selectedChartId = row.selected_chart_id;
  if ((outcome !== 'paused' && outcome !== 'cancelled' && outcome !== 'not_selected')
    || (selectedChartId !== null && (typeof selectedChartId !== 'string' || !UUID.test(selectedChartId)))
    || (outcome !== 'not_selected' && selectedChartId !== null)) {
    throw new Error('Daily chart deletion guard returned an invalid state.');
  }
  return { outcome, selectedChartId };
}

export async function revokeDailyEmailPreference(
  recipientHash: string,
  subject: { kind: 'sun' } | { kind: 'chart'; userId: string },
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<void> {
  if (!HASH.test(recipientHash)) {
    throw new Error('Daily recipient hash is invalid.');
  }
  if (subject.kind === 'chart' && !UUID.test(subject.userId)) {
    throw new Error('Daily chart preference user is invalid.');
  }
  const response = await fetcher(
    `${supabaseOrigin(env)}/rest/v1/rpc/revoke_daily_email_preference`,
    {
      method: 'POST',
      headers: serviceHeaders(env, 'return=minimal'),
      body: JSON.stringify({
        candidate_recipient_hash: recipientHash,
        candidate_tier: subject.kind === 'sun' ? 'sun_sign' : 'chart',
        candidate_user_id: subject.kind === 'chart' ? subject.userId : null,
      }),
    },
  );
  if (!response.ok) throw new Error(`Daily preference revocation failed (${response.status})`);
}

export async function deletePendingDailyChartPreference(
  userId: string,
  confirmationTokenHash: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<void> {
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    confirmation_token_hash: `eq.${confirmationTokenHash}`,
    confirmed_at: 'is.null',
  });
  const response = await fetcher(
    `${supabaseOrigin(env)}/rest/v1/daily_chart_preferences?${query}`,
    { method: 'DELETE', headers: serviceHeaders(env, 'return=minimal') },
  );
  if (!response.ok) throw new Error(`Pending daily chart preference deletion failed (${response.status})`);
}

export async function deleteDailyChartPreference(
  userId: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<void> {
  const response = await fetcher(
    `${supabaseOrigin(env)}/rest/v1/daily_chart_preferences?user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: serviceHeaders(env, 'return=minimal') },
  );
  if (!response.ok) throw new Error(`Daily chart preference deletion failed (${response.status})`);
}
