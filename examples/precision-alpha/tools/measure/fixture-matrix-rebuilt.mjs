/**
 * The twenty-fixture matrix of PARTITION-EVALUATION-V2.md, rule V-3.
 *
 *   node tools/measure/fixture-matrix.mjs --alpha=DIR --label=v1|v2 --out=FILE
 *   node tools/measure/fixture-matrix.mjs --compare=V1.json --with=V2.json --out=FILE
 *
 * The engine audit ran a matrix like this and committed only its digests
 * (engine-audit-2026-09-22, LEDGER.md, alpha-search-partition). This
 * rebuilds it from that description, and is committed before its first
 * version-2 run. `--alpha` names the precision-alpha tree whose search
 * code runs; the fixtures' bytes are built by THIS tree's test helpers, so
 * two runs on one machine search identical packs.
 *
 * Every fixture is exact-polynomial: the geocentric vector's ecliptic
 * components are polynomials in time, so the records hold them exactly and
 * the true roots are known. Planet-like fixtures put a fixed observer at
 * the origin and the target 1e8 km away along longitude 0, displaced by
 * `A p(t)` across the line of sight, so the geometric longitude is
 * `atan(A p(t))` and its roots are p's. With the observer at rest the
 * light-time at a root is exactly X0/c, so the reception roots are p's
 * shifted by that, and aberration adds nothing. Moon-like fixtures share
 * the EMB between target and observer, and the EMB moves at 30 km/s across
 * the line of sight; their reception roots are solved here, from the same
 * polynomials, with the light-time iterated to convergence.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPack } from '../../test/tier-a/_pack.mjs';
import { fit, DAY, EMRAT, CE, SE } from '../../test/tier-a/_geometry.mjs';

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const OUT = args.get('out');
if (!OUT) { process.stderr.write('--out=FILE is required\n'); process.exit(2); }

const C = 299792.458;
const X0 = 1e8;
const X0_MOON = 4e5;
const V_EMB = 30;
const K = 1 / EMRAT;
const WIN = [-1.5 * DAY, 1.5 * DAY];
const INIT = -3 * DAY;
const NREC = 6;
const NCOEF = 8;
const BUDGET = { maxEvaluations: 4_000_000, maxCells: 400_000 };

// ----------------------------------------------------------- the fixtures
// Each p is a polynomial in seconds; `roots` are its real roots in the
// window (simple or not); `crossings` are the sign changes, which is what a
// longitude search finds.
const poly = (...rs) => (t) => rs.reduce((v, r) => v * (t - r), 1);
const FIXTURES = [
  { id: 'M01-simple', p: poly(1080), roots: [1080], crossings: [1080] },
  { id: 'M02-pair-10s', p: poly(0, 10), roots: [0, 10], crossings: [0, 10] },
  { id: 'M03-pair-1s', p: poly(0, 1), roots: [0, 1], crossings: [0, 1] },
  { id: 'M04-pair-1ms', p: poly(0, 1e-3), roots: [0, 1e-3], crossings: [0, 1e-3] },
  { id: 'M05-tangency', p: poly(100, 100), roots: [100], crossings: [] },
  { id: 'M06-triple-root', p: poly(100, 100, 100), roots: [100], crossings: [100] },
  { id: 'M07-graze-10s', p: (t) => (t - 100) ** 2 + 10 ** 2, roots: [], crossings: [] },
  { id: 'M08-graze-0.1s', p: (t) => (t - 100) ** 2 + 0.1 ** 2, roots: [], crossings: [] },
  { id: 'M09-graze-0.01s', p: (t) => (t - 100) ** 2 + 0.01 ** 2, roots: [], crossings: [] },
  { id: 'M10-three-in-a-record', p: poly(10000, 30000, 60000), roots: [10000, 30000, 60000], crossings: [10000, 30000, 60000] },
  { id: 'M11-record-boundary', p: poly(DAY), roots: [DAY], crossings: [DAY] },
  { id: 'M12-record-boundary+1e-9', p: poly(DAY + 1e-9), roots: [DAY + 1e-9], crossings: [DAY + 1e-9] },
  { id: 'M13-record-boundary+1e-7', p: poly(DAY + 1e-7), roots: [DAY + 1e-7], crossings: [DAY + 1e-7] },
  { id: 'M14-record-boundary+1e-5', p: poly(DAY + 1e-5), roots: [DAY + 1e-5], crossings: [DAY + 1e-5] },
  { id: 'M15-left-edge', edge: 'left', offset: 0 },
  { id: 'M16-right-edge', edge: 'right', offset: 0 },
  { id: 'M17-left-edge+1s', edge: 'left', offset: 1 },
  { id: 'M18-right-edge-1s', edge: 'right', offset: 1 },
  { id: 'M19-four-roots', p: poly(-100000, -20000, 40000, 110000), roots: [-100000, -20000, 40000, 110000], crossings: [-100000, -20000, 40000, 110000] },
  { id: 'M20-no-root', p: (t) => t + 3 * DAY, roots: [], crossings: [] },
];
const MOON_LIKE = new Set(['M01-simple', 'M02-pair-10s', 'M10-three-in-a-record', 'M14-record-boundary+1e-5', 'M19-four-roots', 'M20-no-root']);

/**
 * The edge fixtures are defined by their RECEPTION root, at or 1 s inside
 * a window edge, for a planet-like target; the geometric rung's window is
 * the same, so its root sits light-time X0/c earlier than the edge.
 */
