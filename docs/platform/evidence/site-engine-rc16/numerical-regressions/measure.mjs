/** Local rc.15/rc.16 attribution, no external reference values or live requests.
 * Run from the repository root: node docs/platform/evidence/site-engine-rc16/numerical-regressions/measure.mjs
 * Uses the same current site adapter/scanner/scene on two separately bundled engines.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = process.cwd();
const out = dirname(fileURLToPath(import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'rc16-regressions-'));
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const entry = `
export { computeChart, computeBodies, bodyLongitude, longitudeSpeed } from './src/lib/engine/full.ts';
export { scanTransitContacts } from './src/lib/engine/transit-scan.ts';
export { buildSceneModel } from './src/lib/scene/build.ts';
export { computeAngles } from './src/lib/engine/houses.ts';
export { compareEnvelopes } from './src/lib/compare/diff.ts';
export { buildEnvelope, ORDINARY } from './src/lib/compare/fixtures.ts';
export { natalChart } from '@zodiacs/engine';
export { createNatalEnvelope, NATAL_RECEIPT_CONVENTION_SETS } from '@zodiacs/engine/receipt';
export { timeBasis, tilt, elapsedDays } from './src/lib/engine/time-basis.mjs';
export { MakeTime, SetDeltaTFunction, e_tilt, SiderealTime } from 'astronomy-engine';
export { deltaT } from '@zodiacs/engine/deltat';
`;
async function bundle(version) {
  const archive = resolve(root, `vendor/zodiacs-engine-0.1.1-rc.${version}.tgz`);
  const dir = join(work, `rc${version}`);
  mkdirSync(dir);
  execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', dir]);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json')));
  const output = join(work, `rc${version}.mjs`);
  await build({ stdin: { contents: entry, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: output,
    plugins: [{ name: 'archived-engine', setup(builder) {
      builder.onResolve({ filter: /^@zodiacs\/engine(?:\/|$)/ }, args => ({ path: join(dir, pkg.exports[args.path === '@zodiacs/engine' ? '.' : `.${args.path.slice('@zodiacs/engine'.length)}`].import) }));
      builder.onResolve({ filter: /^astronomy-engine$/ }, () => ({ path: resolve(root, 'node_modules/astronomy-engine/esm/astronomy.js') }));
    } }], logLevel: 'error' });
  return { api: await import(pathToFileURL(output).href), artifact: { version: pkg.version, sha256: digest(archive) } };
}
const signed = d => ((d + 540) % 360 + 360) % 360 - 180;
const iso = ms => new Date(ms).toISOString();
try {
  const [old, current] = await Promise.all([bundle(15), bundle(16)]);
  const A = old.api, B = current.api;
  function frame(ms) {
    const basis = B.timeBasis(ms, 'utc');
    B.SetDeltaTFunction(() => basis.deltaT.seconds);
    const time = B.MakeTime(basis.ut1Days);
    const five = B.e_tilt(time), full = B.tilt(time.tt);
    const oldGast = B.SiderealTime(time);
    B.SetDeltaTFunction(B.deltaT);
    return { basis, five, full, dpsiDeltaDegrees: (full.dpsi - five.dpsi) / 3600,
      oldGast, newGast: ((oldGast + (full.ee - five.ee * 15) / 54000) % 24 + 24) % 24 };
  }
  function longitude(body, ms) {
    const before = A.bodyLongitude(body, new Date(ms)), after = B.bodyLongitude(body, new Date(ms));
    const f = frame(ms), observed = signed(after - before), expected = f.dpsiDeltaDegrees;
    const residualDegrees = observed - expected;
    assert(Math.abs(residualDegrees) < 2e-10, `${body} ${iso(ms)}: longitude not explained by Δψ ${residualDegrees}`);
    return { body, utc: iso(ms), before, after, deltaDegrees: observed, dpsiDeltaDegrees: expected, residualDegrees };
  }
  function speed(body, ms) {
    const step = body.endsWith('Node') ? 0.25 : 0.001;
    const left = longitude(body, ms - step * 864e5), right = longitude(body, ms + step * 864e5);
    const before = A.longitudeSpeed(body, new Date(ms)), after = B.longitudeSpeed(body, new Date(ms));
    const denominator = B.elapsedDays(B.timeBasis(ms - step * 864e5), B.timeBasis(ms + step * 864e5), 2 * step);
    const expected = (right.dpsiDeltaDegrees - left.dpsiDeltaDegrees) / denominator;
    const residualDegreesPerDay = after - before - expected;
    assert(Math.abs(residualDegreesPerDay) < 1e-9, `${body}: speed not explained by Δψ central difference`);
    return { body, utc: iso(ms), before, after, deltaDegreesPerDay: after - before, expectedDeltaDegreesPerDay: expected, residualDegreesPerDay };
  }
  function station(api, body, from, to) {
    let low = Date.parse(from), high = Date.parse(to);
    const sign = api.longitudeSpeed(body, new Date(low)) > 0;
    assert.notEqual(api.longitudeSpeed(body, new Date(high)) > 0, sign);
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if ((api.longitudeSpeed(body, new Date(mid)) > 0) === sign) low = mid; else high = mid;
    }
    return { utc: iso(high), ms: high, beforeSpeed: api.longitudeSpeed(body, new Date(high - 10000)), afterSpeed: api.longitudeSpeed(body, new Date(high + 10000)) };
  }
  function contacts(api, target, from = '2026-01-01', to = '2027-01-01') {
    return api.scanTransitContacts({ bodies: [{ body: 'Sun', lon: target }], angles: null }, new Date(from), new Date(to), { transitBodies: ['Mercury'] }).filter(x => x.aspect === 'conjunction').map(x => x.exactUtc);
  }
  const stationCases = [ ['Mercury', '2026-02-26T06:40:00Z', '2026-02-26T06:55:00Z'], ['Saturn', '2026-07-26T19:50:00Z', '2026-07-26T20:05:00Z'] ].map(([body, from, to]) => {
    const before = station(A, body, from, to), after = station(B, body, from, to);
    return { body, before, after, deltaMilliseconds: after.ms - before.ms, attribution: speed(body, before.ms) };
  });
  const nearStation = '2026-02-26T06:47:23.924Z';
  const mercury = { fixedTarget: 352.56407473871195, before: contacts(A, 352.56407473871195), after: contacts(B, 352.56407473871195), nearStation,
    nearContacts: contacts(B, B.bodyLongitude('Mercury', new Date(nearStation)), '2026-02-25', '2026-02-27') };
  mercury.crossingAttribution = [...new Set([...mercury.before, ...mercury.after])].map(utc => longitude('Mercury', Date.parse(utc)));
  const maximumSamples = Array.from({length: 2001}, (_, i) => { const ms = Date.parse('2026-02-26T06:47:13.000Z') + i; return { utc: iso(ms), lon: B.bodyLongitude('Mercury', new Date(ms)) }; });
  const maximum = Math.max(...maximumSamples.map(x => x.lon));
  mercury.maximumLongitudeSamples = maximumSamples.filter(x => x.lon === maximum);
  const stationMs = Date.parse('2026-02-26T06:47:13.947Z');
  const stationLon = B.bodyLongitude('Mercury', new Date(stationMs));
  const halfSecondEnvelope = Math.max(...[-500, 500].map(offset => Math.abs(signed(B.bodyLongitude('Mercury', new Date(stationMs + offset)) - stationLon))));
  mercury.nearTangentContacts = contacts(B, stationLon - 0.8 * halfSecondEnvelope, '2026-02-25', '2026-02-27');
  assert.equal(mercury.nearTangentContacts.length, 2);
  mercury.nearTangentSeparationMilliseconds = Date.parse(mercury.nearTangentContacts[1]) - Date.parse(mercury.nearTangentContacts[0]);
  assert(mercury.nearTangentSeparationMilliseconds > 100);
  const phaseMs = Date.parse('2024-01-16T10:18:00Z');
  const moon = longitude('Moon', phaseMs), sun = longitude('Sun', phaseMs);
  const phase = { moon, sun, angleBefore: ((moon.before - sun.before) % 360 + 360) % 360, angleAfter: ((moon.after - sun.after) % 360 + 360) % 360 };
  const ordinary = A.ORDINARY;
  const rounding = [A, B].map(api => {
    const base = api.buildEnvelope(ordinary);
    return { version: base.receipt.engine.version, comparisons: [-1, 2, 6].map(ms => ({ milliseconds: ms, rows: api.compareEnvelopes(base, api.buildEnvelope({ ...ordinary, utc: iso(Date.parse(ordinary.utc) + ms) }), { engineVersion: base.receipt.engine.version }).differences.filter(r => r.id.endsWith('-lon')) })) };
  });
  const pinnedSpeeds = [A, B].map(api => {
    const chart = api.natalChart(ordinary);
    const pin = chart.deltaT.seconds;
    const pinned = api.natalChart({ ...ordinary, deltaT: pin });
    return { version: chart.engineVersion, deltaT: pin, speeds: chart.bodies.map((body, i) => ({ body: body.body, modelled: body.speed, pinned: pinned.bodies[i].speed, printedModelled: body.speed.toFixed(6), printedPinned: pinned.bodies[i].speed.toFixed(6) })) };
  });
  const roundingAttribution = [-1, 0, 2, 6].flatMap(offset => B.computeBodies(new Date(ordinary.utc)).map(({ body }) => longitude(body, Date.parse(ordinary.utc) + offset)));
  const speedAttribution = B.computeBodies(new Date(ordinary.utc)).map(({ body }) => speed(body, Date.parse(ordinary.utc)));
  const chartInput = { utc: new Date('1907-07-06T15:06:36.000Z'), latitude: 19.35, longitude: -99.16, houseSystem: 'whole', timeKnown: true, flags: ['lmt'] };
  const chartA = A.computeChart(chartInput), chartB = B.computeChart(chartInput);
  const f = frame(chartInput.utc.getTime());
  const anglesA = B.computeAngles({ gastHours: f.oldGast, obliquity: f.five.tobl, latitude: chartInput.latitude, longitude: chartInput.longitude });
  const anglesB = B.computeAngles({ gastHours: f.newGast, obliquity: f.full.tobl, latitude: chartInput.latitude, longitude: chartInput.longitude });
  for (const key of ['asc', 'mc', 'dsc', 'ic']) {
    assert(Math.abs(signed(anglesA[key] - chartA.angles[key])) < 1e-10);
    assert(Math.abs(signed(anglesB[key] - chartB.angles[key])) < 1e-10);
  }
  const scene = { input: chartInput, frame: { dpsiDeltaDegrees: f.dpsiDeltaDegrees, obliquityBefore: f.five.tobl, obliquityAfter: f.full.tobl, gastBefore: f.oldGast, gastAfter: f.newGast }, anglesBefore: chartA.angles, anglesAfter: chartB.angles,
    longitudes: chartA.bodies.map(body => longitude(body.body, chartInput.utc.getTime())), speeds: chartA.bodies.map(body => speed(body.body, chartInput.utc.getTime())) };
  const stable = value => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'number' ? Number(item.toFixed(7)) : item));
  const sceneA = stable(A.buildSceneModel(chartA)), sceneB = stable(B.buildSceneModel(chartB));
  const differences = [];
  function collect(a, b, path = '') {
    if (Object.is(a, b)) return;
    if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
      assert.deepEqual(Object.keys(a), Object.keys(b), `Scene shape changed at ${path}`);
      for (const key of Object.keys(a)) collect(a[key], b[key], path ? `${path}.${key}` : key);
    } else differences.push({ path, before: a, after: b });
  }
  collect(sceneA, sceneB);
  for (const difference of differences) {
    assert(difference.path === 'engineVersion' || /^(?:anchor\.lon|angles\.(?:asc|mc|dsc|ic)|bodies\.\d+\.(?:lon|drawLon|signDegree|speed))$/.test(difference.path), `Unexpected scene change: ${difference.path}`);
  }
  scene.snapshotDifferences = differences;
  function random(seed) { let state = seed >>> 0; return () => { state = (state + 0x6D2B79F5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const shareFrame = { samples: 0, oldMaximumErrorDegrees: 0, correctedMaximumErrorDegrees: 0, gateDegrees: 1e-6 };
  for (const [latitudes, perLatitude, seed] of [ [[15, -15, 45, -45, 54.81, -54.81, 60], 45, 20260928], [[61.22, 62.45, 64.18, 64.84, 66.5, 66.53, 68.97, 69.65, 69.35, 78.22], 12, 20260929] ]) {
    const next = random(seed);
    for (const latitude of latitudes) for (let i = 0; i < perLatitude; i += 1) {
      const utc = new Date(Math.floor(Date.UTC(1950, 0, 1) + next() * (Date.UTC(2008, 11, 31) - Date.UTC(1950, 0, 1))));
      const longitude = -180 + next() * 360;
      const chart = B.computeChart({ utc, latitude, longitude, houseSystem: 'whole', timeKnown: true });
      const f = frame(utc.getTime());
      for (const [kind, gastHours, obliquity] of [['old', f.oldGast, f.five.tobl], ['corrected', f.newGast, f.full.tobl]]) {
        const angles = B.computeAngles({ gastHours, obliquity, latitude, longitude });
        for (const key of ['asc', 'mc']) shareFrame[`${kind}MaximumErrorDegrees`] = Math.max(shareFrame[`${kind}MaximumErrorDegrees`], Math.abs(signed(angles[key] - chart.angles[key])));
      }
      shareFrame.samples += 1;
    }
  }
  assert(shareFrame.correctedMaximumErrorDegrees < shareFrame.gateDegrees);
  const value = { schema: 'rc16-numerical-regressions/1', node: process.version, engines: [old.artifact, current.artifact], method: 'Separately bundled archived rc.15 and rc.16 with the same site adapters. Longitude changes attributed to full-minus-five-term Δψ on the same TT; speed changes to its sampled derivative; angle changes to true obliquity and equation of equinoxes. No external reference ephemeris.', stationCases, mercury, phase, rounding, roundingAttribution, pinnedSpeeds, speedAttribution, scene, shareFrame };
  writeFileSync(join(out, 'measurements.json'), `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify({ stationCases, mercury, phase, pinnedSpeeds, sceneFrame: scene.frame }, null, 2));
} finally { rmSync(work, { recursive: true, force: true }); }
