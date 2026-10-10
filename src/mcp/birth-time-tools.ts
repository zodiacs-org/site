/** Local wall time through the carried package geo entry; no site clock algorithm. */
import { z } from 'zod';
import { ENGINE_VERSION } from '@zodiacs/engine';
import { TZDB, prepareLocalTime, resolveBirth, resolveLocalToUtc } from '@zodiacs/engine/geo';
import { receiptDigest } from '../lib/receipt-digest';
import { ADAPTER_NAME, ADAPTER_VERSION, HOUSE_SYSTEMS, bounded, parseInstant } from './bounds';
import type { ToolOutcome } from './tools';

export const LOCAL_BIRTH_RESULT_SCHEMA = 'zodiacs.mcp-local-birth.v1' as const;
export const LOCAL_BIRTH_RECEIPT_SCHEMA = 'zodiacs.mcp-local-birth-receipt.v1' as const;
export const LOCAL_BIRTH_DOCS_URL = 'https://zodiacs.org/methodology/';

export const RESOLVE_BIRTH_INPUT = z.strictObject({
  date: z.string().length(10).regex(/^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/)
    .describe('The written local date, YYYY-MM-DD, 1800–2199, in the selected calendar. The package rejects nonexistent dates.'),
  time: z.string().length(5).regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional()
    .describe('The supplied local HH:MM time. Never invent one. When omitted, local noon is an explicit unknown-time reference, not a recovered birth time.'),
  timeZone: z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/)
    .describe('An explicit IANA time zone, including letter-case variants accepted by Intl. No place name is resolved and no zone is inferred.'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
    .describe('Degrees east, with latitude supplied too. Before the package zone era ends, a plausible longitude selects the birthplace mean time.'),
  timeKnown: z.boolean().optional()
    .describe('Defaults to whether time was supplied. true requires time. false labels the instant as a reference and does not establish whole-date coverage.'),
  houseSystem: z.enum(HOUSE_SYSTEMS).optional(),
  calendar: z.enum(['gregorian', 'julian']).optional()
    .describe('The written calendar, Gregorian by default. Choose explicitly; the tool does not infer historical calendar adoption.'),
}).superRefine((input, context) => {
  if ((input.latitude === undefined) !== (input.longitude === undefined)) {
    context.addIssue({ code: 'custom', message: 'Supply both latitude and longitude, or neither.' });
  }
  if (input.timeKnown === true && input.time === undefined) {
    context.addIssue({ code: 'custom', message: 'A known birth time requires the supplied local time.' });
  }
});

const flags = z.array(z.enum(['dst-gap', 'dst-fold', 'lmt']));
const transition = z.strictObject({
  at: z.iso.datetime(),
  offsetBeforeMinutes: z.number(),
  offsetAfterMinutes: z.number(),
  cause: z.enum(['dst', 'legal-change', 'date-line']),
}).nullable();
const meanTime = z.strictObject({ longitude: z.number(), zoneOffsetMinutes: z.number() }).nullable();
const zone = z.strictObject({
  source: z.enum(['tzdb', 'intl']),
  tzdbVersion: z.string().nullable(),
  dataForm: z.enum(['main+backzone', 'main', 'host']),
  abbreviation: z.string().nullable(),
  dst: z.boolean().nullable(),
});
const localResolution = z.strictObject({
  date: z.string(),
  time: z.string(),
  timeZone: z.string(),
  offsetMinutes: z.number(),
  gapShiftMinutes: z.number(),
  policy: z.strictObject({ fold: z.literal('earlier'), gap: z.literal('shift-forward') }),
  calendar: z.enum(['gregorian', 'julian']),
  writtenDate: z.string(),
  tzdbVersion: z.string().nullable(),
  dataForm: z.enum(['main+backzone', 'main', 'host']),
  clock: z.enum(['local-mean-time', 'legal']),
  transition,
  localMeanTime: meanTime,
});
const receipt = z.strictObject({
  schema: z.literal(LOCAL_BIRTH_RECEIPT_SCHEMA),
  tool: z.literal('resolve_birth_time'),
  adapter: z.strictObject({ name: z.literal(ADAPTER_NAME), version: z.string() }),
  engine: z.strictObject({ name: z.literal('@zodiacs/engine'), version: z.string() }),
  tzdb: z.strictObject({ version: z.string(), sha256: z.string(), form: z.literal('main+backzone') }),
  localResolution,
  reference: z.enum(['supplied-instant', 'local-noon']),
}).describe('The clock policy and local resolution used. This contains personal birth details; its digest is not anonymous.');

