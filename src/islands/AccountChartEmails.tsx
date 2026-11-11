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

type ConsentState = 'pending' | 'granted' | 'withdrawn';

interface AccountChartEmailsProps {
  accessToken: string;
  email: string | null;
  /** The account's synced self chart (server revision at least 1), or null. */
  syncedChartId: string | null;
  consent: ConsentState;
  disabled: boolean;
  onConsentChange: (state: ConsentState) => void;
}

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
    try {
      const result = await recordChartEmailsConsent(accessToken, next ? 'grant' : 'withdraw', freshUuid());
      if (result.outcome === 'granted' || result.outcome === 'withdrawn') {
        onConsentChange(result.outcome);
        setMessage(result.outcome === 'granted'
          ? 'Chart emails are on.'
          : 'Chart emails are off. Emails you get no longer use your chart.');
      } else {
        setMessage('That did not save. Please try again.');
      }
    } catch {
      setMessage('That did not save. Please try again.');
    } finally {
      setBusy(false);
    }
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
      setMessage('That did not save. Please try again.');
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
      setMessage('That did not save. Please try again.');
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

  const locked = disabled || busy;
  const confirmed = Boolean(daily && (daily.enabled || daily.requiresConfirmation));
  const usesSyncedChart = Boolean(daily?.chartId && daily.chartId === syncedChartId);
  const timezonePicker = (
    <label class="pf-daily__timezone" for="pf-chart-emails-timezone">
      <span>Morning delivery time zone</span>
      <select
        id="pf-chart-emails-timezone"
        value={timezone}
        disabled={locked}
        onChange={(event) => setTimezone((event.currentTarget as HTMLSelectElement).value)}
      >
        {timezoneChoices.map((zone) => <option value={zone} key={zone}>{zone}</option>)}
      </select>
    </label>
  );

  return (
    <section class="pf-account-v2__section" aria-labelledby="chart-emails-heading" id="daily-brief">
      <h2 id="chart-emails-heading">Chart emails</h2>
      <label class="pf-digest">
        <input
          type="checkbox"
          checked={granted}
          disabled={locked || (!granted && !syncedChartId)}
          onChange={(event) => void onToggle((event.target as HTMLInputElement).checked)}
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

      {lifecycle && (
        <div class="pf-daily" aria-busy={dailyState === 'loading' || busy}>
          <h3>Daily chart email</h3>
          {dailyState === 'error' && <p>We could not check your daily chart email just now.</p>}
          {dailyState === 'ready' && daily?.pending && (
            <>
              <p>
                {daily.maskedEmail
                  ? `Check ${daily.maskedEmail} for the confirmation link. Nothing is sent until you confirm.`
                  : 'Your account email changed after this link was sent. Ask for a new one.'}
              </p>
              <div class="pf-sync__actions">
                <button class="pf-chart__action" type="button" disabled={locked} onClick={() => void resendDaily()}>Send a new link</button>
                <button class="pf-chart__action" type="button" disabled={locked} onClick={() => void stopDaily()}>Cancel</button>
              </div>
            </>
          )}
          {dailyState === 'ready' && daily && !daily.pending && confirmed && granted && usesSyncedChart && !daily.requiresConfirmation && (
            <>
              <p>On. Sent each morning in {daily.timezone ?? 'UTC'}, using your synced chart.</p>
              {timezonePicker}
              <div class="pf-sync__actions">
                {timezone !== daily.timezone && (
                  <button class="pf-chart__action" type="button" disabled={locked} onClick={() => void startDaily()}>Save time zone</button>
                )}
                <button class="pf-chart__action" type="button" disabled={locked} onClick={() => void stopDaily()}>Stop the daily chart email</button>
              </div>
            </>
          )}
          {dailyState === 'ready' && daily && !daily.pending && confirmed && (!granted || !usesSyncedChart || daily.requiresConfirmation) && (
            <>
              <p>
                {daily.requiresConfirmation
                  ? 'Your account email changed, so the daily chart email needs a new confirmation.'
                  : !granted
                    ? 'Your daily chart email is paused until chart emails are on. If you also get the free Daily Sun email, that keeps arriving.'
                    : 'Your daily chart email is paused. Earlier cloud chart sync has ended, so it needs your synced chart.'}
              </p>
              {granted && syncedChartId && (
                <>
                  {timezonePicker}
                  <button class="btn btn--primary" type="button" disabled={locked} onClick={() => void startDaily()}>
                    {daily.requiresConfirmation ? 'Send a confirmation link' : 'Restart with my synced chart'}
                  </button>
                </>
              )}
              <button class="pf-chart__action" type="button" disabled={locked} onClick={() => void stopDaily()}>Stop the daily chart email</button>
            </>
          )}
          {dailyState === 'ready' && daily && !daily.pending && !confirmed && (
            granted && syncedChartId ? (
              <>
                <p>A short morning email about how the day&rsquo;s sky touches your synced chart.</p>
                {timezonePicker}
                <button class="btn btn--primary" type="button" disabled={locked} onClick={() => void startDaily()}>
                  Email me a confirmation link
                </button>
              </>
            ) : (
              <p>Turn on chart emails to get a daily email about your own chart.</p>
            )
          )}
        </div>
      )}
      {message && <p class="pf-sync__message" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
