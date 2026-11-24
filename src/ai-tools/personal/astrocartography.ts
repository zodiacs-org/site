/**
 * get_astrocartography: the person's planetary map lines, and the lines
 * closest to the towns and cities they name.
 *
 * The birth instant is resolved as every chart tool resolves it. Each body's
 * right ascension and declination, and Greenwich sidereal time, come from the
 * site's chart engine (src/lib/astrocartography/positions.ts), the same
 * quantities the /astrocartography/ page reads. The lines and distances are src/lib/astrocartography's,
 * the same geometry the /astrocartography/ page draws in the browser; the
 * readings are pre-written there. Towns and cities are resolved from the
 * GeoNames index bundled with Zodiacs (find_birthplace's), so a name is not
 * sent anywhere. Nothing is stored, logged or put in a link.
 */
import { z } from 'zod';
import { equatorialMoment } from '../../lib/astrocartography/positions';
import { ACG_ANGLES, ACG_BODIES, NOTICEABLE_KM, STRONG_KM, horizonLongitude, lineDistances, mcLongitude, strengthOf, wrapLongitude, type EquatorialBody } from '../../lib/astrocartography/lines';
import { ACG_CONFIDENCE, ANGLE_LABEL, ANGLE_NAME, clockChangeLimit, farPlaceSummary, lineMeaning, lineSentence, roundedDistanceKm, under18At } from '../../lib/astrocartography/meanings';
import { astrocartographyShareUrl } from '../../lib/astrocartography/share';
import { countryMatches, findBirthplace, queryVariants, type PlaceTable } from '../features/birthplace';
import { fold, queryRows, shardKey } from '../../lib/geo/rank';
import { roundCoordinate } from '../plain-text';
import { softenMinor, MINOR_NOTE } from '../features/reading-guards';
import { readingConfidence, readingConfidenceText } from '../reading-confidence';
import { birthFields, castNatal, definePersonalTool, refineBirth, type PersonalToolContext } from './shared';

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
  /**
   * A share card of this line alone: the planet and the angle, never the birth details or the place. Null while the
   * website's page is switched off, and for a reading whose confidence is not the card's (no birthplace coordinates).
   */
  shareUrl: z.url().nullable(),
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
    /** Nearby lines, closest first. Outside the noticeable range, only the nearest measurement is given. */
    closest: z.array(nearLine).max(12),
    summary: z.string(),
  })).max(ACG_MAX_CITIES),
  /** Names that matched no town or city in the index. */
  unmatched: z.array(z.string()).max(ACG_MAX_CITIES),
  readings: z.object({ ASC: z.string(), DSC: z.string(), MC: z.string(), IC: z.string() }),
  confidence: z.number().int().min(40).max(95),
  confidenceLabel: z.string(),
  limits: z.array(z.string()),
  /** The /astrocartography/ page; null while the website's page is switched off (PUBLIC_ASTROCARTOGRAPHY_ENABLED). */
  pageUrl: z.url().nullable(),
});
export type AstrocartographyData = z.infer<typeof astrocartographyData>;

/** Each body's right ascension and declination at an instant, from the site's chart engine (src/lib/astrocartography/positions.ts). */
export function equatorialBodies(utc: Date): EquatorialBody[] {
  return equatorialMoment(utc).bodies;
}

/** Greenwich sidereal time, degrees: the right ascension of the Midheaven at longitude 0. */
export function greenwichSiderealDegrees(utc: Date): number {
  return equatorialMoment(utc).gast;
}

/** "Lisbon" or "Paris, France". */
function splitCity(text: string): { place: string; country?: string } {
  const comma = text.lastIndexOf(',');
  if (comma <= 0) return { place: text.trim() };
  const place = text.slice(0, comma).trim();
  const country = text.slice(comma + 1).trim();
  return place.length >= 2 && country.length >= 2 ? { place, country } : { place: text.trim() };
}

/**
 * The most populous place whose whole name is the one asked for, in the country when one is given. Null when no name
 * matches whole. Only this tool reads it, so find_birthplace's own list is unchanged.
 */
