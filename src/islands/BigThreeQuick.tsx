import { useEffect, useRef, useState } from 'preact/hooks';
import { BirthFields, birthDateForChart, calendarInPlay, type CalendarChoice } from './BirthFields';
import type { City } from '../lib/geo/search';
import { useEngine } from '../lib/hooks/useEngine';
import CalculationReload, { calculationError } from './CalculationReload';
import { loadModule } from '../lib/module-load';
import { prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import { SIGNS, formatLongitude, signForLongitude, signName } from '../lib/signs';
import { bigThree } from '../lib/interpretations';
import { chartHandoffFragment } from '../lib/chart-handoff';
import type { Chart } from '../lib/engine/types';
import type { PreparedChartCard } from '../lib/share-card';

/**
 * Three fields, one answer: Sun, Moon, and Rising from the same client-side
 * engine as the full calculator, with a share image and a hand-off into the
 * whole chart. The ephemeris loads on demand (warmed when the time field is
 * focused) and never enters this route's static bundle; the share card and
 * its renderer load only after a chart exists. Nothing leaves the browser:
 * the hand-off travels in a URL fragment.
 */

type CardModule = typeof import('../lib/share-card');

interface Placement {
  kind: 'sun' | 'moon' | 'rising';
  title: string;
  lon: number;
}

const TITLES: Record<Placement['kind'], string> = { sun: 'Sun', moon: 'Moon', rising: 'Rising' };
let heldDiscs: HTMLImageElement[] | undefined;

/**
 * All twelve discs, in zodiac order, before the three a chart shows, so the
 * requests do not show its signs. lib/sign-icon.ts does this for the other
 * pages; it is written out here to keep this route's static bundle small.
 */
function requestAllDiscs(): void {
  if (typeof Image === 'undefined' || heldDiscs) return;
  heldDiscs = SIGNS.map(({ slug }) => Object.assign(new Image(), { src: `/assets/zodiac-icons/128/${slug}.webp` }));
}

function track(name: string, props: Record<string, string>): void {
  const analytics = (window as Window & {
    zodiacsAnalytics?: { track?: (name: string, props: Record<string, string>) => void };
  }).zodiacsAnalytics;
  analytics?.track?.(name, props);
}

export default function BigThreeQuick() {
  const loadEngine = useEngine();
  const [date, setDate] = useState('');
  const [calendar, setCalendar] = useState<CalendarChoice>('gregorian');
  const [time, setTime] = useState('');
  const [city, setCity] = useState<City | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placements, setPlacements] = useState<Placement[] | null>(null);
  const [handoff, setHandoff] = useState('');
  const [card, setCard] = useState<{ module: CardModule; prepared: PreparedChartCard; run: number } | null>(null);
  const [cardState, setCardState] = useState<'idle' | 'preparing' | 'ready' | 'sharing' | 'shared' | 'downloaded' | 'failed'>('idle');
  const [cardError, setCardError] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const cardAttempt = useRef(0);
  const cardSource = useRef<{ chart: Chart; run: number } | null>(null);

  useEffect(() => {
    // Warm the same index without placing the search module in the form's
    // initial JavaScript closure; PlaceSearch also warms it on first focus.
    void import('../lib/geo/search').then(({ preloadIndex }) => preloadIndex(), () => {});
    return () => { generation.current += 1; };
  }, []);

  async function prepareCard(): Promise<void> {
    const source = cardSource.current;
    if (!source || source.run !== generation.current) return;
    const attempt = ++cardAttempt.current;
    const isCurrent = () => source.run === generation.current && attempt === cardAttempt.current;
    setCardState('preparing');
    setCardError('');
    try {
      const module = await loadModule(() => import('../lib/share-card'));
      if (!isCurrent()) return;
      const { chart } = source;
      const prepared = await module.prepareBigThreeCard(
        { bodies: chart.bodies, angles: chart.angles, engineVersion: chart.engineVersion, utc: chart.input?.utc },
        'en',
      );
      if (!isCurrent()) return;
      setCard({ module, prepared, run: source.run });
      setCardState('ready');
    } catch (cause) {
      if (!isCurrent()) return;
      setCardError(calculationError(cause, 'en', 'The share card could not be prepared. Try again.'));
      setCardState('failed');
    }
  }

  async function compute(event: Event): Promise<void> {
    event.preventDefault();
    if (!date || !time || !city) {
      setError('Enter a birth date, a birth time, and a birthplace.');
      return;
    }
    const run = ++generation.current;
    setBusy(true);
    setError('');
    cardSource.current = null;
    setCard(null);
    setCardState('idle');
    setCardError('');
    try {
      let day = date;
      if (calendarInPlay(date, calendar)) {
        // A date before 1924 is read in its calendar; the chart and the handoff use the Gregorian date.
        const entry = await birthDateForChart('en', date, calendar);
        if (run !== generation.current) return;
        if ('error' in entry) {
          setError(entry.error);
          setPlacements(null);
          setHandoff('');
          return;
        }
        day = entry.date;
      }
      await prepareLocalTime(day, city.tz);
      const resolution = resolveLocalToUtc(day, time, city.tz, { longitude: city.lon });
      const engine = await loadEngine();
      if (run !== generation.current) return;
      const chart: Chart = engine.computeChart({
        utc: resolution.utc,
        latitude: city.lat,
        longitude: city.lon,
        houseSystem: 'whole',
        timeKnown: true,
        flags: resolution.flags,
      });
      if (run !== generation.current) return;
      const sun = chart.bodies.find((body) => body.body === 'Sun');
      const moon = chart.bodies.find((body) => body.body === 'Moon');
      if (!sun || !moon || !chart.angles) throw new Error('incomplete chart');
      cardSource.current = { chart, run };
      requestAllDiscs();
      setPlacements([
        { kind: 'sun', title: TITLES.sun, lon: sun.lon },
        { kind: 'moon', title: TITLES.moon, lon: moon.lon },
        { kind: 'rising', title: TITLES.rising, lon: chart.angles.asc },
      ]);
      setHandoff(`/birth-chart/#${chartHandoffFragment({
        date: day,
        time,
        timeKnown: true,
        lat: city.lat,
        lon: city.lon,
        tz: city.tz,
        place: city.name,
        houseSystem: 'whole',
      })}`);
      track('chart_computed', { mode: 'rising', source: 'fresh' });
      track('result_rendered', { mode: 'rising' });
      requestAnimationFrame(() => {
        if (run !== generation.current) return;
        resultRef.current?.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start',
        });
      });
    } catch (cause) {
      if (run !== generation.current) return;
      if (cause instanceof RangeError) setError('That date or time is not valid.');
      else setError(calculationError(cause, 'en', 'The chart could not be computed. Check the date, time, and place and try again.'));
      setPlacements(null);
      setHandoff('');
      cardSource.current = null;
      setCardState('idle');
      return;
    } finally {
      if (run === generation.current) setBusy(false);
    }

    // The result is complete even if its optional image cannot be prepared.
    // Prepare before the share tap to retain iOS user activation on that tap.
    void prepareCard();
  }

  function share(): void {
    if (!card) {
      void prepareCard();
      return;
    }
    const source = cardSource.current;
    if (!source || source.run !== generation.current || card.run !== source.run) return;
    const attempt = ++cardAttempt.current;
    const isCurrent = () => source.run === generation.current && attempt === cardAttempt.current;
    setCardError('');
    setCardState('sharing');
    const fail = () => {
      if (!isCurrent()) return;
      setCardError('The card could not be shared or saved. Try again.');
      setCardState('failed');
    };
    try {
      track('chart_share', { variant: 'big_three_card' });
      void card.module.savePreparedChartCard(card.prepared).then((outcome) => {
        if (!isCurrent()) return;
        if (outcome === 'shared' || outcome === 'downloaded') {
          setCardState(outcome);
          track('share_card_downloaded', { variant: 'big_three_card' });
        } else {
          setCardState('ready');
        }
      }).catch(fail);
    } catch {
      fail();
    }
  }

  return (
    <div class="big-three" id="big-three">
      <form class="big-three__form calc__form" onSubmit={compute} noValidate>
        <BirthFields
          locale="en"
          dateId="bt-date"
          timeId="bt-time"
          placeId="bt-place"
          date={date}
          time={time}
          timeKnown={true}
          city={city}
          onDateChange={setDate}
          calendar={calendar}
          onCalendarChange={setCalendar}
          onTimeChange={setTime}
          onTimeKnownChange={() => {}}
          onCityChange={setCity}
          onWarm={() => { void loadEngine(); }}
          showUnknownTime={false}
          requireKnownTime
          timeHelp="Rising needs the time; the Sun and Moon usually don't."
        />
        <div class="big-three__actions">
          <button type="submit" class="btn btn--primary" disabled={busy} data-big-three-submit>
            <span>{busy ? 'Computing…' : 'Show my Big Three'}</span>
            <span class="orb">→</span>
          </button>
          {error && <p class="field__error big-three__error" role="alert">{error}</p>}
          <CalculationReload error={error} locale="en" />
        </div>
      </form>

      {placements && (
        <div class="big-three__result" ref={resultRef} data-big-three-result>
          <div class="calc__three calc__three--3">
            {placements.map(({ kind, title, lon }) => {
              const s = signForLongitude(lon);
              return (
                <div class="three-card shell tinted" style={`--sign:${s.hue}`} key={kind}>
                  <div class="core tinted three-card__core">
                    <span class="mono--label">{title}</span>
                    <span class="three-card__sign">
                      <picture class="three-card__icon">
                        <img src={`/assets/zodiac-icons/128/${s.slug}.webp`} width="44" height="44" alt="" decoding="async" />
                      </picture>
                      {signName(s, 'en')}
                    </span>
                    <span class="mono three-card__deg">{formatLongitude(lon, 'en')}</span>
                    <p class="three-card__read">{bigThree(kind, s.slug)}</p>
                    <a class="three-card__more" href={`/${s.slug}/`}>Read {signName(s, 'en')} →</a>
                  </div>
                </div>
              );
            })}
          </div>

          <div class="big-three__next">
            <a class="btn btn--primary" href={handoff} data-big-three-full>
              <span>See the whole chart</span>
              <span class="orb">↗</span>
            </a>
            <button
              type="button"
              class="btn btn--glass"
              onClick={share}
              disabled={busy || cardState === 'idle' || cardState === 'preparing' || cardState === 'sharing'}
              data-big-three-share
            >
              <span>
                {cardState === 'preparing' ? 'Preparing your card…'
                  : cardState === 'sharing' ? 'Sharing…'
                    : cardState === 'shared' ? 'Shared'
                      : cardState === 'downloaded' ? 'Saved'
                        : cardState === 'failed' ? (card ? 'Try sharing again' : 'Retry card')
                          : 'Share your Big Three'}
              </span>
              <span class="orb">↑</span>
            </button>
          </div>
          {cardError && <p class="field__error big-three__error" role="alert">Your Big Three are ready. {cardError}</p>}
          <CalculationReload error={cardError} locale="en" />
          <p class="big-three__note">
            The full chart adds every planet, the houses, and the aspects between them. Your birth details travel in the
            link's fragment, so they stay in this browser.
          </p>
        </div>
      )}
    </div>
  );
}
