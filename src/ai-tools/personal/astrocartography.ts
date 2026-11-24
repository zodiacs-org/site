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
import { queryVariants, type PlaceTable } from '../features/birthplace';
import { fold, queryRows, shardKey, type Row } from '../../lib/geo/rank';
import { coordinateText, distinctPlaceLabels, placeId, placeLabelText, rowPoint } from '../../lib/geo/place-label';
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
  placeIds: z.array(z.string().trim().min(2).max(40)).max(ACG_MAX_CITIES).optional().describe(`Optional. The id of a place listed under ambiguous or didYouMean in an earlier answer, to check exactly that place. Up to ${ACG_MAX_CITIES} places in all, with cities.`),
}).superRefine(refineBirth).superRefine((args, context) => {
  if ((args.cities?.length ?? 0) + (args.placeIds?.length ?? 0) > ACG_MAX_CITIES) context.addIssue({ code: 'custom', path: ['placeIds'], message: `Up to ${ACG_MAX_CITIES} places in all, with cities.` });
});
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
/** A place to ask about: its id for placeIds, and a label that tells it apart from the others listed with it. */
const placeChoice = z.object({ id: z.string(), name: z.string(), region: z.string(), country: z.string(), label: z.string() });
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
    /** The place's id (placeIds reads it back). */
    id: z.string(),
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
  /** Names that match more than one place equally well, with the places they could be: ask which one is meant. */
  ambiguous: z.array(z.object({
    asked: z.string(),
    places: z.array(placeChoice).min(2).max(5),
  })).max(ACG_MAX_CITIES),
  /** Names with a region or country that no place with the name is in, with the places of that name elsewhere: ask which one is meant. */
  didYouMean: z.array(z.object({
    asked: z.string(),
    places: z.array(placeChoice).min(1).max(5),
  })).max(ACG_MAX_CITIES),
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

/** A town or city as this tool reads it from the place index, with its id (placeId, src/lib/geo/place-label.ts). */
export interface AcgPlace { id: string; name: string; region: string; country: string; latitude: number; longitude: number }

const words = (text: string) => ` ${fold(text).replace(/[^a-z0-9]+/gu, ' ').trim()} `;
/** A text's comma-separated parts, each folded to its words, so labels and names compare whatever the spacing and case. */
const partKeys = (text: string) => text.split(',').map((part) => words(part).trim());

/**
 * "Lisbon", "Paris, France", "Belmont, California" or "London, Ontario, Canada": the name, then a region or a country
 * after a comma, or a region and then the country. A run of parts that is the whole of a name in the index with a
 * comma in it (joined: a place such as Mianzhu, Deyang, Sichuan, or a country such as Bonaire, Saint Eustatius and
 * Saba) stays one part, the longest such name first, so that name is never split into a name and its hints.
 */
function splitCity(text: string, joined: readonly (readonly string[])[] = []): { place: string; hints: string[] } {
  const raw = text.split(',').map((part) => part.trim());
  const keys = raw.map((part) => words(part).trim());
  const parts: string[] = [];
  for (let at = 0; at < raw.length;) {
    const run = joined.find((name) => name.length <= raw.length - at && name.every((key, offset) => keys[at + offset] === key))?.length ?? 1;
    parts.push(raw.slice(at, at + run).join(', '));
    at += run;
  }
  const [place, ...hints] = parts;
  return place.length >= 2 && hints.length && hints.every((hint) => hint.length >= 2) ? { place, hints } : { place: parts.join(', '), hints: [] };
}

/** What a typed name is checked against before it is split at its commas: every place's label, and its id. */
interface LabelIndex {
  /** Each label's folded parts (partKeys joined by commas) to the places with that label, largest first. */
  labels: Map<string, Row[]>;
  /** The names in the index with a comma in them, as folded parts, longest first (splitCity's joined). */
  joined: string[][];
}
const labelIndexes = new WeakMap<PlaceTable, LabelIndex>();
/**
 * The label index of a table: each place under its label (Udaipur, Rajasthan, India) and under the label with its
 * coordinates that tells it apart from places sharing that label (Udaipur, Rajasthan, India (24.59° N, 73.71° E)),
 * so any label an answer lists reads back as the place it was listed for.
 */
