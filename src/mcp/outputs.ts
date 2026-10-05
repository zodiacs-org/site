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
 * get_positions, find_events and check_sky_fact return the hosted compute
 * API's success body, so their schemas follow its OpenAPI components
 * (`src/lib/compute-api/openapi.ts`) field for field, with this adapter's
 * `cite` and without the zone, which it never reads. The tests hold every
 * result to both.
 */
import { z } from 'zod';
import { EPHEMERIS } from '@zodiacs/engine';
import { NATAL_DIAGNOSTIC_SCHEMA, NATAL_ENVELOPE_SCHEMA, NATAL_RECEIPT_SCHEMA } from '@zodiacs/engine/receipt';
import {
  COMPUTE_RECEIPT_SCHEMA, EVENT_BODIES, EVENT_KINDS, PHASE_NAMES, SEARCH_STEP_DAYS, SKY_FACT_KINDS, responseSchemaName,
} from '../lib/compute-api/constants';
import { ADAPTER_NAME, COMPARE_OUTPUTS, HOUSE_SYSTEMS, REFERENCES } from './bounds';
import { ADAPTER_RECEIPT_SCHEMA, SKY_TOOLS, toolUrl, type SkyToolName, type ToolName } from './cite';

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
  if (Object.hasOwn(SKY_TOOLS, tool)) {
    return 'SHA-256 of the RFC 8785 canonical JSON of the receipt this reply carries, which holds no instant, date or body from the request. It is the digest the hosted compute API cites for the same request.';
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

function adapterReceipt(tool: Exclude<ToolName, 'calculate_natal_chart'>, withOutput: boolean) {
  return z.strictObject({
    schema: z.literal(ADAPTER_RECEIPT_SCHEMA),
    tool: z.literal(tool),
    adapter: z.strictObject({ name: z.literal(ADAPTER_NAME), version: z.string() }),
    engine,
    ...(withOutput ? { output: z.enum(COMPARE_OUTPUTS) } : {}),
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
    releaseStatus: z.literal('published'),
    registry: z.literal('npm'),
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
function computeReceipt(tool: SkyToolName) {
  return z.strictObject({
    schema: z.literal(COMPUTE_RECEIPT_SCHEMA),
    endpoint: z.literal(SKY_TOOLS[tool]),
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
  }).describe('The compute API\'s receipt for this calculation: the engine, its conventions and coverage as its own receipts state them, and what this request used. The cite digest is of this object.');
}

function computeBody<Result extends z.ZodTypeAny>(tool: SkyToolName, result: Result) {
  return z.strictObject({
    schema: z.literal(responseSchemaName(SKY_TOOLS[tool])),
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

/** The fact as the compute API read it. This adapter reads no zone, so zone is always null. */
const factEcho = z.union([
  z.strictObject({ kind: z.literal('sign'), body: z.enum(EVENT_BODIES), sign, instant: instantOut.nullable(), date: z.string().nullable(), zone: z.null() }),
  z.strictObject({ kind: z.literal('retrograde'), body: z.enum(EVENT_BODIES), instant: instantOut.nullable(), date: z.string().nullable(), zone: z.null() }),
  z.strictObject({ kind: z.literal('ingress'), body: z.enum(EVENT_BODIES), sign, date: z.string(), zone: z.null() }),
  z.strictObject({ kind: z.literal('phase'), phase: z.enum(PHASE_NAMES), date: z.string(), zone: z.null() }),
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
  ]).describe('The computed values that decide the answer.'),
})).describe('The body of POST /api/v1/sky-fact for the same request, with this tool\'s cite. answer is never an interpretation.');

export type CapabilitiesOutput = z.infer<typeof CAPABILITIES_OUTPUT>;
export type NatalSummaryOutput = z.infer<typeof NATAL_SUMMARY_OUTPUT>;
export type NatalRecordOutput = z.infer<typeof NATAL_RECORD_OUTPUT>;
export type CompareOutput = z.infer<typeof COMPARE_OUTPUT>;
