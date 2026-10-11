import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from '@vercel/firewall';
import subscribeHandler from '../../../api/email/subscribe';
import confirmHandler from '../../../api/email/_confirm';
import { hasEmailCaptureProvider, hasStandaloneWeeklyEmailCapture } from './config';
import { createEmailSubscriptionAdapter } from './provider';
import {
  createEmailOptInToken,
  EMAIL_CONFIRMATION_TOKEN_MAX_CHARS,
  EMAIL_OPT_IN_LEGACY_ACCEPT_UNTIL_MS,
  EMAIL_OPT_IN_TTL_MS,
  verifyEmailOptInToken,
} from './opt-in-token';
import { parseEmailSubscription } from './input';
import { emailStatusPage } from './server-page';

const ORIGINAL_ENV = { ...process.env };
const SECRET = 'test-secret-that-is-at-least-thirty-two-characters';

vi.mock('@vercel/firewall', () => ({ checkRateLimit: vi.fn() }));

beforeEach(() => {
  vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: false } as never);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.mocked(checkRateLimit).mockReset();
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

const SITE_HEADERS = {
  origin: 'https://zodiacs.org',
  host: 'zodiacs.org',
  accept: 'application/json',
};

describe('email capture configuration', () => {
  it('stays hidden without a fully configured provider', () => {
    expect(hasEmailCaptureProvider({})).toBe(false);
    expect(hasEmailCaptureProvider({ EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_test' })).toBe(false);
    expect(hasEmailCaptureProvider({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_same',
      RESEND_CONTACTS_API_KEY: 're_same',
      RESEND_FROM_EMAIL: 'Zodiacs.org <hello@zodiacs.org>',
      EMAIL_CONFIRM_SECRET: SECRET,
    })).toBe(false);
    expect(hasEmailCaptureProvider({
      EMAIL_PROVIDER: 'loops',
      LOOPS_FORM_ENDPOINT: 'https://app.loops.so/api/newsletter-form/form_123',
    })).toBe(false);
  });

  it('requires Loops form double opt-in acknowledgement and blocks arbitrary endpoints', () => {
    expect(hasEmailCaptureProvider({
      EMAIL_PROVIDER: 'loops',
      LOOPS_FORM_ENDPOINT: 'https://app.loops.so/api/newsletter-form/form_123',
      LOOPS_DOUBLE_OPT_IN_CONFIRMED: '1',
    })).toBe(true);
    expect(hasEmailCaptureProvider({
      EMAIL_PROVIDER: 'loops',
      LOOPS_FORM_ENDPOINT: 'https://attacker.test/api/newsletter-form/form_123',
      LOOPS_DOUBLE_OPT_IN_CONFIRMED: '1',
    })).toBe(false);
  });

  it('keeps standalone weekly capture off until its sender lifecycle is explicitly released', () => {
    const resend = {
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_sending_test',
      RESEND_CONTACTS_API_KEY: 're_contacts_test',
      RESEND_FROM_EMAIL: 'Zodiacs.org <hello@zodiacs.org>',
      EMAIL_CONFIRM_SECRET: SECRET,
    };
    expect(hasEmailCaptureProvider(resend)).toBe(true);
    expect(hasStandaloneWeeklyEmailCapture(resend)).toBe(false);
    expect(hasStandaloneWeeklyEmailCapture({
      ...resend,
      STANDALONE_WEEKLY_EMAIL_ENABLED: '1',
    })).toBe(false);
    expect(hasStandaloneWeeklyEmailCapture({
      ...resend,
      STANDALONE_WEEKLY_EMAIL_ENABLED: '1',
      RESEND_SEGMENT_ID: 'seg_weekly',
    })).toBe(true);
    expect(hasStandaloneWeeklyEmailCapture({
      ...resend,
      STANDALONE_WEEKLY_EMAIL_ENABLED: '1',
      RESEND_SEGMENT_ID: 'bad id',
    })).toBe(false);
    expect(hasStandaloneWeeklyEmailCapture({
      ...resend,
      STANDALONE_WEEKLY_EMAIL_ENABLED: '1',
      RESEND_SEGMENT_ID: 'short',
    })).toBe(false);
    expect(hasStandaloneWeeklyEmailCapture({
      ...resend,
      STANDALONE_WEEKLY_EMAIL_ENABLED: '1',
      RESEND_SEGMENT_ID: 'seg_weekly',
      RESEND_DAILY_SEGMENT_ID: 'seg_weekly',
    })).toBe(false);
    expect(hasStandaloneWeeklyEmailCapture({
      ...resend,
      STANDALONE_WEEKLY_EMAIL_ENABLED: '1',
      RESEND_SEGMENT_ID: 'seg_weekly',
      RESEND_DAILY_SEGMENT_ID: 'bad daily id',
    })).toBe(false);
    expect(hasStandaloneWeeklyEmailCapture({
      ...resend,
      STANDALONE_WEEKLY_EMAIL_ENABLED: '1',
      RESEND_SEGMENT_ID: 'seg_weekly',
      RESEND_DAILY_SEGMENT_ID: 'seg_daily',
    })).toBe(true);
  });
});

describe('email capture input', () => {
  it('normalizes only email, optional sign, and locale', () => {
    expect(parseEmailSubscription({
      email: ' Person@Example.COM ', sign: 'libra', locale: 'es',
      birthDate: '1990-01-01', birthTime: '12:00', birthplace: 'private',
    })).toEqual({
      email: 'person@example.com', sign: 'libra', locale: 'es', honeypot: false,
    });
  });

  it('rejects malformed email and non-canonical signs', () => {
    expect(parseEmailSubscription({ email: 'not-an-email', sign: '' })).toBeNull();
    expect(parseEmailSubscription({ email: 'person@example.com', sign: 'ophiuchus' })).toBeNull();
  });

  it('preserves every locale rail, including regional Portuguese input', () => {
    expect(parseEmailSubscription({ email: 'pt@example.com', locale: 'pt-BR' })?.locale).toBe('pt');
    expect(parseEmailSubscription({ email: 'fr@example.com', locale: 'fr' })?.locale).toBe('fr');
    expect(parseEmailSubscription({ email: 'it@example.com', locale: 'it' })?.locale).toBe('it');
  });
});

describe('Resend first-party confirmation token', () => {
  it('round-trips a pending claim and rejects tampering or expiry', () => {
    const now = Date.UTC(2026, 6, 15);
    const token = createEmailOptInToken({
      email: 'person@example.com', sign: 'libra', locale: 'en',
    }, SECRET, now);
    expect(token).toMatch(/^v2\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(token.split('.')).toHaveLength(4);
    expect(token.split('.').slice(1).map((part) => (
      Buffer.from(part, 'base64url').toString('utf8')
    )).join('')).not.toContain('person@example.com');
    expect(verifyEmailOptInToken(token, SECRET, now + 1_000)).toMatchObject({
      email: 'person@example.com', sign: 'libra', locale: 'en',
      expiresAt: now + EMAIL_OPT_IN_TTL_MS,
    });
    expect(verifyEmailOptInToken(`${token}x`, SECRET, now)).toBeNull();
    expect(verifyEmailOptInToken(token, SECRET, now + EMAIL_OPT_IN_TTL_MS)).toBeNull();
  });

  it('rejects oversized and non-canonical encodings before decrypting them', () => {
    const now = Date.UTC(2026, 6, 15);
    const token = createEmailOptInToken({
      email: 'person@example.com', sign: 'libra', locale: 'en',
    }, SECRET, now);
    const [version, iv, encrypted, tag] = token.split('.');

    expect(verifyEmailOptInToken('A'.repeat(EMAIL_CONFIRMATION_TOKEN_MAX_CHARS + 1), SECRET, now))
      .toBeNull();
    for (const mutated of [
      `${version}.${iv}=.${encrypted}.${tag}`,
      `${version}.${iv}.${encrypted}!.${tag}`,
      `${version}.${iv}.${encrypted}.${tag}\n`,
    ]) {
      expect(verifyEmailOptInToken(mutated, SECRET, now)).toBeNull();
    }
  });

  it('accepts unexpired v1 links during the encrypted-token rollout window', () => {
    const now = Date.UTC(2026, 6, 15);
    const payload = Buffer.from(JSON.stringify({
      e: 'legacy@example.com', s: 'taurus', l: 'en', x: now + EMAIL_OPT_IN_TTL_MS,
    })).toString('base64url');
    const signature = createHmac('sha256', SECRET)
      .update(`zodiacs-email-capture-v1:${payload}`)
      .digest('base64url');
    const token = `${payload}.${signature}`;

    expect(verifyEmailOptInToken(token, SECRET, now + 1_000)).toMatchObject({
      email: 'legacy@example.com', sign: 'taurus', locale: 'en',
    });
    expect(verifyEmailOptInToken(token, SECRET, now + EMAIL_OPT_IN_TTL_MS)).toBeNull();
    expect(verifyEmailOptInToken(token, SECRET, EMAIL_OPT_IN_LEGACY_ACCEPT_UNTIL_MS)).toBeNull();
  });

  it('rejects authenticated legacy claims whose expiry exceeds the 48-hour window', () => {
    const now = Date.UTC(2026, 6, 15);
    const payload = Buffer.from(JSON.stringify({
      e: 'legacy@example.com', s: 'taurus', l: 'en', x: now + (3 * EMAIL_OPT_IN_TTL_MS),
    })).toString('base64url');
    const signature = createHmac('sha256', SECRET)
      .update(`zodiacs-email-capture-v1:${payload}`)
      .digest('base64url');
    expect(verifyEmailOptInToken(`${payload}.${signature}`, SECRET, now)).toBeNull();
  });

  it.each(['pt', 'fr', 'it'] as const)('round-trips the %s locale and renders its document language', (locale) => {
    const now = Date.UTC(2026, 6, 15);
    const token = createEmailOptInToken({
      email: `${locale}@example.com`, sign: null, locale,
    }, SECRET, now);
    expect(verifyEmailOptInToken(token, SECRET, now + 1_000)?.locale).toBe(locale);
    const page = emailStatusPage(locale, 'emailPendingTitle', 'emailPendingBody');
    expect(page).toContain(`<html lang="${locale === 'pt' ? 'pt-BR' : locale}">`);
  });
});

describe('Buttondown subscription adapter', () => {
  it('fails closed when the email WAF rule is absent or unavailable', async () => {
    for (const rateLimitResult of [
      { kind: 'result', value: { rateLimited: false, error: 'not-found' } },
      { kind: 'error', value: new Error('firewall unavailable') },
    ] as const) {
      if (rateLimitResult.kind === 'result') {
        vi.mocked(checkRateLimit).mockResolvedValueOnce(rateLimitResult.value as never);
      } else {
        vi.mocked(checkRateLimit).mockRejectedValueOnce(rateLimitResult.value);
      }
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);
      const response = responseRecorder();
      await subscribeHandler({
        method: 'POST',
        headers: SITE_HEADERS,
        body: { email: 'person@example.com', sign: 'aries', locale: 'en' },
      }, response);
      expect(response.statusCode).toBe(503);
      expect(JSON.parse(response.body)).toEqual({ error: 'unavailable' });
      expect(fetcher).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    }
  });

  it('creates an unactivated, double-opt-in subscriber without a type override', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const adapter = createEmailSubscriptionAdapter({
      EMAIL_PROVIDER: 'buttondown',
      BUTTONDOWN_API_KEY: 'buttondown-test-key',
    }, fetcher as unknown as typeof fetch);
    await expect(adapter?.subscribe('person@example.com', 'libra')).resolves.toEqual({
      provider: 'buttondown', pending: true,
    });
    const [, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toEqual({
      email_address: 'person@example.com',
      metadata: { sun_sign: 'libra' },
    });
    expect(JSON.parse(String(request.body))).not.toHaveProperty('type');
  });

  it('runs the same adapter through the public endpoint end to end', async () => {
    process.env.EMAIL_PROVIDER = 'buttondown';
    process.env.BUTTONDOWN_API_KEY = 'buttondown-test-key';
    process.env.STANDALONE_WEEKLY_EMAIL_ENABLED = '1';
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetcher);
    const response = responseRecorder();
    await subscribeHandler({
      method: 'POST',
      headers: SITE_HEADERS,
      body: {
        email: 'person@example.com', sign: 'aries', locale: 'en',
        birthDate: '1990-01-01', birthplace: 'must-not-cross-boundary',
      },
    }, response);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true, pending: true });
    const providerPayload = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(providerPayload).toEqual({
      email_address: 'person@example.com', metadata: { sun_sign: 'aries' },
    });
    expect(JSON.stringify(providerPayload)).not.toContain('birth');
  });

  it('does not consume the recipient cooldown when the provider send fails', async () => {
    process.env.EMAIL_PROVIDER = 'buttondown';
    process.env.BUTTONDOWN_API_KEY = 'buttondown-test-key';
    process.env.STANDALONE_WEEKLY_EMAIL_ENABLED = '1';
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetcher);
    const request = {
      method: 'POST',
      headers: SITE_HEADERS,
      body: { email: 'provider-retry@example.com', sign: 'aries', locale: 'en' },
    };

    const failed = responseRecorder();
    await subscribeHandler(request, failed);
    expect(failed.statusCode).toBe(502);

    const retried = responseRecorder();
    await subscribeHandler(request, retried);
    expect(retried.statusCode).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);

    const held = responseRecorder();
    await subscribeHandler(request, held);
    expect(held.statusCode).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('Resend and Loops subscription adapters', () => {
  it('sends a Resend confirmation that loads nothing remote, before creating any contact', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const adapter = createEmailSubscriptionAdapter({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_sending_test',
      RESEND_CONTACTS_API_KEY: 're_contacts_test',
      RESEND_FROM_EMAIL: 'Zodiacs.org <hello@zodiacs.org>',
      EMAIL_CONFIRM_SECRET: SECRET,
      EMAIL_CONFIRM_BASE_URL: 'https://zodiacs.org',
    }, fetcher as unknown as typeof fetch, 'en');
    await adapter?.subscribe('person@example.com', 'taurus');
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.resend.com/emails');
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('authorization'))
      .toBe('Bearer re_sending_test');
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      to: ['person@example.com'],
      subject: 'Confirm your Zodiacs.org weekly forecast',
    });
    expect(body.text).toContain('https://zodiacs.org/api/email/confirm?token=');

    // The confirmation may be styled, but opening it must still signal
    // nothing: no remote image, no stylesheet, no script, no CSS-fetched
    // asset. Its pictures are inline attachments referenced by cid:.
    // Anchors are fine — a link is only fetched if the reader chooses to.
    expect(body.html).toContain('https://zodiacs.org/api/email/confirm?token=');
    const sources = [...body.html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/giu)].map((match) => match[1]);
    expect(sources).toEqual(['cid:zodiacs-sign', 'cid:zodiacs-ring']);
    expect((body.html.match(/<img\b/giu) ?? []).length).toBe(sources.length);
    expect(body.attachments.map((item: { content_id: string; filename: string }) => [item.content_id, item.filename]))
      .toEqual([['zodiacs-ring', 'zodiacs-ring.png'], ['zodiacs-sign', 'taurus.png']]);
    for (const item of body.attachments) {
      expect(Buffer.from(item.content, 'base64').subarray(1, 4).toString('latin1')).toBe('PNG');
    }
    expect(body.html).not.toMatch(/<script\b/iu);
    expect(body.html).not.toMatch(/<link\b/iu);
    expect(body.html).not.toMatch(/\burl\s*\(/iu);
    expect(body.html).not.toMatch(/\bbackground(-image)?\s*[:=]\s*["']?(https?:)?\/\//iu);
    expect(fetcher.mock.calls.map((call) => call[0])).not.toContain('https://api.resend.com/contacts');
  });

  it('uses the Loops form endpoint so provider double opt-in applies', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const endpoint = 'https://app.loops.so/api/newsletter-form/form_123';
    const adapter = createEmailSubscriptionAdapter({
      EMAIL_PROVIDER: 'loops',
      LOOPS_FORM_ENDPOINT: endpoint,
      LOOPS_DOUBLE_OPT_IN_CONFIRMED: '1',
      LOOPS_MAILING_LIST_ID: 'list_public',
    }, fetcher as unknown as typeof fetch);
    await adapter?.subscribe('person@example.com', 'cancer');
    expect(fetcher.mock.calls[0]?.[0]).toBe(endpoint);
    const body = new URLSearchParams(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(Object.fromEntries(body)).toEqual({
      email: 'person@example.com',
      sunSign: 'cancer',
      mailingLists: 'list_public',
    });
  });
});

