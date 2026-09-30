/**
 * The CPU cost of one engine call on rc.14 and on rc.15, in one process.
 *
 *   node docs/platform/evidence/compute-api-2026-09-29/tools/engine-per-call.mjs > engine-per-call.json
 *
 * Unpacks the two vendored archives (vendor/zodiacs-engine-0.1.1-rc.14.tgz and
 * rc.15) into a temporary directory, each with its own copy of the installed
 * astronomy-engine, since the engine keeps state in that module. Then, for an
 * instant in every year from 1800 to 2199, it times the calls the compute API
 * makes, alternating the two releases call by call so that other work on the
 * machine falls on both alike: positions(), natalChart() with angles and
 * houses, and a 92-day crossing search for Mercury's ingresses at the API's
 * step. Three rounds; CPU time from process.cpuUsage.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../..');
const RELEASES = ['0.1.1-rc.14', '0.1.1-rc.15'];
const ROUNDS = 3;
const DAY = 86_400_000;

const scratch = mkdtempSync(join(tmpdir(), 'engine-per-call-'));
try {
  const engines = {};
  for (const version of RELEASES) {
    const modules = join(scratch, version, 'node_modules');
    mkdirSync(join(modules, '@zodiacs'), { recursive: true });
    execFileSync('tar', ['-xzf', join(ROOT, `vendor/zodiacs-engine-${version}.tgz`), '-C', join(scratch, version)]);
    renameSync(join(scratch, version, 'package'), join(modules, '@zodiacs/engine'));
    cpSync(join(ROOT, 'node_modules/astronomy-engine'), join(modules, 'astronomy-engine'), { recursive: true });
    engines[version] = await import(pathToFileURL(join(modules, '@zodiacs/engine/dist/index.js')).href);
    if (engines[version].ENGINE_VERSION !== version) throw new Error(`unpacked ${engines[version].ENGINE_VERSION}, not ${version}`);
  }

  const instants = Array.from({ length: 400 }, (_, index) => new Date(Date.UTC(1800 + index, index % 12, 1 + (index % 28), 13, 37)));
  const calls = {
    positions: (engine, date) => engine.positions(date),
    natalChart: (engine, date) => engine.natalChart({ utc: date, latitude: 48.85, longitude: 2.35, houseSystem: 'placidus', timeKnown: true }),
    'crossing search, 92 days': (engine, date) => engine.searchLongitudeCrossings('Mercury', 0, date, new Date(date.getTime() + 92 * DAY), { stepDays: 5 }),
  };
  const cpuMs = (fn) => {
    const before = process.cpuUsage();
    fn();
    const used = process.cpuUsage(before);
    return (used.user + used.system) / 1000;
  };

  const rows = [];
  for (const [call, run] of Object.entries(calls)) {
    for (const version of RELEASES) for (const date of instants.slice(0, 20)) run(engines[version], date);
    const totals = Object.fromEntries(RELEASES.map((version) => [version, 0]));
    for (let round = 0; round < ROUNDS; round += 1) {
      for (const date of instants) for (const version of RELEASES) totals[version] += cpuMs(() => run(engines[version], date));
    }
    const [old, current] = RELEASES.map((version) => totals[version] / ROUNDS);
    rows.push({
      call,
      calls: instants.length,
      cpuMsFor400Calls: { [RELEASES[0]]: +old.toFixed(1), [RELEASES[1]]: +current.toFixed(1) },
      ratio: +(current / old).toFixed(3),
    });
  }
  console.log(JSON.stringify({
    measured: new Date().toISOString().slice(0, 10),
    what: 'CPU time of 400 calls, one instant a year 1800-2199, the two releases alternating call by call; mean of three rounds',
    runtime: { node: process.version, cpu: cpus()[0]?.model ?? 'unknown', cores: cpus().length },
    rows,
  }, null, 2));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
