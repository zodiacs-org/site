import { z } from 'zod';
import { BUDGETS, EVENT_BODIES, EVENT_KINDS, PHASE_NAMES, POSITION_BODIES, SIGN_SLUGS } from '../lib/compute-api/constants';
import { OCCASION_KINDS } from '../lib/occasions/kinds';
import { BEST_DAYS_MAX_WINDOW } from '../lib/occasions/best-dates';
import { compatibilityInput, compatibilityResult } from './features/compatibility';
import { chartTwinsData, chartTwinsInput, famousChartData, famousChartInput } from './features/people';
import { birthdayData, birthdayInput, skyCalendarData, skyCalendarInput } from './features/birthday';
import { HOROSCOPE_FOCUSES, HOROSCOPE_PERIODS, HOROSCOPE_SIGNS, HOROSCOPE_URI, LEGACY_HOROSCOPE_URIS } from './horoscope/reading';

export const AI_VERSION = '0.5.0';
export const AI_RESULT_SCHEMA = 'zodiacs.ai-tool-result.v1';
/** The released tools: what the reviewed plugin offers. */
export const AI_TOOL_NAMES = ['get_capabilities', 'get_sky', 'get_upcoming_events', 'check_sky_fact', 'get_horoscope', 'open_chart_studio'] as const;
/**
 * The 0.5.0 tools: the occasion tools, compatibility, famous people, birthdays and the calendar feed.
 * Offered only where ZODIACS_OCCASIONS_ENABLED=1 (docs/platform/zodiacs-ai/OCCASIONS.md).
 */
export const OCCASION_TOOL_NAMES = ['get_occasion_sky', 'get_life_milestones', 'get_compatibility', 'find_chart_twins', 'get_famous_chart', 'get_birthday', 'get_sky_calendar'] as const;
export const ALL_AI_TOOL_NAMES = [...AI_TOOL_NAMES, ...OCCASION_TOOL_NAMES] as const;
export type AiToolName = typeof ALL_AI_TOOL_NAMES[number];
export const OCCASIONS_SWITCH_ENV = 'ZODIACS_OCCASIONS_ENABLED';
/** The compute API's own events bound. */
export const MAX_EVENT_DAYS = BUDGETS['events.windowDays'];
export const MAX_HTTP_BYTES = 16_384;
export const AI_ROUTE_PARAM = '__zodiacs_ai';
export const AI_SWITCH_ENV = 'ZODIACS_MCP_ENABLED';
export const ORIGIN = 'https://zodiacs.org';
// ChatGPT keeps a panel by its URI, so a changed panel gets a new one. The
// earlier URIs stay registered and serve the current panel, so conversations
// and host definitions that still name them keep working.
export const WIDGET_URI = 'ui://zodiacs/sky-events-v3.html';
export const LEGACY_WIDGET_URIS = ['ui://zodiacs/sky-events-v2.html', 'ui://zodiacs/sky-events-v1.html'] as const;
export const STUDIO_URI = 'ui://zodiacs/chart-studio-v4.html';
export const LEGACY_STUDIO_URIS = ['ui://zodiacs/chart-studio-v3.html', 'ui://zodiacs/chart-studio-v2.html', 'ui://zodiacs/chart-studio-v1.html'] as const;
/** The first Chart Studio URI, kept for existing callers. */
export const LEGACY_STUDIO_URI = 'ui://zodiacs/chart-studio-v1.html';
export { HOROSCOPE_URI, LEGACY_HOROSCOPE_URIS };
/** The occasion tools' panel, offered only while ZODIACS_OCCASIONS_ENABLED=1. */
export const OCCASIONS_URI = 'ui://zodiacs/occasions-v4.html';
export const LEGACY_OCCASIONS_URIS = ['ui://zodiacs/occasions-v3.html', 'ui://zodiacs/occasions-v2.html', 'ui://zodiacs/occasions-v1.html'] as const;
export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true } as const;

/** What people see on the tool-call line and in the plugin's details. */
export const TOOL_TITLES: Record<AiToolName, string> = {
  get_capabilities: 'What Zodiacs can do',
  get_sky: 'Sky right now',
  get_upcoming_events: 'Sky calendar',
  check_sky_fact: 'Check a sky fact',
  get_horoscope: 'Horoscopes',
  open_chart_studio: 'Chart Studio',
  get_occasion_sky: 'The sky on a day',
  get_life_milestones: 'Life milestones',
  get_compatibility: 'Compare two charts',
  find_chart_twins: 'Chart twins',
  get_famous_chart: 'A famous birth chart',
  get_birthday: 'Your birthday',
  get_sky_calendar: 'Sky calendar for your calendar app',
};

