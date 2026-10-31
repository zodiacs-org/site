/**
 * The partition on a Moon that moves WITH a fast Earth-Moon barycentre.
 *
 * Every other partition fixture has a zero Moon series (`_geometry.mjs`'s
 * `packOf`), so the case version 2 exists for, a target and an observer
 * that share the EMB's 30 km/s, was never exercised by tier A. Here the
 * EMB circles the Sun at one astronomical unit, the Moon circles the EMB,
 * and the window holds a new moon: the elongation falls through the
 * five-degree floor and rises back through it.
 *
 * The truth is computed here from the same circles, with the light-time
 * iterated to convergence, and never from the code under test. Every
 * admitted span must be above the floor and every excluded span below it
 * at every sampled instant, ends included; the boundary must be a small
 * part of the window; and the centred form must be what decided it.
 *
 * Named `.nodetest.mjs`: a `node:test` suite, not a vitest one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPack } from './_pack.mjs';
import { fit, EMRAT, DAY } from './_geometry.mjs';
import { parseContainerBytes } from '../../src/core/container.mjs';
import { memorySource } from '../../src/core/source.mjs';
import { Ephemeris } from '../../src/core/ephemeris.mjs';
import { partitionDomain } from '../../src/core/domain-partition.mjs';
import { MIN_ELONGATION_RAD } from '../../src/core/deflection.mjs';
import { C_KM_S } from '../../src/core/retarded.mjs';

const AU = 1.495978707e8;
const YEAR_DAYS = 365.25;
const MONTH_DAYS = 27.321661;
const MOON_REL_EMB_KM = 384400 * (EMRAT / (1 + EMRAT));
// The Moon's phase at t = 0, chosen so the Sun, the EMB and the Moon line
// up about 1.5 days into the window: a new moon, inside it.
const MOON_PHASE = Math.PI - (2 * Math.PI * 1.5) / MONTH_DAYS + (2 * Math.PI * 1.5) / YEAR_DAYS;

const emb = (t) => {
  const a = (2 * Math.PI * t) / (YEAR_DAYS * DAY);
  return [AU * Math.cos(a), AU * Math.sin(a), 0];
};
const moonRelEmb = (t) => {
  const a = MOON_PHASE + (2 * Math.PI * t) / (MONTH_DAYS * DAY);
  // About three degrees off the ecliptic at conjunction, so the Moon passes
  // within the floor of the Sun but not across its centre.
  return [MOON_REL_EMB_KM * Math.cos(a), MOON_REL_EMB_KM * Math.sin(a), 0.05 * MOON_REL_EMB_KM * Math.cos(a)];
};

const NCOEF = 24;
const INTERVAL = 2 * DAY;
const INIT = -2 * DAY;
const NREC = 4;
const zeros = () => new Array(NCOEF).fill(0);
const series = (fn) => (r) => {
  const lo = INIT + r * INTERVAL;
  return [0, 1, 2].flatMap((c) => fit((t) => fn(t)[c], lo, lo + INTERVAL, NCOEF));
};
const bytes = buildPack({
  bodies: [
    { name: 'sun', frame: 'native', ncoef: NCOEF, nrec: NREC, initEt: INIT, intervalSec: INTERVAL, coeffs: () => [...zeros(), ...zeros(), ...zeros()] },
    { name: 'emb', frame: 'ssb', ncoef: NCOEF, nrec: NREC, initEt: INIT, intervalSec: INTERVAL, coeffs: series(emb) },
    { name: 'moon', frame: 'ssb', ncoef: NCOEF, nrec: NREC, initEt: INIT, intervalSec: INTERVAL, coeffs: series(moonRelEmb) },
  ],
  derived: { earth399: { emrat: EMRAT, from: 'moon' } },
});
const eph = new Ephemeris(memorySource(bytes), parseContainerBytes(bytes));

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const earth = (t) => sub(emb(t), scale(moonRelEmb(t), 1 / EMRAT));
const moon = (t) => add(emb(t), moonRelEmb(t));

/** The elongation, radians, at reception time t: light-time iterated, the Sun at reception. */
function elongation(t) {
  const o = earth(t);
  let tau = len(sub(moon(t), o)) / C_KM_S;
  for (let i = 0; i < 8; i += 1) tau = len(sub(moon(t - tau), o)) / C_KM_S;
  const d = sub(moon(t - tau), o);
  const toSun = scale(o, -1);
  const c = (d[0] * toSun[0] + d[1] * toSun[1] + d[2] * toSun[2]) / (len(d) * len(toSun));
  return Math.acos(Math.max(-1, Math.min(1, c)));
}

