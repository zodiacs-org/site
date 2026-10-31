/**
 * The ten-case regression corpus of PARTITION-EVALUATION-V2.md, rule V-4:
 * the plain deflected search on F1 to F10, version 1 against version 2.
 *
 *   node tools/measure/corpus-versions.mjs --v1=DIR --pack=FILE --out=FILE
 *
 * `--v1` is a precision-alpha tree holding version 1's code; this file's
 * own tree is version 2. Both search the same pack with the same budget.
 * Every event version 1 finds must be found by version 2 within 1e-3 s
 * with the same direction; for every body but the Moon, whose cells
 * version 2 does not change, the events must be bit-identical.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const V1 = resolve(args.get('v1'));
const V2 = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PACK = args.get('pack');
const OUT = args.get('out');
if (!args.get('v1') || !PACK || !OUT) { process.stderr.write('--v1=DIR --pack=FILE --out=FILE are required\n'); process.exit(2); }

const DAY = 86400;
const J2000_UTC = Date.UTC(2000, 0, 1, 12);
const tdb = (iso) => (Date.parse(iso) - J2000_UTC) / 1000 + 69.184;
const plus = (iso, days) => `${new Date(Date.parse(iso) + days * DAY * 1000).toISOString().slice(0, 10)}T00:00:00Z`;
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const BUDGET = { maxEvaluations: 4_000_000, maxCells: 400_000 };

async function load(dir) {
  const { openPackFile } = await import(join(dir, 'src/node.mjs'));
  const RS = await import(join(dir, 'src/core/retarded-search.mjs'));
  const rt = await openPackFile(PACK);
  return { rt, search: RS.searchDeflectedLongitude };
}
const one = await load(V1);
const two = await load(V2);
const { makeDeflectedReference } = await import(join(V2, 'test/tier-b/_deflected-reference.mjs'));
const ref = makeDeflectedReference(two.rt.ephemeris);

const shape = (r, ms) => ({
  status: r.execution.status,
  established: r.completeness.established,
  evaluations: r.execution.evaluations,
  ms,
  events: r.events.map((e) => ({ tdbSec: e.tdbSec, bracketTdbSec: e.bracketTdbSec, direction: e.direction })),
});

const rows = [];
for (let i = 0; i < BODIES.length; i += 1) {
  const id = `F${i + 1}`;
  const fromIso = plus('1975-01-01T00:00:00Z', 900 * i);
  const from = tdb(fromIso);
  const to = tdb(plus(fromIso, 300));
  const lon = ref.lonDeg(BODIES[i], (from + to) / 2);
  if (lon === null) { rows.push({ id, body: BODIES[i], skipped: 'the reference refuses the midpoint geometry' }); continue; }
  const spec = { body: BODIES[i], targetDeg: Number(lon.toFixed(6)), fromTdbSec: from, toTdbSec: to, ...BUDGET };
  let t0 = Date.now();
  const a = shape(one.search(one.rt.ephemeris, spec), Date.now() - t0);
  t0 = Date.now();
  const b = shape(two.search(two.rt.ephemeris, spec), Date.now() - t0);
  const lost = a.events.filter((e) => !b.events.some((g) => Math.abs(g.tdbSec - e.tdbSec) <= 1e-3 && g.direction === e.direction));
  const identical = JSON.stringify(a.events) === JSON.stringify(b.events);
  const unchangedPath = BODIES[i] !== 'Moon';
  rows.push({ id, body: BODIES[i], targetDeg: spec.targetDeg, v1: a, v2: b, lostEvents: lost, bitIdentical: identical, mustBeBitIdentical: unchangedPath });
  process.stdout.write(`${id} ${BODIES[i]}: v1 ${a.status} ${a.events.length} events ${a.evaluations}; v2 ${b.status} ${b.events.length} events ${b.evaluations}; lost ${lost.length}; identical ${identical}\n`);
}
const failures = rows.filter((r) => !r.skipped && (r.lostEvents.length > 0 || (r.mustBeBitIdentical && !r.bitIdentical)));
writeFileSync(OUT, `${JSON.stringify({
  rule: 'PARTITION-EVALUATION-V2.md V-4',
  pack: PACK.split('/').pop(),
  packDigest: two.rt.integrity.computedDigest,
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  rows,
  verdict: failures.length === 0 ? 'PASS' : 'FAIL',
}, null, 1)}\n`);
process.stdout.write(`${failures.length === 0 ? 'PASS' : 'FAIL'}\n`);
one.rt.dispose();
two.rt.dispose();
