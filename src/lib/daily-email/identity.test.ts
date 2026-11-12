import { describe, expect, it } from 'vitest';
import {
  dailyDeliveryIdempotencyKey,
  dailyRecipientHash,
} from './identity';

const SECRET = 'recipient-hash-secret-that-is-long-enough';

describe('daily email identity', () => {
  it('normalizes an address into one opaque receipt identity', () => {
    const first = dailyRecipientHash(' Person@Example.COM ', SECRET);
    const second = dailyRecipientHash('person@example.com', SECRET);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/u);
    expect(first).not.toContain('person');
  });

  it('scopes provider idempotency to both recipient and edition', () => {
    const first = dailyDeliveryIdempotencyKey('2026-07-20', 'person@example.com', SECRET);
    expect(first).toBe(dailyDeliveryIdempotencyKey(
      '2026-07-20',
      'PERSON@example.com',
      SECRET,
    ));
    expect(first).not.toBe(dailyDeliveryIdempotencyKey(
      '2026-07-21',
      'person@example.com',
      SECRET,
    ));
    expect(first.length).toBeLessThan(256);
  });

  it('fails closed on malformed input', () => {
    expect(() => dailyRecipientHash('not-an-email', SECRET)).toThrow(/recipient/u);
    expect(() => dailyRecipientHash('person@example.com', 'short')).toThrow(/32/u);
  });
});
