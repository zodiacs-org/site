import { POSITION_BODY_ORDER } from '../share-positions';
import type { SavedChart, SavedPlace } from '../profile/schema';
import { isAccountChartLabel } from './chart-label';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

interface ReadyRemoteChart {
  chartId: string;
  label: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  birth: SavedChart['birth'];
  positions: {
    bodies: number[];
    angles: [number, number] | null;
    houseSystem: 'whole' | 'placidus';
    engineVersion: string;
  };
}

/** Strictly parses the decrypted server projection; ciphertext is never accepted here. */
export function parseReadyRemoteChart(input: unknown): ReadyRemoteChart | null {
  if (!recordWithKeys(input, [
    'outcome', 'chart_id', 'label', 'subject_kind', 'subject_attestation',
    'revision', 'created_at', 'updated_at', 'derived', 'birth',
  ])
    || input.outcome !== 'ready'
    || typeof input.chart_id !== 'string'
    || !UUID.test(input.chart_id)
    || !isAccountChartLabel(input.label)
    || input.subject_kind !== 'self'
    || input.subject_attestation !== 'self_declared_v1'
    || !safeRevision(input.revision)
    || !iso(input.created_at)
    || !iso(input.updated_at)) return null;
  const birth = parseBirth(input.birth);
  const positions = parseDerived(input.derived, birth?.timeKnown);
  return birth && positions
    ? {
        chartId: input.chart_id,
        label: input.label,
        revision: input.revision,
        createdAt: input.created_at,
        updatedAt: input.updated_at,
        birth,
        positions,
      }
    : null;
}

/** Recomputes restored summaries locally when possible; the encrypted source remains authoritative. */
export async function savedChartFromRemote(input: unknown): Promise<{
  chart: SavedChart;
  revision: number;
} | null> {
  const parsed = parseReadyRemoteChart(input);
  if (!parsed) return null;

  const fallback = (): SavedChart => ({
    id: parsed.chartId,
    name: parsed.label,
    relationship: 'self',
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
    birth: structuredClone(parsed.birth),
    summary: {
      engineVersion: parsed.positions.engineVersion,
      utcISO: `${parsed.birth.date}T12:00:00.000Z`,
      houseSystem: parsed.positions.houseSystem,
      bodies: POSITION_BODY_ORDER.map((body, index) => ({
        body,
        lon: parsed.positions.bodies[index]!,
        retrograde: false,
      })),
      angles: parsed.positions.angles
        ? { asc: parsed.positions.angles[0], mc: parsed.positions.angles[1] }
        : null,
      flags: parsed.birth.timeKnown ? [] : ['no-time'],
    },
  });

  if (!parsed.birth.place) return { chart: fallback(), revision: parsed.revision };
  try {
    const [{ computeChart }, { prepareLocalTime, resolveLocalToUtc }] = await Promise.all([
      import('../engine/full'),
      import('../time/localToUtc'),
    ]);
    await prepareLocalTime(parsed.birth.date, parsed.birth.place.tz);
    const resolved = resolveLocalToUtc(
      parsed.birth.date,
      parsed.birth.timeKnown && parsed.birth.time ? parsed.birth.time : '12:00',
      parsed.birth.place.tz,
      {
        longitude: parsed.birth.place.lon,
        reconstructedCalendar: true,
      },
    );
    const computed = computeChart({
      utc: resolved.utc,
      latitude: parsed.birth.place.lat,
      longitude: parsed.birth.place.lon,
      houseSystem: parsed.positions.houseSystem,
      timeKnown: parsed.birth.timeKnown,
      flags: resolved.flags,
    });
    return {
      revision: parsed.revision,
      chart: {
        id: parsed.chartId,
        name: parsed.label,
        relationship: 'self',
        createdAt: parsed.createdAt,
        updatedAt: parsed.updatedAt,
        birth: structuredClone(parsed.birth),
        summary: {
          engineVersion: computed.engineVersion,
          utcISO: resolved.utc.toISOString(),
          houseSystem: parsed.positions.houseSystem,
          bodies: computed.bodies.map(({ body, lon, retrograde }) => ({ body, lon, retrograde })),
          angles: computed.angles ? { asc: computed.angles.asc, mc: computed.angles.mc } : null,
          flags: computed.flags,
        },
      },
    };
  } catch {
    return { chart: fallback(), revision: parsed.revision };
  }
}

