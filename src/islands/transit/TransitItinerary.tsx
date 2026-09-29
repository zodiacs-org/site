import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { NatalTransitChart } from '../../lib/engine/transit-scan-core';
import type { TransitWindow } from '../../lib/engine/transit-window-core';
import type { ItineraryRequest, ItineraryResponse } from './TransitItinerary.worker';
import { calendarTransitWindows, serializeTransitWindows } from '../../lib/transit-window-ical';
import { downloadCalendarFile } from '../../lib/ical-download';
import { transitLine } from '../../lib/transits';
import '../../styles/transit-itinerary.css';

const DAY = 86_400_000;
const EARLIEST = Date.parse('1800-01-01T00:00:00.000Z');
const LATEST = Date.parse('2200-01-01T00:00:00.000Z') - 1;
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const date = (value: string | number) => dateFormat.format(new Date(value));
const pointName = (point: string) => point === 'ASC' ? 'rising sign' : point === 'MC' ? 'Midheaven' : point;

function Period({ window }: { window: TransitWindow }) {
  const uncertain = window.exactTopologyStatus === 'uncertain' || window.peak.kind === 'uncertain';
  return <article class="itinerary__period" data-itinerary-period>
    <h4>{window.transitBody} {window.aspect} your {pointName(window.natalPoint)}</h4>
    <p>{transitLine(window.transitBody, window.aspect, window.natalPoint)}</p>
    <dl class="itinerary__dates">
      <div><dt>{window.startClipped ? 'Already active by' : 'Period begins'}</dt><dd><time dateTime={window.startUtc}>{date(window.startUtc)}</time></dd></div>
      <div><dt>{window.endClipped ? 'Active through at least' : 'Period ends'}</dt><dd><time dateTime={window.endUtc}>{date(window.endUtc)}</time></dd></div>
    </dl>
    {window.membershipStatus === 'uncertain' && <p class="field__help">The period boundary is uncertain. This item is excluded from calendar export.</p>}
    {window.boundaryTouch ? <p class="field__help">A brief boundary touch, without a sustained period in orb.</p>
      : uncertain ? <p class="itinerary__peak">Close alignment over this period. Exact timing is uncertain.</p>
        : window.peak.kind === 'closest-approach' && window.peak.atUtc
          ? <p class="itinerary__peak">Closest approach: {date(window.peak.atUtc)}. It does not become exact in this period.</p>
          : window.peak.kind === 'non-unique'
            ? <p class="itinerary__peak">Several equally close approaches occur in this period; there is no single peak.</p>
          : window.peak.kind === 'plateau'
            ? <p class="itinerary__peak">Closest alignment spans a period rather than one peak.</p>
            : window.exactPassesUtc.length
              ? <p class="itinerary__peak">Estimated exact {window.exactPassesUtc.length === 1 ? 'alignment' : 'passes'}: {window.exactPassesUtc.map(date).join(' · ')}</p>
              : <p class="field__help">No verified peak falls within this searched portion.</p>}
  </article>;
}

const CALENDAR_NOTE = 'The times in the file come from your exact chart, so anyone you share it with, or any online calendar you import it into, can work out your birth time from them, and your birthplace from those for your Ascendant or Midheaven.';
const CALENDAR_NOTE_NO_TIME = 'Without a birth time, the times in the file come from your chart for noon at your birthplace, so anyone you share it with, or any online calendar you import it into, can work out your birth date from them, and the time zone of your birthplace or, before standard time, its longitude.';

/**
 * `timeKnown` says whether the itinerary may use the Moon and angles; a chart
 * whose birth time falls in a clock change has a birth time but not that.
 * `birthTimeKnown` says whether the chart has a birth time at all: without
 * one it is noon at the birthplace, which the calendar note names.
 */