const instant = z.string().min(20).max(29).describe('A moment as an ISO 8601 time with Z or an offset, such as 2026-10-08T09:00:00+07:00 (years 1800–2199).');
export const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
const zone = z.string().min(1).max(64).regex(ZONE_PATTERN).describe("The person's time zone, such as Asia/Bangkok or America/New_York. Without it, times are in UTC.");
const date = z.string().regex(/^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/);
const wallClock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

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
  get_occasion_sky: z.strictObject({
    occasion: z.enum(OCCASION_KINDS).describe('What the day is: wedding, anniversary, met (the day they met), birthday, baby (the day a baby arrived), pet, home, job, graduation, retirement, coming-of-age or gathering.'),
    date: date.optional().describe('The day, such as 2027-06-12 (years 1800–2199). Needed unless searchFrom and searchTo are given.'),
    searchFrom: date.optional().describe('To find the best days: the first day of the window to search, such as 2027-06-01. Give it with searchTo.'),
    searchTo: date.optional().describe('The last day of the window to search, such as 2027-06-30, at most 92 days after searchFrom counting both days. Every day is rated and the three best come back.'),
    time: wallClock.optional().describe('The local clock time, such as 19:00, if the person gives one. Needs zone.'),
    zone: zone.optional().describe("The place's time zone, such as Europe/Rome. Needed with a time or a place."),
    latitude: z.number().min(-90).max(90).optional().describe("Optional. The place's latitude, used only to work out sunset, golden hour and the evening sky there. Give it with longitude and zone. Nothing is stored."),
    longitude: z.number().min(-180).max(180).optional().describe("Optional. The place's longitude, with latitude, for the evening sky. Nothing is stored."),
    place: z.string().min(1).max(80).optional().describe('Optional place name printed on the card, such as Florence, Italy. Display only: it is not used in the calculation and is not stored.'),
    names: z.string().min(1).max(60).optional().describe('Optional: up to two first names to print on the card, only if the person asks for them. Display only, not stored.'),
  }).superRefine((args, context) => {
    if ((args.latitude === undefined) !== (args.longitude === undefined)) context.addIssue({ code: 'custom', message: 'Give latitude and longitude together.' });
    if ((args.time !== undefined || args.latitude !== undefined) && !args.zone) context.addIssue({ code: 'custom', message: 'A time or a place needs its time zone.' });
    if ((args.searchFrom === undefined) !== (args.searchTo === undefined)) context.addIssue({ code: 'custom', message: 'Give searchFrom and searchTo together.' });
    if (args.date === undefined && args.searchFrom === undefined) context.addIssue({ code: 'custom', message: 'Give a date, or a window to search.' });
  }),
  get_life_milestones: z.strictObject({
    birthDate: date.describe('The birth date, such as 1997-03-15.'),
    time: wallClock.optional().describe('The birth time on the local clock, if known. Needs zone.'),
    zone: zone.optional().describe("The birthplace's time zone, such as Europe/London. Needed with a time."),
    longitude: z.number().min(-180).max(180).optional().describe("The birthplace's longitude, if known, for birth times before standard time."),
  }).superRefine((args, context) => {
    if (args.time !== undefined && !args.zone) context.addIssue({ code: 'custom', message: 'A birth time needs its time zone.' });
  }),
  get_compatibility: compatibilityInput,
  find_chart_twins: chartTwinsInput,
  get_famous_chart: famousChartInput,
  get_birthday: birthdayInput,
  get_sky_calendar: skyCalendarInput,
  get_horoscope: z.strictObject({
    sign: z.enum(HOROSCOPE_SIGNS).optional().describe('Sun sign. Leave it out to let the person choose; never guess it.'),
    period: z.enum(HOROSCOPE_PERIODS).optional().describe('day (the default) or week.'),
    focus: z.enum(HOROSCOPE_FOCUSES).optional().describe('For a daily reading: general (the default), love or career.'),
    date: date.optional().describe("A date such as 2026-10-08. Leave it out for the person's today."),
    zone: zone.optional(),
    birthDate: date.optional().describe("Optional: the person's birth date, for a personal forecast of their week from their own chart. Not stored."),
    birthTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u).optional().describe('Optional birth time on the local clock; needs birthZone. Not stored.'),
    birthZone: zone.optional().describe("Optional: the birthplace's time zone, needed with birthTime. Not stored."),
  }).refine((args) => args.birthDate !== undefined || (args.birthTime === undefined && args.birthZone === undefined), { message: 'A birth time or birthplace zone needs the birth date.' }),
};

