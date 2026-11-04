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
 *   src/lib/horoscope-program.ts), or the month or the year of a published
 *   monthly or yearly reading.
 *
 * - chart twins: the person's Sun sign, and their Moon sign when a birth time
 *   settled it; the server matches the famous people from the site's own
 *   directory, so no name is carried;
 * - a famous chart: the directory slug of a person the site publishes;
 * - a life milestone: its kind, which one (first, second …) and the age it
 *   comes at, never the birth date. The days of its passes stay out too,
 *   because they lead back to the birth date. A link made before that, with
 *   the first and last days as f and l, still opens, and is drawn without them.
 * - the big three: the Sun sign, the Moon sign when the chart settles it (the
 *   card says the Moon sign is undetermined otherwise) and the rising sign
 *   only when it is known, never the birth date;
 * - the Chinese zodiac: the animal, and the year only when the answer was for
 *   a year rather than a birth date, so a birth date's card names the animal
 *   alone (its element would narrow the birth year);
 * - an invitation to compare charts (the private compatibility invite at
 *   /compatibility/invite/): the Sun signs of the two people, when known, and
 *   no other detail of either.
 *
 * The server checks each one against the site's own data before it draws
 * anything: the birthday table, the sky calendar's events, the published
 * horoscopes and the famous-people directory. Pure: no network, storage or
 * logging. Every value import names its file, so the share function loads
 * this module as it is.
 */
import { SHARE_SIGNS, type ShareRef, type ShareSign } from '../lib/share-results.js';
import { parseCivilDate } from '../lib/time/civil-date.js';
import { CHINESE_ZODIAC_ANIMALS, chineseAnimalForCycleYear } from '../data/chinese-zodiac.js';

export const BIRTHDAY_SHARE_PATH = '/share/birthday/';
export const SKY_CALENDAR_SHARE_PATH = '/share/sky-calendar/';
export const HOROSCOPE_SHARE_PATH = '/share/horoscope/';
export const BIRTHDAY_SHARE_IMAGE_PATH = '/api/og/birthday-image';
export const SKY_CALENDAR_SHARE_IMAGE_PATH = '/api/og/sky-calendar-image';
export const HOROSCOPE_SHARE_IMAGE_PATH = '/api/og/horoscope-image';
export const CHART_TWINS_SHARE_PATH = '/share/chart-twins/';
export const FAMOUS_CHART_SHARE_PATH = '/share/famous-chart/';
export const MILESTONE_SHARE_PATH = '/share/milestone/';
export const CHART_TWINS_SHARE_IMAGE_PATH = '/api/og/chart-twins-image';
export const FAMOUS_CHART_SHARE_IMAGE_PATH = '/api/og/famous-chart-image';
export const MILESTONE_SHARE_IMAGE_PATH = '/api/og/milestone-image';
export const BIG_THREE_SHARE_PATH = '/share/big-three/';
export const CHINESE_ZODIAC_SHARE_PATH = '/share/chinese-zodiac/';
export const INVITE_SHARE_PATH = '/share/invite/';
export const BIG_THREE_SHARE_IMAGE_PATH = '/api/og/big-three-image';
export const CHINESE_ZODIAC_SHARE_IMAGE_PATH = '/api/og/chinese-zodiac-image';
export const INVITE_SHARE_IMAGE_PATH = '/api/og/invite-image';

export const BIRTHDAY_SHARE_KEYS: readonly string[] = Object.freeze(['d', 's', 'ref']);
export const SKY_CALENDAR_SHARE_KEYS: readonly string[] = Object.freeze(['k', 'b', 'd', 'ref']);
export const HOROSCOPE_SHARE_KEYS: readonly string[] = Object.freeze(['s', 'd', 'f', 'w', 'm', 'y', 'ref']);
export const CHART_TWINS_SHARE_KEYS: readonly string[] = Object.freeze(['s', 'm', 'ref']);
export const FAMOUS_CHART_SHARE_KEYS: readonly string[] = Object.freeze(['p', 'ref']);
export const MILESTONE_SHARE_KEYS: readonly string[] = Object.freeze(['k', 'i', 'a', 'f', 'l', 'ref']);
export const BIG_THREE_SHARE_KEYS: readonly string[] = Object.freeze(['s', 'm', 'r', 'ref']);
export const CHINESE_ZODIAC_SHARE_KEYS: readonly string[] = Object.freeze(['a', 'y', 'ref']);
export const INVITE_SHARE_KEYS: readonly string[] = Object.freeze(['s', 'p', 'ref']);

