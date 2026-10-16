/**
 * The facts the Sky today page sets out, derived only from committed data:
 * the edition's noon-UTC snapshot (daily.json), the lunation and retrograde
 * tables (sky.json), the monthly transit catalogs, the eclipse table and the
 * published event pages. Pure functions, no interpretation: every value is
 * a position, a phase, a dated event or a period, worded as a fact.
 */
import type { Daily, DailyBody } from './daily';
import { HOUSE_THEME } from './daily';
import { SIGNS, signBySlug } from './signs';

export interface SkyMoon { type: string; at: string }
export interface SkyRetrograde { planet: string; from: string; to: string }
export interface TransitCatalog {
  month: string;
  ingresses: { planet: string; at: string; sign: string; retrograde?: boolean }[];
  lunations: { type: string; at: string; sign: string; degree: number }[];
  stations: { planet: string; at: string; type: string; sign: string; degree: number }[];
  aspects: { a: string; b: string; type: string; at: string; aSign: string; bSign: string }[];
}
export interface EclipseRecord { type: string; kind: string; peak: string; sign: string; degree: number }
export interface PublishedEventPage { id: string; path: string; title: string; anchor: string; family: string }

const DAY_MS = 86_400_000;
export const PLANET_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
const ASPECTS = [
  { type: 'conjunction', angle: 0 },
  { type: 'sextile', angle: 60 },
  { type: 'square', angle: 90 },
  { type: 'trine', angle: 120 },
  { type: 'opposition', angle: 180 },
] as const;

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
export const signWord = (slug: string) => signBySlug(slug).name;

/** 29.53 → "29°31′", truncated as formatLongitude in signs.ts does. */
export function degreeMinutes(degree: number): string {
  const d = Math.floor(degree);
  const m = Math.floor((degree - d) * 60);
  return `${d}°${String(m).padStart(2, '0')}′`;
}

export function utcClock(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
  }).format(new Date(iso));
}

export function shortDate(iso: string, withYear = false): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  }).format(new Date(iso.length === 10 ? `${iso}T12:00:00.000Z` : iso));
}

