import { render } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import Wheel from '../../lib/wheel/Wheel';
import { buildSceneModel } from '../../lib/scene/build';
import { emphasisFor } from '../../lib/scene/emphasis';
import { entityId, parseEntityId, type EntityRef } from '../../lib/scene/types';
import { formatLongitude, SIGNS } from '../../lib/signs';
import { calculateStudio, compareStudio, EXAMPLE, houseName, recordText, selectionContext, type StudioInput } from './model';
import { StudioBridge } from './bridge';
import { TimeExplorer } from './TimeExplorer';
import { RecordInspector } from './RecordInspector';
import { LocalTimeEntry } from './LocalTimeEntry';
import { chartHeading, EXAMPLE_HEADING } from './heading';
import { YourWeekSection } from './YourWeek';
import './style.css';

declare const STUDIO_ICONS: Record<string, string>;
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function RecordExport({ text }: { text: string }) {
  const [showCopy, setShowCopy] = useState(false);
  const [notice, setNotice] = useState('');
  const output = useRef<HTMLTextAreaElement>(null);
  function download() {
    // Embedded hosts may silently block downloads. Always expose a local recovery path.
    setShowCopy(true); setNotice('');
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'zodiacs-chart-record.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setNotice('Record copied. Save it as zodiacs-chart-record.json in a text editor.');
    } catch {
      output.current?.focus(); output.current?.select();
      setNotice('Automatic copying is unavailable here. The record is selected: use Copy, then save it as zodiacs-chart-record.json in a text editor.');
    }
  }
  return <div class="record-export">
    <div class="inline-actions"><button onClick={download}>Download chart record</button><button class="quiet" aria-expanded={showCopy} onClick={() => { setShowCopy(!showCopy); setNotice(''); }}>Copy chart record</button></div>
    {showCopy && <div class="record-input"><p>If no file downloads, copy the record below and save it as <code>zodiacs-chart-record.json</code> in a text editor. This keeps the record on your device.</p><label>Chart record to copy<textarea ref={output} readOnly value={text} spellcheck={false} autoComplete="off" /></label><div class="inline-actions"><button class="quiet" onClick={() => void copy()}>Copy record text</button><button class="quiet" onClick={() => { output.current?.focus(); output.current?.select(); setNotice('Record selected. Use Copy to copy it.'); }}>Select record text</button></div><p role="status">{notice}</p></div>}
  </div>;
}

