/**
 * Chiron, for get_natal_chart, search_sky_events and explain_astrology with ZODIACS_SKY_EVENTS_ENABLED=1. The engine has no
 * Chiron, so its positions come from NASA JPL Horizons: src/data/chiron.json holds 2060 Chiron's geocentric
 * apparent ecliptic longitude of date every 24 days on Terrestrial Time, from four steps before 1800 to four
 * after 2199 (scripts/build-chiron.mjs, from the response kept in docs/engine-validation/chiron/).
 *
 * A longitude between two table rows comes from the eight-point Lagrange polynomial through the four rows on
 * each side, and its daily motion from that polynomial's derivative. Measured against every daily Horizons
 * value from 1800 to 2199, the longitude is within 2.6 arcseconds and the daily motion within 1.1 arcseconds a
 * day; sign changes fall within minutes of Horizons' and stations within two hours, since Chiron barely moves
 * around them (docs/engine-validation/chiron/README.md). An instant is put on Terrestrial Time with the
 * engine's own clock (time-basis.mjs), as the charts are.
 *
 * Only instants from 1800-01-01T00:00Z up to 2200-01-01T00:00Z have a Chiron: outside them it is left out, never
 * extrapolated. Pure: no network, storage or logging.
 */
import table from '../../data/chiron.json';
import { timeBasis } from '../../lib/engine/time-basis.mjs';
import { NATAL_HOUSE_THEME } from '../../lib/natal';
import { NATAL_BODY_THEME } from '../../lib/natal-context';
import { signTagline } from '../../lib/sign-display';
import { SIGNS, signBySlug } from '../../lib/signs';
import type { AspectType, BodyName } from '../../lib/engine/types';

const J2000 = 2451545;
const DAY = 86_400_000;
/** The polynomial's rows before and after the instant: four each, eight in all. */
const BEFORE = table.points / 2 - 1;
const AFTER = table.points / 2;

/** The instants with a Chiron, UTC milliseconds, half open: from the first up to the second. */
export const CHIRON_SPAN = { from: Date.parse(table.span.from), to: Date.parse(table.span.to) } as const;
/** Why a chart or a search has no Chiron outside those years, in a plain sentence. */
export const CHIRON_OUTSIDE = 'Chiron is left out: Zodiacs has its positions, from NASA JPL Horizons, only from 1800 to 2199, and does not extend them.';
/** Where Chiron's position comes from, for the chart's chiron entry. */
export const CHIRON_ABOUT = 'The engine that calculates the rest of the chart has no Chiron, so its position comes from NASA JPL Horizons: positions every 24 days from 1800 to 2199, with the days between filled in by interpolation. Outside those years it is left out.' as const;
/** What astrology reads into Chiron, in plain words. */
export const CHIRON_MEANING = 'Chiron is a small body, part asteroid and part comet, that orbits the Sun between Saturn and Uranus. Astrology reads it as an old hurt or sensitive spot, and the understanding that grows from living with it, which a person can later offer others. It is a symbolic reading, not a prediction or a fixed destiny.';

let longitudes: Float64Array | undefined;
/** The table's longitudes in degrees, unwrapped: the running sum of its whole-number steps. */
function rows(): Float64Array {
  if (!longitudes) {
    longitudes = new Float64Array(table.longitudes.length);
    let units = 0;
    for (const [index, step] of table.longitudes.entries()) {
      units += step;
      longitudes[index] = units / 100_000;
    }
  }
  return longitudes;
}

/**
 * Chiron's longitude (degrees, unwrapped, so it keeps growing past 360) and its daily motion (degrees per day,
 * negative when retrograde) at a Julian date on Terrestrial Time inside the table. Throws outside it.
 */
