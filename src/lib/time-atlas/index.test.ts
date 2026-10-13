/**
 * The time atlas the site copies from the engine repository (B3.b): its data
 * files are the engine repository's at the pinned commit, its resolver is the
 * engine repository's apart from the loader, and it reads 2,100 wall times as
 * the engine repository's own resolver read them (tests/fixtures/
 * time-atlas-readings.json, generated with atlas/tools/lib.mjs at that commit
 * for 21 places at seeded times from 1869-12-31 to 1920-01-02 and at minutes
 * around every change of each civil clock).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../../data/time-atlas/atlas.json';
import { ATLAS_COMMIT, ATLAS_COVERAGE, ATLAS_PLACES, ATLAS_SOURCE, atlasReading } from './index';
import { loadAtlas, resolve } from './lib.mjs';
import placesData from '../../data/time-atlas/places.json';
import { ATLAS_PLACE_IDS, ATLAS_PLACE_ZONES, ATLAS_VERSION, ATLAS_WINDOW } from './places';

const read = (path: string) => readFileSync(new URL(path, import.meta.url));
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

/** sha256 of each file at engine commit 7307665b, atlas/data/. */
const DIGESTS: Record<string, string> = {
  'atlas.json': '4104e88dfc5b1eaaa1789e5c6c260a290c0d27c1878f39fd54df472355dcb7de',
  'citations-als.json': '5102d32cb2f1a588d569fc3aa57d8e9ebcdaa28843b90cab19c56b54a8f96f3b',
  'citations-fr.json': '3b91f1e679cbb67e1bcb381979d0e21a51842671e339b901d21cfeb652b06b5a',
  'citations-us.json': '0c06ad3a6255083814b3ddad19c6ef6a7dbdfd8e1b3d004c8bc182836df1dd3b',
  'leads.json': 'f247caf33ee57ff7708dc496cf1c5f2cece41f274f2969e4f2616840c462d54b',
  'places.json': '1c1366ae622ffed271ee2717454a5e723253ad28f5b1b444086e571664ef00db',
  'rules-als.json': '6cff3b85bfaf32555dec81399044a8f3e1cba2712d129637635330733807fa20',
  'rules-fr.json': 'f6922563cf13ecb679cb152b04bddb73103c20f9ac1a445d80e106a9e11d53be',
  'rules-us.json': 'be300c2a1961f982500e6cbe57cd5c4165b8235da32655001886443f8d2648b4',
  'tzdb-explanations.json': '3035f49a9c018b9164be6c64b8f85969bf4fcb7a1bd8d1d06395af541dc56fba',
};
/** sha256 of atlas/tools/lib.mjs at that commit from `const LOCAL = ` to its end: everything after the loader. */
const RESOLVER_TAIL = '200cf911f3d50af2bd7429b8fef23013427c4f4cce8585086710eae00f3724dd';

type Case = [string, string, string, string, Array<[number, string, string]>, string];
const golden = JSON.parse(read('../../../tests/fixtures/time-atlas-readings.json').toString('utf8')) as {
  engineCommit: string; counts: Record<string, number>; cases: Case[];
};

describe('the time atlas copied from the engine repository', () => {
  it('carries every data file the manifest lists, byte for byte as at the pinned commit', () => {
    expect(ATLAS_COMMIT).toBe('7307665bdbc432269fdac006104f661be16000bc');
    expect(Object.keys(DIGESTS).sort()).toEqual(['atlas.json', ...manifest.files].sort());
    for (const [file, digest] of Object.entries(DIGESTS)) {
      expect(sha256(read(`../../data/time-atlas/${file}`)), file).toBe(digest);
    }
    expect(ATLAS_SOURCE).toMatchObject({ version: '0.1.0', licence: 'CC BY 4.0' });
    expect(ATLAS_COVERAGE).toEqual({ start: '1870-01-01T00:00:00', end: '1920-01-01T00:00:00' });
    expect(ATLAS_PLACES).toHaveLength(21);
    expect([...ATLAS_PLACE_IDS]).toEqual([...ATLAS_PLACES]);
    expect({ ...ATLAS_PLACE_ZONES }).toEqual(Object.fromEntries(placesData.places.map((place: { id: string; tzdbZone: string }) => [place.id, place.tzdbZone])));
    expect(ATLAS_VERSION).toBe(manifest.version);
    expect(ATLAS_WINDOW).toEqual({ from: manifest.coverage.start, to: manifest.coverage.end });
  });

  it("keeps the engine repository's resolver as it is after the loader, which opens no file", () => {
    const source = read('./lib.mjs').toString('utf8');
    expect(sha256(source.slice(source.indexOf('const LOCAL = ')))).toBe(RESOLVER_TAIL);
    expect(source).not.toMatch(/from 'node:|readFileSync|import\(/u);
  });

  it("reads every wall time of the fixture as the engine repository's own resolver did", () => {
    expect(golden.engineCommit).toBe(ATLAS_COMMIT);
    expect(golden.cases).toHaveLength(2100);
    expect(golden.counts).toEqual({ 'out-of-coverage': 126, ok: 1482, ambiguous: 261, nonexistent: 231 });
    const files: Record<string, unknown> = {};
    for (const file of manifest.files) files[file] = JSON.parse(read(`../../data/time-atlas/${file}`).toString('utf8'));
    const atlas = loadAtlas(manifest, files);
    expect(atlas.problems).toEqual([]);
    const differ: string[] = [];
    for (const [place, date, time, status, instants, digest] of golden.cases) {
      const result = resolve(atlas, place, `${date}T${time}:00`, 'civil');
      const full = JSON.stringify({ status: result.status, instants: result.instants, skipped: result.skipped ?? null });
      const ok = result.status === status
        && JSON.stringify(result.instants.map((i) => [i.utcMs, i.rule, i.uncertainty.flag])) === JSON.stringify(instants)
        && sha256(full).slice(0, 32) === digest;
      if (!ok) differ.push(`${place} ${date}T${time}`);
    }
    expect(differ).toEqual([]);
  });

  it('gives each instant in UTC with its rule, its uncertainty and its citations, titled and linked', () => {
    // Brest kept its own mean time until 1891, where tzdb's Europe/Paris reads Paris mean time.
    const brest = atlasReading('fr-brest', '1885-06-01', '12:00');
    expect(brest).toMatchObject({ place: 'fr-brest', name: 'Brest', clock: 'civil', status: 'ok', skipped: null });
    expect(brest.instants).toHaveLength(1);
    const [instant] = brest.instants;
    expect(instant.utc).toMatch(/^1885-06-01T12:\d{2}:\d{2}\.\d{3}Z$/u);
    expect(instant.offsetSeconds).toBeLessThan(0);
    expect(['documented', 'inferred', 'uncertain']).toContain(instant.uncertainty.flag);
    expect(instant.uncertainty.reasons.length).toBeGreaterThan(0);
    expect(instant.citations.length).toBeGreaterThan(0);
    for (const citation of instant.citations) expect(citation.url).toMatch(/^https:\/\//u);
    expect(atlasReading('us-new-york', '1850-06-01', '12:00')).toMatchObject({ status: 'out-of-coverage', instants: [] });
  });
});
