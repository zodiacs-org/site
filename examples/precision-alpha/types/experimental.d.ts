/**
 * Type declarations for @zodiacs/precision-alpha/experimental.
 *
 * The result shape is the released one -- `SearchResult` from the main
 * entry point, contract `zodiacs-precision-search/2` -- so a consumer
 * already narrowing on `isProven` narrows these the same way. What differs
 * is the SPEC: TDB seconds in, not TT days, because these operations do no
 * time-scale conversion and will not pretend otherwise.
 *
 * Everything here is experimental. The names, the options and the extra
 * diagnostic fields may change in any release.
 */
import type { Body, SearchResult } from './index.js';

export interface RetardedSearchSpec {
  body: Body;
  targetDeg: number;
  /** TDB seconds past J2000. No TT or UTC conversion happens inside. */
  fromTdbSec: number;
  /** TDB seconds past J2000, after `fromTdbSec`. */
  toTdbSec: number;
  /**
   * Polled on every evaluation. An abort comes back as a result with
   * `execution.status === 'cancelled'`, carrying the events already
   * isolated; it does not throw.
   */
  signal?: { aborted: boolean };
  /** Subdivision floor in seconds. Below this a cell stays open. */
  minWidthSec?: number;
  maxEvaluations?: number;
  maxCells?: number;
  /** How many times a candidate light-time interval may be widened. */
  maxTauWidenings?: number;
  /** Below this width a cell whose enclosures failed is reported, not split. */
  enclosureFloorSec?: number;
  /** A floor, in seconds, added to each side of the candidate light-time interval. */
  tauPadFloorSec?: number;
}

/**
 * What this subpath promises, which is deliberately not much.
 */
export const EXPERIMENTAL: Readonly<{
  modes: readonly [
    'validated-retarded-geometric',
    'validated-retarded-aberrated',
    'validated-retarded-aberrated-of-date',
    'validated-retarded-aberrated-deflected-of-date',
  ];
  stability: string;
  timeScale: string;
  /**
   * Which modes can decline part of a request. A caller that ignores this
   * gets a wrong answer rather than an error, so it is declared on the
   * subpath rather than only in the method documentation.
   */
  restrictedDomain: Readonly<{
    modes: readonly ['validated-retarded-aberrated-deflected-of-date'];
    floor: string;
    behaviour: string;
  }>;
  /** The bare contract string, comparable with `===`. */
  resultContract: 'zodiacs-precision-search/2';
  resultContractNote: string;
  /**
   * The partitioned path. A DIFFERENT result contract, not a faster
   * version of the same one: see `PartitionedSearchResult`.
   */
  partitioned: Readonly<{
    planContract: 'zodiacs-domain-partition/1';
    searchContract: 'zodiacs-partitioned-search/1';
    whatItIsFor: string;
    independentOfTargetLongitude: string;
    migration: Readonly<{
      from: 'searchRetardedAberratedDeflectedOfDate';
      whatIsRefused: string;
      fieldsThatMove: readonly string[];
      newPerEventFields: readonly string[];
      whatDoesNotChange: string;
    }>;
  }>;
}>;

/** A closed interval of TDB seconds past J2000, `[from, to]`. */
export type TdbSpan = readonly [number, number];

/** What a plan may be tuned with. Every field has a default. */
export interface DomainPlanSpec {
  body: Body;
  fromTdbSec: number;
  toTdbSec: number;
  /**
   * The pack's verified container digest. Strongly recommended: without
   * it the plan's identity falls back to the pack's structure and proven
   * bounds, which cannot separate two packs of the same shape.
   */
  packDigest?: string | null;
  signal?: { aborted: boolean };
  /**
   * How narrow a span straddling the elongation floor must get before it
   * is reported as boundary instead of being split further. NOT an
   * accuracy claim about the transition instant: the crossing lies
   * somewhere inside the reported span and its width is all that is known.
   */
  boundaryToleranceSec?: number;
  /** How far a span may shrink before its light-time interval is re-derived. */
  relightWidthRatio?: number;
  maxTauWidenings?: number;
  tauPadFloorSec?: number;
  maxEvaluations?: number;
  maxCells?: number;
}

