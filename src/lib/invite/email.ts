import { createHmac, randomUUID } from 'node:crypto';
import { createRateLimitedResendRequest } from '../daily-email/resend-request.js';
import { getAdminEmailUser } from '../email/daily-server.js';
import {
  finalizeCompatibilityInviteDelivery,
  reserveCompatibilityInviteDelivery,
} from './server.js';

type Environment = Record<string, unknown>;
type Fetch = typeof fetch;

function value(env: Environment, key: string): string {
  const candidate = env[key];
  return typeof candidate === 'string' ? candidate.trim() : '';
}
function escapeHtml(input: string): string {
  return input
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function displayDate(instant: string): string {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error('Completion time is invalid.');
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date).toUpperCase();
}

function safeLabel(input: string): string {
  const label = input
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return Array.from(label).slice(0, 24).join('') || 'your chart';
}

export interface InviteCompletionEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderCompatibilityInviteCompletionEmail(
  labelInput: string,
  completedAt: string,
): InviteCompletionEmail {
  const label = safeLabel(labelInput);
  const date = displayDate(completedAt);
  const compatibilityUrl = 'https://zodiacs.org/compatibility/';
  const invitationsUrl = 'https://zodiacs.org/profile/#compat-invites';
  const text = [
    `COMPATIBILITY INVITATION · ${date}`,
    '',
    `The invitation carrying your side as ${label} was opened, and the reading happened just now, on their device, where it stays.`,
    '',
    'The link has closed, and the positions it carried are deleted.',
    '',
    "There's nothing to show you here, and that's on purpose. The reading never touched us. On their result there's a button that sends it back: a picture of the reading and a private link that carries chart positions and labels, with no birth details. Ask them for it.",
    '',
    `Open the compatibility page: ${compatibilityUrl}`,
    '',
    'You asked for one email when this invitation was read. This is it. Nothing recurring, nothing else to manage.',
    `Your invitations: ${invitationsUrl}`,
  ].join('\n');
  const safe = escapeHtml(label);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Your invitation was read</title>
</head>
<body style="margin:0;background:#060709;color:#C6CCDA;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">The reading happened on their device. Ask them to send it back.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#060709;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border:1px solid #242936;background:#0A0C10;">
        <tr><td style="padding:24px 24px 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="color:#7A8397;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;">COMPATIBILITY INVITATION · ${date}</td>
              <td align="right" style="color:#EEF1F7;font:600 13px/1 Georgia,serif;letter-spacing:.12em;">ZODIACS.ORG</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:12px 24px 28px;color:#EEF1F7;font:22px/1.55 Georgia,'Times New Roman',serif;">
          <p style="margin:0 0 20px;">The invitation carrying your side as ${safe} was opened, and the reading happened just now, on their device, where it stays.</p>
          <p style="margin:0 0 20px;">The link has closed, and the positions it carried are deleted.</p>
          <p style="margin:0;">There&#39;s nothing to show you here, and that&#39;s on purpose. The reading never touched us. On their result there&#39;s a button that sends it back: a picture of the reading and a private link that carries chart positions and labels, with no birth details. Ask them for it.</p>
        </td></tr>
        <tr><td style="padding:0 24px 28px;">
          <a href="${compatibilityUrl}" style="display:block;padding:15px 18px;border-radius:999px;background:#EEF1F7;color:#10131A;font:600 15px/1.2 Arial,Helvetica,sans-serif;text-align:center;text-decoration:none;">Open the compatibility page</a>
        </td></tr>
        <tr><td style="padding:20px 24px 24px;border-top:1px solid #242936;color:#7A8397;font:12px/1.6 Arial,Helvetica,sans-serif;">
          You asked for one email when this invitation was read. This is it. Nothing recurring, nothing else to manage.<br>
          <a href="${invitationsUrl}" style="color:#C6CCDA;text-decoration:underline;">Your invitations</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject: 'Your invitation was read', html, text };
}

export function compatibilityInviteRecipientHash(
  email: string,
  env: Environment = process.env,
): string {
  const secret = value(env, 'COMPAT_INVITE_RECIPIENT_HASH_SECRET');
  if (secret.length < 32) {
    throw new Error('COMPAT_INVITE_RECIPIENT_HASH_SECRET must be at least 32 characters.');
  }
  return createHmac('sha256', secret).update(email.trim().toLowerCase(), 'utf8').digest('hex');
}

export type InviteCompletionDispatch =
  | { outcome: 'sent'; providerReceipt: string }
  | { outcome: 'duplicate' | 'skipped' | 'failed' };

export async function dispatchCompatibilityInviteCompletionEmail(
  input: {
    inviteId: string;
    ownerUserId: string;
    label: string;
    completedAt: string;
    notify: boolean;
  },
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<InviteCompletionDispatch> {
  if (!input.notify) return { outcome: 'skipped' };
  const owner = await getAdminEmailUser(input.ownerUserId, env, fetcher);
  if (!owner) return { outcome: 'skipped' };
  const claimToken = randomUUID();
  const recipientHash = compatibilityInviteRecipientHash(owner.email, env);
  const claim = await reserveCompatibilityInviteDelivery(
    input.inviteId,
    recipientHash,
    claimToken,
    env,
    fetcher,
  );
  if (claim.outcome === 'duplicate') return { outcome: 'duplicate' };
  if (claim.outcome !== 'reserved') return { outcome: 'skipped' };

  const message = renderCompatibilityInviteCompletionEmail(input.label, input.completedAt);
  let providerReceipt: string | null = null;
  let providerStatus: number | null = null;
  try {
    const apiKey = value(env, 'RESEND_API_KEY');
    const from = value(env, 'RESEND_FROM_EMAIL');
    if (!apiKey || !from) throw new Error('Completion email provider is not configured.');
    const request = createRateLimitedResendRequest(fetcher);
    const response = await request('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `compat-invite-${input.inviteId}`,
      },
      body: JSON.stringify({
        from,
        to: [owner.email],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    providerStatus = response.status;
    const body = await response.json().catch(() => null) as { id?: unknown } | null;
    if (!response.ok
      || !body
      || typeof body.id !== 'string'
      || !/^[A-Za-z0-9_-]{4,128}$/u.test(body.id)) {
      throw new Error(`Resend completion email failed (${response.status})`);
    }
    providerReceipt = body.id;
    await finalizeCompatibilityInviteDelivery(
      input.inviteId,
      claimToken,
      'sent',
      providerReceipt,
      providerStatus,
      env,
      fetcher,
    );
    return { outcome: 'sent', providerReceipt };
  } catch {
    await finalizeCompatibilityInviteDelivery(
      input.inviteId,
      claimToken,
      'failed',
      providerReceipt,
      providerStatus,
      env,
      fetcher,
    ).catch(() => undefined);
    return { outcome: 'failed' };
  }
}
