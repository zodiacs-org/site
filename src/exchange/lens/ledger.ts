import type { JournalEntry, JournalRevision, PlanReview, ReviewStatus, SetupPlan, TimingRole } from './types';
import { INSTRUMENTS } from './catalog';
import { estimateRisk } from './risk';
import { LensConflictError, TAKEN_REVIEW_STATUSES, updateJournalEntry, type LensStore } from './storage';

export interface ReviewInput { id: string; baseUpdatedAt: string; review: PlanReview; outcome: string }

/** Store mutation for one review; it becomes a new revision, never an overwrite. */
export function applyReview(current: LensStore, input: ReviewInput): LensStore {
  const entry = current.entries.find(candidate => candidate.id === input.id);
  if (!entry) throw new Error('This plan was deleted in another tab. The review was not saved.');
  if (entry.updatedAt !== input.baseUpdatedAt) throw new LensConflictError();
  return { ...current, entries: current.entries.map(candidate => candidate.id === input.id ? updateJournalEntry(candidate, { review: input.review, outcome: input.outcome }) : candidate) };
}

/** Comparisons stay closed until both sides have this many graded plans. */
export const LEDGER_MIN_GRADED = 20;
/** Below this, a group shows counts and dots but no R statistics. */
export const LEDGER_MIN_SUMMARY = 5;
/** Changes this soon after the window opens still count as part of the plan. */
export const PLAN_GRACE_MS = 15 * 60_000;

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  'not-triggered': 'Confirmation never came',
  skipped: 'Passed on it',
  target: 'Target reached',
  stop: 'Stopped out',
  'time-exit': 'Closed at the horizon',
  'manual-exit': 'Closed early by hand',
};

export const TIMING_ROLE_LABELS: Record<TimingRole, string> = {
  none: 'Nothing; I would take this trade the same way without it',
  larger: 'My size; I am trading larger because of it',
  smaller: 'My size; I am trading smaller because of it',
  initiated: 'The decision; I would not take this trade without it',
  veto: 'The decision; it is why I am passing on this trade',
};
export const TIMING_ROLE_SHORT: Record<TimingRole, string> = { none: 'changed nothing', larger: 'raised size', smaller: 'cut size', initiated: 'started the trade', veto: 'vetoed the trade' };

export type LedgerGroupKey = 'ta' | `timing-${TimingRole}` | 'timing-unrecorded';
export const LEDGER_GROUPS: { key: LedgerGroupKey; label: string }[] = [
  { key: 'ta', label: 'TA only' },
  ...(Object.keys(TIMING_ROLE_SHORT) as TimingRole[]).map(role => ({ key: `timing-${role}` as LedgerGroupKey, label: `Timing ${TIMING_ROLE_SHORT[role]}` })),
  { key: 'timing-unrecorded', label: 'Timing answer not recorded' },
];

export const isTaken = (review?: PlanReview): boolean => Boolean(review && TAKEN_REVIEW_STATUSES.includes(review.status));

export function groupOf(entry: JournalEntry): LedgerGroupKey {
  if (entry.method === 'TA only') return 'ta';
  return entry.timingRole ? `timing-${entry.timingRole}` : 'timing-unrecorded';
}

const entryOf = (revision: JournalRevision | undefined, createdAt: string) => Date.parse(revision?.setup?.entryAt ?? createdAt);

/** The window opens at the current planned entry, or when the plan was first saved. */
export function windowStart(entry: Pick<JournalEntry, 'createdAt' | 'setup'>): number {
  return Date.parse(entry.setup?.entryAt ?? entry.createdAt);
}
export function horizonEnd(entry: Pick<JournalEntry, 'createdAt' | 'setup' | 'horizonHours'>): number {
  return windowStart(entry) + entry.horizonHours * 3_600_000;
}
/** Only saved setups are graded: an R result needs the planned entry and stop. */
export const isPlan = (entry: JournalEntry): boolean => Boolean(entry.setup);
export function reviewDue(entry: JournalEntry, now: number): boolean {
  return isPlan(entry) && !entry.review && horizonEnd(entry) <= now;
}

/**
 * When the window actually opened, revision by revision: a revision saved
 * before the window opened may move the planned entry; once it is open, later
 * revisions cannot move it again.
 */
export function openedAt(entry: JournalEntry): number {
  let open = entryOf(entry.revisions[0], entry.createdAt);
  for (const revision of entry.revisions.slice(1)) {
    if (Date.parse(revision.at) >= open + PLAN_GRACE_MS) break;
    open = entryOf(revision, entry.createdAt);
  }
  return open;
}

/** The setup in force when the window opened. Its stop defines 1 R. */
export function planAtOpen(entry: JournalEntry): SetupPlan | undefined {
  const cutoff = openedAt(entry) + PLAN_GRACE_MS;
  return (entry.revisions.filter(revision => Date.parse(revision.at) < cutoff).at(-1) ?? entry.revisions[0]).setup;
}

