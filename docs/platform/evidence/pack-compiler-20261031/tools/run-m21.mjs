/**
 * Version 1's M2.1 rule, run as PREREGISTRATION.md states it.
 *
 *   node docs/platform/evidence/pack-compiler-20261031/tools/run-m21.mjs \
 *     --kernels=DIR --work=DIR --out=FILE
 *
 * DIR must hold NAIF's de440.bsp and de432s.bsp. Packs are written to the
 * work directory, never into the repository, and only their digests, sizes,
 * header figures and the runtime's answers reach FILE.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (k) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const KERNELS = resolve(arg('kernels'));
const WORK = resolve(arg('work'));
const OUT = resolve(arg('out'));
const ALPHA = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', 'examples', 'precision-alpha');
const { openPackFile, CORRECTED } = await import(join(ALPHA, 'src', 'node.mjs'));

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const RUNS = [
  { run: 'DE440 full', name: 'de440-full', args: [`--kernel=${join(KERNELS, 'de440.bsp')}`] },
  { run: 'DE440 cropped', name: 'de440-1790-2210', args: [`--kernel=${join(KERNELS, 'de440.bsp')}`, '--fromYear=1790', '--toYear=2210'] },
  { run: 'DE432s', name: 'de432s', args: [`--kernel=${join(KERNELS, 'de432s.bsp')}`] },
];

function compile(name, args) {
  const out = join(WORK, `${name}.zeph`);
  const t0 = process.hrtime.bigint();
  const r = spawnSync(process.execPath, [join(ALPHA, 'tools', 'compiler', 'compile.mjs'), ...args, `--out=${out}`], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const seconds = Number(process.hrtime.bigint() - t0) / 1e9;
  return { out, status: r.status, seconds: +seconds.toFixed(1), stdout: r.stdout, stderr: r.stderr };
}

const results = [];
for (const { run, name, args } of RUNS) {
  const c = compile(name, args);
  const entry = { run, command: `compile.mjs ${args.map((a) => a.replace(KERNELS, '<kernels>')).join(' ')}`, exit: c.status, compileSeconds: c.seconds };
  if (c.status !== 0) {
    entry.verdict = c.status === 3 ? 'refused with a typed reason' : 'FAIL: neither a pack nor a typed refusal';
    try { entry.refusal = JSON.parse(c.stderr.trim().split('\n').pop()); } catch { entry.stderr = c.stderr; }
    results.push(entry);
    continue;
  }
  const header = JSON.parse(readFileSync(c.out).subarray(16, 16 + readFileSync(c.out).readUInt32LE(8)).toString('utf8'));
  const sealedPath = join(WORK, `${name}.v2.zeph`);
  const seal = spawnSync(process.execPath, [join(ALPHA, 'tools', 'seal.mjs'), c.out, sealedPath], { encoding: 'utf8' });
  if (seal.status !== 0) throw new Error(`seal failed for ${name}: ${seal.stderr}`);
  const rt = await openPackFile(sealedPath);
  const cov = rt.coverage;
  const ttDays = [cov.startEtSecTdb / 86400 + 1, (cov.startEtSecTdb + cov.stopEtSecTdb) / 2 / 86400, cov.stopEtSecTdb / 86400 - 1];
  const answers = [];
  let allFinite = true;
  for (const tt of ttDays) {
    for (const body of BODIES) {
      const r = rt.apparent(body, tt, CORRECTED);
      const finite = Number.isFinite(r.lon) && Number.isFinite(r.lat) && Number.isFinite(r.distKm) && r.distKm > 0;
      allFinite &&= finite;
      answers.push({ ttDaysPastJ2000: +tt.toFixed(6), body, lonDeg: +r.lon.toFixed(7), latDeg: +r.lat.toFixed(7), distKm: Math.round(r.distKm), finite });
    }
  }
  const selfConsistent = rt.integrity.selfConsistent;
  rt.dispose();
  Object.assign(entry, {
    verdict: selfConsistent && allFinite ? 'compiles, opens and answers' : 'FAIL: opened without verifying, or did not answer',
    bytes: readFileSync(c.out).length,
    fileSha256: sha256(c.out),
    payloadSha256: header.payloadSha256,
    sealedBytes: readFileSync(sealedPath).length,
    sealedSha256: sha256(sealedPath),
    selfConsistent,
    coverage: { start: header.coverage.startUtcApprox, stop: header.coverage.stopUtcApprox, spanDays: header.coverage.spanDays, kernelSpanDays: header.coverage.kernelSpanDays },
    provenance: header.provenance,
    bodies: header.bodies.map((b) => ({
      name: b.name, frame: b.frame, nominal: b.fit.nominal, ncoef: b.ncoef, ncoefAdded: b.fit.ncoefAdded,
      nrec: b.nrec, intervalDays: b.intervalDays, provenFitKm: b.provenParts.refit.posKm,
      provenQuantKm: b.provenParts.quantisation.posKm, provenPosKm: b.provenPosKm, budgetKm: b.budgetKm,
      insideBudget: b.provenPosKm <= b.budgetKm, bytes: b.bytes,
    })),
    answers,
  });
  results.push(entry);
}

// Determinism: the cropped compile, a second time.
const again = compile('de440-1790-2210-again', RUNS[1].args);
const first = results.find((r) => r.run === 'DE440 cropped');
const determinism = {
  run: 'DE440 cropped, compiled a second time',
  exit: again.status,
  fileSha256: again.status === 0 ? sha256(again.out) : null,
  identical: again.status === 0 && sha256(again.out) === first.fileSha256,
};

writeFileSync(OUT, `${JSON.stringify({
  what: 'Version 1\'s M2.1 rule for compiler 2.0.0, as PREREGISTRATION.md states it',
  node: process.version, platform: `${process.platform}-${process.arch}`,
  kernels: Object.fromEntries(['de440.bsp', 'de432s.bsp'].map((k) => [k, { bytes: readFileSync(join(KERNELS, k)).length, sha256: sha256(join(KERNELS, k)) }])),
  runs: results,
  determinism,
  verdict: results.every((r) => r.verdict.startsWith('compiles') || r.verdict.startsWith('refused')) && determinism.identical ? 'PASS' : 'FAIL',
}, null, 1)}\n`);
process.stdout.write(`${results.map((r) => `${r.run}: ${r.verdict} (${r.compileSeconds} s${r.bytes ? `, ${r.bytes} bytes` : ''})`).join('\n')}\ndeterminism: ${determinism.identical}\n`);
