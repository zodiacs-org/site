import { describe, expect, it } from 'vitest';
import { createJournalEntry, emptyStore, LensConflictError, updateJournalEntry } from './storage';
import { estimateRisk } from './risk';
import { applyReview, buildReview, describeReview, formatR, groupOf, hindsightFlags, horizonEnd, LEDGER_GROUPS, LEDGER_MIN_GRADED, openedAt, planAtOpen, PLAN_GRACE_MS, resultR, reviewDue, roundR, summarizeLedger, windowStart } from './ledger';
import type { JournalEntry, PlanReview, SetupPlan, TimingRole } from './types';

const H = 3_600_000;
const START = '2026-10-01T00:00:00.000Z';
const at = (hours: number) => new Date(Date.parse(START) + hours * H).toISOString();
const risk = { equity: 10_000, riskMode: 'percent' as const, riskValue: 1, entry: 100, stop: 95, feeBps: 10, slippageBps: 5 };
const setup = (entryAt?: string, overrides: Partial<SetupPlan['risk']> = {}): SetupPlan => ({ interval: '1d', technicalSetup: 'Retest of support', confirmation: 'Close above 100', invalidation: 'Close below 95', risk: { ...risk, ...overrides }, ...(entryAt ? { entryAt } : {}) });

function plan(id: string, options: { method?: JournalEntry['method']; role?: TimingRole; horizon?: number; created?: string; entryAt?: string } = {}): JournalEntry {
  const method = options.method ?? 'TA + astrology';
  return createJournalEntry({ instrument: 'BTC-USD', eventIds: [], horizonHours: options.horizon ?? 24, method, hypothesis: 'Support holds', plan: 'Buy the retest', outcome: '', setup: setup(options.entryAt), ...(method === 'TA + astrology' && options.role ? { timingRole: options.role } : {}) }, { at: options.created ?? START, id });
}
const reviewed = (entry: JournalEntry, review: PlanReview, hours = 48) => updateJournalEntry(entry, { review }, { at: at(hours) });
const kinds = (entry: JournalEntry) => hindsightFlags(entry).map(flag => `${flag.kind}@${flag.at}`);

describe('plan windows', () => {
  it('opens at the planned entry when present, otherwise at the save time', () => {
    expect(windowStart(plan('a'))).toBe(Date.parse(START));
    expect(horizonEnd(plan('a'))).toBe(Date.parse(START) + 24 * H);
    const scheduled = plan('b', { entryAt: at(10), horizon: 72 });
    expect(windowStart(scheduled)).toBe(Date.parse(at(10)));
    expect(horizonEnd(scheduled)).toBe(Date.parse(at(82)));
  });

  it('is due for review once the horizon has passed and until a review exists', () => {
    const entry = plan('a');
    expect(reviewDue(entry, Date.parse(at(23)))).toBe(false);
    expect(reviewDue(entry, Date.parse(at(24)))).toBe(true);
    expect(reviewDue(reviewed(entry, { status: 'not-triggered' }), Date.parse(at(60)))).toBe(false);
  });

  it('lets a revision saved before the window opens move the entry, but not one saved after', () => {
    const postponed = updateJournalEntry(plan('a', { entryAt: at(10) }), { setup: setup(at(40)) }, { at: at(5) });
    expect(openedAt(postponed)).toBe(Date.parse(at(40)));
    const moved = updateJournalEntry(plan('b', { entryAt: at(2) }), { setup: setup(at(40)) }, { at: at(30) });
    expect(openedAt(moved)).toBe(Date.parse(at(2)));
    expect(windowStart(moved)).toBe(Date.parse(at(40)));
  });

  it('takes 1 R from the setup in force when the window opened', () => {
    let entry = plan('a', { entryAt: at(10) });
    entry = updateJournalEntry(entry, { setup: setup(at(10), { stop: 97 }) }, { at: at(5) });
    entry = updateJournalEntry(entry, { setup: setup(at(10), { stop: 99 }) }, { at: at(12) });
    expect(planAtOpen(entry)?.risk.stop).toBe(97);
    expect(entry.setup?.risk.stop).toBe(99);
  });
});