describe('Resend confirmation endpoint', () => {
  it('rejects oversized tokens before provider or database work', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_sending_test';
    process.env.RESEND_CONTACTS_API_KEY = 're_contacts_test';
    process.env.RESEND_FROM_EMAIL = 'Zodiacs.org <hello@zodiacs.org>';
    process.env.EMAIL_CONFIRM_SECRET = SECRET;
    process.env.STANDALONE_WEEKLY_EMAIL_ENABLED = '1';
    process.env.RESEND_SEGMENT_ID = 'seg_weekly';
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const token = 'A'.repeat(EMAIL_CONFIRMATION_TOKEN_MAX_CHARS + 1);

    for (const request of [
      { method: 'GET', query: { token } },
      { method: 'POST', body: new URLSearchParams({ token }).toString() },
    ]) {
      const response = responseRecorder();
      await confirmHandler(request, response);
      expect(response.statusCode).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('normalizes the confirmation secret identically when issuing and verifying links', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_sending_test';
    process.env.RESEND_CONTACTS_API_KEY = 're_contacts_test';
    process.env.RESEND_FROM_EMAIL = 'Zodiacs.org <hello@zodiacs.org>';
    process.env.EMAIL_CONFIRM_SECRET = `  ${SECRET}\n`;
    process.env.STANDALONE_WEEKLY_EMAIL_ENABLED = '1';
    process.env.RESEND_SEGMENT_ID = 'seg_weekly';
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetcher);
    const adapter = createEmailSubscriptionAdapter(process.env, fetcher as unknown as typeof fetch, 'en');
    await adapter?.subscribe('whitespace@example.com', 'virgo');
    const emailRequest = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    const confirmationUrl = String(emailRequest.text).match(/https:\/\/\S+/u)?.[0];
    if (!confirmationUrl) throw new Error('Confirmation URL was not sent.');
    const token = new URL(confirmationUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    const response = responseRecorder();
    await confirmHandler({ method: 'GET', query: { token } }, response);
    expect(response.statusCode).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('makes GET read-only and creates the contact only after POST confirmation', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_sending_test';
    process.env.RESEND_CONTACTS_API_KEY = 're_contacts_test';
    process.env.RESEND_FROM_EMAIL = 'Zodiacs.org <hello@zodiacs.org>';
    process.env.EMAIL_CONFIRM_SECRET = SECRET;
    process.env.STANDALONE_WEEKLY_EMAIL_ENABLED = '1';
    process.env.RESEND_SEGMENT_ID = 'seg_weekly';
    const token = createEmailOptInToken({
      email: 'person@example.com', sign: 'pisces', locale: 'en',
    }, SECRET);
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetcher);

    const getResponse = responseRecorder();
    await confirmHandler({ method: 'GET', query: { token } }, getResponse);
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body).toContain('method="post"');
    expect(getResponse.body).toContain('/assets/zodiac-icons/48/aries.webp');
    expect(getResponse.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(fetcher).not.toHaveBeenCalled();

    const postResponse = responseRecorder();
    await confirmHandler({
      method: 'POST', body: new URLSearchParams({ token }).toString(),
    }, postResponse);
    expect(postResponse.statusCode).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.resend.com/contacts');
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('authorization'))
      .toBe('Bearer re_contacts_test');
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      email: 'person@example.com',
      unsubscribed: false,
      properties: { sun_sign: 'pisces' },
      segments: [{ id: 'seg_weekly' }],
    });
  });
});
