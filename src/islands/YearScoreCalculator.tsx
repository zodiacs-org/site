/**
 * Year Ahead Score calculator: a birth date in, a 0 to 10 score for the next
 * twelve months out, with the best and hardest months and the slow-planet
 * transits behind the number. The engine and the scorer lazy-load together
 * on submit and everything is calculated on this device; the birth details
 * are never sent, stored or put in the address bar.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import PlaceSearch from './PlaceSearch';
import { SIGNS, signForLongitude } from '../lib/signs';
import { birthDayEnvelope, settledSunSign } from '../lib/sun-settled';
import { prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import type { City } from '../lib/geo/search';
import { createModuleLoader } from '../lib/module-load';
import { birthDayEnds, rangeWorthShowing, untimedScoreNote, type ScoreRange } from '../lib/year-score/range';
import { yearScoreShareUrl } from '../lib/year-score/share';
import { dayName, shortMonth, yearReading, type YearReading } from '../lib/year-score/reading';

const loadScorer = createModuleLoader(() => import('../lib/year-score/browser'));

// Islands never import the assistant tools (the compute privacy test holds that), so the two age rules and the
// reading-confidence rule of src/ai-tools/reading-confidence.ts are restated here, with the same cutoffs.
const underAge = (birthDate: string, today: string, years: number) => birthDate > `${String(Number(today.slice(0, 4)) - years).padStart(4, '0')}${today.slice(4)}`;
/** Under 18, the one romantic phrase a slow-planet line can carry (Venus as "way of loving") is left out. */
const softenMinor = (text: string) => text.replace(/\bway of loving\b/gu, 'way of caring');
const confidenceLabel = (timed: boolean) => `Reading confidence ${timed ? 70 : 55}%`;

const UNDER_13 = 'Zodiacs is not directed at children under 13, so it gives no score for a birth date less than 13 years ago.';
const FUTURE_DATE = 'Enter a birth date in the past.';
const TIME_NEEDS_PLACE = 'Add the birthplace to use the birth time, or clear the time.';
const TIME_INCOMPLETE = 'Enter the full birth time, or clear the time.';

interface Result {
  reading: YearReading;
  /** The Sun sign, null when an untimed birth day starts and ends in different signs (then `candidates` names both). */
  sign: { name: string; slug: string } | null;
  candidates: string[];
  /** The tint: the sign of the chart the score was read from. */
  hue: string;
  from: string;
  to: string;
  confidence: string;
  timeKnown: boolean;
  /** Without a birth time: the lowest and highest score across the birth day. Null with a birth time. */
  range: ScoreRange | null;
}