const WIN = [-DAY, 4 * DAY];
const plan = partitionDomain(eph, { body: 'Moon', fromTdbSec: WIN[0], toTdbSec: WIN[1] });
const total = (spans) => spans.reduce((s, [lo, hi]) => s + (hi - lo), 0);
const samples = (lo, hi) => {
  const out = [];
  for (let k = 0; k <= 64; k += 1) out.push(lo + ((hi - lo) * k) / 64);
  for (const dt of [1e-3, 1, 10, 30]) if (hi - lo > 2 * dt) out.push(lo + dt, hi - dt);
  return out;
};

test('the fixture really holds a new moon, through the floor and back', () => {
  let below = 0;
  for (let t = WIN[0]; t <= WIN[1]; t += 600) if (elongation(t) < MIN_ELONGATION_RAD) below += 1;
  assert.ok(below > 10 && below < 500, `${below} ten-minute samples below the floor; the window must cross it twice`);
  assert.ok(elongation(WIN[0]) > MIN_ELONGATION_RAD && elongation(WIN[1]) > MIN_ELONGATION_RAD);
  // and the observer really moves fast, which is the whole point
  const v = len(sub(earth(60), earth(0))) / 60;
  assert.ok(v > 29 && v < 31, `the geocentre moves at ${v} km/s`);
});

test('every admitted instant is above the floor, and every excluded one below it', () => {
  assert.equal(plan.execution.status, 'finished');
  assert.ok(plan.admissible.length >= 2 && plan.excluded.length >= 1, JSON.stringify({ a: plan.admissible, e: plan.excluded }));
  for (const [lo, hi] of plan.admissible) {
    for (const t of samples(lo, hi)) {
      assert.ok(elongation(t) >= MIN_ELONGATION_RAD, `admitted at ${t} s, where the elongation is ${elongation(t)} rad`);
    }
  }
  for (const [lo, hi] of plan.excluded) {
    for (const t of samples(lo, hi)) {
      assert.ok(elongation(t) < MIN_ELONGATION_RAD, `excluded at ${t} s, where the elongation is ${elongation(t)} rad`);
    }
  }
});

test('the transitions are small, and the centred form is what decided them', () => {
  const residue = total(plan.boundary) / (WIN[1] - WIN[0]);
  assert.ok(residue < 0.005, `${(residue * 100).toFixed(3)} per cent of the window came back boundary`);
  assert.ok(plan.diagnostics.centredCells > 0, 'no cell used the centred form');
  // Both crossings fall in boundary spans, never in a decided one.
  let crossings = 0;
  let prev = elongation(WIN[0]) >= MIN_ELONGATION_RAD;
  for (let t = WIN[0]; t <= WIN[1]; t += 5) {
    const now = elongation(t) >= MIN_ELONGATION_RAD;
    if (now !== prev) {
      crossings += 1;
      assert.ok(plan.boundary.some(([lo, hi]) => t - 5 >= lo - 1e-6 && t <= hi + 1e-6) || plan.boundary.some(([lo, hi]) => t >= lo && t <= hi),
        `the crossing near ${t} s is not inside a boundary span`);
    }
    prev = now;
  }
  assert.equal(crossings, 2);
});
