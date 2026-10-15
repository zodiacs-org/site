/**
 * The calculations behind the calculator pages' WebMCP tools (calculator-tools.ts). scripts/build-webmcp.mjs builds
 * this to /assets/webmcp-calculators.js, which a page loads only when an agent calls its tool. Each tool reads its
 * input strictly, refuses with a fixed sentence that repeats nothing it was given, and computes in the browser with
 * the code the page uses, so it answers what the page shows (calculators/*.test.ts hold each to its page).
 */
import * as engine from '../engine/full';
import { NumerologyInputError } from '../numerology';
import type { TwinPerson } from '../sharing/twins';
import { prepareLocalTime } from '../time/localToUtc';
import { babyZodiacResult } from './calculators/baby-zodiac';
import {
  bigThreeResult, birthChartResult, chartPageNatal, moonSignResult, personNatal, risingSignResult,
} from './calculators/chart';
import { ENGINE, fixed, pageUrl, position } from './calculators/format';
import {
  isRecord, onlyKeys, readBirth, readDate, readHouseSystem, readInstant, readPlace, readTime, type Birth,
} from './calculators/input';
import { LocalDateReferenceError, lookupMoonPhase } from './calculators/moon-phase';
import { numerologyResult } from './calculators/numerology';
import {
  chartTwinsResult, compatibilityResult, DuplicatePersonError, groupChartResult, transitsResult, type GroupMember,
} from './calculators/people';
import { chartPdfResult, yearWrappedResult } from './calculators/return-visits';
import { lunarReturnResult, saturnReturnResult, solarReturnResult } from './calculators/returns';

export type CalculatorErrorCode =
  | 'INVALID_INPUT' | 'TIME_NEEDS_PLACE' | 'LOCAL_DATE_REFERENCE' | 'CLOCK_CHANGE' | 'UNSUPPORTED_NAME'
  | 'DUPLICATE_PERSON' | 'DIRECTORY_UNAVAILABLE' | 'CALCULATION_FAILED' | 'UNKNOWN_TOOL';

export type CalculatorEnvelope =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: { code: CalculatorErrorCode; message: string } };

const MESSAGES: Record<CalculatorErrorCode, string> = {
  INVALID_INPUT: 'The input does not match the tool\'s schema: check each date (YYYY-MM-DD, within the stated range), '
    + 'time (HH:MM), place (coordinates and an IANA time zone) and instant (ISO 8601 UTC), and that no other field '
    + 'is given.',
  TIME_NEEDS_PLACE: 'A time is read at a place: give the place too, or leave the time out.',
  LOCAL_DATE_REFERENCE: 'Local noon could not be placed within that local date; give a time.',
  CLOCK_CHANGE: 'That local birth time was skipped or repeated by a clock change; check the birth record.',
  UNSUPPORTED_NAME: 'The name uses letters outside A to Z once accents are removed; the Pythagorean table covers only '
    + 'the Latin alphabet.',
  DUPLICATE_PERSON: 'The same person is entered twice.',
  DIRECTORY_UNAVAILABLE: 'The public directory could not be read from this site; try again.',
  CALCULATION_FAILED: 'The calculation could not be completed for that input.',
  UNKNOWN_TOOL: 'This page has no calculator tool of that name.',
};

class Refusal extends Error {
  constructor(readonly code: CalculatorErrorCode) {
    super(MESSAGES[code]);
    this.name = 'Refusal';
  }
}

/** Reads a value or refuses it as INVALID_INPUT. */
function need<T>(value: T | undefined): T {
  if (value === undefined) throw new Refusal('INVALID_INPUT');
  return value;
}

function fields(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isRecord(input) || !onlyKeys(input, keys)) throw new Refusal('INVALID_INPUT');
  return input;
}

const birth = (value: unknown, timeRequired = false): Birth => need(readBirth(value, { timeRequired }));

