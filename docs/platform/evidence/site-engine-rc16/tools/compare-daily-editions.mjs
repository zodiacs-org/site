/** Review rc.15 -> rc.16 daily facts and copy, including all replay goldens.
 * Run from the repository root on Node 22 with rc.16 installed:
 * node docs/platform/evidence/site-engine-rc16/tools/compare-daily-editions.mjs \
 *   <rc.15 site commit> vendor/zodiacs-engine-0.1.1-rc.15.tgz
 *
 * Uses only this site's engines. No reference ephemeris or personal fixtures.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const [baseCommit, archive] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/u.test(baseCommit ?? '') || !archive) {
  throw new Error('usage: compare-daily-editions.mjs <40-hex base commit> <rc.15 archive>');
}
const root = process.cwd();
const work = mkdtempSync(join(tmpdir(), 'zodiacs-daily-review-'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])]));
  return value;
}
function differences(a, b, path = '') {
  if (canonical(a) === canonical(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((key) => differences(a[key], b[key], path ? `${path}.${key}` : key));
  }
  return [{ path, old: a ?? null, new: b ?? null }];
}
const copy = (publication) => publication.signs.map(({ sign, headline, lines, todayLine }) => ({
  sign, headline, lines: lines.map(({ text, receipt }) => ({ text, receipt })),
  todayLine: { text: todayLine.text, receipt: todayLine.receipt },
}));

try {
  const oldRoot = join(work, 'old');
  mkdirSync(oldRoot);
  execFileSync('sh', ['-c', `git archive ${baseCommit} src scripts | tar -x -C "${oldRoot}"`], { cwd: root });
  mkdirSync(join(oldRoot, 'node_modules/@zodiacs/engine'), { recursive: true });
  execFileSync('tar', ['-xzf', resolve(root, archive), '--strip-components=1', '-C', join(oldRoot, 'node_modules/@zodiacs/engine')]);
  symlinkSync(resolve(root, 'node_modules/astronomy-engine'), join(oldRoot, 'node_modules/astronomy-engine'));
  async function bundle(from, name) {
    const outfile = join(work, `${name}.mjs`);
    await esbuild.build({ stdin: {
      contents: "export { computeDailySnapshot } from './scripts/daily-snapshot-lib.mjs'; export { buildDailyPublication } from './src/lib/daily-publication.ts'; export { ENGINE_VERSION } from '@zodiacs/engine'; export { bodyLongitude } from '@zodiacs/engine/internal';",
      resolveDir: from, sourcefile: `${name}-entry.mjs`, loader: 'js',
    }, bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile, logLevel: 'error' });
    return import(pathToFileURL(outfile).href);
  }
  const old = await bundle(oldRoot, 'old');
  const current = await bundle(root, 'current');
  const monthly = { files: 0, byKind: {}, unexpectedChanges: [] };
  for (const file of readdirSync(resolve(root, 'src/data')).filter((file) => /^transits-\d{4}-\d{2}\.json$/u.test(file)).sort()) {
    const a = JSON.parse(readFileSync(resolve(oldRoot, 'src/data', file)));
    const b = JSON.parse(readFileSync(resolve(root, 'src/data', file)));
    monthly.files += 1;
    for (const kind of ['ingresses', 'lunations', 'stations', 'aspects']) {
      if (a[kind].length !== b[kind].length) throw new Error(`${file}/${kind}: count changed`);
      const stats = monthly.byKind[kind] ??= { events: 0, instantsMoved: 0, displayedMinutesMoved: 0, datesMoved: 0, maxInstantShiftMs: 0, maxExample: null };
      for (let i = 0; i < b[kind].length; i += 1) {
        const left = a[kind][i];
        const right = b[kind][i];
        stats.events += 1;
        const diff = differences(left, right);
        const unexpected = diff.filter(({ path }) => !['at', 'degree', 'aDegree', 'bDegree'].includes(path));
        if (unexpected.length) monthly.unexpectedChanges.push({ file, kind, index: i, changes: unexpected });
        const shift = Date.parse(right.at) - Date.parse(left.at);
        if (!shift) continue;
        stats.instantsMoved += 1;
        if (left.at.slice(0, 16) !== right.at.slice(0, 16)) stats.displayedMinutesMoved += 1;
        if (left.at.slice(0, 10) !== right.at.slice(0, 10)) stats.datesMoved += 1;
        if (Math.abs(shift) > stats.maxInstantShiftMs) {
          stats.maxInstantShiftMs = Math.abs(shift);
          stats.maxExample = { file, ...Object.fromEntries(Object.entries(right).filter(([key]) => !['at', 'degree', 'aDegree', 'bDegree'].includes(key))), oldAt: left.at, newAt: right.at, shiftMs: shift };
        }
      }
    }
  }
  const speed = (engine, body, instant) => {
    const at = Date.parse(instant);
    const delta = engine.bodyLongitude(body, new Date(at + 0.25 * 86400000)) - engine.bodyLongitude(body, new Date(at - 0.25 * 86400000));
    return (((delta + 540) % 360) - 180) / 0.5;
  };
  const station = monthly.byKind.stations.maxExample;
  const stationRootCheck = { body: station.planet, stepDays: 0.25,
    oldAt: station.oldAt, newAt: station.newAt,
    oldEngineSpeedAtOld: speed(old, station.planet, station.oldAt),
    newEngineSpeedAtOld: speed(current, station.planet, station.oldAt),
    oldEngineSpeedAtNew: speed(old, station.planet, station.newAt),
    newEngineSpeedAtNew: speed(current, station.planet, station.newAt),
    units: 'degrees/day; same +/-0.25-day central difference as build-transits.mjs',
  };
  const goldens = JSON.parse(readFileSync(resolve(root, 'src/data/daily-replay-goldens.json')));
  const cases = [];
  for (const date of [...goldens.cases.map((row) => row.date), '2026-09-30', '2026-10-01']) {
    const a = await old.computeDailySnapshot(date, oldRoot);
    const b = await current.computeDailySnapshot(date, root);
    const ap = old.buildDailyPublication(a);
    const bp = current.buildDailyPublication(b);
    const longitudeShifts = b.bodies.map((body, i) => (body.lon - a.bodies[i].lon) * 3600);
    const changes = differences(a, b);
    const unexpected = changes.filter(({ path }) => !/^bodies\.\d+\.(lon|degree)$/u.test(path)
      && !/^events\.\d+\.(at|degree|aDegree|bDegree)$/u.test(path));
    cases.push({ date, oldFactsSha256: sha256(canonical(a)), factsSha256: sha256(canonical(b)),
      oldPublicationSha256: sha256(canonical(ap)), publicationSha256: sha256(canonical(bp)),
      bodyLongitudeShiftArcsec: longitudeShifts[0],
      bodyCommonRotationSpreadArcsec: Math.max(...longitudeShifts) - Math.min(...longitudeShifts),
      bodySignsAndDirectionsUnchanged: canonical(a.bodies.map(({ body, sign, retrograde }) => ({ body, sign, retrograde }))) === canonical(b.bodies.map(({ body, sign, retrograde }) => ({ body, sign, retrograde }))),
      moonMetadataUnchanged: canonical(a.moon) === canonical(b.moon),
      eventChanges: changes.filter(({ path }) => path.startsWith('events.')),
      copyChanges: differences(copy(ap), copy(bp)), unexpectedChanges: unexpected,
    });
  }
  process.stdout.write(`${JSON.stringify({ schema: 'zodiacs.daily-rc16-review.v1', node: process.version,
    old: { sourceCommit: baseCommit, engineVersion: old.ENGINE_VERSION, archive, archiveSha256: sha256(readFileSync(archive)) },
    new: { engineVersion: current.ENGINE_VERSION },
    cause: 'Full IAU 2000B nutation changes the common longitude origin. The time-varying correction moves ingress and station roots; common rotations cancel in lunation and aspect separations. Numerical bounds describe these eight editions only.',
    monthly, stationRootCheck, cases }, null, 2)}\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
