import { CheckOurMath } from './ChartTrust';
/**
 * Moon phase, two ways: tonight's (lite math, instant, no ephemeris)
 * and the moon of any date — a birthday, usually — via the lazy-loaded
 * full engine for a precise longitude.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import EvidenceDisclosure from './EvidenceDisclosure';
import PlaceSearch from './PlaceSearch';
import SignChip from './SignChip';
import {
  moonIllumination, moonLongitude, moonPhaseAngle, moonPhaseName, moonPhaseNameFromAngle,
} from '../lib/engine/lite';
import type { MoonPhaseName } from '../lib/engine/lite';
import { formatLongitude, signForLongitude, signName, signPrepositional } from '../lib/signs';
import { prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import { assessLocalDateReference } from '../lib/time/local-date-reference';
import type { City } from '../lib/geo/search';
import { localizePath, normalizeCatalogLocale, t, tf, type CatalogLocale as Locale } from '../lib/i18n';
import { chartHandoffFragment, dateHandoffFragment } from '../lib/chart-handoff';
import { formatDateTime } from '../lib/i18n/dates';
import { moonPhaseLabel } from '../lib/i18n/astrology';
import { useEngine } from '../lib/hooks/useEngine';
import CalculationReload, { calculationError } from './CalculationReload';

/**
 * The lit portion of the disc as one path: the limb on the bright side,
 * back along the terminator ellipse. Angle 0 = new, 180 = full.
 */
function PhaseDisc({
  angle, locale, size = 120, ariaHidden = false,
}: { angle: number; locale: Locale; size?: number; ariaHidden?: boolean }) {
  const r = 44;
  const cosA = Math.cos((angle * Math.PI) / 180);
  const waxing = angle < 180;
  const rx = Math.max(0.5, Math.abs(cosA) * r);
  const limbSweep = waxing ? 1 : 0;
  const bowRight = waxing ? cosA > 0 : cosA < 0;
  const termSweep = bowRight ? 0 : 1;
  const lit = `M 50 ${50 - r} A ${r} ${r} 0 0 ${limbSweep} 50 ${50 + r} A ${rx} ${r} 0 0 ${termSweep} 50 ${50 - r} Z`;
  return (
    <svg
      class="mp__disc" viewBox="0 0 100 100" width={size} height={size}
      role={ariaHidden ? undefined : 'img'}
      aria-hidden={ariaHidden ? 'true' : undefined}
      aria-label={ariaHidden ? undefined : tf(locale, 'moonDiscAria', {
        percent: Math.round(moonIlluminationFromAngle(angle) * 100),
      })}
    >
      <circle cx="50" cy="50" r={r} fill="var(--void-2)" stroke="var(--hair-2)" stroke-width="1" />
      {angle > 2 && angle < 358 && <path d={lit} fill="var(--ink-1, #E8EAF0)" opacity="0.92" />}
    </svg>
  );
}

function moonIlluminationFromAngle(angle: number): number {
  return (1 - Math.cos((angle * Math.PI) / 180)) / 2;
}

interface Lookup {
  computedUtc: Date;
  reference: boolean;
  phase: MoonPhaseName;
  angle: number;
  illum: number;
  lon: number;
  /** Captured reference or UTC-conversion caption; empty for a supplied local time. */
  caption: string;
}

/** Exactly the inputs a shown result was computed from; the chart hand-off reads only these. */
interface LookupInputs {
  date: string;
  time: string | null;
  city: City | null;
}

/**
 * Birth details travel in the fragment only: never in a query string, a
 * request, or a log. A known place carries the full details codec.
 */
function birthChartHandoff(inputs: LookupInputs): string {
  const { date, time, city } = inputs;
  return city
    ? chartHandoffFragment({ date, time, timeKnown: time !== null, lat: city.lat, lon: city.lon,
      tz: city.tz, place: city.name.slice(0, 40), houseSystem: 'whole' })
    : dateHandoffFragment(date, time);
}

