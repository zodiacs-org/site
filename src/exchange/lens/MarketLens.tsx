import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { EventFamily, EventManifest, InstrumentId, Interval, JournalEntry, RuleCondition, SkyEvent } from './types';
import { INSTRUMENTS, loadMarketDataset } from './market';
import { calculateIndicators } from './indicators';
import { eventDay, eventICS, formatEventDate, formatEventTime, loadEvents } from './events';
import { evaluateRules } from './rules';
import { createJournalEntry, exportStore, importStore, readStore, compareAndSaveStore, LensConflictError, MAX_IMPORT_BYTES, updateJournalEntry, type LensStore } from './storage';
import ChartPanel from './ChartPanel';
import CalendarPanel from './CalendarPanel';
import HistoryPanel from './HistoryPanel';
import JournalPanel from './JournalPanel';
import RulesPanel from './RulesPanel';
import type { MarketDataset } from './types';
import './lens.css';

const FAMILIES: EventFamily[] = ['lunation', 'eclipse', 'station', 'retrograde', 'ingress', 'aspect'];
const EMPTY_STORE: LensStore = { schema: 1, rules: [], entries: [], seenMatches: [] };
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const download = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function MarketLens({ manifest }: { manifest: EventManifest }) {
  const [instrument, setInstrument] = useState<InstrumentId>('BTC-USD');
  const [interval, setInterval] = useState<Interval>('1d');
  const [timeZone, setTimeZone] = useState('UTC');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [view, setView] = useState<'chart' | 'calendar' | 'rules' | 'journal' | 'history'>('chart');
  const [families, setFamilies] = useState<EventFamily[]>(FAMILIES);
  const [responseData, setData] = useState<MarketDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketError, setMarketError] = useState('');
  const [eventError, setEventError] = useState('');
  const [events, setEvents] = useState<SkyEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [store, setStore] = useState<LensStore>(EMPTY_STORE);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [notice, setNotice] = useState('');
  const storeRef = useRef<LensStore>(EMPTY_STORE);
  const persistence = useRef<Promise<unknown>>(Promise.resolve());
  const [clock, setClock] = useState(Date.now());
  // Selection changes render before the fetch effect clears the previous response.
  const data = responseData?.instrument.id === instrument && responseData.interval === interval ? responseData : null;

  useEffect(() => {
    try {
      const preferences = JSON.parse(localStorage.getItem('zodiacs-market-lens-preferences-v1') ?? '{}');
      const zone = preferences.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      new Intl.DateTimeFormat('en', { timeZone: zone }).format(); setTimeZone(zone); setSelectedDate(eventDay(Date.now(), zone));
      if (preferences.instrument === 'BTC-USD' || preferences.instrument === 'ETH-USD') setInstrument(preferences.instrument);
      if (preferences.interval === '1h' || preferences.interval === '1d') setInterval(preferences.interval);
      if (Array.isArray(preferences.families) && preferences.families.every((f: EventFamily) => FAMILIES.includes(f))) setFamilies(preferences.families);
    } catch { /* Public view preferences are optional; note storage errors are explicit. */ }
    readStore().then((saved) => { storeRef.current = saved; setStore(saved); setStorageReady(true); }).catch(() => setStorageError('Private storage is unavailable. Your calendar and chart still work; notes and rules cannot be saved in this browser.'));
    const timer = window.setInterval(() => { setClock(Date.now()); setRefresh((n) => n + 1); }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('zodiacs-market-lens-preferences-v1', JSON.stringify({ instrument, interval, timeZone, families })); } catch { /* Optional preferences. */ }
  }, [instrument, interval, timeZone, families]);

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
      setSelectedId((previous) => rows.some((e) => e.id === previous) ? previous : rows.find((e) => Date.parse(e.at) >= Date.now())?.id ?? rows.at(-1)?.id ?? null);
    }).catch(() => !controller.signal.aborted && setEventError('Sky events could not load. Check your connection; no substitute events have been generated.'));
    return () => controller.abort();
  }, [manifest, loadedMonths.join(',')]);

  const persist = (mutate: (current: LensStore) => LensStore): Promise<void> => {
    const operation = persistence.current.catch(() => {}).then(async () => {
      if (!storageReady) throw new Error('Private storage is unavailable.');
      const previous = storeRef.current; const next = mutate(previous); await compareAndSaveStore(previous, next); storeRef.current = next; setStore(next); setStorageError(null);
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
  const visibleEvents = useMemo(() => events.filter((event) => families.includes(event.family)), [events, families]);
  const selectedEvent = events.find((event) => event.id === selectedId) ?? null;
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
    <div class="lens-toolbar">
      <label class="lens-field">Instrument<select data-testid="lens-instrument" value={instrument} onChange={(e) => setInstrument(e.currentTarget.value as InstrumentId)}>{Object.values(INSTRUMENTS).map((i) => <option value={i.id}>{i.name} · {i.id}</option>)}</select></label>
      <div class="lens-field"><span>Candles</span><div class="lens-segments">{(['1h', '1d'] as const).map((value) => <button aria-pressed={interval === value} onClick={() => setInterval(value)}>{value === '1h' ? '1 hour' : '1 day'}</button>)}</div></div>
      <label class="lens-field">Display timezone<select value={timeZone} onChange={(e) => setTimeZone(e.currentTarget.value)}>{zoneOptions.map((zone) => <option value={zone}>{zone.replaceAll('_', ' ')}</option>)}</select></label>
      <button class="lens-button lens-refresh" disabled={loading} onClick={() => setRefresh((n) => n + 1)}>{loading ? 'Refreshing…' : 'Refresh candles'}</button>
    </div>
    <div class="lens-market-summary" aria-live="polite">
      <div><span class="lens-market-symbol">{instrument}</span><strong>{last ? money(last.close) : '—'}</strong><span class={change !== null && change < 0 ? 'lens-down' : 'lens-up'}>{change === null ? '' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}% previous candle`}</span></div>
      <p>Coinbase Exchange · USD quote · {data ? `${data.candles.filter((c) => c.complete).length} finalized candles` : 'awaiting public data'}<br />{data && <>Fetched {formatEventDate(data.fetchedAt, timeZone)} · {formatEventTime(data.fetchedAt, timeZone)} · {data.stale || marketError ? 'stale / previous response' : 'latest response'} · {data.coverage.gaps.length} missing buckets</>}</p>
    </div>
    {marketError && <p class="lens-error" role="alert">{marketError}</p>}
    {data?.warnings.map((warning) => <p class="lens-notice">{warning}</p>)}
    {eventError && <p class="lens-error" role="alert">{eventError}</p>}
    {notice && <div key="notice" class="lens-notice" role="status">{notice}<button class="lens-text-button" onClick={() => setNotice('')}>Dismiss</button></div>}
    <div key="upcoming" class="lens-upcoming" aria-label="Next sky events">{upcoming.map((event) => <button key={event.id} class="lens-next-event" onClick={() => selectEvent(event)}><span>{formatEventDate(event, timeZone)} · {formatEventTime(event, timeZone)}</span><strong>{event.title}</strong><small>{event.family}</small></button>)}</div>
    <div key="workspace-nav" class="lens-workspace-nav"><div class="lens-segments" aria-label="Workspace view">{(['chart', 'calendar', 'rules', 'journal', 'history'] as const).map((tab) => <button data-testid={`lens-tab-${tab}`} aria-pressed={view === tab} onClick={() => setView(tab)}>{({ chart: 'Chart', calendar: 'Calendar', rules: 'Watch rules', journal: 'Journal', history: 'History' })[tab]}</button>)}</div>
      <fieldset class="lens-event-filters"><legend>Sky layers</legend>{FAMILIES.map((family) => <label><input type="checkbox" checked={families.includes(family)} onChange={() => setFamilies((current) => current.includes(family) ? current.filter((x) => x !== family) : [...current, family])} />{family === 'lunation' ? 'Moon phases' : family[0].toUpperCase() + family.slice(1)}</label>)}</fieldset></div>
    <div key="workspace" class={`lens-workspace ${view === 'journal' || view === 'rules' ? 'lens-workspace--wide' : ''}`}>
      <div key="main-view" class="lens-main-view">
        {(view === 'rules' || view === 'journal') && !storageReady && !storageError && <p class="lens-muted" role="status">Opening your private workspace…</p>}
        {view === 'chart' && <ChartPanel data={data} indicators={indicators} events={visibleEvents} selectedEvent={selectedEvent} timeZone={timeZone} onSelectEvent={selectEvent} />}
        {view === 'calendar' && <CalendarPanel events={visibleEvents} timeZone={timeZone} selectedDate={selectedDate} onDate={setSelectedDate} onSelect={selectEvent} />}
        {view === 'history' && <HistoryPanel data={data} events={events} selectedEvent={selectedEvent} timeZone={timeZone} onSelect={selectEvent} loading={loading} onExpand={() => { setInterval('1d'); setExpanded(true); setRefresh((n) => n + 1); }} />}
        {(storageReady || storageError) && <div key="rules-panel" hidden={view !== 'rules'}><RulesPanel rules={store.rules} matches={matches} instrument={instrument} interval={interval} timeZone={timeZone} storageError={storageError}
          onSave={(input: { condition: RuleCondition; threshold?: number; family: EventFamily | 'any'; windowHours: number }) => persist((current) => ({ ...current, rules: [...current.rules, { ...input, id: crypto.randomUUID(), version: 1, instrument, interval, enabled: true, createdAt: new Date().toISOString() }] }))}
          onToggle={(id: string) => persist((current) => ({ ...current, rules: current.rules.map((rule) => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule) }))}
          onDelete={(id: string) => persist((current) => ({ ...current, rules: current.rules.filter((rule) => rule.id !== id) }))} /></div>}
        {(storageReady || storageError) && <div key="journal-panel" hidden={view !== 'journal'}><JournalPanel entries={store.entries} instrument={instrument} selectedEvent={selectedEvent} timeZone={timeZone} storageError={storageError}
          onSave={(input: { id?: string; instrument: InstrumentId; hypothesis: string; plan: string; outcome: string; horizonHours: number; method: JournalEntry['method']; eventIds: string[] }) => persist((current) => {
            if (input.id) {
              if (!current.entries.some((entry) => entry.id === input.id)) throw new Error('This entry was deleted in another tab. Your draft remains here; choose Save as new entry to keep it.');
              return { ...current, entries: current.entries.map((entry) => entry.id === input.id ? updateJournalEntry(entry, { hypothesis: input.hypothesis, plan: input.plan, outcome: input.outcome }) : entry) };
            }
            return { ...current, entries: [...current.entries, createJournalEntry({ ...input, outcome: input.outcome })] };
          })}
          onDelete={(id: string) => persist((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) }))}
          onExport={() => download('zodiacs-market-lens-journal.json', exportStore(storeRef.current), 'application/json')}
          onImport={async (file: File) => { if (file.size > MAX_IMPORT_BYTES) throw new Error('Import file is too large (2 MB maximum).'); const payload = await file.text(); let result = ''; await persist((current) => { const imported = importStore(payload, current); result = `Imported ${imported.importedEntries} notes and ${imported.importedRules} rules. ${imported.conflicts.length} conflicts retained separately.`; return imported.store; }); setNotice(result); }} /></div>}
      </div>
      {view !== 'journal' && view !== 'rules' && <aside class="lens-event-detail lens-panel" aria-labelledby="lens-event-detail-title" data-testid="lens-event-detail">
        {selectedEvent ? <>
          <span class={`lens-tag lens-event--${selectedEvent.family}`}>{selectedEvent.family}</span><h2 id="lens-event-detail-title">{selectedEvent.title}</h2>
          <p class="lens-event-instant">{formatEventDate(selectedEvent, timeZone)}<br />{formatEventTime(selectedEvent, timeZone)}</p>
          <dl><dt>Sky fact</dt><dd>{selectedEvent.bodies.join(' · ')}{selectedEvent.aspectType ? ` · ${selectedEvent.aspectType}` : ''}{selectedEvent.sign ? ` · ${selectedEvent.sign}` : ''}<br /><span class="lens-muted">UTC {selectedEvent.at}</span>{selectedEvent.end && <><br />Ends {formatEventDate(selectedEvent.end, timeZone)} · {formatEventTime(selectedEvent.end, timeZone)}</>}</dd>
            <dt>Traditional interpretation</dt><dd>{selectedEvent.interpretation}</dd><dt>Market observation</dt><dd>Inspect the selected asset and previous occurrences. This interpretation does not establish a price direction.</dd></dl>
          <div class="lens-inline"><button class="lens-button" onClick={() => download(`${selectedEvent.id}.ics`, eventICS(selectedEvent), 'text/calendar')}>Add to calendar</button><button class="lens-button lens-button--primary" onClick={() => setView('journal')}>Record hypothesis</button><button class="lens-button lens-button--quiet" onClick={() => setView('history')}>Explore history →</button></div>
          <details class="lens-method"><summary>Source &amp; calculation</summary><p>{selectedEvent.provenance.catalog}<br />{selectedEvent.provenance.convention}<br />Engine {selectedEvent.provenance.engineVersion}</p><p class="lens-hash">SHA-256 {selectedEvent.provenance.sha256}</p></details>
        </> : <><h2 id="lens-event-detail-title">Select a sky event</h2><p class="lens-muted">Choose a marker, upcoming event or calendar entry to see its facts and interpretation.</p></>}
      </aside>}
    </div>
    <details class="lens-coverage"><summary>Coverage &amp; research boundaries</summary><p>Sky catalog: {manifest.coverage.start.slice(0, 10)} through {manifest.coverage.end.slice(0, 10)}. Loaded UTC months: {loadedMonths[0] ?? 'none'} through {loadedMonths.at(-1) ?? 'none'}. Filtered absence outside coverage is not an all-clear signal.</p><ul>{manifest.limitations.map((text) => <li>{text}</li>)}</ul><p>Astrology has no established predictive relationship with asset prices. Market Lens is a read-only research workspace. Notes stay in this browser; exports are your responsibility. Local timestamps are not independently verified publication records.</p><p>Chart software: <a href="/data/market-lens/chart-license/NOTICE.txt">TradingView notice</a> · <a href="/data/market-lens/chart-license/LICENSE.txt">Apache 2.0 license</a>.</p></details>
  </div>;
}
