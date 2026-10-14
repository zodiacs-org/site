/**
 * resolve_birth_time and search_places.
 *
 * resolve_birth_time runs the hosted compute API's time endpoint: over a
 * seeded corpus each result is the body the compute API's own handler answers
 * for the same JSON, except for `cite.url`, and each refusal is the handler's
 * own sentence. search_places runs the site's birthplace search over the same
 * index the calculators fetch: each answer lists the places the site's search
 * lists for the same query. Every result is held to the output schema a host
 * reads, in zod and as the JSON Schema `tools/list` advertises, and the time
 * results to the compute API's OpenAPI response schema.
 *
 * Every date, time and place here is seeded or synthetic; the place names are
 * the index's own.
 */
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { TZDB } from '@zodiacs/engine/geo';
import atlasPlaces from '../data/time-atlas/places.json';
import { ATLAS_PLACE_IDS, ATLAS_VERSION, ATLAS_WINDOW } from '../lib/time-atlas/places';
import { createComputeApiHandler } from '../lib/compute-api/handler';
import * as localTime from '../lib/compute-api/local-time-source';
import { COMPUTE_COMPONENTS, responseComponentName } from '../lib/compute-api/openapi';
import { run } from '../../scripts/lib/compute-api-harness';
import { COMPUTE_TOOLS, toolUrl } from './cite';
import { createServer } from './create-server';
import { PLACES_OUTPUT, TIME_OUTPUT } from './outputs';
import { PLACE_SHARDS, PLACES_DEFAULT, PLACES_MAX, PLACES_SOURCE, searchPlaces } from './places';
import { PINNED_TZDB_RELEASE } from './bounds';
import { resolveBirthTime } from './time-tools';
import { describeCapabilities, describeLocalChartCapabilities, type ToolOutcome } from './tools';

/** mulberry32: a small seeded generator, so the corpus is the same on every run. */
function generator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0');
const pick = <T,>(random: () => number, items: readonly T[]): T => items[Math.floor(random() * items.length)];
const DAY = 86_400_000;

const handler = createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' });
const hosted = async (body: unknown) => run(handler, { endpoint: 'time', body });

const value = (outcome: ToolOutcome) => {
  if (!outcome.ok) throw new Error(`refused: ${outcome.refusal}`);
  return outcome.value as Record<string, any>;
};

const ZONES = [
  'Europe/Paris', 'America/New_York', 'Asia/Kolkata', 'Europe/Moscow', 'Europe/Stockholm', 'Australia/Sydney',
  'America/Sao_Paulo', 'Africa/Lagos', 'Asia/Tokyo', 'America/St_Johns', 'Asia/Kathmandu', 'Pacific/Chatham',
  'Europe/Athens', 'America/Mexico_City', 'Asia/Shanghai', 'Europe/London', 'UTC', 'Antarctica/Troll',
] as const;
const COUNTRIES = ['RU', 'GR', 'JP', 'FR', 'TR', 'ZZ'] as const;

