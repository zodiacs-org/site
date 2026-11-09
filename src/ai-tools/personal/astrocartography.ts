/**
 * get_astrocartography: the person's planetary map lines, and the lines
 * closest to the towns and cities they name.
 *
 * The birth instant is resolved as every chart tool resolves it. Each body's
 * apparent right ascension and declination of date come from
 * @zodiacs/engine/calc (calc, frame "equatorial-true-of-date"), and Greenwich
 * sidereal time from the engine's relocation of the same instant to longitude
 * 0 (houses().armc). The lines and distances are src/lib/astrocartography's,
 * the same geometry the /astrocartography/ page draws in the browser; the
 * readings are pre-written there. Towns and cities are resolved from the
 * GeoNames index bundled with Zodiacs (find_birthplace's), so a name is not
 * sent anywhere. Nothing is stored, logged or put in a link.
 */
import { z } from 'zod';
import { calc, houses, type CalcBody } from '@zodiacs/engine/calc';
import { ACG_ANGLES, ACG_BODIES, NOTICEABLE_KM, STRONG_KM, horizonLongitude, lineDistances, mcLongitude, strengthOf, wrapLongitude, type EquatorialBody } from '../../lib/astrocartography/lines';
import { ANGLE_LABEL, ANGLE_NAME, LINE_MEANING, lineSentence } from '../../lib/astrocartography/meanings';
import { findBirthplace } from '../features/birthplace';
import { roundCoordinate } from '../plain-text';
import { readingConfidence, readingConfidenceLabel, readingDetail } from '../reading-confidence';
import { isUnder18, softenMinor, MINOR_NOTE } from '../features/reading-guards';
import { birthFields, castNatal, dateOn, definePersonalTool, refineBirth, type PersonalToolContext } from './shared';

export const ACG_MAX_CITIES = 5;
/** Latitudes the rising and setting lines are listed at in the answer: every 5 degrees from 75 south to 75 north. */
export const ACG_LIST_LATITUDES = Array.from({ length: 31 }, (_, index) => -75 + index * 5);
const round2 = (value: number) => Math.round(value * 100) / 100;
const KM_PER_MILE = 1.609344;

export const astrocartographyInput = z.strictObject({
  ...birthFields,
  time: birthFields.time.unwrap().describe('The birth time on the local clock, such as 08:30. Required: the lines move about 1 degree of longitude for every 4 minutes of birth time. Never guess it. Needs zone.'),
  zone: birthFields.zone.unwrap().describe("The birthplace's time zone, such as Europe/Madrid. Required."),
  latitude: birthFields.latitude.describe("Optional. The birthplace's latitude, with longitude: it matters only for births on local mean time, before standard time zones. Nothing is stored."),
  cities: z.array(z.string().trim().min(2).max(80)).max(ACG_MAX_CITIES).optional().describe(`Optional. Up to ${ACG_MAX_CITIES} towns or cities to check, such as "Lisbon" or "Paris, France" (a country after a comma when several places share the name). Names are matched against the place index bundled with Zodiacs and not sent anywhere or stored.`),
}).superRefine(refineBirth);
export type AstrocartographyInput = z.infer<typeof astrocartographyInput>;

const body = z.enum(ACG_BODIES);
const angle = z.enum(ACG_ANGLES);
const nearLine = z.object({
  planet: body,
  angle,
  /** "Venus Descendant line". */
  title: z.string(),
  distanceKm: z.number().int().min(0),
  distanceMiles: z.number().int().min(0),
  /** Which way the line lies along the place's own latitude, when the line reaches it. */
  side: z.enum(['east', 'west']).nullable(),
  strength: z.enum(['strong', 'noticeable', 'faint']),
  line: z.string(),
});
export const astrocartographyData = z.object({
  birthDate: z.string(),
  /** The birth instant the lines are for, UTC. */
  instantUtc: z.string(),
  /** Greenwich apparent sidereal time at birth, degrees. */
  siderealTimeDegrees: z.number(),
  lines: z.array(z.object({
    planet: body,
    /** East longitudes of the Midheaven and IC lines, degrees from −180 to 180 (negative is west). */
    mcLongitude: z.number(),
    icLongitude: z.number(),
    /** Where the planet was rising and setting, at every 5 degrees of latitude it reaches from 75 south to 75 north. */
    ascendant: z.array(z.object({ latitude: z.number(), longitude: z.number() })),
    descendant: z.array(z.object({ latitude: z.number(), longitude: z.number() })),
  })),
  cities: z.array(z.object({
    asked: z.string(),
    name: z.string(),
    region: z.string(),
    country: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    /** The nearest lines, closest first: every line within 800 km, and at least the closest three. */
    closest: z.array(nearLine).max(12),
    summary: z.string(),
  })).max(ACG_MAX_CITIES),
  /** Names that matched no town or city in the index. */
  unmatched: z.array(z.string()).max(ACG_MAX_CITIES),
  readings: z.object({ ASC: z.string(), DSC: z.string(), MC: z.string(), IC: z.string() }),
  confidence: z.number().int().min(40).max(95),
  confidenceLabel: z.string(),
  limits: z.array(z.string()),
  pageUrl: z.url(),
});
export type AstrocartographyData = z.infer<typeof astrocartographyData>;

