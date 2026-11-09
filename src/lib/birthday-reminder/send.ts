/**
 * Plain-text email through Resend, for the birthday reminder. The address is
 * sent to Resend and nowhere else; failures carry the status code only.
 */
import { environmentValue } from '../email/config.js';
import { createRateLimitedResendRequest } from '../daily-email/resend-request.js';

type Environment = Record<string, unknown>;

export async function sendPlainEmail(to: string, email: { subject: string; text: string }, env: Environment = process.env, fetcher: typeof fetch = fetch, headers: Record<string, string> = {}): Promise<void> {
  const request = createRateLimitedResendRequest(fetcher);
  const response = await request('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${environmentValue(env, 'RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: environmentValue(env, 'RESEND_FROM_EMAIL'), to: [to], subject: email.subject, text: email.text, ...(Object.keys(headers).length ? { headers } : {}) }),
  });
  if (!response.ok) throw new Error(`Birthday reminder email failed (${response.status}).`);
}