function edgeFixture(f) {
  const tau = X0 / C;
  const reception = f.edge === 'left' ? WIN[0] + f.offset : WIN[1] - f.offset;
  const r = reception - tau;
  return { ...f, p: poly(r), roots: [r], crossings: [r] };
}

/** Scale each p so the displacement stays well inside a radian over the window. */
function scaleOf(p) {
  let m = 0;
  for (let t = INIT; t <= INIT + NREC * DAY; t += 600) m = Math.max(m, Math.abs(p(t)));
  return 0.3 / m;
}

const toEqu = ([x, y, z]) => [x, y * CE - z * SE, y * SE + z * CE];
const zeros = () => new Array(NCOEF).fill(0);
const seriesOf = (fn) => (r) => {
  const lo = INIT + r * DAY;
  return [0, 1, 2].flatMap((c) => fit((t) => fn(t)[c], lo, lo + DAY, NCOEF));
};

function packFor(f, kind) {
  const A = scaleOf(f.p);
  const sun = () => toEqu([0, -1.5e8, 0]);
  if (kind === 'planet') {
    const target = (t) => toEqu([X0, X0 * A * f.p(t), 0]);
    return {
      A,
      bytes: buildPack({
        bodies: [
          { name: 'sun', frame: 'native', ncoef: NCOEF, nrec: NREC, initEt: INIT, intervalSec: DAY, coeffs: seriesOf(sun) },
          { name: 'emb', frame: 'ssb', ncoef: NCOEF, nrec: NREC, initEt: INIT, intervalSec: DAY, coeffs: () => [...zeros(), ...zeros(), ...zeros()] },
          { name: 'moon', frame: 'ssb', ncoef: NCOEF, nrec: NREC, initEt: INIT, intervalSec: DAY, coeffs: () => [...zeros(), ...zeros(), ...zeros()] },
          { name: 'marsBary', frame: 'ssb', ncoef: NCOEF, nrec: NREC, initEt: INIT, intervalSec: DAY, coeffs: seriesOf(target) },
        ],
        derived: { earth399: { emrat: EMRAT, from: 'moon' } },
      }),
    };
  }
  const geo = (t) => toEqu([X0_MOON, X0_MOON * A * f.p(t), 0]);
  const emb = (t) => toEqu([0, V_EMB * t, 0]);
  const moonRel = (t) => geo(t).map((x) => x / (1 + K));
  return {
    A,
    geo,
    emb,
    moonRel,
    bytes: buildPack({
      bodies: [
        { name: 'sun', frame: 'native', ncoef: NCOEF, nrec: NREC, initEt: INIT, intervalSec: DAY, coeffs: seriesOf(sun) },
        { name: 'emb', frame: 'ssb', ncoef: NCOEF, nrec: NREC, initEt: INIT, intervalSec: DAY, coeffs: seriesOf(emb) },
        { name: 'moon', frame: 'ssb', ncoef: NCOEF, nrec: NREC, initEt: INIT, intervalSec: DAY, coeffs: seriesOf(moonRel) },
      ],
      derived: { earth399: { emrat: EMRAT, from: 'moon' } },
    }),
  };
}

/**
 * The Moon-like fixture's true reception roots, from the same polynomials.
 * d(t) = moon(t - tau) - earth(t), tau iterated; the longitude is the
 * ecliptic one, so its sign is the sign of d's ecliptic y. The EMB's
 * 30 km/s over the light-time moves d by about 40 km across the line of
 * sight, which moves a root by tens to thousands of seconds, so the whole
 * window is scanned at 0.25 s and every sign change bisected; roots closer
 * together than the step would be missed, and none of the six Moon-like
 * fixtures has any.
 */
