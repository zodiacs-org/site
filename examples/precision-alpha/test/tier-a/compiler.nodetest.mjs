/**
 * The compiler against version 1's M2.1, on kernels written here.
 *
 *   - the span comes from the kernel, and no record reaches past it;
 *   - every body is proven inside its budget, or nothing is written;
 *   - `--kernel` is required, `--out` defaults to the working directory,
 *     `--help` is handled, and every refusal is typed;
 *   - the header is format 2, with tokens and a provenance block;
 *   - the same kernel gives the same bytes, on any machine.
 *
 * The kernels are synthetic and small (see `_spk.mjs`), so this runs in
 * tier A with no data. The real kernels are tier B's and the evidence's.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deShaped, writeSpk, circle, wiggle, EMRAT, DAY } from './_spk.mjs';
import { compilePack, parseArgs, CompileRefusal, FORMAT_VERSION, MAX_NCOEF } from '../../tools/compiler/compile.mjs';
import { BUDGET_KM } from '../../tools/compiler/sources.mjs';
import { SpkRef } from '../../tools/compiler/spkref.mjs';
import { openPackFromBytes, CORRECTED } from '../../src/index.mjs';

const COMPILER = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tools', 'compiler', 'compile.mjs');
const dir = realpathSync(mkdtempSync(join(tmpdir(), 'zodiacs-compiler-')));
test.after(() => rmSync(dir, { recursive: true, force: true }));

const kernelFile = (name, segments) => {
  const path = join(dir, name);
  writeFileSync(path, writeSpk(segments));
  return path;
};
// 1,120 days of records, except Pluto's, which start 32 days in: the span
// the pack can have is the stretch every segment covers, 32..1120 days.
const NORMAL = kernelFile('normal.bsp', deShaped({ stopDays: 1120, plutoStartDays: 32 }));
const compile = (args) => compilePack(parseArgs(args));
const refusalOf = async (args) => {
  try { await compile(args); } catch (error) {
    assert.ok(error instanceof CompileRefusal, `expected a CompileRefusal, got ${error.name}: ${error.message}`);
    return error;
  }
  assert.fail('the compiler wrote a pack it should have refused');
};
const sealed = (bytes) => {
  const out = new Uint8Array(bytes.length + 32);
  out.set(bytes); out.set(new TextEncoder().encode('ZODEPH02'), 0);
  out.set(createHash('sha256').update(out.subarray(0, bytes.length)).digest(), bytes.length);
  return out;
};
const cli = (args, cwd = dir) => spawnSync(process.execPath, [COMPILER, ...args], { cwd, encoding: 'utf8' });
const refusedOnStderr = (r) => JSON.parse(r.stderr.trim().split('\n').pop());

let normal;
test.before(async () => { normal = await compile([`--kernel=${NORMAL}`]); });

test('the span is the stretch every segment covers, read from the kernel', () => {
  const c = normal.header.coverage;
  assert.equal(c.kernelStartEtSecTdb, 32 * DAY);
  assert.equal(c.kernelStopEtSecTdb, 1120 * DAY);
  assert.equal(c.startEtSecTdb, 32 * DAY);
  assert.equal(c.stopEtSecTdb, 1120 * DAY);
  assert.equal(c.spanDays, 1088);
  assert.equal(c.kernelSpanDays, 1088);
});

test('nrec = ceil(span / L): the records tile the span, and none reaches past it', () => {
  const span = 1088 * DAY;
  for (const b of normal.header.bodies) {
    assert.equal(b.initEt, 32 * DAY, b.name);
    assert.equal(b.nrec, Math.ceil(span / (b.fit.nominal.Ldays * DAY) - 1e-9), b.name);
    assert.ok(Math.abs(b.initEt + b.nrec * b.intervalSec - 1120 * DAY) < 1e-6, `${b.name}'s last record ends on the kernel's stop`);
    assert.ok(b.intervalDays <= b.fit.nominal.Ldays, `${b.name}'s records are no longer than the chosen interval`);
  }
  // Most of the chosen intervals do not divide 1,088 days, so the records shrink.
  const shrunk = normal.header.bodies.filter((b) => b.intervalDays < b.fit.nominal.Ldays);
  assert.ok(shrunk.length >= 5, `only ${shrunk.length} bodies had their interval shortened`);
});

test('every body is proven inside its budget, and the header says how', () => {
  for (const b of normal.header.bodies) {
    assert.equal(b.budgetKm, BUDGET_KM[b.name]);
    assert.ok(b.provenPosKm <= b.budgetKm, `${b.name}: ${b.provenPosKm} > ${b.budgetKm}`);
    assert.ok(b.provenParts.refit.posKm <= b.budgetKm / 2, `${b.name}'s fit takes at most half the budget`);
    assert.ok(b.fit.trail.length >= 1 && b.fit.trail.at(-1).ncoef === b.ncoef);
  }
});

test('the header is format 2, with tokens and a provenance block', () => {
  const h = normal.header;
  assert.equal(h.formatVersion, FORMAT_VERSION);
  assert.equal(h.conventions.chebyshev, 'spk-type-2');
  assert.equal(h.conventions.units, 'km,km/s');
  const p = h.provenance;
  assert.deepEqual(p.producer, { name: 'Zodiacs', institution: 'zodiacs.org' });
  assert.equal(p.source.file, 'normal.bsp');
  assert.equal(p.source.sha256, createHash('sha256').update(readFileSync(NORMAL)).digest('hex'));
  assert.equal(p.source.ephemeris, 'DE999', 'read from the segment names');
  assert.equal(p.source.citation, null, 'no citation is invented for an ephemeris the compiler does not know');
  assert.match(p.modification, /name whoever made the last modification/);
  assert.equal(p.rulesPage, 'https://naif.jpl.nasa.gov/naif/rules.html');
});

test('the producer can be named on the command line', async () => {
  const { header } = await compile([`--kernel=${NORMAL}`, '--producer-name=A. Person', '--producer-institution=Somewhere']);
  assert.deepEqual(header.provenance.producer, { name: 'A. Person', institution: 'Somewhere' });
});

test('the same kernel gives the same bytes, on any machine', async () => {
  const again = await compile([`--kernel=${NORMAL}`]);
  assert.equal(Buffer.compare(again.bytes, normal.bytes), 0);
  // Pinned so that CI on another architecture fails if the arithmetic moves.
  // Nothing in the compiler's path reads Math.cos since 2.0.0.
  assert.equal(normal.header.payloadSha256, PINNED_PAYLOAD_SHA256);
});

test('the pack opens in the runtime and answers across its whole span', async () => {
  const rt = await openPackFromBytes(sealed(normal.bytes));
  const ttDays = [33, 576, 1119].map((d) => d - 0.5);       // TT days past J2000 noon
  for (const tt of ttDays) {
    for (const body of ['Sun', 'Moon', 'Mercury', 'Mars', 'Jupiter', 'Pluto']) {
      const r = rt.apparent(body, tt, CORRECTED);
      assert.ok(Number.isFinite(r.lon) && Number.isFinite(r.lat) && r.distKm > 0, `${body} at ${tt}`);
    }
  }
  rt.dispose();
});

test('a cropped window is compiled from its own start to its own stop', async () => {
  const { header } = await compile([`--kernel=${NORMAL}`, '--fromYear=2001', '--toYear=2003']);
  const from = Date.UTC(2001, 0, 1) / 1000 - 946728000; const to = Date.UTC(2003, 0, 1) / 1000 - 946728000;
  assert.equal(header.coverage.startEtSecTdb, from);
  assert.equal(header.coverage.stopEtSecTdb, to);
  assert.equal(header.coverage.croppedFromKernel, true);
  for (const b of header.bodies) assert.ok(Math.abs(b.initEt + b.nrec * b.intervalSec - to) < 1e-6, b.name);
});

test('a window outside the kernel is refused, not quietly shortened', async () => {
  const e = await refusalOf([`--kernel=${NORMAL}`, '--fromYear=1999']);
  assert.equal(e.code, 'window-outside-kernel');
  assert.equal((await refusalOf([`--kernel=${NORMAL}`, '--toYear=2004'])).code, 'window-outside-kernel');
});

test('a body that 64 coefficients cannot prove inside its budget refuses the whole pack', async () => {
  // A 30 km oscillation every 0.37 days: the source kernel carries it in
  // half-day records, and no refit over weeks can follow it.
  const fast = wiggle(circle(384400 * (EMRAT / (1 + EMRAT)), 27.32, 0.15, 0.09), 30, 0.37);
  const path = kernelFile('fast-moon.bsp', deShaped({ stopDays: 160, moon: fast, moonRecordDays: 0.5 }));
  const e = await refusalOf([`--kernel=${path}`]);
  assert.equal(e.code, 'over-budget');
  assert.deepEqual(e.details.bodies.map((b) => b.body), ['moon']);
  const moon = e.details.bodies[0];
  let last = 31;                                       // the Moon's chosen degree
  while (last + 2 <= MAX_NCOEF) last += 2;
  assert.equal(moon.ncoef, last, 'the fit grew two coefficients at a time to the cap before giving up');
  assert.equal(moon.fitTrail.length, (last - 31) / 2 + 1);
  assert.ok(moon.provenPosKm > moon.budgetKm);
  // and through the command line: exit 3, a typed refusal, no file
  const out = join(dir, 'never-written.zeph');
  const r = cli([`--kernel=${path}`, `--out=${out}`]);
  assert.equal(r.status, 3);
  assert.equal(refusedOnStderr(r).refused, 'over-budget');
  assert.equal(existsSync(out), false);
});

test('a kernel without a segment the pack reads is refused by name', async () => {
  const path = kernelFile('no-moon.bsp', deShaped({ stopDays: 160, omit: ['301/3'] }));
  const e = await refusalOf([`--kernel=${path}`]);
  assert.equal(e.code, 'segment-missing');
  assert.deepEqual(e.details, { target: 301, center: 3 });
});

test('the SPK reader refuses an instant outside a segment instead of extrapolating', () => {
  const ref = new SpkRef(NORMAL);
  const seg = ref.segment(9, 0);
  const out = new Float64Array(6);
  assert.ok(Number.isFinite(ref.state(seg, 32 * DAY, out)[0]));
  assert.ok(Number.isFinite(ref.state(seg, 1120 * DAY, out)[0]));
  assert.throws(() => ref.state(seg, 31 * DAY, out), RangeError);
  assert.throws(() => ref.state(seg, 1121 * DAY, out), RangeError);
});

test('candidate C is refused: its error has no proven bound', async () => {
  assert.equal((await refusalOf([`--kernel=${NORMAL}`, '--candidate=C'])).code, 'no-proven-bound');
});

test('--help prints the usage and compiles nothing', () => {
  const r = cli(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--kernel=PATH/);
  assert.equal(r.stderr, '');
});

test('--kernel is required: there is no default kernel', () => {
  const r = cli([]);
  assert.equal(r.status, 2);
  assert.equal(refusedOnStderr(r).refused, 'kernel-required');
});

test('unknown, repeated and empty arguments are refused, not ignored', () => {
  for (const args of [['--kernal=x.bsp'], [`--kernel=${NORMAL}`, `--kernel=${NORMAL}`], ['--kernel='], ['kernel.bsp'], [`--kernel=${NORMAL}`, '--candidate=E']]) {
    const r = cli(args);
    assert.equal(r.status, 2, args.join(' '));
    assert.equal(refusedOnStderr(r).refused, 'bad-arguments', args.join(' '));
  }
});

test('an unreadable kernel and a file that is not a kernel are told apart', () => {
  const missing = cli([`--kernel=${join(dir, 'nothing-here.bsp')}`]);
  assert.equal(missing.status, 3);
  assert.equal(refusedOnStderr(missing).refused, 'kernel-unreadable');
  const notSpk = join(dir, 'not-a-kernel.bsp');
  writeFileSync(notSpk, Buffer.alloc(2048, 65));
  const r = cli([`--kernel=${notSpk}`]);
  assert.equal(r.status, 3);
  assert.equal(refusedOnStderr(r).refused, 'not-an-spk');
});

test('--out defaults to the working directory, and is never the kernel', () => {
  const r = cli([`--kernel=${NORMAL}`]);
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  assert.equal(report.out, join(dir, 'normal-D.zeph'));
  assert.equal(readFileSync(report.out).length, report.bytes);
  const clash = cli([`--kernel=${NORMAL}`, `--out=${NORMAL}`]);
  assert.equal(clash.status, 3);
  assert.equal(refusedOnStderr(clash).refused, 'out-is-kernel');
});

const PINNED_PAYLOAD_SHA256 = 'e9c8bcb35ea95b85c32372bb4f6ab19f0292b4db3ad6975d4a4c62c2857700a8';
