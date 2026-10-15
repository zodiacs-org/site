/**
 * The moon-phase calculator's lookup for its WebMCP tool: the same reading as the page's
 * (src/islands/MoonPhaseTool.tsx), which moon-phase.test.ts holds it to, so an agent gets the answer the page shows.
 *
 * The Moon's phase, illumination and longitude for a date. Without a time it reads noon: local noon at a place,
 * which must fall within that local date, or noon UTC without one. Without a place, a time is read as UTC.
 */
import { moonPhaseNameFromAngle, type MoonPhaseName } from '../../engine/lite';
import { prepareLocalTime, resolveLocalToUtc } from '../../time/localToUtc';
import { assessLocalDateReference } from '../../time/local-date-reference';

export interface MoonPhasePlace {
  /** Longitude, degrees east: local mean time before standard time reads it. */
  lon: number;
  /** IANA time zone. */
  tz: string;
}

export interface MoonPhaseRequest {
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM, or null for the noon reference. */
  time: string | null;
  place: MoonPhasePlace | null;
}

/** How the instant was read: a local time, local noon, a UTC time, or noon UTC. */
export type MoonPhaseBasis = 'local-time' | 'local-reference' | 'utc-time' | 'utc-reference';

export interface MoonPhaseLookup {
  computedUtc: Date;
  /** True when no time was given and noon was read. */
  reference: boolean;
  basis: MoonPhaseBasis;
  phase: MoonPhaseName;
  /** Moon minus Sun in ecliptic longitude, degrees 0–360: 0 new, 180 full. */
  angle: number;
  /** Lit fraction of the disc, 0–1. */
  illum: number;
  /** The Moon's tropical ecliptic longitude, degrees. */
  lon: number;
}

/** Local noon could not be placed within the local date (a zone change at midday). */
export class LocalDateReferenceError extends Error {
  constructor() {
    super('Could not establish a calculation time within the local date.');
    this.name = 'LocalDateReferenceError';
  }
}

interface MoonPhaseEngine {
  bodyLongitude(name: 'Sun' | 'Moon', date: Date): number;
}

export function moonIlluminationFromAngle(angle: number): number {
  return (1 - Math.cos((angle * Math.PI) / 180)) / 2;
}

/** The lookup itself. With a place it first loads the zone's history the resolver needs, as the page does. */
export async function lookupMoonPhase(request: MoonPhaseRequest, engine: MoonPhaseEngine): Promise<MoonPhaseLookup> {
  const { date, place } = request;
  const time = request.time === '' ? null : request.time;
  let utc: Date;
  if (place) {
    await prepareLocalTime(date, place.tz);
    utc = resolveLocalToUtc(date, time ?? '12:00', place.tz, { longitude: place.lon }).utc;
    if (time === null) {
      try {
        if (assessLocalDateReference(date, utc, place.tz).referenceStatus !== 'member') throw new LocalDateReferenceError();
      } catch {
        throw new LocalDateReferenceError();
      }
    }
  } else {
    utc = new Date(`${date}T${time ?? '12:00'}:00Z`);
  }
  const lon = engine.bodyLongitude('Moon', utc);
  const sunLon = engine.bodyLongitude('Sun', utc);
  const angle = (((lon - sunLon) % 360) + 360) % 360;
  const basis: MoonPhaseBasis = place
    ? (time === null ? 'local-reference' : 'local-time')
    : (time === null ? 'utc-reference' : 'utc-time');
  return {
    computedUtc: utc,
    reference: time === null,
    basis,
    phase: moonPhaseNameFromAngle(angle),
    angle,
    illum: moonIlluminationFromAngle(angle),
    lon,
  };
}
