/**
 * The adapter's tools and resources, registered on an McpServer.
 *
 * `server.ts` connects this to stdio and does nothing else. Keeping the
 * registrations here lets the tests drive them through the SDK's own client in
 * one process, with every result checked against the output schema a host
 * reads, and lets another transport serve the same definitions.
 *
 * Nothing thrown by a handler reaches the connection. Every tool call runs
 * inside `guard`, so a malformed request produces a refusal and leaves the
 * session able to serve the next valid one.
 */
import { McpServer } from '@modelcontextprotocol/server';
import { ADAPTER_NAME, ADAPTER_VERSION } from './bounds';
import {
  CAPABILITIES_OUTPUT, COMPARE_OUTPUT, EVENTS_OUTPUT, NATAL_OUTPUT, POSITIONS_OUTPUT, SKY_FACT_OUTPUT,
} from './outputs';
import { RESOURCES } from './resources';
import { RESOLVE_BIRTH_INPUT, RESOLVE_BIRTH_OUTPUT, resolveBirthTime } from './birth-time-tools';
import {
  ANY_ZONE_DAY_TEXT, EVENTS_INPUT, POSITIONS_INPUT, SKY_FACT_INPUT, checkSkyFact, findEvents, getPositions,
} from './sky-tools';
import {
  CAPABILITIES_INPUT, COMPARE_INPUT, NATAL_INPUT, PRIVACY,
  calculateNatalChart, compareCalculationRecords, describeCapabilities, type ToolOutcome,
} from './tools';

/**
 * Where the server may report on itself, outside the protocol. What it is
 * given is deliberately thin: fixed strings, version numbers and error class
 * names. No birth detail, no record content, no argument value.
 */
export type Note = (message: string) => void;

function respond(outcome: ToolOutcome) {
  if (!outcome.ok) return { isError: true as const, content: [{ type: 'text' as const, text: outcome.refusal }] };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(outcome.value, null, 1) }],
    structuredContent: outcome.value,
  };
}

/**
 * An unexpected throw becomes a refusal on this call alone. The note names the
 * error's class and not its message, because a message from an unknown throw
 * may quote the argument that caused it.
 */
function failed(note: Note, error: unknown) {
  note(`a tool handler failed with ${error instanceof Error ? error.name : 'a non-error throw'}`);
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: 'The adapter could not complete this call. The connection is still open and the next request is unaffected.' }],
  };
}

function guard(note: Note, run: () => ToolOutcome) {
  try {
    return respond(run());
  } catch (error) {
    return failed(note, error);
  }
}

/** The same guard for a handler that returns a promise, which a rejection does not escape. */
async function guardAsync(note: Note, run: () => Promise<ToolOutcome>) {
  try {
    return respond(await run());
  } catch (error) {
    return failed(note, error);
  }
}

/** Honest hints: nothing here writes, reaches the network, or varies by call. */
const READ_ONLY = Object.freeze({
  readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false,
});

