/**
 * The link the occasions page's "Copy the card's link" button copies (src/islands/OccasionSky.tsx).
 *
 * A birthday, a baby's arrival or a coming of age gets no card link: its day can be a birth date, and links never
 * carry a birth year, a birth time, a birthplace or the names you give (AGENTS.md, and the privacy page's
 * assistant section, which says the same of the Zodiacs app). That matches the save rule in ./saved-path.ts and the
 * hosted tool's card link (occasionCardUrl in src/ai-tools/tools.ts). Every other occasion keeps the link it had:
 * its inputs after the #, so they never reach the server. Pure: no storage, network or logging.
 */
import { BIRTH_OCCASIONS } from './saved-path';

export interface CardLinkPlace {
  tz: string;
  lat: number;
  lon: number;
  label: string;
}

export interface CardLinkInput {
  occasion: string;
  names: string;
  date: string;
  time: string;
  place: CardLinkPlace | null;
}

/** The card's link on `pageUrl` (origin and path, no hash), or null for a birth occasion, which gets none. */
export function occasionCardLink(pageUrl: string, input: CardLinkInput): string | null {
  if (BIRTH_OCCASIONS.has(input.occasion)) return null;
  const params = new URLSearchParams({ o: input.occasion, d: input.date });
  if (input.names.trim()) params.set('n', input.names.trim());
  if (input.time) params.set('t', input.time);
  if (input.place) {
    params.set('tz', input.place.tz);
    params.set('lat', input.place.lat.toFixed(4));
    params.set('lon', input.place.lon.toFixed(4));
    params.set('place', input.place.label);
  }
  return `${pageUrl}#${params.toString()}`;
}

/** Whether a link opened on the page names a birth occasion, whose details then leave the address bar. */
export function isBirthOccasionLink(hash: string): boolean {
  return BIRTH_OCCASIONS.has(new URLSearchParams(hash.replace(/^#/u, '')).get('o') ?? '');
}