export function chironAtJdTT(jd: number): { lon: number; speed: number } {
  const values = rows();
  const position = (jd - table.firstJd) / table.stepDays;
  const row = Math.floor(position);
  if (!(row - BEFORE >= 0 && row + AFTER < values.length)) throw new RangeError(`JD ${jd} TT is outside the Chiron table.`);
  const x = position - row;
  const base = values[row];
  let lon = 0;
  let rate = 0;
  for (let j = -BEFORE; j <= AFTER; j += 1) {
    // The Lagrange weight of row j at x, and its derivative, built up one factor at a time.
    let weight = 1;
    let slope = 0;
    for (let m = -BEFORE; m <= AFTER; m += 1) {
      if (m === j) continue;
      const factor = (x - m) / (j - m);
      slope = slope * factor + weight / (j - m);
      weight *= factor;
    }
    // The weights sum to one and their slopes to zero, so the rows are taken from the one at `row`.
    const value = values[row + j] - base;
    lon += weight * value;
    rate += slope * value;
  }
  return { lon: base + lon, speed: rate / table.stepDays };
}

export interface ChironPosition {
  /** Tropical ecliptic longitude of date, degrees 0 to 360. */
  lon: number;
  /** Degrees per day; negative when Chiron is retrograde. */
  speed: number;
  retrograde: boolean;
}

const normal = (lon: number) => ((lon % 360) + 360) % 360;

/** Unwrapped longitude and daily motion at a UTC instant, on the engine's clock; null outside the span. */
function unwrappedAt(ms: number): { lon: number; speed: number } | null {
  if (!(ms >= CHIRON_SPAN.from && ms < CHIRON_SPAN.to)) return null;
  return chironAtJdTT(J2000 + timeBasis(ms).ttDays);
}

/** Chiron at an instant, or null outside 1800-01-01T00:00Z to 2200-01-01T00:00Z. */
export function chironAt(at: Date): ChironPosition | null {
  const found = unwrappedAt(at.getTime());
  if (!found) return null;
  return { lon: normal(found.lon), speed: found.speed, retrograde: found.speed < 0 };
}

export interface ChironEvent {
  kind: 'station' | 'ingress';
  at: Date;
  /** Longitude at that moment, 0 to 360; for a sign change, the sign's edge. */
  lon: number;
  /** The sign it stations in, or the sign it enters (an index into SIGNS). */
  sign: number;
  /** A station: retrograde (turning backward) or direct. A sign change: true when it moves back into the sign before. */
  retrograde: boolean;
}

/** The instant in (lo, hi] where `inside` turns false, by bisection to a second; `inside(lo)` is true. */
function bisect(lo: number, hi: number, inside: (ms: number) => boolean): number {
  while (hi - lo > 1000) {
    const middle = Math.floor((lo + hi) / 2);
    if (inside(middle)) lo = middle;
    else hi = middle;
  }
  return hi;
}

/** Sampling step for stations: Chiron's turns are months apart, so two never fall within four days. */
const SAMPLE = 4 * DAY;

/**
 * Chiron's stations and sign changes from `from` up to `to` (not included), soonest first, kept inside the span,
 * and whether the span cut the window. A station is where the daily motion changes sign, sampled every four days
 * and narrowed to a second; between two stations the longitude only grows or only shrinks, so each sign edge it
 * passes there is one sign change, narrowed to a second too.
 */
