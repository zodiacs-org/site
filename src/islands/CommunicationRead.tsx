import { useEffect, useMemo, useState } from 'preact/hooks';
import AspectGlyph from '../components/AspectGlyph';
import PlanetGlyph from '../components/PlanetGlyph';
import { trackAnalytics } from '../lib/analytics';
import {
  COMMUNICATION_COPY,
  communicationRead,
} from '../lib/communication';
import type { Chart } from '../lib/engine/types';
import type { ReleasedLocale as Locale } from '../lib/i18n';
import {
  prepareChartCard,
  savePreparedChartCard,
  type PreparedChartCard,
} from '../lib/share-card';
import { aspectLabel } from '../lib/i18n/astrology';
import { signBySlug, signName } from '../lib/signs';
import { signIcon } from '../lib/sign-icon';
import { moonCandidates } from '../lib/moon-certainty';

interface Props {
  chart: Chart;
  locale?: Locale;
}

type ShareState = 'preparing' | 'idle' | 'busy' | 'saved' | 'error';

export default function CommunicationRead({ chart, locale = 'en' }: Props) {
  const read = useMemo(() => communicationRead(chart), [chart]);
  const [shareState, setShareState] = useState<ShareState>('preparing');
  const [preparedCard, setPreparedCard] = useState<PreparedChartCard | null>(null);
  const parts = useMemo(() => [
    {
      body: 'Mercury' as const,
      role: 'How you phrase things',
      sign: read.mercurySign,
      reading: read.mercury,
      addendum: read.mercuryAddendum,
    },
    {
      body: 'Moon' as const,
      role: 'What helps you feel heard',
      sign: read.moonSign,
      reading: read.moon,
      addendum: null,
    },
    {
      body: 'Mars' as const,
      role: 'How you handle friction',
      sign: read.marsSign,
      reading: read.mars,
      addendum: null,
    },
  ], [read]);

  useEffect(() => {
    trackAnalytics('comm_read_view');
  }, [chart]);

  useEffect(() => {
    let current = true;
    setPreparedCard(null);
    setShareState('preparing');
    void prepareChartCard(chart, { variant: 'communication', locale }).then((prepared) => {
      if (!current) return;
      setPreparedCard(prepared);
      setShareState('idle');
    }).catch((error) => {
      console.error(error);
      if (current) setShareState('error');
    });
    return () => { current = false; };
  }, [chart, locale]);

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
      trackAnalytics('chart_share', { variant: 'communication_card' });
      trackAnalytics('share_card_downloaded', { variant: 'communication_card' });
      setShareState('saved');
    }).catch((error) => {
      console.error(error);
      setShareState('error');
    });
  }

  return (
    <section class="calc__comm" aria-labelledby="calc-comm-title">
      <header class="calc__comm-head">
        <div>
          <span class="mono--label">A personal pattern</span>
          <h2 id="calc-comm-title">{COMMUNICATION_COPY.title}</h2>
        </div>
        <button
          class="btn btn--ghost calc__comm-share"
          type="button"
          onClick={shareReading}
          disabled={!preparedCard || shareState === 'preparing' || shareState === 'busy'}
          aria-busy={shareState === 'preparing' || shareState === 'busy'}
          data-card-state={shareState}
          data-communication-share
        >
          <span>{shareState === 'preparing'
            ? 'Preparing your card…'
            : shareState === 'busy' ? 'Opening share…'
            : shareState === 'saved' ? 'Reading shared'
              : shareState === 'error' && !preparedCard ? 'Card unavailable'
                : 'Share this reading'}</span>
          <span class="orb" aria-hidden="true">{shareState === 'saved' ? '✓' : '↗'}</span>
        </button>
      </header>
      <p class="calc__comm-intro">{COMMUNICATION_COPY.intro}</p>

      <div class="calc__comm-flow" aria-hidden="true">
        {parts.map((part, index) => (
          <div class="calc__comm-node" key={part.body}>
            <span class="calc__comm-node-glyph"><PlanetGlyph body={part.body} size={22} /></span>
            <span>{part.body}</span>
            {part.sign && <small>{signName(signBySlug(part.sign), locale)}</small>}
            {index < parts.length - 1 && <span class="calc__comm-connector" />}
          </div>
        ))}
      </div>

      <div class="calc__comm-grid">
        {parts.map((part) => (
          <article class="calc__comm-part" key={part.body}>
            <header class="calc__comm-part-head">
              <span class="calc__comm-planet"><PlanetGlyph body={part.body} size={22} /></span>
              <div>
                <span class="mono--label">{part.body}</span>
                <h3>{part.role}</h3>
              </div>
              {part.sign && (
                <span class="calc__comm-sign" style={`--sign:${signBySlug(part.sign).hue}`}>
                  <picture>
                    <img src={signIcon(48, part.sign)} width="32" height="32" alt="" loading="lazy" decoding="async" />
                  </picture>
                  {signName(signBySlug(part.sign), locale)}
                </span>
              )}
            </header>
            <p>{part.reading}</p>
            {part.addendum && <p class="calc__comm-addendum">{part.addendum}</p>}
            {part.body === 'Mercury' && read.aspects.length > 0 && (
              <ul class="calc__comm-aspects" aria-label="Mercury connections">
                {read.aspects.map((aspect) => (
                  <li key={`${aspect.target}-${aspect.type}-${aspect.orb}`}>
                    <span class="calc__comm-aspect-label">
                      <AspectGlyph type={aspect.type} size={15} />
                      {aspectLabel(locale, aspect.type)} {aspect.target}
                      <small>{aspect.orb.toFixed(1)}°</small>
                    </span>
                    <span>{aspect.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>

      <footer class="calc__deep-read-footer">
        <p class="calc__comm-privacy">Birth details stay off the image.</p>
        {moonCandidates(chart).map((slug) => (
          <a key={slug} href={`/learn/placements/moon-in-${slug}/`}>
            Read Moon in {signName(signBySlug(slug), locale)} →
          </a>
        ))}
      </footer>
      {shareState === 'preparing' && <p class="sr-only" role="status">Preparing your communication card.</p>}
      {shareState === 'saved' && <p class="sr-only" role="status">Your communication card is ready.</p>}
      {shareState === 'error' && (
        <p class="calc__error" role="alert">We couldn’t create that image. Please try again.</p>
      )}
    </section>
  );
}
