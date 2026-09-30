/**
 * The compute API's part of the /api/v1 OpenAPI 3.1 document: a JSON Schema
 * (draft 2020-12, as OpenAPI 3.1 uses) for every request and response, and an
 * example of each, taken from examples.ts and the handler's own answers in
 * examples.json. src/lib/sky-api/schemas.ts merges these into the document it
 * builds for the static sky data.
 *
 * Request schemas are closed: a field they do not name is refused. Response
 * schemas are open, because within v1 fields are added, never renamed or
 * removed. A schema cannot state every rule the server applies (a real
 * calendar date, an offset that keeps an instant inside the epoch, a zone the
 * server's time zone data knows, an events window whose `to` is after its
 * `from`); those are refused with invalid-request too.
 */
import {
  COMPUTE_DOCS_URL,
  COMPUTE_RECEIPT_SCHEMA,
  COMPUTE_ENDPOINTS,
  ERROR_CODES,
  PREFLIGHT_HEADERS,
  RETRY_AFTER_SECONDS,
  EVENT_BODIES,
  EVENT_KINDS,
  HOUSE_SYSTEM_NAMES,
  MAX_BODY_BYTES,
  PHASE_NAMES,
  POSITION_BODIES,
  SIGN_SLUGS,
  BUDGETS,
  computeDocsUrl,
  computePath,
  responseSchemaName,
  type ComputeEndpoint,
} from './constants.js';
import examples from './examples.json';
import { REFUSAL_EXAMPLES, SUCCESS_EXAMPLES } from './examples.js';

type Schema = Record<string, unknown>;
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] });

const YEAR = '(?:18|19|20|21)\\d{2}';
const DATE = `${YEAR}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])`;
const CLOCK = '(?:[01]\\d|2[0-3]):[0-5]\\d';
const OFFSET = '(?:Z|[+-](?:(?:0\\d|1[0-3]):[0-5]\\d|14:00))';

const outputInstant = { type: 'string', format: 'date-time' };
const bodyName = { enum: [...POSITION_BODIES] };
const eventBody = { enum: [...EVENT_BODIES] };
const sign = { enum: [...SIGN_SLUGS] };
const num = { type: 'number' };
const bool = { type: 'boolean' };
const str = { type: 'string' };
const ZONE_PATTERN = '^[A-Za-z][A-Za-z0-9_+-]*(?:/[A-Za-z0-9_+-]+){0,3}$';
const requestZone = {
  type: 'string',
  maxLength: 64,
  pattern: ZONE_PATTERN,
  description: 'An IANA time zone name, such as Europe/Paris, in any letter case. The answer names it as tzdb spells it.',
};
const spanFlags = { type: 'array', items: { const: 'outside-reference-span' }, maxItems: 1 };
const list = (items: Schema): Schema => ({ type: 'array', items });
const object = (required: string[], properties: Record<string, unknown>, description?: string): Schema => ({
  type: 'object',
  required,
  properties,
  ...(description ? { description } : {}),
});

