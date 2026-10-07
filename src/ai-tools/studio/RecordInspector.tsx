import { useEffect, useRef, useState } from 'preact/hooks';
import type { Comparison, Difference } from '../../lib/compare/diff';
import { inspectRecords, readStudioRecord, reproduceRecord, RECORD_BYTES } from './inspect';

function Differences({ rows, right = 'Record B' }: { rows: readonly Difference[]; right?: string }) {
  return <div class="table-scroll" tabIndex={0} aria-label="Calculation differences"><table><thead><tr><th>Field</th><th>Record A</th><th>{right}</th><th>Kind</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><th scope="row">{row.label}</th><td>{row.left}</td><td>{row.right}</td><td>{row.kind}</td></tr>)}</tbody></table></div>;
}
export function RecordInspector({ currentRecord }: { currentRecord: string }) {
  const [records, setRecords] = useState(['', '']);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [reproduction, setReproduction] = useState<ReturnType<typeof reproduceRecord> | null>(null);
  const [error, setError] = useState('');
  const revision = useRef(0);
  useEffect(() => () => { revision.current++; }, []);
  function change(side: number, text: string) {
    revision.current++; setRecords(previous => previous.map((value, i) => i === side ? text : value));
    setComparison(null); setReproduction(null); setError('');
  }
  async function readFile(side: number, file?: File) {
    if (!file) return;
    const id = ++revision.current; setComparison(null); setReproduction(null); setError('');
    try {
      if (file.size > RECORD_BYTES) throw new Error('The record exceeds the 64 KiB limit.');
      const text = await file.text(); readStudioRecord(text);
      if (id === revision.current) change(side, text);
    } catch (error) { if (id === revision.current) setError((error as Error).message); }
  }
  function inspect(reproduce: boolean) {
    setError(''); setComparison(null); setReproduction(null);
    try { if (reproduce) setReproduction(reproduceRecord(records[0])); else setComparison(inspectRecords(records[0], records[1])); }
    catch (error) { setError((error as Error).message); }
  }
  return <section class="feature-panel" aria-label="Chart Inspector"><p class="kicker">Understand a calculation</p><h2>Chart Inspector</h2>
    <p>Open a Zodiacs calculation record, reproduce it with this engine, or compare two records to see which inputs and results differ.</p>
    <p class="callout">Records contain personal chart data. Files are read in this panel and are not uploaded or shared with the assistant. A matching calculation does not authenticate a record or its claimed source.</p>
    <div class="record-inputs">{records.map((value, side) => <div class="record-input" key={side}><h3>Record {side === 0 ? 'A' : 'B'}</h3><label>Open record {side === 0 ? 'A' : 'B'}<input type="file" accept=".json,application/json" onChange={e => { void readFile(side, e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} /></label><label>Record {side === 0 ? 'A' : 'B'} JSON<textarea spellcheck={false} autoComplete="off" value={value} maxLength={RECORD_BYTES} onInput={e => change(side, e.currentTarget.value)} placeholder="Paste a Zodiacs natal calculation record" /></label><div class="inline-actions"><button class="quiet" onClick={() => change(side, currentRecord)}>Use current chart for {side === 0 ? 'A' : 'B'}</button><button class="quiet" disabled={!value} onClick={() => change(side, '')}>Clear {side === 0 ? 'A' : 'B'}</button></div></div>)}</div>
    <div class="inline-actions"><button disabled={!records[0]} onClick={() => inspect(true)}>Reproduce record A</button><button disabled={!records[0] || !records[1]} onClick={() => inspect(false)}>Compare records</button><button class="quiet" disabled={!records.some(Boolean)} onClick={() => { change(0, ''); change(1, ''); }}>Clear both records</button></div>
    {error && <p role="alert" class="error">{error}</p>}
    {reproduction && <div class="inspection-result" aria-live="polite"><h3>{reproduction.matches ? 'Compared calculation fields reproduce' : 'The recalculation differs'}</h3><p>Recalculated using engine {reproduction.engine}, with the record’s instant, time scale, coordinates, requested houses and any pinned ΔT. Source claims and extensions are not verified.</p>{reproduction.differences.length > 0 && <Differences rows={reproduction.differences} right="Recalculated" />}<details><summary>Inspect recalculated record</summary><pre tabIndex={0}>{reproduction.record}</pre></details></div>}
    {comparison && <div class="inspection-result" aria-live="polite"><h3>{comparison.identical ? 'No differences in compared fields' : `${comparison.differences.length} ${comparison.differences.length === 1 ? 'difference' : 'differences'}`}</h3><p>This comparison checks the calculation fields supported by the Zodiacs record comparator. It does not establish that records came from independent software.</p>{comparison.differences.length > 0 && <Differences rows={comparison.differences} />}{comparison.explanations.map(row => <article key={row.id}><h4>{row.evidence}</h4><p>{row.statement}</p>{row.detail && <p>{row.detail}</p>}</article>)}{comparison.limits.map((limit, i) => <p key={i} class="callout">{limit}</p>)}</div>}
  </section>;
}
