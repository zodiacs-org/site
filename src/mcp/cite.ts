/**
 * What every tool result cites: `cite: { url, receipt, engine, version }`, the
 * shape the hosted compute API puts on each of its successes, with the same
 * digest: `receiptDigest` from `src/lib/receipt-digest.ts`, which the compute
 * API cites with too — SHA-256 over the receipt's RFC 8785 canonical JSON,
 * written `sha256:` and hex. An assistant quotes a result from either the same
 * way, and anyone holding the receipt can recompute the digest.
 *
 * Which receipt a result cites:
 *
 * - `calculate_natal_chart`: the engine's own calculation receipt, the
 *   `receipt` inside the record that `output: "record"` returns for the same
 *   arguments. A summary and a record of one calculation cite one digest. Only
 *   the record carries the receipt itself: it holds the instant and the
 *   coordinates, which the summary leaves out.
 * - `get_capabilities` and `compare_calculation_records`: the adapter's own
 *   receipt, which the reply carries in full: the adapter and the engine that
 *   answered, and for a comparison its output. Nothing in it comes from a
 *   record, so a comparison's citation says how the comparison was made, not
 *   which records it read. The engine's version fixes the conventions it
 *   calculates under, which the `zodiacs://conventions` resource lists.
 * - `get_positions`, `find_events` and `check_sky_fact`: the hosted compute
 *   API's receipt for the same calculation, which the reply carries in full:
 *   the engine, its conventions and coverage, the reference span, the two
 *   sources of ΔT, and for a search how it searched and how many evaluations
 *   it made. It holds no instant, date or body from the request, and it is the
 *   receipt the compute API writes for the same request, so the digest is the
 *   one the compute API cites.
 *
 * resolve_birth_time cites its separate clock receipt, which holds local birth
 * details. Its URL is the existing methodology page while the new local tool
 * and its guide entry remain an unpublished preparation.
 */
import { ENGINE_VERSION, EPHEMERIS } from '@zodiacs/engine';
import { receiptDigest } from '../lib/receipt-digest';
import { ADAPTER_NAME, ADAPTER_VERSION, type CompareOutputName } from './bounds';

export const ADAPTER_RECEIPT_SCHEMA = 'zodiacs.mcp-receipt.v1' as const;
export const DOCS_URL = 'https://zodiacs.org/developers/mcp/';

export const TOOL_NAMES = Object.freeze([
  'get_capabilities', 'resolve_birth_time', 'calculate_natal_chart', 'compare_calculation_records',
  'get_positions', 'find_events', 'check_sky_fact',
] as const);
export type ToolName = (typeof TOOL_NAMES)[number];

/** The tools that run a compute API calculation, and the endpoint each one is. */
export const SKY_TOOLS = Object.freeze({
  get_positions: 'positions',
  find_events: 'events',
  check_sky_fact: 'sky-fact',
} as const);
export type SkyToolName = keyof typeof SKY_TOOLS;

export function toolUrl(tool: ToolName): string {
  return tool === 'resolve_birth_time' ? 'https://zodiacs.org/methodology/' : `${DOCS_URL}#${tool}`;
}

export interface Cite {
  url: string;
  receipt: string;
  engine: '@zodiacs/engine';
  version: string;
}

export function citeFor(tool: ToolName, receipt: unknown): Cite {
  return { url: toolUrl(tool), receipt: receiptDigest(receipt), engine: '@zodiacs/engine', version: ENGINE_VERSION };
}

function adapterReceipt<Tool extends Exclude<ToolName, 'calculate_natal_chart' | 'resolve_birth_time' | SkyToolName>>(tool: Tool) {
  return {
    schema: ADAPTER_RECEIPT_SCHEMA,
    tool,
    adapter: { name: ADAPTER_NAME, version: ADAPTER_VERSION },
    engine: { name: '@zodiacs/engine' as const, version: ENGINE_VERSION, ephemeris: { name: EPHEMERIS.name, version: EPHEMERIS.version } },
  };
}

/** The receipt `get_capabilities` carries and cites. */
export function capabilitiesReceipt() {
  return adapterReceipt('get_capabilities');
}

/** The receipt `compare_calculation_records` carries and cites: the adapter's, and the output asked for. */
export function comparisonReceipt(output: CompareOutputName) {
  return { ...adapterReceipt('compare_calculation_records'), output };
}
