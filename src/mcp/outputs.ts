/**
 * The shape of each tool's structured result.
 *
 * A host reads these as JSON Schema in `tools/list` before it calls, and the
 * SDK checks every result against them before it leaves this process: a result
 * that does not match is answered as an error rather than sent. So each schema
 * says exactly what its tool returns. Objects are `z.strictObject` throughout,
 * because the JSON Schema a host reads forbids properties it does not list, and
 * the check here must refuse what that schema refuses. Names the bundle fixes,
 * such as the engine's and the schemas', are literals; versions are strings,
 * which the tests hold to the bundle's.
 * `outputs.test.ts` holds every result over a seeded corpus to these schemas.
 *
 * The vocabularies below are the engine's (`@zodiacs/engine` types: bodies,
 * signs, chart flags, aspect types) and the comparison's (`src/lib/compare/`).
 * The engine exports them as types only, so they are written out here, and
 * the tests compare each list with what the engine returns.
 *
 * get_positions, find_events, check_sky_fact and resolve_birth_time return
 * the hosted compute API's success body, so their schemas follow its OpenAPI
 * components (`src/lib/compute-api/openapi.ts`) field for field, with this
 * adapter's `cite`, and for check_sky_fact without the zone, which it never
 * reads. The tests hold every result to both.
 */
import { z } from 'zod';
import { EPHEMERIS } from '@zodiacs/engine';
import { NATAL_DIAGNOSTIC_SCHEMA, NATAL_ENVELOPE_SCHEMA, NATAL_RECEIPT_SCHEMA } from '@zodiacs/engine/receipt';
import {
  COMPUTE_RECEIPT_SCHEMA, EVENT_BODIES, EVENT_KINDS, PHASE_NAMES, SEARCH_STEP_DAYS, SKY_FACT_KINDS, responseSchemaName,
} from '../lib/compute-api/constants';
import { ADAPTER_NAME, COMPARE_OUTPUTS, HOUSE_SYSTEMS, REFERENCES } from './bounds';
import { CALENDARS } from '../lib/compute-api/validate';
import { ADAPTER_RECEIPT_SCHEMA, COMPUTE_TOOLS, SKY_TOOLS, toolUrl, type ComputeToolName, type SkyToolName, type ToolName } from './cite';
import { PLACES_MAX, PLACES_SOURCE } from './places-source';
import { ATLAS_PLACE_IDS } from '../lib/time-atlas/places';

