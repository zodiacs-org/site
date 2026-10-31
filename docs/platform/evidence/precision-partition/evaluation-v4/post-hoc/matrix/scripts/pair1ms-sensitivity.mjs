/**
 * Diagnostic, unscored: is the one result that differs between this Mac's
 * version 1 run and the committed (Linux) one, pair-1ms on the geometric
 * rung, sensitive to last-bit changes in the fixture's synthetic pack?
 *
 *   node pair1ms-sensitivity.mjs --tree=TREE --out=OUT.json
 *
 * The fixture and the call are the audit's (fixture-matrix.mjs). The pack
 * is built by the tree's own test helper, `packOf`, whose Chebyshev fit
 * calls Math.cos and Math.acos. Each variant changes only the bytes of the
 * pack: the displacement scaled by one rounding unit either way, or every
 * Math.cos / Math.acos result inside `packOf` moved one unit in the last
 * place (Math is restored before the search runs). Reported per variant:
 * the result's counts and event times. No coefficient is printed.
 */
import { writeFileSync } from 'node:fs';

const args = new Map(process.argv.slice(2).map((a) => { const i = a.indexOf('='); return [a.slice(2, i), a.slice(i + 1)]; }));
const R = args.get('tree');
const { packOf, AT_REST, DAY, CE, SE } = await import(`${R}/test/tier-a/_geometry.mjs`);
const { searchGeometricLongitude } = await import(`${R}/src/core/validated-search.mjs`);

const f64 = new Float64Array(1); const u64 = new BigUint64Array(f64.buffer);
const step = (x, n) => { if (x === 0 || !Number.isFinite(x)) return x; f64[0] = x; u64[0] += BigInt(n) * (x > 0 ? 1n : -1n); return f64[0]; };

const X0 = 1e8;
const r0 = 3 * DAY + 5000;
const K = 1e-3;
const p = (t) => K * (t - r0) * (t - r0 - 1e-3);
const win = [r0 - 2 * DAY, r0 + 2 * DAY];
const sunFixed = () => [0, -1e8 * CE, -1e8 * SE];

function build(variant) {
  const scale = variant.scale ?? 1;
  const target = (t) => { const y = p(t) * scale; return [X0, y * CE, y * SE]; };
  const cos = Math.cos; const acos = Math.acos;
  if (variant.cosUlp) Math.cos = (x) => step(cos(x), variant.cosUlp);
  if (variant.acosUlp) Math.acos = (x) => step(acos(x), variant.acosUlp);
  try {
    return packOf(target, AT_REST.observer, { sunFn: sunFixed });
  } finally {
    Math.cos = cos; Math.acos = acos;
  }
}
const variants = [
  { name: 'as the audit builds it' },
  { name: 'displacement x (1 + 2^-52)', scale: 1 + 2 ** -52 },
  { name: 'displacement x (1 - 2^-53)', scale: 1 - 2 ** -53 },
  { name: 'Math.cos in the fit +1 ulp', cosUlp: 1 },
  { name: 'Math.cos in the fit -1 ulp', cosUlp: -1 },
  { name: 'Math.acos in the fit +1 ulp', acosUlp: 1 },
  { name: 'Math.acos in the fit -1 ulp', acosUlp: -1 },
];
const out = [];
for (const v of variants) {
  const eph = build(v);
  const res = searchGeometricLongitude(eph, { body: 'Mars', targetDeg: 0, fromTtDays: win[0] / DAY, toTtDays: win[1] / DAY });
  out.push({
    variant: v.name,
    found: res.events.length,
    established: res.completeness.established,
    unresolved: res.accounting.unresolved.length,
    evaluations: res.execution.evaluations,
    cells: res.execution.cells,
    times: res.events.map((e) => e.ttDays * DAY),
  });
}
const committedLinux = { found: 2, unresolved: 9, evaluations: 190, times: [264200.00031888485, 264200.0007212162] };
const record = { tool: 'pair1ms-sensitivity.mjs (results/matrix/scripts)', tree: R, node: process.version, platform: `${process.platform}-${process.arch}`, committedLinux, variants: out };
writeFileSync(args.get('out'), `${JSON.stringify(record, null, 1)}\n`);
for (const x of out) process.stdout.write(`${x.variant.padEnd(30)} found ${x.found} est ${x.established} unres ${x.unresolved} evals ${x.evaluations} cells ${x.cells} times ${JSON.stringify(x.times)}\n`);
