/**
 * "Your week": where the moving planets meet a chart in the next seven days.
 *
 * Pure: the caller injects the ephemeris (the panel's worker passes the bundled
 * engine's). Exact passes come from the site's transit scanner. The edges of
 * each period come from the same scanner, run on the chart's points moved by
 * the orb either way, so no new root finder is involved. The words are in
 * week-words.ts, outside the worker.
 */
import { findLongitudeCrossingsWith } from '@zodiacs/engine/crossings';
import {
  aspectTargetLongitudes,
  createTransitScanner,
  natalTransitPoints,
  type NatalTransitChart,
  type TransitContact,
} from '../../lib/engine/transit-scan-core';
import {
  DEFAULT_TRANSIT_BODIES,
  MAJOR_ASPECT_ORDER,
  type NatalPoint,
  type TransitBody,
} from '../../lib/engine/transit-scan-shared';
import type { AspectType, BodyName } from '../../lib/engine/types';
import type { PortableChartCalculation } from '../../lib/engine/portable';

export const WEEK_DAYS = 7;
/** The site's transit orb (TRANSIT_ORB in src/lib/transits.ts; week.test.ts holds them equal). */
export const WEEK_ORB = 3;
export const WEEK_LIMIT = 5;
const DAY = 86_400_000;
/** Spacing of the extra orb samples used only to rank periods with no exact pass. */
const SAMPLE_MS = 6 * 3_600_000;
/** Without a birth time these points are left out: the Moon moves about 13° a day. */
export const UNTIMED_LEFT_OUT: readonly NatalPoint[] = ['Moon', 'ASC', 'MC'];

export interface WeekEphemeris {
  bodyLongitude(body: BodyName, date: Date): number;
  longitudeSpeed(body: BodyName, date: Date): number;
}

export interface WeekRequest {
  /** Chart longitudes only: the ten planets and, with a known time and place, ASC and MC. */
  natal: NatalTransitChart;
  timeKnown: boolean;
  /** The start of the seven days: the device's clock when the chart was made. */
  fromUtc: string;
}

export interface WeekItem {
  transitBody: TransitBody;
  natalPoint: NatalPoint;
  aspect: AspectType;
  /** The part of the period that falls within the seven days. */
  startUtc: string;
  endUtc: string;
  /** Already within orb when the seven days begin. */
  startClipped: boolean;
  /** Still within orb when the seven days end. */
  endClipped: boolean;
  /** Exact passes within the period. */
  exactUtc: string[];
  /** Smallest distance from exact within the seven days, in degrees (0 when exact). */
  closestOrb: number;
}

export interface YourWeek {
  fromUtc: string;
  toUtc: string;
  timeKnown: boolean;
  /** Closest first, at most WEEK_LIMIT. */
  items: WeekItem[];
  /** Periods found before the limit. */
  found: number;
}

/** The request for a calculated Studio chart: longitudes only, no birth inputs. */
export function weekRequest(run: PortableChartCalculation, now: Date): WeekRequest {
  const angles = run.chart.input.timeKnown && run.chart.angles ? { asc: run.chart.angles.asc, mc: run.chart.angles.mc } : null;
  return {
    natal: { bodies: run.chart.bodies.map(({ body, lon }) => ({ body, lon })), angles },
    timeKnown: run.chart.input.timeKnown,
    fromUtc: now.toISOString(),
  };
}

/** Each longitude is asked for once per instant: the scans share most of their samples. */
function remember(ephemeris: WeekEphemeris): WeekEphemeris {
  const cache = { lon: new Map<string, number>(), speed: new Map<string, number>() };
  const once = (store: Map<string, number>, read: (body: BodyName, date: Date) => number) => (body: BodyName, date: Date) => {
    const key = `${body}|${date.getTime()}`;
    let value = store.get(key);
    if (value === undefined) { value = read(body, date); store.set(key, value); }
    return value;
  };
  return {
    bodyLongitude: once(cache.lon, (body, date) => ephemeris.bodyLongitude(body, date)),
    longitudeSpeed: once(cache.speed, (body, date) => ephemeris.longitudeSpeed(body, date)),
  };
}

const distance = (target: number, lon: number) => Math.abs((((lon - target + 540) % 360) + 360) % 360 - 180);
const keyOf = (contact: Pick<TransitContact, 'transitBody' | 'natalPoint' | 'aspect'>) => `${contact.transitBody}|${contact.natalPoint}|${contact.aspect}`;

function shifted(chart: NatalTransitChart, degrees: number): NatalTransitChart {
  return {
    bodies: chart.bodies.map(({ body, lon }) => ({ body, lon: lon + degrees })),
    angles: chart.angles ? { asc: chart.angles.asc + degrees, mc: chart.angles.mc + degrees } : null,
  };
}