/**
 * Where the deflection profile can and cannot answer, over one window,
 * for one body -- computed WITHOUT a target longitude.
 *
 * The four span lists tile the request exactly and in order. They are not
 * four ways of saying the same thing:
 *
 *   admissible   PROVED at or above the floor at every instant
 *   excluded     PROVED below it at every instant: no answer at any resolution
 *   boundary     proved NEITHER. The transition is in here.
 *   unprocessed  never examined, because the budget ran out or the caller
 *                cancelled. Not excluded, and not searched-and-empty.
 */
export interface DomainPlan {
  readonly contract: 'zodiacs-domain-partition/1';
  /**
   * The identity this plan is a proof about: pack, observer, body,
   * profile, window, tolerance and numerical policy. A plan whose key does
   * not match the call it is handed to is refused, not recomputed.
   */
  readonly key: string;
  readonly request: Readonly<Record<string, unknown>> & {
    readonly identityStrength: 'digest' | 'structure-only';
  };
  readonly admissible: readonly TdbSpan[];
  readonly excluded: readonly TdbSpan[];
  readonly boundary: readonly TdbSpan[];
  readonly unprocessed: readonly TdbSpan[];
  readonly boundaryReasons: readonly Readonly<{ fromTdbSec: number; toTdbSec: number; why: string }>[];
  readonly execution: Readonly<{
    status: 'finished' | 'budget-exhausted' | 'cancelled';
    finished: boolean;
    reason: string | null;
    evaluations: number;
    cells: number;
    maxEvaluations: number;
    maxCells: number;
  }>;
  readonly diagnostics: Readonly<Record<string, unknown>>;
}

/** A crossing found over a plan, carrying which span class it came from. */
export interface PartitionedEvent {
  readonly tdbSec: number;
  readonly bracketTdbSec: readonly [number, number];
  /** Which class of span this crossing was found in. */
  readonly domain: 'admissible' | 'boundary';
  /**
   * `established` only inside a proved-admissible span. A crossing found
   * in a boundary span has NOT been shown to lie in the supported domain.
   *
   * `boundary-ambiguous` is a safety net: a crossing found in an
   * admissible span whose BRACKET reaches into a boundary span, so the
   * instant itself may lie on the unproved side. For a plan this runtime
   * derived it cannot fire — admissible and boundary spans are disjoint
   * and a subsearch's brackets stay inside the span it was given, which
   * was checked over 1,029 crossings without one occurrence. Handle it;
   * do not rely on it.
   */
  readonly eligibility: 'established' | 'not-established' | 'boundary-ambiguous';
  /**
   * Which rung located it. A boundary-span crossing is located with the
   * of-date rung and carries NO solar deflection, so its time is not the
   * deflected crossing time.
   */
  readonly positionFrom:
    | 'validated-retarded-aberrated-deflected-of-date'
    | 'validated-retarded-aberrated-of-date';
  readonly positionNote?: string;
  readonly [key: string]: unknown;
}

/**
 * The result of searching over a plan. NOT `SearchResult`: its
 * completeness is stated over the spans it names rather than over the
 * request, and its events carry fields `SearchResult` has no place for.
 */