export function createServer(note: Note): McpServer {
  const server = new McpServer(
    { name: ADAPTER_NAME, version: ADAPTER_VERSION },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.registerTool('get_capabilities', {
    title: 'Zodiacs engine capabilities',
    description: [
      'What this adapter can calculate, the exact engine and schema versions behind it, every limit a request must respect, the resources it offers, and what it deliberately does not do.',
      'Read this before the other tools rather than guessing at supported options.',
      PRIVACY.assistant,
    ].join(' '),
    inputSchema: CAPABILITIES_INPUT,
    outputSchema: CAPABILITIES_OUTPUT,
    annotations: READ_ONLY,
  }, () => guard(note, () => describeCapabilities()));

  server.registerTool('resolve_birth_time', {
    title: 'Resolve a supplied local birth time',
    description: [
      'Resolve a written local date and supplied IANA zone through the pinned package geo entry, with an explicit Gregorian or Julian calendar.',
      'Returns the UTC instant and the actual clock receipt, including fold, gap, mean time and timezone provenance.',
      'An omitted time selects an unknown local-noon reference; it does not recover a birth time or cover the whole date.',
      'No place or zone is inferred. Existing site forms may use a different historical alias clock policy.',
      'The reply contains birth details and its receipt digest identifies them. Quote it only where those details may be known.',
      PRIVACY.assistant,
    ].join(' '),
    inputSchema: RESOLVE_BIRTH_INPUT,
    outputSchema: RESOLVE_BIRTH_OUTPUT,
    annotations: READ_ONLY,
  }, (args) => guardAsync(note, () => resolveBirthTime(args)));

  server.registerTool('calculate_natal_chart', {
    title: 'Calculate a natal chart',
    description: [
      'Calculate one natal chart from a birth instant and, optionally, coordinates.',
      'Returns body positions, angles, house cusps and aspects, with whether the time was known and which house system was requested against which one was actually used, and what to cite.',
      'The citation\'s digest identifies the birth details, so quote it only where they may be known.',
      'Computed on this machine by the pinned Zodiacs engine.',
      PRIVACY.assistant,
    ].join(' '),
    inputSchema: NATAL_INPUT,
    outputSchema: NATAL_OUTPUT,
    annotations: READ_ONLY,
  }, (args) => guard(note, () => calculateNatalChart(args)));

  server.registerTool('compare_calculation_records', {
    title: 'Compare two calculation records',
    description: [
      'Read two Zodiacs calculation records and report what differs between them and how much of it is explained.',
      'Each difference is a fact read from the two records. Each proposed cause is labelled by its evidence: reproduced by a local recalculation, reported by the records themselves, a hypothesis that fits, or unresolved.',
      'Pass record content, not a path or a URL.',
      // This tool takes two whole calculation records as arguments and was the
      // one of the three missing the routing sentence, which is the wrong way
      // round: it is the call that carries the most.
      PRIVACY.assistant,
      PRIVACY.output,
    ].join(' '),
    inputSchema: COMPARE_INPUT,
    outputSchema: COMPARE_OUTPUT,
    annotations: READ_ONLY,
  }, (args) => guard(note, () => compareCalculationRecords(args)));

  // The compute API's own calculations: the same parser, function and receipt as
  // POST /api/v1/positions, /events and /sky-fact, run here.
  server.registerTool('get_positions', {
    title: 'Body positions at given instants',
    description: [
      'The positions of the Sun, the Moon, the planets and the two lunar nodes at up to 100 instants: tropical ecliptic longitude, latitude, daily motion, sign and degree, with the ΔT and time scale the engine used.',
      'The same calculation, result and receipt as POST https://zodiacs.org/api/v1/positions for the same request, computed on this machine by the pinned Zodiacs engine.',
      PRIVACY.assistant,
    ].join(' '),
    inputSchema: POSITIONS_INPUT,
    outputSchema: POSITIONS_OUTPUT,
    annotations: READ_ONLY,
  }, (args) => guard(note, () => getPositions(args)));

  server.registerTool('find_events', {
    title: 'Find sign ingresses, stations and lunations',
    description: [
      'Sign ingresses, stations and new and full moons in a window of up to 92 days, in time order, found by the engine\'s crossing search.',
      'The search is tested, not proven to miss nothing: the receipt says so in search.completeness, beside how it searched and how many evaluations it made.',
      'The same calculation, result and receipt as POST https://zodiacs.org/api/v1/events for the same request, computed on this machine.',
      PRIVACY.assistant,
    ].join(' '),
    inputSchema: EVENTS_INPUT,
    outputSchema: EVENTS_OUTPUT,
    annotations: READ_ONLY,
  }, (args) => guard(note, () => findEvents(args)));

  server.registerTool('check_sky_fact', {
    title: 'Check a stated sky fact',
    description: [
      'Whether a stated fact holds: a body in a sign or retrograde at an instant or on a date, a body entering a sign on a date, or the Moon reaching a phase on a date.',
      'Answers true, false or depends, with the computed values that decide it and a receipt. It never interprets.',
      ANY_ZONE_DAY_TEXT,
      'The same calculation, result and receipt as POST https://zodiacs.org/api/v1/sky-fact for the same request without a zone, computed on this machine.',
      PRIVACY.assistant,
    ].join(' '),
    inputSchema: SKY_FACT_INPUT,
    outputSchema: SKY_FACT_OUTPUT,
    annotations: READ_ONLY,
  }, (args) => guardAsync(note, () => checkSkyFact(args)));

  // Static text built into the bundle: a read opens no file and makes no request.
  for (const resource of RESOURCES) {
    server.registerResource(resource.name, resource.uri, {
      title: resource.title,
      description: resource.description,
      mimeType: resource.mimeType,
    }, () => ({ contents: [{ uri: resource.uri, mimeType: resource.mimeType, text: resource.read() }] }));
  }

  return server;
}
