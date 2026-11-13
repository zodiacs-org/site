import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { OccasionsBridge, type PanelToolResult } from '../occasions-panel/bridge';
import { Art, artOf, Nameplate, PanelFooter } from '../card-kit/parts';
import { ChineseZodiac, Explainer, HoroscopePeriod, NatalChart, PersonalTransits } from './views';
import type { NatalChartData } from '../features/natal-chart';
import type { HoroscopePeriodData } from '../features/horoscope-period';
import type { ChineseZodiacData } from '../features/chinese-zodiac';
import type { PersonalTransitsData } from '../features/personal-transits';
import type { ExplainData } from '../features/explain';
import './style.css';

type Shown = { tool: 'get_natal_chart'; data: NatalChartData } | { tool: 'get_horoscope_period'; data: HoroscopePeriodData }
  | { tool: 'get_chinese_zodiac'; data: ChineseZodiacData } | { tool: 'get_personal_transits'; data: PersonalTransitsData }
  | { tool: 'explain_astrology'; data: ExplainData };
const PANEL_TOOLS: readonly string[] = ['get_natal_chart', 'get_horoscope_period', 'get_chinese_zodiac', 'get_personal_transits', 'explain_astrology'];

function shownFrom(content: unknown): Shown | { error: string } | null {
  const result = content as { ok?: boolean; tool?: string; data?: unknown; error?: { message?: string } } | undefined;
  if (!result || !result.tool || !PANEL_TOOLS.includes(result.tool)) return null;
  if (!result.ok) return { error: result.error?.message ?? 'That could not be worked out.' };
  return { tool: result.tool, data: result.data } as Shown;
}

function CardFor({ shown }: { shown: Shown }) {
  switch (shown.tool) {
    case 'get_natal_chart': return <NatalChart data={shown.data}/>;
    case 'get_horoscope_period': return <HoroscopePeriod data={shown.data}/>;
    case 'get_chinese_zodiac': return <ChineseZodiac data={shown.data}/>;
    case 'get_personal_transits': return <PersonalTransits data={shown.data}/>;
    default: return <Explainer data={shown.data}/>;
  }
}

function App() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('');
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
        : waiting ? <p role="status" class="quiet">Working out the reading…</p>
        : <><Art panels={[{ src: artOf('milestones-hero') }]}/><p class="quiet">Ask for a birth chart, a monthly or yearly horoscope, the Chinese zodiac, your transits, or what an astrology term means, and the reading appears here.</p></>}
    </div>}
    <PanelFooter>This panel shows what the assistant worked out and saves nothing.</PanelFooter>
  </main>;
}

render(<App/>, document.getElementById('readings')!);
