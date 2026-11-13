/**
 * find_birthplace: a town or city name to coordinates and an IANA time zone,
 * from the GeoNames cities15000 index the site already ships
 * (public/data/cities/, CC BY 4.0). The search reads that index in process.
 * The name is not sent anywhere, and nothing is stored or logged.
 *
 * A text with a house number that matches no town is refused as a street
 * address. Town names are searched first, so St. Louis and Temple Terrace stay
 * places, and "St", "St." and "Saint" find the same places.
 *
 * Coordinates are already stored to 0.01 degree and are rounded to two
 * decimals again on the way out. With a date, the UTC
 * offset is the one tzdb gives for noon that day in the place's zone,
 * including historical daylight saving. Without a date, the offset is for
 * today (UTC).
 */
import { z } from 'zod';
import type { LocalTimeModule } from '../../lib/compute-api/local-time';
import { fold, foldedQuery, queryRows, rankCities, shardKey, type City, type CityIndex, type Row } from '../../lib/geo/rank';
import { roundCoordinate } from '../plain-text';

const DATE = /^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/;
const LIMIT = 5;
const RANK_LIMIT = 40;
/**
 * A house number, such as 221B or 10: an address, not a town. Read only when no
 * town matches, so a town with a number in its name still resolves, and a small
 * town such as Lane Cove gets the index's own answer rather than a refusal.
 */
const HOUSE_NUMBER = /(?:^|[\s,])\d+[a-z]?(?=[\s,]|$)/iu;

const COUNTRY_ALIAS: Record<string, string> = {
  uk: 'united kingdom',
  britain: 'united kingdom',
  'great britain': 'united kingdom',
  england: 'united kingdom',
  scotland: 'united kingdom',
  wales: 'united kingdom',
  us: 'united states',
  usa: 'united states',
  america: 'united states',
  uae: 'united arab emirates',
};

export const birthplaceInput = z.strictObject({
  place: z.string().trim().min(2).max(80).describe('A town or city name, such as London or Almaty. Not a street address. Nothing is stored.'),
  country: z.string().trim().min(2).max(60).optional().describe('Optional country when several places share the name, such as United Kingdom or Kazakhstan.'),
  date: z.string().regex(DATE).optional().describe('Optional date, such as 1990-05-03 (years 1800 to 2199), for the UTC offset in force that day. Without it, the offset is for today.'),
});
export type BirthplaceInput = z.infer<typeof birthplaceInput>;

const placeRow = z.object({
  name: z.string(),
  region: z.string(),
  country: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  timeZone: z.string(),
  /** The UTC offset at noon on the date, such as +01:00. */
  offset: z.string(),
  offsetMinutes: z.number().int(),
});

export const birthplaceData = z.object({
  place: z.string(),
  country: z.string().nullable(),
  date: z.string(),
  places: z.array(placeRow).max(LIMIT),
  message: z.string().nullable(),
  source: z.object({
    name: z.literal('GeoNames cities15000'),
    licence: z.literal('CC BY 4.0'),
    note: z.string(),
  }),
});
export type BirthplaceData = z.infer<typeof birthplaceData>;

export type BirthplaceClock = Pick<LocalTimeModule, 'prepareLocalTime' | 'resolveLocalToUtc'>;

/** The place index, supplied by the host so the shared runtime does not inline it. */
export interface PlaceTable {
  index: CityIndex;
  shards: Readonly<Record<string, readonly Row[]>>;
}

function countryFold(hint: string): string {
  const folded = fold(hint.trim());
  return COUNTRY_ALIAS[folded] ?? folded;
}

/** The hint is the country's name, or whole words of it: Korea finds South Korea, and Oman never finds Romania. */
function countryMatches(country: string, hint: string): boolean {
  const words = (text: string) => ` ${text.replace(/[^a-z0-9]+/gu, ' ').trim()} `;
  const wanted = countryFold(hint);
  const name = fold(country);
  if (!words(wanted).trim()) return name === wanted;
  return words(name).includes(words(wanted)) || words(wanted).includes(words(name));
}

