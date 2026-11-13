/**
 * Google and Apple sign-in through Supabase, with PKCE. Starting sends the
 * browser to Supabase, which sends it on to the provider; the provider
 * returns to /auth/callback/, where the one-time code is exchanged for a
 * session in this browser. Nothing from the site is posted to the provider.
 */
import { getPkceAuthClient } from '../supabase/client';
import { oauthRedirectTo, readOAuthCallback, type OAuthProvider } from './oauth-config';

export type OAuthStartResult = { ok: true } | { ok: false; message: string };

export async function continueWithProvider(provider: OAuthProvider, next?: string): Promise<OAuthStartResult> {
  const client = getPkceAuthClient();
  if (!client) return { ok: false, message: 'Sign-in is not set up on this site yet.' };
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: oauthRedirectTo(window.location.origin, next ?? window.location.pathname) },
  });
  if (error) return { ok: false, message: error.message };
  // Supabase is already moving the browser to the provider.
  return { ok: true };
}

export type OAuthFinishResult =
  | { ok: true; next: string }
  | { ok: false; next: string; message: string };

export async function finishOAuthSignIn(href: string): Promise<OAuthFinishResult> {
  const read = readOAuthCallback(href);
  if (read.kind === 'error') return { ok: false, next: read.next, message: read.message };
  if (read.kind === 'none') return { ok: false, next: read.next, message: 'This sign-in link is missing its code. Try signing in again.' };
  const client = getPkceAuthClient();
  if (!client) return { ok: false, next: read.next, message: 'Sign-in is not set up on this site yet.' };
  const { error } = await client.auth.exchangeCodeForSession(read.code);
  if (error) {
    return {
      ok: false,
      next: read.next,
      message: 'Sign-in could not be finished in this browser. Start again from the same browser you began in.',
    };
  }
  return { ok: true, next: read.next };
}
