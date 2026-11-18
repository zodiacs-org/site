/**
 * One instant read on five clocks: UTC, New York, London, Kolkata and Sydney.
 *
 * The year pages (Mercury retrograde, full moons, eclipses) and the birthday
 * pages print a sky event once, as an instant. People search for it on their
 * own clock, and the date can differ by zone: a full moon at 23:23 UTC is the
 * next morning in Sydney. Everything here runs at build time through Intl and
 * IANA zone names, so daylight saving comes from the time zone database, not
 * from a hand-kept offset. Times are cut to the minute the way the pages'
 * UTC columns already print them (Intl drops the seconds; it does not round).
 */

export const WORLD_TIME_ZONES = [
  { zone: 'UTC', city: 'UTC' },
  { zone: 'America/New_York', city: 'New York' },
  { zone: 'Europe/London', city: 'London' },
  { zone: 'Asia/Kolkata', city: 'Kolkata' },
  { zone: 'Australia/Sydney', city: 'Sydney' },
] as const;

export type WorldTimeZone = (typeof WORLD_TIME_ZONES)[number]['zone'];

export interface WorldTime {
  zone: WorldTimeZone;
  city: string;
  /** "Wed Feb 10" */
  day: string;
  /** "February 10" */
  monthDay: string;
  /** "04:36", 24-hour */
  time: string;
  /** "UTC+11", "UTC-5", "UTC+5:30"; "UTC" for the UTC clock itself. */
  offset: string;
  /** The local calendar date, YYYY-MM-DD. */
  ymd: string;
  /** Local calendar date minus the UTC calendar date, in days (-1, 0 or 1). */
  dayShift: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    });
    formatters.set(zone, f);
  }
  return f;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "GMT-05:00" reads "UTC-5", "GMT+05:30" reads "UTC+5:30", "GMT" reads "UTC+0". */
export function utcOffsetLabel(gmt: string): string {
  const m = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/u.exec(gmt);
  if (!m) throw new Error(`Unexpected time zone offset: ${gmt}`);
  if (!m[1]) return 'UTC+0';
  const hours = Number(m[2]);
  return `UTC${m[1]}${hours}${m[3] === '00' ? '' : `:${m[3]}`}`;
}

/** The instant on one clock. */
export function timeIn(at: Date, zone: WorldTimeZone): WorldTime {
  const city = WORLD_TIME_ZONES.find((z) => z.zone === zone)!.city;
  const parts = Object.fromEntries(formatter(zone).formatToParts(at).map((p) => [p.type, p.value]));
  const month = MONTHS.indexOf(parts.month) + 1;
  if (month === 0) throw new Error(`Unexpected month name: ${parts.month}`);
  const ymd = `${parts.year}-${String(month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const dayShift = Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${at.toISOString().slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  return {
    zone,
    city,
    day: `${parts.weekday} ${parts.month.slice(0, 3)} ${parts.day}`,
    monthDay: `${parts.month} ${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    offset: zone === 'UTC' ? 'UTC' : utcOffsetLabel(parts.timeZoneName),
    ymd,
    dayShift,
  };
}

/** The instant on all five clocks, UTC first. */
export function worldTimes(at: Date): WorldTime[] {
  return WORLD_TIME_ZONES.map(({ zone }) => timeIn(at, zone));
}

/**
 * One plain sentence for an instant: "17:36 UTC on February 9, which is 12:36
 * in New York, 17:36 in London, 23:06 in Kolkata and 04:36 on February 10 in
 * Sydney". A zone's date is named only where it differs from the UTC date.
 */
export function worldTimesSentence(at: Date): string {
  const [utc, ...rest] = worldTimes(at);
  const parts = rest.map((t) => `${t.time}${t.ymd === utc.ymd ? '' : ` on ${t.monthDay}`} in ${t.city}`);
  const list = `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `${utc.time} UTC on ${utc.monthDay}, which is ${list}`;
}
