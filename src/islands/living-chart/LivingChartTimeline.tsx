import { useEffect, useRef, useState } from 'preact/hooks';
import '../../styles/living-chart.css';
import { useLivingChart } from '../../lib/hooks/useLivingChart';
import type { LivingMomentCategory, LivingMomentV1 } from '../../lib/living-chart/types';
import { trackAnalytics } from '../../lib/analytics';

const CATEGORY_LABELS: Record<LivingMomentCategory, string> = {
  work: 'Work',
  relationships: 'Relationships',
  home: 'Home',
  creativity: 'Creativity',
  change: 'Change',
  wellbeing: 'Wellbeing',
  other: 'Other',
};

const REFLECTION_QUESTIONS: Record<string, string> = {
  'reflection:focus.v1': 'What deserves your full attention, and what can wait?',
  'reflection:test-opening.v1': 'Which small opening is worth testing before you commit more?',
  'reflection:clear-step.v1': 'Where would one clear boundary or next step reduce friction?',
  'reflection:use-support.v1': 'What is already working that you could use more deliberately?',
  'reflection:name-needs.v1': 'Which two needs can you name before choosing between them?',
  'reflection:quiet-room.v1': 'What can you do with the extra room without inventing urgency?',
  'reflection:notice.v1': 'What stands out when you compare this theme with what actually happened?',
  'what-stood-out.v1': 'What stood out when you saved this moment?',
};