export function exactPlace(table: PlaceTable, request: { place: string; country?: string }): { name: string; region: string; country: string; latitude: number; longitude: number } | null {
  for (const query of queryVariants(request.place)) {
    const key = shardKey(query);
    // The rows are in population order (queryRows), so the first whole-name match is the most populous.
    for (const row of queryRows(table.index, table.shards[key] ?? [], key)) {
      if (fold(row[0]) !== query && (row[1] === 0 || fold(row[1]) !== query)) continue;
      const country = table.index.countries[row[3]] ?? '';
      if (request.country && !countryMatches(country, request.country)) continue;
      return { name: row[0], region: table.index.admin1[row[2]] ?? '', country, latitude: row[4] / 100, longitude: row[5] / 100 };
    }
  }
  return null;
}

/**
 * find_birthplace lists names that start with the text, by population, for the person to choose from; this tool
 * answers for one place. A whole-name match comes first when the list's first name only continues the last word
 * asked for: Kerman, Iran is Kerman, not Kermanshah, and Dali, China is Dali, not Dalian. A first name that adds
 * whole words keeps its place, so Mexico stays Mexico City and Nara stays Nara-shi.
 */
export function chosenPlace<A extends { name: string }, B extends { name: string }>(listed: A | undefined, exact: B | null, place: string): A | B | undefined {
  if (!listed || !exact) return listed ?? exact ?? undefined;
  const name = fold(listed.name);
  const continuesWord = queryVariants(place).some((query) => name !== query && name.startsWith(query) && /[\p{L}\p{N}]/u.test(name[query.length] ?? ''));
  return continuesWord ? exact : listed;
}

export async function getAstrocartography(args: AstrocartographyInput, context: Pick<PersonalToolContext, 'now' | 'localTime' | 'origin' | 'pageOn' | 'placeTable'>): Promise<{ data: AstrocartographyData; links: { title: string; url: string }[] }> {
  const natal = await castNatal(args, context.localTime);
  // The page and its line cards exist only while the website's page is switched on; otherwise neither is linked.
  const pageOn = context.pageOn === true;
  const utc = natal.birthUtc;
  const bodies = equatorialBodies(utc);
  const gast = greenwichSiderealDegrees(utc);
  // The shared rule (../reading-confidence.ts): a birth time counts only with the birthplace's latitude and longitude.
  const confidence = readingConfidence(natal.detail);
  const confidenceLabel = readingConfidenceText(confidence);
  // A line's share card prints the page's confidence (ACG_CONFIDENCE, a birth time with its birthplace), so a
  // reading with another confidence gets no card link rather than one whose card disagrees with it.
  const cardMatches = confidence === ACG_CONFIDENCE;
  // The age is read as the /astrocartography/ page reads it: on the calendar date at UTC-12, the earliest anywhere,
  // so nobody gets the love and attraction readings before their 18th birthday has begun everywhere.
  const under18 = under18At(args.birthDate, context.now);
  // Under 18 the lines read as love or attraction take their own readings (lineMeaning); softenMinor covers the rest.
  const guard = (text: string) => (under18 ? softenMinor(text) : text);
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
  const clockChange = clockChangeLimit(natal.flags, natal.jumpMinutes);
  if (clockChange) limits.push(clockChange);
  if (under18) limits.push(MINOR_NOTE);
  const asked = args.cities ?? [];
  if (asked.length) {
    if (!context.placeTable) throw new RangeError('Town and city lookup is not offered here; leave out cities for the lines alone.');
    const table = await context.placeTable();
    for (const text of asked) {
      const request = splitCity(text);
      const found = await findBirthplace(request, context.now, context.localTime, table);
      const place = chosenPlace(found.data.places[0], exactPlace(table, request), request.place);
      if (!place) { unmatched.push(text); continue; }
      const point = { lat: place.latitude, lon: place.longitude };
      const distances = lineDistances(point, bodies, gast);
      const far = farPlaceSummary(distances[0]);
      const selected = far ? distances.slice(0, 1) : distances.filter((row, index) => index < 3 || row.km <= NOTICEABLE_KM).slice(0, 12);
      const closest = selected.map((row) => {
        const distanceKm = roundedDistanceKm(row.km);
        return {
          planet: row.body, angle: row.angle, title: `${row.body} ${ANGLE_LABEL[row.angle]}`,
          distanceKm, distanceMiles: Math.round(distanceKm / KM_PER_MILE), side: row.side, strength: strengthOf(row.km),
          line: far ?? `${guard(lineSentence(row.body, row.angle, under18))} ${confidenceLabel}.`,
          shareUrl: pageOn && cardMatches ? astrocartographyShareUrl(context.origin, { planet: row.body, angle: row.angle }) : null,
        };
      });
      const strong = closest.filter((row) => row.strength === 'strong');
      const top = closest[0];
      let summary = far;
      if (!summary && strong.length) {
        const meaning = lineMeaning(top.planet, top.angle, under18);
        summary = `${place.name} is within ${STRONG_KM} km of your ${strong.map((row) => row.title).join(', ')}.${meaning ? ` ${guard(meaning)}` : ''}`;
      }
      summary ??= `No line runs within ${STRONG_KM} km of ${place.name}. The nearest is your ${top.title}, about ${top.distanceKm.toLocaleString('en-GB')} km ${top.side ?? 'away'}, so its pull is still noticeable there.`;
      cities.push({ asked: text, name: place.name, region: place.region, country: place.country, latitude: roundCoordinate(place.latitude), longitude: roundCoordinate(place.longitude), closest, summary });
    }
    if (unmatched.length) limits.push(`Some names matched no town or city of 15,000 people or more in the index: ${unmatched.join(', ')}. Try another spelling, or add the country after a comma.`);
  }
  return {
    data: {
      birthDate: args.birthDate, instantUtc: utc.toISOString(), siderealTimeDegrees: Math.round(gast * 10_000) / 10_000,
      lines, cities, unmatched,
      readings: { ASC: `Ascendant lines (${ANGLE_NAME.ASC}): how you come across and how you feel in yourself there.`, DSC: under18 ? `Descendant lines (${ANGLE_NAME.DSC}).` : `Descendant lines (${ANGLE_NAME.DSC}): the people you meet and partner with there.`, MC: `Midheaven lines (${ANGLE_NAME.MC}): work, reputation and public life there.`, IC: `IC lines (${ANGLE_NAME.IC}): home, family and private life there.` },
      confidence, confidenceLabel, limits,
      pageUrl: pageOn ? `${context.origin}/astrocartography/` : null,
    },
    links: [
      ...(pageOn ? [{ title: 'Draw your map on Zodiacs (calculated in your browser)', url: `${context.origin}/astrocartography/` }] : []),
      { title: 'Resolve a town or city (find_birthplace)', url: `${context.origin}/birth-chart/` },
      { title: 'How we calculate', url: `${context.origin}/methodology/` },
    ],
  };
}

