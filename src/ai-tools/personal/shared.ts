/**
 * What the personal tools share: the birth fields they take, the one context
 * the hosted server hands them, and casting the birth chart once.
 *
 * The personal tools (get_vedic_signs, get_personal_day, get_retrograde_for_me
 * and get_astrocartography) are offered only while
 * ZODIACS_PERSONAL_TOOLS_ENABLED=1 joins the occasion and coverage switches
 * (docs/platform/zodiacs-ai/PERSONAL_TOOLS.md). Each one computes its answer
 * from the engine and the site's own pre-written wording; none calls a
 * language model. Birth details are used for the one call and never stored,
 * logged, counted or put in a link.
 *
 * This module imports nothing from ../contracts, so the registry it feeds can
 * be imported by contracts without a cycle.
 */
import { z } from 'zod';
import type { LocalTimeModule } from '../../lib/compute-api/local-time';
import { computeChart } from '../../lib/engine/full.js';
import type { Chart } from '../../lib/engine/types';
import { parseCivilDate, parseCivilTime } from '../../lib/time/civil-date';
import type { PlaceTable } from '../features/birthplace';
import { roundCoordinate } from '../plain-text';
import { readingDetail, type ReadingDetail } from '../reading-confidence';

export const PERSONAL_MIN_YEAR = 1800;
export const PERSONAL_MAX_YEAR = 2199;
const ZONE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
const DATE = /^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/;
const HOUR = 3_600_000;

export const zoneField = z.string().min(1).max(64).regex(ZONE);

/** The birth fields every personal tool takes, described as get_natal_chart describes them. */
export const birthFields = {
  birthDate: z.string().regex(DATE).describe('The birth date, such as 1990-05-03 (years 1800 to 2199).'),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional().describe('The birth time on the local clock, such as 08:30, only if the person knows it. Never guess it. Needs zone.'),
  zone: zoneField.optional().describe("The birthplace's time zone, such as Europe/Madrid. Needed with a time or a place."),
  latitude: z.number().min(-90).max(90).optional().describe("Optional. The birthplace's latitude. Give it with longitude and zone. Nothing is stored."),
  longitude: z.number().min(-180).max(180).optional().describe("Optional. The birthplace's longitude, with latitude. Nothing is stored."),
};

/** The same pairing rules as get_natal_chart and get_personal_transits. */
export function refineBirth(args: { time?: string; zone?: string; latitude?: number; longitude?: number }, context: z.RefinementCtx): void {
  if ((args.latitude === undefined) !== (args.longitude === undefined)) context.addIssue({ code: 'custom', message: 'Give latitude and longitude together.' });
  if ((args.time !== undefined || args.latitude !== undefined) && !args.zone) context.addIssue({ code: 'custom', message: 'A birth time or a place needs its time zone.' });
}

export interface BirthArgs {
  birthDate: string;
  time?: string | undefined;
  zone?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
}

export interface Link { title: string; url: string }
export type Verdict = 'allowed' | 'limited' | 'unavailable';

/** What the hosted server hands a personal tool for one call. Nothing in it outlives the call. */
export interface PersonalToolContext {
  now: Date;
  localTime: Pick<LocalTimeModule, 'prepareLocalTime' | 'resolveLocalToUtc'>;
  /** A zone name as tzdb spells it; an unknown name is refused with the field named. */
  resolveZone: (name: string, pointer: string) => Promise<string>;
  /** The time zone the assistant shares with the call, if any (ChatGPT's user location). */
  hostZone?: string | undefined;
  origin: string;
  /** The hosted event budget, for tools that search the sky over a span. */
  allowEvents?: (() => Promise<Verdict>) | undefined;
  /** The GeoNames place index, for tools that take place names. */
  placeTable?: (() => Promise<PlaceTable>) | undefined;
}

export type PersonalToolResult = { data: unknown; links: Link[] } | { refused: 'rate-limited' | 'rate-limit-unavailable' };

