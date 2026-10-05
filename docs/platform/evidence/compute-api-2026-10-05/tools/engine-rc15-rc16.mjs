/**
 * The engine calls the compute API makes, timed on engine rc.15 and rc.16 in
 * one process, alternately, so that whatever else the machine does falls on
 * both alike:
 *
 *   node docs/platform/evidence/compute-api-2026-10-05/tools/engine-rc15-rc16.mjs > engine-rc15-rc16.txt
 *
 * Both packages are unpacked from vendor/ into a temporary folder and load
 * astronomy-engine from the site's node_modules. Each figure is the median of
 * ten rounds of 300 calls, in CPU milliseconds a call; the sign changes of an
 * events request, every body's twelve boundaries over 92 days, ten rounds of
 * three searches.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../..');
const dir = mkdtempSync(join(tmpdir(), 'zodiacs-engine-rc15-rc16-'));
const load = async (version) => {
  const into = join(dir, version);
  mkdirSync(into);
  execFileSync('tar', ['xzf', join(repo, `vendor/zodiacs-engine-0.1.1-${version}.tgz`), '-C', into]);
  symlinkSync(join(repo, 'node_modules'), join(into, 'package/node_modules'));
  return import(pathToFileURL(join(into, 'package/dist/index.js')).href);
};
try {
  const [e15, e16] = [await load('rc.15'), await load('rc.16')];
  const cpu = () => { const used = process.cpuUsage(); return (used.user + used.system) / 1000; };
  const START = Date.UTC(1900, 0, 1);
  const STEP = 9.7 * 86_400_000;
  const time = (call, calls) => { const before = cpu(); for (let i = 0; i < calls; i += 1) call(i); return (cpu() - before) / calls; };
  const work = {
    'positions(), every body': (engine) => (i) => engine.positions(new Date(START + i * STEP)),
    'natalChart(), placidus': (engine) => (i) => engine.natalChart({ utc: new Date(START + i * STEP), latitude: 51.5, longitude: -0.1, houseSystem: 'placidus' }),
    'moonPhase()': (engine) => (i) => engine.moonPhase(new Date(START + i * STEP)),
  };
  // An events request's sign changes: every body's twelve boundaries over 92 days, every 5 days or every day for the Moon.
  const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  const signChanges = (engine) => (i) => {
    const from = new Date(START + i * 37 * 86_400_000);
    const to = new Date(from.getTime() + 92 * 86_400_000);
    for (const body of BODIES) for (let k = 0; k < 12; k += 1) engine.searchLongitudeCrossings(body, k * 30, from, to, { stepDays: body === 'Moon' ? 1 : 5 });
  };
  console.log(`engine ${e15.ENGINE_VERSION ?? 'rc.15'} against ${e16.ENGINE_VERSION ?? 'rc.16'}, Node ${process.version}; CPU ms a call, median of ten rounds of 300`);
  for (const [name, make] of Object.entries(work)) {
    const [f15, f16] = [make(e15), make(e16)];
    for (let i = 0; i < 200; i += 1) { f15(i); f16(i); }
    const a = [];
    const b = [];
    for (let round = 0; round < 10; round += 1) { a.push(time(f15, 300)); b.push(time(f16, 300)); }
    a.sort((x, y) => x - y);
    b.sort((x, y) => x - y);
    console.log(`${name.padEnd(26)} rc.15 ${a[5].toFixed(3)}  rc.16 ${b[5].toFixed(3)}  rc.16 / rc.15 ${(b[5] / a[5]).toFixed(2)}`);
  }
  {
    const [f15, f16] = [signChanges(e15), signChanges(e16)];
    f15(0);
    f16(0);
    const a = [];
    const b = [];
    for (let round = 0; round < 10; round += 1) { a.push(time(f15, 3)); b.push(time(f16, 3)); }
    a.sort((x, y) => x - y);
    b.sort((x, y) => x - y);
    console.log(`${'92 days of sign changes'.padEnd(26)} rc.15 ${a[5].toFixed(1)}  rc.16 ${b[5].toFixed(1)}  rc.16 / rc.15 ${(b[5] / a[5]).toFixed(2)}  (ms a search of every body's twelve boundaries)`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
