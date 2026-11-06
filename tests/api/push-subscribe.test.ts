import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, {
  enrollmentRow,
  isAllowedSiteRequest,
  parseStatusRequest,
  parseSubscription,
  parseTopic,
  parseUnsubscribe,
} from '../../api/push/subscribe.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

function responseRecorder() {
  return {
    statusCode: 0,
    headers: new Map<string, string>(),
    body: '',
    setHeader(name: string, value: string) { this.headers.set(name, value); },
    end(value: string) { this.body = value; },
  };
}

describe('push subscription API input', () => {
  it('accepts the minimum browser subscription and normalizes language', () => {
    expect(parseSubscription({
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/example',
      keys: { p256dh: 'public_key-123', auth: 'auth_key-456' },
      lang: 'es',
    })).toEqual({
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/example',
      keys: { p256dh: 'public_key-123', auth: 'auth_key-456' },
      lang: 'es',
    });
    expect(parseSubscription({
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/portuguese',
      keys: { p256dh: 'public_key-123', auth: 'auth_key-456' },
      lang: 'pt-BR',
    })?.lang).toBe('pt');
    expect(parseSubscription({
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/portuguese',
      keys: { p256dh: 'public_key-123', auth: 'auth_key-456' },
      lang: 'pt',
    })?.lang).toBe('pt');
    expect(parseSubscription({
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/french',
      keys: { p256dh: 'public_key-123', auth: 'auth_key-456' },
      lang: 'fr-FR',
    })?.lang).toBe('fr');
    expect(parseSubscription({
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/italian',
      keys: { p256dh: 'public_key-123', auth: 'auth_key-456' },
      lang: 'it-IT',
    })?.lang).toBe('it');
  });

  it('rejects insecure endpoints and incomplete keys', () => {
    expect(parseSubscription({ endpoint: 'http://push.test/x', keys: { p256dh: 'a', auth: 'b' } })).toBeNull();
    expect(parseSubscription({ endpoint: 'https://push.test/x', keys: { p256dh: 'a' } })).toBeNull();
    expect(parseUnsubscribe({ endpoint: 'javascript:alert(1)' })).toBeNull();
  });

  it('accepts only known push-service hosts on subscribe, any https host on unsubscribe', () => {
    const keys = { p256dh: 'public_key-123', auth: 'auth_key-456' };
    expect(parseSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/example', keys })).not.toBeNull();
    expect(parseSubscription({ endpoint: 'https://web.push.apple.com/QOexample', keys })).not.toBeNull();
    expect(parseSubscription({ endpoint: 'https://sin.notify.windows.com/w/?token=x', keys })).not.toBeNull();
    // Junk hosts must not enter the table, including lookalike prefixes.
    expect(parseSubscription({ endpoint: 'https://attacker.test/flood', keys })).toBeNull();
    expect(parseSubscription({ endpoint: 'https://notify.windows.com.attacker.test/x', keys })).toBeNull();
    // Cleanup of anything previously stored stays possible.
    expect(parseUnsubscribe({ endpoint: 'https://attacker.test/flood' })).toBe('https://attacker.test/flood');
  });

  it('allows the exact serving production or preview origin only', () => {
    const request = (origin: string, host = 'zodiacs.org') => ({ headers: { origin, host } });
    expect(isAllowedSiteRequest(request('https://zodiacs.org'))).toBe(true);
    expect(isAllowedSiteRequest(request('https://zodiacs-preview.vercel.app', 'zodiacs-preview.vercel.app'))).toBe(true);
    expect(isAllowedSiteRequest(request('https://attacker.test'))).toBe(false);
    expect(isAllowedSiteRequest(request('http://zodiacs.org'))).toBe(false);
    expect(isAllowedSiteRequest({ headers: { host: 'zodiacs.org' } })).toBe(false);
  });

  it('round-trips subscribe and unsubscribe through mocked service-role PostgREST calls', async () => {
    process.env.PUSH_ENABLED = '1';
    process.env.PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const base = { headers: { origin: 'https://zodiacs.org', host: 'zodiacs.org' } };
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/subscription',
      keys: { p256dh: 'public-key', auth: 'auth-key' },
      lang: 'en',
    };

    const subscribeResponse = responseRecorder();
    await handler({ ...base, method: 'POST', body: subscription }, subscribeResponse);
    expect(subscribeResponse.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(1,
      'https://project.supabase.co/rest/v1/push_subscriptions?on_conflict=endpoint',
      expect.objectContaining({ method: 'POST' }),
    );

    const unsubscribeResponse = responseRecorder();
    await handler({ ...base, method: 'DELETE', body: { endpoint: subscription.endpoint } }, unsubscribeResponse);
    expect(unsubscribeResponse.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      'https://project.supabase.co/rest/v1/push_subscriptions?endpoint=eq.https%3A%2F%2Ffcm.googleapis.com%2Ffcm%2Fsend%2Fsubscription',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('keeps each stream flag apart and deletes the row only when no stream is left', async () => {
    process.env.PUSH_ENABLED = '1';
    process.env.PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    const base = { headers: { origin: 'https://zodiacs.org', host: 'zodiacs.org' } };
    const endpoint = 'https://fcm.googleapis.com/fcm/send/subscription';
    const keys = { p256dh: 'public-key', auth: 'auth-key' };
    const rows = 'https://project.supabase.co/rest/v1/push_subscriptions';
    const match = `endpoint=eq.${encodeURIComponent(endpoint)}`;
    const json = (value: unknown) => ({ ok: true, status: 200, json: async () => value });

    // Topics parse strictly; a missing one is Sky Alerts.
    expect(parseTopic(undefined)).toBe('sky');
    expect(parseTopic('lunation')).toBe('lunation');
    expect(parseTopic('everything')).toBeNull();
    expect(parseStatusRequest({ action: 'status', endpoint })).toBe(endpoint);
    expect(parseStatusRequest({ endpoint })).toBeNull();

    // Enrolling one stream sends only that stream's flag, so the other
    // stream's flag is never overwritten. Only Sky Alerts carry a language.
    const parsed = parseSubscription({ endpoint, keys, lang: 'es' })!;
    expect(enrollmentRow(parsed, 'sky')).toEqual({
      endpoint, p256dh: 'public-key', auth: 'auth-key', lang: 'es', sky_alerts: true,
    });
    expect(enrollmentRow(parsed, 'lunation')).toEqual({
      endpoint, p256dh: 'public-key', auth: 'auth-key', lunation_reminders: true,
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const enroll = responseRecorder();
    await handler({ ...base, method: 'POST', body: { endpoint, keys, lang: 'en', topic: 'lunation' } }, enroll);
    expect(enroll.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenLastCalledWith(`${rows}?on_conflict=endpoint`, expect.objectContaining({ method: 'POST' }));
    const sent = JSON.parse(fetchMock.mock.lastCall![1].body);
    expect(sent).toEqual({ endpoint, p256dh: 'public-key', auth: 'auth-key', lunation_reminders: true });
    expect(sent).not.toHaveProperty('sky_alerts');

    const unknown = responseRecorder();
    await handler({ ...base, method: 'POST', body: { endpoint, keys, topic: 'everything' } }, unknown);
    expect(unknown.statusCode).toBe(400);

    // Status: the endpoint alone reads back the two flags.
    fetchMock.mockReset().mockResolvedValueOnce(json([{ sky_alerts: true, lunation_reminders: false }]));
    const status = responseRecorder();
    await handler({ ...base, method: 'POST', body: { action: 'status', endpoint } }, status);
    expect(JSON.parse(status.body)).toEqual({ ok: true, topics: { sky: true, lunation: false } });
    expect(fetchMock.mock.calls[0][0]).toBe(`${rows}?${match}&select=sky_alerts,lunation_reminders`);
    fetchMock.mockReset().mockResolvedValueOnce(json([]));
    const missing = responseRecorder();
    await handler({ ...base, method: 'POST', body: { action: 'status', endpoint } }, missing);
    expect(JSON.parse(missing.body)).toEqual({ ok: true, topics: { sky: false, lunation: false } });

    // Leaving the only stream deletes the row.
    fetchMock.mockReset().mockResolvedValueOnce(json([{ endpoint }]));
    const alone = responseRecorder();
    await handler({ ...base, method: 'DELETE', body: { endpoint, topic: 'lunation' } }, alone);
    expect(JSON.parse(alone.body)).toEqual({ ok: true, remaining: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${rows}?${match}&sky_alerts=is.false&select=endpoint`);
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');

    // Leaving one of two streams clears only its flag and keeps the row.
    fetchMock.mockReset()
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([{ endpoint }]));
    const shared = responseRecorder();
    await handler({ ...base, method: 'DELETE', body: { endpoint, topic: 'lunation' } }, shared);
    expect(JSON.parse(shared.body)).toEqual({ ok: true, remaining: true });
    expect(fetchMock.mock.calls[1][0]).toBe(`${rows}?${match}&select=endpoint`);
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ lunation_reminders: false });

    // Sky Alerts leave the same way, keeping a Moon journal reminder.
    fetchMock.mockReset()
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([{ endpoint }]));
    const sky = responseRecorder();
    await handler({ ...base, method: 'DELETE', body: { endpoint, topic: 'sky' } }, sky);
    expect(JSON.parse(sky.body)).toEqual({ ok: true, remaining: true });
    expect(fetchMock.mock.calls[0][0]).toBe(`${rows}?${match}&lunation_reminders=is.false&select=endpoint`);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ sky_alerts: false });
  });
});

describe('push topics migration', () => {
  it('is additive: existing subscribers keep Sky Alerts and nothing is dropped or deleted', () => {
    const sql = readFileSync('supabase/migrations/20261106090000_push_subscription_topics.sql', 'utf8')
      .replace(/--[^\n]*/gu, '');
    expect(sql).not.toMatch(/\b(?:drop|delete|truncate|update)\b/iu);
    expect(sql).toContain('add column if not exists sky_alerts boolean not null default true;');
    expect(sql).toContain('alter column sky_alerts set default false;');
    expect(sql).toContain('add column if not exists lunation_reminders boolean not null default false;');
    expect(sql).toContain('check (sky_alerts or lunation_reminders)');
  });
});
