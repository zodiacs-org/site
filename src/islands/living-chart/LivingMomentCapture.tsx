import { useRef, useState } from 'preact/hooks';
import type { LivingForecastSnapshotV1, LivingMomentV1 } from '../../lib/living-chart/types';
import { livingMomentCaptureSyncMode } from '../../lib/living-chart/capture-sync-choice';
import type { TodayContact } from '../../lib/today';
import { trackAnalytics } from '../../lib/analytics';
import { useLivingChart } from '../../lib/hooks/useLivingChart';

type ComposerModule = typeof import('./LivingMomentComposer');

const MOVING_FOCUS: Record<string, string> = {
  Sun: 'attention and visibility',
  Moon: 'mood and immediate needs',
  Mercury: 'messages and decisions',
  Venus: 'connection and values',
  Mars: 'effort and assertion',
  Jupiter: 'growth and confidence',
  Saturn: 'limits and responsibility',
  Uranus: 'change and experimentation',
  Neptune: 'longing and ambiguity',
  Pluto: 'power and release',
};

const NATAL_FOCUS: Record<string, string> = {
  Sun: 'your sense of self',
  Moon: 'your emotional life',
  Mercury: 'how you think and speak',
  Venus: 'how you connect and value',
  Mars: 'how you pursue and defend',
  Jupiter: 'how you seek growth',
  Saturn: 'your inner rules',
  Uranus: 'your need for freedom',
  Neptune: 'your imagination and ideals',
  Pluto: 'your relationship with power',
  Ascendant: 'how you meet the room',
  Midheaven: 'your work and public direction',
};

const ASPECT_EXPRESSION: Record<string, string> = {
  conjunction: 'extra emphasis linking',
  sextile: 'an opening between',
  square: 'friction between',
  trine: 'an easier flow between',
  opposition: 'a pull between',
};

export interface ReflectionPrompt {
  id: string;
  question: string;
}

const REFLECTION_BY_ASPECT: Record<string, ReflectionPrompt> = {
  conjunction: {
    id: 'reflection:focus.v1',
    question: 'What deserves your full attention, and what can wait?',
  },
  sextile: {
    id: 'reflection:test-opening.v1',
    question: 'Which small opening is worth testing before you commit more?',
  },
  square: {
    id: 'reflection:clear-step.v1',
    question: 'Where would one clear boundary or next step reduce friction?',
  },
  trine: {
    id: 'reflection:use-support.v1',
    question: 'What is already working that you could use more deliberately?',
  },
  opposition: {
    id: 'reflection:name-needs.v1',
    question: 'Which two needs can you name before choosing between them?',
  },
};

const QUIET_REFLECTION: ReflectionPrompt = {
  id: 'reflection:quiet-room.v1',
  question: 'What can you do with the extra room today without inventing urgency?',
};

export function possibleContactLine(contact: TodayContact): string {
  const moving = MOVING_FOCUS[contact.transiting] ?? contact.transiting.toLowerCase();
  const natal = NATAL_FOCUS[contact.natal] ?? `your natal ${contact.natal}`;
  const expression = ASPECT_EXPRESSION[contact.type] ?? 'a point of attention between';
  return `This symbolic contact can be read as ${expression} ${moving} and ${natal}.`;
}

export function reflectionForContact(contact: TodayContact | null): ReflectionPrompt {
  return contact ? REFLECTION_BY_ASPECT[contact.type] ?? {
    id: 'reflection:notice.v1',
    question: 'What stands out when you compare this theme with what is actually happening?',
  } : QUIET_REFLECTION;
}

interface Props {
  chartLabel: string;
  forecast: LivingForecastSnapshotV1;
  reflectionQuestionId: string;
  syncEnabled?: boolean;
}

