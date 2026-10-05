import { CheckOurMath, ResultOpening } from './ChartTrust';
/**
 * The transit page's island: birth input in, the animated Transit Ring out.
 * The natal side resolves once (from a saved chart or the form); the ring
 * itself — the bi-wheel + scrubber — is a lazy chunk loaded on the first
 * "check", so /transits/ carries the wheel and its animation only when a
 * chart exists to draw. The transiting side is live engine math.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BirthFields, birthDateForChart, calendarInPlay, type CalendarChoice } from './BirthFields';
import type { MinimalBody } from '../lib/engine/synastry';
import type { Chart } from '../lib/engine/types';
import type { SavedChart } from '../lib/profile/schema';
import { prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import type { City } from '../lib/geo/search';
import { localizePath, normalizeCatalogLocale, t, type CatalogLocale as Locale } from '../lib/i18n';
import { useEngine, type EngineLoader } from '../lib/hooks/useEngine';
import { loadModule } from '../lib/module-load';
import CalculationReload, { calculationError } from './CalculationReload';
import { useProfile } from '../lib/hooks/useProfile';
import { useProfileAccessGeneration } from '../lib/hooks/useProfileAccessGeneration';
import type { TransitSky } from './transit/TransitRing';
import type { CalendarPositionsSource } from './CalendarSubscribe';
import { eventTransitQuery } from '../lib/events/transit-link';
import type {
  NatalPoint,
  NatalTransitChart,
  TransitBody,
  TransitContact,
} from '../lib/engine/transit-scan';

type RingModule = typeof import('./transit/TransitRing');
type SearchModule = typeof import('./transit/TransitSearch');
type ItineraryModule = typeof import('./transit/TransitItinerary');

const EVENT_COPY = {
  en: { invalid: 'This event link has an invalid date. Your chart will open at the current time.', unknownTime: 'Birth time is unknown. The Moon shown is a midday estimate; precise Moon contacts, houses, angles and exact-date calendar links are unavailable.' },
  es: { invalid: 'Este enlace tiene una fecha no válida. Tu carta se abrirá en el momento actual.', unknownTime: 'La hora de nacimiento es desconocida. La Luna es una estimación al mediodía; los contactos lunares precisos, las casas, los ángulos y la exportación al calendario no están disponibles.' },
  pt: { invalid: 'Este link tem uma data inválida. Seu mapa abrirá no momento atual.', unknownTime: 'A hora de nascimento é desconhecida. A Lua é uma estimativa para o meio-dia; contatos lunares precisos, casas, ângulos e exportação de calendário não estão disponíveis.' },
  fr: { invalid: 'Ce lien contient une date invalide. Ton thème s’ouvrira à l’heure actuelle.', unknownTime: 'L’heure de naissance est inconnue. La Lune est estimée à midi ; les contacts lunaires précis, les maisons, les angles et l’export de calendrier ne sont pas disponibles.' },
  it: { invalid: 'Questo link contiene una data non valida. Il tema si aprirà all’ora attuale.', unknownTime: 'L’ora di nascita è sconosciuta. La Luna è stimata a mezzogiorno; i contatti lunari precisi, le case, gli angoli e l’esportazione del calendario non sono disponibili.' },
  ru: { invalid: 'В этой ссылке указана неверная дата. Карта откроется на текущее время.', unknownTime: 'Время рождения неизвестно. Луна показана приблизительно на полдень; точные лунные аспекты, дома, углы и экспорт календаря недоступны.' },
} satisfies Record<Locale, { invalid: string; unknownTime: string }>;

// The transiting bodies drawn on the outer ring (planets + the Moon; the Moon
// circles fast and is left out of the aspect list, but shown so you can watch it).
const TRANSIT_BODIES = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);

interface SlotState {
  source: 'saved' | 'form';
  savedId: string;
  date: string;
  time: string;
  timeKnown: boolean;
  city: City | null;
  /** The calendar the form's date was written in; absent is Gregorian. */
  calendar?: CalendarChoice;
}

interface NatalWheel {
  computedUtc?: Date | string;
  bodies: { body: string; lon: number; retrograde?: boolean }[];
  asc: number | null;
  mc: number | null;
  cusps: number[] | null;
  minimal: MinimalBody[];
  timeKnown: boolean;
  itineraryTimeKnown: boolean;
  calendarPositions: CalendarPositionsSource | null;
}

interface Result {
  natal: NatalWheel;
  computeSky: (when: Date) => TransitSky[];
  nowMs: number;
  revision: number;
  eventActive: boolean;
}

