/**
 * What an occasion card is saved to a profile as, shared by the site's own
 * "Save to your profile" (src/islands/OccasionSky.tsx) and the assistant's
 * save tool (src/ai-tools/accounts/save.ts).
 *
 * A birthday, a baby's arrival or a coming of age is kept as the page address
 * only: that day can be a birth date, so no date, time, zone or coordinates.
 * Any other occasion reopens its card from the day, and the time, zone and
 * coordinates (two decimals) when the page can take them. Never names, never
 * a place name. Pure: no storage, network or logging.
 */
import { OCCASION_KINDS } from './kinds.js';

/** A birthday, a baby's arrival, or a coming of age: the date can be a birth date, so it stays out of every link. */
export const BIRTH_OCCASIONS: ReadonlySet<string> = new Set(['birthday', 'baby', 'coming-of-age']);

/** How a saved birth occasion is named: its title is "<label> card", with no date and no names. */
export const BIRTH_OCCASION_SAVE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  birthday: 'Birthday',
  baby: 'New baby',
  'coming-of-age': 'Coming of age',
});

/** The page a birth occasion is saved as. */
export const OCCASIONS_PAGE = '/occasions/';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;
const TIME_RE = /^\d{2}:\d{2}$/u;
const ZONE_RE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,2}$/u;
const KEYS: ReadonlySet<string> = new Set(['o', 'd', 't', 'tz', 'lat', 'lon']);

/** Two decimals, as every occasion link rounds a coordinate (src/ai-tools/plain-text.ts, roundCoordinate). */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * The occasion page a person chose to keep. Null for a birth occasion, whose
 * only stored form is the page address. A zone without coordinates cannot
 * reopen on the page, so that link keeps the day only.
 */
export function savedOccasionPath(
  args: { latitude?: number; longitude?: number },
  data: { occasion: string; date: string; time: string | null; zone: string | null },
): string | null {
  if (BIRTH_OCCASIONS.has(data.occasion)) return null;
  const params = new URLSearchParams({ o: data.occasion, d: data.date });
  const hasCoords = args.latitude !== undefined && args.longitude !== undefined;
  if (data.zone && !hasCoords) return `/occasions/#${params.toString()}`;
  if (data.time) params.set('t', data.time);
  if (data.zone && hasCoords) {
    params.set('tz', data.zone);
    params.set('lat', round2(args.latitude!).toFixed(2));
    params.set('lon', round2(args.longitude!).toFixed(2));
  }
  return `/occasions/#${params.toString()}`;
}

/**
 * Whether a link is one the rule above writes, exactly: the occasions page
 * itself, or that page with only the day, time, zone and two-decimal
 * coordinates of an occasion that is not a birth occasion.
 */
export function isSavedOccasionHref(href: string): boolean {
  if (href === OCCASIONS_PAGE) return true;
  if (!href.startsWith(`${OCCASIONS_PAGE}#`)) return false;
  const params = new URLSearchParams(href.slice(OCCASIONS_PAGE.length + 1));
  const seen = new Set<string>();
  for (const key of params.keys()) {
    if (!KEYS.has(key) || seen.has(key)) return false;
    seen.add(key);
  }
  const occasion = params.get('o');
  const date = params.get('d');
  if (!occasion || !(OCCASION_KINDS as readonly string[]).includes(occasion) || BIRTH_OCCASIONS.has(occasion)) return false;
  if (!date || !DATE_RE.test(date)) return false;
  const time = params.get('t');
  if (time !== null && !TIME_RE.test(time)) return false;
  const zone = params.get('tz');
  if (zone !== null && !ZONE_RE.test(zone)) return false;
  const lat = params.get('lat');
  const lon = params.get('lon');
  const latitude = lat === null ? undefined : Number(lat);
  const longitude = lon === null ? undefined : Number(lon);
  if ((latitude !== undefined && !Number.isFinite(latitude)) || (longitude !== undefined && !Number.isFinite(longitude))) return false;
  return savedOccasionPath({ latitude, longitude }, { occasion, date, time, zone }) === href;
}

function longDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * The site's saved page for an occasion card on screen: its link by the rule
 * above, titled "<card title> · <long date>", or "<label> card" for a birth
 * occasion. Names and the place are never read.
 */
export function occasionSavedPage(
  shown: { occasion: string; date: string; time: string; city: { tz: string; lat: number; lon: number } | null },
  cardTitle: string,
): { kind: 'occasion'; title: string; href: string } {
  if (BIRTH_OCCASIONS.has(shown.occasion)) {
    return { kind: 'occasion', title: `${BIRTH_OCCASION_SAVE_LABELS[shown.occasion]} card`, href: OCCASIONS_PAGE };
  }
  const href = savedOccasionPath(
    shown.city ? { latitude: shown.city.lat, longitude: shown.city.lon } : {},
    { occasion: shown.occasion, date: shown.date, time: shown.time || null, zone: shown.city?.tz ?? null },
  ) ?? OCCASIONS_PAGE;
  return { kind: 'occasion', title: `${cardTitle} · ${longDate(shown.date)}`, href };
}
