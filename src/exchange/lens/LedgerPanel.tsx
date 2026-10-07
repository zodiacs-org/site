import { useState } from 'preact/hooks';
import type { JournalEntry } from './types';
import type { LensStore } from './storage';
import { applyReview, formatR, HINDSIGHT_LABELS, horizonEnd, LEDGER_MIN_GRADED, LEDGER_MIN_SUMMARY, PLAN_GRACE_MS, summarizeLedger, TIMING_ROLE_SHORT, type LedgerGroup, type LedgerStats, type ReviewInput } from './ledger';
import { formatMinute } from './window';
import ReviewForm from './ReviewForm';

interface Props {
  entries: JournalEntry[];
  timeZone: string;
  now: number;
  storageError: string | null;
  onUpdate: (mutate: (current: LensStore) => LensStore) => Promise<void>;
}

const percent = (value: number | null) => value === null ? '—' : `${Math.round(value * 100)}%`;
const firstLine = (text: string) => { const line = text.split('\n')[0]; return line.length > 110 ? `${line.slice(0, 107)}…` : line; };
const methodLabel = (entry: JournalEntry) => entry.method === 'TA only' ? 'TA only' : `TA + astrology, timing ${entry.timingRole ? TIMING_ROLE_SHORT[entry.timingRole] : 'answer not recorded'}`;
const statsLine = (stats: LedgerStats) => `median ${formatR(stats.medianR)}, mean ${formatR(stats.meanR)}, ${percent(stats.positiveShare)} above 0 R, across ${stats.graded}`;
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const axisLabel = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)} R`;
function countsLine(group: LedgerGroup): string {
  const parts = [group.taken && `${group.taken} traded`, group.ungraded && `${group.ungraded} without an R result`, group.notTriggered && `${group.notTriggered} without confirmation`, group.passed && `${group.passed} passed`, group.withheld && `${group.withheld} left out of the figures`].filter(Boolean);
  const followed = group.followedKnown ? ` Followed the plan ${group.followed} of ${group.followedKnown} times.` : '';
  return `${parts.length ? parts.join(', ') : group.reviewed ? 'Reviewed' : 'Not reviewed yet'}.${followed}`;
}

/** One row of results on the ledger's shared R axis. Hollow dots are would-have results of passed plans. */
function Dots({ values, wouldHave, domain }: { values: number[]; wouldHave: number[]; domain: [number, number] }) {
  if (!values.length && !wouldHave.length) return null;
  const [low, high] = domain;
  const x = (value: number) => (Math.min(high, Math.max(low, value)) - low) / (high - low) * 100;
  const placed: { left: number; lane: number; value: number; hollow: boolean }[] = [];
  for (const [value, hollow] of [...values.map(v => [v, false] as const), ...wouldHave.map(v => [v, true] as const)].sort((a, b) => a[0] - b[0])) {
    const left = x(value);
    let lane = 0;
    while (lane < 3 && placed.some(dot => dot.lane === lane && Math.abs(dot.left - left) < 3)) lane += 1;
    placed.push({ left, lane, value, hollow });
  }
  const lanes = Math.max(...placed.map(dot => dot.lane)) + 1;
  const label = `${values.length ? `Results: ${values.map(formatR).join(', ')}.` : ''}${wouldHave.length ? ` Would-have results: ${wouldHave.map(formatR).join(', ')}.` : ''}`.trim();
  return <div class="lens-dots-wrap">
    <div class="lens-dots" role="img" aria-label={label} style={{ height: `${10 + lanes * 10}px` }}>
      <span class="lens-dots-zero" style={{ left: `${x(0)}%` }} />
      {placed.map(dot => <span key={`${dot.value}-${dot.left}-${dot.lane}-${dot.hollow}`} class={`lens-dot${dot.hollow ? ' is-would-have' : ''}`} style={{ left: `${dot.left}%`, bottom: `${5 + dot.lane * 10}px` }} title={`${formatR(dot.value)}${dot.hollow ? ', would-have' : ''}`} />)}
    </div>
    <div class="lens-dots-axis" aria-hidden="true"><span>{axisLabel(low)}</span><span style={{ left: `${x(0)}%` }}>0</span><span>{axisLabel(high)}</span></div>
  </div>;
}

export default function LedgerPanel({ entries, timeZone, now, storageError, onUpdate }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const summary = summarizeLedger(entries, now);
  const save = (input: ReviewInput) => onUpdate(current => applyReview(current, input));
  const groups = summary.groups.filter(group => group.plans > 0);
  const upcoming = entries.filter(entry => entry.setup && !entry.review && horizonEnd(entry) > now).sort((a, b) => horizonEnd(a) - horizonEnd(b))[0];
  const withheld = summary.groups.reduce((sum, group) => sum + group.withheld, 0);
  const all = groups.flatMap(group => [...group.values, ...group.passedStats.values]);
  // One shared axis for every group, padded so no dot sits on an edge.
  const domain: [number, number] = [Math.max(-10, Math.min(-2, Math.floor(Math.min(...all, 0) - 0.5))), Math.min(20, Math.max(3, Math.ceil(Math.max(...all, 0) + 0.5)))];
  const { ta, timing, ready } = summary.comparison;
  const vetoGroup = summary.groups.find(group => group.key === 'timing-veto')!;
  return <section class="lens-panel lens-ledger" aria-labelledby="lens-ledger-heading" data-testid="lens-ledger">
    <h2 id="lens-ledger-heading">Plan ledger</h2>
    <p class="lens-muted">Grade each saved setup when its window closes. Over time the ledger compares your own results with and without timing. It describes your records; it does not forecast.</p>
    {storageError && <p class="lens-error" role="alert">{storageError}</p>}

    <h3>Ready for review{summary.due.length ? ` (${summary.due.length})` : ''}</h3>
    {summary.due.length === 0 && <p class="lens-muted">No plans are waiting for review.{upcoming && <> The next window closes {formatMinute(horizonEnd(upcoming), timeZone)}.</>}</p>}
    <div class="lens-list" data-testid="ledger-due">
      {summary.due.map(entry => <article key={entry.id} class={`lens-ledger-due${open === entry.id ? ' is-open' : ''}`}>
        <div class="lens-ledger-due-main">
          <p class="lens-ledger-plan"><strong>{entry.instrument}</strong> {firstLine(entry.setup?.technicalSetup || entry.plan)}</p>
          <p class="lens-muted">{methodLabel(entry)}. Window closed {formatMinute(horizonEnd(entry), timeZone)}.</p>
        </div>
        {open === entry.id ? <ReviewForm entry={entry} onSave={save} onDone={() => setOpen(null)} /> : <button type="button" class="lens-button" disabled={Boolean(storageError)} onClick={() => setOpen(entry.id)} data-testid="ledger-review">Review</button>}
      </article>)}
    </div>

    <h3>Your results by method</h3>
    {groups.length === 0 ? <p class="lens-muted">Save a setup in Setup &amp; risk. When its window closes it appears above for review, then here.</p> : <>
      <div class="lens-ledger-groups" data-testid="ledger-groups">
        {groups.map(group => <div key={group.key} class="lens-ledger-group" data-testid={`ledger-group-${group.key}`}>
          <div class="lens-ledger-group-head"><strong>{group.label}</strong><span>{plural(group.plans, 'plan')}, {group.reviewed} reviewed</span></div>
          <p class="lens-ledger-counts">{countsLine(group)}</p>
          {group.graded >= LEDGER_MIN_SUMMARY ? <p class="lens-ledger-stats">{statsLine(group)} trades.</p> : group.graded > 0 && <p class="lens-muted">R figures appear at {LEDGER_MIN_SUMMARY} trades with a result.</p>}
          {group.passedStats.graded > 0 && <p class="lens-muted">Would-have results of passed plans: {group.passedStats.graded >= LEDGER_MIN_SUMMARY ? `${statsLine(group.passedStats)} plans.` : `${group.passedStats.graded} recorded.`}</p>}
          <Dots values={group.values} wouldHave={group.passedStats.values} domain={domain} />
        </div>)}
      </div>
      <div class="lens-ledger-compare" data-testid="ledger-comparison">
        <h3>With and without timing</h3>
        {ready ? <>
          <p><strong>TA only:</strong> {statsLine(ta)} trades.</p>
          <p><strong>Timing raised size or started the trade:</strong> {statsLine(timing)} trades.</p>
        </> : <p class="lens-muted">This comparison opens at {LEDGER_MIN_GRADED} trades with an R result on each side. Now: TA only {ta.graded}; timing raised size or started the trade {timing.graded}.</p>}
        {vetoGroup.plans > 0 && (summary.vetoes.ready
          ? <p><strong>Plans the timing vetoed, had you taken them:</strong> {statsLine(summary.vetoes.vetoed)} plans.</p>
          : <p class="lens-muted">Timing vetoed {plural(vetoGroup.plans, 'plan')}; {vetoGroup.passedStats.graded} {vetoGroup.passedStats.graded === 1 ? 'has' : 'have'} a would-have result. Comparing vetoes with your TA-only trades opens at {LEDGER_MIN_GRADED} on each side.</p>)}
        {(ready || summary.vetoes.ready) && <p class="lens-muted">These are your own self-recorded, self-selected plans. A gap here is a reason to run a stricter, pre-registered test, not proof that timing works.</p>}
      </div>
    </>}

    {summary.flagged.length > 0 && <div class="lens-notice" data-testid="ledger-hindsight">
      {plural(summary.flagged.length, 'plan was', 'plans were')} written or changed once the outcome could be known{withheld ? `; ${plural(withheld, 'result is', 'results are')} left out of the figures above` : ''}. Set a planned entry to keep editing until the window opens, and add later thoughts as review notes.
      <ul>{summary.flagged.map(row => <li key={row.entry.id}>{row.entry.instrument}, saved {formatMinute(Date.parse(row.entry.createdAt), timeZone)}: {row.flags.map(flag => flag.kind === 'recorded-late' ? HINDSIGHT_LABELS[flag.kind] : `${HINDSIGHT_LABELS[flag.kind]} (${formatMinute(Date.parse(flag.at), timeZone)})`).join('; ')}</li>)}</ul>
    </div>}

    <details class="lens-method"><summary>How the ledger works</summary>
      <p>The ledger grades saved setups, because a result in R needs the planned entry and stop. A setup's window opens at its planned entry, or when it was first saved, and closes at the end of its horizon; then it is ready for review.</p>
      <p>1 R is the loss the plan accepted at its stop when the window opened, including the entered fees and slippage. An exit price gives the result in R from that plan, so the planned stop is −1 R and the planned target is the plan's net reward : risk.</p>
      <p>What the timing changed is fixed when a plan is saved, so it cannot drift toward the outcome. The plan itself can change until {PLAN_GRACE_MS / 60_000} minutes after its window opens. Plans saved after their planned entry, or changed later, are listed and left out of the figures.</p>
      <p>A passed plan can record where it would have exited. Those would-have results stay apart from real trades and show whether your vetoes skipped losers or winners.</p>
      <p>Everything here is self-recorded on this device, with this device's clock, and deleting a plan removes it from the figures. The ledger cannot show that timing predicts prices. It can show whether your own timing habits coincide with better or worse results.</p>
    </details>
  </section>;
}
