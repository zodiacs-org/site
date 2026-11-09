import { moonPhase } from '@zodiacs/engine';
import { moonPhaseNameFromAngle } from '../lib/engine/lite';
import { createLocalTimeModule } from '../../api/_compute/local-time.mjs';
import { ComputeApiError } from '../lib/compute-api/errors';
import { BUDGETS, EPOCH, EVENT_KINDS } from '../lib/compute-api/constants';
import { computeEvents, computePositions, computeSkyFact } from '../lib/compute-api/endpoints';
import { BACKEND, engineStatements } from '../lib/compute-api/receipt';
import { parseEventsRequest, parsePositionsRequest, parseSkyFactRequest, zoneAt } from '../lib/compute-api/validate';
import type { LocalTimeModule } from '../lib/compute-api/local-time';
import { occasionCard } from '../lib/occasions/card';
import { MILESTONE_WORDS, milestoneCard } from '../lib/occasions/milestone-card';
import type { Milestone } from '../lib/occasions/milestones';
import { compatibilityMissing, computeCompatibility } from './features/compatibility';
import { findChartTwins, getFamousChart } from './features/people';
import { getBirthday, getSkyCalendar } from './features/birthday';
import { rateOccasionDate } from '../lib/occasions/date-score';
import { guardPersonalWeek, personalWeek } from './features/personal-week';
import { bestDays, type BestDays } from '../lib/occasions/best-dates';
import { occasionShareUrl } from '../lib/share-results';
import { milestoneShareUrl } from './share-links';
import { NATAL_MAX_YEAR, NATAL_MIN_YEAR, getNatalChart, natalChartInputWithHouses } from './features/natal-chart';
import { getHoroscopePeriod, type HoroscopeMonths } from './features/horoscope-period';
import { getChineseZodiac } from './features/chinese-zodiac';
import { getPersonalTransits } from './features/personal-transits';
import { explainAstrology } from './features/explain';
import { searchSkyEvents } from './features/sky-events';
import { getGoodDays } from './features/good-days';
import { NO_MEDICAL_TIMING, isMedicalGoal } from '../lib/good-days/goals';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';
import type { z } from 'zod';
import { AI_RESULT_SCHEMA, AI_TOOL_NAMES, AI_VERSION, ALL_AI_TOOL_NAMES, COVERAGE_TOOL_NAMES, INPUT_SCHEMAS, MAX_EVENT_DAYS, OCCASION_NOTE, OCCASION_TOOL_NAMES, ORIGIN, OUTPUT_SCHEMAS, PLACE_TOOL_NAMES, SKY_EVENTS_OUTPUT_SCHEMAS, SKY_EVENTS_TOOL_NAMES, GOOD_DAYS_TOOL_NAMES, UNDER_13_REFUSAL, inputSchemaFor, type AiToolName, type CoverageToolName, type GoodDaysToolName, type PlaceToolName, type SkyEventsToolName } from './contracts';
import { isUnder13 } from './features/reading-guards';
import { readingConfidence, readingConfidenceLabel, readingDetail } from './reading-confidence';
import { roundCoordinate, stripConsumerDashes } from './plain-text';
import { findBirthplace, type PlaceTable } from './features/birthplace';
import { HOROSCOPE_SIGNS, dateInZone, horoscopePanel, resolveHoroscope, type HoroscopePanelData, type ZoneSource } from './horoscope/reading';
import type { HoroscopeWindow } from './horoscope/window';

export interface AiDependencies {
  /** Authenticated preview only; changes the declared privacy/limitations. */
  skyWatch?: boolean;
  localTime?: LocalTimeModule;
  now?: () => Date;
  /** The hosted boundary supplies both Firewall and atomic event admission. */
  allowEvents?: () => Promise<'allowed' | 'limited' | 'unavailable'>;
  /** The daily horoscope window; get_horoscope is offered only where it is supplied. */
  horoscopeWindow?: () => Promise<HoroscopeWindow>;
  /** The occasion tools (ZODIACS_OCCASIONS_ENABLED=1); off until their release. */
  occasions?: boolean;
  /** The 0.6.0 tools (ZODIACS_COVERAGE_ENABLED=1), offered only with the occasion tools. */
  coverage?: boolean;
  /**
   * search_sky_events, the natal chart's house system and nodes, and explain_astrology's event and house topics
   * (ZODIACS_SKY_EVENTS_ENABLED=1), in effect only with the coverage and occasion tools (skyEventsOn).
   */
  skyEvents?: boolean;
  /** find_good_days (ZODIACS_GOOD_DAYS_ENABLED=1), in effect only with the coverage and occasion tools (goodDaysOn). */
  goodDays?: boolean;
  /** The published monthly horoscopes (src/data/horoscope-months.json); get_horoscope_period needs it with the program and the window. */
  horoscopeMonths?: () => Promise<HoroscopeMonths>;
  /** The committed horoscope program (src/data/horoscope-program.json), for the yearly readings. */
  horoscopeProgram?: () => Promise<HoroscopeProgram>;
  /** save_to_zodiacs is offered (ZODIACS_ACCOUNTS_ENABLED=1 with the occasion tools); changes the declared privacy/limitations. */
  accounts?: boolean;
  /**
   * The GeoNames place index for find_birthplace. The host loads it beside the
   * function so the shared runtime does not carry the place names as copy.
   */
  placeTable?: () => Promise<PlaceTable>;
}

/** Per-call facts from the host and results meant only for the panel. */
export interface AiCallContext {
  /** The time zone the assistant shares with the call, if any; validated before use. */
  hostZone?: string;
  /** Which assistant the call came through, added to zodiacs.org links as ?ref= so the site can count those visits. */
  ref?: 'chatgpt' | 'assistant';
  /** Set by get_horoscope: the selected sign's readings for the panel, never shown to the model. */
  horoscopePanel?: HoroscopePanelData;
}

const PRIVACY_POLICY = 'https://zodiacs.org/privacy/';
/** With saving switched on (ZODIACS_ACCOUNTS_ENABLED=1), the one place a birth detail is kept: the person's own saved page. */
export const SAVED_PAGE_EXCEPTION = 'The only exception is a page a signed-in person chooses to save to their own account.';
const privacyWithBirthTools = (accounts: boolean) => `Public-sky tools and Sun-sign horoscopes need no birth details. The compatibility, occasion, chart-twin, birthday and milestone tools, and a personal weekly forecast in get_horoscope, take the dates you give for that answer only and save none of them. Zodiacs never stores or logs birth details. Links never carry a birth year, a birth time, a birthplace or the names you give; a birthday link carries only the month and day.${accounts ? ` ${SAVED_PAGE_EXCEPTION}` : ''} Ask before using someone else's birth details. The assistant provider can receive tool arguments and results. Hosted calculations run on Zodiacs infrastructure. Chart Studio calculates in the browser; only explicitly reviewed selections are sent to the assistant. Hosting-layer request metadata has a separate retention policy, set out in the privacy policy: ${PRIVACY_POLICY}. Links to zodiacs.org end in ?ref=chatgpt or ?ref=assistant so the site can count those visits; the page removes it as it opens.`;
const PRIVACY = `Public-sky tools and horoscopes need no birth details and save no request or result. The assistant provider can receive tool arguments and results. Hosted calculations run on Zodiacs infrastructure; the local developer server runs on its own machine. Chart Studio calculates in the browser; only explicitly reviewed selections are sent to the assistant, and downloaded records contain personal chart data. Hosting-layer request metadata has a separate retention policy, set out in the privacy policy: ${PRIVACY_POLICY}. Links to zodiacs.org end in ?ref=chatgpt or ?ref=assistant so the site can count those visits; the page removes it as it opens.`;
const methodLink = { title: 'How we calculate', url: `${ORIGIN}/methodology/` };
const moonLink = { title: 'Explore Moon phases', url: `${ORIGIN}/moon-phase/` };
/** The page get_sky_calendar points to, where the sky calendar is added to a calendar app. */
const calendarLink = { title: 'New and full Moons, eclipses and retrogrades in your calendar app (get_sky_calendar)', url: `${ORIGIN}/sky-calendar/` };
/** The daily horoscope email's sign-up on the sign's horoscope page (or the horoscopes page, to choose a sign). */
export function dailyEmailLink(origin: string, sign?: string): { title: string; url: string } {
  return sign
    ? { title: `The ${sign.charAt(0).toUpperCase()}${sign.slice(1)} horoscope by email each morning`, url: `${origin}/horoscopes/${sign}/#daily-email` }
    : { title: 'Your horoscope by email each morning', url: `${origin}/horoscopes/#daily-email` };
}
const LIMITS = { from: EPOCH.from, to: EPOCH.to, eventWindowDays: MAX_EVENT_DAYS, eventKinds: [...EVENT_KINDS], samples: BUDGETS['events.samples'], factSamples: BUDGETS['sky-fact.samples'] };

