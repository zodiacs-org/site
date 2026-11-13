import type { Session } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { profileAccessAllowed } from '../lib/account-v2/profile-access-reader';
import { useProfileAccessGeneration } from '../lib/hooks/useProfileAccessGeneration';
import {
  derivePostChartDailyState,
  postChartStateShowsSunCapture,
  type PostChartDailyState,
} from '../lib/email/post-chart-state';
import {
  currentPostChartContext,
  isPostChartContext,
  type PostChartContext,
} from '../lib/profile/post-chart-context';

const COPY = {
  syncedTitle: 'This chart can have its own daily brief.',
  syncedCta: 'Set it up in your profile',
  pendingTitle: 'Almost on.',
  pendingAddressChanged: 'A confirmation is still pending. Resend the link to your current account email, then confirm it to begin the daily brief.',
  pendingResend: 'Resend the link',
  pendingAgain: 'Another confirmation link is on its way. The newest link is the one that works.',
  activeLink: 'Manage it in your profile.',
  pausedTitle: 'Your daily brief is paused.',
  pausedBody: 'The chart it read was deleted, so delivery stopped. Choose another synced chart whenever you’re ready. Nothing is chosen for you.',
  pausedCta: 'Choose in your profile',
  error: "Couldn't resend the link. Please try again.",
} as const;

type StableView =
  | Extract<PostChartDailyState, { kind: 'device-only' | 'signed-in-unsynced' | 'paused' }>
  | (Extract<PostChartDailyState, { kind: 'synced-eligible' }> & { chartName: string })
  | Extract<PostChartDailyState, { kind: 'pending' }>
  | (Extract<PostChartDailyState, { kind: 'active' }> & { chartName: string });

type View = { kind: 'idle' | 'unavailable' } | StableView;

interface PostChartDailyBriefProps {
  idPrefix: string;
}

interface ResolveOptions {
  preserveStable?: boolean;
  pendingStatus?: string;
}

function isStableView(view: View): view is StableView {
  return view.kind !== 'idle' && view.kind !== 'unavailable';
}

function fallbackChartName(current: boolean): string {
  return current ? 'this saved chart' : 'your selected chart';
}

