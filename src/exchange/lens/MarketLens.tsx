import { isInstrumentId } from './catalog';
import { profileAccessAllowed } from '../../lib/account-v2/profile-access-reader';
import { explicitSelfChart, loadProfile } from '../../lib/profile/read-store';
import { lazyPanel } from './lazy-panel';
import { loadEconomics, economicAsEvent, economicState, type EconomicCatalog } from './economics';
import type { PersonalResult } from './personal';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { EventFamily, EventManifest, InstrumentId, Interval, JournalEntry, RuleCondition, SkyEvent } from './types';
import { INSTRUMENTS, loadMarketDataset } from './market';
import { calculateIndicators } from './indicators';
import { eventDay, formatEventDate, formatEventTime, loadEvents } from './events';
import { evaluateRules } from './rules';
import { emptyStore, createJournalEntry, exportStore, importStore, readStore, compareAndSaveStore, clearPersonalContext, LensConflictError, MAX_IMPORT_BYTES, updateJournalEntry, type LensStore } from './storage';
const AssetPicker = lazyPanel(() => import('./AssetPicker'));
const ChartPanel = lazyPanel(() => import('./ChartPanel'));
const CalendarPanel = lazyPanel(() => import('./CalendarPanel'));
const HistoryPanel = lazyPanel(() => import('./HistoryPanel'));
const JournalPanel = lazyPanel(() => import('./JournalPanel'));
const RulesPanel = lazyPanel(() => import('./RulesPanel'));
import type { MarketDataset } from './types';
import './lens.css';
const BriefPanel = lazyPanel(() => import('./BriefPanel'));
const EventDetail = lazyPanel(() => import('./EventDetail'));
const LedgerPanel = lazyPanel(() => import('./LedgerPanel'));
const SetupPanel = lazyPanel(() => import('./SetupPanel'));
const PersonalContext = lazyPanel(() => import('./PersonalContext'));

