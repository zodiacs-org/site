/**
 * The Moon journal: a private notebook tied to the new and full Moons, kept
 * only in this browser. No account, no request, no analytics event: the
 * notes are read from and written to localStorage on this device, and leave it
 * only as a file the visitor downloads.
 *
 * The page renders from its build time first, with every box sized, and the
 * island then moves to the device's own clock and reads saved notes; the
 * boxes it fills keep their size, so nothing shifts.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { moonIllumination, moonLongitude, moonPhaseAngle, moonPhaseName } from '../lib/engine/lite';
import { MOON_JOURNAL_COPY, type MoonJournalLocale } from '../lib/moon-journal/copy';
import { cycleAt, journalMarkdown, lunationCalendar, lunationKey, promptFor } from '../lib/moon-journal/cycle';
import {
  MAX_ENTRY_LENGTH, browserStorage, deleteEverything, probeStorage, readEntries, removeEntry,
  upsertEntry, writeEntries, type JournalStorage, type StorageState,
} from '../lib/moon-journal/store';
import { SIGN_SLUGS, type JournalEntry, type Lunation, type SignSlug } from '../lib/moon-journal/types';
import { downloadCalendarFile } from '../lib/ical-download';

interface Props {
  lunations: Lunation[];
  signNames: Record<string, string>;
  /** Build time, so the first render matches the server's. */
  builtAt: string;
  locale?: MoonJournalLocale;
}

function Disc({ angle }: { angle: number }) {
  const r = 44;
  const cosA = Math.cos((angle * Math.PI) / 180);
  const waxing = angle < 180;
  const rx = Math.max(0.5, Math.abs(cosA) * r);
  const limbSweep = waxing ? 1 : 0;
  const bowRight = waxing ? cosA > 0 : cosA < 0;
  const termSweep = bowRight ? 0 : 1;
  const lit = `M 50 ${50 - r} A ${r} ${r} 0 0 ${limbSweep} 50 ${50 + r} A ${rx} ${r} 0 0 ${termSweep} 50 ${50 - r} Z`;
  return (
    <svg class="mj-disc" viewBox="0 0 100 100" width="72" height="72" aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="var(--void-2)" stroke="var(--hair-2)" stroke-width="1" />
      {angle > 2 && angle < 358 && <path d={lit} fill="var(--ink-1, #E8EAF0)" opacity="0.92" />}
    </svg>
  );
}

const SIGN_BOUNDS = 30;
function signOfLongitude(lon: number): SignSlug {
  return SIGN_SLUGS[Math.floor((((lon % 360) + 360) % 360) / SIGN_BOUNDS)] ?? 'aries';
}

