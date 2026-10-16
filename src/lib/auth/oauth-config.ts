/**
 * Google and Apple sign-in: which providers this build shows, where the
 * provider returns to, and how the return address is read. Pure and free of
 * the Supabase library, so a page can decide what to render without loading
 * it. Each provider stays hidden until its public build flag is exactly "1";
 * the committed and default state is off, so nothing appears before the
 * provider is set up in Supabase.
 */

export const OAUTH_PROVIDERS = ['google', 'apple'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const OAUTH_PROVIDER_FLAGS: Readonly<Record<OAuthProvider, string>> = Object.freeze({
  google: 'PUBLIC_AUTH_GOOGLE',
  apple: 'PUBLIC_AUTH_APPLE',
});

/** The provider's own wording, from its brand guidelines. */
export const OAUTH_PROVIDER_LABELS: Readonly<Record<OAuthProvider, string>> = Object.freeze({
  google: 'Continue with Google',
  apple: 'Continue with Apple',
});

export interface OAuthPublicEnv {
  PUBLIC_AUTH_GOOGLE?: string;
  PUBLIC_AUTH_APPLE?: string;
}

export function enabledOAuthProviders(
  env: OAuthPublicEnv = {
    PUBLIC_AUTH_GOOGLE: import.meta.env.PUBLIC_AUTH_GOOGLE,
    PUBLIC_AUTH_APPLE: import.meta.env.PUBLIC_AUTH_APPLE,
  },
): OAuthProvider[] {
  return OAUTH_PROVIDERS.filter((provider) => env[OAUTH_PROVIDER_FLAGS[provider] as keyof OAuthPublicEnv] === '1');
}

export const OAUTH_CALLBACK_PATH = '/auth/callback/';
export const DEFAULT_RETURN_PATH = '/profile/';
const RETURN_PATH_MAX = 512;

/**
 * A same-site path to return to after sign-in, or the fallback. Only a plain
 * absolute path is accepted: no scheme, no host, no protocol-relative `//`,
 * no backslash, no control characters, and never the callback itself.
 */
export function safeReturnPath(raw: unknown, fallback: string = DEFAULT_RETURN_PATH): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > RETURN_PATH_MAX) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f\s]/u.test(raw)) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(raw, 'https://zodiacs.invalid');
  } catch {
    return fallback;
  }
  if (parsed.origin !== 'https://zodiacs.invalid') return fallback;
  if (parsed.pathname.startsWith(OAUTH_CALLBACK_PATH.slice(0, -1))) return fallback;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** The address the provider sends the browser back to, carrying `next`. */
export function oauthRedirectTo(origin: string, next: unknown): string {
  const url = new URL(OAUTH_CALLBACK_PATH, origin);
  url.searchParams.set('next', safeReturnPath(next));
  return url.toString();
}

export type OAuthCallbackRead =
  | { kind: 'code'; code: string; next: string }
  | { kind: 'error'; message: string; next: string }
  | { kind: 'none'; next: string };

const PROVIDER_ERROR_MAX = 200;

/**
 * Reads the return address. Supabase puts `code` in the query for the PKCE
 * flow; a refusal (for example, the person pressed Cancel) arrives as
 * `error` / `error_description` in the query or the fragment.
 */
export function readOAuthCallback(href: string): OAuthCallbackRead {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { kind: 'none', next: DEFAULT_RETURN_PATH };
  }
  const next = safeReturnPath(url.searchParams.get('next'));
  const fragment = new URLSearchParams(url.hash.slice(1));
  const error = url.searchParams.get('error') ?? fragment.get('error');
  if (error) {
    const description = url.searchParams.get('error_description') ?? fragment.get('error_description') ?? '';
    const message = description.replace(/[\u0000-\u001f\u007f]/gu, ' ').trim().slice(0, PROVIDER_ERROR_MAX);
    return { kind: 'error', message: message || 'Sign-in was not completed.', next };
  }
  const code = url.searchParams.get('code');
  if (code && /^[A-Za-z0-9._~-]{1,512}$/u.test(code)) return { kind: 'code', code, next };
  return { kind: 'none', next };
}
