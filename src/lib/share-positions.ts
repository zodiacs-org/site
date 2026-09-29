/**
 * Positions-only share-link codec. Unlike the v1 birth-input token in
 * share.ts, this v2 token can reconstruct only a read-only chart: it
 * deliberately has no field for a date, time, timezone, coordinates, name,
 * place, or flags. This module stays separate so the normal calculator path
 * can load it on demand.
 *
 * Longitudes are stored to 3 decimal places. The maximum rounding error is
 * 0.0005° (1.8 arcseconds), comfortably below both the engine's accuracy
 * gate and the chart's displayed precision, while avoiding false precision
 * and keeping the fragment compact.
 *
 * A code that leaves the device (a chart link, the transit calendar feed, a
 * two-chart link, an invitation, a chart card) is made with
 * encodeSharedPositionsLink, which keeps ASC and MC only to the whole degree
 * (see wholeDegreeAngle). Its bodies are those at the chart's UTC instant
 * rounded to the whole minute; a chart without a birth time has no angles,
 * and its code carries the sky at 12:00 UTC on the birth date instead of the
 * chart's own positions (see share-positions-noon.ts).
 * share-positions-callers.test.ts holds every producer of a shared code to
 * these rules.
 */
import type {
  Angles, BodyName, BodyPosition, HouseSystem,
} from './engine/types.js';

export const POSITION_BODY_ORDER = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter',
  'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node',
] as const satisfies readonly BodyName[];

export interface PositionsShareBody {
  body: BodyName;
  lon: number;
}

export interface PositionsShareInput {
  /** Full engine body rows are accepted; only body and longitude are read. */
  bodies: readonly Pick<BodyPosition, 'body' | 'lon'>[];
  /** Null for a no-time chart. DSC and IC are derivable and are not stored. */
  angles: Pick<Angles, 'asc' | 'mc'> | null;
  houseSystem: HouseSystem;
  engineVersion: string;
}

export interface PositionsShareChart {
  /** Always returned in POSITION_BODY_ORDER, regardless of encoder input order. */
  bodies: PositionsShareBody[];
  angles: Pick<Angles, 'asc' | 'mc'> | null;
  houseSystem: HouseSystem;
  engineVersion: string;
}

const POSITIONS_VERSION_PREFIX = '2.';
const POSITION_DECIMAL_FACTOR = 1e3;
const POSITIONS_TOKEN_MAX_LENGTH = 256;
const ENGINE_VERSION_MAX_LENGTH = 32;
const ENGINE_VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,31}$/;
const POSITION_BODY_SET: ReadonlySet<string> = new Set(POSITION_BODY_ORDER);

