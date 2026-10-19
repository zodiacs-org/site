/**
 * Share links for two results of the Zodiacs app: a compatibility score and
 * a date's rating. The link's query string carries only what its preview
 * image shows: first names or "Person A/B", Sun and Moon signs, the scores
 * and a verdict key, and for a date the occasion, the day and a place name.
 * It never carries a birth date, a time or coordinates.
 *
 * Every parameter is checked against a fixed vocabulary or a short plain-text
 * pattern; a query with anything else is not a share query. Pure: no network,
 * storage or logging.
 */
import { COMPAT_VERDICTS, compatVerdictKey, type CompatVerdictKey } from './compat-score.js';
import { DATE_VERDICTS, dateVerdictKey, type DateVerdictKey } from './occasions/date-score.js';
import { OCCASION_KINDS, type OccasionKind } from './occasions/kinds.js';
import { parseCivilDate } from './time/civil-date.js';

export const SHARE_SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const;
export type ShareSign = (typeof SHARE_SIGNS)[number];
export type ShareRef = 'chatgpt' | 'assistant';

export const COMPATIBILITY_SHARE_PATH = '/share/compatibility/';
export const OCCASION_SHARE_PATH = '/share/occasion/';
export const COMPATIBILITY_SHARE_IMAGE_PATH = '/api/og/compatibility-image';
export const OCCASION_SHARE_IMAGE_PATH = '/api/og/occasion-image';

export const COMPATIBILITY_SHARE_KEYS: readonly string[] = Object.freeze(['a', 'b', 'as', 'bs', 'score', 'attraction', 'communication', 'stability', 'v', 'ref']);
export const OCCASION_SHARE_KEYS: readonly string[] = Object.freeze(['o', 'd', 'n', 'p', 'sun', 'moon', 'score', 'v', 'ref']);

export interface CompatibilityShare {
  a: string | null;
  b: string | null;
  aSun: ShareSign | null;
  bSun: ShareSign | null;
  score: number;
  attraction: number;
  communication: number;
  stability: number;
  verdict: CompatVerdictKey;
  ref: ShareRef | null;
}

export interface OccasionShare {
  occasion: OccasionKind;
  date: string;
  names: string | null;
  place: string | null;
  sun: ShareSign | null;
  moon: ShareSign | null;
  score: number;
  verdict: DateVerdictKey;
  ref: ShareRef | null;
}

export const COMPATIBILITY_VERDICT_TEXT: Readonly<Record<CompatVerdictKey, string>> = COMPAT_VERDICTS;
export const OCCASION_VERDICT_TEXT: Readonly<Record<DateVerdictKey, string>> = DATE_VERDICTS;

/** The headline a shared date card gives each occasion. */
export const OCCASION_SHARE_HEADLINES: Readonly<Record<OccasionKind, string>> = {
  wedding: 'Our wedding',
  anniversary: 'Our anniversary',
  met: 'The day we met',
  birthday: 'A birthday',
  baby: 'A new arrival',
  pet: 'A pet’s big day',
  home: 'A new home',
  job: 'A first day at work',
  graduation: 'Graduation day',
  retirement: 'Retirement',
  'coming-of-age': 'Coming of age',
  gathering: 'An evening under the sky',
};

// Letters the preview's typefaces draw: Latin, with its accents (Latin-1 and
// Latin Extended-A), and Cyrillic as EB Garamond's Cyrillic subset draws it
// (the Russian, Ukrainian, Belarusian, Serbian, Macedonian and Bulgarian
// alphabets, and Ґ). A name in another script is left out of the link.
const LETTER = 'A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u017F\\u0400-\\u045F\\u0490\\u0491';
const NAME_RE = new RegExp(`^[${LETTER}][${LETTER} .'’-]*$`, 'u');
const NAMES_RE = new RegExp(`^[${LETTER}][${LETTER} .,&'’-]*$`, 'u');
const PLACE_RE = new RegExp(`^[${LETTER}0-9][${LETTER}0-9 .,'’()-]*$`, 'u');
const SCORE_RE = /^(?:0|[1-9][0-9]?|100)$/u;
const DATE_RE = /^(?:18|19|20|21)[0-9]{2}-[0-9]{2}-[0-9]{2}$/u;