const link = z.object({ title: z.string(), url: z.url() });
const jsonObject = z.record(z.string(), z.unknown());
const calculation = z.object({ schema: z.string(), result: jsonObject, receipt: jsonObject, backend: jsonObject, cite: z.object({ url: z.url(), receipt: z.string(), engine: z.string(), version: z.string() }) });
const localTime = z.object({ utc: z.string(), zone: z.string(), display: z.string() });
const body = z.object({ body: z.string(), lon: z.number(), lat: z.number(), speed: z.number(), retrograde: z.boolean(), sign: z.string(), degree: z.number() });
const positionResult = z.object({ instants: z.array(z.object({ instant: z.string(), bodies: z.array(body), deltaT: jsonObject, timeScale: jsonObject, flags: z.array(z.string()) })) });
const event = z.object({ kind: z.enum(EVENT_KINDS), at: z.string(), localAt: z.string(), body: z.string().optional(), sign: z.string(), type: z.string().optional(), retrograde: z.boolean().optional(), lon: z.number().optional(), degree: z.number().optional() });
const personal = z.object({ timeKnown: z.boolean(), items: z.array(z.object({ title: z.string(), line: z.string(), when: z.string() })), note: z.string() });
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
  personal: personal.optional(),
  /** The share link for the reading shown, when there is one. */
  shareUrl: z.url().nullable().optional(),
  disclosure: z.string(),
});
const clockTime = z.object({ utc: z.string(), local: z.string() });
const occasionNote = 'Astrology’s reading of the day, for insight and fun — not a guarantee of how it will go.';
const occasionSky = z.object({
  occasion: z.enum(OCCASION_KINDS), date: z.string(), time: z.string().nullable(), zone: z.string().nullable(),
  place: z.string().nullable(), names: z.string().nullable(),
  card: z.object({ title: z.string(), interpretation: z.string(), closing: z.string() }),
  instant: clockTime, instantIs: z.enum(['given-time', 'local-noon', 'utc-noon']),
  sky: z.object({
    bodies: z.array(z.object({ body: z.string(), sign: z.string(), degree: z.number(), retrograde: z.boolean() })),
    moon: z.object({ phase: z.string(), illuminationPercent: z.number(), waxing: z.boolean() }),
    retrograde: z.array(z.string()),
  }),
  moonSignChange: z.object({ from: z.string(), to: z.string() }).nullable(),
  evening: z.object({
    sunrise: clockTime.nullable(), sunset: clockTime.nullable(),
    goldenHour: z.object({ start: clockTime, end: clockTime }).nullable(), civilDusk: clockTime.nullable(),
    moonrise: clockTime.nullable(), moonset: clockTime.nullable(),
    moonHighest: z.object({ at: clockTime, altitude: z.number() }).nullable(),
    planetsAfterDusk: z.array(z.string()), flags: z.array(z.string()),
  }).nullable(),
  rating: z.object({ score: z.number().int().min(0).max(100), verdict: z.string(), reasons: z.array(z.string()) }),
  /** With a search window: the three best-rated days in it, best first; the card is for date, else the best day. */
  bestDays: z.object({
    from: z.string(), to: z.string(), days: z.number().int().min(1).max(BEST_DAYS_MAX_WINDOW),
    best: z.array(z.object({ date: z.string(), score: z.number().int().min(0).max(100), verdict: z.string(), reasons: z.array(z.string()) })).max(3),
  }).nullable(),
  cardUrl: z.url().nullable(),
  shareUrl: z.url().nullable(),
  note: z.literal(occasionNote),
});
const milestone = z.object({
  kind: z.enum(['jupiter-return', 'saturn-return', 'uranus-opposition']), name: z.string(), index: z.number(), age: z.number(),
  first: z.string(), last: z.string(), passes: z.array(z.object({ at: z.string(), retrograde: z.boolean() })),
});
const lifeMilestones = z.object({
  birthDate: z.string(), timeKnown: z.boolean(), asOf: z.string(),
  milestones: z.array(milestone), next: milestone.nullable(),
  numbers: z.object({ fullMoons: z.number(), mercuryRetrogrades: z.number(), jupiterReturns: z.number() }),
  cardUrl: z.url().nullable(),
  note: z.literal('Dates of computed crossings and their traditional astrological names. Without a birth time, a pass can move by about a day.'),
});
export const OCCASION_NOTE = occasionNote;

