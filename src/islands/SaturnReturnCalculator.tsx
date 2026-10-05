import SaturnCountdown from './SaturnCountdown';
import { CheckOurMath, ResultOpening } from './ChartTrust';
/**
 * Saturn return calculator: birth date in, return seasons out. The
 * engine and the return-scanner lazy-load together on submit; a date
 * alone is enough — time and place refine dates by days, never years.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { BirthDateField, birthDateForChart, calendarInPlay, type CalendarChoice } from './BirthFields';
import PlaceSearch from './PlaceSearch';
import SignChip from './SignChip';
import { SATURN_RETURN } from '../lib/interpretations';
import { formatLongitude, signForLongitude } from '../lib/signs';
import { prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import type { City } from '../lib/geo/search';
import type { ReturnSeason, SaturnReturnResult } from '../lib/engine/returns';
import { localizePath, normalizeCatalogLocale, t, tf, type CatalogLocale as Locale } from '../lib/i18n';
import { formatShortDate } from '../lib/i18n/dates';
import { createModuleLoader } from '../lib/module-load';
import CalculationReload, { calculationError } from './CalculationReload';

const loadReturns = createModuleLoader(() => import('../lib/engine/returns'));

function seasonStatus(season: ReturnSeason, now: Date): 'past' | 'active' | 'upcoming' {
  if (season.last.getTime() < now.getTime()) return 'past';
  if (season.first.getTime() > now.getTime()) return 'upcoming';
  return 'active';
}

export default function SaturnReturnCalculator({ locale: rawLocale = 'en' }: { locale?: Locale }) {
  const locale = normalizeCatalogLocale(rawLocale);
  const ordinal = [t(locale, 'first'), t(locale, 'second'), t(locale, 'third'), t(locale, 'fourth')];
  const ageHint = [t(locale, 'aroundAge29'), t(locale, 'aroundAge58'), t(locale, 'aroundAge88'), ''];
  const statusLabel = { past: t(locale, 'complete'), active: t(locale, 'underwayNow'), upcoming: t(locale, 'aheadOfYou') } as const;
  const fmt = (d: Date) => formatShortDate(locale, d);
  const [date, setDate] = useState('');
  const [calendar, setCalendar] = useState<CalendarChoice>('gregorian');
  const [time, setTime] = useState('');
  const [city, setCity] = useState<City | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [result, setResult] = useState<SaturnReturnResult | null>(null);
  const [resultReceipt, setResultReceipt] = useState<{ utc: Date; reference: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const focusAfterComputeRef = useRef(false);
  const generation = useRef(0);

  useEffect(() => () => { generation.current += 1; }, []);

  const approximate = resultReceipt?.reference ?? true;

  function invalidate() { generation.current++; setBusy(false); setResult(null); setResultReceipt(null); setError(''); focusAfterComputeRef.current = false; }

  async function compute(e: Event) {
    e.preventDefault();
    if (!date || busy) return;
    const run = ++generation.current;
    focusAfterComputeRef.current = true;
    setBusy(true);
    setError('');
    try {
      let day = date;
      if (calendarInPlay(date, calendar)) {
        // A date before 1924 is read in its calendar; the return uses the Gregorian date.
        const entry = await birthDateForChart(locale, date, calendar);
        if (run !== generation.current) return;
        if ('error' in entry) {
          setError(entry.error);
          return;
        }
        day = entry.date;
      }
      const [returns] = await Promise.all([loadReturns(), showDetail && city ? prepareLocalTime(day, city.tz) : null]);
      if (run !== generation.current) return;
      const utc = showDetail && city
        ? resolveLocalToUtc(day, time || '12:00', city.tz, { longitude: city.lon }).utc
        : new Date(`${day}T12:00:00Z`);
      const nextResult = returns.saturnReturns(utc);
      setResultReceipt({ utc, reference: !showDetail || !city || !time });
      setResult(nextResult);
    } catch (err) {
      if (run !== generation.current) return;
      setError(calculationError(err, locale, t(locale, 'returnError')));
      console.error(err);
    } finally {
      if (run === generation.current) setBusy(false);
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

  const now = new Date();
  const natalSign = result ? signForLongitude(result.natalLon) : null;

  return (
    <div class="calc">
      <form class="calc__form shell" onSubmit={compute} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <BirthDateField
              locale={locale} id="sr-date" date={date} city={showDetail ? city : null}
              onDateChange={(value) => { invalidate(); setDate(value); }} calendar={calendar} onCalendarChange={(value) => { invalidate(); setCalendar(value); }}
              onFocus={() => { void loadReturns(); }}
              help={<p class="field__help">{t(locale, 'saturnDateHelp')}</p>}
            />
          </div>

          {!showDetail ? (
            <button class="sr__more" type="button" onClick={() => { invalidate(); setShowDetail(true); }}>
              {t(locale, 'addBirthDetails')}
            </button>
          ) : (
            <div class="calc__fields">
              <div class="field">
                <label class="field__label" for="sr-time">{t(locale, 'birthTime')}</label>
                <input
                  id="sr-time" class="field__input" type="time" value={time}
                  onInput={(e) => { invalidate(); setTime((e.target as HTMLInputElement).value); }}
                />
              </div>
              <div class="field">
                <label class="field__label" for="sr-place">{t(locale, 'birthplace')}</label>
                <PlaceSearch id="sr-place" selected={city} onSelect={(value) => { invalidate(); setCity(value); }} locale={locale} />
              </div>
            </div>
          )}

          <button class="btn btn--primary calc__submit" type="submit" disabled={!date || busy}>
            <span>{busy ? t(locale, 'computing') : t(locale, 'findSaturnReturn')}</span>
            <span class="orb">↗</span>
          </button>
          <p class="calc__privacy">{t(locale, 'privacyDevice')}</p>
          {error && <p class="calc__error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
          <CalculationReload error={error} locale={locale} />
        </div>
      </form>

      {result && natalSign && (
        <div class="calc__result">
          <h2 class="sr-only" tabIndex={-1} ref={resultHeadingRef}>{t(locale, 'saturnReturn')}</h2>
          <ResultOpening locale={locale} kind="saturn" />
          <CheckOurMath locale={locale} utc={resultReceipt?.utc} basis={resultReceipt?.reference ? 'reference' : 'birth'} />
          <div class="sr__natal shell tinted" style={`--sign:${natalSign.hue}`}>
            <div class="core tinted sr__natal-core">
              <span class="mono--label">{t(locale, 'natalSaturn')}</span>
              <span class="sr__natal-sign">
                <SignChip lon={result.natalLon} locale={locale} />
                <span class="mono sr__natal-deg">
                  {formatLongitude(result.natalLon, locale)}{result.natalRetrograde ? ' · Rx' : ''}
                </span>
              </span>
              {locale !== 'ru' && <p class="sr__reading">{SATURN_RETURN[natalSign.slug]}</p>}
            </div>
          </div>

          {approximate && (
            <p class="field__help">
              {t(locale, 'returnApprox')}
            </p>
          )}

          <SaturnCountdown result={result} approximate={approximate} locale={locale} />

          <div class="sr__seasons">
            {result.seasons.map((season, i) => {
              const status = seasonStatus(season, now);
              return (
                <div key={season.first.toISOString()} class={`sr__season shell ${status === 'active' ? 'tinted' : ''}`} style={status === 'active' ? `--sign:${natalSign.hue}` : ''}>
                  <div class={`core sr__season-core ${status === 'active' ? 'tinted' : ''}`}>
                    <div class="sr__season-head">
                      <strong>{tf(locale, 'saturnReturnHeading', { ordinal: ordinal[i] ?? String(i + 1) })}</strong>
                      <span class="mono sr__season-status">{statusLabel[status]}</span>
                    </div>
                    <p class="sr__season-span mono">
                      {fmt(season.first)}
                      {season.crossings.length > 1 ? ` – ${fmt(season.last)}` : ''}
                      {ageHint[i] ? ` · ${ageHint[i]}` : ''}
                    </p>
                    <ul class="sr__crossings">
                      {season.crossings.map((c) => (
                        <li class="mono" key={`${c.at.toISOString()}-${c.retrograde ? 'rx' : 'direct'}`}>
                          {fmt(c.at)}{c.retrograde ? ` · ${t(locale, 'retrogradePass')}` : ''}
                        </li>
                      ))}
                    </ul>
                    {season.crossings.length === 3 && (
                      <p class="sr__season-note">
                        {t(locale, 'threePasses')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div class="calc__actions">
            <a class="btn btn--ghost" href={localizePath(locale, '/birth-chart/')}>
              <span>{t(locale, 'seeSaturnChart')}</span><span class="orb">↗</span>
            </a>
            <a
              class="btn btn--ghost"
              href="/learn/planets/saturn/"
              title={locale === 'ru' ? 'Материал пока доступен по-английски' : undefined}
            >
              <span>{t(locale, 'whatSaturnMeans')}{locale === 'ru' ? ' — пока по-английски' : ''}</span><span class="orb">→</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
