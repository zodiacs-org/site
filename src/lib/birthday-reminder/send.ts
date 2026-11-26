/**
 * Plain-text email through Resend, for the birthday reminder. The address is
 * sent to Resend and nowhere else; failures carry the status code only.
 */
import { createHash } from 'node:crypto';
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

/** A definitive rejection of this attempt. Timeouts and key conflicts are ambiguous. */
export class BirthdayEmailRejectedError extends Error {}

export async function sendPlainEmail(
  to: string, email: { subject: string; text: string }, env: Environment = process.env,
  fetcher: typeof fetch = fetch, headers: Record<string, string> = {}, idempotencyKey?: string,
  beforeAttempt?: (hash: string) => Promise<boolean>,
): Promise<void> {
  const request = resendRequest(fetcher);
  const body = JSON.stringify({
    from: environmentValue(env, 'RESEND_FROM_EMAIL'), to: [to], subject: email.subject, text: email.text,
    ...(Object.keys(headers).length ? { headers } : {}),
  });
  const control = beforeAttempt && {
    beforeAttempt: () => beforeAttempt(createHash('sha256')
      .update('birthday-reminder/email/v1\0').update(idempotencyKey ?? '').update('\0').update(body).digest('hex')),
  };
  const response = await request('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${environmentValue(env, 'RESEND_API_KEY')}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    body, signal: AbortSignal.timeout(30_000),
  }, control);
  if (!response.ok) {
    const message = `Birthday reminder email failed (${response.status}).`;
    if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 409) {
      throw new BirthdayEmailRejectedError(message);
    }
    throw new Error(message);
  }
  if (beforeAttempt) {
    const receipt = await response.json().catch(() => null);
    if (typeof receipt?.id !== 'string' || !receipt.id.trim()) throw new Error('Missing birthday reminder email receipt.');
  }
}
