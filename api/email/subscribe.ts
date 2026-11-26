import { waitUntil } from '@vercel/functions';
import { checkRateLimit } from '@vercel/firewall';
import { createEmailSubscriptionAdapter } from '../../src/lib/email/provider.js';
import { parseEmailSubscription } from '../../src/lib/email/input.js';
import { isAllowedEmailCaptureRequest, requestHeader } from '../../src/lib/email/request.js';
import { emailStatusPage } from '../../src/lib/email/server-page.js';
import { dailyEmailFeatureEnabled, hasDailySunEmailProvider } from '../../src/lib/email/daily-config.js';
import { hasStandaloneWeeklyEmailCapture } from '../../src/lib/email/config.js';
import { dailyEmailPage } from '../../src/lib/email/daily-page.js';
import confirmHandler from './_confirm.js';
import unsubscribeHandler from './_unsubscribe.js';
import birthdayReminderHandler from './_birthday-reminder.js';

function sendJson(res: any, status: number, body: Record<string, string | boolean>): void {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function sendHtml(res: any, status: number, body: string): void {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(body);
}

function wantsJson(req: any): boolean {
  return requestHeader(req, 'accept').includes('application/json');
}

/** Uses Vercel's per-region firewall counters; the matching WAF rule must use this exported ID. */
export const EMAIL_SUBSCRIBE_RATE_LIMIT_ID = 'zodiacs-email-subscribe';

type SubscribeRateLimitState = 'allowed' | 'limited' | 'unavailable';

async function subscribeRateLimitState(req: any): Promise<SubscribeRateLimitState> {
  try {
    const result = await checkRateLimit(EMAIL_SUBSCRIBE_RATE_LIMIT_ID, { headers: req.headers });
    if (result?.error === 'not-found') return 'unavailable';
    if (result?.rateLimited === true) return 'limited';
    if (result?.rateLimited === false) return 'allowed';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

// The daily path holds a durable per-recipient confirmation claim; the weekly
// path has no store of its own (the daily claim is purpose-bound), so a
// per-instance recipient cooldown absorbs scripted same-address bursts and
// spares provider send quota. Cold starts reset it — the firewall counter
// above is the cross-instance line. Insertion order doubles as an LRU bound.
const WEEKLY_COOLDOWN_MS = 10 * 60_000;
const WEEKLY_COOLDOWN_MAX_ENTRIES = 5_000;
const weeklyCooldown = new Map<string, number>();

function weeklyCooldownKey(email: string): string {
  return email.trim().toLowerCase();
}

export function weeklyRecipientOnCooldown(email: string, now = Date.now()): boolean {
  const key = weeklyCooldownKey(email);
  const last = weeklyCooldown.get(key);
  if (last !== undefined && now - last < WEEKLY_COOLDOWN_MS) return true;
  weeklyCooldown.delete(key);
  weeklyCooldown.set(key, now);
  if (weeklyCooldown.size > WEEKLY_COOLDOWN_MAX_ENTRIES) {
    const oldest = weeklyCooldown.keys().next().value;
    if (oldest !== undefined) weeklyCooldown.delete(oldest);
  }
  return false;
}

function releaseWeeklyRecipientCooldown(email: string, claimedAt: number): void {
  const key = weeklyCooldownKey(email);
  if (weeklyCooldown.get(key) === claimedAt) weeklyCooldown.delete(key);
}

export async function handleEmailSubscribe(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'method' });
    return;
  }
  if (!isAllowedEmailCaptureRequest(req)) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }
  const rateLimitState = await subscribeRateLimitState(req);
  if (rateLimitState === 'unavailable') {
    if (wantsJson(req)) sendJson(res, 503, { error: 'unavailable' });
    else sendHtml(res, 503, emailStatusPage('en', 'emailCaptureErrorTitle', 'emailCaptureError'));
    return;
  }
  if (rateLimitState === 'limited') {
    res.setHeader('Retry-After', '60');
    sendJson(res, 429, { error: 'rate_limited' });
    return;
  }

  const input = parseEmailSubscription(req.body);
  if (!input) {
    if (wantsJson(req)) sendJson(res, 400, { error: 'invalid' });
    else sendHtml(res, 400, emailStatusPage('en', 'emailCaptureErrorTitle', 'emailCaptureError'));
    return;
  }

  const daily = dailyEmailFeatureEnabled(process.env) && input.locale === 'en';
  if (daily && !input.sign) {
    if (wantsJson(req)) sendJson(res, 400, { error: 'sign_required' });
    else sendHtml(res, 400, dailyEmailPage('Choose your sign', 'A sign is needed for the daily horoscope.'));
    return;
  }

  if (daily && !hasDailySunEmailProvider(process.env)) {
    if (wantsJson(req)) sendJson(res, 503, { error: 'disabled' });
    else sendHtml(res, 503, dailyEmailPage('Not available yet', 'Daily email is not ready to join just yet.'));
    return;
  }

  if (!daily && !hasStandaloneWeeklyEmailCapture(process.env)) {
    if (wantsJson(req)) sendJson(res, 503, { error: 'disabled' });
    else sendHtml(res, 503, emailStatusPage(input.locale, 'emailCaptureErrorTitle', 'emailCaptureError'));
    return;
  }

  const adapter = createEmailSubscriptionAdapter(process.env, fetch, input.locale);
  if (!adapter) {
    if (wantsJson(req)) sendJson(res, 503, { error: 'disabled' });
    else sendHtml(res, 503, emailStatusPage(input.locale, 'emailCaptureErrorTitle', 'emailCaptureError'));
    return;
  }

  // Daily DOI dispatch continues inside the Vercel request lifecycle without
  // delaying the public response. This keeps active, pending, throttled, and
  // new addresses indistinguishable at the HTTP boundary. The durable
  // recipient cooldown prevents background requests from becoming an email
  // flooding or token-churn path.
  if (daily) {
    if (!input.honeypot) {
      waitUntil(adapter.subscribe(input.email, input.sign).then(
        () => undefined,
        () => undefined,
      ));
    }
    if (wantsJson(req)) sendJson(res, 200, { ok: true, pending: true });
    else sendHtml(res, 200, dailyEmailPage(
      'You’re set.',
      'If confirmation or a change is needed, check your inbox. Nothing changes until you confirm it.',
    ));
    return;
  }

  try {
    // A filled hidden field is treated as a successful no-op, and so is a
    // recipient inside the weekly cooldown window — throttled, new, and
    // known addresses stay indistinguishable at the HTTP boundary. Only the
    // email and optional self-declared sign ever cross the provider boundary.
    if (!input.honeypot) {
      const claimedAt = Date.now();
      if (!weeklyRecipientOnCooldown(input.email, claimedAt)) {
        try {
          await adapter.subscribe(input.email, input.sign);
        } catch (error) {
          // A provider failure did not consume send quota, so it must not make
          // a genuine retry look successful while suppressing confirmation.
          // Delete only this request's claim in case a later claim replaced it.
          releaseWeeklyRecipientCooldown(input.email, claimedAt);
          throw error;
        }
      }
    }
    if (wantsJson(req)) sendJson(res, 200, { ok: true, pending: true });
    else sendHtml(res, 200, emailStatusPage(input.locale, 'emailPendingTitle', 'emailPendingBody'));
  } catch {
    if (wantsJson(req)) sendJson(res, 502, { error: 'unavailable' });
    else sendHtml(res, 502, emailStatusPage(input.locale, 'emailCaptureErrorTitle', 'emailCaptureError'));
  }
}

export function emailLifecycleRoute(req: any): 'subscribe' | 'confirm' | 'unsubscribe' | 'birthday-reminder' | 'invalid' {
  const route = req?.query?.__zodiacs_email_route;
  if (route === undefined) return 'subscribe';
  if (route === 'confirm' || route === 'unsubscribe' || route === 'birthday-reminder') return route;
  return 'invalid';
}

export default async function handler(req: any, res: any): Promise<void> {
  const route = emailLifecycleRoute(req);
  if (route === 'confirm') {
    await confirmHandler(req, res);
    return;
  }
  if (route === 'unsubscribe') {
    await unsubscribeHandler(req, res);
    return;
  }
  if (route === 'birthday-reminder') {
    // Off, and answering 404, unless BIRTHDAY_REMINDER_ENABLED=1 (src/lib/birthday-reminder/config.ts).
    await birthdayReminderHandler(req, res);
    return;
  }
  if (route === 'invalid') {
    sendJson(res, 404, { error: 'route' });
    return;
  }
  await handleEmailSubscribe(req, res);
}
