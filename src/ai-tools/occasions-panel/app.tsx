import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { OccasionsBridge, type PanelToolResult } from './bridge';
import { OCCASION_LABELS, type OccasionKind } from '../../lib/occasions/kinds';
import { MILESTONE_WORDS } from '../../lib/occasions/milestone-words';
import { Actions, Score, Birthday, ChartTwins, Compatibility, FamousChart, Signature, SkyCalendar } from './views';
import type { CompatibilityData } from '../features/compatibility';
import type { ChartTwinsData, FamousChartData } from '../features/people';
import type { BirthdayData, SkyCalendarData } from '../features/birthday';
import './style.css';

declare const OCCASIONS_ICONS: Record<string, string>;

interface ClockTime { utc: string; local: string }
interface OccasionSky {
  occasion: OccasionKind; date: string; time: string | null; zone: string | null; place: string | null; names: string | null;
  card: { title: string; interpretation: string; closing: string };
  instant: ClockTime; instantIs: 'given-time' | 'local-noon' | 'utc-noon';
  sky: { bodies: { body: string; sign: string; degree: number; retrograde: boolean }[]; moon: { phase: string; illuminationPercent: number; waxing: boolean }; retrograde: string[] };
  moonSignChange: { from: string; to: string } | null;
  evening: {
    sunrise: ClockTime | null; sunset: ClockTime | null; goldenHour: { start: ClockTime; end: ClockTime } | null; civilDusk: ClockTime | null;
    moonrise: ClockTime | null; moonset: ClockTime | null; moonHighest: { at: ClockTime; altitude: number } | null;
    planetsAfterDusk: string[]; flags: string[];
  } | null;
  rating: { score: number; verdict: string; reasons: string[] };
  cardUrl: string | null; shareUrl?: string | null; note: string;
}
type MilestoneKind = keyof typeof MILESTONE_WORDS;
interface Milestone { kind: MilestoneKind; name: string; index: number; age: number; first: string; last: string; passes: { at: string; retrograde: boolean }[] }
interface LifeMilestones {
  birthDate: string; timeKnown: boolean; asOf: string; milestones: Milestone[]; next: Milestone | null;
  numbers: { fullMoons: number; mercuryRetrogrades: number; jupiterReturns: number };
  cardUrl: string | null; note: string;
}
type Shown = { tool: 'get_occasion_sky'; data: OccasionSky } | { tool: 'get_life_milestones'; data: LifeMilestones }
  | { tool: 'get_compatibility'; data: CompatibilityData } | { tool: 'find_chart_twins'; data: ChartTwinsData } | { tool: 'get_famous_chart'; data: FamousChartData }
  | { tool: 'get_birthday'; data: BirthdayData } | { tool: 'get_sky_calendar'; data: SkyCalendarData };
const PANEL_TOOLS: readonly string[] = ['get_occasion_sky', 'get_life_milestones', 'get_compatibility', 'find_chart_twins', 'get_famous_chart', 'get_birthday', 'get_sky_calendar'];

