/**
 * Once a chart is marked as yours, one quiet line on how to get back here
 * in a tap: install the site where the browser offers it, add it to the
 * Home Screen on iPhone and iPad, or bookmark it (shown as the keys to
 * press) — plus the short address, zodiacs.org/me. It never shows inside
 * the installed app, and hiding it is remembered on this device.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { runAfterProfileAccess } from '../lib/account-v2/profile-access-request';
import { useProfile } from '../lib/hooks/useProfile';
import { useMe } from '../lib/hooks/useMe';
import { explicitSelfChart } from '../lib/profile/read-store';
import { saveMe } from '../lib/profile/me';
import { a2hsPlatform } from '../lib/a2hs';
import { isStandalonePwa } from '../lib/pwa-install';
import { useProfileSurface } from '../lib/profile/surface-gate';

interface DeferredInstall extends Event {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Route = 'install' | 'ios' | 'android' | 'desktop-mac' | 'desktop';

export const SHORT_ADDRESS = 'zodiacs.org/me';

/** Which instruction fits this browser. User-agent routing only picks the copy. */
export function keepCloseRoute(userAgent: string, canInstall: boolean): Route {
  if (canInstall) return 'install';
  const platform = a2hsPlatform(userAgent);
  if (platform) return platform;
  return /\bMac OS X\b|\bMacintosh\b/u.test(userAgent) ? 'desktop-mac' : 'desktop';
}

/** How to keep the page one tap away, for this browser. */
function Instruction({ route }: { route: Route }) {
  switch (route) {
    case 'install':
      return <>Add Zodiacs to this device, or bookmark this page</>;
    case 'ios':
      return (
        <>
          Tap Share{' '}
          <svg class="pf-keep__glyph" width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
            <path d="M6 1.2v7.6M3.3 3.8 6 1.2l2.7 2.6M3.6 6H2a.8.8 0 0 0-.8.8v5.4c0 .5.4.8.8.8h8c.5 0 .8-.3.8-.8V6.8a.8.8 0 0 0-.8-.8H8.4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          , then Add to Home Screen
        </>
      );
    case 'android':
      return <>In Chrome’s menu, tap Add to Home screen</>;
    case 'desktop-mac':
      return <>Press <kbd>⌘</kbd><kbd>D</kbd> to bookmark this page</>;
    default:
      return <>Press <kbd>Ctrl</kbd><kbd>D</kbd> to bookmark this page</>;
  }
}

function installPrompt(): DeferredInstall | null {
  const event = Reflect.get(window, 'zodiacsInstallPrompt') as DeferredInstall | undefined;
  return event && typeof event.prompt === 'function' ? event : null;
}

export default function ProfileKeepClose({ accountBound = false }: { accountBound?: boolean }) {
  const { profile, ready: profileReady } = useProfile();
  const ready = useProfileSurface(accountBound) && profileReady;
  const me = useMe();
  const self = useMemo(() => explicitSelfChart(profile.charts), [profile.charts]);
  const [route, setRoute] = useState<Route | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const update = () => {
      setStandalone(isStandalonePwa(navigator, window.matchMedia.bind(window)));
      setRoute(keepCloseRoute(navigator.userAgent, installPrompt() !== null));
    };
    update();
    window.addEventListener('zodiacs:install-prompt-ready', update);
    window.addEventListener('appinstalled', update);
    return () => {
      window.removeEventListener('zodiacs:install-prompt-ready', update);
      window.removeEventListener('appinstalled', update);
    };
  }, []);

  if (!ready || !self || standalone || !route || hidden || me.keepCloseDismissed) return null;

  async function install() {
    const event = installPrompt();
    if (!event) return;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      // The browser's install sheet answers once; either way the offer is spent.
      Reflect.set(window, 'zodiacsInstallPrompt', undefined);
      if (choice?.outcome === 'accepted') setHidden(true);
      else setRoute(keepCloseRoute(navigator.userAgent, false));
    } catch {
      setRoute(keepCloseRoute(navigator.userAgent, false));
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`https://${SHORT_ADDRESS}`);
      setCopied('copied');
    } catch {
      setCopied('manual');
    }
  }

  function dismiss() {
    setHidden(true);
    // A dismissal waits for access like any write; if it cannot start, the
    // card stays hidden for this visit and may show again next time.
    runAfterProfileAccess(() => { saveMe({ keepCloseDismissed: true }); }, () => {});
  }

  return (
    <aside class="pf-keep" aria-label="Keep this page close" data-keep-close={route}>
      <p class="pf-keep__text">
        <em class="pf-keep__lead">Keep it close.</em>{' '}
        <Instruction route={route} />, or remember <strong>{SHORT_ADDRESS}</strong>.
      </p>
      <div class="pf-keep__actions">
        {route === 'install' && (
          <button class="pf-quiet" type="button" onClick={install}>Add to this device</button>
        )}
        <button class="pf-quiet" type="button" onClick={copy}>
          {copied === 'copied' ? 'Address copied' : 'Copy address'}
        </button>
        <button class="pf-keep__close" type="button" onClick={dismiss} aria-label="Hide this tip">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      {copied === 'manual' && (
        <input
          class="field__input pf-keep__url"
          type="text"
          readOnly
          value={`https://${SHORT_ADDRESS}`}
          aria-label="Short address for your page"
          onFocus={(event) => (event.currentTarget as HTMLInputElement).select()}
        />
      )}
      <p class="sr-only" role="status">{copied === 'copied' ? 'Address copied' : ''}</p>
    </aside>
  );
}
