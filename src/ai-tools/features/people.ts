/**
 * Famous-people tools for the Zodiacs AI integrations: find_chart_twins
 * (directory people who share your Sun and/or Moon sign) and
 * get_famous_chart (a directory person's date-sourced chart by name).
 *
 * Reads only people-index.json, the compact extract that
 * scripts/build-ai-people.mjs writes from src/data/people.json with the
 * site's own directory rule; the runtime never loads the full release.
 * Pure: no network, storage or logging. Local time comes in as a dependency,
 * as for get_life_milestones.
 */
import { z } from 'zod';
import { SIGN_SLUGS } from '../../lib/compute-api/constants';
import type { LocalTimeModule } from '../../lib/compute-api/local-time';
import { zoneAt } from '../../lib/compute-api/validate';
import { computeChart } from '../../lib/engine/full.js';
import type { ChartInput } from '../../lib/engine/types';
import { validOccasionDate } from '../../lib/occasions/card';
import { matchTwins, twinSigns, type TwinPerson } from '../../lib/sharing/twins';
import rawIndex from './people-index.json';

const DEFAULT_ORIGIN = 'https://zodiacs.org';
const MAX_TWINS = 12;
const MAX_ALSO = 4;

// ---------- the index ----------

const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
const signSlug = z.enum(SIGN_SLUGS);
const indexPerson = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  name: z.string().min(1),
  shortDescription: z.string().min(1),
  born: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  gregorian: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  birthplace: z.string().min(1),
  sun: z.object({ sign: signSlug, degree: z.number() }),
  moon: z.union([z.object({ sign: signSlug, degree: z.number() }), z.object({ sign: z.null(), degree: z.null() })]),
  placements: z.array(z.object({ body: z.enum(BODIES), sign: signSlug, degree: z.number(), settled: z.boolean() })).length(10),
  lede: z.string().min(1),
  birthdayRoute: z.string().regex(/^\/birthday\/[a-z]+-\d{1,2}\/$/u),
});
export type IndexPerson = z.infer<typeof indexPerson>;
const peopleIndex = z.object({ schema: z.literal('zodiacs.ai-people-index.v1'), source: z.string(), reviewedAtUtc: z.string(), people: z.array(indexPerson) });

export const PEOPLE_INDEX: readonly IndexPerson[] = peopleIndex.parse(rawIndex).people;
const BY_SLUG = new Map(PEOPLE_INDEX.map((person) => [person.slug, person] as const));
const TWIN_DIRECTORY: readonly TwinPerson[] = PEOPLE_INDEX.map((person) => ({ slug: person.slug, name: person.name, sun: person.sun.sign, moon: person.moon.sign }));

const link = z.object({ title: z.string(), url: z.url() });
export type ToolLink = z.infer<typeof link>;
const personUrl = (origin: string, slug: string) => `${origin}/people/${slug}/`;

// ---------- find_chart_twins ----------

// The zone pattern of contracts.ts, repeated so contracts.ts can import this module without a cycle.
const zone = z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/);
export const chartTwinsInput = z.strictObject({
  birthDate: z.string().regex(/^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/).describe('The birth date, such as 1997-03-15.'),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional().describe('The birth time on the local clock, if known. Needs zone. Without it only the Sun is compared.'),
  zone: zone.optional().describe("The birthplace's time zone, such as Europe/London. Needed with a time."),
  longitude: z.number().min(-180).max(180).optional().describe("The birthplace's longitude, if known, for birth times before standard time."),
  latitude: z.number().min(-90).max(90).optional().describe("The birthplace's latitude, if known. Give it with longitude."),
}).superRefine((args, context) => {
  if (args.time !== undefined && !args.zone) context.addIssue({ code: 'custom', message: 'A birth time needs its time zone.' });
  if (args.latitude !== undefined && args.longitude === undefined) context.addIssue({ code: 'custom', message: 'Give latitude with longitude.' });
});
export type ChartTwinsArgs = z.infer<typeof chartTwinsInput>;

const SHARES = ['sun', 'moon', 'sun-and-moon'] as const;
export const TWINS_NOTES = {
  limit: 'Birth times in this directory are unknown, so we compare verified Sun and Moon signs only. Rising signs are not compared.',
  noMoon: 'Your Moon sign is unverified without a birth time, so only your Sun is compared.',
  noSun: 'Your Sun was close enough to a sign boundary on that date that its sign depends on the birth time, so nothing is compared. Add the birth time and time zone to compare.',
  none: 'No one in the directory shares these signs yet.',
} as const;