/** Each body's apparent right ascension and declination of date at an instant, from the engine. */
export function equatorialBodies(utc: Date): EquatorialBody[] {
  return ACG_BODIES.map((name) => {
    const position = calc({ body: name as CalcBody, time: utc.toISOString(), frame: 'equatorial-true-of-date', flags: { speeds: false } });
    if (position.status !== 'ok') throw new RangeError('The birth date is outside the years the map can be drawn for (1800 to 2199).');
    return { body: name, ra: position.lon, dec: position.lat };
  });
}

/** Greenwich apparent sidereal time, degrees: the right ascension of the Midheaven at longitude 0, the engine's relocation of the instant there. */
export function greenwichSiderealDegrees(utc: Date): number {
  const result = houses({ time: utc.toISOString(), place: { latitude: 0, longitude: 0 } });
  if (result.status !== 'ok') throw new RangeError('The birth date is outside the years the map can be drawn for (1800 to 2199).');
  return result.armc;
}

/** "Lisbon" or "Paris, France". */
function splitCity(text: string): { place: string; country?: string } {
  const comma = text.lastIndexOf(',');
  if (comma <= 0) return { place: text.trim() };
  const place = text.slice(0, comma).trim();
  const country = text.slice(comma + 1).trim();
  return place.length >= 2 && country.length >= 2 ? { place, country } : { place: text.trim() };
}

