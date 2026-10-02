/**
 * The site's chart outputs on engine rc.15 and on rc.16, compared value by
 * value.
 *
 *   node docs/platform/evidence/site-engine-rc16/tools/compare-site-outputs.mjs \
 *     <base commit> vendor/zodiacs-engine-0.1.1-rc.15.tgz > site-outputs.json
 *
 * Run from the repository root with rc.16 installed (`npm ci`). The "old" side
 * is the base commit's own `src/lib/engine/` read from git objects (never the
 * working tree) and bundled against the rc.15 archive, extracted into a
 * temporary directory. The "new" side is this checkout's `src/lib/engine/`
 * bundled against the installed rc.16. Both are bundled by the repository's
 * esbuild for Node and loaded into one process, so each carries its own copy
 * of astronomy-engine and its own clock. Every call is made on both sides in
 * the same order, and every value is compared exactly: numbers with
 * `Object.is`, dates by their milliseconds, errors by constructor and message.
 *
 * The corpus is #600's (site-engine-rc14/tools/compare-site-outputs.mjs), with
 * the frozen node/polar corpus now read from the independent references, whose
 * instants and places are the removed Swiss pack's, and two more sections:
 *
 * - every tenth day from 1800-01-01 to 2199-12-31 at 12:00 UTC (14,610
 *   instants) through `computeBodies`, `bodyLongitude` and `longitudeSpeed`
 *   for all twelve bodies, through `computeChart` in both of the site's house
 *   systems at the three polar places of the node/polar corpus and three
 *   ordinary ones, and with no birth time with and without a place;
 * - the node/polar corpus itself: its three node instants and its three polar
 *   places in both house systems;
 * - the site's secondary progressions, for births drawn from the same corpus;
 * - retained from rc.15, the cases of the dated Swiss benchmark
 *   (docs/platform/evidence/swiss-benchmark/tools/corpus.mjs, measure and
 *   holdout), through `computeChart` as its dump casts them, with no Swiss
 *   value read;
 * - retained from rc.15, the unchanged time-basis edges: each leap second from 1972 to
 *   2017, 1972-01-01, 1973-01-02 (UT1 − UTC from finals2000A instead of C04),
 *   2027-06-28 (the leap-second list's expiry) and 2027-10-02 (the IERS
 *   table's end), at −1 s, −1 ms, 0, +1 ms and +1 s, through `computeBodies`
 *   and `computeChart` (London, Placidus), and `longitudeSpeed` for all twelve
 *   bodies, whose samples straddle the edge.
 *
 * Every difference is grouped by section, by the era of the instant it was
 * computed at (before 1972, 1972-01-01 to 2027-10-02 where both read the
 * instant as UTC, or after), and by the path of the value, a body's row named
 * by its body, with its count, its largest absolute difference (and, for
 * values in [0, 360], the largest circular one), and up to two examples;
 * cusps are grouped by house system. `signChanges` counts the bodies,
 * ascendants and midheavens whose sign differs. No reference ephemeris is
 * used; this compares the site with itself. `output-mechanisms.mjs` verifies
 * each attribution with independent numerical witnesses; it does not classify
 * changes merely by their path. The benchmark's ordinary synthetic comparison
 * cases are retained; the Moon enclosure/P4.5 holdout is never read or run.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { createMechanisms } from './output-mechanisms.mjs';

const [baseCommit, oldArchive] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/u.test(baseCommit ?? '') || !oldArchive) {
  console.error('usage: compare-site-outputs.mjs <40-hex base commit> <rc.15 archive>');
  process.exit(2);
}
const root = process.cwd();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 1 << 26 });

const ENGINE_SOURCES = ['full.ts', 'chart-adapter.ts', 'types.ts', 'progressions.ts'];
const IERS_FROM = Date.UTC(1972, 0, 1);
const IERS_TO = Date.UTC(2027, 9, 2);
const eraOf = (ms) => (ms < IERS_FROM ? 'before-1972' : ms <= IERS_TO ? '1972-to-2027-10-02' : 'after-2027-10-02');
const work = mkdtempSync(join(tmpdir(), 'zodiacs-site-outputs-'));


try {
  // The old side: the base commit's adapter sources on the rc.15 archive.
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
  const mechanisms = await createMechanisms({ root, old, work });
  if (A.ENGINE_VERSION !== '0.1.1-rc.15' || B.ENGINE_VERSION !== '0.1.1-rc.16') throw new Error('Expected exact rc.15 and rc.16 packages');

  const report = {
    schema: 'zodiacs-site-engine-output-comparison/v3',
    generatedAt: new Date().toISOString(),
    node: process.version,
    esbuild: esbuild.version,
    toolSources: Object.fromEntries(['compare-site-outputs.mjs', 'output-mechanisms.mjs'].map((name) => [name, sha256(readFileSync(resolve(root, 'docs/platform/evidence/site-engine-rc16/tools', name)))])),
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
      archive: 'vendor/zodiacs-engine-0.1.1-rc.16.tgz',
      archiveSha256: sha256(readFileSync(resolve(root, 'vendor/zodiacs-engine-0.1.1-rc.16.tgz'))),
      installed: JSON.parse(readFileSync(resolve(root, 'node_modules/@zodiacs/engine/package.json'), 'utf8')).version,
      engineVersion: B.ENGINE_VERSION,
      bundledPackageFiles: after.packageFiles.length,
    },
    eras: {
      'before-1972': 'instants before 1972-01-01T00:00Z: both read as UT1 with the ΔT model',
      '1972-to-2027-10-02': 'instants from 1972-01-01T00:00Z to 2027-10-02T00:00Z: both read them as UTC through the same IERS leap seconds and UT1 − UTC',
      'after-2027-10-02': 'instants after 2027-10-02T00:00Z: both read as UT1 with the ΔT model',
    },
    corpus: {},
    sections: {},
    differences: [],
  };

  // ---- exact comparison ------------------------------------------------------
  const found = new Map();
  let section;
  let era;
  let attribution;
  function note(path, a, b, context) {
    const key = `${section} ${era} ${path}`;
    const entry = found.get(key) ?? { section, era, path, count: 0, examples: [] };
    entry.count += 1;
    const cause = attribution?.(path) ?? 'unexplained';
    entry.causes ??= {};
    entry.causes[cause] = (entry.causes[cause] ?? 0) + 1;
    if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) {
      const absolute = Math.abs(a - b);
      if (!(entry.maxAbsolute >= absolute)) {
        entry.maxAbsolute = absolute;
        entry.maxAbsoluteAt = context;
      }
      if (a >= 0 && a <= 360 && b >= 0 && b <= 360) {
        const circular = Math.min(absolute, 360 - absolute);
        if (!(entry.maxCircular >= circular)) entry.maxCircular = circular;
      }
    }
    if (typeof a === 'string' && typeof b === 'string' && /^\d{4}-\d\d-\d\dT.*Z$/u.test(a) && /^\d{4}-\d\d-\d\dT.*Z$/u.test(b)) {
      const milliseconds = Math.abs(Date.parse(a) - Date.parse(b));
      if (!(entry.maxMilliseconds >= milliseconds)) entry.maxMilliseconds = milliseconds;
    }
    if (entry.examples.length < 2) entry.examples.push({ context, old: a, new: b });
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
      // Rows of bodies are told apart by body, so each body's differences have their own maxima.
      for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
        const body = typeof a[i]?.body === 'string' && a[i].body === b[i]?.body ? a[i].body : '';
        compare(a[i], b[i], `${path}[${body}]`, context);
      }
      return;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
      for (const key of keys) {
        if (!(key in a) || !(key in b)) {
          report.sections[section].values += 1;
          note(`${path}.${key}`, key in a ? 'present' : 'absent', key in b ? 'present' : 'absent', context);
        } else {
          // A house system's cusps are told apart by system: whole-sign cusps move in steps of 30°.
          const system = typeof a[key]?.system === 'string' && a[key].system === b[key]?.system ? `(${a[key].system})` : '';
          compare(a[key], b[key], `${path}.${key}${system}`, context);
        }
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
  /** Counts the signs that differ: of each body, and of the ascendant and midheaven. */
  const signChanges = {};
  function countSigns(a, b, context) {
    const bodiesA = Array.isArray(a) ? a : a?.bodies;
    const bodiesB = Array.isArray(b) ? b : b?.bodies;
    const pairs = [];
    if (Array.isArray(bodiesA) && Array.isArray(bodiesB)) {
      bodiesA.forEach((row, i) => { if (row?.body === bodiesB[i]?.body) pairs.push([row.body, row.lon, bodiesB[i].lon]); });
    }
    if (a?.angles && b?.angles) pairs.push(['ascendant', a.angles.asc, b.angles.asc], ['midheaven', a.angles.mc, b.angles.mc]);
    for (const [what, x, y] of pairs) {
      if (Math.floor(x / 30) === Math.floor(y / 30)) continue;
      const key = `${section} ${era} ${what}`;
      const entry = signChanges[key] ?? { section, era, what, count: 0, examples: [] };
      entry.count += 1;
      if (entry.examples.length < 2) entry.examples.push({ context, old: x, new: y });
      signChanges[key] = entry;
    }
  }
  function call(label, context, at, runOld, runNew) {
    report.sections[section].calls += 1;
    attribution = null;
    era = Number.isFinite(at) ? eraOf(at) : 'invalid';
    const a = outcome(runOld);
    const b = outcome(runNew);
    if (a.ok !== b.ok) {
      report.sections[section].values += 1;
      note(`${label} outcome`, a.ok ? 'returned' : a.error, b.ok ? 'returned' : b.error, context);
      return;
    }
    attribution = a.ok ? mechanisms.attest(label, context, at, a.value, b.value) : null;
    if (a.ok) countSigns(a.value, b.value, context);
    compare(a.ok ? a.value : a.error, b.ok ? b.value : b.error, a.ok ? label : `${label} error`, context);
  }
  function begin(name, description) {
    section = name;
    process.stderr.write(`${new Date().toISOString()} section ${name}\n`);
    report.sections[name] = { description, calls: 0, values: 0, differingValues: 0 };
  }

  // ---- corpus ----------------------------------------------------------------
  const DAY = 86_400_000;
  const instants = [];
  for (let t = Date.UTC(1800, 0, 1, 12); t < Date.UTC(2200, 0, 1); t += 10 * DAY) instants.push(t);
  if (process.env.RC16_OUTPUT_SMOKE === '1') instants.splice(8);
  const fixturePath = 'src/lib/engine/fixtures/independent-node-polar.json';
  const fixture = JSON.parse(readFileSync(resolve(root, fixturePath), 'utf8'));
  const polar = fixture.polar.map((row) => ({
    id: row.id.replace(/^polar-/u, ''), latitude: row.latitudeDegrees, longitude: row.longitudeDegreesEastPositive,
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
  // Leap seconds: the first instant of each day on which TAI − UTC changed, 1972-07-01 to 2017-01-01.
  const LEAP_DAYS = [[1972, 6], [1973, 0], [1974, 0], [1975, 0], [1976, 0], [1977, 0], [1978, 0], [1979, 0], [1980, 0],
    [1981, 6], [1982, 6], [1983, 6], [1985, 6], [1988, 0], [1990, 0], [1991, 0], [1992, 6], [1993, 6], [1994, 6],
    [1996, 0], [1997, 6], [1999, 0], [2006, 0], [2009, 0], [2012, 6], [2015, 6], [2017, 0]].map(([y, m]) => Date.UTC(y, m, 1));
  const EDGES = [...LEAP_DAYS, Date.UTC(1972, 0, 1), Date.UTC(1973, 0, 2), Date.UTC(2027, 5, 28), IERS_TO].sort((a, b) => a - b);
  const EDGE_OFFSETS = [-1000, -1, 0, 1, 1000];
  report.corpus = {
    instants: instants.length,
    cadenceDays: 10,
    from: new Date(instants[0]).toISOString(),
    to: new Date(instants.at(-1)).toISOString(),
    locations,
    houseSystems: HOUSES,
    nodePolarCorpus: { file: fixturePath, sha256: sha256(readFileSync(resolve(root, fixturePath))) },
    timeBasisEdges: EDGES.map((edge) => new Date(edge).toISOString()),
    timeBasisEdgeOffsetsMs: EDGE_OFFSETS,
  };

  begin('positions', 'computeBodies at every corpus instant: body order and every field of all twelve rows');
  for (const t of instants) {
    call('computeBodies', new Date(t).toISOString(), t, () => A.computeBodies(new Date(t)), () => B.computeBodies(new Date(t)));
  }

  begin('singleBody', 'bodyLongitude and longitudeSpeed for all twelve bodies at every corpus instant');
  for (const t of instants) {
    for (const body of BODIES) {
      const context = `${new Date(t).toISOString()} ${body}`;
      call('bodyLongitude', context, t, () => A.bodyLongitude(body, new Date(t)), () => B.bodyLongitude(body, new Date(t)));
      call('longitudeSpeed', context, t, () => A.longitudeSpeed(body, new Date(t)), () => B.longitudeSpeed(body, new Date(t)));
    }
  }

  begin('charts', 'computeChart at every corpus instant, six locations, whole sign and Placidus, time known; every field');
  for (const t of instants) {
    for (const place of locations) {
      for (const houseSystem of HOUSES) {
        const input = () => ({ utc: new Date(t), latitude: place.latitude, longitude: place.longitude, houseSystem, timeKnown: true });
        call('chart', `${new Date(t).toISOString()} ${place.id} ${houseSystem}`, t, () => A.computeChart(input()), () => B.computeChart(input()));
      }
    }
  }

  begin('unknownTime', 'computeChart at every corpus instant with no birth time, with and without a place');
  for (const t of instants) {
    const withPlace = () => ({ utc: new Date(t), latitude: 51.5074, longitude: -0.1278, houseSystem: 'placidus', timeKnown: false });
    const withoutPlace = () => ({ utc: new Date(t), houseSystem: 'whole', timeKnown: false });
    call('chart', `${new Date(t).toISOString()} no time, place`, t, () => A.computeChart(withPlace()), () => B.computeChart(withPlace()));
    call('chart', `${new Date(t).toISOString()} no time, no place`, t, () => A.computeChart(withoutPlace()), () => B.computeChart(withoutPlace()));
  }

  begin('frozenNodePolar', 'the node/polar corpus: node instants through computeBodies, polar places through computeChart in both systems');
  for (const row of fixture.trueNode) {
    const utc = row.input.utc;
    call('computeBodies', row.id, Date.parse(utc), () => A.computeBodies(new Date(utc)), () => B.computeBodies(new Date(utc)));
  }
  for (const row of fixture.polar) {
    for (const houseSystem of HOUSES) {
      const input = () => ({ utc: new Date(row.input.utc), latitude: row.latitudeDegrees,
        longitude: row.longitudeDegreesEastPositive, houseSystem, timeKnown: true });
      call('chart', `${row.id} ${houseSystem}`, Date.parse(row.input.utc), () => A.computeChart(input()), () => B.computeChart(input()));
    }
  }

  // The dated Swiss benchmark's own cases (docs/platform/evidence/swiss-benchmark/,
  // the 2026-09-20 and 2026-09-25 runs that the pages quote). No Swiss value is
  // read: this records how far the site's charts move at those instants, which
  // bounds how far the quoted statistics could move if the benchmark were run again.
  const benchmark = await import(pathToFileURL(resolve(root, 'docs/platform/evidence/swiss-benchmark/tools/corpus.mjs')).href);
  begin('swissBenchmarkCorpus', 'the Swiss benchmark\'s measure and holdout cases through computeChart, as dump-zodiacs.mjs casts them (Placidus, time known)');
  for (const kase of [...benchmark.MEASURE, ...benchmark.HOLDOUT]) {
    const input = () => ({ utc: new Date(kase.utc), latitude: kase.latitude, longitude: kase.longitude, houseSystem: kase.houseSystem, timeKnown: kase.timeKnown });
    call('chart', `${kase.id} ${kase.utc}`, Date.parse(kase.utc), () => A.computeChart(input()), () => B.computeChart(input()));
  }

  begin('timeBasisEdges', 'the unchanged rc.15/rc.16 time-basis edges at −1 s, −1 ms, 0, +1 ms and +1 s: computeBodies, computeChart (London, Placidus) and longitudeSpeed for all twelve bodies');
  for (const edge of EDGES) {
    for (const offset of EDGE_OFFSETS) {
      const t = edge + offset;
      const iso = new Date(t).toISOString();
      call('computeBodies', iso, t, () => A.computeBodies(new Date(t)), () => B.computeBodies(new Date(t)));
      const input = () => ({ utc: new Date(t), latitude: 51.5074, longitude: -0.1278, houseSystem: 'placidus', timeKnown: true });
      call('chart', `${iso} london placidus`, t, () => A.computeChart(input()), () => B.computeChart(input()));
      for (const body of BODIES) {
        call('longitudeSpeed', `${iso} ${body}`, t, () => A.longitudeSpeed(body, new Date(t)), () => B.longitudeSpeed(body, new Date(t)));
      }
    }
  }

  // ---- progressions ----------------------------------------------------------
  begin('progressions', 'progressedInstant and progressedBodies: the base commit\'s adapter on rc.15 against this branch\'s on rc.16; the era is the progressed instant\'s');
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
    const targets = [...offsets.map((offset) => birth + offset), Date.parse('2026-09-30T00:00:00Z')];
    for (const target of targets) {
      const context = `${new Date(birth).toISOString()} → ${new Date(target).toISOString()}`;
      const progressed = A.progressedInstant(new Date(birth), new Date(target)).getTime();
      call('progressedInstant', context, progressed, () => A.progressedInstant(new Date(birth), new Date(target)),
        () => B.progressedInstant(new Date(birth), new Date(target)));
      call('progressedBodies', context, progressed, () => A.progressedBodies(new Date(birth), new Date(target)),
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
      call('progressedInstant', `${birth} → ${target}`, expected, () => A.progressedInstant(new Date(birth), new Date(target)),
        () => B.progressedInstant(new Date(birth), new Date(target)));
      mappings += 1;
    }
  }
  report.sections.progressionMapping.mappings = mappings;

  begin('invalidDates', 'invalid dates, which no site path passes: recorded, not required to agree');
  const invalid = new Date(Number.NaN);
  call('progressedInstant', 'invalid birth', Number.NaN, () => A.progressedInstant(invalid, new Date(0)), () => B.progressedInstant(invalid, new Date(0)));
  call('progressedBodies', 'invalid target', Number.NaN, () => A.progressedBodies(new Date(0), invalid), () => B.progressedBodies(new Date(0), invalid));
  call('computeBodies', 'invalid date', Number.NaN, () => A.computeBodies(invalid), () => B.computeBodies(invalid));

  report.differences = [...found.values()].sort((x, y) => `${x.section} ${x.era} ${x.path}`.localeCompare(`${y.section} ${y.era} ${y.path}`));
  report.signChanges = Object.values(signChanges).sort((x, y) => `${x.section} ${x.era} ${x.what}`.localeCompare(`${y.section} ${y.era} ${y.what}`));
  const byEra = {};
  for (const entry of report.differences) byEra[entry.era] = (byEra[entry.era] ?? 0) + entry.count;
  report.mechanisms = mechanisms.report();
  const byClass = {};
  const unexplained = [];
  for (const entry of report.differences) {
    for (const [cause, count] of Object.entries(entry.causes)) byClass[cause] = (byClass[cause] ?? 0) + count;
    if (entry.causes.unexplained) unexplained.push({ section: entry.section, era: entry.era, path: entry.path, count: entry.causes.unexplained });
  }
  report.classes = { byClass, unexplained };
  report.summary = {
    calls: Object.values(report.sections).reduce((sum, value) => sum + value.calls, 0),
    values: Object.values(report.sections).reduce((sum, value) => sum + value.values, 0),
    differingValues: Object.values(report.sections).reduce((sum, value) => sum + value.differingValues, 0),
    differingValuesByEra: byEra,
    paths: report.differences.length,
    unexplainedPaths: report.classes.unexplained.length,
    unexplainedValues: report.classes.unexplained.reduce((sum, row) => sum + row.count, 0),
    mechanismFailures: report.mechanisms.failures,
    smokeOnly: process.env.RC16_OUTPUT_SMOKE === '1',
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.summary.unexplainedValues || report.summary.mechanismFailures) process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