function labelIndex(table: PlaceTable): LabelIndex {
  let index = labelIndexes.get(table);
  if (index) return index;
  const labels = new Map<string, Row[]>();
  const add = (key: string, row: Row) => { const list = labels.get(key); if (list) list.push(row); else labels.set(key, [row]); };
  const joined = new Map<string, string[]>();
  for (const shard of Object.values(table.shards)) {
    for (const row of shard) {
      const point = rowPoint(table.index, row);
      const label = placeLabelText(point);
      add(partKeys(label).join(','), row);
      add(partKeys(`${label} (${coordinateText(point.lat, point.lon)})`).join(','), row);
      for (const name of [point.name, ...(row[1] === 0 ? [] : [String(row[1])]), point.admin1, point.country]) {
        if (name.includes(',')) joined.set(partKeys(name).join(','), partKeys(name));
      }
    }
  }
  for (const list of labels.values()) list.sort((a, b) => b[7] - a[7]);
  index = { labels, joined: [...joined.values()].sort((a, b) => b.length - a.length) };
  labelIndexes.set(table, index);
  return index;
}

/**
 * The one place, or the places sharing it, that a typed text names whole: a place's id, or a label an answer lists
 * (a place's name, region and country, with its coordinates where they tell it apart). Null when it is neither.
 */
function placeByLabel(table: PlaceTable, text: string): { place: AcgPlace } | { choices: AcgPlace[] } | null {
  if (PLACE_ID.test(text.trim())) {
    const place = placeById(table, text);
    if (place) return { place };
  }
  const rows = labelIndex(table).labels.get(partKeys(text).join(','));
  if (!rows?.length) return null;
  return rows.length === 1 ? { place: toPlace(table, rows[0]) } : { choices: rows.slice(0, ACG_CHOICES).map((row) => toPlace(table, row)) };
}
/** The form of placeId's ids (src/lib/geo/place-label.ts). */
const PLACE_ID = /^p[0-9a-z]{11}$/u;
/**
 * Names a person may give as a country that are a region of it in the index: England, Scotland, Wales and Northern
 * Ireland are the United Kingdom's regions. A typed one must be the place's own region, never just its country, so
 * London, Scotland is not London, England, and Northern Ireland is never read as Ireland.
 */
const REGION_NAMES: ReadonlySet<string> = new Set(['england', 'scotland', 'wales', 'northern ireland']);
const isRegionName = (hint: string) => REGION_NAMES.has(words(hint).trim());
/**
 * The hint is the place's region by its whole name, folded, never by words inside a longer one: Virginia is not West
 * Virginia, Carolina is not North or South Carolina, Dakota is not North or South Dakota.
 */
function regionMatches(hint: string, region: string): boolean {
  return words(hint).trim() !== '' && words(region).trim() === words(hint).trim();
}
/** A country's name as compared: folded words, without a leading "the" (The Netherlands, The Gambia). */
const countryKey = (text: string) => words(text).trim().replace(/^the /u, '');
/**
 * Other names people give for a country in the index, each to the index's own name. A country is matched only by its
 * whole name or one of these, never by part of a name: Samoa is not American Samoa, Guinea is not Papua New Guinea,
 * Equatorial Guinea or Guinea-Bissau, Niger is not Nigeria, Dominica is not the Dominican Republic and Sudan is not
 * South Sudan. Korea reads as South Korea; a place only in North Korea then comes back as a suggestion, not the answer.
 * Written as people spell them; each name on both sides is folded with countryKey, the fold the typed country goes
 * through, so Côte d'Ivoire with either apostrophe, or none, and U.S.A. with or without its full stops read alike.
 */