const dataSchemas = {
  open_chart_studio: z.object({ title: z.literal('Chart Studio'), calculation: z.literal('browser-local'), initialChart: z.literal('birth-details'), sharing: z.literal('user-reviewed-selection-only') }),
  get_capabilities: z.object({ name: z.literal('Zodiacs'), version: z.string(), engine: jsonObject, tools: z.array(z.enum(ALL_AI_TOOL_NAMES)), limits: jsonObject, conventions: jsonObject, coverage: jsonObject, privacy: z.string(), limitations: z.array(z.string()) }),
  get_sky: z.object({ mode: z.enum(['current-instant', 'requested-instant']), time: localTime, calculation: calculation.extend({ result: positionResult }), moonPhase: z.object({ name: z.string(), angle: z.number(), illumination: z.number() }), interpretation: z.literal('Astronomical calculations; no personal prediction is supplied.') }),
  get_upcoming_events: z.object({ from: z.string(), to: z.string(), zone: z.string(), events: z.array(event), calculation, completeness: z.literal('tested-not-proven') }),
  check_sky_fact: z.object({ answer: z.enum(['true', 'false', 'depends']), calculation, interpretation: z.literal('The verdict checks an astronomical proposition, not an astrological prediction.') }),
  get_horoscope: horoscope,
  get_occasion_sky: occasionSky,
  get_life_milestones: lifeMilestones,
  get_compatibility: compatibilityResult,
  find_chart_twins: chartTwinsData,
  get_famous_chart: famousChartData,
  get_birthday: birthdayData,
  get_sky_calendar: skyCalendarData,
};

export const ERROR_SCHEMA = z.object({ schema: z.literal(AI_RESULT_SCHEMA), ok: z.literal(false), tool: z.enum(ALL_AI_TOOL_NAMES), error: z.object({ code: z.string(), message: z.string(), retryAfterSeconds: z.number().optional() }) });
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
  get_occasion_sky: outputSchema('get_occasion_sky', dataSchemas.get_occasion_sky),
  get_life_milestones: outputSchema('get_life_milestones', dataSchemas.get_life_milestones),
  get_compatibility: outputSchema('get_compatibility', dataSchemas.get_compatibility),
  find_chart_twins: outputSchema('find_chart_twins', dataSchemas.find_chart_twins),
  get_famous_chart: outputSchema('get_famous_chart', dataSchemas.get_famous_chart),
  get_birthday: outputSchema('get_birthday', dataSchemas.get_birthday),
  get_sky_calendar: outputSchema('get_sky_calendar', dataSchemas.get_sky_calendar),
};

