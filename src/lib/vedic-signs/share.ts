/**
 * The Vedic signs share link, read by the share page and pictures in
 * src/server/result-preview.ts and made by the /vedic-signs/ page and the
 * get_vedic_signs tool. As with ../share-results.ts, the query carries only
 * what the card shows, each value from a fixed vocabulary, and a query with
 * anything else is not a share:
 *
 * - s: the sidereal Sun sign (required: no link for a day the Sun changed sign);
 * - a: the ayanamsa the Sun sign was read with (a setting, not a birth detail);
 * - ref: chatgpt or assistant, as on the other share links.
 *
 * Never a Moon sign, rising sign, nakshatra, birth date, time, place,
 * coordinates or name. Pure; every value import names its file, so the share
 * function loads this module as it is.
 */
import { SHARE_SIGNS, type ShareRef, type ShareSign } from '../share-results.js';
import { VEDIC_AYANAMSAS, type VedicAyanamsa } from './wording.js';

export const VEDIC_SIGNS_PAGE_PATH = '/vedic-signs/';
export const VEDIC_SIGNS_SHARE_PATH = '/share/vedic-signs/';
export const VEDIC_SIGNS_SHARE_IMAGE_PATH = '/api/og/vedic-signs-image';
export const VEDIC_SIGNS_SHARE_STORY_PATH = '/api/og/vedic-signs-story';
export const VEDIC_SIGNS_SHARE_KEYS: readonly string[] = Object.freeze(['s', 'a', 'ref']);

export interface VedicSignsShare {
  sun: ShareSign;
  ayanamsa: VedicAyanamsa;
  ref: ShareRef | null;
}

const isSign = (value: string | null | undefined): value is ShareSign => !!value && (SHARE_SIGNS as readonly string[]).includes(value);
const isAyanamsa = (value: string | null | undefined): value is VedicAyanamsa => !!value && (VEDIC_AYANAMSAS as readonly string[]).includes(value);

export function vedicSignsQuery(share: VedicSignsShare, withRef = false): string {
  const params = new URLSearchParams({ s: share.sun, a: share.ayanamsa });
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

/** The share query for a reading, or null when the Sun's sign is not settled (including right on a sign boundary). Nothing but the sidereal Sun sign and the ayanamsa. */
export function vedicSignsShareQuery(reading: { sun: { sign: string; cusp?: boolean } | null; ayanamsa: { name: VedicAyanamsa } }): string | null {
  if (!reading.sun || reading.sun.cusp) return null;
  const sun = reading.sun.sign;
  if (!isSign(sun) || !isAyanamsa(reading.ayanamsa.name)) return null;
  return vedicSignsQuery({ sun, ayanamsa: reading.ayanamsa.name, ref: null });
}

export function vedicSignsShareUrl(origin: string, reading: Parameters<typeof vedicSignsShareQuery>[0]): string | null {
  const query = vedicSignsShareQuery(reading);
  return query === null ? null : `${origin}${VEDIC_SIGNS_SHARE_PATH}?${query}`;
}

/** Each key once, only these keys, every value from its vocabulary; anything else is not a share. */
export function parseVedicSignsShare(params: URLSearchParams): VedicSignsShare | null {
  const fields = new Map<string, string>();
  for (const [key, value] of params) {
    if (!VEDIC_SIGNS_SHARE_KEYS.includes(key) || fields.has(key)) return null;
    fields.set(key, value);
  }
  const [sun, ayanamsa, refText] = ['s', 'a', 'ref'].map((key) => fields.get(key));
  const ref = refText === undefined ? null : refText === 'chatgpt' || refText === 'assistant' ? refText : undefined;
  if (!isSign(sun) || !isAyanamsa(ayanamsa) || ref === undefined) return null;
  return { sun, ayanamsa, ref };
}

/**
 * The share page's own address for a query as it arrived: the share's keys, each once, in their fixed order, or
 * nothing when the query is not a share. Every other key (a birth date, a Moon or rising sign, a nakshatra, a place,
 * a name, an app's tracking key) is left out, and nothing is read from it, echoed or logged.
 */
export function vedicSignsCleanQuery(params: URLSearchParams): string {
  const kept = new URLSearchParams();
  for (const key of VEDIC_SIGNS_SHARE_KEYS) {
    const values = params.getAll(key);
    if (values.length > 1) return '';
    if (values.length === 1) kept.set(key, values[0]);
  }
  const share = parseVedicSignsShare(kept);
  return share ? vedicSignsQuery(share, true) : '';
}
