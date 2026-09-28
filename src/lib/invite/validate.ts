import {
  decodePositionsLink,
  encodePositionsLink,
  encodeSharedPositionsLink,
  POSITION_BODY_ORDER,
  type PositionsShareChart,
  type PositionsShareInput,
} from '../share-positions.js';
import { untimedSharedPositions } from '../share-positions-noon.js';
import type { SignSlug } from '../scene/types';
import { signForLongitude } from '../signs.js';
import type { InvitePublicPayload } from './types';

export const INVITE_LABEL_MAX = 24;
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/u;
export const INVITE_HASH_RE = /^[0-9a-f]{64}$/u;
export const INVITE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const FORBIDDEN_PAYLOAD_KEY = /(?:birth|date|time(?:zone)?|place|country|admin|lat|lon|email|address|recipient|user|account|chart.?id|note|message)/iu;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function cleanInviteLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const label = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!label || Array.from(label).length > INVITE_LABEL_MAX) return null;
  return label;
}

function labelFromChartName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const label = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!label) return null;
  return Array.from(label).slice(0, INVITE_LABEL_MAX).join('');
}

export function parseCreateInviteBody(value: unknown): {
  chartId: string;
  consent: true;
  notify: boolean;
} | null {
  let input = value;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { return null; }
  }
  const body = record(input);
  if (!body
    || Object.keys(body).length !== 3
    || !Object.prototype.hasOwnProperty.call(body, 'chartId')
    || !Object.prototype.hasOwnProperty.call(body, 'consent')
    || !Object.prototype.hasOwnProperty.call(body, 'notify')
    || typeof body.chartId !== 'string'
    || !INVITE_UUID_RE.test(body.chartId)
    || body.consent !== true
    || typeof body.notify !== 'boolean') return null;
  return { chartId: body.chartId, consent: true, notify: body.notify };
}

export function parseInviteIdBody(value: unknown): string | null {
  let input = value;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { return null; }
  }
  const body = record(input);
  return body
    && Object.keys(body).length === 1
    && typeof body.id === 'string'
    && INVITE_UUID_RE.test(body.id)
    ? body.id
    : null;
}

export function isEmptyJsonBody(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  let input = value;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { return false; }
  }
  const body = record(input);
  return body !== null && Object.keys(body).length === 0;
}

export interface InviteStoredPositions {
  b: number[];
  a?: [number, number];
  h: 'w' | 'p';
  v: string;
}

export interface InviteDerivedChart {
  label: string;
  sunSign: SignSlug;
  positions: InviteStoredPositions;
  timeKnown: boolean;
}

function toStoredPositions(chart: PositionsShareChart): InviteStoredPositions {
  const positions: InviteStoredPositions = {
    b: POSITION_BODY_ORDER.map((body) => chart.bodies.find((row) => row.body === body)!.lon),
    h: chart.houseSystem === 'whole' ? 'w' : 'p',
    v: chart.engineVersion,
  };
  if (chart.angles) positions.a = [chart.angles.asc, chart.angles.mc];
  return positions;
}

export function positionsFromStored(value: unknown): PositionsShareChart | null {
  const payload = record(value);
  if (!payload
    || Object.keys(payload).some((key) => FORBIDDEN_PAYLOAD_KEY.test(key))
    || !Array.isArray(payload.b)
    || payload.b.length !== POSITION_BODY_ORDER.length
    || !payload.b.every((longitude) => (
      typeof longitude === 'number'
      && Number.isFinite(longitude)
      && longitude >= 0
      && longitude < 360
    ))
    || (payload.h !== 'w' && payload.h !== 'p')
    || typeof payload.v !== 'string') return null;

  let angles: { asc: number; mc: number } | null = null;
  if (Object.prototype.hasOwnProperty.call(payload, 'a')) {
    if (!Array.isArray(payload.a)
      || payload.a.length !== 2
      || !payload.a.every((longitude) => (
        typeof longitude === 'number'
        && Number.isFinite(longitude)
        && longitude >= 0
        && longitude < 360
      ))) return null;
    angles = { asc: payload.a[0] as number, mc: payload.a[1] as number };
  }

  const token = encodePositionsLink({
    bodies: POSITION_BODY_ORDER.map((body, index) => ({
      body,
      lon: (payload.b as number[])[index],
    })),
    angles,
    houseSystem: payload.h === 'w' ? 'whole' : 'placidus',
    engineVersion: payload.v,
  });
  return token ? decodePositionsLink(token) : null;
}

/**
 * Derives the invitation payload from an RLS-owned synchronized chart row.
 * The invitee receives these positions, so ASC and MC are kept only to the
 * whole degree, as in every other code that leaves the device. Invitations
 * stored before this change keep their angles until they expire.
 *
 * A chart without a birth time was computed at noon at the birthplace, an
 * instant that gives the place away, so its invitation carries the sky at
 * 12:00 UTC on the birth date instead, from bodiesAt (the server ephemeris).
 * Without bodiesAt such a chart makes no invitation.
 */
export function deriveInviteChartFromSyncedPayload(
  value: unknown,
  bodiesAt?: (utc: Date) => PositionsShareInput['bodies'],
): InviteDerivedChart | null {
  const chart = record(value);
  const summary = record(chart?.summary);
  const birth = record(chart?.birth);
  if (!chart || !summary || !birth) return null;
  // Saved chart names predate the invitation label limit. Keep the complete
  // name in the private chart picker, but store only a bounded display label
  // in the one-time invitation payload.
  const label = labelFromChartName(chart.name);
  const timeKnown = birth.timeKnown === true;
  const rawBodies = Array.isArray(summary.bodies) ? summary.bodies : [];
  const base = {
    houseSystem: summary.houseSystem,
    engineVersion: summary.engineVersion,
  } as Pick<PositionsShareInput, 'houseSystem' | 'engineVersion'>;
  const input = timeKnown
    ? {
      ...base,
      bodies: rawBodies.map((item) => {
        const row = record(item);
        return { body: row?.body, lon: row?.lon };
      }),
      angles: summary.angles,
    } as PositionsShareInput
    : bodiesAt && typeof birth.date === 'string'
      ? untimedSharedPositions(base, birth.date, bodiesAt)
      : null;
  const token = input ? encodeSharedPositionsLink(input) : null;
  const positions = token ? decodePositionsLink(token) : null;
  const sun = positions?.bodies.find((body) => body.body === 'Sun');
  if (!label || !positions || !sun || (timeKnown !== (positions.angles !== null))) return null;
  return {
    label,
    sunSign: signForLongitude(sun.lon).slug as SignSlug,
    positions: toStoredPositions(positions),
    timeKnown,
  };
}

export function parseInvitePublicPayload(value: unknown): InvitePublicPayload | null {
  const payload = record(value);
  if (!payload
    || payload.version !== 1
    || typeof payload.expiresAt !== 'string'
    || !Number.isFinite(Date.parse(payload.expiresAt))) return null;
  const label = cleanInviteLabel(payload.label);
  const positions = positionsFromStored(payload.positions);
  const sun = positions?.bodies.find((body) => body.body === 'Sun');
  if (!label
    || !positions
    || !sun
    || payload.timeKnown !== (positions.angles !== null)
    || typeof payload.sunSign !== 'string'
    || signForLongitude(sun.lon).slug !== payload.sunSign) return null;
  return {
    version: 1,
    label,
    sunSign: payload.sunSign as SignSlug,
    positions,
    timeKnown: payload.timeKnown as boolean,
    expiresAt: payload.expiresAt,
  };
}
