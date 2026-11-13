/**
 * "Your 2027 sky": the year read against one chart, a share card and a
 * calendar file, all made on this device.
 *
 * The chart comes from a saved chart in this browser or from birth details
 * typed here. Either way the birth details never leave the device: the dates
 * are found in a worker (YearSky.worker.ts) from longitudes alone, the words
 * are written here, the cards are painted on a canvas, and the calendar is a
 * file handed to the browser. No request, link or file name carries them.
 *
 * Layout stability: the chooser keeps one reserved height from the server
 * render through hydration and the profile read; the reading only appears
 * after the reader asks for it, below the chooser.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { localizePath, t, type CatalogLocale } from '../lib/i18n';
import { useEngine } from '../lib/hooks/useEngine';
import { useProfile } from '../lib/hooks/useProfile';
import { explicitSelfChart, loadProfile } from '../lib/profile/read-store';
import type { SavedChart } from '../lib/profile/schema';
import { calculateEntry, emptyEntry } from '../lib/sharing/chart-entry';
import { createModuleLoader } from '../lib/module-load';
import { ringFront } from '../lib/ring-front';
import { yearSkyWords } from '../lib/year-sky/copy';
import { QUARTERS, quarterOf, EDITION_PATH } from '../lib/year-sky/edition';
import type { EclipseRecord } from '../lib/upcoming';
import type { IngressWindowRecord, SkyRetrograde } from '../lib/year-sky/general';
import type { PersonalYear } from '../lib/year-sky/moments';
import type { YearSkyNatal, YearSkyScan } from '../lib/year-sky/scan';
import type { YearMoment } from '../lib/year-sky/types';
import type { PreparedYearCard, YearCardFormat } from '../lib/year-sky/card';
import PlanetGlyph from '../components/PlanetGlyph';
import SharingBirthForm from './SharingBirthForm';
import CalculationReload, { calculationError } from './CalculationReload';

const loadMoments = createModuleLoader(() => import('../lib/year-sky/moments'));
const loadCalendar = createModuleLoader(() => import('../lib/year-sky/calendar'));
const loadCards = createModuleLoader(() => import('../lib/year-sky/card'));
const loadSaver = createModuleLoader(() => import('../lib/share-card'));
const loadDownload = createModuleLoader(() => import('../lib/ical-download'));

const PLANETS = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);

interface Props {
  locale?: CatalogLocale;
  year: number;
  eclipses: EclipseRecord[];
  ingresses: IngressWindowRecord[];
  retrogrades: SkyRetrograde[];
  /** The shared sky's moments, for the calendar file. */
  general: YearMoment[];
  /** This page's own path, for the calendar file's links (the server localizes it). */
  pagePath?: string;
}

interface Result {
  personal: PersonalYear;
  calendar: string | null;
  front: string | null;
}

function readerTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

function savedNatal(chart: SavedChart): YearSkyNatal {
  const timeKnown = chart.birth.timeKnown === true && Boolean(chart.birth.time);
  return {
    bodies: chart.summary.bodies.filter((b) => PLANETS.has(b.body)).map(({ body, lon }) => ({ body, lon })),
    asc: timeKnown ? chart.summary.angles?.asc ?? null : null,
    mc: timeKnown ? chart.summary.angles?.mc ?? null : null,
    utc: chart.summary.utcISO,
    timeKnown,
  };
}

