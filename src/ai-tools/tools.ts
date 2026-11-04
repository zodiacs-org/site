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
import { personalWeek } from './features/personal-week';
import { bestDays, type BestDays } from '../lib/occasions/best-dates';
import { occasionShareUrl } from '../lib/share-results';
import { milestoneShareUrl } from './share-links';
import { NATAL_MAX_YEAR, NATAL_MIN_YEAR, getNatalChart } from './features/natal-chart';
import { getHoroscopePeriod, type HoroscopeMonths } from './features/horoscope-period';
import { getChineseZodiac } from './features/chinese-zodiac';
import { getPersonalTransits } from './features/personal-transits';
import { explainAstrology } from './features/explain';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';
import type { z } from 'zod';
import { AI_RESULT_SCHEMA, AI_TOOL_NAMES, AI_VERSION, ALL_AI_TOOL_NAMES, COVERAGE_TOOL_NAMES, INPUT_SCHEMAS, MAX_EVENT_DAYS, OCCASION_NOTE, OCCASION_TOOL_NAMES, ORIGIN, OUTPUT_SCHEMAS, PLACE_TOOL_NAMES, type AiToolName, type CoverageToolName, type PlaceToolName } from './contracts';
import { readingConfidenceLabel, readingDetail } from './reading-confidence';
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
const PRIVACY_WITH_BIRTH_TOOLS = `Public-sky tools and Sun-sign horoscopes need no birth details. The compatibility, occasion, chart-twin, birthday and milestone tools, and a personal weekly forecast in get_horoscope, take the dates you give for that answer only and save none of them. Zodiacs never stores or logs birth details. Links never carry a birth year, time, place or names; a birthday link carries only the month and day. Ask before using someone else's birth details. The assistant provider can receive tool arguments and results. Hosted calculations run on Zodiacs infrastructure. Chart Studio calculates in the browser; only explicitly reviewed selections are sent to the assistant. Hosting-layer request metadata has a separate retention policy, set out in the privacy policy: ${PRIVACY_POLICY}. Links to zodiacs.org end in ?ref=chatgpt or ?ref=assistant so the site can count those visits; the page removes it as it opens.`;
const PRIVACY = `Public-sky tools and horoscopes need no birth details and save no request or result. The assistant provider can receive tool arguments and results. Hosted calculations run on Zodiacs infrastructure; the local developer server runs on its own machine. Chart Studio calculates in the browser; only explicitly reviewed selections are sent to the assistant, and downloaded records contain personal chart data. Hosting-layer request metadata has a separate retention policy, set out in the privacy policy: ${PRIVACY_POLICY}. Links to zodiacs.org end in ?ref=chatgpt or ?ref=assistant so the site can count those visits; the page removes it as it opens.`;
const methodLink = { title: 'How we calculate', url: `${ORIGIN}/methodology/` };
const moonLink = { title: 'Explore Moon phases', url: `${ORIGIN}/moon-phase/` };
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

/** The tools this server actually offers with these dependencies. */
export function offeredTools(dependencies: AiDependencies): AiToolName[] {
  const released: AiToolName[] = AI_TOOL_NAMES.filter((tool) => tool !== 'get_horoscope' || !!dependencies.horoscopeWindow);
  if (!dependencies.occasions) return released;
  if (!dependencies.coverage) return [...released, ...OCCASION_TOOL_NAMES];
  // The period horoscope reads the published months and the program alongside the daily window.
  const coverage = COVERAGE_TOOL_NAMES.filter((tool) => tool !== 'get_horoscope_period' || (!!dependencies.horoscopeWindow && !!dependencies.horoscopeMonths && !!dependencies.horoscopeProgram));
  return [...released, ...OCCASION_TOOL_NAMES, ...coverage, ...PLACE_TOOL_NAMES];
}

