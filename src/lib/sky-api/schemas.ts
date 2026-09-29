/**
 * JSON Schema (draft 2020-12) for every sky data API payload, and the
 * OpenAPI 3.1 document composed from the same definitions. One source: the
 * published schema files, the OpenAPI components, and the tests all read
 * these objects. The document also describes the compute endpoints, whose
 * schemas and examples come from src/lib/compute-api/openapi.ts.
 */
import { API_BASE, API_ORIGIN, PLANET_SLUGS, schemaUrl } from './meta';
import { COMPUTE_COMPONENTS, COMPUTE_TAG, computeOpenApiPaths } from '../compute-api/openapi';
import { COMPUTE_DOCS_URL } from '../compute-api/constants';

type Schema = Record<string, unknown>;

const iso = { type: 'string', format: 'date-time' } as const;
const isoOrNull = { type: ['string', 'null'], format: 'date-time' } as const;
const day = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } as const;
const slug = { type: 'string', pattern: '^[a-z]+$' } as const;
const url = { type: 'string', format: 'uri' } as const;
const str = { type: 'string' } as const;
const num = { type: 'number' } as const;
const bool = { type: 'boolean' } as const;
const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] });

const envelopeProperties = {
  $schema: url,
  schema: { type: 'string', pattern: '^zodiacs\\.sky-api\\.[a-z-]+\\.v1$' },
  source: url,
  docs: url,
  guide: url,
  license: { const: 'CC BY 4.0' },
  licenseUrl: url,
  attribution: str,
  generatedAt: iso,
};
const envelopeRequired = ['schema', 'source', 'docs', 'license', 'licenseUrl', 'attribution', 'generatedAt'];

const about = { type: 'object', additionalProperties: str };
const links = { type: 'object' };

const body = {
  type: 'object',
  required: ['body', 'lon', 'sign', 'degree', 'retrograde', 'signName', 'position'],
  properties: {
    body: str,
    lon: { type: 'number', minimum: 0, maximum: 360 },
    sign: slug,
    signName: str,
    glyph: str,
    degree: { type: 'number', minimum: 0, maximum: 30 },
    retrograde: bool,
    position: str,
  },
};

const lunation = {
  type: 'object',
  required: ['type', 'at', 'label'],
  properties: {
    type: { enum: ['full', 'new'] },
    at: iso,
    sign: slug,
    signName: str,
    degree: { type: 'number', minimum: 0, maximum: 30 },
    name: str,
    label: str,
    daysAway: num,
    when: str,
  },
};

const retrogradeWindow = {
  type: 'object',
  required: [
    'planet', 'from', 'to', 'preShadowStart', 'postShadowEnd', 'clippedStart', 'clippedEnd',
    'stationRetrograde', 'stationDirect', 'stationRetrogradeSign', 'stationDirectSign', 'durationDays', 'label',
  ],
  properties: {
    planet: str,
    from: iso,
    to: iso,
    preShadowStart: isoOrNull,
    postShadowEnd: isoOrNull,
    clippedStart: bool,
    clippedEnd: bool,
    stationRetrograde: isoOrNull,
    stationDirect: isoOrNull,
    stationRetrogradeSign: { type: ['string', 'null'] },
    stationDirectSign: { type: ['string', 'null'] },
    durationDays: { type: ['number', 'null'] },
    label: str,
  },
};

const ingress = {
  type: 'object',
  required: ['planet', 'at', 'sign', 'retrograde', 'signName', 'label'],
  properties: { planet: str, at: iso, sign: slug, signName: str, retrograde: bool, label: str },
};

const station = {
  type: 'object',
  required: ['planet', 'at', 'type', 'sign', 'degree', 'signName', 'label'],
  properties: { planet: str, at: iso, type: { enum: ['direct', 'retrograde'] }, sign: slug, signName: str, degree: num, label: str },
};

const eclipse = {
  type: 'object',
  required: ['type', 'kind', 'peak', 'sign', 'lon', 'degree', 'signName', 'label'],
  properties: {
    type: { enum: ['solar', 'lunar'] },
    kind: str,
    peak: iso,
    sign: slug,
    signName: str,
    lon: num,
    degree: num,
    obscuration: { type: 'number', minimum: 0, maximum: 1 },
    totalMinutes: num,
    label: str,
  },
};

const aspect = {
  type: 'object',
  required: ['a', 'b', 'type', 'orb', 'at', 'aSign', 'aDegree', 'bSign', 'bDegree', 'label'],
  properties: {
    a: str, b: str, type: str, orb: num, at: iso,
    aSign: slug, aSignName: str, aDegree: num, bSign: slug, bSignName: str, bDegree: num, label: str,
  },
};

