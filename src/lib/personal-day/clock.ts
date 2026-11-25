/**
 * Dates and clock times on a zone's clock, for the personal day: plain Intl,
 * no engine, so the /your-day/ page can show its default day before the
 * calculation loads.
 */
const DAY = 86_400_000;

/** The calendar date of an instant on a zone's clock, as YYYY-MM-DD. */
export function dateOn(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** "Tue 3 Nov 2026" on a zone's clock. */
export function dayLabel(at: Date | string, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(new Date(at)).map((part) => [part.type, part.value]));
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
}

const HOUR = 3_600_000;

/**
 * The zone's offset from UTC at an instant, in seconds east, from Intl's "GMT-04:00" ("GMT" at zero). The formatter
 * is made for one clock time and dropped with it: the zone can be a birthplace's (the MCP falls back to the birth
 * clock), so nothing here keeps a zone past the call that was given it.
 */
function offsetSeconds(at: Date, format: Intl.DateTimeFormat): number {
  const name = format.formatToParts(at).find((part) => part.type === 'timeZoneName')!.value;
  const match = /^GMT(?:([+-])(\d{2}):(\d{2})(?::(\d{2}))?)?$/u.exec(name);
  if (!match) throw new RangeError(`Unexpected time zone offset: ${name}`);
  if (!match[1]) return 0;
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4] ?? 0));
}

/** "UTC-4", "UTC+5:30", "UTC+0", as the world clocks write an offset (src/world-times/world-times.ts). */
function offsetLabel(seconds: number): string {
  const minutes = Math.round(Math.abs(seconds) / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `UTC${seconds < 0 ? '-' : '+'}${hours}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`;
}

/**
 * Whether the zone's clock showed this instant's wall time at another instant too: when the clock was turned back,
 * the same wall time comes round again under the other offset. The offsets come from a day either side.
 */
function shownTwice(at: Date, format: Intl.DateTimeFormat, own: number): boolean {
  const others = new Set<number>();
  for (let hours = -26; hours <= 26; hours += 1) {
    const offset = offsetSeconds(new Date(at.getTime() + hours * HOUR), format);
    if (offset !== own) others.add(offset);
  }
  for (const offset of others) {
    const twin = new Date(at.getTime() + (own - offset) * 1000);
    if (offsetSeconds(twin, format) === offset) return true;
  }
  return false;
}

/** HH:MM on a zone's clock, with the offset after it when the clock showed that time twice: "01:03 (UTC-4)". */
export function clockTime(at: Date, timeZone: string): string {
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  const offsets = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'longOffset' });
  const own = offsetSeconds(at, offsets);
  return shownTwice(at, offsets, own) ? `${time} (${offsetLabel(own)})` : time;
}
/** The next calendar date, YYYY-MM-DD. */
export const nextDate = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
/** The calendar date `days` after (or before) a YYYY-MM-DD date. */
export const shiftDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
/** Whole days from one YYYY-MM-DD date to another. */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
