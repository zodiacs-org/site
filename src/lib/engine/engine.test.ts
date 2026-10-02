/**
 * Engine accuracy gate.
 *
 * Reference longitudes are apparent geocentric TRUE-OF-DATE ecliptic
 * coordinates from JPL Horizons (QUANTITIES='31', CENTER='500@399') —
 * the same frame the engine computes. Fetched 2026-07-05.
 */
import { describe, expect, it } from 'vitest';
import horizonsReference from './fixtures/horizons-reference.json';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import '../../../scripts/lib/deltat-install.mjs';
import {
  Body, Observer, SearchHourAngle, SearchRiseSet, MakeTime, SiderealTime,
} from 'astronomy-engine';

import { computeAngles as packageComputeAngles } from '@zodiacs/engine';

import { computeBodies, computeChart } from './full';
import { computeAngles, meanObliquity, placidusCusps, wholeSignCusps, houseOf, norm } from './houses';
import { findAspects, separation } from './aspects';
import { sunLongitude, moonLongitude, moonPhaseAngle } from './lite';
import { prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';
import { formatLongitude, signForLongitude } from '../signs';
import type { BodyPosition } from './types';
import nodePolar from './fixtures/independent-node-polar.json';
import nodePolarPolicy from './fixtures/swiss-node-polar-policy.json';
import independentCases from './fixtures/independent-eight-cases.json';
import independentPolicy from './fixtures/swiss-eight-cases-policy.json';
import { expectIndependentPositions } from './fixtures/independent-validation.test-helpers';

const lonOf = (bodies: BodyPosition[], name: string) =>
  bodies.find((b) => b.body === name)!.lon;

const angleDiff = (a: number, b: number) => {
  const d = Math.abs(norm(a - b));
  return d > 180 ? 360 - d : d;
};

// The true node against the ascending node of the Moon's osculating orbit
// from NASA JPL Horizons (DE441) state vectors, and the polar angles against
// ERFA, at the instants and places of the Swiss node/polar pack that was
// removed on 2026-09-28 (docs/platform/programme/DECISIONS-2026-09-28.md §3).
// The gates are that pack's, declared before any comparison and unchanged
// (swiss-node-polar-policy.json). The references, their sources and the
// command that rebuilds them are in docs/engine-validation/independent-references/.
describe('independent true node and polar references', () => {
  it('retains the reference and pre-comparison policy bytes', () => {
    const digest = (name: string) => createHash('sha256')
      .update(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)))
      .digest('hex');
    // rc.16 rebuild: engine-version and retained Horizons manifest identity only.
    expect(digest('independent-node-polar.json'))
      .toBe('b65d3ee3058eb13f9fe84b2a7770663dd20866deefdc09aae023b594d8a38c3a');
    expect(digest('swiss-node-polar-policy.json'))
      .toBe('7742cb2bc7cd0932a344ddcb708e45dad07b91cb653ea1f55538c2d73fa18e96');
  });

  it.each(nodePolar.trueNode)('$id', (reference) => {
    const node = computeBodies(new Date(reference.input.utc))
      .find((body) => body.body === 'North Node')!;
    const policy = nodePolarPolicy.trueNode;
    expect(Number.isFinite(node.lon)).toBe(true);
    expect(Number.isFinite(node.speed)).toBe(true);
    expect(angleDiff(node.lon, reference.longitudeDegrees))
      .toBeLessThanOrEqual(policy.longitudeCircularDifferenceDegreesMaximum);
    expect(Math.abs(node.speed - reference.longitudeSpeedDegreesPerDay))
      .toBeLessThanOrEqual(policy.longitudeSpeedAbsoluteDifferenceDegreesPerDayMaximum);
    expect(node.retrograde).toBe(node.speed < 0);
    if (Math.abs(node.speed) > policy.directionDeadbandDegreesPerDay
      && Math.abs(reference.longitudeSpeedDegreesPerDay) > policy.directionDeadbandDegreesPerDay) {
      expect(node.retrograde).toBe(reference.longitudeSpeedDegreesPerDay < 0);
    }
  });

  for (const houseSystem of ['whole', 'placidus'] as const) {
    it.each(nodePolar.polar)(`$id, requested ${houseSystem}`, (reference) => {
      const chart = computeChart({
        utc: new Date(reference.input.utc),
        latitude: reference.latitudeDegrees,
        longitude: reference.longitudeDegreesEastPositive,
        houseSystem,
        timeKnown: true,
      });
      const policy = nodePolarPolicy.polar;
      expect(chart.angles).not.toBeNull();
      expect(chart.houses?.system).toBe('whole');
      expect(chart.flags.includes('polar-fallback')).toBe(houseSystem === 'placidus');
      expect(angleDiff(chart.angles!.asc, reference.whole.ascendantDegrees))
        .toBeLessThanOrEqual(policy.ascendantCircularDifferenceDegreesMaximum);
      expect(angleDiff(chart.angles!.mc, reference.whole.midheavenDegrees))
        .toBeLessThanOrEqual(policy.midheavenCircularDifferenceDegreesMaximum);
      expect(chart.houses!.cusps).toHaveLength(12);
      chart.houses!.cusps.forEach((cusp, index) => {
        expect(angleDiff(cusp, reference.whole.cuspsDegrees[index]))
          .toBeLessThanOrEqual(policy.wholeHouseCuspCircularDifferenceDegreesMaximum);
      });
      // Placidus has no cusps here: the latitude is at or past 90° minus the
      // true obliquity of date (ERFA), where a degree's semi-arc can vanish.
      expect(reference.placidusDefined).toBe(false);
      expect(Math.abs(reference.latitudeDegrees)).toBeGreaterThanOrEqual(reference.placidusLimitDegrees);
    });
  }
});