/** Synthetic local times: every zone above, dates across the accepted years, some Julian, some with a country. */
function timeCorpus() {
  const random = generator(20261012);
  const cases: Array<Record<string, unknown>> = [];
  for (let index = 0; index < 96; index += 1) {
    const julian = index % 6 === 0;
    const first = Date.UTC(1800, 0, 1);
    const last = julian ? Date.UTC(1923, 11, 31) : Date.UTC(2199, 11, 31);
    const day = new Date(first + Math.floor(random() * ((last - first) / DAY)) * DAY).toISOString().slice(0, 10);
    // A Julian date written as the Gregorian one before it: always a real Julian date.
    const date = julian && day.endsWith('-02-29') ? day.replace('-29', '-28') : day;
    const body: Record<string, unknown> = {
      local: { date, time: `${pad(Math.floor(random() * 24))}:${pad(Math.floor(random() * 60))}`, zone: pick(random, ZONES) },
    };
    if (random() < 0.5) body.longitude = Math.round((random() * 360 - 180) * 100) / 100;
    if (julian) body.calendar = 'julian';
    if (random() < 0.3) body.country = pick(random, COUNTRIES);
    cases.push(body);
  }
  return [
    ...cases,
    // A skipped time, a repeated one, a disputed history, a place's own mean time, and the calendar notes.
    { local: { date: '2026-03-29', time: '02:30', zone: 'Europe/Paris' } },
    { local: { date: '2026-10-25', time: '02:30', zone: 'Europe/Paris' } },
    { local: { date: '1947-07-01', time: '12:00', zone: 'Europe/Stockholm' }, longitude: 18.07 },
    { local: { date: '1890-06-01', time: '12:00', zone: 'Europe/Paris' }, longitude: -4.49 },
    { local: { date: '1917-10-25', time: '12:00', zone: 'Europe/Moscow' }, calendar: 'julian', country: 'RU' },
    { local: { date: '1917-10-25', time: '12:00', zone: 'Europe/Moscow' }, country: 'RU' },
    { local: { date: '1918-02-14', time: '12:00', zone: 'Europe/Moscow' }, calendar: 'julian', country: 'RU' },
    { local: { date: '1850-01-01', time: '12:00', zone: 'Asia/Tokyo' }, country: 'JP' },
    // A zone name in another letter case is answered in its tzdb spelling.
    { local: { date: '1990-06-15', time: '14:30', zone: 'europe/paris' } },
    // The time atlas's places, each at a seeded wall time from 1869 to 1921, and its changes.
    ...atlasCorpus(),
    { local: { date: '1916-06-14', time: '23:00', zone: 'Europe/Paris' }, atlasPlace: 'fr-paris' },
    { local: { date: '1911-03-10', time: '23:51', zone: 'Europe/Paris' }, atlasPlace: 'fr-paris' },
    { local: { date: '1883-11-18', time: '12:00', zone: 'America/New_York' }, atlasPlace: 'us-new-york' },
    { local: { date: '1918-03-31', time: '02:00', zone: 'America/New_York' }, atlasPlace: 'us-new-york' },
  ];
}

/** Each atlas place, with its zone and longitude, at a seeded wall time from 1869 to 1921. */
function atlasCorpus() {
  const random = generator(1870);
  const first = Date.UTC(1869, 0, 1);
  const last = Date.UTC(1921, 11, 31);
  return atlasPlaces.places.map(({ id, tzdbZone, longitude }: { id: string; tzdbZone: string; longitude: number }) => {
    const date = new Date(first + Math.floor(random() * ((last - first) / DAY)) * DAY).toISOString().slice(0, 10);
    const time = `${pad(Math.floor(random() * 24))}:${pad(Math.floor(random() * 60))}`;
    return { local: { date, time, zone: tzdbZone }, longitude: Math.round(longitude * 100) / 100, atlasPlace: id };
  });
}

const corpus = await Promise.all(timeCorpus().map(async (args) => ({ args, value: value(await resolveBirthTime(args as any)) })));