/** Wire shape. Key names and body order are part of the v2 contract. */
interface PositionsWire {
  b: number[];             // longitudes in POSITION_BODY_ORDER
  a?: [number, number];    // [asc, mc]; absent for no-time charts
  h: 'w' | 'p';            // whole / placidus
  v: string;               // engine version
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const bin = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function validLongitude(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value < 360;
}

function roundLongitude(value: number): number {
  const rounded = Math.round(value * POSITION_DECIMAL_FACTOR) / POSITION_DECIMAL_FACTOR;
  // 359.9995° rounds to the equivalent canonical longitude 0°.
  if (rounded >= 360 || Object.is(rounded, -0)) return 0;
  return rounded;
}

function validEngineVersion(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= ENGINE_VERSION_MAX_LENGTH
    && ENGINE_VERSION_RE.test(value);
}

function canonicalLongitudes(
  bodies: readonly Pick<BodyPosition, 'body' | 'lon'>[],
): number[] | null {
  if (!Array.isArray(bodies) || bodies.length !== POSITION_BODY_ORDER.length) return null;

  const byBody = new Map<BodyName, number>();
  for (const position of bodies) {
    if (typeof position !== 'object' || position === null) return null;
    if (!POSITION_BODY_SET.has(position.body) || byBody.has(position.body)) return null;
    if (!validLongitude(position.lon)) return null;
    byBody.set(position.body, roundLongitude(position.lon));
  }

  const ordered: number[] = [];
  for (const body of POSITION_BODY_ORDER) {
    const longitude = byBody.get(body);
    if (longitude === undefined) return null;
    ordered.push(longitude);
  }
  return ordered;
}

/**
 * Encode a positions-only chart token with every value, angles included, to
 * 0.001°. Runtime-invalid input returns null rather than emitting a token that
 * its strict decoder rejects. For a code that leaves the device, use
 * encodeSharedPositionsLink.
 */
export function encodePositionsLink(input: PositionsShareInput): string | null {
  if (typeof input !== 'object' || input === null) return null;
  const longitudes = canonicalLongitudes(input.bodies);
  if (!longitudes || !validEngineVersion(input.engineVersion)) return null;
  if (input.houseSystem !== 'whole' && input.houseSystem !== 'placidus') return null;

  const wire: PositionsWire = {
    b: longitudes,
    h: input.houseSystem === 'whole' ? 'w' : 'p',
    v: input.engineVersion,
  };
  if (input.angles !== null) {
    if (typeof input.angles !== 'object'
      || !validLongitude(input.angles.asc)
      || !validLongitude(input.angles.mc)) return null;
    wire.a = [roundLongitude(input.angles.asc), roundLongitude(input.angles.mc)];
  }

  const token = POSITIONS_VERSION_PREFIX
    + toBase64Url(new TextEncoder().encode(JSON.stringify(wire)));
  return token.length <= POSITIONS_TOKEN_MAX_LENGTH ? token : null;
}

/**
 * The middle of the whole degree an angle falls in: 123.456° becomes 123.5°.
 * The sign and the whole degree stay as they were, and the error is at most
 * 0.5°. In the code of a chart with a birth time, ASC and MC depend on where
 * the birth took place. The planets, the Moon and the nodes stay at 0.001°,
 * so the birth date and time can still be worked out from a shared code, to
 * the minute: they are taken at the chart's UTC instant rounded to the whole
 * minute (sharedTimedInstant), because before standard time the instant
 * itself depends on the place, and its seconds would give the birthplace's
 * longitude to within strips about 3 km wide. share-positions.test.ts
 * measures the region the rounded angles leave for the birthplace at every
 * latitude the place index reaches, and that the seconds are gone.
 *
 * A chart without a birth time is computed at 12:00 at the birthplace, an
 * instant that depends on the place, so its own positions are never shared
 * (see share-positions-noon.ts).
 */
export function wholeDegreeAngle(longitude: number): number {
  return typeof longitude === 'number' ? Math.floor(longitude) + 0.5 : Number.NaN;
}

export function wholeDegreeAngles(
  angles: Pick<Angles, 'asc' | 'mc'>,
): Pick<Angles, 'asc' | 'mc'> {
  return { asc: wholeDegreeAngle(angles.asc), mc: wholeDegreeAngle(angles.mc) };
}

/**
 * encodePositionsLink with ASC and MC at the whole degree. Every code that
 * leaves the device is made here; encodePositionsLink alone stays exact for
 * the charts a person keeps for themselves. The input must already carry
 * timedSharedPositions or untimedSharedPositions (share-positions-noon.ts),
 * or be a code that was received and is passed on unchanged.
 */
export function encodeSharedPositionsLink(input: PositionsShareInput): string | null {
  if (typeof input !== 'object' || input === null) return null;
  const { angles } = input;
  if (angles === null || typeof angles !== 'object') return encodePositionsLink(input);
  return encodePositionsLink({ ...input, angles: wholeDegreeAngles(angles) });
}

const POSITIONS_WIRE_KEYS = new Set(['b', 'a', 'h', 'v']);

function hasExactPositionsKeys(wire: Record<string, unknown>): boolean {
  const keys = Object.keys(wire);
  const expectedCount = Object.prototype.hasOwnProperty.call(wire, 'a') ? 4 : 3;
  return keys.length === expectedCount
    && Object.prototype.hasOwnProperty.call(wire, 'b')
    && Object.prototype.hasOwnProperty.call(wire, 'h')
    && Object.prototype.hasOwnProperty.call(wire, 'v')
    && keys.every((key) => POSITIONS_WIRE_KEYS.has(key));
}

/** Decode a v2 positions token. Hostile input always resolves to null. */
export function decodePositionsLink(token: string): PositionsShareChart | null {
  try {
    if (typeof token !== 'string'
      || token.length > POSITIONS_TOKEN_MAX_LENGTH
      || !token.startsWith(POSITIONS_VERSION_PREFIX)) return null;

    const payload = token.slice(POSITIONS_VERSION_PREFIX.length);
    const bytes = fromBase64Url(payload);
    // Reject alternative/non-canonical base64 spellings of the same bytes.
    if (!bytes || toBase64Url(bytes) !== payload) return null;

    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(json);
    // Accept only the encoder's compact canonical JSON. Besides keeping one
    // wire spelling, this rejects duplicate keys even when a key is escaped
    // (`"b"` plus `"\u0062"`), which JSON.parse would otherwise resolve by
    // silently keeping the last value.
    if (JSON.stringify(parsed) !== json) return null;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const wire = parsed as Record<string, unknown>;
    if (!hasExactPositionsKeys(wire)) return null;

    if (!Array.isArray(wire.b)
      || wire.b.length !== POSITION_BODY_ORDER.length
      || !wire.b.every(validLongitude)) return null;
    if (wire.h !== 'w' && wire.h !== 'p') return null;
    if (!validEngineVersion(wire.v)) return null;

    let angles: Pick<Angles, 'asc' | 'mc'> | null = null;
    if (Object.prototype.hasOwnProperty.call(wire, 'a')) {
      if (!Array.isArray(wire.a)
        || wire.a.length !== 2
        || !wire.a.every(validLongitude)) return null;
      angles = { asc: wire.a[0], mc: wire.a[1] };
    }

    return {
      bodies: POSITION_BODY_ORDER.map((body, index) => ({
        body,
        lon: (wire.b as number[])[index],
      })),
      angles,
      houseSystem: wire.h === 'w' ? 'whole' : 'placidus',
      engineVersion: wire.v,
    };
  } catch {
    return null;
  }
}
