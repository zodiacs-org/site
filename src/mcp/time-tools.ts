/**
 * resolve_birth_time: the hosted compute API's time calculation, POST
 * https://zodiacs.org/api/v1/time, run on this machine with the resolver the
 * compute API's function uses, @zodiacs/engine/geo, and the zone histories it
 * loads, which the bundle carries. As for the other compute tools
 * (sky-tools.ts), the parser and the function are the compute API's own, so
 * the same JSON gets the same result and receipt, and a refusal is its
 * sentence. A module of its own: the developer plugin imports the chart tools,
 * and with them sky-tools.ts, but never this, so its bundle carries no zone
 * history.
 */
import { z } from 'zod';
import { EPOCH } from '../lib/compute-api/constants';
import { computeTime } from '../lib/compute-api/endpoints';
import * as localTime from '../lib/compute-api/local-time-source';
import { CALENDARS, parseTimeRequest } from '../lib/compute-api/validate';
import { ATLAS_PLACE_IDS } from '../lib/time-atlas/places';
import { cited, refusalOf } from './sky-tools';
import type { ToolOutcome } from './tools';

const DATE_CHARS = 10;

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
  atlasPlace: z.enum(ATLAS_PLACE_IDS).optional()
    .describe('A place of the Zodiacs time atlas, which records, with citations, what the clocks said in 21 places of France and the United States from 1870 to 1919; the place must lie in local.zone, and tzdb\'s reading uses its longitude, so a longitude sent with it must be the place\'s, to 0.01°. The reply then gives the atlas\'s reading of the same wall time there, with its rule, its uncertainty flag and its citations, beside tzdb\'s.'),
});

export async function resolveBirthTime(args: z.infer<typeof TIME_INPUT>): Promise<ToolOutcome> {
  try {
    return cited('resolve_birth_time', await computeTime(await parseTimeRequest(args, localTime.canonicalZoneName), { localTime }));
  } catch (error) {
    return refusalOf(error);
  }
}
