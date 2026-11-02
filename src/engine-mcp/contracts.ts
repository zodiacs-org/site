/**
 * Input and output contracts of the engine tools served at /mcp/engine.
 *
 * natal_chart, transits_at, event_search and resolve_civil_time keep the
 * contracts of the engine repository's zodiacs-astro server (engine PRs #49
 * and #74, mcp/src/contracts.ts and mcp/src/chart-schema.ts): the same inputs
 * and the same `zodiacs-astro/1` data. This endpoint adds `links` (the
 * zodiacs.org pages a bot links a fact to) beside the data.
 *
 * The consumer endpoint /mcp (src/ai-tools/) does not import this module.
 */
import { z } from 'zod';
import type { Chart } from '@zodiacs/engine';
import { createNatalEnvelope, parseNatalEnvelope, serializeNatalEnvelope } from '@zodiacs/engine/receipt';

export const ENGINE_MCP_NAME = 'zodiacs-engine';
export const ENGINE_MCP_VERSION = '1.0.0';
export const ENGINE_MCP_ROUTE_PARAM = '__zodiacs_engine';
/** Off unless set to 1; the endpoint then answers 503 and does nothing else. */
export const ENGINE_MCP_SWITCH_ENV = 'ZODIACS_ENGINE_MCP_ENABLED';
export const ENGINE_MCP_PATH = '/mcp/engine';
export const MAX_ENGINE_HTTP_BYTES = 65_536;
/** A reply larger than this is refused rather than sent. */
export const MAX_ENGINE_REPLY_BYTES = 1_048_576;

/** The tools of this endpoint, in the order the Astrologer bot uses them. */
export const ENGINE_TOOL_NAMES = [
  'search_places', 'resolve_civil_time', 'reading_facts', 'natal_chart', 'transits_at', 'event_search', 'get_capabilities',
] as const;
export type EngineToolName = (typeof ENGINE_TOOL_NAMES)[number];

/** The zodiacs.org pages a fact links to. No birth detail is put in a URL. */
export const PAGES = Object.freeze({
  chart: 'https://zodiacs.org/birth-chart/',
  transits: 'https://zodiacs.org/transits/',
  method: 'https://zodiacs.org/methodology/',
});
export const linksSchema = z.strictObject({
  page: z.string().url().describe('The zodiacs.org page for this kind of fact. Link facts to it exactly as given.'),
  method: z.string().url().describe('How zodiacs.org calculates and checks these facts.'),
});

// ------------------------------------------------------------------ inputs (zodiacs-astro/1)

/** Resolved Gregorian instants; no implicit local zone or noon convention. */
export const instantSchema = z.iso.datetime({ offset: true }).refine((value) => {
  const fraction = value.match(/\.(\d+)/)?.[1];
  return (!fraction || fraction.length <= 3) && Number.isFinite(Date.parse(value));
}, 'Use a resolved ISO instant with at most millisecond precision.');
export const houseSystemSchema = z.enum([
  'whole', 'placidus', 'porphyry', 'equal', 'equal-mc', 'vehlow', 'koch',
  'regiomontanus', 'campanus', 'topocentric', 'alcabitius', 'morinus', 'meridian',
]);
export const bodySchema = z.enum([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus',
  'Neptune', 'Pluto', 'North Node', 'South Node',
]);
const latitudeSchema = z.number().min(-90).max(90);
const longitudeSchema = z.number().min(-180).max(180);
export const birthSchema = z.strictObject({
  utc: instantSchema,
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  houseSystem: houseSystemSchema.optional(), timeKnown: z.boolean().optional(),
  timeScale: z.enum(['utc', 'ut1', 'tt']).optional(),
  deltaT: z.number().min(-1e10).max(1e10).optional(),
}).refine((b) => (b.latitude === undefined) === (b.longitude === undefined), {
  message: 'Supply latitude and longitude together.', path: ['longitude'],
});

/** Days in a month of a proleptic Gregorian or Julian year. */
function monthDays(year: number, month: number, calendar: 'gregorian' | 'julian') {
  const leap = calendar === 'julian' ? year % 4 === 0 : (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}
const dateSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Use a date YYYY-MM-DD.');
const zoneSchema = z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+)*$/, 'Use an IANA time zone name.');

