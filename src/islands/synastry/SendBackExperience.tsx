import { useEffect, useMemo, useState } from 'preact/hooks';
import { NextActionCard } from '../../components/NextActionCard';
import type { MinimalBody, PairSummary } from '../../lib/engine/synastry';
import type { PositionsShareInput } from '../../lib/share-positions';
import type { PreparedChartCard } from '../../lib/share-card';
import { shareCardText } from '../../lib/share-card-copy';
import { encodeSynastryLink } from '../../lib/share-synastry';
import { loadUntimedSharedPositions } from '../../lib/share-positions-untimed';

interface SendPerson {
  label: string;
  bodies: MinimalBody[];
  asc: number | null;
  positions: PositionsShareInput;
  /**
   * The civil birth date of a chart computed on this device without a birth
   * time. Its positions are noon at the birthplace, which would give the
   * place away, so the link carries the sky at 12:00 UTC on this date
   * instead (see sharedReferenceInstant). Absent for a chart with a birth
   * time and for positions that arrived in a link, which pass on unchanged.
   */
  untimedDate?: string;
}

/** The two-chart link for a pair of sides, with each untimed side at noon UTC on its date. */
export async function sendBackToken(a: SendPerson, b: SendPerson): Promise<string | null> {
  const side = (person: SendPerson) => (person.untimedDate === undefined
    ? Promise.resolve(person.positions)
    : loadUntimedSharedPositions(person.positions, person.untimedDate));
  const [chartA, chartB] = await Promise.all([side(a), side(b)]);
  return chartA && chartB
    ? encodeSynastryLink({ sides: [{ chart: chartA, label: a.label }, { chart: chartB, label: b.label }] })
    : null;
}

type SendMethod = 'share' | 'copy' | 'download';
type ActionState = 'idle' | 'preparing' | 'ready' | 'copied' | 'error';
type BigThreeState = 'preparing' | 'ready' | 'busy' | 'saved' | 'error';
type BigThreeModule = Pick<
  typeof import('../../lib/share-card'),
  'prepareBigThreeCard' | 'savePreparedChartCard'
>;

const COPY = {
  sendCue: 'Before anything else',
  sendTitle: 'Send the result back.',
  sendBody: "{label} can't see this reading — it happened here, on your device. One tap makes a picture of it and a private link that carries the positions and the two labels back, with no birth details.",
  sendShare: 'Share it back',
  sendShareText: 'Our charts, read together — from zodiacs.org',
  sendCopy: 'Copy the private link',
  sendCopied: 'Link copied. It carries chart positions and the two labels, with no birth details.',
  sendImage: 'Download the picture',
} as const;

// The same card offered on a plain result: nobody invited anyone, so the copy
// is about sending, not sending back.
const SHARE_COPY = {
  sendCue: 'Share the reading',
  sendTitle: 'Send this to {label}.',
  sendBody: 'One tap makes a picture of this reading and a private link that carries both charts as positions, with the labels you typed and no birth details.',
  sendShare: 'Send it',
  sendShareText: 'Our charts, read together — from zodiacs.org',
  sendCopy: 'Copy the private link',
  sendCopied: 'Link copied. It carries chart positions and the two labels, with no birth details.',
  sendImage: 'Download the picture',
} as const;

