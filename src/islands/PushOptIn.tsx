import { useEffect, useState } from 'preact/hooks';
import type { ReleasedLocale as Locale } from '../lib/i18n';
import { claimA2hsHint } from '../lib/a2hs';
import {
  claimPushPrompt,
  isIosDevice,
  isStandaloneDisplay,
  readPushPreference,
  setPushPreference,
  vapidKeyBytes,
} from '../lib/push';
import { PUSH_CAP, PUSH_COPY, PUSH_REOFFER } from '../strings/push';
import '../styles/push.css';

interface Props {
  locale?: Locale;
  context?: 'chart-save' | 'today-return' | 'profile';
}

type View = 'hidden' | 'offer' | 'reoffer' | 'ios-install' | 'busy' | 'subscribed' | 'denied' | 'error';
const WEB_PUSH_ENABLED = import.meta.env.PUBLIC_WEB_PUSH_ENABLED === '1';

function track(name: 'push_prompt' | 'push_subscribe'): void {
  (window as Window & {
    zodiacsAnalytics?: { track?: (event: string, props: Record<string, never>) => void };
  }).zodiacsAnalytics?.track?.(name, {});
}

function supported(): boolean {
  return WEB_PUSH_ENABLED
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration?.pushManager.getSubscription() ?? null;
}

