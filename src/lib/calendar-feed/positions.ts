/**
 * What a calendar feed stores, and nothing more: the owner's decision of
 * 2026-09-28 keeps "only what the feed computes from: the positions, with
 * whole-degree angles". The transit scanner reads the ten planets and the
 * ascendant and midheaven (natalTransitPoints in transit-scan-core.ts), so
 * the nodes, the house system and the engine version a positions code also
 * carries are dropped here and never reach the database.
 */
import { decodePositionsLink } from '../share-positions.js';
import type { NatalTransitChart } from '../engine/transit-scan-core.js';

export const FEED_PLANETS = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
] as const;

export interface CalendarFeedPositions {
  /** Longitudes of FEED_PLANETS, in that order, to 0.001°. */
  planets: number[];
  /** The ascendant's whole degree, 0–359; null for a chart without a birth time. */
  ascendant: number | null;
  /** The midheaven's whole degree, 0–359; null for a chart without a birth time. */
  midheaven: number | null;
}

/** A longitude in [0, 360) with at most three decimals. */
function thousandths(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value < 360
    && Math.round(value * 1000) / 1000 === value;
}

function wholeDegree(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 359;
}

/**
 * The stored positions of a feed, from the positions code the page sends
 * when someone subscribes; null for anything else. The code must be one made
 * to leave the device (encodeSharedPositionsLink): its ascendant and
 * midheaven sit at the middle of their whole degree, and only that degree
 * is kept.
 */
export function feedPositionsFromCode(code: unknown): CalendarFeedPositions | null {
  if (typeof code !== 'string') return null;
  const chart = decodePositionsLink(code);
  if (!chart) return null;
  const planets = FEED_PLANETS.map((name) => chart.bodies.find((row) => row.body === name)?.lon);
  if (!planets.every(thousandths)) return null;
  if (!chart.angles) return { planets, ascendant: null, midheaven: null };
  const { asc, mc } = chart.angles;
  if (asc - Math.floor(asc) !== 0.5 || mc - Math.floor(mc) !== 0.5) return null;
  return { planets, ascendant: Math.floor(asc), midheaven: Math.floor(mc) };
}

/** Checks what the database returned for a feed; null for any other shape. */
export function feedPositionsFromRecord(record: unknown): CalendarFeedPositions | null {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const { planets, ascendant, midheaven } = record as Record<string, unknown>;
  if (!Array.isArray(planets)
    || planets.length !== FEED_PLANETS.length
    || !planets.every(thousandths)) return null;
  if (ascendant === null && midheaven === null) {
    return { planets: [...planets], ascendant: null, midheaven: null };
  }
  if (!wholeDegree(ascendant) || !wholeDegree(midheaven)) return null;
  return { planets: [...planets], ascendant, midheaven };
}

/**
 * The chart the transit scanner reads: the stored planets, and each angle at
 * the middle of its whole degree, as the feed has always used them
 * (wholeDegreeAngle in share-positions.ts).
 */
export function natalChartFromFeed(positions: CalendarFeedPositions): NatalTransitChart {
  return {
    bodies: FEED_PLANETS.map((body, index) => ({ body, lon: positions.planets[index] })),
    angles: positions.ascendant === null || positions.midheaven === null
      ? null
      : { asc: positions.ascendant + 0.5, mc: positions.midheaven + 0.5 },
  };
}