function momentDate(moment: LivingMomentV1): string {
  const dateOnly = moment.timePrecision === 'date_only';
  const date = new Date(dateOnly ? `${moment.occurredAt}T12:00:00.000Z` : moment.occurredAt);
  const options: Intl.DateTimeFormatOptions = dateOnly
    ? { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }
    : { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  const label = new Intl.DateTimeFormat('en', options).format(date);
  if (dateOnly) return `${label} · date only`;
  return moment.timePrecision === 'approximate' ? `Around ${label}` : label;
}

function downloadText(content: string, format: 'json' | 'markdown'): void {
  const blob = new Blob([content], {
    type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8',
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `living-chart-${new Date().toISOString().slice(0, 10)}.${format === 'json' ? 'json' : 'md'}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

interface Props {
  syncEnabled?: boolean;
  allowSyncGrant?: boolean;
}

export default function LivingChartTimeline({
  syncEnabled = false,
  allowSyncGrant = syncEnabled,
}: Props) {
  const {
    owner,
    moments,
    loading,
    ownerReady,
    update,
    remove,
    exportAs,
    syncStatus,
    syncConsent,
    guestImportCount,
    enableSync,
    withdrawSync,
    retrySync,
    resolveConflict,
    importGuestMoments,
  } = useLivingChart({ syncEnabled });
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editCategory, setEditCategory] = useState<LivingMomentCategory | ''>('');
  const [withdrawArmed, setWithdrawArmed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    trackAnalytics('living_chart_open', { source: 'profile' });
  }, []);

  const onDelete = async (id: string) => {
    if (deleteArmed !== id) {
      setDeleteArmed(id);
      return;
    }
    setBusy(id);
    setMessage('');
    const deleted = await remove(id);
    setBusy(null);
    setDeleteArmed(null);
    if (!deleted) {
      setMessage('That moment could not be deleted. Try again.');
      return;
    }
    trackAnalytics('living_chart_deleted');
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const onExport = async (format: 'json' | 'markdown') => {
    setBusy(`export-${format}`);
    setMessage('');
    const content = await exportAs(format);
    setBusy(null);
    if (!content) {
      setMessage('Your Living Chart could not be exported. Try again.');
      return;
    }
    trackAnalytics('living_chart_export', { format });
    downloadText(content, format);
  };

  const beginEdit = (moment: LivingMomentV1) => {
    setEditId(moment.id);
    setEditNote(moment.note ?? '');
    setEditCategory(moment.category ?? '');
    setMessage('');
  };

  const saveEdit = async (event: Event, id: string) => {
    event.preventDefault();
    if (!editNote.trim() && !editCategory) {
      setMessage('Add a note or choose a category.');
      return;
    }
    setBusy(id);
    const saved = await update(id, {
      note: editNote.trim() || undefined,
      category: editCategory || undefined,
    });
    setBusy(null);
    if (!saved) {
      setMessage('That edit could not be saved. Try again.');
      return;
    }
    setEditId(null);
  };

  const onWithdraw = async () => {
    if (!withdrawArmed) {
      setWithdrawArmed(true);
      return;
    }
    setBusy('withdraw');
    const withdrawn = await withdrawSync();
    setBusy(null);
    setWithdrawArmed(false);
    if (!withdrawn) setMessage('Sync could not be turned off safely. Retry from the sync status.');
  };

  const onEnable = async () => {
    setBusy('enable-sync');
    setMessage('');
    const enabled = await enableSync();
    setBusy(null);
    if (!enabled) setMessage('Sync could not be turned on. Your Living Chart is still saved on this device.');
  };

  const displayedSyncMessage = !allowSyncGrant
    && (syncConsent === 'pending' || syncConsent === 'withdrawn')
    ? 'Saved on this device.'
    : syncStatus.message;

  return (
    <section class="living-chart shell" id="living-chart" data-living-chart aria-labelledby="living-chart-heading">
      <div class="living-chart__core core">
        <header class="living-chart__head">
          <div>
            <h2 id="living-chart-heading" ref={headingRef} tabIndex={-1}>Living Chart</h2>
            <p>Your saved readings and observations, in date order. Open Today for a new reading, then return here to reflect on what you noticed.</p>
          </div>
          {syncEnabled && (
            <div class="living-chart__sync" data-living-chart-sync={syncStatus.phase}>
              <p role="status">{displayedSyncMessage}</p>
              {(syncStatus.phase === 'error' || syncStatus.phase === 'offline') && syncConsent === 'granted' && (
                <button class="living-chart__text-action" type="button" onClick={() => void retrySync()}>Retry sync</button>
              )}
              {allowSyncGrant
                && owner?.kind === 'account'
                && (syncConsent === 'pending' || syncConsent === 'withdrawn')
                && (
                <button class="living-chart__text-action" type="button" disabled={busy !== null || syncStatus.phase === 'checking' || syncStatus.phase === 'syncing'} onClick={() => void onEnable()}>
                  {busy === 'enable-sync' ? 'Turning on…' : 'Keep on every device'}
                </button>
              )}
              {allowSyncGrant && owner?.kind === 'guest' && (
                <a href="/profile/#profile-sync">Sign in to sync</a>
              )}
              {syncConsent === 'granted' && (
                <button class="living-chart__text-action living-chart__text-action--danger" type="button" disabled={busy !== null} onClick={() => void onWithdraw()}>
                  {busy === 'withdraw' ? 'Turning off…' : withdrawArmed ? 'Confirm: turn off sync' : 'Turn off sync'}
                </button>
              )}
            </div>
          )}
        </header>

        {syncEnabled && owner?.kind === 'account' && guestImportCount > 0 && (
          <aside class="living-chart__import" data-living-chart-import>
            <div>
              <strong>Bring over this browser’s earlier saves?</strong>
              <p>{guestImportCount} {guestImportCount === 1 ? 'moment was' : 'moments were'} saved before sign-in. Nothing moves unless you choose it.</p>
            </div>
            <button class="btn" type="button" disabled={busy !== null} onClick={() => void importGuestMoments()}>
              Import {guestImportCount === 1 ? 'moment' : 'moments'}
            </button>
          </aside>
        )}

        {loading ? (
          <p class="living-chart__status" role="status">Opening your Living Chart…</p>
        ) : !ownerReady ? (
          <p class="living-chart__status" role="alert">
            Living Chart storage is unavailable in this browser.
          </p>
        ) : moments.length === 0 ? (
          <div>
            <p class="living-chart__empty">
              No moments saved yet. Your first moment begins with a personal forecast in Today—no account setup needed.
              Markdown and JSON export appear here once a moment is saved.
            </p>
            <a class="btn btn--primary" href="/today/#save-moment">
              <span>Open Today</span><span class="orb" aria-hidden="true">→</span>
            </a>
          </div>
        ) : (
          <ol class="living-chart__list">
            {moments.map((moment) => (
              <li class="living-chart__entry" data-living-chart-entry key={moment.id}>
                <header class="living-chart__entry-head">
                  <time class="living-chart__entry-date" dateTime={moment.occurredAt}>{momentDate(moment)}</time>
                  {moment.category && <span class="living-chart__entry-category">{CATEGORY_LABELS[moment.category]}</span>}
                </header>
                {editId === moment.id ? (
                  <form class="living-chart__edit" onSubmit={(event) => void saveEdit(event, moment.id)}>
                    <label>
                      <span>What happened?</span>
                      <textarea maxLength={500} value={editNote} onInput={(event) => setEditNote((event.currentTarget as HTMLTextAreaElement).value)} />
                    </label>
                    <label>
                      <span>Part of life</span>
                      <select value={editCategory} onChange={(event) => setEditCategory((event.currentTarget as HTMLSelectElement).value as LivingMomentCategory | '')}>
                        <option value="">None</option>
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option value={value}>{label}</option>)}
                      </select>
                    </label>
                    <div class="living-chart__entry-actions">
                      <button class="btn btn--primary" type="submit" disabled={busy !== null}>Save changes</button>
                      <button class="living-chart__text-action" type="button" onClick={() => setEditId(null)}>Cancel</button>
                    </div>
                  </form>
                ) : moment.note ? <p class="living-chart__entry-note">{moment.note}</p> : null}
                {moment.syncState === 'conflict' && (
                  <aside class="living-chart__conflict" role="alert">
                    <strong>This entry changed on two devices.</strong>
                    {moment.conflictCopy ? (
                      <>
                        <div class="living-chart__conflict-copies">
                          <p><span>This device</span>{moment.note || `Category: ${moment.category ?? 'none'}`}</p>
                          <p><span>Synced copy</span>{moment.conflictCopy.note || `Category: ${moment.conflictCopy.category ?? 'none'}`}</p>
                        </div>
                        <div class="living-chart__entry-actions">
                          <button class="living-chart__text-action" type="button" onClick={() => void resolveConflict(moment.id, 'device')}>Keep this device’s version</button>
                          <button class="living-chart__text-action" type="button" onClick={() => void resolveConflict(moment.id, 'cloud')}>Use synced version</button>
                        </div>
                      </>
                    ) : <p>Retry sync to load both safe copies before choosing.</p>}
                  </aside>
                )}
                <details class="living-chart__forecast">
                  <summary>Forecast saved with this moment</summary>
                  <ul>
                    {moment.forecast.lines.map((line, index) => (
                      <li key={line.id}>
                        {index === 0 && moment.forecast.source === 'personalized' && (
                          <span class="living-chart__forecast-rank">Strongest contact · closest to exact</span>
                        )}
                        <span>{line.text}</span>
                        <span class="living-chart__receipt">{line.receipt}</span>
                      </li>
                    ))}
                  </ul>
                </details>
                <p class="living-chart__reflection">
                  <span>Reflection question</span>
                  {REFLECTION_QUESTIONS[moment.reflectionQuestionId]
                    ?? 'What stands out when you compare this saved reading with what actually happened?'}
                </p>
                <div class="living-chart__entry-actions">
                  <button class="living-chart__text-action" type="button" disabled={busy !== null || moment.syncState === 'conflict'} onClick={() => beginEdit(moment)}>Edit</button>
                  <button
                    class="living-chart__text-action living-chart__text-action--danger"
                    type="button"
                    data-living-chart-delete
                    disabled={busy !== null}
                    onClick={() => void onDelete(moment.id)}
                  >
                    {busy === moment.id
                      ? 'Deleting…'
                      : deleteArmed === moment.id ? 'Delete this moment' : 'Delete'}
                  </button>
                  {deleteArmed === moment.id && busy !== moment.id && (
                    <button class="living-chart__text-action" type="button" onClick={() => setDeleteArmed(null)}>Keep it</button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {ownerReady && moments.length > 0 && (
          <div class="living-chart__actions" aria-label="Export Living Chart">
            <button
              class="btn"
              type="button"
              data-living-chart-export="markdown"
              disabled={busy !== null}
              onClick={() => void onExport('markdown')}
            >
              Export Markdown
            </button>
            <button
              class="btn"
              type="button"
              data-living-chart-export="json"
              disabled={busy !== null}
              onClick={() => void onExport('json')}
            >
              Export JSON
            </button>
          </div>
        )}
        {message && <p class="living-chart__status" role="alert">{message}</p>}
      </div>
    </section>
  );
}
