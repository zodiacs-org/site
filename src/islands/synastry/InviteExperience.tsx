import type { Session } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { profileAccessAllowed } from '../../lib/account-v2/profile-access-reader';
import { useProfileAccessGeneration } from '../../lib/hooks/useProfileAccessGeneration';
import type { SavedChart } from '../../lib/profile/schema';
import type { InvitePublicPayload } from '../../lib/invite/types';
import { rememberInviteLink } from '../../lib/invite/local-links';
import { signIcon } from '../../lib/sign-icon';

const COPY = {
  invTitle: 'Invite them to fill in their half.',
  invBody: 'Your side travels as chart positions — where everything sits in your sky — carried by a private link. They add theirs, and the reading appears for them right away.',
  invChartLegend: 'Which chart carries your side?',
  invConsentLabel: "Share this chart's positions with whoever opens the link",
  invTerm1: "The link carries your chart's name or label and its computed positions. It never carries your birth date, time, or place.",
  invTerm2: 'Meant for one person — it closes once their reading is made, and after 14 days at the latest.',
  invTerm3: "You can end it early anytime from your profile, on any device you're signed in to.",
  invNotifyLabel: 'Email me once, when their reading is ready',
  invNotifyNote: "One email for this invitation, to your account address. It isn't a subscription, and it doesn't touch your daily email choices.",
  invCreate: 'Create the invitation link',
  invCreating: 'Creating…',
  invCopy: 'Copy link',
  invShare: 'Share…',
  invReadyNote: 'Ready. One reading, until {expiryDate}.',
  invNotifyOn: 'Ready. One reading, until {expiryDate} — and one email to you when it happens.',
  invManageNote: 'Watch or end it from your profile.',
  invPrivacyLine: 'The link carries a label and chart positions. No birth details.',
  invError: "Couldn't create the link. Please try again.",
  invThrottled: 'Too many new links just now — give it a minute.',
  invCapNote: 'Twelve invitations are open on your account. End one in your profile before making another.',
  siTitle: 'Invitations need an account.',
  siBody: "An invitation keeps your side ready for up to 14 days, so it needs a place that belongs to you. Sign in, sync the chart you'd share, and the invitation button appears right here.",
  siCta: 'Sign in from your profile',
  siNoSyncedTitle: 'Sync a chart to invite with it.',
  siNoSyncedBody: 'Invitations read a saved, synced chart. Charts kept only on this device stay here — sync one from your profile if you want it to carry an invitation.',
  siNoSyncedCta: 'Open your profile',
} as const;

export type AccountState = 'loading' | 'signed-out' | 'signed-in';
type CreateState = 'idle' | 'creating' | 'ready' | 'error' | 'throttled' | 'capped';

interface CreatedInvite {
  id: string;
  url: string;
  expiresAt: string;
}

interface InvitePanelProps {
  enabled: boolean;
  visible: boolean;
  charts: SavedChart[];
}

export interface InviteAccountSnapshot {
  account: AccountState;
  session: Session | null;
  syncedIds: string[];
}

interface InviteAccountResolverDependencies {
  getSyncSession(): Promise<Session | null>;
  getSyncedChartIds(userId: string): Promise<string[]>;
  profileAccessAllowed(): boolean;
  profileAccessGeneration(): number;
  commit(snapshot: InviteAccountSnapshot): void;
}

export interface InviteAccountResolver {
  resolve(supplied?: Session | null): Promise<void>;
  invalidate(): void;
  dispose(): void;
}

/** Serializes auth snapshots and their synced-chart lookup into one latest-wins result. */
export function createInviteAccountResolver(
  dependencies: InviteAccountResolverDependencies,
): InviteAccountResolver {
  let active = true;
  let version = 0;
  const cleared = (account: AccountState): InviteAccountSnapshot => ({
    account,
    session: null,
    syncedIds: [],
  });
  const current = (candidateVersion: number, accessGeneration: number) => active
    && candidateVersion === version
    && accessGeneration === dependencies.profileAccessGeneration()
    && dependencies.profileAccessAllowed();

  return {
    async resolve(supplied?: Session | null): Promise<void> {
      if (!active) return;
      const candidateVersion = ++version;
      const accessGeneration = dependencies.profileAccessGeneration();
      if (!dependencies.profileAccessAllowed()) {
        if (candidateVersion === version) dependencies.commit(cleared('signed-out'));
        return;
      }
      dependencies.commit(cleared('loading'));
      try {
        const nextSession = supplied === undefined
          ? await dependencies.getSyncSession()
          : supplied;
        if (!current(candidateVersion, accessGeneration)) return;
        if (!nextSession) {
          dependencies.commit(cleared('signed-out'));
          return;
        }
        const ids = await dependencies.getSyncedChartIds(nextSession.user.id);
        if (!current(candidateVersion, accessGeneration)) return;
        dependencies.commit({
          account: 'signed-in',
          session: nextSession,
          syncedIds: [...ids],
        });
      } catch {
        if (current(candidateVersion, accessGeneration)) {
          dependencies.commit(cleared('signed-out'));
        }
      }
    },
    invalidate(): void {
      if (!active) return;
      version += 1;
      dependencies.commit(cleared('signed-out'));
    },
    dispose(): void {
      active = false;
      version += 1;
    },
  };
}