function parseBirth(input: unknown): SavedChart['birth'] | null {
  if (!recordWithKeys(input, ['date', 'time', 'timeKnown', 'place'])
    || typeof input.date !== 'string'
    || !DATE.test(input.date)
    || !calendarDate(input.date)
    || typeof input.timeKnown !== 'boolean'
    || (input.timeKnown && (typeof input.time !== 'string' || !TIME.test(input.time)))
    || (!input.timeKnown && input.time !== null)) return null;
  const place = input.place === null ? null : parsePlace(input.place);
  return place === undefined ? null : {
    date: input.date,
    time: input.time as string | null,
    timeKnown: input.timeKnown,
    place,
  };
}

function parsePlace(input: unknown): SavedPlace | null | undefined {
  if (!recordWithKeys(input, ['name', 'admin1', 'country', 'lat', 'lon', 'tz'])
    || typeof input.name !== 'string'
    || typeof input.admin1 !== 'string'
    || typeof input.country !== 'string'
    || typeof input.tz !== 'string'
    || typeof input.lat !== 'number'
    || !Number.isFinite(input.lat)
    || input.lat < -90
    || input.lat > 90
    || typeof input.lon !== 'number'
    || !Number.isFinite(input.lon)
    || input.lon < -180
    || input.lon > 180) return undefined;
  return {
    name: input.name,
    admin1: input.admin1,
    country: input.country,
    lat: input.lat,
    lon: input.lon,
    tz: input.tz,
  };
}

function parseDerived(
  input: unknown,
  expectedTimeKnown: boolean | undefined,
): ReadyRemoteChart['positions'] | null {
  if (expectedTimeKnown === undefined
    || !recordWithKeys(input, ['positions', 'time_known', 'sun_sign', 'engine_version', 'house_system'])
    || input.time_known !== expectedTimeKnown
    || typeof input.sun_sign !== 'string'
    || ![
      'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
      'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
    ].includes(input.sun_sign)
    || (input.house_system !== 'whole' && input.house_system !== 'placidus')
    || typeof input.engine_version !== 'string'
    || input.engine_version.length < 1
    || !recordWithKeys(input.positions, expectedTimeKnown ? ['a', 'b', 'h', 'v'] : ['b', 'h', 'v'])
    || !Array.isArray(input.positions.b)
    || input.positions.b.length !== 12
    || !input.positions.b.every(longitude)
    || input.positions.v !== input.engine_version
    || input.positions.h !== (input.house_system === 'whole' ? 'w' : 'p')
    || Math.floor(input.positions.b[0] / 30) !== [
      'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
      'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
    ].indexOf(input.sun_sign)) return null;
  let angles: [number, number] | null = null;
  if (expectedTimeKnown) {
    if (!Array.isArray(input.positions.a)
      || input.positions.a.length !== 2
      || !input.positions.a.every(longitude)) return null;
    angles = [input.positions.a[0], input.positions.a[1]];
  }
  return {
    bodies: [...input.positions.b],
    angles,
    houseSystem: input.house_system,
    engineVersion: input.engine_version,
  };
}

function recordWithKeys<T extends readonly string[]>(
  input: unknown,
  keys: T,
): input is Record<T[number], any> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const actual = Object.keys(input).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safeRevision(input: unknown): input is number {
  return Number.isSafeInteger(input) && (input as number) >= 1;
}

function iso(input: unknown): input is string {
  return typeof input === 'string' && Number.isFinite(Date.parse(input));
}

function longitude(input: unknown): input is number {
  return typeof input === 'number' && Number.isFinite(input) && input >= 0 && input < 360;
}

function calendarDate(input: string): boolean {
  const [year, month, day] = input.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month! - 1
    && date.getUTCDate() === day;
}