describe('independent representative supported epochs', () => {
  it('retains the reference and pre-acquisition policy bytes', () => {
    const digest = (name: string) => createHash('sha256')
      .update(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)))
      .digest('hex');
    // rc.16 nutation moves the product's solar-return instant; its independent
    // returned-chart references were re-evaluated there, with every gate unchanged.
    expect(digest('independent-eight-cases.json'))
      .toBe('d5f193da1de9bb4d9e7303a038f1fe88589c67dc8b6c266e902a3bba1b8f9527');
    expect(digest('swiss-eight-cases-policy.json'))
      .toBe('9dfc069be7c6854da1f0dff578c0b213e64624e720d21e27c6301b7612fd79a4');
  });

  it.each(independentCases.epochs)('$id', (reference) => {
    const input = independentPolicy.fixedEpochs.find((row) => row.id === reference.id)!;
    // E1800/E2199 Z strings transport nominal UT1, not historical/future UTC.
    // The Horizons positions are taken at the engine's own TT for each
    // transport, so the two programs' ΔT does not enter; the Moon's
    // light-time difference is disclosed in the frozen policy. These points do
    // not certify every supported date.
    expectIndependentPositions(computeBodies(new Date(input.productDateTransport)), reference.positions);
  });
});

// ── 1. Modern vector: JPL Horizons, 2020-01-01 00:00 UTC ─────────────
// The literals live in fixtures/horizons-reference.json, which
// scripts/claims-bindings.test.mjs also reads for the published figure.
const [HORIZONS_2020_EPOCH, HORIZONS_1907_EPOCH] = (horizonsReference as {
  epochs: { utc: string; longitudes: Record<string, number> }[];
}).epochs;
const HORIZONS_2020 = HORIZONS_2020_EPOCH.longitudes;
const HORIZONS_1907 = HORIZONS_1907_EPOCH.longitudes;

describe('ephemeris vs JPL Horizons (2020-01-01)', () => {
  const bodies = computeBodies(new Date(HORIZONS_2020_EPOCH.utc));
  for (const [name, expected] of Object.entries(HORIZONS_2020)) {
    it(`${name} within tolerance`, () => {
      const tol = name === 'Moon' ? 0.15 : 0.05;
      expect(angleDiff(lonOf(bodies, name), expected)).toBeLessThan(tol);
    });
  }
});

// ── 2. Historic vector: Horizons, 1907-07-06 15:07 UTC ───────────────
// (Frida Kahlo's birth instant ± half a minute — 08:30 LMT Coyoacán.)
describe('ephemeris vs JPL Horizons (1907-07-06)', () => {
  const bodies = computeBodies(new Date(HORIZONS_1907_EPOCH.utc));
  it('Sun 13° Cancer', () => {
    expect(angleDiff(lonOf(bodies, 'Sun'), HORIZONS_1907.Sun)).toBeLessThan(0.05);
    expect(signForLongitude(lonOf(bodies, 'Sun')).slug).toBe('cancer');
  });
  it('Moon 29° Taurus', () => {
    expect(angleDiff(lonOf(bodies, 'Moon'), HORIZONS_1907.Moon)).toBeLessThan(0.2);
    expect(signForLongitude(lonOf(bodies, 'Moon')).slug).toBe('taurus');
  });
  it('Mars 13° Capricorn', () => {
    expect(angleDiff(lonOf(bodies, 'Mars'), HORIZONS_1907.Mars)).toBeLessThan(0.05);
  });
});