describe('hindsight flags', () => {
  it('allows plan changes until shortly after the window opens, and review notes at any time', () => {
    let entry = plan('a', { entryAt: at(10) });
    entry = updateJournalEntry(entry, { plan: 'Buy the retest; smaller size' }, { at: at(5) });
    entry = updateJournalEntry(entry, { hypothesis: 'Support holds into the open' }, { at: new Date(Date.parse(at(10)) + PLAN_GRACE_MS - 1).toISOString() });
    entry = updateJournalEntry(entry, { review: { status: 'stop', exit: 95, r: -1 }, outcome: 'Late entry.' }, { at: at(40) });
    entry = updateJournalEntry(entry, { outcome: 'Late entry; respected the stop.' }, { at: at(41) });
    expect(hindsightFlags(entry)).toEqual([]);
  });

  it('flags plan changes after the window opened and after review', () => {
    const open = updateJournalEntry(plan('a'), { plan: 'Buy the retest; stop was always 90' }, { at: at(1) });
    expect(kinds(open)).toEqual([`edited-after-open@${at(1)}`]);
    const afterReview = updateJournalEntry(reviewed(plan('b', { entryAt: at(20), horizon: 72 }), { status: 'skipped' }, 10), { hypothesis: 'Expected a fake-out' }, { at: at(11) });
    expect(kinds(afterReview)).toEqual([`edited-after-review@${at(11)}`]);
  });

  it('flags a plan saved after its planned entry, beyond the grace period', () => {
    expect(kinds(plan('a', { entryAt: at(-1) }))).toEqual([`recorded-late@${START}`]);
    expect(hindsightFlags(plan('b', { entryAt: new Date(Date.parse(START) - PLAN_GRACE_MS + 60_000).toISOString() }))).toEqual([]);
  });

  it('cannot escape by moving the entry once the window is open, or by backdating it', () => {
    const moved = updateJournalEntry(plan('a', { entryAt: at(2) }), { setup: setup(at(40)) }, { at: at(30) });
    expect(kinds(moved)).toEqual([`edited-after-open@${at(30)}`]);
    const backdated = updateJournalEntry(plan('b', { entryAt: at(48) }), { setup: setup(at(2)) }, { at: at(24) });
    expect(kinds(backdated)).toEqual([`edited-after-open@${at(24)}`]);
  });
});

describe('results in R', () => {
  it('matches the sizing estimate: the planned stop is −1 R and the target is the net reward : risk', () => {
    expect(resultR(risk, 95)).toBeCloseTo(-1, 12);
    expect(resultR(risk, 120)).toBeCloseTo(estimateRisk({ ...risk, target: 120 }).rewardRisk!, 12);
    expect(resultR(risk, 100)!).toBeLessThan(0);
    const fx = { instrumentId: 'FX:USD/JPY', currency: 'JPY', funding: 'cash' as const, equity: 1_000_000, riskMode: 'percent' as const, riskValue: 1, entry: 150, stop: 149, feeBps: 10, slippageBps: 5 };
    expect(resultR(fx, 149)).toBeCloseTo(-1, 12);
    expect(resultR(fx, 153)).toBeCloseTo(estimateRisk({ ...fx, target: 153 }).rewardRisk!, 12);
  });

  it('returns nothing for unusable prices or plans', () => {
    expect(resultR(risk, 0)).toBeNull();
    expect(resultR(risk, Number.NaN)).toBeNull();
    expect(resultR({ ...risk, stop: 101 }, 105)).toBeNull();
    expect(roundR(-0.004)).toBe(0);
    expect(roundR(1.236)).toBe(1.24);
  });
});