export const COMPUTE_SCHEMAS: Readonly<Record<string, Schema>> = Object.freeze({
  Instant: {
    type: 'string',
    maxLength: 29,
    pattern: `^${DATE}T${CLOCK}(?::[0-5]\\d(?:\\.\\d{1,3})?)?${OFFSET}$`,
    description: 'An instant in ISO 8601 with Z or a numeric offset, from 1800-01-01T00:00:00Z to 2199-12-31T23:59:59.999Z once the offset is applied.',
    examples: ['2000-01-01T12:00:00Z', '1990-06-15T14:30:00+02:00'],
  },
  LocalTime: {
    type: 'object',
    additionalProperties: false,
    required: ['date', 'time', 'zone'],
    description: 'A wall-clock date and time in an IANA time zone, read as the site\'s birth chart calculator reads one.',
    properties: {
      date: { type: 'string', pattern: `^${DATE}$`, description: 'A real proleptic Gregorian date, 1800-01-01 to 2199-12-31.' },
      time: { type: 'string', pattern: `^${CLOCK}$`, description: 'Hours and minutes, 00:00 to 23:59.' },
      zone: requestZone,
    },
  },
  Latitude: { type: 'number', exclusiveMinimum: -90, exclusiveMaximum: 90, description: 'Degrees north. The poles are refused: the engine does not compute angles there.' },
  Longitude: { type: 'number', minimum: -180, maximum: 180, description: 'Degrees east.' },
  HouseSystem: { enum: [...HOUSE_SYSTEM_NAMES], description: 'One of the engine\'s thirteen house systems.' },

  PlaceInstantRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['latitude', 'longitude'],
    oneOf: [{ required: ['utc'] }, { required: ['local'] }],
    properties: {
      utc: ref('Instant'),
      local: ref('LocalTime'),
      latitude: ref('Latitude'),
      longitude: ref('Longitude'),
      houseSystem: { ...ref('HouseSystem'), default: 'placidus' },
    },
    description: 'Exactly one of utc and local, a place, and a house system (placidus when omitted).',
  },
  PositionsRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['instants'],
    properties: {
      instants: { type: 'array', minItems: 1, maxItems: BUDGETS['positions.instants'], items: ref('Instant') },
      bodies: { type: 'array', minItems: 1, uniqueItems: true, items: bodyName, description: 'Rows to return; all twelve when omitted.' },
    },
  },
  EventsRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['from', 'to'],
    description: `A window of at most ${BUDGETS['events.windowDays']} days, from its start (excluded) to its end (included). The end must be later than the start, which the schema cannot state.`,
    properties: {
      from: ref('Instant'),
      to: ref('Instant'),
      bodies: { type: 'array', minItems: 1, uniqueItems: true, items: { enum: [...EVENT_BODIES] }, description: 'All ten when omitted.' },
      kinds: { type: 'array', minItems: 1, uniqueItems: true, items: { enum: [...EVENT_KINDS] }, description: 'All three when omitted.' },
    },
  },
  TimeRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['local'],
    properties: {
      local: ref('LocalTime'),
      longitude: { ...ref('Longitude'), description: 'The place\'s longitude, degrees east. With it, a time before the place adopted a legal time uses the place\'s own mean time, and a date up to 1970-01-01 the pinned zone history.' },
    },
  },
  SkyFactRequest: {
    oneOf: [ref('SignFact'), ref('RetrogradeFact'), ref('IngressFact'), ref('PhaseFact')],
    discriminator: {
      propertyName: 'kind',
      mapping: {
        sign: '#/components/schemas/SignFact',
        retrograde: '#/components/schemas/RetrogradeFact',
        ingress: '#/components/schemas/IngressFact',
        phase: '#/components/schemas/PhaseFact',
      },
    },
  },
  SignFact: {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'body', 'sign'],
    oneOf: [
      { required: ['instant'], not: { anyOf: [{ required: ['date'] }, { required: ['zone'] }] } },
      { required: ['date'], not: { required: ['instant'] } },
    ],
    properties: {
      kind: { const: 'sign' },
      body: { enum: [...EVENT_BODIES] },
      sign,
      instant: ref('Instant'),
      date: { type: 'string', pattern: `^${DATE}$` },
      zone: requestZone,
    },
  },
  RetrogradeFact: {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'body'],
    oneOf: [
      { required: ['instant'], not: { anyOf: [{ required: ['date'] }, { required: ['zone'] }] } },
      { required: ['date'], not: { required: ['instant'] } },
    ],
    properties: {
      kind: { const: 'retrograde' },
      body: { enum: [...EVENT_BODIES] },
      instant: ref('Instant'),
      date: { type: 'string', pattern: `^${DATE}$` },
      zone: requestZone,
    },
  },
  IngressFact: {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'body', 'sign', 'date'],
    properties: {
      kind: { const: 'ingress' },
      body: { enum: [...EVENT_BODIES] },
      sign,
      date: { type: 'string', pattern: `^${DATE}$` },
      zone: requestZone,
    },
  },
  PhaseFact: {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'phase', 'date'],
    properties: {
      kind: { const: 'phase' },
      phase: { enum: [...PHASE_NAMES] },
      date: { type: 'string', pattern: `^${DATE}$` },
      zone: requestZone,
    },
  },

  BodyPosition: {
    type: 'object',
    required: ['body', 'lon', 'lat', 'speed', 'retrograde', 'sign', 'degree'],
    properties: {
      body: bodyName,
      lon: { type: 'number', minimum: 0, exclusiveMaximum: 360, description: 'Tropical ecliptic longitude of date, degrees.' },
      lat: { type: 'number', description: 'Ecliptic latitude, degrees; zero for the nodes.' },
      speed: { type: 'number', description: 'Degrees per day; negative is retrograde.' },
      retrograde: bool,
      sign,
      degree: { type: 'number', minimum: 0, exclusiveMaximum: 30 },
    },
  },
  Angles: { type: 'object', required: ['asc', 'mc', 'dsc', 'ic'], properties: { asc: num, mc: num, dsc: num, ic: num } },
  Houses: {
    type: 'object',
    required: ['system', 'cusps'],
    properties: { system: ref('HouseSystem'), cusps: { type: 'array', minItems: 12, maxItems: 12, items: num } },
    description: 'The system the engine used, which can differ from the one requested (see flags and the receipt), and twelve cusps, the first house first.',
  },
  Aspect: {
    type: 'object',
    required: ['a', 'b', 'type', 'orb', 'applying'],
    properties: {
      a: bodyName,
      b: bodyName,
      type: { enum: ['conjunction', 'sextile', 'square', 'trine', 'opposition'] },
      orb: num,
      applying: bool,
    },
  },
  ChartFlag: { enum: ['dst-gap', 'dst-fold', 'lmt', 'no-time', 'polar-fallback', 'outside-reference-span'] },
  DeltaT: {
    type: 'object',
    required: ['seconds', 'sigma', 'model', 'table', 'tableDigest', 'segment'],
    description: 'ΔT = TT − UT1 in seconds, with its 1-sigma band and where it came from, as the engine reports it.',
    properties: {
      seconds: num,
      sigma: { type: ['number', 'null'] },
      model: str,
      table: { type: ['string', 'null'] },
      tableDigest: { type: ['string', 'null'] },
      segment: { enum: ['long-term', 'reconstructed', 'observed', 'predicted', 'extrapolated', 'pinned'] },
    },
  },
  LocalResolution: {
    type: 'object',
    required: ['offsetMinutes', 'flags', 'localMeanTime', 'zoneHistory', 'zoneUncertain'],
    description: 'How a local time was read: the offset applied, the resolver\'s flags, the birthplace\'s own mean time if it was used, and which zone history gave the offset.',
    properties: {
      offsetMinutes: { type: 'number', description: 'Minutes east of UTC; fractional before standard time.' },
      flags: { type: 'array', items: { enum: ['dst-gap', 'dst-fold', 'lmt'] } },
      localMeanTime: nullable({ type: 'object', required: ['longitude', 'zoneOffsetMinutes'], properties: { longitude: num, zoneOffsetMinutes: num } }),
      zoneHistory: { enum: ['pinned', 'runtime'] },
      zoneUncertain: bool,
    },
  },
  CalculationReceipt: {
    type: 'object',
    description: 'The engine\'s own receipt for a chart, as createNatalEnvelope writes it.',
    required: ['schema', 'instant', 'timeKnown', 'reference', 'localResolution', 'coordinates', 'houses', 'inputFlags', 'resultFlags', 'engine', 'provenance', 'conventions', 'coverage'],
    properties: {
      schema: { const: 'zodiacs.calculation-receipt.draft-v1' },
      instant: outputInstant,
      sourceInstant: { type: ['string', 'null'] },
      timeKnown: bool,
      reference: { enum: ['supplied-instant', 'utc-noon', 'local-noon'] },
      localResolution: nullable({ type: 'object' }),
      coordinates: nullable({ type: 'object', required: ['latitude', 'longitude'], properties: { latitude: num, longitude: num } }),
      houses: { type: 'object', required: ['requested', 'actual', 'absenceReason'] },
      inputFlags: { type: 'array', items: ref('ChartFlag') },
      resultFlags: { type: 'array', items: ref('ChartFlag') },
      engine: ref('Backend'),
      provenance: nullable({ type: 'object' }),
      conventions: { type: 'object', additionalProperties: str },
      coverage: { type: 'object', additionalProperties: str },
    },
  },
  ComputeReceipt: {
    type: 'object',
    description: 'The receipt for a calculation the engine writes no receipt for: the engine, its conventions and coverage as its own receipts state them, and what this request used.',
    required: ['schema', 'endpoint', 'engine', 'conventions', 'coverage', 'referenceSpan', 'deltaT'],
    properties: {
      schema: { const: COMPUTE_RECEIPT_SCHEMA },
      endpoint: { enum: [...COMPUTE_ENDPOINTS] },
      engine: ref('Backend'),
      conventions: { type: 'object', additionalProperties: str },
      coverage: { type: 'object', additionalProperties: str },
      referenceSpan: { type: 'object', required: ['from', 'to'], properties: { from: outputInstant, to: outputInstant } },
      deltaT: { type: 'object', required: ['model', 'table', 'tableDigest'], properties: { model: str, table: str, tableDigest: str } },
      timeResolution: {
        type: 'object',
        required: ['resolver', 'policy', 'pinnedTzdb', 'runtimeTzdb'],
        properties: {
          resolver: str,
          policy: { type: 'object', properties: { fold: { const: 'earlier' }, gap: { const: 'shift-forward' } } },
          pinnedTzdb: { type: 'object' },
          runtimeTzdb: { type: ['string', 'null'] },
        },
      },
      search: {
        type: 'object',
        required: ['solver', 'stepDays', 'bisections', 'samples', 'maxSamples', 'window', 'completeness'],
        properties: {
          solver: { const: 'engine-longitude-crossings' },
          stepDays: { type: 'object', additionalProperties: num },
          bisections: { type: 'integer' },
          samples: { type: 'integer', minimum: 0 },
          maxSamples: { type: 'integer' },
          window: { const: 'start-exclusive-end-inclusive' },
          completeness: { const: 'tested-not-proven' },
        },
      },
    },
  },
  Backend: {
    type: 'object',
    required: ['name', 'version', 'ephemeris'],
    properties: {
      name: { const: '@zodiacs/engine' },
      version: str,
      ephemeris: { type: 'object', required: ['name', 'version'], properties: { name: { const: 'astronomy-engine' }, version: str } },
    },
  },
  Cite: {
    type: 'object',
    additionalProperties: false,
    required: ['url', 'receipt', 'engine', 'version'],
    description: 'What to quote: the documentation of this endpoint, a digest that identifies the receipt in this response (SHA-256 over its RFC 8785 canonical JSON), and the engine and its version. For chart and houses the receipt holds the instant and the coordinates, so the digest identifies the birth details: anyone who knows the date and the place can find the time by trying times until the digest matches. Quote it only where the birth details may be known.',
    properties: {
      url: { type: 'string', format: 'uri' },
      receipt: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
      engine: { const: '@zodiacs/engine' },
      version: str,
    },
  },

  ChartResult: {
    type: 'object',
    required: ['instant', 'local', 'bodies', 'angles', 'houses', 'aspects', 'flags', 'deltaT'],
    properties: {
      instant: outputInstant,
      local: nullable(ref('LocalResolution')),
      bodies: { type: 'array', items: ref('BodyPosition') },
      angles: nullable(ref('Angles')),
      houses: nullable(ref('Houses')),
      aspects: { type: 'array', items: ref('Aspect') },
      flags: { type: 'array', items: ref('ChartFlag') },
      deltaT: ref('DeltaT'),
    },
  },
  HousesResult: {
    type: 'object',
    required: ['instant', 'local', 'angles', 'houses', 'flags', 'deltaT'],
    properties: {
      instant: outputInstant,
      local: nullable(ref('LocalResolution')),
      angles: nullable(ref('Angles')),
      houses: nullable(ref('Houses')),
      flags: { type: 'array', items: ref('ChartFlag') },
      deltaT: ref('DeltaT'),
    },
  },
  PositionsResult: {
    type: 'object',
    required: ['instants'],
    properties: {
      instants: {
        type: 'array',
        items: {
          type: 'object',
          required: ['instant', 'bodies', 'deltaT', 'flags'],
          properties: {
            instant: outputInstant,
            bodies: { type: 'array', items: ref('BodyPosition') },
            deltaT: ref('DeltaT'),
            flags: { type: 'array', items: { const: 'outside-reference-span' } },
          },
        },
      },
    },
  },
  EventsResult: {
    type: 'object',
    required: ['from', 'to', 'events'],
    properties: {
      from: outputInstant,
      to: outputInstant,
      events: {
        type: 'array',
        items: {
          oneOf: [
            {
              type: 'object',
              required: ['kind', 'body', 'at', 'sign', 'retrograde'],
              properties: { kind: { const: 'ingress' }, body: { enum: [...EVENT_BODIES] }, at: outputInstant, sign, retrograde: bool },
            },
            {
              type: 'object',
              required: ['kind', 'body', 'at', 'type', 'lon', 'sign', 'degree'],
              properties: { kind: { const: 'station' }, body: { enum: [...EVENT_BODIES] }, at: outputInstant, type: { enum: ['retrograde', 'direct'] }, lon: num, sign, degree: num },
            },
            {
              type: 'object',
              required: ['kind', 'type', 'at', 'lon', 'sign', 'degree'],
              properties: { kind: { const: 'lunation' }, type: { enum: ['new', 'full'] }, at: outputInstant, lon: num, sign, degree: num },
            },
          ],
        },
      },
    },
  },
  TimeResult: {
    type: 'object',
    required: ['utc', 'offsetMinutes', 'flags', 'localMeanTime', 'zoneHistory', 'zoneUncertain', 'tt', 'deltaT'],
    properties: {
      utc: outputInstant,
      offsetMinutes: num,
      flags: {
        type: 'array',
        items: { enum: ['dst-gap', 'dst-fold', 'lmt', 'outside-reference-span'] },
        description: 'The resolver\'s flags, and outside-reference-span when a local time at the ends of the accepted dates falls outside the instant span.',
      },
      localMeanTime: nullable({ type: 'object', required: ['longitude', 'zoneOffsetMinutes'], properties: { longitude: num, zoneOffsetMinutes: num } }),
      zoneHistory: { enum: ['pinned', 'runtime'] },
      zoneUncertain: bool,
      tt: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}$', description: 'Terrestrial Time to the millisecond, with no zone designator because it is not UTC.' },
      deltaT: ref('DeltaT'),
    },
  },
  BodyState: object(['lon', 'sign', 'degree', 'speed', 'retrograde'], {
    lon: num, sign, degree: num, speed: num, retrograde: bool,
  }, 'A body\'s longitude, sign, degree, speed and direction at one instant.'),
  ZoneEdge: {
    allOf: [ref('LocalResolution'), object(['utc'], { utc: outputInstant })],
    description: 'A midnight of the day in its zone: the instant, and how the local time was read.',
  },
  SkyFactEcho: object(['kind', 'date', 'zone'], {
    kind: { enum: ['sign', 'retrograde', 'ingress', 'phase'] },
    body: eventBody,
    sign,
    phase: { enum: [...PHASE_NAMES] },
    instant: nullable(outputInstant),
    date: nullable({ type: 'string', pattern: `^${DATE}$` }),
    zone: nullable({ type: 'string', description: 'The zone as tzdb spells it.' }),
  }, 'The fact as the server read it, with the zone as tzdb spells it.'),
  SkyFactResult: {
    type: 'object',
    required: ['answer', 'basis', 'fact', 'instant', 'window', 'zone', 'facts'],
    properties: {
      answer: { enum: ['true', 'false', 'depends'] },
      basis: { enum: ['instant', 'local-day', 'any-zone-day'] },
      fact: ref('SkyFactEcho'),
      instant: nullable(outputInstant),
      window: nullable(object(['from', 'to'], { from: outputInstant, to: outputInstant }, 'The day read: from its start (included) to its end (excluded).')),
      zone: nullable(object(['start', 'end'], { start: ref('ZoneEdge'), end: ref('ZoneEdge') }, 'The two midnights of a day read in a zone.')),
      facts: {
        description: 'The computed values that decide the answer. At an instant: the body\'s state there. On a day: the state at its start and end with the sign changes or stations between, or the ingresses or lunations in it. flags holds outside-reference-span when the instant or the day reaches past the instant span.',
        oneOf: [
          object(['lon', 'sign', 'degree', 'speed', 'retrograde', 'deltaT', 'flags'], {
            lon: num, sign, degree: num, speed: num, retrograde: bool, deltaT: ref('DeltaT'),
            boundaryMarginArcsec: { type: 'number', minimum: 0, description: 'For a sign fact: the distance to the nearer sign boundary.' },
            flags: spanFlags,
          }, 'At an instant.'),
          object(['atStart', 'atEnd', 'changes', 'flags'], {
            atStart: ref('BodyState'), atEnd: ref('BodyState'), flags: spanFlags,
            changes: list(object(['at', 'into', 'retrograde'], { at: outputInstant, into: sign, retrograde: bool })),
          }, 'A sign on a day: the sign changes in the day.'),
          object(['atStart', 'atEnd', 'stations', 'flags'], {
            atStart: ref('BodyState'), atEnd: ref('BodyState'), flags: spanFlags,
            stations: list(object(['at', 'type'], { at: outputInstant, type: { enum: ['retrograde', 'direct'] } })),
          }, 'Retrograde on a day: the stations in the day.'),
          object(['ingresses', 'flags'], {
            ingresses: list(object(['at', 'retrograde'], { at: outputInstant, retrograde: bool })), flags: spanFlags,
          }, 'An ingress on a day.'),
          object(['lunations', 'flags'], {
            lunations: list(object(['at', 'lon', 'sign', 'degree'], { at: outputInstant, lon: num, sign, degree: num })), flags: spanFlags,
          }, 'A phase on a day.'),
        ],
      },
    },
  },
  ErrorResponse: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { enum: [...ERROR_CODES] },
          message: str,
          pointer: { type: 'string', description: 'JSON Pointer to the refused field; an empty string is the body itself.' },
          limit: str,
          max: { type: 'integer' },
          retryAfterSeconds: { type: 'integer' },
        },
      },
    },
  },
});

