/**
 * The Moon journal's opt-in reminder: one notification on the day of each
 * new and full Moon, through the site's own Web Push (the same worker, API
 * and stored subscription as Sky Alerts, under its own topic).
 *
 * What leaves the device: the browser's push subscription (its push-service
 * endpoint and keys) and the topic name, posted to the site's own
 * /api/push/subscribe. Never a note, a question, a sign or a date: the
 * reminder is composed on the server from the public sky data.
 *
 * Rendered only when the build has push on (PUBLIC_WEB_PUSH_ENABLED=1), like
 * every other push control, so a build with push off has no dead button.
 * The box is in the server render with its button disabled, so reading the
 * browser's state after load changes words, not layout.
 */
import { useEffect, useState } from 'preact/hooks';
import {
  PUSH_API_PATH,
  fetchTopicStatus,
  isIosDevice,
  isStandaloneDisplay,
  leavePushTopic,
  vapidKeyBytes,
} from '../lib/push';
import { MOON_JOURNAL_REMINDER_COPY, type MoonJournalReminderUi } from '../lib/moon-journal/copy';

type View = 'checking' | 'off' | 'busy' | 'on' | 'leaving' | 'denied' | 'error' | 'unsupported' | 'ios';

/** The build-time push flag, the same one PushOptIn reads. */
export const JOURNAL_REMINDERS_ENABLED = import.meta.env.PUBLIC_WEB_PUSH_ENABLED === '1';

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration?.pushManager.getSubscription() ?? null;
}

export default function MoonJournalReminder({ ui = MOON_JOURNAL_REMINDER_COPY.ui }: { ui?: MoonJournalReminderUi }) {
  const [view, setView] = useState<View>('checking');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    if (!supported()) {
      const needsInstall = isIosDevice(navigator.userAgent)
        && !isStandaloneDisplay(navigator as Navigator & { standalone?: boolean }, window.matchMedia.bind(window));
      setView(needsInstall ? 'ios' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setView('denied');
      return;
    }
    void (async () => {
      try {
        const subscription = await currentSubscription();
        const status = subscription ? await fetchTopicStatus(subscription.endpoint) : null;
        if (live) setView(status?.lunation ? 'on' : 'off');
      } catch {
        // Unknown is shown as Off: turning on again is harmless, it only sets
        // the same flag on the same subscription.
        if (live) setView('off');
      }
    })();
    return () => { live = false; };
  }, []);

  async function turnOn(): Promise<void> {
    if (view === 'busy') return;
    setFailed(false);
    setView('busy');
    try {
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== 'granted') {
        setView('denied');
        return;
      }
      const publicKey = import.meta.env.PUBLIC_VAPID_KEY?.trim();
      if (!publicKey) throw new Error('missing public key');
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyBytes(publicKey),
      });
      const response = await fetch(PUSH_API_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...subscription.toJSON(), lang: 'en', topic: 'lunation' }),
      });
      if (!response.ok) {
        // Drop only a subscription made for this attempt; one that already
        // carries Sky Alerts stays.
        if (!existing) await subscription.unsubscribe().catch(() => false);
        throw new Error(`subscription endpoint ${response.status}`);
      }
      setView('on');
    } catch {
      setFailed(true);
      setView('off');
    }
  }

  async function turnOff(): Promise<void> {
    if (view === 'leaving') return;
    setFailed(false);
    setView('leaving');
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        // Server first, so the browser never forgets an endpoint the server
        // still sends to. The browser subscription goes only when Sky Alerts
        // do not use it too.
        const shared = await leavePushTopic(subscription.endpoint, 'lunation');
        if (!shared && !await subscription.unsubscribe()) throw new Error('browser unsubscribe failed');
      }
      setView('off');
    } catch {
      // Stay truthfully On, with the control to try again.
      setFailed(true);
      setView('on');
    }
  }

  const on = view === 'on' || view === 'leaving';
  const canAsk = view === 'checking' || view === 'off' || view === 'busy';
  // Where the browser cannot take reminders, the reason sits where the
  // button would be, so the box keeps its shape.
  const blocked = view === 'denied'
    ? ui.remindDenied
    : view === 'unsupported'
      ? ui.remindUnsupported
      : view === 'ios'
        ? ui.remindIos
        : '';
  const status = failed ? ui.remindError : view === 'on' ? ui.remindOn : '';

  return (
    <section class="mj-remind" aria-labelledby="mj-remind-head" data-mj-remind={view}>
      <h2 id="mj-remind-head" class="mj-h">{ui.remindHeading}</h2>
      <p class="mj-remind__note">{ui.remindBody} {ui.remindPrivacy}</p>
      <div class="mj-actions mj-remind__row">
        {canAsk && (
          <button
            type="button"
            class="btn"
            onClick={turnOn}
            disabled={view !== 'off'}
            aria-busy={view === 'busy'}
            data-mj-remind-on
          >
            {view === 'busy' ? ui.remindBusy : ui.remindAccept}
          </button>
        )}
        {on && (
          <button
            type="button"
            class="btn"
            onClick={turnOff}
            disabled={view === 'leaving'}
            aria-busy={view === 'leaving'}
            data-mj-remind-off
          >
            {ui.remindOff}
          </button>
        )}
        {blocked && <p class="mj-remind__blocked" data-mj-remind-blocked>{blocked}</p>}
      </div>
      <p class="mj-status" role="status" data-mj-remind-status>{status}</p>
    </section>
  );
}