export const SKY_EVENT_KINDS = ['new-moon', 'full-moon', 'solar-eclipse', 'lunar-eclipse', 'retrograde'] as const;
export type SkyEventKind = (typeof SKY_EVENT_KINDS)[number];
export const SKY_PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;
export type SkyPlanet = (typeof SKY_PLANETS)[number];
export const SHARE_FOCUSES = ['general', 'love', 'career'] as const;
export type ShareFocus = (typeof SHARE_FOCUSES)[number];
export const MILESTONE_KINDS = ['jupiter-return', 'saturn-return', 'uranus-opposition'] as const;
export type ShareMilestoneKind = (typeof MILESTONE_KINDS)[number];
/** A horoscope's period: a day (with its focus), the week from a Monday, a month or a year. */
export const HOROSCOPE_SHARE_PERIODS = ['day', 'week', 'month', 'year'] as const;
export type HoroscopeSharePeriod = (typeof HOROSCOPE_SHARE_PERIODS)[number];
export const CHINESE_ANIMALS: readonly string[] = Object.freeze(CHINESE_ZODIAC_ANIMALS.map((animal) => animal.slug));
/** The Chinese years get_chinese_zodiac answers for (src/data/lunar-new-year.json, a year inside each end). */
export const CHINESE_SHARE_FIRST_YEAR = 1901;
export const CHINESE_SHARE_LAST_YEAR = 2100;

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
  /** A day's date, the Monday the week starts, or the first day of the month or year. */
  date: string;
  period: HoroscopeSharePeriod;
  /** Always general for a week, a month and a year. */
  focus: ShareFocus;
  ref: ShareRef | null;
}

export interface ChartTwinsShare {
  sun: ShareSign;
  /** Only when a birth time settled it; otherwise only the Sun is compared. */
  moon: ShareSign | null;
  ref: ShareRef | null;
}

export interface FamousChartShare {
  /** A directory slug; the server draws only a person the site publishes. */
  slug: string;
  ref: ShareRef | null;
}

export interface MilestoneShare {
  kind: ShareMilestoneKind;
  /** 1 for the first return, 2 for the second … */
  index: number;
  /** The age at the first pass. */
  age: number;
  ref: ShareRef | null;
}

export interface BigThreeShare {
  sun: ShareSign;
  /** Null when the chart does not settle it: the card says the Moon sign is undetermined. */
  moon: ShareSign | null;
  /** Only when it is known, which takes a birth time, so only beside a settled Moon. */
  rising: ShareSign | null;
  ref: ShareRef | null;
}

export interface ChineseZodiacShare {
  /** An animal slug (src/data/chinese-zodiac.ts). */
  animal: string;
  /** The Chinese year, only for an answer about a year; its animal is the link's. Null for a birth date's. */
  year: number | null;
  ref: ShareRef | null;
}

export interface InviteShare {
  /** The Sun sign of the person inviting, when known. */
  sun: ShareSign | null;
  /** The Sun sign of the person invited, when known. */
  partner: ShareSign | null;
  ref: ShareRef | null;
}

/** Month lengths for a birthday, with 29 February. */
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const MONTH_DAY_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/u;
const DATE_RE = /^(?:18|19|20|21)[0-9]{2}-[0-9]{2}-[0-9]{2}$/u;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SLUG_MAX = 64;
const INDEX_RE = /^[1-9][0-9]?$/u;
const AGE_RE = /^[1-9][0-9]{0,2}$/u;
/**
 * The highest ordinal and age a milestone link may carry. The tool takes
 * birth dates from 1800 and lists Jupiter returns to one cycle past the
 * person's age, so a historical birth date reaches about the twentieth
 * return, past age 230.
 */
const MILESTONE_INDEX_MAX = 30;
const MILESTONE_AGE_MAX = 300;
/** The longest a milestone's passes may run, first to last, in days (the longest from 1800 to 2110 is under 300). */
const MILESTONE_SPAN_MAX = 400;
/**
 * When each milestone comes: about index × the planet's cycle in years (the
 * opposition at half Uranus's), give or take what the orbit's eccentricity
 * allows (src/ai-tools/share-links.test.ts checks every birth year).
 */
