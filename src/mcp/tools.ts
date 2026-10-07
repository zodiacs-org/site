/**
 * Three of the six operations this adapter offers, as plain functions over
 * validated arguments: the capabilities reply, a natal chart and a comparison.
 * The other three, the compute API's positions, events and sky facts, are in
 * `sky-tools.ts`.
 *
 * Every calculation here is the site's own: `natalChart` and the envelope codec
 * come from the pinned `@zodiacs/engine` candidate, and the comparison is
 * `compareEnvelopes` from `src/lib/compare/` — the same module the browser tool
 * at `/developers/compare/` runs. Nothing in this file re-derives a position, a
 * tolerance, a validator or an explanation rule. If a rule changes there it
 * changes here, which is the point of putting the adapter in this repository
 * rather than copying the logic into another one.
 *
 * The SDK wiring lives in `server.ts`. Keeping it out of this file means the
 * unit tests and the synthetic benchmark exercise the same functions a host
 * calls, without a process in between.
 */
import { z } from 'zod';
import { ENGINE_VERSION, natalChart } from '@zodiacs/engine';
import {
  NATAL_DIAGNOSTIC_SCHEMA, NATAL_ENVELOPE_SCHEMA, NATAL_RECEIPT_SCHEMA,
  createNatalEnvelope, parseNatalEnvelope, serializeNatalEnvelope,
  type NatalEnvelope, type NatalEnvelopeErrorCode,
} from '@zodiacs/engine/receipt';
import { compareEnvelopes, type Difference } from '../lib/compare/diff';
import { replay } from '../lib/compare/replay';
import {
  BUDGETS, EPOCH, EVENT_BODIES, EVENT_KINDS, PHASE_NAMES, POSITION_BODIES, SKY_FACT_KINDS,
} from '../lib/compute-api/constants';
import { SKY_TOOLS, capabilitiesReceipt, citeFor, comparisonReceipt } from './cite';
import type { CapabilitiesOutput, CompareOutput, NatalRecordOutput, NatalSummaryOutput } from './outputs';
import { RESOURCES } from './resources';
import { ANY_ZONE_DAY_TEXT } from './sky-tools';
import {
  ADAPTER_NAME, ADAPTER_VERSION, COMPARE_OUTPUTS, EPOCH_MAX_UTC, EPOCH_MIN_UTC,
  HOUSE_SYSTEMS, LIMITS, OUTPUTS, REFERENCES, parseCoordinates, parseInstant,
  bounded, polarAngleExclusion, recordTooLarge, rowValueIsTheFinding,
  utcNoonMisused,
} from './bounds';

/**
 * The distinction this adapter has to state everywhere it is described,
 * because getting it wrong would be a privacy claim we cannot support.
 */
export const PRIVACY = Object.freeze({
  calculation: 'This server calculates on the machine it runs on. No birth detail reaches zodiacs.org, and the server opens no network connection, listener or port of any kind.',
  assistant: 'A local calculation server is not a local AI experience. Whatever assistant you connect this to decides what reaches its model provider — your message, the arguments it builds for these tools, and the results it reads back. If that assistant runs in the cloud, assume the birth details in a request reach it. The calculation is local; the conversation is the assistant\'s to route.',
  output: 'A comparison reports the exact difference between two charts. Anyone holding one of the two can reconstruct the other from it, so that output is safer to pass on than a full record but it is not anonymous.',
  withheld: 'By default a comparison names which fields differ and by how much, and leaves out the values of rows carrying birth details or computed positions — you supplied both records to this call, so repeating their contents back tells you nothing you did not have, while adding a second copy to whatever this result travels through. Ask for output: "full" when you need those values. This shortens what travels onward; it hides nothing from the assistant you are talking to, which already received both records as arguments.',
  claims: 'A version, checksum or source URL inside a supplied record is a claim that record makes about itself. Nothing here authenticates it.',
  citation: 'A chart\'s cite.receipt is the digest of its calculation receipt, which holds the instant as it was written, offset included, the coordinates and the settings. The digest identifies the birth details from either side: with the date and the place, trying each time of day finds the time; with the instant, which the positions give away, trying places from a list of towns finds the place, even for a chart with no known time, whose summary shows no angle, cusp or coordinate. With timeKnown: false the coordinates change nothing else in the result, so leaving them out keeps them out of the receipt. Quote the digest only where the birth details may be known. A comparison cites the adapter\'s own receipt, which holds nothing from either record. get_positions, find_events and check_sky_fact cite the compute API\'s receipt for the same calculation, which they carry and which holds no instant, date or body from the request.',
});