export function displayTime(utc: string, zone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' }).format(new Date(utc));
}

function failure(tool: AiToolName, code: string, message: string, retryAfterSeconds?: number) {
  return stripConsumerDashes({ schema: AI_RESULT_SCHEMA, ok: false as const, tool, error: { code, message, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) } });
}

/** The compute API's sentence for a missing field (src/lib/compute-api/validate.ts), which names no field itself. */
const COMPUTE_REQUIRED = 'This field is required.';

/** A JSON Pointer as an assistant reads a field name: /sign is sign, /local/date is local.date, /bodies/2 is bodies[2]. */
function fieldName(pointer: string): string {
  return pointer.slice(1).split('/').map((part) => (/^\d+$/.test(part) ? `[${part}]` : part)).join('.').replace(/\.\[/g, '[');
}

/**
 * A compute API refusal with the field it refused named in the sentence, so an
 * assistant can correct the call: "sign is required." rather than "This field
 * is required.". The sentence is still fixed text plus the schema's own field
 * name, never a value from the request; one without a field stays as it is.
 */
export function namedRefusal(message: string, pointer: string | undefined): string {
  if (!pointer) return message;
  const field = fieldName(pointer);
  if (message === COMPUTE_REQUIRED) return `${field} is required.`;
  if (/^(?:Must|Each must) /.test(message)) return `${field} ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
  return `${field}: ${message}`;
}

/** Whether the sky events switch is in effect: it joins the occasion and coverage switches, and alone changes nothing. */
export function skyEventsOn(dependencies: AiDependencies): boolean {
  return !!(dependencies.occasions && dependencies.coverage && dependencies.skyEvents);
}

/** Whether the good days switch is in effect: it joins the occasion and coverage switches, and alone changes nothing. */
export function goodDaysOn(dependencies: AiDependencies): boolean {
  return !!(dependencies.occasions && dependencies.coverage && dependencies.goodDays);
}

/** The tools this server actually offers with these dependencies. */
export function offeredTools(dependencies: AiDependencies): AiToolName[] {
  const released: AiToolName[] = AI_TOOL_NAMES.filter((tool) => tool !== 'get_horoscope' || !!dependencies.horoscopeWindow);
  if (!dependencies.occasions) return released;
  if (!dependencies.coverage) return [...released, ...OCCASION_TOOL_NAMES];
  // The period horoscope reads the published months and the program alongside the daily window.
  const coverage = COVERAGE_TOOL_NAMES.filter((tool) => tool !== 'get_horoscope_period' || (!!dependencies.horoscopeWindow && !!dependencies.horoscopeMonths && !!dependencies.horoscopeProgram));
  // search_sky_events comes last, so the nineteen entries before it keep their places.
  // find_good_days comes after them all, so every entry before it keeps its place.
  return [...released, ...OCCASION_TOOL_NAMES, ...coverage, ...PLACE_TOOL_NAMES, ...(skyEventsOn(dependencies) ? SKY_EVENTS_TOOL_NAMES : []), ...(goodDaysOn(dependencies) ? GOOD_DAYS_TOOL_NAMES : [])];
}

const isCoverageTool = (tool: string): tool is CoverageToolName => (COVERAGE_TOOL_NAMES as readonly string[]).includes(tool);
const isPlaceTool = (tool: string): tool is PlaceToolName => (PLACE_TOOL_NAMES as readonly string[]).includes(tool);
export const isSkyEventsTool = (tool: string): tool is SkyEventsToolName => (SKY_EVENTS_TOOL_NAMES as readonly string[]).includes(tool);
export const isGoodDaysTool = (tool: string): tool is GoodDaysToolName => (GOOD_DAYS_TOOL_NAMES as readonly string[]).includes(tool);
/** What search_sky_events does, for get_capabilities. */
const SKY_EVENTS_TOOL_SUMMARY: Record<SkyEventsToolName, string> = {
  search_sky_events: 'eclipses, stations, sign changes, new and full Moons and void-of-course Moon periods, months or years ahead',
};
/** What each 0.6.0 tool does, for get_capabilities. */
const COVERAGE_TOOL_SUMMARY: Record<CoverageToolName, string> = {
  get_natal_chart: 'a birth chart readout',
  get_horoscope_period: 'monthly, yearly and weekly horoscopes from the published readings',
  get_chinese_zodiac: 'the Chinese zodiac',
  get_personal_transits: 'dated personal transits for up to 366 days or the year ahead',
  explain_astrology: 'explainers of astrology basics',
};

/** What a field must look like, for refusals that say how to fix it. */
const FIELD_FORMAT: Record<string, string> = {
  birthDate: 'a date such as 1990-05-03', birthTime: 'a time such as 08:30', birthZone: 'a time zone name such as America/New_York', date: 'a date such as 2026-12-01', from: 'a date such as 2026-11-01', to: 'a date such as 2026-12-01',
  time: 'a time such as 08:30', zone: 'a time zone name such as Europe/London', currentZone: 'a time zone name such as Asia/Bangkok', place: 'plain text',
};

/** The birth years a tool takes, named when a date in the right form falls outside them (1799-05-03). */
const BIRTH_YEARS: Partial<Record<CoverageToolName | PlaceToolName | SkyEventsToolName | GoodDaysToolName, string>> = {
  get_natal_chart: `${NATAL_MIN_YEAR} to ${NATAL_MAX_YEAR}`,
  get_personal_transits: `${NATAL_MIN_YEAR} to ${NATAL_MAX_YEAR}`,
};

/**
 * A 0.6.0 tool's refusal of arguments its schema does not accept, naming each field: "birthDate is required.",
 * "period must be one of: month, year, week.". The sentences are fixed text and the schema's own field names and
 * values; nothing from the request is repeated, so an unknown property's name never comes back. `schema` is the
 * tool's input schema in effect, its sky events form while that switch is on; an array item is named as kinds[0].
 */
export function coverageInputRefusal(tool: CoverageToolName | PlaceToolName | SkyEventsToolName | GoodDaysToolName, input: unknown, schema: z.ZodType = INPUT_SCHEMAS[tool]) {
  const parsed = schema.safeParse(input ?? {});
  if (parsed.success) return null;
  const record = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  // A goal asking for medical timing gets its own sentence, so it is not carried over to another goal.
  if (tool === 'find_good_days' && isMedicalGoal(record.goal)) return failure(tool, 'invalid-request', NO_MEDICAL_TIMING);
  const sentences = parsed.error.issues.map((issue: z.core.$ZodIssue) => {
    const field = issue.path.map((part) => (typeof part === 'number' ? `[${part}]` : String(part))).join('.').replace(/\.\[/gu, '[');
    if (issue.code === 'unrecognized_keys') return 'Leave out fields this tool does not take.';
    if (issue.code === 'custom' || !field) return issue.message;
    if (issue.path.length === 1 && record[field] === undefined) return `${field} is required.`;
    if (issue.code === 'invalid_value' && 'values' in issue) return `${field} must be one of: ${(issue.values as unknown[]).join(', ')}.`;
    if (issue.code === 'too_small' && 'minimum' in issue && issue.origin === 'number') return `${field} must be at least ${String(issue.minimum)}.`;
    if (issue.code === 'too_big' && 'maximum' in issue && issue.origin === 'number') return `${field} must be at most ${String(issue.maximum)}.`;
    if (issue.code === 'invalid_type' && issue.expected === 'number') return `${field} must be a number.`;
    if (issue.code === 'invalid_type' && issue.expected === 'int') return `${field} must be a whole number.`;
    if (field === 'birthDate' && BIRTH_YEARS[tool] && typeof record.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(record.birthDate)) return `birthDate must be a date from ${BIRTH_YEARS[tool]}, such as 1990-05-03.`;
    return `${field} must be ${FIELD_FORMAT[field] ?? 'in the documented form'}.`;
  });
  return failure(tool, 'invalid-request', [...new Set(sentences)].slice(0, 3).join(' '));
}

/** A computed instant as UTC and as the place's clock reads it. */
function clockTime(utc: string, zone: string | null) {
  // Built from parts: runtimes disagree on the punctuation of the joined string.
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone ?? 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(utc)).map((part) => [part.type, part.value]));
  const local = `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
  return { utc, local: zone ? local : `${local} UTC` };
}
const optionalClock = (utc: string | null, zone: string | null) => (utc ? clockTime(utc, zone) : null);

/** A birthday, a baby's arrival, or a coming of age: the date can be a birth date, so it stays out of every link. */
export const BIRTH_OCCASIONS: ReadonlySet<string> = new Set(['birthday', 'baby', 'coming-of-age']);

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const fieldOf = (value: unknown, key: string): unknown => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>)[key] : undefined);

