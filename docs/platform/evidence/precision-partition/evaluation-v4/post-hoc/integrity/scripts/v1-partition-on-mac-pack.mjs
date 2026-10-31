// Post hoc, unscored, and on development data (the 1975 regression windows).
// Checks #860's section 3 sentence: "On this pack version 1's code reproduces
// version 1's committed partition figures exactly (F2: 939,176 evaluations,
// 158,121 cells, 5.266 per cent boundary; F3, F4, F5 and F7 likewise)".
// Runs partitionDomain alone, with the harness's own spec, for the ten main
// bodies, from the tree named on the command line. Prints counts only; no
// coefficient is read or printed.
import { pathToFileURL } from 'node:url';
const [,, tree, packPath, only] = process.argv;
const imp = (p) => import(pathToFileURL(`${tree}/${p}`).href);
const { openPackFile } = await imp('src/node.mjs');
const { makeDeflectedReference } = await imp('test/tier-b/_deflected-reference.mjs');
const { partitionDomain, PARTITION_DEFAULTS } = await imp('src/core/domain-partition.mjs');
const rt = await openPackFile(packPath);
const eph = rt.ephemeris;
const packDigest = rt.integrity?.computedDigest ?? null;
const DAY = 86400;
const J2000_UTC = Date.UTC(2000, 0, 1, 12);
const tdb = (iso) => (Date.parse(iso) - J2000_UTC) / 1000 + 69.184;
const plus = (iso, days) => `${new Date(Date.parse(iso) + days * DAY * 1000).toISOString().slice(0, 10)}T00:00:00Z`;
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const EPOCH = '1975-01-01T00:00:00Z';
const out = { tree, packDigest, defaults: PARTITION_DEFAULTS, cases: [] };
for (let i = 0; i < BODIES.length; i += 1) {
  const id = `F${i + 1}`;
  if (only && !only.split(',').includes(id)) continue;
  const fromIso = plus(EPOCH, 900 * i);
  const toIso = plus(fromIso, 300);
  const from = tdb(fromIso); const to = tdb(toIso);
  const plan = partitionDomain(eph, {
    body: BODIES[i], fromTdbSec: from, toTdbSec: to,
    boundaryToleranceSec: PARTITION_DEFAULTS.boundaryToleranceSec,
    relightWidthRatio: PARTITION_DEFAULTS.relightWidthRatio,
    packDigest, maxEvaluations: 4_000_000, maxCells: 400_000,
  });
  const sum = (s) => s.reduce((a, [lo, hi]) => a + (hi - lo), 0);
  const b = sum(plan.boundary ?? []);
  out.cases.push({
    id, body: BODIES[i], status: plan.execution.status,
    evaluations: plan.execution.evaluations, cells: plan.execution.cells,
    boundarySec: b, boundaryPercentRoundedUp: Math.ceil((b / (to - from)) * 100 * 1000) / 1000,
    boundarySpans: (plan.boundary ?? []).length,
    excludedSpans: (plan.excluded ?? []).length,
    admissibleSpans: (plan.admissible ?? []).length,
  });
  process.stderr.write(`${id} ${BODIES[i]} ${plan.execution.status} ${plan.execution.evaluations} ${plan.execution.cells}\n`);
}
console.log(JSON.stringify(out, null, 1));
