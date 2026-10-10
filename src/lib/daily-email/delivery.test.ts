import { describe, expect, it, vi } from 'vitest';
import dailyData from '../../data/daily.json';
import publicationData from '../../data/daily-publication.json';
import programData from '../../data/horoscope-program.json';
import type { Daily } from '../daily';
import type { DailyPublication } from '../daily-publication';
import type { HoroscopeProgram } from '../horoscope-program';
import {
  assertLiveDailyEmailEdition,
  createResendDelivery,
  createSupabaseDeliveryReceiptStore,
  deliverDailyEmails,
  type DeliveryReceiptStore,
  type ResendDelivery,
} from './delivery';
import type { DailyEmailMessage, SunSignRecipient } from './types';

const daily = dailyData as Daily;
const publication = publicationData as DailyPublication;
const program = programData as HoroscopeProgram;
const LEASE_TOKEN = '30000000-0000-4000-8000-000000000003';
const recipient = (email: string): SunSignRecipient => ({
  tier: 'sun_sign', email, sign: 'aries', contactId: `contact_${email[0]}_0001`, timezone: 'UTC',
});
const message: DailyEmailMessage = {
  subject: 'Daily', preheader: 'Today', text: 'Today\nUnsubscribe',
  html: '<p>Today</p><a>Unsubscribe</a>',
  unsubscribeUrl: 'https://zodiacs.org/api/email/unsubscribe?token=test',
};

describe('daily email production edition gate', () => {
  it('accepts only the exact committed facts, publication, and horoscope program', async () => {
    const exact = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      publication,
      inputs: { dailyFacts: daily, horoscopeProgram: program },
    }), { status: 200 }));
    await expect(assertLiveDailyEmailEdition({
      fetchImpl: exact, daily, publication, program,
    })).resolves.toBeUndefined();
    expect(String(exact.mock.calls[0][0])).toContain('proof=');

    const stale = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      publication: { ...publication, date: '2026-07-19' },
      inputs: { dailyFacts: daily, horoscopeProgram: program },
    }), { status: 200 }));
    await expect(assertLiveDailyEmailEdition({
      fetchImpl: stale, daily, publication, program,
    })).rejects.toThrow(/exact committed/u);
  });
});

