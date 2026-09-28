import { useEffect, useMemo, useState } from 'preact/hooks';
import { moonCandidates, moonLabel } from '../lib/moon-certainty';
import PlanetGlyph from '../components/PlanetGlyph';
import { approachRead, type ApproachPart } from '../lib/approach';
import { trackAnalytics } from '../lib/analytics';
import type { Chart } from '../lib/engine/types';
import type { ReleasedLocale as Locale } from '../lib/i18n';
import {
  prepareChartCard,
  savePreparedChartCard,
  type PreparedChartCard,
} from '../lib/share-card';
import { signBySlug, signName } from '../lib/signs';
import { signIcon } from '../lib/sign-icon';

interface Props {
  chart: Chart;
  locale?: Locale;
  moonAmbiguous?: boolean;
  /** The civil birth date: the card of a chart without a birth time shows 12:00 UTC on it. */
  birthDate?: string;
}

type ShareState = 'preparing' | 'idle' | 'busy' | 'saved' | 'error';

const BODY_LABEL: Record<ApproachPart['body'], string> = {
  Rising: 'Rising',
  Mercury: 'Mercury',
  Moon: 'Moon',
  Mars: 'Mars',
};

function SignDisc({ part, locale }: { part: ApproachPart; locale: Locale }) {
  return (
    <span class="calc__approach-sign" style={`--sign:${signBySlug(part.sign).hue}`}>
      <picture>
        <img
          src={signIcon(48, part.sign)}
          width="36"
          height="36"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </picture>
      <span>{signName(signBySlug(part.sign), locale)}</span>
    </span>
  );
}

function PartCard({ part, locale }: { part: ApproachPart; locale: Locale }) {
  return (
    <article class="calc__approach-part">
      <header class="calc__approach-part-head">
        <span class="calc__approach-planet" aria-hidden="true">
          {part.body === 'Rising' ? 'ASC' : <PlanetGlyph body={part.body} size={21} />}
        </span>
        <div>
          <span class="mono--label">{BODY_LABEL[part.body]}</span>
          <h3>{part.role}</h3>
        </div>
        <SignDisc part={part} locale={locale} />
      </header>
      <p>{part.reading}</p>
    </article>
  );
}

export default function ApproachRead({
  chart,
  locale = 'en',
  moonAmbiguous = false,
  birthDate,
}: Props) {
  const read = useMemo(
    () => approachRead(chart, { moonAmbiguous }),
    [chart, moonAmbiguous],
  );
  const [shareState, setShareState] = useState<ShareState>('preparing');
  const [preparedCard, setPreparedCard] = useState<PreparedChartCard | null>(null);
  const parts = [read.rising, read.mercury, read.moon, read.avoid].filter(
    (part): part is ApproachPart => part !== null,
  );

  useEffect(() => {
    let current = true;
    setPreparedCard(null);
    setShareState('preparing');
    void prepareChartCard(chart, {
      variant: 'approach',
      locale,
      moonAmbiguous,
      birthDate,
    }).then((prepared) => {
      if (!current) return;
      setPreparedCard(prepared);
      setShareState('idle');
    }).catch((error) => {
      console.error(error);
      if (current) setShareState('error');
    });
    return () => { current = false; };
  }, [chart, locale, moonAmbiguous, birthDate]);

  function shareReading(): void {
    if (!preparedCard || shareState === 'preparing' || shareState === 'busy') return;
    setShareState('busy');
    // The prepared Blob means navigator.share is reached in this exact tap
    // task on iOS; no dynamic import or canvas render can consume activation.
    void savePreparedChartCard(preparedCard).then((outcome) => {
      if (outcome === 'cancelled') {
        setShareState('idle');
        return;
      }
      trackAnalytics('chart_share', { variant: 'approach_card' });
      trackAnalytics('share_card_downloaded', { variant: 'approach_card' });
      setShareState('saved');
    }).catch((error) => {
      console.error(error);
      setShareState('error');
    });
  }

  return (
    <section class="calc__approach" aria-labelledby="calc-approach-title" data-approach-read>
      <header class="calc__approach-head">
        <div>
          <span class="mono--label">A guide for the people in your life</span>
          <h2 id="calc-approach-title">How to approach you</h2>
        </div>
        <button
          class="btn btn--ghost calc__approach-share"
          type="button"
          onClick={shareReading}
          disabled={!preparedCard || shareState === 'preparing' || shareState === 'busy'}
          aria-busy={shareState === 'preparing' || shareState === 'busy'}
          data-card-state={shareState}
          data-approach-share
        >
          <span>{shareState === 'preparing'
            ? 'Preparing your card…'
            : shareState === 'busy' ? 'Opening share…'
            : shareState === 'saved' ? 'Guidance shared'
              : shareState === 'error' && !preparedCard ? 'Card unavailable'
                : 'Share how to approach me'}</span>
          <span class="orb" aria-hidden="true">{shareState === 'saved' ? '✓' : '↗'}</span>
        </button>
      </header>
      <p class="calc__approach-intro">
        A practical guide to making a good first move, saying things so they land, building trust,
        and keeping pressure from becoming conflict.
      </p>

      <div class="calc__approach-path" aria-label="From first contact to trust">
        {parts.map((part, index) => (
          <div class="calc__approach-node" key={part.body}>
            <SignDisc part={part} locale={locale} />
            <small>{part.role}</small>
            {index < parts.length - 1 && <span class="calc__approach-connector" aria-hidden="true" />}
          </div>
        ))}
      </div>

      {!read.rising && (
        <div class="calc__approach-missing" role="note">
          <span class="calc__approach-planet" aria-hidden="true">ASC</span>
          <p><strong>How to open</strong> A birth time is needed to know how you first come across.</p>
        </div>
      )}

      <div class="calc__approach-grid">
        {parts.map((part) => <PartCard part={part} locale={locale} key={part.body} />)}
      </div>

      {read.moonAmbiguous && (
        <p class="calc__approach-warning" role="note">
          {moonLabel(chart, locale)} · A birth time is needed to settle the Moon reading.
        </p>
      )}
      <footer class="calc__deep-read-footer">
        <p class="calc__approach-privacy">Birth details stay off the image.</p>
        {moonCandidates(chart).map((slug) => (
          <a key={slug} href={`/learn/placements/moon-in-${slug}/`}>
            Read Moon in {signName(signBySlug(slug), locale)} →
          </a>
        ))}
      </footer>
      {shareState === 'preparing' && <p class="sr-only" role="status">Preparing your approach card.</p>}
      {shareState === 'saved' && <p class="sr-only" role="status">Your approach card is ready.</p>}
      {shareState === 'error' && (
        <p class="calc__error" role="alert">We couldn’t create that image. Please try again.</p>
      )}
    </section>
  );
}