/**
 * Transits within orb at any point in the seven days from `fromUtc`, closest
 * first: exact passes first, in time order, then the rest by their smallest
 * distance from exact. The transiting Moon is not listed (its contacts last
 * hours). Without a birth time the chart's Moon, ASC and MC are left out.
 */
export function scanYourWeek(request: WeekRequest, ephemeris: WeekEphemeris, limit = WEEK_LIMIT): YourWeek {
  const fromMs = Date.parse(request.fromUtc);
  if (!Number.isFinite(fromMs)) throw new RangeError('The week needs a valid start.');
  if (typeof request.timeKnown !== 'boolean') throw new RangeError('Confirm whether the birth time is known.');
  const toMs = fromMs + WEEK_DAYS * DAY;
  const from = new Date(fromMs), to = new Date(toMs);
  const natal: NatalTransitChart = request.timeKnown ? request.natal : { bodies: request.natal.bodies, angles: null };
  const points = natalTransitPoints(natal).filter(point => request.timeKnown || !UNTIMED_LEFT_OUT.includes(point.name));
  const result: YourWeek = { fromUtc: from.toISOString(), toUtc: to.toISOString(), timeKnown: request.timeKnown, items: [], found: 0 };
  if (!points.length) return result;

  const sky = remember(ephemeris);
  const scanner = createTransitScanner({
    bodyLongitude: sky.bodyLongitude,
    longitudeSpeed: sky.longitudeSpeed,
    findLongitudeCrossings: (body, target, start, end, stepDays) => findLongitudeCrossingsWith(sky.bodyLongitude, body, target, start, end, stepDays),
  });
  const options = { transitBodies: DEFAULT_TRANSIT_BODIES, natalPoints: points.map(point => point.name), aspects: MAJOR_ASPECT_ORDER };
  const exact = new Map<string, number[]>();
  for (const contact of scanner.scanTransitContacts(natal, from, to, options)) {
    exact.set(keyOf(contact), [...(exact.get(keyOf(contact)) ?? []), Date.parse(contact.exactUtc)]);
  }
  // An exact contact with a point moved by the orb is the moment the real contact enters or leaves it.
  const edges = new Map<string, number[]>();
  for (const degrees of [WEEK_ORB, -WEEK_ORB]) {
    for (const contact of scanner.scanTransitContacts(shifted(natal, degrees), from, to, options)) {
      edges.set(keyOf(contact), [...(edges.get(keyOf(contact)) ?? []), Date.parse(contact.exactUtc)]);
    }
  }

  const samples = Array.from({ length: Math.floor((toMs - fromMs) / SAMPLE_MS) + 1 }, (_, index) => fromMs + index * SAMPLE_MS);
  const items: WeekItem[] = [];
  for (const transitBody of DEFAULT_TRANSIT_BODIES) {
    const lonAt = (ms: number) => sky.bodyLongitude(transitBody, new Date(ms));
    for (const point of points) {
      for (const aspect of MAJOR_ASPECT_ORDER) {
        const targets = aspectTargetLongitudes(point.lon, aspect);
        const orbAt = (ms: number) => Math.min(...targets.map(target => distance(target, lonAt(ms))));
        const key = `${transitBody}|${point.name}|${aspect}`;
        const cuts = [...new Set([fromMs, ...(edges.get(key) ?? []).filter(ms => ms > fromMs && ms < toMs), toMs])].sort((a, b) => a - b);
        const periods: { start: number; end: number }[] = [];
        for (let index = 0; index < cuts.length - 1; index += 1) {
          const start = cuts[index], end = cuts[index + 1];
          // Each piece between edges is wholly inside or outside the orb; its middle says which.
          if (orbAt((start + end) / 2) > WEEK_ORB) continue;
          const last = periods[periods.length - 1];
          if (last && last.end === start) last.end = end;
          else periods.push({ start, end });
        }
        for (const { start, end } of periods) {
          const passes = (exact.get(key) ?? []).filter(ms => ms >= start && ms <= end).sort((a, b) => a - b);
          const closestOrb = passes.length ? 0 : Math.min(orbAt(start), orbAt(end), ...samples.filter(ms => ms > start && ms < end).map(orbAt));
          items.push({
            transitBody, natalPoint: point.name, aspect,
            startUtc: new Date(start).toISOString(), endUtc: new Date(end).toISOString(),
            startClipped: start === fromMs, endClipped: end === toMs,
            exactUtc: passes.map(ms => new Date(ms).toISOString()), closestOrb,
          });
        }
      }
    }
  }
  const firstExact = (item: WeekItem) => (item.exactUtc[0] ?? item.startUtc);
  items.sort((a, b) => a.closestOrb - b.closestOrb || firstExact(a).localeCompare(firstExact(b)) || a.startUtc.localeCompare(b.startUtc));
  return { ...result, items: items.slice(0, Math.max(0, limit)), found: items.length };
}