// ── 3. Angles: self-grounding sky invariants ─────────────────────────
describe('angles', () => {
  const nyc = new Observer(40.7128, -74.0060, 10);

  function anglesAt(date: Date, lat: number, lon: number) {
    const gastHours = SiderealTime(MakeTime(date));
    const obliquity = meanObliquity(
      (date.getTime() - Date.UTC(2000, 0, 1, 12)) / (86400_000 * 36525)
    );
    return computeAngles({ gastHours, latitude: lat, longitude: lon, obliquity });
  }

  it('ASC ≈ Sun longitude at sunrise (NYC)', () => {
    const rise = SearchRiseSet(Body.Sun, nyc, +1, MakeTime(new Date('2024-06-01T00:00:00Z')), 2);
    expect(rise).toBeTruthy();
    const bodies = computeBodies(rise!.date);
    const a = anglesAt(rise!.date, 40.7128, -74.0060);
    expect(angleDiff(a.asc, lonOf(bodies, 'Sun'))).toBeLessThan(2.5);
  });

  it('MC ≈ Sun longitude at solar culmination (NYC)', () => {
    const culm = SearchHourAngle(Body.Sun, nyc, 0, MakeTime(new Date('2024-06-01T00:00:00Z')), 1);
    const bodies = computeBodies(culm.time.date);
    const a = anglesAt(culm.time.date, 40.7128, -74.0060);
    expect(angleDiff(a.mc, lonOf(bodies, 'Sun'))).toBeLessThan(0.2);
  });

  it('southern hemisphere ASC ≈ Sun at Sydney sunrise', () => {
    const sydney = new Observer(-33.8688, 151.2093, 20);
    const rise = SearchRiseSet(Body.Sun, sydney, +1, MakeTime(new Date('2024-06-01T00:00:00Z')), 2);
    const bodies = computeBodies(rise!.date);
    const a = anglesAt(rise!.date, -33.8688, 151.2093);
    expect(angleDiff(a.asc, lonOf(bodies, 'Sun'))).toBeLessThan(2.5);
  });
});

