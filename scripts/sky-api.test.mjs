import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import { loadSkyApiSources } from '../src/lib/sky-api/sources.ts';
import { buildSkyApi } from '../src/lib/sky-api/files.ts';
import { SCHEMAS, SCHEMA_NAMES, schemaNameForFile } from '../src/lib/sky-api/schemas.ts';
import {
  LUNATION_JOIN_TOLERANCE_MS,
  buildUpcoming,
  completeTransitYears,
  joinLunationDetail,
  lunationRecords,
  normalizeWindow,
  yearsWithin,
} from '../src/lib/sky-api/build.ts';
import { PLANET_NAMES, PLANET_SLUGS } from '../src/lib/sky-api/meta.ts';
import { writeSkyApi } from './build-sky-api.mjs';

const GENERATED_AT = '2026-09-07T00:00:00.000Z';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sources = await loadSkyApiSources(repo);
const { daily, sky, months } = sources;
const build = buildSkyApi(sources, { generatedAt: GENERATED_AT });
const payload = (path) => build.payloads.get(path);
const jsonFiles = [...build.files.keys()].filter((path) => path.endsWith('.json'));
const dataFiles = jsonFiles.filter((path) => !path.startsWith('schema/') && path !== 'openapi.json');
const YEAR_FAMILIES = ['retrogrades', 'stations', 'ingresses', 'moon-phases', 'eclipses', 'aspects'];

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
for (const name of SCHEMA_NAMES) ajv.addSchema(SCHEMAS[name], SCHEMAS[name].$id);

describe('sky data API — coverage and contracts', () => {
  it('emits only years whose twelve monthly snapshots are committed, bounded by each scan horizon', () => {
    expect(completeTransitYears(['2025-11', '2025-12', '2026-01'])).toEqual([]);
    const full = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
    expect(completeTransitYears([...full, '2027-01'])).toEqual([2026]);
    expect(yearsWithin([2025, 2026, 2027], '2026-01-01T00:00:00.000Z', '2028-01-01T00:00:00.000Z')).toEqual([2026, 2027]);
    expect(build.transitYears[0]).toBe(2026);
    expect(build.skyYears.every((year) => build.transitYears.includes(year))).toBe(true);
    expect(build.eclipseYears.every((year) => build.transitYears.includes(year))).toBe(true);
  });

  it('validates every JSON payload against its published schema, including formats', () => {
    expect(dataFiles.length).toBeGreaterThan(40);
    for (const path of dataFiles) {
      const data = payload(path);
      const name = schemaNameForFile(path);
      expect(data.$schema, path).toBe(SCHEMAS[name].$id);
      expect(data.schema, path).toBe(`zodiacs.sky-api.${name}.v1`);
      const validate = ajv.getSchema(data.$schema);
      const valid = validate(data);
      expect(valid, `${path}: ${JSON.stringify(validate.errors?.slice(0, 3))}`).toBe(true);
    }
  });

  it('advertises exactly the files it writes, and the OpenAPI document covers them all', async () => {
    const index = payload('index.json');
    const advertised = [...index.endpoints.map((entry) => entry.path), ...index.documents.map((entry) => entry.path)]
      .map((path) => path.replace('/api/v1/', ''))
      .sort();
    const written = [...build.files.keys()].filter((path) => path !== 'index.json').sort();
    expect(advertised).toEqual(written);
    expect(new Set(advertised).size).toBe(advertised.length);
    for (const entry of index.endpoints) expect(entry.schema).toMatch(/^https:\/\/zodiacs\.org\/api\/v1\/schema\/[a-z-]+\.v1\.json$/);

    const openapi = JSON.parse(build.files.get('openapi.json'));
    expect(openapi.openapi).toBe('3.1.0');
    expect(openapi.info.license.name).toBe('CC BY 4.0');
    const templates = Object.keys(openapi.paths);
    for (const entry of index.endpoints) {
      const matched = templates.some((template) => {
        const pattern = new RegExp(`^${template.replace(/\{year\}/g, '\\d{4}').replace(/\{planet\}/g, '[a-z]+').replace(/\./g, '\\.')}$`);
        return pattern.test(entry.path);
      });
      expect(matched, entry.path).toBe(true);
    }
    for (const name of SCHEMA_NAMES) expect(openapi.components.schemas[name]).toBeDefined();
    // The compute operations are POST-only; the static files are GET.
    const yearParams = Object.values(openapi.paths).flatMap((item) => item.get?.parameters ?? []).filter((param) => param.name === 'year');
    expect(yearParams.length).toBe(YEAR_FAMILIES.length);

    const outputRoot = await mkdtemp(join(tmpdir(), 'sky-api-'));
    await writeSkyApi({ outputRoot, generatedAt: GENERATED_AT });
    const walk = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map((entry) => (
      entry.isDirectory() ? walk(resolve(dir, entry.name)) : [relative(resolve(outputRoot, 'api/v1'), resolve(dir, entry.name))]
    )))).flat();
    expect((await walk(resolve(outputRoot, 'api/v1'))).sort()).toEqual([...build.files.keys()].sort());
  });

  it('is deterministic, and keeps yearly files and schemas byte-stable across builds', () => {
    const again = buildSkyApi(sources, { generatedAt: GENERATED_AT });
    expect([...again.files.entries()]).toEqual([...build.files.entries()]);
    const later = buildSkyApi(sources, { generatedAt: '2026-09-08T04:00:00.000Z' });
    for (const path of build.files.keys()) {
      const yearly = YEAR_FAMILIES.some((family) => path.startsWith(`${family}/`));
      if (yearly || path.startsWith('schema/')) {
        expect(later.files.get(path), path).toBe(build.files.get(path));
      }
    }
    const strip = (data) => JSON.stringify({ ...data, generatedAt: null });
    expect(strip(later.payloads.get('sky/today.json'))).toBe(strip(payload('sky/today.json')));
  });
});

