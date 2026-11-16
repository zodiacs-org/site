import { useState } from 'preact/hooks';
import { NextActionCard } from '../../components/NextActionCard';
import { requestDailySignup, type DailySignupOutcome } from '../../lib/invite/recipient';
import { SIGNS, signBySlug } from '../../lib/signs';

interface InviteSignupProps {
  /**
   * The recipient's Sun sign from the chart they just worked out, offered as
   * the starting choice only when their chart has a birth time. Otherwise null,
   * and they choose.
   */
  sign: string | null;
}

/** What the card says after every submission, new address or not, so it reveals nothing about who subscribes. */
export const DAILY_SIGNUP_SENT = 'If that address is new to us, we sent one email to confirm.';

/**
 * After an invitation's reading, for someone 18 or older: a plain opt-in to
 * their own daily horoscope by email, laid out as the page's other next-step
 * cards (NextActionCard). It posts to the same public subscribe route as every
 * daily signup form, with its own double opt-in, and carries no invite handle;
 * the invitation completed when the reading was made, and nothing here
 * changes that. Nothing is asked before the result and the box is unticked.
 * Shown only while PUBLIC_INVITE_SIGNUP_ENABLED=1.
 */
export function InviteSignup({ sign: suggested }: InviteSignupProps) {
  const [email, setEmail] = useState('');
  const [sign, setSign] = useState(suggested && SIGNS.some((entry) => entry.slug === suggested) ? suggested : '');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | DailySignupOutcome>('idle');
  const signName = sign ? signBySlug(sign).name : '';

  async function submit(event: Event) {
    event.preventDefault();
    if (!consent || !sign || !email || state === 'sending') return;
    setState('sending');
    setState(await requestDailySignup(email, sign));
  }

  if (state === 'sent') {
    return (
      <NextActionCard
        className="invite-signup"
        cue="Nearly done"
        title="Check your inbox."
        body={DAILY_SIGNUP_SENT}
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
      body="Each morning, the day’s reading for your Sun sign. One email, free, unsubscribe any time."
      headingLevel={3}
      primary={(
        <form class="invite-signup__form" onSubmit={submit}>
          <label class="field__label" for="invite-signup-sign">Your Sun sign</label>
          <select id="invite-signup-sign" class="field__input" required value={sign}
            onChange={(event) => setSign((event.currentTarget as HTMLSelectElement).value)}>
            <option value="" disabled>Choose your sign</option>
            {SIGNS.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.name}</option>)}
          </select>
          <label class="field__label" for="invite-signup-email">Email</label>
          <input id="invite-signup-email" class="field__input" type="email" autocomplete="email" required value={email}
            onInput={(event) => setEmail((event.currentTarget as HTMLInputElement).value)} />
          <label class="field__toggle invite-signup__consent">
            <input type="checkbox" checked={consent} required onChange={(event) => setConsent((event.currentTarget as HTMLInputElement).checked)} />
            <span>Yes, email me the {signName || 'daily horoscope'}{signName ? ' daily' : ''}. I am 18 or older.</span>
          </label>
          <button class="btn btn--primary" type="submit" disabled={!consent || !sign || !email || state === 'sending'}>
            <span>{state === 'sending' ? 'Sending…' : 'Send the confirmation'}</span>
            <span class="orb" aria-hidden="true">↗</span>
          </button>
          {state === 'error' && <p class="calc__error" role="alert">That did not go through. Nothing was saved; try again in a moment.</p>}
        </form>
      )}
      secondary={<p class="field__help">We keep your address with our email provider, a coded copy of it, and your Sun sign. Never your birth details. This is separate from the invitation, which finished when your reading appeared.</p>}
    />
  );
}
