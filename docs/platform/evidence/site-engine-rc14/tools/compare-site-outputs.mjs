/**
 * The site's chart outputs on engine rc.10 and on rc.14, compared value by
 * value.
 *
 *   node docs/platform/evidence/site-engine-rc14/tools/compare-site-outputs.mjs \
 *     <base commit> vendor/zodiacs-engine-0.1.1-rc.10.tgz > site-outputs.json
 *
 * Run from the repository root with rc.14 installed (`npm ci`). The "old" side
 * is the base commit's own `src/lib/engine/` read from git objects (never the
 * working tree) and bundled against the rc.10 archive, extracted into a
 * temporary directory. The "new" side is this checkout's `src/lib/engine/`
 * bundled against the installed rc.14. Both are bundled by the repository's
 * esbuild for Node and loaded into one process, so each carries its own copy
 * of astronomy-engine and its own ΔT clock. Every call is made on both sides
 * in the same order, and every value is compared exactly: numbers with
 * `Object.is`, dates by their milliseconds, errors by constructor and message.
 *
 * The corpus is the one the rc.10 adoption evidence used:
 *
 * - every tenth day from 1800-01-01 to 2199-12-31 at 12:00 UTC (14,610
 *   instants), the Swiss refresh's corpus, here through the site's own
 *   `computeBodies`, `bodyLongitude` and `longitudeSpeed`, and through
 *   `computeChart` in both of the site's house systems at the three locations
 *   of the frozen node/polar corpus (scripts/platform-engine-report.mjs) and
 *   three ordinary ones, plus once with no birth time;
 * - the frozen node/polar corpus itself: its three node instants and its three
 *   polar locations in both house systems;
 * - the site's secondary progressions, the base commit's own code against this
 *   branch's package-backed adapter, for births drawn from the same corpus.
 *
 * It writes one JSON document to stdout: counts, and every difference found,
 * grouped by the path of the value that differs, with up to five examples of
 * each. No reference ephemeris is used; this compares the site with itself.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const [baseCommit, oldArchive] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/u.test(baseCommit ?? '') || !oldArchive) {
  console.error('usage: compare-site-outputs.mjs <40-hex base commit> <rc.10 archive>');
  process.exit(2);
}
const root = process.cwd();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 1 << 26 });

const ENGINE_SOURCES = ['full.ts', 'chart-adapter.ts', 'types.ts', 'progressions.ts'];
const work = mkdtempSync(join(tmpdir(), 'zodiacs-site-outputs-'));
try {
  // The old side: the base commit's adapter sources on the rc.10 archive.
  const old = join(work, 'old');
  mkdirSync(join(old, 'src/lib/engine'), { recursive: true });
  execFileSync('sh', ['-c', `git archive ${baseCommit} src/lib/engine | tar -x -C "${old}"`], { cwd: root });
  mkdirSync(join(old, 'node_modules/@zodiacs/engine'), { recursive: true });
  execFileSync('tar', ['-xzf', resolve(root, oldArchive), '--strip-components=1',
    '-C', join(old, 'node_modules/@zodiacs/engine')]);
  symlinkSync(resolve(root, 'node_modules/astronomy-engine'), join(old, 'node_modules/astronomy-engine'));

  const entry = [
    "export { computeBodies, computeChart, bodyLongitude, longitudeSpeed } from './src/lib/engine/full.ts';",
    "export { progressedBodies, progressedInstant, PROGRESSION_DAYS_PER_YEAR } from './src/lib/engine/progressions.ts';",
    "export { ENGINE_VERSION } from './src/lib/engine/types.ts';",
  ].join('\n');
  async function bundle(from, name) {
    const result = await esbuild.build({
      stdin: { contents: entry, resolveDir: from, sourcefile: `${name}-entry.mjs`, loader: 'js' },
      bundle: true, platform: 'node', format: 'esm', target: 'node22', write: true,
      outfile: join(work, `${name}.mjs`), metafile: true, logLevel: 'error',
    });
    const packageFiles = Object.keys(result.metafile.inputs)
      .filter((path) => path.includes('node_modules/@zodiacs/engine/'));
    return { module: await import(pathToFileURL(join(work, `${name}.mjs`)).href), packageFiles };
  }
  const before = await bundle(old, 'old');
  const after = await bundle(root, 'new');
  const A = before.module;
  const B = after.module;

  const report = {
    schema: 'zodiacs-site-engine-output-comparison/v1',
    generatedAt: new Date().toISOString(),
    node: process.version,
    esbuild: esbuild.version,
    old: {
      sourceCommit: baseCommit,
      sources: Object.fromEntries(ENGINE_SOURCES.map((name) => [
        `src/lib/engine/${name}`, sha256(git('cat-file', 'blob', `${baseCommit}:src/lib/engine/${name}`)),
      ])),
      archive: oldArchive,
      archiveSha256: sha256(readFileSync(resolve(root, oldArchive))),
      engineVersion: A.ENGINE_VERSION,
      bundledPackageFiles: before.packageFiles.length,
    },
    new: {
      sources: Object.fromEntries(ENGINE_SOURCES.map((name) => [
        `src/lib/engine/${name}`, sha256(readFileSync(resolve(root, 'src/lib/engine', name))),
      ])),
      installed: JSON.parse(readFileSync(resolve(root, 'node_modules/@zodiacs/engine/package.json'), 'utf8')).version,
      engineVersion: B.ENGINE_VERSION,
      bundledPackageFiles: after.packageFiles.length,
    },
    corpus: {},
    sections: {},
    differences: [],
  };

  // ---- exact comparison ------------------------------------------------------
  const found = new Map();
  let section;
  function note(path, a, b, context) {
    const key = `${section} ${path}`;
    const entry = found.get(key) ?? { section, path, count: 0, examples: [] };
    entry.count += 1;
    if (entry.examples.length < 5) entry.examples.push({ context, old: a, new: b });
    found.set(key, entry);
    report.sections[section].differingValues += 1;
  }
  const shape = (value) => (value instanceof Date ? value.toISOString() : value);
  function compare(a, b, path, context) {
    if (typeof a === 'number' && typeof b === 'number') {
      report.sections[section].values += 1;
      if (!Object.is(a, b)) note(path, a, b, context);
      return;
    }
    if (a instanceof Date && b instanceof Date) {
      report.sections[section].values += 1;
      if (!Object.is(a.getTime(), b.getTime())) note(path, shape(a), shape(b), context);
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        report.sections[section].values += 1;
        note(`${path}.length`, a.length, b.length, context);
      }
      for (let i = 0; i < Math.min(a.length, b.length); i += 1) compare(a[i], b[i], `${path}[]`, context);
      return;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
      for (const key of keys) {
        if (!(key in a) || !(key in b)) {
          report.sections[section].values += 1;
          note(`${path}.${key}`, key in a ? 'present' : 'absent', key in b ? 'present' : 'absent', context);
        } else compare(a[key], b[key], `${path}.${key}`, context);
      }
      return;
    }
    report.sections[section].values += 1;
    if (!Object.is(a, b)) note(path, shape(a), shape(b), context);
  }
  function outcome(run) {
    try {
      return { ok: true, value: run() };
    } catch (error) {
      return { ok: false, error: { name: error?.constructor?.name ?? typeof error, message: String(error?.message ?? error) } };
    }
  }
  function call(label, context, runOld, runNew) {
    report.sections[section].calls += 1;
    const a = outcome(runOld);
    const b = outcome(runNew);
    if (a.ok !== b.ok) {
      report.sections[section].values += 1;
      note(`${label} outcome`, a.ok ? 'returned' : a.error, b.ok ? 'returned' : b.error, context);
      return;
    }
    compare(a.ok ? a.value : a.error, b.ok ? b.value : b.error, a.ok ? label : `${label} error`, context);
  }
  function begin(name, description) {
    section = name;
    report.sections[name] = { description, calls: 0, values: 0, differingValues: 0 };
  }

  // ---- corpus ----------------------------------------------------------------
  const DAY = 86_400_000;
  const instants = [];
  for (let t = Date.UTC(1800, 0, 1, 12); t < Date.UTC(2200, 0, 1); t += 10 * DAY) instants.push(t);
  const fixture = JSON.parse(readFileSync(resolve(root, 'src/lib/engine/fixtures/swiss-node-polar.fixture.json'), 'utf8'));
  const polar = fixture.polar.map((row) => ({
    id: row.id.replace(/^swiss-polar-/u, ''), latitude: row.latitudeDegrees, longitude: row.longitudeDegreesEastPositive,
  }));
  const locations = [
    ...polar,
    // Round coordinates of three ordinary places, nobody's birth.
    { id: 'london', latitude: 51.5074, longitude: -0.1278 },
    { id: 'sydney', latitude: -33.8688, longitude: 151.2093 },
    { id: 'quito', latitude: -0.1807, longitude: -78.4678 },
  ];
  const HOUSES = ['whole', 'placidus'];
  const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
    'North Node', 'South Node'];
  report.corpus = {
    instants: instants.length,
    cadenceDays: 10,
    from: new Date(instants[0]).toISOString(),
    to: new Date(instants.at(-1)).toISOString(),
    locations,
    houseSystems: HOUSES,
    frozenNodePolarFixtureSha256: sha256(readFileSync(resolve(root, 'src/lib/engine/fixtures/swiss-node-polar.fixture.json'))),
  };

  begin('positions', 'computeBodies at every corpus instant: body order and every field of all twelve rows');
  for (const t of instants) {
    call('computeBodies', new Date(t).toISOString(), () => A.computeBodies(new Date(t)), () => B.computeBodies(new Date(t)));
  }

  begin('singleBody', 'bodyLongitude and longitudeSpeed for all twelve bodies at every corpus instant');
  for (const t of instants) {
    for (const body of BODIES) {
      const context = `${new Date(t).toISOString()} ${body}`;
      call('bodyLongitude', context, () => A.bodyLongitude(body, new Date(t)), () => B.bodyLongitude(body, new Date(t)));
      call('longitudeSpeed', context, () => A.longitudeSpeed(body, new Date(t)), () => B.longitudeSpeed(body, new Date(t)));
    }
  }

  begin('charts', 'computeChart at every corpus instant, six locations, whole sign and Placidus, time known; every field');
  for (const t of instants) {
    for (const place of locations) {
      for (const houseSystem of HOUSES) {
        const input = () => ({ utc: new Date(t), latitude: place.latitude, longitude: place.longitude, houseSystem, timeKnown: true });
        call('chart', `${new Date(t).toISOString()} ${place.id} ${houseSystem}`, () => A.computeChart(input()), () => B.computeChart(input()));
      }
    }
  }

  begin('unknownTime', 'computeChart at every corpus instant with no birth time, with and without a place');
  for (const t of instants) {
    const withPlace = () => ({ utc: new Date(t), latitude: 51.5074, longitude: -0.1278, houseSystem: 'placidus', timeKnown: false });
    const withoutPlace = () => ({ utc: new Date(t), houseSystem: 'whole', timeKnown: false });
    call('chart', `${new Date(t).toISOString()} no time, place`, () => A.computeChart(withPlace()), () => B.computeChart(withPlace()));
    call('chart', `${new Date(t).toISOString()} no time, no place`, () => A.computeChart(withoutPlace()), () => B.computeChart(withoutPlace()));
  }

  begin('frozenNodePolar', 'the rc.10 parity corpus: node instants through computeBodies, polar locations through computeChart in both systems');
  for (const row of fixture.trueNode) {
    const utc = row.input.utc;
    call('computeBodies', row.id, () => A.computeBodies(new Date(utc)), () => B.computeBodies(new Date(utc)));
  }
  for (const row of fixture.polar) {
    for (const houseSystem of HOUSES) {
      const input = () => ({ utc: new Date(row.input.utc), latitude: row.latitudeDegrees,
        longitude: row.longitudeDegreesEastPositive, houseSystem, timeKnown: true });
      call('chart', `${row.id} ${houseSystem}`, () => A.computeChart(input()), () => B.computeChart(input()));
    }
  }

  // ---- progressions ----------------------------------------------------------
  begin('progressions', 'progressedInstant and progressedBodies: the base commit\'s own code on rc.10 against this branch\'s package-backed adapter on rc.14');
  const YEAR = 365.2422 * DAY;
  const births = [];
  for (let i = 0; i < instants.length; i += 97) {
    // Vary the time of day: noon plus i × 7,919 s, wrapped into the day.
    births.push(instants[i] - 12 * 3_600_000 + ((i * 7_919_000) % DAY));
  }
  births.push(Date.parse('1907-07-06T15:06:36Z'), Date.parse('2000-02-29T23:59:59.999Z'), 0, -1,
    Date.parse('1969-12-31T23:59:59.999Z'), Date.parse('1800-01-01T00:00:00Z'), Date.parse('2199-12-31T23:59:59Z'));
  const offsets = [0, 1, DAY, YEAR, 29.530589 * YEAR, 90 * YEAR, -YEAR, -0.5 * DAY];
  let bodyCases = 0;
  for (const birth of births) {
    const targets = [...offsets.map((offset) => birth + offset), Date.parse('2026-09-29T00:00:00Z')];
    for (const target of targets) {
      const context = `${new Date(birth).toISOString()} → ${new Date(target).toISOString()}`;
      call('progressedInstant', context, () => A.progressedInstant(new Date(birth), new Date(target)),
        () => B.progressedInstant(new Date(birth), new Date(target)));
      call('progressedBodies', context, () => A.progressedBodies(new Date(birth), new Date(target)),
        () => B.progressedBodies(new Date(birth), new Date(target)));
      bodyCases += 1;
    }
  }
  report.sections.progressions.births = births.length;
  report.sections.progressions.bodyCases = bodyCases;

  begin('progressionMapping', 'progressedInstant only, across the whole Date range, where no position is computed');
  const LIMIT = 8.64e15;
  const extremes = [-LIMIT, -LIMIT + 1, -1e15, -62_135_596_800_000, -1, 0, 1, 253_402_300_799_999, 1e15, LIMIT - 1, LIMIT];
  let mappings = 0;
  for (const birth of extremes) {
    for (const target of extremes) {
      const expected = birth + ((target - birth) / YEAR) * DAY;
      if (!Number.isFinite(expected) || Math.abs(expected) > LIMIT) continue;
      call('progressedInstant', `${birth} → ${target}`, () => A.progressedInstant(new Date(birth), new Date(target)),
        () => B.progressedInstant(new Date(birth), new Date(target)));
      mappings += 1;
    }
  }
  report.sections.progressionMapping.mappings = mappings;

  begin('invalidDates', 'invalid dates, which no site path passes: recorded, not required to agree');
  const invalid = new Date(Number.NaN);
  call('progressedInstant', 'invalid birth', () => A.progressedInstant(invalid, new Date(0)), () => B.progressedInstant(invalid, new Date(0)));
  call('progressedBodies', 'invalid target', () => A.progressedBodies(new Date(0), invalid), () => B.progressedBodies(new Date(0), invalid));
  call('computeBodies', 'invalid date', () => A.computeBodies(invalid), () => B.computeBodies(invalid));

  report.differences = [...found.values()];
  const unexpected = report.differences.filter((entry) => entry.section !== 'invalidDates'
    && !/(?:^|\.)engineVersion$/u.test(entry.path));
  report.summary = {
    calls: Object.values(report.sections).reduce((sum, value) => sum + value.calls, 0),
    values: Object.values(report.sections).reduce((sum, value) => sum + value.values, 0),
    differingValues: Object.values(report.sections).reduce((sum, value) => sum + value.differingValues, 0),
    differencesOtherThanEngineVersionAndInvalidDates: unexpected.reduce((sum, value) => sum + value.count, 0),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
