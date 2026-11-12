import { describe, expect, it, vi } from 'vitest';
import { sendPlainEmail } from './send';

const ENV = { RESEND_API_KEY: 'resend', RESEND_FROM_EMAIL: 'Zodiacs.org <hello@zodiacs.org>' };

describe('the birthday reminder email', () => {
  it('carries the idempotency key it is given, so a retry cannot send twice', async () => {
    const fetcher = vi.fn(async () => new Response('{"id":"x"}'));
    await sendPlainEmail('ana@example.com', { subject: 's', text: 't' }, ENV, fetcher as unknown as typeof fetch, {}, 'birthday-reminder/0f8fad5b-d9cb-469f-a165-70867728950e/2027');
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('birthday-reminder/0f8fad5b-d9cb-469f-a165-70867728950e/2027');
  });
  it('sends no idempotency key when none is given', async () => {
    const fetcher = vi.fn(async () => new Response('{"id":"x"}'));
    await sendPlainEmail('ana@example.com', { subject: 's', text: 't' }, ENV, fetcher as unknown as typeof fetch);
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).has('Idempotency-Key')).toBe(false);
  });
});