export const chartTwinsData = z.object({
  birthDate: z.string(),
  timeKnown: z.boolean(),
  you: z.object({ sun: signSlug.nullable(), moon: signSlug.nullable() }),
  twins: z.array(z.object({
    name: z.string(), slug: z.string(), shortDescription: z.string(), born: z.string(),
    shares: z.enum(SHARES), url: z.url(),
  })).max(MAX_TWINS),
  total: z.number().int().nonnegative(),
  notes: z.array(z.string()),
  pageUrl: z.url(),
});
export type ChartTwinsData = z.infer<typeof chartTwinsData>;

const DAY = 86_400_000;

/**
 * Famous people who share the person's Sun and/or Moon sign. The birth
 * instant is resolved as get_life_milestones and the site's chart-twins form
 * resolve it: a timed birth on the zone's clock (with the longitude before
 * standard time); an untimed one at local noon in the zone, else noon UTC,
 * with timeKnown false so the Moon is not compared. Invalid input throws
 * RangeError, or the compute API's error for an unknown zone.
 */
export async function findChartTwins(args: ChartTwinsArgs, localTime: LocalTimeModule, origin: string = DEFAULT_ORIGIN): Promise<{ data: ChartTwinsData; links: ToolLink[] }> {
  const input = chartTwinsInput.parse(args);
  if (!validOccasionDate(input.birthDate)) throw new RangeError('The birth date must be a real date from 1800 to 2199.');
  const timeZone = input.zone ? await zoneAt(input.zone, '/zone', (name) => localTime.canonicalZoneName(name)) : null;
  const timeKnown = input.time !== undefined;
  let utc: Date;
  let flags: ChartInput['flags'];
  if (timeZone) {
    await localTime.prepareLocalTime(input.birthDate, timeZone);
    const resolved = input.longitude !== undefined
      ? localTime.resolveLocalToUtc(input.birthDate, input.time ?? '12:00', timeZone, { longitude: input.longitude })
      : localTime.resolveLocalToUtc(input.birthDate, input.time ?? '12:00', timeZone);
    utc = resolved.utc;
    flags = resolved.flags;
  } else {
    const [year, month, day] = input.birthDate.split('-').map(Number);
    utc = new Date(Date.UTC(year, month - 1, day) + DAY / 2);
  }
  const chart = computeChart({
    utc,
    ...(input.latitude !== undefined && input.longitude !== undefined ? { latitude: input.latitude, longitude: input.longitude } : {}),
    houseSystem: 'whole',
    timeKnown,
    ...(flags ? { flags } : {}),
  });
  const signs = twinSigns(chart);
  const matches = signs.sun === null && signs.moon === null ? [] : matchTwins(signs, TWIN_DIRECTORY);
  const notes: string[] = [TWINS_NOTES.limit];
  if (signs.moon === null) notes.push(TWINS_NOTES.noMoon);
  if (signs.sun === null) notes.push(TWINS_NOTES.noSun);
  else if (matches.length === 0) notes.push(TWINS_NOTES.none);
  const data: ChartTwinsData = {
    birthDate: input.birthDate,
    timeKnown,
    you: { sun: signs.sun as ChartTwinsData['you']['sun'], moon: signs.moon as ChartTwinsData['you']['moon'] },
    twins: matches.slice(0, MAX_TWINS).map((match) => {
      const person = BY_SLUG.get(match.person.slug)!;
      return {
        name: person.name, slug: person.slug, shortDescription: person.shortDescription, born: person.born,
        shares: match.count === 2 ? 'sun-and-moon' : match.sun ? 'sun' : 'moon',
        url: personUrl(origin, person.slug),
      };
    }),
    total: matches.length,
    notes,
    pageUrl: `${origin}/chart-twins/`,
  };
  return {
    data: chartTwinsData.parse(data),
    links: [
      { title: 'Chart twins on Zodiacs', url: `${origin}/chart-twins/` },
      { title: 'Famous birth charts on Zodiacs', url: `${origin}/people/` },
    ],
  };
}

// ---------- get_famous_chart ----------