export interface PartitionedSearchResult {
  readonly contract: 'zodiacs-partitioned-search/1';
  readonly mode: 'validated-retarded-aberrated-deflected-of-date-over-partition';
  readonly request: Readonly<Record<string, unknown>>;
  readonly plan: Readonly<Record<string, unknown>>;
  readonly events: readonly PartitionedEvent[];
  readonly eventCount: Readonly<{
    found: number;
    eligibilityEstablished: number;
    eligibilityAmbiguous: number;
    /** True only where nothing was excluded, boundary or unprocessed. */
    isExactTotalOverRequest: boolean;
    isExactTotalOverAdmissible: boolean;
  }>;
  readonly completeness: Readonly<{
    /** Over the whole request. False wherever the profile declined any of it. */
    overRequest: boolean;
    overRequestWhyNot: string | null;
    /** The SMALLER claim, scoped to `admissibleSpans` and no further. */
    exhaustiveOverAdmissible: boolean;
    admissibleSpans: readonly TdbSpan[];
    /**
     * True while any boundary, unprocessed, under-examined or unresolved
     * region remains. Read it before treating `events` as a total.
     */
    mayHoldUnfoundSupportedEvents: boolean;
    /**
     * True when the domain came from a plan this runtime did not derive,
     * accepted on the caller's authority with `acceptImportedPlan`. Every
     * other field here is then conditional on that plan being what it
     * says it is, which only its shape was checked against.
     */
    restsOnImportedPlan: boolean;
    statement: string;
  }>;
  readonly accounting: Readonly<{
    admissibleSec: number;
    excludedSec: number;
    boundarySec: number;
    unprocessedSec: number;
    requestSec: number;
    /** The four classes tile the request. Checked, not assumed. */
    coversRequestExactly: boolean;
    excluded: readonly TdbSpan[];
    boundary: readonly TdbSpan[];
    unprocessed: readonly TdbSpan[];
    unresolved: readonly Readonly<Record<string, unknown>>[];
    /**
     * A SECOND axis, not one of the four classes: proved admissible,
     * searched, and the search did not finish.
     */
    admissibleNotFullyExamined: readonly TdbSpan[];
    admissibleNotFullyExaminedSec: number;
    /**
     * Also the second axis: classified, so the domain here is known, and
     * then never searched because the budget ran out or the caller
     * cancelled before this span's turn. Not part of the tiling.
     */
    notSearched: readonly TdbSpan[];
    notSearchedSec: number;
  }> & Readonly<Record<string, unknown>>;
  readonly execution: Readonly<{
    status: 'finished' | 'budget-exhausted' | 'cancelled';
    /**
     * False when the PLAN did not finish, too, not only when a subsearch
     * ran out: a run over a partial plan has not finished the request.
     */
    finished: boolean;
    reason: string | null;
    /**
     * One allowance for the whole request: partition plus every
     * subsearch. It is checked AFTER incrementing, so an exhausted run
     * reports one more than its limit — `4,000,001` against a 4,000,000
     * allowance — and `status` is what says it stopped.
     */
    evaluations: number;
    cells: number;
    maxEvaluations: number;
    partitionEvaluations: number;
    searchEvaluations: number;
    partitionReused: boolean;
    /** True when the plan came from outside this runtime. See `restsOnImportedPlan`. */
    planImported: boolean;
  }> & Readonly<Record<string, unknown>>;
  readonly spanResults: readonly Readonly<Record<string, unknown>>[];
  readonly diagnostics: Readonly<Record<string, unknown>>;
}

/** A search over a plan. `plan` optional; without one, one is built. */
export interface PartitionedSearchSpec extends RetardedSearchSpec {
  plan?: DomainPlan;
  packDigest?: string | null;
  boundaryToleranceSec?: number;
  relightWidthRatio?: number;
  maxTauWidenings?: number;
  tauPadFloorSec?: number;
  /**
   * Accept a plan this runtime did not derive — one that came back from a
   * cache, a file or a worker message. Without it such a plan is REFUSED:
   * a matching key is a fingerprint, not a signature. With it the plan's
   * spans are checked for shape (well formed, inside the request,
   * disjoint, tiling it exactly) and its verdicts are taken on your
   * authority; the result then carries
   * `completeness.restsOnImportedPlan`.
   */
  acceptImportedPlan?: boolean;
  /**
   * Accept a plan that stopped before classifying its whole window.
   * Without it such a plan is refused, because reusing one answers the
   * request over a fraction of itself. With it the run inherits the
   * plan's status and reports `execution.finished: false`.
   */
  acceptPartialPlan?: boolean;
}

