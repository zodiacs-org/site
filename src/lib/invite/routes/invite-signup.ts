/**
 * POST /api/compatibility/invite-signup?session={handle}
 *
 * The person who received an invite asks for their own daily horoscope by
 * email, after seeing their result. Offered only while inviteSignupEnabled
 * (src/lib/invite/signup.ts); otherwise 404, as every invite route answers
 * when its contract is missing.
 *
 * The body is exactly { email, sign, consent: true, adult: true }: the
 * address, their own Sun sign for the daily email, the opt-in they ticked,
 * and the page's own check that their birth date is 18 or more years ago
 * (worked out in their browser; the date itself never leaves it). Any other
 * field, a birth detail included, is refused. The address goes to the email
 * provider through the site's existing double opt-in and is otherwise kept
 * only as a keyed hash. The invite completes when they confirm; an address
 * already confirmed for the daily email completes it at once. The answer is
 * the same for new, pending and confirmed addresses. No logging.
 */
import { waitUntil } from '@vercel/functions';
import { checkRateLimit } from '@vercel/firewall';
import { allowInviteMethods, sendInviteJson, validInviteBrowserRequest } from '../api.js';
import { inviteCapabilityCookie, inviteSessionHandle } from '../request.js';
import { compatibilityInviteTokenHash } from '../token.js';
import { confirmCompatibilityInviteSignups, inviteSignupEnabled, stageCompatibilityInviteSignup } from '../signup.js';
import { dispatchConfirmedInvites } from '../signup-notify.js';
import { normalizeEmail } from '../../email/input.js';
import { createEmailSubscriptionAdapter } from '../../email/provider.js';
import { dailySunRecipientHash, getDailySunPreference } from '../../email/daily-sun-server.js';
import { SIGN_SLUGS } from '../../signs.js';

/** The daily signup's own firewall rule: an invite signup is a daily signup. */
const RATE_LIMIT_ID = 'zodiacs-email-subscribe';
const KEYS = 'adult,consent,email,sign';

export interface InviteSignupInput { email: string; sign: string }

/** The exact body, or null. Nothing beyond the four keys is accepted. */
export function parseInviteSignup(body: unknown): InviteSignupInput | null {
  let value = body;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== KEYS) return null;
  if (record.consent !== true || record.adult !== true) return null;
  const email = normalizeEmail(record.email);
  if (!email || typeof record.sign !== 'string' || !SIGN_SLUGS.includes(record.sign)) return null;
  return { email, sign: record.sign };
}

async function rateLimited(req: any): Promise<'allowed' | 'limited' | 'unavailable'> {
  try {
    const result = await checkRateLimit(RATE_LIMIT_ID, { headers: req.headers });
    if (result?.rateLimited === true) return 'limited';
    if (result?.rateLimited === false) return 'allowed';
    return 'unavailable';
  } catch { return 'unavailable'; }
}

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
  if (!inviteSignupEnabled(process.env)) {
    sendInviteJson(res, 404, { error: 'not_found' });
    return;
  }
  const limit = await rateLimited(req);
  if (limit !== 'allowed') {
    if (limit === 'limited') res.setHeader('Retry-After', '60');
    sendInviteJson(res, limit === 'limited' ? 429 : 503, { error: limit === 'limited' ? 'rate_limited' : 'unavailable' });
    return;
  }
  const input = parseInviteSignup(req.body);
  if (!input) {
    sendInviteJson(res, 400, { error: 'invalid_request' });
    return;
  }
  const handle = inviteSessionHandle(req);
  const tokenHash = handle ? compatibilityInviteTokenHash(inviteCapabilityCookie(req, handle)) : '';
  if (!tokenHash) {
    sendInviteJson(res, 200, { outcome: 'unavailable' });
    return;
  }
  try {
    const recipientHash = dailySunRecipientHash(input.email);
    if (await stageCompatibilityInviteSignup(tokenHash, recipientHash) === 'unavailable') {
      sendInviteJson(res, 200, { outcome: 'unavailable' });
      return;
    }
    // An address already confirmed for the daily email has opted in: the invite completes now.
    // Every other address gets the daily email's own confirmation, and the invite completes on its click.
    const confirmed = await getDailySunPreference(recipientHash);
    const adapter = createEmailSubscriptionAdapter(process.env, fetch, 'en');
    waitUntil((async () => {
      if (confirmed) await dispatchConfirmedInvites(await confirmCompatibilityInviteSignups(recipientHash));
      else if (adapter) await adapter.subscribe(input.email, input.sign);
    })().catch(() => undefined));
    sendInviteJson(res, 200, { outcome: 'pending' });
  } catch {
    sendInviteJson(res, 503, { error: 'unavailable' });
  }
}