export const RESOLVE_BIRTH_OUTPUT = z.strictObject({
  schema: z.literal(LOCAL_BIRTH_RESULT_SCHEMA),
  birth: z.strictObject({
    utc: z.iso.datetime(),
    timeKnown: z.boolean(),
    houseSystem: z.enum(HOUSE_SYSTEMS),
    flags,
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
  resolution: z.strictObject({
    utc: z.iso.datetime(),
    offsetMinutes: z.number(),
    flags,
    date: z.string(),
    writtenDate: z.string(),
    calendar: z.enum(['gregorian', 'julian']),
    jump: z.strictObject({ kind: z.enum(['gap', 'fold']), cause: z.enum(['dst', 'legal-change', 'date-line']) }).nullable(),
    transition,
    localMeanTime: meanTime,
    zone,
    intlOffsetMinutes: z.number().nullable(),
  }),
  reference: z.enum(['supplied-instant', 'local-noon']),
  receipt,
  cite: z.strictObject({
    url: z.literal(LOCAL_BIRTH_DOCS_URL),
    receipt: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    engine: z.literal('@zodiacs/engine'),
    version: z.string(),
  }),
  limitations: z.array(z.string()),
});

export async function resolveBirthTime(input: unknown): Promise<ToolOutcome> {
  const parsed = RESOLVE_BIRTH_INPUT.safeParse(input);
  if (!parsed.success) return { ok: false, refusal: 'Supply a valid local date, time and explicit time zone, with both coordinates or neither. A known birth time needs its supplied local time.' };
  const args = parsed.data;
  try {
    await prepareLocalTime(args.date, args.timeZone);
    // This is the package entry named by the programme adoption gate.
    const birth = resolveBirth(args);
    const resolution = resolveLocalToUtc(args.date, args.time ?? '12:00', args.timeZone, {
      longitude: args.longitude, calendar: args.calendar,
    });
    const utc = birth.utc instanceof Date ? birth.utc.toISOString() : String(birth.utc);
    if (!parseInstant(utc).ok) return { ok: false, refusal: 'The resolved instant falls outside this adapter’s existing 1800–2199 reference span.' };
    if (utc !== resolution.utc.toISOString()) throw new Error('Package local birth resolution disagrees');
    const reference = args.time === undefined ? 'local-noon' as const : 'supplied-instant' as const;
    const clockReceipt = {
      schema: LOCAL_BIRTH_RECEIPT_SCHEMA,
      tool: 'resolve_birth_time' as const,
      adapter: { name: ADAPTER_NAME, version: ADAPTER_VERSION },
      engine: { name: '@zodiacs/engine' as const, version: ENGINE_VERSION },
      tzdb: { ...TZDB },
      localResolution: resolution.localResolution,
      reference,
    };
    return bounded(RESOLVE_BIRTH_OUTPUT.parse({
      schema: LOCAL_BIRTH_RESULT_SCHEMA,
      birth: { ...birth, utc },
      resolution: {
        utc: resolution.utc.toISOString(),
        offsetMinutes: resolution.offsetMinutes,
        flags: resolution.flags,
        date: resolution.date,
        writtenDate: resolution.writtenDate,
        calendar: resolution.calendar,
        jump: resolution.jump,
        transition: resolution.transition,
        localMeanTime: resolution.localMeanTime,
        zone: resolution.zone,
        intlOffsetMinutes: resolution.intlOffsetMinutes,
      },
      reference,
      receipt: clockReceipt,
      cite: { url: LOCAL_BIRTH_DOCS_URL, receipt: receiptDigest(clockReceipt), engine: '@zodiacs/engine', version: ENGINE_VERSION },
      limitations: [
        'Uses the package’s pinned pre-1970 clock convention, including its alias policy; existing site forms may use a different host-clock convention.',
        'Resolves the supplied zone and written calendar; it does not identify a place, infer a historical zone or calendar, rectify a birth time, or calculate a chart.',
        'An unknown-time reference is one instant, not coverage of the whole local date. The reply and its receipt contain personal birth details.',
      ],
    }));
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, refusal: 'The package refused the local date, time, zone, calendar or coordinates. No partial resolution is returned.' };
    throw error;
  }
}