const upcomingEvent = {
  type: 'object',
  required: ['kind', 'at', 'when', 'daysAway', 'label'],
  properties: {
    kind: { enum: ['lunation', 'ingress', 'station', 'eclipse', 'aspect'] },
    at: iso,
    when: str,
    daysAway: num,
    label: str,
    eclipseKind: str,
  },
};

function payload(name: string, title: string, description: string, properties: Schema, required: string[]): Schema {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: schemaUrl(name),
    title,
    description,
    type: 'object',
    required: [...envelopeRequired, ...required],
    properties: { ...envelopeProperties, ...properties },
  };
}

const yearProperties = {
  year: { type: 'integer' },
  coverage: { type: 'object', required: ['from', 'to'], properties: { from: iso, to: iso } },
  summary: str,
  about,
};

export const SCHEMAS: Readonly<Record<string, Schema>> = Object.freeze({
  index: payload('index', 'Sky data API index', 'Every endpoint and document the API publishes, with coverage.', {
    api: url,
    summary: str,
    versioning: str,
    coverage: {
      type: 'object',
      required: ['dailyDate', 'years', 'dataVintage'],
      properties: { dailyDate: day, years: { type: 'object', properties: { from: { type: 'integer' }, to: { type: 'integer' } } }, dataVintage: iso },
    },
    endpoints: {
      type: 'array',
      items: { type: 'object', required: ['path', 'description', 'updates', 'schema'], properties: { path: str, description: str, updates: str, schema: url } },
    },
    documents: {
      type: 'array',
      items: { type: 'object', required: ['path', 'description', 'contentType'], properties: { path: str, description: str, contentType: str } },
    },
    about,
  }, ['api', 'summary', 'coverage', 'endpoints', 'documents']),

  today: payload('today', "Today's sky", 'Positions, moon phase, active retrogrades, next lunations, and exact events for one UTC date.', {
    date: day,
    snapshotAt: iso,
    summary: str,
    positions: str,
    bodies: { type: 'array', minItems: 1, items: body },
    moon: {
      type: 'object',
      required: ['phase', 'illumination', 'illuminationPercent', 'nextFullMoon', 'nextNewMoon'],
      properties: {
        phase: str,
        illumination: { type: 'number', minimum: 0, maximum: 1 },
        illuminationPercent: { type: 'integer', minimum: 0, maximum: 100 },
        nextFullMoon: nullable(lunation),
        nextNewMoon: nullable(lunation),
      },
    },
    retrogrades: { type: 'array', items: retrogradeWindow },
    eventsCoverage: str,
    events: { type: 'array', items: { type: 'object', required: ['kind', 'at', 'label'], properties: { kind: str, at: iso, label: str } } },
    about,
    links,
  }, ['date', 'snapshotAt', 'summary', 'bodies', 'moon', 'retrogrades', 'events']),

  upcoming: payload('upcoming', 'Upcoming sky events', 'Lunations, ingresses, stations, eclipses, and exact aspects over a rolling window, plus the next occurrence of each kind.', {
    from: iso,
    to: iso,
    windowDays: { type: 'integer' },
    summary: str,
    counts: { type: 'object', additionalProperties: { type: 'integer' } },
    nextByKind: {
      type: 'object',
      required: ['nextNewMoon', 'nextFullMoon', 'nextSolarEclipse', 'nextLunarEclipse', 'nextIngress', 'nextSunIngress', 'nextStation', 'mercuryRetrograde'],
      properties: {
        nextNewMoon: nullable(upcomingEvent),
        nextFullMoon: nullable(upcomingEvent),
        nextSolarEclipse: nullable(upcomingEvent),
        nextLunarEclipse: nullable(upcomingEvent),
        nextIngress: nullable(upcomingEvent),
        nextSunIngress: nullable(upcomingEvent),
        nextStation: nullable(upcomingEvent),
        mercuryRetrograde: { type: 'object', required: ['current', 'next'], properties: { current: nullable(retrogradeWindow), next: nullable(retrogradeWindow) } },
      },
    },
    events: { type: 'array', items: upcomingEvent },
    about,
    links,
  }, ['from', 'to', 'windowDays', 'summary', 'counts', 'nextByKind', 'events']),

  retrogrades: payload('retrogrades', 'Retrograde windows for a year', 'Windows intersecting the year, station to station, with shadow boundaries and clipping flags.', {
    ...yearProperties,
    retrogrades: { type: 'array', items: retrogradeWindow },
  }, ['year', 'coverage', 'summary', 'retrogrades']),

  stations: payload('stations', 'Stations for a year', 'Every instant a planet turns retrograde or direct during the year.', {
    ...yearProperties,
    stations: { type: 'array', items: station },
  }, ['year', 'coverage', 'summary', 'stations']),

  ingresses: payload('ingresses', 'Sign ingresses for a year', 'Every sign boundary crossing during the year.', {
    ...yearProperties,
    ingresses: { type: 'array', items: ingress },
  }, ['year', 'coverage', 'summary', 'ingresses']),

  'moon-phases': payload('moon-phases', 'Moon phases for a year', 'Exact new and full moon instants with signs and traditional names.', {
    ...yearProperties,
    lunations: { type: 'array', items: lunation },
  }, ['year', 'coverage', 'summary', 'lunations']),

  eclipses: payload('eclipses', 'Eclipses for a year', 'Solar and lunar eclipses by instant of greatest eclipse.', {
    ...yearProperties,
    eclipses: { type: 'array', items: eclipse },
  }, ['year', 'coverage', 'summary', 'eclipses']),

  aspects: payload('aspects', 'Exact aspects for a year', 'Exact planetary aspects during the year.', {
    ...yearProperties,
    aspects: { type: 'array', items: aspect },
  }, ['year', 'coverage', 'summary', 'aspects']),

  planet: payload('planet', 'One body', 'Current position, retrograde status and windows, and the next ingress and station for one body.', {
    planet: str,
    slug: { enum: [...PLANET_SLUGS] },
    date: day,
    snapshotAt: iso,
    summary: str,
    now: body,
    retrograde: {
      type: 'object',
      required: ['applicable', 'active', 'current', 'next', 'windows'],
      properties: {
        applicable: bool,
        active: bool,
        current: nullable(retrogradeWindow),
        next: nullable(retrogradeWindow),
        windows: { type: 'array', items: retrogradeWindow },
      },
    },
    nextIngress: nullable(ingress),
    nextStation: nullable(station),
    about,
    links,
  }, ['planet', 'slug', 'date', 'snapshotAt', 'summary', 'now', 'retrograde', 'nextIngress', 'nextStation']),

  signs: payload('signs', 'The twelve signs', 'Sign metadata, computed Sun seasons, and current occupants.', {
    date: day,
    snapshotAt: iso,
    summary: str,
    signs: {
      type: 'array',
      minItems: 12,
      maxItems: 12,
      items: {
        type: 'object',
        required: ['slug', 'name', 'glyph', 'element', 'modality', 'ruler', 'dates', 'longitudeRange', 'sunSeason', 'occupantsNow', 'summary'],
        properties: {
          slug, name: str, glyph: str,
          element: { enum: ['fire', 'earth', 'air', 'water'] },
          modality: { enum: ['cardinal', 'fixed', 'mutable'] },
          ruler: str, classicRuler: str, polarity: str, house: { type: 'integer' }, dates: str, essence: str,
          longitudeRange: { type: 'object', required: ['from', 'to'], properties: { from: num, to: num } },
          sunSeason: nullable({ type: 'object', required: ['year', 'from', 'to', 'label'], properties: { year: { type: 'integer' }, from: iso, to: isoOrNull, label: str } }),
          occupantsNow: { type: 'array', items: str },
          summary: str,
        },
      },
    },
    about,
    links,
  }, ['date', 'snapshotAt', 'summary', 'signs']),
});

