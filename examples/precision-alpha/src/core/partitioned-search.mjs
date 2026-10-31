/**
 * The deflected longitude search, run over a proved domain partition
 * instead of rediscovering the domain on every request.
 *
 * ## What changes, and what does not
 *
 * The event mathematics is untouched: the same `searchDeflectedLongitude`
 * runs on each admissible subinterval, with the same correction profile,
 * the same continuous vector event equations, the same half-plane test,
 * the same corrected lever arms, the same record ownership and the same
 * root metadata. What changes is that it is handed intervals it can
 * answer, instead of discovering the hard way which ones those are.
 *
 * ## Why that is worth doing
 *
 * Measured on the live runtime, the share of a deflected search's
 * evaluations spent on cells that exist only because some ancestor's
 * elongation enclosure straddled the floor: 98.9 per cent on the Moon,
 * 99.9 on Mercury, 98.9 on Saturn -- and 66.3 on a control window with no
 * conjunction in it at all. The deflection arithmetic itself is 1 to 2 per
 * cent of wall time and the domain test it gates is 0.
 *
 * ## The budget is ONE budget
 *
 * Partitioning, every subsearch and the final accounting draw on a single
 * allowance for the request. A subsearch is given what is left, not a
 * fresh copy: `maxEvaluations: remaining`. When it runs out, the spans not
 * yet reached are UNPROCESSED -- not excluded, not searched-and-empty.
 *
 * ## Five states, kept apart
 *
 * The result distinguishes, and never merges:
 *
 *   finished              the run reached its end rather than stopping
 *   complete over request  every instant of the request was accounted for
 *   exhaustive over the proved-admissible spans, which is a SMALLER claim
 *   excluded by profile    no answer at any resolution
 *   unresolved numerically  this run did not settle it
 *   unprocessed            never examined; budget or cancellation
 *
 * A request containing an excluded span is never complete over the
 * request, whatever else is true of it. And `exhaustiveOverAdmissible` is
 * deliberately scoped to the spans it names: boundary spans may hold
 * supported events, so a blanket "complete within the supported domain"
 * would be a claim about instants nobody classified.
 */
import { fail, PrecisionError } from './errors.mjs';
import { DEFLECTION_PROFILE } from './deflection.mjs';
import {
  partitionDomain, PARTITION_DEFAULTS, partitionKey, packFingerprint, PARTITION_CONTRACT_ID,
  isNativePlan, validatePlanSpans,
} from './domain-partition.mjs';
import {
  searchDeflectedLongitude, searchDeflectedLongitudeOnProvedDomain, searchOfDateLongitude,
  DEFLECTED_CONTRACT, OF_DATE_CONTRACT,
} from './retarded-search.mjs';
import { setLabel } from './instrument.mjs';

const DAY = 86400;

/** Total length of a span list. */
const total = (spans) => spans.reduce((n, [lo, hi]) => n + (hi - lo), 0);

/** Sort and merge touching spans. Reporting, not arithmetic. */
const mergeSpanList = (spans) => {
  const sorted = [...spans].sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [lo, hi] of sorted) {
    const last = out[out.length - 1];
    if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
    else out.push([lo, hi]);
  }
  return out;
};

/**
 * Does `[lo, hi)` STRICTLY overlap any span in the list?
 *
 * Strictly: touching at an endpoint is not overlapping, which is what
 * makes adjacent classes of one partition disjoint rather than in
 * conflict. Exported so the predicate can be tested on its own -- the
 * one place it is used cannot be driven by any well-formed plan, so a
 * test that only ran the search would not see it break.
 */
export const spansMeet = (spans, lo, hi) => spans.some(([a, b]) => a < hi && b > lo);
const meets = spansMeet;

/**
 * A partition, checked against the request it is about to be used for.
 *
 * A cached partition is a PROOF about a particular pack, body, profile,
 * window and tolerance. Reusing it for anything else reuses a proof of a
 * different statement, so the key is compared in full and a mismatch is a
 * refusal rather than a recomputation -- a silent recomputation would hide
 * from the caller that their cache is not working.
 *
 * Note what is NOT in the key: the target longitude. The partition does
 * not depend on one, which is why the same plan answers many.
 */