function downloadText(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function localDayStamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function MoonJournal({ lunations, signNames, builtAt, locale = 'en' }: Props) {
  const copy = MOON_JOURNAL_COPY[locale];
  const ui = copy.ui;
  const [nowMs, setNowMs] = useState(() => Date.parse(builtAt));
  const [onDevice, setOnDevice] = useState(false);
  const [storageState, setStorageState] = useState<StorageState>('ok');
  const storageRef = useRef<JournalStorage | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [toolStatus, setToolStatus] = useState('');
  const statusRef = useRef<HTMLParagraphElement>(null);

  // The visitor's own clock and stored notes, read only on the device.
  useEffect(() => {
    setNowMs(Date.now());
    const storage = browserStorage();
    const state = probeStorage(storage);
    storageRef.current = state === 'ok' ? storage : null;
    setStorageState(state);
    setEntries(readEntries(storageRef.current));
    setOnDevice(true);
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const cycle = useMemo(() => cycleAt(lunations, nowMs), [lunations, nowMs]);
  const current = cycle.current;
  const currentId = current ? lunationKey(current) : null;
  const currentEntry = entries.find((entry) => entry.id === currentId) ?? null;
  const previousEntry = cycle.previousSamePhase
    ? entries.find((entry) => entry.id === lunationKey(cycle.previousSamePhase!)) ?? null
    : null;

  // Load the saved note for this cycle into the editor once notes are read.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!onDevice || !currentId || loadedFor.current === currentId) return;
    loadedFor.current = currentId;
    setDraft(currentEntry?.text ?? '');
  }, [onDevice, currentId, currentEntry]);

  const now = new Date(nowMs);
  const angle = moonPhaseAngle(now);
  const illum = Math.round(moonIllumination(now) * 100);
  const moonSign = signNames[signOfLongitude(moonLongitude(now))];
  const zone = onDevice ? undefined : 'UTC';
  const dayFormat = (iso: string) => new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', ...(zone ? { timeZone: zone } : {}),
  }).format(new Date(iso));
  const dayTimeFormat = (iso: string) => new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    ...(zone ? { timeZone: zone, timeZoneName: 'short' } : {}),
  }).format(new Date(iso));
  const phaseLabel = (type: 'new' | 'full') => copy.phaseInline[type];
  const signName = (slug: string) => signNames[slug] ?? slug;

  const persist = (next: JournalEntry[]): boolean => {
    setEntries(next);
    if (storageState !== 'ok') return false;
    const result = writeEntries(storageRef.current, next);
    if (!result.ok) {
      setStatus(result.reason === 'full' ? ui.storageFull : ui.storageBlocked);
      return false;
    }
    return true;
  };

  const saveCurrent = () => {
    if (!current || !currentId) return;
    const next = upsertEntry(entries, {
      id: currentId,
      phase: current.type,
      sign: current.sign,
      at: current.at,
      prompt: currentEntry?.prompt ?? promptFor(current, locale),
      text: draft,
      savedAt: new Date().toISOString(),
    });
    const kept = persist(next);
    if (kept) setStatus(ui.saved);
    else if (storageState !== 'ok') setStatus(ui.savedNotKept);
  };

  const saveEdit = (entry: JournalEntry) => {
    const next = upsertEntry(entries, { ...entry, text: editText, savedAt: new Date().toISOString() });
    persist(next);
    setEditId(null);
    setToolStatus(storageState === 'ok' ? ui.saved : ui.savedNotKept);
  };

  const deleteOne = (id: string) => {
    persist(removeEntry(entries, id));
    setConfirmId(null);
    if (id === currentId) setDraft('');
  };

  const deleteAll = () => {
    deleteEverything(storageRef.current);
    setEntries([]);
    setDraft('');
    setConfirmAll(false);
    setEditId(null);
    setToolStatus(ui.deletedAll);
  };

  const downloadJournal = () => {
    const today = new Date();
    const text = journalMarkdown(entries, {
      downloadedOn: new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(today),
      formatDay: dayFormat,
      signName,
      locale,
    });
    downloadText(text, `moon-journal-${localDayStamp(today)}.md`);
  };

  const downloadCalendar = () => {
    const calendar = lunationCalendar(lunations, Date.now(), signName, locale);
    if (calendar) downloadCalendarFile(calendar, 'moon-journal-new-and-full-moons.ics');
  };

  const past = entries.filter((entry) => entry.id !== currentId);
  const currentTitle = current ? copy.lunationTitle(current.type, signName(current.sign)) : '';
  const prompt = current ? (currentEntry?.prompt ?? promptFor(current, locale)) : '';

  return (
    <div class="mj" data-moon-journal data-ready={onDevice ? 'true' : 'false'}>
      <section class="mj-now shell" aria-labelledby="mj-now-head">
        <div class="mj-now__core core">
          <h2 id="mj-now-head" class="mj-h">{ui.nowHeading}</h2>
          <div class="mj-now__grid">
            <div class="mj-now__phase">
              <Disc angle={angle} />
              <div>
                <p class="mj-now__name" data-mj-phase>{moonPhaseName(now)}</p>
                <p class="mj-now__meta">{ui.illuminated(illum)} · {ui.moonIn(moonSign ?? '')}</p>
              </div>
            </div>
            <dl class="mj-now__next">
              <div>
                <dt>{ui.nextNew}</dt>
                <dd data-mj-next-new>{cycle.nextNew ? `${dayTimeFormat(cycle.nextNew.at)}, in ${signName(cycle.nextNew.sign)}` : ''}</dd>
              </div>
              <div>
                <dt>{ui.nextFull}</dt>
                <dd data-mj-next-full>{cycle.nextFull ? `${dayTimeFormat(cycle.nextFull.at)}, in ${signName(cycle.nextFull.sign)}` : ''}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {current && (
        <section class="mj-prompt" aria-labelledby="mj-prompt-head">
          <div class="mj-prompt__write">
            <h2 id="mj-prompt-head" class="mj-h">{ui.promptHeading}</h2>
            <p class="mj-prompt__for" data-mj-for>{ui.promptFor(currentTitle, dayFormat(current.at))}</p>
            <p class="mj-prompt__q" data-mj-prompt>{prompt}</p>
            <label class="mj-label" for="mj-draft">{ui.textareaLabel}</label>
            <textarea
              id="mj-draft"
              class="mj-textarea"
              rows={7}
              maxLength={MAX_ENTRY_LENGTH}
              value={draft}
              disabled={!onDevice}
              onInput={(event) => { setDraft((event.target as HTMLTextAreaElement).value); setStatus(''); }}
              data-mj-draft
            />
            <div class="mj-actions">
              <button type="button" class="btn btn--primary" onClick={saveCurrent} disabled={!onDevice} data-mj-save>{ui.save}</button>
            </div>
            <p class="mj-status" role="status" ref={statusRef} data-mj-status>
              {status || (onDevice && storageState !== 'ok' ? ui.storageBlocked : '')}
            </p>
          </div>
          <aside class="mj-last" aria-labelledby="mj-last-head">
            <h3 id="mj-last-head" class="mj-last__head">{ui.lastCycleHeading(phaseLabel(current.type))}</h3>
            {previousEntry ? (
              <div class="mj-last__body" data-mj-last>
                <p class="mj-last__meta">
                  {copy.lunationTitle(previousEntry.phase, signName(previousEntry.sign))}, {dayFormat(previousEntry.at)}
                </p>
                <p class="mj-last__q">{previousEntry.prompt}</p>
                <p class="mj-last__text">{previousEntry.text}</p>
              </div>
            ) : (
              <p class="mj-last__empty" data-mj-last-empty>{ui.lastCycleEmpty(phaseLabel(current.type))}</p>
            )}
          </aside>
        </section>
      )}
      {cycle.nearHorizon && <p class="mj-horizon">{ui.dataHorizon}</p>}

      <section class="mj-past" aria-labelledby="mj-past-head">
        <h2 id="mj-past-head" class="mj-h">{ui.pastHeading}</h2>
        {!onDevice ? (
          <p class="mj-past__empty">{ui.loading}</p>
        ) : past.length === 0 ? (
          <p class="mj-past__empty" data-mj-past-empty>{ui.pastEmpty}</p>
        ) : (
          <ol class="mj-entries" data-mj-entries>
            {past.map((entry) => (
              <li class="mj-entry" key={entry.id} data-mj-entry={entry.id}>
                <p class="mj-entry__title">
                  {copy.lunationTitle(entry.phase, signName(entry.sign))}
                  <span class="mj-entry__date">{dayFormat(entry.at)}</span>
                </p>
                <p class="mj-entry__q">{entry.prompt}</p>
                {editId === entry.id ? (
                  <>
                    <label class="sr-only" for={`mj-edit-${entry.id}`}>{ui.textareaLabel}</label>
                    <textarea
                      id={`mj-edit-${entry.id}`}
                      class="mj-textarea"
                      rows={5}
                      maxLength={MAX_ENTRY_LENGTH}
                      value={editText}
                      onInput={(event) => setEditText((event.target as HTMLTextAreaElement).value)}
                      data-mj-edit-text
                    />
                    <div class="mj-actions">
                      <button type="button" class="btn" onClick={() => saveEdit(entry)} data-mj-edit-save>{ui.save}</button>
                      <button type="button" class="mj-link" onClick={() => setEditId(null)}>{ui.cancel}</button>
                    </div>
                  </>
                ) : (
                  <p class="mj-entry__text">{entry.text}</p>
                )}
                {editId !== entry.id && (
                  confirmId === entry.id ? (
                    <div class="mj-confirm" role="group" aria-label={ui.deleteOneConfirm}>
                      <p>{ui.deleteOneConfirm}</p>
                      <div class="mj-actions">
                        <button type="button" class="btn" onClick={() => deleteOne(entry.id)} data-mj-delete-yes>{ui.deleteOneYes}</button>
                        <button type="button" class="mj-link" onClick={() => setConfirmId(null)}>{ui.keep}</button>
                      </div>
                    </div>
                  ) : (
                    <div class="mj-actions">
                      <button type="button" class="mj-link" onClick={() => { setEditId(entry.id); setEditText(entry.text); setConfirmId(null); }} data-mj-edit>{ui.edit}</button>
                      <button type="button" class="mj-link" onClick={() => { setConfirmId(entry.id); setEditId(null); }} data-mj-delete>{ui.deleteOne}</button>
                    </div>
                  )
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section class="mj-tools" aria-labelledby="mj-tools-head">
        <h2 id="mj-tools-head" class="mj-h">{ui.toolsHeading}</h2>
        <div class="mj-actions">
          <button type="button" class="btn" onClick={downloadJournal} disabled={!onDevice || entries.length === 0} data-mj-download>{ui.downloadJournal}</button>
          <button type="button" class="btn" onClick={downloadCalendar} disabled={!onDevice} data-mj-calendar>{ui.downloadCalendar}</button>
        </div>
        <p class="mj-tools__note">{ui.calendarNote}</p>
        {confirmAll ? (
          <div class="mj-confirm" role="group" aria-label={ui.deleteAll}>
            <p>{ui.deleteAllConfirm(entries.length)}</p>
            <div class="mj-actions">
              <button type="button" class="btn" onClick={deleteAll} data-mj-delete-all-yes>{ui.deleteAllYes}</button>
              <button type="button" class="mj-link" onClick={() => setConfirmAll(false)}>{ui.cancel}</button>
            </div>
          </div>
        ) : (
          <div class="mj-actions">
            <button type="button" class="mj-link mj-link--quiet" onClick={() => { setConfirmAll(true); setToolStatus(''); }} disabled={!onDevice || entries.length === 0} data-mj-delete-all>{ui.deleteAll}</button>
          </div>
        )}
        <p class="mj-status" role="status" data-mj-tool-status>{toolStatus}</p>
      </section>
    </div>
  );
}