// ── 4. Houses ────────────────────────────────────────────────────────
describe('houses', () => {
  const date = new Date('1990-02-01T18:45:00Z');
  const gastHours = SiderealTime(MakeTime(date));
  const obliquity = meanObliquity(
    (date.getTime() - Date.UTC(2000, 0, 1, 12)) / (86400_000 * 36525)
  );

  it('whole sign cusps start at the ASC sign boundary', () => {
    const cusps = wholeSignCusps(197.4);
    expect(cusps[0]).toBe(180);
    expect(cusps[11]).toBe(150);
  });

  it('Placidus cusps are ordered and anchored to the angles (London)', () => {
    const input = { gastHours, latitude: 51.5074, longitude: -0.1278, obliquity };
    const angles = computeAngles(input);
    const cusps = placidusCusps(input, angles)!;
    expect(cusps).toHaveLength(12);
    expect(angleDiff(cusps[0], angles.asc)).toBeLessThan(1e-9);
    expect(angleDiff(cusps[9], angles.mc)).toBeLessThan(1e-9);
    // Each cusp advances eastward: total forward spans sum to 360.
    let total = 0;
    for (let i = 0; i < 12; i += 1) total += norm(cusps[(i + 1) % 12] - cusps[i]);
    expect(total).toBeCloseTo(360, 6);
    // Intermediate cusps sit strictly between their angles.
    expect(norm(cusps[10] - cusps[9])).toBeLessThan(90);
    expect(norm(cusps[11] - cusps[10])).toBeLessThan(90);
  });

  it('at the equator, Placidus RA offsets are exact 30° steps', () => {
    const input = { gastHours, latitude: 0, longitude: 12.5, obliquity };
    const angles = computeAngles(input);
    const cusps = placidusCusps(input, angles)!;
    // AD = 0 at φ=0 so cusp 11 is the ecliptic point at RAMC+30 exactly.
    const ramc = norm(gastHours * 15 + 12.5);
    const expected = norm(
      (Math.atan2(
        Math.sin(((ramc + 30) * Math.PI) / 180),
        Math.cos(((ramc + 30) * Math.PI) / 180) * Math.cos((obliquity * Math.PI) / 180)
      ) * 180) / Math.PI
    );
    expect(angleDiff(cusps[10], expected)).toBeLessThan(1e-6);
  });

  it('falls back to whole sign above the polar circle (Tromsø)', () => {
    const chart = computeChart({
      utc: new Date('2001-12-21T09:30:00Z'),
      latitude: 69.6492,
      longitude: 18.9553,
      houseSystem: 'placidus',
      timeKnown: true,
    });
    expect(chart.houses?.system).toBe('whole');
    expect(chart.flags).toContain('polar-fallback');
  });

  it('above the polar circle the ascendant is always the rising intersection', () => {
    // Longyearbyen, 78.22°N: the shared engine must select the rising
    // intersection before the site adapter sees it. Public consumers receive
    // the same angles throughout the sidereal day.
    const latitude = 78.2232;
    const longitude = 15.6267;
    for (let step = 0; step < 96; step += 1) {
      const utc = new Date(Date.UTC(2001, 11, 21) + step * 15 * 60_000);
      const input = {
        gastHours: SiderealTime(MakeTime(utc)),
        latitude,
        longitude,
        obliquity: meanObliquity(
          (utc.getTime() - Date.UTC(2000, 0, 1, 12)) / (86400_000 * 36525)
        ),
      };
      const shared = packageComputeAngles(input);
      const corrected = computeAngles(input);
      const sep = norm(corrected.asc - corrected.mc);
      expect(sep).toBeGreaterThan(0);
      expect(sep).toBeLessThan(180);
      expect(corrected).toEqual(shared);
    }
  });

  it('polar computeChart re-anchors whole-sign cusps to the corrected ascendant', () => {
    for (let step = 0; step < 24; step += 1) {
      const chart = computeChart({
        utc: new Date(Date.UTC(2001, 11, 21) + step * 3_600_000),
        latitude: 78.2232,
        longitude: 15.6267,
        houseSystem: 'placidus',
        timeKnown: true,
      });
      const sep = norm(chart.angles!.asc - chart.angles!.mc);
      expect(sep).toBeGreaterThan(0);
      expect(sep).toBeLessThan(180);
      expect(chart.houses?.system).toBe('whole');
      expect(chart.flags).toContain('polar-fallback');
      expect(chart.houses!.cusps[0]).toBe(Math.floor(norm(chart.angles!.asc) / 30) * 30);
    }
  });

  it('houseOf places longitudes into forward spans', () => {
    const cusps = wholeSignCusps(15); // ASC 15° Aries → cusp 1 at 0° Aries
    expect(houseOf(20, cusps)).toBe(1);
    expect(houseOf(35, cusps)).toBe(2);
    expect(houseOf(359, cusps)).toBe(12);
  });
});

// Five Placidus charts against ERFA: ASC and MC from ERFA's apparent sidereal
// time (IAU 2006/2000A, at the engine's UT1 and TT for the instant: since
// rc.15, UTC plus IERS UT1 − UTC from 1972 to 2027-10-02) and true
// obliquity of date, and the cusps by the conformance suite's Placidus
// construction (docs/engine-validation/independent-references/). These are the
// cases and the gates this block held to Swiss Ephemeris houses_ex until
// 2026-09-28, when Swiss output was removed from the tree
// (docs/platform/programme/DECISIONS-2026-09-28.md §3).
describe('angles and Placidus houses vs ERFA', () => {
  for (const reference of nodePolar.houses) {
    it(`${reference.id} stays inside the external accuracy gate`, () => {
      const chart = computeChart({
        utc: new Date(reference.utc),
        latitude: reference.latitude,
        longitude: reference.longitude,
        houseSystem: 'placidus',
        timeKnown: true,
      });

      expect(chart.angles).not.toBeNull();
      expect(chart.houses?.system).toBe('placidus');
      expect(chart.houses?.cusps).toHaveLength(12);
      expect(angleDiff(chart.angles!.asc, reference.asc)).toBeLessThanOrEqual(0.1);
      expect(angleDiff(chart.angles!.mc, reference.mc)).toBeLessThanOrEqual(0.1);
      reference.cusps.forEach((expected, index) => {
        expect(angleDiff(chart.houses!.cusps[index], expected)).toBeLessThanOrEqual(0.2);
      });
    });
  }
});

// ── 5. True node sanity vs Meeus mean node ───────────────────────────
describe('true node', () => {
  it('oscillates within 2° of the mean node and moves slowly', () => {
    for (const iso of ['2005-03-15T00:00:00Z', '2020-01-01T00:00:00Z', '2026-07-01T00:00:00Z']) {
      const date = new Date(iso);
      const bodies = computeBodies(date);
      const node = bodies.find((b) => b.body === 'North Node')!;
      const n = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400_000;
      const meanNode = norm(125.04452 - 0.05295377 * n);
      expect(angleDiff(node.lon, meanNode)).toBeLessThan(2);
      expect(Math.abs(node.speed)).toBeLessThan(0.3);
    }
  });
});

