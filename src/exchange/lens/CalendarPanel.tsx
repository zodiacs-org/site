import { useEffect, useMemo, useState } from 'preact/hooks';
import { outlookLabel, type OutlookDay } from './outlook';
import type { SkyEvent } from './types';
import { eventDay, formatEventDate, formatEventTime } from './events';

interface Props { outlook?: OutlookDay[]; events: SkyEvent[]; timeZone: string; selectedDate: string; onDate: (day: string) => void; onSelect: (event: SkyEvent) => void }
const addDays = (day: string, delta: number) => new Date(Date.parse(`${day}T12:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);
const aspectGlyphs: Record<string, string> = { conjunction: '☌', sextile: '⚹', square: '□', trine: '△', opposition: '☍' };
const compactTitle = (event: SkyEvent) => event.personal ? `${event.personal.window.transitBody} ${aspectGlyphs[event.personal.window.aspect]} ${event.personal.window.natalPoint}` : event.economic ? ({ cpi: 'US CPI', employment: 'US employment', 'fomc-decision': 'FOMC decision', 'fomc-press-conference': 'FOMC conference' })[event.economic.kind] : event.title;

export default function CalendarPanel({ outlook, events, timeZone, selectedDate, onDate, onSelect }: Props) {
  const [view, setView] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  useEffect(() => { if (window.matchMedia('(max-width: 700px)').matches) setView('agenda'); }, []);
  const month = selectedDate.slice(0, 7);
  const first = `${month}-01`;
  const days = useMemo(() => {
    if (view === 'day') return [selectedDate];
    if (view === 'week') return Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i));
    const date = new Date(`${first}T12:00:00Z`);
    const offset = (date.getUTCDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => addDays(first, i - offset));
  }, [month, selectedDate, view]);
  const grouped = useMemo(() => {
    const map = new Map<string, SkyEvent[]>();
    for (const event of events) {
      const eventDays = event.personal ? days.filter(day => day >= eventDay(event.personal!.window.startUtc, timeZone) && day <= eventDay(event.personal!.window.endUtc, timeZone)) : [eventDay(event.at, timeZone)];
      for (const day of eventDays) { const rows = map.get(day) ?? []; if (!rows.some(row => row.personal && event.personal && row.personal.window.id === event.personal.window.id)) map.set(day, [...rows, event]); }
    }
    for (const [day, rows] of map) {
      const rank = (event: SkyEvent) => !event.personal ? 0 : eventDay(event.at, timeZone) === day ? 1 : 2;
      rows.sort((a, b) => rank(a) - rank(b) || a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    }
    return map;
  }, [events, timeZone, days]);
  const agenda = events.filter(e => e.personal ? eventDay(e.personal.window.startUtc, timeZone) <= `${month}-31` && eventDay(e.personal.window.endUtc, timeZone) >= first : eventDay(e.at, timeZone).startsWith(month));
  const navigate = (delta: number) => {
    if (view === 'month' || view === 'agenda') {
      const date = new Date(`${first}T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + delta); onDate(date.toISOString().slice(0, 10));
    } else onDate(addDays(selectedDate, delta * (view === 'week' ? 7 : 1)));
  };
  return <section class="lens-panel" aria-labelledby="lens-calendar-title">
    <div class="lens-section-head"><div><h2 id="lens-calendar-title">My Astro Calendar</h2><p class="lens-muted">Shared sky and private personal contacts in {timeZone}. All views use the same active filters.</p></div>
      <div class="lens-inline"><button class="lens-button" aria-label="Previous calendar period" onClick={() => navigate(-1)}>←</button><input aria-label="Calendar date" type="date" value={selectedDate} onChange={(e) => onDate(e.currentTarget.value || selectedDate)} /><button class="lens-button" aria-label="Next calendar period" onClick={() => navigate(1)}>→</button></div></div>
    <div class="lens-segments" aria-label="Calendar view">{(['month', 'week', 'day', 'agenda'] as const).map((v) => <button aria-pressed={view === v} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div>
    {view === 'agenda' ? <div class="lens-list">{agenda.map((event) => <button class="lens-event-row" onClick={() => onSelect(event)}><span>{formatEventDate(event.at, timeZone)}<br />{formatEventTime(event.at, timeZone)}</span><strong>{event.title}</strong><span class="lens-tag">{event.economic ? 'economic' : event.personal ? 'personal' : 'shared'}</span></button>)}{!agenda.length && <p class="lens-muted">No supported events in this month with the current filters. Check the stated coverage.</p>}</div>
      : <div class={`lens-calendar lens-calendar--${view}`} role="group" aria-label={`${view} event calendar`}>
        {view === 'month' && ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div class="lens-weekday">{d}</div>)}
        {days.map((day) => <div class={`lens-calendar-day ${day === selectedDate ? 'is-selected' : ''} ${!day.startsWith(month) ? 'is-other-month' : ''}`}>
          <button class="lens-day-number" aria-label={`Select ${day}, ${(grouped.get(day) ?? []).length} events`} onClick={() => onDate(day)}>{view === 'month' ? Number(day.slice(-2)) : day}{outlook?.find(row => row.date === day) && <span class={`lens-outlook--${outlookLabel(outlook.find(row => row.date === day)!.score)}`}>{outlook.find(row => row.date === day)!.score} astrology</span>}<span class="lens-day-count">{grouped.get(day)?.length ? `${grouped.get(day)!.length} events` : ''}</span></button>
          {(view === 'day' ? grouped.get(day) ?? [] : (grouped.get(day) ?? []).slice(0, 3)).map((event) => <button class={`lens-calendar-event lens-event--${event.economic ? 'economic' : event.personal ? 'personal' : event.family}`} onClick={() => { onDate(day); onSelect(event); }} aria-label={`${event.personal ? 'Personal transit' : event.economic ? 'Economic event' : 'Shared sky event'}: ${event.title}`} title={`${event.title} · ${formatEventTime(event.at, timeZone)}`}>{view === 'day' ? event.title : compactTitle(event)}{event.personal && eventDay(event.at, timeZone) !== day ? ' · in window' : ''}</button>)}
          {view !== 'day' && (grouped.get(day)?.length ?? 0) > 3 && <button class="lens-calendar-more" aria-label={`View all ${grouped.get(day)!.length} events on ${day}`} onClick={() => { onDate(day); setView('day'); }}>+{grouped.get(day)!.length - 3} more</button>}
        </div>)}
      </div>}
    {view === 'month' && <div class="lens-mobile-day-list"><h3>Events on {selectedDate}</h3>{(grouped.get(selectedDate) ?? []).map((event) => <button class="lens-event-row" onClick={() => onSelect(event)}><span>{formatEventTime(event, timeZone)}</span><strong>{event.title}</strong></button>)}{!grouped.get(selectedDate)?.length && <p class="lens-muted">No supported events on this day with the current filters.</p>}</div>}
  </section>;
}
