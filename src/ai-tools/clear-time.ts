import { moonPhaseNameFromAngle } from '../lib/engine/lite';
import { SampleBudget, phaseCrossings } from '../lib/compute-api/endpoints';
import { EPOCH, PHASES } from '../lib/compute-api/constants';

/**
 * Times and Moon phases as the connector hands them to an assistant (ZOD-64).
 *
 * An event time is solved to the millisecond, but a slow planet's sign change or station can sit hours from an
 * independent reference, so a millisecond says more than is known: event times are given to the minute. The exact
 * instant the engine solved stays in the result's calculation, which its receipt covers.
 *
 * A local time is written as ISO 8601 with its offset, 2026-11-10T15:35:46+07:00, never as 10/11/2026, which reads
 * as 10 October in the United States and 10 November elsewhere. The zone's name travels beside it.
 */
const MINUTE = 60_000;
const DAY = 86_400_000;

/** The instant rounded to the nearest minute, half a minute rounding up. */
export function roundToMinute(utc: string | Date): Date {
  return new Date(Math.round(new Date(utc).getTime() / MINUTE) * MINUTE);
}

/** A UTC instant to the minute, with no fraction of a second: 2026-11-10T08:36:00Z. */
export function minuteUtc(utc: string | Date): string {
  return `${roundToMinute(utc).toISOString().slice(0, 16)}:00Z`;
}

const two = (value: number) => String(Math.trunc(Math.abs(value))).padStart(2, '0');

/**
 * The zone's clock at an instant as ISO 8601 with the offset, to the second: 2026-11-10T15:35:46+07:00.
 * UTC is written +00:00. A fraction of a second is dropped. Before a zone kept a whole-minute offset (local mean
 * time, such as +06:42:04), the clock time is the zone's own and the offset is written to the nearest minute.
 * With milliseconds, the fraction is kept: 2026-11-10T15:35:46.560+07:00.
 */
export function localIso(utc: string | Date, zone: string, milliseconds = false): string {
  const exact = new Date(utc).getTime();
  const instant = new Date(Math.floor(exact / 1000) * 1000);
  // Built from parts: runtimes disagree on the punctuation of a joined date.
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, era: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(instant).map((part) => [part.type, part.value]));
  const year = Number(parts.year) * (parts.era === 'BC' ? -1 : 1) + (parts.era === 'BC' ? 1 : 0);
  const wall = new Date(0);
  wall.setUTCFullYear(year, Number(parts.month) - 1, Number(parts.day));
  wall.setUTCHours(Number(parts.hour), Number(parts.minute), Number(parts.second), 0);
  const offsetMinutes = Math.round((wall.getTime() - instant.getTime()) / MINUTE);
  const offset = `${offsetMinutes < 0 ? '-' : '+'}${two(offsetMinutes / 60)}:${two(offsetMinutes % 60)}`;
  const fraction = milliseconds ? `.${String(exact - instant.getTime()).padStart(3, '0')}` : '';
  return `${wall.toISOString().slice(0, 19)}${fraction}${offset}`;
}

/** The zone's clock at an instant rounded to the minute: 2026-11-10T15:36:00+07:00. */
export function localMinuteIso(utc: string | Date, zone: string): string {
  return localIso(roundToMinute(utc), zone);
}

export interface ShownTime { at: Date; precision: 'minute' | 'second' | 'millisecond' }

/**
 * An event's time as the list shows it: the nearest minute, but never outside the window searched or the supported
 * range. At an edge the time rounds toward the inside (an event at 14:31:41 in a window ending 14:31:45 shows 14:31,
 * not 14:32). When no whole minute near the event lies inside the window, the nearest whole second inside it is
 * shown, and failing that the instant itself.
 */