describe('daily email delivery adapters', () => {
  it('reserves with conflict-ignore and finalizes the exact reserved row', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        edition_date: publication.date, recipient_hash: 'a'.repeat(64),
        lease_token: LEASE_TOKEN,
      }]), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        edition_date: publication.date, recipient_hash: 'a'.repeat(64), status: 'sent',
      }]), { status: 200 }));
    const store = createSupabaseDeliveryReceiptStore({
      fetchImpl: fetcher, supabaseUrl: 'https://project.supabase.co', serviceKey: 'service-key',
      newLeaseToken: () => LEASE_TOKEN,
    });
    await expect(store.reserve(publication.date, 'a'.repeat(64), 'sun_sign')).resolves.toBe(LEASE_TOKEN);
    const reserve = fetcher.mock.calls[0];
    expect(String(reserve[0])).toContain('on_conflict=edition_date%2Crecipient_hash');
    expect((reserve[1]!.headers as Record<string, string>).Prefer)
      .toBe('resolution=ignore-duplicates,return=representation');
    await store.markSent(
      publication.date,
      'a'.repeat(64),
      LEASE_TOKEN,
      'provider-1',
      '2026-07-20T07:13:00Z',
    );
    expect(String(fetcher.mock.calls[1][0])).toContain('status=eq.reserved');
    expect(String(fetcher.mock.calls[1][0])).toContain(`lease_token=eq.${LEASE_TOKEN}`);
  });

  it('reopens only a failed receipt so the same provider idempotency key can retry', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        edition_date: publication.date,
        recipient_hash: 'a'.repeat(64),
        status: 'reserved',
        lease_token: LEASE_TOKEN,
      }]), { status: 200 }));
    const store = createSupabaseDeliveryReceiptStore({
      fetchImpl: fetcher,
      supabaseUrl: 'https://project.supabase.co',
      serviceKey: 'service-key',
      newLeaseToken: () => LEASE_TOKEN,
    });
    await expect(store.reserve(publication.date, 'a'.repeat(64), 'chart')).resolves.toBe(LEASE_TOKEN);
    const retry = fetcher.mock.calls[1];
    expect(String(retry[0])).toContain('status=eq.failed');
    expect(retry[1]?.method).toBe('PATCH');
    expect(JSON.parse(String(retry[1]?.body))).toMatchObject({ tier: 'chart', status: 'reserved' });
  });

  it('reclaims only stale reserved rows with an updated-at compare-and-swap', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        edition_date: publication.date,
        recipient_hash: 'a'.repeat(64),
        status: 'reserved',
        lease_token: LEASE_TOKEN,
      }]), { status: 200 }));
    const store = createSupabaseDeliveryReceiptStore({
      fetchImpl: fetcher,
      supabaseUrl: 'https://project.supabase.co',
      serviceKey: 'service-key',
      now: () => new Date('2026-07-20T08:00:00.000Z'),
      newLeaseToken: () => LEASE_TOKEN,
    });
    await expect(store.reserve(publication.date, 'a'.repeat(64), 'chart')).resolves.toBe(LEASE_TOKEN);
    const staleUrl = new URL(String(fetcher.mock.calls[2][0]));
    expect(staleUrl.searchParams.get('status')).toBe('eq.reserved');
    expect(staleUrl.searchParams.get('updated_at')).toBe('lt.2026-07-20T07:30:00.000Z');
    expect(fetcher.mock.calls[2][1]?.method).toBe('PATCH');
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body)))
      .toMatchObject({ status: 'reserved', lease_token: LEASE_TOKEN });
  });

  it('leaves a fresh reserved row protected', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    const store = createSupabaseDeliveryReceiptStore({
      fetchImpl: fetcher,
      supabaseUrl: 'https://project.supabase.co',
      serviceKey: 'service-key',
      now: () => new Date('2026-07-20T08:00:00.000Z'),
      newLeaseToken: () => LEASE_TOKEN,
    });
    await expect(store.reserve(publication.date, 'a'.repeat(64), 'sun_sign')).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('does not let an old lease owner finalize or fail a reclaimed reservation', async () => {
    const oldLease = '40000000-0000-4000-8000-000000000004';
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    const store = createSupabaseDeliveryReceiptStore({
      fetchImpl: fetcher,
      supabaseUrl: 'https://project.supabase.co',
      serviceKey: 'service-key',
    });
    await expect(store.markSent(
      publication.date,
      'a'.repeat(64),
      oldLease,
      'provider-old',
      '2026-07-20T08:01:00.000Z',
    )).rejects.toThrow(/not finalized/u);
    await expect(store.markFailed(publication.date, 'a'.repeat(64), oldLease))
      .rejects.toThrow(/not marked failed/u);
    for (const call of fetcher.mock.calls) {
      expect(new URL(String(call[0])).searchParams.get('lease_token')).toBe(`eq.${oldLease}`);
    }
  });

  it('sends HTML and text with RFC 8058 and Resend idempotency headers', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email_123' }), { status: 200 }));
    const resend = createResendDelivery({
      fetchImpl: fetcher, apiKey: 're_test', from: 'Zodiacs.org <hello@zodiacs.org>',
    });
    await expect(resend.send(recipient('one@example.com'), publication.date, message, 'daily/key'))
      .resolves.toBe('email_123');
    const request = fetcher.mock.calls[0][1]!;
    const headers = new Headers(request.headers);
    expect(headers.get('idempotency-key')).toBe('daily/key');
    expect(headers.get('user-agent')).toContain('Zodiacs.org-daily-email');
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({
      text: message.text, html: message.html,
      headers: {
        'List-Unsubscribe': `<${message.unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  });
});

describe('daily email idempotent batch', () => {
  it('does not let duplicate receipts consume the send limit', async () => {
    const store: DeliveryReceiptStore = {
      reserve: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(LEASE_TOKEN)
        .mockResolvedValueOnce(LEASE_TOKEN),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      sentBefore: vi.fn().mockResolvedValue(true),
    };
    const resend = { send: vi.fn().mockResolvedValue('provider') };
    const report = await deliverDailyEmails({
      recipients: [recipient('one@example.com'), recipient('two@example.com'), recipient('three@example.com')],
      editionDate: publication.date,
      limit: 2,
      dryRun: false,
      hashSecret: 'recipient-hash-secret-that-is-long-enough',
      receipts: store,
      resend,
      render: () => message,
      now: () => new Date('2026-07-20T07:13:00Z'),
      log: vi.fn(),
    });
    expect(report).toEqual({
      considered: 3, reserved: 2, sent: 2, failed: 0, duplicate: 1, dryRun: 0,
    });
    expect(resend.send).toHaveBeenCalledTimes(2);
  });

  it('marks a reserved receipt failed while continuing the batch', async () => {
    const store: DeliveryReceiptStore = {
      reserve: vi.fn().mockResolvedValue(LEASE_TOKEN),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      sentBefore: vi.fn().mockResolvedValue(true),
    };
    const resend = {
      send: vi.fn().mockRejectedValueOnce(new Error('provider down')).mockResolvedValueOnce('provider-2'),
    };
    const report = await deliverDailyEmails({
      recipients: [recipient('one@example.com'), recipient('two@example.com')],
      editionDate: publication.date,
      limit: 2,
      dryRun: false,
      hashSecret: 'recipient-hash-secret-that-is-long-enough',
      receipts: store,
      resend,
      render: () => message,
      log: vi.fn(),
    });
    expect(report.failed).toBe(1);
    expect(report.sent).toBe(1);
    expect(store.markFailed).toHaveBeenCalledOnce();
    expect(store.markSent).toHaveBeenCalledOnce();
  });

  it('reuses the same provider idempotency key after a failed attempt', async () => {
    const store: DeliveryReceiptStore = {
      reserve: vi.fn().mockResolvedValue(LEASE_TOKEN),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      sentBefore: vi.fn().mockResolvedValue(true),
    };
    const keys: string[] = [];
    const resend: ResendDelivery = {
      send: vi.fn(async (_recipient, _editionDate, _message, idempotencyKey) => {
        keys.push(idempotencyKey);
        if (keys.length === 1) throw new Error('provider down');
        return 'provider-2';
      }),
    };
    const input = {
      recipients: [recipient('retry@example.com')],
      editionDate: publication.date,
      limit: 1,
      dryRun: false,
      hashSecret: 'recipient-hash-secret-that-is-long-enough',
      receipts: store,
      resend,
      render: () => message,
      log: vi.fn(),
    };
    await deliverDailyEmails(input);
    await deliverDailyEmails(input);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('isolates malformed recipients and render failures without logging raw PII', async () => {
    const store: DeliveryReceiptStore = {
      reserve: vi.fn().mockResolvedValue(LEASE_TOKEN),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      sentBefore: vi.fn().mockResolvedValue(true),
    };
    const resend = { send: vi.fn().mockResolvedValue('provider-3') };
    const logs: string[] = [];
    const report = await deliverDailyEmails({
      recipients: [
        recipient('malformed-address'),
        recipient('render-private@example.com'),
        recipient('healthy@example.com'),
      ],
      editionDate: publication.date,
      limit: 2,
      dryRun: false,
      hashSecret: 'recipient-hash-secret-that-is-long-enough',
      receipts: store,
      resend,
      render: (candidate) => {
        if (candidate.email === 'render-private@example.com') {
          throw new Error('private chart name and render-private@example.com');
        }
        return message;
      },
      log: (entry) => logs.push(entry),
    });
    expect(report).toEqual({
      considered: 3, reserved: 2, sent: 1, failed: 2, duplicate: 0, dryRun: 0,
    });
    expect(store.reserve).toHaveBeenCalledTimes(2);
    expect(store.markFailed).toHaveBeenCalledOnce();
    expect(store.markSent).toHaveBeenCalledOnce();
    expect(resend.send).toHaveBeenCalledOnce();
    expect(logs.join('\n')).not.toContain('malformed-address');
    expect(logs.join('\n')).not.toContain('render-private@example.com');
    expect(logs.join('\n')).not.toContain('private chart name');
    expect(logs.join('\n')).toContain('during recipient validation');
    expect(logs.join('\n')).toContain('during render');
  });

  it('keeps fixture dry-runs entirely side-effect free', async () => {
    const store: DeliveryReceiptStore = {
      reserve: vi.fn(), markSent: vi.fn(), markFailed: vi.fn(), sentBefore: vi.fn(),
    };
    const resend = { send: vi.fn() };
    const report = await deliverDailyEmails({
      recipients: [recipient('one@example.com')],
      editionDate: publication.date,
      limit: 1,
      dryRun: true,
      hashSecret: 'recipient-hash-secret-that-is-long-enough',
      receipts: store,
      resend,
      render: () => message,
      log: vi.fn(),
    });
    expect(report.dryRun).toBe(1);
    expect(store.reserve).not.toHaveBeenCalled();
    expect(store.sentBefore).not.toHaveBeenCalled();
    expect(resend.send).not.toHaveBeenCalled();
  });
});

describe('daily email first delivery', () => {
  const run = (store: DeliveryReceiptStore, render = vi.fn(() => message)) => ({
    render,
    report: deliverDailyEmails({
      recipients: [recipient('one@example.com')],
      editionDate: publication.date,
      limit: 1,
      dryRun: false,
      hashSecret: 'recipient-hash-secret-that-is-long-enough',
      receipts: store,
      resend: { send: vi.fn().mockResolvedValue('provider') },
      render,
      log: vi.fn(),
    }),
  });
  const storeWith = (sentBefore: DeliveryReceiptStore['sentBefore']): DeliveryReceiptStore => ({
    reserve: vi.fn().mockResolvedValue(LEASE_TOKEN),
    markSent: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    sentBefore,
  });

  it('tells the renderer when no earlier edition reached the recipient', async () => {
    const first = run(storeWith(vi.fn().mockResolvedValue(false)));
    await expect(first.report).resolves.toMatchObject({ sent: 1, failed: 0 });
    expect(first.render).toHaveBeenCalledWith(expect.objectContaining({ email: 'one@example.com' }), { firstDelivery: true });
    const later = run(storeWith(vi.fn().mockResolvedValue(true)));
    await expect(later.report).resolves.toMatchObject({ sent: 1, failed: 0 });
    expect(later.render).toHaveBeenCalledWith(expect.anything(), { firstDelivery: false });
  });

  it('sends nothing and releases the receipt when the history lookup fails', async () => {
    const store = storeWith(vi.fn().mockRejectedValue(new Error('database down')));
    const attempt = run(store);
    await expect(attempt.report).resolves.toMatchObject({ reserved: 1, sent: 0, failed: 1 });
    expect(attempt.render).not.toHaveBeenCalled();
    expect(store.markFailed).toHaveBeenCalledOnce();
    expect(store.markSent).not.toHaveBeenCalled();
  });

  it('asks Supabase only for an earlier sent edition of this recipient', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ edition_date: '2026-07-19' }]), { status: 200 }));
    const store = createSupabaseDeliveryReceiptStore({
      fetchImpl: fetcher, supabaseUrl: 'https://project.supabase.co', serviceKey: 'service-key',
    });
    await expect(store.sentBefore(publication.date, 'a'.repeat(64))).resolves.toBe(false);
    await expect(store.sentBefore(publication.date, 'a'.repeat(64))).resolves.toBe(true);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toBe('/rest/v1/daily_email_deliveries');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      select: 'edition_date',
      recipient_hash: `eq.${'a'.repeat(64)}`,
      status: 'eq.sent',
      edition_date: `lt.${publication.date}`,
      limit: '1',
    });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'GET' });
  });
});
