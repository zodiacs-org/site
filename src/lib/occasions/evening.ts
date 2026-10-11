/**
 * The evening sky at a place on a local day, for planning an occasion:
 * sunrise and sunset, golden hour, civil dusk, the Moon's rise, set and
 * highest point, and the bright planets above the horizon after dusk.
 *
 * Rise, set and transit times come from @zodiacs/engine/sky; golden hour and
 * civil dusk from ./sun-altitude.ts, between the Sun's upper and lower
 * transits, where its altitude only falls.
 */
import { skyEvents, skyEventsOn, type Observer, type SkyBody, type SkyEvent } from '@zodiacs/engine/sky';
import { sunDescendsThrough } from './sun-altitude';

/** Golden hour runs from the Sun at this height down to sunset (a common photographers' convention). */
export const GOLDEN_HOUR_SUN_ALTITUDE = 6;
/** Civil dusk: the Sun 6° below the horizon. */
export const CIVIL_DUSK_SUN_ALTITUDE = -6;
/** Planets bright enough to point out by name after dusk. */
export const EVENING_PLANETS = ['Venus', 'Mars', 'Jupiter', 'Saturn'] as const satisfies readonly SkyBody[];
/** How long after dusk a planet may rise and still count as up for the evening. */
const EVENING_HOURS = 4;
const HOUR = 3_600_000;

export interface EveningSky {
  date: string;
  utcOffsetMinutes: number;
  sunrise: string | null;
  sunset: string | null;
  /** Golden hour: from the Sun at 6° to sunset. Null when the Sun never climbs that high or never sets. */
  goldenHour: { start: string; end: string } | null;
  civilDusk: string | null;
  moon: {
    rise: string | null;
    set: string | null;
    /** The Moon's highest point that day, with its geometric altitude in whole degrees. */
    highest: { at: string; altitude: number } | null;
  };
  /** Bright planets above the horizon at dusk, or rising within four hours of it. */
  planetsAfterDusk: (typeof EVENING_PLANETS)[number][];
  /** Polar day or night: the Sun neither rises nor sets that day. */
  flags: ('sun-never-rises' | 'sun-never-sets')[];
}

function first(events: readonly SkyEvent[], kind: SkyEvent['kind']): SkyEvent | undefined {
  return events.find((event) => event.kind === kind);
}

/** Whether `body` is above the horizon at `at`, or rises before `until`. */
function upInWindow(body: SkyBody, observer: Observer, at: Date, until: Date): boolean {
  const ahead = skyEvents(body, observer, at, new Date(at.getTime() + 24 * HOUR));
  if (ahead.status !== 'complete') return false;
  if (ahead.flags.includes('never-sets')) return true;
  if (ahead.flags.includes('never-rises')) return false;
  const next = ahead.events.find((event) => event.kind === 'rise' || event.kind === 'set');
  if (!next) return false;
  if (next.kind === 'set') return true;
  return next.at.getTime() <= until.getTime();
}

export function eveningSky(observer: Observer, date: string, utcOffsetMinutes: number): EveningSky {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new RangeError('eveningSky needs a YYYY-MM-DD date.');
  const options = { utcOffsetMinutes };
  const sun = skyEventsOn('Sun', observer, date, options);
  const moon = skyEventsOn('Moon', observer, date, options);
  if (sun.status !== 'complete' || moon.status !== 'complete') {
    throw new Error('The sky search was refused for this day.');
  }
  const flags: EveningSky['flags'] = [];
  if (sun.flags.includes('never-rises')) flags.push('sun-never-rises');
  if (sun.flags.includes('never-sets')) flags.push('sun-never-sets');

  const sunrise = first(sun.events, 'rise')?.at ?? null;
  const sunset = first(sun.events, 'set')?.at ?? null;
  // The Sun only descends from its upper transit to the next lower transit.
  const upper = first(sun.events, 'upper-transit');
  const after = upper ? skyEvents('Sun', observer, upper.at, new Date(upper.at.getTime() + 24 * HOUR)) : null;
  const lower = after?.status === 'complete' ? after.events.find((event) => event.kind === 'lower-transit') : undefined;
  const descent = upper && lower ? { from: upper.at, to: lower.at } : null;
  const goldenStart = sunset && descent
    ? sunDescendsThrough(GOLDEN_HOUR_SUN_ALTITUDE, descent.from, sunset, observer.latitude, observer.longitude)
    : null;
  const dusk = sunset && descent
    ? sunDescendsThrough(CIVIL_DUSK_SUN_ALTITUDE, sunset, descent.to, observer.latitude, observer.longitude)
    : null;
  const goldenHour = goldenStart && sunset && goldenStart.getTime() < sunset.getTime()
    ? { start: goldenStart.toISOString(), end: sunset.toISOString() }
    : null;

  const moonHigh = first(moon.events, 'upper-transit');
  const evening = dusk ?? sunset;
  const planetsAfterDusk = evening
    ? EVENING_PLANETS.filter((body) => upInWindow(body, observer, evening, new Date(evening.getTime() + EVENING_HOURS * HOUR)))
    : [];

  return {
    date,
    utcOffsetMinutes,
    sunrise: sunrise?.toISOString() ?? null,
    sunset: sunset?.toISOString() ?? null,
    goldenHour,
    civilDusk: dusk?.toISOString() ?? null,
    moon: {
      rise: first(moon.events, 'rise')?.at.toISOString() ?? null,
      set: first(moon.events, 'set')?.at.toISOString() ?? null,
      highest: moonHigh ? { at: moonHigh.at.toISOString(), altitude: Math.round(moonHigh.altitude) } : null,
    },
    planetsAfterDusk,
    flags,
  };
}