export interface ExperimentalSearches {
  /** True once this handle, or the runtime behind it, has been disposed. */
  readonly disposed: boolean;
  readonly contracts: Readonly<{
    retarded: Readonly<Record<string, unknown>>;
    aberrated: Readonly<Record<string, unknown>>;
    ofDate: Readonly<Record<string, unknown>>;
    deflected: Readonly<Record<string, unknown>>;
  }>;
  readonly defaults: Readonly<Record<string, number>>;
  /**
   * The supported-domain floor of the deflected mode, in radians of solar
   * elongation, so a caller can decide whether to ask before asking rather
   * than reading a refusal afterwards.
   */
  readonly deflectionMinElongationRad: number;

  /**
   * `validated-retarded-geometric`: reception light-time only. The
   * observer's own motion does not enter the direction.
   *
   * ## What throws and what does not
   *
   * A malformed REQUEST throws a `PrecisionError`: `disposed` once the
   * handle or its runtime is gone, `unknown-body` for a body outside the
   * contract, `unsupported-option` for an unknown tuning key or a window
   * that runs backwards, and `out-of-coverage` for a window the pack has
   * no records for at all. Write the call inside a `try`.
   *
   * Everything the SEARCH then runs into comes back inside the result and
   * never throws: a budget spent or a cancelled signal is
   * `execution.status`, and a cell that could not be closed is an entry in
   * `accounting.unresolved` with a reason. That is the distinction -- a
   * request the operation cannot accept, against an answer the operation
   * declines to give.
   */
  searchRetarded(spec: RetardedSearchSpec): SearchResult;

  /**
   * `validated-retarded-aberrated`: reception light-time AND stellar
   * aberration from the observer's velocity at reception.
   *
   * NOT an apparent place. Deflection, the Shapiro delay, precession,
   * nutation, the IAU 2006 frame bias and everything topocentric are
   * absent; `diagnostics.notApplied` on the result lists them by name.
   */
  searchRetardedAberrated(spec: RetardedSearchSpec): SearchResult;

  /**
   * `validated-retarded-aberrated-of-date`: the same corrected direction
   * as `searchRetardedAberrated`, expressed in the **mean ecliptic of date
   * with its origin at the true equinox of date**.
   *
   * `spec.targetDeg` is therefore measured from a DIFFERENT ORIGIN than
   * the other two methods use. They differ by precession since J2000 --
   * roughly a quarter of a degree over a couple of decades -- so passing
   * one number to two of these methods asks two different questions, and a
   * crossing that falls inside the window in one frame can fall outside it
   * in the other. `result.request.frame` names which frame an answer is
   * in.
   *
   * Times stay TDB seconds. The TT the frame needs is derived inside by a
   * declared model, and the result reports that model's contribution
   * separately under `uncertainty.timeScale`, alongside the proven
   * numerical width and the unbounded external term. They are not summed.
   *
   * Still NOT an apparent place: gravitational deflection, the Shapiro
   * delay and everything topocentric remain absent, and
   * `diagnostics.notApplied` lists them.
   */
  searchRetardedAberratedOfDate(spec: RetardedSearchSpec): SearchResult;

  /**
   * `validated-retarded-aberrated-deflected-of-date`: the of-date mode
   * with solar gravitational light bending added, in the same frame and
   * with the same origin.
   *
   * ## The one mode here that can decline
   *
   * Every other method answers the whole window or throws. This one has a
   * **restricted domain**: inside five degrees of the Sun it declines to
   * answer rather than guessing, and a window crossing a solar conjunction
   * comes back with `accounting.excluded` non-empty,
   * `completeness.established` false and `eventCount.isExactTotal` false.
   *
   * `events` is then a **lower bound over the request**, exhaustive only
   * over `interval.decidedTdbSec`. Reading it without reading
   * `accounting.excluded` silently turns "we did not look there" into
   * "there is nothing there", which is a wrong answer and not an error:
   *
   * ```ts
   * const r = x.searchRetardedAberratedDeflectedOfDate(spec);
   * if (r.accounting.excluded.length > 0) {
   *   // r.events is a lower bound; r.interval.decidedTdbSec is the part
   *   // it is exhaustive over.
   * }
   * ```
   *
   * `accounting.excluded` and `accounting.unresolved` are different
   * answers and are kept apart: an excluded span is one the profile has no
   * answer for at any resolution, an unresolved one is a span the run
   * could not settle at the cell size it reached.
   *
   * The **Sun as target** is answered and NOT deflected — a body does not
   * deflect its own light. `diagnostics.deflection.appliedToThisBody` is
   * false there and `notAppliedBecause` says why; the mode name is kept so
   * the ladder stays comparable.
   *
   * Requires a pack containing the Sun, and throws `unknown-body` on the
   * first cell if there is none.
   *
   * Still NOT an apparent place: the Shapiro delay, deflection by bodies
   * other than the Sun, and everything topocentric remain absent, and
   * `diagnostics.notApplied` lists them.
   */
  searchRetardedAberratedDeflectedOfDate(spec: RetardedSearchSpec): SearchResult;

