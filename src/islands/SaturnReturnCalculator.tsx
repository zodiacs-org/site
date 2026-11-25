import SaturnCountdown from './SaturnCountdown';
import { rangeWords } from '../lib/range-words';
import { CheckOurMath, ResultOpening } from './ChartTrust';
/**
 * Saturn return calculator: birth date in, return seasons out. The
 * engine and the return-scanner lazy-load together on submit; a date
 * alone is enough — time and place refine dates by days, never years.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { BirthDateField, birthDateForChart, calendarInPlay, type CalendarChoice } from './BirthFields';
import PlaceSearch from './PlaceSearch';
import { birthDateRefusal, birthDateRefusalLang, birthDateRefusalText } from '../lib/birth-date-policy';
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
// The calendar file is built only when asked for; the page loads nothing for it before then.
const loadCalendar = createModuleLoader(() => Promise.all([
  import('../lib/saturn-return-ical'), import('../lib/ical-download'),
]));

/** The button, in the words of the sky calendar's download button in each language. */
const DOWNLOAD_CALENDAR: Record<Locale, string> = {
  en: 'Download calendar (.ics)',
  es: 'Descargar calendario (.ics)',
  pt: 'Baixar calendário (.ics)',
  fr: 'Télécharger le calendrier (.ics)',
  it: 'Scarica calendario (.ics)',
  ru: 'Скачать календарь (.ics)',
};

