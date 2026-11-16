/**
 * Compatibility invites: the consent each side gave, named by the version of
 * the text the page showed them. Shared by the page, which sends the version
 * it showed, and the server, which records a version only when it is one of
 * these. An unknown or missing version is never recorded, so a consent row
 * always names text somebody saw. Recorded only while INVITE_SIGNUP_ENABLED=1
 * (src/lib/invite/signup.ts).
 *
 * A change to either text needs a new version here, in the allowlist, and in
 * the database's own allowlist
 * (supabase/migrations/20261109120000_compat_invite_signups.sql).
 */

/**
 * The inviter's invite panel with PUBLIC_INVITE_SIGNUP_ENABLED=1
 * (src/islands/synastry/InviteExperience.tsx): "This is my own chart, and I
 * agree to share its positions with whoever opens the link", with the
 * released terms (one person; it closes once their reading is made, and after
 * 14 days at the latest).
 */
export const INVITER_CONSENT_VERSION = 'invite-inviter-2026-11-16.v1';

/**
 * The recipient's check before anything is worked out, with
 * PUBLIC_INVITE_SIGNUP_ENABLED=1 (src/islands/SynastryCalculator.tsx):
 * "These are my own birth details, and I am 13 or older." Recorded when their
 * reading completes the invite. It says nothing about any email.
 */
export const RECIPIENT_CONSENT_VERSION = 'invite-recipient-2026-11-16.v1';

export const KNOWN_INVITER_CONSENT_VERSIONS: readonly string[] = Object.freeze([INVITER_CONSENT_VERSION]);
export const KNOWN_RECIPIENT_CONSENT_VERSIONS: readonly string[] = Object.freeze([RECIPIENT_CONSENT_VERSION]);

export type ConsentParty = 'inviter' | 'recipient';

/** True only for a version this site has shown to that party. */
export function knownConsentVersion(party: ConsentParty, version: unknown): version is string {
  const known = party === 'inviter' ? KNOWN_INVITER_CONSENT_VERSIONS : KNOWN_RECIPIENT_CONSENT_VERSIONS;
  return typeof version === 'string' && known.includes(version);
}