const isCoverageTool = (tool: string): tool is CoverageToolName => (COVERAGE_TOOL_NAMES as readonly string[]).includes(tool);
const isPlaceTool = (tool: string): tool is PlaceToolName => (PLACE_TOOL_NAMES as readonly string[]).includes(tool);
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
  birthDate: 'a date such as 1990-05-03', date: 'a date such as 2026-12-01', from: 'a date such as 2026-11-01', to: 'a date such as 2026-12-01',
  time: 'a time such as 08:30', zone: 'a time zone name such as Europe/London', currentZone: 'a time zone name such as Asia/Bangkok', place: 'plain text',
};

/** The birth years a tool takes, named when a date in the right form falls outside them (1799-05-03). */
const BIRTH_YEARS: Partial<Record<CoverageToolName | PlaceToolName, string>> = {
  get_natal_chart: `${NATAL_MIN_YEAR} to ${NATAL_MAX_YEAR}`,
  get_personal_transits: `${NATAL_MIN_YEAR} to ${NATAL_MAX_YEAR}`,
};

/**
 * A 0.6.0 tool's refusal of arguments its schema does not accept, naming each field: "birthDate is required.",
 * "period must be one of: month, year, week.". The sentences are fixed text and the schema's own field names and
 * values; nothing from the request is repeated, so an unknown property's name never comes back.
 */
