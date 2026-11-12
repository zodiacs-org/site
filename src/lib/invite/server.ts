import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import {
  accountChartBodies,
  decryptAccountChartSource,
  loadOwnerSelfChartSource,
} from '../account-api/chart-sources.js';
import { isAdultAccountBirthDate } from '../account-api/sync-wire.js';
import type { AuthenticatedEmailUser } from '../email/daily-server.js';
import type { InviteDerivedChart } from './validate.js';
import { cleanInviteLabel, parseInvitePublicPayload } from './validate.js';
import type { InvitePublicPayload, InviteStatusRow } from './types.js';

type Environment = Record<string, unknown>;
type Fetch = typeof fetch;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HASH = /^[0-9a-f]{64}$/u;
const SIGN_SLUGS = new Set([
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
]);

function value(env: Environment, key: string): string {
  const candidate = env[key];
  return typeof candidate === 'string' ? candidate.trim() : '';
}

function supabaseOrigin(env: Environment): string {
  const url = new URL(value(env, 'PUBLIC_SUPABASE_URL'));
  if (url.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS.');
  return url.origin;
}

function serviceHeaders(env: Environment): Record<string, string> {
  const serviceKey = value(env, 'SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
}

async function rpc(
  name: string,
  body: Record<string, unknown>,
  env: Environment,
  fetcher: Fetch,
): Promise<Record<string, unknown>> {
  const response = await fetcher(`${supabaseOrigin(env)}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: serviceHeaders(env),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Compatibility invitation ${name} failed (${response.status})`);
  const result = await response.json() as unknown;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(`Compatibility invitation ${name} returned an invalid state.`);
  }
  return result as Record<string, unknown>;
}

/**
 * The invitation's source chart: the owner's one encrypted v2 self chart,
 * decrypted on the server during the owner's own authenticated request and
 * only when its id is the one the owner chose. public.charts is never read.
 * The account must hold chart_sync, the chart is self-attested, and its birth
 * date must still pass the 18+ gate (which also refuses every under-13
 * chart). The return value is the minimal saved-chart shape the existing
 * derivation reads; it is used in memory and never stored or logged. Only
 * the derived positions and a bounded label reach the invitation.
 */
export async function getOwnedSyncedChartPayload(
  userId: string,
  chartId: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
  nowMs: number = Date.now(),
): Promise<unknown | null> {
  if (!UUID.test(userId) || !UUID.test(chartId)) return null;
  const source = await loadOwnerSelfChartSource(userId, {
    supabaseUrl: value(env, 'PUBLIC_SUPABASE_URL'),
    serviceKey: value(env, 'SUPABASE_SERVICE_ROLE_KEY'),
    fetcher,
  });
  if (!source || source.chartId !== chartId.toLowerCase()) return null;
  const payload = decryptAccountChartSource(source, env);
  if (!payload || !isAdultAccountBirthDate(payload.birth.date, nowMs)) return null;
  const { birth, derived } = payload;
  let utcISO = '';
  if (birth.timeKnown) {
    // A timed chart needs its instant; without a birthplace there is none.
    if (!birth.place || !birth.time) return null;
    const clock = createLocalTimeModule();
    try {
      await clock.prepareLocalTime(birth.date, birth.place.tz);
      utcISO = clock.resolveLocalToUtc(birth.date, birth.time, birth.place.tz, {
        longitude: birth.place.lon,
      }).utc.toISOString();
    } finally {
      clock.dispose();
    }
  }
  return {
    name: payload.label,
    birth: { date: birth.date, timeKnown: birth.timeKnown },
    summary: {
      engineVersion: derived.engineVersion,
      houseSystem: derived.houseSystem,
      utcISO,
      bodies: accountChartBodies(payload),
      angles: derived.positions.a
        ? { asc: derived.positions.a[0], mc: derived.positions.a[1] }
        : null,
    },
  };
}

export type CreateInviteRpcResult =
  | { outcome: 'created'; id: string; expiresAt: string }
  | { outcome: 'invalid' | 'not_found' | 'active_limit' | 'creation_rate_limit' | 'token_conflict' };

export async function createCompatibilityInvite(
  owner: AuthenticatedEmailUser,
  chart: InviteDerivedChart,
  notify: boolean,
  tokenHash: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<CreateInviteRpcResult> {
  if (!UUID.test(owner.id) || !HASH.test(tokenHash)) return { outcome: 'invalid' };
  const result = await rpc('create_compatibility_invite', {
    candidate_owner_user_id: owner.id,
    candidate_label: chart.label,
    candidate_sun_sign: chart.sunSign,
    candidate_positions: chart.positions,
    candidate_time_known: chart.timeKnown,
    candidate_notify_on_complete: notify,
    candidate_token_hash: tokenHash,
  }, env, fetcher);
  if (result.outcome === 'created'
    && typeof result.invite_id === 'string'
    && UUID.test(result.invite_id)
    && typeof result.expires_at === 'string'
    && Number.isFinite(Date.parse(result.expires_at))) {
    return { outcome: 'created', id: result.invite_id, expiresAt: result.expires_at };
  }
  if (result.outcome === 'invalid'
    || result.outcome === 'not_found'
    || result.outcome === 'active_limit'
    || result.outcome === 'creation_rate_limit'
    || result.outcome === 'token_conflict') {
    return { outcome: result.outcome };
  }
  throw new Error('Compatibility invitation creation returned an invalid state.');
}

export async function exchangeCompatibilityInvite(
  tokenHash: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<{ outcome: 'ready'; expiresAt: string } | { outcome: 'unavailable' }> {
  if (!HASH.test(tokenHash)) return { outcome: 'unavailable' };
  const result = await rpc('open_compatibility_invite', {
    candidate_token_hash: tokenHash,
  }, env, fetcher);
  if (result.outcome === 'ready'
    && typeof result.expires_at === 'string'
    && Number.isFinite(Date.parse(result.expires_at))) {
    return { outcome: 'ready', expiresAt: result.expires_at };
  }
  if (result.outcome === 'unavailable') return { outcome: 'unavailable' };
  throw new Error('Compatibility invitation exchange returned an invalid state.');
}

export async function readCompatibilityInvite(
  tokenHash: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<{ outcome: 'ready'; payload: InvitePublicPayload } | { outcome: 'unavailable' }> {
  if (!HASH.test(tokenHash)) return { outcome: 'unavailable' };
  const result = await rpc('read_compatibility_invite', {
    candidate_token_hash: tokenHash,
  }, env, fetcher);
  if (result.outcome === 'unavailable') return { outcome: 'unavailable' };
  if (result.outcome !== 'ready') {
    throw new Error('Compatibility invitation read returned an invalid state.');
  }
  const payload = parseInvitePublicPayload({
    version: 1,
    label: result.label,
    sunSign: result.sun_sign,
    positions: result.positions,
    timeKnown: result.time_known,
    expiresAt: result.expires_at,
  });
  if (!payload) throw new Error('Compatibility invitation read returned an invalid payload.');
  return { outcome: 'ready', payload };
}

export interface CompleteInviteResult {
  outcome: 'completed' | 'duplicate' | 'unavailable';
  inviteId?: string;
  ownerUserId?: string;
  label?: string;
  notify?: boolean;
  completedAt?: string;
}

export async function completeCompatibilityInvite(
  tokenHash: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<CompleteInviteResult> {
  if (!HASH.test(tokenHash)) return { outcome: 'unavailable' };
  const result = await rpc('complete_compatibility_invite', {
    candidate_token_hash: tokenHash,
  }, env, fetcher);
  if (result.outcome === 'unavailable') return { outcome: 'unavailable' };
  if ((result.outcome === 'completed' || result.outcome === 'duplicate')
    && typeof result.invite_id === 'string'
    && UUID.test(result.invite_id)
    && typeof result.owner_user_id === 'string'
    && UUID.test(result.owner_user_id)
    && typeof result.label === 'string'
    && typeof result.notify_on_complete === 'boolean'
    && typeof result.completed_at === 'string'
    && Number.isFinite(Date.parse(result.completed_at))) {
    return {
      outcome: result.outcome,
      inviteId: result.invite_id,
      ownerUserId: result.owner_user_id,
      label: result.label,
      notify: result.notify_on_complete,
      completedAt: result.completed_at,
    };
  }
  throw new Error('Compatibility invitation completion returned an invalid state.');
}

function inviteStatus(value: Record<string, unknown>): InviteStatusRow | null {
  const label = cleanInviteLabel(value.label);
  if (typeof value.id !== 'string'
    || !UUID.test(value.id)
    || !label
    || typeof value.sun_sign !== 'string'
    || !SIGN_SLUGS.has(value.sun_sign)
    || typeof value.status !== 'string'
    || typeof value.created_at !== 'string'
    || !Number.isFinite(Date.parse(value.created_at))
    || typeof value.expires_at !== 'string'
    || !Number.isFinite(Date.parse(value.expires_at))) return null;
  const state = value.status === 'active'
    ? (value.opened_at ? 'opened' : 'waiting')
    : value.status;
  if (state !== 'waiting'
    && state !== 'opened'
    && state !== 'completed'
    && state !== 'revoked'
    && state !== 'expired') return null;
  const closedAt = value.completed_at ?? value.revoked_at ?? value.expired_at ?? null;
  return {
    id: value.id,
    label,
    sunSign: value.sun_sign as InviteStatusRow['sunSign'],
    state,
    createdAt: value.created_at,
    expiresAt: value.expires_at,
    openedAt: typeof value.opened_at === 'string' ? value.opened_at : null,
    closedAt: typeof closedAt === 'string' ? closedAt : null,
    hiddenAt: typeof value.owner_hidden_at === 'string' ? value.owner_hidden_at : null,
  };
}

export async function listCompatibilityInvites(
  ownerUserId: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<InviteStatusRow[]> {
  if (!UUID.test(ownerUserId)) return [];
  const result = await rpc('list_compatibility_invites', {
    candidate_owner_user_id: ownerUserId,
  }, env, fetcher);
  if (result.outcome === 'not_found') return [];
  if (result.outcome !== 'ok' || !Array.isArray(result.invites)) {
    throw new Error('Compatibility invitation list returned an invalid state.');
  }
  const rows = result.invites
    .map((row) => row && typeof row === 'object' && !Array.isArray(row)
      ? inviteStatus(row as Record<string, unknown>)
      : null);
  if (rows.some((row) => row === null)) {
    throw new Error('Compatibility invitation list returned an invalid row.');
  }
  return rows.filter((row): row is InviteStatusRow => row !== null && row.hiddenAt === null);
}

async function ownerAction(
  functionName: 'revoke_compatibility_invite' | 'hide_compatibility_invite',
  ownerUserId: string,
  inviteId: string,
  env: Environment,
  fetcher: Fetch,
): Promise<'ok' | 'active' | 'not_found'> {
  if (!UUID.test(ownerUserId) || !UUID.test(inviteId)) return 'not_found';
  const result = await rpc(functionName, {
    candidate_owner_user_id: ownerUserId,
    candidate_invite_id: inviteId,
  }, env, fetcher);
  if (result.outcome === 'not_found') return 'not_found';
  if (functionName === 'hide_compatibility_invite' && result.outcome === 'hidden') return 'ok';
  if (functionName === 'hide_compatibility_invite' && result.outcome === 'active') return 'active';
  if (functionName === 'revoke_compatibility_invite'
    && (result.outcome === 'revoked'
      || result.outcome === 'expired'
      || result.outcome === 'completed')) return 'ok';
  throw new Error(`Compatibility invitation ${functionName} returned an invalid state.`);
}

export function revokeCompatibilityInvite(
  ownerUserId: string,
  inviteId: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<'ok' | 'active' | 'not_found'> {
  return ownerAction('revoke_compatibility_invite', ownerUserId, inviteId, env, fetcher);
}

export function hideCompatibilityInvite(
  ownerUserId: string,
  inviteId: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<'ok' | 'active' | 'not_found'> {
  return ownerAction('hide_compatibility_invite', ownerUserId, inviteId, env, fetcher);
}

export interface DeliveryReservation {
  outcome: 'reserved' | 'duplicate' | 'skipped' | 'invalid';
  state?: 'reserved' | 'sent' | 'failed';
}

export async function reserveCompatibilityInviteDelivery(
  inviteId: string,
  recipientHash: string,
  claimToken: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<DeliveryReservation> {
  const result = await rpc('reserve_compatibility_invite_delivery', {
    candidate_invite_id: inviteId,
    candidate_recipient_hash: recipientHash,
    candidate_claim_token: claimToken,
  }, env, fetcher);
  if (result.outcome === 'reserved'
    || result.outcome === 'skipped'
    || result.outcome === 'invalid') return { outcome: result.outcome };
  if (result.outcome === 'duplicate'
    && (result.state === 'reserved' || result.state === 'sent' || result.state === 'failed')) {
    return { outcome: 'duplicate', state: result.state };
  }
  throw new Error('Compatibility invitation delivery claim returned an invalid state.');
}

export async function finalizeCompatibilityInviteDelivery(
  inviteId: string,
  claimToken: string,
  outcome: 'sent' | 'failed',
  providerReceipt: string | null,
  providerStatus: number | null,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<'sent' | 'failed' | 'duplicate' | 'unavailable'> {
  const result = await rpc('finalize_compatibility_invite_delivery', {
    candidate_invite_id: inviteId,
    candidate_claim_token: claimToken,
    candidate_outcome: outcome,
    candidate_provider_receipt: providerReceipt,
    candidate_provider_status: providerStatus,
  }, env, fetcher);
  if (result.outcome === 'unavailable') return 'unavailable';
  if (result.outcome === 'duplicate') return 'duplicate';
  if (result.outcome === 'finalized'
    && (result.state === 'sent' || result.state === 'failed')) return result.state;
  throw new Error('Compatibility invitation delivery finalize returned an invalid state.');
}

export async function pruneCompatibilityInvites(
  limit = 64,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<{ expired: number; pruned: number }> {
  const result = await rpc('prune_compatibility_invites', {
    candidate_limit: Math.max(1, Math.min(256, Math.floor(limit))),
  }, env, fetcher);
  if (!Number.isInteger(result.expired)
    || !Number.isInteger(result.pruned)
    || (result.expired as number) < 0
    || (result.pruned as number) < 0) {
    throw new Error('Compatibility invitation prune returned an invalid state.');
  }
  return { expired: result.expired as number, pruned: result.pruned as number };
}