export function assertPartitionUsable(plan, {
  eph, packDigest, body, fromTdbSec, toTdbSec,
  boundaryToleranceSec, relightWidthRatio, maxTauWidenings, tauPadFloorSec,
  acceptImportedPlan = false, acceptPartialPlan = false,
}) {
  if (!plan || plan.contract !== PARTITION_CONTRACT_ID) {
    fail('unsupported-option', `a plan must be a ${PARTITION_CONTRACT_ID} produced by this runtime`);
  }
  if (!plan.request || typeof plan.request !== 'object') {
    fail('unsupported-option', 'a plan must carry the request it was built for');
  }
  /**
   * The key is rebuilt from what THIS CALL asks for, never from the
   * plan's own statement of it.
   *
   * The first version of this function took the boundary tolerance out of
   * `plan.request` and then checked that the key matched -- which it
   * always did, because the plan had supplied the very field being
   * compared. A caller asking for a 5-second tolerance and handed a
   * 60-second plan was told nothing. Every field the identity names is
   * now taken from the caller's side, and the pack's own numerical
   * metadata is read from the live runtime rather than believed from the
   * plan: a serialized partition that merely CONTAINS a plausible key is
   * not evidence that the key is its own.
   */
  const want = partitionKey({
    packDigest,
    packStructure: eph ? packFingerprint(eph) : null,
    observer: eph ? (eph.observer ?? 'unknown') : null,
    body,
    fromTdbSec,
    toTdbSec,
    boundaryToleranceSec,
    relightWidthRatio,
    maxTauWidenings,
    tauPadFloorSec,
    profile: DEFLECTION_PROFILE.id,
  });
  if (plan.key !== want) {
    fail('unsupported-option',
      `this plan is for a different request: it carries ${plan.key} and this call needs ${want}. A partition is a proof about one pack, observer, body, profile, window, tolerance and numerical policy; it is not reused across any of them.`);
  }
  const [lo, hi] = plan.request.windowTdbSec ?? [NaN, NaN];
  if (!(lo === fromTdbSec && hi === toTdbSec)) {
    fail('unsupported-option', 'the plan\'s stated window does not match the window its key claims');
  }

  /**
   * Where a proof stops being a proof.
   *
   * A matching key is not evidence that this runtime derived the plan. It
   * is a non-cryptographic fingerprint, recomputed here from the live
   * pack, so anything that can call `partitionKey` can produce one -- and
   * a partial write, a compaction that keeps only `admissible`, or a hand
   * edit leaves the header untouched. An earlier version of this function
   * carried a comment claiming it caught exactly that. It did not: the
   * only thing under that comment was the window comparison above, and a
   * plan whose span lists had been replaced with `admissible: [whole
   * window]` was accepted and turned every hedge in the contract off at
   * once -- `overRequest: true`, `mayHoldUnfoundSupportedEvents: false`,
   * every crossing labelled `established`, and the deflected rung run with
   * its domain gate disabled on spans nothing had proved.
   *
   * So: a plan this process built is trusted by identity, not by shape.
   * Anything else is an IMPORT. Its spans are checked for structure --
   * well formed, inside the request, pairwise disjoint, tiling it exactly
   * -- and the caller has to say `acceptImportedPlan: true`, because
   * structure is all that can be checked. Nothing here can tell a true
   * verdict from a false one; only recomputing can.
   */
  const imported = !isNativePlan(plan);
  if (imported) {
    if (!acceptImportedPlan) {
      fail('unsupported-option',
        'this plan was not produced by this runtime in this running process; it is an import. A matching key is a fingerprint, not a signature: it says the plan is ABOUT this request, not that anyone proved it. Recompute it with planDeflectedDomain, or pass acceptImportedPlan: true to accept a structurally checked import on the authority of wherever it came from.');
    }
    const why = validatePlanSpans(plan, fromTdbSec, toTdbSec);
    if (why !== null) {
      fail('unsupported-option', `this imported plan is not well formed: ${why}`);
    }
  }

  /**
   * A plan that did not finish classified only part of its window, and
   * the rest is `unprocessed` -- not excluded, not admissible, not
   * anything. Reusing it for a request with a larger budget silently
   * answers that request over a fraction of itself: measured, a plan
   * built at a hundred evaluations classified 3 per cent of a two-day
   * window, carried a key identical to the full plan's, and returned
   * zero crossings where the full plan returns three.
   *
   * The budget is deliberately NOT in the key -- two FINISHED plans built
   * at different budgets are the same plan, and keying on the budget would
   * make a cache miss on every allowance. What matters is whether the plan
   * is complete, which is a property of the plan and is checked here.
   */
  if (!acceptPartialPlan) {
    if (plan.execution.status !== 'finished') {
      fail('unsupported-option',
        `this plan stopped with ${plan.execution.status} and classified only part of its window. Rebuild it, or pass acceptPartialPlan: true to search the part it did classify.`);
    }
    if (plan.unprocessed.length > 0) {
      fail('unsupported-option',
        `this plan left ${plan.unprocessed.length} span(s) unclassified. Rebuild it, or pass acceptPartialPlan: true.`);
    }
  }
  return { plan, imported };
}

