import { useEffect, useRef, useState } from 'preact/hooks';
import { t, type CatalogLocale } from '../lib/i18n';
import { planetLabel } from '../lib/i18n/astrology';
import { signBySlug, signName } from '../lib/signs';
import { useEngine } from '../lib/hooks/useEngine';
import { loadModule } from '../lib/module-load';
import { calculateEntry, emptyEntry, type ChartEntry } from '../lib/sharing/chart-entry';
import { sharingText as s } from '../lib/sharing/copy';
import { groupReading, validGroupSize, ROLE_HUES, ROLE_KEYS, ROLE_READ_KEYS, type GroupReading } from '../lib/sharing/group';
import SharingBirthForm from './SharingBirthForm';
import CalculationReload, { calculationError } from './CalculationReload';
import type { Chart } from '../lib/engine/types';
import type { PreparedChartCard } from '../lib/share-card';
import type * as Trust from './ChartTrust';

type Result = { name: string; chart: Chart; reading: GroupReading };
export default function GroupCharts({ locale = 'en' }: { locale?: CatalogLocale }) {
  const engine = useEngine();
  const [entries, setEntries] = useState<ChartEntry[]>([emptyEntry(1), emptyEntry(2), emptyEntry(3)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Result[] | null>(null);
  const [trust, setTrust] = useState<typeof Trust | null>(null);
  const [card, setCard] = useState<PreparedChartCard | null>(null);
  const [cardState, setCardState] = useState<'idle' | 'preparing' | 'ready' | 'sharing' | 'shared' | 'saved' | 'failed'>('idle');
  const cardModule = useRef<typeof import('../lib/share-card') | null>(null);
  const generation = useRef(0), nextId = useRef(4), resultRef = useRef<HTMLElement>(null);
  function change(next: ChartEntry[] | ((current: ChartEntry[]) => ChartEntry[])) { generation.current++; setEntries(next); setBusy(false); setResults(null); setCard(null); setCardState('idle'); setError(''); }
  async function prepare(rows: Result[], run: number) {
    setCardState('preparing');
    try {
      const [mod, saveMod] = await Promise.all([loadModule(() => import('../lib/sharing/group-card')), loadModule(() => import('../lib/share-card'))]);
      const prepared = await mod.prepareGroupCard(rows.map(({ name, chart, reading }) => ({ name, role: reading.role, unknown: !chart.input.timeKnown })), locale);
      if (run === generation.current) { cardModule.current = saveMod; setCard(prepared); setCardState('ready'); }
    } catch { if (run === generation.current) setCardState('failed'); }
  }
  useEffect(() => () => { generation.current++; }, []);
  async function compute(event: Event) {
    event.preventDefault();
    const run = ++generation.current;
    setBusy(true); setError(''); setResults(null); setCard(null); setCardState('idle');
    try {
      if (!validGroupSize(entries.length)) throw new RangeError('group size');
      const [mod, trustMod] = await Promise.all([engine(), loadModule(() => import('./ChartTrust'))]);
      const rows: Result[] = []; const seen = new Set<string>();
      for (const [index, entry] of entries.entries()) {
        const computed = await calculateEntry(entry, mod, locale);
        if (run !== generation.current) return;
        const identity = `${computed.date}|${entry.timeKnown ? entry.time : '?'}|${entry.city!.lat}|${entry.city!.lon}`;
        // Prevent accidental duplicate entries without treating a matching date as a matching person.
        const name = entry.name.trim() || s(locale, 'person', { n: index + 1 });
        const duplicate = `${name.toLocaleLowerCase()}|${identity}`;
        if (seen.has(duplicate)) throw new RangeError('duplicate entry');
        seen.add(duplicate);
        rows.push({ name, chart: computed.chart, reading: groupReading(computed.chart) });
      }
      if (run !== generation.current) return;
      setTrust(trustMod); setResults(rows);
      requestAnimationFrame(() => { if (run === generation.current) { resultRef.current?.focus({ preventScroll: true }); resultRef.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } });
      void prepare(rows, run);
    } catch (cause) { if (run === generation.current) setError(calculationError(cause, locale, s(locale, 'groupError'))); }
    finally { if (run === generation.current) setBusy(false); }
  }
  function share() {
    const run = generation.current;
    if (!card || !cardModule.current) { if (results) void prepare(results, run); return; }
    setCardState('sharing');
    // The card is already rendered; call the native share path during this tap.
    void cardModule.current.savePreparedChartCard(card).then((outcome) => {
      if (run === generation.current) setCardState(outcome === 'downloaded' ? 'saved' : outcome === 'shared' ? 'shared' : 'ready');
    }, () => { if (run === generation.current) setCardState('failed'); });
  }
  return <div class="sharing-tool">
    <form class="group-form" onSubmit={compute}>
      <div class="group-entry-grid">{entries.map((entry, index) => <fieldset class="tile group-entry" key={entry.id}>
        <legend>{entry.name.trim() || s(locale, 'person', { n: index + 1 })}</legend>
        <SharingBirthForm named locale={locale} entry={entry} warm={engine} onChange={(patch) => change((current) => current.map((item) => item.id === entry.id ? { ...item, ...patch } : item))} />
        {entries.length > 3 && <button class="group-remove" type="button" aria-label={s(locale, 'removePerson', { person: entry.name || s(locale, 'person', { n: index + 1 }) })} onClick={() => change((current) => current.filter((item) => item.id !== entry.id))}>{t(locale, 'remove')}</button>}
      </fieldset>)}</div>
      <div class="sharing-actions"><button type="button" class="btn btn--ghost" data-group-add disabled={entries.length >= 8} onClick={() => { const id = nextId.current++; change((current) => current.length < 8 ? [...current, emptyEntry(id)] : current); }}>{s(locale, 'addPerson')}</button>
        <button type="submit" class="btn btn--primary" disabled={busy} data-group-submit><span>{s(locale, busy ? 'computing' : 'groupSubmit')}</span><span class="orb">↗</span></button></div>
      <p class="sharing-note">{s(locale, 'privacy')}</p>
      {error && <p role="alert" class="field__error">{error}</p>}<CalculationReload error={error} locale={locale} />
    </form>
    {results && trust && <section class="sharing-result" tabIndex={-1} ref={resultRef} aria-label={s(locale, 'groupTitle')} data-group-result>
      <p data-result-opening>{s(locale, 'groupOpening')}</p>
      <div class="group-reading-grid">{results.map(({ name, chart, reading }, index) => <article class="tile group-reading" key={index} style={`--role-hue:${ROLE_HUES[reading.role]}`}>
        <h2>{name}</h2><p class="group-role">{s(locale, ROLE_KEYS[reading.role])}</p><p>{s(locale, ROLE_READ_KEYS[reading.role])}</p>
        <p class="sharing-note">{s(locale, 'groupCount', { n: reading.winningCount, total: reading.total })}</p>
        {!chart.input.timeKnown && <p class="sharing-note">{s(locale, 'groupUnknown')}</p>}
        <details><summary>{s(locale, 'groupMethod')}</summary><ul class="group-basis">{reading.placements.map((placement) => <li>{placement.body === 'Rising' ? t(locale, 'rising') : planetLabel(locale, placement.body)}: {signName(signBySlug(placement.sign), locale)}</li>)}</ul></details>
        <trust.CheckOurMath locale={locale} utc={chart.input.utc} basis={chart.input.timeKnown ? 'birth' : 'reference'} />
      </article>)}</div>
      <button class="btn btn--glass" type="button" onClick={share} disabled={cardState === 'preparing' || cardState === 'sharing'} data-group-share><span>{s(locale, cardState === 'preparing' ? 'cardPreparing' : cardState === 'sharing' ? 'sharing' : cardState === 'shared' ? 'shared' : cardState === 'saved' ? 'saved' : cardState === 'failed' ? 'retry' : 'groupShare')}</span><span class="orb">↑</span></button>
      {cardState === 'failed' && <p class="field__error" role="alert">{s(locale, 'cardError')}</p>}
      <p class="sharing-note">{s(locale, 'groupCardNote')}</p>
    </section>}
    <details class="sharing-method"><summary>{s(locale, 'groupMethod')}</summary><p>{s(locale, 'groupMethodBody')}</p></details>
  </div>;
}