export const COUNTRY_ALIASES: Readonly<Record<string, string>> = foldedAliases({
  UK: 'United Kingdom', 'U.K.': 'United Kingdom', Britain: 'United Kingdom', 'Great Britain': 'United Kingdom',
  US: 'United States', 'U.S.': 'United States', USA: 'United States', 'U.S.A.': 'United States', America: 'United States', 'United States of America': 'United States',
  'US Virgin Islands': 'U.S. Virgin Islands',
  UAE: 'United Arab Emirates', 'U.A.E.': 'United Arab Emirates',
  Holland: 'Netherlands',
  Korea: 'South Korea', 'Republic of Korea': 'South Korea', DPRK: 'North Korea',
  'Czech Republic': 'Czechia', Burma: 'Myanmar', Swaziland: 'Eswatini', Macedonia: 'North Macedonia',
  'Cape Verde': 'Cabo Verde', "Côte d'Ivoire": 'Ivory Coast', 'Côte d Ivoire': 'Ivory Coast', 'East Timor': 'Timor-Leste', 'Russian Federation': 'Russia',
  'Viet Nam': 'Vietnam', Macau: 'Macao', Türkiye: 'Turkey', Palestine: 'Palestinian Territory', 'Vatican City': 'Vatican', 'Holy See': 'Vatican',
  DRC: 'Democratic Republic of the Congo', 'DR Congo': 'Democratic Republic of the Congo', 'D.R. Congo': 'Democratic Republic of the Congo',
  'Congo-Kinshasa': 'Democratic Republic of the Congo', 'Congo-Brazzaville': 'Republic of the Congo',
});
/** The aliases keyed and valued by countryKey; two spellings that fold alike must name the same country. */
function foldedAliases(aliases: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  // No prototype, so a typed country such as Constructor is never read as an alias.
  const folded: Record<string, string> = Object.create(null);
  for (const [alias, country] of Object.entries(aliases)) {
    const key = countryKey(alias);
    if (key in folded && folded[key] !== countryKey(country)) throw new Error(`Country alias ${alias} folds to a key that names another country`);
    folded[key] = countryKey(country);
  }
  return folded;
}
const countryWanted = (hint: string) => COUNTRY_ALIASES[countryKey(hint)] ?? countryKey(hint);
/** The hint is the place's country by its whole name or a known other name for it (COUNTRY_ALIASES). */
export function countryNameMatches(country: string, hint: string): boolean {
  const wanted = countryWanted(hint);
  return wanted !== '' && countryKey(country) === wanted;
}
/** The hint is the place's country; a region name such as Scotland must be the place's region instead. */
function countryHintMatches(hint: string, region: string, country: string): boolean {
  return isRegionName(hint) ? regionMatches(hint, region) : countryNameMatches(country, hint);
}
/**
 * One part after the name: the region or the country. Several: each a region, and the last the country. A region is
 * read only by its whole name (regionMatches), so a single part that is also a country's name (Atlanta, Georgia) reads
 * as that region, and Niger is not Niger State in Nigeria and Ireland is not Northern Ireland.
 */
function hintsMatch(hints: readonly string[], region: string, country: string): boolean {
  if (hints.length === 1) {
    const [hint] = hints;
    return regionMatches(hint, region) || countryHintMatches(hint, region, country);
  }
  return hints.every((hint, index) => (index === hints.length - 1 ? countryHintMatches(hint, region, country) : regionMatches(hint, region)));
}

/** How a place's name meets the name asked for: whole, then with whole words added, then a longer word, then containing it. */
const Fit = { Whole: 0, Words: 1, Longer: 2, Contains: 3 } as const;
type Fit = (typeof Fit)[keyof typeof Fit];
function fitOf(names: readonly string[], query: string): Fit | null {
  let best: Fit | null = null;
  for (const name of names) {
    let fit: Fit | null = null;
    if (name === query) fit = Fit.Whole;
    else if (name.startsWith(query)) fit = /[\p{L}\p{N}]/u.test(name[query.length] ?? '') ? Fit.Longer : Fit.Words;
    else if (query[2] && name[0] === query[0] && name.includes(query)) fit = Fit.Contains;
    if (fit !== null && (best === null || fit < best)) best = fit;
  }
  return best;
}

/** Below this share of the largest place's population, a place sharing the whole name is not asked about when no region or country is given. */
const MINOR_SHARE = 0.1;
export const ACG_CHOICES = 5;

function toPlace(table: PlaceTable, row: Row): AcgPlace {
  const point = rowPoint(table.index, row);
  return { id: placeId(point), name: point.name, region: point.admin1, country: point.country, latitude: point.lat, longitude: point.lon };
}

const byId = new WeakMap<PlaceTable, Map<string, Row>>();
/** The place an id from placeId names, or null. */
export function placeById(table: PlaceTable, id: string): AcgPlace | null {
  let rows = byId.get(table);
  if (!rows) {
    rows = new Map();
    for (const shard of Object.values(table.shards)) for (const row of shard) rows.set(placeId(rowPoint(table.index, row)), row);
    byId.set(table, rows);
  }
  const row = rows.get(id.trim());
  return row ? toPlace(table, row) : null;
}

/**
 * The one town or city a name asks for, or the places it could be when the index cannot tell. A place whose whole
 * name is the one asked for comes first: Aparecida, Brazil is Aparecida, not Aparecida de Goiânia, and Kerman, Iran
 * is Kerman, not Kermanshah. Several places with that whole name in the region or country given (Belmont, United
 * States) are choices to ask about, not a guess; with no region or country given, the largest is read when every
 * other is under a tenth of its size (London is London, England) and no longer name that adds whole words to it is
 * larger (Mexico asks between Mexico City and Mexico, Philippines). With no whole-name match, a single place whose
 * name adds whole words (New York City, Nara-shi) is read; several are choices. A region or country given is never
 * overridden: when no place with the name is there (London, Scotland or Cardiff, England), the places with the name
 * elsewhere come back as suggestions to ask about, never as the answer (Charleston, Virginia is not Charleston, West
 * Virginia). A whole label or id an answer lists is read first, as the place it was listed for, and a name in the
 * index with a comma in it (Mianzhu, Deyang, Sichuan) is never split at its commas. Null when nothing matches the name.
 */