function sunSlug(chart: SavedChart): string {
  const sun = chart.summary.bodies.find((body) => body.body === 'Sun');
  if (!sun) return 'aries';
  const signs = [
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
  ];
  return signs[Math.floor((((sun.lon % 360) + 360) % 360) / 30)] ?? 'aries';
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date);
}

function PastelSign({ sign, size = 24 }: { sign: string; size?: number }) {
  return (
    <picture class="syn-invite__sign" aria-hidden="true">
      <img src={signIcon(128, sign)} width={size} height={size} alt="" decoding="async" />
    </picture>
  );
}

function validCreatedInvite(value: unknown): value is CreatedInvite {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(row.id)
    && typeof row.url === 'string'
    && /^https:\/\/[^/]+\/c\/[A-Za-z0-9_-]{43}\/$/u.test(row.url)
    && typeof row.expiresAt === 'string'
    && Number.isFinite(new Date(row.expiresAt).getTime());
}

export function InvitePanel({ enabled, visible, charts }: InvitePanelProps) {
  const [account, setAccount] = useState<AccountState>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [syncedIds, setSyncedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [consent, setConsent] = useState(false);
  const [notify, setNotify] = useState(false);
  const [createState, setCreateState] = useState<CreateState>('idle');
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const linkRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(false);
  const accountResolverRef = useRef<InviteAccountResolver | null>(null);
  const profileAccessGeneration = useProfileAccessGeneration(() => {
    accountResolverRef.current?.invalidate();
    setSession(null);
    setSyncedIds([]);
    setAccount('signed-out');
    requestRef.current = false;
    setSelected('');
    setConsent(false);
    setNotify(false);
    setCreated(null);
    setCreateState('idle');
    setAnnouncement('');
  });

  const syncedCharts = charts
    .filter((chart) => syncedIds.includes(chart.id))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let unsubscribe = () => {};
    let removeProfileAccessListener = () => {};
    void Promise.all([
      import('../../lib/profile/sync'),
      import('../../lib/profile/daily-email-client'),
    ]).then(([sync, daily]) => {
      if (!active) return;
      const resolver = createInviteAccountResolver({
        getSyncSession: sync.getSyncSession,
        getSyncedChartIds: daily.getSyncedChartIds,
        profileAccessAllowed,
        profileAccessGeneration: () => profileAccessGeneration.current,
        commit(snapshot) {
          setSession(snapshot.session);
          setSyncedIds(snapshot.syncedIds);
          setAccount(snapshot.account);
        },
      });
      accountResolverRef.current = resolver;
      // Subscribe before taking the initial snapshot so an auth transition can
      // always supersede a slower getSyncSession/getSyncedChartIds chain.
      unsubscribe = sync.onSyncAuthChange((next) => void resolver.resolve(next));
      const onProfileAccess = () => {
        if (!profileAccessAllowed()) {
          resolver.invalidate();
          return;
        }
        queueMicrotask(() => {
          if (active && profileAccessAllowed()) void resolver.resolve();
        });
      };
      window.addEventListener('zodiacs:profile-access', onProfileAccess);
      removeProfileAccessListener = () => {
        window.removeEventListener('zodiacs:profile-access', onProfileAccess);
      };
      void resolver.resolve();
    }).catch(() => {
      if (!active) return;
      setSession(null);
      setSyncedIds([]);
      setAccount('signed-out');
    });

    return () => {
      active = false;
      unsubscribe();
      removeProfileAccessListener();
      accountResolverRef.current?.dispose();
      accountResolverRef.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (syncedCharts.length === 1) setSelected(syncedCharts[0].id);
    else if (!syncedCharts.some((chart) => chart.id === selected)) setSelected('');
  }, [syncedIds.join('|'), charts]);

  useEffect(() => {
    if (createState !== 'ready') return;
    requestAnimationFrame(() => {
      linkRef.current?.focus();
      linkRef.current?.select();
    });
  }, [createState]);

  if (!enabled || !visible || account === 'loading') return null;

  async function createInvite() {
    if (!session || !selected || !consent || requestRef.current) return;
    const accessGeneration = profileAccessGeneration.current;
    requestRef.current = true;
    setCreateState('creating');
    setAnnouncement('');
    try {
      const sync = await import('../../lib/profile/sync');
      if (accessGeneration !== profileAccessGeneration.current || !profileAccessAllowed()) return;
      const currentSession = await sync.getSyncSession();
      if (
        accessGeneration !== profileAccessGeneration.current
        || !profileAccessAllowed()
        || !currentSession
      ) return;
      const response = await fetch('/api/compatibility/invites', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${currentSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chartId: selected, consent: true, notify }),
      });
      if (accessGeneration !== profileAccessGeneration.current || !profileAccessAllowed()) return;
      if (response.status === 429) {
        setCreateState('throttled');
        return;
      }
      if (response.status === 409) {
        setCreateState('capped');
        return;
      }
      const payload = await response.json() as unknown;
      if (accessGeneration !== profileAccessGeneration.current || !profileAccessAllowed()) return;
      if (!response.ok || !validCreatedInvite(payload)) throw new Error('invalid invite response');
      rememberInviteLink(payload.id, payload.url);
      setCreated(payload);
      setCreateState('ready');
      setAnnouncement('Invitation link ready.');
      (window as Window & {
        zodiacsAnalytics?: {
          track?: (name: string, props: Record<string, boolean>) => void;
        };
      }).zodiacsAnalytics?.track?.('invite_created', { notify });
      window.dispatchEvent(new CustomEvent('zodiacs:invite-created', { detail: payload }));
    } catch {
      if (accessGeneration !== profileAccessGeneration.current) return;
      setCreateState('error');
    } finally {
      if (accessGeneration !== profileAccessGeneration.current) return;
      requestRef.current = false;
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setAnnouncement('Link copied.');
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
    }
  }

  async function shareLink() {
    if (!created || !navigator.share) return;
    try {
      await navigator.share({
        title: 'An invitation — Zodiacs.org',
        text: 'Compare our charts privately on Zodiacs.org.',
        url: created.url,
      });
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setAnnouncement(COPY.invError);
    }
  }

  if (account === 'signed-out') {
    return (
      <aside class="syn-invite shell" aria-labelledby="syn-invite-title">
        <div class="core syn-invite__core">
          <h2 id="syn-invite-title">{COPY.siTitle}</h2>
          <p>{COPY.siBody}</p>
          <a class="text-link" href="/profile/">{COPY.siCta} →</a>
        </div>
      </aside>
    );
  }

  if (syncedCharts.length === 0) {
    return (
      <aside class="syn-invite shell" aria-labelledby="syn-invite-title">
        <div class="core syn-invite__core">
          <h2 id="syn-invite-title">{COPY.siNoSyncedTitle}</h2>
          <p>{COPY.siNoSyncedBody}</p>
          <a class="text-link" href="/profile/">{COPY.siNoSyncedCta} →</a>
        </div>
      </aside>
    );
  }

  if (createState === 'ready' && created) {
    const expiry = formatExpiry(created.expiresAt);
    return (
      <aside class="syn-invite shell" aria-labelledby="syn-invite-ready-title">
        <div class="core syn-invite__core">
          <h2 id="syn-invite-ready-title">{COPY.invTitle}</h2>
          <label class="field__label" for="syn-invite-link">Private link</label>
          <input
            ref={linkRef}
            id="syn-invite-link"
            class="field__input mono syn-invite__link"
            readOnly
            value={created.url}
          />
          <div class="syn-invite__actions">
            <button type="button" class="btn btn--primary" onClick={copyLink}>
              <span>{COPY.invCopy}</span><span class="orb" aria-hidden="true">↗</span>
            </button>
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <button type="button" class="btn btn--ghost" onClick={shareLink}>{COPY.invShare}</button>
            )}
          </div>
          <p class="syn-invite__ready">
            {(notify ? COPY.invNotifyOn : COPY.invReadyNote).replace('{expiryDate}', expiry)}
          </p>
          <p><a href="/profile/#compat-invites">{COPY.invManageNote}</a></p>
          <p class="mono syn-invite__privacy">{COPY.invPrivacyLine}</p>
          <p class="sr-only" role="status">{announcement}</p>
        </div>
      </aside>
    );
  }

  const stateMessage = createState === 'error'
    ? COPY.invError
    : createState === 'throttled'
      ? COPY.invThrottled
      : createState === 'capped'
        ? COPY.invCapNote
        : '';

  return (
    <aside class="syn-invite shell" aria-labelledby="syn-invite-title">
      <div class="core syn-invite__core">
        <div>
          <h2 id="syn-invite-title">{COPY.invTitle}</h2>
          <p>{COPY.invBody}</p>
        </div>
        <fieldset class="syn-invite__picker">
          <legend>{COPY.invChartLegend}</legend>
          {syncedCharts.map((chart) => (
            <label class="syn-invite__chart" key={chart.id}>
              <input
                type="radio"
                name="syn-invite-chart"
                value={chart.id}
                checked={selected === chart.id}
                onChange={() => setSelected(chart.id)}
              />
              <PastelSign sign={sunSlug(chart)} />
              <span>{chart.name}</span>
            </label>
          ))}
        </fieldset>
        <label class="syn-invite__check">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent((event.currentTarget as HTMLInputElement).checked)} />
          <span>{COPY.invConsentLabel}</span>
        </label>
        <div class="syn-invite__terms">
          <p>{COPY.invTerm1}</p>
          <p>{COPY.invTerm2}</p>
          <p>{COPY.invTerm3}</p>
        </div>
        <label class="syn-invite__check">
          <input type="checkbox" checked={notify} onChange={(event) => setNotify((event.currentTarget as HTMLInputElement).checked)} />
          <span>{COPY.invNotifyLabel}</span>
        </label>
        <p class="field__help">{COPY.invNotifyNote}</p>
        {createState !== 'capped' && (
          <button
            type="button"
            class="btn btn--primary"
            disabled={!selected || !consent || createState === 'creating'}
            onClick={createInvite}
          >
            <span>{createState === 'creating' ? COPY.invCreating : COPY.invCreate}</span>
            <span class="orb" aria-hidden="true">↗</span>
          </button>
        )}
        {stateMessage && <p class="calc__error" role="alert">{stateMessage}</p>}
        {createState === 'capped' && (
          <a class="text-link" href="/profile/#compat-invites">Open your invitations →</a>
        )}
        <p class="sr-only" role="status">{announcement}</p>
      </div>
    </aside>
  );
}