/** What this first integration deliberately does not do. */
export const UNSUPPORTED = Object.freeze([
  'Transit, progression, return or eclipse searches. find_events finds sign ingresses, stations and new and full moons in a window of at most 92 days, and nothing else.',
  'Interpretation, horoscope or any generated reading.',
  'Resolving a place name or time zone: supply an instant with an explicit offset. check_sky_fact reads a date without a zone as that day in every UTC offset in use today at once.',
  'Reading or writing files. Records are passed as content; the adapter accepts no path and imports no filesystem module.',
  'Fetching a URL, running a command, importing a named module or installing a package.',
  'Any network listener, remote endpoint or browser-reachable port. The transport is local stdio only.',
  'Authenticating a record, or establishing that two records came from independent software.',
  'Interrupting work in progress. A calculation is synchronous, so it completes or throws; there is no timeout that could stop it mid-way and none is claimed.',
]);

export type ToolOutcome =
  | { readonly ok: true; readonly value: Record<string, unknown> }
  | { readonly ok: false; readonly refusal: string };

const instantDescription = `The birth instant as ISO-8601 with an explicit zone, such as 1990-06-15T13:30:00Z or 1990-06-15T19:00:00+05:30. A naked wall time is refused rather than assumed to be UTC. Must fall within ${EPOCH_MIN_UTC} to ${EPOCH_MAX_UTC}.`;

/**
 * `z.strictObject` rather than `z.object`: an unknown argument is refused
 * instead of ignored, and the generated JSON Schema says so, so a model reads
 * the same boundary the server enforces.
 */
export const CAPABILITIES_INPUT = z.strictObject({});

export const NATAL_INPUT = z.strictObject({
  utc: z.string().max(LIMITS.instantChars).describe(instantDescription),
  latitude: z.number().min(-90).max(90).optional()
    .describe('Degrees north, -90 to 90. Supply both coordinates or neither; with neither, the result carries no angles or houses and says why. Exactly 90 or -90 needs timeKnown: false: the engine does not compute angles at the poles.'),
  longitude: z.number().min(-180).max(180).optional()
    .describe('Degrees east, -180 to 180. Supply both coordinates or neither.'),
  houseSystem: z.enum(HOUSE_SYSTEMS).default('placidus')
    .describe('Requested house system. Both the request and what the engine could actually use are reported, which differ inside the polar circle: Placidus and Koch are undefined there, and the engine uses whole sign.'),
  timeKnown: z.boolean().default(true)
    .describe('False means utc is a reference instant rather than a birth time, which suppresses angles and houses. It does not imply noon. With false, coordinates change nothing in the result, but the calculation record still holds them and the result\'s cite.receipt identifies them.'),
  reference: z.enum(REFERENCES).optional()
    .describe('What the supplied instant represents, recorded in the calculation record. Omitting it is the usual case and infers nothing, including when timeKnown is false. "utc-noon" means no birth time was known and midday UTC stands in, so it needs timeKnown: false and utc at exactly 12:00:00Z.'),
  output: z.enum(OUTPUTS).default('summary')
    .describe('summary returns the computed chart and the four fields needed to read it. record additionally returns the full calculation record, which repeats every input back — ask for it only when the record is what you need, such as to compare two of them.'),
});

export const COMPARE_INPUT = z.strictObject({
  left: z.string().min(1).max(LIMITS.recordBytes)
    .describe(`The content of a ${NATAL_ENVELOPE_SCHEMA} calculation record, as JSON text. Not a file path, URL or identifier: the adapter reads no files and fetches nothing. At most ${LIMITS.recordBytes} bytes.`),
  right: z.string().min(1).max(LIMITS.recordBytes)
    .describe('The content of the second calculation record, as JSON text.'),
  output: z.enum(COMPARE_OUTPUTS).default('summary')
    .describe('summary lists every row full does, with its label, kind and numeric difference, and leaves out the values of rows carrying birth details or computed positions — you already hold both records. full returns those values too; ask for it when you need to read them rather than act on which fields moved.'),
});

/**
 * Each parse failure keeps its own sentence. Collapsing them into "invalid
 * record" would hide the one distinction that matters most: a record this
 * adapter cannot support is not the same as a record that is malformed, and a
 * caller who is told the difference knows whether to fix the file or stop.
 */
