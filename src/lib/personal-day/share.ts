/**
 * The personal day's share link (kind `your-day`), read by the share page and
 * pictures in src/server/result-preview.ts and built by the /your-day/ page
 * and the get_personal_day tool.
 *
 * The query carries only the day read (a public sky date, not a birth detail)
 * and the person's Sun sign, each from a fixed vocabulary; a query with
 * anything else is not a share:
 *
 * - day: the day read, YYYY-MM-DD (a day of the sky, not a birth detail);
 * - s: the person's Sun sign (aries..pisces);
 * - ref: chatgpt or assistant, as on the other share links.
 *
 * Never a Moon sign, rising sign, nakshatra, natal point, confidence, birth
 * date, time, place, coordinates or name. Pure: no network, storage or
 * logging. Every value import names its file, so the share function loads this
 * module as it is.
 */
import { parseCivilDate } from '../time/civil-date.js';
import { SHARE_SIGNS, type ShareRef, type ShareSign } from '../share-results.js';

export const YOUR_DAY_PAGE_PATH = '/your-day/';
export const YOUR_DAY_SHARE_PATH = '/share/your-day/';
export const YOUR_DAY_SHARE_IMAGE_PATH = '/api/og/your-day-image';
export const YOUR_DAY_SHARE_STORY_PATH = '/api/og/your-day-story';
export const YOUR_DAY_SHARE_KEYS: readonly string[] = Object.freeze(['day', 's', 'ref']);

export interface YourDayShare {
  date: string;
  sun: ShareSign;
  ref: ShareRef | null;
}

const DATE_RE = /^(?:18|19|20|21)[0-9]{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])$/u;

function validDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = parseCivilDate(value);
  return !!date && date.year >= 1800 && date.year <= 2199;
}

/** The query, its keys always in the same order. */
export function yourDayQuery(share: Omit<YourDayShare, 'ref'> & { ref?: ShareRef | null }, withRef = false): string {
  const params = new URLSearchParams({ day: share.date, s: share.sun });
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

/** The share link for a day's reading, or null when the day or Sun sign is missing or outside its vocabulary. */
export function yourDayShareUrl(origin: string, day: { date: string; sun: string | null | undefined }): string | null {
  if (!day.sun) return null;
  const share = parseYourDayShare(new URLSearchParams({ day: day.date, s: day.sun }));
  return share ? `${origin}${YOUR_DAY_SHARE_PATH}?${yourDayQuery(share)}` : null;
}

/** Each key once, only these keys, every value from its vocabulary; anything else is not a share. */
export function parseYourDayShare(params: URLSearchParams): YourDayShare | null {
  const fields = new Map<string, string>();
  for (const [key, value] of params) {
    if (!YOUR_DAY_SHARE_KEYS.includes(key) || fields.has(key)) return null;
    fields.set(key, value);
  }
  const [date, sun, ref] = ['day', 's', 'ref'].map((key) => fields.get(key));
  if (date === undefined || !validDate(date)) return null;
  if (sun === undefined || !(SHARE_SIGNS as readonly string[]).includes(sun)) return null;
  if (ref !== undefined && ref !== 'chatgpt' && ref !== 'assistant') return null;
  return { date, sun: sun as ShareSign, ref: (ref as ShareRef | undefined) ?? null };
}

/**
 * The share page's own address for a query as it arrived: the share's keys, each once, in their fixed order, or
 * nothing when the query is not a share. Every other key (a birth date, a Moon or rising sign, a place, a name, an
 * app's tracking key) is left out, and nothing is read from it, echoed or logged.
 */
export function yourDayCleanQuery(params: URLSearchParams): string {
  const kept = new URLSearchParams();
  for (const key of YOUR_DAY_SHARE_KEYS) {
    const values = params.getAll(key);
    if (values.length > 1) return '';
    if (values.length === 1) kept.set(key, values[0]);
  }
  const share = parseYourDayShare(kept);
  return share ? yourDayQuery(share, true) : '';
}
