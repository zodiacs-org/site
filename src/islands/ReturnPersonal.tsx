import { useEffect, useRef, useState } from 'preact/hooks';
import { localizePath, t, type CatalogLocale } from '../lib/i18n';
import { planetLabel, aspectLabel } from '../lib/i18n/astrology';
import { formatShortDate } from '../lib/i18n/dates';
import { returnText as s } from '../lib/return-visits/copy';
import { sharingText } from '../lib/sharing/copy';
import { calculateEntry, emptyEntry, type ChartEntry } from '../lib/sharing/chart-entry';
import { useEngine } from '../lib/hooks/useEngine';
import { loadProfile } from '../lib/profile/read-store';
import type { SavedChart } from '../lib/profile/schema';
import type { Chart } from '../lib/engine/types';
import type { TransitContact } from '../lib/engine/transit-scan-core';
import type { PreparedChartCard } from '../lib/share-card';
import type * as Trust from './ChartTrust';
import SharingBirthForm from './SharingBirthForm';
import { createModuleLoader } from '../lib/module-load';
import CalculationReload, { calculationError } from './CalculationReload';
const loadTrust = createModuleLoader(() => import('./ChartTrust'));
const loadCards = createModuleLoader(() => import('../lib/share-card'));
const loadPdf = createModuleLoader(() => import('../lib/return-visits/chart-pdf'));
const loadWrappedCard = createModuleLoader(() => import('../lib/return-visits/wrapped-card'));
interface PersonalResult { chart: Chart; trust: typeof Trust; pdf?: Blob; contacts?: TransitContact[]; card?: PreparedChartCard; year: number }

