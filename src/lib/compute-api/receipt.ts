/**
 * Receipts, the backend's name, and the citation every success carries.
 *
 * chart and houses carry the engine's own calculation receipt
 * (`zodiacs.calculation-receipt.draft-v1`, from `createNatalEnvelope`). The
 * engine writes no receipt for the other calculations, so positions, events,
 * time, sky-fact and elections carry `zodiacs.compute-receipt.v1`: the same engine
 * identity, conventions and coverage statement the engine writes into its own
 * receipts, read from one it writes, plus what the request used (the ΔT
 * sources of the engine's time basis, searches, time zone data).
 *
 * `cite.receipt` is a digest of the receipt in the same response, not a second
 * copy: SHA-256 over its RFC 8785 canonical JSON, so any client can recompute
 * it from the response, and an assistant can quote it in one line. The digest
 * is `src/lib/receipt-digest.ts`, which the MCP adapter cites with too.
 */
import {
  DELTA_T_MODEL,
  DELTA_T_TABLE,
  ENGINE_VERSION,
  EPHEMERIS,
  REFERENCE_SPAN,
  natalChart,
} from '@zodiacs/engine';
import { createNatalEnvelope, type NatalReceipt } from '@zodiacs/engine/receipt';
import {
  COMPUTE_RECEIPT_SCHEMA,
  computeDocsUrl,
  responseSchemaName,
  type ComputeEndpoint,
} from './constants.js';
import type { TimeResolutionFacts } from './local-time.js';
import { receiptDigest } from '../receipt-digest.js';

export { canonicalJson, receiptDigest } from '../receipt-digest.js';

/** The backend every response names. */
export const BACKEND = Object.freeze({
  name: '@zodiacs/engine' as const,
  version: ENGINE_VERSION,
  ephemeris: Object.freeze({ name: EPHEMERIS.name, version: EPHEMERIS.version }),
});

/** A source of ΔT (TT − UT1) as a chart names it: its model, table and the table's digest. */
export interface DeltaTSource {
  model: string;
  table: string;
  tableDigest: string;
}

type EngineStatements = Pick<NatalReceipt, 'conventions' | 'coverage'> & { deltaT: readonly [DeltaTSource, DeltaTSource] };
let statements: EngineStatements | null = null;

/**
 * The conventions and coverage statement exactly as the engine writes them
 * into a receipt, and the two sources of ΔT its time basis uses: IERS (the
 * leap seconds and UT1 − UTC) from 1972 to the end of its UT1 table, as a chart
 * at 2000-01-01 names it, and the ΔT model otherwise. The engine exports its
 * conventions set and the model's table but not the coverage statement or the
 * UT1 table's, so those are read from a chart and a receipt it writes for a
 * fixed instant.
 */
export function engineStatements(): EngineStatements {
  if (!statements) {
    const chart = natalChart({ utc: '2000-01-01T12:00:00Z', timeKnown: false });
    const { receipt } = createNatalEnvelope(chart);
    const { model, table, tableDigest } = chart.deltaT;
    if (model !== 'iers-utc/1' || table === null || tableDigest === null) {
      throw new Error('The engine\'s chart for 2000-01-01 no longer names the IERS table.');
    }
    statements = {
      conventions: receipt.conventions,
      coverage: receipt.coverage,
      deltaT: [
        { model, table, tableDigest },
        { model: DELTA_T_MODEL, table: DELTA_T_TABLE.version, tableDigest: DELTA_T_TABLE.digest },
      ],
    };
  }
  return statements;
}

export interface SearchFacts {
  /** The engine's one crossing solver, root export `searchLongitudeCrossings` or `searchLongitudeCrossingsWith`. */
  solver: 'engine-longitude-crossings';
  stepDays: { default: number; moon: number; elongation: number };
  /** Each crossing is bisected 24 times, to within the step divided by 2^24. */
  bisections: 24;
  /** Evaluations the searches made, and the most they were allowed. */
  samples: number;
  maxSamples: number;
  /** A crossing exactly at the window's start is left out, and one exactly at its end is kept. */
  window: 'start-exclusive-end-inclusive';
  completeness: 'tested-not-proven';
}

/**
 * How an election search ran: the crossing search's steps for sign changes,
 * stations and phases, the void-of-course rule and its scan, the house
 * sampling, and the evaluations it made. Boundaries are within a second.
 */
export interface ElectionSearchFacts {
  solver: 'engine-longitude-crossings-and-sampled-houses';
  stepDays: { default: number; moon: number; elongation: number };
  voidOfCourse: { convention: 'last-exact-ptolemaic-aspect-to-sign-exit'; bodies: 'modern'; scanHours: number };
  houseSampleMinutes: number;
  boundarySeconds: number;
  /** Gaps shorter than this between windows are closed, and windows shorter than it are not listed. */
  resolutionSeconds: number;
  /** What one full calculation (all positions, or a natalChart) counts for in samples; a crossing step counts once. */
  fullCalculationCost: number;
  samples: number;
  maxSamples: number;
  /** Each window holds its start and not its end, as the request's window does. */
  window: 'start-inclusive-end-exclusive';
  completeness: 'tested-not-proven';
}

export interface ComputeReceipt {
  schema: typeof COMPUTE_RECEIPT_SCHEMA;
  endpoint: ComputeEndpoint;
  engine: typeof BACKEND;
  conventions: EngineStatements['conventions'];
  coverage: EngineStatements['coverage'];
  referenceSpan: { from: string; to: string };
  /** The two ΔT sources of the engine's time basis, IERS first; each result that gives an instant's ΔT names which applied. */
  deltaT: readonly [DeltaTSource, DeltaTSource];
  timeResolution?: TimeResolutionFacts;
  search?: SearchFacts;
  electionSearch?: ElectionSearchFacts;
}

export function computeReceipt(
  endpoint: ComputeEndpoint,
  extra: { timeResolution?: TimeResolutionFacts; search?: SearchFacts; electionSearch?: ElectionSearchFacts } = {},
): ComputeReceipt {
  const { conventions, coverage, deltaT } = engineStatements();
  return {
    schema: COMPUTE_RECEIPT_SCHEMA,
    endpoint,
    engine: BACKEND,
    conventions,
    coverage,
    referenceSpan: { from: REFERENCE_SPAN.from, to: REFERENCE_SPAN.to },
    deltaT,
    ...(extra.timeResolution ? { timeResolution: extra.timeResolution } : {}),
    ...(extra.search ? { search: extra.search } : {}),
    ...(extra.electionSearch ? { electionSearch: extra.electionSearch } : {}),
  };
}

export interface Cite {
  url: string;
  receipt: string;
  engine: typeof BACKEND.name;
  version: string;
}

export function citeFor(endpoint: ComputeEndpoint, receipt: unknown): Cite {
  return {
    url: computeDocsUrl(endpoint),
    receipt: receiptDigest(receipt),
    engine: BACKEND.name,
    version: BACKEND.version,
  };
}

export interface SuccessBody<Result, Receipt> {
  schema: string;
  result: Result;
  receipt: Receipt;
  backend: typeof BACKEND;
  cite: Cite;
}

export function successBody<Result, Receipt>(
  endpoint: ComputeEndpoint,
  result: Result,
  receipt: Receipt,
): SuccessBody<Result, Receipt> {
  return {
    schema: responseSchemaName(endpoint),
    result,
    receipt,
    backend: BACKEND,
    cite: citeFor(endpoint, receipt),
  };
}