export function resolvePlace(table: PlaceTable, text: string): { place: AcgPlace } | { choices: AcgPlace[] } | { suggestions: AcgPlace[] } | null {
  // A label or id an answer listed reads back as its place, before the text is split at its commas.
  const labelled = placeByLabel(table, text);
  if (labelled) return labelled;
  const { place, hints } = splitCity(text, labelIndex(table).joined);
  const named = new Map<Row, Fit>();
  for (const query of queryVariants(place)) {
    const key = shardKey(query);
    for (const row of queryRows(table.index, table.shards[key] ?? [], key)) {
      const fit = fitOf(row[1] === 0 ? [fold(row[0])] : [fold(row[0]), fold(row[1])], query);
      if (fit === null) continue;
      const known = named.get(row);
      if (known === undefined || fit < known) named.set(row, fit);
    }
  }
  const found = new Map([...named].filter(([row]) => hintsMatch(hints, table.index.admin1[row[2]] ?? '', table.index.countries[row[3]] ?? '')));
  // Each fit's places, largest first.
  const rows = (from: Map<Row, Fit>, fit: Fit) => [...from].filter(([, value]) => value === fit).map(([row]) => row).sort((a, b) => b[7] - a[7]);
  const best = (from: Map<Row, Fit>) => {
    for (const fit of [Fit.Whole, Fit.Words, Fit.Longer, Fit.Contains]) {
      const list = rows(from, fit);
      if (list.length) return list;
    }
    return [];
  };
  if (!found.size) {
    const elsewhere = best(named);
    return elsewhere.length ? { suggestions: elsewhere.slice(0, ACG_CHOICES).map((row) => toPlace(table, row)) } : null;
  }
  const choose = (list: Row[]) => (list.length === 1 ? { place: toPlace(table, list[0]) } : { choices: list.slice(0, ACG_CHOICES).map((row) => toPlace(table, row)) });
  const whole = rows(found, Fit.Whole);
  if (whole.length) {
    if (hints.length) return choose(whole);
    const [largest, next] = whole;
    if (next && next[7] >= largest[7] * MINOR_SHARE) return choose(whole);
    const larger = rows(found, Fit.Words).filter((row) => row[7] > largest[7]);
    return larger.length ? choose([...larger, largest]) : choose([largest]);
  }
  const inPlace = best(found);
  // Only a longer name in the region or country given, and the whole name elsewhere (Juba, Sudan: Jubayt is in Sudan,
  // Juba in South Sudan): suggestions to ask about, the whole name first, never the longer name as the answer.
  const wholeElsewhere = rows(named, Fit.Whole).filter((row) => !found.has(row));
  if (wholeElsewhere.length && found.get(inPlace[0])! > Fit.Words) return { suggestions: [...wholeElsewhere, ...inPlace].slice(0, ACG_CHOICES).map((row) => toPlace(table, row)) };
  return choose(inPlace);
}

/** "Belmont, California, United States": a choice written as the cities input reads it. */
export function placeLabel(place: Pick<AcgPlace, 'name' | 'region' | 'country'>): string {
  return placeLabelText({ name: place.name, admin1: place.region, country: place.country });
}

