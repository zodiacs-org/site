/* rc16 adaptation: original corpus, chart defaults, quantiles and gates unchanged.
 * The --as-written run means default UTC chart options; Swiss still reads UTC as UT1.
 * The aligned run adds timeScale: ut1 only. Version assertion and clock/frame diagnostics
 * now bind to rc16 so the original ERFA decomposition remains meaningful. */
/*
 * Grids A and L of angle-grid-inputs.json through the SHIPPED chart path: the site's
 * src/lib/engine/full.ts computeChart (adaptChart over @zodiacs/engine/internal computeChart,
 * the vendored 0.1.1-rc.16), house system Placidus, time known. Also records, per case, the
 * engine clock and the two inputs its angles are built from (astronomy-engine SiderealTime and
 * e_tilt), and cross-checks the site path against the package's computeChart called directly.
 *
 * No Swiss input. Run with vite-node from the site root and this folder's Vite config (root
 * SITE_ROOT, so full.ts and its TS imports resolve as the site resolves them):
 *   cd $SITE_ROOT && npx vite-node --config <tools>/vite.config.mjs <tools>/s13/engine_grids.mjs > $WORK/s13/engine-grids.log
 * (--config, not --script: --script makes vite-node ignore --config.) Writes
 * $WORK/s13/engine-grids.json, which records the corpus's absolute path. Reads the repository;
 * writes nothing into it.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { SITE_ROOT, WORK, outDir } from '../../../phase1-verdicts-2026-09-25/tools/lib/paths.mjs';
import { readdirSync } from 'node:fs';

const TREE = SITE_ROOT;
const O = WORK;
outDir('s13');
const corpusPath = `${TREE}/docs/platform/evidence/engine-beyond-swiss/corpora/angle-grid-inputs.json`;
const corpusBytes = readFileSync(corpusPath);
const corpus = JSON.parse(corpusBytes.toString('utf8'));

const site = await import(`${TREE}/src/lib/engine/full.ts`);
const pkg = await import(`${TREE}/node_modules/@zodiacs/engine/dist/internal.js`);
const math = await import(`${TREE}/node_modules/@zodiacs/engine/dist/internal-math.js`);
const ae = await import(`${TREE}/node_modules/astronomy-engine/esm/astronomy.js`);
if (math.ENGINE_VERSION !== '0.1.1-rc.16') throw new Error(`engine ${math.ENGINE_VERSION}`);

const { timeBasis, tilt: engineTilt } = await import(`${TREE}/src/lib/engine/time-basis.mjs`);
const { deltaT } = await import('@zodiacs/engine/deltat');
const clockMode = process.env.CLOCK_MODE || 'default-utc';
if (!['default-utc', 'aligned-ut1'].includes(clockMode)) throw new Error(clockMode);
const ephemerisSource = readdirSync(`${TREE}/node_modules/@zodiacs/engine/dist`)
  .filter(n => n.endsWith('.js'))
  .map(n => readFileSync(`${TREE}/node_modules/@zodiacs/engine/dist/${n}`, 'utf8'))
  .find(s => s.includes('function gastHours(time) {'));
const gastSource = ephemerisSource.match(/function gastHours\(time\) \{[\s\S]*?\n\}/u)?.[0];
if (!gastSource) throw new Error('Cannot locate package gastHours');
// Extract the installed package's exact implementation, passing its generated tilt.
const gastHours = new Function('tilt', `return (${gastSource})`)(engineTilt);
let packageMismatches = 0;
let diagnosticMismatches = 0;
const run = (rows) => rows.map(([utc, latitude, longitude, hsys], index) => {
  const input = { utc: new Date(utc), latitude, longitude, houseSystem: 'placidus', timeKnown: true, ...(clockMode === 'aligned-ut1' ? { timeScale: 'ut1' } : {}) };
  const chart = site.computeChart(input);
  if (chart.engineVersion !== '0.1.1-rc.16') throw new Error(`chart engineVersion ${chart.engineVersion}`);
  const direct = pkg.computeChart({ ...input, utc: new Date(utc) });
  const same = direct.angles.asc === chart.angles.asc && direct.angles.mc === chart.angles.mc
    && direct.houses.system === chart.houses.system
    && direct.houses.cusps.every((c, i) => c === chart.houses.cusps[i])
    && direct.flags.join() === chart.flags.join();
  if (!same) packageMismatches += 1;
  const basis = timeBasis(Date.parse(utc), clockMode === 'aligned-ut1' ? 'ut1' : 'utc');
  ae.SetDeltaTFunction(() => basis.deltaT.seconds);
  const time = ae.MakeTime(basis.ut1Days);
  ae.SetDeltaTFunction(deltaT);
  const tilt = engineTilt(time.tt);
  const reconstructed = math.computeAngles({ gastHours: gastHours(time), latitude, longitude, obliquity: tilt.tobl });
  if (reconstructed.asc !== chart.angles.asc || reconstructed.mc !== chart.angles.mc) diagnosticMismatches += 1;
  return {
    i: index, utc, lat: latitude, lon: longitude, hsys,
    asc: chart.angles.asc, mc: chart.angles.mc,
    system: chart.houses.system, cusps: chart.houses.cusps, flags: chart.flags,
    ut: time.ut, tt: time.tt, gastHours: gastHours(time),
    dpsi: tilt.dpsi, deps: tilt.deps, ee: tilt.ee / 15, mobl: tilt.mobl, tobl: tilt.tobl,
  };
});

const A = run(corpus.A);
const L = run(corpus.L);
const out = {
  what: 'grids A and L through the site computeChart (src/lib/engine/full.ts) on @zodiacs/engine 0.1.1-rc.16, Placidus, timeKnown',
  corpus: { path: corpusPath, sha256: createHash('sha256').update(corpusBytes).digest('hex') },
  engineVersion: math.ENGINE_VERSION,
  node: process.version,
  units: 'asc, mc, cusps, mobl, tobl in degrees; gastHours in hours; dpsi, deps in arcseconds; ee in seconds of time; ut, tt in days from J2000',
  packageMismatches, diagnosticMismatches, clockMode, gastSourceSha256: createHash('sha256').update(gastSource).digest('hex'),
  A, L,
};
writeFileSync(`${O}/s13/engine-grids.json`, JSON.stringify(out));
console.log(JSON.stringify({
  A: A.length, L: L.length, packageMismatches, diagnosticMismatches, clockMode,
  AFallbacks: A.filter((r) => r.flags.includes('polar-fallback')).length,
  LFallbacks: L.filter((r) => r.flags.includes('polar-fallback')).length,
  corpusSha256: out.corpus.sha256,
}));

if (packageMismatches || diagnosticMismatches) throw new Error('Package/site/diagnostic mismatch');
