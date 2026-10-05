import { useEffect, useRef, useState } from 'preact/hooks';
import { useProfileSurface } from '../lib/profile/surface-gate';
import type { ChartBackup } from '../lib/profile/backup';
import type { ChartSaveStatus } from '../lib/profile/sync';

export default function ProfileSafety({ syncConfigured = false, accountBound = false }: { syncConfigured?: boolean; accountBound?: boolean }) {
  const visible = useProfileSurface(accountBound);
  const [signedIn, setSignedIn] = useState(false);
  const [status, setStatus] = useState<ChartSaveStatus>('local');
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<ChartBackup | null>(null);
  const [restoreIdentity, setRestoreIdentity] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true, unsubscribe = () => {};
    setReady(true);
    const connection = () => setOnline(navigator.onLine);
    const update = (e: Event) => setStatus((e as CustomEvent<ChartSaveStatus>).detail);
    const boundary = () => { setPending(null); setMessage(''); };
    connection();
    window.addEventListener('online', connection); window.addEventListener('offline', connection);
    window.addEventListener('zodiacs:chart-save-status', update);
    window.addEventListener('zodiacs:profile-access', boundary);
    if (syncConfigured && !accountBound) void import('../lib/profile/sync').then(async api => {
      const session = await api.getSyncSession();
      if (!alive) return;
      setSignedIn(!!session); setStatus(api.getChartSaveStatus());
      unsubscribe = api.onSyncAuthChange(next => { if (alive) { setSignedIn(!!next); if (!next) setStatus('local'); } });
    }).catch(() => { if (alive) setStatus('error'); });
    return () => {
      alive = false; unsubscribe();
      window.removeEventListener('online', connection); window.removeEventListener('offline', connection);
      window.removeEventListener('zodiacs:chart-save-status', update); window.removeEventListener('zodiacs:profile-access', boundary);
    };
  }, [syncConfigured, accountBound]);

  useEffect(() => { if (pending) panel.current?.focus({ preventScroll: true }); }, [pending]);

  async function download() {
    setBusy(true); setMessage('');
    try {
      const { createChartBackup } = await import('../lib/profile/backup');
      const backup = createChartBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `zodiacs-charts-${backup.createdAt.slice(0, 10)}.json`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Backup downloaded. Keep the file private: it contains birth details and your profile photo, if added.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The backup could not be downloaded.'); }
    finally { setBusy(false); }
  }
  async function readFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement, selected = input.files?.[0];
    if (!selected) return;
    setBusy(true); setMessage(''); setPending(null); setRestoreIdentity(false);
    try {
      const { BACKUP_LIMIT, parseChartBackup } = await import('../lib/profile/backup');
      if (selected.size > BACKUP_LIMIT) throw new Error('Choose a Zodiacs chart backup under 2 MB.');
      setPending(parseChartBackup(await selected.text()));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'This backup could not be opened.'); }
    finally { setBusy(false); input.value = ''; }
  }
  async function restore() {
    if (!pending) return;
    setBusy(true); setMessage('');
    try {
      const { restoreChartBackup } = await import('../lib/profile/backup');
      const added = restoreChartBackup(pending, restoreIdentity);
      if (syncConfigured && !accountBound) void import('../lib/profile/sync').then(async api => {
        if (await api.getSyncSession()) api.scheduleCloudSync();
      }).catch(() => setStatus('error'));
      setPending(null); setMessage(`Backup restored. ${added} new ${added === 1 ? 'chart' : 'charts'} added. Existing charts were kept.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The backup could not be restored.'); }
    finally { setBusy(false); }
  }
  if (!visible) return null;
  const label = signedIn
    ? !online ? 'Saved in this browser · offline' : status === 'synced' ? 'Charts synced to your account'
      : status === 'error' ? 'Saved in this browser · sync needs attention' : status === 'local' ? 'Saved in this browser · sync pending' : 'Saved in this browser · syncing charts…'
    : 'Saved in this browser';
  return <section class="pf-safety" aria-label="Saving and backup">
    <div class="pf-safety__status">
      <strong role="status" aria-live="polite">{label}</strong>
      <p>Clearing site data removes local saves. {signedIn ? 'Sign in with the same email on another device to retrieve synced birth charts.' : 'Use an optional account to keep your birth charts on other devices, or transfer them with a backup.'}</p>
    </div>
    <div class="pf-safety__actions">
      {syncConfigured && <a class="btn btn--ghost" href="#profile-sync">{signedIn ? 'Manage chart sync' : 'Save across devices'} <span aria-hidden="true">↗</span></a>}
      <button class="pf-quiet" type="button" disabled={!ready || busy} onClick={download}>Download backup</button>
      <button class="pf-quiet" ref={restoreButton} type="button" disabled={!ready || busy} onClick={() => file.current?.click()}>Restore backup</button>
      <input class="sr-only" ref={file} type="file" disabled={!ready || busy} accept="application/json,.json" aria-label="Choose chart backup" onChange={readFile} tabIndex={-1} />
    </div>
    <details class="pf-safety__details"><summary>What is saved and synced?</summary>
      <p>Account sync keeps saved birth charts. Your name, photo, and received cards stay in this browser and are included in chart backups. Saved comparisons stay here. Timeline observations have their own export below.</p>
      {!syncConfigured && <p>Account sync is unavailable in this build. Use a backup to transfer charts to another device.</p>}
    </details>
    {pending && <div class="pf-safety__restore" ref={panel} tabIndex={-1} role="group" aria-label="Review backup before restoring">
      <h2>Restore this backup?</h2>
      <p>{pending.profile.charts.length} saved {pending.profile.charts.length === 1 ? 'chart' : 'charts'} and {pending.circle.length} received {pending.circle.length === 1 ? 'card' : 'cards'}. Existing charts and cards will be kept; duplicates are skipped.</p>
      {signedIn && <p>Restored birth charts will also sync to your signed-in account.</p>}
      <label class="pf-safety__choice"><input type="checkbox" checked={restoreIdentity} onChange={e => setRestoreIdentity(e.currentTarget.checked)} /> Also use the name and photo from this backup</label>
      <div class="pf-safety__actions"><button class="btn btn--primary" type="button" disabled={busy} onClick={restore}>{busy ? 'Restoring…' : 'Restore charts and cards'}</button><button class="pf-quiet" type="button" disabled={busy} onClick={() => { setPending(null); restoreButton.current?.focus(); }}>Cancel</button></div>
    </div>}
    {message && <p class="pf-safety__message" role="status">{message}</p>}
  </section>;
}