/** The furthest any clock runs ahead of UTC (UTC+14), so no place has reached a later date. */
const LATEST_CLOCK_MS = 14 * 3_600_000;

/**
 * Today's date where a card's day is kept: in the time zone the call gives, else the one the assistant shares
 * (ChatGPT's user location), else the latest date anywhere. An unknown zone falls through to the next.
 */
function cardToday(now: Date, zones: readonly unknown[]): string {
  for (const zone of zones) if (typeof zone === 'string') { try { return dateInZone(now, zone); } catch { /* try the next */ } }
  return new Date(now.getTime() + LATEST_CLOCK_MS).toISOString().slice(0, 10);
}

/**
 * The birth dates a call carries: its birthDate, both people's in a comparison, and the days a birthday card can be
 * for once they have come, since a birthday on such a day can be a birth date: the card's date, and the latest day of
 * a best-day window that has begun, because the card then goes to a day in it. Whether a day has come is read on the
 * card's own clock, else the assistant's when the card names no place, else the clock furthest ahead, so a birthday
 * still to come is a day being planned.
 * A Chinese zodiac year alone, a birthday's month and day, and the dates of every other tool are not birth dates.
 * Read only to decide on the refusal below, never echoed, stored or logged.
 */
export function birthDatesIn(tool: AiToolName, args: unknown, now: Date, hostZone?: string): string[] {
  let dates: unknown[];
  if (tool === 'get_compatibility') dates = [fieldOf(fieldOf(args, 'a'), 'birthDate'), fieldOf(fieldOf(args, 'b'), 'birthDate')];
  else if (tool !== 'get_occasion_sky') dates = [fieldOf(args, 'birthDate')];
  else if (fieldOf(args, 'occasion') !== 'birthday') dates = [];
  else {
    // A place named without a zone may lie far from the person, so their shared zone is not the card's clock then.
    const today = cardToday(now, [fieldOf(args, 'zone'), fieldOf(args, 'place') === undefined ? hostZone : undefined]);
    const [date, from, to] = [fieldOf(args, 'date'), fieldOf(args, 'searchFrom'), fieldOf(args, 'searchTo')];
    const windowDay = typeof from === 'string' && typeof to === 'string' && from <= today ? (to < today ? to : today) : undefined;
    dates = [date, windowDay].filter((day) => typeof day === 'string' && day <= today);
  }
  return dates.filter((date): date is string => typeof date === 'string' && CIVIL_DATE.test(date));
}

/**
 * The hosted tools' refusal of a child's birth date, before anything is worked out: Zodiacs is not directed at
 * children under 13, so a call that carries a birth date less than 13 years before today, or one still to come, gets
 * the fixed refusal and no card, chart or reading. Null for every other call.
 */
export function childBirthDateRefusal(tool: AiToolName, args: unknown, now: Date, hostZone?: string) {
  const today = now.toISOString().slice(0, 10);
  return birthDatesIn(tool, args, now, hostZone).some((date) => isUnder13(date, today)) ? failure(tool, 'invalid-request', UNDER_13_REFUSAL) : null;
}

/**
 * The card page with its details after the #, as the site's own Copy link makes it. The page reads a
 * zone only with the place's coordinates, so a zone without them gets no link rather than one that
 * opens on a different card. A birthday, a baby's arrival, or a coming of age gets no card link: the
 * answer's links then give the occasions page, as the published description says to use when cardUrl is null.
 */
function occasionCardUrl(args: { occasion: string; date: string; time?: string; zone?: string; latitude?: number; longitude?: number; place?: string; names?: string }): string | null {
  if (BIRTH_OCCASIONS.has(args.occasion)) return null;
  if (args.zone && (args.latitude === undefined || args.longitude === undefined)) return null;
  const params = new URLSearchParams({ o: args.occasion, d: args.date });
  if (args.time) params.set('t', args.time);
  if (args.zone && args.latitude !== undefined && args.longitude !== undefined) {
    params.set('tz', args.zone);
    params.set('lat', roundCoordinate(args.latitude).toFixed(2));
    params.set('lon', roundCoordinate(args.longitude).toFixed(2));
  }
  return `${ORIGIN}/occasions/#${params.toString()}`;
}

function milestoneRow(milestone: Milestone) {
  return { kind: milestone.kind, name: MILESTONE_WORDS[milestone.kind].name, index: milestone.index, age: milestone.age, first: milestone.first, last: milestone.last, passes: milestone.passes };
}
const occasionsLink = { title: 'Occasion cards on Zodiacs', url: `${ORIGIN}/occasions/` };

/** A zodiacs.org page address with ?ref= added before any #, which the page reads and then removes. */
export function refUrl(url: string, ref: 'chatgpt' | 'assistant'): string {
  if (!url.startsWith(`${ORIGIN}/`)) return url;
  const hash = url.indexOf('#');
  const [base, fragment] = hash === -1 ? [url, ''] : [url.slice(0, hash), url.slice(hash)];
  return `${base}${base.includes('?') ? '&' : '?'}ref=${ref}${fragment}`;
}
/** Every page address in a result (fields named url or ending in Url, except feeds) with its ?ref= added. */
function withRef(value: unknown, ref: 'chatgpt' | 'assistant', key = ''): unknown {
  // A calendar feed is fetched by calendar apps, not visited, so its address stays as published.
  if (typeof value === 'string') return /(^url|Url)$/u.test(key) && key !== 'feedUrl' ? refUrl(value, ref) : value;
  if (Array.isArray(value)) return value.map((item) => withRef(item, ref));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, withRef(item, ref, name)]));
  return value;
}

/** A feature's answer, or the plain message of the RangeError it refused the details with. */
async function feature<T>(run: () => Promise<T>): Promise<T | { failure: string }> {
  try { return await run(); } catch (error) {
    if (error instanceof RangeError) return { failure: error.message };
    throw error;
  }
}