describe('ledger summary', () => {
  it('grades saved setups only; journal notes without a setup are never due or counted', () => {
    const note = createJournalEntry({ instrument: 'BTC-USD', eventIds: [], horizonHours: 24, method: 'TA only', hypothesis: 'Watching', plan: 'No trade yet', outcome: '' }, { at: START, id: 'note' });
    expect(reviewDue(note, Date.parse(at(100)))).toBe(false);
    const summary = summarizeLedger([note, plan('a', { method: 'TA only' })], Date.parse(at(100)));
    expect(summary.groups.find(group => group.key === 'ta')!.plans).toBe(1);
    expect(summary.due.map(entry => entry.id)).toEqual(['a']);
  });

  it('groups plans by method and fixed timing answer', () => {
    expect(groupOf(plan('a', { method: 'TA only' }))).toBe('ta');
    expect(groupOf(plan('b', { role: 'initiated' }))).toBe('timing-initiated');
    expect(groupOf(plan('c', { role: 'smaller' }))).toBe('timing-smaller');
    expect(groupOf(plan('d'))).toBe('timing-unrecorded');
    expect(LEDGER_GROUPS.map(group => group.label)).toEqual(['TA only', 'Timing changed nothing', 'Timing raised size', 'Timing cut size', 'Timing started the trade', 'Timing vetoed the trade', 'Timing answer not recorded']);
  });

  it('counts reviews, grades results, keeps would-have results apart and withholds flagged plans', () => {
    const entries = [
      reviewed(plan('a', { method: 'TA only' }), { status: 'target', exit: 120, r: 2, followedPlan: true }),
      reviewed(plan('b', { method: 'TA only' }), { status: 'stop', r: -1, followedPlan: false }),
      reviewed(plan('c', { method: 'TA only' }), { status: 'not-triggered' }),
      reviewed(plan('d', { method: 'TA only' }), { status: 'manual-exit' }),
      updateJournalEntry(reviewed(plan('e', { method: 'TA only' }), { status: 'target', r: 3 }), { plan: 'Rewritten after the fact' }, { at: at(50) }),
      reviewed(plan('f', { role: 'veto' }), { status: 'skipped', exit: 92, r: -1.5 }),
      reviewed(plan('h', { role: 'veto' }), { status: 'skipped' }),
      plan('g', { role: 'larger' }),
    ];
    const summary = summarizeLedger(entries, Date.parse(at(100)));
    const ta = summary.groups.find(group => group.key === 'ta')!;
    expect(ta).toMatchObject({ plans: 5, reviewed: 5, taken: 4, graded: 2, notTriggered: 1, withheld: 1, followed: 1, followedKnown: 2, medianR: 0.5, meanR: 0.5, positiveShare: 0.5, values: [-1, 2] });
    const veto = summary.groups.find(group => group.key === 'timing-veto')!;
    expect(veto).toMatchObject({ plans: 2, passed: 2, taken: 0, graded: 0, medianR: null });
    expect(veto.passedStats).toMatchObject({ graded: 1, values: [-1.5] });
    expect(summary.due.map(entry => entry.id)).toEqual(['g']);
    expect(summary.flagged.map(row => row.entry.id)).toEqual(['e']);
    expect(summary.comparison.ready).toBe(false);
    expect(summary.vetoes).toMatchObject({ ready: false, vetoed: { graded: 1 } });
  });

  it('opens each comparison only when both sides reach the minimum number of graded plans', () => {
    const make = (count: number, method: JournalEntry['method'], role: TimingRole | undefined, review: PlanReview) => Array.from({ length: count }, (_, i) => reviewed(plan(`${method === 'TA only' ? 'ta' : 'timing'}-${role ?? 'none'}-${review.status}-${i}`, { method, role }), review));
    const almost = [...make(LEDGER_MIN_GRADED, 'TA only', undefined, { status: 'target', r: 1 }), ...make(LEDGER_MIN_GRADED - 1, 'TA + astrology', 'initiated', { status: 'target', r: 2 })];
    expect(summarizeLedger(almost, Date.parse(at(100))).comparison.ready).toBe(false);
    const ready = [...almost, ...make(1, 'TA + astrology', 'larger', { status: 'stop', r: -1 }), ...make(1, 'TA + astrology', 'smaller', { status: 'stop', r: -1 })];
    const { comparison, vetoes } = summarizeLedger(ready, Date.parse(at(100)));
    expect(comparison.ready).toBe(true);
    expect(comparison.ta).toMatchObject({ graded: 20, medianR: 1 });
    expect(comparison.timing.graded).toBe(20);
    expect(comparison.timing.medianR).toBe(2);
    expect(comparison.timing.meanR).toBeCloseTo((19 * 2 - 1) / 20, 10);
    expect(vetoes.ready).toBe(false);
    const withVetoes = summarizeLedger([...ready, ...make(LEDGER_MIN_GRADED, 'TA + astrology', 'veto', { status: 'skipped', r: -0.5 })], Date.parse(at(100))).vetoes;
    expect(withVetoes).toMatchObject({ ready: true, vetoed: { graded: 20, medianR: -0.5 } });
  });
});

