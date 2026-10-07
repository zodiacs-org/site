/**
 * Numerical witnesses for the rc.15 → rc.16 comparison, not an accuracy gate.
 * The comparison bundles are unmodified. Separate proof bundles prevent these
 * extra calculations from perturbing their astronomy-engine caches. The probe
 * imports exact installed/archive dist code, internal/math, and the same
 * astronomy-engine; no reference ephemeris or external values are involved.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import * as esbuild from 'esbuild';

const DAY = 86400000;
const RAD = 180 / Math.PI;
const circular = (x) => ((x + 180) % 360 + 360) % 360 - 180;
// Declared before measurement: absolute arithmetic consistency limits, not the
// P1.03/P2.A/Swiss acceptance tolerances. Exact replays below use Object.is.
const LONGITUDE_RESIDUAL_DEG = 1e-9;
const LATITUDE_RESIDUAL_DEG = 1e-10;
const sha = (v) => createHash('sha256').update(v).digest('hex');
const normalize = (x) => (x % 360 + 360) % 360;

export async function createMechanisms({ root, old, work }) {
  const provenance = [];
  async function probe(from, name, isNew) {
    const dist = join(from, 'node_modules/@zodiacs/engine/dist');
    const chunks = readdirSync(dist).filter((n) => n.endsWith('.js')).map((name) => ({ name, text: readFileSync(join(dist, name), 'utf8') }));
    const find = (fn) => {
      const matches = chunks.filter(({ text }) => text.includes(`\nfunction ${fn}(`));
      if (matches.length !== 1) throw new Error(`Expected one ${name} chunk defining ${fn}`);
      provenance.push({ side: name, function: fn, chunk: matches[0].name, sha256: sha(matches[0].text) });
      return JSON.stringify(join(dist, matches[0].name));
    };
    const entry = [
      "export * as math from '@zodiacs/engine/internal/math';",
      "export * as astro from 'astronomy-engine';",
      `export { timeBasis, elapsedDays } from ${find('timeBasis')};`,
      ...(isNew ? [`export { tilt, eclipticFrame, meanEcliptic, eclipticOfDate } from ${find('tilt')};`] : []),
    ].join('\n');
    const output = join(work, `${name}-proof.mjs`);
    await esbuild.build({ stdin: { contents: entry, resolveDir: from, sourcefile: `${name}-proof-entry.mjs` }, bundle: true,
      platform: 'node', format: 'esm', target: 'node22', outfile: output, logLevel: 'error' });
    return import(pathToFileURL(output).href);
  }
  const A = await probe(old, 'rc15', false);
  const B = await probe(root, 'rc16', true);
  const checks = {};
  let failures = 0;
  const stats = {};
  function check(name, pass, context, detail) {
    const row = checks[name] ??= { checks: 0, failures: 0, examples: [] };
    row.checks += 1;
    if (!pass) {
      row.failures += 1;
      failures += 1;
      if (row.examples.length < 4) row.examples.push({ context, ...detail });
    }
    return pass;
  }
  function maximum(name, value, context, unit) {
    const row = stats[name] ??= { observations: 0, maxAbsolute: 0, unit, at: null };
    row.observations += 1;
    if (Math.abs(value) > row.maxAbsolute) { row.maxAbsolute = Math.abs(value); row.at = context; }
  }
  const frames = new Map();
  function frame(ms) {
    ms = new Date(ms).getTime(); // Date truncation also applies to progressed instants.
    if (frames.has(ms)) return frames.get(ms);
    const basisA = A.timeBasis(ms, 'utc');
    const basisB = B.timeBasis(ms, 'utc');
    const context = new Date(ms).toISOString();
    const clocksEqual = check('identical time bases', isDeepStrictEqual(basisA, basisB), context, { old: basisA, new: basisB });
    const make = (P, basis) => { P.astro.SetDeltaTFunction(() => basis.deltaT.seconds); return P.astro.MakeTime(basis.ut1Days); };
    const timeA = make(A, basisA);
    const timeB = make(B, basisB);
    // Force the proof's five-term tilt to this exact TT. This cache belongs to
    // the independent proof bundle, not either original comparison bundle.
    A.astro.e_tilt({ tt: timeA.tt + 1 });
    const tiltA = A.astro.e_tilt(timeA);
    const tiltB = B.tilt(timeB.tt);
    const dpsi = (tiltB.dpsi - tiltA.dpsi) / 3600;
    const dObliquity = tiltB.tobl - tiltA.tobl;
    const equationA = 15 * tiltA.ee;
    const equationB = tiltB.ee;
    // GAST's Earth rotation and precession polynomial are identical on both
    // sides; only the equation of equinoxes changes (including rc.16's two
    // IERS complementary terms). Do not use astronomy-engine SiderealTime's
    // different clock reconstruction.
    function gast(time, equation) {
      const t = time.tt / 36525;
      const thet1 = 0.779057273264 + 0.00273781191135448 * time.ut;
      const thet3 = time.ut % 1;
      let theta = 360 * ((thet1 + thet3) % 1);
      if (theta < 0) theta += 360;
      const st = equation + 0.014506 + ((((-368e-10 * t - 29956e-9) * t - 44e-8) * t + 1.3915817) * t + 4612.156534) * t;
      let gst = (st / 3600 + theta) % 360 / 15;
      if (gst < 0) gst += 24;
      return gst;
    }
    const gastA = gast(timeA, equationA);
    const gastB = gast(timeB, equationB);
    maximum('Δψ change', dpsi * 3600, context, 'arcsec');
    maximum('true obliquity change', dObliquity * 3600, context, 'arcsec');
    maximum('GAST change', circular((gastB - gastA) * 15) * 3600, context, 'arcsec');
    const gastResidual = circular((gastB - gastA) * 15) - (equationB - equationA) / 3600;
    maximum('GAST minus equation-of-equinoxes change residual', gastResidual, context, 'deg');
    const gastOK = check('GAST change follows equation of equinoxes', Math.abs(gastResidual) <= LONGITUDE_RESIDUAL_DEG, context, { residualDegrees: gastResidual });
    const result = { ms, basisA, basisB, timeA, timeB, tiltA, tiltB, dpsi, gastA, gastB, valid: clocksEqual && gastOK, positions: new Map(), speeds: new Map() };
    frames.set(ms, result);
    return result;
  }
  function position(body, f) {
    if (f.positions.has(body)) return f.positions.get(body);
    const astro = A.astro;
    astro.SetDeltaTFunction(() => f.basisA.deltaT.seconds);
    astro.e_tilt({ tt: f.timeA.tt + 1 });
    astro.e_tilt(f.timeA);
    let old;
    let next;
    if (body === 'South Node') {
      const n = position('North Node', f);
      old = { lon: normalize(n.old.lon + 180), lat: 0 };
      next = { lon: normalize(n.next.lon + 180), lat: 0 };
    } else if (body === 'North Node') {
      const s = astro.GeoMoonState(f.timeA);
      const v = new astro.Vector(s.y * s.vz - s.z * s.vy, s.z * s.vx - s.x * s.vz, s.x * s.vy - s.y * s.vx, f.timeA);
      const e = astro.RotateVector(astro.Rotation_EQJ_ECT(f.timeA), v);
      old = { lon: normalize(Math.atan2(e.x, -e.y) * RAD), lat: 0 };
      const frame = B.eclipticFrame(f.timeB.tt);
      const [x, y] = B.meanEcliptic(frame, v.x, v.y, v.z);
      next = { lon: normalize(Math.atan2(x, -y) * RAD + frame.tilt.dpsi / 3600), lat: 0 };
    } else {
      const v = body === 'Moon' ? astro.GeoMoon(f.timeA) : astro.GeoVector(astro.Body[body], f.timeA, true);
      if (body === 'Moon') {
        const m = astro.EclipticGeoMoon(f.timeA);
        old = { lon: normalize(m.lon), lat: m.lat };
      } else {
        const e = astro.RotateVector(astro.Rotation_EQJ_ECT(f.timeA), v);
        old = { lon: normalize(Math.atan2(e.y, e.x) * RAD), lat: Math.asin(e.z / Math.hypot(e.x, e.y, e.z)) * RAD };
      }
      next = B.eclipticOfDate(v.x, v.y, v.z, f.timeB.tt);
    }
    const context = `${new Date(f.ms).toISOString()} ${body}`;
    const residual = circular(next.lon - old.lon) - f.dpsi;
    const latitudeResidual = next.lat - old.lat;
    maximum('longitude Δψ residual', residual, context, 'deg');
    maximum('latitude change from equivalent frame arithmetic', latitudeResidual, context, 'deg');
    const lonOK = check('longitude shift is Δψ at identical TT', f.valid && Math.abs(residual) <= LONGITUDE_RESIDUAL_DEG, context, { residualDegrees: residual, deltaPsiDegrees: f.dpsi });
    const latOK = check('latitude invariant under nutation-longitude rotation', f.valid && Math.abs(latitudeResidual) <= LATITUDE_RESIDUAL_DEG, context, { residualDegrees: latitudeResidual });
    const result = { old, next, lonOK, latOK };
    f.positions.set(body, result);
    return result;
  }
  function speed(body, f) {
    if (f.speeds.has(body)) return f.speeds.get(body);
    const step = body.endsWith('Node') ? 0.25 : 0.001;
    const before = frame(f.ms - step * DAY);
    const after = frame(f.ms + step * DAY);
    const a = position(body, before);
    const b = position(body, after);
    const elapsedA = A.elapsedDays(before.basisA, after.basisA, 2 * step);
    const elapsedB = B.elapsedDays(before.basisB, after.basisB, 2 * step);
    const difference = (x, y) => { let d = y - x; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
    const old = difference(a.old.lon, b.old.lon) / elapsedA;
    const next = difference(a.next.lon, b.next.lon) / elapsedB;
    const predictedChange = (after.dpsi - before.dpsi) / elapsedA;
    const residual = (next - old) - predictedChange;
    // Derived from four longitude arithmetic residuals divided by the actual
    // elapsed TT denominator, including leap-second/IERS table boundaries.
    const bound = 4 * LONGITUDE_RESIDUAL_DEG / elapsedA;
    const context = `${new Date(f.ms).toISOString()} ${body}`;
    maximum('speed minus Δψ finite-difference residual', residual, context, 'deg/day');
    const valid = check('speed shift follows Δψ at both sample TTs', a.lonOK && b.lonOK && elapsedA === elapsedB && Math.abs(residual) <= bound, context, { residualDegreesPerDay: residual, bound, elapsedDays: elapsedA });
    const result = { old, next, valid };
    f.speeds.set(body, result);
    return result;
  }
  function attest(label, context, at, a, b) {
    if (label === 'progressedInstant' || !Number.isFinite(at)) return () => null;
    const f = frame(at);
    const allowed = new Map();
    function replay(name, actual, expected, unit, tolerance = 0) {
      const residual = unit === 'angle' ? circular(actual - expected) : actual - expected;
      maximum(`${name} replay residual`, residual, context, unit === 'angle' ? 'deg' : unit);
      return check(name, tolerance === 0 ? Object.is(actual, expected) : Math.abs(residual) <= tolerance, context, { actual, expected, residual });
    }
    function bodyCheck(body, oldRow, newRow, path, isRow) {
      const p = position(body, f);
      const nTolerance = 0;
      const lonOld = replay('old longitude', oldRow.lon, p.old.lon, 'angle');
      const lonNew = replay('new longitude', newRow.lon, p.next.lon, 'angle', nTolerance);
      const deltaResidual = circular(newRow.lon - oldRow.lon) - f.dpsi;
      maximum('actual longitude Δψ residual', deltaResidual, context, 'deg');
      const deltaOK = check('actual longitude change follows Δψ', Math.abs(deltaResidual) <= LONGITUDE_RESIDUAL_DEG, context, { residualDegrees: deltaResidual });
      if (p.lonOK && lonOld && lonNew && deltaOK) allowed.set(isRow ? `${path}.lon` : path, 'full IAU2000B Δψ at identical TT; old/new vector frame replay');
      if (isRow) {
        const latOld = replay('old latitude', oldRow.lat, p.old.lat, 'deg');
        const latNew = replay('new latitude', newRow.lat, p.next.lat, 'deg');
        if (p.latOK && latOld && latNew) allowed.set(`${path}.lat`, 'equivalent ecliptic rotation arithmetic; latitude invariant verified');
        speedCheck(body.endsWith('Node') ? 'North Node' : body, oldRow.speed, newRow.speed, `${path}.speed`);
        if (allowed.has(`${path}.speed`) && check('retrograde derived from speed', oldRow.retrograde === (oldRow.speed < 0) && newRow.retrograde === (newRow.speed < 0), context)) allowed.set(`${path}.retrograde`, 'retrograde recomputed from causally verified speed');
      }
    }
    function speedCheck(body, oldSpeed, newSpeed, path) {
      const s = speed(body, f);
      const tol = 0;
      const oldOK = replay('old speed', oldSpeed, s.old, 'deg/day');
      const newOK = replay('new speed', newSpeed, s.next, 'deg/day', tol);
      if (s.valid && oldOK && newOK) allowed.set(path, 'central difference of Δψ-shifted endpoint longitudes at identical TT samples');
    }
    if (label === 'bodyLongitude') {
      const body = context.slice(context.indexOf(' ') + 1);
      bodyCheck(body, { lon: a }, { lon: b }, label, false);
    } else if (label === 'longitudeSpeed') {
      speedCheck(context.slice(context.indexOf(' ') + 1), a, b, label);
    } else {
      const oldBodies = Array.isArray(a) ? a : a.bodies;
      const newBodies = Array.isArray(b) ? b : b.bodies;
      if (oldBodies && newBodies) for (let i = 0; i < oldBodies.length; i += 1) {
        const aa = oldBodies[i]; const bb = newBodies[i];
        if (aa.body !== bb?.body) continue;
        const prefix = Array.isArray(a) ? label : `${label}.bodies`;
        bodyCheck(aa.body, aa, bb, `${prefix}[${aa.body}]`, true);
      }
      if (!Array.isArray(a)) {
        if (a.engineVersion === '0.1.1-rc.15' && b.engineVersion === '0.1.1-rc.16') allowed.set(`${label}.engineVersion`, 'exact immutable package version transition');
        if (a.angles && b.angles) {
          const common = { latitude: a.input.latitude, longitude: a.input.longitude };
          const inputA = { ...common, gastHours: f.gastA, obliquity: f.tiltA.tobl };
          const inputB = { ...common, gastHours: f.gastB, obliquity: f.tiltB.tobl };
          const anglesA = A.math.computeAngles(inputA);
          const anglesB = B.math.computeAngles(inputB);
          const angleOK = check('angles exactly reconstructed by internal/math on both frames', isDeepStrictEqual(a.angles, anglesA) && isDeepStrictEqual(b.angles, anglesB), context, { oldActual: a.angles, oldExpected: anglesA, newActual: b.angles, newExpected: anglesB });
          const housesA = A.math.computeHouses(a.input.houseSystem, inputA, anglesA);
          const housesB = B.math.computeHouses(b.input.houseSystem, inputB, anglesB);
          const houseOK = check('houses exactly reconstructed by internal/math on both frames', isDeepStrictEqual(a.houses, housesA.houses) && isDeepStrictEqual(b.houses, housesB.houses), context, { oldActual: a.houses, oldExpected: housesA, newActual: b.houses, newExpected: housesB });
          // A two-step counterfactual quantifies the separate GAST and true-
          // obliquity contributions; their sum must equal the full change.
          const midInput = { ...inputA, gastHours: inputB.gastHours };
          const midAngles = B.math.computeAngles(midInput);
          const midHouses = B.math.computeHouses(b.input.houseSystem, midInput, midAngles);
          for (const key of ['asc', 'mc', 'dsc', 'ic']) {
            maximum(`angle ${key}: GAST-only contribution`, circular(midAngles[key] - anglesA[key]) * 3600, context, 'arcsec');
            maximum(`angle ${key}: obliquity-after-GAST contribution`, circular(anglesB[key] - midAngles[key]) * 3600, context, 'arcsec');
            if (angleOK && f.valid) allowed.set(`${label}.angles.${key}`, 'internal/math exact replay from measured GAST and true-obliquity changes');
          }
          if (houseOK && angleOK && f.valid) allowed.set(`${label}.houses(${a.houses.system})`, 'internal/math exact recomputation from GAST, true obliquity and recomputed angles');
          if (housesA.houses.system === housesB.houses.system && midHouses.houses.system === housesA.houses.system) for (let i = 0; i < 12; i += 1) {
            maximum(`${a.houses.system} cusps: GAST-only contribution`, circular(midHouses.houses.cusps[i] - housesA.houses.cusps[i]) * 3600, context, 'arcsec');
            maximum(`${a.houses.system} cusps: obliquity-after-GAST contribution`, circular(housesB.houses.cusps[i] - midHouses.houses.cusps[i]) * 3600, context, 'arcsec');
          }
        }
        if (a.aspects && b.aspects) {
          const bodiesVerified = oldBodies.every((row) => allowed.has(`${label}.bodies[${row.body}].lon`) && allowed.has(`${label}.bodies[${row.body}].speed`));
          const aspectOK = check('aspects exactly recomputed from verified bodies', bodiesVerified && isDeepStrictEqual(a.aspects, A.math.findAspects(oldBodies)) && isDeepStrictEqual(b.aspects, B.math.findAspects(newBodies)), context);
          if (aspectOK) allowed.set(`${label}.aspects`, 'findAspects exact replay on Δψ-shifted bodies, including orb rounding and sort order');
        }
      }
    }
    return (path) => allowed.get(path) ?? [...allowed].find(([prefix]) => path.startsWith(`${prefix}[`) || path.startsWith(`${prefix}.`))?.[1] ?? null;
  }
  return { attest, report: () => ({
    method: 'Separate unmodified-package proof bundles: same TT/UT1, old five-term rotation and new full IAU2000B frame, central differences at each actual speed sample, internal/math angle/house and aspect reconstruction. Every differing value gets an attribution only when its numerical witnesses pass.',
    noExternalReference: true, noAccuracyGateChanged: true,
    arithmeticLimits: { longitudeResidualDegrees: LONGITUDE_RESIDUAL_DEG, latitudeResidualDegrees: LATITUDE_RESIDUAL_DEG, speedResidual: '4 × longitude residual / actual elapsed days', replay: 'Exact Object.is for every longitude, latitude and speed replay' },
    provenance, distinctTTFrames: frames.size, checks, maxima: stats, failures,
  }) };
}
