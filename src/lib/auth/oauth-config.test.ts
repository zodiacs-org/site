import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETURN_PATH,
  OAUTH_CALLBACK_PATH,
  OAUTH_PROVIDER_LABELS,
  enabledOAuthProviders,
  oauthRedirectTo,
  readOAuthCallback,
  safeReturnPath,
} from './oauth-config';

describe('enabledOAuthProviders', () => {
  it('shows no provider by default', () => {
    expect(enabledOAuthProviders({})).toEqual([]);
  });

  it('shows a provider only for the exact value "1"', () => {
    expect(enabledOAuthProviders({ PUBLIC_AUTH_GOOGLE: '1' })).toEqual(['google']);
    expect(enabledOAuthProviders({ PUBLIC_AUTH_APPLE: '1' })).toEqual(['apple']);
    expect(enabledOAuthProviders({ PUBLIC_AUTH_GOOGLE: '1', PUBLIC_AUTH_APPLE: '1' })).toEqual(['google', 'apple']);
    expect(enabledOAuthProviders({ PUBLIC_AUTH_GOOGLE: 'true', PUBLIC_AUTH_APPLE: '0' })).toEqual([]);
  });

  it('uses the providers’ own button wording', () => {
    expect(OAUTH_PROVIDER_LABELS).toEqual({ google: 'Continue with Google', apple: 'Continue with Apple' });
  });
});

describe('safeReturnPath', () => {
  it('keeps a same-site path with its query and fragment', () => {
    expect(safeReturnPath('/profile/')).toBe('/profile/');
    expect(safeReturnPath('/compatibility/?pair=1#x')).toBe('/compatibility/?pair=1#x');
  });

  it.each([
    'https://evil.example/',
    '//evil.example/',
    '/\\evil.example',
    'profile/',
    '/pro file/',
    '/profile/\n',
    'javascript:alert(1)',
    OAUTH_CALLBACK_PATH,
    '/auth/callback?next=/x',
    '',
    null,
    42,
    `/${'a'.repeat(600)}`,
  ])('falls back for %s', (value) => {
    expect(safeReturnPath(value)).toBe(DEFAULT_RETURN_PATH);
  });
});

describe('oauthRedirectTo', () => {
  it('returns to the callback with the page to go on to', () => {
    expect(oauthRedirectTo('https://zodiacs.org', '/profile/')).toBe('https://zodiacs.org/auth/callback/?next=%2Fprofile%2F');
  });

  it('never carries an off-site next', () => {
    expect(oauthRedirectTo('http://localhost:4321', 'https://evil.example/')).toBe('http://localhost:4321/auth/callback/?next=%2Fprofile%2F');
  });
});

describe('readOAuthCallback', () => {
  it('reads the PKCE code and the next path', () => {
    expect(readOAuthCallback('https://zodiacs.org/auth/callback/?next=%2Fprofile%2F&code=4f8c2a1e-7b0d-4c55-9a3e-2f1b6d8e9c00'))
      .toEqual({ kind: 'code', code: '4f8c2a1e-7b0d-4c55-9a3e-2f1b6d8e9c00', next: '/profile/' });
  });

  it('reads a refusal from the query or the fragment', () => {
    expect(readOAuthCallback('https://zodiacs.org/auth/callback/?error=access_denied&error_description=User+cancelled'))
      .toEqual({ kind: 'error', message: 'User cancelled', next: '/profile/' });
    expect(readOAuthCallback('https://zodiacs.org/auth/callback/#error=server_error'))
      .toEqual({ kind: 'error', message: 'Sign-in was not completed.', next: '/profile/' });
  });

  it('refuses a malformed code and an unsafe next', () => {
    expect(readOAuthCallback('https://zodiacs.org/auth/callback/?code=%3Cscript%3E&next=//evil.example'))
      .toEqual({ kind: 'none', next: '/profile/' });
  });
});