const RESULT_SCHEMA: Readonly<Record<ComputeEndpoint, string>> = {
  chart: 'ChartResult',
  positions: 'PositionsResult',
  houses: 'HousesResult',
  events: 'EventsResult',
  time: 'TimeResult',
  'sky-fact': 'SkyFactResult',
};

const REQUEST_SCHEMA: Readonly<Record<ComputeEndpoint, string>> = {
  chart: 'PlaceInstantRequest',
  positions: 'PositionsRequest',
  houses: 'PlaceInstantRequest',
  events: 'EventsRequest',
  time: 'TimeRequest',
  'sky-fact': 'SkyFactRequest',
};

export function responseComponentName(endpoint: ComputeEndpoint): string {
  return `${endpoint === 'sky-fact' ? 'SkyFact' : endpoint.charAt(0).toUpperCase() + endpoint.slice(1)}Response`;
}

export function requestComponentName(endpoint: ComputeEndpoint): string {
  return REQUEST_SCHEMA[endpoint];
}

function responseEnvelope(endpoint: ComputeEndpoint): Schema {
  return {
    type: 'object',
    required: ['schema', 'result', 'receipt', 'backend', 'cite'],
    properties: {
      schema: { const: responseSchemaName(endpoint) },
      result: ref(RESULT_SCHEMA[endpoint]),
      receipt: ref(endpoint === 'chart' || endpoint === 'houses' ? 'CalculationReceipt' : 'ComputeReceipt'),
      backend: ref('Backend'),
      cite: ref('Cite'),
    },
  };
}

