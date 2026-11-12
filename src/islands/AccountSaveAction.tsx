/**
 * The quiet account line under a result. Signed in: "Save to your profile"
 * keeps a link to this reading or card with the account. Signed out: one
 * "Sign in to save" link; the page waits on this device until sign-in, then
 * the profile saves it. On the birth chart, the existing Save keeps the
 * chart on this device; chart sync is paused, so there it only says so.
 *
 * Hosts load this module only when PUBLIC_ACCOUNT_SAVES_ENABLED is on.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  MAX_SAVED_PAGES,
  SIGN_IN_TO_SAVE_HREF,
  hasStoredAuthSession,
  stashPendingSave,
  type SavedPageDraft,
} from '../lib/profile/saved-pages-config';
import type { SaveOutcome } from '../lib/profile/saved-pages-cloud';
import { comparisonSavedPage } from '../lib/profile/comparison-link';
import { accountSyncV2Enabled } from '../lib/account-v2/feature-flags';
import '../styles/account.css';

type Props =
  | { kind: 'chart' }
  | { kind: 'page'; draft: SavedPageDraft | null; noun: string };

type State = 'idle' | 'saving' | SaveOutcome;

export const ACCOUNT_SAVE_COPY = {
  save: 'Save to your profile',
  saving: 'Saving…',
  saved: 'Saved to your profile.',
  open: 'Open your profile',
  exists: 'This is already on your profile.',
  full: `Your profile holds ${MAX_SAVED_PAGES} saved pages. Remove one there to save this.`,
  error: 'This could not be saved. Check your connection and try again.',
  signIn: 'Sign in to save',
  chartSignedOut: 'Saved charts stay in this browser. Chart sync is paused for now.',
} as const;

function useStoredSession(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const read = () => setSignedIn(hasStoredAuthSession());
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);
  return signedIn;
}

export default function AccountSaveAction(props: Props) {
  const signedIn = useStoredSession();
  const [state, setState] = useState<State>('idle');
  const draft = props.kind === 'page' ? props.draft : null;

  useEffect(() => { setState('idle'); }, [draft?.href]);

  if (props.kind === 'chart') {
    // Chart sync is paused: signing in sends no chart, so the line offers no
    // sign-in. The account v2 preview syncs one chart by explicit choice instead.
    if (signedIn || accountSyncV2Enabled()) return null;
    return (
      <div class="acct-save" data-account-save="chart">
        <p>{ACCOUNT_SAVE_COPY.chartSignedOut}</p>
      </div>
    );
  }

  if (!draft) return null;

  if (!signedIn || state === 'signed-out') {
    return (
      <div class="acct-save" data-account-save="signed-out">
        <p>
          <a href={SIGN_IN_TO_SAVE_HREF} onClick={() => { stashPendingSave(draft); }}>{ACCOUNT_SAVE_COPY.signIn}</a>
          {' '}this {props.noun} to your profile, so it opens on any device.
        </p>
      </div>
    );
  }

  async function save() {
    if (!draft) return;
    setState('saving');
    try {
      const { saveSavedPage } = await import('../lib/profile/saved-pages-cloud');
      setState(await saveSavedPage(draft));
    } catch {
      setState('error');
    }
  }

  if (state === 'saved' || state === 'exists') {
    return (
      <div class="acct-save" data-account-save="saved">
        <p role="status">
          {state === 'saved' ? ACCOUNT_SAVE_COPY.saved : ACCOUNT_SAVE_COPY.exists}{' '}
          <a href="/profile/#saved-pages">{ACCOUNT_SAVE_COPY.open}</a>
        </p>
      </div>
    );
  }

  return (
    <div class="acct-save" data-account-save="signed-in">
      <button
        type="button"
        class="btn btn--ghost acct-save__btn"
        onClick={() => void save()}
        disabled={state === 'saving'}
      >
        {state === 'saving' ? ACCOUNT_SAVE_COPY.saving : ACCOUNT_SAVE_COPY.save}
      </button>
      {(state === 'full' || state === 'error') && (
        <p class="acct-save__error" role="alert">{state === 'full' ? ACCOUNT_SAVE_COPY.full : ACCOUNT_SAVE_COPY.error}</p>
      )}
    </div>
  );
}

/**
 * The compatibility result's line. It saves the two Sun signs' pair page (or
 * the compatibility page when a Sun sign is unsettled): no birth details, no names.
 */
export function ComparisonSave({ signA, signB }: { signA: string | null; signB: string | null }) {
  const draft = useMemo(() => comparisonSavedPage(signA, signB), [signA, signB]);
  return <AccountSaveAction kind="page" noun="reading" draft={draft} />;
}
