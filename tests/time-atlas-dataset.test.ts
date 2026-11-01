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
import { TIME_ATLAS_DATA_FILES, timeAtlasFileProblems, timeAtlasPageProblems } from '../scripts/check-time-atlas.mjs';
import {
  INDEX_FILE, agreementSpans, atlasViewer, citationAnchor, citedSources, comparisonBase, joinDifferences, pairId, placeTables,
  ruleAnchor, summaryRows, type Difference, type Explanation,
} from '../src/pages/developers/time-atlas/_atlas';
import { ATLAS_COMMIT, ATLAS_SOURCE } from '../src/lib/time-atlas/index';

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

/** What a failure of the published bytes says (C2): the version's files are fixed once released. */
const FROZEN = 'the files of 0.1.0 never change: publish a changed atlas as a new version, at its own path';

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
    expect(entries.map((entry) => entry.path), `${FOLDER}: ${FROZEN}`).toEqual(['files.json', ...PUBLISHED.map(([path]) => path)].sort());
    for (const entry of entries) expect(entry.regular, `${entry.path}: ${FROZEN}`).toBe(true);
    expect(await timeAtlasFileProblems(FOLDER), `${FOLDER}: ${FROZEN}`).toEqual([]);

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
      expect(data.length, `${path}: ${FROZEN}`).toBe(bytes);
      expect(sha256Of(data), `${path}: ${FROZEN}`).toBe(digest);
      expect(gitBlobOf(data), `${path}: ${FROZEN}`).toBe(blob);
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
      expect(index.files[i], `${path}: ${FROZEN}`).toEqual({ path, source, bytes: data.length, sha256: sha256Of(data), gitBlob: gitBlobOf(data) });
      expect([bytes, digest, blob], `${path}: ${FROZEN}`).toEqual([data.length, sha256Of(data), gitBlobOf(data)]);
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

  // ---------- the viewer's data (C5) ----------

  it('reads the comparison as TZDB-DIFFERENCES.md states it: 23 place and zone pairs, 287 periods, 178 agreeing, 1 within a second and 108 differing', () => {
    const summary = summaryRows(REPORT);
    const tables = placeTables(REPORT);
    const agreement = agreementSpans(REPORT);
    expect(summary).toHaveLength(23);
    for (const row of summary) expect(row.compared, row.place).toBe(row.agree + row.differ + row.rounding);
    expect(tableCountsMatch(summary, tables)).toBe(true);
    expect(summary.reduce((sum, row) => sum + row.compared, 0)).toBe(287);
    expect(summary.reduce((sum, row) => sum + row.agree, 0)).toBe(178);
    expect(summary.reduce((sum, row) => sum + row.rounding, 0)).toBe(1);
    expect(summary.reduce((sum, row) => sum + row.differ, 0)).toBe(108);
    expect(summary.filter((row) => row.differ > 0)).toHaveLength(22);
    expect(pairsMatchPlaces(summary)).toBe(true);
    expect(summary.filter((row) => row.informational).map((row) => `${row.place} ${row.zone}`)).toEqual(['fr-strasbourg Europe/Berlin', 'fr-metz Europe/Berlin']);
    expect(new Set(tables.flatMap((table) => table.rows.map((row) => row.rule))).size).toBe(58);
    expect(newYorkRounding(summary, tables)).toBe('380');
    expect(agreement).toHaveLength(23);
    expect(agreement.reduce((sum, row) => sum + row.spans.length, 0)).toBe(77);
    expect(agreement.map((row) => `${row.place}|${row.zone}`)).toEqual(summary.map((row) => `${row.place}|${row.zone}`));
    expect(comparisonBase(REPORT)).toEqual({
      tzdb: '2025c',
      tarballSha256: '4aa79e4effee53fc4029ffe5f6ebe97937282ebcdf386d5d2da91ce84142f957',
      treeFiles: 598,
      treeSha256: '98ba2bd3eb549fced32814888318d478c96eb65d5fa5b482ee1d89ebb298bcc5',
      window: ['1870-01-01T00:00:00', '1920-01-01T00:00:00'],
    });

    // Controls, each on a copy of the Markdown text.
    const lines = REPORT.split('\n');
    const firstSummaryRow = lines.findIndex((line) => line.startsWith('| Paris (`fr-paris`) | Europe/Paris | 16 '));
    const withoutRow = [...lines.slice(0, firstSummaryRow), ...lines.slice(firstSummaryRow + 1)].join('\n');
    expect(summaryRows(withoutRow)).toHaveLength(22);
    expect(pairsMatchPlaces(summaryRows(withoutRow))).toBe(false);
    const oneAgreementDiffers = REPORT.replace('| `fr-paris-mean-time-before-1891` | +0:09:21 | +0:09:21 LMT | agrees |', '| `fr-paris-mean-time-before-1891` | +0:09:21 | +0:09:21 LMT | differs by 1 s |');
    expect(oneAgreementDiffers).not.toBe(REPORT);
    expect(tableCountsMatch(summaryRows(oneAgreementDiffers), placeTables(oneAgreementDiffers))).toBe(false);
    const roundingAgrees = REPORT.replace('| rounding (380 ms) |', '| agrees |');
    expect(roundingAgrees).not.toBe(REPORT);
    expect(tableCountsMatch(summaryRows(roundingAgrees), placeTables(roundingAgrees))).toBe(false);
    expect(newYorkRounding(summaryRows(roundingAgrees), placeTables(roundingAgrees))).toBeNull();
    const otherTarball = REPORT.replace('4aa79e4effee53fc4029ffe5f6ebe97937282ebcdf386d5d2da91ce84142f957', '0'.repeat(64));
    expect(comparisonBase(otherTarball).tarballSha256).toBe('0'.repeat(64));
  });

  it('finds in the place tables exactly the 108 differences of tzdb/differences.json, in order, with their offsets', () => {
    const tables = placeTables(REPORT);
    const differing = joinDifferences(tables, DIFFERENCES).filter((row) => row.result.kind === 'differs');
    expect(differing).toHaveLength(108);
    differing.forEach((row, at) => {
      const entry = DIFFERENCES[at];
      expect({
        place: row.place, zone: row.zone, from: row.from, to: row.to, atlasRule: row.rule, atlasOffset: row.atlasOffset,
        tzdbOffset: row.tzdbOffset, tzdbAbbreviation: row.tzdbAbbreviation,
        differenceSeconds: row.result.kind === 'differs' ? Number(row.result.seconds) : null, explanation: row.explanation,
      }, `difference ${at + 1}`).toEqual({
        place: entry.place, zone: entry.zone, from: entry.from, to: entry.to, atlasRule: entry.atlasRule, atlasOffset: entry.atlasOffset,
        tzdbOffset: entry.tzdbOffset, tzdbAbbreviation: entry.tzdbAbbreviation, differenceSeconds: entry.differenceSeconds, explanation: entry.explanation,
      });
    });
    // The rules the 108 rows name, and the rows by their rule's version and flag (C5's first bullet).
    const rulesById = new Map(['rules-fr.json', 'rules-als.json', 'rules-us.json']
      .flatMap((name) => dataFiles[name].rules ?? []).map((rule) => [rule.id, rule]));
    expect(rulesById.size).toBe(59);
    expect(rowRules(DIFFERENCES, rulesById)).toEqual({
      rules: 31, versions: { 1: 46, 2: 44, 3: 18 }, flags: { documented: 54, inferred: 32, uncertain: 22 },
    });

    // Control: one rule's flag changed, fr-wet-1916 (version 3, documented, on 10 rows) made uncertain, in a copy of the rules.
    const wet = rulesById.get('fr-wet-1916')!;
    expect([wet.version, wet.uncertainty.flag, DIFFERENCES.filter((difference) => difference.atlasRule === wet.id).length]).toEqual([3, 'documented', 10]);
    const reflagged = new Map(rulesById).set(wet.id, { ...wet, uncertainty: { ...wet.uncertainty, flag: 'uncertain' } });
    expect(rowRules(DIFFERENCES, reflagged).flags).toEqual({ documented: 44, inferred: 32, uncertain: 32 });

    // Controls, each on a cloned copy of the differences.
    const changedTo = structuredClone(DIFFERENCES);
    changedTo[5].to = '1891-03-17T00:17:57.707Z';
    expect(() => joinDifferences(tables, changedTo)).toThrow(/difference 6 does not match the row of fr-brest against Europe\/Paris from 1891-03-15T23:50:39Z/u);
    const removed = DIFFERENCES.filter((_, at) => at !== 0);
    expect(() => joinDifferences(tables, removed)).toThrow(/difference 1 does not match the row of fr-paris against Europe\/Paris from 1916-10-01T00:00:00Z/u);
    const changedOffset = structuredClone(DIFFERENCES);
    changedOffset[2].tzdbOffset = '+1:00:01';
    expect(() => joinDifferences(tables, changedOffset)).toThrow(/difference 3 does not match the row of fr-paris against Europe\/Paris from 1918-10-06T00:00:00Z/u);
  });

  it('matches each difference to exactly one of the 11 explanations on its place, zone, rule and both offsets', () => {
    expect(EXPLANATIONS).toHaveLength(11);
    const matched = DIFFERENCES.map((difference) => explaining(EXPLANATIONS, difference));
    matched.forEach((ids, at) => expect(ids, `difference ${at + 1}`).toEqual([DIFFERENCES[at].explanation]));
    for (const explanation of EXPLANATIONS) expect(matched.some((ids) => ids.includes(explanation.id)), explanation.id).toBe(true);
    const counts = Object.fromEntries(EXPLANATIONS.map((explanation) => [explanation.id, DIFFERENCES.filter((difference) => difference.explanation === explanation.id).length]));
    expect(counts).toEqual({
      'fr-summer-time-end-hour': 42, 'als-mos-german-rule': 24, 'fr-own-mean-time-before-1891': 18, 'als-mos-not-berlin': 8,
      'us-city-time-before-standard-time': 5, 'us-standard-time-adopted-later': 3, 'als-strasbourg-five-minutes': 2,
      'de-reich-law-1893-instant': 2, 'us-city-time-whole-minutes': 2, 'us-washington-until-1884': 1, 'us-louisville-city-clock': 1,
    });
    const informational = new Set(summaryRows(REPORT).filter((row) => row.informational).map((row) => `${row.place}|${row.zone}`));
    const own = DIFFERENCES.filter((difference) => !informational.has(`${difference.place}|${difference.zone}`));
    expect([own.length, DIFFERENCES.length - own.length]).toEqual([98, 10]);
    expect(DIFFERENCES.filter((difference) => difference.place === 'fr-strasbourg' && difference.zone === 'Europe/Berlin')).toHaveLength(5);
    expect(DIFFERENCES.filter((difference) => difference.place === 'fr-metz' && difference.zone === 'Europe/Berlin')).toHaveLength(5);
    expect(EXPLANATIONS.reduce((sum, explanation) => sum + explanation.citations.length, 0)).toBe(48);
    const sources = citedSources(EXPLANATIONS, CITATION_FILES);
    expect(sources).toHaveLength(37);
    expect(sources.filter((source) => source.gloss)).toHaveLength(13);

    // Controls.
    const moved = { ...DIFFERENCES[0], tzdbOffsetSeconds: DIFFERENCES[0].tzdbOffsetSeconds + 1 };
    expect(explaining(EXPLANATIONS, moved)).toEqual([]);
    const swapped = EXPLANATIONS.map((explanation) => ({ ...explanation }));
    [swapped[0].id, swapped[1].id] = [swapped[1].id, swapped[0].id];
    expect(DIFFERENCES.some((difference) => JSON.stringify(explaining(swapped, difference)) !== JSON.stringify([difference.explanation]))).toBe(true);
    const fewer = EXPLANATIONS.filter((explanation) => explanation.id !== 'us-louisville-city-clock');
    expect(explaining(fewer, DIFFERENCES.find((difference) => difference.explanation === 'us-louisville-city-clock')!)).toEqual([]);
    const misspelt = EXPLANATIONS.map((explanation, at) => (at === 1 ? { ...explanation, citations: ['fr-senat-1891-02-17-restauration', ...explanation.citations.slice(1)] } : explanation));
    expect(() => citedSources(misspelt, CITATION_FILES)).toThrow('time atlas: no citation fr-senat-1891-02-17-restauration');
  });

  it('builds the viewer with every period once, each difference under its explanation, and an anchor for every explanation, source, pair, row and rule', () => {
    const viewer = atlasViewer();
    const periods = viewer.pairs.flatMap((pair) => pair.periods);
    expect(periods).toHaveLength(287);
    expect(periods.filter((period) => period.explanation)).toHaveLength(108);
    expect(viewer.totals).toEqual({
      comparisons: 23, compared: 287, agree: 178, rounding: 1, differ: 108, withDifference: 22, ownZone: 98, informational: 10, spans: 77,
    });
    for (const explanation of viewer.explanations) {
      const own = periods.filter((period) => period.explanation === explanation.id);
      expect(explanation.count, explanation.id).toBe(own.length);
      expect(explanation.pairs, explanation.id).toEqual([...new Set(own.map((period) => pairId(period.place, period.zone)))]);
    }
    expect(viewer.citations).toHaveLength(37);
    expect(new Set(viewer.citations.map((source) => source.id)).size).toBe(37);
    expect(viewer.rules).toHaveLength(59);
    for (const rule of viewer.rules) expect([1, 2, 3].includes(rule.version) && ['documented', 'inferred', 'uncertain'].includes(rule.flag), rule.id).toBe(true);
    expect(viewer.rules.reduce((sum, rule) => sum + rule.changes.length, 0)).toBe(45);
    const ruleIds = new Set(viewer.rules.map((rule) => rule.id));
    for (const period of periods) expect(ruleIds.has(period.rule), period.rule).toBe(true);
    const ids = [
      ...SECTION_IDS,
      ...viewer.explanations.map((explanation) => explanation.id),
      ...viewer.citations.map((source) => citationAnchor(source.id)),
      ...viewer.pairs.map((pair) => pair.id),
      ...periods.filter((period) => period.id).map((period) => period.id!),
      ...viewer.rules.map((rule) => ruleAnchor(rule.id)),
    ];
    expect(ids).toHaveLength(SECTION_IDS.length + 11 + 37 + 23 + 108 + 59);
    expect(new Set(ids).size).toBe(ids.length);

    // Control: a viewer built from place tables with the first differing row removed.
    const withoutFirst = REPORT.replace('| 1916-10-01T00:00:00Z | 1916-10-01T23:00:00Z | 23.00 h | `fr-wet-1916` | +0:00:00 | +1:00:00 WEST | differs by -3600 s |\n', '');
    expect(withoutFirst).not.toBe(REPORT);
    expect(() => atlasViewer(withoutFirst)).toThrow(/time atlas: difference 1 does not match the row of fr-paris against Europe\/Paris from 1917-10-07T00:00:00Z/u);
  });

  it('shows nothing with an en or em dash, and leaves out the excerpts, the only atlas strings that have them', () => {
    const viewer = atlasViewer();
    expect(dashedStrings(viewer)).toEqual([]);
    expect(viewer.citations.some((source) => 'excerpt' in source)).toBe(false);
    const excerpts = CITATION_FILES.flatMap((file) => file.citations.map((source) => source.excerpt));
    expect(dashedStrings(excerpts)).toHaveLength(8);
    expect(excerpts.reduce((sum, excerpt) => sum + (excerpt.match(DASH) ?? []).length, 0)).toBe(9);
    for (const path of ['src/pages/developers/time-atlas/index.astro', 'src/pages/developers/time-atlas/_atlas.ts', 'scripts/check-time-atlas.mjs']) {
      expect(dashedStrings([readFileSync(path, 'utf8')]), path).toEqual([]);
    }
    expect(dashedStrings([hubCard()])).toEqual([]);

    // Control: the same walker finds a planted en dash between 1870 and 1919.
    expect(dashedStrings({ ...viewer, planted: ['1870\u20131919'] })).toEqual(['1870\u20131919']);
  });

  it("names the version and commit the compute API's reading names", () => {
    const index = readJson(join(FOLDER, 'files.json'));
    expect(ATLAS_SOURCE.version).toBe(index.version);
    expect(ATLAS_COMMIT).toBe(index.source.commit);
    expect(ATLAS_SOURCE.licence).toBe('CC BY 4.0');
    expect(manifest.license).toBe('CC-BY-4.0');
  });

  it("holds the page's checks over the built site to the files, and fails each planted fault", () => {
    const inputs = pageInputs();
    const reference = syntheticReference();
    const page = syntheticPage();
    expect(timeAtlasPageProblems({ ...inputs, page, reference })).toEqual([]);

    const first = DIFFERENCES[0];
    const firstRow = page.indexOf('<tr id="fr-paris-europe-paris-1916-10-01t00-00-00z"');
    const firstRowEnd = page.indexOf('</tr>', firstRow) + '</tr>'.length;
    const excerpt = CITATION_FILES.flatMap((file) => file.citations).find((source) => source.id === 'fr-jo-1891-03-15-law')!.excerpt;
    const geo = manifest.longitudeSource;
    const controls: [string, string, RegExp, string][] = [
      ['an explanation section dropped', page.replace(/<section id="us-louisville-city-clock"[\s\S]*?<\/section>/u, ''), /^viewer: the explanation sections are not/u, 'viewer'],
      ['a data-explanation changed', page.replace(`data-explanation="${first.explanation}"`, 'data-explanation="als-mos-german-rule"'), /^viewer: the difference rows do not name/u, 'viewer'],
      ['the first difference row removed', page.slice(0, firstRow) + page.slice(firstRowEnd), /^viewer: 107 difference rows with an anchor, not 108$/u, 'viewer'],
      ['a tzdb offset changed', page.slice(0, firstRow) + page.slice(firstRow, firstRowEnd).replace('+1:00:00 WEST', '+1:00:01 WEST') + page.slice(firstRowEnd), /^viewer: difference 1 \(fr-paris against Europe\/Paris from 1916-10-01T00:00:00Z\) does not show/u, 'viewer'],
      ['a finding\'s label removed', page.replace('<strong>Finding about tzdb 2025c, not sent to the tz project:</strong>', ''), /^viewer: fr-summer-time-end-hour lacks the label/u, 'viewer'],
      ['an excerpt inserted', page.replace('<li id="cite-fr-jo-1891-03-15-law" data-citation>', `<li id="cite-fr-jo-1891-03-15-law" data-citation><q>${html(excerpt)}</q>`), /^viewer: the excerpt of fr-jo-1891-03-15-law is on the page$/u, 'viewer'],
      ['a GeoNames field altered', page.replace(html(geo.changes), html(geo.changes.replace('copied unchanged', 'copied'))), /^licence: item 3 of the licence and attribution text/u, 'licence'],
      ['the correction form\'s link removed', page.replace(`<a href="${html(FORM_URL)}">Atlas correction issue</a>`, 'Atlas correction issue'), /^corrections: "Atlas correction issue" does not link/u, 'corrections'],
      ['an in-page link to a missing id', page.replace('</main>', '<p><a href="#nowhere">nowhere</a></p></main>'), /^viewer: the link to #nowhere has no target$/u, 'viewer'],
      ['an id duplicated', page.replace('</main>', '<p id="files">again</p></main>'), /^viewer: the id files appears twice$/u, 'viewer'],
      ['a file link missing', page.replace('href="/developers/time-atlas/0.1.0/README.md"', 'href="/developers/time-atlas/0.1.0/README.txt"'), /^viewer: the files table does not link README\.md/u, 'viewer'],
      ['a script in <main>', page.replace('</main>', '<script>1</script></main>'), /^viewer: <main> holds a script$/u, 'viewer'],
      ['an en dash', page.replace('</main>', '<p>1870\u20131919</p></main>'), /^viewer: 1 en or em dashes, raw or as references$/u, 'viewer'],
      ['an em dash as a reference', page.replace('</main>', `<p>1870${'&' + 'mdash;'}1919</p></main>`), /^viewer: 1 en or em dashes, raw or as references$/u, 'viewer'],
    ];
    for (const [name, planted, problem, part] of controls) {
      expect(planted, name).not.toBe(page);
      const problems = timeAtlasPageProblems({ ...inputs, page: planted, reference });
      expect(problems.some((found) => problem.test(found)), `${name}: ${problems.join('; ')}`).toBe(true);
      expect(problems.every((found) => found.startsWith(`${part}: `)), `${name} fails only its part: ${problems.join('; ')}`).toBe(true);
    }
  });

  it('states in the hub card the counts the files give', () => {
    const places = readJson(join(FOLDER, 'data/places.json')).places.length;
    expect(places).toBe(21);
    const matcher = (text: string) => squash(text).includes(`for ${places} places of France and the United States`);
    expect(matcher(hubCard())).toBe(true);
    // Control: the same matcher on the card with another count.
    expect(matcher(hubCard().replace(`for ${places} places`, 'for 20 places'))).toBe(false);
  });

  it('states in both llms entries the counts and the commit the files give', () => {
    const short = readFileSync('public/llms.txt', 'utf8').split('\n').find((line) => line.startsWith('Historical time atlas, version '));
    const full = /^### Time atlas\n([\s\S]*?)\n### /mu.exec(readFileSync('public/llms-full.txt', 'utf8'))?.[1];
    expect(short, 'llms.txt has the time atlas entry').toBeDefined();
    expect(full, 'llms-full.txt has the time atlas section').toBeDefined();
    const summary = summaryRows(REPORT);
    const informational = new Set(summary.filter((row) => row.informational).map((row) => `${row.place}|${row.zone}`));
    const counts = {
      places: readJson(join(FOLDER, 'data/places.json')).places.length,
      differ: DIFFERENCES.length,
      explanations: EXPLANATIONS.length,
      pairs: summary.length,
      periods: summary.reduce((sum, row) => sum + row.compared, 0),
      own: DIFFERENCES.filter((difference) => !informational.has(`${difference.place}|${difference.zone}`)).length,
      berlin: DIFFERENCES.filter((difference) => informational.has(`${difference.place}|${difference.zone}`)).length,
    };
    expect(counts).toEqual({ places: 21, differ: 108, explanations: 11, pairs: 23, periods: 287, own: 98, berlin: 10 });
    const commit = readJson(join(FOLDER, 'files.json')).source.commit.slice(0, 8);
    const shortMatchers = [`${counts.places} places`, `${counts.differ} periods`, `${counts.explanations} explanations`, commit];
    const fullMatchers = [
      `${counts.places} places`, `${counts.pairs} place and zone pairs`, `${counts.periods} periods`, `${counts.differ} that differ`,
      `${counts.own} against the places' own zones`, `${counts.berlin} against Europe/Berlin`, `${counts.explanations} explanations`, commit,
    ];
    for (const matcher of shortMatchers) expect(short, matcher).toContain(matcher);
    for (const matcher of fullMatchers) expect(full, matcher).toContain(matcher);

    // Controls: each matcher fails on a copy with its number changed.
    const bump = (text: string, matcher: string) => text.replace(matcher, matcher.replace(/\d+/u, (number) => String(Number(number) + 1)));
    for (const matcher of shortMatchers.slice(0, -1)) expect(bump(short!, matcher).includes(matcher), matcher).toBe(false);
    for (const matcher of fullMatchers.slice(0, -1)) expect(bump(full!, matcher).includes(matcher), matcher).toBe(false);
  });
});

