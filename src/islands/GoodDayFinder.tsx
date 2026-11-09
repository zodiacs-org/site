/**
 * The good day finder: a goal and a window of up to a year, and the best days
 * in it by traditional electional astrology, with the days to avoid. Worked
 * out on the device behind a lazy import of src/lib/good-days/find.ts, the
 * same module the hosted find_good_days tool runs.
 *
 * Sharing: the share card and its link carry the goal and the two dates only,
 * after the # (which browsers do not send to a server). Opening the link runs
 * the general reading for those dates; a birth date is never in it.
 *
 * Privacy: an optional birth date is used for the one search and kept only in
 * this component's memory. Nothing is written to the address bar, to storage
 * or to analytics, and nothing is sent anywhere. A birth date under 13 is
 * refused by the finder before anything is worked out.
 *
 * Layout: results fill a slot under the form. The slot takes a full screen of
 * height from the moment of the click (or, for a shared link, from first
 * paint, by the class the page's head script sets), so the days arriving
 * never move anything on screen.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { GOAL_RULES, GOOD_DAY_GOALS, type GoodDayGoal } from '../lib/good-days/goals';
import type { GoodDaysResult } from '../lib/good-days/find';

const loadFinder = () => Promise.all([import('../lib/good-days/find'), import('../lib/occasions/site-clock')]);
/** The label the site's forecasts carry for a dated reading (src/ai-tools/reading-confidence.ts). */
const CONFIDENCE_LABEL = 'Reading confidence 55%';
const DATE = /^20[23]\d-\d{2}-\d{2}$/u;
/** The goal's headline on the share card. */
const CARD_TITLE: Readonly<Record<GoodDayGoal, string>> = {
  launch: 'Good days to launch',
  contract: 'Good days to sign a contract',
  move: 'Good days to move home',
  relationship: 'Good days to start something new together',
  travel: 'Good days to travel',
  job: 'Good days to start a new job',
  wedding: 'Good days for a wedding',
};

const DAY = 86_400_000;
function localToday(zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)!.value).join('-');
}
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
/** The latest birth date that is 13 today, for the field's max. */
const thirteenYearsAgo = (today: string) => `${String(Number(today.slice(0, 4)) - 13).padStart(4, '0')}${today.slice(4)}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

function browserZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

/** The share link: the goal and the dates after the #, and nothing else. */
export function goodDaysLink(origin: string, goal: GoodDayGoal, from: string, to: string): string {
  return `${origin}/good-days/#g=${goal}&f=${from}&t=${to}`;
}

