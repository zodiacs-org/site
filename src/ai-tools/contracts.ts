import { z } from 'zod';
import { EVENT_BODIES, EVENT_KINDS, PHASE_NAMES, POSITION_BODIES, SIGN_SLUGS } from '../lib/compute-api/constants';

export const AI_VERSION = '0.1.0';
export const AI_RESULT_SCHEMA = 'zodiacs.ai-tool-result.v1';
export const AI_TOOL_NAMES = ['get_capabilities', 'get_sky', 'get_upcoming_events', 'check_sky_fact', 'search_zodiacs'] as const;
export type AiToolName = typeof AI_TOOL_NAMES[number];
export const MAX_EVENT_DAYS = 31;
export const MAX_HTTP_BYTES = 16_384;
export const AI_ROUTE_PARAM = '__zodiacs_ai';
export const AI_SWITCH_ENV = 'ZODIACS_MCP_ENABLED';
export const ORIGIN = 'https://zodiacs.org';
export const WIDGET_URI = 'ui://zodiacs/sky-events-v1.html';
export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true } as const;

const instant = z.string().min(20).max(29).describe('ISO 8601 instant with Z or a numeric UTC offset, years 1800–2199.');
const zone = z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/).describe('IANA timezone for display, such as Asia/Bangkok. Omitted means UTC.');
const date = z.string().regex(/^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/);

export const INPUT_SCHEMAS = {
  get_capabilities: z.strictObject({}),
  get_sky: z.strictObject({ instant: instant.optional(), zone: zone.optional(), bodies: z.array(z.enum(POSITION_BODIES)).min(1).max(12).optional() }),
  get_upcoming_events: z.strictObject({ from: instant.optional(), to: instant.optional(), zone: zone.optional(), bodies: z.array(z.enum(EVENT_BODIES)).min(1).max(10).optional(), kinds: z.array(z.enum(EVENT_KINDS)).min(1).max(3).optional() }).superRefine((args, context) => {
    // Native sidebar/thread entrypoints invoke the tool with exactly {}.
    // Every explicit search must still supply both bounds.
    if ((!args.from || !args.to) && Object.keys(args).length !== 0) context.addIssue({ code: 'custom', message: 'Supply both from and to, or an empty object for the next seven days in UTC.' });
  }),
  check_sky_fact: z.strictObject({ kind: z.enum(['sign', 'retrograde', 'ingress', 'phase']), body: z.enum(EVENT_BODIES).optional(), sign: z.enum(SIGN_SLUGS).optional(), phase: z.enum(PHASE_NAMES).optional(), instant: instant.optional(), date: date.optional(), zone: zone.optional() }),
  search_zodiacs: z.strictObject({ query: z.string().trim().min(2).max(200) }),
};

const link = z.object({ title: z.string(), url: z.url() });
const jsonObject = z.record(z.string(), z.unknown());
const calculation = z.object({ schema: z.string(), result: jsonObject, receipt: jsonObject, backend: jsonObject, cite: z.object({ url: z.url(), receipt: z.string(), engine: z.string(), version: z.string() }) });
const localTime = z.object({ utc: z.string(), zone: z.string(), display: z.string() });
const body = z.object({ body: z.string(), lon: z.number(), lat: z.number(), speed: z.number(), retrograde: z.boolean(), sign: z.string(), degree: z.number() });
const positionResult = z.object({ instants: z.array(z.object({ instant: z.string(), bodies: z.array(body), deltaT: jsonObject, timeScale: jsonObject, flags: z.array(z.string()) })) });
const event = z.object({ kind: z.enum(EVENT_KINDS), at: z.string(), localAt: z.string(), body: z.string().optional(), sign: z.string(), type: z.string().optional(), retrograde: z.boolean().optional(), lon: z.number().optional(), degree: z.number().optional() });
const dataSchemas = {
  get_capabilities: z.object({ name: z.literal('Zodiacs'), version: z.string(), engine: jsonObject, tools: z.array(z.enum(AI_TOOL_NAMES)), limits: jsonObject, conventions: jsonObject, coverage: jsonObject, privacy: z.string(), limitations: z.array(z.string()) }),
  get_sky: z.object({ mode: z.enum(['current-instant', 'requested-instant']), time: localTime, calculation: calculation.extend({ result: positionResult }), moonPhase: z.object({ name: z.string(), angle: z.number(), illumination: z.number() }), interpretation: z.literal('Astronomical calculations; no personal prediction is supplied.') }),
  get_upcoming_events: z.object({ from: z.string(), to: z.string(), zone: z.string(), events: z.array(event), calculation, completeness: z.literal('tested-not-proven') }),
  check_sky_fact: z.object({ answer: z.enum(['true', 'false', 'depends']), calculation, interpretation: z.literal('The verdict checks an astronomical proposition, not an astrological prediction.') }),
  search_zodiacs: z.object({ scope: z.literal('curated-consumer-guides'), results: z.array(z.object({ title: z.string(), description: z.string(), kind: z.string(), url: z.url() })).max(5) }),
};

export const ERROR_SCHEMA = z.object({ schema: z.literal(AI_RESULT_SCHEMA), ok: z.literal(false), tool: z.enum(AI_TOOL_NAMES), error: z.object({ code: z.string(), message: z.string(), retryAfterSeconds: z.number().optional() }) });
function outputSchema<T extends AiToolName, S extends z.ZodType>(tool: T, data: S) {
  return z.union([
    z.object({ schema: z.literal(AI_RESULT_SCHEMA), ok: z.literal(true), tool: z.literal(tool), data, links: z.array(link) }),
    ERROR_SCHEMA,
  ]);
}
export const OUTPUT_SCHEMAS = {
  get_capabilities: outputSchema('get_capabilities', dataSchemas.get_capabilities), get_sky: outputSchema('get_sky', dataSchemas.get_sky),
  get_upcoming_events: outputSchema('get_upcoming_events', dataSchemas.get_upcoming_events), check_sky_fact: outputSchema('check_sky_fact', dataSchemas.check_sky_fact),
  search_zodiacs: outputSchema('search_zodiacs', dataSchemas.search_zodiacs),
};

export const TOOL_DESCRIPTIONS: Record<AiToolName, string> = {
  get_capabilities: 'Use this when you need the supported operations, versions, bounds and privacy of Zodiacs before choosing another tool. Read-only; no signup or birth data required.',
  get_sky: 'Use this when the user asks where planets are at an explicit instant or right now. Omit instant only for the current server instant. Returns tropical positions, Moon phase, explicit UTC and display timezone, calculation receipt and method links. Do not describe the result as a personal prediction.',
  get_upcoming_events: 'Use this when the user asks what changes in a bounded week or month. Supply both from/to instants and the requested display timezone. Exactly {} opens the sky calendar for seven days from the current server instant in UTC. Finds supported sign ingresses, stations and new/full Moons in at most 31 days. Search completeness is tested, not proven; this does not find eclipses or all possible aspects.',
  check_sky_fact: 'Use this when the user wants to check an astronomical sign, retrograde, ingress or lunar-phase claim. Sign/retrograde take either instant or date; ingress/phase take date. Date checks can return depends, especially without a timezone. This cannot verify predictions, medical advice, relationship outcomes or investment timing.',
  search_zodiacs: 'Use this when the user wants a relevant Zodiacs calculator or learning guide. Searches a small curated consumer catalogue and returns at most five canonical links, without fetching arbitrary URLs or requiring a click to obtain a calculation.',
};