export default function LivingMomentCapture({
  chartLabel,
  forecast,
  reflectionQuestionId,
  syncEnabled = false,
}: Props) {
  const [composer, setComposer] = useState<ComposerModule | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedMoment, setSavedMoment] = useState<LivingMomentV1 | null>(null);
  const [message, setMessage] = useState('');
  const [syncDismissed, setSyncDismissed] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const {
    owner,
    syncConsent,
    syncStatus,
    enableSync,
    chooseDeviceOnly,
    retrySync,
    importGuestMoment,
  } = useLivingChart({ readMoments: false, syncEnabled });

  const keepEverywhere = async () => {
    setSyncBusy(true);
    const enabled = syncConsent === 'granted' || await enableSync();
    const moved = enabled
      && savedMoment?.owner.kind === 'guest'
      && owner?.kind === 'account'
      ? await importGuestMoment(savedMoment.id)
      : true;
    if (enabled && moved) await retrySync();
    setSyncBusy(false);
    if (!enabled || !moved) setMessage('Sync could not start for this moment. It is still saved on this device.');
  };

  const keepHere = () => {
    if (syncConsent === 'pending' || syncConsent === 'withdrawn') chooseDeviceOnly();
    setSyncDismissed(true);
  };

  const close = () => {
    setComposer(null);
    window.requestAnimationFrame(() => openButtonRef.current?.focus());
  };

  const open = () => {
    if (composer || loading) return;
    trackAnalytics('living_chart_open', { source: 'today' });
    setMessage('');
    setLoading(true);
    void import('./LivingMomentComposer')
      .then((module) => {
        setComposer(module);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setMessage('The save form could not open. Try again.');
      });
  };

  if (savedMoment) {
    const syncGranted = syncEnabled && syncConsent === 'granted';
    const choiceMode = livingMomentCaptureSyncMode({
      syncEnabled,
      syncDismissed,
      syncConsent,
      syncPhase: syncStatus.phase,
      owner,
      savedOwner: savedMoment.owner,
    });
    return (
      <div class="living-moment-slot" data-living-moment-capture data-living-moment-saved>
        <div class="living-moment-composer__saved">
          <p role="status">Saved to this device.</p>
          {syncGranted && (
            <p class="living-moment-composer__sync-state" role="status">{syncStatus.message}</p>
          )}
          {(choiceMode === 'account_choice' || choiceMode === 'guest_import') && (
            <div class="living-moment-composer__sync-choice" aria-label="Living Chart sync choice">
              <button class="btn btn--primary" type="button" disabled={syncBusy} onClick={() => void keepEverywhere()}>
                {syncBusy ? 'Turning on…' : 'Keep this on every device'}
              </button>
              <button class="living-chart__text-action" type="button" disabled={syncBusy} onClick={keepHere}>
                {choiceMode === 'guest_import' ? 'Leave this save on this device' : 'Keep on this device only'}
              </button>
              <p>
                {choiceMode === 'guest_import'
                  ? 'This save was made before your account was confirmed. It stays here unless you choose to bring it into account sync.'
                  : 'Sync is a separate choice. It stores your Living Chart in your Zodiacs account so signed-in devices can use it.'}
              </p>
            </div>
          )}
          {choiceMode === 'guest_choice' && (
            <div class="living-moment-composer__sync-choice">
              <a class="btn btn--primary" href="/profile/#profile-sync">Keep this on every device</a>
              <button class="living-chart__text-action" type="button" onClick={() => setSyncDismissed(true)}>
                Keep on this device only
              </button>
            </div>
          )}
          {choiceMode === 'checking' && (
            <div class="living-moment-composer__sync-choice" data-living-sync-resolution="checking">
              <p role="status">
                {syncStatus.phase === 'error'
                  ? 'Your account sync setting could not be checked. This moment is saved on this device while you retry.'
                  : 'Checking your account sync setting. This moment is saved on this device for now.'}
              </p>
              {syncStatus.phase === 'error' && (
                <button class="living-chart__text-action" type="button" onClick={() => window.location.reload()}>
                  Retry sync check
                </button>
              )}
            </div>
          )}
          {(syncStatus.phase === 'error' || syncStatus.phase === 'offline') && syncGranted && (
            <button class="living-chart__text-action" type="button" onClick={() => void retrySync()}>Retry sync</button>
          )}
          <p>Return to Today for the next edition. Your timeline keeps this reading beside the observation you saved.</p>
          <a href="/profile/#living-chart">Revisit your saved observations →</a>
        </div>
        {message && <p class="living-moment-composer__status" role="alert">{message}</p>}
      </div>
    );
  }

  if (!composer) {
    return (
      <div class="living-moment-slot" data-living-moment-capture>
        <div class="living-moment-slot__closed">
          <button
            class="btn btn--primary"
            type="button"
            ref={openButtonRef}
            data-living-moment-open
            disabled={loading}
            aria-busy={loading ? 'true' : undefined}
            onClick={open}
          >
            <span>{loading ? 'Opening…' : 'Save this moment'}</span>
            <span class="orb" aria-hidden="true">+</span>
          </button>
          <p class="field__help">Keep today’s reading with a short observation, then revisit it in your timeline. Saving starts on this device.</p>
        </div>
        {message && <p class="living-moment-composer__status" role="alert">{message}</p>}
      </div>
    );
  }

  const Composer = composer.default;
  return (
    <div class="living-moment-slot" data-living-moment-capture>
      <Composer
        chartLabel={chartLabel}
        forecast={forecast}
        reflectionQuestionId={reflectionQuestionId}
        syncEnabled={syncEnabled}
        onCancel={close}
        onSaved={(moment) => {
          setSavedMoment(moment);
          if (syncConsent === 'granted' && moment.owner.kind === 'account') void retrySync();
        }}
      />
    </div>
  );
}
