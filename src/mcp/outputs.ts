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
 */
import { z } from 'zod';
import { EPHEMERIS } from '@zodiacs/engine';
import { NATAL_DIAGNOSTIC_SCHEMA, NATAL_ENVELOPE_SCHEMA, NATAL_RECEIPT_SCHEMA } from '@zodiacs/engine/receipt';
import { ADAPTER_NAME, COMPARE_OUTPUTS, HOUSE_SYSTEMS, REFERENCES } from './bounds';
import { ADAPTER_RECEIPT_SCHEMA, toolUrl, type ToolName } from './cite';

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
function cite(tool: ToolName) {
  return z.strictObject({
    url: z.literal(toolUrl(tool)),
    receipt: z.string().regex(/^sha256:[0-9a-f]{64}$/).describe(tool === 'calculate_natal_chart'
      ? 'SHA-256 of the calculation receipt\'s RFC 8785 canonical JSON. The receipt holds the instant as written, the coordinates and the settings, so this digest identifies the birth details, even when the time is unknown: quote it only where they may be known.'
      : 'SHA-256 of the RFC 8785 canonical JSON of the receipt this reply carries, which holds nothing from a record.'),
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

export type CapabilitiesOutput = z.infer<typeof CAPABILITIES_OUTPUT>;
export type NatalSummaryOutput = z.infer<typeof NATAL_SUMMARY_OUTPUT>;
export type NatalRecordOutput = z.infer<typeof NATAL_RECORD_OUTPUT>;
export type CompareOutput = z.infer<typeof COMPARE_OUTPUT>;
