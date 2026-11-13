import { useMemo, useState } from 'preact/hooks';
import { markPrimarySelfChart } from '../../lib/profile/store';
import { runAfterProfileAccess } from '../../lib/account-v2/profile-access-request';
import { t } from '../../lib/i18n';
import type { SavedChart } from '../../lib/profile/schema';

interface Props {
  charts: SavedChart[];
}

function validCharts(charts: SavedChart[]): SavedChart[] {
  return charts.filter((chart) => (
    chart && typeof chart.id === 'string' && typeof chart.name === 'string'
    && Array.isArray(chart.summary?.bodies)
    && chart.summary.bodies.some((body) => Number.isFinite(body?.lon))
  ));
}

export default function LivingSelfChartChooser({ charts }: Props) {
  const choices = useMemo(() => validCharts(charts), [charts]);
  const [selected, setSelected] = useState(choices[0]?.id ?? '');
  const [message, setMessage] = useState('');

  if (choices.length === 0) return null;

  const choose = () => {
    if (!selected) {
      setMessage('That chart could not be selected. Try again.');
      return;
    }
    const chartId = selected;
    runAfterProfileAccess(() => {
      if (!markPrimarySelfChart(chartId)) {
        setMessage('That chart could not be selected. Try again.');
        return;
      }
      setMessage('Opening your personal forecast…');
    }, () => setMessage(t('en', 'profileSaveUnavailable')));
  };

  return (
    <section class="living-self-chart" data-living-self-chart aria-labelledby="living-self-chart-heading">
      <div>
        <h2 id="living-self-chart-heading">Which chart is yours?</h2>
        <p>Living Chart uses only your own birth chart. Other saved charts stay separate.</p>
      </div>
      {choices.length > 1 && (
        <label>
          <span class="living-moment-composer__label">My chart</span>
          <select class="field__input" value={selected} onChange={(event) => setSelected((event.currentTarget as HTMLSelectElement).value)}>
            {choices.map((chart) => <option value={chart.id} key={chart.id}>{chart.name}</option>)}
          </select>
        </label>
      )}
      <button class="btn btn--primary" type="button" onClick={choose}>
        <span>{choices.length === 1 ? `Use ${choices[0]!.name}` : 'Use this as my chart'}</span>
        <span class="orb" aria-hidden="true">→</span>
      </button>
      {message && <p class="living-chart__status" role="status">{message}</p>}
    </section>
  );
}

export function LivingSelfChartPlaceholder() {
  return (
    <section class="living-self-chart living-self-chart--placeholder" aria-hidden="true">
      <div>
        <h2>Which chart is yours?</h2>
        <p>Choose your own birth chart to open a personal forecast.</p>
      </div>
      <span class="btn btn--primary"><span>Use this as my chart</span><span class="orb" aria-hidden="true">→</span></span>
    </section>
  );
}