export async function getAstrocartography(args: AstrocartographyInput, context: Pick<PersonalToolContext, 'now' | 'localTime' | 'origin' | 'placeTable'>): Promise<{ data: AstrocartographyData; links: { title: string; url: string }[] }> {
  const natal = await castNatal(args, context.localTime);
  const utc = natal.birthUtc;
  const bodies = equatorialBodies(utc);
  const gast = greenwichSiderealDegrees(utc);
  const under18 = isUnder18(args.birthDate, dateOn(context.now, 'UTC'));
  const guard = (text: string) => (under18 ? softenMinor(text) : text);
  // The instant is fixed by the date, time and zone; coordinates change it only on local mean time.
  const detail = readingDetail({ hasDate: true, hasTime: true, hasPlace: true });
  const confidenceLabel = readingConfidenceLabel(detail);
  const lines = bodies.map((entry) => {
    const mc = mcLongitude(entry, gast);
    const at = (which: 'ASC' | 'DSC') => ACG_LIST_LATITUDES.flatMap((latitude) => {
      const longitude = horizonLongitude(entry, gast, latitude, which);
      return longitude === null ? [] : [{ latitude, longitude: round2(longitude) }];
    });
    return { planet: entry.body, mcLongitude: round2(mc), icLongitude: round2(wrapLongitude(mc + 180)), ascendant: at('ASC'), descendant: at('DSC') };
  });

  const cities: AstrocartographyData['cities'] = [];
  const unmatched: string[] = [];
  const limits: string[] = [
    'Lines move about 1 degree of longitude (about 110 km at the equator) for every 4 minutes of birth time, so a birth time 15 minutes out moves every line by about 400 km.',
    `Astrocartographers mostly work within about ${STRONG_KM} km of a line and treat it as fading by about ${NOTICEABLE_KM} km.`,
  ];
  if (under18) limits.push(MINOR_NOTE);
  const asked = args.cities ?? [];
  if (asked.length) {
    if (!context.placeTable) throw new RangeError('Town and city lookup is not offered here; leave out cities for the lines alone.');
    const table = await context.placeTable();
    for (const text of asked) {
      const found = await findBirthplace(splitCity(text), context.now, context.localTime, table);
      const place = found.data.places[0];
      if (!place) { unmatched.push(text); continue; }
      const point = { lat: place.latitude, lon: place.longitude };
      const distances = lineDistances(point, bodies, gast);
      const closest = distances.filter((row, index) => index < 3 || row.km <= NOTICEABLE_KM).slice(0, 12).map((row) => ({
        planet: row.body, angle: row.angle, title: `${row.body} ${ANGLE_LABEL[row.angle]}`,
        distanceKm: Math.round(row.km), distanceMiles: Math.round(row.km / KM_PER_MILE), side: row.side, strength: strengthOf(row.km),
        line: `${guard(lineSentence(row.body, row.angle))} ${confidenceLabel}.`,
      }));
      const strong = closest.filter((row) => row.strength === 'strong');
      const top = closest[0];
      const summary = strong.length
        ? `${place.name} is within ${STRONG_KM} km of your ${strong.map((row) => row.title).join(', ')}. ${guard(LINE_MEANING[top.planet][top.angle])}`
        : `No line runs within ${STRONG_KM} km of ${place.name}. The nearest is your ${top.title}, about ${top.distanceKm.toLocaleString('en-GB')} km ${top.side ?? 'away'}, so its pull is ${top.strength === 'noticeable' ? 'still noticeable there' : 'faint there'}.`;
      cities.push({ asked: text, name: place.name, region: place.region, country: place.country, latitude: roundCoordinate(place.latitude), longitude: roundCoordinate(place.longitude), closest, summary });
    }
    if (unmatched.length) limits.push(`Some names matched no town or city of 15,000 people or more in the index: ${unmatched.join(', ')}. Try another spelling, or add the country after a comma.`);
  }
  return {
    data: {
      birthDate: args.birthDate, instantUtc: utc.toISOString(), siderealTimeDegrees: Math.round(gast * 10_000) / 10_000,
      lines, cities, unmatched,
      readings: { ASC: `Ascendant lines (${ANGLE_NAME.ASC}): how you come across and how you feel in yourself there.`, DSC: `Descendant lines (${ANGLE_NAME.DSC}): the people you meet and partner with there.`, MC: `Midheaven lines (${ANGLE_NAME.MC}): work, reputation and public life there.`, IC: `IC lines (${ANGLE_NAME.IC}): home, family and private life there.` },
      confidence: readingConfidence(detail), confidenceLabel, limits,
      pageUrl: `${context.origin}/astrocartography/`,
    },
    links: [
      { title: 'Draw your map on Zodiacs (calculated in your browser)', url: `${context.origin}/astrocartography/` },
      { title: 'Resolve a town or city (find_birthplace)', url: `${context.origin}/birth-chart/` },
      { title: 'How we calculate', url: `${context.origin}/methodology/` },
    ],
  };
}

export const astrocartographyTool = definePersonalTool({
  name: 'get_astrocartography',
  title: 'Your map lines',
  summary: 'astrocartography lines, and the lines nearest named towns and cities',
  description: "Gives the person's astrocartography: the lines on the world map where each planet, Sun to Pluto, was rising, setting, overhead or underfoot at the moment of birth, and, for up to five towns or cities they name, the closest lines with their distance and what each is traditionally read as for that place (love, work, home and how they feel there). Use it for astrocartography, astro map, relocation lines, where I should live or travel, or what a city means for me, once the person has given a birth date, time and time zone. A birth time is required, because the lines move about 1 degree of longitude for every 4 minutes; never guess one. When they name the birthplace as a town or city, use find_birthplace first for its time zone. Name the cities to check in cities. Share the readings plainly as astrology's reading, with the reading-confidence label; for a full map, give the returned page link, where the map is drawn in their own browser.",
  input: astrocartographyInput,
  data: astrocartographyData,
  clockDependent: false,
  example: { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', latitude: 51.51, longitude: -0.13, cities: ['Lisbon', 'New York', 'Tokyo'] },
  run: (args, context) => getAstrocartography(args, context),
});