export const SCHEMA_NAMES: readonly string[] = Object.freeze(Object.keys(SCHEMAS));

/** Schema names that a payload's `schema` field maps to (planet payloads share one schema). */
export function schemaNameForFile(relPath: string): string {
  if (relPath === 'index.json') return 'index';
  if (relPath === 'sky/today.json') return 'today';
  if (relPath === 'sky/upcoming.json') return 'upcoming';
  if (relPath === 'signs.json') return 'signs';
  if (relPath.startsWith('planets/')) return 'planet';
  return relPath.split('/')[0];
}

function componentSchema(schema: Schema): Schema {
  const { $schema: _schemaKeyword, $id: _id, ...rest } = schema as Schema & { $schema?: string; $id?: string };
  return rest;
}

function jsonResponse(ref: string, description: string) {
  return {
    200: {
      description,
      headers: {
        'Access-Control-Allow-Origin': { schema: { const: '*' }, description: 'Every endpoint is open to any origin.' },
        'Cache-Control': { schema: str, description: 'Short on daily files, a day on yearly files.' },
      },
      content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } },
    },
    404: { description: 'No such file: a year or body outside coverage.' },
  };
}

export function buildOpenApi(
  { transitYears, skyYears, eclipseYears, dailyDate, version }:
  { transitYears: number[]; skyYears: number[]; eclipseYears: number[]; dailyDate: string; version: string },
): Schema {
  const yearParam = (years: number[]) => ({
    name: 'year',
    in: 'path',
    required: true,
    schema: { type: 'integer', enum: years },
    description: `A covered calendar year (${years[0]}–${years.at(-1)}).`,
  });
  const yearPath = (family: string, schema: string, summary: string, years: number[]) => ({
    [`/api/v1/${family}/{year}.json`]: {
      get: {
        operationId: `get${family.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')}Year`,
        summary,
        tags: ['yearly'],
        parameters: [yearParam(years)],
        responses: jsonResponse(schema, `${summary}.`),
      },
    },
  });
  return {
    openapi: '3.1.0',
    info: {
      title: 'Zodiacs.org API',
      version,
      summary: "Free sky data as static files: today's sky, upcoming events, planets, signs, and per-year retrogrades, stations, ingresses, moon phases, eclipses, and aspects. And six calculation endpoints that take a POST body.",
      description: `The sky data (tags daily and yearly) is static JSON files served from the CDN with open CORS and no authentication. Positions are apparent geocentric tropical ecliptic longitudes computed at 12:00 UTC daily. Data as of ${dailyDate}. Guide for AI agents: ${API_BASE}/llms.txt. Documentation: ${API_ORIGIN}/developers/. The compute endpoints (tag compute) calculate from the body of a POST request, with open CORS and no authentication; their documentation is ${COMPUTE_DOCS_URL}.`,
      license: { name: 'CC BY 4.0', identifier: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
      contact: { url: `${API_ORIGIN}/developers/` },
    },
    servers: [{ url: API_ORIGIN }],
    tags: [
      { name: 'daily', description: 'Daily publication is scheduled from 00:00 UTC using positions computed for noon UTC. Delivery can be delayed; check each payload edition date.' },
      { name: 'yearly', description: 'Regenerated when the underlying yearly data is refreshed.' },
      { ...COMPUTE_TAG },
    ],
    paths: {
      '/api/v1/index.json': { get: { operationId: 'getIndex', summary: 'Every endpoint and document', tags: ['daily'], responses: jsonResponse('index', 'The endpoint manifest.') } },
      '/api/v1/sky/today.json': { get: { operationId: 'getToday', summary: "Today's sky", tags: ['daily'], responses: jsonResponse('today', "Today's positions, moon, retrogrades, and events.") } },
      '/api/v1/sky/upcoming.json': { get: { operationId: 'getUpcoming', summary: 'Upcoming events', tags: ['daily'], responses: jsonResponse('upcoming', 'The next weeks of sky events.') } },
      '/api/v1/signs.json': { get: { operationId: 'getSigns', summary: 'The twelve signs', tags: ['daily'], responses: jsonResponse('signs', 'Sign metadata, Sun seasons, and occupants.') } },
      '/api/v1/planets/{planet}.json': {
        get: {
          operationId: 'getPlanet',
          summary: 'One body',
          tags: ['daily'],
          parameters: [{ name: 'planet', in: 'path', required: true, schema: { type: 'string', enum: [...PLANET_SLUGS] }, description: 'Lowercase body name.' }],
          responses: jsonResponse('planet', 'Current position, retrograde status, next ingress and station.'),
        },
      },
      ...yearPath('retrogrades', 'retrogrades', 'Retrograde windows for a year', skyYears),
      ...yearPath('stations', 'stations', 'Stations for a year', transitYears),
      ...yearPath('ingresses', 'ingresses', 'Sign ingresses for a year', transitYears),
      ...yearPath('moon-phases', 'moon-phases', 'Moon phases for a year', skyYears),
      ...yearPath('eclipses', 'eclipses', 'Eclipses for a year', eclipseYears),
      ...yearPath('aspects', 'aspects', 'Exact aspects for a year', transitYears),
      ...computeOpenApiPaths(),
    },
    components: {
      schemas: {
        ...Object.fromEntries(Object.entries(SCHEMAS).map(([name, schema]) => [name, componentSchema(schema)])),
        ...COMPUTE_COMPONENTS,
      },
    },
  };
}