// ---------- helpers for the viewer's data and the page check ----------

const REPORT = readFileSync(join(FOLDER, 'TZDB-DIFFERENCES.md'), 'utf8');
const DIFFERENCES: Difference[] = readJson(join(FOLDER, 'tzdb/differences.json')).differences;
const EXPLANATIONS: Explanation[] = readJson(join(FOLDER, 'data/tzdb-explanations.json')).explanations;
const CITATION_FILES = ['citations-fr.json', 'citations-als.json', 'citations-us.json'].map((name) => readJson(join(FOLDER, 'data', name)));
const SECTION_IDS = ['files', 'licence', 'cite', 'corrections', 'comparison', 'explanations', 'sources', 'places', 'rules', 'limits'];
const FORM_URL = 'https://github.com/zodiacs-org/engine/issues/new?template=atlas-correction.yml';
const DASH = /[\u2013\u2014]/gu;
const squash = (text: string) => text.replace(/\s+/gu, ' ').trim();

/** Whether each summary row's counts are its place table's. */
function tableCountsMatch(summary: ReturnType<typeof summaryRows>, tables: ReturnType<typeof placeTables>): boolean {
  return summary.length === tables.length && summary.every((row, at) => {
    const table = tables[at];
    const count = (kind: string) => table.rows.filter((period) => period.result.kind === kind).length;
    return table.place === row.place && table.zone === row.zone && table.rows.length === row.compared
      && count('agrees') === row.agree && count('differs') === row.differ && count('rounding') === row.rounding;
  });
}

