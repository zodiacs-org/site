import { useMemo, useState } from 'preact/hooks';
import type { SetupPlan, SkyEvent } from './types';
import { eventDay } from './events';
import { calendarTicks, coversWindow, formatMinute, linkedWindowRatio, relativeLabel, tickLabel, tradeWindow, windowICS, type TradeWindowItem } from './window';

interface Props {
  events: SkyEvent[];
  start: number;
  end: number;
  timeZone: string;
  /** Plain label for the exported calendar entry, e.g. "BTC-USD, 48 h". */
  label: string;
  uidSeed: string;
  startLabel: string;
  linkedWindow?: SetupPlan['window'];
  /** Loaded sky and personal coverage, Unix seconds. */
  coverage?: { start: number; end: number };
  economicCoverage?: { start: string; endExclusive: string };
  onSelect?: (event: SkyEvent) => void;
}

const MAX_BAND_LANES = 4;
const LANE_TOP = 40, LANE = 10;
const KIND_LABEL = { economic: 'Economic', sky: 'Sky', personal: 'Personal' } as const;
const RELEASE_LABEL: Record<string, string> = { cpi: 'CPI', employment: 'Jobs report', 'fomc-decision': 'FOMC', 'fomc-press-conference': 'press conference' };
const shortDate = (ms: number, timeZone: string) => new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(new Date(ms));

function when(item: TradeWindowItem, start: number, end: number, timeZone: string): { lead: string; detail: string } {
  if (item.at !== null) return { lead: relativeLabel(item.at, start), detail: formatMinute(item.at, timeZone) };
  const span = `${shortDate(item.from, timeZone)} to ${shortDate(item.to, timeZone)}`;
  const contacts = item.contacts.length ? `; exact at ${item.contacts.map(contact => relativeLabel(contact.at, start)).join(', ')}` : '';
  if (item.from <= start && item.to >= end) return { lead: '', detail: `${span}${contacts}` };
  if (item.from <= start) return { lead: `Until ${relativeLabel(item.to, start)}`, detail: `${span}${contacts}` };
  return { lead: `From ${relativeLabel(item.from, start)}`, detail: `${span}${item.to > end ? ', continues after' : ''}${contacts}` };
}

