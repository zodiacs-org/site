import { useEffect, useRef, useState } from 'preact/hooks';
import { BirthFields, birthDateForChart, calendarInPlay, type CalendarChoice } from './BirthFields';
import type { City } from '../lib/geo/search';
import { useEngine } from '../lib/hooks/useEngine';
import CalculationReload, { calculationError } from './CalculationReload';
import { createModuleLoader, loadModule } from '../lib/module-load';
import { prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import { SIGNS, formatLongitude, signForLongitude, signName } from '../lib/signs';
import { chartHandoffFragment } from '../lib/chart-handoff';
import type { Chart } from '../lib/engine/types';
import type { PreparedChartCard } from '../lib/share-card';
import { formatSharingCopy, type SharingCopy, type SharingKey } from '../lib/sharing/copy-en';
import { localizePath, t, type CatalogLocale } from '../lib/i18n';

/**
 * Three fields, one answer: Sun, Moon, and Rising from the same client-side
 * engine as the full calculator, with a share image and a hand-off into the
 * whole chart. The ephemeris loads on demand (warmed when the time field is
 * focused) and never enters this route's static bundle; the share card and
 * its renderer load only after a chart exists. Nothing leaves the browser:
 * the hand-off travels in a URL fragment.
 */

type CardModule = typeof import('../lib/share-card');
const loadReading = createModuleLoader(() => import('../lib/interpretations'));
const loadResultTrust = createModuleLoader(() => import('./ChartTrust'));
type ResultTrust = typeof import('./ChartTrust');

interface Placement {
  kind: 'sun' | 'moon' | 'rising';
  title: string;
  lon: number;
}

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

export default function BigThreeQuick({ locale = 'en', copy }: { locale?: CatalogLocale; copy: SharingCopy }) {
  const s = (_locale: CatalogLocale, key: SharingKey, values: Record<string, string | number> = {}) => formatSharingCopy(copy, key, values);
  const loadEngine = useEngine();
  const [date, setDate] = useState('');
  const [calendar, setCalendar] = useState<CalendarChoice>('gregorian');
  const [time, setTime] = useState('');
  const [city, setCity] = useState<City | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [readingModule, setReadingModule] = useState<typeof import('../lib/interpretations') | null>(null);
  const [placements, setPlacements] = useState<Placement[] | null>(null);
  const [resultTrust, setResultTrust] = useState<ResultTrust | null>(null);
  const [resultUtc, setResultUtc] = useState<Date | null>(null);
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
    void import('../lib/geo/search').then(({ preloadIndex }) => preloadIndex()).catch(() => {});
    return () => { generation.current += 1; };
  }, []);

  function edit<T>(setter: (value: T) => void, value: T): void {
    generation.current += 1; cardAttempt.current += 1;
    setter(value); setBusy(false); setPlacements(null); setHandoff('');
    cardSource.current = null; setCard(null); setCardState('idle'); setCardError(''); setError('');
  }

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
        locale,
      );
      if (!isCurrent()) return;
      setCard({ module, prepared, run: source.run });
      setCardState('ready');
    } catch (cause) {
      if (!isCurrent()) return;
      setCardError(calculationError(cause, locale, s(locale, 'cardError')));
      setCardState('failed');
    }
  }

  async function compute(event: Event): Promise<void> {
    event.preventDefault();
    if (!date || !time || !city) {
      setError(s(locale, 'required'));
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
        const entry = await birthDateForChart(locale, date, calendar);
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
      const [engine, trust, reading] = await Promise.all([loadEngine(), loadResultTrust(), locale === 'en' ? loadReading().catch(() => null) : Promise.resolve(null)]);
      if (run === generation.current) setReadingModule(reading);
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
      setResultTrust(trust);
      setResultUtc(chart.input.utc);
      setPlacements([
        { kind: 'sun', title: t(locale, 'sun'), lon: sun.lon },
        { kind: 'moon', title: t(locale, 'moon'), lon: moon.lon },
        { kind: 'rising', title: t(locale, 'rising'), lon: chart.angles.asc },
      ]);
      setHandoff(`${localizePath(locale, '/birth-chart/')}#${chartHandoffFragment({
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
      if (cause instanceof RangeError) setError(s(locale, 'required'));
      else setError(calculationError(cause, locale, s(locale, 'computeError')));
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
      setCardError(s(locale, 'cardError'));
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
          locale={locale}
          dateId="bt-date"
          timeId="bt-time"
          placeId="bt-place"
          date={date}
          time={time}
          timeKnown={true}
          city={city}
          onDateChange={(value) => edit(setDate, value)}
          calendar={calendar}
          onCalendarChange={(value) => edit(setCalendar, value)}
          onTimeChange={(value) => edit(setTime, value)}
          onTimeKnownChange={() => {}}
          onCityChange={(value) => edit(setCity, value)}
          onWarm={() => { void loadEngine(); }}
          showUnknownTime={false}
          requireKnownTime
          timeHelp={<a href={localizePath(locale, '/birth-chart/')}>{s(locale, 'bigHelp')}</a>}
        />
        <div class="big-three__actions">
          <button type="submit" class="btn btn--primary" disabled={busy} data-big-three-submit>
            <span>{s(locale, busy ? 'computing' : 'bigSubmit')}</span>
            <span class="orb">→</span>
          </button>
          {error && <p class="field__error big-three__error" role="alert">{error}</p>}
          <CalculationReload error={error} locale={locale} />
        </div>
      </form>

      {placements && (
        <div class="big-three__result" ref={resultRef} data-big-three-result>
          {resultTrust && <><resultTrust.ResultOpening locale={locale} /><resultTrust.CheckOurMath utc={resultUtc} locale={locale} /></>}
          <div class="calc__three calc__three--3">
            {placements.map(({ kind, title, lon }) => {
              const sign = signForLongitude(lon);
              return (
                <div class="three-card shell tinted" style={`--sign:${sign.hue}`} key={kind}>
                  <div class="core tinted three-card__core">
                    <span class="mono--label">{title}</span>
                    <span class="three-card__sign">
                      <picture class="three-card__icon">
                        <img src={`/assets/zodiac-icons/128/${sign.slug}.webp`} width="44" height="44" alt="" decoding="async" />
                      </picture>
                      {signName(sign, locale)}
                    </span>
                    <span class="mono three-card__deg">{formatLongitude(lon, locale)}</span>
                    {locale === 'en' && readingModule && <p class="three-card__read">{readingModule.bigThree(kind, sign.slug)}</p>}
                    <a class="three-card__more" href={localizePath(locale, `/${sign.slug}/`)}>{s(locale, 'readSign', { sign: signName(sign, locale) })} →</a>
                  </div>
                </div>
              );
            })}
          </div>

          <div class="big-three__next">
            <a class="btn btn--primary" href={handoff} data-big-three-full>
              <span>{s(locale, 'fullChart')}</span>
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
                {s(locale, cardState === 'preparing' ? 'cardPreparing' : cardState === 'sharing' ? 'sharing' : cardState === 'shared' ? 'shared' : cardState === 'downloaded' ? 'saved' : cardState === 'failed' ? 'retry' : 'bigShare')}
              </span>
              <span class="orb">↑</span>
            </button>
          </div>
          {cardError && <p class="field__error big-three__error" role="alert">{cardError}</p>}
          <CalculationReload error={cardError} locale={locale} />
          <p class="big-three__note">{s(locale, 'cardNote')}
          </p>
        </div>
      )}
    </div>
  );
}