const FAMILIES: EventFamily[] = ['lunation', 'eclipse', 'station', 'retrograde', 'ingress', 'aspect'];
const admitPersonalContext = (store: LensStore, session?: { id: string; updatedAt: string } | null) => { const own = explicitSelfChart(loadProfile().charts); const source = session?.id === 'session' && profileAccessAllowed() ? session : own; return clearPersonalContext(store, source?.id ?? null, source?.updatedAt); };
const EMPTY_STORE: LensStore = emptyStore();
const money = (n: number, currency: string) => currency === 'GBX' ? `${n.toLocaleString('en-US')} GBX` : n.toLocaleString('en-US', {style:'currency', currency, maximumFractionDigits:5});
const download = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function MarketLens({ manifest }: { manifest: EventManifest }) {
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [instrument, setInstrument] = useState<InstrumentId>('BTC-USD');
  const [interval, setInterval] = useState<Interval>('1d');
  const [timeZone, setTimeZone] = useState('UTC');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [view, setView] = useState<'chart' | 'calendar' | 'rules' | 'journal' | 'history' | 'setup' | 'brief'>('chart');
  const [families, setFamilies] = useState<EventFamily[]>(FAMILIES);
  const [responseData, setData] = useState<MarketDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketError, setMarketError] = useState('');
  const [eventError, setEventError] = useState('');
  const [events, setEvents] = useState<SkyEvent[]>([]);
  const [economics, setEconomics] = useState<EconomicCatalog | null>(null);
  const [economicError, setEconomicError] = useState('');
  const [economicKinds, setEconomicKinds] = useState(['cpi', 'employment', 'fomc-decision', 'fomc-press-conference']);
  const [showEconomics, setShowEconomics] = useState(true);
  const [personal, setPersonal] = useState<PersonalResult | null>(null);
  const [showPersonal, setShowPersonal] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [store, setStore] = useState<LensStore>(EMPTY_STORE);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [notice, setNotice] = useState('');
  const liveChartRef = useRef<{ id: string; updatedAt: string } | null>(null);
  const storeRef = useRef<LensStore>(EMPTY_STORE);
  const persistence = useRef<Promise<unknown>>(Promise.resolve());
  const [clock, setClock] = useState(Date.now());
  // Selection changes render before the fetch effect clears the previous response.
  const data = responseData?.instrument.id === instrument && responseData.interval === interval ? responseData : null;

  useEffect(() => { const controller = new AbortController(); void loadEconomics(controller.signal).then(value => !controller.signal.aborted && setEconomics(value)).catch(error => !controller.signal.aborted && setEconomicError(error.message)); return () => controller.abort(); }, []);

  useEffect(() => {
    try {
      const preferences = JSON.parse(localStorage.getItem('zodiacs-market-lens-preferences-v1') ?? '{}');
      const zone = preferences.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      new Intl.DateTimeFormat('en', { timeZone: zone }).format(); setTimeZone(zone); setSelectedDate(eventDay(Date.now(), zone));
      if (isInstrumentId(preferences.instrument)) setInstrument(preferences.instrument);
      if (preferences.interval === '1h' || preferences.interval === '1d') setInterval(preferences.interval);
      if (Array.isArray(preferences.families) && preferences.families.every((f: EventFamily) => FAMILIES.includes(f))) setFamilies(preferences.families);
    } catch { /* Public view preferences are optional; note storage errors are explicit. */ }
    setPreferencesReady(true);
    readStore().then((saved) => { const admitted = admitPersonalContext(saved, liveChartRef.current); storeRef.current = saved; setStore(admitted); setStorageReady(true); }).catch(() => setStorageError('Private storage is unavailable. Your calendar and chart still work; notes and rules cannot be saved in this browser.'));
    const timer = window.setInterval(() => { setClock(Date.now()); setRefresh((n) => n + 1); }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    try { localStorage.setItem('zodiacs-market-lens-preferences-v1', JSON.stringify({ instrument, interval, timeZone, families })); } catch { /* Optional preferences. */ }
  }, [instrument, interval, timeZone, families, preferencesReady]);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setMarketError('');
    if (data?.instrument.id !== instrument || data.interval !== interval) setData(null);
    const end = Math.floor(Date.now() / 1000 / (interval === '1h' ? 3600 : 86400)) * (interval === '1h' ? 3600 : 86400) + (interval === '1h' ? 3600 : 86400);
    loadMarketDataset({ instrument, interval, ...(expanded ? { start: end - 900 * (interval === '1h' ? 3600 : 86400), end } : {}) }, { signal: controller.signal })
      .then((response) => !controller.signal.aborted && setData(response))
      .catch((error) => !controller.signal.aborted && setMarketError(error instanceof Error ? error.message : 'Market data is unavailable.'))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [instrument, interval, refresh, expanded]);

  const loadedMonths = useMemo(() => {
    const chosen = Date.parse(`${selectedDate.slice(0, 7)}-01T00:00:00Z`);
    const left = Math.min(chosen - 32 * 86400000, (data?.coverage.start ?? clock / 1000 - 240 * 86400) * 1000);
    const right = Math.max(chosen + 63 * 86400000, (data?.coverage.end ?? clock / 1000) * 1000 + 32 * 86400000);
    return manifest.months.filter((month) => { const at = Date.parse(`${month}-01T00:00:00Z`); return at >= left - 32 * 86400000 && at <= right; });
  }, [selectedDate.slice(0, 7), data?.coverage.start, data?.coverage.end, manifest]);

  useEffect(() => {
    const controller = new AbortController(); setEventError('');
    loadEvents(manifest, loadedMonths, controller.signal).then((rows) => {
      if (controller.signal.aborted) return; setEvents(rows);
      setSelectedId((previous) => previous?.startsWith('personal:') || rows.some((e) => e.id === previous) ? previous : rows.find((e) => Date.parse(e.at) >= Date.now())?.id ?? rows.at(-1)?.id ?? null);
    }).catch(() => !controller.signal.aborted && setEventError('Sky events could not load. Check your connection; no substitute events have been generated.'));
    return () => controller.abort();
  }, [manifest, loadedMonths.join(',')]);

  useEffect(() => {
    if (!storageReady) return;
    let active = true;
    const sync = () => { void readStore().then(saved => { if (active) { const admitted = admitPersonalContext(saved, liveChartRef.current); storeRef.current = saved; setStore(admitted); } }).catch(() => {}); };
    let channel: BroadcastChannel | undefined;
    try { channel = new BroadcastChannel('zodiacs:lens-workspace'); channel.onmessage = sync; } catch { /* CAS detects conflicts on save. */ }
    window.addEventListener('focus', sync);
    return () => { active = false; channel?.close(); window.removeEventListener('focus', sync); };
  }, [storageReady]);
  const persist = (mutate: (current: LensStore) => LensStore): Promise<void> => {
    const operation = persistence.current.catch(() => {}).then(async () => {
      if (!storageReady) throw new Error('Private storage is unavailable.');
      const previous = storeRef.current; const next = admitPersonalContext(mutate(admitPersonalContext(previous, liveChartRef.current)), liveChartRef.current); await compareAndSaveStore(previous, next); storeRef.current = next; setStore(next); setStorageError(null);
    }).catch(async (error) => {
      if (error instanceof LensConflictError) {
        const saved = await readStore(); storeRef.current = saved; setStore(saved);
        setNotice('Another tab updated your workspace. The latest entries are now loaded; your draft has been kept. Review it and save again.');
      }
      // Validation and one failed mutation must not disable healthy storage.
      throw error;
    });
    persistence.current = operation;
    return operation;
  };
  const indicators = useMemo(() => calculateIndicators(data?.candles ?? [], interval === '1h' ? 3600 : 86400), [data, interval]);
  const visibleEvents = useMemo(() => events.filter((event) => event.family !== 'economic' && families.includes(event.family)), [events, families]);
  const economicEvents = useMemo(() => economics?.events.map(economicAsEvent) ?? [], [economics]);
  const allEvents = useMemo(() => [...events, ...(showPersonal ? personal?.events ?? [] : [])].sort((a, b) => a.at.localeCompare(b.at)), [events, personal, showPersonal]);
  const displayEvents = useMemo(() => [...visibleEvents, ...(showEconomics ? economicEvents.filter(event => economicKinds.includes(event.subtype)) : []), ...(showPersonal ? personal?.events ?? [] : [])].sort((a, b) => a.at.localeCompare(b.at)), [visibleEvents, personal, showPersonal, economicEvents, showEconomics, economicKinds]);
  const historyCoverage = useMemo(() => { const certainty = personal?.events[0]?.personal?.window.certainty; const lastMonth = new Date(`${loadedMonths.at(-1) ?? '2030-12'}-01T00:00:00Z`); lastMonth.setUTCMonth(lastMonth.getUTCMonth() + 1); return { start: Math.max(Date.parse(`${loadedMonths[0] ?? '2026-01'}-01T00:00:00Z`), certainty ? Date.parse(certainty.queryFromUtc) : -Infinity) / 1000, end: Math.min(lastMonth.getTime(), certainty ? Date.parse(certainty.queryToUtc) : Infinity) / 1000 }; }, [personal, loadedMonths.join(',')]);
  const selectedEvent = [...allEvents, ...economicEvents].find((event) => event.id === selectedId) ?? null;
  const matches = useMemo(() => data ? evaluateRules(store.rules, data.candles, events, instrument, interval) : [], [data, store.rules, events, instrument, interval]);
  useEffect(() => {
    if (!storageReady) return;
    const fresh = matches.filter((match) => !store.seenMatches.includes(match.key));
    if (!fresh.length) return;
    setNotice(`${fresh.length} saved watch condition${fresh.length > 1 ? 's' : ''} matched on finalized candles. Review the conditions in Watch rules.`);
    void persist((current) => ({ ...current, seenMatches: [...new Set([...current.seenMatches, ...fresh.map((match) => match.key)])].slice(-10000) })).catch(() => {});
  }, [matches, storageReady]);
  const selectEvent = (event: SkyEvent) => { setSelectedId(event.id); setSelectedDate(eventDay(event, timeZone)); };
  const last = data?.candles.filter((c) => c.complete).at(-1);
  const previous = data?.candles.filter((c) => c.complete).at(-2);
  const change = last && previous ? (last.close / previous.close - 1) * 100 : null;
  const upcoming = visibleEvents.filter((e) => Date.parse(e.at) > clock).slice(0, 4);
  const zoneOptions = [...new Set([timeZone, 'UTC', 'Asia/Bangkok', 'Asia/Kathmandu', 'America/New_York', 'Europe/London'])];

  return <div class="market-lens" data-testid="market-lens" data-storage-state={storageReady ? 'ready' : storageError ? 'unavailable' : 'loading'}>
    <AssetPicker value={instrument} onChange={setInstrument} />
    <div class="lens-toolbar">

      <div class="lens-field"><span>Candles</span><div class="lens-segments">{(['1h', '1d'] as const).map((value) => <button aria-pressed={interval === value} onClick={() => setInterval(value)}>{value === '1h' ? '1 hour' : '1 day'}</button>)}</div></div>
      <label class="lens-field">Display timezone<select value={timeZone} onChange={(e) => setTimeZone(e.currentTarget.value)}>{zoneOptions.map((zone) => <option value={zone}>{zone.replaceAll('_', ' ')}</option>)}</select></label>
      <button class="lens-button lens-refresh" disabled={loading} onClick={() => setRefresh((n) => n + 1)}>{loading ? 'Refreshing…' : 'Refresh candles'}</button>
    </div>
    <div class="lens-market-summary" aria-live="polite">
      <div><span class="lens-market-symbol">{instrument}</span><strong>{last ? money(last.close, INSTRUMENTS[instrument].quote) : '—'}</strong><span class={change !== null && change < 0 ? 'lens-down' : 'lens-up'}>{change === null ? '' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}% previous candle`}</span></div>
      <p>{INSTRUMENTS[instrument].venue} · {INSTRUMENTS[instrument].quote} quote · {data ? `${data.candles.filter((c) => c.complete).length} finalized candles` : 'awaiting public data'}<br />{data && <>Fetched {formatEventDate(data.fetchedAt, timeZone)} · {formatEventTime(data.fetchedAt, timeZone)} · {data.stale || marketError ? 'stale / previous response' : 'latest response'} · {data.coverage.gaps.length} missing buckets</>}</p>
    </div>
    {marketError && <p class="lens-error" role="alert">{marketError}</p>}
    {data?.warnings.map((warning) => <p class="lens-notice">{warning}</p>)}
    {eventError && <p class="lens-error" role="alert">{eventError}</p>}
    {notice && <div key="notice" class="lens-notice" role="status">{notice}<button class="lens-text-button" onClick={() => setNotice('')}>Dismiss</button></div>}
    <><PersonalContext date={selectedDate} timeZone={timeZone} onSourceChange={(id, updatedAt) => { liveChartRef.current = id && updatedAt ? { id, updatedAt } : null; setSelectedId(value => value?.startsWith('personal:') ? null : value); setStore(current => clearPersonalContext(current, id, updatedAt)); if (storageReady) void persist(current => clearPersonalContext(current, id, updatedAt)).catch(() => {}); }} onResult={setPersonal} /></>
    <div key="upcoming" class="lens-upcoming" aria-label="Next sky events">{upcoming.map((event) => <button key={event.id} class="lens-next-event" onClick={() => selectEvent(event)}><span>{formatEventDate(event, timeZone)} · {formatEventTime(event, timeZone)}</span><strong>{event.title}</strong><small>{event.family}</small></button>)}</div>
    <div key="workspace-nav" class="lens-workspace-nav"><div class="lens-segments" aria-label="Workspace view">{(['chart', 'calendar', 'setup', 'brief', 'rules', 'journal', 'history'] as const).map((tab) => <button data-testid={`lens-tab-${tab}`} aria-pressed={view === tab} onClick={() => setView(tab)}>{({ chart: 'Chart', calendar: 'Calendar', rules: 'Watch rules', journal: 'Journal', history: 'History', setup: 'Setup & risk', brief: 'Session brief' })[tab]}</button>)}</div>
      <fieldset class="lens-event-filters"><legend>Context layers</legend><label><input type="checkbox" checked={showEconomics} onChange={() => setShowEconomics(!showEconomics)} />Economics</label><label><input type="checkbox" checked={showPersonal} onChange={() => setShowPersonal(!showPersonal)} />Personal contacts</label>{FAMILIES.map((family) => <label><input type="checkbox" checked={families.includes(family)} onChange={() => setFamilies((current) => current.includes(family) ? current.filter((x) => x !== family) : [...current, family])} />{family === 'lunation' ? 'Moon phases' : family[0].toUpperCase() + family.slice(1)}</label>)}</fieldset></div>
    {economicError && <p class="lens-error">{economicError}</p>}{showEconomics && economics && <details class="lens-coverage"><summary>Economic schedule · {economicState(economics, selectedDate)} · verified {economics.verifiedAt.slice(0, 10)}</summary><p>Official Fed and BLS snapshot · {economics.coverage.start} to {economics.coverage.endExclusive} exclusive · America/New_York. Refresh verification is due after 7 days. Dates outside coverage are unavailable.</p><fieldset class="lens-event-filters"><legend>Economic releases</legend>{[['cpi', 'US CPI'], ['employment', 'US employment'], ['fomc-decision', 'FOMC decisions'], ['fomc-press-conference', 'FOMC press conferences']].map(([kind, label]) => <label><input type="checkbox" checked={economicKinds.includes(kind)} onChange={() => setEconomicKinds(current => current.includes(kind) ? current.filter(value => value !== kind) : [...current, kind])} />{label}</label>)}</fieldset>{economics.unavailable.map(row => <p>{row.period}: {row.reason} <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a></p>)}{economics.limitations.map(text => <p>{text}</p>)}</details>}
    <div key="workspace" class={`lens-workspace ${view === 'journal' || view === 'rules' ? 'lens-workspace--wide' : ''}`}>
      <div key="main-view" class="lens-main-view"><>
        {(view === 'rules' || view === 'journal') && !storageReady && !storageError && <p class="lens-muted" role="status">Opening your private workspace…</p>}
        <div hidden={view !== 'setup'}><SetupPanel key={instrument} instrument={instrument} interval={interval} selectedEvent={selectedEvent} entries={store.entries} storageError={storageReady ? storageError : 'Private storage is loading.'} events={displayEvents} timeZone={timeZone} coverage={historyCoverage} economicCoverage={economics?.coverage} onSelect={selectEvent} onJournal={() => setView('journal')} onSave={input => persist(current => {
          if (input.id) {
            const entry = current.entries.find(entry => entry.id === input.id);
            if (!entry) throw new Error('This setup was deleted in another tab. Save it as a new setup.');
            if (entry.updatedAt !== input.baseUpdatedAt) throw new LensConflictError();
            return { ...current, entries: current.entries.map(entry => entry.id === input.id ? updateJournalEntry(entry, { hypothesis: input.hypothesis, plan: input.plan, setup: input.setup }) : entry) };
          }
          return { ...current, entries: [...current.entries, createJournalEntry({ hypothesis: input.hypothesis, plan: input.plan, setup: input.setup, horizonHours: input.horizonHours, method: input.method, eventIds: input.eventIds, instrument, outcome: '', timingRole: input.timingRole, ...(input.setup.window?.kind === 'personal' && input.setup.window.sourceUpdatedAt ? { chartRef: { id: input.setup.window.sourceId!, updatedAt: input.setup.window.sourceUpdatedAt } } : {}) })] };
        })} /></div>
        {view === 'brief' && <BriefPanel instrument={instrument} interval={interval} timeZone={timeZone} data={data} marketError={marketError} indicators={indicators} events={displayEvents} economics={economics} rules={store.rules} entries={store.entries} onSetup={() => setView('setup')} onJournal={() => setView('journal')} onSelect={selectEvent} coverage={historyCoverage} />}
        {view === 'chart' && <ChartPanel data={data} indicators={indicators} events={displayEvents} selectedEvent={selectedEvent} timeZone={timeZone} onSelectEvent={selectEvent} />}
        {view === 'calendar' && <CalendarPanel outlook={personal?.outlook} events={displayEvents} timeZone={timeZone} selectedDate={selectedDate} onDate={setSelectedDate} onSelect={event => setSelectedId(event.id)} />}
        {view === 'history' && <HistoryPanel eventCoverage={historyCoverage} data={data} events={allEvents} selectedEvent={selectedEvent} timeZone={timeZone} onSelect={selectEvent} loading={loading} onExpand={() => { setInterval('1d'); setExpanded(true); setRefresh((n) => n + 1); }} />}
        {(storageReady || storageError) && <div key="rules-panel" hidden={view !== 'rules'}><RulesPanel rules={store.rules} matches={matches} instrument={instrument} interval={interval} timeZone={timeZone} storageError={storageError}
          onSave={(input: { condition: RuleCondition; threshold?: number; family: EventFamily | 'any'; windowHours: number }) => persist((current) => ({ ...current, rules: [...current.rules, { ...input, id: crypto.randomUUID(), version: 1, instrument, interval, enabled: true, createdAt: new Date().toISOString() }] }))}
          onToggle={(id: string) => persist((current) => ({ ...current, rules: current.rules.map((rule) => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule) }))}
          onDelete={(id: string) => persist((current) => ({ ...current, rules: current.rules.filter((rule) => rule.id !== id) }))} /></div>}
        {(storageReady || storageError) && <div key="journal-panel" hidden={view !== 'journal'}><LedgerPanel entries={store.entries} timeZone={timeZone} now={clock} storageError={storageError} onUpdate={persist} /><JournalPanel entries={store.entries} instrument={instrument} selectedEvent={selectedEvent} timeZone={timeZone} storageError={storageError} onUpdate={persist} personalSourceKey={liveChartRef.current ? `${liveChartRef.current.id}:${liveChartRef.current.updatedAt}` : ''}
          onSave={(input: { id?: string; baseUpdatedAt?: string; instrument: InstrumentId; hypothesis: string; plan: string; outcome: string; horizonHours: number; method: JournalEntry['method']; eventIds: string[] }) => persist((current) => {
            if (input.id) {
              const saved = current.entries.find(entry => entry.id === input.id);
              if (!saved) throw new Error('This entry was deleted in another tab. Your draft remains here; choose Save as new entry to keep it.');
              if (saved.updatedAt !== input.baseUpdatedAt) throw new LensConflictError();
              return { ...current, entries: current.entries.map((entry) => entry.id === input.id ? updateJournalEntry(entry, { hypothesis: input.hypothesis, plan: input.plan, outcome: input.outcome }) : entry) };
            }
            return { ...current, entries: [...current.entries, createJournalEntry({ instrument: input.instrument, hypothesis: input.hypothesis, plan: input.plan, horizonHours: input.horizonHours, method: input.method, eventIds: input.eventIds, outcome: input.outcome, ...(selectedEvent?.personal?.sourceUpdatedAt && input.eventIds.includes(selectedEvent.id) ? { chartRef: { id: selectedEvent.personal.sourceId, updatedAt: selectedEvent.personal.sourceUpdatedAt } } : {}) })] };
          })}
          onDelete={(id: string) => persist((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) }))}
          onExport={() => download('zodiacs-desk-journal.json', exportStore(admitPersonalContext(storeRef.current, liveChartRef.current)), 'application/json')}
          onImport={async (file: File) => { if (file.size > MAX_IMPORT_BYTES) throw new Error('Import file is too large (2 MB maximum).'); const payload = await file.text(); let result = ''; await persist((current) => { const imported = importStore(payload, current); result = `Imported ${imported.importedEntries} notes and ${imported.importedRules} rules. ${imported.conflicts.length} conflicts retained separately.`; return imported.store; }); setNotice(result); }} /></div>}
      </></div>
      {view !== 'journal' && view !== 'rules' && <aside class="lens-event-detail lens-panel" aria-labelledby="lens-event-detail-title" data-testid="lens-event-detail"><EventDetail event={selectedEvent} timeZone={timeZone} onView={setView} /></aside>}
    </div>
    <details class="lens-coverage"><summary>Coverage &amp; research boundaries</summary><p>Sky catalog: {manifest.coverage.start.slice(0, 10)} through {manifest.coverage.end.slice(0, 10)}. Loaded UTC months: {loadedMonths[0] ?? 'none'} through {loadedMonths.at(-1) ?? 'none'}. Filtered absence outside coverage is not an all-clear signal.</p><ul>{manifest.limitations.map((text) => <li>{text}</li>)}</ul><p>Astrology has no established predictive relationship with asset prices. Zodiacs Desk is a read-only research workspace. Notes stay in this browser; exports are your responsibility. Local timestamps are not independently verified publication records.</p><p>Chart software: <a href="/data/market-lens/chart-license/NOTICE.txt">TradingView notice</a> · <a href="/data/market-lens/chart-license/LICENSE.txt">Apache 2.0 license</a>.</p></details>
  </div>;
}
