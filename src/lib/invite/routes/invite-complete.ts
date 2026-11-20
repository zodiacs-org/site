import { waitUntil } from '@vercel/functions';
import {
  allowInviteMethods,
  sendInviteJson,
  validInviteBrowserRequest,
} from '../api.js';
import { hasCompatibilityInviteContract } from '../config.js';
import { dispatchCompatibilityInviteCompletionEmail } from '../email.js';
import {
  clearInviteCapabilityCookie,
  inviteCapabilityCookie,
  inviteSessionHandle,
} from '../request.js';
import { completeCompatibilityInvite } from '../server.js';
import { compatibilityInviteTokenHash } from '../token.js';
import { recordRecipientConsent } from '../signup.js';
import { parseCompleteInviteBody } from '../validate.js';

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    allowInviteMethods(res, ['POST']);
    sendInviteJson(res, 405, { error: 'method' });
    return;
  }
  if (!validInviteBrowserRequest(req, true)) {
    sendInviteJson(res, 403, { error: 'forbidden' });
    return;
  }
  if (!hasCompatibilityInviteContract(process.env)) {
    sendInviteJson(res, 404, { error: 'not_found' });
    return;
  }
  const input = parseCompleteInviteBody(req.body);
  if (!input) {
    sendInviteJson(res, 400, { error: 'invalid_request' });
    return;
  }
  const handle = inviteSessionHandle(req);
  if (!handle) {
    sendInviteJson(res, 200, { outcome: 'unavailable', notification: 'skipped' });
    return;
  }
  const hash = compatibilityInviteTokenHash(inviteCapabilityCookie(req, handle));
  if (!hash) {
    res.setHeader('Set-Cookie', clearInviteCapabilityCookie(handle));
    sendInviteJson(res, 200, { outcome: 'unavailable', notification: 'skipped' });
    return;
  }
  try {
    const result = await completeCompatibilityInvite(hash);
    res.setHeader('Set-Cookie', clearInviteCapabilityCookie(handle));
    if (result.outcome === 'unavailable') {
      sendInviteJson(res, 200, { outcome: 'unavailable', notification: 'skipped' });
      return;
    }
    const shouldNotify = Boolean(
      result.notify
      && result.inviteId
      && result.ownerUserId
      && result.label
      && result.completedAt,
    );
    // With INVITE_SIGNUP_ENABLED=1, the recipient's consent is recorded against the invite their reading just
    // completed, and only for a known version of the text their page showed (src/lib/invite/consent.ts).
    if (input.consentVersion && result.inviteId) {
      await recordRecipientConsent(result.inviteId, input.consentVersion).catch(() => undefined);
    }
    if (shouldNotify) {
      waitUntil(dispatchCompatibilityInviteCompletionEmail({
        inviteId: result.inviteId!,
        ownerUserId: result.ownerUserId!,
        label: result.label!,
        completedAt: result.completedAt!,
        notify: true,
      }).then(() => undefined));
    }
    sendInviteJson(res, 200, {
      outcome: result.outcome,
      notification: shouldNotify ? 'queued' : 'skipped',
    });
  } catch {
    sendInviteJson(res, 503, { error: 'unavailable' });
  }
}