export function TransitItinerary({ natal, timeKnown, anchorMs, birthTimeKnown = timeKnown }: {
  natal: NatalTransitChart; timeKnown: boolean; anchorMs: number; birthTimeKnown?: boolean;
}) {
  const [windows, setWindows] = useState<TransitWindow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    workerRef.current?.terminate(); workerRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };
  useEffect(() => { cancel(); setWindows(null); setBusy(false); setStatus(''); setError('');
    return cancel;
  }, [natal, timeKnown, anchorMs]);

  function build() {
    cancel(); setError(''); setWindows(null); setBusy(true); setShowAll(false);
    setStatus('Preparing your transit periods…');
    try {
      const worker = new Worker(new URL('./TransitItinerary.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      const fail = (message: string) => { if (workerRef.current !== worker) return;
        cancel(); setBusy(false); setStatus(''); setError(message); };
      timeoutRef.current = setTimeout(() => fail('This calculation took too long. Try building the itinerary again.'), 45_000);
      worker.onerror = () => fail('The itinerary could not load or finish. Try again.');
      worker.onmessage = ({ data }: MessageEvent<ItineraryResponse>) => {
        if (workerRef.current !== worker) return;
        if (data.type === 'progress') { setStatus(`Calculating ${data.body} periods…`); return; }
        if (data.type === 'error') { fail(data.message); return; }
        cancel(); setBusy(false); setStatus('Your itinerary is ready.');
        setWindows(data.windows.filter((window) => timeKnown || !['Moon', 'ASC', 'MC'].includes(window.natalPoint)));
      };
      const request: ItineraryRequest = { natal, timeKnown,
        fromUtc: new Date(Math.max(EARLIEST, anchorMs - 365 * DAY)).toISOString(),
        toUtc: new Date(Math.min(LATEST, anchorMs + 365 * DAY)).toISOString() };
      worker.postMessage(request);
    } catch { cancel(); setBusy(false); setStatus(''); setError('The itinerary could not start. Try again.'); }
  }
  const sorted = useMemo(() => [...(windows ?? [])].sort((a, b) => a.startUtc.localeCompare(b.startUtc) || a.id.localeCompare(b.id)), [windows]);
  const active = sorted.filter((window) => Date.parse(window.startUtc) <= anchorMs && Date.parse(window.endUtc) >= anchorMs);
  const future = sorted.filter((window) => Date.parse(window.startUtc) > anchorMs);
  const earlier = sorted.filter((window) => Date.parse(window.endUtc) < anchorMs);
  const upcoming = showAll ? future.slice(1) : future.slice(1, 7);
  const exportable = calendarTransitWindows([...active, ...future], timeKnown);
  const today = new Date(anchorMs).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  function download() {
    try { downloadCalendarFile(serializeTransitWindows(exportable, { generatedAt: new Date(), timeKnown }), 'zodiacs-transit-itinerary.ics'); }
    catch { setError('The calendar could not be prepared. Your itinerary is still available.'); }
  }
  return <section class="itinerary" aria-label="Your transit itinerary" data-transit-itinerary>
    <p>A clear view of the longer periods around {date(anchorMs)}: what is active, what comes next, and when it eases.</p>
    <p class="field__help">Jupiter through Pluto · five major aspects · 3° orb · one year either side. Dates are approximate, in UTC. These are traditional interpretations for reflection, not predictions.</p>
    {!timeKnown && <p class="notice">These are reference targets. Moon, rising sign and Midheaven require complete, confirmed birth details and are excluded from this itinerary and its calendar.</p>}
    <div class="itinerary__actions">
      <button type="button" class="btn btn--primary" disabled={busy} onClick={build}>{busy ? 'Building…' : windows ? 'Rebuild itinerary' : 'Build my itinerary'}</button>
      {busy && <button type="button" class="btn" onClick={() => { cancel(); setBusy(false); setStatus('Calculation cancelled.'); }}>Cancel</button>}
      {!!exportable.length && <button type="button" class="btn" onClick={download}>Calendar for {exportable.length} periods</button>}
    </div>
    {!!exportable.length && <p class="field__help" data-itinerary-calendar-note>{birthTimeKnown ? CALENDAR_NOTE : CALENDAR_NOTE_NO_TIME}</p>}
    <p role="status" aria-live="polite">{status}</p>
    {error && <p class="calc__error" role="alert">{error}</p>}
    {windows && <>
      <section aria-label="Active periods"><h3>{today ? 'Now' : `Active on ${date(anchorMs)}`}</h3>
        {active.length ? active.map((window) => <Period key={window.id} window={window} />) : <p>No slow-planet periods are active on this date.</p>}</section>
      <section aria-label="Next period"><h3>Next</h3>
        {future[0] ? <Period window={future[0]} /> : <p>No new period begins within this searched year.</p>}</section>
      {!!upcoming.length && <section aria-label="Upcoming periods"><h3>Upcoming</h3>
        {upcoming.map((window) => <Period key={window.id} window={window} />)}
        {!showAll && future.length > 7 && <button type="button" class="btn" onClick={() => setShowAll(true)}>Show {future.length - 7} more periods</button>}</section>}
      {!!earlier.length && <details><summary>Earlier in this range ({earlier.length})</summary>{earlier.map((window) => <Period key={window.id} window={window} />)}</details>}
      <p class="field__help">Calendar files contain these periods only. Your name, birth details and saved-chart identifiers are omitted. Clipped periods say when entry or exit falls outside the searched range.</p>
    </>}
  </section>;
}