function moonReceptionRoots(pk) {
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sc = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const moon = (t) => add(pk.emb(t), pk.moonRel(t));
  const earth = (t) => add(pk.emb(t), sc(pk.moonRel(t), -K));
  const yEcl = (t) => {
    const o = earth(t);
    let tau = X0_MOON / C;
    for (let i = 0; i < 12; i += 1) {
      const d = add(moon(t - tau), sc(o, -1));
      tau = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) / C;
    }
    const d = add(moon(t - tau), sc(o, -1));
    return d[1] * CE + d[2] * SE;            // the ecliptic y of d
  };
  const roots = [];
  const STEP = 0.25;
  let a = WIN[0];
  let fa = yEcl(a);
  if (fa === 0) roots.push(a);
  for (let b = a + STEP; b <= WIN[1] + 1e-9; b += STEP) {
    const fb = yEcl(b);
    if (fb === 0) roots.push(b);
    else if (fa !== 0 && Math.sign(fa) !== Math.sign(fb)) {
      let lo = a; let hi = b; let flo = fa;
      for (let i = 0; i < 80 && hi - lo > 1e-9; i += 1) {
        const m = (lo + hi) / 2;
        const fm = yEcl(m);
        if (Math.sign(fm) === Math.sign(flo)) { lo = m; flo = fm; } else hi = m;
      }
      roots.push((lo + hi) / 2);
    }
    a = b; fa = fb;
  }
  return roots;
}

// ------------------------------------------------------------------ a run
async function run(alphaDir, label) {
  const { parseContainerBytes } = await import(join(alphaDir, 'src/core/container.mjs'));
  const { memorySource } = await import(join(alphaDir, 'src/core/source.mjs'));
  const { Ephemeris } = await import(join(alphaDir, 'src/core/ephemeris.mjs'));
  const RS = await import(join(alphaDir, 'src/core/retarded-search.mjs'));
  const VS = await import(join(alphaDir, 'src/core/validated-search.mjs'));
  const ptI = (x) => ({ lo: x, hi: x });
  const R1E0 = [[1, 0, 0], [0, CE, SE], [0, -SE, CE]];
  const fixedEcliptic = () => ({
    R: R1E0.map((row) => row.map(ptI)),
    Rdot: [0, 1, 2].map(() => [ptI(0), ptI(0), ptI(0)]),
    angles: null,
    clock: { t: ptI(0), dtdTdb: ptI(1), tdbMinusTtSec: ptI(0) },
  });
  const shape = (r, timeKey, bracketKey, scale = 1) => ({
    status: r.execution?.status ?? r.status ?? null,
    established: r.completeness?.established ?? null,
    found: r.events.length,
    events: r.events.map((e) => ({
      t: e[timeKey] * scale,
      bracket: e[bracketKey].map((x) => x * scale),
      direction: e.direction ?? null,
    })),
    unresolved: (r.completeness?.unresolved ?? r.unresolved ?? []).length,
    evaluations: r.execution?.evaluations ?? r.evaluations ?? null,
  });
  const attempt = (fn) => {
    const t0 = Date.now();
    try {
      const out = fn();
      return { ...out, ms: Date.now() - t0 };
    } catch (error) {
      return { error: `${error.code ?? error.name}: ${error.message}`.slice(0, 300), ms: Date.now() - t0 };
    }
  };

  const rows = [];
  for (const base of FIXTURES) {
    const f = base.edge ? edgeFixture(base) : base;
    for (const kind of MOON_LIKE.has(f.id) ? ['planet', 'moon'] : ['planet']) {
      const pk = packFor(f, kind);
      const eph = new Ephemeris(memorySource(pk.bytes), parseContainerBytes(pk.bytes));
      const body = kind === 'planet' ? 'Mars' : 'Moon';
      const spec = { body, targetDeg: 0, fromTdbSec: WIN[0], toTdbSec: WIN[1], ...BUDGET };
      const reception = kind === 'planet'
        ? f.crossings.map((r) => r + X0 / C)
        : moonReceptionRoots(pk);
      const rungs = {
        geometric: attempt(() => shape(VS.searchGeometricLongitude(eph, { body, targetDeg: 0, fromTtDays: WIN[0] / DAY, toTtDays: WIN[1] / DAY, maxEvaluations: BUDGET.maxEvaluations }), 'ttDays', 'bracketTtDays', DAY)),
        retarded: attempt(() => shape(RS.searchRetardedLongitude(eph, spec), 'tdbSec', 'bracketTdbSec')),
        aberrated: attempt(() => shape(RS.searchAberratedLongitude(eph, spec), 'tdbSec', 'bracketTdbSec')),
        ofDateFixedFrame: attempt(() => shape(RS.searchOfDateLongitudeWithFrame(eph, spec, fixedEcliptic), 'tdbSec', 'bracketTdbSec')),
        ofDate: attempt(() => shape(RS.searchOfDateLongitude(eph, spec), 'tdbSec', 'bracketTdbSec')),
        deflected: attempt(() => shape(RS.searchDeflectedLongitude(eph, spec), 'tdbSec', 'bracketTdbSec')),
      };
      // Known roots: the geometric rung's are p's crossings; the reception
      // rungs' are `reception`, except where the moving observer's own
      // aberration (Moon-like) or a real frame of date or the deflection
      // moves them, which are counted only.
      // Each rung's window is [WIN[0], WIN[1]], closed, so a root just
      // outside it is not one the rung should find. A Moon-like root the
      // solver above could not bracket makes that rung count-only.
      const inWindow = (xs) => (xs.some((t) => t === null) ? null : xs.filter((t) => t >= WIN[0] && t <= WIN[1]));
      const rec = inWindow(reception);
      const known = {
        geometric: inWindow(f.crossings),
        retarded: rec,
        aberrated: kind === 'planet' ? rec : null,
        ofDateFixedFrame: kind === 'planet' ? rec : null,
        ofDate: null,
        deflected: null,
      };
      rows.push({ fixture: f.id, kind, scale: pk.A, known, rungs });
      process.stdout.write(`${label} ${f.id} ${kind}: ${Object.entries(rungs).map(([k, v]) => `${k}=${v.error ? 'ERR' : `${v.found}${v.established ? '!' : '?'}`}`).join(' ')}\n`);
    }
  }
  return { tool: 'tools/measure/fixture-matrix.mjs', label, alpha: alphaDir, node: process.version, platform: `${process.platform}-${process.arch}`, window: WIN, rows };
}

