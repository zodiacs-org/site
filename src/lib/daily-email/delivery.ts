import { randomUUID } from 'node:crypto';
import type { Daily } from '../daily';
import type { DailyPublication } from '../daily-publication';
import type { HoroscopeProgram } from '../horoscope-program';
import { dailyDeliveryIdempotencyKey, dailyRecipientHash, maskDailyEmail } from './identity';
import { createRateLimitedResendRequest, type ResendRequest } from './resend-request';
import type {
  DailyEmailMessage,
  DailyEmailRecipient,
  DailyEmailTier,
  DeliveryReport,
} from './types';

export const DAILY_EMAIL_RESERVATION_LEASE_MS = 30 * 60 * 1_000;

export interface DeliveryReceiptStore {
  reserve(editionDate: string, recipientHash: string, tier: DailyEmailTier): Promise<string | null>;
  markSent(
    editionDate: string,
    recipientHash: string,
    leaseToken: string,
    providerReceipt: string,
    sentAt: string,
  ): Promise<void>;
  markFailed(editionDate: string, recipientHash: string, leaseToken: string): Promise<void>;
  /** Whether this recipient was already sent a daily email for an edition before this one. */
  sentBefore(editionDate: string, recipientHash: string): Promise<boolean>;
}

/** What the renderer needs to know about this recipient's history. */
export interface DailyEmailRenderContext {
  /** No earlier edition was sent to this recipient: the email says what they signed up for. */
  firstDelivery: boolean;
}

export interface ResendDelivery {
  send(
    recipient: DailyEmailRecipient,
    editionDate: string,
    message: DailyEmailMessage,
    idempotencyKey: string,
  ): Promise<string>;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonical(child)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonical(value));
}

async function errorBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '';
  }
}