const MILESTONE_AGES: Readonly<Record<ShareMilestoneKind, { cycle: number; within: number }>> = {
  'jupiter-return': { cycle: 11.86, within: 2 },
  'saturn-return': { cycle: 29.46, within: 2 },
  'uranus-opposition': { cycle: 42, within: 5 },
};

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

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

/** A milestone a link may name: a real kind and ordinal, and an age near when that milestone comes. */
function validMilestone(share: Omit<MilestoneShare, 'ref'>): boolean {
  if (!(MILESTONE_KINDS as readonly string[]).includes(share.kind)) return false;
  if (!Number.isInteger(share.index) || share.index < 1 || share.index > MILESTONE_INDEX_MAX) return false;
  if (!Number.isInteger(share.age) || share.age < 1 || share.age > MILESTONE_AGE_MAX) return false;
  if (share.kind === 'uranus-opposition' && share.index !== 1) return false;
  const { cycle, within } = MILESTONE_AGES[share.kind];
  return Math.abs(share.age - share.index * cycle) <= within;
}

/**
 * An older link's first and last days, which it is still checked against before it opens: passes that
 * start on or before they end and run no longer than the slowest one does. New links leave them out.
 */
function validPasses(first: string, last: string): boolean {
  if (!validDate(first) || !validDate(last)) return false;
  const span = dayNumber(last) - dayNumber(first);
  return span >= 0 && span <= MILESTONE_SPAN_MAX;
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
  if (share.period === 'week') params.set('w', share.date);
  else if (share.period === 'month') params.set('m', share.date.slice(0, 7));
  else if (share.period === 'year') params.set('y', share.date.slice(0, 4));
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
  const share: HoroscopeShare = { sign: source.sign, date: source.date, period: source.week ? 'week' : 'day', focus: source.week ? 'general' : source.focus as ShareFocus, ref };
  return `${origin}${HOROSCOPE_SHARE_PATH}?${horoscopeQuery(share, true)}`;
}

/** A published monthly or yearly reading's share link: the sign and the month or year that `date` falls in. */
export function horoscopePeriodShareUrl(origin: string, source: { sign: string; period: 'month' | 'year'; date: string }): string | null {
  if (!isSign(source.sign) || !validDate(source.date)) return null;
  const date = source.period === 'month' ? `${source.date.slice(0, 7)}-01` : `${source.date.slice(0, 4)}-01-01`;
  return `${origin}${HOROSCOPE_SHARE_PATH}?${horoscopeQuery({ sign: source.sign, date, period: source.period, focus: 'general', ref: null })}`;
}

