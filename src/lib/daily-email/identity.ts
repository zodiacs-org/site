import { createHmac } from 'node:crypto';
import { normalizeEmail } from '../email/input.js';

const RECIPIENT_CONTEXT = 'zodiacs.daily-email.recipient.v1';
const DELIVERY_CONTEXT = 'zodiacs.daily-email.delivery.v1';

function requiredEmail(value: string): string {
  const normalized = normalizeEmail(value);
  if (!normalized) throw new Error('Daily email recipient is invalid.');
  return normalized;
}

function requiredSecret(secret: string): string {
  if (secret.length < 32) {
    throw new Error('Daily email recipient hash secret must be at least 32 characters.');
  }
  return secret;
}

function hmacHex(secret: string, value: string): string {
  return createHmac('sha256', requiredSecret(secret)).update(value).digest('hex');
}

/** Stable database identifier. The edition is the other half of the primary key. */
export function dailyRecipientHash(email: string, secret: string): string {
  return hmacHex(secret, `${RECIPIENT_CONTEXT}\0${requiredEmail(email)}`);
}

/** Stable provider idempotency key scoped to one recipient and one edition. */
export function dailyDeliveryIdempotencyKey(
  editionDate: string,
  email: string,
  secret: string,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(editionDate)) {
    throw new Error('Daily email edition must be YYYY-MM-DD.');
  }
  const digest = hmacHex(
    secret,
    `${DELIVERY_CONTEXT}\0${editionDate}\0${requiredEmail(email)}`,
  );
  return `zodiacs-daily/${editionDate}/${digest}`;
}

