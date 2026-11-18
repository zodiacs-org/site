import { describe, expect, it, vi } from 'vitest';
import {
  WeeklyDigestProviderAbortError,
  buildWeeklyDigestRequestEnvelope,
  createWeeklyDigestResendRequest,
  openWeeklyDigestRequestEnvelope,
  sealWeeklyDigestRequestEnvelope,
  sendWeeklyDigestEnvelope,
  sendWeeklyDigestEmail,
  weeklyDigestEnvelopeDigest,
  weeklyDigestIdempotencyKey,
  weeklyDigestOrderKey,
  type WeeklyDigestDeliveryContext,
  type WeeklyDigestEmail,
} from './delivery';

const SECRET = 'weekly-envelope-secret-that-is-at-least-32-characters';
const OTHER_SECRET = 'different-weekly-secret-that-is-also-at-least-32';
const EMAIL: WeeklyDigestEmail = {
  apiKey: 'resend_test_key',
  from: 'Zodiacs.org <hello@zodiacs.org>',
  to: 'recipient@example.com',
  subject: 'Your sky',
  text: 'Personalized text',
  html: '<p>Personalized HTML</p>',
  unsubscribe: 'https://zodiacs.org/api/unsubscribe?token=test',
  weekStart: '2026-07-13',
  userId: '10000000-0000-4000-8000-000000000001',
};
const CONTEXT: WeeklyDigestDeliveryContext = {
  weekStart: EMAIL.weekStart,
  userId: EMAIL.userId,
};

function providerError(status: number, name: string, message = 'provider detail'): Response {
  return Response.json({ name, statusCode: status, message }, { status });
}

async function capturedAbort(promise: Promise<unknown>): Promise<WeeklyDigestProviderAbortError> {
  try {
    await promise;
    throw new Error('Expected the provider operation to abort.');
  } catch (error) {
    expect(error).toBeInstanceOf(WeeklyDigestProviderAbortError);
    return error as WeeklyDigestProviderAbortError;
  }
}