/**
 * Search one body's longitude over a requested interval, using a domain
 * partition.
 *
 * `spec.plan` is optional. Without one a partition is built for this
 * request and its cost is charged to this request's budget -- the cold
 * path, and the one the evaluation measures first.
 */
export function searchDeflectedOverPartition(eph, spec = {}) {
  const {
    body,
    targetDeg,
    fromTdbSec,
    toTdbSec,
    plan: given = null,
    packDigest = null,
    signal = null,
    boundaryToleranceSec = PARTITION_DEFAULTS.boundaryToleranceSec,
    relightWidthRatio = PARTITION_DEFAULTS.relightWidthRatio,
    maxTauWidenings = PARTITION_DEFAULTS.maxTauWidenings,
    tauPadFloorSec = PARTITION_DEFAULTS.tauPadFloorSec,
    /**
     * A plan that did not come from this runtime in this process, and a
     * plan that did not finish, are each accepted only when the caller
     * says so by name. See `assertPartitionUsable`.
     */
    acceptImportedPlan = false,
    acceptPartialPlan = false,
    maxEvaluations = 4_000_000,
    maxCells = 400_000,
    ...rest
  } = spec;
  const a = Number(fromTdbSec);
  const b = Number(toTdbSec);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !(b > a)) {
    fail('unsupported-option', 'the window must be finite with toTdbSec after fromTdbSec');
  }

  let evaluationsUsed = 0;
  let cellsUsed = 0;
  let status = 'finished';
  let reason = null;
  /**
   * A supplied plan that did not finish, held apart from `status` until
   * the subsearches are done. Setting `status` from it up front, as the
   * first version did, made `runOn` skip every span, so
   * `acceptPartialPlan: true` searched nothing of the part the plan DID
   * classify, which is what the option promises (audit finding
   * alpha-search-partition-1). Folded in after the subsearches.
   */
  let inherited = null;
  const remaining = () => Math.max(0, maxEvaluations - evaluationsUsed);

  // ------------------------------------------------------------- partition
  let plan;
  let partitionEvaluations = 0;
  let partitionReused = false;
  let planImported = false;
  if (given) {
    const checked = assertPartitionUsable(given, {
      eph,
      packDigest,
      body,
      fromTdbSec: a,
      toTdbSec: b,
      boundaryToleranceSec,
      relightWidthRatio,
      maxTauWidenings,
      tauPadFloorSec,
      acceptImportedPlan,
      acceptPartialPlan,
    });
    plan = checked.plan;
    planImported = checked.imported;
    partitionReused = true;
    /**
     * The plan's own incompleteness is the REQUEST's incompleteness. A
     * run over a plan that never classified part of its window has not
     * finished that window, whatever its own subsearches did, and the
     * top-level status is the field a consumer branches on.
     */
    if (plan.execution.status !== 'finished') {
      inherited = {
        status: plan.execution.status,
        reason: `the supplied plan stopped with ${plan.execution.status}: ${plan.execution.reason}`,
      };
    }
  } else {
    setLabel('partition');
    plan = partitionDomain(eph, {
      body,
      fromTdbSec: a,
      toTdbSec: b,
      boundaryToleranceSec,
      relightWidthRatio,
      maxTauWidenings,
      tauPadFloorSec,
      packDigest,
      signal,
      maxEvaluations,
      maxCells,
    });
    partitionEvaluations = plan.execution.evaluations;
    evaluationsUsed += partitionEvaluations;
    cellsUsed += plan.execution.cells;
    if (!plan.execution.finished) {
      status = plan.execution.status;
      reason = `partitioning stopped: ${plan.execution.reason}`;
    }
  }

  // ------------------------------------------------------------ subsearches
  /**
   * Admissible spans first, then boundary spans. Order matters when the
   * budget runs out: spending what is left on spans where an answer is
   * PROVED eligible beats spending it where the answer would be
   * ambiguous anyway.
   */
  const searched = [];
  const events = [];
  const unresolved = [];
  const spanResults = [];
  /**
   * The SECOND axis, and the reason there are two.
   *
   * The four classes answer "what is the domain here" and tile the
   * request. Whether a span was then SEARCHED is a different question
   * about the same instants, and a span can be admissible and unsearched
   * at once. The first version of this pushed unsearched admissible spans
   * into `unprocessed` alongside the plan's own, which meant the same
   * second was reported in `admissibleSec` and in `unprocessedSec` both:
   * on a starved 2-day request the four figures summed to 4 days while
   * `coversRequestExactly`, computed from `plan.unprocessed` rather than
   * from the list it was reporting, still said true. Two axes, kept
   * apart, and the tiling check now reads the same list it prints.
   */
  const notSearched = [];
  /** Proved admissible, started, and not finished. Also the second axis. */
  const notFullyExamined = [];
  let searchEvaluations = 0;

  const runOn = (lo, hi, domain) => {
    if (status !== 'finished') { notSearched.push([lo, hi]); return; }
    if (remaining() <= 0) {
      status = 'budget-exhausted';
      reason = `the request's evaluation budget of ${maxEvaluations} was spent`;
      notSearched.push([lo, hi]);
      return;
    }
    setLabel(`subsearch-${domain}`);
    let r;
    /**
     * On an ADMISSIBLE span the partition has proved the elongation floor
     * at every instant, so the search does not re-decide it. That is the
     * whole point of partitioning: domain membership is a property of
     * instants, a sub-span inherits it, and re-testing it is what the
     * 98.9 per cent was.
     *
     * On a BOUNDARY span nothing was proved, so the ordinary gated search
     * runs and may exclude or refuse inside it -- which is the honest
     * behaviour there.
     */
    /**
     * A BOUNDARY span is searched with rung 4 -- the of-date direction,
     * no solar term -- and not with the deflected rung.
     *
     * Two reasons, and the second is the one that matters. First,
     * `DEFLECTION-PROFILE.md` section 7 already prescribes exactly this
     * where the profile declines: "the caller should use rung 4, which
     * has no solar term and no near-Sun degeneracy", as a downgrade the
     * caller chooses and records. Second, running the GATED deflected rung
     * here reintroduces the cascade the partition exists to remove, inside
     * the one region where it can never terminate: measured on Saturn, two
     * boundary spans totalling 0.06 days cost 26,621 evaluations -- four
     * and a half times what the 288.9 admissible days cost -- because the
     * gate bisects to the one-second enclosure floor and the tolerance
     * that stopped the partition does not apply to it.
     *
     * What this costs in honesty is stated rather than hidden: a crossing
     * found here has its POSITION from rung 4, not rung 5, and its
     * eligibility is not established. Both travel with the event.
     */
    const run = domain === 'admissible'
      ? searchDeflectedLongitudeOnProvedDomain
      : searchOfDateLongitude;
    try {
      r = run(eph, {
        body,
        targetDeg,
        fromTdbSec: lo,
        toTdbSec: hi,
        signal,
        maxEvaluations: remaining(),
        maxCells: Math.max(1, maxCells - cellsUsed),
        ...rest,
      });
    } catch (error) {
      if (error instanceof PrecisionError && (error.code === 'budget-exhausted' || error.code === 'cancelled')) {
        status = error.code;
        reason = error.message;
        notSearched.push([lo, hi]);
        return;
      }
      throw error;
    }
    evaluationsUsed += r.execution.evaluations;
    searchEvaluations += r.execution.evaluations;
    cellsUsed += r.execution.cells;
    searched.push([lo, hi]);
    spanResults.push({
      spanTdbSec: [lo, hi],
      domain,
      status: r.execution.status,
      established: r.completeness.established,
      found: r.events.length,
      evaluations: r.execution.evaluations,
      cells: r.execution.cells,
    });
    for (const e of r.events) {
      events.push({
        ...e,
        /**
         * Which kind of span this event was found in. An event inside a
         * proved-admissible span has established eligibility AND a
         * deflected position; one found in a boundary span has neither,
         * and saying so is the difference between a partial answer and a
         * wrong one.
         */
        domain,
        eligibility: domain === 'admissible' ? 'established' : 'not-established',
        positionFrom: domain === 'admissible'
          ? 'validated-retarded-aberrated-deflected-of-date'
          : 'validated-retarded-aberrated-of-date',
        ...(domain === 'admissible' ? {} : {
          positionNote: 'This crossing was located with rung 4, the of-date direction with NO solar deflection, because the profile does not support this span. Its time is not the deflected crossing time and its eligibility is not established.',
        }),
      });
    }
    for (const u of r.accounting.unresolved) unresolved.push({ ...u, domain });
    /**
     * A span the profile declines INSIDE a span the partition PROVED
     * admissible is a contradiction between two implementations of one
     * definition, and it is surfaced rather than absorbed.
     *
     * Only for admissible spans. A boundary span is expected to contain
     * declined parts -- that is what makes it a boundary -- and the first
     * version of this flagged those as contradictions, which would have
     * had every conjunction case reporting a disagreement that was not
     * one. Rung 4 produces no excluded spans at all now, so this is about
     * the admissible path.
     */
    for (const x of r.accounting.excluded) {
      if (domain === 'admissible') {
        spanResults[spanResults.length - 1].contradiction = true;
        unresolved.push({ ...x, domain, why: `the search excluded a span inside a PROVED-ADMISSIBLE span, so the partition and the deflection disagree here: ${x.why}` });
      } else {
        unresolved.push({ ...x, domain });
      }
    }
    if (r.execution.status !== 'finished') {
      status = r.execution.status;
      reason = r.execution.reason;
      /**
       * The span is still ADMISSIBLE -- domain membership is a fact about
       * the geometry and a subsearch running out of budget does not
       * unprove it. What stopped is the EXAMINATION, and that is a
       * different axis, recorded separately.
       *
       * It is not moved to `unprocessed`: part of it WAS examined, and an
       * unfinished run reports no decided spans, so nothing here can say
       * which part. Reporting the whole span as never-examined would be
       * false in one direction and double-counted against the four
       * classes that tile the request in the other. The span stays where
       * it belongs and the incompleteness is stated beside it.
       */
      notFullyExamined.push([lo, hi]);
    }
  };

  for (const [lo, hi] of plan.admissible) runOn(lo, hi, 'admissible');
  for (const [lo, hi] of plan.boundary) runOn(lo, hi, 'boundary');

  // ------------------------------------------------------------- accounting
  /**
   * An event whose BRACKET meets a boundary span cannot have its
   * eligibility settled by its midpoint. The midpoint is not the event;
   * the bracket is what was proved, and half of a bracket lying in
   * unclassified territory is an ambiguity, not a rounding question.
   */
  for (const e of events) {
    const [blo, bhi] = e.bracketTdbSec ?? [e.tdbSec, e.tdbSec];
    if (e.eligibility === 'established' && meets(plan.boundary, blo, bhi)) {
      e.eligibility = 'boundary-ambiguous';
      e.eligibilityNote = 'the reported bracket meets a span whose admissibility was not established, so this event\'s eligibility is not settled by the partition. Its POSITION is unaffected.';
    }
  }
  events.sort((x, y) => x.tdbSec - y.tdbSec);

  const established = events.filter((e) => e.eligibility === 'established');
  const ambiguous = events.filter((e) => e.eligibility !== 'established');

  /**
   * The DOMAIN axis only: spans the partition never classified. Spans the
   * SEARCH never reached are `notSearched`, which is not one of the four
   * classes and is reported separately.
   */
  const unprocessed = plan.unprocessed;
  const unprocessedTotal = total(unprocessed);
  const notSearchedTotal = total(notSearched);
  const excludedTotal = total(plan.excluded);
  const boundaryTotal = total(plan.boundary);
  const requestSpan = b - a;

  /**
   * Exhaustive over the spans NAMED in `admissible`, and no further. Every
   * such span must have been searched and must have established its own
   * completeness. Boundary spans are deliberately not part of this claim:
   * they may hold supported events, and a flag that covered them would be
   * a claim about instants nobody classified.
   */
  const everyAdmissibleSearched = plan.admissible.length === spanResults
    .filter((s) => s.domain === 'admissible' && s.established && s.status === 'finished').length;
  const exhaustiveOverAdmissible = status === 'finished'
    && everyAdmissibleSearched
    && !spanResults.some((s) => s.contradiction);
  // Only now does the plan's own incompleteness reach the request's
  // status: the classified part was searched above, and the run is still
  // not finished, because part of the window was never classified.
  if (inherited) {
    reason = status === 'finished' ? inherited.reason : `${inherited.reason}; then ${reason}`;
    status = inherited.status;
  }

  /**
   * Complete over the REQUEST -- the original rule's claim, and the larger
   * one. It holds only in the case where there is nothing else to hold it
   * back: the profile declined nothing, the tolerance left nothing
   * unclassified, the budget left nothing unexamined, and the admissible
   * spans that were searched exhaustively therefore ARE the request.
   *
   * This is not a blanket "complete within the supported domain". It is
   * refused the moment a single second of the request is excluded,
   * boundary or unprocessed, which for any window containing a conjunction
   * is always. Written this way so the partitioned path can be scored by
   * the original rule rather than being weaker than the search it
   * replaces on the cases where the whole window is admissible.
   */
  const completeOverRequest = exhaustiveOverAdmissible
    && excludedTotal === 0
    && boundaryTotal === 0
    && unprocessedTotal === 0
    && notSearchedTotal === 0
    && notFullyExamined.length === 0
    && Math.abs(total(plan.admissible) - requestSpan) <= 1e-6;

  return {
    contract: 'zodiacs-partitioned-search/1',
    mode: 'validated-retarded-aberrated-deflected-of-date-over-partition',
    request: {
      body,
      targetDeg,
      windowTdbSec: [a, b],
      profile: DEFLECTION_PROFILE.id,
      operation: DEFLECTED_CONTRACT.operation,
      frame: DEFLECTED_CONTRACT.frame,
      /**
       * The caller's, not the plan's. The key check already proves the
       * two agree; taking it from the plan would leave the one value a
       * supplied object could still put into the result's statement of
       * what was asked.
       */
      boundaryToleranceSec,
    },
    plan: {
      key: plan.key,
      reused: partitionReused,
      admissible: plan.admissible,
      excluded: plan.excluded,
      boundary: plan.boundary,
      unprocessed: plan.unprocessed,
      execution: plan.execution,
      diagnostics: plan.diagnostics,
    },
    events,
    eventCount: {
      found: events.length,
      eligibilityEstablished: established.length,
      eligibilityAmbiguous: ambiguous.length,
      /**
       * NEVER true while any part of the request went unexamined or
       * unclassified. An exact total is a statement about the request, and
       * an excluded span is part of the request.
       */
      isExactTotalOverRequest: completeOverRequest,
      isExactTotalOverAdmissible: exhaustiveOverAdmissible,
    },
    completeness: {
      /**
       * Over the REQUEST. False whenever the profile declined any part of
       * it -- which, for a window containing a conjunction, is always. The
       * original rule scores this and it is reported unchanged.
       */
      overRequest: completeOverRequest,
      overRequestWhyNot: completeOverRequest
        ? null
        : excludedTotal > 0
        ? 'the profile excludes part of this request, so no run can be complete over it'
        : (boundaryTotal > 0 || unprocessedTotal > 0
          ? 'part of this request was neither admitted nor excluded'
          : 'not claimed'),
      /** The SMALLER claim, scoped to the spans it names. */
      exhaustiveOverAdmissible,
      admissibleSpans: plan.admissible,
      /**
       * Every way a supported crossing could still be sitting unfound:
       * a boundary span nobody classified, a span nobody examined, an
       * admissible span whose search stopped early, and a sliver the
       * search itself could not settle. The first version listed only
       * the first two, which would have read as "nothing else can be
       * hiding" on a run whose subsearch ran out of budget.
       */
      mayHoldUnfoundSupportedEvents: boundaryTotal > 0
        || unprocessedTotal > 0
        || notSearchedTotal > 0
        || notFullyExamined.length > 0
        || unresolved.length > 0,
      /**
       * Whose word the domain rests on. False -- the ordinary case --
       * means this runtime proved it. True means the caller supplied a
       * plan from elsewhere and said `acceptImportedPlan`, so every
       * claim below is conditional on that plan being what it says it
       * is, which nothing here checked beyond its shape.
       */
      restsOnImportedPlan: planImported,
      statement: `${exhaustiveOverAdmissible
        ? 'Every crossing of the requested longitude by the light-time-, solar-deflection- and aberration-corrected direction, in the ecliptic of date with the true equinox of date as origin, over the spans listed in admissibleSpans and NOT over the rest of the request.'
        : 'No exhaustiveness is claimed: at least one admissible span was not searched to completion.'}${planImported
        ? ' CONDITIONAL: the domain came from an imported plan this runtime did not derive. Its spans were checked for shape and not for truth.'
        : ''}`,
    },
    accounting: {
      /**
       * The four classes tile the request exactly. Checked here rather
       * than trusted: a gap or an overlap would mean some instant was
       * counted twice or not at all, and either makes every span figure
       * below meaningless.
       */
      admissibleSec: total(plan.admissible),
      excludedSec: excludedTotal,
      boundarySec: boundaryTotal,
      unprocessedSec: unprocessedTotal,
      requestSec: requestSpan,
      /**
       * The four classes tile the request. Computed from the SAME lists
       * this object publishes -- an earlier version summed
       * `plan.unprocessed` while printing an `unprocessed` that also held
       * unsearched admissible spans, so it could not see the overlap it
       * existed to catch.
       */
      coversRequestExactly: Math.abs(
        total(plan.admissible) + excludedTotal + boundaryTotal + unprocessedTotal - requestSpan,
      ) <= 1e-6,
      excluded: plan.excluded,
      boundary: plan.boundary,
      unprocessed,
      unresolved,
      excludedNote: 'Spans this profile DECLINES to answer for. Not empty spans: a crossing inside one is neither found nor ruled out.',
      boundaryNote: 'Spans whose admissibility was not established at the declared tolerance. The transition lies in here. Events found in them are reported with eligibility not established.',
      unprocessedNote: 'Spans the PARTITION never classified, because its budget ran out or the caller cancelled. NOT excluded and NOT searched-and-empty. One of the four classes that tile the request.',
      /**
       * A SECOND axis, deliberately not one of the four classes.
       * Classified -- so the domain is known here -- and then never
       * searched, because the budget ran out or the caller cancelled
       * before this span's turn.
       */
      notSearched: mergeSpanList(notSearched),
      notSearchedSec: notSearchedTotal,
      notSearchedNote: 'Spans whose DOMAIN is known and whose crossings were never looked for. They still belong to their class above; this is not a fifth class and is not part of the tiling.',
      /**
       * A SECOND axis, deliberately not one of the four classes above.
       * Those tile the request and answer "what is the domain here"; this
       * one answers "how far did the examination get", and an interval
       * can be admissible and under-examined at once.
       */
      admissibleNotFullyExamined: mergeSpanList(notFullyExamined),
      admissibleNotFullyExaminedSec: total(notFullyExamined),
      admissibleNotFullyExaminedNote: 'Proved admissible, searched, and the search did not finish. Still admissible; not exhaustively searched. Not part of the four-class tiling of the request.',
    },
    execution: {
      status,
      finished: status === 'finished',
      reason,
      evaluations: evaluationsUsed,
      cells: cellsUsed,
      maxEvaluations,
      partitionEvaluations,
      searchEvaluations,
      partitionReused,
      /**
       * True when the plan did not come from this runtime in this
       * process: its verdicts were taken on the caller's authority after
       * a structural check, not proved here.
       */
      planImported,
      partitionEvaluationsNote: 'A reused plan costs nothing here; it was charged to the request that built it.',
      budgetNote: 'One allowance for the whole request: partitioning plus every subsearch. A subsearch is given what is left, never a fresh copy.',
    },
    spanResults,
    diagnostics: {
      profile: DEFLECTION_PROFILE,
      partitionIndependentOfLongitude: true,
      partitionIndependentOfLongitudeBecause: 'partitionDomain never receives a target longitude; the independence is structural, not asserted',
      admissibleFraction: requestSpan > 0 ? total(plan.admissible) / requestSpan : null,
      excludedFraction: requestSpan > 0 ? excludedTotal / requestSpan : null,
      boundaryFraction: requestSpan > 0 ? boundaryTotal / requestSpan : null,
      requestSpanDays: requestSpan / DAY,
    },
  };
}
