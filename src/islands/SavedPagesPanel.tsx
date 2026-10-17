/**
 * "Saved to your profile" on /profile/: the compatibility readings and
 * occasion cards a signed-in person saved, each a link back to its page.
 * A page someone chose to save before signing in is saved here once the
 * session arrives. Renders nothing unless PUBLIC_ACCOUNT_SAVES_ENABLED is on.
 */
import { useEffect, useState } from 'preact/hooks';
import {
  SAVED_PAGE_KIND_LABELS,
  peekPendingSave,
  settlePendingSave,
  type SavedPage,
  type SavedPageDraft,
} from '../lib/profile/saved-pages-config';
import { assistantSavedReading, type SavedReading } from '../lib/profile/assistant-saved-reading';
import '../styles/account.css';

interface Props {
  enabled: boolean;
}

type Load = 'loading' | 'signed-out' | 'ready' | 'error';

const COPY = {
  title: 'Saved to your profile',
  intro: 'Compatibility readings and occasion cards you saved. They open on any device you sign in on.',
  introWithAssistant: 'Compatibility readings and occasion cards you saved, and what your assistant saved for you. They open on any device you sign in on.',
  empty: 'Nothing saved yet. Use “Save to your profile” under a compatibility reading or an occasion card.',
  pending: 'Sign in above and this will be saved to your profile:',
  justSaved: 'Saved to your profile:',
  pendingFull: 'Your profile is full, so this was not saved yet. Remove a page below, then reload to save it:',
  pendingError: 'This could not be saved yet. Reload the page to try again:',
  remove: 'Remove',
  removed: 'Removed from your profile.',
  loadError: 'Your saved pages could not be loaded. Reload the page to try again.',
  removeError: 'That could not be removed. Try again.',
  fromAssistant: 'from your assistant',
  download: 'Download as JSON',
  downloadError: 'Your saved pages could not be downloaded. Try again.',
} as const;