/** A written local wall time; the engine resolves it to the minute, with no place lookup. */
export const civilTimeSchema = z.strictObject({
  date: dateSchema.describe('Local date as written, YYYY-MM-DD, in the calendar named by calendar.'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, 'Use a time HH:MM or HH:MM:00.')
    .describe('Local wall time HH:MM, or HH:MM:00; the engine resolves to the minute.'),
  timeZone: zoneSchema.describe('IANA time zone name, such as America/New_York.'),
  longitude: longitudeSchema.optional()
    .describe('Birthplace longitude, degrees east; used only inside a zone\'s local mean time era.'),
  calendar: z.enum(['gregorian', 'julian']).optional().describe('Calendar of date; gregorian by default.'),
  country: z.string().min(1).max(64).optional()
    .describe('ISO 3166-1 alpha-2 code or tzdata country name; adds a calendar note and never changes the instant.'),
}).refine(({ date, calendar = 'gregorian' }) => {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return day <= monthDays(year, month, calendar);
}, { message: 'The day does not exist in that month and calendar.', path: ['date'] });

/** Longest transit window reading_facts accepts, days. */
export const READING_MAX_DAYS = 120;
export const readingFactsSchema = z.strictObject({
  date: dateSchema.describe('Local birth date, YYYY-MM-DD (Gregorian), as written.'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time HH:MM.').nullable().optional()
    .describe('Local birth time HH:MM as the clock showed it; null or omitted when unknown.'),
  timeKnown: z.boolean().describe('False when the birth time is unknown: no houses, angles, chart ruler or sect, and the Moon\'s signs over the day.'),
  zone: zoneSchema.describe('IANA time zone of the birthplace, from search_places.'),
  lat: latitudeSchema.describe('Birthplace latitude, degrees north.'),
  lon: longitudeSchema.describe('Birthplace longitude, degrees east.'),
  windowStart: dateSchema.refine((date) => date >= '1971-01-01', 'Start the window on 1971-01-01 or later.').optional()
    .describe('First local date of the transit window, YYYY-MM-DD, 1971-01-01 or later; today\'s date in zone when omitted.'),
  days: z.number().int().min(1).max(READING_MAX_DAYS).optional().describe(`Length of the transit window in days, 1 to ${READING_MAX_DAYS}; 90 when omitted.`),
  format: z.enum(['sheet', 'facts', 'both']).optional()
    .describe('sheet: the text facts sheet with an ID on every line (default); facts: the same facts as JSON; both.'),
}).refine((r) => r.timeKnown ? typeof r.time === 'string' : true, { message: 'Give time when timeKnown is true.', path: ['time'] });

export const inputSchemas = {
  natal_chart: z.strictObject({ birth: birthSchema }),
  transits_at: z.strictObject({ birth: birthSchema, at: instantSchema }),
  event_search: z.strictObject({
    body: bodySchema, longitude: z.number().min(0).lt(360),
    from: instantSchema, to: instantSchema,
    maxSamples: z.number().int().min(1).max(100_000).optional(),
  }).refine(({ from, to }) => {
    const span = Date.parse(to) - Date.parse(from);
    return span >= 0 && span <= 366 * 86_400_000;
  }, 'Search window must be ordered and no longer than 366 days.'),
  resolve_civil_time: civilTimeSchema,
  reading_facts: readingFactsSchema,
  get_capabilities: z.strictObject({}),
};
export type ToolInput<T extends keyof typeof inputSchemas> = z.infer<(typeof inputSchemas)[T]>;

// ------------------------------------------------------------------ outputs (zodiacs-astro/1)

export const jsonObjectSchema = z.record(z.string(), z.json());
export const receiptRecordSchema = z.strictObject({ role: z.string().min(1), envelope: jsonObjectSchema.refine((value) => {
  try { return parseNatalEnvelope(JSON.stringify(value)).ok; } catch { return false; }
}, 'Invalid native engine receipt envelope.') });
export function outputSchema<S extends z.ZodType>(data: S) {
  return z.strictObject({
    schemaVersion: z.literal('zodiacs-astro/1'), data,
    receipts: z.array(receiptRecordSchema).min(1),
    links: linksSchema,
  });
}

const longitude = z.number().min(0).lt(360);
export const chartFlagSchema = z.enum([
  'dst-gap', 'dst-fold', 'lmt', 'no-time', 'polar-fallback', 'outside-reference-span',
]);
export const aspectTypeSchema = z.enum(['conjunction', 'sextile', 'square', 'trine', 'opposition']);
export const bodyPositionSchema = z.strictObject({
  body: bodySchema, lon: longitude.describe('Tropical ecliptic longitude of date, degrees.'),
  lat: z.number().describe('Ecliptic latitude, degrees.'),
  speed: z.number().describe('Longitude speed, degrees per day.'),
  retrograde: z.boolean(),
  sign: z.enum(['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']),
  degree: z.number().min(0).lt(30),
});
export const deltaTSchema = z.strictObject({
  seconds: z.number(), sigma: z.number().nonnegative().nullable(),
  model: z.enum(['zodiacs-deltat/1', 'iers-utc/1', 'pinned']),
  table: z.string().nullable(), tableDigest: z.string().nullable(),
  segment: z.enum(['long-term', 'reconstructed', 'observed', 'predicted', 'extrapolated', 'pinned', 'fallback']),
});
export const timeScaleSchema = z.strictObject({
  input: z.enum(['utc', 'ut1', 'tt']), basis: z.enum(['iers', 'delta-t', 'pinned']),
  ut1MinusUtc: z.strictObject({ seconds: z.number(), sigma: z.number().nonnegative(),
    source: z.enum(['observed', 'predicted', 'fallback']) }).nullable(),
  leapSeconds: z.strictObject({ taiMinusUtc: z.number(), listed: z.boolean() }).nullable(),
});
/** JSON representation of the native Chart, with Date serialized as ISO text. */
export const chartSchema = z.strictObject({
  input: z.strictObject({
    utc: instantSchema, timeScale: z.enum(['ut1', 'tt']).optional(),
    deltaT: z.number().optional(), latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(), houseSystem: houseSystemSchema,
    timeKnown: z.boolean(), flags: z.array(chartFlagSchema).optional(),
  }),
  bodies: z.array(bodyPositionSchema),
  angles: z.strictObject({ asc: longitude, mc: longitude, dsc: longitude, ic: longitude }).nullable(),
  houses: z.strictObject({ system: houseSystemSchema, cusps: z.array(longitude).length(12) }).nullable(),
  aspects: z.array(z.strictObject({ a: bodySchema, b: bodySchema, type: aspectTypeSchema,
    orb: z.number().nonnegative(), applying: z.boolean() })),
  flags: z.array(chartFlagSchema), deltaT: deltaTSchema, timeScale: timeScaleSchema,
  engineVersion: z.string().min(1),
});

// ------------------------------------------------------------------ serialization

export type JsonValue = z.infer<ReturnType<typeof z.json>>;

/** Reject lossy conversion instead of dropping fields or rounding numbers. */
export function toJson(value: unknown): JsonValue {
  const ancestors = new Set<object>();
  function visit(item: unknown): JsonValue {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (item instanceof Date) {
      if (!Number.isFinite(item.getTime())) throw new TypeError('Invalid result date.');
      return item.toISOString();
    }
    if (typeof item !== 'object' || item === null) throw new TypeError('Result is not JSON-safe.');
    if (ancestors.has(item)) throw new TypeError('Cyclic result.');
    ancestors.add(item);
    try {
      if (Array.isArray(item)) return Array.from(item, visit);
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
        throw new TypeError('Result must contain plain objects.');
      }
      return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, visit(entry)]));
    } finally { ancestors.delete(item); }
  }
  return visit(value);
}

export function chartReceipt(role: string, chart: Chart, sourceInstant?: string) {
  const envelope = createNatalEnvelope(chart, sourceInstant === undefined ? undefined : { sourceInstant });
  const encoded = serializeNatalEnvelope(envelope);
  const parsed = parseNatalEnvelope(encoded);
  if (!parsed.ok) throw new TypeError('Engine receipt failed validation.');
  return { role, envelope: jsonObjectSchema.parse(JSON.parse(encoded)) };
}

export function structuredResult<S extends z.ZodType>(schema: S, data: unknown, receipts: ReturnType<typeof chartReceipt>[], links: z.infer<typeof linksSchema>) {
  const structuredContent = outputSchema(schema).parse({
    schemaVersion: 'zodiacs-astro/1', data: toJson(data), receipts, links,
  });
  return { content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }], structuredContent };
}