// -------------------------------------------------------------- the rules
function compare(v1, v2) {
  const key = (r) => `${r.fixture}|${r.kind}`;
  const one = new Map(v1.rows.map((r) => [key(r), r]));
  const falseProofs = [];
  const lost = [];
  const changed = [];
  let knownChecks = 0;
  for (const r of v2.rows) {
    const old = one.get(key(r));
    if (!old) { changed.push({ row: key(r), why: 'missing from version 1' }); continue; }
    for (const [rung, res] of Object.entries(r.rungs)) {
      const truth = r.known[rung];
      for (const [name, x] of [['v1', old.rungs[rung]], ['v2', res]]) {
        if (truth && x && !x.error && x.established) {
          knownChecks += 1;
          const inside = truth.every((t) => t !== null && x.events.some((e) => e.bracket[0] <= t && t <= e.bracket[1]));
          if (x.found !== truth.length || !inside) falseProofs.push({ row: key(r), rung, version: name, found: x.found, truth });
        }
      }
      const a = old.rungs[rung];
      if (a && !a.error) {
        for (const e of a.events) {
          if (!(res.events ?? []).some((g) => Math.abs(g.t - e.t) <= 1e-3 && g.direction === e.direction)) lost.push({ row: key(r), rung, t: e.t });
        }
      }
      if (r.kind === 'planet') {
        const strip = (x) => JSON.stringify({ status: x.status, established: x.established, events: x.events, error: x.error ?? null });
        if (strip(a) !== strip(res)) changed.push({ row: key(r), rung });
      }
    }
  }
  return {
    rule: 'PARTITION-EVALUATION-V2.md V-3',
    knownRootChecks: knownChecks,
    falseProofs,
    lostEvents: lost,
    planetLikeRungsNotBitIdentical: changed,
    verdict: falseProofs.length === 0 && lost.length === 0 && changed.length === 0 ? 'PASS' : 'FAIL',
  };
}

if (args.has('compare')) {
  const v1 = JSON.parse(readFileSync(args.get('compare'), 'utf8'));
  const v2 = JSON.parse(readFileSync(args.get('with'), 'utf8'));
  const out = compare(v1, v2);
  writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
  process.stdout.write(`${out.verdict}: ${out.knownRootChecks} known-root checks, ${out.falseProofs.length} false proofs, ${out.lostEvents.length} lost events, ${out.planetLikeRungsNotBitIdentical.length} planet-like rungs not bit-identical\n`);
} else {
  const here = dirname(fileURLToPath(import.meta.url));
  const alpha = resolve(args.get('alpha') ?? join(here, '..', '..'));
  const out = await run(alpha, args.get('label') ?? 'run');
  writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
}
