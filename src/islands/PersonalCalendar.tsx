import { useEffect, useRef, useState } from 'preact/hooks';
import { localizePath, t, type CatalogLocale } from '../lib/i18n';
import { formatShortDate } from '../lib/i18n/dates';
import { returnText as s } from '../lib/return-visits/copy';
import { calculateEntry, emptyEntry, entryRefusalMessage } from '../lib/sharing/chart-entry';
import { birthDateRefusal, birthDateRefusalLang, birthDateRefusalText } from '../lib/birth-date-policy';
import { useEngine } from '../lib/hooks/useEngine';
import type { PersonalSky } from '../lib/personal-calendar/compute';
import type { PersonalCalendarEvent } from '../lib/ical';
import type { Engine2NoticeItem } from '../lib/chart-notices';
import SharingBirthForm from './SharingBirthForm';
import { createModuleLoader } from '../lib/module-load';
import CalculationReload, { calculationError } from './CalculationReload';

const loadEvents = createModuleLoader(() => import('../lib/personal-calendar/events'));
const loadDownload = createModuleLoader(() => import('../lib/ical-download'));
const loadNotices = createModuleLoader(() => import('../lib/chart-notices'));

interface Result {
  events: PersonalCalendarEvent[];
  calendar: string;
  from: string;
  to: string;
  timeKnown: boolean;
  hostZoneNote?: string;
  notices: Engine2NoticeItem[];
}

function readerTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

/**
 * Personal sky dates as a calendar file built in the browser. The birth
 * details stay on the device: the chart is computed here, the dates are
 * found in a worker, and the file is handed to the browser as a download.
 */
