/**
 * "How did your day go?": the good day finder's follow-up, about a week after
 * a picked day. The page opens from the reminder link
 * (/good-days/how-did-it-go/#g=…&d=…&s=…&p=…), which carries the goal, the
 * day, the finder's score and whether a birth date ranked it, never the birth
 * date. The answer is a rating from 1 to 5 and an optional short note, sent
 * once to /api/good-days/outcome and kept anonymously. Nothing else is read
 * from the link, and nothing is kept on the device beyond marking a pick the
 * person asked to be reminded of as answered.
 *
 * Layout: the card holds a full screen of height from the server's first
 * paint, so filling it with the day, or the thanks, moves nothing on screen.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { GOAL_RULES } from '../lib/good-days/goals';
import { OUTCOMES_API_PATH, OUTCOME_NOTE_MAX, OUTCOME_RATINGS, readFollowUpLink, scrubNote, type PickedDay } from '../lib/good-days/outcomes';
import { deviceStorage, duePicks, finishPick } from '../lib/good-days/outcome-memory';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function longDay(date: string): string {
  const at = new Date(`${date}T12:00:00Z`);
  return `${WEEKDAYS[at.getUTCDay()]} ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}
function localToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)!.value).join('-');
}

type State = 'reading' | 'none' | 'early' | 'ask' | 'sending' | 'done' | 'closed';

export default function GoodDayOutcome() {
  const [state, setState] = useState<State>('reading');
  const [pick, setPick] = useState<PickedDay | null>(null);
  const [others, setOthers] = useState<PickedDay[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [noteDropped, setNoteDropped] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const linked = readFollowUpLink(window.location.hash);
    const today = localToday();
    if (!linked) {
      setOthers(duePicks(deviceStorage(), today));
      setState('none');
      return;
    }
    setPick(linked);
    setState(linked.day > today ? 'early' : 'ask');
  }, []);

  async function submit(event: Event) {
    event.preventDefault();
    if (!pick || rating === null) { setError('Choose how the day went.'); return; }
    setError(null);
    setState('sending');
    try {
      const response = await fetch(OUTCOMES_API_PATH, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', cache: 'no-store', referrerPolicy: 'strict-origin',
        body: JSON.stringify({ goal: pick.goal, day: pick.day, score: pick.score, personal: pick.personal, rating, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      if (response.status === 404) { setState('closed'); return; }
      const answer = await response.json().catch(() => ({})) as { ok?: boolean; noteKept?: boolean; message?: string };
      if (!response.ok || !answer.ok) { setError(answer.message ?? 'That did not go through. Please try again.'); setState('ask'); return; }
      finishPick(deviceStorage(), pick);
      setNoteDropped(scrubNote(note).dropped === 'children');
      setState('done');
      requestAnimationFrame(() => card.current?.focus());
    } catch {
      setError('That did not go through. Check your connection and try again.');
      setState('ask');
    }
  }

  const goal = pick ? GOAL_RULES[pick.goal] : null;
  return (
    <div class="outcome shell" ref={card} tabIndex={-1}>
      <div class="core outcome__core">
        <h1 class="display outcome__title">How did your day go?</h1>
        <p class="outcome__day">{pick && goal ? `${goal.label}: ${longDay(pick.day)}` : state === 'reading' ? 'Your chosen day' : 'No day to ask about'}</p>

        {state === 'none' && (
          <div class="outcome__body">
            <p>This page opens from the reminder the good day finder sets for a day you pick.</p>
            {others.length > 0 && (
              <ul class="outcome__others">
                {others.map((other) => (
                  <li key={`${other.goal}-${other.day}`}><a href={`#g=${other.goal}&d=${other.day}&s=${other.score ?? ''}&p=${other.personal ? 1 : 0}`} onClick={() => { setPick(other); setState('ask'); }}>{GOAL_RULES[other.goal].label}: {longDay(other.day)}</a></li>
                ))}
              </ul>
            )}
            <p><a class="btn" href="/good-days/">Find good days</a></p>
          </div>
        )}

        {state === 'early' && pick && (
          <div class="outcome__body">
            <p>That day has not come yet. Come back after {longDay(pick.day)}, and tell us how it went.</p>
            <p><a class="btn" href="/good-days/">Back to the good day finder</a></p>
          </div>
        )}

        {(state === 'ask' || state === 'sending') && pick && (
          <form class="outcome__body" onSubmit={submit} aria-busy={state === 'sending'}>
            <fieldset class="outcome__ratings">
              <legend class="field__label">On the day itself</legend>
              {OUTCOME_RATINGS.map((option) => (
                <label class={`outcome__rating${rating === option.value ? ' is-chosen' : ''}`} key={option.value}>
                  <input type="radio" name="rating" value={option.value} checked={rating === option.value} onChange={() => setRating(option.value)} />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            <div class="field">
              <label class="field__label" for="outcome-note">Anything to add? <span class="field__optional">optional</span></label>
              <textarea id="outcome-note" class="field__input outcome__note" rows={3} maxLength={OUTCOME_NOTE_MAX} value={note} autocomplete="off"
                onInput={(event) => setNote((event.target as HTMLTextAreaElement).value)} />
              <p class="field__help">Please leave out names, contact details and anything about children. Dates and contact details are taken out before the note is kept.</p>
            </div>
            <button class="btn btn--primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending' : 'Send'}</button>
            <p class="calc__privacy">Kept anonymously with the goal, the day and the finder’s score for it, to test how well the days it picks go. No name, birth detail or address is kept.</p>
            {error && <p class="calc__error" role="alert">{error}</p>}
          </form>
        )}

        {state === 'done' && (
          <div class="outcome__body">
            <p class="outcome__thanks">Thank you. Your answer is in.</p>
            {noteDropped && <p class="field__help">Your note mentioned a child, so only the rating was kept.</p>}
            <p><a class="btn" href="/good-days/">Find more good days</a></p>
          </div>
        )}

        {state === 'closed' && (
          <div class="outcome__body">
            <p>Follow-ups are not open yet. Nothing was sent or kept.</p>
            <p><a class="btn" href="/good-days/">Back to the good day finder</a></p>
          </div>
        )}
      </div>
    </div>
  );
}