function App() {
  const [draft, setDraft] = useState<StudioInput>({ ...EXAMPLE });
  const [applied, setApplied] = useState<StudioInput>({ ...EXAMPLE });
  const [run, setRun] = useState(() => calculateStudio(EXAMPLE));
  const [example, setExample] = useState(true);
  // A new panel asks for the person's own birth details first; the example is a labelled second choice.
  const [started, setStarted] = useState(false);
  const [unknownDate, setUnknownDate] = useState('');
  const [selection, setSelection] = useState<EntityRef | null>(null);
  const [compare, setCompare] = useState(false);
  const [error, setError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'placements' | 'aspects' | 'receipt'>('placements');
  const [workspace, setWorkspace] = useState<'chart' | 'time' | 'inspect'>('chart');
  const [workspaceEpoch, setWorkspaceEpoch] = useState(0);
  const bridge = useRef<StudioBridge>();
  const wheelRoot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // The shared wheel already defers icons for the homepage. Supply its deferred
    // assets from this bundle before paint, without modifying the site renderer.
    for (const image of wheelRoot.current?.querySelectorAll('image[data-href]') ?? []) {
      const slug = image.getAttribute('data-href')!.split('/').at(-1)!.replace('.webp', '');
      if (STUDIO_ICONS[slug]) image.setAttribute('href', STUDIO_ICONS[slug]);
    }
  }, [run, workspace]);
  useEffect(() => { const host = new StudioBridge(setAvailable); bridge.current = host; void host.connect(); return () => host.dispose(); }, []);
  const scene = useMemo(() => buildSceneModel(run.chart, { wheelConventions: false }), [run]);
  const emphasis = useMemo(() => emphasisFor(scene, selection), [scene, selection]);
  const otherSystem = applied.houseSystem === 'placidus' ? 'whole' : 'placidus';
  const comparisonResult = useMemo(() => {
    if (!compare || !run.chart.houses) return { run: null, error: '' };
    try { return { run: calculateStudio({ ...applied, houseSystem: otherSystem }), error: '' }; }
    catch { return { run: null, error: 'The comparison could not be calculated. The current chart is unchanged.' }; }
  }, [run, compare, applied, otherSystem]);
  const comparison = comparisonResult.run;
  const context = useMemo(() => selectionContext(run, selection), [run, selection]);
  const facts = JSON.parse(context).facts;
  const changes = comparison ? compareStudio(run, comparison) : [];
  const changed = changes.filter(row => row.currentHouse !== row.comparedHouse).length;
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const heading = example ? EXAMPLE_HEADING : chartHeading(applied, run.inputSnapshot.utc);
  const selectedBody = selection?.kind === 'body' ? scene.bodies.find(b => b.body === selection.body) : null;
  const selectedHue = selectedBody ? SIGNS.find(s => s.slug === selectedBody.sign)?.hue : '#B6D4E4';
  const selectedTitle = selection?.kind === 'body' ? selection.body : selection?.kind === 'house' ? `House ${selection.house}` : selection?.kind === 'sign' ? titleCase(selection.sign) : selection?.kind === 'angle' ? ({ asc: 'Ascendant', mc: 'Midheaven', dsc: 'Descendant', ic: 'Imum coeli' }[selection.angle]) : selection?.kind === 'aspect' ? `${selection.a} ${selection.type} ${selection.b}` : 'Select a placement';
  const shareRevision = useRef(0);
  function select(next: EntityRef | null) { shareRevision.current++; setSelection(next); setShareOpen(false); setNotice(''); }
  function update<K extends keyof StudioInput>(key: K, value: StudioInput[K]) { setDraft(previous => ({ ...previous, local: key === 'houseSystem' ? previous.local : undefined, place: ['latitude', 'longitude', 'timeKnown'].includes(key) ? undefined : previous.place, [key]: value })); setError(''); }
  function apply(input: StudioInput, isExample = false) {
    try {
      const next = calculateStudio(input);
      shareRevision.current++; setRun(next); setApplied({ ...input }); setDraft({ ...input }); setExample(isExample);
      setError(''); setShareOpen(false); setNotice(''); setSelection(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'The chart could not be calculated.'); }
  }
  async function share() {
    if (sharing) return;
    const revision = shareRevision.current;
    setSharing(true); setNotice('');
    try { const message = await bridge.current!.share(context); if (revision === shareRevision.current) { setNotice(message); setShareOpen(false); } }
    catch (e) { if (revision === shareRevision.current) setNotice(e instanceof Error ? e.message : 'Could not share this selection.'); }
    finally { setSharing(false); }
  }
  if (!started) return <main>
    <header class="studio-header"><a href="https://zodiacs.org/" target="_blank" rel="noreferrer">Zodiacs<span>·</span>org</a><span class="header-note">Your birth chart</span></header>
    <section class="onboarding" aria-label="Your birth details">
      <h1>When and where were you born?</h1>
      <p class="lede">Your chart is worked out inside this panel. Nothing is saved, and the assistant sees only what you choose to share.</p>
      <LocalTimeEntry input={draft} title="Birth date, time and place" intro="Use the time on your birth certificate if you have it, and the town or city you were born in." applyLabel="Make my chart" onApply={input => { apply(input); setStarted(true); }} />
      <details class="unknown-time"><summary>I don't know my birth time</summary>
        <p>Without a birth time we use midday as a stand-in. Your Sun sign is reliable; your rising sign and houses can't be shown, and the Moon may have changed sign that day.</p>
        <form onSubmit={e => { e.preventDefault(); if (unknownDate) { apply({ ...EXAMPLE, date: unknownDate, time: '12:00', timeKnown: false, latitude: '', longitude: '' }); setStarted(true); } }}>
          <label>Birth date<input type="date" required min="1800-01-01" max="2199-12-31" value={unknownDate} onInput={e => setUnknownDate(e.currentTarget.value)} /></label>
          <button type="submit" disabled={!unknownDate}>Make my chart without a time</button>
        </form>
      </details>
      {error && <p class="error" role="alert">{error}</p>}
      <button class="quiet" onClick={() => { apply(EXAMPLE, true); setStarted(true); }}>See an example chart (not yours)</button>
    </section>
    <footer class="studio-footer"><a href="https://zodiacs.org/methodology/" target="_blank" rel="noreferrer">How we calculate</a><a href="https://zodiacs.org/privacy/" target="_blank" rel="noreferrer">Privacy</a></footer>
  </main>;
  return <main>
    <header class="studio-header"><a href="https://zodiacs.org/" target="_blank" rel="noreferrer">Zodiacs<span>·</span>org</a><span class="header-note">An interactive chart workspace</span></header>
    <div class="studio-title"><div><p class="kicker">Explore the details</p><h1>Chart Studio</h1><p class="lede">A chart you can explore, compare, and bring into the conversation.</p></div><button class="quiet" onClick={() => { setStarted(false); setWorkspaceEpoch(value => value + 1); }}>Start over</button></div>
    <nav class="workspace-tabs" aria-label="Chart Studio workspaces">{([['chart', 'Chart'], ['time', 'Time Explorer'], ['inspect', 'Chart Inspector']] as const).map(([value, label]) => <button key={value} aria-pressed={workspace === value} onClick={() => setWorkspace(value)}>{label}</button>)}</nav>
    {error && <p class="error" role="alert">{error} The displayed chart still uses its previous inputs.</p>}
    <div hidden={workspace !== 'inspect'}><RecordInspector key={workspaceEpoch} currentRecord={recordText(run)} /></div>
    {workspace !== 'inspect' && <>
    <details class="inputs"><summary>Chart inputs <span>{example ? 'Example chart (not yours) · London, 15 June 1990' : 'Your chart'}{dirty ? ' · unapplied changes' : ''}</span></summary>
      <LocalTimeEntry key={workspaceEpoch} input={draft} onApply={apply} />
      <h2 class="utc-heading">Enter UTC directly</h2>
      <form onSubmit={e => { e.preventDefault(); apply(draft); }} onKeyDown={e => { if (e.key === 'Enter' && e.target instanceof HTMLInputElement) { e.preventDefault(); apply(draft); } }}>
        <label>UTC date<input type="date" min="1800-01-01" max="2199-12-31" required value={draft.date} onInput={e => update('date', e.currentTarget.value)} /></label>
        <label>UTC time<input type="time" step="0.001" required disabled={!draft.timeKnown} value={draft.time} onInput={e => update('time', e.currentTarget.value)} /></label>
        <label>Latitude<input type="number" step="any" min="-89.999999" max="89.999999" value={draft.latitude} disabled={!draft.timeKnown} onInput={e => update('latitude', e.currentTarget.value)} /></label>
        <label>Longitude<input type="number" step="any" min="-180" max="180" value={draft.longitude} disabled={!draft.timeKnown} onInput={e => update('longitude', e.currentTarget.value)} /></label>
        <label>House system<select value={draft.houseSystem} onChange={e => update('houseSystem', e.currentTarget.value as StudioInput['houseSystem'])}><option value="placidus">Placidus</option><option value="whole">Whole sign</option></select></label>
        <button type="button" onClick={() => apply(draft)}>Update chart</button>
        <label class="check"><input type="checkbox" checked={draft.timeKnown} onChange={e => update('timeKnown', e.currentTarget.checked)} /> Exact time is known</label>
        <p class="form-help">Enter UTC, not local clock time. Coordinates are optional; both are needed for houses. With unknown time, noon UTC is a reference only: no houses or angles are calculated, and positions can change during the day.</p>
      </form>
    </details>
    {workspace === 'time' && <TimeExplorer key={workspaceEpoch} input={applied} run={run} onApply={apply} dirty={dirty} />}
    <div class="workspace">
      <section class="chart-area" aria-label="Chart workspace">
        <div class="chart-meta"><span>{example ? 'Example chart (not yours)' : 'Your chart'}</span><time dateTime={heading.dateTime}>{heading.text}</time></div>
        {applied.local && run.chart.input.timeKnown && <p class="local-origin">Converted from your local clock time. Time-zone details are in the calculation record.</p>}
        <div class="wheel-wrap" ref={wheelRoot}><Wheel bodies={run.chart.bodies} asc={run.chart.angles?.asc} mc={run.chart.angles?.mc} cusps={run.chart.houses?.cusps} aspects={run.chart.aspects} size={520} deferIcons interactive={{ scene, selection, emphasis, onSelect: select, label: 'Select a chart element' }} /></div>
        <div class="chart-caption"><span>Tropical zodiac</span><span>{run.chart.houses ? `${houseName(run.chart.houses.system)} houses` : 'No houses or angles'}</span><span>Engine {run.chart.engineVersion}</span></div>
        {run.chart.flags.includes('polar-fallback') && <p class="callout">Placidus is unavailable at this latitude. The engine used whole-sign houses; the receipt records the fallback.</p>}
        {!run.chart.input.timeKnown && <p class="callout">Birth time unknown. Positions use midday as a stand-in, so the rising sign and houses aren't shown, and the Moon may have been in a different sign at your actual time of birth.</p>}
        {run.chart.input.timeKnown && !run.chart.houses && <p class="callout">No location supplied. Add both coordinates to calculate houses and angles.</p>}
        <div class="compare-control"><label class="check"><input type="checkbox" checked={compare} disabled={!run.chart.houses} onChange={e => setCompare(e.currentTarget.checked)} /> Compare house systems</label>{comparison && <span>{changed} of {changes.length} placements change house</span>}</div>
        {comparisonResult.error && <p class="error" role="alert">{comparisonResult.error}</p>}
        {compare && comparison && <section class="comparison" aria-label="House comparison"><h2>{houseName(applied.houseSystem)} &amp; {houseName(otherSystem)}</h2><p>The same instant and location. Planetary positions stay the same; the house boundaries can change.</p><table><thead><tr><th scope="col">Placement</th><th scope="col">{houseName(run.chart.houses!.system)}</th><th scope="col">{houseName(comparison.chart.houses!.system)}</th></tr></thead><tbody>{changes.map(row => <tr key={row.body} data-changed={row.currentHouse !== row.comparedHouse}><th scope="row">{row.body}</th><td>{row.currentHouse}</td><td>{row.comparedHouse}{row.currentHouse !== row.comparedHouse ? ' · changed' : ''}</td></tr>)}</tbody></table>{comparison.chart.flags.includes('polar-fallback') && <p class="callout">The comparison's requested Placidus calculation also falls back to whole sign.</p>}</section>}
      </section>
      <aside class="inspector" aria-label="Chart inspector" style={{ '--selection-color': selectedHue }}>
        <label class="selection-label">Inspect an element<select value={selection ? entityId(selection) : ''} onChange={e => select(parseEntityId(e.currentTarget.value))}><option value="">Choose an element</option><optgroup label="Placements">{scene.bodies.map(b => <option key={b.body} value={`body:${b.body}`}>{b.body}</option>)}</optgroup><optgroup label="Signs">{SIGNS.map(s => <option key={s.slug} value={`sign:${s.slug}`}>{s.name}</option>)}</optgroup>{scene.houses && <optgroup label="Houses">{scene.houses.map(h => <option key={h.index} value={`house:${h.index}`}>House {h.index}</option>)}</optgroup>}{scene.angles && <optgroup label="Angles">{['asc','mc','dsc','ic'].map(a => <option key={a} value={`angle:${a}`}>{a.toUpperCase()}</option>)}</optgroup>}<optgroup label="Aspects">{scene.aspects.map(a => <option key={entityId({ kind: 'aspect', ...a })} value={entityId({ kind: 'aspect', ...a })}>{a.a} {a.type} {a.b}</option>)}</optgroup></select></label>
        <div class="selection-detail" aria-live="polite"><p class="kicker">{selection ? titleCase(selection.kind) : 'Chart detail'}</p><h2>{selectedTitle}</h2>{selectedBody ? <><p class="position">{formatLongitude(selectedBody.lon)}</p><dl><div><dt>House</dt><dd>{selectedBody.house ?? 'Not calculated'}</dd></div><div><dt>Motion</dt><dd>{selectedBody.retrograde ? 'Retrograde' : 'Direct'}</dd></div><div><dt>Longitude</dt><dd>{selectedBody.lon.toFixed(6)}°</dd></div></dl><p class="detail-help">Select a connected aspect below to inspect its orb and whether it is applying.</p>{scene.aspects.filter(a => a.a === selectedBody.body || a.b === selectedBody.body).map(a => <button key={entityId({ kind: 'aspect', ...a })} class="aspect-link" onClick={() => select({ kind: 'aspect', ...a })}>{a.a} {a.type} {a.b}<span>{a.orb.toFixed(2)}° {a.applying ? 'applying' : 'separating'}</span></button>)}</> : !selection ? <p class="detail-help">Choose a placement on the wheel, or use the element menu to inspect a body, sign, house, angle, or aspect.</p> : <dl>{Object.entries(facts).map(([key,value]) => <div key={key}><dt>{titleCase(key.replace(/([A-Z])/g,' $1'))}</dt><dd>{Array.isArray(value) ? value.map(v => typeof v === 'object' ? `${v.body}: ${v.position}` : String(v)).join(', ') || 'None' : typeof value === 'number' ? value.toFixed(4) : String(value)}</dd></div>)}</dl>}</div>
        <div class="assistant-action"><button disabled={!selection || sharing} onClick={() => setShareOpen(!shareOpen)} aria-expanded={shareOpen}>Ask about this</button><p>Only the selection you review is shared. Chart positions can reveal personal information.</p>{shareOpen && <div class="share-preview"><h3>Review this selection</h3><p>{selectedTitle}, its computed facts, and the calculation settings shown below.</p><details><summary>See exactly what's shared</summary><pre tabIndex={0}>{context}</pre></details><p>{available ? 'Your assistant provider will receive these facts. Earlier shared selections remain in the conversation.' : 'Open Chart Studio through the connected plugin to share this selection.'}</p><button disabled={!available || sharing} onClick={() => void share()}>{sharing ? 'Sharing…' : 'Share these facts'}</button><button class="quiet" disabled={sharing} onClick={() => setShareOpen(false)}>Cancel</button></div>}<p role="status">{notice}</p></div>
      </aside>
    </div>
    {!example && workspace === 'chart' && <YourWeekSection run={run} />}
    <section class="records" aria-label="Calculation details"><div class="record-tabs" role="group" aria-label="View calculation details">{(['placements','aspects','receipt'] as const).map(name => <button key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>{titleCase(name)}</button>)}</div>
      {tab === 'placements' && <div class="placement-grid">{scene.bodies.map(b => <button key={b.body} aria-pressed={selection?.kind === 'body' && selection.body === b.body} onClick={() => select({ kind: 'body', body: b.body })}><span>{b.body}</span><strong>{formatLongitude(b.lon)}</strong><small>{b.house ? `House ${b.house}` : 'House unavailable'}{b.retrograde ? ' · retrograde' : ''}</small></button>)}</div>}
      {tab === 'aspects' && <div class="aspect-grid">{scene.aspects.map(a => <button key={entityId({ kind: 'aspect', ...a })} onClick={() => select({ kind: 'aspect', ...a })}><span>{a.a} {a.type} {a.b}</span><small>Orb {a.orb.toFixed(3)}° · {a.applying ? 'applying' : 'separating'}</small></button>)}</div>}
      {tab === 'receipt' && <div class="receipt"><div><h2>Calculation record</h2><p>Inputs, conventions, versions, and results for the displayed chart. Downloaded and copied records contain personal chart data.</p><RecordExport key={recordText(run)} text={recordText(run)} /></div><details><summary>Inspect full JSON record</summary><pre tabIndex={0}>{recordText(run)}</pre></details>{comparison && <details><summary>Inspect comparison record</summary><pre tabIndex={0}>{recordText(comparison)}</pre></details>}</div>}
    </section>
    </>}
    <footer class="studio-footer"><a href="https://zodiacs.org/methodology/" target="_blank" rel="noreferrer">How we calculate</a><p>Calculated in this browser. This panel does not save charts. Only reviewed selections are shared with the assistant. Interpretations are separate from these calculations.</p><a href="https://zodiacs.org/privacy/" target="_blank" rel="noreferrer">Privacy</a></footer>
  </main>;
}
render(<App />, document.getElementById('studio')!);
