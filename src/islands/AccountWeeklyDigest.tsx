import { useEffect, useState } from 'preact/hooks';
import {
  getDigestOptIn as readDigestOptIn,
  setDigestOptIn as writeDigestOptIn,
} from '../lib/profile/digest-preference';

interface AccountWeeklyDigestProps {
  /** The signed-in account; the preference is reloaded when it changes. */
  accountId: string;
  /** Whether the account currently lets its emails use the synced chart. */
  chartEmails: boolean;
  disabled: boolean;
  loadPreference?: () => Promise<boolean>;
  savePreference?: (optIn: boolean) => Promise<boolean>;
}

/**
 * Saves the Monday digest choice. Returns the state to show: the new choice
 * when it saved, the previous one when it did not.
 */
export async function saveWeeklyDigestChoice(
  next: boolean,
  previous: boolean,
  save: (optIn: boolean) => Promise<boolean>,
): Promise<{ optIn: boolean; message: string }> {
  try {
    if (await save(next)) {
      return { optIn: next, message: next ? 'The weekly digest is on.' : 'The weekly digest is off.' };
    }
  } catch {
    // Shown below.
  }
  return { optIn: previous, message: 'That did not save. Please try again.' };
}

export interface AccountWeeklyDigestViewProps {
  optIn: boolean;
  chartEmails: boolean;
  loadState: 'loading' | 'ready' | 'error';
  locked: boolean;
  message: string;
  onChange: (next: boolean) => void;
}

export function AccountWeeklyDigestView({
  optIn,
  chartEmails,
  loadState,
  locked,
  message,
  onChange,
}: AccountWeeklyDigestViewProps) {
  return (
    <section class="pf-account-v2__section" aria-labelledby="weekly-digest-heading" id="weekly-digest">
      <h2 id="weekly-digest-heading">Weekly digest</h2>
      {loadState === 'error' && <p>We could not check your weekly digest just now.</p>}
      <label class="pf-digest">
        <input
          type="checkbox"
          checked={optIn}
          disabled={locked || loadState !== 'ready'}
          onChange={(event) => onChange((event.currentTarget as HTMLInputElement).checked)}
        />
        <span>
          <strong>Send me the Monday digest</strong>
          <small>
            Off until you check this box. {chartEmails
              ? 'It uses your synced chart, because chart emails are on.'
              : 'It lists the week\u2019s notable sky events. Turn on chart emails above to have it use your synced chart.'}
            {' '}Every digest has a link to stop it.
          </small>
        </span>
      </label>
      {message && <p class="pf-sync__message" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}

/**
 * The weekly digest subscription for a signed-in account with encrypted sync:
 * the same profiles.digest_opt_in switch the earlier profile panel used. It
 * decides whether any Monday digest is sent. Whether the digest uses the
 * synced chart is the separate "Use my chart for my emails" choice above it.
 */
export default function AccountWeeklyDigest({
  accountId,
  chartEmails,
  disabled,
  loadPreference = readDigestOptIn,
  savePreference = writeDigestOptIn,
}: AccountWeeklyDigestProps) {
  const [optIn, setOptIn] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let current = true;
    setLoadState('loading');
    setMessage('');
    loadPreference()
      .then((value) => {
        if (!current) return;
        setOptIn(value);
        setLoadState('ready');
      })
      .catch(() => {
        if (current) setLoadState('error');
      });
    return () => {
      current = false;
    };
  }, [accountId]);

  async function onChange(next: boolean): Promise<void> {
    const previous = optIn;
    setOptIn(next);
    setBusy(true);
    setMessage('');
    const result = await saveWeeklyDigestChoice(next, previous, savePreference);
    setOptIn(result.optIn);
    setMessage(result.message);
    setBusy(false);
  }

  return (
    <AccountWeeklyDigestView
      optIn={optIn}
      chartEmails={chartEmails}
      loadState={loadState}
      locked={disabled || busy}
      message={message}
      onChange={(next) => void onChange(next)}
    />
  );
}
