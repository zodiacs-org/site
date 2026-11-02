/**
 * The seven tools of /mcp/engine, the hosted tools of the Astrologer bot
 * (zodiacs-org/engine bots/astrologer/). Every number comes from the vendored
 * @zodiacs/engine; nothing here computes a position itself.
 *
 * - natal_chart, transits_at, event_search, resolve_civil_time: ports of the
 *   engine repository's zodiacs-astro tools (PRs #49 and #74), same inputs and
 *   data, plus `links`.
 * - reading_facts: the bot's facts sheet, `reading-facts.ts`, copied
 *   from the engine repository by scripts/sync-reading-facts.mjs.
 * - search_places: the site's birthplace search (places.ts).
 * - get_capabilities: what this endpoint offers and the versions it runs on.
 *
 * Validation and engine refusals throw; server.ts turns a throw into an error
 * result that quotes no argument.
 */
import { z } from 'zod';
import { ENGINE_VERSION, EPHEMERIS, natalChart, searchLongitudeCrossings, transits } from '@zodiacs/engine';
import { TZDB, prepareLocalTime, resolveLocalToUtc, zoneOffsetAt } from '@zodiacs/engine/geo';
import { PLACES_SOURCE, searchPlaces, type PLACES_INPUT } from './places.js';
import {
  ENGINE_MCP_NAME, ENGINE_MCP_VERSION, ENGINE_TOOL_NAMES, PAGES, READING_MAX_DAYS,
  aspectTypeSchema, bodyPositionSchema, bodySchema, chartReceipt, chartSchema, civilTimeSchema, inputSchemas, instantSchema,
  linksSchema, structuredResult, toJson, type ToolInput,
} from './contracts.js';
import {
  RANGE_ORB, SLOW, STATIONARY_SPEED, STATION_BODIES, STATION_ORB, TRANSITING, TRANSIT_ASPECTS, buildReadingFacts, formatReadingFacts,
} from './reading-facts.js';

const CHART_LINKS = Object.freeze({ page: PAGES.chart, method: PAGES.method });
const TRANSIT_LINKS = Object.freeze({ page: PAGES.transits, method: PAGES.method });

type Birth = ToolInput<'natal_chart'>['birth'];
function chartOf(birth: Birth) {
  return natalChart({
    utc: birth.utc,
    ...(birth.latitude === undefined ? {} : { latitude: birth.latitude }),
    ...(birth.longitude === undefined ? {} : { longitude: birth.longitude }),
    ...(birth.houseSystem === undefined ? {} : { houseSystem: birth.houseSystem }),
    ...(birth.timeKnown === undefined ? {} : { timeKnown: birth.timeKnown }),
    ...(birth.timeScale === undefined ? {} : { timeScale: birth.timeScale }),
    ...(birth.deltaT === undefined ? {} : { deltaT: birth.deltaT }),
  });
}

// ------------------------------------------------------------------ natal_chart

export const natalDataSchema = z.strictObject({ chart: chartSchema });

export function natalChartTool(input: unknown) {
  const { birth } = inputSchemas.natal_chart.parse(input);
  const chart = chartOf(birth);
  return structuredResult(natalDataSchema, { chart }, [chartReceipt('natal', chart, birth.utc)], CHART_LINKS);
}

// ------------------------------------------------------------------ transits_at

export const interAspectSchema = z.strictObject({
  a: bodySchema.describe('Moving body.'), aLon: z.number().min(0).lt(360),
  b: bodySchema.describe('Natal body.'), bLon: z.number().min(0).lt(360),
  type: aspectTypeSchema, orb: z.number().nonnegative(),
});
export const transitDataSchema = z.strictObject({
  transit: z.strictObject({
    natal: chartSchema, at: instantSchema,
    positions: z.array(bodyPositionSchema), aspects: z.array(interAspectSchema),
  }),
  sky: chartSchema.describe('Coordinate-free UTC chart supplying transit position provenance.'),
});