function savedOn(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export default function SavedPagesPanel({ enabled }: Props) {
  const [load, setLoad] = useState<Load>('loading');
  const [pages, setPages] = useState<SavedPage[]>([]);
  const [pending, setPending] = useState<SavedPageDraft | null>(null);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let generation = 0;
    let unsubscribe = () => {};
    void import('../lib/profile/saved-pages-cloud').then((cloud) => {
      if (!active) return;
      unsubscribe = cloud.onSavedPagesAuthChange((signedIn) => {
        if (!active) return;
        const current = ++generation;
        setPages([]);
        setStatus(null);
        setLoad('loading');
        if (!signedIn) {
          setPending(peekPendingSave());
          setLoad('signed-out');
          return;
        }
        // Supabase asks that auth callbacks not call back into the client
        // synchronously; let the callback return first.
        setTimeout(() => void (async () => {
          if (!active || current !== generation) return;
          try {
            const settled = await settlePendingSave((draft) => cloud.saveSavedPage(draft));
            if (settled && active && current === generation) {
              const { draft, outcome } = settled;
              if (outcome === 'saved' || outcome === 'exists') setStatus({ text: `${COPY.justSaved} ${draft.title}` });
              else setStatus({ text: `${outcome === 'full' ? COPY.pendingFull : COPY.pendingError} ${draft.title}`, error: true });
            }
            if (!active || current !== generation) return;
            const rows = await cloud.listSavedPages();
            if (!active || current !== generation) return;
            setPending(null);
            if (rows === null) {
              setLoad('signed-out');
              return;
            }
            setPages(rows);
            setLoad('ready');
          } catch {
            if (active && current === generation) setLoad('error');
          }
        })(), 0);
      });
    }).catch(() => { if (active) setLoad('error'); });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled]);

  if (!enabled || load === 'loading') return null;
  if (load === 'signed-out') {
    if (!pending) return null;
    return (
      <section class="saved-pages shell" id="saved-pages" aria-labelledby="saved-pages-title">
        <div class="core saved-pages__core">
          <div class="saved-pages__head">
            <h2 id="saved-pages-title">{COPY.title}</h2>
            <p>{COPY.pending} <strong>{pending.title}</strong></p>
          </div>
        </div>
      </section>
    );
  }

  async function remove(page: SavedPage) {
    setStatus(null);
    try {
      const { removeSavedPage } = await import('../lib/profile/saved-pages-cloud');
      if (!await removeSavedPage(page.id)) throw new Error('remove failed');
      setPages((current) => current.filter((row) => row.id !== page.id));
      setStatus({ text: COPY.removed });
    } catch {
      setStatus({ text: COPY.removeError, error: true });
    }
  }

  async function download() {
    setStatus(null);
    try {
      const { exportSavedPages } = await import('../lib/profile/saved-pages-cloud');
      const rows = await exportSavedPages();
      if (!rows) throw new Error('signed out');
      const blob = new Blob([JSON.stringify({ schema: 'zodiacs.saved-pages-export.v1', exportedAt: new Date().toISOString(), savedPages: rows }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'zodiacs-saved-pages.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setStatus({ text: COPY.downloadError, error: true });
    }
  }

  return (
    <section class="saved-pages shell" id="saved-pages" aria-labelledby="saved-pages-title" data-saved-pages>
      <div class="core saved-pages__core">
        <div class="saved-pages__head">
          <h2 id="saved-pages-title">{COPY.title}</h2>
          <p>{pages.some((page) => page.source === 'assistant') ? COPY.introWithAssistant : COPY.intro}</p>
        </div>
        {load === 'error' ? (
          <p class="saved-pages__status saved-pages__status--error" role="alert">{COPY.loadError}</p>
        ) : pages.length === 0 ? (
          <p class="saved-pages__empty">{COPY.empty}</p>
        ) : (
          <ul class="saved-pages__list" role="list">
            {pages.map((page) => (
              <li key={page.id} class="saved-pages__row">
                {page.source === 'assistant' ? <button type="button" class="saved-pages__link saved-pages__open" aria-controls={`saved-reading-${page.id}`} onClick={() => {
                  const detail = document.getElementById(`saved-reading-${page.id}`);
                  if (detail instanceof HTMLDetailsElement) detail.open = !detail.open;
                }}>{page.title}</button> : <a class="saved-pages__link" href={page.href}>{page.title}</a>}
                {page.summary && <span class="saved-pages__summary">{page.summary}</span>}
                <span class="saved-pages__meta">{SAVED_PAGE_KIND_LABELS[page.kind]} · saved {savedOn(page.savedAt)}{page.source === 'assistant' ? ` ${COPY.fromAssistant}` : ''}</span>
                <button
                  type="button"
                  class="saved-pages__remove"
                  onClick={() => void remove(page)}
                  aria-label={`${COPY.remove}: ${page.title}`}
                >{COPY.remove}</button>
                {page.source === 'assistant' && <AssistantReading page={page} />}
              </li>
            ))}
          </ul>
        )}
        {load === 'ready' && pages.length > 0 && (
          <button type="button" class="saved-pages__download" onClick={() => void download()}>{COPY.download}</button>
        )}
        {status && (
          <p class={`saved-pages__status${status.error ? ' saved-pages__status--error' : ''}`} role="status">{status.text}</p>
        )}
      </div>
    </section>
  );
}

/** Loaded on demand; unmounting on an account change drops all reading state. */
function AssistantReading({ page }: { page: SavedPage }) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState<SavedReading | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open || reading) return;
    let active = true;
    setFailed(false);
    void import('../lib/profile/saved-pages-cloud').then((cloud) => cloud.loadSavedPageDetail(page.id))
      .then((value) => {
        if (!active) return;
        const parsed = assistantSavedReading(value, page.kind);
        setReading(parsed); setFailed(!parsed);
      }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [open, page.id, page.kind]);
  return <details class="saved-pages__reading" id={`saved-reading-${page.id}`} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Read saved result</summary>
    {open && (reading ? <>
      <SavedReadingContent reading={reading} />
      <a href={page.href}>{page.kind === 'week' || page.href.includes('saved=') ? 'Explore more on Zodiacs' : 'Open on website'}</a>
    </> : <p role="status">{failed ? 'This saved reading could not be opened. Close it and try again.' : 'Loading your saved reading…'}</p>)}
  </details>;
}

export function SavedReadingContent({ reading }: { reading: SavedReading }) {
  return <div class="saved-pages__reading-content">
    {reading.sections.map((section, index) => <div key={index}>
      <h3>{section.title}</h3>
      {section.lines.map((line, lineIndex) => <p key={lineIndex}>{line}</p>)}
    </div>)}
    {reading.note && <p class="saved-pages__summary">{reading.note}</p>}
  </div>;
}