/** "St Louis", "St. Louis" and "Saint Louis" are one name to a person; the index writes each place one way. */
function queryVariants(place: string): string[] {
  const query = foldedQuery(place);
  if (!query) return [];
  const rest = /^(?:st\.?|saint)\s+(.+)$/u.exec(query)?.[1];
  return rest ? [...new Set([query, `st. ${rest}`, `st ${rest}`, `saint ${rest}`])] : [query];
}

/** Places for one spelling, as the site's own search ranks them; for several, the names that start with one first, each by population. */
function rankPlaces(table: PlaceTable, variants: readonly string[]): City[] {
  const rank = (query: string) => {
    const key = shardKey(query);
    return rankCities(table.index, queryRows(table.index, table.shards[key] ?? [], key), query, RANK_LIMIT);
  };
  if (variants.length <= 1) return variants.length ? rank(variants[0]) : [];
  const found = new Map<string, City>();
  for (const query of variants) for (const city of rank(query)) found.set(`${city.name}|${city.lat}|${city.lon}`, city);
  const starts = (city: City) => variants.some((query) => fold(city.name).startsWith(query));
  return [...found.values()].sort((a, b) => Number(starts(b)) - Number(starts(a)) || b.pop - a.pop).slice(0, RANK_LIMIT);
}

function offsetText(minutes: number): string {
  const rounded = Math.round(minutes);
  const sign = rounded < 0 ? '-' : '+';
  const abs = Math.abs(rounded);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function todayUtc(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function findBirthplace(
  args: BirthplaceInput,
  now: Date,
  clock: BirthplaceClock,
  table: PlaceTable,
): Promise<{ data: BirthplaceData; links: { title: string; url: string }[] }> {
  const date = args.date ?? todayUtc(now);
  if (Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new RangeError('date must be a real date from 1800 to 2199, such as 1990-05-03.');
  }
  const year = Number(date.slice(0, 4));
  if (year < 1800 || year > 2199) throw new RangeError('date must be a real date from 1800 to 2199, such as 1990-05-03.');
  const ranked = rankPlaces(table, queryVariants(args.place));
  const matched = args.country ? ranked.filter((city) => countryMatches(city.country, args.country!)) : ranked;
  if (!matched.length && HOUSE_NUMBER.test(args.place)) throw new RangeError('Give a town or city name, not a street address.');
  const chosen = matched.slice(0, LIMIT);
  const places = [];
  for (const city of chosen) {
    await clock.prepareLocalTime(date, city.tz);
    const resolved = clock.resolveLocalToUtc(date, '12:00', city.tz);
    places.push({
      name: city.name,
      region: city.admin1,
      country: city.country,
      latitude: roundCoordinate(city.lat),
      longitude: roundCoordinate(city.lon),
      timeZone: city.tz,
      offset: offsetText(resolved.offsetMinutes),
      offsetMinutes: Math.round(resolved.offsetMinutes),
    });
  }
  const message = places.length
    ? null
    : args.country
      ? 'No town or city in that country matches. Try the name on its own, or another spelling. The index lists places of 15,000 people or more.'
      : 'No town or city matches. Try another spelling. The index lists places of 15,000 people or more.';
  const data: BirthplaceData = {
    place: args.place,
    country: args.country ?? null,
    date,
    places,
    message,
    source: {
      name: 'GeoNames cities15000',
      licence: 'CC BY 4.0',
      note: 'Resolved from the place index shipped with Zodiacs. The name is not sent anywhere, and nothing is stored. Pass the latitude, longitude and time zone to a chart tool.',
    },
  };
  return {
    data,
    links: [{ title: 'Birth chart on Zodiacs', url: 'https://zodiacs.org/birth-chart/' }],
  };
}
