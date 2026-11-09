/**
 * "How did your day go?": the good day finder's outcome follow-up, behind its
 * switches (PUBLIC_GOOD_DAYS_OUTCOMES_ENABLED for the pages,
 * ZODIACS_GOOD_DAYS_OUTCOMES_ENABLED for the endpoint), both off.
 *
 * About a week after someone picks a day, they are asked how it went: a
 * rating from 1 to 5 and an optional short note. The record is anonymous and
 * small: the goal, the day, the finder's score for it and whether a birth
 * date was used to rank it (never the birth date), the rating, the scrubbed
 * note and the rules version. It holds no name, birth detail, address, IP or
 * account, and the day it was recorded is kept to the day. It is the data for
 * later tests of whether days the finder rated highly went better than days
 * it rated low.
 *
 * Shared by the follow-up page, the finder's reminder and the endpoint. Pure.
 */
import { GOOD_DAY_GOALS, type GoodDayGoal } from './goals.js';

/**
 * The days the finder covers (find.ts reads them from the eclipse table). Kept here as literals so the endpoint's
 * import graph stays this small; outcomes.test.ts holds them equal to find.ts's.
 */
export const OUTCOME_FIRST_DAY = '2026-01-01';
export const OUTCOME_LAST_DAY = '2030-12-31';
const GOOD_DAYS_FIRST = OUTCOME_FIRST_DAY;
const GOOD_DAYS_LAST = OUTCOME_LAST_DAY;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Days after the chosen day that the follow-up asks. */
export const FOLLOW_UP_DAYS = 7;
/** A rating is taken up to this many days after the day, so late answers still count but stale ones do not pile up. */
export const OUTCOME_MAX_AGE_DAYS = 120;
export const OUTCOME_NOTE_MAX = 280;
/** The finder's rules a recorded score came from; bump when goals.ts or find.ts changes how a day is scored. */
export const OUTCOME_RULES_VERSION = 'good-days-1';
export const OUTCOMES_PAGE_PATH = '/good-days/how-did-it-go/';
export const OUTCOMES_API_PATH = '/api/good-days/outcome';
export const OUTCOMES_PUBLIC_SWITCH = 'PUBLIC_GOOD_DAYS_OUTCOMES_ENABLED';
export const OUTCOMES_SERVER_SWITCH = 'ZODIACS_GOOD_DAYS_OUTCOMES_ENABLED';

/** The five answers, best first. */
export const OUTCOME_RATINGS = [
  { value: 5, label: 'Very well' },
  { value: 4, label: 'Well' },
  { value: 3, label: 'Mixed' },
  { value: 2, label: 'Not well' },
  { value: 1, label: 'Badly' },
] as const;

