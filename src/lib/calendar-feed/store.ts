/**
 * The feed store: four service-role RPCs in the site's Supabase project
 * (supabase/migrations/20260929180000_calendar_feeds.sql), reached with the
 * same environment variables as the compatibility invitations. Errors carry
 * the RPC's name and HTTP status only, never a request body.
 */
import { feedPositionsFromRecord, type CalendarFeedPositions } from './positions.js';

type Environment = Record<string, unknown>;
type Fetch = typeof fetch;

const RPC_TIMEOUT_MS = 5_000;
const HASH = /^[0-9a-f]{64}$/u;

function value(env: Environment, key: string): string {
  const candidate = env[key];
  return typeof candidate === 'string' ? candidate.trim() : '';
}

export function hasCalendarFeedStore(env: Environment = process.env): boolean {
  const serviceKey = value(env, 'SUPABASE_SERVICE_ROLE_KEY');
  try {
    return new URL(value(env, 'PUBLIC_SUPABASE_URL')).protocol === 'https:' && serviceKey.length >= 16;
  } catch {
    return false;
  }
}

/** The bearer secret the scheduled sweep presents; empty when not provisioned. */
export function calendarFeedSweepSecret(env: Environment = process.env): string {
  const secret = value(env, 'CALENDAR_FEED_SWEEP_SECRET');
  return secret.length >= 32 ? secret : '';
}

/**
 * A feed is made only where it can also be deleted: the store is configured
 * and so is the secret the daily sweep uses to delete feeds after 12 months
 * without a fetch. Serving and removing existing feeds need only the store.
 */
export function canCreateCalendarFeeds(env: Environment = process.env): boolean {
  return hasCalendarFeedStore(env) && calendarFeedSweepSecret(env) !== '';
}

async function rpc(
  name: string,
  body: Record<string, unknown>,
  env: Environment,
  fetcher: Fetch,
): Promise<Record<string, unknown>> {
  const url = new URL(value(env, 'PUBLIC_SUPABASE_URL'));
  if (url.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS.');
  const serviceKey = value(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetcher(`${url.origin}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Calendar feed ${name} failed (${response.status})`);
  const result = await response.json() as unknown;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(`Calendar feed ${name} returned an invalid state.`);
  }
  return result as Record<string, unknown>;
}

/**
 * 'busy' means the database refused the feed because 500 feeds were made in
 * the last hour, for all visitors together.
 */
export async function createCalendarFeedRecord(
  id: string,
  secretHash: string,
  positions: CalendarFeedPositions,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<'created' | 'invalid' | 'id_conflict' | 'busy'> {
  if (!HASH.test(secretHash)) return 'invalid';
  const result = await rpc('create_calendar_feed', {
    candidate_id: id,
    candidate_secret_hash: secretHash,
    candidate_planets: positions.planets,
    candidate_ascendant: positions.ascendant,
    candidate_midheaven: positions.midheaven,
  }, env, fetcher);
  if (result.outcome === 'created' && result.id === id) return 'created';
  if (result.outcome === 'invalid' || result.outcome === 'id_conflict' || result.outcome === 'busy') {
    return result.outcome;
  }
  throw new Error('Calendar feed creation returned an invalid state.');
}

/** A feed's positions, noting the fetch; null when the id is unknown or removed. */
export async function fetchCalendarFeedRecord(
  id: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<CalendarFeedPositions | null> {
  const result = await rpc('fetch_calendar_feed', { candidate_id: id }, env, fetcher);
  if (result.outcome === 'not_found') return null;
  const positions = result.outcome === 'ready' ? feedPositionsFromRecord(result) : null;
  if (!positions) throw new Error('Calendar feed fetch returned an invalid state.');
  return positions;
}

export async function revokeCalendarFeedRecord(
  id: string,
  secretHash: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<'revoked' | 'not_found'> {
  if (!HASH.test(secretHash)) return 'not_found';
  const result = await rpc('revoke_calendar_feed', {
    candidate_id: id,
    candidate_secret_hash: secretHash,
  }, env, fetcher);
  if (result.outcome === 'revoked' || result.outcome === 'not_found') return result.outcome;
  throw new Error('Calendar feed removal returned an invalid state.');
}

export async function pruneCalendarFeedRecords(
  limit = 256,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<number> {
  const result = await rpc('prune_calendar_feeds', {
    candidate_limit: Math.max(1, Math.min(1024, Math.floor(limit))),
  }, env, fetcher);
  if (!Number.isInteger(result.pruned) || (result.pruned as number) < 0) {
    throw new Error('Calendar feed prune returned an invalid state.');
  }
  return result.pruned as number;
}