/** Last fail-closed check immediately before any real-send side effect. */
export async function assertLiveDailyEmailEdition({
  fetchImpl,
  endpoint = 'https://zodiacs.org/data/daily-publication.json',
  daily,
  publication,
  program,
}: {
  fetchImpl: typeof fetch;
  endpoint?: string;
  daily: Daily;
  publication: DailyPublication;
  program: HoroscopeProgram;
}): Promise<void> {
  const url = new URL(endpoint);
  url.searchParams.set('proof', String(Date.now()));
  const response = await fetchImpl(url, {
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Production daily edition returned HTTP ${response.status}: ${await errorBody(response)}`);
  }
  const remote = await response.json() as {
    publication?: unknown;
    inputs?: { dailyFacts?: unknown; horoscopeProgram?: unknown };
  };
  if (canonicalJson(remote.publication) !== canonicalJson(publication)
    || canonicalJson(remote.inputs?.dailyFacts) !== canonicalJson(daily)
    || canonicalJson(remote.inputs?.horoscopeProgram) !== canonicalJson(program)) {
    throw new Error(`Production does not serve the exact committed ${publication.date} daily edition.`);
  }
}

function serviceHeaders(serviceKey: string, prefer?: string): Record<string, string> {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function deliveriesEndpoint(supabaseUrl: string): URL {
  return new URL('/rest/v1/daily_email_deliveries', `${supabaseUrl.replace(/\/+$/u, '')}/`);
}

function reservationResult(value: unknown, leaseToken: string, label: string): string | null {
  if (!Array.isArray(value)) throw new Error(`${label} returned an invalid response.`);
  if (value.length === 0) return null;
  if (value.length !== 1) throw new Error(`${label} returned too many rows.`);
  const row = value[0] as { lease_token?: unknown } | null;
  if (!row || row.lease_token !== leaseToken) {
    throw new Error(`${label} did not return the current lease owner.`);
  }
  return leaseToken;
}

export function createSupabaseDeliveryReceiptStore({
  fetchImpl,
  supabaseUrl,
  serviceKey,
  now = () => new Date(),
  newLeaseToken = randomUUID,
}: {
  fetchImpl: typeof fetch;
  supabaseUrl: string;
  serviceKey: string;
  now?: () => Date;
  newLeaseToken?: () => string;
}): DeliveryReceiptStore {
  return {
    async sentBefore(editionDate, recipientHash) {
      const url = deliveriesEndpoint(supabaseUrl);
      url.searchParams.set('select', 'edition_date');
      url.searchParams.set('recipient_hash', `eq.${recipientHash}`);
      url.searchParams.set('status', 'eq.sent');
      url.searchParams.set('edition_date', `lt.${editionDate}`);
      url.searchParams.set('limit', '1');
      const response = await fetchImpl(url, { method: 'GET', headers: serviceHeaders(serviceKey) });
      if (!response.ok) {
        throw new Error(`Could not read earlier daily email receipts (${response.status}): ${await errorBody(response)}`);
      }
      const rows = await response.json() as unknown;
      if (!Array.isArray(rows)) throw new Error('Earlier daily email receipts returned an invalid response.');
      return rows.length > 0;
    },
    async reserve(editionDate, recipientHash, tier) {
      const leaseToken = newLeaseToken();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(leaseToken)) {
        throw new Error('Daily email reservation owner token is invalid.');
      }
      const url = deliveriesEndpoint(supabaseUrl);
      url.searchParams.set('on_conflict', 'edition_date,recipient_hash');
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: serviceHeaders(serviceKey, 'resolution=ignore-duplicates,return=representation'),
        body: JSON.stringify({
          edition_date: editionDate,
          recipient_hash: recipientHash,
          tier,
          status: 'reserved',
          lease_token: leaseToken,
        }),
      });
      if (!response.ok) {
        throw new Error(`Could not reserve daily email receipt (${response.status}): ${await errorBody(response)}`);
      }
      const rows = await response.json() as unknown;
      const inserted = reservationResult(rows, leaseToken, 'Daily email receipt reservation');
      if (inserted) return inserted;

      // A provider/network failure may be retried with the same Resend
      // idempotency key. Sent and currently reserved rows remain immutable.
      const retryUrl = deliveriesEndpoint(supabaseUrl);
      retryUrl.searchParams.set('edition_date', `eq.${editionDate}`);
      retryUrl.searchParams.set('recipient_hash', `eq.${recipientHash}`);
      retryUrl.searchParams.set('status', 'eq.failed');
      const retry = await fetchImpl(retryUrl, {
        method: 'PATCH',
        headers: serviceHeaders(serviceKey, 'return=representation'),
        body: JSON.stringify({
          tier,
          status: 'reserved',
          lease_token: leaseToken,
          provider_receipt: null,
          sent_at: null,
        }),
      });
      if (!retry.ok) {
        throw new Error(`Could not retry failed daily email receipt (${retry.status}): ${await errorBody(retry)}`);
      }
      const retried = await retry.json() as unknown;
      const failedRetry = reservationResult(retried, leaseToken, 'Daily email retry reservation');
      if (failedRetry) return failedRetry;

      // A crashed worker can leave a reservation behind. Reclaim it only
      // after a fixed lease, with updated_at in the PATCH predicate acting as
      // an atomic compare-and-swap. The provider idempotency key remains the
      // deterministic edition/recipient key used by the original attempt.
      const leaseCutoff = new Date(now().getTime() - DAILY_EMAIL_RESERVATION_LEASE_MS);
      if (Number.isNaN(leaseCutoff.getTime())) {
        throw new Error('Daily email reservation clock returned an invalid instant.');
      }
      const staleUrl = deliveriesEndpoint(supabaseUrl);
      staleUrl.searchParams.set('edition_date', `eq.${editionDate}`);
      staleUrl.searchParams.set('recipient_hash', `eq.${recipientHash}`);
      staleUrl.searchParams.set('status', 'eq.reserved');
      staleUrl.searchParams.set('updated_at', `lt.${leaseCutoff.toISOString()}`);
      const stale = await fetchImpl(staleUrl, {
        method: 'PATCH',
        headers: serviceHeaders(serviceKey, 'return=representation'),
        body: JSON.stringify({
          tier,
          status: 'reserved',
          lease_token: leaseToken,
          provider_receipt: null,
          sent_at: null,
        }),
      });
      if (!stale.ok) {
        throw new Error(`Could not reclaim stale daily email receipt (${stale.status}): ${await errorBody(stale)}`);
      }
      const reclaimed = await stale.json() as unknown;
      return reservationResult(reclaimed, leaseToken, 'Daily email stale reservation');
    },

    async markSent(editionDate, recipientHash, leaseToken, providerReceipt, sentAt) {
      const url = deliveriesEndpoint(supabaseUrl);
      url.searchParams.set('edition_date', `eq.${editionDate}`);
      url.searchParams.set('recipient_hash', `eq.${recipientHash}`);
      url.searchParams.set('status', 'eq.reserved');
      url.searchParams.set('lease_token', `eq.${leaseToken}`);
      const response = await fetchImpl(url, {
        method: 'PATCH',
        headers: serviceHeaders(serviceKey, 'return=representation'),
        body: JSON.stringify({
          status: 'sent',
          provider_receipt: providerReceipt,
          sent_at: sentAt,
        }),
      });
      if (!response.ok) {
        throw new Error(`Could not finalize daily email receipt (${response.status}): ${await errorBody(response)}`);
      }
      const rows = await response.json() as unknown;
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw new Error('Daily email receipt was not finalized from its reserved state.');
      }
    },

    async markFailed(editionDate, recipientHash, leaseToken) {
      const url = deliveriesEndpoint(supabaseUrl);
      url.searchParams.set('edition_date', `eq.${editionDate}`);
      url.searchParams.set('recipient_hash', `eq.${recipientHash}`);
      url.searchParams.set('status', 'eq.reserved');
      url.searchParams.set('lease_token', `eq.${leaseToken}`);
      const response = await fetchImpl(url, {
        method: 'PATCH',
        headers: serviceHeaders(serviceKey, 'return=representation'),
        body: JSON.stringify({ status: 'failed', provider_receipt: null, sent_at: null }),
      });
      if (!response.ok) {
        throw new Error(`Could not mark daily email receipt failed (${response.status}): ${await errorBody(response)}`);
      }
      const rows = await response.json() as unknown;
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw new Error('Daily email receipt was not marked failed from its reserved state.');
      }
    },
  };
}

export function createResendDelivery({
  fetchImpl,
  apiKey,
  from,
  request = createRateLimitedResendRequest(fetchImpl),
}: {
  fetchImpl: typeof fetch;
  apiKey: string;
  from: string;
  request?: ResendRequest;
}): ResendDelivery {
  return {
    async send(recipient, editionDate, message, idempotencyKey) {
      const response = await request('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: [recipient.email],
          subject: message.subject,
          text: message.text,
          html: message.html,
          headers: {
            'List-Unsubscribe': `<${message.unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          tags: [
            { name: 'edition', value: editionDate.replaceAll('-', '_') },
            { name: 'tier', value: recipient.tier },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend daily email failed (${response.status}).`);
      }
      const body = await response.json() as { id?: unknown };
      if (typeof body.id !== 'string' || !body.id) {
        throw new Error('Resend daily email response omitted its provider receipt.');
      }
      return body.id;
    },
  };
}

export async function deliverDailyEmails({
  recipients,
  editionDate,
  limit,
  dryRun,
  hashSecret,
  receipts,
  resend,
  render,
  now = () => new Date(),
  log = console.log,
}: {
  recipients: readonly DailyEmailRecipient[];
  editionDate: string;
  limit: number;
  dryRun: boolean;
  hashSecret: string;
  receipts: DeliveryReceiptStore;
  resend: ResendDelivery;
  render: (recipient: DailyEmailRecipient, context: DailyEmailRenderContext) => DailyEmailMessage;
  now?: () => Date;
  log?: (message: string) => void;
}): Promise<DeliveryReport> {
  const report: DeliveryReport = {
    considered: 0,
    reserved: 0,
    sent: 0,
    failed: 0,
    duplicate: 0,
    dryRun: 0,
  };
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Daily email limit must be positive.');

  for (const recipient of recipients) {
    if ((dryRun ? report.dryRun : report.reserved) >= limit) break;
    report.considered += 1;
    const maskedEmail = maskDailyEmail(recipient.email);
    let recipientHash: string;
    let idempotencyKey: string;
    try {
      recipientHash = dailyRecipientHash(recipient.email, hashSecret);
      idempotencyKey = dailyDeliveryIdempotencyKey(editionDate, recipient.email, hashSecret);
    } catch {
      report.failed += 1;
      log(`daily-email: failed ${recipient.tier} for ${maskedEmail} during recipient validation`);
      continue;
    }

    if (dryRun) {
      try {
        render(recipient, { firstDelivery: false });
        report.dryRun += 1;
        log(`daily-email: dry-run ${recipient.tier} ${maskedEmail}`);
      } catch {
        report.failed += 1;
        log(`daily-email: failed ${recipient.tier} for ${maskedEmail} during render`);
      }
      continue;
    }

    const leaseToken = await receipts.reserve(editionDate, recipientHash, recipient.tier);
    if (!leaseToken) {
      report.duplicate += 1;
      continue;
    }
    report.reserved += 1;
    // Only editions before this one count, so a retry of today's edition
    // renders the same message under the same provider idempotency key.
    let firstDelivery: boolean;
    try {
      firstDelivery = !await receipts.sentBefore(editionDate, recipientHash);
    } catch {
      report.failed += 1;
      try {
        await receipts.markFailed(editionDate, recipientHash, leaseToken);
      } catch {
        log(`daily-email: receipt update failed for ${maskedEmail}`);
      }
      log(`daily-email: failed ${recipient.tier} for ${maskedEmail} during history lookup`);
      continue;
    }
    let message: DailyEmailMessage;
    try {
      message = render(recipient, { firstDelivery });
    } catch {
      report.failed += 1;
      try {
        await receipts.markFailed(editionDate, recipientHash, leaseToken);
      } catch {
        log(`daily-email: receipt update failed for ${maskedEmail}`);
      }
      log(`daily-email: failed ${recipient.tier} for ${maskedEmail} during render`);
      continue;
    }

    try {
      const providerReceipt = await resend.send(recipient, editionDate, message, idempotencyKey);
      await receipts.markSent(
        editionDate,
        recipientHash,
        leaseToken,
        providerReceipt,
        now().toISOString(),
      );
      report.sent += 1;
      log(`daily-email: sent ${recipient.tier} to ${maskedEmail}`);
    } catch {
      report.failed += 1;
      try {
        await receipts.markFailed(editionDate, recipientHash, leaseToken);
      } catch {
        log(`daily-email: receipt update failed for ${maskedEmail}`);
      }
      log(`daily-email: failed ${recipient.tier} for ${maskedEmail} during delivery`);
    }
  }
  return report;
}