/**
 * get_horoscope_period takes a sign as written ("Leo", "LEO", " leo "): it is lower-cased before validation, so the
 * published schema keeps its lower-case enum and any other value is refused as before.
 */
export function normaliseCoverageInput(tool: AiToolName, input: unknown): unknown {
  if (tool !== 'get_horoscope_period' || !input || typeof input !== 'object' || Array.isArray(input)) return input;
  const sign = (input as Record<string, unknown>).sign;
  if (typeof sign !== 'string') return input;
  const lower = sign.trim().toLowerCase();
  return (HOROSCOPE_SIGNS as readonly string[]).includes(lower) ? { ...input, sign: lower } : input;
}

/**
 * The same, for a JSON-RPC tools/call message before the MCP SDK checks it against the published schema: a 0.6.0
 * tool's arguments are replaced in place with their normalised form. True when they changed; any other message,
 * including a call to one of the thirteen, is left as it is.
 */
export function normaliseCoverageCall(message: unknown): boolean {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
  const { method, params } = message as Record<string, unknown>;
  if (method !== 'tools/call' || !params || typeof params !== 'object' || Array.isArray(params)) return false;
  const call = params as Record<string, unknown>;
  if (typeof call.name !== 'string' || !(COVERAGE_TOOL_NAMES as readonly string[]).includes(call.name)) return false;
  const input = normaliseCoverageInput(call.name as CoverageToolName, call.arguments);
  if (input === call.arguments) return false;
  call.arguments = input;
  return true;
}

