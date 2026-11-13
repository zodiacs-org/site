/**
 * Section 5, sense 1, of the bundle's PARTITION-EVALUATION-V2.md: the
 * released pointwise reduction `apparent()` on a fixed grid, the ten bodies
 * at 100 instants spread evenly over the ten F windows, must be
 * bit-identical in every field between the two versions.
 *
 *   node apparent-grid.mjs --pack=FILE --v1=TREE --v2=TREE --out=OUT.json
 *
 * The grid, the windows and the comparison are the bundle harness's
 * (partition-evaluation-v2.mjs lines 87-90, 117-120, 274-281, 842-879).
 * Not a matrix measurement. The rule's own pack (container 4cc6f85a...) is
 * not available here, so this runs on the pack #860 evaluated on; both
 * versions read the same bytes. Only digests and counts are written: no
 * value the pack's coefficients produce is printed or saved.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const args = new Map(process.argv.slice(2).map((a) => { const i = a.indexOf('='); return [a.slice(2, i), a.slice(i + 1)]; }));
const PACK = args.get('pack');
const sha256 = (x) => createHash('sha256').update(x).digest('hex');
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const DAY = 86400;
const J2000_UTC = Date.UTC(2000, 0, 1, 12);
const tdb = (iso) => (Date.parse(iso) - J2000_UTC) / 1000 + 69.184;
const plus = (iso, days) => `${new Date(Date.parse(iso) + days * DAY * 1000).toISOString().slice(0, 10)}T00:00:00Z`;
const threw = (e) => ({ threw: { code: e?.code ?? null, message: String(e?.message ?? e).slice(0, 300) } });

const node = { v1: await import(`${args.get('v1')}/src/node.mjs`), v2: await import(`${args.get('v2')}/src/node.mjs`) };
const packBytes = readFileSync(PACK);
const rt = { v1: await node.v1.openPackFile(PACK), v2: await node.v2.openPackFile(PACK) };
const payloadOffset = new DataView(packBytes.buffer, packBytes.byteOffset, packBytes.byteLength).getUint32(12, true);
const pack = {
  bytes: packBytes.length,
  fileSha256: sha256(packBytes),
  payloadSha256: sha256(packBytes.subarray(payloadOffset, rt.v2.header.payloadEndOffset)),
  headerPayloadSha256: rt.v2.header.payloadSha256 ?? null,
  containerDigest: { v1: rt.v1.integrity.computedDigest, v2: rt.v2.integrity.computedDigest },
  compiler: rt.v2.header.compiler?.version ?? null,
};

// The ten F windows: 300 days from 1975-01-01 at 900-day strides.
const windows = [];
for (let i = 0; i < BODIES.length; i += 1) {
  const fromIso = plus('1975-01-01T00:00:00Z', 900 * i);
  windows.push([tdb(fromIso), tdb(plus(fromIso, 300))]);
}
function apparentGrid(v) {
  const out = [];
  for (const [from, to] of windows) {
    for (let k = 0; k < 10; k += 1) {
      const ttDays = (from + ((to - from) * (k + 0.5)) / 10) / DAY;
      for (const body of BODIES) {
        try { out.push({ body, ttDays, value: rt[v].apparent(body, ttDays) }); } catch (e) { out.push({ body, ttDays, ...threw(e) }); }
      }
    }
  }
  return out;
}
function deepSame(a, b) {
  if (typeof a === 'number' || typeof b === 'number') return Object.is(a, b);
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (ArrayBuffer.isView(a) || Array.isArray(a)) {
    if (!(ArrayBuffer.isView(b) || Array.isArray(b)) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!deepSame(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a).sort(); const kb = Object.keys(b).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => deepSame(a[k], b[k]));
}
const grid1 = apparentGrid('v1');
const grid2 = apparentGrid('v2');
const gridDiffers = grid1.map((x, i) => ({ i, body: x.body, ttDays: x.ttDays, same: deepSame(x, grid2[i]) })).filter((x) => !x.same);
const record = {
  tool: 'apparent-grid.mjs (results/matrix/scripts)',
  sense: 'PARTITION-EVALUATION-V2.md (bundle) section 5, sense 1; not a matrix measurement',
  trees: { v1: args.get('v1'), v2: args.get('v2') },
  pack,
  windows: windows.length,
  instants: windows.length * 10,
  calls: grid1.length,
  threw: { v1: grid1.filter((x) => x.threw).length, v2: grid2.filter((x) => x.threw).length },
  differing: gridDiffers.length,
  firstDiffering: gridDiffers.slice(0, 5).map(({ i, body }) => ({ i, body })),
  digest: { v1: sha256(JSON.stringify(grid1)), v2: sha256(JSON.stringify(grid2)) },
  pass: grid1.length === grid2.length && gridDiffers.length === 0,
};
writeFileSync(args.get('out'), `${JSON.stringify(record, null, 1)}\n`);
process.stdout.write(`container ${pack.containerDigest.v2.slice(0, 8)} (v1 reads ${pack.containerDigest.v1.slice(0, 8)}), payload ${pack.payloadSha256.slice(0, 8)}, compiler ${pack.compiler}; ${record.calls} calls, ${record.threw.v1}/${record.threw.v2} threw, ${record.differing} differ, digests equal ${record.digest.v1 === record.digest.v2}\n`);
