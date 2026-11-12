import { useState } from 'preact/hooks';
import { NextActionCard } from '../../components/NextActionCard';
import { requestInviteSignup, type InviteSignupOutcome } from '../../lib/invite/recipient';
import { signBySlug } from '../../lib/signs';

interface InviteSignupProps {
  handle: string;
  /** The inviter's label, as they chose it. */
  label: string;
  /** The recipient's own Sun sign, from the chart they just worked out. */
  sign: string;
}

/**
 * After the result of an invite, for someone 18 or older: an opt-in to their
 * own daily horoscope by email, laid out as the page's other next-step cards
 * (NextActionCard). Nothing is asked before the result, the box is unticked,
 * and the invite counts as finished only when they confirm the email the site
 * sends. Shown only while PUBLIC_INVITE_SIGNUP_ENABLED=1.
 */
export function InviteSignup({ handle, label, sign }: InviteSignupProps) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | InviteSignupOutcome>('idle');
  const signName = signBySlug(sign)?.name ?? sign;

  async function submit(event: Event) {
    event.preventDefault();
    if (!consent || state === 'sending') return;
    setState('sending');
    setState(await requestInviteSignup(handle, email, sign));
  }

  if (state === 'pending') {
    return (
      <NextActionCard
        className="invite-signup"
        cue="Nearly done"
        title="Check your inbox."
        body={`We sent one email to confirm. Your ${signName} daily starts once you confirm it, and that also tells the invitation it is finished.`}
        headingLevel={3}
        primary={<p class="field__help" role="status">Nothing changes until you confirm. Every email has an unsubscribe link.</p>}
      />
    );
  }

  return (
    <NextActionCard
      className="invite-signup"
      cue="If you'd like"
      title="Your own daily horoscope."
      body={`Each morning, the day’s reading for ${signName}. One email, free, unsubscribe any time. Confirming it finishes ${label}’s invitation.`}
      headingLevel={3}
      primary={(
        <form class="invite-signup__form" onSubmit={submit}>
          <label class="field__label" for="invite-signup-email">Email</label>
          <input id="invite-signup-email" class="field__input" type="email" autocomplete="email" required value={email}
            onInput={(event) => setEmail((event.currentTarget as HTMLInputElement).value)} />
          <label class="field__toggle invite-signup__consent">
            <input type="checkbox" checked={consent} required onChange={(event) => setConsent((event.currentTarget as HTMLInputElement).checked)} />
            <span>Yes, email me the {signName} daily. I am 18 or older.</span>
          </label>
          <button class="btn btn--primary" type="submit" disabled={!consent || !email || state === 'sending'}>
            <span>{state === 'sending' ? 'Sending…' : 'Send the confirmation'}</span>
            <span class="orb" aria-hidden="true">↗</span>
          </button>
          {state === 'unavailable' && <p class="calc__error" role="alert">This invitation has closed, so nothing was sent. The daily email is still on any horoscope page.</p>}
          {state === 'error' && <p class="calc__error" role="alert">That did not go through. Nothing was saved; try again in a moment.</p>}
        </form>
      )}
      secondary={<p class="field__help">We keep your address with our email provider, a coded copy of it, and your Sun sign. Never your birth details. If {label} asked to know when you finish, they get a short note without your name, address or result.</p>}
    />
  );
}
