/**
 * "Continue with Google" / "Continue with Apple", above the email sign-in.
 * Each button appears only when its public build flag is on
 * (oauth-config.ts); with no provider enabled this renders nothing. The
 * marks are inline SVG and the buttons follow each provider's published
 * button rules: Google's light theme and Apple's white style, both meant for
 * dark backgrounds, with the providers' own wording.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import {
  OAUTH_PROVIDER_LABELS,
  enabledOAuthProviders,
  type OAuthProvider,
} from '../lib/auth/oauth-config';
import '../styles/account.css';

function GoogleMark() {
  return (
    <svg class="oauth__mark" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg class="oauth__mark" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

const MARKS: Record<OAuthProvider, () => JSX.Element> = { google: GoogleMark, apple: AppleMark };

interface Props {
  /** Same-site path to come back to after signing in; defaults to this page. */
  next?: string;
  /** Overrides the build flags; tests and the screenshot drive use it. */
  providers?: OAuthProvider[];
  /** Words under the buttons, before the email form. */
  divider?: string;
}

export default function OAuthButtons({ next, providers, divider = 'or use your email' }: Props) {
  const shown = providers ?? enabledOAuthProviders();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [message, setMessage] = useState('');
  if (shown.length === 0) return null;

  async function start(provider: OAuthProvider) {
    setBusy(provider);
    setMessage('');
    try {
      const { continueWithProvider } = await import('../lib/auth/oauth');
      const result = await continueWithProvider(provider, next);
      if (!result.ok) {
        setMessage(result.message);
        setBusy(null);
      }
    } catch {
      setMessage('Sign-in could not start. Check your connection and try again.');
      setBusy(null);
    }
  }

  return (
    <div class="oauth" data-oauth-sign-in>
      <div class="oauth__buttons">
        {shown.map((provider) => {
          const Mark = MARKS[provider];
          return (
            <button
              key={provider}
              type="button"
              class={`oauth__btn oauth__btn--${provider}`}
              onClick={() => void start(provider)}
              disabled={busy !== null}
              aria-busy={busy === provider}
              data-oauth-provider={provider}
            >
              <Mark />
              <span>{OAUTH_PROVIDER_LABELS[provider]}</span>
            </button>
          );
        })}
      </div>
      {message && <p class="oauth__message" role="alert">{message}</p>}
      <p class="oauth__or"><span>{divider}</span></p>
    </div>
  );
}
