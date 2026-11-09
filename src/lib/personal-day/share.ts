/**
 * The personal day's share link (kind `your-day`), read by the share page and
 * pictures in src/server/result-preview.ts and built by the /your-day/ page
 * and the get_personal_day tool. As with src/lib/share-results.ts, the query
 * carries only what the card shows, each value from a fixed vocabulary or
 * pattern, and a query with anything else is not a share:
 *
 * - day: the day read, YYYY-MM-DD (a day of the sky, not a birth detail);
 * - p, a, n: the top contact's moving planet, aspect and natal point;
 * - c: its reading confidence, one of the values the rule gives a dated chart
 *   with or without a contact under 1 degree.
 *
 * Never a birth date, time or place, coordinates or a name. Pure: no
 * network, storage or logging. Every value import names its file, so the
 * share function loads this module as it is.
 */
import { MAJOR_ASPECT_ORDER, NATAL_POINT_ORDER, TRANSIT_BODY_ORDER, type NatalPoint, type TransitBody } from '../engine/transit-scan-shared.js';
import type { AspectType } from '../engine/types';
import { parseCivilDate } from '../time/civil-date.js';
import { PAIR_CONFIDENCES } from '../../ai-tools/reading-confidence.js';
import type { ShareRef } from '../share-results.js';

export const YOUR_DAY_PAGE_PATH = '/your-day/';
export const YOUR_DAY_SHARE_PATH = '/share/your-day/';
export const YOUR_DAY_SHARE_IMAGE_PATH = '/api/og/your-day-image';
export const YOUR_DAY_SHARE_STORY_PATH = '/api/og/your-day-story';
export const YOUR_DAY_SHARE_KEYS: readonly string[] = Object.freeze(['day', 'p', 'a', 'n', 'c', 'ref']);
/**
 * A day's reading of a dated chart: a date alone or with a time and a place,
 * with or without a contact under 1 degree (src/ai-tools/reading-confidence.ts).
 * These are the values a two-chart reading can have too, by the same rule.
 */
export const YOUR_DAY_CONFIDENCES: readonly number[] = PAIR_CONFIDENCES;

export interface YourDayShare {
  date: string;
  planet: TransitBody;
  aspect: AspectType;
  point: NatalPoint;
  confidence: number;
  ref: ShareRef | null;
}

const DATE_RE = /^(?:18|19|20|21)[0-9]{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])$/u;
const slug = (value: string) => value.toLowerCase();
const PLANETS = new Map<string, TransitBody>(TRANSIT_BODY_ORDER.map((body) => [slug(body), body]));
const POINTS = new Map<string, NatalPoint>(NATAL_POINT_ORDER.map((point) => [slug(point), point]));
const ASPECTS = new Set<string>(MAJOR_ASPECT_ORDER);

function validDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = parseCivilDate(value);
  return !!date && date.year >= 1800 && date.year <= 2199;
}

/** The query, its keys always in the same order. */
export function yourDayQuery(share: Omit<YourDayShare, 'ref'> & { ref?: ShareRef | null }, withRef = false): string {
  const params = new URLSearchParams({ day: share.date, p: slug(share.planet), a: share.aspect, n: slug(share.point), c: String(share.confidence) });
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

/** The share link for a day's top contact, or null when any value is outside its vocabulary. */
export function yourDayShareUrl(origin: string, day: { date: string; contact: { planet: string; aspect: string; point: string; confidence: number } | null | undefined }): string | null {
  const contact = day.contact;
  if (!contact) return null;
  const share = parseYourDayShare(new URLSearchParams({ day: day.date, p: slug(contact.planet), a: contact.aspect, n: slug(contact.point), c: String(contact.confidence) }));
  return share ? `${origin}${YOUR_DAY_SHARE_PATH}?${yourDayQuery(share)}` : null;
}

/** Each key once, only these keys, every value from its vocabulary; anything else is not a share. */
export function parseYourDayShare(params: URLSearchParams): YourDayShare | null {
  const fields = new Map<string, string>();
  for (const [key, value] of params) {
    if (!YOUR_DAY_SHARE_KEYS.includes(key) || fields.has(key)) return null;
    fields.set(key, value);
  }
  const [date, planet, aspect, point, confidence, ref] = ['day', 'p', 'a', 'n', 'c', 'ref'].map((key) => fields.get(key));
  if (date === undefined || !validDate(date)) return null;
  const body = planet === undefined ? undefined : PLANETS.get(planet);
  const natal = point === undefined ? undefined : POINTS.get(point);
  if (!body || !natal || aspect === undefined || !ASPECTS.has(aspect)) return null;
  if (confidence === undefined || !/^[1-9][0-9]$/u.test(confidence) || !YOUR_DAY_CONFIDENCES.includes(Number(confidence))) return null;
  if (ref !== undefined && ref !== 'chatgpt' && ref !== 'assistant') return null;
  return { date, planet: body, aspect: aspect as AspectType, point: natal, confidence: Number(confidence), ref: (ref as ShareRef | undefined) ?? null };
}
