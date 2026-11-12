/**
 * Compatibility invites: a completed invite is a confirmed opt-in signup.
 *
 * Offered only while INVITE_SIGNUP_ENABLED=1 joins the released invite
 * contract (src/lib/invite/config.ts) and the daily email's double opt-in
 * (src/lib/email/daily-config.ts). The person who received an invite sees
 * their result first, with nothing asked of them. They may then ask for their
 * own daily horoscope by email; that request goes through the same double
 * opt-in as every daily signup on the site, and stages the invite against a
 * keyed hash of their address. Their confirmation click completes the invite
 * (supabase/migrations/20261109120000_compat_invite_signups.sql), so every
 * completed invite is a confirmed signup. Without one it stays open until it
 * expires.
 *
 * Nothing here receives or stores a birth date, time, place, position or
 * name; the address reaches only the email provider, as on any daily signup.
 * No logging.
 */
import { hasCompatibilityInviteContract } from './config.js';
import { hasDailySunEmailProvider } from '../email/daily-config.js';

type Environment = Record<string, unknown>;
type Fetch = typeof fetch;

const HASH = /^[0-9a-f]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const INVITE_SIGNUP_SWITCH = 'INVITE_SIGNUP_ENABLED';
export const PUBLIC_INVITE_SIGNUP_SWITCH = 'PUBLIC_INVITE_SIGNUP_ENABLED';

const read = (env: Environment, key: string) => (typeof env[key] === 'string' ? (env[key] as string).trim() : '');

/** Exactly '1', with the invite contract and the daily email's double opt-in in place. */
export function inviteSignupEnabled(env: Environment = process.env): boolean {
  return read(env, INVITE_SIGNUP_SWITCH) === '1' && hasCompatibilityInviteContract(env) && hasDailySunEmailProvider(env);
}

async function rpc(name: string, body: Record<string, unknown>, env: Environment, fetcher: Fetch): Promise<Record<string, unknown>> {
  const origin = new URL(read(env, 'PUBLIC_SUPABASE_URL'));
  if (origin.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS.');
  const key = read(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetcher(`${origin.origin}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Compatibility invite signup ${name} failed (${response.status})`);
  const result = await response.json() as unknown;
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(`Compatibility invite signup ${name} returned an invalid state.`);
  return result as Record<string, unknown>;
}

/** Stage a signup against the invite whose capability the request holds. Only hashes cross this boundary. */
export async function stageCompatibilityInviteSignup(tokenHash: string, recipientHash: string, env: Environment = process.env, fetcher: Fetch = fetch): Promise<'staged' | 'unavailable'> {
  if (!HASH.test(tokenHash) || !HASH.test(recipientHash)) return 'unavailable';
  const result = await rpc('stage_compatibility_invite_signup', { candidate_token_hash: tokenHash, candidate_recipient_hash: recipientHash }, env, fetcher);
  if (result.outcome === 'staged' || result.outcome === 'unavailable') return result.outcome;
  throw new Error('Compatibility invite signup staging returned an invalid state.');
}

export interface ConfirmedInvite {
  inviteId: string;
  ownerUserId: string;
  label: string;
  notify: boolean;
  completedAt: string;
}

/** Complete every still-active invite staged for a recipient who has just confirmed. */
export async function confirmCompatibilityInviteSignups(recipientHash: string, env: Environment = process.env, fetcher: Fetch = fetch): Promise<ConfirmedInvite[]> {
  if (!HASH.test(recipientHash)) return [];
  const result = await rpc('confirm_compatibility_invite_signups', { candidate_recipient_hash: recipientHash }, env, fetcher);
  if (!Array.isArray(result.completed)) throw new Error('Compatibility invite signup confirmation returned an invalid state.');
  return result.completed.flatMap((row: unknown) => {
    const value = row as Record<string, unknown> | null;
    if (!value || typeof value.invite_id !== 'string' || !UUID.test(value.invite_id) || typeof value.owner_user_id !== 'string' || !UUID.test(value.owner_user_id)
      || typeof value.label !== 'string' || typeof value.notify_on_complete !== 'boolean' || typeof value.completed_at !== 'string' || !Number.isFinite(Date.parse(value.completed_at))) return [];
    return [{ inviteId: value.invite_id, ownerUserId: value.owner_user_id, label: value.label, notify: value.notify_on_complete, completedAt: value.completed_at }];
  });
}

/** The text the inviter agrees to on the invite panel, by version (src/islands/synastry/InviteExperience.tsx). */
export const INVITER_CONSENT_VERSION = 'invite-inviter-2026-11-09.v1';
/** The text the recipient agrees to before their signup (src/islands/synastry/InviteSignup.tsx); the database stages it. */
export const RECIPIENT_CONSENT_VERSION = 'invite-recipient-2026-11-09.v1';

/** Record the inviter's consent against the invite they just created. Off unless inviteSignupEnabled. */
export async function recordInviterConsent(inviteId: string, ownerUserId: string, env: Environment = process.env, fetcher: Fetch = fetch): Promise<boolean> {
  if (!inviteSignupEnabled(env) || !UUID.test(inviteId) || !UUID.test(ownerUserId)) return false;
  const result = await rpc('record_compatibility_invite_inviter_consent', { candidate_invite_id: inviteId, candidate_owner_user_id: ownerUserId, candidate_policy_version: INVITER_CONSENT_VERSION }, env, fetcher);
  return result.outcome === 'recorded';
}