export function longDate(day: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00.000Z`));
}

const sameUtcDay = (iso: string, day: string) => iso.slice(0, 10) === day;

/** The whole-sign house a body's sign falls in, counted from a Sun sign. */
export function houseFrom(sunSign: string, bodySign: string): number {
  const from = SIGNS.findIndex((sign) => sign.slug === sunSign);
  const to = SIGNS.findIndex((sign) => sign.slug === bodySign);
  return ((to - from + 12) % 12) + 1;
}

export function ordinal(value: number): string {
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] ?? 'th';
  return `${value}${suffix}`;
}

export interface PlanetRow {
  body: string;
  sign: string;
  degree: string;
  retrograde: boolean;
  /** A station on the edition's UTC date, if the catalog records one. */
  stationToday?: { type: string; at: string };
}

export function planetRows(daily: Daily): PlanetRow[] {
  return PLANET_ORDER
    .map((name) => daily.bodies.find((body) => body.body === name))
    .filter((body): body is DailyBody => Boolean(body))
    .map((body) => {
      const station = daily.events.find((event) => (
        event.kind === 'station' && event.planet === body.body && sameUtcDay(event.at, daily.date)
      ));
      return {
        body: body.body,
        sign: body.sign,
        degree: degreeMinutes(body.degree),
        retrograde: body.retrograde,
        stationToday: station ? { type: station.type ?? '', at: station.at } : undefined,
      };
    });
}

export interface MoonCycleNode {
  kind: 'new' | 'full' | 'now';
  at: string;
  sign?: string;
}

/**
 * The lunation before the edition, the edition itself, and the next two
 * lunations: the cycle the Moon is in and the one it is heading for.
 */
export function moonCycle(daily: Daily, moons: readonly SkyMoon[], catalogs: readonly TransitCatalog[]): MoonCycleNode[] {
  const snapshot = daily.snapshotAt ?? `${daily.date}T12:00:00.000Z`;
  const signOf = (at: string) => catalogs
    .flatMap((catalog) => catalog.lunations)
    .find((lunation) => Math.abs(Date.parse(lunation.at) - Date.parse(at)) < 60_000)?.sign;
  const sorted = [...moons].sort((a, b) => a.at.localeCompare(b.at));
  const before = sorted.filter((moon) => moon.at <= snapshot).at(-1);
  const after = sorted.filter((moon) => moon.at > snapshot).slice(0, 3);
  const nodes: MoonCycleNode[] = [];
  if (before) nodes.push({ kind: before.type as 'new' | 'full', at: before.at, sign: signOf(before.at) });
  nodes.push({ kind: 'now', at: snapshot });
  for (const moon of after) {
    nodes.push({ kind: moon.type as 'new' | 'full', at: moon.at, sign: signOf(moon.at) });
    if (nodes.length >= 5) break;
  }
  return nodes;
}

/** Days since the last new moon at the snapshot, to one decimal. */
export function moonAgeDays(daily: Daily, moons: readonly SkyMoon[]): number | null {
  const snapshot = daily.snapshotAt ?? `${daily.date}T12:00:00.000Z`;
  const lastNew = [...moons].filter((moon) => moon.type === 'new' && moon.at <= snapshot)
    .sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  if (!lastNew) return null;
  return Math.round(((Date.parse(snapshot) - Date.parse(lastNew.at)) / DAY_MS) * 10) / 10;
}

export interface SignRow {
  sign: string;
  house: number;
  theme: string;
  moonInSign: boolean;
}

/** Where the edition's Moon falls, counted from each Sun sign. */
export function moonFromEachSign(daily: Daily): SignRow[] {
  const moon = daily.bodies.find((body) => body.body === 'Moon');
  if (!moon) return [];
  return SIGNS.map((sign) => {
    const house = houseFrom(sign.slug, moon.sign);
    const theme = HOUSE_THEME[house];
    return { sign: sign.slug, house, theme: cap(theme), moonInSign: house === 1 };
  });
}

export interface ComingEvent {
  at: string;
  kind: 'ingress' | 'lunation' | 'station' | 'eclipse';
  body: string;
  sign: string;
  title: string;
  detail: string;
  /** The published event page for the same instant, when there is one. */
  path?: string;
}

/**
 * Ingresses, lunations, stations and eclipses after the edition's snapshot,
 * through `days` days, as dated facts in UTC. Lunations that are eclipses
 * appear once, as the eclipse.
 */
export function comingUp(
  daily: Daily,
  catalogs: readonly TransitCatalog[],
  eclipses: readonly EclipseRecord[],
  pages: readonly PublishedEventPage[],
  { days = 31 }: { days?: number } = {},
): ComingEvent[] {
  const start = Date.parse(daily.snapshotAt ?? `${daily.date}T12:00:00.000Z`);
  const end = Date.parse(`${daily.date}T00:00:00.000Z`) + (days + 1) * DAY_MS;
  const within = (at: string) => {
    const time = Date.parse(at);
    return time > start && time < end;
  };
  const pageAt = (at: string, families: readonly string[]) => pages.find((page) => (
    families.includes(page.family) && Math.abs(Date.parse(page.anchor) - Date.parse(at)) < 120_000
  ))?.path;
  const eclipseEvents: ComingEvent[] = eclipses.filter((eclipse) => within(eclipse.peak)).map((eclipse) => ({
    at: eclipse.peak,
    kind: 'eclipse',
    body: eclipse.type === 'solar' ? 'Sun' : 'Moon',
    sign: eclipse.sign,
    title: `${cap(eclipse.kind)} ${eclipse.type} eclipse in ${signWord(eclipse.sign)}`,
    detail: `${degreeMinutes(eclipse.degree)} ${signWord(eclipse.sign)} · ${utcClock(eclipse.peak)} UTC`,
    path: pageAt(eclipse.peak, ['eclipse']),
  }));
  const eclipseDays = new Set(eclipseEvents.map((event) => event.at.slice(0, 10)));
  const seen = new Set<string>();
  const events: ComingEvent[] = [...eclipseEvents];
  for (const catalog of catalogs) {
    for (const ingress of catalog.ingresses) {
      if (!within(ingress.at)) continue;
      events.push({
        at: ingress.at,
        kind: 'ingress',
        body: ingress.planet,
        sign: ingress.sign,
        title: `${ingress.planet} enters ${signWord(ingress.sign)}`,
        detail: `${ingress.retrograde ? 'Moving retrograde · ' : ''}${utcClock(ingress.at)} UTC`,
        path: pageAt(ingress.at, ['ingress', 'season']),
      });
    }
    for (const lunation of catalog.lunations) {
      if (!within(lunation.at) || eclipseDays.has(lunation.at.slice(0, 10))) continue;
      events.push({
        at: lunation.at,
        kind: 'lunation',
        body: 'Moon',
        sign: lunation.sign,
        title: `${lunation.type === 'new' ? 'New' : 'Full'} moon in ${signWord(lunation.sign)}`,
        detail: `${degreeMinutes(lunation.degree)} ${signWord(lunation.sign)} · ${utcClock(lunation.at)} UTC`,
        path: pageAt(lunation.at, ['lunation']),
      });
    }
    for (const station of catalog.stations) {
      if (!within(station.at)) continue;
      events.push({
        at: station.at,
        kind: 'station',
        body: station.planet,
        sign: station.sign,
        title: `${station.planet} stations ${station.type}`,
        detail: `${degreeMinutes(station.degree)} ${signWord(station.sign)} · ${utcClock(station.at)} UTC`,
        path: pageAt(station.at, ['retrograde']),
      });
    }
  }
  return events
    .filter((event) => {
      const key = `${event.kind}:${event.body}:${event.at}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** The first eclipse after the edition, for the line under the calendar. */
export function nextEclipse(daily: Daily, eclipses: readonly EclipseRecord[]): EclipseRecord | null {
  const start = daily.snapshotAt ?? `${daily.date}T12:00:00.000Z`;
  return [...eclipses].filter((eclipse) => eclipse.peak > start)
    .sort((a, b) => a.peak.localeCompare(b.peak))[0] ?? null;
}

export interface RetrogradeBar {
  planet: string;
  from: string;
  to: string;
  state: 'now' | 'upcoming' | 'ended';
  /** Position of the bar within the window, in percent. */
  left: number;
  width: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

export interface RetrogradeTimeline {
  from: string;
  to: string;
  todayAt: number;
  months: { label: string; left: number }[];
  rows: RetrogradeBar[];
}

/**
 * Retrograde periods that touch a window from about three months before the
 * edition to about four months after, each placed on one shared time axis,
 * with the edition marked. One row per planet: the period in effect at the
 * edition, else the next one, else the one that just ended.
 */
export function retrogradeTimeline(
  daily: Daily,
  retrogrades: readonly SkyRetrograde[],
  { monthsBefore = 3, monthsAfter = 5 }: { monthsBefore?: number; monthsAfter?: number } = {},
): RetrogradeTimeline {
  const snapshot = daily.snapshotAt ?? `${daily.date}T12:00:00.000Z`;
  const edition = new Date(`${daily.date}T00:00:00.000Z`);
  const windowStart = Date.UTC(edition.getUTCFullYear(), edition.getUTCMonth() - monthsBefore, 1);
  const windowEnd = Date.UTC(edition.getUTCFullYear(), edition.getUTCMonth() + monthsAfter, 1);
  const span = windowEnd - windowStart;
  const pct = (time: number) => Math.round((Math.min(Math.max(time, windowStart), windowEnd) - windowStart) / span * 10_000) / 100;
  const months: { label: string; left: number }[] = [];
  for (let offset = 0; offset < monthsBefore + monthsAfter; offset += 1) {
    const time = Date.UTC(edition.getUTCFullYear(), edition.getUTCMonth() - monthsBefore + offset, 1);
    months.push({
      label: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(time)),
      left: pct(time),
    });
  }
  const rows: RetrogradeBar[] = [];
  for (const planet of PLANET_ORDER) {
    const periods = retrogrades
      .filter((period) => period.planet === planet)
      .filter((period) => Date.parse(period.to) > windowStart && Date.parse(period.from) < windowEnd)
      .sort((a, b) => a.from.localeCompare(b.from));
    const current = periods.find((period) => period.from <= snapshot && period.to > snapshot);
    const upcoming = periods.find((period) => period.from > snapshot);
    const ended = [...periods].reverse().find((period) => period.to <= snapshot);
    const chosen = current ? { period: current, state: 'now' as const }
      : upcoming ? { period: upcoming, state: 'upcoming' as const }
        : ended ? { period: ended, state: 'ended' as const } : null;
    if (!chosen) continue;
    const fromTime = Date.parse(chosen.period.from);
    const toTime = Date.parse(chosen.period.to);
    const left = pct(fromTime);
    rows.push({
      planet,
      from: chosen.period.from,
      to: chosen.period.to,
      state: chosen.state,
      left,
      width: Math.max(0.6, Math.round((pct(toTime) - left) * 100) / 100),
      clippedStart: fromTime < windowStart,
      clippedEnd: toTime > windowEnd,
    });
  }
  return {
    from: new Date(windowStart).toISOString(),
    to: new Date(windowEnd).toISOString(),
    todayAt: pct(Date.parse(snapshot)),
    months,
    rows,
  };
}

export interface AspectToday {
  a: string;
  b: string;
  type: string;
  orb: number;
  /** Exact time on the edition's date, when the catalog records one. */
  exactAt?: string;
}

/** Major aspects between the ten bodies within `maxOrb` degrees at the snapshot. */
export function aspectsToday(daily: Daily, maxOrb = 3): AspectToday[] {
  const bodies = PLANET_ORDER
    .map((name) => daily.bodies.find((body) => body.body === name))
    .filter((body): body is DailyBody => Boolean(body));
  const found: AspectToday[] = [];
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const raw = Math.abs(bodies[i].lon - bodies[j].lon) % 360;
      const separation = raw > 180 ? 360 - raw : raw;
      for (const aspect of ASPECTS) {
        const orb = Math.abs(separation - aspect.angle);
        if (orb > maxOrb) continue;
        const exact = daily.events.find((event) => (
          event.kind === 'aspect' && event.type === aspect.type
          && ((event.a === bodies[i].body && event.b === bodies[j].body) || (event.a === bodies[j].body && event.b === bodies[i].body))
          && sameUtcDay(event.at, daily.date)
        ));
        found.push({ a: bodies[i].body, b: bodies[j].body, type: aspect.type, orb, exactAt: exact?.at });
      }
    }
  }
  return found.sort((x, y) => (x.exactAt ? 0 : 1) - (y.exactAt ? 0 : 1) || x.orb - y.orb);
}
