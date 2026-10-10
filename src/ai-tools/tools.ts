import { moonPhase } from '@zodiacs/engine';
import { createLocalTimeModule } from '../../api/_compute/local-time.mjs';
import { ComputeApiError } from '../lib/compute-api/errors';
import { BUDGETS, EPOCH, EVENT_KINDS } from '../lib/compute-api/constants';
import { computeEvents, computePositions, computeSkyFact } from '../lib/compute-api/endpoints';
import { BACKEND, engineStatements } from '../lib/compute-api/receipt';
import { parseEventsRequest, parsePositionsRequest, parseSkyFactRequest, zoneAt } from '../lib/compute-api/validate';
import type { LocalTimeModule } from '../lib/compute-api/local-time';
import { AI_RESULT_SCHEMA, AI_TOOL_NAMES, AI_VERSION, INPUT_SCHEMAS, MAX_EVENT_DAYS, ORIGIN, OUTPUT_SCHEMAS, type AiToolName } from './contracts';
import { dateInZone, horoscopePanel, resolveHoroscope, type HoroscopePanelData, type ZoneSource } from './horoscope/reading';
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
}

/** Per-call facts from the host and results meant only for the panel. */
export interface AiCallContext {
  /** The time zone the assistant shares with the call, if any; validated before use. */
  hostZone?: string;
  /** Set by get_horoscope: the selected sign's readings for the panel, never shown to the model. */
  horoscopePanel?: HoroscopePanelData;
}

const PRIVACY = 'Public-sky tools and horoscopes need no birth details and save no request or result. The assistant provider can receive tool arguments and results. Hosted calculations run on Zodiacs infrastructure; the local developer server runs on its own machine. Chart Studio calculates in the browser; only explicitly reviewed selections are sent to the assistant, and downloaded records contain personal chart data. Hosting-layer request metadata has a separate retention policy.';
const methodLink = { title: 'How we calculate', url: `${ORIGIN}/methodology/` };
const moonLink = { title: 'Explore Moon phases', url: `${ORIGIN}/moon-phase/` };
const LIMITS = { from: EPOCH.from, to: EPOCH.to, eventWindowDays: MAX_EVENT_DAYS, eventKinds: [...EVENT_KINDS], samples: BUDGETS['events.samples'], factSamples: BUDGETS['sky-fact.samples'] };

export function displayTime(utc: string, zone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' }).format(new Date(utc));
}

function failure(tool: AiToolName, code: string, message: string, retryAfterSeconds?: number) {
  return { schema: AI_RESULT_SCHEMA, ok: false as const, tool, error: { code, message, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) } };
}

/** The tools this server actually offers with these dependencies. */
export function offeredTools(dependencies: AiDependencies): AiToolName[] {
  return AI_TOOL_NAMES.filter((tool) => tool !== 'get_horoscope' || !!dependencies.horoscopeWindow);
}

/** One typed operation per call. No network, persistence or logs; the horoscope window is read through its injected loader. */
export async function executeAiTool(tool: AiToolName, input: unknown, dependencies: AiDependencies, context: AiCallContext = {}) {
  let ownedLocalTime: ReturnType<typeof createLocalTimeModule> | undefined;
  const localTime = () => dependencies.localTime ?? (ownedLocalTime ??= createLocalTimeModule());
  const resolveZone = (name: string) => localTime().canonicalZoneName(name);
  try {
    const parsed = INPUT_SCHEMAS[tool].safeParse(input);
    if (!parsed.success) return failure(tool, 'invalid-request', 'Zodiacs could not use those details. Check the sign, date or time zone and try again.');
    let data: unknown;
    let links = [methodLink];
    switch (tool) {
      case 'open_chart_studio': {
        data = { title: 'Chart Studio', calculation: 'browser-local', initialChart: 'birth-details', sharing: 'user-reviewed-selection-only' };
        links = [];
        break;
      }
      case 'get_capabilities': {
        const statements = engineStatements();
        data = { name: 'Zodiacs', version: AI_VERSION, engine: BACKEND, tools: offeredTools(dependencies), limits: LIMITS, conventions: statements.conventions, coverage: statements.coverage, privacy: PRIVACY, limitations: ['Tropical geocentric positions; supported reference span is stated in each receipt.', 'Event completeness is tested, not proven. Budget exhaustion refuses the whole search.', 'No eclipse or aspect search, birth-time rectification, personal predictions, reminders or account access.', 'Horoscopes are dated Sun-sign readings for the day before, the day of and the day after the current edition; they are interpretation, not personal birth-chart forecasts.', 'Current means the server instant; daily sky files are separate noon-UTC snapshots.'] };
        if (dependencies.skyWatch) {
          const capabilities = data as { privacy: string; limitations: string[] };
          capabilities.privacy += ' Sky Watch preview saves public-sky filters, owner, expiration and encrypted callback credentials. Stopping or expiring a watch clears its credentials; subscription metadata is retained for up to 30 days afterward. Public event records and delivery status are retained for up to 30 days. No birth details are accepted.';
          capabilities.limitations[2] = 'Sky Watch delivers selected public-sky events through verified callbacks. Delivery can be delayed or repeated; no personal predictions, eclipses, aspect search or birth-time rectification.';
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
        data = { mode: args.instant ? 'requested-instant' : 'current-instant', time: { utc, zone, display: displayTime(utc, zone) }, calculation, moonPhase: { name: phase.name, angle: phase.angle, illumination: phase.illumination }, interpretation: 'Astronomical calculations; no personal prediction is supplied.' };
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
        links = [{ title: 'Explore the lunar calendar', url: `${ORIGIN}/full-moon-calendar/` }, { title: 'Explore retrogrades', url: `${ORIGIN}/retrogrades/` }, methodLink];
        break;
      }
      case 'check_sky_fact': {
        const args = INPUT_SCHEMAS.check_sky_fact.parse(input);
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
        data = resolveHoroscope(window, request, zone, zoneSource, localDate);
        if (args.sign) context.horoscopePanel = horoscopePanel(window, args.sign, { period: request.period, focus: request.focus, ...(args.date ? { date: args.date } : {}), ...(zoneSource === 'default' ? {} : { zone }) });
        links = [...(args.sign ? [{ title: `${args.sign[0].toUpperCase()}${args.sign.slice(1)} on Zodiacs`, url: `${ORIGIN}/horoscopes/${args.sign}/` }] : []), methodLink];
        break;
      }
    }
    const result = { schema: AI_RESULT_SCHEMA, ok: true as const, tool, data, links };
    // Validate our own output so callers never receive a success outside its contract.
    return OUTPUT_SCHEMAS[tool].parse(result);
  } catch (error) {
    if (error instanceof ComputeApiError) return failure(tool, error.detail.code, error.detail.message, error.detail.retryAfterSeconds);
    return failure(tool, 'calculation-failed', 'Zodiacs could not complete this. Nothing partial is returned; try again.');
  } finally { ownedLocalTime?.dispose(); }
}
