import { z as zod } from 'zod';
import { POSITION_BODIES, SIGN_SLUGS } from '../../lib/compute-api/constants';

export const MOMENT_CHART_TOOL = 'get_moment_chart';
export const MOMENT_CHART_SWITCH = 'ZODIACS_MOMENT_CHART_ENABLED';
export const MOMENT_ROUTING = 'Use get_moment_chart for the sky with houses at a place now, at an event, or when a horary question was asked. It returns a sky chart. Never use it for a birth, a personal reading, or to retry a refused request.';

export const momentChartInput = zod.strictObject({
  instant: zod.string().min(1).max(29).optional().describe('Event timestamp with Z or a numeric offset. Omit for right now.'),
  latitude: zod.number().gt(-90).lt(90).describe('Event latitude in degrees north. Houses are undefined at the poles.'),
  longitude: zod.number().min(-180).max(180).describe('Event longitude in degrees east.'),
  houseSystem: zod.enum(['whole-sign', 'placidus']).optional().describe('Defaults to whole-sign.'),
});

const eclipticLongitude = zod.number().min(0).lt(360);
const bodyName = zod.enum(POSITION_BODIES);
export const momentChartData = zod.object({
  kind: zod.literal('moment'),
  instant: zod.string(),
  angles: zod.object({ asc: eclipticLongitude, mc: eclipticLongitude, dsc: eclipticLongitude, ic: eclipticLongitude }),
  houses: zod.object({
    system: zod.enum(['whole-sign', 'placidus']),
    cusps: zod.array(eclipticLongitude).length(12).describe('Ecliptic longitude in degrees, starting with the first house.'),
    polarFallback: zod.boolean(),
  }),
  positions: zod.array(zod.object({
    body: bodyName, longitude: eclipticLongitude, sign: zod.enum(SIGN_SLUGS), house: zod.number().int().min(1).max(12), retrograde: zod.boolean(),
  })).length(POSITION_BODIES.length),
  aspects: zod.array(zod.object({
    a: bodyName, b: bodyName, type: zod.enum(['conjunction', 'sextile', 'square', 'trine', 'opposition']),
    orb: zod.number().nonnegative(), applying: zod.boolean(),
  })),
});
