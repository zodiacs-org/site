import { degreeLabel, HOUSE_THEMES } from './personal';
import { formatEventDate, formatEventTime } from './events';
import { profileChartHandoffFragment } from '../../lib/chart-handoff';
import type { SkyEvent } from './types';

export default function PersonalDetail({ event, timeZone }: { event: SkyEvent; timeZone: string }) {
  const detail = event.personal;
  if (!detail) return null;
  const window = detail.window;
  const when = (at: string) => `${formatEventDate(at, timeZone)} · ${formatEventTime(at, timeZone)}`;
  return <div class="lens-personal-detail" data-testid="lens-personal-detail"><span class="lens-tag lens-event--personal">Personal transit · private</span>
    <p>{window.transitBody}: {degreeLabel(detail.transitLongitude)}<br />Natal {window.natalPoint}: {degreeLabel(detail.natalLongitude)}<br />Angular separation: {Math.abs(((detail.transitLongitude - detail.natalLongitude + 540) % 360) - 180).toFixed(3)}°<br />Deviation from exact: {detail.separation.toFixed(3)}° · {detail.phase} at 12:00 UTC on the selected date<br />Contact orb: {detail.orb}°</p>
    <dl><dt>Window entry</dt><dd>{when(window.startUtc)}{window.startClipped && ' · clipped by scan coverage'}</dd><dt>Model exact contacts</dt><dd>{window.exactTopologyStatus === 'uncertain' ? 'Exact timing / number of passes is uncertain; model instants are withheld.' : window.exactPassesUtc.length ? window.exactPassesUtc.map(at => <div>{when(at)}</div>) : 'No exact crossing in this window.'}</dd><dt>Window exit</dt><dd>{when(window.endUtc)}{window.endClipped && ' · clipped by scan coverage'}</dd><dt>Calculation confidence</dt><dd>Membership {window.membershipStatus}; exact topology {window.exactTopologyStatus}. Angular comparison budget {window.certainty?.angularBudgetDegrees}°. Peak: {window.peak.kind}.</dd></dl>
    <p>Natal target house: {detail.natalHouse ?? 'unavailable'} · transit in natal house: {detail.transitHouse ?? 'unavailable'}.</p>
    {[detail.natalHouse, detail.transitHouse].filter((house, i, values) => house && HOUSE_THEMES[house] && values.indexOf(house) === i).map(house => <p><strong>Traditional {house}th-house theme</strong><br />{HOUSE_THEMES[house!]}. Reflect on your resources and obligations before deciding risk.</p>)}
    {detail.sourceId !== 'session' && <a href={`/birth-chart/#${profileChartHandoffFragment(detail.sourceId)}`}>Inspect your chart →</a>}
  </div>;
}