/** Choices as the answer lists them: each with its id, and a label that tells it apart from the others (distinctPlaceLabels). */
function choiceList(places: readonly AcgPlace[]): AstrocartographyData['ambiguous'][number]['places'] {
  const labels = distinctPlaceLabels(places.map((place) => ({ name: place.name, admin1: place.region, country: place.country, lat: place.latitude, lon: place.longitude })));
  return places.map((place, index) => ({ id: place.id, name: place.name, region: place.region, country: place.country, label: labels[index] }));
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
  const ambiguous: AstrocartographyData['ambiguous'] = [];
  const limits: string[] = [
    'Lines move about 1 degree of longitude (about 110 km at the equator) for every 4 minutes of birth time, so a birth time 15 minutes out moves every line by about 400 km.',
    `Astrocartographers mostly work within about ${STRONG_KM} km of a line and treat it as fading by about ${NOTICEABLE_KM} km.`,
  ];
  const clockChange = clockChangeLimit(natal.flags, natal.jumpMinutes);
  if (clockChange) limits.push(clockChange);
  if (under18) limits.push(MINOR_NOTE);
  const asked = args.cities ?? [];
  const ids = args.placeIds ?? [];
  const didYouMean: AstrocartographyData['didYouMean'] = [];
  const readPlace = (text: string, place: AcgPlace) => {
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
    cities.push({ asked: text, id: place.id, name: place.name, region: place.region, country: place.country, latitude: roundCoordinate(place.latitude), longitude: roundCoordinate(place.longitude), closest, summary });
  };
  if (asked.length || ids.length) {
    if (!context.placeTable) throw new RangeError('Town and city lookup is not offered here; leave out cities for the lines alone.');
    const table = await context.placeTable();
    // An id names one place exactly; one the index does not have is refused rather than skipped, without repeating it.
    const byIds = ids.map((id) => {
      const place = placeById(table, id);
      if (!place) throw new RangeError('A place id is not in the index. Use an id from ambiguous or didYouMean, or name the place in cities.');
      return [id, place] as const;
    });
    for (const text of asked) {
      const resolved = resolvePlace(table, text);
      if (!resolved) unmatched.push(text);
      else if ('choices' in resolved) ambiguous.push({ asked: text, places: choiceList(resolved.choices) });
      else if ('suggestions' in resolved) didYouMean.push({ asked: text, places: choiceList(resolved.suggestions) });
      else readPlace(text, resolved.place);
    }
    for (const [id, place] of byIds) readPlace(id, place);
    for (const entry of ambiguous) {
      const labels = entry.places.map((place) => place.label).join('; ');
      // Places that share a name, region and country cannot be told apart by name: only the id chooses one.
      const shared = entry.places.some((place) => place.label !== placeLabel(place));
      limits.push(shared
        ? `More than one town or city matches ${entry.asked}: ${labels}. Some share a name, region and country, so choose one by its id in placeIds.`
        : `More than one town or city matches ${entry.asked}: ${labels}. Add the region or country after a comma to choose one, such as ${entry.places[0].label}.`);
    }
    for (const entry of didYouMean) limits.push(`No town or city in the index matches ${entry.asked}. Did you mean ${entry.places.map((place) => place.label).join('; ')}? Ask which one is meant, then give its id in placeIds.`);
    if (unmatched.length) limits.push(`Some names matched no town or city of 15,000 people or more in the index: ${unmatched.join(', ')}. Try another spelling, or add the country after a comma.`);
  }
  return {
    data: {
      birthDate: args.birthDate, instantUtc: utc.toISOString(), siderealTimeDegrees: Math.round(gast * 10_000) / 10_000,
      lines, cities, unmatched, ambiguous, didYouMean,
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
  description: "Gives the person's astrocartography: the lines on the world map where each planet, Sun to Pluto, was rising, setting, overhead or underfoot at the moment of birth, and, for up to five towns or cities they name, the closest lines with their distance and what each is traditionally read as for that place (love, work, home and how they feel there). Use it for astrocartography, astro map, relocation lines, where I should live or travel, or what a city means for me, once the person has given a birth date, time and time zone. Zodiacs is not directed at children under 13: check the birth date first, and ask for no birth time or birthplace when it is less than 13 years ago, since the tool refuses that date. A birth time is required, because the lines move about 1 degree of longitude for every 4 minutes; never guess one. When they name the birthplace as a town or city, use find_birthplace first for its time zone. Name the cities to check in cities. A name that matches more than one place comes back under ambiguous with the places it could be; ask the person which one they mean. A name with a region or country that no place of that name is in comes back under didYouMean; ask which one is meant. To check a place listed under ambiguous or didYouMean, give its id in placeIds. Share the readings plainly as astrology's reading, with the reading-confidence label; for a full map, give the returned page link, where the map is drawn in their own browser. Each line near a place has a shareUrl to a card of that line alone (no birth details or place); give it exactly as returned.",
  input: astrocartographyInput,
  data: astrocartographyData,
  // The readings change on the eighteenth birthday, so a repeat call can differ as the server's clock moves.
  clockDependent: true,
  pageFlag: 'PUBLIC_ASTROCARTOGRAPHY_ENABLED',
  example: { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', latitude: 51.51, longitude: -0.13, cities: ['Lisbon', 'New York', 'Tokyo'] },
  run: (args, context) => getAstrocartography(args, context),
});
