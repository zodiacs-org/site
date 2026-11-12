/**
 * Plain-text email through Resend, for the birthday reminder. The address is
 * sent to Resend and nowhere else; failures carry the status code only.
 */
import { environmentValue } from '../email/config.js';
import { createRateLimitedResendRequest, type ResendRequest } from '../daily-email/resend-request.js';

type Environment = Record<string, unknown>;

// One paced queue per fetcher, so the daily run's emails keep Resend's pace between recipients, not just within one.
const queues = new WeakMap<typeof fetch, ResendRequest>();
function resendRequest(fetcher: typeof fetch): ResendRequest {
  let request = queues.get(fetcher);
  if (!request) { request = createRateLimitedResendRequest(fetcher); queues.set(fetcher, request); }
  return request;
}

/** `idempotencyKey`: Resend sends at most one email per key (24 hours), so a retry after an unclear failure cannot send twice. */
export async function sendPlainEmail(to: string, email: { subject: string; text: string }, env: Environment = process.env, fetcher: typeof fetch = fetch, headers: Record<string, string> = {}, idempotencyKey?: string): Promise<void> {
  const request = resendRequest(fetcher);
  const response = await request('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${environmentValue(env, 'RESEND_API_KEY')}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    body: JSON.stringify({ from: environmentValue(env, 'RESEND_FROM_EMAIL'), to: [to], subject: email.subject, text: email.text, ...(Object.keys(headers).length ? { headers } : {}) }),
  });
  if (!response.ok) throw new Error(`Birthday reminder email failed (${response.status}).`);
}
