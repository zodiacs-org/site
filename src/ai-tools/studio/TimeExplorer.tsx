import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { BirthWindow, WindowChange } from '@zodiacs/engine/window';
import type { PortableChartCalculation } from '../../lib/engine/portable';
import { formatDelta } from '../../lib/compare/angles';
import { shiftStudio, timeChanges, initialWindow, windowRequest, windowSummary, type WindowDraft } from './explore';
import type { StudioInput } from './model';
import { WindowCalculator } from './window-client';

const dateLabel = (date: Date) => date.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
const name = (value: string | number | null) => value === null ? 'Unresolved' : String(value).replace(/^./, s => s.toUpperCase());
function changeLabel(change: WindowChange) {
  if (change.feature === 'aspect') return `${change.a} / ${change.b}: ${change.from ? name(change.from) : 'No major aspect in orb'} → ${change.to ? name(change.to) : 'No major aspect in orb'}`;
  const label = 'body' in change ? `${change.body} ${change.feature}` : change.feature === 'house-system' ? 'House system' : name(change.feature);
  return `${label}: ${name(change.from)} → ${name(change.to)}`;
}

export function TimeExplorer({ input, run, onApply, dirty }: { input: StudioInput; run: PortableChartCalculation; onApply: (input: StudioInput) => void; dirty: boolean }) {
  const [anchor, setAnchor] = useState(run);
  const [step, setStep] = useState(60);
  const [error, setError] = useState('');
  const changes = useMemo(() => timeChanges(anchor, run), [anchor, run]);
  function move(direction: number) {
    try { onApply(shiftStudio(input, direction * (input.timeKnown ? step : 1440))); setError(''); }
    catch (error) { setError((error as Error).message); }
  }
  return <section class="feature-panel" aria-label="Time Explorer">
    <p class="kicker">Follow a changing sky</p><h2>Time Explorer</h2>
    <p>Move the displayed chart through UTC time. Compare its positions with an anchor, or explore a possible birth-time window below.</p>
    <div class="time-controls"><button onClick={() => move(-1)} disabled={dirty}>Earlier</button><label>Time step<select value={input.timeKnown ? step : 1440} disabled={!input.timeKnown || dirty} onChange={e => setStep(Number(e.currentTarget.value))}><option value={15}>15 minutes</option><option value={60}>1 hour</option><option value={1440}>1 day</option></select></label><button onClick={() => move(1)} disabled={dirty}>Later</button><button class="quiet" onClick={() => setAnchor(run)}>Use current chart as anchor</button></div>
    {dirty && <p class="callout">Apply your chart-input changes before stepping through time.</p>}
    {!input.timeKnown && <p class="callout">Time is unknown. Each day uses noon UTC as a reference, with no houses or angles.</p>}
    {error && <p role="alert" class="error">{error}</p>}
    <p class="feature-meta">Anchor: {anchor.inputSnapshot.utc} · Current: {run.inputSnapshot.utc}</p>
    <details><summary>Compare placements with anchor</summary><p>The change is the shortest angular difference between these two instants. It does not count full revolutions or trace the path between them.</p>
    <div class="table-scroll" tabIndex={0} aria-label="Changes from anchor"><table><thead><tr><th>Body</th><th>Sign: anchor → current</th><th>House: anchor → current</th><th>Change</th></tr></thead><tbody>{changes.map(row => <tr key={row.body} data-changed={row.changed}><th scope="row">{row.body}</th><td>{row.fromSign === row.toSign ? row.toSign : `${row.fromSign} → ${row.toSign}`}{row.motionChanged ? ' · motion changed' : ''}</td><td>{row.fromHouse ?? '—'} → {row.toHouse ?? '—'}</td><td>{formatDelta(row.delta)}</td></tr>)}</tbody></table></div></details>
    <BirthWindowPanel key={JSON.stringify(input)} input={input} />
  </section>;
}