export default function YearSky({ locale = 'en', year, eclipses, ingresses, retrogrades, general, pagePath = EDITION_PATH }: Props) {
  const w = yearSkyWords(locale);
  const engine = useEngine();
  const { profile } = useProfile();
  const [mounted, setMounted] = useState(false);
  const charts = useMemo(() => profile.charts
    .filter((chart) => chart.birth.place && chart.summary?.bodies?.length)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [profile.charts]);
  const [selected, setSelected] = useState('');
  const [entering, setEntering] = useState(false);
  const [entry, setEntry] = useState(emptyEntry(27));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [cards, setCards] = useState<Record<YearCardFormat, PreparedYearCard> | null>(null);
  const [previews, setPreviews] = useState<Partial<Record<YearCardFormat, string>>>({});
  const [status, setStatus] = useState('');
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  const pendingReject = useRef<((reason: Error) => void) | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => { setMounted(true); }, []);
  const chosen = charts.find((chart) => chart.id === selected) ?? explicitSelfChart(charts) ?? charts[0] ?? null;

  function clear() {
    generation.current += 1;
    worker.current?.terminate();
    worker.current = null;
    pendingReject.current?.(new Error('cancelled'));
    pendingReject.current = null;
    setBusy(false);
    setError('');
    setStatus('');
    setResult(null);
    setCards(null);
  }
  useEffect(() => () => { generation.current += 1; worker.current?.terminate(); pendingReject.current?.(new Error('cancelled')); }, []);
  useEffect(() => {
    const urls: Partial<Record<YearCardFormat, string>> = {};
    if (cards) for (const format of ['square', 'story'] as const) urls[format] = URL.createObjectURL(cards[format].blob);
    setPreviews(urls);
    return () => Object.values(urls).forEach((url) => url && URL.revokeObjectURL(url));
  }, [cards]);

  function scan(natal: YearSkyNatal): Promise<YearSkyScan> {
    worker.current = new Worker(new URL('./YearSky.worker.ts', import.meta.url), { type: 'module' });
    return new Promise((resolve, reject) => {
      pendingReject.current = reject;
      const current = worker.current!;
      const done = () => { current.terminate(); worker.current = null; pendingReject.current = null; };
      current.onerror = () => { done(); reject(new Error('worker failed')); };
      current.onmessage = (event: MessageEvent<{ error?: boolean; scan: YearSkyScan }>) => {
        done();
        if (event.data.error) reject(new Error('scan failed'));
        else resolve(event.data.scan);
      };
      current.postMessage({ natal, year, retrogrades });
    });
  }

  async function read(event: Event) {
    event.preventDefault();
    if (busy) return;
    clear();
    const run = generation.current;
    const fromSaved = !entering && chosen ? chosen : null;
    setBusy(true);
    try {
      let natal: YearSkyNatal;
      if (fromSaved) natal = savedNatal(fromSaved);
      else {
        const mod = await engine();
        const { chart } = await calculateEntry(entry, mod, locale);
        if (chart.flags.includes('outside-reference-span')) throw new RangeError(t(locale, 'birthDateRange'));
        natal = {
          bodies: chart.bodies.filter((b) => PLANETS.has(b.body)).map(({ body, lon }) => ({ body, lon })),
          asc: chart.input.timeKnown ? chart.angles?.asc ?? null : null,
          mc: chart.input.timeKnown ? chart.angles?.mc ?? null : null,
          utc: chart.input.utc.toISOString(),
          timeKnown: chart.input.timeKnown,
        };
      }
      if (run !== generation.current) return;
      const [found, moments, calendarModule] = await Promise.all([scan(natal), loadMoments(), loadCalendar()]);
      if (run !== generation.current) return;
      if (fromSaved && JSON.stringify(loadProfile().charts.find((chart) => chart.id === fromSaved.id)?.summary) !== JSON.stringify(fromSaved.summary)) {
        setError(w.savedRemoved);
        return;
      }
      const personal = moments.personalYear(found, natal, { eclipses, ingresses }, locale);
      const calendar = calendarModule.yearCalendar(calendarModule.calendarMoments(personal.moments, general), {
        locale,
        timeZone: readerTimeZone(),
        generatedAt: new Date(),
        pageUrl: `https://zodiacs.org${pagePath}`,
      });
      const front = ringFront(natal.bodies, natal.timeKnown);
      setResult({ personal, calendar, front });
      requestAnimationFrame(() => {
        if (run !== generation.current) return;
        resultRef.current?.focus({ preventScroll: true });
        resultRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
      });
      // The cards are painted ahead of the share tap, so the share sheet opens
      // straight from the tap.
      const cardModule = await loadCards();
      const prepared = await cardModule.prepareYearCards({
        year,
        signs: personal.signs,
        lines: personal.highlights.map((moment) => moment.card!).filter(Boolean),
        count: personal.moments.length,
        front,
      }, locale);
      await loadSaver();
      if (run === generation.current) setCards(prepared);
    } catch (cause) {
      if (run === generation.current) setError(calculationError(cause, locale, w.error));
    } finally {
      if (run === generation.current) setBusy(false);
    }
  }

  async function share(format: YearCardFormat) {
    const card = cards?.[format];
    if (!card) return;
    const run = generation.current;
    try {
      const outcome = await (await loadSaver()).savePngBlob(card.blob, card.filename);
      if (run === generation.current) setStatus(outcome === 'cancelled' ? '' : outcome === 'shared' ? w.shareShared : w.shareSaved);
    } catch {
      if (run === generation.current) setError(w.error);
    }
  }

  async function downloadCalendar() {
    if (!result?.calendar) return;
    try {
      const { YEAR_SKY_CALENDAR_FILENAME } = await loadCalendar();
      (await loadDownload()).downloadCalendarFile(result.calendar, YEAR_SKY_CALENDAR_FILENAME);
      setStatus(w.calendarDone);
    } catch (cause) {
      setError(calculationError(cause, locale, w.error));
    }
  }

  const personal = result?.personal;
  const byQuarter = (moments: YearMoment[]) => QUARTERS.map((quarter) => moments.filter((moment) => quarterOf(moment.at) === quarter));

  return <div class="ys">
    <form class="ys-chooser" onSubmit={read} aria-busy={busy} data-year-sky-chooser>
      <h2 class="ys-chooser__title">{w.chooserTitle}</h2>
      {!mounted ? null : !entering && charts.length > 0 ? <>
        <p class="ys-chooser__lede">{w.savedLede(charts.length > 1 ? null : chosen?.name ?? null)} <button type="button" class="ys-chooser__switch" onClick={() => { clear(); setEntering(true); }}>{w.enterOther}</button></p>
        <div class="ys-chooser__actions">
          {charts.length > 1 && <select id="ys-chart" class="field__input ys-chooser__select" aria-label={w.chooserSaved} value={chosen?.id ?? ''} onChange={(event) => { clear(); setSelected(event.currentTarget.value); }}>
            {charts.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}
          </select>}
          <button class="btn btn--primary" disabled={busy} data-year-sky-read><span>{busy ? w.reading : w.readMine}</span><span class="orb">↗</span></button>
          {busy && <button class="btn btn--ghost" type="button" onClick={clear}>{w.cancel}</button>}
        </div>
      </> : !entering ? <>
        <p class="ys-chooser__lede">{w.enterDetailsLede} <a href="#shared-sky">{w.orGeneral}</a></p>
        <div class="ys-chooser__actions">
          <button class="btn btn--primary" type="button" onClick={() => setEntering(true)} data-year-sky-enter><span>{w.enterDetails}</span><span class="orb">↗</span></button>
        </div>
      </> : <>
        <SharingBirthForm locale={locale} entry={entry} warm={engine} onChange={(patch) => { clear(); setEntry((current) => ({ ...current, ...patch })); }} />
        <div class="ys-chooser__actions">
          <button class="btn btn--primary" disabled={busy} data-year-sky-read><span>{busy ? w.reading : w.readEntered}</span><span class="orb">↗</span></button>
          {busy && <button class="btn btn--ghost" type="button" onClick={clear}>{w.cancel}</button>}
          {charts.length > 0 && !busy && <button class="btn btn--ghost" type="button" onClick={() => { clear(); setEntering(false); }}>{w.useSaved}</button>}
        </div>
        {charts.length === 0 && <p class="sharing-note">{w.saveHint} <a href={localizePath(locale, '/birth-chart/')}>{w.saveChart} →</a></p>}
      </>}
      <p class="sharing-note ys-chooser__privacy">{w.privacy}</p>
      {error && <p class="field__error" role="alert">{error}</p>}
      <CalculationReload error={error} locale={locale} />
    </form>

    {personal && <section class="ys-result" tabIndex={-1} ref={resultRef} aria-labelledby="ys-result-title" data-year-sky-result>
      <h2 id="ys-result-title" class="display ys-result__title">{w.resultTitle}</h2>
      <p class="ys-result__lede">{w.resultLede}</p>
      {!personal.timeKnown && <p class="notice">{w.unknownTime}</p>}
      <p class="sharing-note">{w.confidenceNote}</p>

      {personal.highlights.length > 0 && <div class="ys-brief">
        <h3>{w.briefTitle}</h3>
        <ol>{personal.highlights.map((moment) => <li key={moment.id}>
          <PlanetGlyph body={moment.body} size={18} class="ys-glyph" />
          <span>{moment.title}</span>
          <span class="ys-brief__when">{w.quarterNames[quarterOf(moment.at)]}</span>
        </li>)}</ol>
      </div>}

      {personal.allYear.length > 0 && <div class="ys-quarter">
        <h3>{w.allYearTitle}</h3>
        <p class="ys-quarter__lede">{w.allYearLede}</p>
        <ul class="ys-moments">{personal.allYear.map((moment) => <li class="ys-moment" key={moment.id}>
          <p class="ys-moment__line"><PlanetGlyph body={moment.body} size={16} class="ys-glyph" /> {moment.line}</p>
          {moment.confidence !== null && <p class="ys-moment__confidence">{w.confidence(moment.confidence)}</p>}
        </li>)}</ul>
      </div>}

      {byQuarter(personal.moments).map((moments, quarter) => <div class="ys-quarter" key={quarter}>
        <h3>{w.quarterNames[quarter]}</h3>
        {moments.length === 0 ? <p class="ys-quarter__lede">{w.quietQuarter}</p> : <ul class="ys-moments">{moments.map((moment) => <li class="ys-moment" key={moment.id} data-kind={moment.kind}>
          <p class="ys-moment__when"><time dateTime={moment.at}>{moment.underWay ? w.underWay : w.day(moment.at, year)}</time></p>
          <h4 class="ys-moment__title"><PlanetGlyph body={moment.body} size={18} class="ys-glyph" /> {moment.title}</h4>
          <p class="ys-moment__line">{moment.line}</p>
          <p class="ys-moment__detail">{moment.detail}</p>
          {moment.confidence !== null && <p class="ys-moment__confidence">{w.confidence(moment.confidence)}</p>}
        </li>)}</ul>}
      </div>)}

      <div class="ys-share" data-year-sky-share>
        <h3>{w.shareTitle}</h3>
        <p>{w.shareLede}</p>
        <div class="ys-share__previews">
          <figure class="ys-share__frame ys-share__frame--square">{previews.square && <img src={previews.square} width={1080} height={1080} alt="" />}</figure>
          <figure class="ys-share__frame ys-share__frame--story">{previews.story && <img src={previews.story} width={1080} height={1920} alt="" />}</figure>
        </div>
        <div class="return-actions">
          <button type="button" class="btn btn--glass" disabled={!cards} onClick={() => { void share('square'); }} data-year-sky-share-square>{w.shareSquare}</button>
          <button type="button" class="btn btn--glass" disabled={!cards} onClick={() => { void share('story'); }} data-year-sky-share-story>{w.shareStory}</button>
        </div>
        <p class="sharing-note">{w.cardNote}</p>
      </div>

      {result.calendar && <div class="ys-calendar">
        <h3>{w.calendarTitle}</h3>
        <p>{w.calendarLede}</p>
        <div class="return-actions"><button type="button" class="btn btn--primary" onClick={() => { void downloadCalendar(); }} data-year-sky-calendar><span>{w.calendarButton}</span><span class="orb">↓</span></button></div>
        <p class="sharing-note">{w.calendarNote}</p>
      </div>}
      <p role="status" class="ys-status">{status}</p>
    </section>}
  </div>;
}
