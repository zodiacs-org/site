import { useMemo, useState } from 'preact/hooks';
import { analyzeOccurrences, matchingEvents } from './history';
import { formatEventDate, formatEventTime } from './events';
import type { MarketDataset, SkyEvent } from './types';

interface Props { data: MarketDataset | null; events: SkyEvent[]; selectedEvent: SkyEvent | null; timeZone: string; onSelect: (event: SkyEvent) => void; onExpand: () => void; loading: boolean }
const number = (value: number | null) => value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

export default function HistoryPanel({ data, events, selectedEvent, timeZone, onSelect, onExpand, loading }: Props) {
  const [horizon, setHorizon] = useState(24);
  const summary = useMemo(() => data && selectedEvent ? analyzeOccurrences(matchingEvents(selectedEvent, events), data.candles, {
    interval: data.interval, horizonHours: horizon, beforeHours: horizon, contextEvents: events,
  }) : null, [data, events, selectedEvent, horizon]);
  return <section class="lens-panel" aria-labelledby="lens-history-title">
    <div class="lens-section-head"><div><h2 id="lens-history-title">Previous occurrences</h2><p class="lens-muted">Inspect the same event family, bodies and aspect. Every qualifying occurrence in the loaded catalog is shown.</p></div>
      <button class="lens-button" onClick={onExpand} disabled={loading}>Load 900 daily candles</button></div>
    {!selectedEvent ? <p class="lens-muted">Select a sky event to inspect its previous occurrences.</p> : <>
      <div class="lens-inline"><strong>{selectedEvent.title}</strong><label class="lens-field">Before &amp; after window<select value={horizon} onChange={(e) => setHorizon(Number(e.currentTarget.value))}><option value={24}>24 hours</option><option value={72}>3 days</option><option value={168}>7 days</option></select></label></div>
      {summary && <>
        <div class="lens-metrics"><div><span>Completed windows</span><strong>{summary.complete} / {summary.total}</strong></div><div><span>Median return after</span><strong>{number(summary.medianReturnPct)}</strong></div><div><span>Mean return after</span><strong>{number(summary.meanReturnPct)}</strong></div><div><span>Pending / incomplete</span><strong>{summary.pending} / {summary.incomplete}</strong></div></div>
        <p class="lens-muted">{summary.convention} These are descriptive observations, with no entry rule or transaction costs. Overlapping and linked events are flagged; {summary.independent} completed windows are isolated from the other loaded events.</p>
        {summary.complete < 10 && <p class="lens-notice">Few completed occurrences are available. This sample cannot establish a reliable predictive effect.</p>}
        <div class="lens-table-scroll"><table><caption>Occurrence outcomes · {data?.instrument.id} · {data?.interval} · Coinbase Exchange</caption><thead><tr><th>Date</th><th>Time ({timeZone})</th><th>Before</th><th>After</th><th>Range after</th><th>Coverage</th></tr></thead>
          <tbody>{summary.occurrences.map((row) => <tr key={row.event.id}><th scope="row"><button class="lens-text-button" onClick={() => onSelect(row.event)}>{formatEventDate(row.event, timeZone)}</button></th><td>{formatEventTime(row.event, timeZone)}</td><td>{number(row.beforeReturnPct)}</td><td>{number(row.returnPct)}</td><td>{number(row.rangePct)}</td><td>{row.status}{row.overlappingIds.length > 0 && ' · overlapping'}{row.linkedIds.length > 0 && ' · linked'}{row.reason && <small>{row.reason}</small>}</td></tr>)}</tbody></table></div>
      </>}
    </>}
    <details class="lens-method"><summary>Forecasting experiment</summary><p>A fixed lunar-feature experiment found no consistent added predictive benefit. The separate research report compares technical-only, lunar-only and combined models on chronological holdout data, with source receipts, calibration and uncertainty. Public model forecasts remain disabled.</p><a href="/terminal/lens/research/">Read the experiment results →</a></details>
  </section>;
}