export default function YearScoreCalculator() {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [city, setCity] = useState<City | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // A birth time is used only when complete and with a birthplace (its zone); otherwise submit is refused and the note
  // under the time says why. The form is noValidate (for the site's own date sentences), so an incomplete time, which
  // leaves the field's value empty, is caught here from the field's own validity rather than by the browser.
  const [timeNote, setTimeNote] = useState('');
  const timeRef = useRef<HTMLInputElement>(null);
  // Today's date as the date field's latest, set after hydration so the built page never carries the build day.
  const [maxDate, setMaxDate] = useState<string | undefined>(undefined);
  useEffect(() => { setMaxDate(new Date().toISOString().slice(0, 10)); }, []);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);

  function invalidate() { generation.current++; setBusy(false); setResult(null); setError(''); setTimeNote(''); }

  async function compute(event: Event) {
    event.preventDefault();
    if (!date || busy) return;
    const run = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || date < '1800-01-01') { setError('Enter a birth date from 1800 on.'); return; }
      if (date > today) { setError(FUTURE_DATE); return; }
      if (underAge(date, today, 13)) { setError(UNDER_13); return; }
      if (showDetail && timeRef.current && !timeRef.current.validity.valid) { setTimeNote(TIME_INCOMPLETE); return; }
      if (showDetail && time && !city) { setTimeNote(TIME_NEEDS_PLACE); return; }
      const placed = showDetail && city;
      const [scorer] = await Promise.all([loadScorer(), placed ? prepareLocalTime(date, city.tz) : null]);
      if (run !== generation.current) return;
      const timeKnown = !!(placed && time);
      const utc = placed ? resolveLocalToUtc(date, time || '12:00', city.tz, { longitude: city.lon }).utc : new Date(`${date}T12:00:00Z`);
      // Without a birth time, the birth day's two ends: local midnight to 23:59 with a place, every clock's version of the date without.
      let local: [Date, Date] | null | undefined;
      if (!timeKnown && placed) {
        try {
          local = [resolveLocalToUtc(date, '00:00', city.tz, { longitude: city.lon }).utc, resolveLocalToUtc(date, '23:59', city.tz, { longitude: city.lon }).utc];
        } catch {
          local = null;
        }
      }
      const day = timeKnown ? undefined : birthDayEnds(date, utc, local);
      const { year, sunLon, range } = scorer.scoreBirth(utc, timeKnown, new Date(`${today}T00:00:00Z`), day);
      // The Sun sign is the birth day's only when both ends of the day agree: the birthplace clock's 00:00 and 23:59
      // (midday plus and minus 12 hours if either does not resolve), or every clock's version of the date.
      const ends: [Date, Date] = timeKnown ? [utc, utc] : placed ? day! : birthDayEnvelope(date);
      const settled = settledSunSign(ends, scorer.sunLonAt);
      const guard = underAge(date, today, 18) ? softenMinor : (text: string) => text;
      setResult({
        reading: yearReading(year, guard),
        sign: settled.sign === null ? null : { name: SIGNS[settled.sign].name, slug: SIGNS[settled.sign].slug },
        candidates: settled.candidates.map((index) => SIGNS[index].name),
        hue: signForLongitude(sunLon).hue,
        from: year.from,
        to: year.to,
        confidence: confidenceLabel(timeKnown && !!placed),
        timeKnown,
        range,
      });
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch (err) {
      if (run !== generation.current) return;
      setError('The score could not be calculated. Check the date and try again.');
      console.error(err);
    } finally {
      if (run === generation.current) setBusy(false);
    }
  }

  return (
    <div class="calc" data-year-score-calculator>
      <form class="calc__form shell" onSubmit={compute} aria-busy={busy} noValidate>
        <div class="core calc__core">
          <div class="calc__fields">
            <div class="field">
              <label class="field__label" for="ys-date">Birth date</label>
              <input id="ys-date" class="field__input" type="date" required min="1800-01-01" max={maxDate} value={date}
                onFocus={() => { void loadScorer(); }}
                onInput={(e) => { invalidate(); setDate((e.target as HTMLInputElement).value); }} />
              <p class="field__help">A date alone gives a first reading. A birth time and place settle it and add the Moon.</p>
            </div>
          </div>
          {!showDetail ? (
            <button class="ys__more" type="button" onClick={() => { invalidate(); setShowDetail(true); }}>Add birth time and place</button>
          ) : (
            <div class="calc__fields">
              <div class="field">
                <label class="field__label" for="ys-time">Birth time</label>
                <input id="ys-time" ref={timeRef} class="field__input" type="time" value={time} aria-invalid={!!timeNote || undefined} aria-describedby={timeNote ? 'ys-time-note' : undefined}
                  onInput={(e) => { invalidate(); setTime((e.target as HTMLInputElement).value); }} />
                {/* The hidden copy holds the note's height from the start, so showing the note moves nothing. */}
                <p class="field__help ys__time-note">
                  <span class="ys__time-note-space" aria-hidden="true">{TIME_NEEDS_PLACE}</span>
                  <span id="ys-time-note" role="alert">{timeNote}</span>
                </p>
              </div>
              <div class="field">
                <label class="field__label" for="ys-place">Birthplace</label>
                <PlaceSearch id="ys-place" selected={city} onSelect={(value) => { invalidate(); setCity(value); }} locale="en" />
              </div>
            </div>
          )}
          <button class="btn btn--primary calc__submit" type="submit" disabled={!date || busy}>
            <span>{busy ? 'Calculating' : 'Score my year'}</span>
            <span class="orb">↗</span>
          </button>
          <p class="calc__privacy">Calculated on your device. Your birth details are not sent or saved.</p>
          {error && <p class="calc__error" role="alert">{error}</p>}
        </div>
      </form>

      {result && (
        <div class="calc__result ys" style={`--sign:${result.hue}`}>
          <div class="ys__score shell tinted" style={`--sign:${result.hue}`}>
            <div class="core tinted ys__score-core">
              <h2 class="ys__heading" tabIndex={-1} ref={headingRef}>
                <span class="sr-only">Your Year Ahead Score: </span><span class="ys__number">{result.reading.score.toFixed(1)}</span><span class="ys__outof" aria-hidden="true">/10</span><span class="sr-only"> out of 10</span>
              </h2>
              <p class="ys__tier">{result.reading.tier.label}</p>
              {rangeWorthShowing(result.range) && (
                <p class="ys__range">Without a birth time this could be anywhere from {result.range.low.toFixed(1)} to {result.range.high.toFixed(1)}. Add your birth time and place to settle it.</p>
              )}
              <p class="ys__summary">{result.reading.tier.summary}</p>
              {result.sign
                ? <p class="ys__meta">{result.sign.name} Sun · {dayName(result.from)} to {dayName(result.to)} · {result.confidence}</p>
                : <>
                  <p class="ys__meta" data-ys-sun-unsettled>Your Sun is in {result.candidates[0]} or {result.candidates[1]}: a birth time settles it.</p>
                  <p class="ys__meta">{dayName(result.from)} to {dayName(result.to)} · {result.confidence}</p>
                </>}
            </div>
          </div>

          <ol class="ys__months" aria-label="Score by month">
            {result.reading.months.map((month, index) => (
              <li key={month.month} class="ys__month" title={`${month.name}: ${month.score.toFixed(1)}`}>
                <span class="ys__bar" style={`--h:${Math.max(4, month.score * 10)}%`} aria-hidden="true" />
                {/* The strip can hold the same month twice, a year apart, so the year shows under the first month and each January. */}
                <span class="ys__month-label" aria-hidden="true">{shortMonth(month.month)}<span class="ys__month-year">{index === 0 || month.month.endsWith('-01') ? `’${month.month.slice(2, 4)}` : '\u00a0'}</span></span>
                <span class="sr-only">{month.name}: {month.score.toFixed(1)} out of 10</span>
              </li>
            ))}
          </ol>

          <div class="ys__picks">
            {result.reading.best && <div class="tile"><h3>Best month</h3><p>{result.reading.best.line}</p></div>}
            {result.reading.hardest && <div class="tile"><h3>Hardest month</h3><p>{result.reading.hardest.line}</p></div>}
          </div>

          {result.reading.drivers.length > 0 && (
            <div class="ys__drivers">
              <h3>What moves the number</h3>
              <ul>
                {result.reading.drivers.map((driver) => (
                  <li key={driver.title}>
                    <strong>{driver.title}</strong> <span class="ys__tone">{driver.tone}, {Math.round(driver.share * 100)}% of the year</span>
                    <p>{driver.line}</p>
                    <p class="ys__when">In orb {dayName(driver.inOrbFrom)} to {dayName(driver.inOrbTo)}, closest {dayName(driver.peak)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!result.timeKnown && <p class="field__help">{untimedScoreNote(result.range)}</p>}
          <div class="calc__actions">
            {(() => {
              // The link carries the Sun sign and the score only: never the birth date, time or place. No settled sign, no link.
              const share = result.sign ? yearScoreShareUrl(location.origin, { sun: result.sign.slug, score: result.reading.score }) : null;
              return share ? <a class="btn btn--primary" href={share}><span>Share your score</span><span class="orb">↗</span></a> : null;
            })()}
            <a class="btn btn--ghost" href="/transits/"><span>See every transit to your chart</span><span class="orb">↗</span></a>
          </div>
        </div>
      )}
    </div>
  );
}
