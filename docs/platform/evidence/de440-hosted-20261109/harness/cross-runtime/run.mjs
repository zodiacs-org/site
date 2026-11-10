/**
 * Rule (vi): the engine's DE440 positions, bundled once, on the same pack
 * bytes in Node 22.22.2, in Node 24 and, through the site's pinned
 * Playwright, in Chromium and Firefox (WebKit reported if it runs), for the
 * 24 horizons-24 instants by the 12 position bodies. PASS when every
 * longitude and latitude equals Node 22.22.2's to within 1e-9 degrees. C5:
 * the same comparison finds a 1e-8 degree change in one row.
 *
 *   node run.mjs --pack PACK [--instants INSTANTS.json] --node22 BIN --node24 BIN [--node-extra BIN] --scratch DIR
 *
 * Without --instants, the instants are the horizons-24 corpus's, on the
 * pinned clock of rule (i): the UTC millisecond whose engine TT is nearest
 * each TT the corpus asked Horizons for (../lib/clock.mjs).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '../../../../../..');
const require = createRequire(join(ROOT, 'package.json'));
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1]; };
const pack = arg('pack');
const scratch = arg('scratch');
mkdirSync(scratch, { recursive: true });
let instantsFile = arg('instants');
if (!instantsFile) {
  const { utcForTt, isoOf, J2000_JD } = await import('../lib/clock.mjs');
  const corpus = JSON.parse(readFileSync(join(ROOT, 'docs/platform/evidence/engine-beyond-swiss/corpora/horizons-24/corpus-tt.json'), 'utf8'));
  instantsFile = join(scratch, 'instants.json');
  writeFileSync(instantsFile, JSON.stringify(corpus.cases.map((kase) => isoOf(utcForTt(kase.jdTt - J2000_JD).ms))));
}
const packBytes = readFileSync(pack);
const digest = createHash('sha256').update(packBytes).digest('hex');

// The one bundle.
const esbuild = require('esbuild');
const bundlePath = join(scratch, 'de440-positions.mjs');
await esbuild.build({ entryPoints: [join(HERE, 'entry.mjs')], absWorkingDir: ROOT, bundle: true, format: 'esm', platform: 'neutral', mainFields: ['module', 'main'], conditions: ['import'], target: 'es2022', outfile: bundlePath, logLevel: 'silent' });
const bundleSha256 = createHash('sha256').update(readFileSync(bundlePath)).digest('hex');

function inNode(bin) {
  const result = spawnSync(bin, [join(HERE, 'node-run.mjs'), bundlePath, pack, digest, instantsFile], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (result.status !== 0) return { instrument: `node ${bin}: exit ${result.status} ${result.stderr.slice(0, 300)}` };
  return JSON.parse(result.stdout);
}

async function inBrowsers() {
  const { chromium, firefox, webkit } = require('playwright-core');
  const instants = readFileSync(instantsFile, 'utf8');
  const server = createServer((req, res) => {
    if (req.url === '/bundle.mjs') { res.setHeader('content-type', 'text/javascript'); res.end(readFileSync(bundlePath)); return; }
    if (req.url === '/pack.zeph') { res.setHeader('content-type', 'application/octet-stream'); res.end(packBytes); return; }
    if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>vi</title>'); return; }
    res.statusCode = 404; res.end();
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://localhost:${server.address().port}`;
  const out = {};
  for (const [name, type] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
    let browser;
    try {
      browser = await type.launch();
      const page = await browser.newPage();
      await page.goto(`${origin}/`);
      const rows = await page.evaluate(async ({ digest, instants }) => {
        const m = await import('/bundle.mjs');
        const bytes = new Uint8Array(await (await fetch('/pack.zeph')).arrayBuffer());
        return m.de440Rows(bytes, digest, JSON.parse(instants));
      }, { digest, instants });
      out[name] = { runtime: `${name} ${browser.version()}`, rows };
    } catch (error) {
      out[name] = { instrument: `${name}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}` };
    } finally {
      await browser?.close();
    }
  }
  server.close();
  return out;
}

/** Rows of one runtime against the reference: the largest |difference| in degrees and the rows over the tolerance. */
export function compareRows(reference, other, tolerance = 1e-9) {
  let largest = 0;
  const over = [];
  let n = 0;
  reference.forEach((instant, i) => {
    instant.bodies.forEach((body, j) => {
      const them = other[i]?.bodies?.[j];
      n += 1;
      if (!them || them.body !== body.body || ![them.lon, them.lat].every(Number.isFinite)) { over.push(`${instant.utc} ${body.body}: absent`); return; }
      let dLon = (them.lon - body.lon) % 360;
      if (dLon > 180) dLon -= 360;
      if (dLon <= -180) dLon += 360;
      const d = Math.max(Math.abs(dLon), Math.abs(them.lat - body.lat));
      largest = Math.max(largest, d);
      if (d > tolerance) over.push(`${instant.utc} ${body.body}: ${d}`);
    });
  });
  return { rows: n, largestDegrees: largest, over };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const runs = { node22: inNode(arg('node22')), node24: inNode(arg('node24')) };
  if (arg('node-extra')) runs.nodeExtra = inNode(arg('node-extra'));
  Object.assign(runs, await inBrowsers());
  const reference = runs.node22.rows;
  const comparisons = {};
  for (const [name, run] of Object.entries(runs)) {
    if (name === 'node22') continue;
    comparisons[name] = run.instrument ? { instrument: run.instrument } : { runtime: run.runtime, ...compareRows(reference, run.rows) };
  }
  // C5: one row moved by 1e-8 degree must be found.
  const moved = structuredClone(reference);
  moved[7].bodies[3].lon += 1e-8;
  const c5 = compareRows(reference, moved);
  const required = ['node24', 'chromium', 'firefox', ...(runs.nodeExtra ? ['nodeExtra'] : [])];
  const notRun = required.filter((name) => comparisons[name].instrument);
  const failed = required.filter((name) => !comparisons[name].instrument && comparisons[name].over.length > 0);
  const verdict = runs.node22.instrument ? 'NOT RUN' : failed.length ? 'FAIL' : notRun.length ? 'NOT RUN' : 'PASS';
  writeFileSync(join(scratch, 'node22-rows.json'), JSON.stringify(reference));
  process.stdout.write(`${JSON.stringify({ rule: 'vi', bundleSha256, packSha256: digest, reference: runs.node22.runtime ?? runs.node22.instrument, rows: reference?.length * 12, comparisons, c5: { movedDegrees: 1e-8, found: c5.over.length === 1, over: c5.over.length }, verdict }, null, 1)}\n`);
}