describe('sky data API — retrograde windows', () => {
  it('flags windows truncated at the scan boundary instead of presenting the boundary as a station', () => {
    const year2026 = payload('retrogrades/2026.json');
    const clipped = year2026.retrogrades.filter((window) => window.clippedStart);
    expect(clipped.map((window) => window.planet).sort()).toEqual(['Jupiter', 'Uranus']);
    for (const window of clipped) {
      expect(window.from).toBe(sky.from);
      expect(window.stationRetrograde).toBeNull();
      expect(window.stationRetrogradeSign).toBeNull();
      expect(window.durationDays).toBeNull();
      expect(window.stationDirect).toBe(window.to);
      expect(window.stationDirectSign).toMatch(/^[a-z]+$/);
      expect(window.label).toContain('before coverage begins');
    }
    for (const window of year2026.retrogrades.filter((window) => !window.clippedStart && !window.clippedEnd)) {
      expect(window.stationRetrograde).toBe(window.from);
      expect(window.stationDirect).toBe(window.to);
      expect(window.durationDays).toBeGreaterThan(0);
      expect(window.label).toMatch(/retrograde/);
    }
    const synthetic = normalizeWindow({ planet: 'Mars', from: sky.from, to: sky.stationBoundaryScanTo, preShadowStart: null, postShadowEnd: null }, sky, months);
    expect(synthetic.clippedStart && synthetic.clippedEnd).toBe(true);
    expect(synthetic.label).toContain('both stations lie outside coverage');
  });

  it('agrees with the daily snapshot about which planets are retrograde, and joins station signs', () => {
    const today = payload('sky/today.json');
    const fromWindows = new Set(today.retrogrades.map((window) => window.planet));
    const fromBodies = new Set(daily.bodies.filter((body) => body.retrograde).map((body) => body.body));
    expect(fromWindows).toEqual(fromBodies);
    for (const window of today.retrogrades) {
      expect(Date.parse(window.from)).toBeLessThanOrEqual(Date.parse(daily.snapshotAt));
      expect(Date.parse(window.to)).toBeGreaterThan(Date.parse(daily.snapshotAt));
      if (!window.clippedStart) expect(window.stationRetrogradeSign).toMatch(/^[a-z]+$/);
    }
  });
});