/** Whether the comparisons are each place's own zone, and its compareZones, in places.json's order. */
function pairsMatchPlaces(summary: ReturnType<typeof summaryRows>): boolean {
  const places: { id: string; tzdbZone: string; compareZones?: string[] }[] = readJson(join(FOLDER, 'data/places.json')).places;
  const expected = places.flatMap((place) => [`${place.id}|${place.tzdbZone}|own`, ...(place.compareZones ?? []).map((zone) => `${place.id}|${zone}|information`)]);
  return JSON.stringify(summary.map((row) => `${row.place}|${row.zone}|${row.informational ? 'information' : 'own'}`)) === JSON.stringify(expected);
}

/** New York's one rounding period's milliseconds, or null when it has none or differs. */
function newYorkRounding(summary: ReturnType<typeof summaryRows>, tables: ReturnType<typeof placeTables>): string | null {
  const row = summary.find((entry) => entry.place === 'us-new-york');
  const rounding = tables.find((table) => table.place === 'us-new-york')?.rows.filter((period) => period.result.kind === 'rounding') ?? [];
  if (!row || row.differ !== 0 || row.rounding !== 1 || rounding.length !== 1) return null;
  const [period] = rounding;
  return period.result.kind === 'rounding' && period.from === '1870-01-01T04:56:01.620Z' && period.to === '1883-11-18T17:00:00Z'
    && period.rule === 'us-nyc-city-time-before-1883' && period.atlasOffset === '-4:56:01.620' && `${period.tzdbOffset} ${period.tzdbAbbreviation}` === '-4:56:02 LMT'
    ? String(period.result.ms) : null;
}