export default function ReturnPersonal({ kind, locale }: { kind: 'kit' | 'wrapped'; locale: CatalogLocale }) {
  const engine = useEngine();
  const [entry, setEntry] = useState(emptyEntry(3));
  const [saved, setSaved] = useState<SavedChart[]>([]), [selected, setSelected] = useState('');
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [result, setResult] = useState<PersonalResult | null>(null);
  const [preview, setPreview] = useState(''), [status, setStatus] = useState('');
  const cardSaver = useRef<typeof import("../lib/share-card")["savePreparedChartCard"] | null>(null);
  const resultRef = useRef<HTMLElement>(null), worker = useRef<Worker | null>(null), generation = useRef(0);
  const pendingReject = useRef<((reason: Error) => void) | null>(null);
  function clear() { generation.current++; worker.current?.terminate(); worker.current = null; pendingReject.current?.(new Error('cancelled')); pendingReject.current = null; cardSaver.current = null; setBusy(false); setResult(null); setError(''); setStatus(''); }
  useEffect(() => {
    const refresh = () => { clear(); const charts = loadProfile().charts.filter((chart) => chart.birth.place); setSaved(charts); setSelected(''); };
    refresh();
    const events = ['zodiacs:profile', 'zodiacs:profile-surface', 'zodiacs:profile-access-reevaluate', 'storage'];
    events.forEach((name) => window.addEventListener(name, refresh));
    return () => { generation.current++; worker.current?.terminate(); pendingReject.current?.(new Error('cancelled')); events.forEach((name) => window.removeEventListener(name, refresh)); };
  }, []);
  useEffect(() => { if (!result?.card) { setPreview(''); return; } const url = URL.createObjectURL(result.card.blob); setPreview(url); return () => URL.revokeObjectURL(url); }, [result]);
  async function scan(chart: Chart, year: number): Promise<TransitContact[]> {
    worker.current = new Worker(new URL('./Wrapped.worker.ts', import.meta.url), { type: 'module' });
    return new Promise((resolve, reject) => { pendingReject.current = reject;
      const current = worker.current!;
      current.onerror = () => { current.terminate(); worker.current = null; pendingReject.current = null; reject(new Error('worker failed')); };
      current.onmessage = (event: MessageEvent<{ error?: boolean; contacts: TransitContact[] }>) => { current.terminate(); worker.current = null; pendingReject.current = null; if (event.data.error) reject(new Error('scan failed')); else resolve(event.data.contacts); };
      current.postMessage({ chart, year });
    });
  }
  async function compute(event: Event) {
    event.preventDefault(); if (busy) return;
    clear(); const run = generation.current; setBusy(true);
    const chosen = kind === 'wrapped' ? loadProfile().charts.find((chart) => chart.id === selected && chart.birth.place) : null;
    const input: ChartEntry = chosen ? { id: 3, name: chosen.name, date: chosen.birth.date, time: chosen.birth.time ?? '', timeKnown: chosen.birth.timeKnown && !!chosen.birth.time, city: chosen.birth.place as ChartEntry['city'], calendar: 'gregorian' } : entry;
    try {
      if (kind === 'wrapped' && !chosen) throw new Error('saved chart missing');
      const [mod, trust] = await Promise.all([engine(), loadTrust()]);
      const { chart, date } = await calculateEntry(input, mod, locale);
      if (chart.flags.includes('outside-reference-span')) throw new RangeError(t(locale, 'birthDateRange'));
      if (run !== generation.current) return;
      let next: PersonalResult;
      if (kind === 'kit') { const pdf = await (await loadPdf()).prepareClientPdf(chart, input, date, locale); next = { chart, trust, pdf, year }; }
      else {
        const contacts = await scan(chart, year);
        if (run !== generation.current) return;
        const [cardModule, saverModule] = await Promise.all([loadWrappedCard(), loadCards()]);
        const card = await cardModule.prepareWrappedCard(year, contacts.filter((c) => c.transitBody === 'Jupiter').length, contacts.filter((c) => c.transitBody === 'Saturn').length, !chart.input.timeKnown, locale);
        if (run === generation.current) cardSaver.current = saverModule.savePreparedChartCard;
        next = { chart, trust, contacts, card, year };
      }
      if (run !== generation.current) return;
      if (chosen && JSON.stringify(loadProfile().charts.find((chart) => chart.id === chosen.id)) !== JSON.stringify(chosen)) { setError(s(locale, 'savedRemoved')); return; }
      setResult(next);
      requestAnimationFrame(() => { if (run === generation.current) { resultRef.current?.focus({ preventScroll: true }); resultRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' }); } });
    } catch (cause) { if (run === generation.current) setError(calculationError(cause, locale, s(locale, 'error'))); }
    finally { if (run === generation.current) setBusy(false); }
  }
  function downloadPdf() {
    if (!result?.pdf) return;
    const url = URL.createObjectURL(result.pdf), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'zodiacs-client-chart.pdf'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  async function shareCard() {
    if (!result?.card || !cardSaver.current) return; const run = generation.current;
    try { const outcome = await cardSaver.current(result.card); if (run === generation.current) setStatus(outcome === 'cancelled' ? '' : sharingText(locale, outcome === 'shared' ? 'shared' : 'saved')); }
    catch { if (run === generation.current) setError(s(locale, 'error')); }
  }
  const currentYear = new Date().getUTCFullYear();
  return <div>
    <form class="return-personal" onSubmit={compute} aria-busy={busy}>
      {kind === 'kit' ? <SharingBirthForm named locale={locale} entry={entry} warm={engine} onChange={(patch) => { clear(); setEntry((current) => ({ ...current, ...patch })); }} /> : <>
        <div class="field"><label class="field__label" for="wrapped-chart">{s(locale, 'savedChart')}</label>
          <select id="wrapped-chart" class="field__input" value={selected} required onChange={(event) => { clear(); setSelected(event.currentTarget.value); }}><option value="">{s(locale, 'chooseChart')}</option>{saved.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}</select>
        </div>
        {!saved.length && <p class="sharing-note">{s(locale, 'noSaved')} <a href={localizePath(locale, '/birth-chart/')}>{s(locale, 'saveChart')} →</a></p>}
        <div class="field"><label class="field__label" for="wrapped-year">{s(locale, 'year')}</label><select id="wrapped-year" class="field__input" value={year} onChange={(event) => { clear(); setYear(Number(event.currentTarget.value)); }}>{Array.from({ length: 5 }, (_, i) => currentYear - i).filter((year) => year >= 1800 && year <= 2199).map((year) => <option value={year}>{year}</option>)}</select></div>
      </>}
      <button class="btn btn--primary" disabled={busy || (kind === 'wrapped' && !selected)} data-return-submit><span>{s(locale, busy ? 'generating' : kind === 'kit' ? 'makePdf' : 'makeWrapped')}</span><span class="orb">↗</span></button>
      {busy && <button class="btn btn--ghost" type="button" onClick={clear}>{s(locale, 'cancel')}</button>}
      <p class="sharing-note">{sharingText(locale, 'privacy')}</p>
      {error && <p class="field__error" role="alert">{error}</p>}<CalculationReload error={error} locale={locale} />
    </form>
    {result && <section class="return-result" tabIndex={-1} ref={resultRef} aria-label={s(locale, kind === 'kit' ? 'kitTitle' : 'wrappedTitle')} data-return-result>
      <p data-result-opening>{s(locale, kind === 'kit' ? 'opening' : 'wrappedOpening')}</p>
      <result.trust.CheckOurMath locale={locale} utc={result.chart.input.utc} basis={result.chart.input.timeKnown ? 'birth' : 'reference'} />
      {kind === 'kit' ? <><p>{s(locale, 'pdfNote')}</p><button type="button" class="btn btn--glass" onClick={downloadPdf} data-download-client-pdf>{s(locale, 'downloadPdf')}</button></> : <>
        <h2>{s(locale, 'wrappedYear', { year: result.year })}</h2><p>{s(locale, 'wrappedScope')}</p>
        {!result.chart.input.timeKnown && <p class="notice">{s(locale, 'wrappedUnknown')}</p>}
        {result.year === currentYear && <p class="notice">{s(locale, 'wrappedPreview')}</p>}
        <p>{s(locale, 'contactCount', { n: result.contacts?.length ?? 0 })}</p>
        <ul class="return-contact-list">{result.contacts?.map((contact) => <li key={`${contact.exactUtc}-${contact.transitBody}-${contact.natalPoint}-${contact.aspect}`}>
          <span>{planetLabel(locale, contact.transitBody)} · {aspectLabel(locale, contact.aspect)} · {contact.natalPoint === 'ASC' ? t(locale, 'rising') : planetLabel(locale, contact.natalPoint)}</span>
          <time dateTime={contact.exactUtc}>{formatShortDate(locale, contact.exactUtc)} · UTC</time>
          {Date.parse(contact.exactUtc) > Date.now() && <span class="return-upcoming">{s(locale, 'upcoming')}</span>}
        </li>)}</ul>
        {!result.contacts?.length && <p>{s(locale, 'emptyContacts')}</p>}
        {preview && <img class="return-card-preview" src={preview} width="1080" height="1920" alt={s(locale, 'wrappedYear', { year: result.year })} />}
        <div class="return-actions"><button type="button" class="btn btn--glass" onClick={shareCard} data-share-wrapped>{s(locale, 'wrappedShare')}</button></div>
        <p class="sharing-note">{s(locale, 'wrappedCardNote')}</p><p role="status">{status}</p>
      </>}
    </section>}
  </div>;
}
