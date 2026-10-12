/**
 * get_positions, find_events, check_sky_fact and resolve_birth_time: the hosted
 * compute API's positions, events, sky-fact and time calculations, run on this
 * machine.
 *
 * Each tool parses its arguments with the compute API's own parser and
 * calculates with the compute API's own function (`src/lib/compute-api/`), so
 * for the same JSON a call returns what POST
 * https://zodiacs.org/api/v1/positions, /events, /sky-fact or /time returns:
 * the same result and the same receipt, and so the same `cite.receipt` digest.
 * Only `cite.url` differs: it names the tool's entry on the developer page.
 * Nothing here re-derives a position, a search, an answer or an offset. A
 * request the compute API's parser refuses gets its own fixed sentence, which
 * never quotes a value from the request; one the input schema below refuses
 * first, such as an unknown argument or a value outside a list, gets the MCP
 * SDK's validation message instead.
 *
 * resolve_birth_time reads a local time in a named zone with the resolver the
 * compute API's function uses, @zodiacs/engine/geo with the zone histories it
 * loads, which are built into the bundle. The other three take no zone:
 * check_sky_fact takes an instant with its offset, or a date, which the
 * compute API reads in every UTC offset in use today at once.
 */
import { z } from 'zod';
import { ASPECTS, ASPECT_TYPES } from '@zodiacs/engine';
import {
  ANY_ZONE_DAY, BUDGETS, EPOCH, EVENT_BODIES, EVENT_KINDS, PHASE_NAMES, POSITION_BODIES, SIGN_SLUGS, SKY_FACT_KINDS,
} from '../lib/compute-api/constants';
import { computeEvents, computePositions, computeSkyFact, computeTime, type ComputeDependencies } from '../lib/compute-api/endpoints';
import { ComputeApiError } from '../lib/compute-api/errors';
import * as localTime from '../lib/compute-api/local-time-source';
import {
  CALENDARS, parseEventsRequest, parsePositionsRequest, parseSkyFactRequest, parseTimeRequest, type ZoneNames,
} from '../lib/compute-api/validate';
import { bounded } from './bounds';
import { citeFor, type ComputeToolName } from './cite';
import type { ToolOutcome } from './tools';

/** The compute API's longest instant, `1800-01-01T00:00:00.000+14:00`, is 29 characters. */
const INSTANT_CHARS = 29;
const DATE_CHARS = 10;

const instantForm = `ISO 8601 with Z or a numeric offset, such as 2000-01-01T12:00:00Z or 1990-06-15T14:30:00+02:00, from ${EPOCH.from} to ${EPOCH.to} once the offset is applied. A time without Z or an offset is refused.`;

/**
 * The day a date without a zone stands for. Written once, because the input
 * schema, the capabilities reply and the methodology resource all say it. The
 * offsets are today's: before 1868 some places kept a local time further from
 * UTC than either end (Manila until 1844, Alaska until 1867), and their date
 * is not covered, as it is not by the compute API without a zone.
 */
export const ANY_ZONE_DAY_TEXT = `check_sky_fact takes no time zone, so a date is read as that day in every UTC offset in use today, from −${ANY_ZONE_DAY.endHoursAfterUtcMidnight - 24}:00 to +${ANY_ZONE_DAY.startHoursBeforeUtcMidnight}:00, at once: from ${ANY_ZONE_DAY.startHoursBeforeUtcMidnight} hours before its midnight UTC to ${ANY_ZONE_DAY.endHoursAfterUtcMidnight} hours after. depends means the answer turns on the time of day or on the offset.`;

/** As in tools.ts: an unknown argument is refused, and the JSON Schema a model reads says so. */
export const POSITIONS_INPUT = z.strictObject({
  instants: z.array(z.string().max(INSTANT_CHARS)).min(1).max(BUDGETS['positions.instants'])
    .describe(`One to ${BUDGETS['positions.instants']} instants, each in ${instantForm}`),
  bodies: z.array(z.enum(POSITION_BODIES)).min(1).optional()
    .describe('Which rows to return, each named once; all twelve when omitted.'),
});

export const EVENTS_INPUT = z.strictObject({
  from: z.string().max(INSTANT_CHARS)
    .describe(`The start of the window, which is excluded, in ${instantForm}`),
  to: z.string().max(INSTANT_CHARS)
    .describe(`The end of the window, which is included: later than from and at most ${BUDGETS['events.windowDays']} days after it, in ${instantForm}`),
  bodies: z.array(z.enum(EVENT_BODIES)).min(1).optional()
    .describe('Which bodies to search, each named once; all ten when omitted. Only Mercury to Pluto station: the Sun and the Moon never move backward.'),
  kinds: z.array(z.enum(EVENT_KINDS)).min(1).optional()
    .describe('ingress: a body entering a sign. station: a planet turning retrograde or direct. lunation: a new or full moon, whichever bodies are named. Each named once; all three when omitted.'),
});

/** The orbs a chart's aspects use, which an aspect fact holds to. */
const ASPECT_ORBS = ASPECTS.map(({ type, angle, orb, luminaryOrb }) => `${type} ${angle}° within ${orb}° (${luminaryOrb}° with the Sun or the Moon)`).join(', ');