/** A picked day, as the follow-up link and the device reminder carry it. */
export interface PickedDay {
  goal: GoodDayGoal;
  /** YYYY-MM-DD. */
  day: string;
  /** The finder's score for the day, 0 to 100, or null when not known. */
  score: number | null;
  /** Whether the person's own chart was used to rank it. */
  personal: boolean;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const realDate = (date: string) => DATE.test(date) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;

/** The follow-up link: the goal, the day, the score and the personal flag after the #, and nothing else. */
export function followUpLink(origin: string, pick: PickedDay): string {
  return `${origin}${OUTCOMES_PAGE_PATH}#g=${pick.goal}&d=${pick.day}&s=${pick.score ?? ''}&p=${pick.personal ? 1 : 0}`;
}

/** A follow-up link's pick, read by hand so nothing but these four keys is ever taken from it. */
export function readFollowUpLink(hash: string): PickedDay | null {
  const fields: Record<string, string> = {};
  for (const part of hash.replace(/^#/u, '').split('&')) {
    const [key, value] = part.split('=');
    if (key && value !== undefined && ['g', 'd', 's', 'p'].includes(key)) fields[key] = value;
  }
  const goal = GOOD_DAY_GOALS.find((name) => name === fields.g);
  if (!goal || !realDate(fields.d ?? '') || fields.d < GOOD_DAYS_FIRST || fields.d > GOOD_DAYS_LAST) return null;
  const score = /^\d{1,3}$/u.test(fields.s ?? '') && Number(fields.s) <= 100 ? Number(fields.s) : null;
  return { goal, day: fields.d, score, personal: fields.p === '1' };
}

/** The first day the follow-up asks: a week after the chosen day. */
export const followUpDue = (day: string) => addDays(day, FOLLOW_UP_DAYS);

/**
 * Words that put a note about a child: such a note is dropped and the rating kept, because Zodiacs collects nothing
 * about children. Whole words, compared lower-cased.
 */
const CHILD_WORDS = /\b(?:child|children|childs?|kid|kids|kiddo|baby|babies|toddler|infant|newborn|son|sons|daughter|daughters|boy|girl|teen|teens|teenager|teenagers|preteen|school|schools|preschool|nursery|kindergarten|pupil|pupils|minor|minors|grandson|granddaughter|grandchild|grandchildren|stepson|stepdaughter|nephew|niece)\b/iu;

/**
 * A note as it is kept: trimmed, one line, at most OUTCOME_NOTE_MAX characters, with email addresses, web addresses,
 * phone numbers and anything shaped like a date taken out, so a birth date or a contact detail typed into it is not
 * kept. A note about a child is dropped whole.
 */
export function scrubNote(input: unknown): { note: string | null; dropped: 'children' | null } {
  if (typeof input !== 'string') return { note: null, dropped: null };
  let text = input.normalize('NFC').replace(/[\u0000-\u001f\u007f]+/gu, ' ');
  if (CHILD_WORDS.test(text)) return { note: null, dropped: 'children' };
  text = text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu, '[removed]')
    .replace(/\b(?:https?:\/\/|www\.)\S+/giu, '[removed]')
    .replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/gu, '[removed]')
    .replace(/\+?\d[\d\s().-]{6,}\d/gu, '[removed]')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!text) return { note: null, dropped: null };
  return { note: text.length > OUTCOME_NOTE_MAX ? text.slice(0, OUTCOME_NOTE_MAX).trimEnd() : text, dropped: null };
}

/** The record the endpoint stores. */
export interface OutcomeRecord {
  goal: GoodDayGoal;
  day: string;
  finderScore: number | null;
  personal: boolean;
  rating: 1 | 2 | 3 | 4 | 5;
  note: string | null;
  rulesVersion: typeof OUTCOME_RULES_VERSION;
}

const ALLOWED_KEYS = new Set(['goal', 'day', 'score', 'personal', 'rating', 'note']);

/**
 * Checks a submitted outcome against `today` (YYYY-MM-DD, the latest date anywhere) and returns the record to store,
 * or a plain refusal. Unknown fields are refused rather than ignored, so nothing extra can ride along.
 */
export function outcomeRecord(body: unknown, today: string): { record: OutcomeRecord } | { refusal: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { refusal: 'Send the goal, the day and a rating.' };
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !ALLOWED_KEYS.has(key))) return { refusal: 'Leave out fields this form does not take.' };
  const goal = GOOD_DAY_GOALS.find((name) => name === input.goal);
  if (!goal) return { refusal: 'goal must be one of the finder\'s goals.' };
  if (typeof input.day !== 'string' || !realDate(input.day) || input.day < GOOD_DAYS_FIRST || input.day > GOOD_DAYS_LAST) return { refusal: 'day must be a real date the finder covers.' };
  if (input.day > today) return { refusal: 'Tell us how the day went once it has come.' };
  if (input.day < addDays(today, -OUTCOME_MAX_AGE_DAYS)) return { refusal: `This form takes days from the last ${OUTCOME_MAX_AGE_DAYS} days.` };
  const rating = input.rating;
  if (rating !== 1 && rating !== 2 && rating !== 3 && rating !== 4 && rating !== 5) return { refusal: 'rating must be a whole number from 1 to 5.' };
  const score = input.score;
  if (score !== undefined && score !== null && !(Number.isInteger(score) && (score as number) >= 0 && (score as number) <= 100)) return { refusal: 'score must be a whole number from 0 to 100.' };
  if (input.personal !== undefined && typeof input.personal !== 'boolean') return { refusal: 'personal must be true or false.' };
  if (input.note !== undefined && input.note !== null && (typeof input.note !== 'string' || input.note.length > 1000)) return { refusal: 'The note is too long.' };
  return {
    record: {
      goal, day: input.day, finderScore: (score ?? null) as number | null, personal: input.personal === true,
      rating, note: scrubNote(input.note).note, rulesVersion: OUTCOME_RULES_VERSION,
    },
  };
}