/** The browser's local date, as the numerology page reads "today". */
function localToday(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

async function moonPhase(input: unknown) {
  const { date, time, place: rawPlace } = fields(input, ['date', 'time', 'place']);
  const day = need(readDate(date));
  const clock = need(readTime(time));
  const place = need(readPlace(rawPlace));
  if (place) await prepareLocalTime(day, place.timeZone);
  const lookup = lookupMoonPhase({
    date: day,
    time: clock,
    place: place ? { lon: place.longitude, tz: place.timeZone } : null,
  }, engine);
  return {
    phase: lookup.phase,
    illuminationPercent: Math.round(lookup.illum * 100),
    elongationDegrees: fixed(lookup.angle),
    moon: position(lookup.lon),
    computedUtc: lookup.computedUtc.toISOString(),
    basis: lookup.basis,
    engine: ENGINE,
    page: pageUrl('/moon-phase/'),
  };
}

async function birthChart(input: unknown) {
  const { houseSystem, ...rest } = fields(input, ['date', 'time', 'place', 'houseSystem']);
  return birthChartResult(await chartPageNatal(birth(rest), need(readHouseSystem(houseSystem)), { receipt: true }));
}

async function moonSign(input: unknown) {
  return moonSignResult(await chartPageNatal(birth(input), 'whole', { receipt: false }));
}

async function risingSign(input: unknown) {
  return risingSignResult(await chartPageNatal(birth(input, true), 'whole', { receipt: false }));
}

async function bigThree(input: unknown) {
  return bigThreeResult(await personNatal(birth(input, true)));
}

async function compatibility(input: unknown) {
  const { first, second } = fields(input, ['first', 'second']);
  return compatibilityResult(birth(first), birth(second));
}

async function transits(input: unknown) {
  const { birth: natal, at } = fields(input, ['birth', 'at']);
  const reading = birth(natal);
  return transitsResult(reading, need(readInstant(at)) ?? new Date());
}

async function saturnReturn(input: unknown) {
  const { date, time, place: rawPlace } = fields(input, ['date', 'time', 'place']);
  const day = need(readDate(date));
  const clock = need(readTime(time));
  const place = need(readPlace(rawPlace));
  if (clock !== null && place === null) throw new Refusal('TIME_NEEDS_PLACE');
  return saturnReturnResult(day, clock, place, new Date());
}

/** A year from 1800 through 2199; `absent` when none is given. */
function year<T>(value: unknown, absent: T): T | number {
  if (value === undefined) return absent;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1800 || value > 2199) {
    throw new Refusal('INVALID_INPUT');
  }
  return value;
}

async function solarReturn(input: unknown) {
  const {
    birth: natal, year: rawYear, castPlace, houseSystem,
  } = fields(input, ['birth', 'year', 'castPlace', 'houseSystem']);
  return solarReturnResult(
    birth(natal), year(rawYear, 'current' as const), need(readPlace(castPlace)), need(readHouseSystem(houseSystem)), new Date(),
  );
}

async function lunarReturn(input: unknown) {
  const { birth: natal, after, castPlace, houseSystem } = fields(input, ['birth', 'after', 'castPlace', 'houseSystem']);
  const reading = birth(natal, true);
  const from = need(readInstant(after)) ?? new Date();
  const cast = need(readPlace(castPlace));
  const system = need(readHouseSystem(houseSystem));
  try {
    return await lunarReturnResult(reading, from, cast, system);
  } catch (error) {
    // computeLunarReturn refuses a birth time a clock change skipped or repeated.
    if (error instanceof RangeError && /clock change/.test(error.message)) throw new Refusal('CLOCK_CHANGE');
    throw error;
  }
}

async function numerology(input: unknown) {
  const { birthDate, fullName, today } = fields(input, ['birthDate', 'fullName', 'today']);
  const date = need(readDate(birthDate));
  if (fullName !== undefined && (typeof fullName !== 'string' || fullName.length > 200)) {
    throw new Refusal('INVALID_INPUT');
  }
  const forDate = today === undefined ? localToday(new Date()) : need(readDate(today));
  try {
    return numerologyResult(date, (fullName as string | undefined) ?? null, forDate);
  } catch (error) {
    if (error instanceof NumerologyInputError) {
      throw new Refusal(error.code === 'unsupported-letters' ? 'UNSUPPORTED_NAME' : 'INVALID_INPUT');
    }
    throw error;
  }
}

async function babyZodiac(input: unknown) {
  const { dueDate } = fields(input, ['dueDate']);
  return babyZodiacResult(need(readDate(dueDate, '1990-01-01', '2028-12-31')));
}