export const SKY_FACT_INPUT = z.strictObject({
  kind: z.enum(SKY_FACT_KINDS)
    .describe('sign: is the body in the sign? retrograde: is the body retrograde? ingress: does the body enter the sign on the date? phase: does the Moon reach the phase on the date? aspect: are the body and the other body in the aspect?'),
  body: z.enum(EVENT_BODIES).optional().describe('For sign, retrograde, ingress and aspect.'),
  other: z.enum(EVENT_BODIES).optional().describe('For aspect: the second body, not the same as body.'),
  aspect: z.enum(ASPECT_TYPES).optional().describe(`For aspect, within the orbs a chart's aspects use: ${ASPECT_ORBS}.`),
  sign: z.enum(SIGN_SLUGS).optional().describe('For sign and ingress, in lowercase.'),
  phase: z.enum(PHASE_NAMES).optional().describe('For phase.'),
  instant: z.string().max(INSTANT_CHARS).optional()
    .describe(`For sign, retrograde and aspect: the moment to check, in ${instantForm} Give instant or date, not both.`),
  date: z.string().max(DATE_CHARS).optional()
    .describe(`YYYY-MM-DD, from ${EPOCH.firstYear}-01-01 to ${EPOCH.lastYear}-12-31. Needed for ingress and phase; for sign, retrograde and aspect, the alternative to instant. ${ANY_ZONE_DAY_TEXT}`),
});

/**
 * A refusal in the compute API's own words: its fixed sentence, after the
 * JSON Pointer of the field it refused when there is one. Any other throw is
 * left to the server's guard, which reports it without its message.
 */
function refusalOf(error: unknown): ToolOutcome {
  if (!(error instanceof ComputeApiError)) throw error;
  const { message, pointer } = error.detail;
  return { ok: false, refusal: pointer ? `${pointer}: ${message}` : message };
}

function cited<Body extends { receipt: unknown; cite: unknown }>(tool: ComputeToolName, body: Body): ToolOutcome {
  return bounded({ ...body, cite: citeFor(tool, body.receipt) });
}

export function getPositions(args: z.infer<typeof POSITIONS_INPUT>): ToolOutcome {
  try {
    return cited('get_positions', computePositions(parsePositionsRequest(args)));
  } catch (error) {
    return refusalOf(error);
  }
}

export function findEvents(args: z.infer<typeof EVENTS_INPUT>): ToolOutcome {
  try {
    return cited('find_events', computeEvents(parseEventsRequest(args)));
  } catch (error) {
    return refusalOf(error);
  }
}

/**
 * check_sky_fact's input schema has no zone, so its parser never asks for a
 * zone name and its calculation never resolves a local time. These are here
 * to satisfy the compute API's signatures, and each throws if that ever
 * changes.
 */
function noZones(): never {
  throw new Error('check_sky_fact reads no time zone.');
}
const NO_ZONE_NAMES: ZoneNames = async () => noZones();
const NO_ZONES: ComputeDependencies = {
  localTime: {
    prepareLocalTime: async () => noZones(),
    resolveLocalToUtc: () => noZones(),
    canonicalZoneName: async () => noZones(),
    get TZDB() { return noZones(); },
  },
};

export async function checkSkyFact(args: z.infer<typeof SKY_FACT_INPUT>): Promise<ToolOutcome> {
  try {
    return cited('check_sky_fact', await computeSkyFact(await parseSkyFactRequest(args, NO_ZONE_NAMES), NO_ZONES));
  } catch (error) {
    return refusalOf(error);
  }
}

export const TIME_INPUT = z.strictObject({
  local: z.strictObject({
    date: z.string().max(DATE_CHARS)
      .describe(`YYYY-MM-DD in the calendar named by calendar: from ${EPOCH.firstYear}-01-01 to ${EPOCH.lastYear}-12-31, or with calendar julian from ${EPOCH.firstYear}-01-01 to 1923-12-31.`),
    time: z.string().max(5).describe('The time the clock showed, HH:MM, from 00:00 to 23:59.'),
    zone: z.string().max(64)
      .describe('An IANA time zone name, such as Europe/Paris, in any letter case; search_places gives each place\'s zone.'),
  }).describe('A local date and time as a clock in the zone showed them.'),
  longitude: z.number().optional()
    .describe('The place\'s longitude in degrees east, from -180 to 180. With it, a time before the place adopted a legal time is read on the place\'s own mean time.'),
  calendar: z.enum(CALENDARS).optional()
    .describe('The calendar local.date is written in; gregorian when omitted. julian, the Old Style, is accepted for a date written up to 1923-12-31 and converted to the Gregorian date before the time is read.'),
  country: z.string().max(2).optional()
    .describe('The place\'s country as an ISO 3166-1 alpha-2 code in capitals, such as RU, for the note on when it changed to the Gregorian calendar.'),
});

export async function resolveBirthTime(args: z.infer<typeof TIME_INPUT>): Promise<ToolOutcome> {
  try {
    return cited('resolve_birth_time', await computeTime(await parseTimeRequest(args, localTime.canonicalZoneName), { localTime }));
  } catch (error) {
    return refusalOf(error);
  }
}
