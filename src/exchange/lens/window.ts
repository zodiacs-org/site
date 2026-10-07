import type { SetupPlan, SkyEvent } from './types';
import { eventVEVENT, foldICSLine, icsDate, icsText } from './events';
import { localInstant } from './sessions';

export type WindowItemKind = 'economic' | 'personal' | 'sky';
export interface TradeWindowItem {
  /** The event shown for this row; a personal row stands for its whole transit window. */
  event: SkyEvent;
  kind: WindowItemKind;
  /** Instant of an exact event, or null for a row shown by its span. */
  at: number | null;
  /** Span of the row. Equal to `at` for instants. */
  from: number;
  to: number;
  /** Exact personal contacts that fall inside the trade window. */
  contacts: { at: number; event: SkyEvent }[];
}

export const kindOf = (event: SkyEvent): WindowItemKind => event.economic ? 'economic' : event.personal ? 'personal' : 'sky';

/**
 * Everything in the given events that touches [start, end]: instants inside the
 * window and spans (personal windows, retrograde periods) that overlap it.
 * Personal contacts that share one transit window become one row.
 */
export function tradeWindow(events: SkyEvent[], start: number, end: number): TradeWindowItem[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const rows = new Map<string, TradeWindowItem>();
  for (const event of events) {
    const at = Date.parse(event.at);
    if (!Number.isFinite(at)) continue;
    const kind = kindOf(event);
    if (event.personal) {
      const window = event.personal.window;
      const from = Date.parse(window.startUtc), to = Date.parse(window.endUtc);
      if (!(from <= end && to >= start)) continue;
      const key = `personal:${event.personal.sourceId}:${window.id}`;
      const row = rows.get(key) ?? { event, kind, at: null, from, to, contacts: [] };
      const exact = window.exactTopologyStatus === 'resolved' && window.exactPassesUtc.includes(event.at);
      if (exact && at >= start && at <= end && !row.contacts.some(contact => contact.at === at)) row.contacts.push({ at, event });
      rows.set(key, row);
      continue;
    }
    const to = event.end ? Date.parse(event.end) : at;
    if (!(at <= end && to >= start)) continue;
    rows.set(event.id, { event, kind, at: event.end ? null : at, from: at, to, contacts: [] });
  }
  const order: Record<WindowItemKind, number> = { economic: 0, sky: 1, personal: 2 };
  return [...rows.values()].map(row => ({ ...row, contacts: row.contacts.sort((a, b) => a.at - b.at) }))
    .sort((a, b) => Math.max(a.from, start) - Math.max(b.from, start) || order[a.kind] - order[b.kind] || a.event.title.localeCompare(b.event.title));
}

