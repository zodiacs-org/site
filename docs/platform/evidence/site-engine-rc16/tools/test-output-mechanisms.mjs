/** Negative controls: a field-name match alone must never explain a change. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { createMechanisms } from './output-mechanisms.mjs';

const root = process.cwd();
const work = mkdtempSync(join(tmpdir(), 'rc16-output-controls-'));
const old = join(work, 'old');
const base = 'ed55dacb449ada6e4893676c80bd0d9ba73db576';
try {
  mkdirSync(join(old, 'node_modules/@zodiacs/engine'), { recursive: true });
  execFileSync('sh', ['-c', `git archive ${base} src/lib/engine | tar -x -C "${old}"`]);
  execFileSync('tar', ['xzf', 'vendor/zodiacs-engine-0.1.1-rc.15.tgz', '--strip-components=1', '-C', join(old, 'node_modules/@zodiacs/engine')]);
  symlinkSync(resolve(root, 'node_modules/astronomy-engine'), join(old, 'node_modules/astronomy-engine'));
  async function bundle(from, name) {
    const outfile = join(work, `${name}.mjs`);
    await esbuild.build({ stdin: { contents: "export { computeChart } from './src/lib/engine/full.ts';", resolveDir: from }, bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile, logLevel: 'error' });
    return import(pathToFileURL(outfile).href);
  }
  const A = await bundle(old, 'old');
  const B = await bundle(root, 'new');
  const mechanisms = await createMechanisms({ root, old, work });
  const input = { utc: new Date('2000-01-01T12:00:00Z'), latitude: 51.5074, longitude: -0.1278, houseSystem: 'placidus', timeKnown: true };
  const a = A.computeChart(input);
  const b = B.computeChart(input);
  const ordinary = mechanisms.attest('chart', 'negative-controls baseline', input.utc.getTime(), a, b);
  for (const path of ['chart.bodies[Sun].lon', 'chart.bodies[Sun].lat', 'chart.bodies[Sun].speed', 'chart.angles.asc', 'chart.houses(placidus).cusps[]', 'chart.aspects[].orb']) assert.ok(ordinary(path), path);
  assert.equal(mechanisms.report().failures, 0);
  const controls = [
    ['longitude perturbation', (chart) => chart.bodies[0].lon += 0.001, 'chart.bodies[Sun].lon'],
    ['latitude perturbation', (chart) => chart.bodies[0].lat += 0.001, 'chart.bodies[Sun].lat'],
    ['speed perturbation', (chart) => chart.bodies[0].speed += 0.001, 'chart.bodies[Sun].speed'],
    ['angle perturbation', (chart) => chart.angles.asc += 0.001, 'chart.angles.asc'],
    ['cusp perturbation', (chart) => chart.houses.cusps[1] += 0.001, 'chart.houses(placidus).cusps[]'],
    ['aspect perturbation', (chart) => chart.aspects[0].orb += 0.001, 'chart.aspects[].orb'],
    ['version perturbation', (chart) => chart.engineVersion = '0.1.1-rc.17', 'chart.engineVersion'],
  ];
  const results = [];
  for (const [name, mutate, path] of controls) {
    const altered = structuredClone(b);
    mutate(altered);
    const why = mechanisms.attest('chart', name, input.utc.getTime(), a, altered);
    assert.equal(why(path), null, name);
    results.push({ name, alteredPath: path, result: 'unexplained, correctly refused' });
  }
  assert.equal(ordinary('chart.flags[]'), null, 'unknown metadata cannot be auto-classified');
  console.log(JSON.stringify({ schema: 'zodiacs-site-output-mechanism-controls/v1', node: process.version, baseline: 'all tested mechanisms explained, zero failures', negativeControls: results, unknownMetadata: 'unexplained, correctly refused', pass: true }, null, 2));
} finally { rmSync(work, { recursive: true, force: true }); }
