/**
 * The time atlas the site publishes as a dataset (B3.c), version 0.1.0: the
 * engine repository's atlas/ at commit 7307665b, copied byte for byte to
 * public/developers/time-atlas/0.1.0/ beside files.json, the site's index of
 * the seventeen files. These are the preregistration's checks C2 and C5 and
 * the unit tests of C6's page check
 * (docs/platform/evidence/time-atlas-dataset-20261101/PREREGISTRATION.md).
 *
 * The digests are written out below as the preregistration fixed them, so any
 * change to a published file fails here: a changed atlas is published as a new
 * version, at its own path, and the files of 0.1.0 never change.
 */
import { createHash } from 'node:crypto';
import {
  cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { timeAtlasFileProblems } from '../scripts/check-time-atlas.mjs';

const FOLDER = 'public/developers/time-atlas/0.1.0';
const SOURCE_DATA = 'src/data/time-atlas';
const COMMIT = '7307665bdbc432269fdac006104f661be16000bc';
const TREE = '8e1bc174cafdb8c09ee7986cae4527cdbac18e9a';

/** [served path, source path at COMMIT, bytes, SHA-256, git blob], in the index's order. */
const PUBLISHED: ReadonlyArray<readonly [string, string, number, string, string]> = [
  ['data/atlas.json', 'atlas/data/atlas.json', 1720, '4104e88dfc5b1eaaa1789e5c6c260a290c0d27c1878f39fd54df472355dcb7de', '97d557d641efdae56ae337e2b03ba3f2bb618849'],
  ['data/places.json', 'atlas/data/places.json', 6659, '1c1366ae622ffed271ee2717454a5e723253ad28f5b1b444086e571664ef00db', '7bf219585a7f9b70686872536510803426f51348'],
  ['data/leads.json', 'atlas/data/leads.json', 1703, 'f247caf33ee57ff7708dc496cf1c5f2cece41f274f2969e4f2616840c462d54b', '2985ffd094e4a9059079c805c50a21ab38785bb4'],
  ['data/citations-fr.json', 'atlas/data/citations-fr.json', 32315, '3b91f1e679cbb67e1bcb381979d0e21a51842671e339b901d21cfeb652b06b5a', 'aa8880404324cfd640eac51429dbd2a66c094c43'],
  ['data/rules-fr.json', 'atlas/data/rules-fr.json', 36487, 'f6922563cf13ecb679cb152b04bddb73103c20f9ac1a445d80e106a9e11d53be', '485a27d06feb474c68ad5cae2d2fc0467072d97c'],
  ['data/citations-als.json', 'atlas/data/citations-als.json', 16769, '5102d32cb2f1a588d569fc3aa57d8e9ebcdaa28843b90cab19c56b54a8f96f3b', 'c3f3a7e8a94fbfbdcd4507c90fa64945b9303f32'],
  ['data/rules-als.json', 'atlas/data/rules-als.json', 26340, '6cff3b85bfaf32555dec81399044a8f3e1cba2712d129637635330733807fa20', '44c734f5d0d13f6757c00f7d8735a1114fa7ed69'],
  ['data/citations-us.json', 'atlas/data/citations-us.json', 20505, '0c06ad3a6255083814b3ddad19c6ef6a7dbdfd8e1b3d004c8bc182836df1dd3b', '2328c3e490f5d1dd55a384ae16616747f09eb649'],
  ['data/rules-us.json', 'atlas/data/rules-us.json', 49068, 'be300c2a1961f982500e6cbe57cd5c4165b8235da32655001886443f8d2648b4', 'd7de5df948e87582c8d87821b43080ec4d64d77e'],
  ['data/tzdb-explanations.json', 'atlas/data/tzdb-explanations.json', 15913, '3035f49a9c018b9164be6c64b8f85969bf4fcb7a1bd8d1d06395af541dc56fba', '8215f08af3834c9d7ce567e6985fce7b8eae640e'],
  ['tzdb/differences.json', 'atlas/tzdb/differences.json', 42949, '46efb73ea6264200b54e86ad979bc5e50a0b932ee589aa1986e84eef1ff957dc', 'bb415cd19d1e9ac35b05f83f38a81f81f6e64b3c'],
  ['TZDB-DIFFERENCES.md', 'atlas/TZDB-DIFFERENCES.md', 84517, '1fbf2d47a168fc2626a630cbcf8384e284e3aa8d7dffd1a6d05267cba4486a53', '1d649e371335ddb1e6b8b920bc358c76458bd707'],
  ['README.md', 'atlas/README.md', 11078, 'ba480ca8860e163ef6ba7ebbcf773881e36085e94d99a1bdf00f029e35868cea', '604ab3d59008517992e6efae72aeed72dbfa2382'],
  ['COVERAGE.md', 'atlas/COVERAGE.md', 22736, '375e2aa1cf6bc2428ff713628c4b53391db5957257b0e1130e8eff7e6e61de75', '7a826c1a159b608e3ffd9c2029c1d05ce6e7886b'],
  ['CORRECTIONS.md', 'atlas/CORRECTIONS.md', 5837, '362be60dfcccec7e7c9c71594e313378b603d1b90e5499caf1e948da3e3d0013', '464b21fc5f97f507583b67ce93572d9eeb6cbc61'],
  ['LICENSING.md', 'atlas/LICENSING.md', 2894, '7ba4edc0d9862a7e534057e0ecc3fc426b0cef41f38f2c5edb6b5e53ceb438fc', 'b9d2b546309d01c0eecbbf28b8359be70ae939c6'],
  ['LICENSE.txt', 'atlas/LICENSE', 18657, '9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411', 'da6ab6cc8f333d7e89a99812866df8f24374d47c'],
];

// Computed here, apart from scripts/check-time-atlas.mjs, so the check and the test do not share a mistake.
const sha256Of = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const gitBlobOf = (bytes: Buffer) => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

const scratch: string[] = [];
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});
/** A temporary copy of the published folder, for a control to change. */
function copyOfFolder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'time-atlas-'));
  scratch.push(dir);
  const copy = join(dir, '0.1.0');
  cpSync(FOLDER, copy, { recursive: true });
  return copy;
}