export function chartTwinsQuery(share: ChartTwinsShare, withRef = false): string {
  const params = new URLSearchParams({ s: share.sun });
  if (share.moon) params.set('m', share.moon);
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function famousChartQuery(share: FamousChartShare, withRef = false): string {
  const params = new URLSearchParams({ p: share.slug });
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function milestoneQuery(share: MilestoneShare, withRef = false): string {
  const params = new URLSearchParams({ k: share.kind, i: String(share.index), a: String(share.age) });
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

/** Chart twins' share link: the Sun sign, and the Moon sign when it was settled. Null without a settled Sun. */
export function chartTwinsShareUrl(origin: string, you: { sun: string | null; moon: string | null }): string | null {
  if (!isSign(you.sun)) return null;
  return `${origin}${CHART_TWINS_SHARE_PATH}?${chartTwinsQuery({ sun: you.sun, moon: isSign(you.moon) ? you.moon : null, ref: null })}`;
}

/** A famous chart's share link: the person's directory slug. */
export function famousChartShareUrl(origin: string, slug: string): string | null {
  return SLUG_RE.test(slug) && slug.length <= SLUG_MAX ? `${origin}${FAMOUS_CHART_SHARE_PATH}?${famousChartQuery({ slug, ref: null })}` : null;
}

/** A life milestone's share link, from the tool's milestone row: its kind, ordinal and age, never the days of its passes. */
export function milestoneShareUrl(origin: string, milestone: { kind: string; index: number; age: number }): string | null {
  const share = { kind: milestone.kind as ShareMilestoneKind, index: milestone.index, age: milestone.age };
  return validMilestone(share) ? `${origin}${MILESTONE_SHARE_PATH}?${milestoneQuery({ ...share, ref: null })}` : null;
}

export function bigThreeQuery(share: BigThreeShare, withRef = false): string {
  const params = new URLSearchParams({ s: share.sun });
  if (share.moon) params.set('m', share.moon);
  if (share.moon && share.rising) params.set('r', share.rising);
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function chineseZodiacQuery(share: ChineseZodiacShare, withRef = false): string {
  const params = new URLSearchParams({ a: share.animal });
  if (share.year !== null) params.set('y', String(share.year));
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function inviteQuery(share: InviteShare, withRef = false): string {
  const params = new URLSearchParams();
  if (share.sun) params.set('s', share.sun);
  if (share.partner) params.set('p', share.partner);
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

/**
 * The big three's share link: the Sun sign, the Moon sign when the chart settles it and the rising sign when it
 * is known. Null without a settled Sun. Never the birth date, time or place.
 */
export function bigThreeShareUrl(origin: string, chart: { sun: string | null; moon: string | null; rising: string | null }): string | null {
  if (!isSign(chart.sun)) return null;
  const moon = isSign(chart.moon) ? chart.moon : null;
  const rising = moon && isSign(chart.rising) ? chart.rising : null;
  return `${origin}${BIG_THREE_SHARE_PATH}?${bigThreeQuery({ sun: chart.sun, moon, rising, ref: null })}`;
}

/** A year the Chinese zodiac card may name, with its animal. */
function validChineseYear(year: number, animal: string): boolean {
  return Number.isInteger(year) && year >= CHINESE_SHARE_FIRST_YEAR && year <= CHINESE_SHARE_LAST_YEAR && chineseAnimalForCycleYear(year).slug === animal;
}

/**
 * The Chinese zodiac's share link: the animal, and the year only when the answer was for a year (pass null for a
 * birth date's answer, whose year would lead back to the birth date).
 */
export function chineseZodiacShareUrl(origin: string, source: { animal: string; year: number | null }): string | null {
  if (!CHINESE_ANIMALS.includes(source.animal)) return null;
  if (source.year !== null && !validChineseYear(source.year, source.animal)) return null;
  return `${origin}${CHINESE_ZODIAC_SHARE_PATH}?${chineseZodiacQuery({ animal: source.animal, year: source.year, ref: null })}`;
}

/** An invitation to compare charts: the two Sun signs when known, and nothing else; the bare page when neither is. */
export function inviteShareUrl(origin: string, signs: { sun: string | null; partner: string | null }): string {
  const query = inviteQuery({ sun: isSign(signs.sun) ? signs.sun : null, partner: isSign(signs.partner) ? signs.partner : null, ref: null });
  return `${origin}${INVITE_SHARE_PATH}${query ? `?${query}` : ''}`;
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

const MONTH_RE = /^(?:18|19|20|21)[0-9]{2}-(?:0[1-9]|1[0-2])$/u;
const YEAR_RE = /^(?:18|19|20|21)[0-9]{2}$/u;

export function parseHoroscopeShare(params: URLSearchParams): HoroscopeShare | null {
  const fields = strictParams(params, HOROSCOPE_SHARE_KEYS);
  if (!fields) return null;
  const sign = fields.get('s');
  const [day, week, month, year] = ['d', 'w', 'm', 'y'].map((key) => fields.get(key));
  const focus = fields.get('f');
  const ref = readRef(fields.get('ref'));
  if (!isSign(sign) || ref === undefined) return null;
  // One period: a day's reading, a week's, a month's or a year's; only a day has a focus.
  if ([day, week, month, year].filter((value) => value !== undefined).length !== 1 || (day === undefined && focus !== undefined)) return null;
  if (focus !== undefined && !(SHARE_FOCUSES as readonly string[]).includes(focus)) return null;
  if (month !== undefined) return MONTH_RE.test(month) ? { sign, date: `${month}-01`, period: 'month', focus: 'general', ref } : null;
  if (year !== undefined) return YEAR_RE.test(year) && validDate(`${year}-01-01`) ? { sign, date: `${year}-01-01`, period: 'year', focus: 'general', ref } : null;
  const date = (day ?? week)!;
  if (!validDate(date) || (week !== undefined && !isMonday(date))) return null;
  return { sign, date, period: week !== undefined ? 'week' : 'day', focus: (focus as ShareFocus | undefined) ?? 'general', ref };
}

export function parseChartTwinsShare(params: URLSearchParams): ChartTwinsShare | null {
  const fields = strictParams(params, CHART_TWINS_SHARE_KEYS);
  if (!fields) return null;
  const sun = fields.get('s');
  const moon = fields.get('m');
  const ref = readRef(fields.get('ref'));
  if (!isSign(sun) || (moon !== undefined && !isSign(moon)) || ref === undefined) return null;
  return { sun, moon: moon ?? null, ref };
}

export function parseFamousChartShare(params: URLSearchParams): FamousChartShare | null {
  const fields = strictParams(params, FAMOUS_CHART_SHARE_KEYS);
  if (!fields) return null;
  const slug = fields.get('p');
  const ref = readRef(fields.get('ref'));
  if (slug === undefined || slug.length > SLUG_MAX || !SLUG_RE.test(slug) || ref === undefined) return null;
  return { slug, ref };
}

/** A milestone link, new (k, i, a) or older (with f and l too, both or neither, checked and then dropped). */
export function parseMilestoneShare(params: URLSearchParams): MilestoneShare | null {
  const fields = strictParams(params, MILESTONE_SHARE_KEYS);
  if (!fields) return null;
  const [kind, index, age, first, last] = ['k', 'i', 'a', 'f', 'l'].map((key) => fields.get(key));
  const ref = readRef(fields.get('ref'));
  if (kind === undefined || index === undefined || age === undefined || ref === undefined) return null;
  if (!INDEX_RE.test(index) || !AGE_RE.test(age)) return null;
  if ((first === undefined) !== (last === undefined)) return null;
  if (first !== undefined && last !== undefined && !validPasses(first, last)) return null;
  const share = { kind: kind as ShareMilestoneKind, index: Number(index), age: Number(age) };
  return validMilestone(share) ? { ...share, ref } : null;
}

export function parseBigThreeShare(params: URLSearchParams): BigThreeShare | null {
  const fields = strictParams(params, BIG_THREE_SHARE_KEYS);
  if (!fields) return null;
  const [sun, moon, rising] = ['s', 'm', 'r'].map((key) => fields.get(key));
  const ref = readRef(fields.get('ref'));
  if (!isSign(sun) || ref === undefined) return null;
  if ((moon !== undefined && !isSign(moon)) || (rising !== undefined && !isSign(rising))) return null;
  // A known rising sign takes a birth time, and a birth time settles the Moon.
  if (rising !== undefined && moon === undefined) return null;
  return { sun, moon: moon ?? null, rising: rising ?? null, ref };
}

export function parseChineseZodiacShare(params: URLSearchParams): ChineseZodiacShare | null {
  const fields = strictParams(params, CHINESE_ZODIAC_SHARE_KEYS);
  if (!fields) return null;
  const animal = fields.get('a');
  const year = fields.get('y');
  const ref = readRef(fields.get('ref'));
  if (animal === undefined || !CHINESE_ANIMALS.includes(animal) || ref === undefined) return null;
  if (year === undefined) return { animal, year: null, ref };
  return /^[12][0-9]{3}$/u.test(year) && validChineseYear(Number(year), animal) ? { animal, year: Number(year), ref } : null;
}

/** An invitation names at least one Sun sign; the bare page is the plain one. */
export function parseInviteShare(params: URLSearchParams): InviteShare | null {
  const fields = strictParams(params, INVITE_SHARE_KEYS);
  if (!fields) return null;
  const sun = fields.get('s');
  const partner = fields.get('p');
  const ref = readRef(fields.get('ref'));
  if (ref === undefined || (sun === undefined && partner === undefined)) return null;
  if ((sun !== undefined && !isSign(sun)) || (partner !== undefined && !isSign(partner))) return null;
  return { sun: sun ?? null, partner: partner ?? null, ref };
}