export default function PersonalCalendar({ locale }: { locale: CatalogLocale }) {
  const engine = useEngine();
  const [entry, setEntry] = useState(emptyEntry(4));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const worker = useRef<Worker | null>(null), generation = useRef(0), resultRef = useRef<HTMLElement>(null);
  const pendingReject = useRef<((reason: Error) => void) | null>(null);
  function clear() { generation.current++; worker.current?.terminate(); worker.current = null; pendingReject.current?.(new Error('cancelled')); pendingReject.current = null; setBusy(false); setResult(null); setError(''); }
  useEffect(() => () => { generation.current++; worker.current?.terminate(); pendingReject.current?.(new Error('cancelled')); }, []);

  function scan(chart: unknown, now: Date): Promise<PersonalSky> {
    worker.current = new Worker(new URL('./PersonalCalendar.worker.ts', import.meta.url), { type: 'module' });
    return new Promise((resolve, reject) => {
      pendingReject.current = reject;
      const current = worker.current!;
      const done = () => { current.terminate(); worker.current = null; pendingReject.current = null; };
      current.onerror = () => { done(); reject(new Error('worker failed')); };
      current.onmessage = (event: MessageEvent<{ error?: boolean; sky: PersonalSky }>) => { done(); if (event.data.error) reject(new Error('scan failed')); else resolve(event.data.sky); };
      current.postMessage({ chart, now: now.toISOString() });
    });
  }

  async function compute(event: Event) {
    event.preventDefault(); if (busy) return;
    clear();
    // Refused before the engine loads or the worker starts.
    const refusal = birthDateRefusal(entry.date);
    if (refusal) { setError(birthDateRefusalText(refusal)); return; }
    const run = generation.current; setBusy(true);
    try {
      const mod = await engine();
      const { chart, oldStyle } = await calculateEntry(entry, mod, locale);
      if (chart.flags.includes('outside-reference-span')) throw new RangeError(t(locale, 'birthDateRange'));
      const now = new Date();
      const noticeFlags = chart.flags.filter((flag) => (
        flag === 'calendar-unknown' || (!chart.input.timeKnown && flag === 'host-zone-data-differs')
      ));
      const [sky, events, noticeMod] = await Promise.all([
        scan(chart, now),
        loadEvents(),
        loadNotices(),
      ]);
      if (run !== generation.current) return;
      const absolute = (path: string) => `https://zodiacs.org${localizePath(locale, path)}`;
      const notices = noticeMod.resolveEngine2Notices(locale, noticeFlags, { convertedFromJulian: Boolean(oldStyle) });
      const options = {
        locale,
        timeZone: readerTimeZone(),
        links: { solarReturn: absolute('/solar-return/'), milestones: absolute('/occasions/milestones/'), saturnReturn: absolute('/saturn-return/'), transits: absolute('/transits/') },
        ...(notices.length ? { notes: notices.map((notice) => notice.text) } : {}),
      };
      const list = events.personalEvents(sky, options);
      const calendar = events.personalCalendar(sky, { ...options, generatedAt: now });
      if (!calendar) throw new Error('empty calendar');
      const hostZoneNote = sky.timeKnown && sky.hostZoneDiffers
        ? events.PERSONAL_WORDS[locale].hostZoneDiffersTime
        : undefined;
      setResult({
        events: list.sort((a, b) => (a.date ?? String(a.start)).localeCompare(b.date ?? String(b.start))),
        calendar,
        from: sky.from,
        to: sky.to,
        timeKnown: sky.timeKnown,
        hostZoneNote,
        notices,
      });
      requestAnimationFrame(() => { if (run === generation.current) { resultRef.current?.focus({ preventScroll: true }); resultRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' }); } });
    } catch (cause) { if (run === generation.current) setError(entryRefusalMessage(cause) ?? calculationError(cause, locale, s(locale, 'error'))); }
    finally { if (run === generation.current) setBusy(false); }
  }

  async function download() {
    if (!result) return;
    try { (await loadDownload()).downloadCalendarFile(result.calendar, 'zodiacs-my-sky.ics'); }
    catch (cause) { setError(calculationError(cause, locale, s(locale, 'error'))); }
  }

  const shown = (event: PersonalCalendarEvent) => formatShortDate(locale, event.date ? `${event.date}T12:00:00Z` : event.start!);
  return <div class="personal-calendar">
    <form class="return-personal" onSubmit={compute} aria-busy={busy}>
      <SharingBirthForm locale={locale} entry={entry} warm={engine} onChange={(patch) => { clear(); setEntry((current) => ({ ...current, ...patch })); }} />
      <button class="btn btn--primary" disabled={busy} data-personal-calendar-submit><span>{s(locale, busy ? 'generating' : 'personalFind')}</span><span class="orb">↗</span></button>
      {busy && <button class="btn btn--ghost" type="button" onClick={clear}>{s(locale, 'cancel')}</button>}
      <p class="sharing-note">{s(locale, 'personalPrivacy')}</p>
      {error && <p class="field__error" role="alert" lang={birthDateRefusalLang(error)}>{error}</p>}<CalculationReload error={error} locale={locale} />
    </form>
    {result && <section class="return-result" tabIndex={-1} ref={resultRef} aria-label={s(locale, 'personalTitle')} data-personal-calendar-result>
      <p>{s(locale, 'personalCount', { n: result.events.length, from: formatShortDate(locale, result.from), to: formatShortDate(locale, result.to) })}</p>
      {!result.timeKnown && <p class="notice">{s(locale, 'personalUnknown')}</p>}
      {result.hostZoneNote && <p class="notice" role="note" data-personal-calendar-notice="host-zone-data-differs">{result.hostZoneNote}</p>}
      {result.notices.map((notice) => (
        <p class="notice" role="note" key={notice.key} data-personal-calendar-notice={notice.key}>{notice.text}</p>
      ))}
      <ul class="return-contact-list">{result.events.map((event) => <li key={event.uid}>
        <span>{event.summary}</span>
        <time dateTime={event.date ?? String(event.start)}>{shown(event)}</time>
      </li>)}</ul>
      <div class="return-actions"><button type="button" class="btn btn--primary" onClick={() => { void download(); }} data-personal-calendar-download><span>{s(locale, 'personalDownload')}</span><span class="orb">↓</span></button></div>
      <p class="sharing-note">{s(locale, 'personalHow')}</p>
    </section>}
  </div>;
}
