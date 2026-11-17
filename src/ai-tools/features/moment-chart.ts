/**
 * get_moment_chart (ZOD-62): a chart for a moment, not for a person. It casts the sky at one instant over one place,
 * for an event, a question asked now or the sky right now, with houses and the rising sign, through the same engine
 * call get_natal_chart makes (computeChart, src/lib/engine/full.ts).
 *
 * get_natal_chart refuses a birth date less than 13 years ago, so it cannot cast a chart for today. This tool takes
 * no name and no birth date, is never read as anyone's birth, and gives no reading about a person: only positions,
 * signs, houses, angles and aspects, with no interpretation lines and no under-18 or reading-confidence wording. The
 * instant, the local time and the coordinates are used for this answer only; no link carries them.
 *
 * Offered only where ZODIACS_MOMENT_CHART_ENABLED=1 joins the coverage and occasion switches (momentChartOn), after
 * every other tool. Pure: no network, storage or logging.
 */
import { z } from 'zod';
import { computeChart } from '../../lib/engine/full.js';
import { houseOf } from '../../lib/engine/houses';
import { SIGNS, formatLongitude, signIndexForLongitude } from '../../lib/signs';
import { parseCivilDate, parseCivilTime } from '../../lib/time/civil-date';
import { localIso } from '../clear-time';
import { roundCoordinate } from '../plain-text';
import { NATAL_HOUSE_SYSTEMS, NATAL_MAX_YEAR, NATAL_MIN_YEAR, type NatalClock } from './natal-chart';

const DEFAULT_ORIGIN = 'https://zodiacs.org';
const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
type Planet = typeof PLANETS[number];
/** Every pair of the ten planets can be in at most one aspect. */
const MAX_ASPECTS = (PLANETS.length * (PLANETS.length - 1)) / 2;

export const MOMENT_NOTE = 'A chart for a moment: the sky at this instant over this place, such as an event, a question or the sky now. It is not a birth chart and gives no reading about a person.';

export const momentChartInput = z.strictObject({
  instant: z.string().min(20).max(29).optional().describe('The moment as an ISO 8601 time with Z or an offset, such as 2026-11-17T09:30:00Z (years 1800 to 2199). Leave out instant and date for the current moment.'),
  date: z.string().regex(/^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/).optional().describe('Instead of instant: the date on the local clock at the place, such as 2026-11-17, with time and zone.'),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional().describe('With date: the time on the local clock, such as 21:15.'),
  zone: z.string().min(1).max(64).regex(ZONE_PATTERN).optional().describe("The place's time zone, such as Asia/Bangkok. Needed with date and time; otherwise it only sets the clock the answer is shown on."),
  latitude: z.number().min(-90).max(90).describe("The place's latitude, for the rising sign and the houses."),
  longitude: z.number().min(-180).max(180).describe("The place's longitude, with latitude."),
  houseSystem: z.enum(NATAL_HOUSE_SYSTEMS).optional().describe('Optional: whole-sign (the default) or placidus. Placidus cannot be drawn from about 66.6 degrees latitude north or south; there the chart uses whole-sign houses and houseNote says so.'),
}).superRefine((args, context) => {
  if (args.instant !== undefined && (args.date !== undefined || args.time !== undefined)) context.addIssue({ code: 'custom', message: 'Give either instant, or date and time with zone, not both.' });
  if ((args.date === undefined) !== (args.time === undefined)) context.addIssue({ code: 'custom', message: 'Give date and time together, with zone.' });
  if (args.date !== undefined && !args.zone) context.addIssue({ code: 'custom', message: 'A local date and time need their time zone.' });
});
export type MomentChartInput = z.infer<typeof momentChartInput>;

const signSlug = z.enum(SIGNS.map((sign) => sign.slug) as [string, ...string[]]);
const placed = z.object({ sign: signSlug, position: z.string() });

export const momentChartData = z.object({
  /** Always a moment: this answer is never a birth chart. */
  kind: z.literal('moment'),
  castFor: z.object({
    utc: z.string(),
    /** The same instant on the zone's clock, with its offset; null without a zone. */
    local: z.string().nullable(),
    zone: z.string().nullable(),
    basis: z.enum(['now', 'instant', 'local-time']),
  }),
  /** Present only when the local time fell in a clock change: a skipped hour or a repeated one. */
  timeNote: z.string().nullable(),
  houseSystem: z.enum(['whole-sign', 'placidus']),
  houseNote: z.string().nullable(),
  rising: placed.extend({ pageUrl: z.url() }),
  midheaven: placed,
  planets: z.array(placed.extend({
    body: z.enum(PLANETS),
    retrograde: z.boolean(),
    house: z.number().int().min(1).max(12),
  })).length(PLANETS.length),
  houses: z.array(placed.extend({ house: z.number().int().min(1).max(12) })).length(12),
  aspects: z.array(z.object({
    a: z.enum(PLANETS), b: z.enum(PLANETS),
    type: z.enum(['conjunction', 'sextile', 'square', 'trine', 'opposition']),
    orb: z.number().min(0),
    applying: z.boolean(),
  })).max(MAX_ASPECTS),
  note: z.literal(MOMENT_NOTE),
});
export type MomentChartData = z.infer<typeof momentChartData>;