/** How many times longer a linked context window is than the trade window. */
export function linkedWindowRatio(window: SetupPlan['window'] | undefined, start: number, end: number): number | null {
  if (!window || end <= start) return null;
  const span = Date.parse(window.to) - Date.parse(window.from);
  return Number.isFinite(span) && span > 0 ? span / (end - start) : null;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let value = formatters.get(key);
  if (!value) { value = new Intl.DateTimeFormat('en-US', { timeZone, ...options }); formatters.set(key, value); }
  return value;
}
const DATE_PARTS: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
const localDate = (ms: number, timeZone: string): string => {
  const p = Object.fromEntries(formatter(timeZone, DATE_PARTS).formatToParts(new Date(ms)).map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
};

/** Minute precision for planning, e.g. "Tue, Oct 14, 19:30 GMT+7". */
export function formatMinute(ms: number, timeZone: string): string {
  return formatter(timeZone, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' }).format(new Date(ms));
}
/** Short tick label, e.g. "Tue 14" or "Nov". */
export function tickLabel(ms: number, timeZone: string, unit: 'day' | 'month'): string {
  if (unit === 'month') return formatter(timeZone, { month: 'short' }).format(new Date(ms));
  const p = Object.fromEntries(formatter(timeZone, { weekday: 'short', day: 'numeric' }).formatToParts(new Date(ms)).map(part => [part.type, part.value]));
  return `${p.weekday} ${p.day}`;
}

/** Spans that cover the whole trade window are background rather than timing. */
export const coversWindow = (item: TradeWindowItem, start: number, end: number): boolean => item.at === null && item.from <= start && item.to >= end;

/**
 * Resolve a datetime-local value typed in the display zone with the Desk's
 * session-time helper. A planned entry is a present-day market time, so the
 * zone's current rules apply; a time skipped by a clock change is refused,
 * and a repeated one resolves to its earlier instant.
 */
export function plannedEntry(value: string, timeZone: string): { at?: string; note?: string; error?: string } {
  if (!value) return {};
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value.slice(0, 16));
  let at: number;
  try { if (!match) throw new Error('format'); at = localInstant(match[1], Number(match[2]), Number(match[3]), timeZone) * 1000; }
  catch (reason) { return { error: match && reason instanceof Error && reason.message.startsWith('Ambiguous or nonexistent') ? 'That local time is skipped by a clock change in this zone. Choose another time.' : 'Enter the planned entry as a date and time.' }; }
  const wall = value.slice(0, 16);
  for (const shift of [3_600_000, 1_800_000]) if (wallTimeInput(at - shift, timeZone) === wall) { at -= shift; break; }
  const repeated = [3_600_000, 1_800_000].some(shift => wallTimeInput(at + shift, timeZone) === wall);
  return { at: new Date(at).toISOString(), ...(repeated ? { note: 'That local time happens twice because of a clock change; the plan uses the earlier one.' } : {}) };
}

/** Wall-clock value for an <input type="datetime-local"> in the display zone. */
export function wallTimeInput(ms: number, timeZone: string): string {
  const p = Object.fromEntries(formatter(timeZone, { ...DATE_PARTS, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * Local calendar boundaries in the display zone strictly inside (start, end):
 * midnights for windows up to 16 days, otherwise the first of each month.
 * Found by sampling and narrowing to the minute, so DST and fractional
 * offsets come from Intl rather than hand-computed offsets.
 */
export function calendarTicks(start: number, end: number, timeZone: string): { unit: 'day' | 'month'; ticks: number[] } {
  const unit = end - start <= 16 * 86_400_000 ? 'day' : 'month';
  const ticks: number[] = [];
  if (!(end > start)) return { unit, ticks };
  const key = (ms: number) => unit === 'day' ? localDate(ms, timeZone) : localDate(ms, timeZone).slice(0, 7);
  const step = 3_600_000 * Math.max(1, Math.ceil((end - start) / 3_600_000 / 3000));
  let probe = start, current = key(start);
  while (probe < end && ticks.length < 400) {
    const next = Math.min(probe + step, end);
    const nextKey = key(next);
    if (nextKey !== current) {
      let low = probe, high = next;
      while (high - low > 60_000) {
        const mid = low + Math.max(60_000, Math.floor((high - low) / 120_000) * 60_000);
        if (mid >= high) break;
        if (key(mid) === current) low = mid; else high = mid;
      }
      if (high > start && high < end) ticks.push(high);
      current = nextKey;
    }
    if (next === end) break;
    probe = next;
  }
  return { unit, ticks };
}

/** Offset from the window start: "+31 h", "+2 d 4 h". */
export function relativeLabel(ms: number, start: number): string {
  const hours = Math.round((ms - start) / 3_600_000);
  if (hours < 48) return `+${Math.max(0, hours)} h`;
  const days = Math.floor(hours / 24), rest = hours % 24;
  return `+${days} d${rest ? ` ${rest} h` : ''}`;
}

/**
 * One calendar file with the trade window itself plus every exact event inside
 * it. The trade window entry carries no plan text: calendars often sync elsewhere.
 */
export function windowICS(items: TradeWindowItem[], start: number, end: number, label: string, uidSeed: string, generatedAt: Date = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Zodiacs//Zodiacs Desk//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${encodeURIComponent(`trade-window:${uidSeed}`)}@zodiacs.org`, `DTSTAMP:${icsDate(generatedAt)}`, `DTSTART:${icsDate(new Date(start))}`, `DTEND:${icsDate(new Date(end))}`,
    `SUMMARY:${icsText(`Trade window: ${label}`)}`, `DESCRIPTION:${icsText('Planned entry to the end of the horizon, from Zodiacs Desk. Plan details stay on your device.')}`, 'TRANSP:TRANSPARENT', 'END:VEVENT'];
  const seen = new Set<string>();
  for (const item of items) {
    const exact = item.kind === 'personal' ? item.contacts.map(contact => contact.event) : item.at === null ? [] : [item.event];
    for (const event of exact) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      lines.push(...eventVEVENT(event, generatedAt));
    }
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldICSLine).join('\r\n')}\r\n`;
}
