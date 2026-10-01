import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SkyEvent } from './types';
import { eventDay, formatEventDate, formatEventTime } from './events';

interface Props { events: SkyEvent[]; timeZone: string; selectedDate: string; onDate: (day: string) => void; onSelect: (event: SkyEvent) => void }
const addDays = (day: string, delta: number) => new Date(Date.parse(`${day}T12:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);

export default function CalendarPanel({ events, timeZone, selectedDate, onDate, onSelect }: Props) {
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
    for (const event of events) { const day = eventDay(event.at, timeZone); map.set(day, [...(map.get(day) ?? []), event]); }
    return map;
  }, [events, timeZone]);
  const agenda = events.filter((e) => eventDay(e.at, timeZone).startsWith(month));
  const navigate = (delta: number) => {
    if (view === 'month' || view === 'agenda') {
      const date = new Date(`${first}T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + delta); onDate(date.toISOString().slice(0, 10));
    } else onDate(addDays(selectedDate, delta * (view === 'week' ? 7 : 1)));
  };
  return <section class="lens-panel" aria-labelledby="lens-calendar-title">
    <div class="lens-section-head"><div><h2 id="lens-calendar-title">Sky calendar</h2><p class="lens-muted">Exact event times in {timeZone}. All views use the same active filters.</p></div>
      <div class="lens-inline"><button class="lens-button" aria-label="Previous calendar period" onClick={() => navigate(-1)}>←</button><input aria-label="Calendar date" type="date" value={selectedDate} onChange={(e) => onDate(e.currentTarget.value || selectedDate)} /><button class="lens-button" aria-label="Next calendar period" onClick={() => navigate(1)}>→</button></div></div>
    <div class="lens-segments" aria-label="Calendar view">{(['month', 'week', 'day', 'agenda'] as const).map((v) => <button aria-pressed={view === v} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div>
    {view === 'agenda' ? <div class="lens-list">{agenda.map((event) => <button class="lens-event-row" onClick={() => onSelect(event)}><span>{formatEventDate(event.at, timeZone)}<br />{formatEventTime(event.at, timeZone)}</span><strong>{event.title}</strong><span class="lens-tag">{event.family}</span></button>)}{!agenda.length && <p class="lens-muted">No supported events in this month with the current filters. Check the stated coverage.</p>}</div>
      : <div class={`lens-calendar lens-calendar--${view}`} role="group" aria-label={`${view} event calendar`}>
        {view === 'month' && ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div class="lens-weekday">{d}</div>)}
        {days.map((day) => <div class={`lens-calendar-day ${day === selectedDate ? 'is-selected' : ''} ${!day.startsWith(month) ? 'is-other-month' : ''}`}>
          <button class="lens-day-number" aria-label={`Select ${day}, ${(grouped.get(day) ?? []).length} events`} onClick={() => onDate(day)}>{view === 'month' ? Number(day.slice(-2)) : day}<span class="lens-day-count">{grouped.get(day)?.length ? `${grouped.get(day)!.length} events` : ''}</span></button>
          {(grouped.get(day) ?? []).map((event) => <button class={`lens-calendar-event lens-event--${event.family}`} onClick={() => { onDate(day); onSelect(event); }} title={formatEventTime(event.at, timeZone)}>{event.title}</button>)}
        </div>)}
      </div>}
    {view === 'month' && <div class="lens-mobile-day-list"><h3>Events on {selectedDate}</h3>{(grouped.get(selectedDate) ?? []).map((event) => <button class="lens-event-row" onClick={() => onSelect(event)}><span>{formatEventTime(event, timeZone)}</span><strong>{event.title}</strong></button>)}{!grouped.get(selectedDate)?.length && <p class="lens-muted">No supported events on this day with the current filters.</p>}</div>}
  </section>;
}
