import { environmentValue } from './config.js';
import { dailySunSegmentId } from './daily-config.js';
import { createRateLimitedResendRequest, type ResendRequest } from '../daily-email/resend-request.js';
import { normalizeEmail } from './input.js';

type Environment = Record<string, unknown>;
type Fetch = typeof fetch;

interface ResendContact {
  id: string;
  email?: string;
}

function authHeaders(
  env: Environment,
  capability: 'sending' | 'contacts',
  json = false,
): Record<string, string> {
  return {
    Authorization: `Bearer ${environmentValue(
      env,
      capability === 'sending' ? 'RESEND_API_KEY' : 'RESEND_CONTACTS_API_KEY',
    )}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

function validContact(value: unknown): value is ResendContact {
  return !!value
    && typeof value === 'object'
    && typeof (value as { id?: unknown }).id === 'string'
    && /^[A-Za-z0-9_-]{8,128}$/.test((value as { id: string }).id);
}

async function contactByEmail(
  email: string,
  env: Environment,
  request: ResendRequest,
): Promise<ResendContact> {
  const response = await request(`https://api.resend.com/contacts/${encodeURIComponent(email)}`, {
    headers: authHeaders(env, 'contacts'),
  });
  if (!response.ok) throw new Error(`Resend contact lookup failed (${response.status})`);
  const body = await response.json() as unknown;
  if (!validContact(body)) throw new Error('Resend returned an invalid contact.');
  return body;
}

export async function getDailyContactEmail(
  contactId: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(contactId)) return null;
  const request = createRateLimitedResendRequest(fetcher);
  const response = await request(`https://api.resend.com/contacts/${encodeURIComponent(contactId)}`, {
    headers: authHeaders(env, 'contacts'),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Resend contact lookup failed (${response.status})`);
  const body = await response.json() as { email?: unknown };
  return normalizeEmail(body.email);
}

async function ensureContact(
  email: string,
  env: Environment,
  request: ResendRequest,
): Promise<ResendContact> {
  const response = await request('https://api.resend.com/contacts', {
    method: 'POST',
    headers: authHeaders(env, 'contacts', true),
    body: JSON.stringify({ email, unsubscribed: false }),
  });
  if (response.status === 409) return contactByEmail(email, env, request);
  if (!response.ok) throw new Error(`Resend contact creation failed (${response.status})`);
  const body = await response.json() as unknown;
  if (!validContact(body)) throw new Error('Resend returned an invalid contact.');
  return body;
}

async function removeSegment(
  contactId: string,
  segmentId: string,
  env: Environment,
  request: ResendRequest,
): Promise<void> {
  const response = await request(
    `https://api.resend.com/contacts/${encodeURIComponent(contactId)}/segments/${encodeURIComponent(segmentId)}`,
    { method: 'DELETE', headers: authHeaders(env, 'contacts') },
  );
  // Missing contact membership is the desired idempotent end state.
  if (!response.ok && response.status !== 404) {
    throw new Error(`Resend segment removal failed (${response.status})`);
  }
}

async function addSegment(
  contactId: string,
  segmentId: string,
  env: Environment,
  request: ResendRequest,
): Promise<void> {
  const response = await request(
    `https://api.resend.com/contacts/${encodeURIComponent(contactId)}/segments/${encodeURIComponent(segmentId)}`,
    { method: 'POST', headers: authHeaders(env, 'contacts') },
  );
  if (!response.ok && response.status !== 409) {
    throw new Error(`Resend segment assignment failed (${response.status})`);
  }
}

export async function confirmDailySunContact(
  email: string,
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<ResendContact> {
  const segment = dailySunSegmentId(env);
  if (!segment) throw new Error('The daily Sun segment is not configured.');
  const request = createRateLimitedResendRequest(fetcher);
  const contact = await ensureContact(email, env, request);
  await addSegment(contact.id, segment, env, request);
  return contact;
}

export async function removeDailySunSegment(
  subject: { contactId: string } | { email: string },
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<void> {
  const segment = dailySunSegmentId(env);
  if (!segment) throw new Error('The daily Sun segment is not configured.');
  const identifier = 'contactId' in subject ? subject.contactId : subject.email;
  const request = createRateLimitedResendRequest(fetcher);
  await removeSegment(identifier, segment, env, request);
}

export async function sendDailyChartConfirmation(
  email: string,
  selection: {
    chartName: string;
    token: string;
  },
  env: Environment = process.env,
  fetcher: Fetch = fetch,
): Promise<void> {
  const configuredBase = environmentValue(env, 'EMAIL_CONFIRM_BASE_URL') || 'https://zodiacs.org';
  const base = new URL(configuredBase);
  if (base.protocol !== 'https:') throw new Error('EMAIL_CONFIRM_BASE_URL must use HTTPS.');
  const confirmation = new URL('/api/email/confirm', base.origin);
  confirmation.searchParams.set('token', selection.token);
  const chartName = selection.chartName
    .replace(/[\r\n\t]+/gu, ' ')
    .replace(/\s{2,}/gu, ' ')
    .trim()
    .slice(0, 120) || 'Saved chart';
  const request = createRateLimitedResendRequest(fetcher);
  const response = await request('https://api.resend.com/emails', {
    method: 'POST',
    headers: authHeaders(env, 'sending', true),
    body: JSON.stringify({
      from: environmentValue(env, 'RESEND_FROM_EMAIL'),
      to: [email],
      subject: 'Confirm your Zodiacs.org personal daily brief',
      text: [
        `Confirm that you want the personal daily brief for ${chartName}:`,
        '',
        `Confirm subscription: ${confirmation.toString()}`,
        '',
        'The link works for 48 hours. If you did not request this, ignore this email. Nothing will be subscribed.',
      ].join('\n'),
    }),
  });
  if (!response.ok) throw new Error(`Resend confirmation email failed (${response.status})`);
}