describe('resolve_birth_time is the compute API\'s time endpoint', () => {
  it("returns, for every request of the corpus, the body the compute API's handler answers, with the tool's cite", async () => {
    expect(corpus).toHaveLength(130);
    for (const { args, value: result } of corpus) {
      const response = await hosted(args);
      expect(response.status, JSON.stringify(args)).toBe(200);
      const { cite: hostedCite, ...hostedRest } = response.json;
      const { cite, ...rest } = result;
      expect(rest).toEqual(hostedRest);
      expect(cite).toEqual({ ...hostedCite, url: toolUrl('resolve_birth_time') });
    }
  }, 120_000);

  it('reaches every flag, both zone histories and every calendar note', () => {
    const flags = new Set(corpus.flatMap(({ value: result }) => result.result.flags));
    for (const flag of ['dst-gap', 'dst-fold', 'lmt', 'zone-history-disputed']) expect(flags).toContain(flag);
    expect(new Set(corpus.map(({ value: result }) => result.result.zoneHistory))).toEqual(new Set(['pinned', 'runtime']));
    const notes = new Set(corpus.map(({ value: result }) => result.result.calendarNote));
    for (const note of ['old-style', 'new-style', 'other-calendar', null]) expect(notes).toContain(note);
    expect(corpus.some(({ value: result }) => result.result.zoneUncertain)).toBe(true);
    expect(corpus.filter(({ value: result }) => result.result.calendar === 'julian').length).toBeGreaterThan(10);
    expect(corpus.at(-1)!.value.receipt.endpoint).toBe('time');
    // The atlas: every place, and every status it has for a wall time in or out of its window.
    const atlas = corpus.map(({ value: result }) => result.result.atlas).filter(Boolean);
    expect(new Set(atlas.map((reading: { place: string }) => reading.place)).size).toBe(21);
    expect(new Set(atlas.map((reading: { status: string }) => reading.status))).toEqual(new Set(['ok', 'ambiguous', 'nonexistent', 'out-of-coverage']));
    expect(atlas.some((reading: { secondsFromTzdb: number | null }) => reading.secondsFromTzdb === 0)).toBe(true);
    expect(atlas.some((reading: { secondsFromTzdb: number | null }) => Math.abs(reading.secondsFromTzdb ?? 0) >= 60)).toBe(true);
  });

  it('refuses what the compute API refuses, in the same words', async () => {
    const refused = [
      { local: { date: '1924-01-01', time: '12:00', zone: 'Europe/Moscow' }, calendar: 'julian' },
      { local: { date: '1900-02-29', time: '12:00', zone: 'Europe/Moscow' } },
      { local: { date: '2000-01-01', time: '24:00', zone: 'Europe/Moscow' } },
      { local: { date: '2000-01-01', time: '12:00', zone: 'Mars/Olympus_Mons' } },
      { local: { date: '2000-01-01', time: '12:00', zone: 'Europe/Moscow' }, country: 'ru' },
      { local: { date: '2000-01-01', time: '12:00', zone: 'Europe/Moscow' }, longitude: 181 },
    ];
    for (const args of refused) {
      const outcome = await resolveBirthTime(args as any);
      expect(outcome.ok, JSON.stringify(args)).toBe(false);
      const { error } = (await hosted(args)).json;
      expect(outcome.ok ? '' : outcome.refusal).toBe(`${error.pointer}: ${error.message}`);
    }
  });

  it("refuses an atlas place outside the request's zone, or with another town's longitude or another country, in the compute API's words", async () => {
    for (const [args, pointer] of [
      [{ local: { date: '1900-06-01', time: '12:00', zone: 'Europe/Paris' }, atlasPlace: 'us-new-york' }, '/atlasPlace'],
      [{ local: { date: '1880-06-01', time: '12:00', zone: 'Europe/Paris' }, longitude: 2.35, atlasPlace: 'fr-brest' }, '/longitude'],
      [{ local: { date: '1917-06-01', time: '12:00', zone: 'Europe/Paris' }, country: 'RU', atlasPlace: 'fr-paris' }, '/country'],
    ] as const) {
      const outcome = await resolveBirthTime(args as any);
      const { error } = (await hosted(args)).json;
      expect(error.pointer).toBe(pointer);
      expect(outcome.ok ? '' : outcome.refusal).toBe(`${error.pointer}: ${error.message}`);
    }
  });

  it("holds every result to its output schema, to the JSON Schema a host reads, and to the compute API's OpenAPI response", async () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const OPENAPI_ID = 'https://zodiacs.org/api/v1/openapi.json';
    ajv.addSchema({ $id: OPENAPI_ID, components: { schemas: COMPUTE_COMPONENTS } });
    const listed = await listedTools();
    const advertised = ajv.compile(listed.find(({ name }) => name === 'resolve_birth_time')!.outputSchema as object);
    const openapi = ajv.getSchema(`${OPENAPI_ID}#/components/schemas/${responseComponentName(COMPUTE_TOOLS.resolve_birth_time)}`)!;
    for (const { value: result } of corpus) {
      expect(() => TIME_OUTPUT.parse(result)).not.toThrow();
      expect(advertised(result), ajv.errorsText(advertised.errors)).toBe(true);
      expect(openapi(result), ajv.errorsText(openapi.errors)).toBe(true);
    }
    expect(TIME_OUTPUT.safeParse({ ...corpus[0].value, extra: 1 }).success).toBe(false);
  });
});

