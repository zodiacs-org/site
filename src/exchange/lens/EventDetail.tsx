import type { SkyEvent } from './types';
import { eventICS, formatEventDate, formatEventTime } from './events';
import EconomicDetail from './EconomicDetail';
import PersonalDetail from './PersonalDetail';

type View = 'setup' | 'journal' | 'history';
interface Props { event: SkyEvent | null; timeZone: string; onView: (view: View) => void }

function downloadICS(event: SkyEvent) {
  const url = URL.createObjectURL(new Blob([eventICS(event)], { type: 'text/calendar' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${event.id}.ics`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Facts, interpretation and next steps for the selected event. Loaded after the shell. */
export default function EventDetail({ event, timeZone, onView }: Props) {
  if (!event) return <><h2 id="lens-event-detail-title">Select a sky event</h2><p class="lens-muted">Choose a marker, upcoming event or calendar entry to see its facts and interpretation.</p></>;
  if (event.economic) return <><EconomicDetail event={event.economic} timeZone={timeZone} /><div class="lens-inline"><button class="lens-button" onClick={() => downloadICS(event)}>Add to calendar</button><button class="lens-button" onClick={() => onView('journal')}>Record hypothesis</button></div></>;
  return <>
    <span class={`lens-tag lens-event--${event.family}`}>{event.family}</span><h2 id="lens-event-detail-title">{event.title}</h2>
    <p class="lens-event-instant">{formatEventDate(event, timeZone)}<br />{formatEventTime(event, timeZone)}</p>
    {event.personal && <PersonalDetail event={event} timeZone={timeZone} />}
    <dl><dt>Calculated fact</dt><dd>{event.bodies.join(' · ')}{event.aspectType ? ` · ${event.aspectType}` : ''}{event.sign ? ` · ${event.sign}` : ''}<br /><span class="lens-muted">UTC {event.at}</span>{event.end && <><br />Ends {formatEventDate(event.end, timeZone)} · {formatEventTime(event.end, timeZone)}</>}</dd>
      <dt>Traditional interpretation</dt><dd>{event.interpretation}</dd><dt>Market observation</dt><dd>Inspect the selected asset and previous occurrences. This interpretation does not establish a price direction.</dd><dt>Trader hypothesis / plan</dt><dd>Write your technical confirmation, invalidation and risk before the outcome. Link this window in the setup planner or journal.</dd></dl>
    <div class="lens-inline"><button class="lens-button" onClick={() => downloadICS(event)}>Add to calendar</button><button class="lens-button" onClick={() => onView('setup')}>Plan setup &amp; risk</button><button class="lens-button lens-button--primary" onClick={() => onView('journal')}>Record hypothesis</button><button class="lens-button lens-button--quiet" onClick={() => onView('history')}>Explore history →</button></div>
    <details class="lens-method"><summary>Source &amp; calculation</summary><p>{event.provenance.catalog}<br />{event.provenance.convention}<br />Engine {event.provenance.engineVersion}</p>{event.provenance.sha256 && <p class="lens-hash">SHA-256 {event.provenance.sha256}</p>}</details>
  </>;
}
