import { useState } from 'preact/hooks';
import type { JournalEntry, ReviewStatus } from './types';
import { TAKEN_REVIEW_STATUSES } from './storage';
import { buildReview, formatR, planAtOpen, resultR, REVIEW_LABELS, roundR, type ReviewInput } from './ledger';

const TAKEN: ReviewStatus[] = ['target', 'stop', 'time-exit', 'manual-exit'];
const NOT_TAKEN: ReviewStatus[] = ['not-triggered', 'skipped'];

interface Props { entry: JournalEntry; onSave: (input: ReviewInput) => Promise<void>; onDone?: () => void }

export default function ReviewForm({ entry, onSave, onDone }: Props) {
  const plan = planAtOpen(entry);
  const currency = plan?.risk.currency ?? 'USD';
  const prefill = (value: ReviewStatus | '') => !plan ? '' : value === 'stop' ? String(plan.risk.stop) : value === 'target' && plan.risk.target !== undefined ? String(plan.risk.target) : '';
  const [status, setStatus] = useState<ReviewStatus | ''>(entry.review?.status ?? '');
  const [exit, setExit] = useState(entry.review?.exit === undefined ? '' : String(entry.review.exit));
  const [r, setR] = useState(entry.review?.r === undefined || entry.review.exit !== undefined ? '' : String(entry.review.r));
  const [followed, setFollowed] = useState<'' | 'yes' | 'no'>(entry.review?.followedPlan === undefined ? '' : entry.review.followedPlan ? 'yes' : 'no');
  const [note, setNote] = useState(entry.outcome);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const taken = status !== '' && TAKEN_REVIEW_STATUSES.includes(status);
  const result = taken || status === 'skipped';
  // With an exit price, R comes from the plan as it stood when the window opened.
  const computed = plan && exit.trim() ? resultR(plan.risk, Number(exit)) : null;
  const rText = exit.trim() ? computed === null ? '' : String(roundR(computed)) : r;
  const name = `review-status-${entry.id}`;
  function choose(next: ReviewStatus) {
    if (exit === '' || exit === prefill(status)) setExit(prefill(next));
    setStatus(next);
  }
  async function save(event: Event) {
    event.preventDefault();
    if (!status) { setError('Choose what happened to this plan.'); return; }
    let review;
    try { review = buildReview(status, result ? exit : '', result ? rText : '', taken ? followed : ''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Check the exit and R result.'); return; }
    setBusy(true); setError('');
    try { await onSave({ id: entry.id, baseUpdatedAt: entry.updatedAt, review, outcome: note.trim() }); onDone?.(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The review could not be saved.'); }
    finally { setBusy(false); }
  }
  const option = (value: ReviewStatus) => <label key={value} class={`lens-choice${status === value ? ' is-chosen' : ''}`}><input type="radio" name={name} value={value} checked={status === value} onChange={() => choose(value)} disabled={busy} />{REVIEW_LABELS[value]}</label>;
  return <form class="lens-review" onSubmit={save} data-testid="review-form" aria-busy={busy}>
    {plan && <p class="lens-muted lens-review-plan">Plan when the window opened: entry {plan.risk.entry} · stop {plan.risk.stop}{plan.risk.target === undefined ? '' : ` · target ${plan.risk.target}`} {currency}. Its stop is 1 R.</p>}
    <fieldset class="lens-choices"><legend>Traded</legend>{TAKEN.map(option)}</fieldset>
    <fieldset class="lens-choices"><legend>Not traded</legend>{NOT_TAKEN.map(option)}</fieldset>
    {result && <fieldset class="lens-review-result"><legend>{taken ? 'Result' : 'If you had taken it (optional)'}</legend>
      <label class="lens-field">{taken ? `Exit price (${currency})` : `Where it would have exited (${currency})`}
        <input type="number" step="any" min="0" inputMode="decimal" value={exit} onInput={event => setExit(event.currentTarget.value)} disabled={busy} data-testid="review-exit" />
      </label>
      <div class="lens-review-r">
        <label class="lens-field">Result in R
          <input type="number" step="any" min="-100" max="100" inputMode="decimal" value={rText} placeholder="−1 or 2.5" readOnly={Boolean(exit.trim())} onInput={event => setR(event.currentTarget.value)} disabled={busy} aria-describedby={`${name}-hint`} data-testid="review-r" />
        </label>
        <p id={`${name}-hint`} class="lens-muted" role="status">{exit.trim()
          ? computed === null ? 'This price gives no R result for the plan.' : `${formatR(computed)} from the plan's entry, stop, fees and slippage.`
          : taken ? 'Enter the exit price, or the result in R yourself if you scaled in or out.' : 'Would-have results stay apart from real trades in the ledger.'}</p>
      </div>
      {taken && <label class="lens-field">Did you follow the plan?
        <select value={followed} onChange={event => setFollowed(event.currentTarget.value as '' | 'yes' | 'no')} disabled={busy} data-testid="review-followed">
          <option value="">Not sure</option><option value="yes">Yes</option><option value="no">No</option>
        </select>
      </label>}
    </fieldset>}
    <label class="lens-field">What you noticed (optional)
      <textarea rows={2} maxLength={5000} value={note} onInput={event => setNote(event.currentTarget.value)} disabled={busy} placeholder="Execution, discipline, what you would repeat or avoid." data-testid="review-note" />
    </label>
    {error && <p class="lens-error" role="alert">{error}</p>}
    <div class="lens-inline">
      <button class="lens-button lens-button--primary" disabled={busy} data-testid="review-save">{busy ? 'Saving…' : 'Save review'}</button>
      {onDone && <button type="button" class="lens-button lens-button--quiet" onClick={onDone} disabled={busy}>Cancel</button>}
    </div>
  </form>;
}
