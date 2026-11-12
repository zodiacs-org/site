// Bundled by the public email lifecycle entrypoint (api/email/subscribe.ts); not a standalone Function.
// The birthday reminder (src/lib/birthday-reminder/): a sign-up (POST JSON), its confirmation, and the way out.
// Off unless BIRTHDAY_REMINDER_ENABLED=1 with storage, sending and the secret configured: then sign-ups and
// confirmations are 404. A stop link keeps working whenever storage and the secret are configured, switch or not.
// Nothing here logs, and no response repeats the email, month or day.
import { checkRateLimit } from '@vercel/firewall';
import { birthdayReminderEnabled, birthdayReminderSecret, birthdayReminderStorageReady } from '../../src/lib/birthday-reminder/config.js';
import { confirmationEmail, hashToken, newConfirmToken, parseReminderRequest, readUnsubscribeToken } from '../../src/lib/birthday-reminder/core.js';
import { confirmReminder, deleteReminder, requestReminder } from '../../src/lib/birthday-reminder/store.js';
import { sendPlainEmail } from '../../src/lib/birthday-reminder/send.js';
import { dailyEmailPage } from '../../src/lib/email/daily-page.js';
import { isAllowedEmailCaptureRequest } from '../../src/lib/email/request.js';

export const BIRTHDAY_REMINDER_RATE_LIMIT_ID = 'zodiacs-birthday-reminder';
const PATH = '/api/email/birthday-reminder';

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
function field(req: any, name: string): string {
  const query = req.query?.[name];
  if (typeof query === 'string') return query;
  const body = req.body;
  if (typeof body === 'string') { try { const parsed = JSON.parse(body); if (typeof parsed?.[name] === 'string') return parsed[name]; } catch { return new URLSearchParams(body).get(name) ?? ''; } }
  if (body && typeof body === 'object' && typeof body[name] === 'string') return body[name];
  return '';
}
function jsonBody(req: any): unknown {
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return null; } }
  return req.body ?? null;
}
function origin(env: Record<string, unknown>): string {
  const configured = typeof env.EMAIL_CONFIRM_BASE_URL === 'string' && env.EMAIL_CONFIRM_BASE_URL.trim() ? env.EMAIL_CONFIRM_BASE_URL.trim() : 'https://zodiacs.org';
  const url = new URL(configured);
  if (url.protocol !== 'https:') throw new Error('EMAIL_CONFIRM_BASE_URL must use HTTPS.');
  return url.origin;
}

async function rateLimited(req: any): Promise<boolean> {
  try { return (await checkRateLimit(BIRTHDAY_REMINDER_RATE_LIMIT_ID, { headers: req.headers }))?.rateLimited === true; } catch { return false; }
}

export interface ReminderDependencies {
  env?: Record<string, unknown>;
  fetcher?: typeof fetch;
  rateLimit?: (req: any) => Promise<boolean>;
}

export default async function birthdayReminderHandler(req: any, res: any, deps: ReminderDependencies = {}): Promise<void> {
  const env = deps.env ?? process.env;
  const fetcher = deps.fetcher ?? fetch;
  const confirm = field(req, 'confirm');
  const unsubscribe = field(req, 'unsubscribe');
  // The way out stays open after the switch goes off: a stop link needs only the list and the secret.
  const open = unsubscribe && !confirm ? birthdayReminderStorageReady(env) : birthdayReminderEnabled(env);
  if (!open) { sendJson(res, 404, { error: 'not-offered' }); return; }

  if (confirm || unsubscribe) {
    if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); sendJson(res, 405, { error: 'method' }); return; }
    // A link opens a page with a button; only the POST acts, so mail scanners that follow links change nothing.
    if (req.method === 'GET') {
      sendHtml(res, 200, confirm
        ? dailyEmailPage('Confirm your birthday reminder', 'One email a year, on your birthday. We keep only your email address and your birthday’s month and day.', { action: `${PATH}?confirm=${encodeURIComponent(confirm)}`, token: confirm, label: 'Confirm the reminder' })
        : dailyEmailPage('Stop birthday reminders', 'This deletes your email address and birthday from the reminder list.', { action: `${PATH}?unsubscribe=${encodeURIComponent(unsubscribe)}`, token: unsubscribe, label: 'Stop and delete' }));
      return;
    }
    try {
      if (confirm) {
        const done = /^[A-Za-z0-9_-]{43}$/u.test(confirm) && await confirmReminder(hashToken(confirm), env, fetcher);
        sendHtml(res, done ? 200 : 410, done
          ? dailyEmailPage('Birthday reminder confirmed', 'We will email you on your birthday to score your year ahead again. Every email has a link to stop.')
          : dailyEmailPage('This link has expired', 'Confirmation links work for 48 hours. Score your year again to ask for a new one.', { kind: 'link', href: '/year-score/', label: 'Score your year' }));
        return;
      }
      const id = readUnsubscribeToken(unsubscribe, birthdayReminderSecret(env));
      if (id) await deleteReminder(id, env, fetcher);
      // The same answer whether or not there was a reminder, so the page reveals nothing.
      sendHtml(res, id ? 200 : 400, dailyEmailPage(id ? 'Birthday reminders stopped' : 'This link is not valid', id ? 'Your email address and birthday have been deleted from the reminder list.' : 'Use the link in the latest birthday email.'));
    } catch {
      sendHtml(res, 502, dailyEmailPage('Something went wrong', 'Nothing was changed. Try the link again in a few minutes.'));
    }
    return;
  }

  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); sendJson(res, 405, { error: 'method' }); return; }
  if (!isAllowedEmailCaptureRequest(req)) { sendJson(res, 403, { error: 'origin' }); return; }
  if (await (deps.rateLimit ?? rateLimited)(req)) { sendJson(res, 429, { error: 'rate-limited' }); return; }
  const parsed = parseReminderRequest(jsonBody(req));
  if ('refused' in parsed) { sendJson(res, 400, { error: parsed.refused }); return; }
  try {
    const { token, hash } = newConfirmToken();
    const outcome = await requestReminder(parsed.email, parsed.month, parsed.day, hash, env, fetcher);
    if (outcome === 'requested') {
      const email = confirmationEmail(`${origin(env)}${PATH}?confirm=${token}`);
      await sendPlainEmail(parsed.email, email, env, fetcher);
    }
    // Capped or not, the answer is the same: a confirmation email is on its way if the address can take one.
    sendJson(res, 202, { ok: true });
  } catch {
    sendJson(res, 502, { error: 'unavailable' });
  }
}