/** Every entry under `folder` that is not a directory, by lstat, so a link is seen as a link. */
function walk(folder: string, prefix = ''): { path: string; regular: boolean }[] {
  const found: { path: string; regular: boolean }[] = [];
  for (const name of readdirSync(join(folder, prefix))) {
    const path = prefix ? `${prefix}/${name}` : name;
    const info = lstatSync(join(folder, path));
    if (info.isDirectory()) found.push(...walk(folder, path));
    else found.push({ path, regular: info.isFile() });
  }
  return found.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/** The names among `names` whose bytes in `published` differ from those in `source`. */
function differingDataFiles(published: string, source: string, names: string[]): string[] {
  return names.filter((name) => !readFileSync(join(published, name)).equals(readFileSync(join(source, name))));
}

interface Rule { id: string; version: number; uncertainty: { flag: string }; changes?: unknown[] }
type AtlasFiles = Record<string, { jurisdictions?: unknown[]; rules?: Rule[]; citations?: unknown[]; places?: unknown[] }>;

/** The counts check.mjs prints for an atlas, from its manifest and its files. */
function atlasCounts(manifest: { files: string[] }, files: AtlasFiles) {
  const all = manifest.files.map((name) => files[name]);
  const rules = all.flatMap((file) => file.rules ?? []);
  const tally = (values: (string | number)[]) => Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((other) => other === value).length]),
  );
  return {
    places: all.reduce((sum, file) => sum + (file.places?.length ?? 0), 0),
    jurisdictions: all.reduce((sum, file) => sum + (file.jurisdictions?.length ?? 0), 0),
    rules: rules.length,
    citations: all.reduce((sum, file) => sum + (file.citations?.length ?? 0), 0),
    flags: tally(rules.map((rule) => rule.uncertainty.flag)),
    versions: tally(rules.map((rule) => rule.version)),
    rulesWithChanges: rules.filter((rule) => (rule.changes ?? []).length > 0).length,
    changeEntries: rules.reduce((sum, rule) => sum + (rule.changes ?? []).length, 0),
  };
}

const manifest = readJson(join(FOLDER, 'data/atlas.json'));
const dataFiles: AtlasFiles = Object.fromEntries(manifest.files.map((name: string) => [name, readJson(join(FOLDER, 'data', name))]));