export function transitsAtTool(input: unknown) {
  const { birth, at } = inputSchemas.transits_at.parse(input);
  // Defaults and natal time options belong only to the natal calculation.
  const natal = chartOf(birth);
  const transit = transits(natal, at);
  const sky = natalChart({ utc: at });
  return structuredResult(transitDataSchema, { transit, sky }, [
    chartReceipt('natal', natal, birth.utc), chartReceipt('transit-sky', sky, at),
  ], TRANSIT_LINKS);
}

// ------------------------------------------------------------------ event_search

export const EVENT_STEP_DAYS = 0.25;
export const EVENT_DEFAULT_MAX_SAMPLES = 10_000;
const crossingSchema = z.strictObject({ at: instantSchema, retrograde: z.boolean() });
const searchResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('complete'), crossings: z.array(crossingSchema), samples: z.number().int().nonnegative() }),
  z.strictObject({ status: z.literal('refused'), reason: z.literal('sample-budget'),
    crossings: z.array(crossingSchema).length(0), samples: z.number().int().nonnegative(),
    maxSamples: z.number().int().positive() }),
]);
export const eventSearchDataSchema = z.strictObject({
  request: z.strictObject({ body: bodySchema, longitude: z.number().min(0).lt(360), from: instantSchema, to: instantSchema }),
  policy: z.strictObject({ stepDays: z.literal(EVENT_STEP_DAYS), maxSamples: z.number().int().min(1).max(100_000),
    interval: z.literal('(from,to]'), completeness: z.literal('not-proven') }),
  search: searchResultSchema,
});

/** Native bounded solver; refusal never exposes a partial set of events. */
export function eventSearchTool(input: unknown) {
  const { body, longitude, from, to, maxSamples = EVENT_DEFAULT_MAX_SAMPLES } = inputSchemas.event_search.parse(input);
  // Validate both endpoints and keep their time and coverage provenance even for a refused or empty scan.
  const start = natalChart({ utc: from });
  const end = natalChart({ utc: to });
  const search = searchLongitudeCrossings(body, longitude, new Date(from), new Date(to), {
    stepDays: EVENT_STEP_DAYS, maxSamples,
  });
  const receipts = [chartReceipt('search-start', start, from), chartReceipt('search-end', end, to)];
  for (const [index, crossing] of search.crossings.entries()) {
    const at = crossing.at.toISOString();
    receipts.push(chartReceipt(`event-${index + 1}`, natalChart({ utc: at }), at));
  }
  return structuredResult(eventSearchDataSchema, {
    request: { body, longitude, from, to },
    policy: { stepDays: EVENT_STEP_DAYS, maxSamples, interval: '(from,to]', completeness: 'not-proven' }, search,
  }, receipts, TRANSIT_LINKS);
}

// ------------------------------------------------------------------ resolve_civil_time