  /**
   * WHERE the deflection profile can answer over a window, without asking
   * WHAT it answers there.
   *
   * It takes no target longitude — that is how its independence from one
   * is established rather than asserted — so one plan answers many
   * longitudes over the same window.
   */
  planDeflectedDomain(spec: DomainPlanSpec): DomainPlan;

  /**
   * The deflected search, run over a domain plan instead of rediscovering
   * the domain on every cell.
   *
   * ```ts
   * const plan = x.planDeflectedDomain({ body, fromTdbSec, toTdbSec, packDigest });
   * for (const targetDeg of longitudes) {
   *   const r = x.searchRetardedAberratedDeflectedOfDateOverPlan({
   *     body, targetDeg, fromTdbSec, toTdbSec, plan, packDigest,
   *   });
   * }
   * ```
   *
   * A plan built for a different pack, observer, body, window, profile or
   * tolerance is REFUSED, not silently recomputed.
   *
   * The result is NOT `SearchResult`. See `PartitionedSearchResult` and
   * `EXPERIMENTAL.partitioned.migration`.
   */
  searchRetardedAberratedDeflectedOfDateOverPlan(spec: PartitionedSearchSpec): PartitionedSearchResult;

  /**
   * Detach this handle. Idempotent, and it does NOT dispose the runtime --
   * the caller opened that and may still be using the released modes on it.
   */
  dispose(): void;
}

/** Attach the experimental modes to an open runtime. */
export function experimental(runtime: unknown): ExperimentalSearches;

export const RETARDED_CONTRACT: Readonly<Record<string, unknown>>;
export const ABERRATED_CONTRACT: Readonly<Record<string, unknown>>;
export const OF_DATE_CONTRACT: Readonly<Record<string, unknown>>;
export const DEFLECTED_CONTRACT: Readonly<Record<string, unknown>>;
export const RETARDED_DEFAULTS: Readonly<Record<string, number>>;
export const PARTITION_CONTRACT: Readonly<Record<string, unknown>>;
export const PARTITION_CONTRACT_ID: 'zodiacs-domain-partition/1';
export const PARTITION_DEFAULTS: Readonly<Record<string, number>>;

/**
 * The identity a cached plan must match before it may be reused. Exported
 * so a consumer keying its own cache keys it the same way.
 */
export function partitionKey(parts: {
  packDigest?: string | null;
  packStructure?: string | null;
  observer?: string | null;
  body: Body;
  fromTdbSec: number;
  toTdbSec: number;
  boundaryToleranceSec: number;
  relightWidthRatio: number;
  maxTauWidenings: number;
  tauPadFloorSec: number;
  profile?: string;
}): string;

/**
 * The range over which the of-date frame MODELS claim to represent the
 * sky: TDB seconds past J2000 for 1900-01-01 to 2100-01-01.
 *
 * Outside it the search still runs and still returns proven enclosures
 * about the model as implemented; what lapses is the claim that the model
 * is the sky. `diagnostics.frameOfDate.requestWithinModelRange` says which
 * side a given window is on.
 */
export const OF_DATE_MODEL_RANGE_TDB_SEC: readonly [number, number];