export interface PersonalToolDefinition<N extends string = string> {
  readonly name: N;
  /** The tool-call line and the plugin's details. */
  readonly title: string;
  readonly description: string;
  /** What get_capabilities says it does. */
  readonly summary: string;
  readonly input: z.ZodType;
  readonly data: z.ZodType;
  /** True when a repeat call can differ because the answer moves with the server's clock. */
  readonly clockDependent: boolean;
  /** A call with an adult's details, which the shared tests make (src/ai-tools/personal-tools.test.ts). */
  readonly example: Readonly<Record<string, unknown>>;
  /** Throws RangeError with a plain sentence for details it cannot use. */
  readonly run: (args: never, context: PersonalToolContext) => Promise<PersonalToolResult>;
}

/** Keeps a definition's name as its literal type, so the registry's names form a union. */
export function definePersonalTool<const N extends string, I extends z.ZodType>(definition: Omit<PersonalToolDefinition<N>, 'input' | 'run'> & { input: I; run: (args: z.infer<I>, context: PersonalToolContext) => Promise<PersonalToolResult> }): PersonalToolDefinition<N> {
  return definition as unknown as PersonalToolDefinition<N>;
}

/** The calendar date of an instant on a zone's clock, as YYYY-MM-DD. */
export function dateOn(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** "Tue 3 Nov 2026" on a zone's clock. */
export function dayLabel(at: Date | string, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(new Date(at)).map((part) => [part.type, part.value]));
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
}

export interface NatalCast {
  birthUtc: Date;
  chart: Chart;
  timeKnown: boolean;
  placed: boolean;
  /** The birthplace rounded to two decimals, as every tool rounds a place it is given. */
  latitude: number | undefined;
  longitude: number | undefined;
  /** The ascendant and Midheaven, only with a birth time and place. */
  angles: { asc: number; mc: number } | null;
  detail: ReadingDetail;
}

/**
 * The birth chart, cast once: the engine's (src/lib/engine/full.ts), whole-sign
 * houses, from the local time resolved by @zodiacs/engine/geo. Without a time
 * it is cast for local noon (UTC noon without a zone) with no angles, as
 * get_natal_chart and get_personal_transits cast it.
 */
export async function castNatal(args: BirthArgs, clock: PersonalToolContext['localTime']): Promise<NatalCast> {
  const birth = parseCivilDate(args.birthDate);
  if (!birth || birth.year < PERSONAL_MIN_YEAR || birth.year > PERSONAL_MAX_YEAR) throw new RangeError(`birthDate must be a real date from ${PERSONAL_MIN_YEAR} to ${PERSONAL_MAX_YEAR}.`);
  if (args.time !== undefined && !parseCivilTime(args.time)) throw new RangeError('time must be HH:MM, such as 08:30.');
  const latitude = args.latitude === undefined ? undefined : roundCoordinate(args.latitude);
  const longitude = args.longitude === undefined ? undefined : roundCoordinate(args.longitude);
  const timeKnown = args.time !== undefined;
  const placed = latitude !== undefined && longitude !== undefined;
  let birthUtc: Date;
  if (args.zone) {
    await clock.prepareLocalTime(args.birthDate, args.zone);
    const time = args.time ?? '12:00';
    birthUtc = (longitude !== undefined ? clock.resolveLocalToUtc(args.birthDate, time, args.zone, { longitude }) : clock.resolveLocalToUtc(args.birthDate, time, args.zone)).utc;
  } else birthUtc = new Date(`${args.birthDate}T12:00:00Z`);
  const chart = computeChart({ utc: birthUtc, ...(placed ? { latitude, longitude } : {}), houseSystem: 'whole', timeKnown });
  const angles = timeKnown && placed && chart.angles ? { asc: chart.angles.asc, mc: chart.angles.mc } : null;
  return { birthUtc, chart, timeKnown, placed, latitude, longitude, angles, detail: readingDetail({ hasDate: true, hasTime: timeKnown, hasPlace: placed }) };
}

