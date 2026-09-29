import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { serializeTransitContacts } from '../../lib/ical';
import { downloadCalendarFile } from '../../lib/ical-download';
import {
  SLOW_TRANSIT_BODIES,
  TRANSIT_BODY_ORDER,
} from '../../lib/engine/transit-scan-shared';
import type {
  NatalPoint,
  NatalTransitChart,
  TransitBody,
  TransitContact,
} from '../../lib/engine/transit-scan';
import type { AspectType } from '../../lib/engine/types';
import { groupTransitSearchResults } from './transit-search-model';

const DAY = 86_400_000;
const RING_WINDOW = 365 * DAY;
const MONTH_FORMATTER = new Intl.DateTimeFormat('en', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});
const EXACT_DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  month: 'short', day: 'numeric', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
});

const SEARCH_COPY = {
  title: 'Find a transit',
  intro: 'Pick a moving planet, a point in your chart, and a window — get the exact dates, computed on this device.',
  fastBodyNote: 'Sun through Mars make these contacts every few weeks; the search really earns its keep on the slow planets.',
  empty: 'No exact contacts in this window. Widen the range or add bodies.',
  cap: (count: number) => `Showing the first 200 of ${count} contacts — narrow the range or the bodies to see the rest.`,
  running: (body: TransitBody) => `Scanning ${body}…`,
  calendar: 'Calendar file for these dates',
  calendarNote: 'The times in the file come from your exact chart, so anyone you share it with, or any online calendar you import it into, can work out your birth time from them, and your birthplace from those for your Ascendant or Midheaven.',
  calendarNoteNoTime: 'Without a birth time, the times in the file come from your chart for noon at your birthplace, so anyone you share it with, or any online calendar you import it into, can work out your birth date from them, and the time zone of your birthplace or, before standard time, its longitude.',
} as const;

const ASPECT_OPTIONS = [
  ['all', 'All'],
  ['conjunction', 'Conjunction'],
  ['square', 'Square'],
  ['opposition', 'Opposition'],
  ['trine', 'Trine'],
  ['sextile', 'Sextile'],
] as const;

const SPAN_OPTIONS = [
  [1, '1 year'],
  [5, '5 years'],
  [10, '10 years'],
] as const;

type SearchSpan = 1 | 5 | 10;

interface SearchWorkerRequest {
  natal: NatalTransitChart;
  fromUtc: string;
  toUtc: string;
  bodies: TransitBody[];
  natalPoint: NatalPoint;
  aspect: AspectType | null;
}

type SearchWorkerResponse =
  | { type: 'progress'; body: TransitBody }
  | { type: 'result'; contacts: TransitContact[] }
  | { type: 'error'; message: string };

export interface TransitSearchProps {
  natal: NatalTransitChart | null;
  natalPoints: { name: NatalPoint }[];
  nowMs: number;
  onShowOnRing: (contact: TransitContact) => void;
  /** Whether the chart has a birth time; without one it is noon at the birthplace. */
  timeKnown?: boolean;
}

function shiftUtcYears(instant: number, years: number): Date {
  const shifted = new Date(instant);
  shifted.setUTCFullYear(shifted.getUTCFullYear() + years);
  return shifted;
}

function formatMonth(month: string): string {
  return MONTH_FORMATTER.format(new Date(`${month}-01T00:00:00.000Z`));
}

function formatExactDate(exactUtc: string): string {
  return `${EXACT_DATE_FORMATTER.format(new Date(exactUtc))} UTC`;
}

function isSlowDefault(bodies: readonly TransitBody[]): boolean {
  return bodies.length === SLOW_TRANSIT_BODIES.length
    && SLOW_TRANSIT_BODIES.every((body) => bodies.includes(body));
}

function trackSearch(span: SearchSpan, bodies: readonly TransitBody[]): void {
  const analytics = (globalThis as typeof globalThis & {
    zodiacsAnalytics?: {
      track?: (name: string, props: { span: string; bodies: string }) => void;
    };
  }).zodiacsAnalytics;
  analytics?.track?.('transit_search', {
    span: `${span}y`,
    bodies: isSlowDefault(bodies) ? 'slow' : 'custom',
  });
}