function download(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'zodiacs-compatibility.png';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function SendBackCard({
  a,
  b,
  summary,
  inviterLabel,
  onReturned,
  variant = 'return',
}: {
  a: SendPerson;
  b: SendPerson;
  summary: PairSummary;
  inviterLabel: string;
  onReturned?: (method: SendMethod) => void;
  /** `return` completes an invitation; `share` offers a plain result to the other person. */
  variant?: 'return' | 'share';
}) {
  const wording = variant === 'share' ? SHARE_COPY : COPY;
  const [blob, setBlob] = useState<Blob | null>(null);
  const [state, setState] = useState<ActionState>('preparing');
  const [bigThree, setBigThree] = useState<{
    module: BigThreeModule;
    prepared: PreparedChartCard;
  } | null>(null);
  const [bigThreeState, setBigThreeState] = useState<BigThreeState>('preparing');
  const untimed = a.untimedDate !== undefined || b.untimedDate !== undefined;
  const direct = useMemo(() => (untimed ? null : encodeSynastryLink({
    sides: [
      { chart: a.positions, label: a.label },
      { chart: b.positions, label: b.label },
    ],
  })), [a, b, untimed]);
  const [untimedToken, setUntimedToken] = useState<string | null>(null);
  // Keyed on the sides' values: callers pass fresh wrapper objects each render.
  useEffect(() => {
    setUntimedToken(null);
    if (!untimed) return undefined;
    let active = true;
    void sendBackToken(a, b).then((next) => { if (active) setUntimedToken(next); }, () => {});
    return () => { active = false; };
  }, [a.positions, b.positions, a.label, b.label, a.untimedDate, b.untimedDate]);
  const token = untimed ? untimedToken : direct;
  const url = token && typeof window !== 'undefined'
    ? `${window.location.origin}/compatibility/#s=${token}`
    : '';

  useEffect(() => {
    let active = true;
    setState('preparing');
    void import('../../lib/compatibility-card').then(({ drawCompatibilityCard }) => (
      drawCompatibilityCard(a, b, summary, 'en')
    )).then((next) => {
      if (!active) return;
      setBlob(next);
      setState('ready');
    }).catch(() => {
      if (active) setState('error');
    });
    return () => { active = false; };
  }, [a, b, summary]);

  useEffect(() => {
    let active = true;
    setBigThree(null);
    setBigThreeState('preparing');
    if (!b.positions.angles) return () => { active = false; };
    void import('../../lib/share-card').then(async (module) => {
      const prepared = await module.prepareBigThreeCard(b.positions, 'en');
      if (!active) return;
      setBigThree({ module, prepared });
      setBigThreeState('ready');
    }).catch(() => {
      if (active) setBigThreeState('error');
    });
    return () => { active = false; };
  }, [b.positions]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      onReturned?.('copy');
    } catch {
      setState('error');
    }
  }

  async function share() {
    if (!url || !navigator.share) return;
    const file = blob ? new File([blob], 'zodiacs-compatibility.png', { type: 'image/png' }) : null;
    const data: ShareData = {
      title: 'Our charts, read together — Zodiacs.org',
      text: wording.sendShareText,
      url,
      ...(file && navigator.canShare?.({ files: [file] }) ? { files: [file] } : {}),
    };
    try {
      await navigator.share(data);
      onReturned?.('share');
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setState('error');
    }
  }

  function saveImage() {
    if (!blob) return;
    download(blob);
    onReturned?.('download');
  }

  function shareBigThree() {
    if (!bigThree || bigThreeState === 'busy') return;
    setBigThreeState('busy');
    // The renderer is prepared before this tap. Calling the saved module
    // function directly preserves the iOS share-sheet activation.
    void bigThree.module.savePreparedChartCard(bigThree.prepared).then((outcome) => {
      if (outcome === 'cancelled') {
        setBigThreeState('ready');
        return;
      }
      const analytics = (window as Window & {
        zodiacsAnalytics?: {
          track?: (name: string, props: { variant: string }) => void;
        };
      }).zodiacsAnalytics;
      analytics?.track?.('chart_share', { variant: 'big_three_card' });
      analytics?.track?.('share_card_downloaded', { variant: 'big_three_card' });
      setBigThreeState('saved');
    }).catch(() => setBigThreeState('error'));
  }

  if (!token) return null;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <NextActionCard
      className="syn-sendback"
      cue={wording.sendCue}
      title={wording.sendTitle.replace('{label}', inviterLabel)}
      body={wording.sendBody.replace('{label}', inviterLabel)}
      headingLevel={3}
      primary={canNativeShare ? (
        <button type="button" class="btn btn--primary" onClick={share}>
          <span>{wording.sendShare}</span>
          <span class="orb" aria-hidden="true">↗</span>
        </button>
      ) : (
        <button type="button" class="btn btn--primary" onClick={copy}>
          <span>{wording.sendCopy}</span>
          <span class="orb" aria-hidden="true">↗</span>
        </button>
      )}
      secondary={(
        <>
          {canNativeShare && (
            <button type="button" class="btn btn--ghost" onClick={copy}>{wording.sendCopy}</button>
          )}
          <button
            type="button"
            class="btn btn--ghost"
            onClick={saveImage}
            disabled={!blob}
          >{wording.sendImage}</button>
          {b.positions.angles && (
            <button
              type="button"
              class="btn btn--ghost"
              onClick={shareBigThree}
              disabled={!bigThree || bigThreeState === 'preparing' || bigThreeState === 'busy'}
              data-share-card-action="big-three"
            >
              {shareCardText('en', 'bigThreeAction')}
            </button>
          )}
          {state === 'preparing' && <span class="field__help">Preparing the picture…</span>}
          {state === 'copied' && <p class="sr-only" role="status">{wording.sendCopied}</p>}
          {state === 'error' && <p class="calc__error" role="alert">The share is still here. Please try again.</p>}
          {bigThreeState === 'saved' && (
            <p class="sr-only" role="status">Your Big Three picture is ready.</p>
          )}
          {b.positions.angles && bigThreeState === 'error' && (
            <p class="calc__error" role="alert">The Big Three picture isn't ready. Please try again.</p>
          )}
        </>
      )}
    />
  );
}

