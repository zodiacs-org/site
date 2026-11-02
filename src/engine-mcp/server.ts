/**
 * The /mcp/engine server: exactly the seven tools the Astrologer bot calls.
 * A separate server from the consumer endpoint /mcp (src/ai-tools/), which
 * keeps its own tools; nothing is shared between the two but the engine and
 * the place index.
 *
 * Nothing thrown by a handler reaches the connection, and an error result
 * quotes no argument: a validation error names the fields only.
 */
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { PLACES_INPUT, PLACES_OUTPUT } from './places.js';
import { ENGINE_MCP_NAME, ENGINE_MCP_VERSION, inputSchemas, linksSchema, outputSchema } from './contracts.js';
import {
  capabilitiesTool, civilTimeOutputSchema, eventSearchDataSchema, eventSearchTool, natalChartTool, natalDataSchema,
  readingFactsOutputSchema, readingFactsTool, resolveCivilTimeTool, searchPlacesTool, transitDataSchema, transitsAtTool,
} from './tools.js';

type Result = { content: { type: 'text'; text: string }[]; structuredContent?: Record<string, unknown>; isError?: true };

/** A refusal that says what was wrong without repeating what was sent. */
export function refusal(error: unknown): Result {
  let text = 'The engine could not complete this call. The connection is still open and the next request is unaffected.';
  if (error instanceof z.ZodError) {
    const fields = [...new Set(error.issues.map((issue) => issue.path.join('.') || 'input'))].slice(0, 8);
    text = `The request was not valid: check ${fields.join(', ')}.`;
  } else if (error instanceof RangeError) {
    text = 'The engine refused this request: a date, time, zone or place is outside what it can calculate.';
  }
  return { isError: true, content: [{ type: 'text', text }] };
}

async function guard(run: () => Result | Promise<Result>): Promise<Result> {
  try { return await run(); } catch (error) { return refusal(error); }
}

const ANNOTATIONS = Object.freeze({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
const CAPABILITIES_OUTPUT = z.object({ name: z.literal(ENGINE_MCP_NAME), version: z.string(), tools: z.array(z.string()) }).passthrough();

export interface EngineServerOptions {
  /** The clock reading_facts uses for a window that starts today. */
  now?: () => Date;
}

export function createEngineServer(options: EngineServerOptions = {}): McpServer {
  const server = new McpServer(
    { name: ENGINE_MCP_NAME, version: ENGINE_MCP_VERSION },
    { instructions: 'Tools of the zodiacs.org engine for the Astrologer bot. Tropical zodiac, whole sign houses by default. Find the birthplace with search_places, resolve the local birth time with resolve_civil_time (ask the person when status is gap or fold), then call reading_facts for the facts sheet. Every calculated fact comes from these tools; link each one to the links.page returned with it, exactly as given.' },
  );
  server.registerTool('search_places', {
    title: 'Find a birthplace',
    description: 'Find a place by name in GeoNames cities15000 (every place of 15,000 people or more): its coordinates and IANA time zone, for resolve_civil_time and reading_facts. Ask the person to choose when more than one place matches.',
    inputSchema: PLACES_INPUT, outputSchema: PLACES_OUTPUT.extend({ links: linksSchema }), annotations: ANNOTATIONS,
  }, (args) => guard(() => searchPlacesTool(args)));
  server.registerTool('resolve_civil_time', {
    title: 'Resolve a local birth time',
    description: 'Resolve a written local date and wall time in an IANA zone to a UTC instant, with gap, fold, local mean time and calendar flags. Unless status is resolved, ask the person which time they mean before using the instant. The time-resolution record is not a chart receipt.',
    inputSchema: inputSchemas.resolve_civil_time, outputSchema: civilTimeOutputSchema, annotations: ANNOTATIONS,
  }, (args) => guard(() => resolveCivilTimeTool(args)));
  server.registerTool('reading_facts', {
    title: 'Reading facts sheet',
    description: 'Every fact a natal reading and its transit window may state, calculated by the engine: placements, sect, dignities, aspects ranked by orb, chart ruler, dispositors, planets on an angle, sign edges and birth-time margins, next birthday and solar return, transits with dates in the birth zone, stations and their contacts. Each sheet line starts with an ID in square brackets. A time that happened twice or did not exist gives both charts (A and B). Takes the local birth date and time as written; it resolves the time zone itself.',
    inputSchema: inputSchemas.reading_facts, outputSchema: readingFactsOutputSchema, annotations: { ...ANNOTATIONS, idempotentHint: false },
  }, (args) => guard(() => readingFactsTool(args, options.now)));
  server.registerTool('natal_chart', {
    title: 'Natal chart',
    description: 'Calculate a tropical natal chart from a resolved UTC instant (from resolve_civil_time). Whole sign houses unless houseSystem is given; unknown time suppresses houses and angles. Returns a native engine receipt.',
    inputSchema: inputSchemas.natal_chart, outputSchema: outputSchema(natalDataSchema), annotations: ANNOTATIONS,
  }, (args) => guard(() => natalChartTool(args)));
  server.registerTool('transits_at', {
    title: 'Transits at an instant',
    description: 'Calculate moving-to-natal aspects at a resolved UTC instant, with separate natal and transit sky receipts.',
    inputSchema: inputSchemas.transits_at, outputSchema: outputSchema(transitDataSchema), annotations: ANNOTATIONS,
  }, (args) => guard(() => transitsAtTool(args)));
  server.registerTool('event_search', {
    title: 'Longitude crossing search',
    description: 'Search the instants in (from, to] when a body crosses a tropical longitude, at most 366 days. A search that runs out of its sample budget is refused with no partial events. Completeness is tested, not proven.',
    inputSchema: inputSchemas.event_search, outputSchema: outputSchema(eventSearchDataSchema), annotations: ANNOTATIONS,
  }, (args) => guard(() => eventSearchTool(args)));
  server.registerTool('get_capabilities', {
    title: 'What this server offers',
    description: 'The tools, settings, versions (engine, ephemeris, time zone data, Node) and limits of this server.',
    inputSchema: inputSchemas.get_capabilities, outputSchema: CAPABILITIES_OUTPUT, annotations: ANNOTATIONS,
  }, () => guard(() => capabilitiesTool()));
  return server;
}