describe('the time atlas dataset, version 0.1.0', () => {
  it('publishes exactly the seventeen atlas files and their index, none missing, none extra and no link', async () => {
    const entries = walk(FOLDER);
    expect(entries.map((entry) => entry.path)).toEqual(['files.json', ...PUBLISHED.map(([path]) => path)].sort());
    for (const entry of entries) expect(entry.regular, entry.path).toBe(true);
    expect(await timeAtlasFileProblems(FOLDER)).toEqual([]);

    // Controls, each on a copy: a file removed, a file the dataset does not carry added, a file replaced by a link.
    const removed = copyOfFolder();
    unlinkSync(join(removed, 'data/leads.json'));
    expect(await timeAtlasFileProblems(removed)).toEqual(['data/leads.json: missing']);
    const added = copyOfFolder();
    mkdirSync(join(added, 'schema'));
    writeFileSync(join(added, 'schema/atlas.schema.json'), '{}\n');
    expect(await timeAtlasFileProblems(added)).toEqual(['schema/atlas.schema.json: not listed in files.json']);
    const linked = copyOfFolder();
    unlinkSync(join(linked, 'README.md'));
    symlinkSync(resolve(FOLDER, 'README.md'), join(linked, 'README.md'));
    expect(walk(linked).find((entry) => entry.path === 'README.md')?.regular).toBe(false);
    expect(await timeAtlasFileProblems(linked)).toEqual(['README.md: a symbolic link, not a file']);
  });

  it("keeps the bytes the engine repository's atlas had at 7307665b, file by file", async () => {
    for (const [path, , bytes, digest, blob] of PUBLISHED) {
      const data = readFileSync(join(FOLDER, path));
      expect(data.length, path).toBe(bytes);
      expect(sha256Of(data), path).toBe(digest);
      expect(gitBlobOf(data), path).toBe(blob);
    }
    expect(PUBLISHED.reduce((sum, [, , bytes]) => sum + bytes, 0)).toBe(396_147);

    // Controls: README.md with its last byte changed, and one byte of data/places.json changed.
    for (const [path, at] of [['README.md', -1], ['data/places.json', 100]] as const) {
      const copy = copyOfFolder();
      const data = readFileSync(join(copy, path));
      const index = at < 0 ? data.length + at : at;
      data[index] = data[index] ^ 1;
      writeFileSync(join(copy, path), data);
      const [, , , digest, blob] = PUBLISHED.find(([served]) => served === path)!;
      expect(sha256Of(data)).not.toBe(digest);
      expect(gitBlobOf(data)).not.toBe(blob);
      const problems = await timeAtlasFileProblems(copy);
      expect(problems).toEqual([
        `${path}: SHA-256 ${sha256Of(data)}, not ${digest}`,
        `${path}: git blob ${gitBlobOf(data)}, not ${blob}`,
      ]);
    }
  });

  it('serves the same ten data files the compute API reads', () => {
    const names = ['atlas.json', ...manifest.files];
    expect(names).toHaveLength(10);
    expect(differingDataFiles(join(FOLDER, 'data'), SOURCE_DATA, names)).toEqual([]);
    expect(readdirSync(join(FOLDER, 'data')).sort()).toEqual([...names].sort());
    expect(readdirSync(SOURCE_DATA).sort()).toEqual([...names].sort());

    // Control: a copy with one data file changed is reported unequal, that file alone.
    const copy = copyOfFolder();
    const data = readFileSync(join(copy, 'data/rules-us.json'));
    data[200] = data[200] ^ 1;
    writeFileSync(join(copy, 'data/rules-us.json'), data);
    expect(differingDataFiles(join(copy, 'data'), SOURCE_DATA, names)).toEqual(['rules-us.json']);
  });

  it('lists each file in files.json with its size, SHA-256, git blob and source, and the commit and tree it came from', async () => {
    const index = readJson(join(FOLDER, 'files.json'));
    expect(Object.keys(index)).toEqual(['schema', 'name', 'version', 'license', 'licenseUrl', 'source', 'files']);
    expect(index.schema).toBe('zodiacs.time-atlas-files.v1');
    expect(index.name).toBe(manifest.name);
    expect(index.version).toBe(manifest.version);
    expect(index.version).toBe('0.1.0');
    expect(index.license).toBe(manifest.license);
    expect(index.license).toBe('CC-BY-4.0');
    expect(index.licenseUrl).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(index.source).toEqual({ repository: 'https://github.com/zodiacs-org/engine', commit: COMMIT, tree: TREE, path: 'atlas' });
    expect(index.files.map((file: { path: string }) => file.path)).toEqual(PUBLISHED.map(([path]) => path));
    for (const [i, [path, source, bytes, digest, blob]] of PUBLISHED.entries()) {
      const data = readFileSync(join(FOLDER, path));
      expect(index.files[i], path).toEqual({ path, source, bytes: data.length, sha256: sha256Of(data), gitBlob: gitBlobOf(data) });
      expect([bytes, digest, blob], path).toEqual([data.length, sha256Of(data), gitBlobOf(data)]);
    }

    // Control: an index with one file's size wrong.
    const copy = copyOfFolder();
    const wrong = readJson(join(copy, 'files.json'));
    wrong.files[2].bytes += 1;
    writeFileSync(join(copy, 'files.json'), `${JSON.stringify(wrong, null, 2)}\n`);
    expect(await timeAtlasFileProblems(copy)).toEqual(['data/leads.json: 1703 bytes, not 1704']);
  });

  it("gives the atlas's own counts: 21 places, 14 jurisdictions, 59 rules (27 documented, 26 inferred, 6 uncertain) and 66 citations", () => {
    expect(atlasCounts(manifest, dataFiles)).toEqual({
      places: 21,
      jurisdictions: 14,
      rules: 59,
      citations: 66,
      flags: { documented: 27, inferred: 26, uncertain: 6 },
      versions: { 1: 21, 2: 31, 3: 7 },
      rulesWithChanges: 38,
      changeEntries: 45,
    });

    // Control: the same count on a copy of the rules with one flag changed.
    const rules = structuredClone(dataFiles['rules-fr.json']);
    rules.rules!.find((rule) => rule.uncertainty.flag === 'documented')!.uncertainty.flag = 'inferred';
    const changed = atlasCounts(manifest, { ...dataFiles, 'rules-fr.json': rules });
    expect(changed.flags).toEqual({ documented: 26, inferred: 27, uncertain: 6 });
  });
});