interface TransitFocusRequest {
  contact: TransitContact;
}

function wheelFromChart(
  r: Chart,
  timeKnown: boolean,
  utc: Date,
  houseSystem: CalendarPositionsSource['houseSystem'] = r.houses?.system ?? 'whole',
): NatalWheel {
  return {
    computedUtc: utc,
    // South Node stays off the drawn wheel — the site-wide convention
    // (share card, demo chart, calculator scene all hide it). `minimal`
    // keeps every body; the aspect search filters by ASPECT_BODIES itself.
    bodies: r.bodies
      .filter((b) => b.body !== 'South Node')
      .map(({ body, lon, retrograde }) => ({ body, lon, retrograde })),
    asc: timeKnown ? (r.angles?.asc ?? null) : null,
    mc: timeKnown ? (r.angles?.mc ?? null) : null,
    cusps: timeKnown ? (r.houses?.cusps ?? null) : null,
    minimal: r.bodies.filter((b) => timeKnown || b.body !== 'Moon').map(({ body, lon }) => ({ body, lon })),
    timeKnown,
    itineraryTimeKnown: timeKnown && !r.flags.some((flag) => flag === 'no-time' || flag === 'dst-gap' || flag === 'dst-fold'),
    calendarPositions: timeKnown ? {
      bodies: r.bodies,
      angles: r.angles ? { asc: r.angles.asc, mc: r.angles.mc } : null,
      houseSystem,
      engineVersion: r.engineVersion,
      utc,
    } : null,
  };
}

type Engine = Awaited<ReturnType<EngineLoader>>;

function calendarPositionsFromSaved(chart: SavedChart): CalendarPositionsSource {
  return {
    bodies: chart.summary.bodies,
    angles: chart.summary.angles,
    houseSystem: chart.summary.houseSystem,
    engineVersion: chart.summary.engineVersion,
    utc: chart.summary.utcISO,
  };
}

function natalFromForm(slot: SlotState, engine: Engine): NatalWheel {
  const timeKnown = slot.timeKnown && slot.time !== '';
  const resolved = resolveLocalToUtc(slot.date, timeKnown ? slot.time : '12:00', slot.city!.tz, { longitude: slot.city!.lon });
  const r = engine.computeChart({
    utc: resolved.utc,
    latitude: slot.city!.lat,
    longitude: slot.city!.lon,
    houseSystem: 'whole',
    timeKnown,
    flags: resolved.flags,
  });
  return wheelFromChart(r, timeKnown, resolved.utc);
}

function natalFromSaved(chart: SavedChart, engine: Engine): NatalWheel {
  if (chart.birth.place) {
    const timeKnown = chart.birth.timeKnown && Boolean(chart.birth.time);
    const resolved = resolveLocalToUtc(
      chart.birth.date,
      timeKnown && chart.birth.time ? chart.birth.time : '12:00',
      chart.birth.place.tz,
      { longitude: chart.birth.place.lon },
    );
    const r = engine.computeChart({
      utc: resolved.utc,
      latitude: chart.birth.place.lat,
      longitude: chart.birth.place.lon,
      houseSystem: chart.summary.houseSystem,
      timeKnown,
      flags: resolved.flags,
    });
    return wheelFromChart(r, timeKnown, resolved.utc, chart.summary.houseSystem);
  }
  // No stored place — draw from the summary (bodies + ascendant), no house ring.
  const timeKnown = chart.birth.timeKnown && Boolean(chart.birth.time);
  return {
    computedUtc: chart.summary.utcISO,
    bodies: chart.summary.bodies
      .filter((b) => b.body !== 'South Node')
      .map(({ body, lon, retrograde }) => ({ body, lon, retrograde })),
    asc: timeKnown ? (chart.summary.angles?.asc ?? null) : null,
    mc: timeKnown ? (chart.summary.angles?.mc ?? null) : null,
    cusps: null,
    minimal: chart.summary.bodies.filter((b) => timeKnown || b.body !== 'Moon').map(({ body, lon }) => ({ body, lon })),
    timeKnown,
    itineraryTimeKnown: false,
    calendarPositions: timeKnown ? calendarPositionsFromSaved(chart) : null,
  };
}