export function coverageInputRefusal(tool: CoverageToolName | PlaceToolName, input: unknown) {
  const parsed = INPUT_SCHEMAS[tool].safeParse(input ?? {});
  if (parsed.success) return null;
  const record = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const sentences = parsed.error.issues.map((issue: z.core.$ZodIssue) => {
    const field = issue.path.map(String).join('.');
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
  let ownedLocalTime: ReturnType<typeof createLocalTimeModule> | undefined;
  const localTime = () => dependencies.localTime ?? (ownedLocalTime ??= createLocalTimeModule());
  const resolveZone = (name: string) => localTime().canonicalZoneName(name);
  try {
    if ((OCCASION_TOOL_NAMES as readonly string[]).includes(tool) && !dependencies.occasions) return failure(tool, 'unavailable', 'This tool is not offered here.');
    if (((COVERAGE_TOOL_NAMES as readonly string[]).includes(tool) || isPlaceTool(tool)) && !offeredTools(dependencies).includes(tool)) return failure(tool, 'unavailable', 'This tool is not offered here.');
    if (isCoverageTool(tool) || isPlaceTool(tool)) { const refusal = coverageInputRefusal(tool, input); if (refusal) return refusal; }
    const parsed = INPUT_SCHEMAS[tool].safeParse(input);
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
        const eclipseLine = dependencies.coverage
          ? 'Eclipses are listed by get_sky_calendar, get_horoscope_period and get_personal_transits (year-ahead). Exact aspects to a birth chart are listed by get_personal_transits. get_upcoming_events lists ingresses, stations and lunations. No birth-time rectification, reminders or account access.'
          : 'Eclipses are listed by get_sky_calendar. get_upcoming_events lists ingresses, stations and lunations, not eclipses or aspects. No birth-time rectification, reminders or account access.';
        data = { name: 'Zodiacs', version: AI_VERSION, engine: BACKEND, tools: offered.filter((name) => (ALL_AI_TOOL_NAMES as readonly string[]).includes(name)), limits: LIMITS, conventions: statements.conventions, coverage: { ...statements.coverage, tools: offered.join(', '), eclipses: dependencies.coverage ? 'get_sky_calendar, get_horoscope_period and get_personal_transits year-ahead include eclipses. get_upcoming_events lists ingresses, stations and lunations.' : 'get_sky_calendar includes eclipses. get_upcoming_events lists ingresses, stations and lunations.', aspects: dependencies.coverage ? 'get_personal_transits lists exact aspects to a birth chart. get_upcoming_events does not search aspects.' : 'get_upcoming_events does not search aspects.' }, privacy: dependencies.occasions ? PRIVACY_WITH_BIRTH_TOOLS : PRIVACY, limitations: ['Tropical geocentric positions; supported reference span is stated in each receipt.', 'Event completeness is tested, not proven. Budget exhaustion refuses the whole search.', eclipseLine, dependencies.occasions ? 'Horoscopes are dated Sun-sign readings for the day before, the day of and the day after the current edition; with a birth date, get_horoscope also gives a personal forecast for the week from the person’s own chart.' : 'Horoscopes are dated Sun-sign readings for the day before, the day of and the day after the current edition; they are not personal birth-chart forecasts.', 'Current means the server instant; daily sky files are separate noon-UTC snapshots.'] };
        if (dependencies.occasions) {
          const capabilities = data as { privacy: string; limitations: string[] };
          capabilities.privacy += ' The occasion, compatibility, chart-twin and birthday tools take dates, and birth dates with an optional time, time zone, place and first names, for one or two people; they calculate from them for that call and save none of it. The result goes to the assistant. Share links and card links leave out names and raw birth details, and coordinates in a link are rounded to two decimals. A birthday, a baby\'s arrival or a coming of age gets no card link and no share link, because that date can be a birth date. The famous-chart and sky-calendar tools need no personal details.';
          capabilities.limitations.push('The occasion tools give the sky on a date, rate it from 0 to 100 by astrology\'s traditional reading, can rate every day in a window of up to 92 days and name the three best, and give the dates of astrology\'s life milestones; they do not guarantee how a day will go.');
          capabilities.limitations.push('Compatibility scores two charts by astrology\'s reading of their contacts; it does not guarantee how a relationship will go. When either birth date is under 18, it leaves out romantic and attraction readings and gives no share link. Famous charts, alone or compared with someone\'s own, cover only the people Zodiacs publishes, cast for local noon because their birth times are not on record.');
          if (!dependencies.coverage) capabilities.limitations.push('Which tool: what changes in the sky over a window, get_upcoming_events; subscribing in a calendar app, get_sky_calendar; one birthday, get_birthday; lifetime returns, get_life_milestones.');
        }
        if (dependencies.occasions && dependencies.coverage) {
          const capabilities = data as { privacy: string; limitations: string[] };
          capabilities.privacy += ' The natal chart, personal transit and Chinese zodiac tools take a birth date, with an optional time, time zone and coordinates for the first two, for that call only and save none of it; the period horoscope and explainer tools take no personal details.';
          // The tools field's enum is the thirteen published names, so the 0.6.0 tools are named here, by their tools/list names.
          const added = [
            ...offeredTools(dependencies).filter(isCoverageTool).map((name) => `${name} (${COVERAGE_TOOL_SUMMARY[name]})`),
            ...offeredTools(dependencies).filter(isPlaceTool).map((name) => `${name} (a town or city name, with coordinates and a time zone for the chart tools)`),
          ];
          const listed = (data as { tools: string[] }).tools.length;
          capabilities.limitations.push(`Version 0.6.0 adds tools listed in tools/list: ${added.slice(0, -1).join(', ')}${added.length > 1 ? ' and ' : ''}${added.at(-1)}. They give astrology's reading plainly, with a reading-confidence label on each forecast (how specific the details were, not the odds that an event happens), never a guarantee, and no health, financial or medical advice. With them Zodiacs offers ${listed + added.length} tools: the ${listed} in the tools field and these ${added.length}.`);
          capabilities.limitations.push(`Which tool: today, tomorrow or this week's general Sun-sign horoscope, get_horoscope; a month or a year, or the week's love or career readings together, get_horoscope_period; transits to a person's own chart or their year ahead, get_personal_transits; one birthday, get_birthday; lifetime returns, get_life_milestones; a chart read in the chat once a birth date is given, get_natal_chart, or open_chart_studio for the person to fill in;${offered.includes('find_birthplace') ? ' a town or city named instead of coordinates, find_birthplace;' : ''} what changes in the sky over a window, get_upcoming_events; subscribing in a calendar app, get_sky_calendar; a yes or no sky check, check_sky_fact; what a term means, or whether two Sun signs are compatible, explain_astrology.`);
        }
        if (dependencies.accounts && dependencies.occasions) {
          const capabilities = data as { privacy: string; limitations: string[] };
          capabilities.privacy += ' Only the save tool needs an account: when the person signs in to their own Zodiacs account and asks to keep a chart, comparison, occasion card or personal week, Zodiacs works it out again from the same details and saves that result, including the birth dates and names in it, to their account until they delete it. It saves no conversation text.';
          capabilities.limitations[2] = dependencies.coverage
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
        links = [moonLink, methodLink];
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
        links = [{ title: 'Subscribe to these in your calendar (get_sky_calendar)', url: `${ORIGIN}/sky-calendar/` }, { title: 'Explore the lunar calendar', url: `${ORIGIN}/full-moon-calendar/` }, { title: 'Explore retrogrades', url: `${ORIGIN}/retrogrades/` }, methodLink];
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
            const personal = await personalWeek({ birthDate: args.birthDate, ...(args.birthTime ? { birthTime: args.birthTime } : {}), ...(birthZone ? { birthZone } : {}) }, dependencies.now?.() ?? new Date(), localTime(), zone);
            const personalLabel = readingConfidenceLabel(readingDetail({ hasDate: true, hasTime: args.birthTime !== undefined, hasPlace: false }));
            personal.note = `${personal.note} ${personalLabel}. For the dates of these contacts, use get_personal_transits.`;
            (data as { personal?: unknown }).personal = personal;
          } catch (error) {
            if (error instanceof RangeError) return failure(tool, 'invalid-request', error.message);
            throw error;
          }
        }
        if (args.sign) context.horoscopePanel = horoscopePanel(window, args.sign, { period: request.period, focus: request.focus, ...(args.date ? { date: args.date } : {}), ...(zoneSource === 'default' ? {} : { zone }) }, { origin: ORIGIN, ref: context.ref ?? null });
        links = [...(args.sign ? [{ title: `${args.sign[0].toUpperCase()}${args.sign.slice(1)} on Zodiacs`, url: `${ORIGIN}/horoscopes/${args.sign}/` }] : []), methodLink];
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
        const withLabel = <T extends { verdict: string; reasons: string[] }>(rating: T): T => ({ ...rating, verdict: `${rating.verdict}. ${label}.`, reasons: [...rating.reasons, label, 'For the sky at a chosen moment, use get_sky.'] });
        const rating = withLabel(rateOccasionDate(args.occasion, card.sky));
        if (best) best = { ...best, best: best.best.map((day) => withLabel(day)) };
        const signOf = (body: string) => card.sky.bodies.find((row) => row.body === body)?.sign ?? null;
        // The share link carries the day, the Sun and Moon signs and the rating. Names stay out of the link.
        // A birthday, a baby's arrival, or a coming of age gets none: that date can be a birth date.
        const shareUrl = BIRTH_OCCASIONS.has(args.occasion) ? null : occasionShareUrl(ORIGIN, { occasion: args.occasion, date, names: null, place: null, sun: signOf('Sun'), moon: signOf('Moon'), score: rating.score });
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
        break;
      }
      case 'get_natal_chart': {
        const args = INPUT_SCHEMAS.get_natal_chart.parse(input);
        const zone = args.zone ? await zoneAt(args.zone, '/zone', resolveZone) : undefined;
        const today = (dependencies.now?.() ?? new Date()).toISOString().slice(0, 10);
        const result = await feature(() => getNatalChart({ ...args, ...(zone ? { zone } : {}) }, localTime(), ORIGIN, today));
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
        }, ORIGIN));
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
        const result = await feature(async () => getChineseZodiac(args, dateInZone(dependencies.now?.() ?? new Date(), zone), zone, ORIGIN, zoneAssumed));
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
        ({ data, links } = explainAstrology(INPUT_SCHEMAS.explain_astrology.parse(input), ORIGIN));
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
    return stripConsumerDashes(OUTPUT_SCHEMAS[tool].parse(result));
  } catch (error) {
    if (error instanceof ComputeApiError) return failure(tool, error.detail.code, namedRefusal(error.detail.message, error.detail.pointer), error.detail.retryAfterSeconds);
    return failure(tool, 'calculation-failed', 'Zodiacs could not complete this. Nothing partial is returned; try again.');
  } finally { ownedLocalTime?.dispose(); }
}
