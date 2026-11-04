/**
 * get_natal_chart: one person's birth chart as a readout the assistant can
 * read and reason over. The chart is the engine's (src/lib/engine/full.ts,
 * whole-sign houses, as get_compatibility casts it); every sentence is the
 * site's own wording: the big three (src/lib/interpretations.ts), each
 * placement's sign and house (src/lib/natal-context.ts, src/lib/natal.ts),
 * the closest aspects (natalAspectLine) and the element and mode balance
 * (chartWeather).
 *
 * Without a birth time it says what is unknown rather than guessing: no
 * rising sign, no houses, and a sign only where the whole birth day keeps
 * the body in it; otherwise it lists the
 * signs the body was in that day. Pure: no network, storage or logging.
 */
import { z } from 'zod';
import type { LocalTimeModule } from '../../lib/compute-api/local-time';
import { computeChart } from '../../lib/engine/full.js';
import { houseOf } from '../../lib/engine/houses';
import type { BodyName, Chart } from '../../lib/engine/types';
import { bigThree } from '../../lib/interpretations';
import { chartWeather, natalAspectLine, planetInHouseLine } from '../../lib/natal';
import { placementContext } from '../../lib/natal-context';
import { roundCoordinate } from '../plain-text';
import { SIGNS, formatLongitude, signIndexForLongitude, type Element, type Modality } from '../../lib/signs';
import { parseCivilDate, parseCivilTime } from '../../lib/time/civil-date';
import { MINOR_NOTE, isUnder18, softenHealth, softenMinor } from './reading-guards';