export default function PushOptIn({ locale = 'en', context = 'chart-save' }: Props) {
  const copy = PUSH_COPY[locale];
  const [view, setView] = useState<View>('hidden');
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [profileStatusKnown, setProfileStatusKnown] = useState(false);
  const [profileOperationError, setProfileOperationError] = useState(false);

  useEffect(() => {
    if (!supported()) return;
    let live = true;
    if (context === 'profile') {
      setProfileStatusKnown(false);
      setProfileOperationError(false);
    }
    void currentSubscription().then((subscription) => {
      if (!live) return;
      if (context === 'profile') setProfileStatusKnown(true);
      if (subscription) {
        setPushPreference(localStorage, 'subscribed');
        // A returning Today visit is an acquisition moment, not a settings
        // surface. Once alerts are already active it stays quiet; the same
        // mounted card still shows confirmation immediately after opt-in.
        if (context !== 'today-return') setView('subscribed');
        return;
      }

      const needsInstall = isIosDevice(navigator.userAgent)
        && !isStandaloneDisplay(navigator as Navigator & { standalone?: boolean }, window.matchMedia.bind(window));
      if (needsInstall) {
        if (context === 'profile') {
          setView('ios-install');
          return;
        }
        // Claim only the install hint. The independent push claim remains open
        // for the first contextual visit from the installed Home Screen app.
        if (claimA2hsHint(locale, navigator.userAgent, localStorage)) setView('ios-install');
        return;
      }

      const preference = readPushPreference(localStorage);
      if (preference === 'subscribed') {
        setPushPreference(localStorage, 'offered');
        setView('reoffer');
        if (context !== 'profile') track('push_prompt');
        return;
      }
      if (context === 'profile') {
        // Profile is the durable reversal surface. Unlike acquisition cards,
        // its Off row remains reachable after a prior dismissal.
        setView('offer');
        return;
      }
      if (!claimPushPrompt(localStorage)) return;
      setView('offer');
      track('push_prompt');
    }).catch(() => {
      if (live && context === 'profile') setView('error');
    });
    return () => { live = false; };
  }, [context]);

  function dismiss(): void {
    if (view === 'ios-install') {
      setView('hidden');
      return;
    }
    setPushPreference(localStorage, 'dismissed');
    setView('hidden');
  }

  async function subscribe(): Promise<void> {
    if (view === 'busy') return;
    setProfileOperationError(false);
    setView('busy');
    try {
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== 'granted') {
        setPushPreference(localStorage, 'dismissed');
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
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...subscription.toJSON(), lang: locale }),
      });
      if (!response.ok) {
        if (!existing) await subscription.unsubscribe();
        throw new Error(`subscription endpoint ${response.status}`);
      }

      setPushPreference(localStorage, 'subscribed');
      setView('subscribed');
      track('push_subscribe');
    } catch {
      if (context !== 'profile') {
        setView('error');
        return;
      }

      // A failed enrollment can leave either no browser subscription (the
      // rollback worked) or a live one (the rollback failed). Reconcile before
      // publishing On/Off so the durable Profile row remains truthful and
      // offers the appropriate retry action.
      setProfileOperationError(true);
      try {
        const subscription = await currentSubscription();
        setProfileStatusKnown(true);
        if (subscription) {
          setPushPreference(localStorage, 'subscribed');
          setView('subscribed');
        } else {
          setPushPreference(localStorage, 'dismissed');
          setView('offer');
        }
      } catch {
        setProfileStatusKnown(false);
        setView('error');
      }
    }
  }

  async function unsubscribe(): Promise<void> {
    if (unsubscribing) return;
    setProfileOperationError(false);
    setUnsubscribing(true);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        // Delete the server record first so a provider failure never strands
        // an endpoint that the browser can no longer identify for retry.
        const response = await fetch('/api/push/subscribe', {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error(`unsubscribe endpoint ${response.status}`);
        if (!await subscription.unsubscribe()) throw new Error('browser unsubscribe failed');
      }
      setPushPreference(localStorage, 'dismissed');
      setView(context === 'profile' ? 'offer' : 'hidden');
    } catch {
      if (context === 'profile') {
        // Keep the truthful On state and its retry control until both halves
        // of revocation have succeeded.
        setView('subscribed');
        setProfileOperationError(true);
      } else {
        setView('error');
      }
    } finally {
      setUnsubscribing(false);
    }
  }

  if (view === 'hidden') return null;

  const message = view === 'subscribed'
    ? copy.on
    : view === 'ios-install'
      ? copy.ios
      : view === 'denied'
        ? copy.denied
        : view === 'error'
          ? copy.error
          : view === 'reoffer'
            ? PUSH_REOFFER[locale]
            : copy.body;

  if (context === 'profile') {
    const active = view === 'subscribed';
    const detail = profileOperationError
      ? copy.error
      : view === 'ios-install' || view === 'denied' || view === 'error' || view === 'reoffer'
        ? message
        : null;
    return (
      <aside
        class="push-optin push-optin--profile"
        aria-live="polite"
        aria-busy={view === 'busy' || unsubscribing}
        data-push-optin
        data-push-context="profile"
      >
        <div class="push-optin__copy">
          <strong>
            {profileStatusKnown
              ? `Sky alerts · ${active ? 'On' : 'Off'} — the dates that matter, by notification.`
              : 'Sky alerts'}
          </strong>
          {detail && <span>{detail}</span>}
        </div>
        <div class="push-optin__actions">
          {(view === 'offer' || view === 'reoffer' || view === 'busy') && (
            <button class="btn btn--ghost" type="button" onClick={subscribe} disabled={view === 'busy'}>
              {view === 'busy' ? copy.installing : copy.accept}
            </button>
          )}
          {view === 'subscribed' && (
            <button class="btn btn--ghost" type="button" onClick={unsubscribe} disabled={unsubscribing}>
              {copy.off}
            </button>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside
      class="push-optin"
      aria-live="polite"
      aria-busy={view === 'busy' || unsubscribing}
      data-push-optin
      data-push-context={context}
    >
      <div class="push-optin__copy">
        {view !== 'subscribed' && <strong>{copy.heading}</strong>}
        <span>{message}</span>
        {(view === 'offer' || view === 'reoffer' || view === 'subscribed') && (
          <small>{PUSH_CAP[locale]}</small>
        )}
      </div>
      <div class="push-optin__actions">
        {(view === 'offer' || view === 'reoffer' || view === 'busy') && (
          <button class="btn btn--ghost" type="button" onClick={subscribe} disabled={view === 'busy'}>
            {view === 'busy' ? copy.installing : copy.accept}
          </button>
        )}
        {view === 'subscribed' && (
          <button class="btn btn--ghost" type="button" onClick={unsubscribe} disabled={unsubscribing}>
            {copy.off}
          </button>
        )}
        {view !== 'subscribed' && view !== 'busy' && (
          <button class="push-optin__dismiss" type="button" onClick={dismiss} aria-label={copy.dismissLabel}>
            {copy.dismiss}
          </button>
        )}
      </div>
    </aside>
  );
}
