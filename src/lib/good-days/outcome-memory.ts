/**
 * The good day finder's on-device reminder, kept only when the person asks
 * ("Remind me on this device"): the goal, the day, the finder's score and
 * whether their own chart ranked it. Never a birth date, a name or anything
 * typed. It lives in this browser's local storage, is never sent anywhere,
 * and is cleared with the browser's site data. A reminder is removed once it
 * is answered or dismissed, or once its day is more than 30 days past
 * (prunePicks, run whenever a page reads the reminders). Every read and write
 * is wrapped, so a browser that refuses storage simply has no reminder.
 */
import { GOOD_DAY_GOALS } from './goals';
import { followUpDue, type PickedDay } from './outcomes';

export const MEMORY_KEY = 'zodiacs.goodDays.followUps.v1';
const MAX_PICKS = 20;
/** A reminder whose day is more than this many days past is removed, answered or not. */
export const REMINDER_KEEP_DAYS = 30;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** done: written by earlier builds, which marked a finished reminder instead of removing it; prunePicks removes those. */
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
/** Writes what is left after a removal; an empty list removes the key itself. */
function keepOnly(storage: Storage | undefined, list: Stored[]): void {
  if (list.length) { write(storage, list); return; }
  try { storage?.removeItem(MEMORY_KEY); } catch { /* storage refused */ }
}
const same = (a: PickedDay, b: PickedDay) => a.goal === b.goal && a.day === b.day;

/** Keeps a picked day; only its four fields are written. */
export function rememberPick(storage: Storage | undefined, pick: PickedDay): boolean {
  const kept: Stored = { goal: pick.goal, day: pick.day, score: pick.score, personal: pick.personal };
  return write(storage, [...read(storage).filter((item) => !same(item, kept)), kept]);
}

/**
 * Picks whose follow-up is due on `today` and not yet answered or dismissed, oldest first. Prunes first, so reading
 * the reminders also removes the finished and the stale ones.
 */
export function duePicks(storage: Storage | undefined, today: string): PickedDay[] {
  return prunePicks(storage, today).filter((item) => followUpDue(item.day) <= today)
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** Removes an answered or dismissed pick, so it is neither asked again nor kept. */
export function finishPick(storage: Storage | undefined, pick: PickedDay): void {
  const list = read(storage);
  const left = list.filter((item) => !same(item, pick));
  if (left.length !== list.length) keepOnly(storage, left);
}

/**
 * Removes every finished reminder (marked done by an earlier build) and every reminder whose day is more than
 * REMINDER_KEEP_DAYS days before `today`, and returns the ones left. Writes only when something was removed; when
 * nothing is left the key itself is removed.
 */
export function prunePicks(storage: Storage | undefined, today: string): PickedDay[] {
  const list = read(storage);
  const oldest = addDays(today, -REMINDER_KEEP_DAYS);
  const left = list.filter((item) => !item.done && item.day >= oldest);
  if (left.length !== list.length) keepOnly(storage, left);
  return left.map(({ done: _done, ...pick }) => pick);
}

/** The browser's local storage, or undefined where it is refused. */
export function deviceStorage(): Storage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}