const signName = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1);
const longDate = (date: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
const day = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
/** "Sat 12 Jun 2027, 20:57" (or "…, 20:57 UTC") as the tool gives it, down to the time. */
const time = (clock: ClockTime | null | undefined) => (clock ? clock.local.split(', ').pop() ?? clock.local : '');
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const milestoneName = (milestone: Milestone) => (milestone.kind === 'uranus-opposition' ? 'Uranus opposition' : `${ORDINALS[milestone.index - 1] ?? `${milestone.index}th`} ${MILESTONE_WORDS[milestone.kind].name}`);
const capital = (text: string) => text.replace(/^./u, (c) => c.toUpperCase());

/** The panel shows a successful result of one of its tools and nothing else. */
function shownFrom(content: unknown): Shown | { error: string } | null {
  const result = content as { ok?: boolean; tool?: string; data?: unknown; error?: { message?: string } } | undefined;
  if (!result || !result.tool || !PANEL_TOOLS.includes(result.tool)) return null;
  if (!result.ok) return { error: result.error?.message ?? 'That could not be worked out.' };
  return { tool: result.tool, data: result.data } as Shown;
}

function Brand() {
  return <header class="brand"><a href="https://zodiacs.org/" target="_blank" rel="noreferrer">Zodiacs</a></header>;
}

function Occasion({ data }: { data: OccasionSky }) {
  const sun = data.sky.bodies.find((body) => body.body === 'Sun');
  const moon = data.sky.bodies.find((body) => body.body === 'Moon');
  const evening = data.evening;
  const when = [
    longDate(data.date),
    data.place,
    data.instantIs === 'given-time' ? time(data.instant)
      : data.instantIs === 'local-noon' ? 'no time given, so at noon'
      // A place name alone (no zone or coordinates) is shown, but the sky is still read at noon UTC.
      : data.place ? 'no time given, so at noon UTC' : 'no time or place given, so at noon UTC',
  ].filter(Boolean).join(' · ');
  const moonLine = data.moonSignChange ? `${signName(data.moonSignChange.from)} → ${signName(data.moonSignChange.to)} Moon` : moon ? `${signName(moon.sign)} Moon` : '';
  const rows: [string, string][] = [];
  if (evening?.goldenHour) rows.push(['Golden hour', `${time(evening.goldenHour.start)} – ${time(evening.goldenHour.end)}`]);
  if (evening?.sunset) rows.push(['Sunset', time(evening.sunset)]);
  if (evening?.civilDusk) rows.push(['Dusk', time(evening.civilDusk)]);
  if (evening?.moonHighest && evening.moonHighest.altitude > 0) rows.push(['Moon at its highest', `${time(evening.moonHighest.at)} · ${evening.moonHighest.altitude}° up`]);
  if (evening && evening.planetsAfterDusk.length > 0) rows.push(['Bright after dark', list(evening.planetsAfterDusk)]);
  if (evening?.flags.includes('sun-never-sets')) rows.push(['The Sun', 'does not set that day']);
  if (evening?.flags.includes('sun-never-rises')) rows.push(['The Sun', 'does not rise that day']);
  if (data.sky.retrograde.length > 0) rows.push(['Also that day', `${list(data.sky.retrograde)} retrograde`]);
  const kicker = [OCCASION_LABELS[data.occasion], data.names?.trim()].filter(Boolean).join(' · ');
  const text = [data.names?.trim(), data.card.title, when, `${data.rating.score}/100 · ${data.rating.verdict}`, sun ? `${signName(sun.sign)} Sun · ${moonLine}` : '', ...rows.map(([label, value]) => `${label}: ${value}`), `${data.card.interpretation} ${data.card.closing}`, data.note, 'zodiacs.org/occasions']
    .filter(Boolean).join('\n');
  return <main>
    <Brand/>
    <article class="card">
      <p class="kicker">{kicker}</p>
      <h1>{data.card.title}</h1>
      <p class="when">{when}</p>
      <Score score={data.rating.score} verdict={data.rating.verdict}/>
      {data.rating.reasons.length > 0 && <ul class="reasons">{data.rating.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
      {sun && moon && <div class="discs">
        <div class="disc"><img src={OCCASIONS_ICONS[sun.sign]} alt="" width="56" height="56"/><div><strong>{signName(sun.sign)} Sun</strong><span class="quiet">{sun.degree.toFixed(1)}°</span></div></div>
        <div class="disc"><img src={OCCASIONS_ICONS[moon.sign]} alt="" width="56" height="56"/><div><strong>{moonLine}</strong><span class="quiet">{data.sky.moon.phase.toLowerCase()} · {data.sky.moon.illuminationPercent}% lit</span></div></div>
      </div>}
      {rows.length > 0 && <dl class="rows">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      <p class="words">{data.card.interpretation} {data.card.closing}</p>
      {data.moonSignChange && data.instantIs !== 'given-time' && <p class="quiet">The Moon changes sign that day. Add the time to pin it down.</p>}
      <Actions text={text} cardUrl={data.cardUrl} cardLabel="Open the printable card" shareUrl={data.shareUrl}/>
      <p class="disclosure">{data.note}</p>
      <Signature/>
    </article>
    <Footer/>
  </main>;
}

function Milestones({ data }: { data: LifeMilestones }) {
  const next = data.next;
  const now = Date.parse(data.asOf);
  const passLabel = (milestone: Milestone, index: number, pass: { retrograde: boolean }) => (index === 0
    ? (milestone.kind === 'uranus-opposition' ? 'Uranus reaches the point opposite its place at your birth' : `${milestone.kind === 'jupiter-return' ? 'Jupiter' : 'Saturn'} reaches its place at your birth`)
    : pass.retrograde ? 'Passes back over it, retrograde' : index === milestone.passes.length - 1 ? 'Crosses it for the last time' : 'Crosses it again');
  const span = (milestone: Milestone) => `${day(milestone.first)}${milestone.passes.length > 1 ? ` – ${day(milestone.last)}` : ''}`;
  const lead = next ? `${Date.parse(next.first) <= now ? 'Now' : 'Next'}: your ${milestoneName(next)}, at ${next.age}` : '';
  const text = [`Born ${day(data.birthDate)}`, 'Your sky milestones', lead, ...data.milestones.map((milestone) => `${capital(milestoneName(milestone))} · age ${milestone.age}: ${span(milestone)}`),
    `${data.numbers.fullMoons.toLocaleString('en-GB')} full moons, ${data.numbers.mercuryRetrogrades} Mercury retrogrades and ${data.numbers.jupiterReturns} Jupiter returns lived through, as of ${day(data.asOf)}`, data.note, 'zodiacs.org/occasions/milestones']
    .filter(Boolean).join('\n');
  return <main>
    <Brand/>
    <article class="card">
      <p class="kicker">Born {day(data.birthDate)}</p>
      <h1>Your sky milestones</h1>
      {next && <>
        <p class="when">{lead}</p>
        <dl class="rows lead">{next.passes.map((pass, index) => <div key={pass.at}><dt>{passLabel(next, index, pass)}</dt><dd>{day(pass.at)}</dd></div>)}</dl>
        <p class="words">{MILESTONE_WORDS[next.kind].about}</p>
      </>}
      <div class="numbers">
        <div><strong>{data.numbers.fullMoons.toLocaleString('en-GB')}</strong><span>full moons lived through</span></div>
        <div><strong>{data.numbers.mercuryRetrogrades}</strong><span>Mercury retrogrades</span></div>
        <div><strong>{data.numbers.jupiterReturns}</strong><span>Jupiter returns</span></div>
      </div>
      <dl class="rows">{data.milestones.map((milestone) => <div key={`${milestone.kind}-${milestone.index}`}><dt>{capital(milestoneName(milestone))} · age {milestone.age}</dt><dd>{span(milestone)}</dd></div>)}</dl>
      {!data.timeKnown && <p class="quiet">Without a birth time, a date can be a day off.</p>}
      <Actions text={text} cardUrl={data.cardUrl} cardLabel="Open the card on zodiacs.org"/>
      <p class="disclosure">{data.note}</p>
      <Signature/>
    </article>
    <Footer/>
  </main>;
}

function Footer() {
  return <footer><p>This panel shows what the assistant worked out and saves nothing.</p><a href="https://zodiacs.org/privacy/" target="_blank" rel="noreferrer">Privacy</a></footer>;
}

function App() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('');
  // The result is usually on its way when the panel opens; say so quietly until it arrives.
  const [waiting, setWaiting] = useState(true);
  const bridge = useRef<OccasionsBridge | null>(null);

  useEffect(() => {
    const link = new OccasionsBridge((result: PanelToolResult) => {
      const next = shownFrom(result.structuredContent);
      if (!next) return;
      if ('error' in next) { setError(next.error); setShown(null); } else { setShown(next); setError(''); }
      setWaiting(false);
    }, (value) => setTheme(value === 'dark' || value === 'light' ? value : ''));
    bridge.current = link;
    link.connect();
    return () => link.dispose();
  }, []);
  useEffect(() => { const timer = setTimeout(() => setWaiting(false), 1500); return () => clearTimeout(timer); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme || ''; }, [theme]);

  if (shown?.tool === 'get_occasion_sky') return <Occasion data={shown.data}/>;
  if (shown?.tool === 'get_life_milestones') return <Milestones data={shown.data}/>;
  if (shown) return <main>
    <Brand/>
    {shown.tool === 'get_compatibility' ? <Compatibility data={shown.data}/>
      : shown.tool === 'find_chart_twins' ? <ChartTwins data={shown.data}/>
      : shown.tool === 'get_famous_chart' ? <FamousChart data={shown.data}/>
      : shown.tool === 'get_birthday' ? <Birthday data={shown.data}/>
      : <SkyCalendar data={shown.data}/>}
    <Footer/>
  </main>;
  return <main>
    <Brand/>
    {error ? <p role="alert" class="notice">{error}</p>
      : waiting ? <p role="status" class="quiet">Working out the sky…</p>
      : <p class="quiet">Ask the assistant about a day that matters, your life milestones, two charts, your chart twins, a famous chart or a birthday, and the card appears here.</p>}
  </main>;
}

render(<App/>, document.getElementById('occasions')!);
