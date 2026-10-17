import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { OccasionsBridge, type PanelToolResult } from './bridge';
import { Art, artOf, Nameplate, PanelFooter } from '../card-kit/parts';
import { Birthday, ChartTwins, Compatibility, FamousChart, Milestones, Occasion, SkyCalendar, type LifeMilestones, type OccasionSky } from './views';
import type { CompatibilityData, CompatibilityNotFound } from '../features/compatibility';
import type { ChartTwinsData, FamousChartData } from '../features/people';
import type { BirthdayData, SkyCalendarData } from '../features/birthday';
import './style.css';

type Shown = { tool: 'get_occasion_sky'; data: OccasionSky } | { tool: 'get_life_milestones'; data: LifeMilestones }
  | { tool: 'get_compatibility'; data: CompatibilityData | CompatibilityNotFound } | { tool: 'find_chart_twins'; data: ChartTwinsData } | { tool: 'get_famous_chart'; data: FamousChartData }
  | { tool: 'get_birthday'; data: BirthdayData } | { tool: 'get_sky_calendar'; data: SkyCalendarData };
const PANEL_TOOLS: readonly string[] = ['get_occasion_sky', 'get_life_milestones', 'get_compatibility', 'find_chart_twins', 'get_famous_chart', 'get_birthday', 'get_sky_calendar'];

/** The panel shows a successful result of one of its tools and nothing else. */
function shownFrom(content: unknown): Shown | { error: string } | null {
  const result = content as { ok?: boolean; tool?: string; data?: unknown; error?: { message?: string } } | undefined;
  if (!result || !result.tool || !PANEL_TOOLS.includes(result.tool)) return null;
  if (!result.ok) return { error: result.error?.message ?? 'That could not be worked out.' };
  return { tool: result.tool, data: result.data } as Shown;
}

function CardFor({ shown }: { shown: Shown }) {
  switch (shown.tool) {
    case 'get_occasion_sky': return <Occasion data={shown.data}/>;
    case 'get_life_milestones': return <Milestones data={shown.data}/>;
    case 'get_compatibility': return <Compatibility data={shown.data}/>;
    case 'find_chart_twins': return <ChartTwins data={shown.data}/>;
    case 'get_famous_chart': return <FamousChart data={shown.data}/>;
    case 'get_birthday': return <Birthday data={shown.data}/>;
    default: return <SkyCalendar data={shown.data}/>;
  }
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

  return <main>
    {shown ? <CardFor shown={shown}/> : <div class="shell">
      <Nameplate/>
      {error ? <p role="alert" class="notice">{error}</p>
        : waiting ? <p role="status" class="quiet">Working out the sky…</p>
        : <><Art panels={[{ src: artOf('sky-calendar-hero') }]}/><p class="quiet">Ask the assistant about a day that matters, your life milestones, two charts, your chart twins, a famous chart or a birthday, and the card appears here.</p></>}
    </div>}
    <PanelFooter>This panel shows what the assistant worked out and saves nothing.</PanelFooter>
  </main>;
}

render(<App/>, document.getElementById('occasions')!);