/** How many rules the differences name, and the differences tallied by their rule's version and flag. */
function rowRules(differences: Difference[], rules: Map<string, Rule>) {
  const named = differences.map((difference) => {
    const rule = rules.get(difference.atlasRule);
    if (!rule) throw new Error(`no rule ${difference.atlasRule}`);
    return rule;
  });
  const tally = (values: (string | number)[]) => Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((other) => other === value).length]),
  );
  return {
    rules: new Set(differences.map((difference) => difference.atlasRule)).size,
    versions: tally(named.map((rule) => rule.version)),
    flags: tally(named.map((rule) => rule.uncertainty.flag)),
  };
}

/** The explanations that match a difference, as atlas/tools/compare-tzdb.mjs matches them. */
function explaining(explanations: Explanation[], difference: Difference): string[] {
  const same = (a: number, b: number) => Math.abs(a - b) < 0.0005;
  return explanations.filter((explanation) => {
    const match = (explanation as unknown as { match: { places: string[]; zones: string[]; rules: string[]; atlasOffsets: number[]; tzdbOffsets: number[] } }).match;
    return match.places.includes(difference.place) && match.zones.includes(difference.zone) && match.rules.includes(difference.atlasRule)
      && match.atlasOffsets.some((value) => same(value, difference.atlasOffsetSeconds))
      && match.tzdbOffsets.some((value) => same(value, difference.tzdbOffsetSeconds));
  }).map((explanation) => explanation.id);
}

