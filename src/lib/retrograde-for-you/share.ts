/**
 * The share link for a retrograde in one person's chart (kind
 * `retrograde-for-you`), read by the share page and its pictures in
 * src/server/result-preview.ts and built by the /retrogrades/for-you/ page and
 * the get_retrograde_for_me tool.
 *
 * As with src/lib/share-results.ts, the query carries only what the card
 * shows, each value from a fixed vocabulary, and a query with anything else
 * is not a share:
 *
 * - p: the planet, mercury, venus or mars;
 * - s: the UTC date the retrograde starts, YYYY-MM-DD, a public sky date the
 *   server checks against the site's sky data before it draws anything;
 * - h: the natal house the loop begins in, 1 to 12, when the chart settles one;
 * - b: what that house was counted from, rising (a birth time and place) or
 *   sun (the Sun sign), given with h and only with it;
 * - c: the reading's confidence, 55 or 70, as the rule gives it
 *   (src/ai-tools/reading-confidence.ts): 70 exactly when the houses are
 *   counted from the rising sign;
 * - ref: chatgpt or assistant, as on the other share links.
 *
 * Never a birth date, time, place, coordinates or a name. Pure: no network,
 * storage or logging.
 */
import type { ShareRef } from '../share-results.js';
import { DAY_CONFIDENCES } from '../../ai-tools/reading-confidence.js';
import { parseCivilDate } from '../time/civil-date.js';

export const RETROGRADE_FOR_YOU_PAGE_PATH = '/retrogrades/for-you/';
export const RETROGRADE_FOR_YOU_SHARE_PATH = '/share/retrograde-for-you/';
export const RETROGRADE_FOR_YOU_SHARE_IMAGE_PATH = '/api/og/retrograde-for-you-image';
export const RETROGRADE_FOR_YOU_SHARE_STORY_PATH = '/api/og/retrograde-for-you-story';
export const RETROGRADE_FOR_YOU_SHARE_KEYS: readonly string[] = Object.freeze(['p', 's', 'h', 'b', 'c', 'ref']);

export const SHARE_RETROGRADE_PLANETS = ['mercury', 'venus', 'mars'] as const;
export type ShareRetrogradePlanet = typeof SHARE_RETROGRADE_PLANETS[number];
export type ShareHouseBasis = 'rising' | 'sun';

export interface RetrogradeForYouShare {
  planet: ShareRetrogradePlanet;
  /** The UTC date the retrograde starts. */
  date: string;
  house: number | null;
  basis: ShareHouseBasis | null;
  confidence: number;
  ref: ShareRef | null;
}

const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;
const HOUSE_RE = /^(?:[1-9]|1[0-2])$/u;
const CONFIDENCE_RE = /^[0-9]{2}$/u;
const [DATE_CONFIDENCE, TIMED_CONFIDENCE] = DAY_CONFIDENCES;

function validDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = parseCivilDate(value);
  return !!date && date.year >= 1800 && date.year <= 2199;
}

/** A rising-sign house takes a birth time and place (70); a Sun-sign house, or none, a date alone (55). */
function consistent(share: Pick<RetrogradeForYouShare, 'house' | 'basis' | 'confidence'>): boolean {
  if ((share.house === null) !== (share.basis === null)) return false;
  if (!DAY_CONFIDENCES.includes(share.confidence)) return false;
  return share.basis === 'rising' ? share.confidence === TIMED_CONFIDENCE : share.confidence === DATE_CONFIDENCE;
}

export function retrogradeForYouQuery(share: RetrogradeForYouShare, withRef = false): string {
  const params = new URLSearchParams({ p: share.planet, s: share.date });
  if (share.house !== null && share.basis !== null) {
    params.set('h', String(share.house));
    params.set('b', share.basis);
  }
  params.set('c', String(share.confidence));
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function parseRetrogradeForYouShare(params: URLSearchParams): RetrogradeForYouShare | null {
  const fields = new Map<string, string>();
  for (const [key, value] of params) {
    if (!RETROGRADE_FOR_YOU_SHARE_KEYS.includes(key) || fields.has(key)) return null;
    fields.set(key, value);
  }
  const [planet, date, house, basis, confidence, ref] = ['p', 's', 'h', 'b', 'c', 'ref'].map((key) => fields.get(key));
  if (!planet || !(SHARE_RETROGRADE_PLANETS as readonly string[]).includes(planet)) return null;
  if (date === undefined || !validDate(date)) return null;
  if (house !== undefined && !HOUSE_RE.test(house)) return null;
  if (basis !== undefined && basis !== 'rising' && basis !== 'sun') return null;
  if (confidence === undefined || !CONFIDENCE_RE.test(confidence)) return null;
  if (ref !== undefined && ref !== 'chatgpt' && ref !== 'assistant') return null;
  const share: RetrogradeForYouShare = {
    planet: planet as ShareRetrogradePlanet,
    date,
    house: house === undefined ? null : Number(house),
    basis: (basis ?? null) as ShareHouseBasis | null,
    confidence: Number(confidence),
    ref: (ref ?? null) as ShareRef | null,
  };
  return consistent(share) ? share : null;
}

/**
 * The UTC date of the published retrograde window whose start is within a
 * day of `stationUtc`, or null: a share link names only a window the site's
 * sky data lists, so the server can check it.
 */
export function publishedRetrogradeDate(planet: string, stationUtc: string, windows: readonly { planet: string; from: string }[]): string | null {
  const at = Date.parse(stationUtc);
  const match = windows.find((entry) => entry.planet === planet && Math.abs(Date.parse(entry.from) - at) < 86_400_000);
  return match ? new Date(match.from).toISOString().slice(0, 10) : null;
}

/** The share query for one period of the reading, or null when its window is not in the published sky data. */
export function retrogradeForYouShareQuery(source: {
  planet: string;
  stationRetrogradeUtc: string;
  house: number | null;
  countedFrom: 'rising sign' | 'Sun sign' | null;
  confidence: number;
}, windows: readonly { planet: string; from: string }[]): string | null {
  const planet = source.planet.toLowerCase();
  if (!(SHARE_RETROGRADE_PLANETS as readonly string[]).includes(planet)) return null;
  const date = publishedRetrogradeDate(source.planet, source.stationRetrogradeUtc, windows);
  if (!date) return null;
  const basis: ShareHouseBasis | null = source.house === null || source.countedFrom === null ? null : source.countedFrom === 'rising sign' ? 'rising' : 'sun';
  const share: RetrogradeForYouShare = { planet: planet as ShareRetrogradePlanet, date, house: basis ? source.house : null, basis, confidence: source.confidence, ref: null };
  return consistent(share) ? retrogradeForYouQuery(share) : null;
}

export const retrogradeForYouShareUrl = (origin: string, query: string) => `${origin}${RETROGRADE_FOR_YOU_SHARE_PATH}?${query}`;
