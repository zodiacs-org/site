/**
 * The inviter's optional "they finished" email, for invites a confirmed
 * signup completed: the same one-shot message, claim and provider receipt as
 * the released completion route (src/lib/invite/routes/invite-complete.ts),
 * which names no recipient, birth detail, result or link.
 */
import { dispatchCompatibilityInviteCompletionEmail } from './email.js';
import type { ConfirmedInvite } from './signup.js';

export async function dispatchConfirmedInvites(invites: readonly ConfirmedInvite[]): Promise<void> {
  for (const invite of invites) {
    if (!invite.notify) continue;
    await dispatchCompatibilityInviteCompletionEmail({ inviteId: invite.inviteId, ownerUserId: invite.ownerUserId, label: invite.label, completedAt: invite.completedAt, notify: true }).catch(() => undefined);
  }
}

/**
 * Called by the daily email's confirmation (api/email/_confirm.ts) once a
 * signup is confirmed: completes the invites staged for that address and
 * sends their inviters' optional emails. Off unless inviteSignupEnabled, and
 * never lets a failure here touch the confirmation the person just made.
 */
export async function completeInviteSignupsForConfirmedEmail(email: string, env: Record<string, unknown> = process.env): Promise<void> {
  const { inviteSignupEnabled, confirmCompatibilityInviteSignups } = await import('./signup.js');
  if (!inviteSignupEnabled(env)) return;
  const { dailySunRecipientHash } = await import('../email/daily-sun-server.js');
  try {
    await dispatchConfirmedInvites(await confirmCompatibilityInviteSignups(dailySunRecipientHash(email, env), env));
  } catch {
    // The confirmation stands; a staged invite simply stays open until it expires.
  }
}