const causeSchema = z.enum(['dst', 'legal-change', 'date-line']);
const transitionSchema = z.strictObject({
  at: instantSchema, offsetBeforeMinutes: z.number(), offsetAfterMinutes: z.number(), cause: causeSchema,
});
const calendarSchema = z.enum(['gregorian', 'julian']);
const dataFormSchema = z.enum(['main+backzone', 'main', 'host']);
const meanTimeSchema = z.strictObject({ longitude: z.number(), zoneOffsetMinutes: z.number() });
const resolutionSchema = z.strictObject({
  utc: instantSchema,
  offsetMinutes: z.number().describe('Minutes east of UTC at the instant; may be fractional.'),
  flags: z.array(z.enum(['dst-gap', 'dst-fold', 'lmt'])),
  date: z.string().describe('Resolved proleptic Gregorian date.'),
  writtenDate: z.string().describe('Date as written in its calendar.'),
  calendar: calendarSchema,
  jump: z.strictObject({ kind: z.enum(['gap', 'fold']), cause: causeSchema }).nullable(),
  transition: transitionSchema.nullable(),
  localMeanTime: meanTimeSchema.nullable(),
  zone: z.strictObject({
    source: z.enum(['tzdb', 'intl']), tzdbVersion: z.string().nullable(), dataForm: dataFormSchema,
    abbreviation: z.string().nullable(), dst: z.boolean().nullable(),
  }),
  intlOffsetMinutes: z.number().nullable(),
  calendarNote: z.strictObject({
    kind: z.enum(['old-style', 'new-style']),
    adoption: z.strictObject({
      code: z.string(), country: z.string(), region: z.string().nullable(), firstGregorian: z.string(),
      lastJulian: z.string(), sources: z.array(z.enum(['tzdb', 'grotefend-1891', 'grotefend-1898'])), note: z.string(),
    }),
  }).nullable(),
  localResolution: z.strictObject({
    date: z.string(), time: z.string(), timeZone: z.string(), offsetMinutes: z.number(),
    gapShiftMinutes: z.number(),
    policy: z.strictObject({ fold: z.literal('earlier'), gap: z.literal('shift-forward') }),
    calendar: calendarSchema.optional(), writtenDate: z.string().optional(),
    tzdbVersion: z.string().nullable().optional(), dataForm: dataFormSchema.optional(),
    clock: z.enum(['local-mean-time', 'legal']).optional(),
    transition: transitionSchema.nullable().optional(), localMeanTime: meanTimeSchema.nullable().optional(),
  }),
});
export const civilTimeDataSchema = z.strictObject({
  status: z.enum(['resolved', 'gap', 'fold'])
    .describe('gap: the wall time was skipped and moved forward; fold: it occurred twice and the earlier instant is given.'),
  request: civilTimeSchema,
  resolution: resolutionSchema,
});
/** Names the software and zone data used; it is not a chart receipt and carries no chart values. */
export const timeResolutionRecordSchema = z.strictObject({
  role: z.literal('time-resolution'),
  engine: z.strictObject({ name: z.literal('@zodiacs/engine'), version: z.string() }),
  shippedTzdb: z.strictObject({ version: z.string(), sha256: z.string().regex(/^[0-9a-f]{64}$/), form: z.literal('main+backzone') })
    .describe('Zone history the engine ships, used before 1970.'),
  answeredBy: z.strictObject({ source: z.enum(['tzdb', 'intl']), tzdbVersion: z.string().nullable(), dataForm: dataFormSchema })
    .describe('Which zone data gave this offset: the shipped history (tzdb) or the host\'s Intl.'),
});
export const civilTimeOutputSchema = z.strictObject({
  schemaVersion: z.literal('zodiacs-astro/1'), data: civilTimeDataSchema, record: timeResolutionRecordSchema, links: linksSchema,
});

/** Loads the shipped zone history when needed; validation and engine refusals propagate as tool errors. */
export async function resolveCivilTimeTool(input: unknown) {
  const request = inputSchemas.resolve_civil_time.parse(input);
  const { date, timeZone, longitude, calendar, country } = request;
  // Loads the zone's shipped history for a written date before 1971; a Julian date after
  // year 200 falls later in the Gregorian calendar, so the written date is enough.
  await prepareLocalTime(date, timeZone);
  const resolution = resolveLocalToUtc(date, request.time.slice(0, 5), timeZone, {
    ...(longitude === undefined ? {} : { longitude }),
    ...(calendar === undefined ? {} : { calendar }),
    ...(country === undefined ? {} : { country }),
  });
  const structuredContent = civilTimeOutputSchema.parse({
    schemaVersion: 'zodiacs-astro/1',
    data: { status: resolution.jump === null ? 'resolved' : resolution.jump.kind, request, resolution: toJson(resolution) },
    record: {
      role: 'time-resolution',
      engine: { name: '@zodiacs/engine', version: ENGINE_VERSION },
      shippedTzdb: { ...TZDB },
      answeredBy: { source: resolution.zone.source, tzdbVersion: resolution.zone.tzdbVersion, dataForm: resolution.zone.dataForm },
    },
    links: CHART_LINKS,
  });
  return { content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }], structuredContent };
}

// ------------------------------------------------------------------ reading_facts

/** Software and zone data that answered; no birth detail. */
function versionsRecord() {
  return {
    engine: { name: '@zodiacs/engine', version: ENGINE_VERSION },
    ephemeris: EPHEMERIS,
    shippedTzdb: { ...TZDB },
    hostTzdb: process.versions.tz ?? null,
    node: process.versions.node,
  };
}