export const SHARE_NAME_MAX = 24;
export const SHARE_NAMES_MAX = 40;
export const SHARE_PLACE_MAX = 48;

function plain(value: string, pattern: RegExp, max: number): string | null {
  if (value.length < 1 || value.length > max || value !== value.trim() || /\s{2}/u.test(value)) return null;
  // A full stop must end a word ("J. Smith", "St. Louis"), so no text reads as a web address ("example.com").
  if (/\.[^\s]/u.test(value)) return null;
  return pattern.test(value) ? value : null;
}

/** A first name a share link can carry, or null. */
export const shareName = (value: string | null | undefined): string | null => (value ? plain(value.trim(), NAME_RE, SHARE_NAME_MAX) : null);
/** Up to two first names for a date card, or null. */
export const shareNames = (value: string | null | undefined): string | null => (value ? plain(value.trim().replace(/\s+/gu, ' '), NAMES_RE, SHARE_NAMES_MAX) : null);
/** A place name for a date card: the whole name, else the part before its first comma, or null. */
export function sharePlace(value: string | null | undefined): string | null {
  if (!value) return null;
  const whole = value.trim().replace(/\s+/gu, ' ');
  return plain(whole, PLACE_RE, SHARE_PLACE_MAX) ?? plain(whole.split(',')[0].trim(), PLACE_RE, SHARE_PLACE_MAX);
}

const isSign = (value: string | null | undefined): value is ShareSign => !!value && (SHARE_SIGNS as readonly string[]).includes(value);
const isScore = (value: number) => Number.isInteger(value) && value >= 0 && value <= 100;

// ── Building ─────────────────────────────────────────────────────────

export interface CompatibilityShareSource {
  a: { name: string | null; sun: string | null };
  b: { name: string | null; sun: string | null };
  score: { overall: number; areas: { attraction: number; communication: number; stability: number } };
}

