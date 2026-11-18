/**
 * The Birthday report: a birth date in, four readings for the birthday year
 * out (src/lib/birthday-report/report.ts), with a share link that carries the
 * Sun sign, the score and the card number only. The engine lazy-loads on
 * submit and everything is calculated on this device; the birth details are
 * never sent, stored or put in the address bar. Close to a birthday (45 days
 * or less) the report opens on the year that birthday starts, and two
 * buttons switch between that year and the one in progress. The buttons'
 * row is reserved from the first paint, so the result never shifts it.
 */
import type { Ref } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import PlaceSearch from './PlaceSearch';
import { prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import type { City } from '../lib/geo/search';
import { createModuleLoader } from '../lib/module-load';
import { dayName, monthName, scoreTier } from '../lib/year-score/reading';
import { birthdayReportShareUrl } from '../lib/birthday-report/share';
import { NUMBER_MEANINGS, PERSONAL_YEAR_MEANINGS, type CoreNumber, type SingleDigit } from '../data/numerology-meanings';
import type { BirthdayReport as Report, BirthdayYear } from '../lib/birthday-report/report';

const loadReport = createModuleLoader(() => import('../lib/birthday-report/report'));
// Islands never import the assistant tools, so the age rule is restated here with the same cutoff.
const underAge = (birthDate: string, today: string, years: number) => birthDate > `${String(Number(today.slice(0, 4)) - years).padStart(4, '0')}${today.slice(4)}`;
const UNDER_13 = 'Zodiacs is not directed at children under 13, so it makes no report for a birth date less than 13 years ago.';

const DAY = 86_400_000;
/** The report opens on the next birthday year when its solar return is this close. */
const NEXT_YEAR_WITHIN = 45 * DAY;
/** A window that began longer ago than this is mostly behind, so its score is not called the year ahead. */
const AHEAD_FOR = 30 * DAY;

/** A date only: on the birthplace clock when there is one, else the UTC date (an untimed return is cast from 12:00 UTC and can be a day either side). */
function day(iso: string, zone: string | null = null): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone ?? 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

/** A timed return on the birthplace clock, named so the reader knows whose clock it is. */
function clock(iso: string, zone: string): string {
  const at = new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  return `${at} (${zone}, your birthplace's clock)`;
}

/**
 * The report's state once calculated: the chosen year's report, the dates both buttons name, and what a switch recomputes from.
 * `zone` is the birthplace's zone only for a timed birth; `birth.sunEnds` settles the Sun sign (reportInstants).
 */
export interface ReportState {
  data: Report;
  zone: string | null;
  share: string | null;
  which: BirthdayYear;
  returns: Record<BirthdayYear, string>;
  now: Date;
  birth: { utc: Date; date: string; timeKnown: boolean; sunEnds?: readonly [Date, Date] };
}
type ReportModule = Pick<typeof import('../lib/birthday-report/report'), 'birthdayReport'>;

/** The report opens on the next birthday year when its solar return is 45 days away or less. */
export function openingYear(nextReturn: string, now: Date): BirthdayYear {
  return Date.parse(nextReturn) - now.getTime() <= NEXT_YEAR_WITHIN ? 'next' : 'current';
}

/** The score tile's title: a window that began more than 30 days ago is mostly behind, so it is not the year ahead. */
export function scoreTitle(solarReturn: string, now: Date): 'Year Ahead Score' | 'Year score' {
  return now.getTime() - Date.parse(solarReturn) <= AHEAD_FOR ? 'Year Ahead Score' : 'Year score';
}

/** The share link for a report: the Sun sign, the score and the card number, nothing else. No settled Sun sign, no share link: the link never guesses one. */
export const shareOf = (origin: string, data: Report) => data.sun ? birthdayReportShareUrl(origin, { sun: data.sun.slug, score: data.year.score, card: data.card.number }) : null;

/** The first report for a birth: both return dates, the year it opens on, and that year's report and share link. */
export function openReport(module: ReportModule, birth: ReportState['birth'], zone: string | null, now: Date, origin: string): ReportState {
  const current = module.birthdayReport(birth.utc, birth.date, birth.timeKnown, now, 'current', birth.sunEnds);
  const returns = { current: current.solarReturn, next: current.nextSolarReturn };
  const which = openingYear(returns.next, now);
  const data = which === 'next' ? module.birthdayReport(birth.utc, birth.date, birth.timeKnown, now, 'next', birth.sunEnds) : current;
  return { data, zone, share: shareOf(origin, data), which, returns, now, birth };
}

/** The same birth's report for the other birthday year, recalculated on this device; the share link follows the chosen year. */
export function switchYear(module: ReportModule, state: ReportState, which: BirthdayYear, origin: string): ReportState {
  if (which === state.which) return state;
  const { utc, date, timeKnown, sunEnds } = state.birth;
  const data = module.birthdayReport(utc, date, timeKnown, state.now, which, sunEnds);
  return { ...state, data, which, share: shareOf(origin, data) };
}

/**
 * The two year buttons. They are drawn from the first paint, hidden and
 * disabled until there is a report, so the result never moves them or the
 * page when it arrives. Each label stays on one line (the buttons stack on a
 * phone), so the reserved row is exactly the row the report fills.
 */
export function YearChoice({ state, onChoose }: { state: ReportState | null; onChoose: (which: BirthdayYear) => void }) {
  return (
    <div class="br__years" role="group" aria-label="Birthday year" aria-hidden={state ? undefined : 'true'} data-ready={state ? 'true' : 'false'}>
      {(['current', 'next'] as const).map((which) => (
        <button key={which} type="button" class="br__year" disabled={!state} aria-pressed={state ? state.which === which : undefined} onClick={() => onChoose(which)}>
          Year from {state ? day(state.returns[which], state.zone) : '\u00a0'}
        </button>
      ))}
    </div>
  );
}

/** The report itself, for the chosen birthday year. */
export function ReportResult({ state, yearScoreLink, headingRef }: { state: ReportState; yearScoreLink: boolean; headingRef?: Ref<HTMLHeadingElement> }) {
  const { data, zone, now } = state;
  const opened = Date.parse(data.solarReturn) <= now.getTime();
  const lifePath = NUMBER_MEANINGS[data.lifePath as CoreNumber];
  const tier = scoreTier(data.year.score);
  /** A return as the reader can use it: the minute on the birthplace clock when timed, else the date. */
  const at = (iso: string) => zone ? clock(iso, zone) : `around ${day(iso)}`;
  return (
    <div class="calc__result br__result">
      {/* With an unsettled Sun the heading names no sign: it keeps the Personal Year and its year. */}
      <h2 class="br__heading" tabIndex={-1} ref={headingRef}>{data.heading}</h2>
      {!data.sun && <p data-br-sun-unsettled>Your Sun is in {data.sunCandidates[0].name} or {data.sunCandidates[1].name}: a birth time settles it.</p>}

      <section class="tile br__part">
        <h3>Solar return</h3>
        <p class="br__big" data-br-return>{zone ? clock(data.solarReturn, zone) : `Around ${day(data.solarReturn)}`}</p>
        {!zone && <p>Without a birth time this can be a day either side. Add your birth time and place for the minute.</p>}
        {opened
          ? <p>The Sun came back to the degree it held when you were born, and your birthday year began. The next return is {at(data.nextSolarReturn)}.</p>
          : <p>The Sun comes back to the degree it held when you were born, and your next birthday year begins. The return after it is {at(data.nextSolarReturn)}.</p>}
        <p><a href="/solar-return/">Cast the full solar return chart</a></p>
      </section>

      <section class="tile br__part">
        <h3>{scoreTitle(data.solarReturn, now)}</h3>
        <p class="br__big">{data.year.score.toFixed(1)}/10 <span class="br__tier">{tier.label}</span></p>
        <p>{tier.summary}</p>
        {data.year.best && data.year.hardest && <p>Strongest month: {monthName(data.year.best.month)}. Most pressure: {monthName(data.year.hardest.month)}. From {dayName(data.year.from)}.</p>}
        {yearScoreLink && <p><a href="/year-score/">See the months and the transits behind it</a></p>}
      </section>

      <section class="tile br__part">
        <h3>Numerology: Personal Year {data.personalYear} ({data.calendarYear})</h3>
        <p>{PERSONAL_YEAR_MEANINGS[data.personalYear as SingleDigit]}</p>
        {lifePath && <p>Your Life Path is {data.lifePath}, {lifePath.name.toLowerCase()}: {lifePath.keywords.join(', ')}.</p>}
        <p><a href="/numerology/">Work out every number from your name too</a></p>
      </section>

      <section class="tile br__part">
        <h3>Tarot year card: {data.card.numeral} {data.cardTitle}</h3>
        <p>{data.card.year}</p>
        <p class="br__note">The year card adds your birthday’s month and day to {data.calendarYear} and reduces the total to a Major Arcana card, as tarot readers do.</p>
      </section>

      <p class="br__note">Astrology, numerology and tarot are separate traditions; this page reads each on its own terms.</p>
      <div class="calc__actions">
        {state.share && <a class="btn btn--primary" href={state.share}><span>Share my birthday report</span><span class="orb">↗</span></a>}
      </div>
    </div>
  );
}

/** `yearScoreLink`: the page passes whether /year-score/ is switched on (src/lib/launch-flags.ts); the island runs in the browser. */
export default function BirthdayReport({ yearScoreLink = false }: { yearScoreLink?: boolean } = {}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [city, setCity] = useState<City | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [report, setReport] = useState<ReportState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  function invalidate() { generation.current++; setBusy(false); setReport(null); setError(''); }

  async function compute(event: Event) {
    event.preventDefault();
    if (!date || busy) return;
    const run = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || date < '1800-01-01') { setError('Enter a birth date from 1800 on.'); return; }
      if (underAge(date, today, 13)) { setError(UNDER_13); return; }
      const placed = showDetail && city ? city : null;
      const [module] = await Promise.all([loadReport(), placed ? prepareLocalTime(date, placed.tz) : null]);
      if (run !== generation.current) return;
      // Without a birth time the report is cast from 12:00 UTC on the birth date, place or no place, as /solar-return/ is.
      const { birthUtc, timeKnown, sunEnds } = module.reportInstants({ date, time: time || null, place: placed ? { tz: placed.tz, lon: placed.lon } : null }, { resolveLocalToUtc });
      setReport(openReport(module, { utc: birthUtc, date, timeKnown, sunEnds }, timeKnown && placed ? placed.tz : null, new Date(), location.origin));
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch (err) {
      if (run !== generation.current) return;
      setError('The report could not be calculated. Check the date and try again.');
      console.error(err);
    } finally {
      if (run === generation.current) setBusy(false);
    }
  }

  /** Recalculates the report on this device for the other birthday year; nothing is sent. */
  async function choose(which: BirthdayYear) {
    if (!report || which === report.which || busy) return;
    const run = ++generation.current;
    try {
      const module = await loadReport();
      if (run !== generation.current) return;
      setReport(switchYear(module, report, which, location.origin));
    } catch (err) {
      if (run !== generation.current) return;
      setError('The report could not be calculated. Check the date and try again.');
      console.error(err);
    }
  }

  return (
    <div class="calc" data-birthday-report>
      <form class="calc__form shell" onSubmit={compute} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <div class="field">
              <label class="field__label" for="br-date">Birth date</label>
              <input id="br-date" class="field__input" type="date" required min="1800-01-01" value={date} onFocus={() => { void loadReport(); }} onInput={(e) => { invalidate(); setDate((e.target as HTMLInputElement).value); }} />
              <p class="field__help">A date alone is enough. A birth time and place set the solar return on your birthplace's clock and add the Moon to the score. A birthplace is used only with a birth time.</p>
            </div>
          </div>
          {!showDetail ? (
            <button class="ys__more" type="button" onClick={() => { invalidate(); setShowDetail(true); }}>Add birth time and place</button>
          ) : (
            <div class="calc__fields">
              <div class="field">
                <label class="field__label" for="br-time">Birth time</label>
                <input id="br-time" class="field__input" type="time" value={time} onInput={(e) => { invalidate(); setTime((e.target as HTMLInputElement).value); }} />
              </div>
              <div class="field">
                <label class="field__label" for="br-place">Birthplace</label>
                <PlaceSearch id="br-place" selected={city} onSelect={(value) => { invalidate(); setCity(value); }} locale="en" />
              </div>
            </div>
          )}
          <button class="btn btn--primary calc__submit" type="submit" disabled={!date || busy}>
            {/* Both labels share one cell, so the button keeps its width while it calculates. */}
            <span class="br__submit" data-busy={busy ? 'true' : 'false'}><span>Make my birthday report</span><span>Calculating</span></span><span class="orb">↗</span>
          </button>
          <p class="calc__privacy">Calculated on your device. Your birth details are not sent or saved.</p>
          {error && <p class="calc__error" role="alert">{error}</p>}
        </div>
      </form>

      <div class="br" style={report ? `--sign:${report.data.hue}` : undefined}>
        <YearChoice state={report} onChoose={(which) => { void choose(which); }} />
        {report
          ? <ReportResult state={report} yearScoreLink={yearScoreLink} headingRef={headingRef} />
          // Held from the click, inside its input window, so a result that arrives late fills space already taken.
          : busy && <div class="br__pending" aria-hidden="true" />}
      </div>
    </div>
  );
}