/** Every component: the shared schemas above and one response envelope per endpoint. */
export const COMPUTE_COMPONENTS: Readonly<Record<string, Schema>> = Object.freeze({
  ...COMPUTE_SCHEMAS,
  ...Object.fromEntries(COMPUTE_ENDPOINTS.map((endpoint) => [responseComponentName(endpoint), responseEnvelope(endpoint)])),
});

const SUMMARIES: Readonly<Record<ComputeEndpoint, string>> = {
  chart: 'A natal chart for an instant and a place',
  positions: `Positions and speeds of bodies at up to ${BUDGETS['positions.instants']} instants`,
  houses: 'Angles and house cusps for an instant, a place and a system',
  events: 'Sign ingresses, stations and lunations in a window',
  time: 'A local civil time as UTC and TT, with ΔT and flags',
  'sky-fact': 'Whether a stated fact about the sky holds: true, false or depends',
};

const DESCRIPTIONS: Readonly<Record<ComputeEndpoint, string>> = {
  chart: 'Bodies, angles, house cusps and aspects as the engine\'s natalChart returns them, for an instant given in UTC or as local civil time in an IANA zone. The receipt is the engine\'s own.',
  positions: 'The rows the engine\'s positions() returns at each instant: tropical ecliptic longitude and latitude of date, speed in degrees per day, and the sign. Each instant carries the ΔT it was computed with.',
  houses: 'The angles and the twelve cusps of natalChart for one instant, place and house system. Inside the polar circle Placidus and Koch fall back to whole sign, and the flags and the receipt say so.',
  events: 'Sign ingresses of the requested bodies, their stations, and new and full moons, found by the engine\'s crossing search. Each crossing is bisected to within its search step divided by 2^24. Completeness is tested, not proven: sampling can miss a pair of crossings around a station that falls between two samples.',
  time: 'The site\'s own local-time resolver: a repeated wall time takes the earlier instant (dst-fold), a skipped one moves forward by the gap (dst-gap). With a longitude, a time before the place adopted a legal time uses the place\'s own mean time (lmt), and a date up to 1970-01-01 in a zone the pinned tzdb release keeps takes that release\'s offsets, backzone included (zoneHistory pinned). Otherwise offsets come from the server\'s time zone data (zoneHistory runtime), and a date up to 1970-01-01 read that way has zoneUncertain true.',
  'sky-fact': 'A structured fact, never interpretive text, answered true, false or depends, with the computed values that decide it. A fact about a date is depends when the answer turns on the time of day or, with no zone given, on the zone.',
};