/** The site's own search, reading the index files the calculators fetch. */
async function siteSearch() {
  vi.resetModules();
  vi.stubGlobal('fetch', async (url: string) => {
    const name = /^\/data\/cities\/([0-9a-z]+|index)\.json$/u.exec(url)?.[1];
    if (!name) throw new Error(`unexpected fetch ${url}`);
    const text = readFileSync(new URL(`../../public/data/cities/${name}.json`, import.meta.url), 'utf8');
    return { ok: true, json: async () => JSON.parse(text) };
  });
  return (await import('../lib/geo/search')).searchCities;
}

afterEach(() => { vi.unstubAllGlobals(); });

const index = JSON.parse(readFileSync(new URL('../../public/data/cities/index.json', import.meta.url), 'utf8'));

describe('search_places is the site\'s birthplace search', () => {
  it('carries every shard of the index the calculators fetch, row for row', () => {
    expect(Object.keys(PLACE_SHARDS).sort()).toEqual([...index.shards].sort());
    let rows = 0;
    for (const key of index.shards) {
      const file = JSON.parse(readFileSync(new URL(`../../public/data/cities/${key}.json`, import.meta.url), 'utf8'));
      expect(PLACE_SHARDS[key]).toEqual(file);
      for (const row of PLACE_SHARDS[key]) {
        expect(row).toHaveLength(8);
        expect(typeof row[0] === 'string' && (row[1] === 0 || typeof row[1] === 'string')).toBe(true);
        expect(row.slice(2).every((field) => Number.isInteger(field))).toBe(true);
      }
      rows += PLACE_SHARDS[key].length;
    }
    expect(rows).toBe(index.count);
    expect(PLACES_SOURCE.rows).toBe(index.count);
    expect(index.source).toBe(`${PLACES_SOURCE.source} (${PLACES_SOURCE.licence})`);
  });

  it('lists, for every query, the places the site lists, in the same order', async () => {
    const searchCities = await siteSearch();
    const random = generator(7);
    const queries = ['Paris', 'par', 'PAR', 'são', 'sao paulo', 'new y', 'Zürich', 'Zurich', 'zu', 'ab', 'x', '  ', '12', 'Saint-', 'los', 'ko', 'Dong', 'Ibri', "'s-Her", 'arkhangelsk'];
    for (let n = 0; n < 60; n += 1) {
      const key = pick(random, index.shards as string[]);
      const row = pick(random, PLACE_SHARDS[key]);
      const name = row[1] === 0 ? row[0] : row[1];
      queries.push(name.slice(0, 2 + Math.floor(random() * Math.max(1, name.length - 1))));
    }
    for (const query of queries) {
      for (const limit of [undefined, 1, PLACES_MAX]) {
        const site = await searchCities(query, limit ?? PLACES_DEFAULT);
        const tool = value(searchPlaces(limit === undefined ? { query } : { query, limit }));
        expect(tool.places, `${query} ${limit}`).toEqual(site.map((city) => ({
          name: city.name, admin1: city.admin1, country: city.country,
          latitude: city.lat, longitude: city.lon, timeZone: city.tz, population: city.pop,
        })));
      }
    }
    expect(value(searchPlaces({ query: 'Paris' })).places[0]).toMatchObject({ name: 'Paris', country: 'France', timeZone: 'Europe/Paris' });
    // A place is found by its GeoNames name or its ASCII spelling, with or without accents and apostrophes,
    // including the names the index files under another letter than the one they begin with.
    for (const [query, name, country] of [
      ['Łódź', 'Łódź', 'Poland'], ['Zürich', 'Zürich', 'Switzerland'], ['Zurich', 'Zürich', 'Switzerland'], ['Zuerich', 'Zürich', 'Switzerland'],
      ['Düsseldorf', 'Düsseldorf', 'Germany'], ['Dusseldorf', 'Düsseldorf', 'Germany'], ['Đồng Hới', 'Đồng Hới', 'Vietnam'],
      ['Dong Hoi', 'Đồng Hới', 'Vietnam'], ['Əhmədbəyli', 'Əhmədbəyli', 'Azerbaijan'], ['Arkhangelsk', 'Arkhangel’sk', 'Russia'], ['Ibri', '‘Ibrī', 'Oman'],
    ]) expect(value(searchPlaces({ query })).places[0], query).toMatchObject({ name, country });
    expect(value(searchPlaces({ query: 'a' })).places).toEqual([]);
  });

  it('holds every result to its output schema and to the JSON Schema a host reads, and cites the index, not the query', async () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const listed = await listedTools();
    const advertised = ajv.compile(listed.find(({ name }) => name === 'search_places')!.outputSchema as object);
    const results = ['Paris', 'tok', 'x', 'saint'].map((query) => value(searchPlaces({ query, limit: PLACES_MAX })));
    for (const result of results) {
      expect(() => PLACES_OUTPUT.parse(result)).not.toThrow();
      expect(advertised(result), ajv.errorsText(advertised.errors)).toBe(true);
      expect(result.receipt).toEqual(results[0].receipt);
      expect(result.cite).toEqual(results[0].cite);
      expect(JSON.stringify(result.receipt)).not.toMatch(/paris|tok|saint/iu);
    }
    expect(results[0].cite.url).toBe(toolUrl('search_places'));
  });
});

