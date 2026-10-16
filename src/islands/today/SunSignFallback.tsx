import { useEffect, useMemo, useState } from 'preact/hooks';
import { SIGNS, type Sign } from '../../lib/signs';
import { signDateRange } from '../../lib/sign-display';
import { editionDateLabel } from '../../lib/edition-freshness';

export const TODAY_SUN_SIGN_STORAGE_KEY = 'zodiacs:today-sun-sign:v1';

type NextAction = 'choose-sun-sign' | 'open-horoscope' | 'get-birth-chart';

interface Props {
  noChartConfirmed?: boolean;
  selfChartUnselected?: boolean;
  comparisonUnavailable?: boolean;
  sunSignLines: Record<string, string>;
  editionDate: string;
}

interface PastelSignIconProps {
  sign: Sign;
  size: number;
  className: string;
}

function PastelSignIcon({ sign, size, className }: PastelSignIconProps) {
  return (
    <picture
      class={className}
      aria-hidden="true"
      style={`display:block;inline-size:${size}px;block-size:${size}px;aspect-ratio:1;contain:layout size`}
    >
      <source srcset={`/assets/zodiac-icons/48/${sign.slug}.avif`} type="image/avif" />
      <img
        src={`/assets/zodiac-icons/48/${sign.slug}.webp`}
        width={size}
        height={size}
        alt=""
        decoding="sync"
        style="display:block;width:100%;height:100%;aspect-ratio:1;object-fit:contain"
      />
    </picture>
  );
}

function trackNextAction(state: 'no-chart' | 'sun-sign', action: NextAction): void {
  if (typeof window === 'undefined') return;
  (window as Window & {
    zodiacsAnalytics?: {
      track?: (name: string, properties: { state: string; action: string }) => void;
    };
  }).zodiacsAnalytics?.track?.('next_action_clicked', { state, action });
}

function readSavedSign(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(TODAY_SUN_SIGN_STORAGE_KEY);
    return SIGNS.some((sign) => sign.slug === saved) ? saved : null;
  } catch {
    return null;
  }
}

function saveSign(slug: string): void {
  try {
    window.localStorage.setItem(TODAY_SUN_SIGN_STORAGE_KEY, slug);
  } catch {
    // The reading still works when local storage is unavailable.
  }
}

export default function SunSignFallback({
  noChartConfirmed = false,
  selfChartUnselected = false,
  comparisonUnavailable = false,
  sunSignLines,
  editionDate,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const saved = readSavedSign();
    setSelected(saved);
  }, []);

  const active = useMemo<Sign | null>(
    () => SIGNS.find((sign) => sign.slug === selected) ?? null,
    [selected],
  );
  const dailyLine = active ? sunSignLines[active.slug] ?? null : null;
  const editionLabel = editionDateLabel(editionDate);
  const introCopy = `This is usually the zodiac sign you know from your birthday. Choose it for one clear note for the ${editionLabel} edition — no birth time needed.`;
  const allReadings = useMemo(
    () => SIGNS.map((sign) => ({
      sign,
      line: sunSignLines[sign.slug]
        ?? `The ${editionLabel} edition note is temporarily unavailable.`,
    })),
    [editionLabel, sunSignLines],
  );

  const chooseSign = (slug: string) => {
    setSelected(slug);
    setHasInteracted(true);
    saveSign(slug);
    trackNextAction('no-chart', 'choose-sun-sign');
  };

  return (
    <div class="today-fallback">
      <div class="today-fallback__intro">
        <h2>Start with your Sun sign</h2>
        <p>{introCopy}</p>
        {/* Keep this line in the server layout. Revealing it after local profile
            lookup must not push the sign picker down after first paint. */}
        <p
          class={`today-fallback__status${noChartConfirmed || selfChartUnselected || comparisonUnavailable ? ' is-visible' : ''}`}
          aria-hidden={noChartConfirmed || selfChartUnselected || comparisonUnavailable ? undefined : 'true'}
        >
          {comparisonUnavailable
            ? 'Your saved-chart comparison is temporarily unavailable. Your Sun sign still gives you a useful starting point.'
            : selfChartUnselected
              ? 'No chart selected as yours. You can also start with your Sun sign.'
              : 'No saved chart on this device. Your Sun sign still gives you a useful starting point.'}
        </p>
      </div>

      <nav class="today-sign-picker" aria-label="Choose your Sun sign">
        <div class="today-sign-picker__grid">
          {SIGNS.map((sign) => (
            <a
              key={sign.slug}
              href={`#today-sun-sign-${sign.slug}`}
              class={`today-sign${selected === sign.slug ? ' today-sign--selected' : ''}`}
              style={`--sign:${sign.hue}`}
              aria-current={selected === sign.slug ? 'true' : undefined}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                  return;
                }
                // Let the native fragment jump finish before the result grid
                // narrows to the selected sign. Modified clicks stay native.
                window.setTimeout(() => chooseSign(sign.slug), 0);
              }}
            >
              <PastelSignIcon sign={sign} size={34} className="today-sign__icon" />
              <span class="today-sign__name">{sign.name}</span>
              <span class="today-sign__dates">{signDateRange(sign)}</span>
            </a>
          ))}
        </div>
      </nav>

      <div
        id="today-sun-sign-reading"
        class="today-fallback__result"
        aria-live={hasInteracted ? 'polite' : undefined}
      >
        {active && dailyLine && hasInteracted ? (
          <section
            id={`today-sun-sign-${active.slug}`}
            class="today-sign-reading"
            style={`--sign:${active.hue}`}
            data-today-sun-sign={active.slug}
          >
            <p class="kicker">Your quick read</p>
            <h3 class="today-sign-reading__title">
              <PastelSignIcon sign={active} size={28} className="today-sign-reading__icon" />
              <span>{active.name} · {editionLabel}</span>
            </h3>
            <p class="today-sign-reading__line">{dailyLine}</p>
            <a
              class="btn btn--primary"
              href={`/horoscopes/${active.slug}/`}
              onClick={() => trackNextAction('sun-sign', 'open-horoscope')}
            >
              <span>Read the {active.name} horoscope</span>
              <span class="orb" aria-hidden="true">→</span>
            </a>
          </section>
        ) : (
          <div class="today-sign-readings" data-today-all-signs>
            {allReadings.map(({ sign, line }) => (
              <article
                key={sign.slug}
                id={`today-sun-sign-${sign.slug}`}
                class="today-sign-reading today-sign-reading--compact"
                style={`--sign:${sign.hue}`}
                data-today-sun-sign={sign.slug}
              >
                <p class="kicker">{signDateRange(sign)}</p>
                <h3 class="today-sign-reading__title">
                  <PastelSignIcon sign={sign} size={28} className="today-sign-reading__icon" />
                  <span>{sign.name} · {editionLabel}</span>
                </h3>
                <p class="today-sign-reading__line">{line}</p>
                <a
                  class="today-sign-reading__more"
                  href={`/horoscopes/${sign.slug}/`}
                  onClick={() => trackNextAction('sun-sign', 'open-horoscope')}
                >
                  Read the full {sign.name} horoscope <span aria-hidden="true">→</span>
                </a>
              </article>
            ))}
          </div>
        )}
      </div>

      <div class="today-fallback__personalize">
        <div>
          <strong>Want a reading based on your whole chart?</strong>
          <p>Add your birth time and place for a more personal daily comparison.</p>
        </div>
        <a
          class="btn btn--ghost"
          href="/birth-chart/"
          onClick={() => trackNextAction('sun-sign', 'get-birth-chart')}
        >
          <span>Get your birth chart</span>
          <span class="orb" aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  );
}