export function TransitSearch({
  natal,
  natalPoints,
  nowMs,
  onShowOnRing,
  timeKnown = true,
}: TransitSearchProps) {
  const [bodies, setBodies] = useState<TransitBody[]>([...SLOW_TRANSIT_BODIES]);
  const [natalPoint, setNatalPoint] = useState<NatalPoint | ''>(
    natalPoints.some((point) => point.name === 'Sun') ? 'Sun' : (natalPoints[0]?.name ?? ''),
  );
  const [aspect, setAspect] = useState<AspectType | 'all'>('all');
  const [span, setSpan] = useState<SearchSpan>(5);
  const [contacts, setContacts] = useState<TransitContact[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<TransitBody | null>(null);
  const [error, setError] = useState('');
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const grouped = useMemo(
    () => contacts === null ? null : groupTransitSearchResults(contacts),
    [contacts],
  );

  function toggleBody(body: TransitBody): void {
    setBodies((current) => TRANSIT_BODY_ORDER.filter((candidate) =>
      candidate === body ? !current.includes(candidate) : current.includes(candidate)));
  }

  function runSearch(event: Event): void {
    event.preventDefault();
    if (!natal || !natalPoint || bodies.length === 0 || busy) return;

    workerRef.current?.terminate();
    const worker = new Worker(new URL('./TransitSearch.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    setBusy(true);
    setContacts(null);
    setError('');
    setProgress(bodies[0]);
    trackSearch(span, bodies);

    worker.onmessage = (message: MessageEvent<SearchWorkerResponse>) => {
      if (workerRef.current !== worker) return;
      if (message.data.type === 'progress') {
        setProgress(message.data.body);
        return;
      }
      worker.terminate();
      workerRef.current = null;
      setBusy(false);
      setProgress(null);
      if (message.data.type === 'result') setContacts(message.data.contacts);
      else setError(message.data.message);
    };
    worker.onerror = () => {
      if (workerRef.current !== worker) return;
      worker.terminate();
      workerRef.current = null;
      setBusy(false);
      setProgress(null);
      setError('The transit search could not finish. Please try again.');
    };

    const request: SearchWorkerRequest = {
      natal,
      fromUtc: shiftUtcYears(nowMs, -span).toISOString(),
      toUtc: shiftUtcYears(nowMs, span).toISOString(),
      bodies,
      natalPoint,
      aspect: aspect === 'all' ? null : aspect,
    };
    worker.postMessage(request);
  }

  function downloadCalendar(): void {
    if (!contacts?.length) return;
    const calendar = serializeTransitContacts(contacts, {
      generatedAt: new Date(),
      calendarName: 'Zodiacs.org transit search',
    });
    downloadCalendarFile(calendar, 'zodiacs-transit-search.ics');
  }

  const canRun = natal !== null && natalPoint !== '' && bodies.length > 0 && !busy;

  return (
    <div class="tsearch" data-transit-search role="region" aria-label={SEARCH_COPY.title}>
      <p class="tsearch__intro">{SEARCH_COPY.intro}</p>

      <form class="tsearch__form" onSubmit={runSearch} aria-busy={busy}>
        <fieldset class="tsearch__field">
          <legend class="field__label">Transiting bodies</legend>
          <div class="tsearch__chips">
            {TRANSIT_BODY_ORDER.map((body) => (
              <button
                key={body}
                type="button"
                class={`tsearch__chip${bodies.includes(body) ? ' is-on' : ''}`}
                aria-pressed={bodies.includes(body)}
                data-search-body={body}
                onClick={() => toggleBody(body)}
              >
                {body}
              </button>
            ))}
          </div>
          <p class="field__help">{SEARCH_COPY.fastBodyNote}</p>
        </fieldset>

        <div class="tsearch__selects">
          <label class="field">
            <span class="field__label">Natal point</span>
            <select
              class="field__input"
              value={natalPoint}
              disabled={!natal}
              data-search-natal-point
              onChange={(event) => setNatalPoint((event.target as HTMLSelectElement).value as NatalPoint)}
            >
              {natalPoints.map((point) => (
                <option key={point.name} value={point.name}>{point.name}</option>
              ))}
            </select>
          </label>

          <label class="field">
            <span class="field__label">Aspect</span>
            <select
              class="field__input"
              value={aspect}
              data-search-aspect
              onChange={(event) => setAspect((event.target as HTMLSelectElement).value as AspectType | 'all')}
            >
              {ASPECT_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset class="tsearch__field">
          <legend class="field__label">Range around today</legend>
          <div class="tsearch__chips">
            {SPAN_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                class={`tsearch__chip${span === value ? ' is-on' : ''}`}
                aria-pressed={span === value}
                data-search-span={`${value}y`}
                onClick={() => setSpan(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <button class="btn btn--primary" type="submit" disabled={!canRun} data-search-run>
          <span>Find exact dates</span>
          <span class="orb">↗</span>
        </button>
        {!natal && <p class="field__help">Load your natal chart above to search its points.</p>}
      </form>

      {busy && progress && (
        <p class="tsearch__status mono" role="status">{SEARCH_COPY.running(progress)}</p>
      )}
      {error && <p class="calc__error" role="alert">{error}</p>}

      {grouped && grouped.total === 0 && (
        <p class="tsearch__empty" role="status">{SEARCH_COPY.empty}</p>
      )}

      {grouped && grouped.total > 0 && (
        <div class="tsearch__results" data-search-results>
          <div class="tsearch__result-head">
            <p class="mono">{grouped.total} exact {grouped.total === 1 ? 'contact' : 'contacts'}</p>
            <button class="btn btn--glass" type="button" onClick={downloadCalendar} data-search-calendar>
              <span>{SEARCH_COPY.calendar}</span>
            </button>
          </div>
          <p class="field__help" data-search-calendar-note>
            {timeKnown ? SEARCH_COPY.calendarNote : SEARCH_COPY.calendarNoteNoTime}
          </p>
          {grouped.capped && (
            <p class="tsearch__cap" role="status" data-search-cap>{SEARCH_COPY.cap(grouped.total)}</p>
          )}

          <div class="tsearch__months">
            {grouped.months.map((month) => (
              <section class="tsearch__month" key={month.key}>
                <h3>{formatMonth(month.key)}</h3>
                {month.contacts.map((group) => (
                  <div class="tsearch__contact" key={group.key}>
                    <h4>{group.transitBody} {group.aspect} natal {group.natalPoint}</h4>
                    <ol>
                      {group.contacts.map((contact) => (
                        <li
                          key={`${contact.exactUtc}-${group.key}`}
                          data-search-contact={`${contact.transitBody}|${contact.aspect}|${contact.natalPoint}`}
                          data-search-exact={contact.exactUtc}
                          data-search-pass-count={contact.passCount}
                        >
                          <span class="mono">{formatExactDate(contact.exactUtc)}</span>
                          {contact.passCount > 1 && (
                            <span>Pass {contact.pass} of {contact.passCount}</span>
                          )}
                          {Math.abs(Date.parse(contact.exactUtc) - nowMs) <= RING_WINDOW && (
                            <button
                              class="tsearch__show"
                              type="button"
                              onClick={() => onShowOnRing(contact)}
                              data-search-show-ring
                            >
                              Show on ring
                            </button>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