export const BODY_NAMES = Object.freeze([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  'North Node', 'South Node',
] as const);
export const SIGN_NAMES = Object.freeze([
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const);
export const CHART_FLAGS = Object.freeze([
  'dst-gap', 'dst-fold', 'lmt', 'no-time', 'polar-fallback', 'outside-reference-span',
] as const);
export const ASPECT_TYPES = Object.freeze(['conjunction', 'sextile', 'square', 'trine', 'opposition'] as const);
export const EVIDENCE = Object.freeze(['reproduced', 'reported', 'hypothesis', 'unresolved'] as const);
export const DIFFERENCE_KINDS = Object.freeze(['metadata', 'numeric', 'display'] as const);

const houseSystem = z.enum(HOUSE_SYSTEMS);
const count = z.number().int().min(0);
/** Exactly two numbers. Not `z.tuple`, whose JSON Schema form some validators do not read. */
const pair = z.array(z.number()).length(2);

const ephemeris = z.strictObject({ name: z.literal(EPHEMERIS.name), version: z.string() });

const engine = z.strictObject({
  name: z.literal('@zodiacs/engine'),
  version: z.string(),
  ephemeris,
}).describe('The engine that calculated, as its calculation record names it.');

/**
 * A chart's digest is the one a model may be asked to quote, and the one that
 * identifies the birth details, so its description says so where the model
 * reads it: in the output schema, not only in the privacy text.
 */
function citeReceiptText(tool: ToolName): string {
  if (tool === 'calculate_natal_chart') {
    return 'SHA-256 of the calculation receipt\'s RFC 8785 canonical JSON. The receipt holds the instant as written, the coordinates and the settings, so this digest identifies the birth details, even when the time is unknown: quote it only where they may be known.';
  }
  if (tool === 'resolve_birth_time') {
    return 'SHA-256 of the RFC 8785 canonical JSON of the receipt this reply carries, which holds no date, time or zone from the request. It is the digest the hosted compute API cites for the same request.';
  }
  if (Object.hasOwn(SKY_TOOLS, tool)) {
    return 'SHA-256 of the RFC 8785 canonical JSON of the receipt this reply carries, which holds no instant, date or body from the request. It is the digest the hosted compute API cites for the same request.';
  }
  if (tool === 'search_places') {
    return 'SHA-256 of the RFC 8785 canonical JSON of the receipt this reply carries, which names the place index searched and holds nothing from the query.';
  }
  return 'SHA-256 of the RFC 8785 canonical JSON of the receipt this reply carries, which holds nothing from a record.';
}

function cite(tool: ToolName) {
  return z.strictObject({
    url: z.literal(toolUrl(tool)),
    receipt: z.string().regex(/^sha256:[0-9a-f]{64}$/).describe(citeReceiptText(tool)),
    engine: z.literal('@zodiacs/engine'),
    version: z.string(),
  }).describe('What to quote as this result\'s source.');
}

function adapterReceipt(tool: Exclude<ToolName, 'calculate_natal_chart' | ComputeToolName>, withOutput: boolean) {
  return z.strictObject({
    schema: z.literal(ADAPTER_RECEIPT_SCHEMA),
    tool: z.literal(tool),
    adapter: z.strictObject({ name: z.literal(ADAPTER_NAME), version: z.string() }),
    engine,
    ...(withOutput ? { output: z.enum(COMPARE_OUTPUTS) } : {}),
    ...(tool === 'search_places' ? {
      places: z.strictObject({ source: z.literal(PLACES_SOURCE.source), licence: z.literal(PLACES_SOURCE.licence), rows: count }),
    } : {}),
  }).describe('The adapter and the engine that answered. The cite digest is of this object.');
}

export const CAPABILITIES_OUTPUT = z.strictObject({
  adapter: z.strictObject({
    name: z.literal(ADAPTER_NAME),
    version: z.string(),
    releaseStatus: z.literal('unpublished-candidate'),
    transport: z.literal('stdio'),
  }),
  engine: z.strictObject({
    name: z.literal('@zodiacs/engine'),
    version: z.string(),
    releaseStatus: z.literal('unpublished-candidate'),
  }),
  schemas: z.strictObject({
    envelope: z.literal(NATAL_ENVELOPE_SCHEMA),
    receipt: z.literal(NATAL_RECEIPT_SCHEMA),
    diagnostic: z.literal(NATAL_DIAGNOSTIC_SCHEMA),
  }),
  supported: z.strictObject({
    houseSystems: z.array(houseSystem),
    references: z.array(z.enum(REFERENCES)),
    referenceRules: z.strictObject({ 'utc-noon': z.string(), 'local-noon': z.string() }),
    epoch: z.strictObject({ from: z.string(), to: z.string() }),
    coordinates: z.strictObject({ latitude: pair, longitude: pair, excluded: z.string() }),
    limits: z.strictObject({
      recordBytes: count,
      recordDepth: count,
      recordNodes: count,
      instantChars: count,
      requestBytes: count,
      resultBytes: count,
      differences: count,
      explanations: count,
    }),
  }),
  sky: z.strictObject({
    tools: z.array(z.enum(Object.keys(SKY_TOOLS) as [SkyToolName, ...SkyToolName[]])),
    sameAs: z.string(),
    epoch: z.strictObject({ from: z.string(), to: z.string() }),
    positionBodies: z.array(z.enum(BODY_NAMES)),
    eventBodies: z.array(z.enum(EVENT_BODIES)),
    eventKinds: z.array(z.enum(EVENT_KINDS)),
    factKinds: z.array(z.enum(SKY_FACT_KINDS)),
    phases: z.array(z.enum(PHASE_NAMES)),
    limits: z.strictObject({
      'positions.instants': count,
      'events.windowDays': count,
      'events.samples': count,
      'sky-fact.samples': count,
    }),
    search: z.strictObject({
      window: z.literal('start-exclusive-end-inclusive'),
      completeness: z.literal('tested-not-proven'),
    }),
    dates: z.string(),
  }).describe('What get_positions, find_events and check_sky_fact accept.'),
  time: z.strictObject({
    tool: z.literal('resolve_birth_time'),
    sameAs: z.string(),
    resolver: z.literal('@zodiacs/engine/geo'),
    pinnedTzdb: z.strictObject({ release: z.string(), appliesBefore: z.literal('1970-01-02') }),
    calendars: z.array(z.enum(CALENDARS)),
    julianLastWritten: z.literal('1923-12-31'),
    atlas: z.strictObject({
      version: z.string(),
      licence: z.literal('CC BY 4.0'),
      window: z.strictObject({ from: z.string(), to: z.string() }),
      places: z.array(z.enum(ATLAS_PLACE_IDS)),
    }).describe('The Zodiacs time atlas, which resolve_birth_time reads for a place named in atlasPlace: what the clocks said there, with citations, for wall times from its window\'s start up to its end.'),
  }).describe('What resolve_birth_time accepts and how it reads a local time.'),
  places: z.strictObject({
    tool: z.literal('search_places'),
    source: z.literal(PLACES_SOURCE.source),
    licence: z.literal(PLACES_SOURCE.licence),
    url: z.literal(PLACES_SOURCE.url),
    rows: count,
    maxResults: z.literal(PLACES_MAX),
    coordinates: z.string(),
  }).describe('The place index search_places reads, which is built into this adapter.'),
  resources: z.array(z.strictObject({ uri: z.string(), name: z.string(), mimeType: z.string() })),
  unsupported: z.array(z.string()),
  privacy: z.strictObject({
    calculation: z.string(),
    assistant: z.string(),
    output: z.string(),
    withheld: z.string(),
    claims: z.string(),
    citation: z.string(),
  }),
  receipt: adapterReceipt('get_capabilities', false),
  cite: cite('get_capabilities'),
});

const body = z.strictObject({
  body: z.enum(BODY_NAMES),
  lon: z.number().describe('Tropical ecliptic longitude of date, degrees in [0, 360).'),
  lat: z.number().describe('Ecliptic latitude, degrees.'),
  speed: z.number().describe('Daily motion in longitude, degrees a day; negative when retrograde.'),
  retrograde: z.boolean(),
  sign: z.enum(SIGN_NAMES),
  degree: z.number().describe('Longitude within the sign, degrees in [0, 30).'),
});

const aspect = z.strictObject({
  a: z.enum(BODY_NAMES),
  b: z.enum(BODY_NAMES),
  type: z.enum(ASPECT_TYPES),
  orb: z.number().describe('Distance from exact, degrees.'),
  applying: z.boolean(),
});

export const NATAL_SUMMARY_OUTPUT = z.strictObject({
  engine,
  timeKnown: z.boolean(),
  houses: z.strictObject({
    requested: houseSystem,
    actual: houseSystem.nullable(),
    absenceReason: z.enum(['unknown-time', 'missing-location']).nullable(),
  }),
  inputFlags: z.array(z.enum(CHART_FLAGS)),
  resultFlags: z.array(z.enum(CHART_FLAGS)),
  bodies: z.array(body),
  angles: z.strictObject({ asc: z.number(), mc: z.number(), dsc: z.number(), ic: z.number() }).nullable(),
  cusps: z.array(z.number()).length(12).nullable()
    .describe('Twelve cusp longitudes from the first house, or null when there are no houses.'),
  aspects: z.array(aspect),
  cite: cite('calculate_natal_chart'),
}).describe('The default reply: the chart, and the four fields needed to read it.');

export const NATAL_RECORD_OUTPUT = z.strictObject({
  engine,
  schema: z.literal(NATAL_ENVELOPE_SCHEMA),
  record: z.string()
    .describe('The calculation record itself, as JSON text. Pass this field, not the whole reply, to compare_calculation_records.'),
  cite: cite('calculate_natal_chart'),
}).describe('The reply to output: "record".');

export const NATAL_OUTPUT = z.union([NATAL_SUMMARY_OUTPUT, NATAL_RECORD_OUTPUT]);

const differenceBase = {
  id: z.string(),
  area: z.string(),
  label: z.string(),
  delta: z.number().nullable().describe('Right minus left, in the row\'s own unit: degrees, taken the shorter way round the circle for a body\'s longitude, an angle or a cusp, or degrees a day for a speed. Null for a row with no numeric difference, or one too large for a number.'),
  kind: z.enum(DIFFERENCE_KINDS),
};

export const COMPARE_OUTPUT = z.strictObject({
  identical: z.boolean(),
  counts: z.strictObject({ differences: count, substantive: count, displayOnly: count, explanations: count }),
  output: z.enum(COMPARE_OUTPUTS),
  differences: z.array(z.union([
    z.strictObject({ ...differenceBase, left: z.string(), right: z.string() }),
    z.strictObject({ ...differenceBase, valuesWithheld: z.literal(true) }),
  ])),
  explanations: z.array(z.strictObject({
    id: z.string(),
    evidence: z.enum(EVIDENCE),
    statement: z.string(),
    covers: z.array(z.string()),
    detail: z.string().nullable(),
  })),
  limits: z.array(z.string()),
  disclosure: z.string(),
  withheld: z.string().optional(),
  receipt: adapterReceipt('compare_calculation_records', true),
  cite: cite('compare_calculation_records'),
});

// ---------- get_positions, find_events and check_sky_fact ----------

const instantOut = z.string().describe('An instant in UTC, written as ISO 8601 with milliseconds.');
const sign = z.enum(SIGN_NAMES);
const spanFlags = z.array(z.literal('outside-reference-span')).max(1);

const deltaT = z.strictObject({
  seconds: z.number(),
  sigma: z.number(),
  model: z.enum(['iers-utc/1', 'zodiacs-deltat/1']),
  table: z.string(),
  tableDigest: z.string(),
  segment: z.enum(['long-term', 'reconstructed', 'observed', 'predicted', 'extrapolated']),
}).describe('ΔT = TT − UT1 in seconds, with its 1-sigma band and where it came from: iers-utc/1 from 1972 to the end of the engine\'s UT1 table, its model zodiacs-deltat/1 otherwise.');

const timeScale = z.strictObject({
  input: z.literal('utc'),
  basis: z.enum(['iers', 'delta-t']),
  ut1MinusUtc: z.strictObject({ seconds: z.number(), sigma: z.number(), source: z.enum(['observed', 'predicted', 'fallback']) }).nullable(),
  leapSeconds: z.strictObject({ taiMinusUtc: z.number(), listed: z.boolean() }).nullable(),
}).describe('How the engine read the instant. basis iers, from 1972 to the end of its UT1 table: TT is UTC plus the leap seconds and 32.184 s, and UT1 is UTC plus IERS UT1 − UTC. basis delta-t, otherwise: the instant is read as UT1, and TT is UT1 plus the ΔT model.');

const backend = z.strictObject({
  name: z.literal('@zodiacs/engine'),
  version: z.string(),
  ephemeris,
});

/** The receipt the compute API writes for a calculation the engine writes none for. */
function computeReceipt(tool: ComputeToolName) {
  return z.strictObject({
    schema: z.literal(COMPUTE_RECEIPT_SCHEMA),
    endpoint: z.literal(COMPUTE_TOOLS[tool]),
    engine: backend,
    conventions: z.record(z.string(), z.string()),
    coverage: z.record(z.string(), z.string()),
    referenceSpan: z.strictObject({ from: instantOut, to: instantOut }),
    deltaT: z.array(z.strictObject({
      model: z.enum(['iers-utc/1', 'zodiacs-deltat/1']),
      table: z.string(),
      tableDigest: z.string(),
    })).length(2).describe('The two sources of ΔT the engine\'s time basis uses: IERS from 1972 to the end of its UT1 table, and its model at every other instant.'),
    search: z.strictObject({
      solver: z.literal('engine-longitude-crossings'),
      stepDays: z.strictObject({
        default: z.literal(SEARCH_STEP_DAYS.default),
        moon: z.literal(SEARCH_STEP_DAYS.moon),
        elongation: z.literal(SEARCH_STEP_DAYS.elongation),
      }),
      bisections: z.literal(24),
      samples: count,
      maxSamples: count,
      window: z.literal('start-exclusive-end-inclusive'),
      completeness: z.literal('tested-not-proven')
        .describe('The search samples each motion at a fixed step and bisects every crossing it sees. It is tested, not proven to miss nothing.'),
    }).optional().describe('How a search searched: present when one ran.'),
    ...(tool === 'resolve_birth_time' ? { timeResolution: z.strictObject({
      resolver: z.literal('@zodiacs/engine/geo'),
      policy: z.strictObject({ fold: z.literal('earlier'), gap: z.literal('shift-forward') }),
      pinnedTzdb: z.strictObject({
        release: z.string(), sha256: z.string(), dataForm: z.literal('main+backzone'), appliesBefore: z.literal('1970-01-02'),
      }),
      runtimeTzdb: z.string().nullable(),
    }).describe('How local times were read: the resolver and its policy, the tzdb release it ships for dates up to 1970-01-01, and the runtime\'s own tzdb, which reads the rest.') } : {}),
    conventionIds: z.array(z.string())
      .describe('Every id of the Zodiacs conventions registry (zodiacs.org/developers/conventions) that this receipt\'s own fields name, in code-unit order, each once. The result\'s are left out, so the receipt holds nothing the request gave.'),
  }).describe('The compute API\'s receipt for this calculation: the engine, its conventions and coverage as its own receipts state them, and what this request used. The cite digest is of this object.');
}

function computeBody<Result extends z.ZodTypeAny>(tool: ComputeToolName, result: Result) {
  return z.strictObject({
    schema: z.literal(responseSchemaName(COMPUTE_TOOLS[tool])),
    result,
    receipt: computeReceipt(tool),
    backend,
    cite: cite(tool),
  });
}

export const POSITIONS_OUTPUT = computeBody('get_positions', z.strictObject({
  instants: z.array(z.strictObject({
    instant: instantOut,
    bodies: z.array(body),
    deltaT,
    timeScale,
    flags: spanFlags,
  })),
})).describe('The body of POST /api/v1/positions for the same request, with this tool\'s cite.');

export const EVENTS_OUTPUT = computeBody('find_events', z.strictObject({
  from: instantOut,
  to: instantOut,
  events: z.array(z.union([
    z.strictObject({ kind: z.literal('ingress'), body: z.enum(EVENT_BODIES), at: instantOut, sign, retrograde: z.boolean() }),
    z.strictObject({
      kind: z.literal('station'), body: z.enum(EVENT_BODIES), at: instantOut,
      type: z.enum(['retrograde', 'direct']), lon: z.number(), sign, degree: z.number(),
    }),
    z.strictObject({ kind: z.literal('lunation'), type: z.enum(['new', 'full']), at: instantOut, lon: z.number(), sign, degree: z.number() }),
  ])).describe('In time order. A window excludes its start and includes its end.'),
})).describe('The body of POST /api/v1/events for the same request, with this tool\'s cite.');

const bodyState = z.strictObject({ lon: z.number(), sign, degree: z.number(), speed: z.number(), retrograde: z.boolean() });

/** The two bodies at one instant and the aspect between them. */
const aspectState = {
  body: bodyState,
  other: bodyState,
  separation: z.number().min(0).max(180).describe('The angle between the two longitudes, in degrees.'),
  orb: z.number().min(0).describe('How far the separation is from the aspect\'s exact angle, in degrees.'),
  motion: z.enum(['applying', 'separating', 'stationary'])
    .describe('applying while the orb shrinks, separating while it grows, judged from the two daily motions; stationary when the two move at the same speed.'),
};
const allowedOrb = z.number().min(0)
  .describe('The widest orb at which the aspect holds between these two bodies, in degrees: the wider one when the Sun or the Moon is one of them.');

/** The fact as the compute API read it. This adapter reads no zone, so zone is always null. */
const factEcho = z.union([
  z.strictObject({ kind: z.literal('sign'), body: z.enum(EVENT_BODIES), sign, instant: instantOut.nullable(), date: z.string().nullable(), zone: z.null() }),
  z.strictObject({ kind: z.literal('retrograde'), body: z.enum(EVENT_BODIES), instant: instantOut.nullable(), date: z.string().nullable(), zone: z.null() }),
  z.strictObject({ kind: z.literal('ingress'), body: z.enum(EVENT_BODIES), sign, date: z.string(), zone: z.null() }),
  z.strictObject({ kind: z.literal('phase'), phase: z.enum(PHASE_NAMES), date: z.string(), zone: z.null() }),
  z.strictObject({
    kind: z.literal('aspect'), body: z.enum(EVENT_BODIES), other: z.enum(EVENT_BODIES), aspect: z.enum(ASPECT_TYPES),
    instant: instantOut.nullable(), date: z.string().nullable(), zone: z.null(),
  }),
]);

export const SKY_FACT_OUTPUT = computeBody('check_sky_fact', z.strictObject({
  answer: z.enum(['true', 'false', 'depends']),
  basis: z.enum(['instant', 'any-zone-day'])
    .describe('instant: the fact at one moment. any-zone-day: the date in every UTC offset in use today at once.'),
  fact: factEcho,
  instant: instantOut.nullable(),
  window: z.strictObject({ from: instantOut, to: instantOut }).nullable()
    .describe('The span read for a date: from its start, included, to its end, excluded.'),
  zone: z.null(),
  facts: z.union([
    z.strictObject({
      lon: z.number(), sign, degree: z.number(), speed: z.number(), retrograde: z.boolean(), deltaT, timeScale,
      boundaryMarginArcsec: z.number().min(0).optional().describe('For a sign fact: the distance to the nearer sign boundary, in arcseconds.'),
      flags: spanFlags,
    }).describe('At an instant.'),
    z.strictObject({
      atStart: bodyState, atEnd: bodyState,
      changes: z.array(z.strictObject({ at: instantOut, into: sign, retrograde: z.boolean() })),
      flags: spanFlags,
    }).describe('A sign on a date: the sign changes in the span.'),
    z.strictObject({
      atStart: bodyState, atEnd: bodyState,
      stations: z.array(z.strictObject({ at: instantOut, type: z.enum(['retrograde', 'direct']) })),
      flags: spanFlags,
    }).describe('Retrograde on a date: the stations in the span.'),
    z.strictObject({ ingresses: z.array(z.strictObject({ at: instantOut, retrograde: z.boolean() })), flags: spanFlags })
      .describe('An ingress on a date.'),
    z.strictObject({
      lunations: z.array(z.strictObject({ at: instantOut, lon: z.number(), sign, degree: z.number() })),
      flags: spanFlags,
    }).describe('A phase on a date.'),
    z.strictObject({ ...aspectState, allowedOrb, deltaT, timeScale, flags: spanFlags })
      .describe('An aspect at an instant: true when orb is within allowedOrb.'),
    z.strictObject({
      atStart: z.strictObject(aspectState), atEnd: z.strictObject(aspectState), allowedOrb,
      changes: z.array(z.strictObject({
        at: instantOut,
        holds: z.boolean().describe('Whether the aspect holds from this instant on: true where it begins, false where it ends.'),
      })),
      exact: z.array(z.strictObject({
        at: instantOut,
        body: z.strictObject({ lon: z.number(), sign, degree: z.number() }),
        other: z.strictObject({ lon: z.number(), sign, degree: z.number() }),
      })),
      flags: spanFlags,
    }).describe('An aspect on a date: where it begins or ends in the span, and where it is exact.'),
  ]).describe('The computed values that decide the answer.'),
})).describe('The body of POST /api/v1/sky-fact for the same request, with this tool\'s cite. answer is never an interpretation.');

export const TIME_OUTPUT = computeBody('resolve_birth_time', z.strictObject({
  utc: instantOut,
  offsetMinutes: z.number().describe('Minutes east of UTC; fractional before standard time.'),
  flags: z.array(z.enum(['dst-gap', 'dst-fold', 'lmt', 'zone-history-disputed', 'outside-reference-span']))
    .describe('dst-gap: the time was skipped and moved forward by the gap. dst-fold: it happened twice and the earlier was taken. lmt: it was read on a local mean time. zone-history-disputed: tzdb\'s default build, the runtime\'s own data, gives the zone another offset at the instant than the pinned history. outside-reference-span: the instant falls outside 1800 to 2200.'),
  localMeanTime: z.strictObject({ longitude: z.number(), zoneOffsetMinutes: z.number() }).nullable()
    .describe('The place\'s own mean time, where the time was read on it, with the zone\'s offset then.'),
  zoneHistory: z.enum(['pinned', 'runtime'])
    .describe('pinned: tzdb release 2025c with backzone, which the engine ships, read the offset. runtime: the runtime\'s own time zone data read it.'),
  zoneUncertain: z.boolean()
    .describe('True for a date up to 1970-01-01 read on the runtime\'s data where the release records no local time, as at an Antarctic station before it was staffed.'),
  intlOffsetMinutes: z.number().nullable()
    .describe('Where the pinned history answered, the zone\'s offset at the same instant in the runtime\'s own data, tzdb\'s default build; null otherwise.'),
  calendar: z.enum(CALENDARS),
  writtenDate: z.string().describe('The date as written.'),
  date: z.string().describe('The proleptic Gregorian date the time was read on.'),
  adoption: z.strictObject({
    code: z.string(),
    firstGregorian: z.string(),
    lastJulian: z.string().nullable(),
    sources: z.array(z.enum(['wikipedia', 'tzdb', 'lv', 'fi'])),
  }).nullable().describe('When the country named changed to the Gregorian calendar, from the site\'s birth forms\' table; null when no country was named or the table does not date it.'),
  atlas: z.strictObject({
    place: z.enum(ATLAS_PLACE_IDS),
    name: z.string(),
    jurisdiction: z.string(),
    clock: z.literal('civil'),
    status: z.enum(['ok', 'ambiguous', 'nonexistent', 'out-of-coverage'])
      .describe('ok: one instant. ambiguous: the clocks were set back over the time; every instant is listed, earliest first. nonexistent: they were set forward over it; the instant listed is the time read on the clock before the change. out-of-coverage: outside 1870 to 1919.'),
    instants: z.array(z.strictObject({
      utc: instantOut,
      offsetSeconds: z.number(),
      rule: z.string(),
      ruleVersion: z.number().int().min(1),
      isDst: z.boolean(),
      abbreviation: z.string().nullable(),
      uncertainty: z.strictObject({
        flag: z.enum(['documented', 'inferred', 'uncertain']),
        reasons: z.array(z.string()),
      }).describe('documented: the cited sources state the offset and the change. inferred: they follow from the sources by a stated assumption. uncertain: the sources leave it open or disagree, or the time falls within the limits they leave for a change.'),
      citations: z.array(z.strictObject({
        id: z.string(), title: z.string(), date: z.string().nullable(), url: z.string(), locator: z.string().nullable(), gloss: z.string().nullable(),
      })),
    })),
    skipped: z.strictObject({ from: z.string(), to: z.string() }).nullable(),
    secondsFromTzdb: z.number().nullable().describe('The atlas\'s first instant minus the utc tzdb gave, in seconds: 0 where they agree.'),
    source: z.strictObject({ name: z.string(), version: z.string(), licence: z.literal('CC BY 4.0'), url: z.string() }),
  }).nullable().describe('The time atlas\'s reading of the wall time at the place named in atlasPlace, beside tzdb\'s; null when none was named.'),
  calendarNote: z.enum(['old-style', 'new-style', 'other-calendar']).nullable()
    .describe('For a date written before 1924: old-style, written as Gregorian before the country\'s first New Style day; new-style, written as Julian on or after it; other-calendar, before the change in a country whose calendar before was not the Julian. Advice only.'),
  tt: z.string().describe('Terrestrial Time to the millisecond, with no zone designator because it is not UTC.'),
  deltaT,
  timeScale,
})).describe('The body of POST /api/v1/time for the same request, with this tool\'s cite.');

export const PLACES_OUTPUT = z.strictObject({
  places: z.array(z.strictObject({
    name: z.string(),
    admin1: z.string().describe('The region, as GeoNames names its first-level division; empty where it has none.'),
    country: z.string(),
    latitude: z.number().describe('Degrees north, rounded to 0.01° as the index stores it.'),
    longitude: z.number().describe('Degrees east, rounded to 0.01° as the index stores it.'),
    timeZone: z.string().describe('The place\'s IANA time zone, for resolve_birth_time.'),
    population: count,
  })).max(PLACES_MAX).describe('Places whose names start with the query first, then, from three characters, places whose names begin with the same letter and contain it, each in order of population.'),
  source: z.strictObject({
    source: z.literal(PLACES_SOURCE.source),
    licence: z.literal(PLACES_SOURCE.licence),
    url: z.literal(PLACES_SOURCE.url),
    rows: count,
  }).describe('The index searched: GeoNames cities15000, every place of 15,000 people or more, under CC BY 4.0.'),
  receipt: adapterReceipt('search_places', false),
  cite: cite('search_places'),
});

export type CapabilitiesOutput = z.infer<typeof CAPABILITIES_OUTPUT>;
export type NatalSummaryOutput = z.infer<typeof NATAL_SUMMARY_OUTPUT>;
export type NatalRecordOutput = z.infer<typeof NATAL_RECORD_OUTPUT>;
export type CompareOutput = z.infer<typeof COMPARE_OUTPUT>;