export default function MoonPhaseTool({ locale: rawLocale = 'en' }: { locale?: Locale }) {
  const locale = normalizeCatalogLocale(rawLocale);
  const loadEngine = useEngine();
  const [now, setNow] = useState<Date | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [city, setCity] = useState<City | null>(null);
  const [result, setResult] = useState<Lookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const focusAfterComputeRef = useRef(false);
  const lookupRevisionRef = useRef(0);
  const handoffInputsRef = useRef<LookupInputs | null>(null);

  useEffect(() => {
    setNow(new Date());
    return () => {
      lookupRevisionRef.current += 1;
      focusAfterComputeRef.current = false;
    };
  }, []);

  function invalidateLookup(): void {
    lookupRevisionRef.current += 1;
    focusAfterComputeRef.current = false;
    setResult(null);
    setError('');
    setBusy(false);
  }

  async function lookup(e: Event) {
    e.preventDefault();
    if (!date) return;
    const revision = ++lookupRevisionRef.current;
    const localDateReferenceFailure = new Error('Could not establish a calculation time within the local date.');
    const isCurrent = () => revision === lookupRevisionRef.current;
    focusAfterComputeRef.current = true;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const [engine] = await Promise.all([loadEngine(), city ? prepareLocalTime(date, city.tz) : null]);
      if (!isCurrent()) return;
      const hasTime = time !== '';
      let utc: Date;
      if (city) {
        utc = resolveLocalToUtc(date, hasTime ? time : '12:00', city.tz, { longitude: city.lon }).utc;
        if (!hasTime) {
          try {
            if (assessLocalDateReference(date, utc, city.tz).referenceStatus !== 'member') throw localDateReferenceFailure;
          } catch { throw localDateReferenceFailure; }
        }
      } else {
        utc = new Date(`${date}T${hasTime ? time : '12:00'}:00Z`);
      }
      const lon = engine.bodyLongitude('Moon', utc);
      const sunLon = engine.bodyLongitude('Sun', utc);
      const angle = (((lon - sunLon) % 360) + 360) % 360;

      const caption = city && hasTime
        ? ''
        : city
          ? t(locale, 'referenceLocalCaption')
          : hasTime
            ? t(locale, 'utcTimeCaption')
            : t(locale, 'referenceUtcCaption');

      if (!isCurrent()) return;
      handoffInputsRef.current = { date, time: hasTime ? time : null, city };
      setResult({
        computedUtc: utc,
        reference: !hasTime,
        phase: moonPhaseNameFromAngle(angle),
        angle,
        illum: moonIlluminationFromAngle(angle),
        lon,
        caption,
      });
    } catch (err) {
      if (!isCurrent()) return;
      setResult(null);
      setError(err === localDateReferenceFailure ? t(locale, 'localDateReferenceError')
        : calculationError(err, locale, t(locale, 'moonError')));
      console.error(err);
    } finally {
      if (isCurrent()) setBusy(false);
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

  return (
    <div class="calc mp">
      {/* Same shell before hydration so the page doesn't jump. */}
      <div class="mp__tonight shell">
        <div class="core mp__tonight-core">
          <PhaseDisc angle={now ? moonPhaseAngle(now) : 0} locale={locale} ariaHidden={now === null} />
          <div class="mp__tonight-facts">
            <em class="kicker">{t(locale, 'rightNow')}</em>
            <strong class="mp__phase">{now ? moonPhaseLabel(locale, moonPhaseName(now)) : t(locale, 'moonReadingSky')}</strong>
            <span class="mono mp__meta">
              {now
                ? `${Math.round(moonIllumination(now) * 100)}% ${t(locale, 'illuminated')} · ${t(locale, 'moonIn')} ${locale === 'ru' ? signPrepositional(signForLongitude(moonLongitude(now))) : signName(signForLongitude(moonLongitude(now)), locale)}`
                : '—'}
            </span>
            {now && (
              <EvidenceDisclosure label={t(locale, 'howWeCompute')}>
                <span class="mono mp__meta mp__meta--faint">
                  {formatDateTime(locale, now, {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    timeZone: 'UTC', hour12: false,
                  })} UTC
                </span>
              </EvidenceDisclosure>
            )}
          </div>
        </div>
      </div>

      <form class="calc__form shell" onSubmit={lookup} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <div class="field">
              <label class="field__label" for="mp-date">{t(locale, 'date')}</label>
              <input
                id="mp-date" class="field__input" type="date" required
                min="1800-01-01" max="2199-12-31" value={date}
                onFocus={() => loadEngine()}
                onInput={(e) => {
                  invalidateLookup();
                  setDate((e.target as HTMLInputElement).value);
                }}
              />
              <p class="field__help">{t(locale, 'dateHelp')}</p>
            </div>
            <div class="field">
              <label class="field__label" for="mp-time">{t(locale, 'time')} <span class="field__optional">{t(locale, 'optional')}</span></label>
              <input
                id="mp-time" class="field__input" type="time" value={time}
                onInput={(e) => {
                  invalidateLookup();
                  setTime((e.target as HTMLInputElement).value);
                }}
              />
            </div>
            <div class="field">
              <label class="field__label" for="mp-place">{t(locale, 'place')} <span class="field__optional">{t(locale, 'optional')}</span></label>
              <PlaceSearch id="mp-place" selected={city} onSelect={(value) => {
                invalidateLookup();
                setCity(value);
              }} locale={locale} />
              <p class="field__help">{t(locale, 'placeHelpMoon')}</p>
            </div>
          </div>

          <button class="btn btn--primary calc__submit" type="submit" disabled={!date || busy}>
            <span>{busy ? t(locale, 'computing') : t(locale, 'findThatMoon')}</span>
            <span class="orb">↗</span>
          </button>
          <p class="calc__privacy">{t(locale, 'privacyDevice')}</p>
          {error && <p class="calc__error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
          <CalculationReload error={error} locale={locale} />
        </div>
      </form>

      {result && (
        <div class="calc__result">
          <h2 class="sr-only" tabIndex={-1} ref={resultHeadingRef}>{t(locale, 'moonPhase')}</h2>
          <CheckOurMath locale={locale} utc={result.computedUtc} basis={result.reference ? 'sky-reference' : 'birth'} />
          <div class="mp__lookup shell tinted" style={`--sign:${signForLongitude(result.lon).hue}`}>
            <div class="core tinted mp__tonight-core">
              <PhaseDisc angle={result.angle} locale={locale} />
              <div class="mp__tonight-facts">
                <strong class="mp__phase">{moonPhaseLabel(locale, result.phase)}</strong>
                <span class="mono mp__meta">{Math.round(result.illum * 100)}% {t(locale, 'illuminated')}</span>
                <span class="mp__signline">
                  {t(locale, 'moonIn')} {locale === 'ru'
                    ? signPrepositional(signForLongitude(result.lon))
                    : <SignChip lon={result.lon} locale={locale} />}
                </span>
                <EvidenceDisclosure label={t(locale, 'howWeCompute')}>
                  <span class="mono mp__meta mp__meta--faint">{formatLongitude(result.lon, locale)}</span>
                </EvidenceDisclosure>
              </div>
            </div>
          </div>
          {result.caption !== '' && (
            <p class="notice" role="status">
              {result.caption}
            </p>
          )}
          <div class="calc__actions">
            <a
              class="btn btn--ghost"
              href={handoffInputsRef.current
                ? `${localizePath(locale, '/birth-chart/')}#${birthChartHandoff(handoffInputsRef.current)}`
                : localizePath(locale, '/birth-chart/')}
              data-birth-chart-handoff
            >
              <span>{t(locale, 'birthChartForDate')}</span><span class="orb">↗</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
