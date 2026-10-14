import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { HoroscopeBridge, type PanelToolResult } from './bridge';
import type { HoroscopeAnswer, HoroscopeFocus, HoroscopePanelData, PanelReading } from './reading';
import './style.css';

declare const HOROSCOPE_SIGN_TABLE: { slug: string; name: string; dates: string }[];
declare const HOROSCOPE_ICONS: Record<string, string>;

const PANEL_KEY = 'zodiacs/horoscope';
const FOCUS_LABEL: Record<HoroscopeFocus, string> = { general: 'General', love: 'Love', career: 'Career' };
const FOCUSES: HoroscopeFocus[] = ['general', 'love', 'career'];

type View = { mode: 'day'; date: string; focus: HoroscopeFocus } | { mode: 'week' };

function deviceZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}
function dateIn(zone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)!.value).join('-');
}
function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
const noon = (date: string) => new Date(`${date}T12:00:00.000Z`);
const utcFormat = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(noon(date));
const dayName = (date: string) => utcFormat(date, { weekday: 'long', day: 'numeric', month: 'long' });
function weekName(from: string, through: string): string {
  const fromMonth = utcFormat(from, { month: 'long' });
  const throughMonth = utcFormat(through, { month: 'long' });
  const day = (date: string) => utcFormat(date, { day: 'numeric' });
  return fromMonth === throughMonth ? `Week of ${day(from)}–${day(through)} ${throughMonth}` : `Week of ${day(from)} ${fromMonth} – ${day(through)} ${throughMonth}`;
}
const when = (at: string, zone: string) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(at));
const placeName = (zone: string) => (zone === 'UTC' || zone === 'Etc/UTC' ? 'UTC' : (zone.split('/').pop() ?? zone).replaceAll('_', ' '));
const signInfo = (slug: string) => HOROSCOPE_SIGN_TABLE.find((sign) => sign.slug === slug);

function toolAnswer(content: unknown): { answer?: HoroscopeAnswer; error?: string } {
  const result = content as { ok?: boolean; tool?: string; data?: HoroscopeAnswer; error?: { message?: string } } | undefined;
  if (!result || result.tool !== 'get_horoscope') return {};
  if (result.ok) return { answer: result.data };
  return { error: result.error?.message ?? 'That reading could not be opened.' };
}

function startView(panel: HoroscopePanelData, zone: string): View {
  if (panel.requested.period === 'week') return { mode: 'week' };
  return { mode: 'day', date: panel.requested.date ?? dateIn(zone), focus: panel.requested.focus };
}

function Reading({ reading, zone, note, heading }: { reading: PanelReading; zone: string; note: string; heading: string }) {
  return <>
    <p class="when">{heading}</p>
    <div class="prose">{reading.paragraphs.map((paragraph, index) => <div key={index}>{paragraph.heading && <h3>{paragraph.heading}</h3>}<p>{paragraph.text}</p></div>)}</div>
    {(reading.facts.length > 0 || reading.houses.length > 0) && <details class="why">
      <summary>Why this reading?</summary>
      <p>{note}</p>
      {reading.facts.length > 0 && <ul class="facts">{reading.facts.map((fact) => <li key={fact.text + fact.at}><span>{fact.text}</span><span class="quiet">{when(fact.at, zone)}</span></li>)}</ul>}
      {reading.houses.length > 0 && <ul class="houses">{reading.houses.map((house) => <li key={house}>{house}</li>)}</ul>}
      <a href="https://zodiacs.org/methodology/" target="_blank" rel="noreferrer">How we write horoscopes ↗</a>
    </details>}
  </>;
}