export type HindsightKind = 'recorded-late' | 'edited-after-open' | 'edited-after-review';
export interface HindsightFlag { kind: HindsightKind; at: string }
export const HINDSIGHT_LABELS: Record<HindsightKind, string> = {
  'recorded-late': 'saved after its planned entry',
  'edited-after-open': 'plan changed after the window opened',
  'edited-after-review': 'plan changed after review',
};

/**
 * Plans written or rewritten once the outcome could be known: saved after the
 * planned entry, or with the expectation, plan or setup changed after the
 * window opened or after review. Review notes may change at any time. Device
 * clocks are self-reported; this is a self-check, not an attestation.
 */
export function hindsightFlags(entry: JournalEntry): HindsightFlag[] {
  const flags: HindsightFlag[] = [];
  if (Date.parse(entry.createdAt) >= entryOf(entry.revisions[0], entry.createdAt) + PLAN_GRACE_MS) flags.push({ kind: 'recorded-late', at: entry.createdAt });
  const cutoff = openedAt(entry) + PLAN_GRACE_MS;
  const reviewedAt = entry.revisions.find(revision => revision.review)?.at;
  const planOf = (revision: JournalRevision) => JSON.stringify([revision.hypothesis, revision.plan, revision.setup ?? null]);
  entry.revisions.forEach((revision, index) => {
    if (index === 0 || planOf(revision) === planOf(entry.revisions[index - 1])) return;
    if (reviewedAt && Date.parse(revision.at) >= Date.parse(reviewedAt)) flags.push({ kind: 'edited-after-review', at: revision.at });
    else if (Date.parse(revision.at) >= cutoff) flags.push({ kind: 'edited-after-open', at: revision.at });
  });
  return flags;
}

/**
 * Result of exiting a long cash plan at `exit`, in multiples of its planned
 * loss at the stop. It uses the sizing estimate's fills, tick rounding, fees
 * and slippage, so the planned stop is −1 R and the planned target is the
 * plan's net reward : risk.
 */
export function resultR(risk: SetupPlan['risk'], exit: number): number | null {
  if (!Number.isFinite(exit) || exit <= 0 || exit > 1e12) return null;
  try { estimateRisk(risk); } catch { return null; }
  const tick = risk.instrumentId ? INSTRUMENTS[risk.instrumentId]?.tickSize : undefined;
  const round = (value: number, up: boolean) => tick ? Number(((up ? Math.ceil(value / tick - 1e-9) : Math.floor(value / tick + 1e-9)) * tick).toPrecision(14)) : value;
  const fee = risk.feeBps / 10_000, slip = risk.slippageBps / 10_000;
  const entryCost = round(risk.entry * (1 + slip), true) * (1 + fee);
  const loss = entryCost - round(risk.stop * (1 - slip), false) * (1 - fee);
  const r = (round(exit * (1 - slip), false) * (1 - fee) - entryCost) / loss;
  return loss > 0 && Number.isFinite(r) && Math.abs(r) <= 100 ? r : null;
}
export const roundR = (value: number): number => Math.round(value * 100) / 100 || 0;

export interface LedgerStats {
  graded: number;
  medianR: number | null;
  meanR: number | null;
  /** Share of graded results above zero. */
  positiveShare: number | null;
  /** Graded results, ascending. */
  values: number[];
}
export interface LedgerGroup extends LedgerStats {
  key: LedgerGroupKey;
  label: string;
  plans: number;
  reviewed: number;
  taken: number;
  /** Taken trades reviewed without an R result. */
  ungraded: number;
  notTriggered: number;
  passed: number;
  followed: number;
  followedKnown: number;
  /** Results left out of the figures because the plan carries a hindsight flag. */
  withheld: number;
  /** Would-have results of passed plans; never mixed with realized results. */
  passedStats: LedgerStats;
}
export interface LedgerSummary {
  groups: LedgerGroup[];
  due: JournalEntry[];
  flagged: { entry: JournalEntry; flags: HindsightFlag[] }[];
  /** TA-only trades against trades the timing pushed toward: raised size or started. */
  comparison: { ta: LedgerStats; timing: LedgerStats; ready: boolean };
  /** Would-have results of plans the timing vetoed, against TA-only trades. */
  vetoes: { ta: LedgerStats; vetoed: LedgerStats; ready: boolean };
}

export function rStats(values: number[]): LedgerStats {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return { graded: 0, medianR: null, meanR: null, positiveShare: null, values: [] };
  const middle = sorted.length >> 1;
  const medianR = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { graded: sorted.length, medianR, meanR: sorted.reduce((sum, value) => sum + value, 0) / sorted.length, positiveShare: sorted.filter(value => value > 0).length / sorted.length, values: sorted };
}