describe('review input', () => {
  it('builds reviews in stored key order and keeps fields to the outcomes they describe', () => {
    expect(JSON.stringify(buildReview('target', '120', ' 2.5 ', 'yes'))).toBe('{"status":"target","exit":120,"r":2.5,"followedPlan":true}');
    expect(buildReview('stop', '', '', '')).toEqual({ status: 'stop' });
    expect(buildReview('skipped', '92', '-1.5', 'yes')).toEqual({ status: 'skipped', exit: 92, r: -1.5 });
    expect(buildReview('not-triggered', '92', '3', 'no')).toEqual({ status: 'not-triggered' });
    expect(() => buildReview('target', 'two', '', '')).toThrow('positive price');
    expect(() => buildReview('target', '', '150', '')).toThrow('R multiple');
    expect(() => buildReview('manual-exit', '104', '', '')).toThrow('no R result');
  });

  it('describes reviews in plain words and formats R with true minus signs', () => {
    expect(describeReview({ status: 'manual-exit', exit: 104.2, r: 0.62, followedPlan: true })).toBe('Closed early by hand, exit 104.2, +0.62 R, followed the plan');
    expect(describeReview({ status: 'skipped', exit: 92, r: -1.5 })).toBe('Passed on it, would have exited 92, would-have −1.50 R');
    expect(describeReview({ status: 'not-triggered' })).toBe('Confirmation never came');
    expect(formatR(-1)).toBe('−1.00 R');
    expect(formatR(2.5)).toBe('+2.50 R');
    expect(formatR(null)).toBe('—');
  });

  it('applies a review against the version the reviewer saw', () => {
    const entry = plan('a');
    const store = { ...emptyStore(), entries: [entry] };
    const next = applyReview(store, { id: 'a', baseUpdatedAt: entry.updatedAt, review: { status: 'time-exit', exit: 102, r: 0.4 }, outcome: 'Closed at the horizon.' });
    expect(next.entries[0].review).toEqual({ status: 'time-exit', exit: 102, r: 0.4 });
    expect(next.entries[0].outcome).toBe('Closed at the horizon.');
    expect(next.entries[0].revisions).toHaveLength(2);
    expect(hindsightFlags(next.entries[0])).toEqual([]);
    expect(() => applyReview(next, { id: 'a', baseUpdatedAt: entry.updatedAt, review: { status: 'stop', r: -1 }, outcome: '' })).toThrow(LensConflictError);
    expect(() => applyReview(store, { id: 'missing', baseUpdatedAt: entry.updatedAt, review: { status: 'stop' }, outcome: '' })).toThrow('deleted in another tab');
  });
});