export const astrocartographyTool = definePersonalTool({
  name: 'get_astrocartography',
  title: 'Your map lines',
  summary: 'astrocartography lines, and the lines nearest named towns and cities',
  description: "Gives the person's astrocartography: the lines on the world map where each planet, Sun to Pluto, was rising, setting, overhead or underfoot at the moment of birth, and, for up to five towns or cities they name, the closest lines with their distance and what each is traditionally read as for that place (love, work, home and how they feel there). Use it for astrocartography, astro map, relocation lines, where I should live or travel, or what a city means for me, once the person has given a birth date, time and time zone. Zodiacs is not directed at children under 13: check the birth date first, and ask for no birth time or birthplace when it is less than 13 years ago, since the tool refuses that date. A birth time is required, because the lines move about 1 degree of longitude for every 4 minutes; never guess one. When they name the birthplace as a town or city, use find_birthplace first for its time zone. Name the cities to check in cities. Share the readings plainly as astrology's reading, with the reading-confidence label; for a full map, give the returned page link, where the map is drawn in their own browser. Each line near a place has a shareUrl to a card of that line alone (no birth details or place); give it exactly as returned.",
  input: astrocartographyInput,
  data: astrocartographyData,
  // The readings change on the eighteenth birthday, so a repeat call can differ as the server's clock moves.
  clockDependent: true,
  pageFlag: 'PUBLIC_ASTROCARTOGRAPHY_ENABLED',
  example: { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', latitude: 51.51, longitude: -0.13, cities: ['Lisbon', 'New York', 'Tokyo'] },
  run: (args, context) => getAstrocartography(args, context),
});