export type ArrivalView =
  | { state: 'idle' | 'loading' }
  | { state: 'ready'; payload: InvitePublicPayload }
  | { state: 'unavailable' | 'offline' };

export function InviteArrival({
  view,
  onRetry,
  onClear,
}: {
  view: ArrivalView;
  onRetry: () => void;
  onClear: () => void;
}) {
  if (view.state === 'idle') return null;
  if (view.state === 'loading') {
    return (
      <section class="syn-arrival shell" aria-live="polite" aria-busy="true">
        <div class="core syn-arrival__core"><p>Opening the invitation…</p></div>
      </section>
    );
  }
  if (view.state === 'offline' || view.state === 'unavailable') {
    const offline = view.state === 'offline';
    return (
      <section class="syn-arrival shell" aria-labelledby="syn-arrival-title">
        <div class="core syn-arrival__core">
          <h2 id="syn-arrival-title">{offline ? "You're offline." : "This invitation isn't available."}</h2>
          <p>{offline
            ? "Opening an invitation needs a connection once, to fetch their side. Reconnect and try again."
            : 'It may have closed, been used, or been copied incompletely. Ask for a fresh link — or read any two charts below.'}</p>
          <button type="button" class="btn btn--ghost" onClick={onRetry}>Try again</button>
        </div>
      </section>
    );
  }
  if (view.state !== 'ready') return null;
  const { payload } = view;
  const signName = payload.sunSign[0].toUpperCase() + payload.sunSign.slice(1);
  return (
    <section class="syn-arrival shell" aria-labelledby="syn-arrival-title">
      <div class="core syn-arrival__core">
        <PastelSign sign={payload.sunSign} size={44} />
        <div class="syn-arrival__copy">
          <h2 id="syn-arrival-title">{payload.label} wants to read your charts together.</h2>
          <p>Their side is already here — a {signName} Sun, shared by them on purpose as chart positions, with no birth details. Add yours and the reading appears below, worked out in your browser. Your details stay here — {payload.label} won't see them, and neither do we.</p>
          {!payload.timeKnown && <p class="field__help">They shared without a birth time, so their Moon is close rather than exact, and houses sit this reading out.</p>}
          <p class="mono syn-arrival__fine">Invitation links close once they're read — and after 14 days at the latest.</p>
        </div>
        <button type="button" class="btn btn--ghost syn-arrival__clear" onClick={onClear}>Remove shared chart</button>
      </div>
    </section>
  );
}

export const INVITE_COPY = COPY;
