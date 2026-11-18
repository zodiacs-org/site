import { useEffect, useMemo, useState } from 'preact/hooks';
import { recordChartEmailsConsent } from '../lib/account-v2/client';
import {
  browserTimezoneChoices,
  deleteDailyChartPreference,
  getDailyChartPreference,
  maskDailyEmail,
  resendDailyChartPreference,
  setDailyChartPreference,
  type DailyChartPreference,
} from '../lib/profile/daily-email-client';

export type ChartEmailsConsentState = 'pending' | 'granted' | 'withdrawn';
type ConsentState = ChartEmailsConsentState;

interface AccountChartEmailsProps {
  accessToken: string;
  email: string | null;
  /** The account's synced self chart (server revision at least 1), or null. */
  syncedChartId: string | null;
  consent: ConsentState;
  disabled: boolean;
  onConsentChange: (state: ConsentState) => void;
}

const TRY_AGAIN = 'That did not save. Please try again.';

function freshUuid(): string {
  return crypto.randomUUID();
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Records the "Use my chart for my emails" choice. Returns the consent state
 * the server recorded (null when nothing changed) and the line to show.
 */
export async function saveChartEmailsChoice(
  next: boolean,
  record: (decision: 'grant' | 'withdraw', requestId: string) => Promise<{ outcome: string }>,
  newRequestId: () => string = freshUuid,
): Promise<{ consent: 'granted' | 'withdrawn' | null; message: string }> {
  try {
    const result = await record(next ? 'grant' : 'withdraw', newRequestId());
    if (result.outcome === 'granted') return { consent: 'granted', message: 'Chart emails are on.' };
    if (result.outcome === 'withdrawn') {
      return { consent: 'withdrawn', message: 'Chart emails are off. Emails you get no longer use your chart.' };
    }
  } catch {
    // Shown below; the checkbox keeps the recorded state.
  }
  return { consent: null, message: TRY_AGAIN };
}

/**
 * What the daily chart email block shows. A confirmed preference sends the
 * chart edition only while chart emails are on and it names the account's
 * current synced chart; otherwise it is paused, exactly as the daily job
 * treats it.
 */
export type DailyChartEmailView =
  | 'hidden'
  | 'loading'
  | 'error'
  | 'pending'
  | 'on'
  | 'needs_confirmation'
  | 'paused_consent'
  | 'paused_chart'
  | 'offer'
  | 'needs_consent';

export function dailyChartEmailView({
  lifecycle,
  loadState,
  daily,
  granted,
  syncedChartId,
}: {
  lifecycle: boolean;
  loadState: 'off' | 'loading' | 'ready' | 'error';
  daily: DailyChartPreference | null;
  granted: boolean;
  syncedChartId: string | null;
}): DailyChartEmailView {
  if (!lifecycle) return 'hidden';
  if (loadState === 'error') return 'error';
  if (loadState !== 'ready' || !daily) return 'loading';
  if (daily.pending) return 'pending';
  const confirmed = daily.enabled || daily.requiresConfirmation;
  if (!confirmed) return granted && syncedChartId ? 'offer' : 'needs_consent';
  if (daily.requiresConfirmation) return 'needs_confirmation';
  if (!granted) return 'paused_consent';
  if (!daily.chartId || daily.chartId !== syncedChartId) return 'paused_chart';
  return 'on';
}

export interface AccountChartEmailsViewProps {
  consent: ConsentState;
  syncedChartId: string | null;
  locked: boolean;
  daily: DailyChartPreference | null;
  dailyView: DailyChartEmailView;
  timezone: string;
  timezoneChoices: readonly string[];
  message: string;
  onToggle: (next: boolean) => void;
  onTimezone: (zone: string) => void;
  onStart: () => void;
  onStop: () => void;
  onResend: () => void;
}

export function AccountChartEmailsView({
  consent,
  syncedChartId,
  locked,
  daily,
  dailyView,
  timezone,
  timezoneChoices,
  message,
  onToggle,
  onTimezone,
  onStart,
  onStop,
  onResend,
}: AccountChartEmailsViewProps) {
  const granted = consent === 'granted';
  const timezonePicker = (
    <label class="pf-daily__timezone" for="pf-chart-emails-timezone">
      <span>Morning delivery time zone</span>
      <select
        id="pf-chart-emails-timezone"
        value={timezone}
        disabled={locked}
        onChange={(event) => onTimezone((event.currentTarget as HTMLSelectElement).value)}
      >
        {timezoneChoices.map((zone) => <option value={zone} key={zone}>{zone}</option>)}
      </select>
    </label>
  );
  const paused = dailyView === 'needs_confirmation' || dailyView === 'paused_consent' || dailyView === 'paused_chart';

  return (
    <section class="pf-account-v2__section" aria-labelledby="chart-emails-heading" id="daily-brief">
      <h2 id="chart-emails-heading">Chart emails</h2>
      <label class="pf-digest">
        <input
          type="checkbox"
          checked={granted}
          disabled={locked || (!granted && !syncedChartId)}
          onChange={(event) => onToggle((event.target as HTMLInputElement).checked)}
        />
        <span>
          <strong>Use my chart for my emails</strong>
          <small>
            Off by default. When on, the daily chart email and the weekly digest use your synced chart.
            Zodiacs decrypts it only to write those emails. When off, emails use your Sun sign or the week&rsquo;s sky.
          </small>
        </span>
      </label>
      {!syncedChartId && !granted && <p>Sync your own chart above first. Chart emails use only that chart.</p>}

      {dailyView !== 'hidden' && (
        <div class="pf-daily" aria-busy={dailyView === 'loading' || locked}>
          <h3>Daily chart email</h3>
          {dailyView === 'error' && <p>We could not check your daily chart email just now.</p>}
          {dailyView === 'pending' && daily && (
            <>
              <p>
                {daily.maskedEmail
                  ? `Check ${daily.maskedEmail} for the confirmation link. Nothing is sent until you confirm.`
                  : 'Your account email changed after this link was sent. Ask for a new one.'}
              </p>
              <div class="pf-sync__actions">
                <button class="pf-chart__action" type="button" disabled={locked} onClick={onResend}>Send a new link</button>
                <button class="pf-chart__action" type="button" disabled={locked} onClick={onStop}>Cancel</button>
              </div>
            </>
          )}
          {dailyView === 'on' && daily && (
            <>
              <p>On. Sent each morning in {daily.timezone ?? 'UTC'}, using your synced chart.</p>
              {timezonePicker}
              <div class="pf-sync__actions">
                {timezone !== daily.timezone && (
                  <button class="pf-chart__action" type="button" disabled={locked} onClick={onStart}>Save time zone</button>
                )}
                <button class="pf-chart__action" type="button" disabled={locked} onClick={onStop}>Stop the daily chart email</button>
              </div>
            </>
          )}
          {paused && (
            <>
              <p>
                {dailyView === 'needs_confirmation'
                  ? 'Your account email changed, so the daily chart email needs a new confirmation.'
                  : dailyView === 'paused_consent'
                    ? 'Your daily chart email is paused until chart emails are on. If you also get the free Daily Sun email, that keeps arriving.'
                    : 'Your daily chart email is paused. Earlier cloud chart sync has ended, so it needs your synced chart.'}
              </p>
              {granted && syncedChartId && (
                <>
                  {timezonePicker}
                  <button class="btn btn--primary" type="button" disabled={locked} onClick={onStart}>
                    {dailyView === 'needs_confirmation' ? 'Send a confirmation link' : 'Restart with my synced chart'}
                  </button>
                </>
              )}
              <button class="pf-chart__action" type="button" disabled={locked} onClick={onStop}>Stop the daily chart email</button>
            </>
          )}
          {dailyView === 'offer' && (
            <>
              <p>A short morning email about how the day&rsquo;s sky touches your synced chart.</p>
              {timezonePicker}
              <button class="btn btn--primary" type="button" disabled={locked} onClick={onStart}>
                Email me a confirmation link
              </button>
            </>
          )}
          {dailyView === 'needs_consent' && <p>Turn on chart emails to get a daily email about your own chart.</p>}
        </div>
      )}
      {message && <p class="pf-sync__message" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}

/**
 * "Use my chart for my emails" (the chart_emails consent) and the daily chart
 * email it unlocks. Both work only with the account's one synced self chart;
 * no other chart id is ever sent. The daily email keeps its own double
 * opt-in: the consent lets Zodiacs use the chart, the confirmed preference
 * says where and when to send it.
 */
export default function AccountChartEmails({
  accessToken,
  email,
  syncedChartId,
  consent,
  disabled,
  onConsentChange,
}: AccountChartEmailsProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [daily, setDaily] = useState<DailyChartPreference | null>(null);
  const [dailyState, setDailyState] = useState<'off' | 'loading' | 'ready' | 'error'>('off');
  const [timezone, setTimezone] = useState(browserTimezone);
  const lifecycle = typeof document !== 'undefined'
    && document.documentElement.hasAttribute('data-daily-email-lifecycle');
  const granted = consent === 'granted';
  const timezoneChoices = useMemo(() => browserTimezoneChoices([timezone]), [timezone]);

  async function loadDaily(): Promise<void> {
    if (!lifecycle) return;
    setDailyState('loading');
    try {
      const preference = await getDailyChartPreference(accessToken);
      setDaily(preference);
      if (preference.timezone) setTimezone(preference.timezone);
      setDailyState('ready');
    } catch {
      setDailyState('error');
    }
  }

  useEffect(() => {
    void loadDaily();
  }, [accessToken, lifecycle]);

  async function onToggle(next: boolean): Promise<void> {
    setBusy(true);
    setMessage('');
    const result = await saveChartEmailsChoice(
      next,
      (decision, requestId) => recordChartEmailsConsent(accessToken, decision, requestId),
    );
    if (result.consent) onConsentChange(result.consent);
    setMessage(result.message);
    setBusy(false);
  }

  async function startDaily(): Promise<void> {
    if (!syncedChartId) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await setDailyChartPreference(accessToken, { chartId: syncedChartId, timezone });
      setMessage(result.pending
        ? `We sent a confirmation link to ${maskDailyEmail(email)}. Nothing is sent until you confirm.`
        : 'Saved.');
      await loadDaily();
    } catch {
      setMessage(TRY_AGAIN);
    } finally {
      setBusy(false);
    }
  }

  async function stopDaily(): Promise<void> {
    setBusy(true);
    setMessage('');
    try {
      await deleteDailyChartPreference(accessToken);
      setMessage('The daily chart email is off.');
      await loadDaily();
    } catch {
      setMessage(TRY_AGAIN);
    } finally {
      setBusy(false);
    }
  }

  async function resendDaily(): Promise<void> {
    setBusy(true);
    setMessage('');
    try {
      await resendDailyChartPreference(accessToken);
      setMessage('We sent a new confirmation link.');
      await loadDaily();
    } catch {
      setMessage('We could not send a new link just now. Please try again later.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountChartEmailsView
      consent={consent}
      syncedChartId={syncedChartId}
      locked={disabled || busy}
      daily={daily}
      dailyView={dailyChartEmailView({ lifecycle, loadState: dailyState, daily, granted, syncedChartId })}
      timezone={timezone}
      timezoneChoices={timezoneChoices}
      message={message}
      onToggle={(next) => void onToggle(next)}
      onTimezone={setTimezone}
      onStart={() => void startDaily()}
      onStop={() => void stopDaily()}
      onResend={() => void resendDaily()}
    />
  );
}