const DEFAULT_ORIGIN = 'https://zodiacs.org';
const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
const PLAIN_TEXT = /^[^\u0000-\u001f\u007f<>{}[\]\\`]+$/u;
const HOUR = 3_600_000;
export const NATAL_MIN_YEAR = 1800;
export const NATAL_MAX_YEAR = 2199;
/** How many aspects the readout lists, closest first by orb. */
export const NATAL_TOP_ASPECTS = 8;
export const NATAL_NOTE = 'Astrology’s reading of a birth chart: tendencies to reflect on, not a prediction or a fixed destiny.';
const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
type Planet = typeof PLANETS[number];

export const natalChartInput = z.strictObject({
  birthDate: z.string().regex(/^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/).describe('The birth date, such as 1990-05-03 (years 1800 to 2199).'),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional().describe('The birth time on the local clock, such as 08:30, only if the person knows it. Never guess it. Needs zone.'),
  zone: z.string().min(1).max(64).regex(ZONE_PATTERN).optional().describe("The birthplace's time zone, such as Europe/Madrid. Needed with a time or a place."),
  latitude: z.number().min(-90).max(90).optional().describe("Optional. The birthplace's latitude; with a birth time it adds the rising sign and the houses. Give it with longitude and zone. Nothing is stored."),
  longitude: z.number().min(-180).max(180).optional().describe("Optional. The birthplace's longitude, with latitude. Nothing is stored."),
  place: z.string().trim().min(1).max(80).regex(PLAIN_TEXT).optional().describe('Optional birthplace name, such as Madrid, Spain. Display only: it is not used in the calculation and is not stored.'),
}).superRefine((args, context) => {
  if ((args.latitude === undefined) !== (args.longitude === undefined)) context.addIssue({ code: 'custom', message: 'Give latitude and longitude together.' });
  if ((args.time !== undefined || args.latitude !== undefined) && !args.zone) context.addIssue({ code: 'custom', message: 'A birth time or a place needs its time zone.' });
});
export type NatalChartInput = z.infer<typeof natalChartInput>;

const signSlug = z.enum(SIGNS.map((sign) => sign.slug) as [string, ...string[]]);
const tally = <T extends string>(keys: readonly [T, ...T[]]) => z.object(Object.fromEntries(keys.map((key) => [key, z.number().int().min(0)])) as Record<T, z.ZodNumber>);
const bigThreeEntry = z.object({
  /** The sign when the chart settles it; null when it is unknown. */
  sign: signSlug.nullable(),
  /** Without a birth time, the signs the body could be in that day; with one, just its sign. Empty for an unknown rising sign. */
  possibleSigns: z.array(signSlug),
  meaning: z.string().nullable(),
  pageUrl: z.url().nullable(),
});

export const natalChartData = z.object({
  birthDate: z.string(),
  time: z.string().nullable(),
  zone: z.string().nullable(),
  place: z.string().nullable(),
  timeKnown: z.boolean(),
  placed: z.boolean(),
  /** The instant the chart is cast for: the birth time, else local noon (or noon UTC without a zone). */
  castFor: z.object({ utc: z.string(), basis: z.enum(['birth-time', 'local-noon', 'utc-noon']) }),
  houseSystem: z.enum(['whole-sign']).nullable(),
  sun: bigThreeEntry,
  moon: bigThreeEntry,
  rising: bigThreeEntry,
  planets: z.array(z.object({
    body: z.enum(PLANETS),
    sign: signSlug.nullable(),
    possibleSigns: z.array(signSlug),
    /** Degree and minute in the sign, such as 12°37′ Taurus; null when the sign is unknown. */
    position: z.string().nullable(),
    retrograde: z.boolean(),
    house: z.number().int().min(1).max(12).nullable(),
    signLine: z.string().nullable(),
    houseLine: z.string().nullable(),
    pageUrl: z.url().nullable(),
  })).length(PLANETS.length),
  angles: z.object({ ascendant: z.string(), midheaven: z.string() }).nullable(),
  aspects: z.array(z.object({
    a: z.enum(PLANETS), b: z.enum(PLANETS),
    type: z.enum(['conjunction', 'sextile', 'square', 'trine', 'opposition']),
    orb: z.number().min(0),
    line: z.string(),
  })).max(NATAL_TOP_ASPECTS),
  balance: z.object({ elements: tally(['fire', 'earth', 'air', 'water']), modalities: tally(['cardinal', 'fixed', 'mutable']), lines: z.array(z.string()) }),
  /** What the chart cannot say from the details given, in plain sentences. */
  unknown: z.array(z.string()),
  /**
   * Present only when the birth time fell in a daylight saving change: a gap (the clock skipped it, so the chart
   * is cast that many minutes later) or a fold (the clock showed it twice; the chart uses the first).
   */
  timeNote: z.object({
    kind: z.enum(['dst-gap', 'dst-fold']),
    /** For a gap, how far forward the time was moved; 0 for a fold. */
    shiftMinutes: z.number().min(0),
    /** The UTC offset the chart used, such as -04:00. */
    offsetUsed: z.string(),
    text: z.string(),
  }).optional(),
  /** The birth chart page. It carries no birth date, time, place or coordinates. */
  chartUrl: z.url(),
  /** True when the birth date is under 18 on the day of the call. Romantic and attraction readings are left out. */
  under18: z.boolean(),
  note: z.literal(NATAL_NOTE),
});
export type NatalChartData = z.infer<typeof natalChartData>;

/** The resolver methods this module calls; api/_compute/local-time.mjs supplies them. */
export type NatalClock = Pick<LocalTimeModule, 'prepareLocalTime' | 'resolveLocalToUtc'>;

async function resolveLocal(date: string, time: string, zone: string, longitude: number | undefined, clock: NatalClock) {
  await clock.prepareLocalTime(date, zone);
  return longitude !== undefined ? clock.resolveLocalToUtc(date, time, zone, { longitude }) : clock.resolveLocalToUtc(date, time, zone);
}
async function localInstant(date: string, time: string, zone: string, longitude: number | undefined, clock: NatalClock): Promise<Date> {
  return (await resolveLocal(date, time, zone, longitude, clock)).utc;
}

/** Minutes east of UTC as +HH:MM, rounded to the minute (a local mean time offset runs to seconds). */
function offsetText(minutes: number): string {
  const rounded = Math.round(minutes);
  const sign = rounded < 0 ? '-' : '+';
  const abs = Math.abs(rounded);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** What a birth time in a daylight saving gap or fold did to the chart, in a plain sentence; undefined otherwise. */
export function birthTimeNote(date: string, time: string, zone: string, resolved: { utc: Date; offsetMinutes: number; flags: readonly string[] }): NatalChartData['timeNote'] {
  const offsetUsed = offsetText(resolved.offsetMinutes);
  if (resolved.flags.includes('dst-gap')) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const local = new Date(resolved.utc.getTime() + resolved.offsetMinutes * 60_000);
    const shiftMinutes = Math.round((local.getTime() - Date.UTC(year, month - 1, day, hour, minute)) / 60_000);
    const shown = local.toISOString().slice(11, 16);
    // A skipped day (Samoa, 30 December 2011) moves the chart to another date; the note names it.
    const shownDate = local.toISOString().slice(0, 10);
    const onDate = shownDate === date ? '' : ` on ${shownDate}`;
    return {
      kind: 'dst-gap', shiftMinutes, offsetUsed,
      text: `${time} did not exist on ${date} in ${zone}: the clocks jumped forward past it. The chart is cast for ${shown}${onDate} on the new clock (UTC${offsetUsed}), ${shiftMinutes} minute${shiftMinutes === 1 ? '' : 's'} later. Check the birth time with the person if it matters.`,
    };
  }
  if (resolved.flags.includes('dst-fold')) {
    return {
      kind: 'dst-fold', shiftMinutes: 0, offsetUsed,
      text: `${time} happened twice on ${date} in ${zone}, because the clocks went back. The chart uses the first time (UTC${offsetUsed}); a birth in the repeated hour would move the Moon, the rising sign and the houses, so ask which it was if it matters.`,
    };
  }
  return undefined;
}

const slugAt = (index: number | null) => (index === null ? null : SIGNS[index].slug);
const signName = (slug: string) => SIGNS.find((sign) => sign.slug === slug)!.name;
const placementUrl = (origin: string, body: string, slug: string) => `${origin}/learn/placements/${body.toLowerCase()}-in-${slug}/`;

/** `today` is the caller's date (YYYY-MM-DD), for the under-18 rule. */
export async function getNatalChart(args: NatalChartInput, clock: NatalClock, origin = DEFAULT_ORIGIN, today = new Date().toISOString().slice(0, 10)): Promise<{ data: NatalChartData; links: { title: string; url: string }[] }> {
  const date = parseCivilDate(args.birthDate);
  if (!date || date.year < NATAL_MIN_YEAR || date.year > NATAL_MAX_YEAR) throw new RangeError(`birthDate must be a real date from ${NATAL_MIN_YEAR} to ${NATAL_MAX_YEAR}.`);
  if (args.time !== undefined && !parseCivilTime(args.time)) throw new RangeError('time must be HH:MM, such as 08:30.');
  const timeKnown = args.time !== undefined;
  const latitude = args.latitude === undefined ? undefined : roundCoordinate(args.latitude);
  const longitude = args.longitude === undefined ? undefined : roundCoordinate(args.longitude);
  const placed = latitude !== undefined && longitude !== undefined;
  const resolved = args.zone ? await resolveLocal(args.birthDate, args.time ?? '12:00', args.zone, longitude, clock) : null;
  const utc = resolved ? resolved.utc : new Date(`${args.birthDate}T12:00:00Z`);
  const timeNote = resolved && args.time !== undefined ? birthTimeNote(args.birthDate, args.time, args.zone!, resolved) : undefined;
  const chart = computeChart({ utc, ...(placed ? { latitude, longitude } : {}), houseSystem: 'whole', timeKnown });
  const angles = timeKnown && placed ? chart.angles : null;

  // Without a birth time, the signs each body passed through on the birth day: the local day with a zone,
  // else every zone's version of that date (UTC-12 to UTC+14).
  let possible: (body: Planet) => string[] = (body) => [slugAt(signIndexForLongitude(lonOf(chart, body)))!];
  if (!timeKnown) {
    const [first, last] = args.zone
      ? [await localInstant(args.birthDate, '00:00', args.zone, longitude, clock), await localInstant(args.birthDate, '23:59', args.zone, longitude, clock)]
      : [new Date(Date.parse(`${args.birthDate}T00:00:00Z`) - 14 * HOUR), new Date(Date.parse(`${args.birthDate}T23:59:00Z`) + 12 * HOUR)];
    const ends = [first, last].map((at) => computeChart({ utc: at, houseSystem: 'whole', timeKnown: false }));
    possible = (body) => {
      const indices = new Set(ends.map((end) => signIndexForLongitude(lonOf(end, body))));
      // A body that changes sign during the day was in each sign from the first to the last.
      // Walk in the direction the body moved, so a retrograde crossing lists only the signs it passed.
      const [from, to] = [lonOf(ends[0], body), lonOf(ends[1], body)];
      const [a, b] = [signIndexForLongitude(from), signIndexForLongitude(to)];
      const step = ((to - from + 540) % 360) - 180 < 0 ? 11 : 1;
      if (a !== b) for (let index = a; index !== b; index = (index + step) % 12) indices.add(index);
      return [...indices].map((index) => SIGNS[index].slug);
    };
  }
  // A sign is stated only when the whole birth day keeps the body in it: with a birth time, always.
  const settled = (body: Planet) => (timeKnown || possible(body).length === 1 ? possible(body)[0] : null);
  const houseFor = (lon: number) => (angles && chart.houses ? houseOf(lon, chart.houses.cusps) : null);

  const planets = PLANETS.map((body) => {
    const row = chart.bodies.find((entry) => entry.body === body)!;
    const sign = settled(body);
    const house = sign ? houseFor(row.lon) : null;
    const context = sign ? placementContext(body as BodyName, sign, house, row.speed) : null;
    return {
      body,
      sign,
      possibleSigns: possible(body),
      position: sign ? formatLongitude(row.lon) : null,
      retrograde: row.retrograde,
      house,
      signLine: context ? context.how : null,
      houseLine: house ? planetInHouseLine(body, house) : null,
      pageUrl: sign ? placementUrl(origin, body, sign) : null,
    };
  });
  const sun = planets[0];
  const moon = planets[1];
  const risingSlug = angles ? SIGNS[signIndexForLongitude(angles.asc)].slug : null;

  // Untimed, the Moon can move about thirteen degrees through the day, so its aspects are left out.
  const aspectBodies = new Set<string>(timeKnown ? PLANETS : PLANETS.filter((body) => body !== 'Moon'));
  const aspects = chart.aspects
    .filter((aspect) => aspectBodies.has(aspect.a) && aspectBodies.has(aspect.b))
    .sort((a, b) => a.orb - b.orb || a.a.localeCompare(b.a) || a.b.localeCompare(b.b))
    .slice(0, NATAL_TOP_ASPECTS)
    .map((aspect) => ({ a: aspect.a as Planet, b: aspect.b as Planet, type: aspect.type, orb: Math.round(aspect.orb * 10) / 10, line: natalAspectLine(aspect.a, aspect.type, aspect.b) }));

  const weatherBodies = PLANETS.map((body) => {
    const row = chart.bodies.find((entry) => entry.body === body)!;
    return { body, lon: row.lon, retrograde: row.retrograde, sign: settled(body) ?? undefined };
  });
  const weather = chartWeather(weatherBodies, angles ? (body) => houseFor(chart.bodies.find((entry) => entry.body === body)!.lon) : undefined);

  const unknown: string[] = [];
  if (!timeKnown) {
    unknown.push('No birth time was given, so the rising sign and the houses are unknown, and the chart is cast for midday.');
    unknown.push(moon.possibleSigns.length > 1
      ? `The Moon changed sign that day: it was in ${moon.possibleSigns.map(signName).join(' or ')}, depending on the birth time.`
      : `The Moon stayed in ${signName(moon.possibleSigns[0])} all that day, but its exact degree and aspects need the birth time.`);
    for (const row of planets.slice(2)) {
      if (!row.sign) unknown.push(`${row.body} changed sign that day, from ${row.possibleSigns.map(signName).join(' to ')}; the birth time settles it.`);
    }
    if (!sun.sign) unknown.push(`The Sun changed sign that day, from ${sun.possibleSigns.map(signName).join(' to ')}; the birth time settles the Sun sign.`);
  } else if (!placed) {
    unknown.push('No birthplace coordinates were given, so the rising sign and the houses are unknown.');
  }
  if (!args.zone) unknown.push('No time zone was given, so the chart is cast for noon UTC on the birth date.');

  const big = (kind: 'sun' | 'moon' | 'rising', slug: string | null, options: string[], url: string | null) => ({
    sign: slug, possibleSigns: options, meaning: slug ? bigThree(kind, slug) || null : null, pageUrl: url,
  });
  // The page link carries no birth date, time, name or coordinates. The readout stays in the answer.
  const chartUrl = `${origin}/birth-chart/`;
  // Under 18, romantic and attraction wording is left out of every line; the sixth house never reads as health.
  const under18 = isUnder18(args.birthDate, today);
  const guard = (text: string) => (under18 ? softenMinor(softenHealth(text)) : softenHealth(text));
  const guardedBig = (kind: 'sun' | 'moon' | 'rising', slug: string | null, options: string[], url: string | null) => {
    const entry = big(kind, slug, options, url);
    return { ...entry, meaning: entry.meaning ? guard(entry.meaning) : null };
  };
  if (under18) unknown.push(MINOR_NOTE);
  const data: NatalChartData = {
    birthDate: args.birthDate,
    time: args.time ?? null,
    zone: args.zone ?? null,
    place: args.place ?? null,
    timeKnown,
    placed,
    castFor: { utc: utc.toISOString(), basis: timeKnown ? 'birth-time' : args.zone ? 'local-noon' : 'utc-noon' },
    houseSystem: angles ? 'whole-sign' : null,
    sun: guardedBig('sun', sun.sign, sun.possibleSigns, sun.sign ? `${origin}/${sun.sign}/` : null),
    moon: guardedBig('moon', moon.sign, moon.possibleSigns, moon.sign ? placementUrl(origin, 'Moon', moon.sign) : null),
    rising: guardedBig('rising', risingSlug, risingSlug ? [risingSlug] : [], risingSlug ? `${origin}/rising-sign/${risingSlug}/` : null),
    planets: planets.map((row) => ({ ...row, signLine: row.signLine ? guard(row.signLine) : null, houseLine: row.houseLine ? guard(row.houseLine) : null })),
    angles: angles ? { ascendant: formatLongitude(angles.asc), midheaven: formatLongitude(angles.mc) } : null,
    aspects: aspects.map((aspect) => ({ ...aspect, line: guard(aspect.line) })),
    balance: { elements: weather.elements as Record<Element, number>, modalities: weather.modalities as Record<Modality, number>, lines: weather.lines.map(guard) },
    unknown,
    ...(timeNote ? { timeNote } : {}),
    chartUrl,
    under18,
    note: NATAL_NOTE,
  };
  const links = [
    { title: 'Open the birth chart page on Zodiacs', url: chartUrl },
    { title: 'Resolve a town or city (find_birthplace)', url: `${origin}/birth-chart/` },
    ...(sun.sign ? [{ title: `${signName(sun.sign)} on Zodiacs`, url: `${origin}/${sun.sign}/` }] : []),
    { title: 'How to read a birth chart', url: `${origin}/learn/how-to-read-a-birth-chart/` },
  ];
  return { data, links };
}

function lonOf(chart: Chart, body: string): number {
  return chart.bodies.find((row) => row.body === body)!.lon;
}
