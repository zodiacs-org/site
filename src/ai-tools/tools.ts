import { moonPhase } from '@zodiacs/engine';
import { createLocalTimeModule } from '../../api/_compute/local-time.mjs';
import { ComputeApiError } from '../lib/compute-api/errors';
import { BUDGETS, EPOCH, EVENT_KINDS } from '../lib/compute-api/constants';
import { computeEvents, computePositions, computeSkyFact } from '../lib/compute-api/endpoints';
import { BACKEND, engineStatements } from '../lib/compute-api/receipt';
import { parseEventsRequest, parsePositionsRequest, parseSkyFactRequest, zoneAt } from '../lib/compute-api/validate';
import type { LocalTimeModule } from '../lib/compute-api/local-time';
import { rankConsumerSearchEntries } from '../lib/webmcp/search';
import { CONSUMER_CATALOG } from './catalog';
import { AI_RESULT_SCHEMA, AI_TOOL_NAMES, AI_VERSION, INPUT_SCHEMAS, MAX_EVENT_DAYS, ORIGIN, OUTPUT_SCHEMAS, type AiToolName } from './contracts';

export interface AiDependencies {
  localTime?: LocalTimeModule;
  now?: () => Date;
  /** The hosted boundary supplies both Firewall and atomic event admission. */
  allowEvents?: () => Promise<'allowed' | 'limited' | 'unavailable'>;
}

const PRIVACY = 'Public-sky tools need no birth details and save no request or result. The assistant provider can receive tool arguments and results. Hosted calculations run on Zodiacs infrastructure; the local developer server runs on its own machine. Hosting-layer request metadata has a separate retention policy.';
const methodLink = { title: 'How these calculations work', url: `${ORIGIN}/developers/compute/` };
const moonLink = { title: 'Explore Moon phases', url: `${ORIGIN}/moon-phase/` };
const LIMITS = { from: EPOCH.from, to: EPOCH.to, eventWindowDays: MAX_EVENT_DAYS, eventKinds: [...EVENT_KINDS], samples: BUDGETS['events.samples'], factSamples: BUDGETS['sky-fact.samples'], searchResults: 5 };

export function displayTime(utc: string, zone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' }).format(new Date(utc));
}

function failure(tool: AiToolName, code: string, message: string, retryAfterSeconds?: number) {
  return { schema: AI_RESULT_SCHEMA, ok: false as const, tool, error: { code, message, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) } };
}

/** One typed operation per call. No network, filesystem, persistence or logs. */
export async function executeAiTool(tool: AiToolName, input: unknown, dependencies: AiDependencies) {
  let ownedLocalTime: ReturnType<typeof createLocalTimeModule> | undefined;
  const localTime = () => dependencies.localTime ?? (ownedLocalTime ??= createLocalTimeModule());
  const resolveZone = (name: string) => localTime().canonicalZoneName(name);
  try {
    const parsed = INPUT_SCHEMAS[tool].safeParse(input);
    if (!parsed.success) return failure(tool, 'invalid-request', 'The arguments do not match the supported tool schema.');
    let data: unknown;
    let links = [methodLink];
    switch (tool) {
      case 'get_capabilities': {
        const statements = engineStatements();
        data = { name: 'Zodiacs', version: AI_VERSION, engine: BACKEND, tools: [...AI_TOOL_NAMES], limits: LIMITS, conventions: statements.conventions, coverage: statements.coverage, privacy: PRIVACY, limitations: ['Tropical geocentric positions; supported reference span is stated in each receipt.', 'Event completeness is tested, not proven. Budget exhaustion refuses the whole search.', 'No eclipse or aspect search, birth-time rectification, predictions, reminders or account access.', 'Search covers curated consumer guides, not the full website.', 'Current means the server instant; daily sky files are separate noon-UTC snapshots.'] };
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
        if (parsedRequest.to.getTime() - parsedRequest.from.getTime() > MAX_EVENT_DAYS * 86_400_000) return failure(tool, 'budget-exhausted', 'An event window is at most 31 days long.');
        if (dependencies.allowEvents) {
          const verdict = await dependencies.allowEvents();
          if (verdict !== 'allowed') return failure(tool, verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable', 'Event computation is unavailable under its request limit. Try again later.', verdict === 'limited' ? 60 : 300);
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
          if (verdict !== 'allowed') return failure(tool, verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable', 'Date-based fact computation is unavailable under its request limit. Try again later.', verdict === 'limited' ? 60 : 300);
        }
        const calculation = await computeSkyFact(request, { localTime: localTime() });
        data = { answer: calculation.result.answer, calculation, interpretation: 'The verdict checks an astronomical proposition, not an astrological prediction.' };
        break;
      }
      case 'search_zodiacs': {
        const { query } = INPUT_SCHEMAS.search_zodiacs.parse(input);
        const results = rankConsumerSearchEntries(CONSUMER_CATALOG, query).map(({ path, ...entry }) => ({ ...entry, url: `${ORIGIN}${path}` }));
        data = { scope: 'curated-consumer-guides', results };
        links = [];
        break;
      }
    }
    const result = { schema: AI_RESULT_SCHEMA, ok: true as const, tool, data, links };
    // Validate our own output so callers never receive a success outside its contract.
    return OUTPUT_SCHEMAS[tool].parse(result);
  } catch (error) {
    if (error instanceof ComputeApiError) return failure(tool, error.detail.code, error.detail.message, error.detail.retryAfterSeconds);
    return failure(tool, 'calculation-failed', 'Zodiacs could not complete this operation. No partial result is returned.');
  } finally { ownedLocalTime?.dispose(); }
}
