/**
 * Compatibility invites: consent on both sides, recorded by policy version.
 *
 * Recorded only while INVITE_SIGNUP_ENABLED=1 joins the released invite
 * contract (src/lib/invite/config.ts) and the daily email's double opt-in
 * (src/lib/email/daily-config.ts). An invite completes when its recipient's
 * reading is made, exactly as the released completion does; the daily email
 * offered afterwards is a separate opt-in through the public subscribe route,
 * with no link to the invite.
 *
 * The page sends the version of the text it showed (src/lib/invite/consent.ts)
 * and a row is written only for a known version: the inviter's when the invite
 * is created, the recipient's when their reading completes it
 * (supabase/migrations/20261109120000_compat_invite_signups.sql).
 *
 * Nothing here receives or stores a birth date, time, place, position, name or
 * address. No logging.
 */
import { hasCompatibilityInviteContract } from './config.js';
import { knownConsentVersion } from './consent.js';
import { hasDailySunEmailProvider } from '../email/daily-config.js';

export { INVITER_CONSENT_VERSION, RECIPIENT_CONSENT_VERSION } from './consent.js';

type Environment = Record<string, unknown>;
type Fetch = typeof fetch;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const INVITE_SIGNUP_SWITCH = 'INVITE_SIGNUP_ENABLED';
export const PUBLIC_INVITE_SIGNUP_SWITCH = 'PUBLIC_INVITE_SIGNUP_ENABLED';

const read = (env: Environment, key: string) => (typeof env[key] === 'string' ? (env[key] as string).trim() : '');

/**
 * Exactly '1', untrimmed, with the invite contract and the daily email's
 * double opt-in in place. A padded value such as ' 1' leaves the switch off.
 */
export function inviteSignupEnabled(env: Environment = process.env): boolean {
  return env[INVITE_SIGNUP_SWITCH] === '1' && hasCompatibilityInviteContract(env) && hasDailySunEmailProvider(env);
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
  if (!response.ok) throw new Error(`Compatibility invite consent ${name} failed (${response.status})`);
  const result = await response.json() as unknown;
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(`Compatibility invite consent ${name} returned an invalid state.`);
  return result as Record<string, unknown>;
}

/**
 * Record the inviter's consent against the invite they just created, with the
 * version their page sent. Nothing is recorded while the switch is off, or for
 * a version the page never showed.
 */
export async function recordInviterConsent(inviteId: string, ownerUserId: string, version: unknown, env: Environment = process.env, fetcher: Fetch = fetch): Promise<boolean> {
  if (!inviteSignupEnabled(env) || !knownConsentVersion('inviter', version) || !UUID.test(inviteId) || !UUID.test(ownerUserId)) return false;
  const result = await rpc('record_compatibility_invite_inviter_consent', { candidate_invite_id: inviteId, candidate_owner_user_id: ownerUserId, candidate_policy_version: version }, env, fetcher);
  return result.outcome === 'recorded';
}

/**
 * Record the recipient's consent against the invite their reading just
 * completed, with the version their page sent. The invite id comes from the
 * completion itself, never from the request. Same conditions as the inviter's.
 */
export async function recordRecipientConsent(inviteId: string, version: unknown, env: Environment = process.env, fetcher: Fetch = fetch): Promise<boolean> {
  if (!inviteSignupEnabled(env) || !knownConsentVersion('recipient', version) || !UUID.test(inviteId)) return false;
  const result = await rpc('record_compatibility_invite_recipient_consent', { candidate_invite_id: inviteId, candidate_policy_version: version }, env, fetcher);
  return result.outcome === 'recorded';
}