/** Descriptive summary of the trader's own saved setups; never a forecast. */
export function summarizeLedger(allEntries: JournalEntry[], now: number): LedgerSummary {
  const entries = allEntries.filter(isPlan);
  const flagged = entries.map(entry => ({ entry, flags: hindsightFlags(entry) })).filter(row => row.flags.length);
  const flaggedIds = new Set(flagged.map(row => row.entry.id));
  const realized = (entry: JournalEntry) => isTaken(entry.review) && typeof entry.review!.r === 'number';
  const wouldHave = (entry: JournalEntry) => entry.review?.status === 'skipped' && typeof entry.review.r === 'number';
  const rOf = (list: JournalEntry[]) => list.filter(entry => !flaggedIds.has(entry.id)).map(entry => entry.review!.r!);
  const groups = LEDGER_GROUPS.map(({ key, label }) => {
    const members = entries.filter(entry => groupOf(entry) === key);
    const taken = members.filter(entry => isTaken(entry.review));
    const known = taken.filter(entry => typeof entry.review!.followedPlan === 'boolean');
    return {
      key, label, plans: members.length,
      reviewed: members.filter(entry => entry.review).length,
      taken: taken.length,
      ungraded: taken.filter(entry => typeof entry.review!.r !== 'number').length,
      notTriggered: members.filter(entry => entry.review?.status === 'not-triggered').length,
      passed: members.filter(entry => entry.review?.status === 'skipped').length,
      followed: known.filter(entry => entry.review!.followedPlan).length,
      followedKnown: known.length,
      withheld: members.filter(entry => (realized(entry) || wouldHave(entry)) && flaggedIds.has(entry.id)).length,
      ...rStats(rOf(members.filter(realized))),
      passedStats: rStats(rOf(members.filter(wouldHave))),
    };
  });
  const byGroup = (keys: LedgerGroupKey[], test: (entry: JournalEntry) => boolean) => rStats(rOf(entries.filter(entry => keys.includes(groupOf(entry)) && test(entry))));
  const ta = byGroup(['ta'], realized);
  const timing = byGroup(['timing-larger', 'timing-initiated'], realized);
  const vetoed = byGroup(['timing-veto'], wouldHave);
  return {
    groups,
    due: entries.filter(entry => reviewDue(entry, now)).sort((a, b) => horizonEnd(a) - horizonEnd(b)),
    flagged,
    comparison: { ta, timing, ready: ta.graded >= LEDGER_MIN_GRADED && timing.graded >= LEDGER_MIN_GRADED },
    vetoes: { ta, vetoed, ready: ta.graded >= LEDGER_MIN_GRADED && vetoed.graded >= LEDGER_MIN_GRADED },
  };
}

/**
 * Builds a review in the stored key order, so an unchanged review never adds
 * a revision. A plan whose confirmation never came records nothing else; plan
 * adherence belongs only to trades that were taken.
 */
export function buildReview(status: ReviewStatus, exit: string, r: string, followedPlan: '' | 'yes' | 'no'): PlanReview {
  if (status === 'not-triggered') return { status };
  const exitValue = exit.trim() === '' ? undefined : Number(exit);
  if (exitValue !== undefined && (!Number.isFinite(exitValue) || exitValue <= 0 || exitValue > 1e12)) throw new Error('Enter the exit as a positive price.');
  const rValue = r.trim() === '' ? undefined : Number(r);
  if (rValue !== undefined && (!Number.isFinite(rValue) || rValue < -100 || rValue > 100)) throw new Error('Enter the result as an R multiple between −100 and 100, for example −1 or 2.5.');
  if (exitValue !== undefined && rValue === undefined) throw new Error('This exit price gives no R result for the plan. Check the price.');
  const taken = TAKEN_REVIEW_STATUSES.includes(status);
  return { status, ...(exitValue === undefined ? {} : { exit: exitValue }), ...(rValue === undefined ? {} : { r: rValue }), ...(taken && followedPlan ? { followedPlan: followedPlan === 'yes' } : {}) };
}

export const formatR = (value: number | null | undefined): string => value === null || value === undefined ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)} R`;

/** One line for a saved review, e.g. "Closed early by hand, exit 104.2, +0.62 R, followed the plan". */
export function describeReview(review: PlanReview): string {
  const would = review.status === 'skipped';
  return [REVIEW_LABELS[review.status],
    review.exit === undefined ? '' : `${would ? 'would have exited' : 'exit'} ${review.exit}`,
    review.r === undefined ? '' : `${would ? 'would-have ' : ''}${formatR(review.r)}`,
    review.followedPlan === undefined ? '' : review.followedPlan ? 'followed the plan' : 'did not follow the plan'].filter(Boolean).join(', ');
}