const PARSE_REFUSALS: Readonly<Record<NatalEnvelopeErrorCode, string>> = Object.freeze({
  invalid_json: 'is not valid JSON',
  invalid_shape: `is not shaped like a ${NATAL_ENVELOPE_SCHEMA} record`,
  invalid_value: 'carries a value the schema does not allow',
  inconsistent_result: 'contradicts itself: its recorded result does not match what its own receipt describes',
  invalid_context: 'carries a context block the schema does not allow',
  size_limit: `is larger than the ${LIMITS.recordBytes}-byte limit`,
  complexity_limit: `is nested deeper than ${LIMITS.recordDepth} levels or carries more than ${LIMITS.recordNodes} values`,
  unsupported_version: 'does not declare a schema version this adapter supports. It is refused rather than read as though it were the supported one',
  unsupported_feature: 'requires a feature this adapter does not implement. It is refused rather than read with that feature ignored',
});

function readRecord(side: 'first' | 'second', record: string): { ok: true; envelope: NatalEnvelope } | { ok: false; refusal: string } {
  const oversized = recordTooLarge(record);
  if (oversized !== null) {
    return { ok: false, refusal: `The ${side} record is ${oversized} bytes, over the ${LIMITS.recordBytes}-byte limit.` };
  }
  const parsed = parseNatalEnvelope(record);
  if (!parsed.ok) {
    return { ok: false, refusal: `The ${side} record ${PARSE_REFUSALS[parsed.code]}.${hint(record, parsed.code)}` };
  }
  return { ok: true, envelope: parsed.envelope };
}

/**
 * The two likeliest ways to get this wrong are both `calculate_natal_chart`'s
 * own replies, and each needs a different correction.
 *
 * The default reply is a chart summary rather than a record. It refuses as
 * `unsupported_version` exactly as an unrelated JSON object does, so without a
 * hint the caller cannot tell "the wrong kind of Zodiacs object" from "not a
 * Zodiacs object at all", and is not told the one-word fix.
 *
 * The `output: "record"` reply is `{ engine, schema, record }`: the record is
 * the `record` field, as text, and the object around it is not one. Passing the
 * whole reply is the natural reading of "ask for output: record", and it
 * refuses as `invalid_shape` with nothing to act on. An AI review found the
 * developer pages describing it that way; the pages now send readers to the
 * field, and this says the same thing to a caller who arrives without them.
 *
 * Key presence and one `typeof` only: nothing here is executed or reflected,
 * and no part of the caller's record appears in what comes back.
 */
function hint(record: string, code: NatalEnvelopeErrorCode): string {
  let value: unknown;
  try { value = JSON.parse(record); } catch { return ''; }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return '';
  const fields = value as Record<string, unknown>;
  const keys = new Set(Object.keys(fields));
  if (keys.has('record') && keys.has('engine') && keys.has('schema') && typeof fields.record === 'string') {
    return ' It looks like a whole calculate_natal_chart reply: pass its "record" field, which is the record itself.';
  }
  if (code !== 'unsupported_version') return '';
  if (!keys.has('bodies') || !keys.has('engine') || keys.has('schema')) return '';
  return ' It looks like a chart summary: call calculate_natal_chart again with output: "record".';
}