describe('sky data API — lunations', () => {
  it('joins sign and degree by nearest instant within the tolerance, never by calendar day', () => {
    const anchor = months.flatMap((month) => month.lunations).find((moon) => moon.type === 'full');
    const shifted = (ms) => new Date(Date.parse(anchor.at) + ms).toISOString();
    expect(joinLunationDetail({ type: 'full', at: shifted(30 * 1000) }, months)).toEqual({ sign: anchor.sign, degree: anchor.degree });
    expect(joinLunationDetail({ type: 'full', at: shifted(-(LUNATION_JOIN_TOLERANCE_MS - 1)) }, months)).toEqual({ sign: anchor.sign, degree: anchor.degree });
    expect(joinLunationDetail({ type: 'full', at: shifted(LUNATION_JOIN_TOLERANCE_MS + 60_000) }, months)).toBeNull();
    expect(joinLunationDetail({ type: 'new', at: anchor.at }, months)).not.toEqual({ sign: anchor.sign, degree: anchor.degree });
  });

  it('publishes the canonical sky.json instants with signs and traditional full-moon names', () => {
    const canonical = new Set(sky.moons.map((moon) => moon.at));
    let fulls = 0;
    let blue = 0;
    for (const year of build.skyYears) {
      for (const moon of payload(`moon-phases/${year}.json`).lunations) {
        expect(canonical.has(moon.at)).toBe(true);
        expect(moon.sign).toMatch(/^[a-z]+$/);
        expect(moon.signName).toMatch(/^[A-Z][a-z]+$/);
        if (moon.type === 'full') {
          fulls += 1;
          expect(moon.name).toBeTruthy();
          expect(moon.label).toContain('Full Moon in ');
          if (moon.name === 'Blue') blue += 1;
        } else {
          expect(moon.label).toContain('New Moon in ');
        }
      }
    }
    expect(fulls).toBeGreaterThanOrEqual(60);
    expect(blue).toBeGreaterThanOrEqual(1);
    const records = lunationRecords(sky, months);
    expect(records.map((record) => record.at)).toEqual(sky.moons.map((moon) => moon.at).sort());
  });
});