const RETRY_AFTER_HEADER = (seconds: readonly number[], what: string): Schema => ({
  required: true,
  description: `Seconds to wait before trying again: ${what}.`,
  schema: { type: 'integer', enum: [...seconds] },
});

function errorResponse(description: string, names: readonly string[], headers: Record<string, Schema> = {}): Schema {
  const refusals = examples.refusals as Record<string, { response: unknown }>;
  return {
    description,
    headers: {
      'Cache-Control': { schema: { const: 'no-store' } },
      'Access-Control-Allow-Origin': { schema: { const: '*' } },
      ...headers,
    },
    content: {
      'application/json': {
        schema: ref('ErrorResponse'),
        examples: Object.fromEntries(names.map((name) => [name, {
          summary: REFUSAL_EXAMPLES[name].summary,
          value: refusals[name].response,
        }])),
      },
    },
  };
}

const operationName = (endpoint: ComputeEndpoint) => (endpoint === 'sky-fact' ? 'SkyFact' : endpoint.charAt(0).toUpperCase() + endpoint.slice(1));

function operation(endpoint: ComputeEndpoint): Schema {
  const success = (examples.success as Record<string, Record<string, unknown>>)[endpoint];
  const requests = SUCCESS_EXAMPLES[endpoint];
  const budgeted = endpoint === 'positions' || endpoint === 'events' || endpoint === 'sky-fact';
  return {
    options: {
      operationId: `preflight${operationName(endpoint)}`,
      summary: 'CORS preflight',
      description: 'Answered before anything else is checked, with no body, so that a page on another site can POST to the endpoint.',
      tags: ['compute'],
      responses: {
        204: {
          description: 'The methods and headers a cross-origin POST may use.',
          headers: Object.fromEntries(Object.entries(PREFLIGHT_HEADERS)
            .filter(([name]) => name !== 'X-Content-Type-Options' && name !== 'X-Robots-Tag')
            .map(([name, value]) => [name, { schema: { const: value } }])),
        },
      },
    },
    post: {
      operationId: `compute${operationName(endpoint)}`,
      summary: SUMMARIES[endpoint],
      description: `${DESCRIPTIONS[endpoint]} Documentation: ${computeDocsUrl(endpoint)}`,
      tags: ['compute'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ref(REQUEST_SCHEMA[endpoint]),
            examples: Object.fromEntries(Object.entries(requests).map(([name, example]) => [name, { summary: example.summary, value: example.body }])),
          },
        },
      },
      responses: {
        200: {
          description: 'The result, the receipt, the backend and what to cite.',
          headers: {
            'Cache-Control': { schema: { const: 'no-store' }, description: 'No response is stored by a cache.' },
            'Access-Control-Allow-Origin': { schema: { const: '*' } },
          },
          content: {
            'application/json': {
              schema: ref(responseComponentName(endpoint)),
              examples: Object.fromEntries(Object.entries(requests).map(([name, example]) => [name, { summary: example.summary, value: success[name] }])),
            },
          },
        },
        400: errorResponse('The body is not JSON, or a field is missing, unknown or invalid.', ['invalid-request', 'invalid-json']),
        404: errorResponse('The request reached the compute function by a path that is not one of the six endpoints. The six paths never answer it.', ['not-found']),
        405: errorResponse('Only POST, and OPTIONS for a CORS preflight.', ['method-not-allowed'], {
          Allow: { required: true, description: 'The methods the endpoint takes.', schema: { const: 'POST, OPTIONS' } },
        }),
        413: errorResponse(`The body is over ${MAX_BODY_BYTES} bytes.`, ['payload-too-large']),
        415: errorResponse('The body is not sent as application/json.', ['unsupported-media-type']),
        ...(budgeted ? { 422: errorResponse('The request is over one of the endpoint\'s compute budgets, which the error names.', ['budget-exhausted']) } : {}),
        429: errorResponse('Over a per-address rate limit; Retry-After gives the seconds to wait.', ['rate-limited'], {
          'Retry-After': RETRY_AFTER_HEADER([RETRY_AFTER_SECONDS.rateLimited], 'the length of the rate limit\'s window'),
        }),
        500: errorResponse('The engine could not complete the calculation.', ['calculation-failed']),
        503: errorResponse('The compute endpoints are switched off, or their rate limit is not in place or could not be checked: they answer only while it is. Retry-After gives the seconds to wait.', ['disabled', 'rate-limit-unavailable'], {
          'Retry-After': RETRY_AFTER_HEADER([RETRY_AFTER_SECONDS.rateLimitUnavailable, RETRY_AFTER_SECONDS.disabled], `${RETRY_AFTER_SECONDS.rateLimitUnavailable} when the rate limit could not be checked, ${RETRY_AFTER_SECONDS.disabled} when the API is switched off`),
        }),
      },
    },
  };
}

export const COMPUTE_TAG = Object.freeze({
  name: 'compute',
  description: `Calculations from a POST body, on the vendored @zodiacs/engine. Birth data goes only in the body; any query string is ignored. The function writes nothing from a request or its result to a log, a file or a database, and responses are not cached; the host's request logs keep each request's web address and IP address. The endpoints answer only while their per-address rate limit is in place, and 503 otherwise. A body with a repeated key is read as JSON.parse reads it: the last value wins. Documentation: ${COMPUTE_DOCS_URL}`,
});

export function computeOpenApiPaths(): Record<string, Schema> {
  return Object.fromEntries(COMPUTE_ENDPOINTS.map((endpoint) => [computePath(endpoint), operation(endpoint)]));
}