export function describeCapabilities(): ToolOutcome {
  const receipt = capabilitiesReceipt();
  const value: CapabilitiesOutput = {
    adapter: { name: ADAPTER_NAME, version: ADAPTER_VERSION, releaseStatus: 'unpublished-candidate', transport: 'stdio' },
    // 0.1.1-rc.17 is the candidate the site vendors, and npm does not carry it: npm serves rc.16 under
    // `next` (docs/platform/programme/DECISIONS-2026-10-05.md §7). The adapter is not on npm either.
    engine: { name: '@zodiacs/engine', version: ENGINE_VERSION, releaseStatus: 'unpublished-candidate' },
    schemas: { envelope: NATAL_ENVELOPE_SCHEMA, receipt: NATAL_RECEIPT_SCHEMA, diagnostic: NATAL_DIAGNOSTIC_SCHEMA },
    supported: {
      houseSystems: [...HOUSE_SYSTEMS],
      references: [...REFERENCES],
      referenceRules: {
        'utc-noon': 'needs timeKnown: false and utc at exactly 12:00:00Z; it records that no birth time was known',
        'local-noon': 'not offered: it needs a captured local date, wall time, zone and offset, and this adapter resolves no timezones',
      },
      epoch: { from: EPOCH_MIN_UTC, to: EPOCH_MAX_UTC },
      coordinates: {
        latitude: [-90, 90],
        longitude: [-180, 180],
        excluded: 'latitude exactly 90 or -90 with timeKnown: true — the engine does not compute angles at the exact poles',
      },
      limits: { ...LIMITS },
    },
    sky: {
      tools: Object.keys(SKY_TOOLS) as Array<keyof typeof SKY_TOOLS>,
      sameAs: 'POST https://zodiacs.org/api/v1/positions, /events and /sky-fact: the same parser, calculation and receipt, so the same result and cite.receipt for the same request',
      epoch: { from: EPOCH.from, to: EPOCH.to },
      positionBodies: [...POSITION_BODIES],
      eventBodies: [...EVENT_BODIES],
      eventKinds: [...EVENT_KINDS],
      factKinds: [...SKY_FACT_KINDS],
      phases: [...PHASE_NAMES],
      // The compute API's limits on these three tools' requests, by name: its
      // table also holds the limits of elections, which this adapter does not offer.
      limits: {
        'positions.instants': BUDGETS['positions.instants'],
        'events.windowDays': BUDGETS['events.windowDays'],
        'events.samples': BUDGETS['events.samples'],
        'sky-fact.samples': BUDGETS['sky-fact.samples'],
      },
      search: { window: 'start-exclusive-end-inclusive', completeness: 'tested-not-proven' },
      dates: ANY_ZONE_DAY_TEXT,
    },
    resources: RESOURCES.map(({ uri, name, mimeType }) => ({ uri, name, mimeType })),
    unsupported: [...UNSUPPORTED],
    privacy: { ...PRIVACY },
    receipt,
    cite: citeFor('get_capabilities', receipt),
  };
  return { ok: true, value };
}

export function calculateNatalChart(args: z.infer<typeof NATAL_INPUT>): ToolOutcome {
  const instant = parseInstant(args.utc);
  if (!instant.ok) return { ok: false, refusal: `${instant.reason}.` };
  const place = parseCoordinates(args.latitude, args.longitude);
  if (!place.ok) return { ok: false, refusal: `${place.reason}.` };
  // Two rules the engine enforces with an internal error code. Checked here so
  // the caller is told the rule rather than shown a code from inside the codec.
  const misused = args.reference === 'utc-noon' ? utcNoonMisused(instant.instant, args.timeKnown) : null;
  if (misused !== null) return { ok: false, refusal: `${misused}.` };
  const polar = polarAngleExclusion(place.coordinates, args.timeKnown);
  if (polar !== null) return { ok: false, refusal: `${polar}.` };

  let envelope: NatalEnvelope;
  try {
    const chart = natalChart({
      utc: instant.instant,
      ...(place.coordinates ?? {}),
      houseSystem: args.houseSystem,
      timeKnown: args.timeKnown,
    });
    // The supplied spelling is recorded as supplied: an offset the caller wrote
    // is theirs, and normalising it to Z would quietly lose what they said.
    envelope = createNatalEnvelope(chart, {
      sourceInstant: instant.supplied,
      ...(args.reference ? { reference: args.reference } : {}),
    });
  } catch (error) {
    return { ok: false, refusal: `The engine refused this calculation: ${refusalOf(error)}.` };
  }

  const { receipt, result } = envelope;
  // A receipt of the current conventions set always names its ephemeris; the
  // type leaves it optional for records from before rc.8, which this engine
  // never writes. Checked rather than assumed: a throw here is a refusal.
  const { ephemeris } = receipt.engine;
  if (!ephemeris) throw new TypeError('The engine wrote a receipt that names no ephemeris');
  const engine = { name: receipt.engine.name, version: receipt.engine.version, ephemeris };
  // The summary cites the receipt it leaves out, so a summary and a record of
  // one calculation cite one digest; only the record carries the receipt.
  const cite = citeFor('calculate_natal_chart', receipt);
  const value: NatalRecordOutput | NatalSummaryOutput = args.output === 'record'
    ? {
      engine,
      schema: envelope.schema,
      // An explicit, documented choice: the record repeats the inputs back.
      record: serializeNatalEnvelope(envelope),
      cite,
    }
    : {
      engine,
      // These four are not an echo of the request. Without them a position
      // table cannot be read: whether a time was known, which house system was
      // asked for, which one the engine could use, and why one is absent.
      timeKnown: receipt.timeKnown,
      houses: receipt.houses,
      inputFlags: receipt.inputFlags,
      resultFlags: receipt.resultFlags,
      bodies: result.bodies,
      angles: result.angles,
      cusps: result.houses?.cusps ?? null,
      aspects: result.aspects,
      cite,
    };
  return bounded(value);
}

