/**
 * The MCP server behind https://zodiacs.org/mcp: the public-sky tools of the
 * local adapter, served over Streamable HTTP by api/compatibility.ts through
 * hosted-http.ts.
 *
 * The calculations are the local adapter's, from the same modules:
 * get_positions, find_events and check_sky_fact parse and compute with the
 * compute API's own functions (sky-tools.ts), so each returns the same result,
 * receipt and cite as the local tool and as POST /api/v1/positions, /events
 * and /sky-fact for the same request. get_sky is get_positions for one
 * instant, by default the server's current time. Only what is true of a
 * hosted server differs: the descriptions, the capabilities reply and the
 * privacy text.
 *
 * calculate_natal_chart and compare_calculation_records are not offered here.
 * Both take birth details or whole calculation records, and a hosted call
 * would carry those to zodiacs.org; they stay with the local adapter.
 *
 * This file is not one of the local archive's declared sources
 * (examples/mcp-server/candidate.json), so its existence changes nothing in
 * the archive the site distributes.
 */
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ENGINE_VERSION, EPHEMERIS } from '@zodiacs/engine';
import {
  BUDGETS, EPOCH, EVENT_BODIES, EVENT_KINDS, PHASE_NAMES, POSITION_BODIES, SKY_FACT_KINDS,
  type RateLimitVerdict,
} from '../lib/compute-api/constants';
import { receiptDigest } from '../lib/receipt-digest';
import { ADAPTER_RECEIPT_SCHEMA, DOCS_URL } from './cite';
import { MCP_URL } from './hosted-route';
import { EVENTS_OUTPUT, POSITIONS_OUTPUT, SKY_FACT_OUTPUT } from './outputs';
import {
  ANY_ZONE_DAY_TEXT, EVENTS_INPUT, POSITIONS_INPUT, SKY_FACT_INPUT, checkSkyFact, findEvents, getPositions,
} from './sky-tools';
import { UNSUPPORTED, type ToolOutcome } from './tools';

export const HOSTED_SERVER_NAME = 'zodiacs-mcp';
export const HOSTED_SERVER_VERSION = '0.1.0';

export const HOSTED_TOOL_NAMES = Object.freeze([
  'get_capabilities', 'get_sky', 'get_positions', 'find_events', 'check_sky_fact',
] as const);
export type HostedToolName = (typeof HOSTED_TOOL_NAMES)[number];

/** The tools that take birth details or records, and run only in the local adapter. */
export const LOCAL_ONLY_TOOLS = Object.freeze(['calculate_natal_chart', 'compare_calculation_records'] as const);

/** The largest request body the endpoint reads, in bytes: the compute API's own cap. */
export const MAX_REQUEST_BYTES = 16_384;

/**
 * What reaches whom. Pending the owner's approval of the wording before the
 * endpoint is switched on (MCP_SWITCH_ENV): each sentence restates what
 * docs/claims/ledger.json already supports for the compute API (priv.compute-api)
 * or for the local adapter (priv.local-tools), for the one function both
 * hosted surfaces share.
 */
export const HOSTED_PRIVACY = Object.freeze({
  server: 'These tools run on zodiacs.org\'s servers, in the function that serves the compute API. A request\'s arguments travel only in its body, and nothing from a request or its result is written to a log, a file or a database.',
  logs: 'The host\'s request logs keep each request\'s URL and IP address.',
  assistant: 'Whatever assistant you connect decides what reaches its model provider: your message, the arguments it builds for these tools, and the results it reads back.',
});

export const HOSTED_UNSUPPORTED = Object.freeze([
  `Natal charts and comparisons of calculation records. Those tools take birth details, so they run only in the local adapter: ${DOCS_URL}`,
  UNSUPPORTED[0],
  UNSUPPORTED[1],
  UNSUPPORTED[2],
  UNSUPPORTED[7],
  'Sessions, subscriptions or notifications sent by the server: each request is answered on its own.',
]);

/** One instant, as the compute API reads it; the longest it accepts is 29 characters. */
export const SKY_INPUT = z.strictObject({
  instant: z.string().max(29).optional()
    .describe(`One instant in ISO 8601 with Z or a numeric offset, such as 2026-10-06T12:00:00Z, from ${EPOCH.from} to ${EPOCH.to} once the offset is applied. Omitted means the server's current time.`),
  bodies: POSITIONS_INPUT.shape.bodies,
});

export const HOSTED_CAPABILITIES_INPUT = z.strictObject({});

const engine = z.strictObject({
  name: z.literal('@zodiacs/engine'),
  version: z.string(),
  ephemeris: z.strictObject({ name: z.literal(EPHEMERIS.name), version: z.string() }),
});