/** A shared link's goal and dates, read by hand so nothing but these three keys is ever taken from it. */
export function readGoodDaysLink(hash: string): { goal: GoodDayGoal; from: string; to: string } | null {
  const fields: Record<string, string> = {};
  for (const part of hash.replace(/^#/u, '').split('&')) {
    const [key, value] = part.split('=');
    if (key && value !== undefined && (key === 'g' || key === 'f' || key === 't')) fields[key] = value;
  }
  const goal = GOOD_DAY_GOALS.find((name) => name === fields.g);
  if (!goal || !DATE.test(fields.f ?? '') || !DATE.test(fields.t ?? '')) return null;
  return { goal, from: fields.f, to: fields.t };
}

export default function GoodDayFinder() {
  const [zone] = useState(browserZone);
  const [today] = useState(() => localToday(browserZone()));
  const [goal, setGoal] = useState<GoodDayGoal>('launch');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 89));
  const [personal, setPersonal] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [reserved, setReserved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GoodDaysResult | null>(null);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  async function run(input: { goal: GoodDayGoal; from: string; to: string; birth: string | null }, focus: boolean) {
    setBusy(true);
    setReserved(true);
    setError(null);
    // Let the busy state paint before a long window is worked out.
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const [{ findGoodDays }, { SITE_CLOCK }] = await loadFinder();
      const found = await findGoodDays({ goal: input.goal, from: input.from, to: input.to, zone, today, birth: input.birth ? { date: input.birth } : null }, SITE_CLOCK);
      setResult(found);
      if (focus) requestAnimationFrame(() => resultRef.current?.focus({ preventScroll: false }));
    } catch (cause) {
      setResult(null);
      setError(cause instanceof RangeError ? cause.message : 'The days could not be worked out. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const shared = readGoodDaysLink(window.location.hash);
    if (!shared) return;
    setGoal(shared.goal);
    setFrom(shared.from);
    setTo(shared.to);
    void run({ ...shared, birth: null }, false);
  }, []);

  function submit(event: Event) {
    event.preventDefault();
    void run({ goal, from, to, birth: personal && birthDate ? birthDate : null }, true);
  }

  function clearBirth() {
    setPersonal(false);
    setBirthDate('');
  }

  const link = result ? goodDaysLink(window.location.origin, result.goal, result.from, result.to) : '';
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('The link could not be copied. Select it below and copy it instead.');
    }
  }
  async function shareLink() {
    if (!result) return;
    try { await navigator.share({ title: CARD_TITLE[result.goal], url: link }); } catch { /* closed by the person */ }
  }
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

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
            <div class="good-days__dates">
              <div class="field">
                <label class="field__label" for="gd-from">From</label>
                <input id="gd-from" class="field__input" type="date" required min="2026-01-01" max="2030-12-31" value={from}
                  onInput={(event) => setFrom((event.target as HTMLInputElement).value)} />
              </div>
              <div class="field">
                <label class="field__label" for="gd-to">To</label>
                <input id="gd-to" class="field__input" type="date" required min="2026-01-01" max="2030-12-31" value={to}
                  onInput={(event) => setTo((event.target as HTMLInputElement).value)} />
              </div>
              <p class="field__help">Up to twelve months, from 2026 to 2030. A whole year takes a few seconds to work out.</p>
            </div>
            <div class="field good-days__personal">
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
          <p class="calc__privacy">Worked out on your device. Nothing you enter is stored. Days and times are on your device’s clock.</p>
        </div>
      </form>

      <div class="good-days__slot" data-reserved={reserved ? 'true' : undefined} aria-live="polite">
        {error && <p class="calc__error" role="alert">{error}</p>}
        {busy && !result && <p class="good-days__busy">Reading every day in the window…</p>}
        {result && (
          <div class="calc__result good-days__result" ref={resultRef} tabIndex={-1} aria-label={`Good days: ${result.goalLabel}`}>
            <h2 class="good-days__title">{result.goalLabel}: the best days</h2>
            <p class="good-days__sub">{result.days} days read, {shortDay(result.from)} to {shortDay(result.to)}, on {result.zone === 'UTC' ? 'UTC' : `your clock (${result.zone})`}. {CONFIDENCE_LABEL}.</p>
            <ol class="good-days__list">
              {result.best.map((day, index) => (
                <li class="tile good-days__day" key={day.date}>
                  <p class="good-days__date"><span class="good-days__rank">{index + 1}</span><strong>{day.label}</strong> <span class="good-days__score">{day.score}/100</span></p>
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

            <h3 class="good-days__head">Share these days</h3>
            <figure class="good-days-card" aria-label={CARD_TITLE[result.goal]}>
              <p class="kicker good-days-card__kicker">{shortDay(result.from)} to {shortDay(result.to)}</p>
              <p class="good-days-card__title">{CARD_TITLE[result.goal]}</p>
              <ol class="good-days-card__days">
                {result.best.slice(0, 3).map((day) => (
                  <li key={day.date}><span>{day.label}</span><span class="good-days-card__score">{day.score}</span></li>
                ))}
              </ol>
              <p class="good-days-card__note">Read by the traditional rules of electional astrology.</p>
              <figcaption class="good-days-card__foot">zodiacs.org/good-days</figcaption>
            </figure>
            <div class="calc__actions good-days__actions">
              <button type="button" class="btn" onClick={copyLink}>{copied ? 'Link copied' : 'Copy the link'}</button>
              {canShare && <button type="button" class="btn" onClick={shareLink}>Share</button>}
              <button type="button" class="btn" onClick={() => window.print()}>Print the card</button>
            </div>
            <p class="field__help">The link opens this page with the same goal and dates, worked out from the sky alone. {result.personal ? 'Your birth date is not in it.' : 'It carries nothing else.'}</p>
            <p class="good-days__link"><code>{link}</code></p>
          </div>
        )}
      </div>
    </div>
  );
}