export function compareCalculationRecords(args: z.infer<typeof COMPARE_INPUT>): ToolOutcome {
  const left = readRecord('first', args.left);
  if (!left.ok) return { ok: false, refusal: left.refusal };
  const right = readRecord('second', args.right);
  if (!right.ok) return { ok: false, refusal: right.refusal };

  let comparison: ReturnType<typeof compareEnvelopes>;
  try {
    comparison = compareEnvelopes(left.envelope, right.envelope, { engineVersion: ENGINE_VERSION, replay });
  } catch (error) {
    return { ok: false, refusal: `The comparison could not be completed: ${refusalOf(error)}.` };
  }

  const substantive = comparison.differences.filter((row) => row.kind !== 'display');
  if (comparison.differences.length > LIMITS.differences) {
    return { ok: false, refusal: `The comparison produced ${comparison.differences.length} rows, over the ${LIMITS.differences}-row limit; nothing is returned rather than a trimmed answer that would read as complete.` };
  }
  if (comparison.explanations.length > LIMITS.explanations) {
    return { ok: false, refusal: `The comparison produced ${comparison.explanations.length} candidate causes, over the ${LIMITS.explanations} limit.` };
  }
  // The default leaves out the values of rows whose contents are birth details
  // or computed positions, keeping the row, its label, its kind and its numeric
  // difference. Which field moved and by how much is the diagnosis; the
  // absolute values are a second copy of what the caller already sent.
  const full = args.output === 'full';
  // Copies, so a reply shares no object with the comparison that made it. A
  // record may carry numbers as large as Number.MAX_VALUE, so the difference of
  // two can overflow to an infinity, which has no JSON form: it is sent as null,
  // as the text reply always wrote it, rather than failing the output schema.
  const copy = (row: Difference): Difference => ({ ...row, delta: Number.isFinite(row.delta) ? row.delta : null });
  const differences = full ? comparison.differences.map(copy) : comparison.differences.map((row) => {
    if (rowValueIsTheFinding(row.id)) return copy(row);
    const { left: _left, right: _right, ...rest } = copy(row);
    return { ...rest, valuesWithheld: true as const };
  });

  const receipt = comparisonReceipt(args.output);
  const value: CompareOutput = {
    identical: comparison.identical,
    counts: {
      differences: comparison.differences.length,
      substantive: substantive.length,
      displayOnly: comparison.differences.length - substantive.length,
      explanations: comparison.explanations.length,
    },
    output: args.output,
    differences,
    explanations: comparison.explanations.map((row) => ({ ...row, covers: [...row.covers] })),
    limits: [...comparison.limits],
    disclosure: PRIVACY.output,
    ...(full ? {} : { withheld: PRIVACY.withheld }),
    receipt,
    cite: citeFor('compare_calculation_records', receipt),
  };
  return bounded(value);
}

/**
 * What an engine or codec throw is allowed to say back. The message of a known
 * error class is kept because those are fixed strings the engine authors wrote;
 * anything else is reported by class alone, because an unknown throw could
 * carry an argument value in its message.
 *
 * A codec rejection is translated rather than quoted: its message carries the
 * raw error code, which tells a caller nothing they can act on. The same
 * sentences the comparison path uses are reused here — an AI review found this
 * path returning `Natal envelope rejected: invalid_context..`, complete with the
 * doubled full stop from appending one to a message that already ended in it.
 */
function refusalOf(error: unknown): string {
  const code = error instanceof Error && error.name === 'NatalEnvelopeError'
    ? (error as { code?: NatalEnvelopeErrorCode }).code : undefined;
  if (code !== undefined && Object.hasOwn(PARSE_REFUSALS, code)) {
    return `the calculation record it produced ${PARSE_REFUSALS[code]}`;
  }
  if (error instanceof RangeError || error instanceof TypeError) return trimStop(error.message);
  if (error instanceof Error && error.name === 'NatalEnvelopeError') return trimStop(error.message);
  return error instanceof Error ? error.name : 'unknown error';
}

const trimStop = (message: string) => message.replace(/\.+$/, '');