export const HOSTED_CAPABILITIES_OUTPUT = z.strictObject({
  server: z.strictObject({
    name: z.literal(HOSTED_SERVER_NAME),
    version: z.string(),
    transport: z.literal('streamable-http'),
    endpoint: z.literal(MCP_URL),
    stateless: z.literal(true),
    maxRequestBytes: z.literal(MAX_REQUEST_BYTES),
  }),
  engine,
  tools: z.array(z.enum(HOSTED_TOOL_NAMES)),
  localOnly: z.strictObject({ tools: z.array(z.enum(LOCAL_ONLY_TOOLS)), documentation: z.literal(DOCS_URL) }),
  sky: z.strictObject({
    sameAs: z.string(),
    epoch: z.strictObject({ from: z.string(), to: z.string() }),
    positionBodies: z.array(z.string()),
    eventBodies: z.array(z.string()),
    eventKinds: z.array(z.string()),
    factKinds: z.array(z.string()),
    phases: z.array(z.string()),
    limits: z.strictObject({
      'positions.instants': z.number(),
      'events.windowDays': z.number(),
      'events.samples': z.number(),
      'sky-fact.samples': z.number(),
    }),
    search: z.strictObject({ window: z.literal('start-exclusive-end-inclusive'), completeness: z.literal('tested-not-proven') }),
    dates: z.string(),
  }),
  unsupported: z.array(z.string()),
  privacy: z.strictObject({ server: z.string(), logs: z.string(), assistant: z.string() }),
  receipt: z.strictObject({
    schema: z.literal(ADAPTER_RECEIPT_SCHEMA),
    tool: z.literal('get_capabilities'),
    adapter: z.strictObject({ name: z.literal(HOSTED_SERVER_NAME), version: z.string() }),
    engine,
  }),
  cite: z.strictObject({
    url: z.literal(`${DOCS_URL}#get_capabilities`),
    receipt: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    engine: z.literal('@zodiacs/engine'),
    version: z.string(),
  }),
});

export function describeHostedCapabilities(): ToolOutcome {
  const receipt = {
    schema: ADAPTER_RECEIPT_SCHEMA,
    tool: 'get_capabilities' as const,
    adapter: { name: HOSTED_SERVER_NAME, version: HOSTED_SERVER_VERSION },
    engine: { name: '@zodiacs/engine' as const, version: ENGINE_VERSION, ephemeris: { name: EPHEMERIS.name, version: EPHEMERIS.version } },
  };
  return {
    ok: true,
    value: {
      server: {
        name: HOSTED_SERVER_NAME, version: HOSTED_SERVER_VERSION, transport: 'streamable-http',
        endpoint: MCP_URL, stateless: true, maxRequestBytes: MAX_REQUEST_BYTES,
      },
      engine: receipt.engine,
      tools: [...HOSTED_TOOL_NAMES],
      localOnly: { tools: [...LOCAL_ONLY_TOOLS], documentation: DOCS_URL },
      sky: {
        sameAs: 'POST https://zodiacs.org/api/v1/positions, /events and /sky-fact: the same parser, calculation and receipt, so the same result and cite.receipt for the same request',
        epoch: { from: EPOCH.from, to: EPOCH.to },
        positionBodies: [...POSITION_BODIES],
        eventBodies: [...EVENT_BODIES],
        eventKinds: [...EVENT_KINDS],
        factKinds: [...SKY_FACT_KINDS],
        phases: [...PHASE_NAMES],
        limits: {
          'positions.instants': BUDGETS['positions.instants'],
          'events.windowDays': BUDGETS['events.windowDays'],
          'events.samples': BUDGETS['events.samples'],
          'sky-fact.samples': BUDGETS['sky-fact.samples'],
        },
        search: { window: 'start-exclusive-end-inclusive', completeness: 'tested-not-proven' },
        dates: ANY_ZONE_DAY_TEXT,
      },
      unsupported: [...HOSTED_UNSUPPORTED],
      privacy: { ...HOSTED_PRIVACY },
      receipt,
      cite: { url: `${DOCS_URL}#get_capabilities`, receipt: receiptDigest(receipt), engine: '@zodiacs/engine', version: ENGINE_VERSION },
    },
  };
}

/** get_positions for one instant, by default the server's current time. */
export function getSky(args: z.infer<typeof SKY_INPUT>, now: () => Date = () => new Date()): ToolOutcome {
  const instant = args.instant ?? now().toISOString();
  return getPositions({ instants: [instant], ...(args.bodies ? { bodies: args.bodies } : {}) });
}

export interface HostedDependencies {
  /** The server's clock, for get_sky without an instant. */
  readonly now?: () => Date;
  /**
   * The events limit a hosted find_events also counts under, as POST
   * /api/v1/events does. Absent in tests that drive the tools directly.
   */
  readonly allowEvents?: () => Promise<RateLimitVerdict>;
}

/** Fixed sentences: a refusal never quotes a value from the request. */
export const EVENTS_LIMIT_REFUSAL = Object.freeze({
  limited: 'Event searches from this address are over their limit for the minute. Try again in 60 seconds.',
  unavailable: 'Event searches are unavailable because their limit cannot be checked. Try again in five minutes.',
});

