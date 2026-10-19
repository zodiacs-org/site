/**
 * Share links for three more assistant cards: a birthday, the sky calendar's
 * next event and a horoscope, read by the share pages and preview images in
 * src/server/result-preview.ts. As with src/lib/share-results.ts, a link's
 * query carries only what its preview shows, each value from a fixed
 * vocabulary or pattern, and a query with anything else is not a share:
 *
 * - a birthday: the month and day, never a year, and the Sun sign only for a
 *   cusp date whose sign the birth year or time settled;
 * - the sky calendar: the event's kind, the planet of a retrograde and the
 *   date (UTC) it starts;
 * - a horoscope: the Sun sign and the date, with the focus of a day's reading,
 *   or the Monday a week's reading starts (weeks are ISO weeks, as in
 *   src/lib/horoscope-program.ts).
 *
 * The server checks each one against the site's own data before it draws
 * anything: the birthday table, the sky calendar's events and the published
 * horoscopes. Pure: no network, storage or logging. Every value import names
 * its file, so the share function loads this module as it is.
 */
import { SHARE_SIGNS, type ShareRef, type ShareSign } from '../lib/share-results.js';
import { parseCivilDate } from '../lib/time/civil-date.js';

export const BIRTHDAY_SHARE_PATH = '/share/birthday/';
export const SKY_CALENDAR_SHARE_PATH = '/share/sky-calendar/';
export const HOROSCOPE_SHARE_PATH = '/share/horoscope/';
export const BIRTHDAY_SHARE_IMAGE_PATH = '/api/og/birthday-image';
export const SKY_CALENDAR_SHARE_IMAGE_PATH = '/api/og/sky-calendar-image';
export const HOROSCOPE_SHARE_IMAGE_PATH = '/api/og/horoscope-image';

export const BIRTHDAY_SHARE_KEYS: readonly string[] = Object.freeze(['d', 's', 'ref']);
export const SKY_CALENDAR_SHARE_KEYS: readonly string[] = Object.freeze(['k', 'b', 'd', 'ref']);
export const HOROSCOPE_SHARE_KEYS: readonly string[] = Object.freeze(['s', 'd', 'f', 'w', 'ref']);

export const SKY_EVENT_KINDS = ['new-moon', 'full-moon', 'solar-eclipse', 'lunar-eclipse', 'retrograde'] as const;
export type SkyEventKind = (typeof SKY_EVENT_KINDS)[number];
export const SKY_PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;
export type SkyPlanet = (typeof SKY_PLANETS)[number];
export const SHARE_FOCUSES = ['general', 'love', 'career'] as const;
export type ShareFocus = (typeof SHARE_FOCUSES)[number];

export interface BirthdayShare {
  month: number;
  day: number;
  /** Only for a cusp date whose sign was settled; another date's sign follows from the date. */
  sign: ShareSign | null;
  ref: ShareRef | null;
}

export interface SkyCalendarShare {
  kind: SkyEventKind;
  /** The retrograde's planet; null for the other kinds. */
  planet: SkyPlanet | null;
  /** The date (UTC) the event starts or peaks. */
  date: string;
  ref: ShareRef | null;
}

export interface HoroscopeShare {
  sign: ShareSign;
  /** A day's date, or the Monday the week starts. */
  date: string;
  week: boolean;
  /** Always general for the week. */
  focus: ShareFocus;
  ref: ShareRef | null;
}

/** Month lengths for a birthday, with 29 February. */
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const MONTH_DAY_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/u;
const DATE_RE = /^(?:18|19|20|21)[0-9]{2}-[0-9]{2}-[0-9]{2}$/u;

const isSign = (value: string | null | undefined): value is ShareSign => !!value && (SHARE_SIGNS as readonly string[]).includes(value);
const pad = (value: number) => String(value).padStart(2, '0');

function validDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = parseCivilDate(value);
  return !!date && date.year >= 1800 && date.year <= 2199;
}

/** A week's reading starts on a Monday (UTC). */
const isMonday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() === 1;

function validMonthDay(month: number, day: number): boolean {
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}

// ── Building ─────────────────────────────────────────────────────────