// ── 6. lite.ts stays honest against the full engine ──────────────────
describe('lite approximations', () => {
  for (const iso of ['2026-07-05T12:00:00Z', '2027-01-15T03:00:00Z', '2026-11-01T22:00:00Z']) {
    it(`Sun/Moon at ${iso}`, () => {
      const date = new Date(iso);
      const bodies = computeBodies(date);
      expect(angleDiff(sunLongitude(date), lonOf(bodies, 'Sun'))).toBeLessThan(0.1);
      expect(angleDiff(moonLongitude(date), lonOf(bodies, 'Moon'))).toBeLessThan(0.5);
      expect(moonPhaseAngle(date)).toBeGreaterThanOrEqual(0);
    });
  }
});

// ── 7. Aspects ───────────────────────────────────────────────────────
describe('aspects', () => {
  const mk = (body: string, lon: number, speed = 1): BodyPosition =>
    ({ body: body as BodyPosition['body'], lon, lat: 0, speed, retrograde: speed < 0 });

  it('finds a tightening square with luminary orb', () => {
    // Moon at 10°, Mars at 102° — separation 92°, Moon faster: applying.
    const aspects = findAspects([mk('Moon', 10, 13), mk('Mars', 102, 0.5)]);
    expect(aspects).toHaveLength(1);
    expect(aspects[0].type).toBe('square');
    expect(aspects[0].orb).toBeCloseTo(2, 5);
    expect(aspects[0].applying).toBe(true);
  });

  it('respects tighter non-luminary orbs', () => {
    // Mercury–Venus at 65° apart: 5° from sextile > 4° orb → nothing.
    expect(findAspects([mk('Mercury', 0), mk('Venus', 65)])).toHaveLength(0);
  });

  it('separation is symmetric and wraps', () => {
    expect(separation(350, 10)).toBe(20);
    expect(separation(10, 350)).toBe(20);
  });
});

// ── 8. The full pipeline: Frida Kahlo fixture ────────────────────────
await prepareLocalTime('1907-07-06', 'America/Mexico_City');
describe('Frida Kahlo chart (the demo fixture)', () => {
  // Coyoacán's own mean time, 6 h 36 min 38 s behind Greenwich, as the
  // calculator resolves this birth from its city index.
  const resolved = resolveLocalToUtc('1907-07-06', '08:30', 'America/Mexico_City', { longitude: -99.16 });
  const chart = computeChart({
    utc: resolved.utc,
    latitude: 19.35,   // Coyoacán
    longitude: -99.16,
    houseSystem: 'whole',
    timeKnown: true,
    flags: resolved.flags,
  });

  it('big three land on the documented signs', () => {
    expect(signForLongitude(lonOf(chart.bodies, 'Sun')).slug).toBe('cancer');
    expect(signForLongitude(lonOf(chart.bodies, 'Moon')).slug).toBe('taurus');
    expect(signForLongitude(chart.angles!.asc).slug).toBe('leo');
  });

  it('carries the lmt flag through', () => {
    expect(chart.flags).toContain('lmt');
  });

  it('formats longitudes for display', () => {
    expect(formatLongitude(lonOf(chart.bodies, 'Sun'))).toMatch(/^13°\d{2}′ Cancer$/);
  });

  it('writes the homepage fixture when asked', () => {
    if (!process.env.GENERATE_FIXTURE) return;
    const out = resolve(process.cwd(), 'src/data/demo-chart-frida.json');
    mkdirSync(resolve(process.cwd(), 'src/data'), { recursive: true });
    writeFileSync(
      out,
      JSON.stringify(
        {
          name: 'Frida Kahlo',
          birth: 'July 6, 1907 · 8:30 AM · Coyoacán, Mexico',
          utc: chart.input.utc.toISOString(),
          bodies: chart.bodies.map((b) => ({
            body: b.body,
            lon: Number(b.lon.toFixed(4)),
            lat: Number(b.lat.toFixed(4)),
            speed: Number(b.speed.toFixed(6)),
            retrograde: b.retrograde,
          })),
          angles: {
            asc: Number(chart.angles!.asc.toFixed(4)),
            mc: Number(chart.angles!.mc.toFixed(4)),
          },
          houses: chart.houses,
          flags: chart.flags,
        },
        null,
        2
      ) + '\n'
    );
  });
});