export const famousChartInput = z.strictObject({
  name: z.string().trim().min(2).max(80).describe("The person's name, such as Ada Lovelace."),
});
export type FamousChartArgs = z.infer<typeof famousChartInput>;

const lite = z.object({ name: z.string(), slug: z.string(), url: z.url() });
const placementOut = z.object({ body: z.enum(BODIES), sign: signSlug, degree: z.number(), settled: z.boolean() });
export const famousChartData = z.discriminatedUnion('found', [
  z.object({
    found: z.literal(true),
    person: z.object({
      name: z.string(), slug: z.string(), shortDescription: z.string(), born: z.string(), birthplace: z.string(),
      sun: z.object({ sign: signSlug, degree: z.number() }),
      moon: z.object({ sign: signSlug.nullable(), degree: z.number().nullable() }),
      placements: z.array(placementOut).length(10),
      lede: z.string(),
      url: z.url(),
      birthdayUrl: z.url(),
    }),
    alsoMatched: z.array(lite).max(MAX_ALSO),
    note: z.string(),
  }),
  z.object({
    found: z.literal(false),
    query: z.string(),
    suggestions: z.array(lite),
    directoryUrl: z.url(),
    note: z.string(),
  }),
]);
export type FamousChartData = z.infer<typeof famousChartData>;

/** The people page's own caption for the noon reference chart. */
export function noonChartNote(birthplace: string): string {
  return `Positions at 12:00 civil time in ${birthplace}—a reference instant, not a birth time. No houses, rising sign, angles, or sect were computed.`;
}
export const NOT_FOUND_NOTE = 'Zodiacs has no chart for this name in its famous-people directory.';

/** Lowercase, accents stripped (NFD without combining marks), punctuation to spaces. */
export function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const NORMALIZED = PEOPLE_INDEX.map((person) => {
  const full = normalizeName(person.name);
  return { person, full, tokens: full.split(' ') };
});

/** 3: the full name; 2: every query word inside the name; 1: a query word starts a name word; 0: no match. */
function score(query: string, queryTokens: string[], entry: typeof NORMALIZED[number]): number {
  if (entry.full === query) return 3;
  if (queryTokens.every((token) => entry.full.includes(token))) return 2;
  if (queryTokens.some((token) => token.length >= 2 && entry.tokens.some((word) => word.startsWith(token)))) return 1;
  return 0;
}

/** Ranked directory matches for a name; empty when none. */
export function searchPeople(name: string): IndexPerson[] {
  const query = normalizeName(name);
  if (query.length < 2) return [];
  const tokens = query.split(' ');
  return NORMALIZED
    .map((entry) => ({ entry, score: score(query, tokens, entry) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.person.name.localeCompare(b.entry.person.name, 'en') || a.entry.person.slug.localeCompare(b.entry.person.slug))
    .map((hit) => hit.entry.person);
}

/**
 * A directory person's date-sourced chart by name, or found:false when the
 * directory has nobody by that name. Never builds a chart for anyone outside
 * the index.
 */
export function getFamousChart(args: FamousChartArgs, origin: string = DEFAULT_ORIGIN): { data: FamousChartData; links: ToolLink[] } {
  const input = famousChartInput.parse(args);
  const [best, ...rest] = searchPeople(input.name);
  const directory = { title: 'Famous birth charts on Zodiacs', url: `${origin}/people/` };
  if (!best) {
    return {
      data: famousChartData.parse({ found: false, query: input.name, suggestions: [], directoryUrl: `${origin}/people/`, note: NOT_FOUND_NOTE }),
      links: [directory],
    };
  }
  const url = personUrl(origin, best.slug);
  const data: FamousChartData = {
    found: true,
    person: {
      name: best.name, slug: best.slug, shortDescription: best.shortDescription, born: best.born, birthplace: best.birthplace,
      sun: best.sun, moon: best.moon, placements: best.placements, lede: best.lede,
      url, birthdayUrl: `${origin}${best.birthdayRoute}`,
    },
    alsoMatched: rest.slice(0, MAX_ALSO).map((person) => ({ name: person.name, slug: person.slug, url: personUrl(origin, person.slug) })),
    note: noonChartNote(best.birthplace),
  };
  return { data: famousChartData.parse(data), links: [{ title: `${best.name}'s chart on Zodiacs`, url }, directory] };
}