/** Read by the assistant and shown to people in the plugin's details: plain first sentence, then routing detail. */
export const TOOL_DESCRIPTIONS: Record<AiToolName, string> = {
  open_chart_studio: 'Opens Chart Studio, an interactive birth chart the person fills in themselves: birth date, place, and time if they know it. Call it with no arguments and do not ask for birth details first. The chart is calculated inside the panel; you see only the parts the person chooses to share.',
  get_capabilities: 'Lists what Zodiacs can do, its limits and how it handles privacy. Use it when the person asks what Zodiacs can do, or when you need those details before choosing another tool. Zodiacs does not schedule anything, pick stocks or investments, make health predictions or guarantee outcomes, so do not call it to check before turning those requests down. No sign-in or birth details needed.',
  get_sky: "Shows where the Sun, Moon and planets are right now, or at a moment the person names, with the Moon's phase. Pass the person's time zone if you know it so times read on their clock. Astronomy only; it makes no personal prediction.",
  get_upcoming_events: "Shows what changes in the sky over the coming days or weeks: planets changing sign, turning retrograde or direct, and new and full Moons, for up to 92 days. Supply from and to, and the person's time zone. With no arguments it opens the calendar for the next seven days. It does not list eclipses or every aspect.",
  check_sky_fact: "Checks a claim such as 'Is Mercury retrograde today?' or 'Did the Sun enter Libra on 23 September?' and answers yes, no, or that it depends on the time zone when the answer changes during that day. Use instant or date for sign and retrograde checks, date for ingress and Moon-phase checks. Astronomy only; it cannot check predictions. API documentation: https://zodiacs.org/developers/compute/ .",
  get_horoscope: "Shows a Sun-sign horoscope, general, love or career for today or general for this week, written for the person's own date. Use it when the person asks for a horoscope or reading, not to answer a request for a guarantee about a relationship, money or health. Leave out the sign to let them choose; never guess it. Pass their time zone if you know it. Share the reading as written and keep its dates. If the person gives their birth date (and time and birthplace zone if known), pass them too: the result adds a personal forecast for their week from their own chart. Lead with those personal lines, with their dates. If you can schedule tasks for the person, offer once, briefly, to send them their horoscope every morning; Zodiacs itself sends no notifications. If they want to share the reading, give them the returned shareUrl exactly.",
  get_occasion_sky: "Shows the sky on a day that matters to the person: a wedding, anniversary, birthday, the day a baby arrived, a new home or another occasion. It gives the Sun and Moon signs, the Moon's phase, any retrograde planets, a card title and short lines they can use, and, with a place, sunset, golden hour, dusk, the Moon and the planets visible that evening. It needs the date; add the local time, the place's time zone and its coordinates if the person gives them. It also rates the date from 0 to 100 with a verdict and the astrological reasons (Venus, the Moon's phase and sign, retrograde planets); share the rating and its reasons plainly. When asked for the best days for an occasion, give the window as searchFrom and searchTo (up to 92 days, such as a whole month); it rates every day in it and returns the three best-rated days with their reasons, and the card for the best one unless a date is also given. When asked which of a few named dates is best, call it for each date and compare the ratings. It never guarantees how the day will go. For the printable card, copy the returned cardUrl exactly, including every field after #; do not reconstruct it from the conversation. If cardUrl is null, use the returned page link. If they want to share the rating, give them the returned shareUrl exactly.",
  get_life_milestones: "Lists astrology's life milestones from a birth date: each Jupiter return (about every 12 years), the Saturn returns (around 29, 58 and 88) and the Uranus opposition (early forties), with dates, ages and every pass of a retrograde loop, the next one coming, and how many full Moons and Mercury retrogrades the person has lived through. A birth date is enough; add the birth time and time zone if known. It makes no prediction.",
  get_compatibility: "Compares two people's birth charts: their Sun, Moon and rising signs, the closest contacts between their planets with what each traditionally means, and how their elements balance. Use it when someone asks about compatibility with a partner, friend or family member, or with a famous person. Each person needs a birth date; add a birth time, time zone and birthplace coordinates when known, and first names if they want them shown. To compare someone with a famous person Zodiacs publishes, give that side as { famous: \"<name>\" } instead: it uses their published chart for noon on their birth date, without a Moon or rising sign, and links to their page. If Zodiacs has no chart for that name it says so (found: false); never make one up. It returns a compatibility score out of 100 with scores for attraction, communication and long-term stability, a verdict and a headline: lead with the score and verdict in plain words, then the strongest and hardest contacts. Present it as astrology's reading, never a guarantee of how the relationship will turn out. If they want to share the score, give them the returned shareUrl exactly.",
  find_chart_twins: "Finds famous people whose birth charts share the person's Sun sign, Moon sign or both, from the people Zodiacs publishes charts for, with a link to each person's chart. A birth date is enough for the Sun; the Moon needs the birth time and time zone. Use it when someone asks which famous people share their sign or chart.",
  get_famous_chart: "Looks up the birth chart of a famous person Zodiacs publishes: Sun and Moon signs and the planets' signs for their birth date, a short introduction and a link to their page. Use it when someone asks about a well-known person's chart or sign. If Zodiacs has no chart for that person, it says so; never make one up.",
  get_birthday: "Describes the sky on a birthday: the Sun's sign for that date, its traditional meaning, the decan, and whether the date falls on a cusp where the sign depends on the year or time. A month and day (05-03) is enough for general birthday facts. Use a full birth date only to resolve a cusp date's sign in that birth year or calculate a solar return, the moment the Sun comes back to its birth position, with a time and time zone if known. Longitude is only for historical local mean time; do not request coordinates for modern birthdays. It links to the date's birthday page and names the famous people Zodiacs publishes who were born on that day, as the page does. It makes no prediction. If they want to share it, give them the returned shareUrl exactly; it carries the month and day, never the year.",
  get_sky_calendar: "Gives the link to subscribe to Zodiacs' sky calendar in Google Calendar, Apple Calendar or Outlook: new and full Moons, eclipses and retrograde periods, updated automatically, with how to add it and the next few events. Use it when someone wants these in their own calendar. Available in English, Spanish, Portuguese, French, Italian and Russian. If they want to share the calendar, give them the returned shareUrl exactly; it shows the next event.",
};
