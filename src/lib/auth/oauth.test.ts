import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = {
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
};
let configured = true;

vi.mock('../supabase/client', () => ({
  getPkceAuthClient: () => (configured ? { auth } : null),
}));

const { continueWithProvider, finishOAuthSignIn } = await import('./oauth');

beforeEach(() => {
  configured = true;
  auth.signInWithOAuth.mockReset().mockResolvedValue({ data: {}, error: null });
  auth.exchangeCodeForSession.mockReset().mockResolvedValue({ data: {}, error: null });
  vi.stubGlobal('window', { location: { origin: 'https://zodiacs.org', pathname: '/compatibility/' } });
});

describe('continueWithProvider', () => {
  it('asks Supabase for the provider with the callback as the return address', async () => {
    await expect(continueWithProvider('google', '/profile/')).resolves.toEqual({ ok: true });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://zodiacs.org/auth/callback/?next=%2Fprofile%2F' },
    });
  });

  it('returns to the current page by default', async () => {
    await continueWithProvider('apple');
    expect(auth.signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe('https://zodiacs.org/auth/callback/?next=%2Fcompatibility%2F');
  });

  it('reports a provider that is not set up', async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: { message: 'Unsupported provider: provider is not enabled' } });
    await expect(continueWithProvider('apple')).resolves.toEqual({ ok: false, message: 'Unsupported provider: provider is not enabled' });
    configured = false;
    await expect(continueWithProvider('apple')).resolves.toMatchObject({ ok: false });
  });
});

describe('finishOAuthSignIn', () => {
  it('exchanges the code and goes on to next', async () => {
    await expect(finishOAuthSignIn('https://zodiacs.org/auth/callback/?next=%2Fprofile%2F&code=abc-123'))
      .resolves.toEqual({ ok: true, next: '/profile/' });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc-123');
  });

  it('does not exchange anything on a refusal or a missing code', async () => {
    await expect(finishOAuthSignIn('https://zodiacs.org/auth/callback/?error=access_denied'))
      .resolves.toMatchObject({ ok: false, next: '/profile/' });
    await expect(finishOAuthSignIn('https://zodiacs.org/auth/callback/'))
      .resolves.toMatchObject({ ok: false });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('reports a failed exchange in plain words', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: 'invalid flow state' } });
    const result = await finishOAuthSignIn('https://zodiacs.org/auth/callback/?code=abc');
    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? '' : result.message).toContain('same browser');
  });
});