/** Where the instant came from: the server's clock, an ISO instant, or a local date and time already resolved. */
export type MomentAt =
  | { basis: 'now' | 'instant'; utc: Date }
  | { basis: 'local-time'; date: string; time: string };

const slugOf = (lon: number) => SIGNS[signIndexForLongitude(lon)].slug;
const at = (lon: number) => ({ sign: slugOf(lon), position: formatLongitude(lon) });

/** A plain sentence when the local time was skipped or repeated by a clock change; null otherwise. */
function momentTimeNote(time: string, flags: readonly string[], utc: Date, zone: string): string | null {
  if (flags.includes('dst-gap')) return `${time} did not exist on the local clock that day: the clocks jumped forward past it, so the chart is cast for ${localIso(utc, zone).slice(11, 16)} on the new clock.`;
  if (flags.includes('dst-fold')) return `${time} happened twice on the local clock that day, because the clocks went back. The chart uses the first time.`;
  return null;
}

/** The chart for one moment over one place. `zone` is already a canonical zone name when given. */
export async function getMomentChart(args: MomentChartInput, moment: MomentAt, clock: NatalClock, origin = DEFAULT_ORIGIN): Promise<{ data: MomentChartData; links: { title: string; url: string }[] }> {
  let utc: Date;
  let timeNote: string | null = null;
  if (moment.basis === 'local-time') {
    const date = parseCivilDate(moment.date);
    if (!date || date.year < NATAL_MIN_YEAR || date.year > NATAL_MAX_YEAR) throw new RangeError(`date must be a real date from ${NATAL_MIN_YEAR} to ${NATAL_MAX_YEAR}.`);
    if (!parseCivilTime(moment.time)) throw new RangeError('time must be HH:MM, such as 21:15.');
    await clock.prepareLocalTime(moment.date, args.zone!);
    const resolved = clock.resolveLocalToUtc(moment.date, moment.time, args.zone!, { longitude: roundCoordinate(args.longitude) });
    utc = resolved.utc;
    timeNote = momentTimeNote(moment.time, resolved.flags, utc, args.zone!);
  } else {
    utc = moment.utc;
    const year = utc.getUTCFullYear();
    if (year < NATAL_MIN_YEAR || year > NATAL_MAX_YEAR) throw new RangeError(`instant must fall from ${NATAL_MIN_YEAR} to ${NATAL_MAX_YEAR}.`);
  }
  const latitude = roundCoordinate(args.latitude);
  const longitude = roundCoordinate(args.longitude);
  const placidus = args.houseSystem === 'placidus';
  // The birth chart's engine call, with a known time and place, so the angles and houses are always drawn.
  const chart = computeChart({ utc, latitude, longitude, houseSystem: placidus ? 'placidus' : 'whole', timeKnown: true });
  if (!chart.angles || !chart.houses) throw new RangeError('The houses could not be drawn for that moment and place.');
  const { angles, houses } = chart;

  const planets = PLANETS.map((body) => {
    const row = chart.bodies.find((entry) => entry.body === body)!;
    return { body, ...at(row.lon), retrograde: row.retrograde, house: houseOf(row.lon, houses.cusps) };
  });
  const planetSet = new Set<string>(PLANETS);
  const aspects = chart.aspects
    .filter((aspect) => planetSet.has(aspect.a) && planetSet.has(aspect.b))
    .sort((a, b) => a.orb - b.orb || a.a.localeCompare(b.a) || a.b.localeCompare(b.b))
    .slice(0, MAX_ASPECTS)
    .map((aspect) => ({ a: aspect.a as Planet, b: aspect.b as Planet, type: aspect.type, orb: Math.round(aspect.orb * 10) / 10, applying: aspect.applying }));
  const fellBack = placidus && (chart.flags.includes('polar-fallback') || houses.system !== 'placidus');
  const houseNote = fellBack
    ? `Placidus houses cannot be drawn at ${Math.abs(latitude).toFixed(2)} degrees ${latitude >= 0 ? 'north' : 'south'}: from about 66.6 degrees latitude some degrees of the zodiac never rise or set, so the chart uses whole-sign houses instead.`
    : null;
  const rising = at(angles.asc);

  const data: MomentChartData = {
    kind: 'moment',
    castFor: { utc: utc.toISOString(), local: args.zone ? localIso(utc, args.zone) : null, zone: args.zone ?? null, basis: moment.basis },
    timeNote,
    houseSystem: houses.system === 'placidus' ? 'placidus' : 'whole-sign',
    houseNote,
    rising: { ...rising, pageUrl: `${origin}/rising-sign/${rising.sign}/` },
    midheaven: at(angles.mc),
    planets,
    houses: houses.cusps.map((cusp, index) => ({ house: index + 1, ...at(cusp) })),
    aspects,
    note: MOMENT_NOTE,
  };
  // No link carries the instant, the date, the time, the zone or the coordinates.
  const links = [
    { title: "Today's sky on Zodiacs", url: `${origin}/today/` },
    { title: 'The twelve houses', url: `${origin}/learn/houses/` },
    { title: 'Aspects between the planets', url: `${origin}/learn/aspects/` },
  ];
  return { data, links };
}