/** Privacy and re-import note beside the Saturn return calendar download, matching My Sky's honesty rule. */
const CALENDAR_NOTE: Record<Locale, string> = {
  en: 'Built in your browser; your birth details are not sent to us. Anyone you share this file with, or any online calendar you import it into, can narrow down your birth date from its Saturn return dates. If you later add a birth time or place and download a revised file, remove the earlier events first to avoid duplicates.',
  es: 'Creado en tu navegador; tus datos de nacimiento no se nos envían. Cualquier persona con quien compartas este archivo, o cualquier calendario en línea donde lo importes, puede deducir tu fecha de nacimiento a partir de las fechas del retorno de Saturno. Si más adelante agregas una hora o lugar de nacimiento y descargas un archivo revisado, elimina antes los eventos anteriores para evitar duplicados.',
  pt: 'Criado no seu navegador; seus dados de nascimento não são enviados para nós. Quem receber este arquivo, ou qualquer calendário online em que você o importar, pode deduzir sua data de nascimento pelas datas do retorno de Saturno. Se depois você adicionar hora ou local de nascimento e baixar um arquivo revisado, remova primeiro os eventos anteriores para evitar duplicatas.',
  fr: 'Créé dans ton navigateur ; tes données de naissance ne nous sont pas envoyées. Toute personne avec qui tu partages ce fichier, ou tout calendrier en ligne où tu l’importes, peut en déduire ta date de naissance à partir des dates du retour de Saturne. Si tu ajoutes ensuite une heure ou un lieu de naissance et télécharges un fichier mis à jour, supprime d’abord les anciens événements pour éviter les doublons.',
  it: 'Creato nel tuo browser; i tuoi dati di nascita non ci vengono inviati. Chiunque riceva questo file, o qualsiasi calendario online in cui lo importi, può risalire alla tua data di nascita dalle date del ritorno di Saturno. Se in seguito aggiungi ora o luogo di nascita e scarichi un file aggiornato, rimuovi prima gli eventi precedenti per evitare duplicati.',
  ru: 'Файл создаётся в вашем браузере; данные о рождении нам не отправляются. Любой, с кем вы поделитесь этим файлом, или онлайн-календарь, куда вы его импортируете, сможет определить вашу дату рождения по датам возвращения Сатурна. Если позже вы добавите время или место рождения и скачаете обновлённый файл, сначала удалите прежние события, чтобы избежать дубликатов.',
};

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
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarError, setCalendarError] = useState('');
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const focusAfterComputeRef = useRef(false);
  const generation = useRef(0);
  const calendarPending = useRef(false);

  useEffect(() => () => { generation.current += 1; }, []);

  const approximate = resultReceipt?.reference ?? true;

  function settleCalendar(failure = '') { calendarPending.current = false; setCalendarBusy(false); setCalendarError(failure); }

  function invalidate() { generation.current++; setBusy(false); setResult(null); setResultReceipt(null); setError(''); settleCalendar(); focusAfterComputeRef.current = false; }

  async function compute(e: Event) {
    e.preventDefault();
    if (!date || busy) return;
    const run = ++generation.current;
    settleCalendar();
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
      // A birth date under 13 or still to come is refused before anything loads.
      const refusal = birthDateRefusal(day);
      if (refusal) {
        setResult(null);
        setResultReceipt(null);
        setError(birthDateRefusalText(refusal));
        return;
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

  /** Built on this device from the result on screen; nothing is sent anywhere. */
  async function downloadCalendar() {
    if (!result || calendarPending.current) return;
    const run = generation.current;
    const shown = result;
    calendarPending.current = true;
    setCalendarBusy(true);
    setCalendarError('');
    let failure = '';
    try {
      const [calendar, file] = await loadCalendar();
      if (run !== generation.current) return;
      file.downloadCalendarFile(calendar.buildSaturnReturnCalendar(shown, {
        approximate, generatedAt: new Date(), locale,
        words: {
          seasons: shown.seasons.map((_, i) => tf(locale, 'saturnReturnHeading', { ordinal: ordinal[i] ?? String(i + 1) })),
          retrograde: t(locale, 'retrogradePass'),
          approximate: t(locale, 'returnApprox'),
        },
      }), calendar.saturnReturnCalendarFilename(shown));
    } catch (cause) {
      failure = calculationError(cause, locale, t(locale, 'chartReceiptError'));
    }
    if (run === generation.current) settleCalendar(failure);
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
    <div class="calc" data-saturn-return-calculator>
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
          {error && <p class="calc__error" role="alert" tabIndex={-1} ref={errorRef} lang={birthDateRefusalLang(error)}>{error}</p>}
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
                <span class="sr__natal-deg">
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
                      <span class="sr__season-status">{statusLabel[status]}</span>
                    </div>
                    <p class="sr__season-span">
                      {season.crossings.length > 1 ? rangeWords(locale, fmt(season.first), fmt(season.last)) : fmt(season.first)}
                      {ageHint[i] ? ` · ${ageHint[i]}` : ''}
                    </p>
                    <ul class="sr__crossings">
                      {season.crossings.map((c) => (
                        <li key={`${c.at.toISOString()}-${c.retrograde ? 'rx' : 'direct'}`}>
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
            {result.seasons.length > 0 && (
              <button
                class="btn btn--ghost"
                type="button"
                disabled={calendarBusy}
                aria-describedby="sr-calendar-note"
                onClick={() => { void downloadCalendar(); }}
                data-saturn-calendar
              >
                <span>{DOWNLOAD_CALENDAR[locale]}</span><span class="orb">↓</span>
              </button>
            )}
            <a class="btn btn--ghost" href={localizePath(locale, '/birth-chart/')}>
              <span>{t(locale, 'seeSaturnChart')}</span><span class="orb">↗</span>
            </a>
            <a
              class="btn btn--ghost"
              href="/learn/planets/saturn/"
              title={locale === 'ru' ? 'Материал пока доступен по-английски' : undefined}
            >
              <span>{t(locale, 'whatSaturnMeans')}{locale === 'ru' ? ' (пока по-английски)' : ''}</span><span class="orb">→</span>
            </a>
          </div>
          {calendarError && <p class="calc__error" role="alert" data-saturn-calendar-error>{calendarError}</p>}
          <CalculationReload error={calendarError} locale={locale} />
          {result.seasons.length > 0 && (
            <p class="field__help" id="sr-calendar-note" data-saturn-calendar-note>{CALENDAR_NOTE[locale]}</p>
          )}
        </div>
      )}
    </div>
  );
}
