import { useEffect, useState } from 'preact/hooks';
import type { InstrumentId, JournalEntry, SkyEvent } from './types';
import { estimateRisk } from './risk';
import { formatEventDate, formatEventTime } from './events';

type JournalInput = {
  id?: string;
  baseUpdatedAt?: string;
  instrument: InstrumentId;
  hypothesis: string;
  plan: string;
  outcome: string;
  horizonHours: number;
  method: JournalEntry['method'];
  eventIds: string[];
};

export interface JournalPanelProps {
  entries: JournalEntry[];
  instrument: InstrumentId;
  selectedEvent: SkyEvent | null;
  timeZone: string;
  onSave: (input: JournalInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
  storageError: string | null;
  personalSourceKey: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The journal could not be updated. Please try again.';
}

export default function JournalPanel({ entries, instrument, selectedEvent, timeZone, onSave, onDelete, onExport, onImport, storageError, personalSourceKey }: JournalPanelProps) {
  const timestamp = (value: string) => `${formatEventDate(value, timeZone)} · ${formatEventTime(value, timeZone)}`;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | undefined>();
  const [hypothesis, setHypothesis] = useState('');
  const [plan, setPlan] = useState('');
  const [outcome, setOutcome] = useState('');
  const [horizon, setHorizon] = useState('24');
  const [method, setMethod] = useState<JournalEntry['method']>('TA + astrology');
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  function resetDraft() {
    setEditingId(null);
    setBaseUpdatedAt(undefined);
    setHypothesis('');
    setPlan('');
    setOutcome('');
    setHorizon('24');
    setMethod('TA + astrology');
    setEventIds([]);
  }

  useEffect(() => {
    resetDraft();
    setError(null);
    setMessage('');
  }, [instrument]);

  useEffect(() => {
    setEventIds(ids => ids.filter(id => !id.startsWith('personal:')));
  }, [personalSourceKey]);

  const visibleEntries = entries.filter(entry => entry.instrument === instrument)
    .slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  async function save(event: Event) {
    event.preventDefault();
    const horizonHours = Number(horizon);
    if (!hypothesis.trim() || !plan.trim()) {
      setError('Write your expectation and trading plan before saving.');
      return;
    }
    if (!Number.isInteger(horizonHours) || horizonHours < 1 || horizonHours > 8760) {
      setError('Choose a whole-number time horizon between 1 and 8,760 hours.');
      return;
    }
    setPending(true);
    setError(null);
    setMessage('');
    try {
      await onSave({
        ...(editingId ? { id: editingId } : {}),
        ...(editingId ? { baseUpdatedAt } : {}),
        instrument,
        hypothesis: hypothesis.trim(),
        plan: plan.trim(),
        outcome: outcome.trim(),
        horizonHours,
        method,
        eventIds,
      });
      const wasEditing = Boolean(editingId);
      resetDraft();
      setMessage(wasEditing ? 'Journal updated. The earlier version is retained.' : 'Journal entry saved on this device.');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  function edit(entry: JournalEntry) {
    setEditingId(entry.id);
    setBaseUpdatedAt(entry.updatedAt);
    setHypothesis(entry.hypothesis);
    setPlan(entry.plan);
    setOutcome(entry.outcome);
    setHorizon(String(entry.horizonHours));
    setMethod(entry.method);
    setEventIds([...entry.eventIds]);
    setError(null);
    setMessage('Editing this entry. Saving retains its earlier version.');
    document.getElementById('lens-journal-hypothesis')?.focus();
  }

  async function remove(id: string) {
    setPending(true);
    setError(null);
    setMessage('');
    try {
      await onDelete(id);
      if (editingId === id) resetDraft();
      setMessage('Journal entry deleted from this device.');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  async function importFile(file: File) {
    setPending(true);
    setError(null);
    setMessage('');
    try {
      await onImport(file);
      setMessage('Journal imported.');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  function exportEntries() {
    setError(null);
    try {
      onExport();
      setMessage('Journal export downloaded.');
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  return (
    <section class="lens-panel" aria-labelledby="lens-journal-heading" data-testid="lens-journal">
      <div class="lens-inline">
        <h2 id="lens-journal-heading" class="lens-section-title">Trading journal</h2>
        <button type="button" class="lens-button lens-button--quiet" onClick={exportEntries} disabled={pending || entries.length === 0} data-testid="journal-export">Export journal</button>
      </div>
      <p class="lens-muted">Record your expectation before a trade, then return to review the outcome. Entries stay on this device. Export a copy to keep a backup.</p>
      {(error || storageError) && <p class="lens-error" role="alert">{error || storageError}</p>}
      <p role="status" aria-live="polite" class="lens-muted">{message}</p>
      <form class="lens-form" onSubmit={save} data-testid="journal-form" aria-busy={pending}>
        <p class="lens-muted">{editingId ? 'Edit entry' : 'New entry'} · {instrument}</p>
        <div class="lens-inline">
          <label class="lens-field" for="lens-journal-method">Setup method
            <select id="lens-journal-method" value={method} onChange={event => setMethod(event.currentTarget.value as JournalEntry['method'])} disabled={pending || Boolean(editingId)} data-testid="journal-method">
              <option value="TA + astrology">TA + astrology</option>
              <option value="TA only">TA only</option>
            </select>
          </label>
          <label class="lens-field" for="lens-journal-horizon">Time horizon (hours)
            <input id="lens-journal-horizon" type="number" min="1" max="8760" step="1" required value={horizon} onInput={event => setHorizon(event.currentTarget.value)} disabled={pending || Boolean(editingId)} data-testid="journal-horizon" />
          </label>
        </div>
        {editingId && <p class="lens-muted">The original method, time horizon, and attached events are preserved with this entry. <button type="button" class="lens-text-button" disabled={pending} onClick={() => setEditingId(null)}>Save as new entry</button></p>}
        <label class="lens-field" for="lens-journal-hypothesis">Expectation before the trade
          <textarea id="lens-journal-hypothesis" rows={3} required maxLength={5000} value={hypothesis} onInput={event => setHypothesis(event.currentTarget.value)} disabled={pending} placeholder="What do you expect, and over what period?" data-testid="journal-hypothesis" />
        </label>
        <label class="lens-field" for="lens-journal-plan">Trading plan
          <textarea id="lens-journal-plan" rows={3} required maxLength={5000} value={plan} onInput={event => setPlan(event.currentTarget.value)} disabled={pending} placeholder="Entry condition, invalidation level, and the rules you will follow." data-testid="journal-plan" />
        </label>
        <label class="lens-field" for="lens-journal-outcome">Outcome and review (optional)
          <textarea id="lens-journal-outcome" rows={3} maxLength={5000} value={outcome} onInput={event => setOutcome(event.currentTarget.value)} disabled={pending} placeholder="Return after the trade to record what happened and how you executed." data-testid="journal-outcome" />
        </label>
        {selectedEvent ? (
          <label class="lens-inline" for="lens-journal-attach-event">
            <input id="lens-journal-attach-event" type="checkbox" checked={eventIds.includes(selectedEvent.id)} disabled={pending || Boolean(editingId)} onChange={event => setEventIds(event.currentTarget.checked ? [...new Set([...eventIds, selectedEvent.id])] : eventIds.filter(id => id !== selectedEvent.id))} data-testid="journal-attach-event" />
            Attach selected event: {selectedEvent.title}
          </label>
        ) : <p class="lens-muted">Select a sky event to attach it to this entry.</p>}
        {eventIds.length > 0 && <div class="lens-list" aria-label="Attached sky events">{eventIds.map(id => <div key={id} class="lens-inline">
          <span class="lens-muted">{selectedEvent?.id === id ? selectedEvent.title : id}</span>
          <button class="lens-button lens-button--quiet" type="button" disabled={pending || Boolean(editingId)} onClick={() => setEventIds(eventIds.filter(eventId => eventId !== id))} aria-label={`Remove attached event ${selectedEvent?.id === id ? selectedEvent.title : id}`}>Remove</button>
        </div>)}</div>}
        <div class="lens-inline">
          <button class="lens-button lens-button--primary" type="submit" disabled={pending || Boolean(storageError)} data-testid="journal-save">{pending ? 'Saving…' : editingId ? 'Save revision' : 'Save entry'}</button>
          {editingId && <button class="lens-button lens-button--quiet" type="button" disabled={pending} onClick={() => { resetDraft(); setMessage(''); setError(null); }} data-testid="journal-cancel">Cancel edit</button>}
        </div>
      </form>
      <div class="lens-list" data-testid="journal-entries">
        <h3 class="lens-section-title">{instrument} entries ({visibleEntries.length})</h3>
        {visibleEntries.length === 0 && <p class="lens-muted">Your saved plans and reviews will appear here.</p>}
        {visibleEntries.map(entry => <article key={entry.id} class="lens-card" data-testid="journal-entry">
          <div class="lens-inline"><strong>{entry.method}</strong><span class="lens-muted">{entry.horizonHours} h horizon</span></div>
          <p class="lens-muted">Recorded <time dateTime={entry.createdAt}>{timestamp(entry.createdAt)}</time>{entry.updatedAt !== entry.createdAt && <> · Updated <time dateTime={entry.updatedAt}>{timestamp(entry.updatedAt)}</time></>}</p>
          <p><strong>Expectation</strong><br />{entry.hypothesis}</p>
          <p><strong>Plan</strong><br />{entry.plan}</p>
          {entry.setup && <details><summary>Saved setup / risk context</summary><p>Timeframe {entry.setup.interval} · {entry.setup.technicalSetup}<br />Confirmation: {entry.setup.confirmation}<br />Invalidation: {entry.setup.invalidation}<br />Entry ${entry.setup.risk.entry} · stop ${entry.setup.risk.stop} · target {entry.setup.risk.target ?? 'none'}<br />{estimateRisk(entry.setup.risk).units.toFixed(8)} units · ${estimateRisk(entry.setup.risk).stopLossUSD.toFixed(2)} estimated loss incl. costs · fees {entry.setup.risk.feeBps} bps and slippage {entry.setup.risk.slippageBps} bps per side</p>{entry.setup.window && <p>Associated {entry.setup.window.kind} window · {entry.setup.window.from} to {entry.setup.window.to}</p>}</details>}
          {entry.outcome ? <p><strong>Outcome</strong><br />{entry.outcome}</p> : <p class="lens-muted">Outcome not recorded yet.</p>}
          {entry.eventIds.length > 0 && <details><summary>{entry.eventIds.length} attached sky {entry.eventIds.length === 1 ? 'event' : 'events'}</summary><ul>{entry.eventIds.map(id => <li key={id}>{selectedEvent?.id === id ? selectedEvent.title : id}</li>)}</ul></details>}
          {entry.revisions.length > 1 && <details data-testid="journal-revisions">
            <summary>{entry.revisions.length - 1} earlier {entry.revisions.length === 2 ? 'version' : 'versions'}</summary>
            <div class="lens-list">{entry.revisions.slice(0, -1).map((revision, index) => <div class="lens-card" key={`${revision.at}-${index}`}>
              <p class="lens-muted"><time dateTime={revision.at}>{timestamp(revision.at)}</time></p>
              <p><strong>Expectation</strong><br />{revision.hypothesis}</p>
              <p><strong>Plan</strong><br />{revision.plan}</p>
              {revision.setup && <p>Saved risk version: entry ${revision.setup.risk.entry} · stop ${revision.setup.risk.stop} · risk {revision.setup.risk.riskValue} {revision.setup.risk.riskMode} · fees {revision.setup.risk.feeBps} / slippage {revision.setup.risk.slippageBps} bps per side. Confirmation: {revision.setup.confirmation}. Invalidation: {revision.setup.invalidation}.</p>}
              {revision.outcome && <p><strong>Outcome</strong><br />{revision.outcome}</p>}
            </div>)}</div>
          </details>}
          <div class="lens-inline">
            <button class="lens-button lens-button--quiet" type="button" disabled={pending} onClick={() => edit(entry)} data-testid="journal-edit" aria-label={`Edit journal entry from ${timestamp(entry.createdAt)}`}>Edit / add outcome</button>
            <button class="lens-button lens-button--quiet" type="button" disabled={pending} onClick={() => void remove(entry.id)} data-testid="journal-delete" aria-label={`Delete journal entry from ${timestamp(entry.createdAt)}`}>Delete entry</button>
          </div>
        </article>)}
      </div>
      <label class="lens-field" for="lens-journal-import">Import a journal backup
        <input id="lens-journal-import" type="file" accept="application/json,.json" disabled={pending || Boolean(storageError)} data-testid="journal-import" onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void importFile(file);
        }} />
      </label>
    </section>
  );
}