export function shownTime(utc: string | Date, window?: { from: string | Date; to: string | Date }): ShownTime {
  const time = new Date(utc).getTime();
  const low = Math.max(Date.parse(EPOCH.from), window ? new Date(window.from).getTime() : -Infinity);
  const high = Math.min(Date.parse(EPOCH.to), window ? new Date(window.to).getTime() : Infinity);
  for (const [unit, precision] of [[MINUTE, 'minute'], [1000, 'second']] as const) {
    const nearest = Math.round(time / unit) * unit;
    const other = nearest > time ? Math.floor(time / unit) * unit : Math.ceil(time / unit) * unit;
    for (const candidate of [nearest, other]) if (candidate >= low && candidate <= high) return { at: new Date(candidate), precision };
  }
  return { at: new Date(time), precision: 'millisecond' };
}

/** A shown time on the UTC clock: 2026-11-10T08:36:00Z, with seconds or milliseconds only when the window needs them. */
export function shownUtc(shown: ShownTime): string {
  const iso = shown.at.toISOString();
  return shown.precision === 'minute' ? `${iso.slice(0, 16)}:00Z` : shown.precision === 'second' ? `${iso.slice(0, 19)}Z` : iso;
}

/** An event's time in the list, on the UTC clock and on the zone's, both the same shown instant. */
export function eventTimes(utc: string | Date, zone: string, window: { from: string | Date; to: string | Date }): { at: string; localAt: string } {
  const shown = shownTime(utc, window);
  return { at: shownUtc(shown), localAt: localIso(shown.at, zone, shown.precision === 'millisecond') };
}

export type MoonDirection = 'waxing' | 'waning';

/** Waxing from the new Moon to the full Moon (elongation under 180 degrees), waning from full back to new. */
export function moonDirection(angle: number): MoonDirection {
  return angle < 180 ? 'waxing' : 'waning';
}

/**
 * The phase's name with which way the Moon is going. "New Moon" and "Full Moon" cover about a day and a half either
 * side of the exact moment, so the bare name cannot say whether the moment has passed: 12 degrees past new reads
 * "New Moon, waxing", and 12 degrees short of it "New Moon, waning". At the exact new or full Moon (0 or 180 degrees)
 * the Moon is turning, so the name stands alone. The crescent and gibbous names already say which way, and so do
 * the quarters (the first quarter is always waxing, the last always waning): they stay as they are.
 */
export function moonPhaseLabel(angle: number): string {
  const name = moonPhaseNameFromAngle(angle);
  if (/^Wa(?:x|n)ing /u.test(name) || name === 'First Quarter' || name === 'Last Quarter') return name;
  const turn = ((angle % 360) + 360) % 360;
  return turn === 0 || turn === 180 ? name : `${name}, ${moonDirection(angle)}`;
}

export interface MoonCycle {
  direction: MoonDirection;
  /** The new and full Moons either side of the instant, each a UTC instant to the minute. */
  lastNew: string; nextNew: string; lastFull: string; nextFull: string;
}

/**
 * The new and full Moons either side of an instant, from the search behind get_upcoming_events (where the Moon's
 * elongation from the Sun crosses 0 and 180 degrees), rounded to the minute. A lunation at the instant itself counts
 * as the last one. 31 days either side always holds one of each: a lunar month is never longer than 29.9 days.
 */
export function moonCycle(at: Date, angle: number): MoonCycle {
  const budget = new SampleBudget('events.samples');
  const around = (phase: number) => {
    const crossings = phaseCrossings(phase, new Date(at.getTime() - 31 * DAY), new Date(at.getTime() + 31 * DAY), budget).map((crossing) => crossing.at.getTime());
    const last = Math.max(...crossings.filter((time) => time <= at.getTime()));
    const next = Math.min(...crossings.filter((time) => time > at.getTime()));
    if (!Number.isFinite(last) || !Number.isFinite(next)) throw new Error('No lunation either side of the instant.');
    return [minuteUtc(new Date(last)), minuteUtc(new Date(next))] as const;
  };
  const [lastNew, nextNew] = around(PHASES.new);
  const [lastFull, nextFull] = around(PHASES.full);
  return { direction: moonDirection(angle), lastNew, nextNew, lastFull, nextFull };
}