async function listedTools() {
  const server = createServer(() => undefined);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'zodiacs-time-places-test', version: '1.0.0' });
  await client.connect(clientSide);
  return (await client.listTools()).tools;
}

describe('the two tools in get_capabilities and tools/list', () => {
  it('names the resolver, the pinned release, the calendars and the place index', () => {
    const { time, places } = value(describeCapabilities());
    expect(time).toEqual({
      tool: 'resolve_birth_time',
      sameAs: expect.stringContaining('POST https://zodiacs.org/api/v1/time'),
      resolver: '@zodiacs/engine/geo',
      pinnedTzdb: { release: TZDB.version, appliesBefore: '1970-01-02' },
      calendars: ['gregorian', 'julian'],
      julianLastWritten: '1923-12-31',
      atlas: { version: ATLAS_VERSION, licence: 'CC BY 4.0', window: { ...ATLAS_WINDOW }, places: [...ATLAS_PLACE_IDS] },
    });
    expect(places).toMatchObject({ tool: 'search_places', ...PLACES_SOURCE, maxResults: PLACES_MAX });
    expect(PINNED_TZDB_RELEASE).toBe(TZDB.version);
  });

  it("leaves the sky, time and place tools' sections and limits out of the chart tools' capabilities", () => {
    const full = value(describeCapabilities());
    const local = value(describeLocalChartCapabilities());
    expect(Object.keys(local).sort()).toEqual(Object.keys(full).filter((key) => !['sky', 'time', 'places'].includes(key)).sort());
    expect(local.unsupported).toHaveLength(full.unsupported.length - 2);
    expect(JSON.stringify(local.unsupported)).not.toMatch(/find_events|search_places|resolve_birth_time/u);
    expect(local.engine).toEqual(full.engine);
    expect(full.privacy.citation.startsWith(local.privacy.citation)).toBe(true);
    expect(local.privacy.citation).not.toMatch(/get_positions|search_places|resolve_birth_time/u);
  });

  it('describes both in the methodology resource', async () => {
    const { methodology, RESOURCES } = await import('./resources');
    const text = methodology();
    expect(text).toContain('## Local times and places');
    expect(text).toContain('`resolve_birth_time` runs the compute API\'s time endpoint');
    expect(text).toContain('`search_places` searches GeoNames cities15000');
    expect(RESOURCES.find(({ name }) => name === 'methodology')!.description).toMatch(/local times and places/);
  });

  it('marks both read-only and closed-world, with an output schema', async () => {
    const listed = await listedTools();
    for (const name of ['resolve_birth_time', 'search_places']) {
      const tool = listed.find((entry) => entry.name === name)!;
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true });
      expect(tool.outputSchema).toBeTruthy();
    }
  });
});