export const readingFactsOutputSchema = z.strictObject({
  schemaVersion: z.literal('zodiacs-engine/reading-facts/1'),
  status: z.enum(['resolved', 'gap', 'fold', 'time-unknown']),
  window: z.strictObject({ from: z.string(), toInclusive: z.string(), days: z.number().int(), zone: z.string() }),
  sheet: z.string().optional().describe('The facts sheet: every fact line starts with an ID in square brackets; quote facts with their IDs.'),
  facts: z.record(z.string(), z.json()).optional().describe('The same facts as JSON.'),
  record: z.record(z.string(), z.json()),
  links: linksSchema,
});

/** Today's local date in an IANA zone. */
export function localToday(zone: string, now: Date = new Date()): string {
  const ms = now.getTime();
  return new Date(ms + zoneOffsetAt(zone, ms) * 60_000).toISOString().slice(0, 10);
}

export async function readingFactsTool(input: unknown, now: () => Date = () => new Date()) {
  const args = inputSchemas.reading_facts.parse(input);
  const windowStart = args.windowStart ?? localToday(args.zone, now());
  const facts = await buildReadingFacts(
    { date: args.date, time: args.timeKnown ? args.time ?? null : null, timeKnown: args.timeKnown, zone: args.zone, lat: args.lat, lon: args.lon },
    { windowStart, days: args.days ?? 90 },
  );
  const format = args.format ?? 'sheet';
  const structuredContent = readingFactsOutputSchema.parse({
    schemaVersion: 'zodiacs-engine/reading-facts/1',
    status: facts.status,
    window: facts.window,
    ...(format === 'facts' ? {} : { sheet: formatReadingFacts(facts) }),
    // JSON text drops undefined fields, as the CLI's --json does.
    ...(format === 'sheet' ? {} : { facts: JSON.parse(JSON.stringify(facts)) }),
    record: versionsRecord(),
    links: CHART_LINKS,
  });
  const text = structuredContent.sheet ?? JSON.stringify(structuredContent.facts);
  return { content: [{ type: 'text' as const, text }], structuredContent };
}

// ------------------------------------------------------------------ search_places

export async function searchPlacesTool(input: z.infer<typeof PLACES_INPUT>) {
  const structuredContent = { ...(await searchPlaces(input)), links: CHART_LINKS };
  return { content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }], structuredContent };
}

// ------------------------------------------------------------------ get_capabilities

export function capabilitiesTool() {
  const structuredContent = {
    name: ENGINE_MCP_NAME,
    version: ENGINE_MCP_VERSION,
    tools: [...ENGINE_TOOL_NAMES],
    versions: versionsRecord(),
    settings: {
      zodiac: 'tropical',
      positions: 'geocentric apparent',
      houses: 'whole sign by default; natal_chart takes houseSystem',
      node: 'true (North Node)',
      aspects: 'major aspects with the engine\'s default orbs',
    },
    readingFacts: {
      transiting: [...TRANSITING],
      aspects: [...TRANSIT_ASPECTS],
      slowBodiesGivenAsRanges: [...SLOW],
      rangeOrbDegrees: RANGE_ORB,
      stationarySpeedDegreesPerDay: STATIONARY_SPEED,
      stationBodies: [...STATION_BODIES],
      stationContactOrbDegrees: STATION_ORB,
      defaultDays: 90,
      maxDays: READING_MAX_DAYS,
      defaultWindowStart: 'today in the birth zone',
    },
    places: { ...PLACES_SOURCE },
    limitations: [
      'No Chiron or other minor bodies.',
      'Uranus, Neptune and Pluto transit dates are given as in-orb date ranges; treat their exact days as plus or minus 1 day.',
      'Event search completeness is tested, not proven.',
      'No predictions of health, money, legal matters or relationship outcomes.',
    ],
    privacy: 'Birth data is used for the call and not stored. No birth detail is written to logs or put in a returned link.',
    links: CHART_LINKS,
  };
  return { content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }], structuredContent };
}
