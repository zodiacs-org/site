import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { FeaturesBridge, type PanelToolResult } from './bridge';
import { Art, artOf, Nameplate, PanelFooter } from '../card-kit/parts';
import {
  AstrocartographyCard, GoodDaysCard, NumerologyCard, PersonalDayCard, RetrogradeCard, SolarReturnCard, VedicSignsCard, YearScoreCard,
  type ToolLink,
} from './views';
import type { AstrocartographyData } from '../personal/astrocartography';
import type { VedicSignsData } from '../personal/vedic-signs';
import type { YearScoreData } from '../features/year-score';
import type { SolarReturnData } from '../features/solar-return';
import type { GoodDaysData } from '../features/good-days';
import type { RetrogradeForMeData } from '../personal/retrograde-for-me';
import type { PersonalDayData } from '../personal/personal-day';
import type { NumerologyData } from '../features/numerology';
import './style.css';

type Shown =
  | { tool: 'get_astrocartography'; data: AstrocartographyData; links: ToolLink[] }
  | { tool: 'get_vedic_signs'; data: VedicSignsData; links: ToolLink[] }
  | { tool: 'get_year_score'; data: YearScoreData; links: ToolLink[] }
  | { tool: 'get_solar_return'; data: SolarReturnData; links: ToolLink[] }
  | { tool: 'find_good_days'; data: GoodDaysData; links: ToolLink[] }
  | { tool: 'get_retrograde_for_me'; data: RetrogradeForMeData; links: ToolLink[] }
  | { tool: 'get_personal_day'; data: PersonalDayData; links: ToolLink[] }
  | { tool: 'get_numerology'; data: NumerologyData; links: ToolLink[] };

const PANEL_TOOLS: readonly string[] = [
  'get_astrocartography',
  'get_vedic_signs',
  'get_year_score',
  'get_solar_return',
  'find_good_days',
  'get_retrograde_for_me',
  'get_personal_day',
  'get_numerology',
];

function shownFrom(content: unknown): Shown | { error: string } | null {
  const result = content as { ok?: boolean; tool?: string; data?: unknown; links?: ToolLink[]; error?: { message?: string } } | undefined;
  if (!result || !result.tool || !PANEL_TOOLS.includes(result.tool)) return null;
  if (!result.ok) return { error: result.error?.message ?? 'That could not be worked out.' };
  const links = Array.isArray(result.links) ? result.links : [];
  return { tool: result.tool, data: result.data, links } as Shown;
}

function CardFor({ shown }: { shown: Shown }) {
  switch (shown.tool) {
    case 'get_astrocartography': return <AstrocartographyCard data={shown.data} links={shown.links}/>;
    case 'get_vedic_signs': return <VedicSignsCard data={shown.data} links={shown.links}/>;
    case 'get_year_score': return <YearScoreCard data={shown.data} links={shown.links}/>;
    case 'get_solar_return': return <SolarReturnCard data={shown.data} links={shown.links}/>;
    case 'find_good_days': return <GoodDaysCard data={shown.data} links={shown.links}/>;
    case 'get_retrograde_for_me': return <RetrogradeCard data={shown.data} links={shown.links}/>;
    case 'get_personal_day': return <PersonalDayCard data={shown.data} links={shown.links}/>;
    default: return <NumerologyCard data={shown.data} links={shown.links}/>;
  }
}

function App() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('');
  const [waiting, setWaiting] = useState(true);
  const bridge = useRef<FeaturesBridge | null>(null);

  useEffect(() => {
    const link = new FeaturesBridge((result: PanelToolResult) => {
      const next = shownFrom(result.structuredContent);
      if (!next) return;
      if ('error' in next) { setError(next.error); setShown(null); } else { setShown(next); setRevision((n) => n + 1); setError(''); }
      setWaiting(false);
    }, (value) => { if (value === 'dark' || value === 'light') setTheme(value); });
    bridge.current = link;
    link.connect();
    return () => link.dispose();
  }, []);
  useEffect(() => { const timer = setTimeout(() => setWaiting(false), 1500); return () => clearTimeout(timer); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme || ''; }, [theme]);

  return <main>
    {shown ? <CardFor key={revision} shown={shown}/> : <div class="shell">
      <Nameplate/>
      {error ? <p role="alert" class="notice">{error}</p>
        : waiting ? <p role="status" class="quiet">Working out the reading…</p>
        : <><Art panels={[{ src: artOf('milestones-hero') }]}/><p class="quiet">Ask for astrocartography, Vedic signs, your Year Ahead Score, a solar return, good days, retrogrades, Your Day, or numerology, and the card appears here.</p></>}
    </div>}
    <PanelFooter>This panel shows what the assistant worked out and saves nothing.</PanelFooter>
  </main>;
}

render(<App/>, document.getElementById('features')!);