/** Every string under a value that holds an en or em dash. */
function dashedStrings(value: unknown): string[] {
  if (typeof value === 'string') return value.match(DASH) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(dashedStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(dashedStrings);
  return [];
}

/** The hub's card for the atlas, as its source writes it. */
function hubCard(): string {
  const source = readFileSync('src/pages/developers/index.astro', 'utf8');
  const link = source.indexOf('<a href="/developers/time-atlas/">');
  const start = source.lastIndexOf('<li>', link);
  const end = source.indexOf('</li>', link);
  expect(link > 0 && start > 0 && end > link, 'the hub has a card for the atlas').toBe(true);
  return source.slice(start, end + '</li>'.length);
}

const html = (text: string | number) => String(text).replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;');

/** The published files, as the page check takes them. */
function pageInputs() {
  return {
    index: readFileSync(join(FOLDER, 'files.json'), 'utf8'),
    data: Object.fromEntries(TIME_ATLAS_DATA_FILES.map((name: string) => [name, readJson(join(FOLDER, 'data', name))])),
    differences: readJson(join(FOLDER, 'tzdb/differences.json')),
    report: REPORT,
  };
}

const SCRIPTS = '<script type="application/ld+json">JSON</script><script src="/assets/site.js"></script>';
function syntheticReference(): string {
  return `<!doctype html><html><head>${SCRIPTS.replace('JSON', '{}')}</head><body><main id="main"><p>reference</p></main></body></html>`;
}

/** A page rendered here from the real data, holding every row, section, entry, link and text the page check reads. */
function syntheticPage(): string {
  const viewer = atlasViewer();
  const { version, base, totals, manifest: atlas } = viewer;
  const folder = `/developers/time-atlas/${version}`;
  const geo = atlas.longitudeSource;
  const engine = `https://github.com/zodiacs-org/engine/blob/${viewer.commit}`;
  const dataset = {
    '@type': 'Dataset', name: atlas.name, version, temporalCoverage: '1870-01-01/1919-12-31', isAccessibleForFree: true,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    distribution: viewer.files.map((file) => ({ '@type': 'DataDownload', contentUrl: `https://zodiacs.org${folder}/${file.path}` })),
  };
  const out: string[] = [`<!doctype html><html><head>${SCRIPTS.replace('JSON', JSON.stringify([dataset]))}</head><body><main id="main">`];
  out.push('<nav>', ...SECTION_IDS.map((id) => `<a href="#${id}">${id}</a>`), '</nav>');
  out.push('<h2 id="files">The files</h2><table>');
  for (const file of [{ path: INDEX_FILE.path, source: "the site's index", bytes: INDEX_FILE.bytes, sha256: INDEX_FILE.sha256 }, ...viewer.files]) {
    out.push(`<tr data-file="${html(file.path)}"><th><a href="${folder}/${html(file.path)}"><code>${html(file.path)}</code></a></th><td>${html(file.source)}</td><td>${file.bytes}</td><td>${file.sha256}</td></tr>`);
  }
  out.push('</table>');
  out.push('<h2 id="licence">Licence and attribution</h2>');
  out.push(`<p>The Zodiacs.org historical time atlas, version ${version}, is licensed under the Creative Commons Attribution 4.0 International licence (CC BY 4.0), <a href="https://creativecommons.org/licenses/by/4.0/">https://creativecommons.org/licenses/by/4.0/</a>. The licensor is Zodiacs.org. The licence&#39;s text is <a href="${folder}/LICENSE.txt">LICENSE.txt</a> in the version&#39;s folder.</p>`);
  out.push(`<p>${html(geo.attribution)} ${html(geo.dataset)}, <a href="${html(geo.url)}">${html(geo.url)}</a>, retrieved ${html(geo.retrieved)}, SHA-256 <code>${html(geo.sha256)}</code>, licensed under ${html(geo.license)}, <a href="${html(geo.licenseUrl)}">${html(geo.licenseUrl)}</a>. Changes: ${html(geo.changes)}</p>`);
  out.push(`<p>The atlas&#39;s tools and its schema, in atlas/tools/ and atlas/schema/ of the engine repository, are under the MIT licence, whose text is that repository&#39;s <a href="${engine}/LICENSE">LICENSE</a>. They are not among the files published here.</p>`);
  out.push(`<p>As far as the atlas could establish, every text its citations quote is in the public domain, and LICENSING.md says why for each kind of source. The licence covers the atlas&#39;s own work, not the texts it quotes, and no scan or OCR text of a source is copied.</p>`);
  out.push(`<p>The tzdb ${base.tzdb} extract the comparison uses, atlas/tzdb/tzdb-${base.tzdb}.json in the engine repository, is in the public domain like tzdb itself. It is linked here, not published.</p>`);
  out.push(`<h2 id="cite">How to cite</h2><p>Cite it as:</p><pre><code>Zodiacs.org historical time atlas, version ${version}, https://zodiacs.org/developers/time-atlas/ (its files are listed in https://zodiacs.org${folder}/files.json), from ${viewer.sourceUrl}, licensed CC BY 4.0.</code></pre><p>Cite the rule ids and versions you relied on.</p>`);
  out.push(`<h2 id="corrections">Corrections</h2><p>To correct the atlas or add to it, open an <a href="${html(FORM_URL)}">Atlas correction issue</a> in zodiacs-org/engine, or a pull request there, giving the rule id (or the place and period), what the clock showed and when it changed, with the clock the change is read on, and a citation to a primary source: its type, title, date and issuer, a stable link, the page and column, its language, and a verbatim excerpt of at most 40 words in the original language. Issues there are public. <a href="${folder}/CORRECTIONS.md">CORRECTIONS.md</a> says how a correction is reviewed. The copy in this version&#39;s folder is frozen; <a href="https://github.com/zodiacs-org/engine/blob/main/atlas/CORRECTIONS.md">the live one</a>, with its log, is on the engine&#39;s main branch. An accepted correction gives the rule a new version, and the site publishes the changed atlas only as a new version, at its own path. The files of ${version} never change.</p>`);
  out.push(`<h2 id="comparison">The comparison</h2><p>The base is tzdb ${base.tzdb} with backzone. The tarball&#39;s SHA-256 is <code>${base.tarballSha256}</code>, and the compiled tree has ${base.treeFiles} files, with the digest <code>${base.treeSha256}</code>, over ${base.window[0]} to ${base.window[1]}. A difference is a period in which the two offsets differ by one second or more. tzdb stores whole seconds.</p>`);
  out.push('<table>');
  for (const pair of viewer.pairs) {
    const s = pair.summary;
    out.push(`<tr data-comparison="${html(`${pair.place}|${pair.zone}`)}" data-counts="${s.compared} ${s.agree} ${s.differ} ${s.rounding} ${s.daysDiffering}"><th><a href="#${pair.id}">${html(pair.name)}</a> <code>${pair.place}</code></th><td>${html(pair.zone)}${pair.informational ? ' (for information)' : ''}</td></tr>`);
  }
  out.push(`</table><p>${totals.compared} periods.</p>`);
  out.push(`<p>Two explanations end with a finding about tzdb ${base.tzdb}, quoted as the atlas states it. At version ${version} neither had been sent to the tz project.</p>`);
  out.push('<h2 id="explanations">Explanations</h2>');
  for (const explanation of viewer.explanations) {
    out.push(`<section id="${explanation.id}" data-explanation-section data-count="${explanation.count}"><h3><code>${explanation.id}</code></h3><p><code>${html(explanation.category)}</code>, ${explanation.count} ${explanation.count === 1 ? 'period' : 'periods'}</p><p>${html(explanation.explanation)}</p>`);
    if (explanation.tzdbReport) out.push(`<p><strong>Finding about tzdb 2025c, not sent to the tz project:</strong> ${html(explanation.tzdbReport)}</p>`);
    out.push(`<p>${explanation.pairs.map((id) => `<a href="#${id}">${id}</a>`).join(', ')}</p><p>${explanation.citations.map((id) => `<a href="#${citationAnchor(id)}"><code>${id}</code></a>`).join(', ')}</p></section>`);
  }
  out.push('<h2 id="sources">Sources</h2><ol>');
  for (const source of viewer.citations) {
    out.push(`<li id="${citationAnchor(source.id)}" data-citation><p><code>${source.id}</code> <span lang="${source.language}">${html(source.title)}</span>, ${html(source.date)}, ${html(source.issuer ?? '')}, ${html(source.publication ?? '')}, ${html(source.locator)}. <a href="${html(source.url)}">Source</a></p>${source.gloss ? `<p>${html(source.gloss)}</p>` : ''}</li>`);
  }
  out.push('</ol><h2 id="places">Place by place</h2>');
  for (const pair of viewer.pairs) {
    out.push(`<section id="${pair.id}" data-pair="${html(`${pair.place}|${pair.zone}`)}"><h3>${html(pair.name)} (<code>${pair.place}</code>) against ${html(pair.zone)}${pair.informational ? ' (for information)' : ''}</h3><ul>`);
    for (const span of pair.agree) out.push(`<li data-agree>${span.from} to ${span.to}</li>`);
    out.push('</ul><table>');
    for (const period of pair.periods) {
      const rule = `<td><a href="#${ruleAnchor(period.rule)}"><code>${period.rule}</code></a> v${period.ruleVersion}, ${period.ruleFlag}</td>`;
      const cells = `<td>${period.from}</td><td>${period.to}</td><td>${period.length}</td>${rule}<td>${html(period.atlasOffset)}</td><td>${html(period.tzdbOffset)} ${period.tzdbAbbreviation}</td>`;
      if (period.result.kind === 'differs') {
        out.push(`<tr id="${period.id}" data-result="differs" data-explanation="${period.explanation}">${cells}<td>differs by ${period.result.seconds} s, explained by <a href="#${period.explanation}"><code>${period.explanation}</code></a></td></tr>`);
      } else {
        out.push(`<tr data-result="${period.result.kind}">${cells}<td>${period.result.kind === 'rounding' ? `within a second (${period.result.ms} ms)` : 'agrees'}</td></tr>`);
      }
    }
    out.push('</table></section>');
  }
  out.push('<h2 id="rules">Rules</h2><dl>');
  for (const rule of viewer.rules) {
    out.push(`<dt id="${ruleAnchor(rule.id)}" data-rule data-version="${rule.version}" data-flag="${rule.flag}"><code>${rule.id}</code> ${html(rule.title)}, version ${rule.version}</dt><dd><p>${rule.flag}: ${html(rule.reason)}</p>`);
    out.push(rule.changes.length ? `<ul>${rule.changes.map((change) => `<li data-change>Version ${change.version}, ${change.date}: ${html(change.summary)}</li>`).join('')}</ul>` : '<p>No changes.</p>');
    out.push('</dd>');
  }
  out.push('</dl><h2 id="limits">Limits</h2><p>Limits.</p></main></body></html>');
  return out.join('\n');
}
