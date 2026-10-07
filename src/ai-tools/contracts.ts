import { z } from 'zod';
import { BUDGETS, EVENT_BODIES, EVENT_KINDS, PHASE_NAMES, POSITION_BODIES, SIGN_SLUGS } from '../lib/compute-api/constants';
import { HOROSCOPE_FOCUSES, HOROSCOPE_PERIODS, HOROSCOPE_SIGNS, HOROSCOPE_URI } from './horoscope/reading';

export const AI_VERSION = '0.4.0';
export const AI_RESULT_SCHEMA = 'zodiacs.ai-tool-result.v1';
export const AI_TOOL_NAMES = ['get_capabilities', 'get_sky', 'get_upcoming_events', 'check_sky_fact', 'get_horoscope', 'open_chart_studio'] as const;
export type AiToolName = typeof AI_TOOL_NAMES[number];
/** The compute API's own events bound. */
export const MAX_EVENT_DAYS = BUDGETS['events.windowDays'];
export const MAX_HTTP_BYTES = 16_384;
export const AI_ROUTE_PARAM = '__zodiacs_ai';
export const AI_SWITCH_ENV = 'ZODIACS_MCP_ENABLED';
export const ORIGIN = 'https://zodiacs.org';
export const WIDGET_URI = 'ui://zodiacs/sky-events-v1.html';
export const STUDIO_URI = 'ui://zodiacs/chart-studio-v2.html';
// Keep existing host definitions readable while their tool metadata is refreshed.
export const LEGACY_STUDIO_URI = 'ui://zodiacs/chart-studio-v1.html';
export { HOROSCOPE_URI };
export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true } as const;

/** What people see on the tool-call line and in the plugin's details. */
export const TOOL_TITLES: Record<AiToolName, string> = {
  get_capabilities: 'What Zodiacs can do',
  get_sky: 'Sky right now',
  get_upcoming_events: 'Sky calendar',
  check_sky_fact: 'Check a sky fact',
  get_horoscope: 'Horoscopes',
  open_chart_studio: 'Chart Studio',
};

const instant = z.string().min(20).max(29).describe('A moment as an ISO 8601 time with Z or an offset, such as 2026-10-08T09:00:00+07:00 (years 1800–2199).');
export const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
const zone = z.string().min(1).max(64).regex(ZONE_PATTERN).describe("The person's time zone, such as Asia/Bangkok or America/New_York. Without it, times are in UTC.");
const date = z.string().regex(/^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/);

export const INPUT_SCHEMAS = {
  get_capabilities: z.strictObject({}),
  open_chart_studio: z.strictObject({}),
  get_sky: z.strictObject({ instant: instant.optional(), zone: zone.optional(), bodies: z.array(z.enum(POSITION_BODIES)).min(1).max(12).optional() }),
  get_upcoming_events: z.strictObject({ from: instant.optional(), to: instant.optional(), zone: zone.optional(), bodies: z.array(z.enum(EVENT_BODIES)).min(1).max(10).optional(), kinds: z.array(z.enum(EVENT_KINDS)).min(1).max(3).optional() }).superRefine((args, context) => {
    // Native sidebar/thread entrypoints invoke the tool with exactly {}.
    // Every explicit search must still supply both bounds.
    if ((!args.from || !args.to) && Object.keys(args).length !== 0) context.addIssue({ code: 'custom', message: 'Supply both from and to, or an empty object for the next seven days in UTC.' });
  }),
  check_sky_fact: z.strictObject({ kind: z.enum(['sign', 'retrograde', 'ingress', 'phase']), body: z.enum(EVENT_BODIES).optional(), sign: z.enum(SIGN_SLUGS).optional(), phase: z.enum(PHASE_NAMES).optional(), instant: instant.optional(), date: date.optional(), zone: zone.optional() }),
  get_horoscope: z.strictObject({
    sign: z.enum(HOROSCOPE_SIGNS).optional().describe('Sun sign. Leave it out to let the person choose; never guess it.'),
    period: z.enum(HOROSCOPE_PERIODS).optional().describe('day (the default) or week.'),
    focus: z.enum(HOROSCOPE_FOCUSES).optional().describe('For a daily reading: general (the default), love or career.'),
    date: date.optional().describe("A date such as 2026-10-08. Leave it out for the person's today."),
    zone: zone.optional(),
  }),
};