export default function WindowStrip({ events, start, end, timeZone, label, uidSeed, startLabel, linkedWindow, coverage, economicCoverage, onSelect }: Props) {
  const [message, setMessage] = useState('');
  const valid = Number.isFinite(start) && Number.isFinite(end) && end > start;
  const items = useMemo(() => valid ? tradeWindow(events, start, end) : [], [events, start, end, valid]);
  const ticks = useMemo(() => valid ? calendarTicks(start, end, timeZone) : { unit: 'day' as const, ticks: [] }, [start, end, timeZone, valid]);
  if (!valid) return <p class="lens-muted" data-testid="trade-window">Enter a whole horizon of at least one hour to see the trade window.</p>;
  const hours = Math.round((end - start) / 3_600_000);
  const position = (ms: number) => Math.min(100, Math.max(0, (ms - start) / (end - start) * 100));
  const instants = items.filter(item => item.at !== null);
  const timed = items.filter(item => !coversWindow(item, start, end));
  const background = items.filter(item => coversWindow(item, start, end));
  const bands = timed.filter(item => item.at === null).slice(0, MAX_BAND_LANES);
  // Label economic releases on the strip; releases close together share one label.
  const releaseLabels: { left: number; text: string }[] = [];
  for (const item of instants.filter(row => row.kind === 'economic')) {
    const left = position(item.at!), text = RELEASE_LABEL[item.event.economic?.kind ?? ''] ?? item.event.title;
    const last = releaseLabels.at(-1);
    if (last && left - last.left < 12) last.text += ` + ${text}`; else releaseLabels.push({ left, text });
  }
  const ratio = linkedWindowRatio(linkedWindow, start, end);
  const notes: string[] = [];
  if (coverage && (start < coverage.start * 1000 || end > coverage.end * 1000)) notes.push(`Sky and personal events are loaded from ${shortDate(coverage.start * 1000, 'UTC')} to ${shortDate(coverage.end * 1000, 'UTC')} (UTC). Parts of this window outside that range show nothing.`);
  if (economicCoverage && (eventDay(start, 'America/New_York') < economicCoverage.start || eventDay(end, 'America/New_York') >= economicCoverage.endExclusive)) notes.push(`The official economic schedule covers ${economicCoverage.start} to ${economicCoverage.endExclusive} (exclusive). Releases outside it are not shown.`);
  function row(item: TradeWindowItem) {
    const text = when(item, start, end, timeZone);
    return <li key={item.event.id}><button type="button" class={`lens-window-row${text.lead ? '' : ' is-background'}`} onClick={() => onSelect?.(item.contacts[0]?.event ?? item.event)}>
      {text.lead && <span class="lens-window-when">{text.lead}</span>}
      <span class="lens-window-what"><strong>{item.event.title}</strong><small>{text.detail}</small></span>
      <span class={`lens-window-kind lens-window-kind--${item.kind}`}>{KIND_LABEL[item.kind]}</span>
    </button></li>;
  }
  function exportWindow() {
    try {
      const url = URL.createObjectURL(new Blob([windowICS(items, start, end, label, uidSeed)], { type: 'text/calendar' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'zodiacs-desk-trade-window.ics'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Calendar file downloaded.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'The calendar file could not be created.'); }
  }
  return <section class="lens-window" aria-label="Trade window" data-testid="trade-window">
    <div class="lens-window-head">
      <div>
        <h3>Trade window</h3>
        <p class="lens-window-span">{startLabel}: {formatMinute(start, timeZone)} to {formatMinute(end, timeZone)} ({hours} h)</p>
      </div>
      <button type="button" class="lens-button lens-button--quiet" onClick={exportWindow} data-testid="trade-window-export">Export window (.ics)</button>
    </div>
    <div class="lens-window-track" aria-hidden="true" style={{ height: `${LANE_TOP + bands.length * LANE + 24}px` }}>
      {ticks.ticks.map(tick => <span key={tick} class={`lens-window-tick${position(tick) > 88 ? ' is-late' : ''}`} style={{ left: `${position(tick)}%` }}><span>{tickLabel(tick, timeZone, ticks.unit)}</span></span>)}
      <span class="lens-window-axis" />
      {instants.map(item => <span key={item.event.id} class={`lens-window-mark lens-window-mark--${item.kind}`} style={{ left: `${position(item.at!)}%` }} title={`${item.event.title}, ${formatMinute(item.at!, timeZone)}`} />)}
      {releaseLabels.map(label => <span key={label.left} class={`lens-window-release${label.left > 70 ? ' is-late' : ''}`} style={{ left: `${label.left}%` }}>{label.text}</span>)}
      {bands.map((item, lane) => {
        const from = Math.max(item.from, start), to = Math.min(item.to, end);
        return <span key={item.event.id} class={`lens-window-band lens-window-band--${item.kind}${item.from < start ? ' is-open-start' : ''}${item.to > end ? ' is-open-end' : ''}`} style={{ left: `${position(from)}%`, width: `${Math.max(0.5, position(to) - position(from))}%`, top: `${LANE_TOP + lane * LANE}px` }} title={item.event.title}>
          {to > from && item.contacts.map(contact => <span key={contact.at} class="lens-window-contact" style={{ left: `${(contact.at - from) / (to - from) * 100}%` }} />)}
        </span>;
      })}
    </div>
    <div class="lens-window-ends" aria-hidden="true"><span>Entry</span><span>Horizon</span></div>
    {timed.length ? <ol class="lens-window-list">{timed.map(row)}</ol> : <p class="lens-muted lens-window-empty">Nothing in your selected layers starts, ends or happens inside this window. That is not an all-clear: check the context layers and coverage.</p>}
    {background.length > 0 && <details class="lens-window-background" data-testid="trade-window-background"><summary>In effect for the whole window ({background.length})</summary><ul class="lens-window-list lens-window-list--background">{background.map(row)}</ul></details>}
    {ratio !== null && ratio >= 10 && <p class="lens-notice" data-testid="trade-window-long-context">The linked {linkedWindow!.kind} window lasts {Math.round(ratio * hours / 24)} days, about {Math.round(ratio)} times this trade. Treat it as background, not as timing for this entry.</p>}
    {notes.map(note => <p key={note} class="lens-muted">{note}</p>)}
    <p class="lens-muted" role="status">{message}</p>
  </section>;
}
