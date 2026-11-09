/**
 * The Vedic signs share link, read by the share page and pictures in
 * src/server/result-preview.ts and made by the /vedic-signs/ page and the
 * get_vedic_signs tool. As with ../share-results.ts, the query carries only
 * what the card shows, each value from a fixed vocabulary, and a query with
 * anything else is not a share:
 *
 * - s: the sidereal Sun sign (required: no link for a day the Sun changed sign);
 * - m: the sidereal Moon sign, only when the birth day or time settles it;
 * - r: the sidereal rising sign, only when it is known (a birth time and place);
 * - n: the Moon's nakshatra, 1 (Ashwini) to 27 (Revati), only when settled;
 * - a: the ayanamsa the signs were read with.
 *
 * Never a birth date, time, place, coordinates or name. Pure; every value
 * import names its file, so the share function loads this module as it is.
 */
import { SHARE_SIGNS, type ShareRef, type ShareSign } from '../share-results.js';
import { VEDIC_AYANAMSAS, nakshatraSigns, type VedicAyanamsa } from './wording.js';

export const VEDIC_SIGNS_PAGE_PATH = '/vedic-signs/';
export const VEDIC_SIGNS_SHARE_PATH = '/share/vedic-signs/';
export const VEDIC_SIGNS_SHARE_IMAGE_PATH = '/api/og/vedic-signs-image';
export const VEDIC_SIGNS_SHARE_STORY_PATH = '/api/og/vedic-signs-story';
export const VEDIC_SIGNS_SHARE_KEYS: readonly string[] = Object.freeze(['s', 'm', 'r', 'n', 'a', 'ref']);

export interface VedicSignsShare {
  sun: ShareSign;
  moon: ShareSign | null;
  /** Only beside a settled Moon and nakshatra: a birth time settles both. */
  rising: ShareSign | null;
  /** 1 to 27. */
  nakshatra: number | null;
  ayanamsa: VedicAyanamsa;
  ref: ShareRef | null;
}

const isSign = (value: string | null | undefined): value is ShareSign => !!value && (SHARE_SIGNS as readonly string[]).includes(value);
const isAyanamsa = (value: string | null | undefined): value is VedicAyanamsa => !!value && (VEDIC_AYANAMSAS as readonly string[]).includes(value);
const NAKSHATRA_RE = /^(?:[1-9]|1[0-9]|2[0-7])$/u;

/** A nakshatra lies in, or across the edge of, the Moon's sign. */
const fits = (nakshatra: number, moon: ShareSign) => nakshatraSigns(nakshatra - 1).includes(SHARE_SIGNS.indexOf(moon));

export function vedicSignsQuery(share: VedicSignsShare, withRef = false): string {
  const params = new URLSearchParams({ s: share.sun });
  if (share.moon) params.set('m', share.moon);
  if (share.moon && share.nakshatra && share.rising) params.set('r', share.rising);
  if (share.nakshatra) params.set('n', String(share.nakshatra));
  params.set('a', share.ayanamsa);
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

/** The share query for a reading, or null when the Sun's sign is not settled. Nothing but the signs, the nakshatra's number and the ayanamsa. */
export function vedicSignsShareQuery(reading: { sun: { sign: string } | null; moon: { sign: string } | null; rising: { sign: string } | null; moonNakshatra: { number: number } | null; ayanamsa: { name: VedicAyanamsa } }): string | null {
  const sun = reading.sun?.sign;
  if (!isSign(sun) || !isAyanamsa(reading.ayanamsa.name)) return null;
  const moon = isSign(reading.moon?.sign) ? reading.moon!.sign as ShareSign : null;
  const nakshatra = reading.moonNakshatra && Number.isInteger(reading.moonNakshatra.number) && reading.moonNakshatra.number >= 1 && reading.moonNakshatra.number <= 27 ? reading.moonNakshatra.number : null;
  const rising = isSign(reading.rising?.sign) ? reading.rising!.sign as ShareSign : null;
  const share: VedicSignsShare = { sun, moon, rising, nakshatra, ayanamsa: reading.ayanamsa.name, ref: null };
  // Only what the parser opens: anything inconsistent is left out rather than shared.
  const query = vedicSignsQuery(share);
  return parseVedicSignsShare(new URLSearchParams(query)) ? query : vedicSignsQuery({ ...share, rising: null, nakshatra: null });
}

export function vedicSignsShareUrl(origin: string, reading: Parameters<typeof vedicSignsShareQuery>[0]): string | null {
  const query = vedicSignsShareQuery(reading);
  return query === null ? null : `${origin}${VEDIC_SIGNS_SHARE_PATH}?${query}`;
}

export function parseVedicSignsShare(params: URLSearchParams): VedicSignsShare | null {
  const fields = new Map<string, string>();
  for (const [key, value] of params) {
    if (!VEDIC_SIGNS_SHARE_KEYS.includes(key) || fields.has(key)) return null;
    fields.set(key, value);
  }
  const [sun, moon, rising, number, ayanamsa, refText] = ['s', 'm', 'r', 'n', 'a', 'ref'].map((key) => fields.get(key));
  const ref = refText === undefined ? null : refText === 'chatgpt' || refText === 'assistant' ? refText : undefined;
  if (!isSign(sun) || !isAyanamsa(ayanamsa) || ref === undefined) return null;
  if ((moon !== undefined && !isSign(moon)) || (rising !== undefined && !isSign(rising))) return null;
  if (number !== undefined && !NAKSHATRA_RE.test(number)) return null;
  const nakshatra = number === undefined ? null : Number(number);
  // A known rising sign takes a birth time, and a birth time settles the Moon and its nakshatra.
  if (rising !== undefined && (moon === undefined || nakshatra === null)) return null;
  // The nakshatra must lie where the Moon's sign is.
  if (moon !== undefined && nakshatra !== null && !fits(nakshatra, moon)) return null;
  // A day that keeps the Moon in a nakshatra inside one sign keeps it in that sign too.
  if (moon === undefined && nakshatra !== null && nakshatraSigns(nakshatra - 1).length === 1) return null;
  return { sun, moon: moon ?? null, rising: rising ?? null, nakshatra, ayanamsa, ref };
}