export function chironEvents(from: Date, to: Date): { events: ChironEvent[]; clipped: boolean } {
  const clipped = from.getTime() < CHIRON_SPAN.from || to.getTime() > CHIRON_SPAN.to;
  const lo = Math.max(from.getTime(), CHIRON_SPAN.from);
  const hi = Math.min(to.getTime(), CHIRON_SPAN.to) - 1;
  if (!(lo < hi)) return { events: [], clipped };
  const at = (ms: number) => unwrappedAt(ms)!;
  const events: ChironEvent[] = [];
  const turns: number[] = [];
  let previous = lo;
  let forward = at(lo).speed >= 0;
  for (let ms = Math.min(lo + SAMPLE, hi); ; ms = Math.min(ms + SAMPLE, hi)) {
    if ((at(ms).speed >= 0) !== forward) {
      const going = forward;
      const turn = bisect(previous, ms, (instant) => (at(instant).speed >= 0) === going);
      const lon = normal(at(turn).lon);
      events.push({ kind: 'station', at: new Date(turn), lon, sign: Math.floor(lon / 30), retrograde: going });
      turns.push(turn);
      forward = !forward;
    }
    previous = ms;
    if (ms >= hi) break;
  }
  const ends = [lo, ...turns, hi];
  for (let index = 0; index + 1 < ends.length; index += 1) {
    const [start, end] = [ends[index], ends[index + 1]];
    const [a, b] = [at(start).lon, at(end).lon];
    const rising = b >= a;
    // Rising, it enters sign n at 30n for each 30n in (a, b]; falling, it leaves sign n for n - 1 at each 30n in (b, a].
    for (let edge = Math.floor((rising ? a : b) / 30) + 1; edge <= Math.floor((rising ? b : a) / 30); edge += 1) {
      const level = edge * 30;
      const crossing = bisect(start, end, (instant) => (rising ? at(instant).lon < level : at(instant).lon >= level));
      events.push({ kind: 'ingress', at: new Date(crossing), lon: normal(level), sign: (((rising ? edge : edge - 1) % 12) + 12) % 12, retrograde: !rising });
    }
  }
  events.sort((x, y) => x.at.getTime() - y.at.getTime());
  return { events, clipped };
}

const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];

/** Chiron's sign, in the words the chart uses for every placement's sign; `subject` names Chiron where "it" would not. */
export function chironSignLine(slug: string, subject = 'it'): string {
  const sign = signBySlug(slug);
  return `In ${sign.name}, ${subject} takes on a ${sign.modality} ${sign.element} style. ${signTagline(sign)}`;
}

/** Chiron's house, in the words the chart uses for the lunar nodes' houses. */
export function chironHouseLine(house: number, subject = 'it'): string {
  return `The ${ORDINAL[house]} house brings ${subject} into ${NATAL_HOUSE_THEME[house]}.`;
}

const ASPECT_LINE: Record<AspectType, (planet: string, topic: string) => string> = {
  conjunction: (planet, topic) => `Your Chiron is fused to your ${planet}. Astrology ties Chiron's sensitive spot closely to your ${topic}, so tending one tends the other.`,
  sextile: (planet, topic) => `Your Chiron has an open line to your ${planet}. Astrology reads an easy channel between Chiron's sensitive spot and your ${topic}, there when you choose to use it.`,
  square: (planet, topic) => `Your Chiron grinds against your ${planet}. Astrology reads friction between Chiron's sensitive spot and your ${topic}, and the strength that comes from working with it.`,
  trine: (planet, topic) => `Your Chiron runs downhill into your ${planet}. Astrology reads an easy flow between Chiron's sensitive spot and your ${topic}, so what one teaches helps the other.`,
  opposition: (planet, topic) => `Your Chiron faces off with your ${planet}. Astrology reads Chiron's sensitive spot and your ${topic} at opposite ends of one axis, asking for a balance between them.`,
};

/** One sentence for Chiron's aspect to a planet, with the planet's theme in the chart's words. */
export function chironAspectLine(type: AspectType, planet: BodyName): string {
  return ASPECT_LINE[type](planet, NATAL_BODY_THEME[planet].topic);
}

/** The signs Chiron passed through between two longitudes, as the chart lists a body's possible signs. */
export function chironSignsBetween(from: number, to: number): string[] {
  const [a, b] = [Math.floor(normal(from) / 30), Math.floor(normal(to) / 30)];
  const indices = new Set([a, b]);
  const step = ((to - from + 540) % 360) - 180 < 0 ? 11 : 1;
  if (a !== b) for (let index = a; index !== b; index = (index + step) % 12) indices.add(index);
  return [...indices].map((index) => SIGNS[index].slug);
}
