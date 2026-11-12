/**
 * The good day finder's on-device reminder, kept only when the person asks
 * ("Remind me on this device"): the goal, the day, the finder's score and
 * whether their own chart ranked it. Never a birth date, a name or anything
 * typed. It lives in this browser's local storage, is never sent anywhere,
 * and is cleared with the browser's site data. Every read and write is
 * wrapped, so a browser that refuses storage simply has no reminder.
 */
import { GOOD_DAY_GOALS } from './goals';
import { followUpDue, type PickedDay } from './outcomes';

export const MEMORY_KEY = 'zodiacs.goodDays.followUps.v1';
const MAX_PICKS = 20;

interface Stored extends PickedDay { done?: boolean }

function read(storage: Storage | undefined): Stored[] {
  try {
    const raw = storage?.getItem(MEMORY_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter((item): item is Stored => !!item && typeof item === 'object'
      && GOOD_DAY_GOALS.includes((item as Stored).goal) && /^\d{4}-\d{2}-\d{2}$/u.test(String((item as Stored).day)))
      .map((item) => ({ goal: item.goal, day: item.day, score: typeof item.score === 'number' ? item.score : null, personal: item.personal === true, ...(item.done ? { done: true } : {}) }));
  } catch { return []; }
}
function write(storage: Storage | undefined, list: Stored[]): boolean {
  try { storage?.setItem(MEMORY_KEY, JSON.stringify(list.slice(-MAX_PICKS))); return !!storage; } catch { return false; }
}
const same = (a: PickedDay, b: PickedDay) => a.goal === b.goal && a.day === b.day;

/** Keeps a picked day; only its four fields are written. */
export function rememberPick(storage: Storage | undefined, pick: PickedDay): boolean {
  const kept: Stored = { goal: pick.goal, day: pick.day, score: pick.score, personal: pick.personal };
  return write(storage, [...read(storage).filter((item) => !same(item, kept)), kept]);
}

/** Picks whose follow-up is due on `today` and not yet answered or dismissed, oldest first. */
export function duePicks(storage: Storage | undefined, today: string): PickedDay[] {
  return read(storage).filter((item) => !item.done && followUpDue(item.day) <= today)
    .sort((a, b) => a.day.localeCompare(b.day)).map(({ done: _done, ...pick }) => pick);
}

/** Marks a pick answered or dismissed, so it is not asked again. */
export function finishPick(storage: Storage | undefined, pick: PickedDay): void {
  write(storage, read(storage).map((item) => (same(item, pick) ? { ...item, done: true } : item)));
}

/** The browser's local storage, or undefined where it is refused. */
export function deviceStorage(): Storage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}
