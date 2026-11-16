import { moonPhaseNameFromAngle } from '../lib/engine/lite';
import { SampleBudget, phaseCrossings } from '../lib/compute-api/endpoints';
import { PHASES } from '../lib/compute-api/constants';

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
 */
export function localIso(utc: string | Date, zone: string): string {
  const instant = new Date(Math.floor(new Date(utc).getTime() / 1000) * 1000);
  // Built from parts: runtimes disagree on the punctuation of a joined date.
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, era: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(instant).map((part) => [part.type, part.value]));
  const year = Number(parts.year) * (parts.era === 'BC' ? -1 : 1) + (parts.era === 'BC' ? 1 : 0);
  const wall = new Date(0);
  wall.setUTCFullYear(year, Number(parts.month) - 1, Number(parts.day));
  wall.setUTCHours(Number(parts.hour), Number(parts.minute), Number(parts.second), 0);
  const offsetMinutes = Math.round((wall.getTime() - instant.getTime()) / MINUTE);
  const offset = `${offsetMinutes < 0 ? '-' : '+'}${two(offsetMinutes / 60)}:${two(offsetMinutes % 60)}`;
  return `${wall.toISOString().slice(0, 19)}${offset}`;
}

/** The zone's clock at an instant rounded to the minute: 2026-11-10T15:36:00+07:00. */
export function localMinuteIso(utc: string | Date, zone: string): string {
  return localIso(roundToMinute(utc), zone);
}

export type MoonDirection = 'waxing' | 'waning';

/** Waxing from the new Moon to the full Moon (elongation under 180 degrees), waning from full back to new. */
export function moonDirection(angle: number): MoonDirection {
  return angle < 180 ? 'waxing' : 'waning';
}

/**
 * The phase's name with which way the Moon is going. "New Moon" and "Full Moon" cover about a day and a half either
 * side of the exact moment and the quarters about a day, so the bare name cannot say whether the moment has passed:
 * 12 degrees past new reads "New Moon, waxing", and 12 degrees short of it "New Moon, waning". The crescent and
 * gibbous names already say it and stay as they are.
 */
export function moonPhaseLabel(angle: number): string {
  const name = moonPhaseNameFromAngle(angle);
  return /^Wa(?:x|n)ing /u.test(name) ? name : `${name}, ${moonDirection(angle)}`;
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