function BirthWindowPanel({ input }: { input: StudioInput }) {
  const [draft, setDraft] = useState(() => initialWindow(input));
  const [result, setResult] = useState<BirthWindow | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(20);
  const calculator = useRef(new WindowCalculator());
  const revision = useRef(0);
  useEffect(() => () => { revision.current++; calculator.current.cancel(); }, []);
  const rows = useMemo(() => result ? windowSummary(result) : [], [result]);
  function update<K extends keyof WindowDraft>(key: K, value: WindowDraft[K]) {
    revision.current++; calculator.current.cancel(); setBusy(false); setResult(null); setError('');
    setDraft(previous => ({ ...previous, [key]: value }));
  }
  async function calculate() {
    const id = ++revision.current; setError(''); setResult(null); setShown(20);
    try {
      const request = windowRequest(draft); setBusy(true);
      const next = await calculator.current.calculate(request);
      if (id === revision.current) setResult(next);
    } catch (error) { if (id === revision.current) setError((error as Error).message); }
    finally { if (id === revision.current) setBusy(false); }
  }
  return <details class="window-panel"><summary>Explore a possible birth-time window</summary>
    <p>Supply the earliest and latest possible UTC times and a location. This does not choose a birth time or change the chart above.</p>
    <form onSubmit={e => { e.preventDefault(); void calculate(); }} onKeyDown={e => { if (e.key === 'Enter' && e.target instanceof HTMLInputElement && !busy) { e.preventDefault(); void calculate(); } }}>
      <label>Earliest UTC<input type="datetime-local" min="1800-01-01T00:00" max="2199-12-31T23:59" required value={draft.start} onInput={e => update('start', e.currentTarget.value)} /></label>
      <label>Latest UTC (excluded)<input type="datetime-local" min="1800-01-01T00:00" max="2199-12-31T23:59" required value={draft.end} onInput={e => update('end', e.currentTarget.value)} /></label>
      <label>Window house system<select value={draft.houseSystem} onChange={e => update('houseSystem', e.currentTarget.value as WindowDraft['houseSystem'])}><option value="placidus">Placidus</option><option value="whole">Whole sign</option></select></label>
      <label>Window latitude<input type="number" step="any" required value={draft.latitude} onInput={e => update('latitude', e.currentTarget.value)} /></label>
      <label>Window longitude<input type="number" step="any" required value={draft.longitude} onInput={e => update('longitude', e.currentTarget.value)} /></label>
      <button disabled={busy} type="button" onClick={() => void calculate()}>{busy ? 'Calculating window…' : 'Calculate window'}</button>
      <p class="form-help">Up to 48 hours. The beginning is included; the end is excluded. All fields are UTC. No times are converted from local clock time.</p>
      {busy && <button type="button" class="quiet" onClick={() => calculator.current.cancel()}>Cancel calculation</button>}
    </form>
    {error && <p role="alert" class="error">{error}</p>}
    {result && <div class="window-result" aria-live="polite"><h3>What varies within this window</h3><p>{dateLabel(result.start)} to {dateLabel(result.end)} · {result.cells.length} intervals · engine {result.engineVersion}</p>
      <p class="callout">Verification: {result.verification}. Completeness is not proven. “Unchanged” refers only to the signs and houses found in this window; it does not establish a birth time.</p>
      {result.flags.length > 0 && <p class="callout">{result.flags.includes('polar-fallback') && 'Placidus falls back to whole-sign houses in part or all of this window. '}{result.flags.includes('bound-exceeded') && 'A search bound was exceeded: completeness is not established. '}{result.flags.includes('node-unresolved') && 'Some node intervals remain unresolved. '}</p>}
      <div class="table-scroll" tabIndex={0} aria-label="Window placements"><table><thead><tr><th>Body</th><th>Signs found</th><th>Houses found</th><th>Result</th></tr></thead><tbody>{rows.map(row => <tr key={row.body}><th scope="row">{row.body}</th><td>{row.signs.map(name).join(', ')}</td><td>{row.houses.map(name).join(', ')}</td><td>{row.stable && !result.flags.includes('bound-exceeded') ? 'Unchanged' : row.signs.includes(null) || row.houses.includes(null) ? 'Unresolved' : 'Review intervals'}</td></tr>)}</tbody></table></div>
      <details><summary>See when placements change</summary><p>At the start: ascendant in {name(result.cells[0].features.ascendant)}, midheaven in {name(result.cells[0].features.midheaven)}. Longitudes continue to move within each interval.</p>{result.switches.length === 0 ? <p>No changes to the tracked signs, houses, angle signs or aspects in orb were found.</p> : <ol class="window-timeline">{result.switches.slice(0, shown).map((entry, i) => <li key={i}><time dateTime={entry.at.toISOString()}>{dateLabel(entry.at)}</time><ul>{entry.changes.map((change, j) => <li key={j}>{changeLabel(change)}</li>)}</ul></li>)}</ol>}{result.switches.length > shown && <button class="quiet" onClick={() => setShown(value => value + 20)}>Show more changes ({result.switches.length - shown} remaining)</button>}<p>“Unresolved” marks an interval the engine could not resolve; it is not a confirmed crossing.</p></details>
      <details><summary>Inspect window calculation data</summary><pre tabIndex={0}>{JSON.stringify(result, null, 2)}</pre></details>
    </div>}
  </details>;
}