const UNEXPECTED = 'The server could not complete this call. Nothing was kept from it, and the next request is unaffected.';

function respond(outcome: ToolOutcome) {
  if (!outcome.ok) return { isError: true as const, content: [{ type: 'text' as const, text: outcome.refusal }] };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(outcome.value, null, 1) }],
    structuredContent: outcome.value,
  };
}

/** An unexpected throw becomes a refusal on this call alone, and nothing about it is written anywhere. */
async function guard(run: () => ToolOutcome | Promise<ToolOutcome>) {
  try {
    return respond(await run());
  } catch {
    return { isError: true as const, content: [{ type: 'text' as const, text: UNEXPECTED }] };
  }
}

/** Honest hints: nothing here writes or reaches past the calculation. */
const READ_ONLY = Object.freeze({
  readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false,
});
/** get_sky without an instant answers for the time it is asked, so asking twice can differ. */
const READ_ONLY_NOW = Object.freeze({ ...READ_ONLY, idempotentHint: false });

export const HOSTED_INSTRUCTIONS = 'Astronomical positions, sign ingresses, stations, new and full moons, and checks of a stated sky fact, each with a receipt and a cite to quote. Results are calculations, not interpretations or predictions. Call get_capabilities for the limits.';

export function createHostedServer(dependencies: HostedDependencies = {}): McpServer {
  const now = dependencies.now ?? (() => new Date());
  const server = new McpServer(
    { name: HOSTED_SERVER_NAME, version: HOSTED_SERVER_VERSION },
    { capabilities: { tools: {} }, instructions: HOSTED_INSTRUCTIONS },
  );

  server.registerTool('get_capabilities', {
    title: 'What this server calculates',
    description: [
      'What this server can calculate, the exact engine version behind it, every limit a request must respect, and what it deliberately does not do.',
      'Read this before the other tools rather than guessing at supported options.',
    ].join(' '),
    inputSchema: HOSTED_CAPABILITIES_INPUT,
    outputSchema: HOSTED_CAPABILITIES_OUTPUT,
    annotations: READ_ONLY,
  }, () => guard(() => describeHostedCapabilities()));

  server.registerTool('get_sky', {
    title: 'The sky now or at one instant',
    description: [
      'The positions of the Sun, the Moon, the planets and the two lunar nodes at one instant, by default the server\'s current time: tropical ecliptic longitude, latitude, daily motion, sign and degree, with the ΔT and time scale the engine used.',
      'The same calculation, result, receipt and cite as get_positions for that one instant.',
    ].join(' '),
    inputSchema: SKY_INPUT,
    outputSchema: POSITIONS_OUTPUT,
    annotations: READ_ONLY_NOW,
  }, (args) => guard(() => getSky(args, now)));

  server.registerTool('get_positions', {
    title: 'Body positions at given instants',
    description: [
      'The positions of the Sun, the Moon, the planets and the two lunar nodes at up to 100 instants: tropical ecliptic longitude, latitude, daily motion, sign and degree, with the ΔT and time scale the engine used.',
      'The same calculation, result and receipt as POST https://zodiacs.org/api/v1/positions for the same request.',
    ].join(' '),
    inputSchema: POSITIONS_INPUT,
    outputSchema: POSITIONS_OUTPUT,
    annotations: READ_ONLY,
  }, (args) => guard(() => getPositions(args)));

  server.registerTool('find_events', {
    title: 'Find sign ingresses, stations and lunations',
    description: [
      'Sign ingresses, stations and new and full moons in a window of up to 92 days, in time order, found by the engine\'s crossing search.',
      'The search is tested, not proven to miss nothing: the receipt says so in search.completeness, beside how it searched and how many evaluations it made.',
      'The same calculation, result and receipt as POST https://zodiacs.org/api/v1/events for the same request.',
    ].join(' '),
    inputSchema: EVENTS_INPUT,
    outputSchema: EVENTS_OUTPUT,
    annotations: READ_ONLY,
  }, (args) => guard(async () => {
    const verdict = dependencies.allowEvents ? await dependencies.allowEvents() : 'allowed';
    if (verdict !== 'allowed') return { ok: false, refusal: EVENTS_LIMIT_REFUSAL[verdict] };
    return findEvents(args);
  }));

  server.registerTool('check_sky_fact', {
    title: 'Check a stated sky fact',
    description: [
      'Whether a stated fact holds: a body in a sign or retrograde at an instant or on a date, a body entering a sign on a date, or the Moon reaching a phase on a date.',
      'Answers true, false or depends, with the computed values that decide it and a receipt. It never interprets.',
      ANY_ZONE_DAY_TEXT,
      'The same calculation, result and receipt as POST https://zodiacs.org/api/v1/sky-fact for the same request without a zone.',
    ].join(' '),
    inputSchema: SKY_FACT_INPUT,
    outputSchema: SKY_FACT_OUTPUT,
    annotations: READ_ONLY,
  }, (args) => guard(() => checkSkyFact(args)));

  return server;
}
