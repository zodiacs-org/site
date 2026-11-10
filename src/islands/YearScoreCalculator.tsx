/**
 * Year Ahead Score calculator: a birth date in, a 0 to 10 score for the next
 * twelve months out, with the best and hardest months and the slow-planet
 * transits behind the number. The engine and the scorer lazy-load together
 * on submit and everything is calculated on this device; the birth details
 * are never sent, stored or put in the address bar.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import PlaceSearch from './PlaceSearch';
import { signForLongitude } from '../lib/signs';
import { prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import type { City } from '../lib/geo/search';
import { createModuleLoader } from '../lib/module-load';
import { dayName, shortMonth, yearReading, type YearReading } from '../lib/year-score/reading';

const loadScorer = createModuleLoader(() => import('../lib/year-score/browser'));

// Islands never import the assistant tools (the compute privacy test holds that), so the two age rules and the
// reading-confidence rule of src/ai-tools/reading-confidence.ts are restated here, with the same cutoffs.
const underAge = (birthDate: string, today: string, years: number) => birthDate > `${String(Number(today.slice(0, 4)) - years).padStart(4, '0')}${today.slice(4)}`;
/** Under 18, the one romantic phrase a slow-planet line can carry (Venus as "way of loving") is left out. */
const softenMinor = (text: string) => text.replace(/\bway of loving\b/gu, 'way of caring');
const confidenceLabel = (timed: boolean) => `Reading confidence ${timed ? 70 : 55}%`;

const UNDER_13 = 'Zodiacs is not directed at children under 13, so it gives no score for a birth date less than 13 years ago.';

interface Result {
  reading: YearReading;
  sign: { name: string; hue: string };
  from: string;
  to: string;
  confidence: string;
  timeKnown: boolean;
}

export default function YearScoreCalculator() {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [city, setCity] = useState<City | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);

  function invalidate() { generation.current++; setBusy(false); setResult(null); setError(''); }

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
      const [scorer] = await Promise.all([loadScorer(), placed ? prepareLocalTime(date, city.tz) : null]);
      if (run !== generation.current) return;
      const timeKnown = !!(placed && time);
      const utc = placed ? resolveLocalToUtc(date, time || '12:00', city.tz, { longitude: city.lon }).utc : new Date(`${date}T12:00:00Z`);
      const { year, sunLon } = scorer.scoreBirth(utc, timeKnown, new Date(`${today}T00:00:00Z`));
      const sign = signForLongitude(sunLon);
      const guard = underAge(date, today, 18) ? softenMinor : (text: string) => text;
      setResult({
        reading: yearReading(year, guard),
        sign: { name: sign.name, hue: sign.hue },
        from: year.from,
        to: year.to,
        confidence: confidenceLabel(timeKnown && !!placed),
        timeKnown,
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
      <form class="calc__form shell" onSubmit={compute} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <div class="field">
              <label class="field__label" for="ys-date">Birth date</label>
              <input id="ys-date" class="field__input" type="date" required min="1800-01-01" value={date}
                onFocus={() => { void loadScorer(); }}
                onInput={(e) => { invalidate(); setDate((e.target as HTMLInputElement).value); }} />
              <p class="field__help">A date alone is enough. A birth time and place add the Moon.</p>
            </div>
          </div>
          {!showDetail ? (
            <button class="ys__more" type="button" onClick={() => { invalidate(); setShowDetail(true); }}>Add birth time and place</button>
          ) : (
            <div class="calc__fields">
              <div class="field">
                <label class="field__label" for="ys-time">Birth time</label>
                <input id="ys-time" class="field__input" type="time" value={time} onInput={(e) => { invalidate(); setTime((e.target as HTMLInputElement).value); }} />
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
        <div class="calc__result ys" style={`--sign:${result.sign.hue}`}>
          <div class="ys__score shell tinted" style={`--sign:${result.sign.hue}`}>
            <div class="core tinted ys__score-core">
              <h2 class="ys__heading" tabIndex={-1} ref={headingRef}>
                <span class="ys__number">{result.reading.score.toFixed(1)}</span><span class="ys__outof">/10</span>
              </h2>
              <p class="ys__tier">{result.reading.tier.label}</p>
              <p class="ys__summary">{result.reading.tier.summary}</p>
              <p class="ys__meta">{result.sign.name} Sun · {dayName(result.from)} to {dayName(result.to)} · {result.confidence}</p>
            </div>
          </div>

          <ol class="ys__months" aria-label="Score by month">
            {result.reading.months.map((month) => (
              <li key={month.month} class="ys__month" title={`${month.name}: ${month.score.toFixed(1)}`}>
                <span class="ys__bar" style={`--h:${Math.max(4, month.score * 10)}%`} aria-hidden="true" />
                <span class="ys__month-label">{shortMonth(month.month)}</span>
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
                    <strong>{driver.title}</strong> <span class="ys__tone">{driver.tone === 'support' ? 'support' : 'pressure'}, {Math.round(driver.share * 100)}% of the year</span>
                    <p>{driver.line}</p>
                    <p class="ys__when">In orb {dayName(driver.inOrbFrom)} to {dayName(driver.inOrbTo)}, closest {dayName(driver.peak)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!result.timeKnown && <p class="field__help">Without a birth time and place the Moon is left out; the other contacts can shift by about a day.</p>}
          <div class="calc__actions">
            <a class="btn btn--ghost" href="/transits/"><span>See every transit to your chart</span><span class="orb">↗</span></a>
          </div>
        </div>
      )}
    </div>
  );
}
