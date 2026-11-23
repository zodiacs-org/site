/**
 * The share link for a retrograde in one person's chart (kind
 * `retrograde-for-you`), read by the share page and its pictures in
 * src/server/result-preview.ts and built by the /retrogrades/for-you/ page and
 * the get_retrograde_for_me tool.
 *
 * The query carries only non-personal sky identifiers and, when settled, the
 * Sun sign, each from a fixed vocabulary; a query with anything else is not a
 * share:
 *
 * - p: the planet, mercury, venus or mars;
 * - s: the UTC date the retrograde starts, YYYY-MM-DD, a public sky date the
 *   server checks against the site's sky data before it draws anything;
 * - sun: the person's Sun sign (aries..pisces), when settled on the birth day;
 * - ref: chatgpt or assistant, as on the other share links.
 *
 * Never a Moon sign, rising sign, house, confidence, birth date, time, place,
 * coordinates or name. Pure: no network, storage or logging.
 */
import { SHARE_SIGNS, type ShareRef, type ShareSign } from '../share-results.js';
import { parseCivilDate } from '../time/civil-date.js';

export const RETROGRADE_FOR_YOU_PAGE_PATH = '/retrogrades/for-you/';
export const RETROGRADE_FOR_YOU_SHARE_PATH = '/share/retrograde-for-you/';
export const RETROGRADE_FOR_YOU_SHARE_IMAGE_PATH = '/api/og/retrograde-for-you-image';
export const RETROGRADE_FOR_YOU_SHARE_STORY_PATH = '/api/og/retrograde-for-you-story';
export const RETROGRADE_FOR_YOU_SHARE_KEYS: readonly string[] = Object.freeze(['p', 's', 'sun', 'ref']);

export const SHARE_RETROGRADE_PLANETS = ['mercury', 'venus', 'mars'] as const;
export type ShareRetrogradePlanet = typeof SHARE_RETROGRADE_PLANETS[number];

export interface RetrogradeForYouShare {
  planet: ShareRetrogradePlanet;
  /** The UTC date the retrograde starts. */
  date: string;
  /** The person's Sun sign, or null if unsettled on an untimed cusp day. */
  sun: ShareSign | null;
  ref: ShareRef | null;
}

const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;

function validDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = parseCivilDate(value);
  return !!date && date.year >= 1800 && date.year <= 2199;
}

export function retrogradeForYouQuery(share: RetrogradeForYouShare, withRef = false): string {
  const params = new URLSearchParams({ p: share.planet, s: share.date });
  if (share.sun !== null) params.set('sun', share.sun);
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function parseRetrogradeForYouShare(params: URLSearchParams): RetrogradeForYouShare | null {
  const fields = new Map<string, string>();
  for (const [key, value] of params) {
    if (!RETROGRADE_FOR_YOU_SHARE_KEYS.includes(key) || fields.has(key)) return null;
    fields.set(key, value);
  }
  const [planet, date, sun, ref] = ['p', 's', 'sun', 'ref'].map((key) => fields.get(key));
  if (!planet || !(SHARE_RETROGRADE_PLANETS as readonly string[]).includes(planet)) return null;
  if (date === undefined || !validDate(date)) return null;
  if (sun !== undefined && !(SHARE_SIGNS as readonly string[]).includes(sun)) return null;
  if (ref !== undefined && ref !== 'chatgpt' && ref !== 'assistant') return null;
  return {
    planet: planet as ShareRetrogradePlanet,
    date,
    sun: (sun ?? null) as ShareSign | null,
    ref: (ref ?? null) as ShareRef | null,
  };
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
  sun: ShareSign | null;
}, windows: readonly { planet: string; from: string }[]): string | null {
  const planet = source.planet.toLowerCase();
  if (!(SHARE_RETROGRADE_PLANETS as readonly string[]).includes(planet)) return null;
  const date = publishedRetrogradeDate(source.planet, source.stationRetrogradeUtc, windows);
  if (!date) return null;
  return retrogradeForYouQuery({ planet: planet as ShareRetrogradePlanet, date, sun: source.sun, ref: null });
}

export const retrogradeForYouShareUrl = (origin: string, query: string) => `${origin}${RETROGRADE_FOR_YOU_SHARE_PATH}?${query}`;

/**
 * Where a retrograde is listed in full: Mercury's own page, which dates every
 * Mercury retrograde, else the window's row on /retrogrades/ by its published
 * start date (Venus and Mars have no index page of their own). The page and
 * get_retrograde_for_me both link through this.
 */
export function retrogradeTablePath(planet: string, skyDate: string | null): string {
  const slug = planet.toLowerCase();
  if (slug === 'mercury') return '/mercury-retrograde/';
  return skyDate ? `/retrogrades/#retrograde-${slug}-${skyDate}` : '/retrogrades/';
}
