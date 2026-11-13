import { useEffect, useRef, useState } from 'preact/hooks';
import type { PortableChartCalculation } from '../../lib/engine/portable';
import { weekRequest, type YourWeek } from './week';
import { weekDates, weekLine, weekTitle } from './week-words';
import { WeekCalculator } from './week-client';

/** The person's own chart only; nothing here is saved or shared. */
export function YourWeekSection({ run }: { run: PortableChartCalculation }) {
  const [week, setWeek] = useState<YourWeek | null>(null);
  const [failed, setFailed] = useState(false);
  const calculator = useRef(new WeekCalculator());
  useEffect(() => {
    let current = true;
    setWeek(null); setFailed(false);
    calculator.current.calculate(weekRequest(run, new Date()))
      .then(result => { if (current) setWeek(result); })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; calculator.current.cancel(); };
  }, [run]);
  return <section class="your-week" aria-labelledby="your-week-title" data-state={week ? 'ready' : failed ? 'failed' : 'working'}>
    <h2 id="your-week-title">Your week</h2>
    <p class="lede">Where the moving planets meet your chart in the next seven days, closest first. These are traditional meanings to reflect on, not forecasts.</p>
    {!run.chart.input.timeKnown && <p class="callout">Without a birth time, this leaves out your Moon, rising sign and Midheaven, and the dates are approximate.</p>}
    {week
      ? week.items.length
        ? <ol class="week-list">{week.items.map(item => <li key={`${item.transitBody}-${item.aspect}-${item.natalPoint}-${item.startUtc}`}>
            <h3>{weekTitle(item)}</h3>
            <p class="week-dates">{weekDates(item)}</p>
            <p>{weekLine(item)}</p>
          </li>)}</ol>
        : <p class="week-quiet">No planet comes close to your chart in these seven days.</p>
      : <p class="week-quiet" role="status">{failed ? 'Your week could not be worked out here.' : 'Working out your week…'}</p>}
  </section>;
}