const link = z.object({ title: z.string(), url: z.url() });
const jsonObject = z.record(z.string(), z.unknown());
const calculation = z.object({ schema: z.string(), result: jsonObject, receipt: jsonObject, backend: jsonObject, cite: z.object({ url: z.url(), receipt: z.string(), engine: z.string(), version: z.string() }) });
const localTime = z.object({ utc: z.string(), zone: z.string(), display: z.string() });
const body = z.object({ body: z.string(), lon: z.number(), lat: z.number(), speed: z.number(), retrograde: z.boolean(), sign: z.string(), degree: z.number() });
const positionResult = z.object({ instants: z.array(z.object({ instant: z.string(), bodies: z.array(body), deltaT: jsonObject, timeScale: jsonObject, flags: z.array(z.string()) })) });
const event = z.object({ kind: z.enum(EVENT_KINDS), at: z.string(), localAt: z.string(), body: z.string().optional(), sign: z.string(), type: z.string().optional(), retrograde: z.boolean().optional(), lon: z.number().optional(), degree: z.number().optional() });
const horoscope = z.object({
  status: z.enum(['available', 'unavailable', 'choose-sign']),
  sign: z.enum(HOROSCOPE_SIGNS).optional(),
  signName: z.string().optional(),
  period: z.enum(HOROSCOPE_PERIODS),
  focus: z.enum(HOROSCOPE_FOCUSES),
  date: z.string(),
  dateLabel: z.string(),
  zone: z.string(),
  zoneLabel: z.string(),
  zoneSource: z.enum(['request', 'assistant', 'default']),
  reading: z.object({ title: z.string(), paragraphs: z.array(z.object({ heading: z.string().optional(), text: z.string() })) }).optional(),
  why: z.object({ note: z.string(), facts: z.array(z.object({ text: z.string(), when: z.string() })), houses: z.array(z.string()) }).optional(),
  available: z.array(z.object({ date: z.string(), label: z.string() })).optional(),
  message: z.string().optional(),
  disclosure: z.string(),
});
const dataSchemas = {
  open_chart_studio: z.object({ title: z.literal('Chart Studio'), calculation: z.literal('browser-local'), initialChart: z.literal('birth-details'), sharing: z.literal('user-reviewed-selection-only') }),
  get_capabilities: z.object({ name: z.literal('Zodiacs'), version: z.string(), engine: jsonObject, tools: z.array(z.enum(AI_TOOL_NAMES)), limits: jsonObject, conventions: jsonObject, coverage: jsonObject, privacy: z.string(), limitations: z.array(z.string()) }),
  get_sky: z.object({ mode: z.enum(['current-instant', 'requested-instant']), time: localTime, calculation: calculation.extend({ result: positionResult }), moonPhase: z.object({ name: z.string(), angle: z.number(), illumination: z.number() }), interpretation: z.literal('Astronomical calculations; no personal prediction is supplied.') }),
  get_upcoming_events: z.object({ from: z.string(), to: z.string(), zone: z.string(), events: z.array(event), calculation, completeness: z.literal('tested-not-proven') }),
  check_sky_fact: z.object({ answer: z.enum(['true', 'false', 'depends']), calculation, interpretation: z.literal('The verdict checks an astronomical proposition, not an astrological prediction.') }),
  get_horoscope: horoscope,
};

export const ERROR_SCHEMA = z.object({ schema: z.literal(AI_RESULT_SCHEMA), ok: z.literal(false), tool: z.enum(AI_TOOL_NAMES), error: z.object({ code: z.string(), message: z.string(), retryAfterSeconds: z.number().optional() }) });
function outputSchema<T extends AiToolName, S extends z.ZodType>(tool: T, data: S) {
  return z.union([
    z.object({ schema: z.literal(AI_RESULT_SCHEMA), ok: z.literal(true), tool: z.literal(tool), data, links: z.array(link) }),
    ERROR_SCHEMA,
  ]);
}
export const OUTPUT_SCHEMAS = {
  open_chart_studio: outputSchema('open_chart_studio', dataSchemas.open_chart_studio),
  get_capabilities: outputSchema('get_capabilities', dataSchemas.get_capabilities), get_sky: outputSchema('get_sky', dataSchemas.get_sky),
  get_upcoming_events: outputSchema('get_upcoming_events', dataSchemas.get_upcoming_events), check_sky_fact: outputSchema('check_sky_fact', dataSchemas.check_sky_fact),
  get_horoscope: outputSchema('get_horoscope', dataSchemas.get_horoscope),
};

/** Read by the assistant and shown to people in the plugin's details: plain first sentence, then routing detail. */
export const TOOL_DESCRIPTIONS: Record<AiToolName, string> = {
  open_chart_studio: 'Opens Chart Studio, an interactive birth chart the person fills in themselves: birth date, place, and time if they know it. Call it with no arguments and do not ask for birth details first. The chart is calculated inside the panel; you see only the parts the person chooses to share.',
  get_capabilities: 'Lists what Zodiacs can do, its limits and how it handles privacy. Use it when the person asks what Zodiacs can do, or when you need those details before choosing another tool; it is not needed to turn down a request Zodiacs does not handle. No sign-in or birth details needed.',
  get_sky: "Shows where the Sun, Moon and planets are right now, or at a moment the person names, with the Moon's phase. Pass the person's time zone if you know it so times read on their clock. Astronomy only; it makes no personal prediction.",
  get_upcoming_events: "Shows what changes in the sky over the coming days or weeks: planets changing sign, turning retrograde or direct, and new and full Moons, for up to 92 days. Supply from and to, and the person's time zone. With no arguments it opens the calendar for the next seven days. It does not list eclipses or every aspect.",
  check_sky_fact: "Checks a claim such as 'Is Mercury retrograde today?' or 'Did the Sun enter Libra on 23 September?' and answers yes, no, or that it depends on the time zone when the answer changes during that day. Use instant or date for sign and retrograde checks, date for ingress and Moon-phase checks. Astronomy only; it cannot check predictions.",
  get_horoscope: "Shows a Sun-sign horoscope, general, love or career for today or general for this week, written for the person's own date. Use it when the person asks for a horoscope or reading, not to answer a request for certainty about a relationship, money or health. Leave out the sign to let them choose; never guess it. Pass their time zone if you know it. Share the reading as written, keep its dates, and present it as reflection, not a personal birth-chart forecast.",
};
