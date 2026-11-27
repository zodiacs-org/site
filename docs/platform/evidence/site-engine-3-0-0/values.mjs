// Run from the site root: node docs/platform/evidence/site-engine-3-0-0/values.mjs
// Compares what engine 2.1.0 (vendor/zodiacs-engine-2.1.0.tgz, unpacked to a
// temporary directory) and the installed 3.0.0 compute, on DE440 (2.1.0's
// default; 3.0.0 after useDe440()) and on astronomy-engine (3.0.0's default;
// 2.1.0 after setDefaultEphemeris), and prints the counts as JSON.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const site = process.cwd();
const scratch = mkdtempSync(join(tmpdir(), 'zodiacs-engine-2-1-0-'));
try {
  const unpacked = join(scratch, 'node_modules/@zodiacs/engine');
  mkdirSync(unpacked, { recursive: true });
  execFileSync('tar', ['-xzf', resolve(site, 'vendor/zodiacs-engine-2.1.0.tgz'), '-C', unpacked, '--strip-components=1']);
  // Its own copy of astronomy-engine, so the two engines share no module state.
  cpSync(resolve(site, 'node_modules/astronomy-engine'), join(scratch, 'node_modules/astronomy-engine'), { recursive: true });
  const load = (root, entry) => import(pathToFileURL(join(root, `node_modules/@zodiacs/engine/dist/${entry}.js`)).href);
  const [old, oldInternal, nu, nuInternal, pack] = await Promise.all([
    load(scratch, 'index'), load(scratch, 'internal'), load(site, 'index'), load(site, 'internal'), load(site, 'de440-pack'),
  ]);
  // The version is the one field the two releases are meant to differ in.
  const same = (a, b) => JSON.stringify(a, (key, value) => (key === 'engineVersion' ? undefined : value)) === JSON.stringify(b, (key, value) => (key === 'engineVersion' ? undefined : value));
  const places = [[51.5, -0.12, 'placidus'], [-33.9, 151.2, 'whole'], [70.1, 25, 'koch'], [0, 0, 'equal']];
  const instants = [];
  for (let year = 1795; year <= 2205; year += 7) for (const month of [0, 5, 10]) instants.push(new Date(Date.UTC(year, month, 13, 7, 31, 11)));
  function compare(label) {
    const result = { checked: 0, differing: 0 };
    const tally = (a, b) => { result.checked += 1; if (!same(a, b)) result.differing += 1; };
    for (const utc of instants) {
      for (const [latitude, longitude, houseSystem] of places) tally(old.natalChart({ utc, latitude, longitude, houseSystem }), nu.natalChart({ utc, latitude, longitude, houseSystem }));
      tally(old.positions(utc), nu.positions(utc));
      tally(old.moonPhase(utc), nu.moonPhase(utc));
      tally(oldInternal.computeBodies(utc), nuInternal.computeBodies(utc));
      const a = old.chartPoints(old.natalChart({ utc, latitude: 40, longitude: -74 }));
      const b = nu.chartPoints(nu.natalChart({ utc, latitude: 40, longitude: -74 }));
      tally({ ...a, points: a.points }, { ...b, points: b.points.filter((row) => row.point !== 'True Black Moon Lilith') });
    }
    return { ephemeris: label, ...result };
  }
  old.setDefaultEphemeris('astronomy-engine');
  const astronomyEngine = compare('astronomy-engine');
  old.setDefaultEphemeris('de440');
  pack.useDe440();
  const de440 = compare('de440');
  const utc = new Date('2000-01-01T12:00:00Z');
  console.log(JSON.stringify({
    engines: [old.ENGINE_VERSION, nu.ENGINE_VERSION],
    node: process.version,
    instants: `${instants.length}, 1795 to 2205`,
    compared: 'natalChart at four places and house systems, positions, moonPhase, internal computeBodies and chartPoints without its new row; every field but engineVersion',
    runs: [de440, astronomyEngine],
    chartPointsRows: [old.chartPoints(old.natalChart({ utc })).points.length, nu.chartPoints(nu.natalChart({ utc })).points.length],
  }, null, 2));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
