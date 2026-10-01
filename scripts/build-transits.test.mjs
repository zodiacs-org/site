import { execFile } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let temporaryRoot;

function canonicalTransit(catalog) {
  // V8 delegates trigonometry to the host libm, so Node on Linux and macOS
  // can differ below 1e-12 degrees. Normalize only those physical coordinates;
  // every event, timestamp, sign, body, direction, and ordering remains exact.
  const coordinate = (value) => Number(value.toFixed(9));
  return {
    ...catalog,
    lunations: catalog.lunations.map((event) => ({
      ...event,
      degree: coordinate(event.degree),
    })),
    stations: catalog.stations.map((event) => ({
      ...event,
      degree: coordinate(event.degree),
    })),
    aspects: catalog.aspects.map((event) => ({
      ...event,
      aDegree: coordinate(event.aDegree),
      bDegree: coordinate(event.bDegree),
    })),
  };
}

afterEach(async () => {
  if (temporaryRoot) await rm(temporaryRoot, { force: true, recursive: true });
  temporaryRoot = undefined;
});

const catalogFilenames = readdirSync(resolve(repositoryRoot, 'src/data'))
  .filter((name) => /^transits-\d{4}-(?:0[1-9]|1[0-2])\.json$/u.test(name))
  .sort();
const expectedFilenames = Array.from({ length: 60 }, (_, index) => {
  const year = 2026 + Math.floor(index / 12);
  const month = String((index % 12) + 1).padStart(2, '0');
  return `transits-${year}-${month}.json`;
});

describe('Transit fact generation', () => {
  it('keeps one committed catalog for every month of 2026–2030', () => {
    expect(catalogFilenames).toEqual(expectedFilenames);
  });

  // One test per month. A single test that regenerated all sixty months took
  // 110.7 s of its 120 s budget (audit finding F-41) and later ran over it on
  // a slower runner; per month, each regeneration keeps its own budget and
  // every assertion stays the same.
  it.each(expectedFilenames)('regenerates %s byte for byte from the site engine', async (filename) => {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'zodiacs-transit-parity-'));
    const month = filename.slice('transits-'.length, -'.json'.length);
    const firstOutput = join(temporaryRoot, 'first', filename);
    const secondOutput = join(temporaryRoot, 'second', filename);
    // Two independent processes; running them side by side still shows that
    // the generator gives the same bytes twice.
    await Promise.all([firstOutput, secondOutput].map((output) => execFileAsync(process.execPath, [
      'scripts/build-transits.mjs',
      month,
      '--output',
      output,
    ], { cwd: repositoryRoot })));

    const [first, second, committed] = await Promise.all([
      readFile(firstOutput, 'utf8'),
      readFile(secondOutput, 'utf8'),
      readFile(resolve(repositoryRoot, 'src/data', filename), 'utf8'),
    ]);
    expect(first, `${filename} must regenerate byte-for-byte`).toBe(second);
    expect(canonicalTransit(JSON.parse(first)), filename)
      .toEqual(canonicalTransit(JSON.parse(committed)));
  }, 60_000);

  it('pins complete monthly coverage and aggregate event counts for 2026–2030', async () => {
    const filenames = (await readdir(resolve(repositoryRoot, 'src/data')))
      .filter((name) => /^transits-\d{4}-(?:0[1-9]|1[0-2])\.json$/u.test(name))
      .sort();
    const aggregate = { ingresses: 0, lunations: 0, stations: 0, aspects: 0 };
    for (const filename of filenames) {
      const source = JSON.parse(await readFile(resolve(repositoryRoot, 'src/data', filename), 'utf8'));
      expect(filename).toBe(`transits-${source.month}.json`);
      for (const key of Object.keys(aggregate)) aggregate[key] += source[key].length;
    }
    expect(aggregate).toEqual({
      ingresses: 243,
      lunations: 124,
      stations: 90,
      aspects: 797,
    });
  });

  it('pins event coverage and exact source-of-truth vectors for both Phase 1 months', async () => {
    const july = JSON.parse(await readFile(
      resolve(repositoryRoot, 'src/data/transits-2026-07.json'),
      'utf8',
    ));
    const august = JSON.parse(await readFile(
      resolve(repositoryRoot, 'src/data/transits-2026-08.json'),
      'utf8',
    ));

    expect({
      ingresses: july.ingresses.length,
      lunations: july.lunations.length,
      stations: july.stations.length,
      aspects: july.aspects.length,
    }).toEqual({ ingresses: 2, lunations: 2, stations: 3, aspects: 16 });
    expect(july.lunations.map(({ type, at, sign }) => ({ type, at, sign }))).toEqual([
      { type: 'new', at: '2026-07-14T09:43:36.119Z', sign: 'cancer' },
      { type: 'full', at: '2026-07-29T14:35:42.223Z', sign: 'aquarius' },
    ]);
    // rc.16 full IAU 2000B nutation changes the time derivative of
    // longitude, moving station roots; the search and tolerances are fixed.
    expect(july.stations.map(({ planet, at, type }) => ({ planet, at, type }))).toEqual([
      { planet: 'Neptune', at: '2026-07-07T11:01:00.780Z', type: 'retrograde' },
      { planet: 'Mercury', at: '2026-07-23T22:56:24.667Z', type: 'direct' },
      { planet: 'Saturn', at: '2026-07-26T19:53:12.269Z', type: 'retrograde' },
    ]);

    expect({
      ingresses: august.ingresses.length,
      lunations: august.lunations.length,
      stations: august.stations.length,
      aspects: august.aspects.length,
    }).toEqual({ ingresses: 5, lunations: 2, stations: 0, aspects: 15 });
    expect(august.lunations.map(({ type, at, sign }) => ({ type, at, sign }))).toEqual([
      { type: 'new', at: '2026-08-12T17:36:41.548Z', sign: 'leo' },
      { type: 'full', at: '2026-08-28T04:18:31.156Z', sign: 'pisces' },
    ]);
  });

  it('preserves both Mercury ingresses when a retrograde turn returns across a cusp the same day', async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'zodiacs-transit-double-ingress-'));
    const output = join(temporaryRoot, 'transits-1970-01.json');
    await execFileAsync(process.execPath, [
      'scripts/build-transits.mjs',
      '1970-01',
      '--output',
      output,
    ], { cwd: repositoryRoot });

    const generated = JSON.parse(await readFile(output, 'utf8'));
    // rc.16 rotates the apparent longitude origin by the full nutation.
    // Both crossings near Mercury's station persist, with new root instants.
    expect(generated.ingresses.filter(({ planet }) => planet === 'Mercury')).toEqual([
      {
        planet: 'Mercury',
        at: '1970-01-04T03:41:34.317Z',
        sign: 'aquarius',
        retrograde: false,
      },
      {
        planet: 'Mercury',
        at: '1970-01-04T12:42:33.386Z',
        sign: 'capricorn',
        retrograde: true,
      },
    ]);
  });
});
