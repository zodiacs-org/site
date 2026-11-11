/**
 * The Birthday report: a birth date in, four readings for the birthday year
 * out (src/lib/birthday-report/report.ts), with a share link that carries the
 * Sun sign, the score, the Personal Year and the card number only. The engine
 * lazy-loads on submit and everything is calculated on this device; the
 * birth details are never sent, stored or put in the address bar.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import PlaceSearch from './PlaceSearch';
import { prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import type { City } from '../lib/geo/search';
import { createModuleLoader } from '../lib/module-load';
import { dayName, monthName, scoreTier } from '../lib/year-score/reading';
import { birthdayReportShareUrl } from '../lib/birthday-report/share';
import { NUMBER_MEANINGS, PERSONAL_YEAR_MEANINGS, type CoreNumber, type SingleDigit } from '../data/numerology-meanings';
import type { BirthdayReport as Report } from '../lib/birthday-report/report';

const loadReport = createModuleLoader(() => import('../lib/birthday-report/report'));
// Islands never import the assistant tools, so the age rule is restated here with the same cutoff.
const underAge = (birthDate: string, today: string, years: number) => birthDate > `${String(Number(today.slice(0, 4)) - years).padStart(4, '0')}${today.slice(4)}`;
const UNDER_13 = 'Zodiacs is not directed at children under 13, so it makes no report for a birth date less than 13 years ago.';

function clock(iso: string, zone: string | null): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone ?? 'UTC', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...(zone ? {} : { timeZoneName: 'short' }) }).format(new Date(iso));
}

/** `yearScoreLink`: the page passes whether /year-score/ is switched on (src/lib/launch-flags.ts); the island runs in the browser. */
export default function BirthdayReport({ yearScoreLink = false }: { yearScoreLink?: boolean } = {}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [city, setCity] = useState<City | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [report, setReport] = useState<{ data: Report; zone: string | null; share: string | null } | null>(null);
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
      const placed = showDetail && city;
      const [module] = await Promise.all([loadReport(), placed ? prepareLocalTime(date, city.tz) : null]);
      if (run !== generation.current) return;
      const timeKnown = !!(placed && time);
      const utc = placed ? resolveLocalToUtc(date, time || '12:00', city.tz, { longitude: city.lon }).utc : new Date(`${date}T12:00:00Z`);
      const data = module.birthdayReport(utc, date, timeKnown, new Date());
      const share = birthdayReportShareUrl(location.origin, { sun: data.sun.slug, score: data.year.score, personalYear: data.personalYear, card: data.card.number });
      setReport({ data, zone: placed ? city.tz : null, share });
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch (err) {
      if (run !== generation.current) return;
      setError('The report could not be calculated. Check the date and try again.');
      console.error(err);
    } finally {
      if (run === generation.current) setBusy(false);
    }
  }

  const data = report?.data;
  const lifePath = data ? NUMBER_MEANINGS[data.lifePath as CoreNumber] : null;
  return (
    <div class="calc" data-birthday-report>
      <form class="calc__form shell" onSubmit={compute} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <div class="field">
              <label class="field__label" for="br-date">Birth date</label>
              <input id="br-date" class="field__input" type="date" required min="1800-01-01" value={date} onFocus={() => { void loadReport(); }} onInput={(e) => { invalidate(); setDate((e.target as HTMLInputElement).value); }} />
              <p class="field__help">A date alone is enough. A birth time and place set the solar return on your clock and add the Moon to the score.</p>
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
            <span>{busy ? 'Calculating' : 'Make my birthday report'}</span><span class="orb">↗</span>
          </button>
          <p class="calc__privacy">Calculated on your device. Your birth details are not sent or saved.</p>
          {error && <p class="calc__error" role="alert">{error}</p>}
        </div>
      </form>

      {data && report && (
        <div class="calc__result br" style={`--sign:${data.sun.hue}`}>
          <h2 class="br__heading" tabIndex={-1} ref={headingRef}>Your birthday year, {data.sun.name} Sun</h2>

          <section class="tile br__part">
            <h3>Solar return</h3>
            <p class="br__big">{clock(data.solarReturn, report.zone)}</p>
            <p>The Sun came back to the degree it held when you were born, and your birthday year began. The next return is {clock(data.nextSolarReturn, report.zone)}.</p>
            <p><a href="/solar-return/">Cast the full solar return chart</a></p>
          </section>

          <section class="tile br__part">
            <h3>Year Ahead Score</h3>
            <p class="br__big">{data.year.score.toFixed(1)}/10 <span class="br__tier">{scoreTier(data.year.score).label}</span></p>
            <p>{scoreTier(data.year.score).summary}</p>
            {data.year.best && data.year.hardest && <p>Strongest month: {monthName(data.year.best.month)}. Most pressure: {monthName(data.year.hardest.month)}. From {dayName(data.year.from)}.</p>}
            {yearScoreLink && <p><a href="/year-score/">See the months and the transits behind it</a></p>}
          </section>

          <section class="tile br__part">
            <h3>Numerology: Personal Year {data.personalYear}</h3>
            <p>{PERSONAL_YEAR_MEANINGS[data.personalYear as SingleDigit]}</p>
            {lifePath && <p>Your Life Path is {data.lifePath}, {lifePath.name.toLowerCase()}: {lifePath.keywords.join(', ')}.</p>}
            <p><a href="/numerology/">Work out every number from your name too</a></p>
          </section>

          <section class="tile br__part">
            <h3>Tarot year card: {data.card.numeral} {data.card.name}</h3>
            <p>{data.card.year}</p>
            <p class="br__note">The year card adds your birthday’s month and day to {data.calendarYear} and reduces the total to a Major Arcana card, as tarot readers do.</p>
          </section>

          <p class="br__note">Astrology, numerology and tarot are separate traditions; this page reads each on its own terms.</p>
          <div class="calc__actions">
            {report.share && <a class="btn btn--primary" href={report.share}><span>Share my birthday report</span><span class="orb">↗</span></a>}
          </div>
        </div>
      )}
    </div>
  );
}