export function PostChartDailyBrief({ idPrefix }: PostChartDailyBriefProps) {
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [resendBusy, setResendBusy] = useState(false);
  const [resendStatus, setResendStatus] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const resendButtonRef = useRef<HTMLButtonElement>(null);
  const contextRef = useRef<PostChartContext | null>(null);
  // Undefined has not been resolved for this context; null is observed signed-out.
  const sessionRef = useRef<Session | null | undefined>(undefined);
  const generationRef = useRef(0);
  const profileAccessGeneration = useProfileAccessGeneration(() => {
    generationRef.current += 1;
    sessionRef.current = undefined;
    setView({ kind: 'idle' });
    setResendBusy(false);
    setResendStatus('');
  });

  async function resolveContext(
    context: PostChartContext,
    suppliedSession?: Session | null,
    options: ResolveOptions = {},
  ): Promise<void> {
    if (!document.documentElement.hasAttribute('data-daily-email-lifecycle')) return;
    const generation = ++generationRef.current;
    const accessGeneration = profileAccessGeneration.current;
    const requestIsCurrent = () => (
      generation === generationRef.current
      && accessGeneration === profileAccessGeneration.current
      && context.contextId === contextRef.current?.contextId
      && profileAccessAllowed()
    );
    if (!options.preserveStable) setView({ kind: 'idle' });
    setResendStatus('');
    try {
      const [sync, daily, store] = await Promise.all([
        import('../lib/profile/sync'),
        import('../lib/profile/daily-email-client'),
        import('../lib/profile/store'),
      ]);
      if (!requestIsCurrent()) return;
      const session = suppliedSession === undefined
        ? await sync.getSyncSession()
        : suppliedSession;
      if (!requestIsCurrent()) return;
      sessionRef.current = session;

      if (!session) {
        setView({ kind: 'device-only' });
        return;
      }

      const [syncedChartIds, preference] = await Promise.all([
        daily.getSyncedChartIds(session.user.id),
        daily.getDailyChartPreference(session.access_token),
      ]);
      if (!requestIsCurrent()) return;
      const state = derivePostChartDailyState({
        authenticated: true,
        currentChartId: context.chartId,
        syncedChartIds,
        preference,
      });
      if (!state) {
        setView({ kind: 'unavailable' });
        return;
      }

      const chartNames = new Map(store.loadProfile().charts.map((chart) => [chart.id, chart.name]));
      if (state.kind === 'synced-eligible') {
        setView({
          ...state,
          chartName: chartNames.get(state.chartId) ?? fallbackChartName(true),
        });
      } else if (state.kind === 'active') {
        setView({
          ...state,
          chartName: chartNames.get(state.chartId)
            ?? fallbackChartName(state.chartId === context.chartId),
        });
      } else {
        setView(state);
      }
      if (state.kind === 'pending' && options.pendingStatus) {
        setResendStatus(options.pendingStatus);
      }
    } catch {
      if (requestIsCurrent()) setView({ kind: 'unavailable' });
    }
  }

  useEffect(() => {
    if (!document.documentElement.hasAttribute('data-daily-email-lifecycle')) return;
    let active = true;
    let unsubscribe = () => {};

    const onClear = () => {
      generationRef.current += 1;
      contextRef.current = null;
      sessionRef.current = undefined;
      setView({ kind: 'idle' });
      setResendBusy(false);
      setResendStatus('');
    };
    const onComputed = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: string }>).detail;
      if (detail?.mode !== 'full') return;
      onClear();
    };
    const onContext = (event: Event) => {
      const context = (event as CustomEvent<unknown>).detail;
      if (!isPostChartContext(context)) return;
      if (contextRef.current !== context) setResendBusy(false);
      contextRef.current = context;
      void resolveContext(context);
    };
    const refresh = () => {
      const context = contextRef.current;
      if (context) void resolveContext(context, sessionRef.current, { preserveStable: true });
    };
    const onProfileAccess = () => {
      const context = contextRef.current;
      // The access hook advances its generation even for an allowed refresh.
      // The replacement view must not inherit a prior request's busy state.
      setResendBusy(false);
      if (context && profileAccessAllowed()) {
        void resolveContext(context, undefined, { preserveStable: true });
      }
    };

    window.addEventListener('zodiacs:chart-computed', onComputed);
    window.addEventListener('zodiacs:chart-context-cleared', onClear);
    window.addEventListener('zodiacs:chart-context', onContext);
    window.addEventListener('zodiacs:profile-synced', refresh);
    window.addEventListener('zodiacs:profile-access', onProfileAccess);

    const initial = currentPostChartContext();
    if (initial) {
      contextRef.current = initial;
      void resolveContext(initial);
    }

    void import('../lib/profile/sync').then((sync) => {
      if (!active) return;
      unsubscribe = sync.onSyncAuthChange((session) => {
        const context = contextRef.current;
        if (!context) {
          sessionRef.current = undefined;
          return;
        }
        if (sessionRef.current?.user.id !== session?.user.id
          || sessionRef.current?.access_token !== session?.access_token) setResendBusy(false);
        sessionRef.current = session;
        void resolveContext(context, session, { preserveStable: true });
      });
    }).catch(() => {});

    return () => {
      active = false;
      generationRef.current += 1;
      contextRef.current = null;
      sessionRef.current = undefined;
      unsubscribe();
      window.removeEventListener('zodiacs:chart-computed', onComputed);
      window.removeEventListener('zodiacs:chart-context-cleared', onClear);
      window.removeEventListener('zodiacs:chart-context', onContext);
      window.removeEventListener('zodiacs:profile-synced', refresh);
      window.removeEventListener('zodiacs:profile-access', onProfileAccess);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const shell = root?.closest<HTMLElement>('[data-email-capture-shell]');
    if (!root || !shell) return;
    const copy = shell.querySelector<HTMLElement>('.email-capture__copy');
    const form = shell.querySelector<HTMLFormElement>('[data-email-capture]');
    const note = shell.querySelector<HTMLElement>('[data-post-chart-device-note]');
    if (!isStableView(view)) {
      shell.hidden = true;
      shell.setAttribute('aria-busy', 'true');
      delete shell.dataset.postChartState;
      return;
    }

    const showSun = postChartStateShowsSunCapture(view);
    const submit = form?.querySelector<HTMLElement>('.email-capture__submit');
    const sunIsSecondary = view.kind === 'synced-eligible';
    if (copy) copy.hidden = !showSun;
    if (form) form.hidden = !showSun;
    if (submit) {
      submit.classList.toggle('btn--primary', !sunIsSecondary);
      submit.classList.toggle('btn--ghost', sunIsSecondary);
    }
    if (note) note.hidden = view.kind !== 'device-only' && view.kind !== 'signed-in-unsynced';
    shell.dataset.postChartState = view.kind;
    shell.removeAttribute('aria-busy');
    if (view.kind === 'device-only' || view.kind === 'signed-in-unsynced') {
      shell.setAttribute('aria-labelledby', `${idPrefix}-title`);
      shell.removeAttribute('aria-label');
    } else if (view.kind === 'active') {
      shell.removeAttribute('aria-labelledby');
      shell.setAttribute('aria-label', 'Personal daily brief');
    } else {
      shell.setAttribute('aria-labelledby', `${idPrefix}-post-title`);
      shell.removeAttribute('aria-label');
    }
    shell.hidden = false;
  }, [idPrefix, view]);

  async function resendPending(): Promise<void> {
    if (view.kind !== 'pending' || !sessionRef.current || !contextRef.current) return;
    const startingContext = contextRef.current;
    const startingSession = sessionRef.current;
    const accessGeneration = profileAccessGeneration.current;
    const requestIsCurrent = () => (
      accessGeneration === profileAccessGeneration.current
      && contextRef.current === startingContext
      && sessionRef.current?.user.id === startingSession.user.id
      && sessionRef.current?.access_token === startingSession.access_token
      && profileAccessAllowed()
    );
    let restoreFocus = false;
    setResendBusy(true);
    setResendStatus('');
    try {
      const daily = await import('../lib/profile/daily-email-client');
      if (!requestIsCurrent()) return;
      await daily.resendDailyChartPreference(startingSession.access_token);
      if (!requestIsCurrent()) return;
      await resolveContext(startingContext, startingSession, {
        preserveStable: true,
        pendingStatus: COPY.pendingAgain,
      });
      restoreFocus = requestIsCurrent();
    } catch {
      if (!requestIsCurrent()) return;
      await resolveContext(startingContext, startingSession, {
        preserveStable: true,
        pendingStatus: COPY.error,
      });
      restoreFocus = requestIsCurrent();
    } finally {
      if (!requestIsCurrent()) return;
      setResendBusy(false);
      if (restoreFocus) {
        const generation = generationRef.current;
        requestAnimationFrame(() => {
          if (generation === generationRef.current && requestIsCurrent()) {
            resendButtonRef.current?.focus({ preventScroll: true });
          }
        });
      }
    }
  }

  let content = null;
  if (view.kind === 'synced-eligible') {
    content = (
      <>
        <h2 id={`${idPrefix}-post-title`}>{COPY.syncedTitle}</h2>
        <p>
          A personal morning email for{' '}
          <span class="post-chart-daily__inline-value" title={view.chartName}>{view.chartName}</span>
          , where each day’s sky touches its saved placements, not just its Sun sign.
        </p>
        <div class="post-chart-daily__actions">
          <a class="btn btn--primary" href="/profile/#daily-brief">{COPY.syncedCta}</a>
        </div>
      </>
    );
  } else if (view.kind === 'pending') {
    content = (
      <>
        <h2 id={`${idPrefix}-post-title`}>{COPY.pendingTitle}</h2>
        {view.maskedEmail ? (
          <p class="post-chart-daily__status-line" title={view.maskedEmail}>
            Confirm from the email we sent to{' '}
            <span class="post-chart-daily__inline-value" title={view.maskedEmail}>{view.maskedEmail}</span>
            {' '}and the daily brief begins.
          </p>
        ) : <p>{COPY.pendingAddressChanged}</p>}
        <div class="post-chart-daily__actions">
          <button
            ref={resendButtonRef}
            class="btn btn--ghost"
            type="button"
            disabled={resendBusy}
            aria-busy={resendBusy}
            onClick={() => void resendPending()}
          >
            {COPY.pendingResend}
          </button>
        </div>
        <p class="post-chart-daily__status" role="status" aria-live="polite">{resendStatus}</p>
      </>
    );
  } else if (view.kind === 'active') {
    content = (
      <p class="post-chart-daily__active">
        <span class="post-chart-daily__status-line" title={view.chartName}>
          The personal daily brief is on for {view.chartName}.
        </span>{' '}
        <a href="/profile/#daily-brief">{COPY.activeLink}</a>
      </p>
    );
  } else if (view.kind === 'paused') {
    content = (
      <>
        <h2 id={`${idPrefix}-post-title`}>{COPY.pausedTitle}</h2>
        <p>{COPY.pausedBody}</p>
        <div class="post-chart-daily__actions">
          <a class="btn btn--primary" href="/profile/#daily-brief">{COPY.pausedCta}</a>
        </div>
      </>
    );
  }

  const panelVisible = view.kind === 'synced-eligible'
    || view.kind === 'pending'
    || view.kind === 'active'
    || view.kind === 'paused';
  return (
    <div
      ref={rootRef}
      class={`post-chart-daily${panelVisible ? ' post-chart-daily--visible' : ''}`}
      data-post-chart-controller
      data-post-chart-panel={panelVisible ? view.kind : undefined}
      hidden={!panelVisible}
    >
      {content}
    </div>
  );
}
