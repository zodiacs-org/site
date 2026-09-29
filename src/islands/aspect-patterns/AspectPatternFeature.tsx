import { useEffect, useRef, useState } from 'preact/hooks';
import { createModuleLoader } from '../../lib/module-load';
import type { AspectPatternInput } from '../../lib/aspect-pattern-model';
import type { PatternBody } from '../../lib/engine/aspect-patterns';
import type { ChartImageSource } from '../../lib/chart-image-sky';
import CalculationReload, { calculationError } from '../CalculationReload';
import './styles.css';

type PanelModule = typeof import('./AspectPatternPanel');
const loadPanel = createModuleLoader(() => import('./AspectPatternPanel'));
export interface AspectPatternFeatureProps extends AspectPatternInput {
  onSelectBody: (body: PatternBody) => void;
  /**
   * What a share image of a pattern is drawn from, so it shows no more than
   * the chart's link: a natal chart (drawn as share-card's imageChart), or the
   * two-chart picture's own points and aspects. Absent, the image is the page's.
   */
  imageOf?: ChartImageSource;
  imageSky?: () => Promise<Pick<AspectPatternInput, 'points' | 'aspects'>>;
}

/** Optional pattern code loads only when the completed-result disclosure opens. */
export default function AspectPatternFeature(props: AspectPatternFeatureProps) {
  return <PatternDisclosure key={JSON.stringify([props.context, props.sourceKey, props.timeKnown, props.points, props.aspects])} {...props} />;
}
function PatternDisclosure(props: AspectPatternFeatureProps) {
  const mounted = useRef(true), loading = useRef(false);
  const [module, setModule] = useState<PanelModule | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function load() {
    if (!mounted.current || loading.current || module) return;
    loading.current = true; setBusy(true); setError('');
    try {
      const next = await loadPanel();
      if (mounted.current) setModule(next);
    } catch (cause) {
      if (mounted.current) setError(calculationError(cause, 'en', 'Aspect patterns could not load. Your chart is still available. Try again.'));
    } finally { if (mounted.current) { loading.current = false; setBusy(false); } }
  }
  const Panel = module?.default;
  return <details class="apat" data-aspect-patterns data-pattern-context={props.context} onToggle={(event) => { if (event.currentTarget.open) void load(); }}>
    <summary>Aspect patterns</summary>
    {Panel ? <Panel {...props} /> : <div class="apat__content">
      <p role="status">{busy ? 'Finding patterns in the complete aspect graph…' : error ? '' : 'Open to inspect linked groups of three or four planets.'}</p>
      {error && <><p role="alert">{error}</p><button class="btn btn--glass" type="button" onClick={load} data-pattern-retry>Try again</button><CalculationReload error={error} locale="en" /></>}
    </div>}
  </details>;
}
