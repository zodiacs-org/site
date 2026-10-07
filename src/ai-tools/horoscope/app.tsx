import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { dateInZone, DEFAULT_HOROSCOPE_ZONE, getHoroscope, program } from './reading';
import './style.css';
declare const HOROSCOPE_ICONS: Record<string, string>;
const cap = (value: string) => value[0].toUpperCase() + value.slice(1);
function App() {
  const [sign, setSign] = useState('aries');
  const [zone, setZone] = useState(DEFAULT_HOROSCOPE_ZONE);
  const [date, setDate] = useState(dateInZone(new Date(), DEFAULT_HOROSCOPE_ZONE));
  const [period, setPeriod] = useState<'day' | 'week'>('day');
  const [focus, setFocus] = useState<'general' | 'love' | 'career'>('general');
  const [copyStatus, setCopyStatus] = useState('');
  const result = getHoroscope({ sign, zone, date, period, focus });
  // The panel is self-contained: host tool results select controls, never execute HTML.
  useEffect(() => {
    if (window.parent === window) return;
    let origin = '*';
    const listener = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.jsonrpc !== '2.0' || (origin !== '*' && event.origin !== origin)) return;
      if (event.data.id === 'zodiacs-horoscopes-init' && event.data.result) {
        if (event.origin !== 'null') origin = event.origin;
        window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }, origin);
      }
      if (event.data.method === 'ui/notifications/tool-result') {
        const request = event.data.params?.structuredContent?.request;
        if (!request || !getHoroscope(request).ok) return;
        if (program.signs.some(item => item.sign === request.sign)) setSign(request.sign);
        setPeriod(request.period ?? 'day'); setFocus(request.focus ?? 'general'); setZone(request.zone ?? DEFAULT_HOROSCOPE_ZONE);
        setDate(request.date ?? dateInZone(new Date(), request.zone ?? DEFAULT_HOROSCOPE_ZONE));
      }
    };
    window.addEventListener('message', listener);
    window.parent.postMessage({ jsonrpc: '2.0', id: 'zodiacs-horoscopes-init', method: 'ui/initialize', params: { protocolVersion: '2026-01-26', appInfo: { name: 'Zodiacs Horoscopes Preview', version: '0.1.0' }, appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] } } }, '*');
    return () => window.removeEventListener('message', listener);
  }, []);
  useEffect(() => { setCopyStatus(''); }, [sign, zone, date, period, focus]);
  async function copyReading() {
    if (!result.ok || result.status !== 'available') return;
    try { await navigator.clipboard.writeText(`${cap(sign)} · ${result.reading.period.from} — ${result.reading.period.through}\n${result.sourceNote}\n\n${result.reading.text}\n\n${result.interpretation}\nhttps://zodiacs.org/horoscopes/${sign}/`); setCopyStatus('Reading copied with its dates and source.'); }
    catch { setCopyStatus('Copy is unavailable here. Select the reading text to copy it.'); }
  }
  return <main>
    <header><a href="https://zodiacs.org/" target="_blank" rel="noreferrer">Zodiacs<span>.org</span></a><span class="preview">Private preview</span></header>
    <section class="intro"><p class="eyebrow">A little perspective</p><h1>Your horoscope,<br/>with room to reflect.</h1><p class="lede">Choose a sign. Read the day or explore the week.</p></section>
    <nav class="signs" aria-label="Choose your Sun sign">{program.signs.map(item => <button aria-pressed={sign === item.sign} onClick={() => setSign(item.sign)} key={item.sign}><img src={HOROSCOPE_ICONS[item.sign]} alt="" width="36" height="36"/><span>{cap(item.sign)}</span></button>)}</nav>
    <section class="reading-layout">
      <aside class="controls"><h2>Make it yours</h2><label>Period<select aria-label="Period" value={period} onChange={e => { setPeriod(e.currentTarget.value as 'day'|'week'); setFocus('general'); }}><option value="day">Daily</option><option value="week">Weekly</option></select></label>
        <label>Reading date<input aria-label="Reading date" type="date" value={date} onInput={e => setDate(e.currentTarget.value)}/></label>
        <label>Timezone<select aria-label="Timezone" value={zone} onChange={e => setZone(e.currentTarget.value)}><option value="America/New_York">New York</option><option value="America/Los_Angeles">Los Angeles</option><option value="Europe/London">London</option><option value="Asia/Bangkok">Bangkok</option><option value="UTC">UTC</option>{!['America/New_York','America/Los_Angeles','Europe/London','Asia/Bangkok','UTC'].includes(zone) && <option value={zone}>{zone}</option>}</select></label>
        <button class="text-button" onClick={() => setDate(dateInZone(new Date(), zone))}>Use today’s date</button>
        <label>Focus<select aria-label="Focus" value={focus} disabled={period === 'week'} onChange={e => setFocus(e.currentTarget.value as typeof focus)}><option value="general">General</option><option value="love">Love</option><option value="career">Career</option></select></label>
        <p class="quiet">Sun-sign readings. No birth details needed.</p><p class="edition">Edition<br/><strong>{program.anchorDate}</strong></p>
      </aside>
      <article aria-live="polite" aria-atomic="false">
        <div class="reading-heading"><div><p class="eyebrow">{period === 'week' ? 'Across the week' : 'The daily reading'}</p><h2>{cap(sign)}</h2></div><img src={HOROSCOPE_ICONS[sign]} alt="" width="72" height="72"/></div>
        {!result.ok ? <p role="alert">{result.error.message}</p> : result.status === 'available' ? <>
          <p class="dates">{result.reading.period.from}{result.reading.period.through !== result.reading.period.from ? ` — ${result.reading.period.through}` : ''}<span>{zone === DEFAULT_HOROSCOPE_ZONE ? 'New York' : zone} · UTC-based edition</span></p>
          <>{result.request.date !== result.editionDate && period === 'day' && <p class="quiet source-note">{result.sourceNote}</p>}</><div class="reading-text">{result.reading.passages.map((passage, i) => <div key={i}>{passage.heading && <h3>{passage.heading}</h3>}<p>{passage.text}</p></div>)}</div>
          <details class="evidence"><summary>Why this reading?</summary><p>Calculated sky positions and events inform the reading. Their astrological meaning is an interpretation.</p><h3>Sky facts</h3><ul>{result.evidence.filter(item => item.kind !== 'solar-house').map(item => <li key={item.id}><strong>{item.label}</strong><span>{item.localAt} · {zone}</span></li>)}</ul><h3>Interpretive choices</h3><p>Whole-sign solar houses are counted from the selected Sun sign. These are not houses from a personal birth chart.</p><ul>{result.evidence.filter(item => item.kind === 'solar-house').map(item => <li key={item.id}>{item.label}</li>)}</ul><p class="quiet">{result.sourceNote}</p><a href="https://zodiacs.org/methodology/" target="_blank" rel="noreferrer">Read our methodology ↗</a></details>
          <div class="actions"><button onClick={copyReading}>Copy reading</button><a href={`https://zodiacs.org/horoscopes/${sign}/`} target="_blank" rel="noreferrer">Explore {cap(sign)} ↗</a></div><p role="status" class="quiet">{copyStatus}</p>
        </> : result.status === 'unavailable' ? <div class="empty"><h3>This date isn’t available yet</h3><p>{result.message}</p>{result.available.map(item => <button key={item.from} onClick={() => setDate(item.from)}>Read {item.from}{item.through !== item.from ? ` — ${item.through}` : ''}</button>)}</div> : <p>Choose your sign to read.</p>}
        <p class="disclosure">For reflection. Astrology does not establish what will happen in your life.</p>
      </article>
    </section><footer><p>This preview uses the dated Zodiacs edition shown above. Your choices stay in this panel unless you copy them; tool requests and results are visible to a connected assistant.</p><a href="https://zodiacs.org/privacy/" target="_blank" rel="noreferrer">Privacy</a></footer>
  </main>;
}
render(<App/>, document.getElementById('horoscopes')!);
