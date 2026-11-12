/**
 * The solar return's share link, read by src/server/result-preview.ts. It
 * carries what its picture shows: the Sun sign, the return's year, and when
 * the chart settles them the return's rising sign and Jupiter's sign. Never a
 * birth date, a time, a place or a name. Each key once, each value from a
 * fixed vocabulary. Pure.
 */
import { SHARE_SIGNS, type ShareRef, type ShareSign } from '../share-results.js';

export const SOLAR_RETURN_SHARE_PATH = '/share/solar-return/';
export const SOLAR_RETURN_SHARE_IMAGE_PATH = '/api/og/solar-return-image';
export const SOLAR_RETURN_SHARE_KEYS: readonly string[] = Object.freeze(['s', 'y', 'r', 'j', 'ref']);

export interface SolarReturnShare { sun: ShareSign; year: number; rising: ShareSign | null; jupiter: ShareSign; ref: ShareRef | null }

const isSign = (value: unknown): value is ShareSign => typeof value === 'string' && (SHARE_SIGNS as readonly string[]).includes(value);

export function solarReturnQuery(share: SolarReturnShare, withRef = false): string {
  const params = new URLSearchParams({ s: share.sun, y: String(share.year) });
  if (share.rising) params.set('r', share.rising);
  params.set('j', share.jupiter);
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function solarReturnShareUrl(origin: string, source: { sun: string | null; year: number; rising: string | null; jupiter: string }): string | null {
  if (!isSign(source.sun) || !isSign(source.jupiter) || (source.rising !== null && !isSign(source.rising)) || !Number.isInteger(source.year) || source.year < 1800 || source.year > 2200) return null;
  return `${origin}${SOLAR_RETURN_SHARE_PATH}?${solarReturnQuery({ sun: source.sun, year: source.year, rising: source.rising as ShareSign | null, jupiter: source.jupiter, ref: null })}`;
}

export function parseSolarReturnShare(params: URLSearchParams): SolarReturnShare | null {
  const fields = new Map<string, string>();
  for (const [key, value] of params) {
    if (!SOLAR_RETURN_SHARE_KEYS.includes(key) || fields.has(key)) return null;
    fields.set(key, value);
  }
  const [sun, year, rising, jupiter, ref] = ['s', 'y', 'r', 'j', 'ref'].map((key) => fields.get(key));
  if (!isSign(sun) || !isSign(jupiter) || (rising !== undefined && !isSign(rising)) || !year || !/^(?:18|19|20|21)\d{2}$/u.test(year)) return null;
  if (ref !== undefined && ref !== 'chatgpt' && ref !== 'assistant') return null;
  return { sun, year: Number(year), rising: rising ?? null, jupiter, ref: (ref ?? null) as ShareRef | null };
}