/** One typed operation per call. No network, persistence or logs; the horoscope window is read through its injected loader. */
export async function executeAiTool(tool: AiToolName, input: unknown, dependencies: AiDependencies, context: AiCallContext = {}) {
  input = normaliseCoverageInput(tool, input);
  // With the sky events switch on, the natal chart and the explainer take their wider forms (contracts.ts).
  const skyEvents = skyEventsOn(dependencies);
  let ownedLocalTime: ReturnType<typeof createLocalTimeModule> | undefined;
  const localTime = () => dependencies.localTime ?? (ownedLocalTime ??= createLocalTimeModule());
  const resolveZone = (name: string) => localTime().canonicalZoneName(name);
  try {
    if ((OCCASION_TOOL_NAMES as readonly string[]).includes(tool) && !dependencies.occasions) return failure(tool, 'unavailable', 'This tool is not offered here.');
    if (((COVERAGE_TOOL_NAMES as readonly string[]).includes(tool) || isPlaceTool(tool) || isSkyEventsTool(tool) || isGoodDaysTool(tool)) && !offeredTools(dependencies).includes(tool)) return failure(tool, 'unavailable', 'This tool is not offered here.');
    if (isCoverageTool(tool) || isPlaceTool(tool) || isSkyEventsTool(tool) || isGoodDaysTool(tool)) { const refusal = coverageInputRefusal(tool, input, inputSchemaFor(tool, skyEvents)); if (refusal) return refusal; }
    const parsed = inputSchemaFor(tool, skyEvents).safeParse(input);
    if (!parsed.success) return failure(tool, 'invalid-request', 'Zodiacs could not use those details. Check the sign, date or time zone and try again.');
    let data: unknown;
    let links: { title: string; url: string }[] = [methodLink];
    switch (tool) {
      case 'open_chart_studio': {
        data = { title: 'Chart Studio', calculation: 'browser-local', initialChart: 'birth-details', sharing: 'user-reviewed-selection-only' };
        links = [{ title: 'Birth chart page. A chat readout from details already given uses get_natal_chart.', url: `${ORIGIN}/birth-chart/` }];
        break;
      }
      case 'get_capabilities': {
        const statements = engineStatements();
        // The capabilities' tool list keeps the thirteen names its published schema allows; tools/list names the 0.6.0 tools.
        const offered = offeredTools(dependencies);
        const eclipseLine = skyEvents
          ? 'Eclipses are listed by search_sky_events, get_sky_calendar, get_horoscope_period and get_personal_transits (year-ahead). Exact aspects to a birth chart are listed by get_personal_transits. get_upcoming_events lists ingresses, stations and lunations over the next days or weeks; search_sky_events finds eclipses, stations, sign changes, new and full Moons and void-of-course Moon periods months or years ahead. No birth-time rectification, reminders or account access.'
          : dependencies.coverage
            ? 'Eclipses are listed by get_sky_calendar, get_horoscope_period and get_personal_transits (year-ahead). Exact aspects to a birth chart are listed by get_personal_transits. get_upcoming_events lists ingresses, stations and lunations. No birth-time rectification, reminders or account access.'
            : 'Eclipses are listed by get_sky_calendar. get_upcoming_events lists ingresses, stations and lunations, not eclipses or aspects. No birth-time rectification, reminders or account access.';
        // search_sky_events adds what it covers to the coverage statements, after the keys every other answer has.
        const skyEventsCoverage = skyEvents ? { skyEvents: 'search_sky_events gives eclipses from the eclipse table (2026 to 2030), sign changes of the Sun through Pluto from the ingress table, stations and new and full Moons from the engine for windows of up to two years, and void-of-course Moon periods under the rule of the void-of-course calendar (the last major aspect to the Sun or a planet through Pluto), with its times, up to 31 days at a time. Chiron\'s stations and sign changes, and Chiron in get_natal_chart, come from NASA JPL Horizons positions for 1800 to 2199; outside those years Chiron is left out.' } : {};
        data = { name: 'Zodiacs', version: AI_VERSION, engine: BACKEND, tools: offered.filter((name) => (ALL_AI_TOOL_NAMES as readonly string[]).includes(name)), limits: LIMITS, conventions: statements.conventions, coverage: { ...statements.coverage, tools: offered.join(', '), eclipses: skyEvents ? 'search_sky_events lists the eclipses from 2026 to 2030; get_sky_calendar, get_horoscope_period and get_personal_transits year-ahead include eclipses. get_upcoming_events lists ingresses, stations and lunations.' : dependencies.coverage ? 'get_sky_calendar, get_horoscope_period and get_personal_transits year-ahead include eclipses. get_upcoming_events lists ingresses, stations and lunations.' : 'get_sky_calendar includes eclipses. get_upcoming_events lists ingresses, stations and lunations.', aspects: dependencies.coverage ? 'get_personal_transits lists exact aspects to a birth chart. get_upcoming_events does not search aspects.' : 'get_upcoming_events does not search aspects.', ...skyEventsCoverage }, privacy: dependencies.occasions ? privacyWithBirthTools(!!dependencies.accounts) : PRIVACY, limitations: ['Tropical geocentric positions; supported reference span is stated in each receipt.', 'Event completeness is tested, not proven. Budget exhaustion refuses the whole search.', eclipseLine, dependencies.occasions ? 'Horoscopes are dated Sun-sign readings for the day before, the day of and the day after the current edition; with a birth date, get_horoscope also gives a personal forecast for the week from the person’s own chart.' : 'Horoscopes are dated Sun-sign readings for the day before, the day of and the day after the current edition; they are not personal birth-chart forecasts.', 'Current means the server instant; daily sky files are separate noon-UTC snapshots.'] };
        if (dependencies.occasions) {
          const capabilities = data as { privacy: string; limitations: string[] };
          capabilities.privacy += ' The occasion, compatibility, chart-twin and birthday tools take dates, and birth dates with an optional time, time zone, place and first names, for one or two people; they calculate from them for that call and save none of it. The result goes to the assistant. Share links and card links leave out names and raw birth details, and coordinates in a link are rounded to two decimals. A birthday gets no card link and no share link, because that date can be a birth date. The famous-chart and sky-calendar tools need no personal details. Zodiacs is not directed at children under 13: its tools make no card, chart or reading from a birth date less than 13 years ago, or a birthday card for a day in those years.';
          capabilities.limitations.push('The occasion tools give the sky on a date, rate it from 0 to 100 by astrology\'s traditional reading, can rate every day in a window of up to 92 days and name the three best, and give the dates of astrology\'s life milestones; they do not guarantee how a day will go.');
          capabilities.limitations.push('Compatibility scores two charts by astrology\'s reading of their contacts; it does not guarantee how a relationship will go. Compatibility readings are for two adults: when either birth date is under 18 it gives no reading, and from 13 to 17 it points to a friendship reading of the two Sun signs instead. Famous charts, alone or compared with someone\'s own, cover only the people Zodiacs publishes, cast for local noon because their birth times are not on record.');
          if (!dependencies.coverage) capabilities.limitations.push('Which tool: what changes in the sky over a window, get_upcoming_events; subscribing in a calendar app, get_sky_calendar; one birthday, get_birthday; lifetime returns, get_life_milestones.');
        }
        if (dependencies.occasions && dependencies.coverage) {
          const capabilities = data as { privacy: string; limitations: string[] };
          capabilities.privacy += ' The natal chart, personal transit and Chinese zodiac tools take a birth date, with an optional time, time zone and coordinates for the first two, for that call only and save none of it; the period horoscope and explainer tools take no personal details.';
          if (skyEvents) capabilities.privacy += ' The sky events search takes no personal details.';
          // The tools field's enum is the thirteen published names, so the 0.6.0 tools are named here, by their tools/list names.
          const added = [
            ...offeredTools(dependencies).filter(isCoverageTool).map((name) => `${name} (${COVERAGE_TOOL_SUMMARY[name]})`),
            ...offeredTools(dependencies).filter(isPlaceTool).map((name) => `${name} (a town or city name, with coordinates and a time zone for the chart tools)`),
          ];
          const listed = (data as { tools: string[] }).tools.length;
          // With the sky events switch, search_sky_events follows them in tools/list; it gives calculated dates, not readings.
          const skyTools = offeredTools(dependencies).filter(isSkyEventsTool).map((name) => `${name} (${SKY_EVENTS_TOOL_SUMMARY[name]})`);
          const skyLine = skyTools.length ? ` ${skyTools.join(', ')} ${skyTools.length > 1 ? 'are' : 'is'} also listed there: calculated dates with no reading and no confidence label.` : '';
          capabilities.limitations.push(`Version 0.6.0 adds tools listed in tools/list: ${added.slice(0, -1).join(', ')}${added.length > 1 ? ' and ' : ''}${added.at(-1)}. They give astrology's reading plainly, with a reading-confidence label on each forecast (how specific the details were, not the odds that an event happens), never a guarantee, and no health, financial or medical advice.${skyLine} With them Zodiacs offers ${listed + added.length + skyTools.length} tools: the ${listed} in the tools field and these ${added.length + skyTools.length}.`);
          capabilities.limitations.push(`Which tool: today, tomorrow or this week's general Sun-sign horoscope, get_horoscope; a month or a year, or the week's love or career readings together, get_horoscope_period; transits to a person's own chart or their year ahead, get_personal_transits; one birthday, get_birthday; lifetime returns, get_life_milestones; a chart read in the chat once a birth date is given, get_natal_chart, or open_chart_studio for the person to fill in;${offered.includes('find_birthplace') ? ' a town or city named instead of coordinates, find_birthplace;' : ''} what changes in the sky over a window, get_upcoming_events; subscribing in a calendar app, get_sky_calendar; a yes or no sky check, check_sky_fact; what a term means, whether two Sun signs are compatible, or two Sun signs as friends, explain_astrology.`);
          if (skyEvents) capabilities.limitations.push('Which tool for sky events: what changes in the sky over the next days or weeks (up to 92 days), get_upcoming_events; one kind of event months or years ahead, such as the next eclipses, a planet\'s next retrograde, when a planet changes sign, every full Moon next year or this week\'s void-of-course Moon periods, search_sky_events; eclipses, retrograde periods and Moons in a calendar app, get_sky_calendar; a yes or no check on one moment or day, check_sky_fact. In a birth chart, get_natal_chart gives the lunar nodes and Chiron, and takes houseSystem placidus for Placidus houses.');
        }
        if (goodDaysOn(dependencies)) {
          const capabilities = data as { privacy: string; limitations: string[] };
          capabilities.privacy += ' The good day finder takes a goal and dates, and, only if the person asks for their own chart to count, a birth date with an optional time and birthplace time zone, for that call only; it saves none of it and returns only the natal Sun sign.';
          capabilities.limitations.push('find_good_days (also listed in tools/list) ranks the days in a window of up to twelve months for a launch, a contract, a move, a relationship, travel, a new job or a wedding, by traditional electional astrology, and names the days to avoid. It gives no medical timing, no price calls and no legal outcomes, and it schedules nothing.');
        }
        if (dependencies.accounts && dependencies.occasions) {
          const capabilities = data as { privacy: string; limitations: string[] };
          capabilities.privacy += ' Only the save tool needs an account: when the person signs in to their own Zodiacs account and asks to keep a chart, comparison, occasion card or personal week, Zodiacs works it out again from the same details and saves that result, including the birth dates and names in it, to their account until they delete it. It saves no conversation text.';
          capabilities.limitations[2] = skyEvents
            ? 'Eclipses are listed by search_sky_events, get_sky_calendar, get_horoscope_period and get_personal_transits (year-ahead). Exact aspects are listed by get_personal_transits. No birth-time rectification or reminders. Saving to a Zodiacs account needs the person to sign in; every other tool works without one.'
            : dependencies.coverage
              ? 'Eclipses are listed by get_sky_calendar, get_horoscope_period and get_personal_transits (year-ahead). Exact aspects are listed by get_personal_transits. No birth-time rectification or reminders. Saving to a Zodiacs account needs the person to sign in; every other tool works without one.'
              : 'Eclipses are listed by get_sky_calendar. get_upcoming_events does not search aspects. No birth-time rectification or reminders. Saving to a Zodiacs account needs the person to sign in; every other tool works without one.';
        }
        if (dependencies.skyWatch) {
          const capabilities = data as { privacy: string; limitations: string[] };
          capabilities.privacy += ' Sky Watch preview saves public-sky filters, owner, expiration and encrypted callback credentials. Stopping or expiring a watch clears its credentials; subscription metadata is retained for up to 30 days afterward. Public event records and delivery status are retained for up to 30 days. No birth details are accepted.';
          capabilities.limitations[2] = 'Sky Watch delivers selected public-sky events through verified callbacks. Delivery can be delayed or repeated. Eclipses are listed by get_sky_calendar. No personal predictions or birth-time rectification.';
        }
        break;
      }
      case 'get_sky': {
        const args = INPUT_SCHEMAS.get_sky.parse(input);
        const zone = await zoneAt(args.zone ?? 'UTC', '/zone', resolveZone);
        const instant = args.instant ?? (dependencies.now?.() ?? new Date()).toISOString();
        const calculation = computePositions(parsePositionsRequest({ instants: [instant], ...(args.bodies ? { bodies: args.bodies } : {}) }));
        const utc = calculation.result.instants[0].instant;
        const phase = moonPhase(new Date(utc));
        data = { mode: args.instant ? 'requested-instant' : 'current-instant', time: { utc, zone, display: displayTime(utc, zone) }, calculation, moonPhase: { name: moonPhaseNameFromAngle(phase.angle), angle: phase.angle, illumination: phase.illumination }, interpretation: 'Astronomical calculations; no personal prediction is supplied.' };
        links = [moonLink, methodLink, calendarLink];
        break;
      }
      case 'get_upcoming_events': {
        const args = INPUT_SCHEMAS.get_upcoming_events.parse(input);
        const { zone: requestedZone, ...explicitRequest } = args;
        const now = args.from ? undefined : (dependencies.now?.() ?? new Date());
        const request = now ? { from: now.toISOString(), to: new Date(now.getTime() + 7 * 86_400_000).toISOString() } : explicitRequest;
        const zone = await zoneAt(requestedZone ?? 'UTC', '/zone', resolveZone);
        const parsedRequest = parseEventsRequest(request);
        if (parsedRequest.to.getTime() - parsedRequest.from.getTime() > MAX_EVENT_DAYS * 86_400_000) return failure(tool, 'budget-exhausted', `An event window is at most ${MAX_EVENT_DAYS} days long.`);
        if (dependencies.allowEvents) {
          const verdict = await dependencies.allowEvents();
          if (verdict !== 'allowed') return failure(tool, verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable', 'Zodiacs is busy. Try again in a minute.', verdict === 'limited' ? 60 : 300);
        }
        const calculation = computeEvents(parsedRequest);
        data = { from: calculation.result.from, to: calculation.result.to, zone, events: calculation.result.events.map(event => ({ ...event, localAt: displayTime(event.at, zone) })), calculation, completeness: calculation.receipt.search!.completeness };
        links = [{ title: 'Subscribe to these in your calendar (get_sky_calendar)', url: `${ORIGIN}/sky-calendar/` },
          // With the sky events switch, the tool for one kind of event further ahead.
          ...(skyEvents ? [{ title: 'Eclipses, stations, sign changes and Moons months or years ahead (search_sky_events)', url: `${ORIGIN}/events/` }] : []),
          { title: 'Explore the lunar calendar', url: `${ORIGIN}/full-moon-calendar/` }, { title: 'Explore retrogrades', url: `${ORIGIN}/retrogrades/` }, methodLink];
        break;
      }
      case 'check_sky_fact': {
        const parsedArgs = INPUT_SCHEMAS.check_sky_fact.parse(input);
        // An instant already fixes the moment, so a time zone sent with it ("right now, I'm in Bangkok")
        // changes nothing; drop it rather than refuse a request an assistant naturally makes.
        const { zone: _zone, ...withoutZone } = parsedArgs;
        const args = parsedArgs.instant ? withoutZone : parsedArgs;
        const request = await parseSkyFactRequest(args, resolveZone);
        // Date-based facts also run bounded searches; count them as events at the hosted boundary.
        if (args.date && dependencies.allowEvents) {
          const verdict = await dependencies.allowEvents();
          if (verdict !== 'allowed') return failure(tool, verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable', 'Zodiacs is busy. Try again in a minute.', verdict === 'limited' ? 60 : 300);
        }
        const calculation = await computeSkyFact(request, { localTime: localTime() });
        data = { answer: calculation.result.answer, calculation, interpretation: 'The verdict checks an astronomical proposition, not an astrological prediction.' };
        links = [methodLink, calendarLink];
        break;
      }
      case 'get_horoscope': {
        if (!dependencies.horoscopeWindow) return failure(tool, 'unavailable', 'Horoscopes are not offered here.');
        const args = INPUT_SCHEMAS.get_horoscope.parse(input);
        let zone = 'UTC';
        let zoneSource: ZoneSource = 'default';
        if (args.zone) {
          try { zone = await zoneAt(args.zone, '/zone', resolveZone); zoneSource = 'request'; }
          catch { return failure(tool, 'invalid-timezone', "Zodiacs doesn't recognise that time zone. Use a name such as Europe/London or Asia/Bangkok."); }
        } else if (context.hostZone) {
          // A hint the assistant shares; an unknown name falls back to UTC rather than failing.
          try { zone = await zoneAt(context.hostZone, '/zone', resolveZone); zoneSource = 'assistant'; } catch { /* keep UTC */ }
        }
        const window = await dependencies.horoscopeWindow();
        const localDate = dateInZone(dependencies.now?.() ?? new Date(), zone);
        const request = { period: args.period ?? 'day', focus: args.focus ?? 'general', ...(args.sign ? { sign: args.sign } : {}), ...(args.date ? { date: args.date } : {}) } as const;
        data = resolveHoroscope(window, request, zone, zoneSource, localDate, ORIGIN);
        const horoscope = data as { disclosure: string; reading?: { paragraphs: { text: string; heading?: string }[] }; personal?: { note: string } };
        const signLabel = readingConfidenceLabel('sign');
        horoscope.disclosure = `${horoscope.disclosure} ${signLabel}. For a month, a year, or a love or career week, use get_horoscope_period.`;
        // A personal forecast takes a birth date, so it follows the same switch as the other birth-date tools.
        if (args.birthDate && dependencies.occasions) {
          let birthZone: string | undefined;
          if (args.birthZone) {
            try { birthZone = await zoneAt(args.birthZone, '/zone', resolveZone); }
            catch { return failure(tool, 'invalid-timezone', "Zodiacs doesn't recognise that birthplace time zone. Use a name such as Europe/London."); }
          }
          try {
            // Under 18 on the person's own date, no line reads as romance.
            const personal = guardPersonalWeek(await personalWeek({ birthDate: args.birthDate, ...(args.birthTime ? { birthTime: args.birthTime } : {}), ...(birthZone ? { birthZone } : {}) }, dependencies.now?.() ?? new Date(), localTime(), zone), args.birthDate, localDate);
            const personalLabel = readingConfidenceLabel(readingDetail({ hasDate: true, hasTime: args.birthTime !== undefined, hasPlace: false }));
            personal.note = `${personal.note} ${personalLabel}. For the dates of these contacts, use get_personal_transits.`;
            (data as { personal?: unknown }).personal = personal;
          } catch (error) {
            if (error instanceof RangeError) return failure(tool, 'invalid-request', error.message);
            throw error;
          }
        }
        if (args.sign) context.horoscopePanel = horoscopePanel(window, args.sign, { period: request.period, focus: request.focus, ...(args.date ? { date: args.date } : {}), ...(zoneSource === 'default' ? {} : { zone }) }, { origin: ORIGIN, ref: context.ref ?? null });
        links = [...(args.sign ? [{ title: `${args.sign[0].toUpperCase()}${args.sign.slice(1)} on Zodiacs`, url: `${ORIGIN}/horoscopes/${args.sign}/` }] : []), methodLink, dailyEmailLink(ORIGIN, args.sign)];
        break;
      }
      case 'get_occasion_sky': {
        const args = INPUT_SCHEMAS.get_occasion_sky.parse(input);
        const zone = args.zone ? await zoneAt(args.zone, '/zone', resolveZone) : null;
        const hasPlace = args.latitude !== undefined && args.longitude !== undefined;
        let card;
        let best: BestDays | null = null;
        let date: string;
        try {
          // With a window, every day in it is rated at the same clock time and the three best come back.
          const latitude = hasPlace ? roundCoordinate(args.latitude!) : null;
          const longitude = hasPlace ? roundCoordinate(args.longitude!) : null;
          if (args.searchFrom !== undefined && args.searchTo !== undefined) {
            best = await bestDays({
              occasion: args.occasion, from: args.searchFrom, to: args.searchTo, time: args.time ?? null, timeZone: zone,
              longitude,
            }, localTime());
          }
          // The card is for the day asked about, else for the best day found.
          date = args.date ?? best!.best[0].date;
          card = await occasionCard({
            occasion: args.occasion, date, time: args.time ?? null, timeZone: zone,
            place: hasPlace ? { name: args.place ?? '', lat: latitude!, lon: longitude! } : null,
          }, localTime());
        } catch (error) {
          if (error instanceof RangeError) return failure(tool, 'invalid-request', error.message);
          throw error;
        }
        const evening = card.evening;
        const cardUrl = occasionCardUrl({ ...args, latitude: hasPlace ? roundCoordinate(args.latitude!) : undefined, longitude: hasPlace ? roundCoordinate(args.longitude!) : undefined, date, ...(zone ? { zone } : {}) });
        const detail = readingDetail({ hasDate: true, hasTime: args.time !== undefined, hasPlace });
        const label = readingConfidenceLabel(detail);
        const withLabel = <T extends { verdict: string; reasons: string[] }>(rating: T): T => ({ ...rating, verdict: `${rating.verdict}. ${label}.`, reasons: [...rating.reasons, label] });
        const rating = withLabel(rateOccasionDate(args.occasion, card.sky));
        if (best) best = { ...best, best: best.best.map((day) => withLabel(day)) };
        const signOf = (body: string) => card.sky.bodies.find((row) => row.body === body)?.sign ?? null;
        // The share link carries the day, the Sun and Moon signs and the rating. Names stay out of the link.
        // A birthday, a baby's arrival, or a coming of age gets none: that date can be a birth date.
        const shareUrl = BIRTH_OCCASIONS.has(args.occasion) ? null : occasionShareUrl(ORIGIN, { occasion: args.occasion, date, names: null, place: null, sun: signOf('Sun'), moon: signOf('Moon'), score: rating.score, confidence: readingConfidence(detail) });
        const printable = cardUrl !== null;
        data = {
          occasion: args.occasion, date, time: args.time ?? null, zone, place: args.place ?? null, names: args.names ?? null,
          card: card.words,
          instant: clockTime(card.instant, zone), instantIs: args.time ? 'given-time' : zone ? 'local-noon' : 'utc-noon',
          sky: { bodies: card.sky.bodies, moon: card.sky.moon, retrograde: card.sky.retrograde },
          moonSignChange: card.moonSignChange,
          rating,
          bestDays: best,
          evening: evening ? {
            sunrise: optionalClock(evening.sunrise, zone), sunset: optionalClock(evening.sunset, zone),
            goldenHour: evening.goldenHour ? { start: clockTime(evening.goldenHour.start, zone), end: clockTime(evening.goldenHour.end, zone) } : null,
            civilDusk: optionalClock(evening.civilDusk, zone),
            moonrise: optionalClock(evening.moon.rise, zone), moonset: optionalClock(evening.moon.set, zone),
            moonHighest: evening.moon.highest ? { at: clockTime(evening.moon.highest.at, zone), altitude: evening.moon.highest.altitude } : null,
            planetsAfterDusk: evening.planetsAfterDusk, flags: evening.flags,
          } : null,
          cardUrl,
          shareUrl,
          note: OCCASION_NOTE,
        };
        links = [
          ...(printable ? [{ title: 'Open the printable card', url: cardUrl }] : [occasionsLink]),
          { title: 'The sky at a chosen moment (get_sky)', url: `${ORIGIN}/today/` },
          { title: 'Resolve a town or city (find_birthplace)', url: `${ORIGIN}/birth-chart/` },
          ...(printable ? [occasionsLink] : []),
          methodLink,
        ];
        break;
      }
      case 'get_life_milestones': {
        const args = INPUT_SCHEMAS.get_life_milestones.parse(input);
        const zone = args.zone ? await zoneAt(args.zone, '/zone', resolveZone) : null;
        let card;
        try {
          card = await milestoneCard({
            birthDate: args.birthDate, time: args.time ?? null, timeZone: zone,
            birthplace: args.longitude !== undefined ? { lon: roundCoordinate(args.longitude) } : null,
          }, dependencies.now?.() ?? new Date(), localTime());
        } catch (error) {
          if (error instanceof RangeError) return failure(tool, 'invalid-request', error.message);
          throw error;
        }
        data = {
          birthDate: args.birthDate, timeKnown: card.timeKnown, asOf: card.asOf,
          milestones: card.milestones.map(milestoneRow), next: card.next ? milestoneRow(card.next) : null,
          numbers: card.numbers,
          // The page's link carries the birth date only, so it reproduces an untimed answer and no other.
          cardUrl: args.time === undefined && args.zone === undefined && args.longitude === undefined
            ? `${ORIGIN}/occasions/milestones/`
            : null,
          note: 'Dates of computed crossings and their traditional astrological names. Without a birth time, a pass can move by about a day.',
          // The milestone the card leads with: its kind, ordinal, age and days, never the birth date.
          shareUrl: (() => { const shown = card.next ?? card.milestones[0]; return shown ? milestoneShareUrl(ORIGIN, shown) : null; })(),
        };
        links = [{ title: 'Life milestones on Zodiacs', url: `${ORIGIN}/occasions/milestones/` }, { title: 'What a Saturn return means (explain_astrology)', url: `${ORIGIN}/saturn-return/` }, methodLink];
        break;
      }
      case 'get_compatibility': {
        const args = INPUT_SCHEMAS.get_compatibility.parse(input);
        // Each zone is spelt as tzdb spells it first, as the other tools do.
        const person = async (who: typeof args.a, path: string) => (who.zone ? { ...who, zone: await zoneAt(who.zone, path, resolveZone) } : who);
        const pair = { a: await person(args.a, '/a/zone'), b: await person(args.b, '/b/zone') };
        // A famous name the directory does not have is answered as get_famous_chart answers it: plainly, with no chart.
        const missing = compatibilityMissing(pair);
        if (missing) {
          data = missing;
          links = [{ title: 'Famous birth charts on Zodiacs', url: missing.directoryUrl }];
          break;
        }
        const result = await feature(() => computeCompatibility(pair, localTime(), ORIGIN, dependencies.now?.() ?? new Date()));
        if ('failure' in result) return failure(tool, 'invalid-request', result.failure);
        ({ data, links } = result);
        break;
      }
      case 'find_chart_twins': {
        const result = await feature(() => findChartTwins(INPUT_SCHEMAS.find_chart_twins.parse(input), localTime()));
        if ('failure' in result) return failure(tool, 'invalid-request', result.failure);
        ({ data, links } = result);
        break;
      }
      case 'get_famous_chart': {
        ({ data, links } = getFamousChart(INPUT_SCHEMAS.get_famous_chart.parse(input)));
        break;
      }
      case 'get_birthday': {
        const result = await feature(() => getBirthday(INPUT_SCHEMAS.get_birthday.parse(input), localTime(), dependencies.now?.() ?? new Date()));
        if ('failure' in result) return failure(tool, 'invalid-request', result.failure);
        ({ data, links } = result);
        break;
      }
      case 'get_sky_calendar': {
        ({ data, links } = getSkyCalendar(INPUT_SCHEMAS.get_sky_calendar.parse(input), dependencies.now?.() ?? new Date()));
        // With the sky events switch, a list of one kind of event between two dates is search_sky_events'.
        if (skyEvents) links = [...links, { title: 'A list of eclipses, stations, sign changes or Moons between two dates (search_sky_events)', url: `${ORIGIN}/events/` }];
        break;
      }
      case 'get_natal_chart': {
        const args = (skyEvents ? natalChartInputWithHouses : INPUT_SCHEMAS.get_natal_chart).parse(input);
        const zone = args.zone ? await zoneAt(args.zone, '/zone', resolveZone) : undefined;
        const today = (dependencies.now?.() ?? new Date()).toISOString().slice(0, 10);
        const result = await feature(() => getNatalChart({ ...args, ...(zone ? { zone } : {}) }, localTime(), ORIGIN, today, { skyEvents }));
        if ('failure' in result) return failure(tool, 'invalid-request', result.failure);
        ({ data, links } = result);
        break;
      }
      case 'get_horoscope_period': {
        const args = INPUT_SCHEMAS.get_horoscope_period.parse(input);
        let zone = 'UTC';
        let zoneSource: 'request' | 'assistant' | 'default' = 'default';
        if (args.zone) {
          try { zone = await zoneAt(args.zone, '/zone', resolveZone); zoneSource = 'request'; }
          catch { return failure(tool, 'invalid-timezone', "zone: Zodiacs doesn't recognise that time zone. Use a name such as Europe/London or Asia/Bangkok."); }
        } else if (context.hostZone) {
          try { zone = await zoneAt(context.hostZone, '/zone', resolveZone); zoneSource = 'assistant'; } catch { /* keep UTC and say so */ }
        }
        const result = await feature(() => getHoroscopePeriod(args, dateInZone(dependencies.now?.() ?? new Date(), zone), zone, zoneSource, localTime(), {
          window: dependencies.horoscopeWindow!, months: dependencies.horoscopeMonths!, program: dependencies.horoscopeProgram!,
          ...(dependencies.allowEvents ? { allowEvents: dependencies.allowEvents } : {}),
        }, ORIGIN, { skyEvents }));
        if ('failure' in result) return failure(tool, 'invalid-request', result.failure);
        if ('refused' in result) return failure(tool, result.refused, 'Zodiacs is busy. Try again in a minute.', result.refused === 'rate-limited' ? 60 : 300);
        ({ data, links } = result);
        break;
      }
      case 'get_chinese_zodiac': {
        const args = INPUT_SCHEMAS.get_chinese_zodiac.parse(input);
        let zone = 'UTC';
        let zoneAssumed = true;
        if (args.zone) { zone = await zoneAt(args.zone, '/zone', resolveZone); zoneAssumed = false; }
        else if (context.hostZone) { try { zone = await zoneAt(context.hostZone, '/zone', resolveZone); zoneAssumed = false; } catch { /* keep UTC and say so */ } }
        const result = await feature(async () => getChineseZodiac(args, dateInZone(dependencies.now?.() ?? new Date(), zone), zone, ORIGIN, zoneAssumed, { skyEvents }));
        if ('failure' in result) return failure(tool, 'invalid-request', result.failure);
        ({ data, links } = result);
        break;
      }
      case 'get_personal_transits': {
        const args = INPUT_SCHEMAS.get_personal_transits.parse(input);
        const zone = args.zone ? await zoneAt(args.zone, '/zone', resolveZone) : undefined;
        let currentZone = args.currentZone ? await zoneAt(args.currentZone, '/currentZone', resolveZone) : undefined;
        // A zone the assistant shares is where the person is now, so it sets the clock even when a birthplace zone was given.
        if (!currentZone && context.hostZone) { try { currentZone = await zoneAt(context.hostZone, '/currentZone', resolveZone); } catch { /* the answer says which clock it used */ } }
        // A scan of the sky over a window is an event search; count it as one at the hosted boundary.
        if (dependencies.allowEvents) {
          const verdict = await dependencies.allowEvents();
          if (verdict !== 'allowed') return failure(tool, verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable', 'Zodiacs is busy. Try again in a minute.', verdict === 'limited' ? 60 : 300);
        }
        const result = await feature(() => getPersonalTransits({ ...args, ...(zone ? { zone } : {}), ...(currentZone ? { currentZone } : {}) }, dependencies.now?.() ?? new Date(), localTime(), ORIGIN));
        if ('failure' in result) return failure(tool, 'invalid-request', result.failure);
        ({ data, links } = result);
        break;
      }
      case 'explain_astrology': {
        ({ data, links } = explainAstrology(INPUT_SCHEMAS.explain_astrology.parse(input), ORIGIN, { skyEvents }));
        break;
      }
      case 'search_sky_events': {
        const args = INPUT_SCHEMAS.search_sky_events.parse(input);
        let zone = 'UTC';
        let zoneSource: 'request' | 'assistant' | 'default' = 'default';
        if (args.zone) {
          try { zone = await zoneAt(args.zone, '/zone', resolveZone); zoneSource = 'request'; }
          catch { return failure(tool, 'invalid-timezone', "zone: Zodiacs doesn't recognise that time zone. Use a name such as Europe/London or Asia/Bangkok."); }
        } else if (context.hostZone) {
          try { zone = await zoneAt(context.hostZone, '/zone', resolveZone); zoneSource = 'assistant'; } catch { /* keep UTC and say so */ }
        }
        const result = await feature(() => searchSkyEvents(args, localTime(), {
          zone, zoneSource, today: dateInZone(dependencies.now?.() ?? new Date(), zone), origin: ORIGIN,
          ...(dependencies.allowEvents ? { allowEvents: dependencies.allowEvents } : {}),
        }));
        if ('failure' in result) return failure(tool, 'invalid-request', result.failure);
        if ('refused' in result) return failure(tool, result.refused, 'Zodiacs is busy. Try again in a minute.', result.refused === 'rate-limited' ? 60 : 300);
        ({ data, links } = result);
        break;
      }
      case 'find_good_days': {
        const args = INPUT_SCHEMAS.find_good_days.parse(input);
        let zone = 'UTC';
        let zoneSource: 'request' | 'assistant' | 'default' = 'default';
        if (args.zone) {
          try { zone = await zoneAt(args.zone, '/zone', resolveZone); zoneSource = 'request'; }
          catch { return failure(tool, 'invalid-timezone', "zone: Zodiacs doesn't recognise that time zone. Use a name such as Europe/London or Asia/Bangkok."); }
        } else if (context.hostZone) {
          try { zone = await zoneAt(context.hostZone, '/zone', resolveZone); zoneSource = 'assistant'; } catch { /* keep UTC and say so */ }
        }
        let birthZone: string | undefined;
        if (args.birthZone) {
          try { birthZone = await zoneAt(args.birthZone, '/birthZone', resolveZone); }
          catch { return failure(tool, 'invalid-timezone', "birthZone: Zodiacs doesn't recognise that birthplace time zone. Use a name such as America/New_York."); }
        }
        const result = await feature(() => getGoodDays({ ...args, ...(birthZone ? { birthZone } : {}) }, localTime(), {
          zone, zoneSource, today: dateInZone(dependencies.now?.() ?? new Date(), zone), origin: ORIGIN,
          ...(dependencies.allowEvents ? { allowEvents: dependencies.allowEvents } : {}),
        }));
        if ('failure' in result) return failure(tool, 'invalid-request', result.failure);
        if ('refused' in result) return failure(tool, result.refused, 'Zodiacs is busy. Try again in a minute.', result.refused === 'rate-limited' ? 60 : 300);
        ({ data, links } = result);
        break;
      }
      case 'find_birthplace': {
        if (!dependencies.placeTable) return failure(tool, 'unavailable', 'Place lookup is not offered here.');
        const table = await dependencies.placeTable();
        const result = await feature(() => findBirthplace(INPUT_SCHEMAS.find_birthplace.parse(input), dependencies.now?.() ?? new Date(), localTime(), table));
        if ('failure' in result) return failure(tool, 'invalid-request', result.failure);
        ({ data, links } = result);
        break;
      }
    }
    if (context.ref) {
      data = withRef(data, context.ref);
      links = links.map((link) => ({ ...link, url: refUrl(link.url, context.ref!) }));
    }
    const result = { schema: AI_RESULT_SCHEMA, ok: true as const, tool, data, links };
    // Validate our own output so callers never receive a success outside its contract, then clear dashes from the text.
    // With the sky events switch a tool's wider result is checked against its wider schema (contracts.ts).
    const schema = OUTPUT_SCHEMAS[tool];
    const wider = skyEvents ? SKY_EVENTS_OUTPUT_SCHEMAS[tool] : undefined;
    return stripConsumerDashes((wider ? wider.parse(result) : schema.parse(result)) as ReturnType<typeof schema.parse>);
  } catch (error) {
    if (error instanceof ComputeApiError) return failure(tool, error.detail.code, namedRefusal(error.detail.message, error.detail.pointer), error.detail.retryAfterSeconds);
    return failure(tool, 'calculation-failed', 'Zodiacs could not complete this. Nothing partial is returned; try again.');
  } finally { ownedLocalTime?.dispose(); }
}