export function ReturnBand({
  invalid = false,
  onDismiss,
}: {
  invalid?: boolean;
  onDismiss: () => void;
}) {
  return (
    <section class="syn-return shell" aria-labelledby="syn-return-title">
      <div class="core syn-return__core">
        <p class="next-action__cue mono">Sent back to you</p>
        <div>
          <h2 id="syn-return-title">{invalid ? "This result link isn't right." : 'A reading, sent back.'}</h2>
          <p>{invalid
            ? 'It may have been copied incompletely.'
            : 'Two sides, compared — carried here as chart positions and labels, with no birth details. If one of them is yours, the rest of your chart is a minute away.'}</p>
        </div>
        <div class="syn-return__actions">
          {!invalid && <a class="btn btn--primary" href="/birth-chart/">Get your free birth chart</a>}
          <button type="button" class="btn btn--ghost" onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    </section>
  );
}

export function InvitationConversionCard({
  inviterLabel,
  onSaveChart,
  onSavePair,
  onStartOwn,
  onConverted,
}: {
  inviterLabel: string;
  onSaveChart: () => Promise<boolean>;
  onSavePair?: () => boolean;
  onStartOwn: () => void;
  onConverted?: (action: 'saved_chart' | 'saved_pair' | 'own_chart') => void;
}) {
  const [saveState, setSaveState] = useState<'idle' | 'busy' | 'saved' | 'error'>('idle');

  async function saveChart() {
    if (saveState === 'busy' || saveState === 'saved') return;
    setSaveState('busy');
    const saved = await onSaveChart();
    setSaveState(saved ? 'saved' : 'error');
    if (saved) onConverted?.('saved_chart');
  }

  function savePair() {
    if (!onSavePair?.()) return;
    onConverted?.('saved_pair');
  }

  function startOwn() {
    onConverted?.('own_chart');
    onStartOwn();
  }

  return (
    <NextActionCard
      className="syn-conversion"
      cue="Before you go"
      title="Keep your half."
      body={`Save your chart on this device and your full reading — houses, aspects, the year ahead — is one tap away anytime. ${inviterLabel}'s side isn't kept unless you save the comparison too.`}
      headingLevel={3}
      primary={(
        <button
          type="button"
          class="btn btn--primary"
          disabled={saveState === 'busy' || saveState === 'saved'}
          onClick={saveChart}
        >
          <span>{saveState === 'saved' ? 'Saved on this device' : 'Save my chart'}</span>
          <span class="orb" aria-hidden="true">{saveState === 'saved' ? '✓' : '+'}</span>
        </button>
      )}
      secondary={(
        <>
          {onSavePair && (
            <button type="button" class="btn btn--ghost" onClick={savePair}>
              Keep the whole comparison
            </button>
          )}
          <a class="text-link" href="/profile/">Prefer it on every device? An account syncs it.</a>
          <button type="button" class="btn btn--ghost" onClick={startOwn}>
            Start your own — invite someone to compare with you
          </button>
          {saveState === 'saved' && (
            <p class="field__help" role="status">Saved on this device. Your full chart is in your profile.</p>
          )}
          {saveState === 'error' && (
            <p class="calc__error" role="alert">Couldn't save this chart on the device. Please try again.</p>
          )}
        </>
      )}
    />
  );
}

export const SEND_BACK_COPY = COPY;
