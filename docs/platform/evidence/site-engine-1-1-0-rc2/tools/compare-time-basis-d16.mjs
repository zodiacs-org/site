/**
 * D-16: the time basis main's Chiron tool imported (src/lib/engine/time-basis.mjs, which this
 * branch deletes) against the one it now imports (@zodiacs/engine/time from the vendored
 * 1.1.0-rc.2), every 7 hours and 13 seconds from 1799-01-01 to 2201-01-01 UTC, on each of the
 * four scales (the default, "utc", "ut1" and "tt"), comparing each record as JSON, or each
 * thrown message.
 *
 *   git show f95e57e3:src/lib/engine/time-basis.mjs > <tmp>/time-basis.mjs
 *   node docs/platform/evidence/site-engine-1-1-0-rc2/tools/compare-time-basis-d16.mjs <tmp>/time-basis.mjs [--control] > <out.json>
 *
 * --control reads the deleted module 1 ms later than the entry at every instant, so the comparison
 * must find records that differ.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const control = process.argv.includes('--control');
const [oldPath] = process.argv.slice(2).filter((arg) => arg !== '--control');
if (!oldPath) throw new Error('Give the path of the deleted module, taken from git.');
const old = await import(pathToFileURL(oldPath).href);
const { timeBasis } = await import('@zodiacs/engine/time');
const engine = JSON.parse(readFileSync(new URL('../../../../../node_modules/@zodiacs/engine/package.json', import.meta.url), 'utf8'));
const from = Date.parse('1799-01-01T00:00:00Z');
const to = Date.parse('2201-01-01T00:00:00Z');
const step = 7 * 3_600_000 + 13_000;
const scales = [undefined, 'utc', 'ut1', 'tt'];
let compared = 0;
let differing = 0;
let thrown = 0;
for (let ms = from; ms < to; ms += step) {
  for (const scale of scales) {
    let a;
    let b;
    try { a = old.timeBasis(control ? ms + 1 : ms, scale); } catch (error) { a = `throws: ${error.message}`; thrown += 1; }
    try { b = timeBasis(ms, scale); } catch (error) { b = `throws: ${error.message}`; }
    compared += 1;
    if (JSON.stringify(a) !== JSON.stringify(b)) differing += 1;
  }
}
console.log(JSON.stringify({
  what: "src/lib/engine/time-basis.mjs (deleted by this branch) against @zodiacs/engine/time's timeBasis",
  oldModuleSha256: createHash('sha256').update(readFileSync(oldPath)).digest('hex'),
  engine: engine.version,
  node: process.version,
  from: new Date(from).toISOString(),
  to: new Date(to).toISOString(),
  stepMs: step,
  scales: scales.map((scale) => scale ?? 'default'),
  control,
  compared,
  oldThrew: thrown,
  differing,
  pass: control ? differing > 0 : differing === 0,
}, null, 2));