describe('sky data API — daily payloads', () => {
  it("states today's facts in the summary and formats every position", () => {
    const today = payload('sky/today.json');
    expect(today.date).toBe(daily.date);
    expect(today.snapshotAt).toBe(daily.snapshotAt);
    expect(today.summary).toContain('snapshot at 12:00 UTC');
    for (const window of today.retrogrades) expect(today.summary).toContain(window.planet);
    for (const body of today.bodies) {
      expect(body.position).toMatch(/^\d{1,2}°\d{2}′ [A-Z][a-z]+$/);
      expect(body.position.endsWith(body.signName)).toBe(true);
      expect(body.glyph).toHaveLength(1);
    }
    for (const key of ['nextFullMoon', 'nextNewMoon']) {
      const next = today.moon[key];
      expect(Date.parse(next.at)).toBeGreaterThan(Date.parse(daily.snapshotAt));
      expect(next.daysAway).toBe(Math.round((Date.parse(next.at) - Date.parse(daily.snapshotAt)) / 86_400_000 * 10) / 10);
      expect(next.sign).toMatch(/^[a-z]+$/);
    }
    expect(today.moon.nextFullMoon.name).toBeTruthy();
    expect(today.moon.illuminationPercent).toBe(Math.round(daily.moon.illumination * 100));
    expect(today.about.snapshot).toContain('12:00 UTC');
    expect(today.links.planets.mercury).toBe('https://zodiacs.org/api/v1/planets/mercury.json');
  });

  it('orders upcoming events, keeps them inside the window, and points nextByKind past it', () => {
    const upcoming = payload('sky/upcoming.json');
    const start = Date.parse(upcoming.from);
    const end = Date.parse(upcoming.to);
    let previous = start;
    for (const event of upcoming.events) {
      const at = Date.parse(event.at);
      expect(at).toBeGreaterThan(start);
      expect(at).toBeLessThanOrEqual(end);
      expect(at).toBeGreaterThanOrEqual(previous);
      expect(event.daysAway).toBe(Math.round((at - start) / 86_400_000 * 10) / 10);
      expect(event.label.length).toBeGreaterThan(3);
      previous = at;
    }
    for (const kind of Object.keys(upcoming.counts)) {
      expect(upcoming.counts[kind]).toBe(upcoming.events.filter((event) => event.kind === kind).length);
    }
    const { nextByKind } = upcoming;
    for (const key of ['nextNewMoon', 'nextFullMoon', 'nextIngress', 'nextSunIngress', 'nextStation', 'nextSolarEclipse', 'nextLunarEclipse']) {
      expect(nextByKind[key], key).not.toBeNull();
      expect(Date.parse(nextByKind[key].at)).toBeGreaterThan(start);
    }
    expect(nextByKind.nextSunIngress.planet).toBe('Sun');
    expect(nextByKind.nextNewMoon.type).toBe('new');
    const mercury = payload('planets/mercury.json');
    expect(nextByKind.mercuryRetrograde).toEqual({ current: mercury.retrograde.current, next: mercury.retrograde.next });
    expect(upcoming.summary).toContain(`${upcoming.windowDays} days`);
  });

  it('keeps an event thirty minutes ahead even when tenths of a day round to zero', () => {
    const eventAt = Date.parse(payload('sky/upcoming.json').events[0].at);
    const snapshotAt = new Date(eventAt - 30 * 60_000).toISOString();
    const upcoming = buildUpcoming({ ...sources, daily: { ...daily, snapshotAt }, generatedAt: GENERATED_AT });
    const event = upcoming.events.find((entry) => Date.parse(entry.at) === eventAt);
    expect(event).toBeDefined();
    expect(Date.parse(event.at)).toBeGreaterThan(Date.parse(upcoming.from));
    expect(event.daysAway).toBe(0);
  });

  it('describes every body from the same snapshot as today', () => {
    const today = payload('sky/today.json');
    for (const slug of PLANET_SLUGS) {
      const planet = payload(`planets/${slug}.json`);
      const body = today.bodies.find((candidate) => candidate.body === PLANET_NAMES[slug]);
      expect(planet.now.position).toBe(body.position);
      expect(planet.retrograde.active).toBe(body.retrograde);
      if (slug === 'sun' || slug === 'moon') {
        expect(planet.retrograde.applicable).toBe(false);
        expect(planet.retrograde.windows).toEqual([]);
        expect(planet.summary).not.toContain('retrograde');
      } else {
        expect(planet.retrograde.applicable).toBe(true);
        expect(planet.retrograde.windows.length).toBeGreaterThan(0);
        expect(planet.summary).toMatch(/ and (retrograde|direct)/);
      }
      expect(planet.nextIngress?.planet ?? PLANET_NAMES[slug]).toBe(PLANET_NAMES[slug]);
      expect(planet.summary).toContain(`${PLANET_NAMES[slug]} is at `);
    }
    expect(payload('planets/mercury.json').retrograde.windows.length).toBeGreaterThanOrEqual(12);
  });

  it('lists the twelve signs with computed Sun seasons and the bodies in each', () => {
    const signs = payload('signs.json');
    expect(signs.signs).toHaveLength(12);
    const occupants = signs.signs.flatMap((sign) => sign.occupantsNow).sort();
    expect(occupants).toEqual(daily.bodies.map((body) => body.body).sort());
    for (const sign of signs.signs) {
      expect(sign.sunSeason).not.toBeNull();
      expect(Date.parse(sign.sunSeason.to)).toBeGreaterThan(Date.parse(sign.sunSeason.from));
      expect(sign.sunSeason.year).toBe(Number(daily.date.slice(0, 4)));
      expect(sign.summary).toContain(`ruled by ${sign.ruler}`);
      expect(sign.longitudeRange.to - sign.longitudeRange.from).toBe(30);
    }
    expect(signs.signs.find((sign) => sign.slug === 'scorpio').classicRuler).toBe('Mars');
  });
});

describe('sky data API — text documents', () => {
  it('writes an agent guide that names every endpoint family and the license', () => {
    const guide = build.files.get('llms.txt');
    for (const family of [...YEAR_FAMILIES, 'sky/today', 'sky/upcoming', 'signs', 'planets/', 'openapi', 'schema/']) {
      expect(guide, family).toContain(`https://zodiacs.org/api/v1/${family}`);
    }
    expect(guide).toContain('CC BY 4.0');
    expect(guide).toContain('12:00 UTC');
    expect(guide).toContain('clippedStart');
    expect(guide).toContain('Which file answers which question');
    expect(guide).not.toMatch(/\/registry\/|\/sdk\/|\/terminal\/|\/astrofolio\//);
  });

  it('renders Markdown twins that carry the same facts as the JSON', () => {
    const today = payload('sky/today.json');
    const todayMd = build.files.get('sky/today.md');
    for (const body of today.bodies) expect(todayMd).toContain(`| ${body.body} | ${body.position} |`);
    expect(todayMd).toContain(today.summary);
    const upcomingMd = build.files.get('sky/upcoming.md');
    const upcoming = payload('sky/upcoming.json');
    expect(upcomingMd).toContain('## Next of each kind');
    for (const event of upcoming.events.slice(0, 5)) expect(upcomingMd).toContain(event.label);
  });
});