function App() {
  const bridge = useRef<HoroscopeBridge | null>(null);
  const [panel, setPanel] = useState<HoroscopePanelData | null>(null);
  const [picking, setPicking] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [theme, setTheme] = useState('');
  // A reading is usually on its way when the panel opens. Show a quiet line until it
  // arrives, and the sign picker only if nothing comes (the panel can open without a call).
  const [waiting, setWaiting] = useState(true);
  // Once the person has chosen something here, a host repeating the turn's result must not undo it.
  const touched = useRef(false);
  const pick = (value: boolean) => { touched.current = true; setPicking(value); };
  const show = (next: View) => { touched.current = true; setView(next); };

  function accept(result: PanelToolResult) {
    const data = result._meta?.[PANEL_KEY] as HoroscopePanelData | undefined;
    const { answer, error } = toolAnswer(result.structuredContent);
    if (data) {
      setPanel(data);
      setView(startView(data, data.requested.zone ?? deviceZone()));
      setPicking(false);
      setMessage('');
      setWaiting(false);
    } else if (answer?.status === 'choose-sign') {
      setPicking(true);
      setWaiting(false);
    } else if (error) {
      setMessage(error);
      setWaiting(false);
    }
  }

  useEffect(() => {
    const link = new HoroscopeBridge((result) => { if (!touched.current) accept(result); }, (value) => setTheme(value === 'dark' || value === 'light' ? value : ''));
    bridge.current = link;
    link.connect();
    return () => link.dispose();
  }, []);

  useEffect(() => { const timer = setTimeout(() => setWaiting(false), 1500); return () => clearTimeout(timer); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme || ''; }, [theme]);
  useEffect(() => { setStatus(''); }, [panel, view]);

  async function choose(slug: string) {
    const name = signInfo(slug)?.name ?? slug;
    if (!bridge.current?.canCall()) { setMessage(`Ask in the chat for another sign, for example “Show the ${name} horoscope”.`); return; }
    touched.current = true;
    setBusy(true); setMessage('');
    try {
      const period = panel?.requested.period ?? 'day';
      const focus = view?.mode === 'day' ? view.focus : 'general';
      accept(await bridge.current.callTool({ sign: slug, period, focus, zone: panel?.requested.zone ?? deviceZone() }));
    } catch {
      setMessage(`That reading could not be opened here. Ask in the chat: “Show the ${name} horoscope”.`);
    } finally { setBusy(false); }
  }

  const zone = panel?.requested.zone ?? deviceZone();
  const today = dateIn(zone);
  const showGrid = picking || !panel;

  if (waiting && !panel && !picking && !message) {
    return <main>
      <header class="brand"><a href="https://zodiacs.org/horoscopes/" target="_blank" rel="noreferrer">Zodiacs</a></header>
      <p role="status" class="quiet">Opening your horoscope…</p>
    </main>;
  }

  if (showGrid) {
    return <main>
      <header class="brand"><a href="https://zodiacs.org/horoscopes/" target="_blank" rel="noreferrer">Zodiacs</a></header>
      <section class="intro"><h1>Your horoscope</h1><p>Choose your sign. Not sure? It follows your birthday.</p></section>
      <nav class="grid" aria-label="Choose your Sun sign">{HOROSCOPE_SIGN_TABLE.map((sign) => <button key={sign.slug} disabled={busy} aria-pressed={panel?.sign === sign.slug} onClick={() => choose(sign.slug)}>
        <img src={HOROSCOPE_ICONS[sign.slug]} alt="" width="40" height="40"/><span class="name">{sign.name}</span><span class="quiet">{sign.dates}</span>
      </button>)}</nav>
      {busy && <p role="status" class="quiet">Opening the reading…</p>}
      {message && <p role="alert" class="notice">{message}</p>}
      {panel && <button class="text" onClick={() => pick(false)}>Back to {panel.signName}</button>}
    </main>;
  }

  const current = view ?? { mode: 'day', date: today, focus: 'general' as HoroscopeFocus };
  const days = panel.days.map((day) => day.date);
  const dayChoices = [today, addDays(today, 1)].filter((date) => days.includes(date));
  if (current.mode === 'day' && !dayChoices.includes(current.date)) dayChoices.push(current.date);
  const dayLabel = (date: string) => (date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : dayName(date));
  const week = panel.weeks.find((item) => item.from <= today && today <= item.through) ?? panel.weeks[0];
  const reading = current.mode === 'week' ? week : panel.days.find((day) => day.date === current.date)?.focuses[current.focus];
  const heading = current.mode === 'week'
    ? `${weekName(week.from, week.through)} · times for ${placeName(zone)}`
    : `${dayName(current.date)} · times for ${placeName(zone)}`;
  const missing = current.mode === 'day' && !reading
    ? (current.date > days[days.length - 1] ? `The reading for ${dayName(current.date)} isn't published yet. Each day's reading appears the day before.` : `The reading for ${dayName(current.date)} is no longer kept here. Recent readings are on zodiacs.org.`)
    : '';

  async function copy() {
    if (!reading || reading.status !== 'available') return;
    const label = current.mode === 'week' ? weekName(week.from, week.through) : `${dayName(current.date)}${current.focus === 'general' ? '' : ` · ${FOCUS_LABEL[current.focus]}`}`;
    const text = `${panel!.signName} · ${label}\n\n${reading.paragraphs.map((paragraph) => paragraph.text).join('\n\n')}\n\n${panel!.disclosure}\nhttps://zodiacs.org/horoscopes/${panel!.sign}/`;
    try { await navigator.clipboard.writeText(text); setStatus('Reading copied.'); }
    catch { setStatus('Copying isn’t allowed here. Select the text to copy it.'); }
  }

  return <main>
    <header class="sign-head">
      <img src={HOROSCOPE_ICONS[panel.sign]} alt="" width="56" height="56"/>
      <div><p class="eyebrow">Your horoscope</p><h1>{panel.signName}</h1><p class="quiet">{signInfo(panel.sign)?.dates}</p></div>
      <button class="text" onClick={() => pick(true)}>Change sign</button>
    </header>
    <div class="chips" role="group" aria-label="Day or week">
      {dayChoices.map((date) => <button key={date} aria-pressed={current.mode === 'day' && current.date === date} onClick={() => show({ mode: 'day', date, focus: current.mode === 'day' ? current.focus : 'general' })}>{dayLabel(date)}</button>)}
      <button aria-pressed={current.mode === 'week'} onClick={() => show({ mode: 'week' })}>This week</button>
    </div>
    {current.mode === 'day' && <div class="chips focus" role="group" aria-label="Focus">
      {FOCUSES.map((focus) => <button key={focus} aria-pressed={current.focus === focus} onClick={() => show({ ...current, focus })}>{FOCUS_LABEL[focus]}</button>)}
    </div>}
    <article aria-live="polite">
      {reading && reading.status === 'available'
        ? <Reading reading={reading} zone={zone} note={panel.note} heading={heading}/>
        : <p class="notice">{missing || `There's no ${current.mode === 'day' && current.focus !== 'general' ? `${current.focus} ` : ''}reading for ${panel.signName} here yet.`}</p>}
      {reading && reading.status === 'available' && <div class="actions">
        <button onClick={copy}>Copy reading</button>
        <a href={`https://zodiacs.org/horoscopes/${panel.sign}/`} target="_blank" rel="noreferrer">More on zodiacs.org ↗</a>
      </div>}
      <p role="status" class="quiet">{status}</p>
      <p class="disclosure">{panel.disclosure}</p>
    </article>
    {message && <p role="alert" class="notice">{message}</p>}
    <footer><p>Your choices stay on this screen. If you ask the assistant about a reading, it sees that reading.</p><a href="https://zodiacs.org/privacy/" target="_blank" rel="noreferrer">Privacy</a></footer>
  </main>;
}

render(<App/>, document.getElementById('horoscopes')!);