/**
 * The two ends of an untimed birth day: the local day with a zone, else every
 * zone's version of that date (UTC−12 to UTC+14). A placement holds for an
 * untimed birth only when it is the same at both ends.
 */
export async function birthDayEnds(args: BirthArgs, clock: PersonalToolContext['localTime']): Promise<[Date, Date]> {
  if (!args.zone) return [new Date(Date.parse(`${args.birthDate}T00:00:00Z`) - 14 * HOUR), new Date(Date.parse(`${args.birthDate}T23:59:00Z`) + 12 * HOUR)];
  await clock.prepareLocalTime(args.birthDate, args.zone);
  const longitude = args.longitude === undefined ? undefined : roundCoordinate(args.longitude);
  const local = (time: string) => (longitude !== undefined ? clock.resolveLocalToUtc(args.birthDate, time, args.zone!, { longitude }) : clock.resolveLocalToUtc(args.birthDate, time, args.zone!)).utc;
  return [local('00:00'), local('23:59')];
}

/**
 * The clock "today" is read on: where the person is now when given, else the
 * zone the assistant shares, else the birthplace's, else UTC; and a sentence
 * saying which, when it is not where they are now.
 */
export async function currentClock(currentZone: string | undefined, birthZone: string | undefined, context: PersonalToolContext): Promise<{ zone: string; note: string | null }> {
  if (currentZone) return { zone: await context.resolveZone(currentZone, '/currentZone'), note: null };
  if (context.hostZone) {
    try { return { zone: await context.resolveZone(context.hostZone, '/currentZone'), note: null }; } catch { /* fall through */ }
  }
  if (birthZone) return { zone: birthZone, note: `Today is read on the birthplace clock (${birthZone}) because no current location was given.` };
  return { zone: 'UTC', note: 'Today is read in UTC because no time zone was given.' };
}

export const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'] as const;
export const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The copy rule for the personal tools (Dias, November 2026). Allowed, as
 * astrology traditionally reads them: money, career, health and wellbeing,
 * and legal themes ("traditionally a strong year for earnings", "asks you to
 * take rest seriously", "a good window to sign contracts"). Not allowed:
 * specific price, stock or crypto calls, buy or sell signals, diagnoses or
 * medical timing, death predictions, and "you will win or lose" legal
 * outcomes. A note that a reading is "for reflection" is used only where it
 * fits, not on every result. These patterns catch the forbidden kinds of
 * claim in a tool's output; the shared tests run them over every answer.
 */
export const FORBIDDEN_CLAIMS: readonly RegExp[] = [
  /\b(?:buy|sell|short|hold)\b[^.]{0,40}\b(?:shares?|stocks?|coins?|crypto|bitcoin|tokens?|options?|positions?)\b/iu,
  /\b(?:price|stock|share|bitcoin|crypto|coin)s?\b[^.]{0,30}\b(?:will|to)\b[^.]{0,20}\b(?:rise|fall|climb|drop|crash|soar|double)\b/iu,
  /\b(?:crypto|bitcoin|blockchain|token|nft)\b/iu,
  /\b(?:diagnos\w*|you (?:have|will (?:get|develop|catch))\b[^.]{0,30}\b(?:illness|disease|cancer|infection|condition))\b/iu,
  /\b(?:surgery|operation|treatment|medication)\b[^.]{0,40}\b(?:on|before|after|by)\b[^.]{0,20}\d/iu,
  /\b(?:you|they|someone)\b[^.]{0,30}\b(?:will die|death will|pass away)\b|\bdeath\b[^.]{0,20}\b(?:predicted|expected|is coming)\b/iu,
  /\byou will (?:win|lose)\b[^.]{0,40}\b(?:case|lawsuit|court|trial|dispute|appeal)\b/iu,
  /[\u2013\u2014]/u,
];

/** The first forbidden claim in a text, or null. */
export function forbiddenClaim(text: string): string | null {
  for (const pattern of FORBIDDEN_CLAIMS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}