/** The query of a share: in a fixed order, with ?ref= only when asked for (the image's query has none). */
export function compatibilityQuery(share: CompatibilityShare, withRef = false): string {
  const params = new URLSearchParams();
  if (share.a) params.set('a', share.a);
  if (share.aSun) params.set('as', share.aSun);
  if (share.b) params.set('b', share.b);
  if (share.bSun) params.set('bs', share.bSun);
  params.set('score', String(share.score));
  params.set('attraction', String(share.attraction));
  params.set('communication', String(share.communication));
  params.set('stability', String(share.stability));
  params.set('v', share.verdict);
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function occasionQuery(share: OccasionShare, withRef = false): string {
  const params = new URLSearchParams({ o: share.occasion, d: share.date });
  if (share.names) params.set('n', share.names);
  if (share.place) params.set('p', share.place);
  if (share.sun) params.set('sun', share.sun);
  if (share.moon) params.set('moon', share.moon);
  params.set('score', String(share.score));
  params.set('v', share.verdict);
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function compatibilityShareQuery(source: CompatibilityShareSource): string | null {
  const { overall, areas } = source.score;
  if (![overall, areas.attraction, areas.communication, areas.stability].every(isScore)) return null;
  return compatibilityQuery({
    a: shareName(source.a.name),
    b: shareName(source.b.name),
    aSun: isSign(source.a.sun) ? source.a.sun : null,
    bSun: isSign(source.b.sun) ? source.b.sun : null,
    score: overall,
    attraction: areas.attraction,
    communication: areas.communication,
    stability: areas.stability,
    verdict: compatVerdictKey(overall),
    ref: null,
  });
}

export interface OccasionShareSource {
  occasion: OccasionKind;
  date: string;
  names: string | null;
  place: string | null;
  sun: string | null;
  moon: string | null;
  score: number;
}

export function occasionShareQuery(source: OccasionShareSource): string | null {
  if (!isScore(source.score) || !(OCCASION_KINDS as readonly string[]).includes(source.occasion) || !validDate(source.date)) return null;
  return occasionQuery({
    occasion: source.occasion,
    date: source.date,
    names: shareNames(source.names),
    place: sharePlace(source.place),
    sun: isSign(source.sun) ? source.sun : null,
    moon: isSign(source.moon) ? source.moon : null,
    score: source.score,
    verdict: dateVerdictKey(source.score),
    ref: null,
  });
}

export const compatibilityShareUrl = (origin: string, source: CompatibilityShareSource): string | null => {
  const query = compatibilityShareQuery(source);
  return query === null ? null : `${origin}${COMPATIBILITY_SHARE_PATH}?${query}`;
};

export const occasionShareUrl = (origin: string, source: OccasionShareSource): string | null => {
  const query = occasionShareQuery(source);
  return query === null ? null : `${origin}${OCCASION_SHARE_PATH}?${query}`;
};

// ── Reading ──────────────────────────────────────────────────────────

function validDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = parseCivilDate(value);
  return !!date && date.year >= 1800 && date.year <= 2199;
}

/** Each key at most once, and only the keys this kind of link has. */
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

function readScore(value: string | undefined): number | null {
  return value !== undefined && SCORE_RE.test(value) ? Number(value) : null;
}

function readOptional<T>(value: string | undefined, read: (value: string) => T | null): T | null | undefined {
  if (value === undefined) return null;
  const parsed = read(value);
  return parsed === null ? undefined : parsed;
}

const readSign = (value: string): ShareSign | null => (isSign(value) ? value : null);

export function parseCompatibilityShare(params: URLSearchParams): CompatibilityShare | null {
  const fields = strictParams(params, COMPATIBILITY_SHARE_KEYS);
  if (!fields) return null;
  const score = readScore(fields.get('score'));
  const attraction = readScore(fields.get('attraction'));
  const communication = readScore(fields.get('communication'));
  const stability = readScore(fields.get('stability'));
  const verdict = fields.get('v');
  if (score === null || attraction === null || communication === null || stability === null) return null;
  if (verdict === undefined || !Object.hasOwn(COMPAT_VERDICTS, verdict)) return null;
  const a = readOptional(fields.get('a'), (value) => plain(value, NAME_RE, SHARE_NAME_MAX));
  const b = readOptional(fields.get('b'), (value) => plain(value, NAME_RE, SHARE_NAME_MAX));
  const aSun = readOptional(fields.get('as'), readSign);
  const bSun = readOptional(fields.get('bs'), readSign);
  const ref = readRef(fields.get('ref'));
  if (a === undefined || b === undefined || aSun === undefined || bSun === undefined || ref === undefined) return null;
  return { a, b, aSun, bSun, score, attraction, communication, stability, verdict: verdict as CompatVerdictKey, ref };
}

export function parseOccasionShare(params: URLSearchParams): OccasionShare | null {
  const fields = strictParams(params, OCCASION_SHARE_KEYS);
  if (!fields) return null;
  const occasion = fields.get('o');
  const date = fields.get('d');
  const score = readScore(fields.get('score'));
  const verdict = fields.get('v');
  if (occasion === undefined || !(OCCASION_KINDS as readonly string[]).includes(occasion)) return null;
  if (date === undefined || !validDate(date) || score === null) return null;
  if (verdict === undefined || !Object.hasOwn(DATE_VERDICTS, verdict)) return null;
  const names = readOptional(fields.get('n'), (value) => plain(value, NAMES_RE, SHARE_NAMES_MAX));
  const place = readOptional(fields.get('p'), (value) => plain(value, PLACE_RE, SHARE_PLACE_MAX));
  const sun = readOptional(fields.get('sun'), readSign);
  const moon = readOptional(fields.get('moon'), readSign);
  const ref = readRef(fields.get('ref'));
  if (names === undefined || place === undefined || sun === undefined || moon === undefined || ref === undefined) return null;
  return { occasion: occasion as OccasionKind, date, names, place, sun, moon, score, verdict: verdict as DateVerdictKey, ref };
}