/** The query of a share, in a fixed order, with ?ref= only when asked for (the image's query has none). */
export function birthdayQuery(share: BirthdayShare, withRef = false): string {
  const params = new URLSearchParams({ d: `${pad(share.month)}-${pad(share.day)}` });
  if (share.sign) params.set('s', share.sign);
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function skyCalendarQuery(share: SkyCalendarShare, withRef = false): string {
  const params = new URLSearchParams({ k: share.kind });
  if (share.planet) params.set('b', share.planet);
  params.set('d', share.date);
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function horoscopeQuery(share: HoroscopeShare, withRef = false): string {
  const params = new URLSearchParams({ s: share.sign });
  if (share.week) params.set('w', share.date);
  else {
    params.set('d', share.date);
    if (share.focus !== 'general') params.set('f', share.focus);
  }
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

/** A birthday's share link: the month and day, and a cusp date's settled sign. */
export function birthdayShareUrl(origin: string, source: { month: number; day: number; cuspSign: string | null }): string | null {
  if (!validMonthDay(source.month, source.day)) return null;
  return `${origin}${BIRTHDAY_SHARE_PATH}?${birthdayQuery({ month: source.month, day: source.day, sign: isSign(source.cuspSign) ? source.cuspSign : null, ref: null })}`;
}

/**
 * The share of a sky calendar event, from its feed id (src/lib/return-visits/sky-calendar.ts):
 * "new-moon-<instant>", "solar-eclipse-<instant>" or "Mercury-retrograde-<instant>".
 */
export function skyCalendarShareFromEvent(event: { id: string; start: string }): Omit<SkyCalendarShare, 'ref'> | null {
  const date = new Date(event.start);
  if (!Number.isFinite(date.getTime())) return null;
  const day = date.toISOString().slice(0, 10);
  const moon = /^(new|full)-moon-/u.exec(event.id);
  if (moon) return { kind: `${moon[1]}-moon` as SkyEventKind, planet: null, date: day };
  const eclipse = /^(solar|lunar)-eclipse-/u.exec(event.id);
  if (eclipse) return { kind: `${eclipse[1]}-eclipse` as SkyEventKind, planet: null, date: day };
  const retrograde = /^([A-Z][a-z]+)-retrograde-/u.exec(event.id);
  const planet = retrograde?.[1].toLowerCase();
  if (planet && (SKY_PLANETS as readonly string[]).includes(planet)) return { kind: 'retrograde', planet: planet as SkyPlanet, date: day };
  return null;
}

export function skyCalendarShareUrl(origin: string, event: { id: string; start: string }): string | null {
  const share = skyCalendarShareFromEvent(event);
  return share && validDate(share.date) ? `${origin}${SKY_CALENDAR_SHARE_PATH}?${skyCalendarQuery({ ...share, ref: null })}` : null;
}

/** A horoscope's share link; `ref` is added here for links outside a tool result, such as the panel's. */
export function horoscopeShareUrl(origin: string, source: { sign: string; date: string; week: boolean; focus: string }, ref: ShareRef | null = null): string | null {
  if (!isSign(source.sign) || !validDate(source.date) || !(SHARE_FOCUSES as readonly string[]).includes(source.focus)) return null;
  if (source.week && !isMonday(source.date)) return null;
  const share: HoroscopeShare = { sign: source.sign, date: source.date, week: source.week, focus: source.week ? 'general' : source.focus as ShareFocus, ref };
  return `${origin}${HOROSCOPE_SHARE_PATH}?${horoscopeQuery(share, true)}`;
}

// ── Reading ──────────────────────────────────────────────────────────

/** Each key at most once, and only the keys this kind of link has (as src/lib/share-results.ts reads them). */
function strictParams(params: URLSearchParams, allowed: readonly string[]): Map<string, string> | null {
  const seen = new Map<string, string>();
  for (const [key, value] of params) {
    if (!allowed.includes(key) || seen.has(key)) return null;
    seen.set(key, value);
  }
  return seen;
}

function readRef(value: string | undefined): ShareRef | null | undefined {
  if (value === undefined) return null;
  return value === 'chatgpt' || value === 'assistant' ? value : undefined;
}

export function parseBirthdayShare(params: URLSearchParams): BirthdayShare | null {
  const fields = strictParams(params, BIRTHDAY_SHARE_KEYS);
  if (!fields) return null;
  const match = MONTH_DAY_RE.exec(fields.get('d') ?? '');
  if (!match) return null;
  const [month, day] = [Number(match[1]), Number(match[2])];
  if (!validMonthDay(month, day)) return null;
  const sign = fields.get('s');
  const ref = readRef(fields.get('ref'));
  if ((sign !== undefined && !isSign(sign)) || ref === undefined) return null;
  return { month, day, sign: sign ?? null, ref };
}

export function parseSkyCalendarShare(params: URLSearchParams): SkyCalendarShare | null {
  const fields = strictParams(params, SKY_CALENDAR_SHARE_KEYS);
  if (!fields) return null;
  const kind = fields.get('k');
  const planet = fields.get('b');
  const date = fields.get('d');
  const ref = readRef(fields.get('ref'));
  if (kind === undefined || !(SKY_EVENT_KINDS as readonly string[]).includes(kind) || date === undefined || !validDate(date) || ref === undefined) return null;
  // A retrograde names its planet, and nothing else does.
  if ((kind === 'retrograde') !== (planet !== undefined)) return null;
  if (planet !== undefined && !(SKY_PLANETS as readonly string[]).includes(planet)) return null;
  return { kind: kind as SkyEventKind, planet: (planet as SkyPlanet | undefined) ?? null, date, ref };
}

export function parseHoroscopeShare(params: URLSearchParams): HoroscopeShare | null {
  const fields = strictParams(params, HOROSCOPE_SHARE_KEYS);
  if (!fields) return null;
  const sign = fields.get('s');
  const day = fields.get('d');
  const week = fields.get('w');
  const focus = fields.get('f');
  const ref = readRef(fields.get('ref'));
  if (!isSign(sign) || ref === undefined) return null;
  // A day's reading or a week's, never both; a week has no focus.
  if ((day === undefined) === (week === undefined) || (week !== undefined && focus !== undefined)) return null;
  const date = (day ?? week)!;
  if (!validDate(date) || (week !== undefined && !isMonday(date))) return null;
  if (focus !== undefined && !(SHARE_FOCUSES as readonly string[]).includes(focus)) return null;
  return { sign, date, week: week !== undefined, focus: (focus as ShareFocus | undefined) ?? 'general', ref };
}