export default function TransitTracker({ locale: rawLocale = 'en' }: { locale?: Locale }) {
  const locale = normalizeCatalogLocale(rawLocale);
  const loadEngine = useEngine();
  const { profile, ready: profileReady } = useProfile();
  const [slot, setSlot] = useState<SlotState>({
    source: 'form', savedId: '', date: '', time: '', timeKnown: true, city: null,
  });
  const [result, setResult] = useState<Result | null>(null);
  const [ringMod, setRingMod] = useState<RingModule | null>(null);
  const [searchMod, setSearchMod] = useState<SearchModule | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchFocus, setSearchFocus] = useState<TransitFocusRequest | null>(null);
  const [itineraryMod, setItineraryMod] = useState<ItineraryModule | null>(null);
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const [itineraryError, setItineraryError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [eventContext, setEventContext] = useState<{ at: number | null; invalid: boolean }>({ at: null, invalid: false });
  const inputRevision = useRef(0);
  const resultRevision = useRef(0);
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const focusAfterComputeRef = useRef(false);
  const initialProfileReadRef = useRef(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  function invalidateInput() {
    inputRevision.current += 1;
    inFlight.current = false;
    focusAfterComputeRef.current = false;
    setResult(null);
    setSearchFocus(null);
    setBusy(false);
    setError('');
  }
  function changeSlot(update: (current: SlotState) => SlotState) {
    invalidateInput();
    setSlot(update);
  }
  const profileAccessGeneration = useProfileAccessGeneration(() => {
    setResult(null);
    setRingMod(null);
    setSearchFocus(null);
    setBusy(false);
    setError('');
    setSlot((current) => current.source === 'saved'
      ? { source: 'form', savedId: '', date: '', time: '', timeKnown: true, city: null }
      : current);
  });

  useEffect(() => {
    setEventContext(eventTransitQuery(window.location?.search ?? ''));
  }, []);

  useEffect(() => {
    mounted.current = true;
    const onProfile = () => {
      if (slotRef.current.source === 'saved') invalidateInput();
    };
    const onAccess = () => {
      inFlight.current = false;
      focusAfterComputeRef.current = false;
      setBusy(false);
    };
    window.addEventListener('zodiacs:profile-access', onAccess);
    window.addEventListener('zodiacs:profile', onProfile);
    return () => {
      mounted.current = false;
      inFlight.current = false;
      window.removeEventListener('zodiacs:profile-access', onAccess);
      window.removeEventListener('zodiacs:profile', onProfile);
    };
  }, []);

  useEffect(() => {
    if (!profileReady || initialProfileReadRef.current) return;
    initialProfileReadRef.current = true;
    // One saved chart and nothing picked yet? Preselect it.
    if (profile.charts.length > 0) {
      setSlot((s) => (s.source === 'form' && s.savedId === '' && s.date === ''
        ? { ...s, source: 'saved', savedId: profile.charts[0].id }
        : s));
    }
  }, [profileReady, profile]);

  const charts = profile.charts;

  const ready = slot.source === 'saved'
    ? charts.some((c) => c.id === slot.savedId)
    : slot.date !== '' && slot.city !== null;

  async function check(e?: Event) {
    e?.preventDefault();
    if (!mounted.current || !ready || inFlight.current) return;
    inFlight.current = true;
    focusAfterComputeRef.current = e !== undefined;
    setBusy(true);
    setError('');
    const accessGeneration = profileAccessGeneration.current;
    const revision = inputRevision.current;
    const capturedSlot = { ...slot, city: slot.city ? { ...slot.city } : null };
    const selected = charts.find((c) => c.id === capturedSlot.savedId);
    const capturedChart = selected ? structuredClone(selected) : null;
    const isCurrent = () => mounted.current && accessGeneration === profileAccessGeneration.current
      && revision === inputRevision.current;
    try {
      if (capturedSlot.source === 'form' && calendarInPlay(capturedSlot.date, capturedSlot.calendar ?? 'gregorian')) {
        // A date before 1924 is read in its calendar; the natal chart uses the Gregorian date.
        const entry = await birthDateForChart(locale, capturedSlot.date, capturedSlot.calendar ?? 'gregorian');
        if (!isCurrent()) return;
        if ('error' in entry) {
          setError(entry.error);
          return;
        }
        capturedSlot.date = entry.date;
      }
      const [engine, mod] = await Promise.all([
        loadEngine(),
        ringMod ? Promise.resolve(ringMod) : loadModule(() => import('./transit/TransitRing')),
        capturedSlot.source === 'saved' && capturedChart
          ? prepareLocalTime(capturedChart.birth.date, capturedChart.birth.place?.tz ?? 'UTC')
          : prepareLocalTime(capturedSlot.date, capturedSlot.city!.tz),
      ]);
      if (!isCurrent()) return;
      if (capturedSlot.source === 'saved' && !capturedChart) return;
      const natal = capturedSlot.source === 'saved'
        ? natalFromSaved(capturedChart!, engine)
        : natalFromForm(capturedSlot, engine);
      const computeSky = (when: Date): TransitSky[] =>
        engine.computeBodies(when)
          .filter((b) => TRANSIT_BODIES.has(b.body))
          .map(({ body, lon, retrograde }) => ({ body, lon, retrograde }));
      if (!isCurrent()) return;
      setRingMod(mod);
      setSearchFocus(null);
      setResult({ natal, computeSky, nowMs: eventContext.at ?? Date.now(),
        eventActive: eventContext.at !== null, revision: ++resultRevision.current });
    } catch (err) {
      if (!isCurrent()) return;
      setError(calculationError(err, locale, t(locale, 'transitError')));
      console.error(err);
    } finally {
      if (isCurrent()) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    if (busy || !focusAfterComputeRef.current) return;
    if (error) {
      errorRef.current?.focus();
      focusAfterComputeRef.current = false;
      return;
    }
    if (result) {
      resultHeadingRef.current?.focus();
      focusAfterComputeRef.current = false;
    }
  }, [busy, error, result]);

  const RingComponent = ringMod?.default;
  const SearchComponent = searchMod?.TransitSearch;
  const ItineraryComponent = itineraryMod?.TransitItinerary;
  const searchNatal: NatalTransitChart | null = useMemo(() => result ? {
    bodies: result.natal.minimal
      .filter((body) => TRANSIT_BODIES.has(body.body))
      .map((body) => ({ body: body.body as TransitBody, lon: body.lon })),
    angles: result.natal.asc != null && result.natal.mc != null
      ? { asc: result.natal.asc, mc: result.natal.mc }
      : null,
  } : null, [result]);
  const searchNatalPoints = searchNatal ? [
    ...searchNatal.bodies.map(({ body }) => ({ name: body as NatalPoint })),
    ...(searchNatal.angles ? [
      { name: 'ASC' as const },
      { name: 'MC' as const },
    ] : []),
  ] : [];

  function openSearch(event: Event): void {
    if (!(event.currentTarget as HTMLDetailsElement).open || searchMod || searchLoading) return;
    setSearchLoading(true);
    setSearchError('');
    void import('./transit/TransitSearch')
      .then(setSearchMod)
      .catch(() => setSearchError('The transit search could not load. Close this section and try again.'))
      .finally(() => setSearchLoading(false));
  }

  function openItinerary(event?: Event): void {
    if ((event && !(event.currentTarget as HTMLDetailsElement).open) || itineraryMod || itineraryLoading) return;
    setItineraryLoading(true); setItineraryError('');
    void loadModule(() => import('./transit/TransitItinerary'))
      .then((mod) => { if (mounted.current) setItineraryMod(mod); })
      .catch(() => { if (mounted.current) setItineraryError('The itinerary could not load. Try again.'); })
      .finally(() => { if (mounted.current) setItineraryLoading(false); });
  }

  function resetDate(nowMs: number, eventActive: boolean) {
    setSearchFocus(null);
    setResult((current) => current ? {
      ...current, nowMs, eventActive, revision: ++resultRevision.current,
    } : null);
  }

  return (
    <div class="calc">
      <form class="calc__form shell" onSubmit={check} aria-busy={busy}>
        <div class="core calc__core">
          <div class="trans__grid">
            <div class="trans__side">
              <span class="mono--label">{t(locale, 'yourChart')}</span>

              {charts.length > 0 && (
                <div class="field">
                  <label class="field__label" for="trans-source">{t(locale, 'chart')}</label>
                  <select
                    id="trans-source" class="field__input"
                    value={slot.source === 'saved' ? slot.savedId : ''}
                    onChange={(e) => {
                      const v = (e.target as HTMLSelectElement).value;
                      changeSlot((s) => (v === ''
                        ? { ...s, source: 'form', savedId: '' }
                        : { ...s, source: 'saved', savedId: v }));
                    }}
                  >
                    <option value="">{t(locale, 'enterBirthDetails')}</option>
                    {charts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {slot.source === 'form' && (
                <BirthFields
                  locale={locale}
                  dateId="trans-date"
                  timeId="trans-time"
                  placeId="trans-place"
                  date={slot.date}
                  time={slot.time}
                  timeKnown={slot.timeKnown}
                  city={slot.city}
                  onDateChange={(date) => changeSlot((s) => ({ ...s, date }))}
                  calendar={slot.calendar ?? 'gregorian'}
                  onCalendarChange={(calendar) => changeSlot((s) => ({ ...s, calendar }))}
                  onTimeChange={(time) => changeSlot((s) => ({ ...s, time }))}
                  onTimeKnownChange={(timeKnown) => changeSlot((s) => ({ ...s, timeKnown }))}
                  onCityChange={(city) => changeSlot((s) => ({ ...s, city }))}
                  onWarm={loadEngine}
                />
              )}
            </div>

            <div class="trans__side">
              <span class="mono--label">{t(locale, 'theSky')}</span>
              <p class="field__help">{t(locale, 'transitRingLede')}</p>
              {eventContext.at !== null && (
                <p class="field__help" data-event-transit-instant>
                  <time dateTime={new Date(eventContext.at).toISOString()}>{new Date(eventContext.at).toISOString()}</time>
                </p>
              )}
              {eventContext.invalid && <p class="notice" role="status">{EVENT_COPY[locale].invalid}</p>}
            </div>
          </div>

          <button class="btn btn--primary calc__submit" type="submit" disabled={!ready || busy}>
            <span>{busy ? t(locale, 'checking') : t(locale, 'checkTransits')}</span>
            <span class="orb">↗</span>
          </button>
          <p class="calc__privacy">{t(locale, 'privacyDevice')}</p>
          {charts.length === 0 && (
            <p class="field__help">
              {t(locale, 'savedChartHelp')}{' '}
              <a href={localizePath(locale, '/birth-chart/')}>{t(locale, 'getBirthChart')} →</a>
            </p>
          )}
          {error && <p class="calc__error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
          <CalculationReload error={error} locale={locale} />
        </div>
      </form>

      {result && RingComponent && (
        <div class="calc__result">
          <h2 class="sr-only" tabIndex={-1} ref={resultHeadingRef}>{t(locale, 'transits')}</h2>
          <ResultOpening locale={locale} />
          <CheckOurMath locale={locale} utc={result.natal.computedUtc} basis={result.natal.timeKnown ? 'birth' : 'reference'} />
          {!result.natal.timeKnown && (
            <p class="notice" role="status">{EVENT_COPY[locale].unknownTime}</p>
          )}
          {/* Keyed on the result revision: a fresh result remounts the ring,
              so a stale scrub offset or focused contact never carries over
              from a previous chart. */}
          <RingComponent
            key={result.revision}
            locale={locale}
            natal={result.natal}
            computeSky={result.computeSky}
            nowMs={result.nowMs}
            focusRequest={searchFocus}
            eventDate={eventContext.at !== null ? {
              active: result.eventActive,
              onSelect: () => resetDate(eventContext.at!, true),
              onNow: () => resetDate(Date.now(), false),
            } : undefined}
          />
        </div>
      )}

      {locale === 'en' && result && searchNatal && (
        <details class="tsearch-host shell" onToggle={openItinerary} data-transit-itinerary-host>
          <summary class="tsearch-host__summary"><span>Your transit itinerary</span><span class="orb" aria-hidden="true">↗</span></summary>
          <div class="core tsearch-host__core">
            {ItineraryComponent ? <ItineraryComponent key={result.revision} natal={searchNatal}
              timeKnown={result.natal.itineraryTimeKnown} birthTimeKnown={result.natal.timeKnown} anchorMs={result.nowMs} />
              : itineraryError ? <div><p class="calc__error" role="alert">{itineraryError}</p>
                <button type="button" class="btn" onClick={() => openItinerary()}>Try again</button></div>
                : <p role="status">{itineraryLoading ? 'Loading your itinerary…' : 'Open to explore your longer transit periods.'}</p>}
          </div>
        </details>
      )}

      {locale === 'en' && (
        <details class="tsearch-host shell" onToggle={openSearch} data-transit-search-host>
          <summary class="tsearch-host__summary">
            <span>Find a transit</span>
            <span class="orb" aria-hidden="true">↗</span>
          </summary>
          <div class="core tsearch-host__core">
            {SearchComponent ? (
              <SearchComponent
                key={result?.revision ?? 'no-chart'}
                natal={searchNatal}
                natalPoints={searchNatalPoints}
                nowMs={result?.nowMs ?? Date.now()}
                onShowOnRing={(contact) => setSearchFocus({ contact })}
                timeKnown={result?.natal.timeKnown ?? true}
              />
            ) : (
              searchError
                ? <p class="calc__error" role="alert">{searchError}</p>
                : (
                    <p class="tsearch__status mono" role="status">
                      {searchLoading ? 'Loading transit search…' : 'Open to load the transit search.'}
                    </p>
                  )
            )}
          </div>
        </details>
      )}
    </div>
  );
}
