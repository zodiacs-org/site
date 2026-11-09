/**
 * The good day finder: a goal and a window of up to a year, and the best days
 * in it by traditional electional astrology, with the days to avoid. Worked
 * out on the device behind a lazy import of src/lib/good-days/find.ts, the
 * same module the hosted find_good_days tool runs.
 *
 * Privacy: an optional birth date is used for the one search and kept only in
 * this component's memory. Nothing is written to the address bar, to storage
 * or to analytics, and nothing is sent anywhere. A birth date under 13 is
 * refused by the finder before anything is worked out.
 */
import { useRef, useState } from 'preact/hooks';
import { GOAL_RULES, GOOD_DAY_GOALS, type GoodDayGoal } from '../lib/good-days/goals';
import type { GoodDaysResult } from '../lib/good-days/find';

const loadFinder = () => Promise.all([import('../lib/good-days/find'), import('../lib/occasions/site-clock')]);
/** The label the site's forecasts carry for a dated reading (src/ai-tools/reading-confidence.ts). */
const CONFIDENCE_LABEL = 'Reading confidence 55%';

const DAY = 86_400_000;
function localToday(zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)!.value).join('-');
}
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
/** The latest birth date that is 13 today, for the field's max. */
const thirteenYearsAgo = (today: string) => `${String(Number(today.slice(0, 4)) - 13).padStart(4, '0')}${today.slice(4)}`;

function browserZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export default function GoodDayFinder() {
  const zone = useRef(browserZone()).current;
  const today = useRef(localToday(zone)).current;
  const [goal, setGoal] = useState<GoodDayGoal>('launch');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 89));
  const [personal, setPersonal] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GoodDaysResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function submit(event: Event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    // Let the busy state paint before a long window is worked out.
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const [{ findGoodDays }, { SITE_CLOCK }] = await loadFinder();
      const found = await findGoodDays({
        goal, from, to, zone, today,
        birth: personal && birthDate ? { date: birthDate } : null,
      }, SITE_CLOCK);
      setResult(found);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (cause) {
      setResult(null);
      setError(cause instanceof RangeError ? cause.message : 'The days could not be worked out. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function clearBirth() {
    setPersonal(false);
    setBirthDate('');
  }

  return (
    <div class="calc good-days">
      <form class="calc__form shell" onSubmit={submit} aria-busy={busy}>
        <div class="core calc__core">
          <div class="calc__fields">
            <div class="field">
              <label class="field__label" for="gd-goal">What the day is for</label>
              <select id="gd-goal" class="field__input" value={goal} onChange={(event) => setGoal((event.target as HTMLSelectElement).value as GoodDayGoal)}>
                {GOOD_DAY_GOALS.map((key) => <option value={key} key={key}>{GOAL_RULES[key].label}</option>)}
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="gd-from">From</label>
              <input id="gd-from" class="field__input" type="date" required min="2026-01-01" max="2030-12-31" value={from}
                onInput={(event) => setFrom((event.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field__label" for="gd-to">To</label>
              <input id="gd-to" class="field__input" type="date" required min="2026-01-01" max="2030-12-31" value={to}
                onInput={(event) => setTo((event.target as HTMLInputElement).value)} />
              <p class="field__help">Up to twelve months. A year takes a few seconds to work out.</p>
            </div>
            <div class="field">
              <label class="field__label good-days__check">
                <input type="checkbox" checked={personal} onChange={(event) => ((event.target as HTMLInputElement).checked ? setPersonal(true) : clearBirth())} />
                Include my own chart <span class="field__optional">optional</span>
              </label>
              {personal && (
                <>
                  <label class="field__label" for="gd-birth">Your birth date</label>
                  <input id="gd-birth" class="field__input" type="date" min="1800-01-01" max={thirteenYearsAgo(today)} value={birthDate} autocomplete="off"
                    onInput={(event) => setBirthDate((event.target as HTMLInputElement).value)} />
                  <p class="field__help">Used for this search only, on your device. It is not saved, sent or put in the link. For people 13 and over.</p>
                </>
              )}
            </div>
          </div>
          <button class="btn btn--primary calc__submit" type="submit" disabled={busy || !from || !to}>
            {busy ? 'Working out the days' : 'Find good days'}
          </button>
          <p class="calc__privacy">Worked out on your device. Nothing you enter is stored. Days and times are on your clock ({zone}).</p>
          {error && <p class="calc__error" role="alert">{error}</p>}
        </div>
      </form>

      {result && (
        <div class="calc__result good-days__result" ref={resultRef} tabIndex={-1} aria-label={`Good days: ${result.goalLabel}`}>
          <h2 class="good-days__title">{result.goalLabel}: the best days</h2>
          <p class="good-days__sub">{result.best.length ? `${result.days} days read, ${result.from} to ${result.to}.` : 'No good day in this window.'} {CONFIDENCE_LABEL}.</p>
          <ol class="good-days__list">
            {result.best.map((day) => (
              <li class="tile good-days__day" key={day.date}>
                <p class="good-days__date"><strong>{day.label}</strong> <span class="good-days__score">{day.score}/100</span></p>
                <p class="good-days__verdict">{day.verdict}. {day.reason}</p>
                {day.voidOfCourse.length > 0 && (
                  <p class="field__help">Moon void of course: {day.voidOfCourse.map((span) => `${span.from} to ${span.to}`).join('; ')}.</p>
                )}
                <details class="good-days__why">
                  <summary>Every reason</summary>
                  <ul>{day.factors.map((line) => <li key={line}>{line}</li>)}</ul>
                </details>
              </li>
            ))}
          </ol>

          {result.avoid.length > 0 && (
            <>
              <h3 class="good-days__head">Days to avoid</h3>
              <ul class="good-days__avoid">
                {result.avoid.map((day) => <li key={day.date}><strong>{day.label}</strong>: {day.reason}</li>)}
              </ul>
            </>
          )}
          {result.periods.length > 0 && (
            <>
              <h3 class="good-days__head">In this window</h3>
              <ul class="good-days__avoid">
                {result.periods.map((period) => <li key={`${period.kind}-${period.from}`}>{period.line}</li>)}
              </ul>
            </>
          )}
          {result.messages.map((line) => <p class="field__help" key={line}>{line}</p>)}
          <p class="good-days__care">{result.care}</p>
          <p class="field__help">{result.note}</p>
        </div>
      )}
    </div>
  );
}