describe('weekly digest request envelope', () => {
  it('derives stable non-identifying delivery and ordering keys', () => {
    const delivery = weeklyDigestIdempotencyKey(EMAIL.weekStart, EMAIL.userId);
    const order = weeklyDigestOrderKey(EMAIL.weekStart, EMAIL.userId);
    expect(delivery).toMatch(/^weekly-digest-v1\/[0-9a-f]{64}$/u);
    expect(delivery).not.toContain(EMAIL.userId);
    expect(order).toMatch(/^[0-9a-f]{64}$/u);
    expect(order).not.toBe(weeklyDigestOrderKey('2026-07-20', EMAIL.userId));
    expect(() => weeklyDigestIdempotencyKey('2026-07-14', EMAIL.userId)).toThrow(
      'Invalid weekly delivery identity',
    );
  });

  it('builds and freezes the canonical Resend body without the API key', () => {
    const envelope = buildWeeklyDigestRequestEnvelope(EMAIL);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(envelope).toEqual({
      schema: 'weekly-digest-request-v1',
      endpoint: 'https://api.resend.com/emails',
      method: 'POST',
      contentType: 'application/json',
      idempotencyKey: weeklyDigestIdempotencyKey(EMAIL.weekStart, EMAIL.userId),
      body: JSON.stringify({
        from: EMAIL.from,
        to: [EMAIL.to],
        subject: EMAIL.subject,
        text: EMAIL.text,
        html: EMAIL.html,
        headers: {
          'List-Unsubscribe': `<${EMAIL.unsubscribe}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });
    expect(envelope.body).not.toContain(EMAIL.apiKey);
  });

  it('seals with AES-GCM and opens only under the original secret and context', () => {
    const envelope = buildWeeklyDigestRequestEnvelope(EMAIL);
    const sealed = sealWeeklyDigestRequestEnvelope(envelope, CONTEXT, SECRET);

    expect(sealed).toMatch(/^wde1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
    expect(sealed).not.toContain(EMAIL.to);
    expect(sealed).not.toContain(EMAIL.userId);
    expect(sealed).not.toContain(SECRET);
    expect(weeklyDigestEnvelopeDigest(envelope)).toMatch(/^[0-9a-f]{64}$/u);
    const opened = openWeeklyDigestRequestEnvelope(sealed, CONTEXT, SECRET);
    expect(opened).toEqual(envelope);
    expect(Object.isFrozen(opened)).toBe(true);

    expect(openWeeklyDigestRequestEnvelope(sealed, CONTEXT, OTHER_SECRET)).toBeNull();
    expect(openWeeklyDigestRequestEnvelope(sealed, {
      ...CONTEXT,
      weekStart: '2026-07-20',
    }, SECRET)).toBeNull();
    expect(openWeeklyDigestRequestEnvelope(sealed, {
      ...CONTEXT,
      userId: '10000000-0000-4000-8000-000000000002',
    }, SECRET)).toBeNull();
  });

  it('rejects ciphertext, tag, version, and idempotency-context tampering', () => {
    const envelope = buildWeeklyDigestRequestEnvelope(EMAIL);
    const sealed = sealWeeklyDigestRequestEnvelope(envelope, CONTEXT, SECRET);
    const parts = sealed.split('.');
    const ciphertext = parts[2]!;
    parts[2] = `${ciphertext[0] === 'A' ? 'B' : 'A'}${ciphertext.slice(1)}`;
    expect(openWeeklyDigestRequestEnvelope(parts.join('.'), CONTEXT, SECRET)).toBeNull();

    const tagParts = sealed.split('.');
    const tag = tagParts[3]!;
    tagParts[3] = `${tag[0] === 'A' ? 'B' : 'A'}${tag.slice(1)}`;
    expect(openWeeklyDigestRequestEnvelope(tagParts.join('.'), CONTEXT, SECRET)).toBeNull();
    expect(openWeeklyDigestRequestEnvelope(sealed.replace(/^wde1/u, 'wde2'), CONTEXT, SECRET))
      .toBeNull();

    expect(() => sealWeeklyDigestRequestEnvelope({
      ...envelope,
      idempotencyKey: weeklyDigestIdempotencyKey('2026-07-20', EMAIL.userId),
    }, CONTEXT, SECRET)).toThrow('Invalid weekly digest envelope context');
  });

  it('enforces secret, message, and sealed-input size bounds', () => {
    const envelope = buildWeeklyDigestRequestEnvelope(EMAIL);
    expect(() => sealWeeklyDigestRequestEnvelope(envelope, CONTEXT, 'too-short')).toThrow(
      'Invalid weekly digest envelope secret',
    );
    expect(openWeeklyDigestRequestEnvelope('wde1.A.A.A', CONTEXT, 'too-short')).toBeNull();
    expect(() => buildWeeklyDigestRequestEnvelope({
      ...EMAIL,
      html: 'x'.repeat(2 * 1_024 * 1_024),
    })).toThrow('exceeds its size limit');
    expect(openWeeklyDigestRequestEnvelope(
      `wde1.${'A'.repeat(2_900_000)}.A.A`,
      CONTEXT,
      SECRET,
    )).toBeNull();
  });

  it('replays the opened body and key byte-for-byte', async () => {
    const original = buildWeeklyDigestRequestEnvelope(EMAIL);
    const sealed = sealWeeklyDigestRequestEnvelope(original, CONTEXT, SECRET);
    const opened = openWeeklyDigestRequestEnvelope(sealed, CONTEXT, SECRET);
    expect(opened).not.toBeNull();

    let captured: RequestInit | undefined;
    await expect(sendWeeklyDigestEnvelope(opened!, EMAIL.apiKey, async (_input, init) => {
      captured = init;
      return Response.json({ id: 'provider-receipt-replay' });
    })).resolves.toEqual({ kind: 'sent', receipt: 'provider-receipt-replay' });

    expect(captured?.body).toBe(original.body);
    expect(new Headers(captured?.headers).get('Idempotency-Key')).toBe(original.idempotencyKey);
    expect(new Headers(captured?.headers).get('Content-Type')).toBe(original.contentType);
  });
});

describe('weekly digest provider boundary', () => {
  it('retries 429 with the same body/key and a fresh timeout per attempt', async () => {
    const attempts: RequestInit[] = [];
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      attempts.push(init ?? {});
      signals.push(init?.signal as AbortSignal);
      return attempts.length === 1
        ? providerError(429, 'rate_limit_exceeded')
        : Response.json({ id: 'provider-receipt-1' });
    });
    const timeoutSignal = vi.fn(() => new AbortController().signal);
    const request = createWeeklyDigestResendRequest(fetcher as typeof fetch, {
      minIntervalMs: 0,
      maxRetries: 1,
      maxRetryAfterMs: 0,
      sleep: async () => undefined,
      timeoutSignal,
    });

    await expect(sendWeeklyDigestEmail(EMAIL, request)).resolves.toEqual({
      kind: 'sent',
      receipt: 'provider-receipt-1',
    });
    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.body).toBe(attempts[1]?.body);
    expect(new Headers(attempts[0]?.headers).get('Idempotency-Key'))
      .toBe(new Headers(attempts[1]?.headers).get('Idempotency-Key'));
    expect(signals[0]).not.toBe(signals[1]);
    expect(timeoutSignal).toHaveBeenCalledTimes(2);
  });

  it('aborts after bounded 429 retries instead of finalizing a rejection', async () => {
    const fetcher = vi.fn(async () => providerError(429, 'rate_limit_exceeded'));
    const request = createWeeklyDigestResendRequest(fetcher as typeof fetch, {
      minIntervalMs: 0,
      maxRetries: 1,
      maxRetryAfterMs: 0,
      sleep: async () => undefined,
      timeoutSignal: () => new AbortController().signal,
    });

    const error = await capturedAbort(sendWeeklyDigestEmail(EMAIL, request));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(error).toMatchObject({
      reason: 'provider-response',
      status: 429,
      code: 'rate_limit_exceeded',
      // Every attempt was an explicit 429: nothing was accepted.
      definitive: true,
    });
  });

  it('never starts a retry or sleep that can cross the absolute recovery deadline', async () => {
    let clock = 1_000;
    const fetcher = vi.fn(async () => providerError(429, 'rate_limit_exceeded'));
    const timeoutSignal = vi.fn(() => new AbortController().signal);
    const sleep = vi.fn(async (milliseconds: number) => {
      clock += milliseconds;
    });
    const request = createWeeklyDigestResendRequest(fetcher as typeof fetch, {
      absoluteDeadlineMs: 1_200,
      minIntervalMs: 0,
      maxRetries: 3,
      maxRetryAfterMs: 10_000,
      now: () => clock,
      sleep,
      timeoutSignal,
    });

    const error = await capturedAbort(sendWeeklyDigestEmail(EMAIL, request));
    expect(error).toMatchObject({ reason: 'transport', status: null, code: null, definitive: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(timeoutSignal).toHaveBeenCalledExactlyOnceWith(200);
    expect(sleep).not.toHaveBeenCalled();
    expect(clock).toBe(1_000);
  });

  // A 409 (an idempotency conflict: the key may already hold an accepted
  // request), a 408 and a 5xx are ambiguous; any other explicit 4xx is a
  // definitive rejection, so nothing was accepted.
  it.each([
    [409, 'concurrent_idempotent_requests', false],
    [409, 'invalid_idempotent_request', false],
    [408, 'request_timeout', false],
    [500, 'application_error', false],
    [503, 'service_unavailable', false],
    [401, 'missing_api_key', true],
    [403, 'restricted_api_key', true],
    [400, 'validation_error', true],
    [422, 'validation_error', true],
    [418, 'unknown_provider_code', true],
  ])('aborts provider-wide, configuration, or unknown %s/%s responses (definitive=%s)', async (status, code, definitive) => {
    const error = await capturedAbort(sendWeeklyDigestEmail(
      EMAIL,
      async () => providerError(status, code, `private detail for ${EMAIL.to}`),
    ));
    expect(error).toMatchObject({ reason: 'provider-response', status, code, definitive });
    expect(error.message).not.toContain(EMAIL.to);
    expect(error.message).not.toContain(EMAIL.apiKey);
  });

  it('finalizes only an explicitly recipient-specific permanent code', async () => {
    await expect(sendWeeklyDigestEmail(
      EMAIL,
      async () => providerError(422, 'invalid_recipient', `invalid ${EMAIL.to}`),
    )).resolves.toEqual({
      kind: 'rejected',
      status: 422,
      code: 'invalid_recipient',
    });
  });

  it('does not trust mismatched, oversized, or malformed provider metadata', async () => {
    const mismatched = await capturedAbort(sendWeeklyDigestEmail(
      EMAIL,
      async () => Response.json({
        name: 'invalid_recipient',
        statusCode: 400,
      }, { status: 422 }),
    ));
    expect(mismatched).toMatchObject({ status: 422, code: null });

    const oversized = await capturedAbort(sendWeeklyDigestEmail(
      EMAIL,
      async () => providerError(
        422,
        'invalid_recipient',
        `private ${EMAIL.to} ${'x'.repeat(5_000)}`,
      ),
    ));
    expect(oversized).toMatchObject({ status: 422, code: null });

    const malformed = await capturedAbort(sendWeeklyDigestEmail(
      EMAIL,
      async () => new Response('{', { status: 422 }),
    ));
    expect(malformed).toMatchObject({ status: 422, code: null });
  });

  it('sanitizes transport failures and treats malformed successes as ambiguous', async () => {
    const transport = await capturedAbort(sendWeeklyDigestEmail(EMAIL, async () => {
      throw new Error(`connection reset for ${EMAIL.to} using ${EMAIL.apiKey}`);
    }));
    expect(transport).toMatchObject({ reason: 'transport', status: null, code: null, definitive: false });
    expect(transport.message).not.toContain(EMAIL.to);
    expect(transport.message).not.toContain(EMAIL.apiKey);

    const malformed = await capturedAbort(sendWeeklyDigestEmail(
      EMAIL,
      async () => Response.json({ unexpected: true }),
    ));
    expect(malformed).toMatchObject({ reason: 'invalid-success', status: 200, code: null, definitive: false });
  });
});