const TWIN_DIRECTORY_URL = '/data/chart-twins.json';

/** The public directory /chart-twins/ matches against, read from this site: names and signs, nothing else. */
async function loadTwinDirectory(): Promise<TwinPerson[]> {
  let body: unknown;
  try {
    const response = await fetch(TWIN_DIRECTORY_URL, { credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    body = await response.json();
  } catch {
    throw new Refusal('DIRECTORY_UNAVAILABLE');
  }
  const people = isRecord(body) && body.schema === 'zodiacs.chart-twins.v1' && Array.isArray(body.people)
    ? body.people
    : null;
  const valid = (entry: unknown): entry is TwinPerson => isRecord(entry)
    && typeof entry.slug === 'string' && typeof entry.name === 'string' && typeof entry.sun === 'string'
    && (entry.moon === null || typeof entry.moon === 'string');
  if (!people || !people.every(valid)) throw new Refusal('DIRECTORY_UNAVAILABLE');
  return people;
}

async function chartTwins(input: unknown) {
  const reading = birth(input);
  return chartTwinsResult(reading, await loadTwinDirectory());
}

async function groupChart(input: unknown) {
  const { people } = fields(input, ['people']);
  if (!Array.isArray(people) || people.length < 3 || people.length > 8) throw new Refusal('INVALID_INPUT');
  const members: GroupMember[] = people.map((entry, index) => {
    const { name, birth: natal } = fields(entry, ['name', 'birth']);
    if (name !== undefined && (typeof name !== 'string' || name.length > 24)) throw new Refusal('INVALID_INPUT');
    return { name: (name as string | undefined)?.trim() || `Person ${index + 1}`, birth: birth(natal) };
  });
  try {
    return await groupChartResult(members);
  } catch (error) {
    if (error instanceof DuplicatePersonError) throw new Refusal('DUPLICATE_PERSON');
    throw error;
  }
}

async function chartPdf(input: unknown) {
  return chartPdfResult(birth(input));
}

async function yearWrapped(input: unknown) {
  const { birth: natal, year: rawYear } = fields(input, ['birth', 'year']);
  const reading = birth(natal);
  const now = new Date();
  return yearWrappedResult(reading, year(rawYear, now.getUTCFullYear()), now);
}

const TOOLS: Record<string, (input: unknown) => Promise<Record<string, unknown>>> = {
  'zodiacs.birth_chart': birthChart,
  'zodiacs.moon_sign': moonSign,
  'zodiacs.rising_sign': risingSign,
  'zodiacs.big_three': bigThree,
  'zodiacs.compatibility': compatibility,
  'zodiacs.transits': transits,
  'zodiacs.saturn_return': saturnReturn,
  'zodiacs.solar_return': solarReturn,
  'zodiacs.lunar_return': lunarReturn,
  'zodiacs.numerology': numerology,
  'zodiacs.moon_phase': moonPhase,
  'zodiacs.baby_zodiac': babyZodiac,
  'zodiacs.chart_twins': chartTwins,
  'zodiacs.group_chart': groupChart,
  'zodiacs.chart_pdf': chartPdf,
  'zodiacs.year_wrapped': yearWrapped,
};

export const CALCULATOR_TOOL_NAMES: readonly string[] = Object.freeze(Object.keys(TOOLS));

const refuse = (code: CalculatorErrorCode): CalculatorEnvelope => (
  { ok: false, error: { code, message: MESSAGES[code] } }
);

/** Runs a calculator tool by name. An unknown name, an input that does not match and a failed calculation are refused. */
export async function runCalculatorTool(name: string, input: unknown): Promise<CalculatorEnvelope> {
  const tool = Object.hasOwn(TOOLS, name) ? TOOLS[name] : null;
  if (!tool) return refuse('UNKNOWN_TOOL');
  try {
    return { ok: true, data: await tool(input) };
  } catch (error) {
    if (error instanceof Refusal) return refuse(error.code);
    if (error instanceof LocalDateReferenceError) return refuse('LOCAL_DATE_REFERENCE');
    return refuse('CALCULATION_FAILED');
  }
}
