/**
 * /auth/callback/: where Google and Apple sign-in come back. Exchanges the
 * one-time code for a session in this browser, takes the code out of the
 * address bar, then goes on to the page the person started from.
 */
import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_RETURN_PATH } from '../lib/auth/oauth-config';

export default function OAuthCallback() {
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const href = window.location.href;
    // The code is single-use; keep it out of history and any later copy of the address.
    history.replaceState(null, '', window.location.pathname);
    void import('../lib/auth/oauth')
      .then(({ finishOAuthSignIn }) => finishOAuthSignIn(href))
      .then((result) => {
        if (!active) return;
        if (result.ok) window.location.replace(result.next);
        else setFailure(result.message);
      })
      .catch(() => {
        if (active) setFailure('Sign-in could not be finished. Check your connection and try again.');
      });
    return () => { active = false; };
  }, []);

  if (!failure) return <p class="lede" role="status">One moment while your profile opens.</p>;
  return (
    <div role="alert">
      <p class="lede">{failure}</p>
      <p><a class="btn btn--primary" href={`${DEFAULT_RETURN_PATH}#profile-sync`}><span>Back to sign in</span><span class="orb" aria-hidden="true">→</span></a></p>
    </div>
  );
}
