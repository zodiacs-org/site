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
import { CAPABILITIES_OUTPUT, COMPARE_OUTPUT, NATAL_OUTPUT } from './outputs';
import { RESOURCES } from './resources';
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
function guard(note: Note, run: () => ToolOutcome) {
  try {
    return respond(run());
  } catch (error) {
    note(`a tool handler failed with ${error instanceof Error ? error.name : 'a non-error throw'}`);
    return {
      isError: true as const,
      content: [{ type: 'text' as const, text: 'The adapter could not complete this call. The connection is still open and the next request is unaffected.' }],
    };
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
      'Read this before the other two tools rather than guessing at supported options.',
      PRIVACY.assistant,
    ].join(' '),
    inputSchema: CAPABILITIES_INPUT,
    outputSchema: CAPABILITIES_OUTPUT,
    annotations: READ_ONLY,
  }, () => guard(note, () => describeCapabilities()));

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
