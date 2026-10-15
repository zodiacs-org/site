/**
 * The calculations behind the calculator pages' WebMCP tools (calculator-tools.ts). scripts/build-webmcp.mjs builds
 * this to /assets/webmcp-calculators.js, which a page loads only when an agent calls its tool. Each tool reads its
 * input strictly, refuses with a fixed sentence that repeats nothing it was given, and computes in the browser with
 * the engine the page uses, so it answers what the page shows (calculators/*.test.ts hold each to its page).
 */
import * as engine from '../engine/full';
import { ENGINE_VERSION } from '../engine/types';
import { degreeInSign, signForLongitude } from '../signs';
import { parseCivilDate, parseCivilTime } from '../time/civil-date';
import { prepareLocalTime } from '../time/localToUtc';
import { LocalDateReferenceError, lookupMoonPhase } from './calculators/moon-phase';

export type CalculatorErrorCode = 'INVALID_INPUT' | 'LOCAL_DATE_REFERENCE' | 'CALCULATION_FAILED' | 'UNKNOWN_TOOL';

export type CalculatorEnvelope =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: { code: CalculatorErrorCode; message: string } };

const MESSAGES: Record<CalculatorErrorCode, string> = {
  INVALID_INPUT: 'The input does not match the tool\'s schema: check the date (YYYY-MM-DD), the time (HH:MM), the '
    + 'place\'s coordinates and its IANA time zone, and that no other field is given.',
  LOCAL_DATE_REFERENCE: 'Local noon could not be placed within that local date; give a time.',
  CALCULATION_FAILED: 'The calculation could not be completed for that input.',
  UNKNOWN_TOOL: 'This page has no calculator tool of that name.',
};

const refuse = (code: CalculatorErrorCode): CalculatorEnvelope => ({ ok: false, error: { code, message: MESSAGES[code] } });

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const onlyKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every((key) => keys.includes(key));

interface Place { latitude: number; longitude: number; timeZone: string }

function supportedZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** A place, null when absent, or undefined when it is given and invalid. */
function readPlace(value: unknown): Place | null | undefined {
  if (value === undefined) return null;
  if (!isRecord(value) || !onlyKeys(value, ['latitude', 'longitude', 'timeZone'])) return undefined;
  const { latitude, longitude, timeZone } = value;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90) return undefined;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return undefined;
  if (typeof timeZone !== 'string' || timeZone.length === 0 || timeZone.length > 64 || !supportedZone(timeZone)) return undefined;
  return { latitude, longitude, timeZone };
}

const round = (value: number, places: number) => Number(value.toFixed(places));

async function moonPhase(input: unknown): Promise<CalculatorEnvelope> {
  if (!isRecord(input) || !onlyKeys(input, ['date', 'time', 'place'])) return refuse('INVALID_INPUT');
  const { date, time } = input;
  if (!parseCivilDate(date)) return refuse('INVALID_INPUT');
  if (time !== undefined && !parseCivilTime(time)) return refuse('INVALID_INPUT');
  const place = readPlace(input.place);
  if (place === undefined) return refuse('INVALID_INPUT');
  try {
    if (place) await prepareLocalTime(date as string, place.timeZone);
    const lookup = lookupMoonPhase({
      date: date as string,
      time: (time as string | undefined) ?? null,
      place: place ? { lon: place.longitude, tz: place.timeZone } : null,
    }, engine);
    const sign = signForLongitude(lookup.lon);
    return {
      ok: true,
      data: {
        phase: lookup.phase,
        illuminationPercent: Math.round(lookup.illum * 100),
        elongationDegrees: round(lookup.angle, 4),
        moon: { longitude: round(lookup.lon, 4), sign: sign.name, degreeInSign: round(degreeInSign(lookup.lon), 4) },
        computedUtc: lookup.computedUtc.toISOString(),
        basis: lookup.basis,
        engine: { name: '@zodiacs/engine', version: ENGINE_VERSION },
        page: 'https://zodiacs.org/moon-phase/',
      },
    };
  } catch (error) {
    return refuse(error instanceof LocalDateReferenceError ? 'LOCAL_DATE_REFERENCE' : 'CALCULATION_FAILED');
  }
}

const TOOLS: Record<string, (input: unknown) => Promise<CalculatorEnvelope>> = {
  'zodiacs.moon_phase': moonPhase,
};

/** Runs a calculator tool by name; an unknown name is refused rather than thrown. */
export async function runCalculatorTool(name: string, input: unknown): Promise<CalculatorEnvelope> {
  const tool = Object.hasOwn(TOOLS, name) ? TOOLS[name] : null;
  return tool ? tool(input) : refuse('UNKNOWN_TOOL');
}
