import { afterEach, describe, expect, it, vi } from 'vitest';

// email_subscribed is counted only once the server has accepted the sign-up
// (docs/ANALYTICS.md). This drives the real submit handler on a minimal form.

type Handler = (event: unknown) => unknown;

function setup(respond: () => Promise<{ ok: boolean }>) {
  const handlers: Record<string, Handler> = {};
  const element = (extra: Record<string, unknown> = {}) => ({ textContent: '', dataset: {}, ...extra });
  const button = element({ disabled: false, dataset: { label: 'Sign up', busyLabel: 'Sending' } });
  const status = element();
  const email = element({ validity: { valid: true }, value: 'visitor@example.com', reportValidity: () => true, focus: () => {} });
  const parts: Record<string, unknown> = {
    'button[type="submit"]': button,
    '[data-email-status]': status,
    'input[name="email"]': email,
    'input[name="sign"]:checked': null,
    '[data-success-copy]': element({ textContent: 'Check your inbox.' }),
    '[data-error-copy]': element({ textContent: 'Try again.' }),
  };
  const form = {
    action: '/api/email/subscribe',
    dataset: { placement: 'horoscopes' } as Record<string, string>,
    isConnected: true,
    addEventListener: (type: string, handler: Handler) => { handlers[type] = handler; },
    querySelector: (selector: string) => parts[selector] ?? null,
    querySelectorAll: () => [],
    closest: () => null,
    reportValidity: () => true,
    reset: vi.fn(),
  };
  const track = vi.fn();
  vi.stubGlobal('window', { zodiacsAnalytics: { track }, addEventListener: () => {} });
  vi.stubGlobal('document', {
    querySelectorAll: (selector: string) => (selector === '[data-email-capture]' ? [form] : []),
  });
  vi.stubGlobal('FormData', class { [Symbol.iterator]() { return [][Symbol.iterator](); } });
  const fetch = vi.fn(respond);
  vi.stubGlobal('fetch', fetch);
  return {
    track,
    fetch,
    status,
    submit: () => handlers.submit({ preventDefault: () => {} }) as Promise<void>,
  };
}

async function load() {
  vi.resetModules();
  const { enhanceEmailCapture } = await import('./capture-enhancement.js');
  enhanceEmailCapture();
}

describe('email_subscribed', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fires once with the placement after the server accepts the sign-up', async () => {
    const page = setup(async () => ({ ok: true }));
    await load();
    await page.submit();
    expect(page.fetch).toHaveBeenCalledTimes(1);
    expect(page.track).toHaveBeenCalledTimes(1);
    expect(page.track).toHaveBeenCalledWith('email_subscribed', { placement: 'horoscopes' });
    expect(page.status.textContent).toBe('Check your inbox.');
  });

  it('does not fire when the server refuses the sign-up', async () => {
    const page = setup(async () => ({ ok: false }));
    await load();
    await page.submit();
    expect(page.fetch).toHaveBeenCalledTimes(1);
    expect(page.track).not.toHaveBeenCalled();
    expect(page.status.textContent).toBe('Try again.');
  });

  it('does not fire when the request fails', async () => {
    const page = setup(async () => { throw new TypeError('offline'); });
    await load();
    await page.submit();
    expect(page.track).not.toHaveBeenCalled();
    expect(page.status.textContent).toBe('Try again.');
  });

  it('never sends the email address', async () => {
    const page = setup(async () => ({ ok: true }));
    await load();
    await page.submit();
    expect(JSON.stringify(page.track.mock.calls)).not.toContain('visitor@example.com');
  });
});
