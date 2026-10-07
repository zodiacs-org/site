import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import * as ephemeris from './full';
import { findLongitudeCrossings } from './returns';
import { resolveLocalToUtc } from '../time/localToUtc';
import type { Chart, ChartInput } from './types';
import policy from './fixtures/independent-lunar-return-policy.json';
import references from './fixtures/independent-lunar-returns.json';
import applicability from './fixtures/swiss-lunar-fixed-target-applicability.json';
import {
  lunarReturnChart, lunarReturnInstant, LUNAR_RETURN_HORIZON_DAYS,
  LUNAR_RETURN_MAX_AFTER_UTC, LUNAR_RETURN_MAX_UTC, LUNAR_RETURN_MIN_UTC,
  LUNAR_RETURN_STEP_DAYS,
} from './lunar-return';

const DAY_MS = 86_400_000;
const delta = (value: number, target: number) => ((value - target + 540) % 360) - 180;
const reportRows: Record<string, Record<string, unknown>> = {};
const digest = (path: URL) => createHash('sha256').update(readFileSync(path)).digest('hex');
const natalInput = (utc: string): ChartInput => ({
  utc: new Date(utc), latitude: 0, longitude: 0, houseSystem: 'placidus', timeKnown: true,
});
const locationFor = (location: { latitudeDegrees: number; longitudeDegreesEastPositive: number }) => ({
  latitude: location.latitudeDegrees, longitude: location.longitudeDegreesEastPositive,
});

afterEach(() => vi.restoreAllMocks());

// Opt-in review receipt records actual outputs only. Raw provider expectations
// remain separate, hash-pinned inputs; a companion test log supplies the result.
afterAll(() => {
  const path = process.env.LUNAR_RETURN_COMPARISON_REPORT;
  if (!path) return;
  const sourceFiles = [
    './lunar-return.ts', './lunar-return.test.ts', './full.ts', './houses.ts',
    './types.ts', './returns.ts',
    './fixtures/independent-lunar-return-policy.json', './fixtures/independent-lunar-returns.json',
    './fixtures/swiss-lunar-fixed-target-applicability.json',
  ];
  writeFileSync(path, JSON.stringify({
    scope: 'Application calculations from the reviewed lunar unit comparison. Provider outputs and assertions are retained separately.',
    recordedAtUTC: new Date().toISOString(), node: process.version,
    sourceSHA256: Object.fromEntries(sourceFiles.map((name) => [name, digest(new URL(name, import.meta.url))])),
    cases: reportRows,
    fixedExternalTargetIdentityChecks: 'Explicitly omitted under the pre-output root-approved applicability amendment; not recorded as passing.',
  }, null, 2) + '\n', { flag: 'wx' });
});

function record(id: string, part: string, value: unknown) {
  (reportRows[id] ??= {})[part] = value;
}

function expectTime(actual: Date, expected: { expectedMilliseconds: number; timeScale: string }, interval: number[]) {
  const milliseconds = actual.getTime();
  const residual = (milliseconds - expected.expectedMilliseconds) / 1000;
  const diagnostic = `${expected.timeScale}: signed residual ${residual}s`;
  expect(Number.isFinite(milliseconds), diagnostic).toBe(true);
  expect(milliseconds, diagnostic).toBeGreaterThanOrEqual(interval[0]);
  expect(milliseconds, diagnostic).toBeLessThanOrEqual(interval[1]);
}

type ReferencePosition = { longitudeDegrees: number; speedDegreesPerDay?: number };

function expectIndependentChart(actual: Chart, expected: typeof references.cases[number]['chartAtIndependentInstant']) {
  // The references carry a speed for the node, the one body whose speed is gated.
  for (const [name, position] of Object.entries(expected.positions) as [string, ReferencePosition][]) {
    const body = actual.bodies.find((row) => row.body === name)!;
    expect(body, name).toBeDefined();
    expect(Number.isFinite(body.lon), name).toBe(true);
    expect(Number.isFinite(body.speed), name).toBe(true);
    expect(body.retrograde, name).toBe(body.speed < 0);
    const gate = name === 'Moon' ? policy.gates.returnedChartMoonCircularDegreesMaximum
      : name === 'North Node' ? policy.gates.nodeCircularDegreesMaximum
        : policy.gates.otherPlanetCircularDegreesMaximum;
    expect(Math.abs(delta(body.lon, position.longitudeDegrees)), name).toBeLessThanOrEqual(gate);
    if (name === 'North Node') {
      expect(Number.isFinite(position.speedDegreesPerDay), name).toBe(true);
      const speed = position.speedDegreesPerDay!;
      expect(Math.abs(body.speed - speed))
        .toBeLessThanOrEqual(policy.gates.nodeSpeedAbsoluteDegreesPerDayMaximum);
      if (Math.abs(body.speed) > policy.gates.directionDeadbandDegreesPerDay
        && Math.abs(speed) > policy.gates.directionDeadbandDegreesPerDay) {
        expect(body.retrograde).toBe(speed < 0);
      }
    }
  }
  expect(actual.angles).not.toBeNull();
  expect(actual.houses?.system).toBe(expected.expectedProductHouseSystem);
  expect(actual.flags.includes('polar-fallback')).toBe(expected.expectedProductHouseSystem === 'whole');
  expect(Math.abs(delta(actual.angles!.asc, expected.ascmc[0])))
    .toBeLessThanOrEqual(policy.gates.ascendantCircularDegreesMaximum);
  expect(Math.abs(delta(actual.angles!.mc, expected.ascmc[1])))
    .toBeLessThanOrEqual(policy.gates.midheavenCircularDegreesMaximum);
  expect(actual.houses!.cusps).toHaveLength(12);
  actual.houses!.cusps.forEach((cusp, index) => {
    expect(Math.abs(delta(cusp, expected.cuspsDegrees[index])))
      .toBeLessThanOrEqual(policy.gates.houseCuspCircularDegreesMaximum);
  });
}

// The six lunar-return cases against NASA JPL Horizons (DE441) for the Moon
// and the chart bodies and ERFA for angles and cusps
// (docs/engine-validation/independent-references/). The cases, gates and
// conditioning are the Swiss lunar-return policy's, declared on 2026-09-05
// before any application comparison and carried over unchanged; only the
// arbiter changed, when Swiss output was removed from the tree on 2026-09-28
// (docs/platform/programme/DECISIONS-2026-09-28.md §3), and with it L-wrap's
// birth, the first 0° crossing of the Horizons Moon after 2000-01-01.
describe('independent lunar return references', () => {
  it('preserves the approved inputs, gates and applicability amendment', () => {
    expect(digest(new URL('./fixtures/independent-lunar-return-policy.json', import.meta.url)))
      .toBe('5db9f2ef1491fc96896d2d610bbe91a84b0743dd30b449f923e8c2d7aafa5ba5');
    // rc.16 nutation moves returned-chart instants; rebuild their Horizons/ERFA
    // references at those instants, retaining the independent crossings and gates.
    // The rc.17 rebuild changes only the engine version the file records.
    expect(digest(new URL('./fixtures/independent-lunar-returns.json', import.meta.url)))
      .toBe('4bbbeeca7d880f1db8178175380687d92eaa29fd57ba686b29379e348a60e5b0');
    expect(digest(new URL('./fixtures/swiss-lunar-fixed-target-applicability.json', import.meta.url)))
      .toBe('2f9056c0f93b22e3270bf1f496d804759a9057ac6b3e5a142604248ba1dddb1a');
    // The carried-over policy names the one it supersedes, and keeps its gates.
    expect(policy.supersedes.sha256).toBe('16c807cfb7374c340200064ba6f4332b98923f77b05f6f24f62ea5541d5aa146');
    expect(LUNAR_RETURN_STEP_DAYS).toBe(policy.productScanContract.stepDays);
    expect(LUNAR_RETURN_HORIZON_DAYS).toBe(policy.productScanContract.horizonUniformDays);
    expect(LUNAR_RETURN_MIN_UTC).toBe(policy.supportedTransportInterval.minimumInclusive);
    expect(LUNAR_RETURN_MAX_UTC).toBe(policy.supportedTransportInterval.maximumInclusive);
    expect(LUNAR_RETURN_MAX_AFTER_UTC).toBe(policy.supportedTransportInterval.afterMaximumInclusive);
  });

  it.each(references.cases)('$id: complete natal-derived first return and full chronology', (reference) => {
    const input = policy.cases.find((row) => row.id === reference.id)!;
    const natal = natalInput(input.birthTransport);
    const after = new Date(input.afterTransport);
    const target = ephemeris.bodyLongitude('Moon', natal.utc);
    const chart = lunarReturnChart(natal, after, locationFor(input.returnLocation));
    const all = findLongitudeCrossings(
      'Moon', target, after, new Date(after.getTime() + 40 * DAY_MS), 0.25,
    );
    record(reference.id, 'completeNatalDerived', { targetLongitude: target, chart, allCrossings: all });
    expect(Math.abs(delta(target, reference.natalLongitudeDegrees)))
      .toBeLessThanOrEqual(policy.gates.natalMoonCircularDegreesMaximum);
    expect(all).toHaveLength(reference.crossings.length);
    all.forEach((event, index) => {
      const expected = reference.crossings[index];
      expectTime(event.at, expected, expected.natalDerivedAllowedMilliseconds);
      expect(event.retrograde).toBe(expected.retrograde);
      if (index > 0) expect(event.at.getTime()).toBeGreaterThan(all[index - 1].at.getTime());
    });
    expect(chart.input.utc).toEqual(all[0].at);
    expect(chart.input.utc.getTime()).toBeGreaterThan(after.getTime());
    const moon = chart.bodies.find((body) => body.body === 'Moon')!;
    expect(Number.isFinite(moon.speed)).toBe(true);
    expect(moon.retrograde).toBe(false);
    expect(Math.abs(delta(moon.lon, target))).toBeLessThanOrEqual(policy.gates.productOwnTargetResidualDegreesMaximum);
    // Returned-chart parity uses the separate same-time reference below;
    // independent event timing and fixed-clock components remain separate.
  });

  it.each(references.cases.filter((row) => applicability.fixedExternalTargetCases.includes(row.id)))
    ('$id: conditioned fixed external-target crossing', (reference) => {
      const input = policy.cases.find((row) => row.id === reference.id)!;
      const after = new Date(input.afterTransport);
      const instant = lunarReturnInstant(reference.natalLongitudeDegrees, after);
      record(reference.id, 'fixedExternalTarget', { instant });
      expectTime(instant, reference.crossings[0], reference.crossings[0].fixedExternalTargetAllowedMilliseconds);
    });

  it.each(references.cases)('$id: chart at the separately preserved independent instant', (reference) => {
    const input = policy.cases.find((row) => row.id === reference.id)!;
    const chart = ephemeris.computeChart({
      utc: new Date(reference.independentChartUTC), ...locationFor(input.returnLocation),
      houseSystem: 'placidus', timeKnown: true,
    });
    record(reference.id, 'fixedIndependentChart', { chart });
    expectIndependentChart(chart, reference.chartAtIndependentInstant);
    const moon = chart.bodies.find((body) => body.body === 'Moon')!;
    expect(Math.abs(delta(moon.lon, reference.chartAtIndependentInstant.positions.Moon.longitudeDegrees)))
      .toBeLessThanOrEqual(policy.gates.transitMoonAtIndependentInstantCircularDegreesMaximum);
  });

  it.each(references.returnedCharts)('$id: returned chart at the same independent reference clock', (reference) => {
    const input = policy.cases.find((row) => row.id === reference.caseId)!;
    const location = reference.id.endsWith(':relocation') ? input.relocationAtSameInstant! : input.returnLocation;
    const chart = lunarReturnChart(natalInput(input.birthTransport), new Date(input.afterTransport), locationFor(location));
    record(reference.caseId, reference.id.endsWith(':relocation') ? 'sameTimeRelocatedChart' : 'sameTimeReturnedChart', { chart });
    // The reference chart was taken at the instant the product returned when
    // the references were built. The returned chart must be the chart at its
    // own instant, the product's chart at the reference's instant is held to
    // it, and the two instants may differ by at most 15 s. Beyond that,
    // rebuild the independent references at the new product timestamp.
    const place = { ...locationFor(location), houseSystem: 'placidus' as const, timeKnown: true };
    expect(chart).toEqual(ephemeris.computeChart({ utc: chart.input.utc, ...place }));
    const supplementUtc = new Date(reference.utc);
    expect(Math.abs(chart.input.utc.getTime() - supplementUtc.getTime()), 'The returned-chart reference no longer applies; rebuild the independent references at the new product timestamp')
      .toBeLessThanOrEqual(15_000);
    expectIndependentChart(ephemeris.computeChart({ utc: supplementUtc, ...place }), reference.reference);
  });

  it('retains geocentric event identity under relocation and the independent relocated component', () => {
    const input = policy.cases[0];
    const reference = references.cases[0];
    const relocation = input.relocationAtSameInstant!;
    const natal = natalInput(input.birthTransport);
    const after = new Date(input.afterTransport);
    const first = lunarReturnChart(natal, after, locationFor(input.returnLocation));
    const second = lunarReturnChart(natal, after, locationFor(relocation));
    expect(second.input.utc).toEqual(first.input.utc);
    expect(second.bodies).toEqual(first.bodies);
    expect(second.angles).not.toEqual(first.angles);
    const fixed = ephemeris.computeChart({
      utc: new Date(reference.independentChartUTC), ...locationFor(relocation), houseSystem: 'placidus', timeKnown: true,
    });
    record(input.id, 'relocation', { productChart: second, fixedIndependentChart: fixed });
    expectIndependentChart(fixed, reference.relocatedChartAtIndependentInstant!);
  });
});

describe('lunar input and strict-next contracts', () => {
  const after = new Date('2026-03-01T00:00:00Z');
  const known = () => natalInput('1990-02-01T12:00:00Z');

  it.each([NaN, Infinity, -Infinity])('rejects a non-finite target %s', (target) => {
    expect(() => lunarReturnInstant(target, after)).toThrow(RangeError);
  });

  it.each([new Date(NaN), new Date(Date.parse(LUNAR_RETURN_MIN_UTC) - 1), new Date(Date.parse(LUNAR_RETURN_MAX_AFTER_UTC) + 1)])
    ('rejects an invalid or out-of-range reference %s', (reference) => {
      expect(() => lunarReturnInstant(0, reference)).toThrow(RangeError);
      expect(() => lunarReturnChart(known(), reference)).toThrow(RangeError);
    });

  it.each([new Date(NaN), new Date(Date.parse(LUNAR_RETURN_MIN_UTC) - 1), new Date('2026-03-02T00:00:00Z')])
    ('rejects an invalid, unsupported or subsequent birth %s', (utc) => {
      expect(() => lunarReturnChart({ ...known(), utc }, after)).toThrow(RangeError);
    });

  it.each<Partial<ChartInput>>([
    { timeKnown: false }, { flags: ['no-time'] }, { flags: ['dst-gap'] }, { flags: ['dst-fold'] },
    { latitude: undefined }, { longitude: undefined }, { latitude: NaN }, { longitude: Infinity },
    { latitude: 91 }, { longitude: -181 },
  ])('rejects incomplete or uncertain natal input %j', (invalid) => {
    expect(() => lunarReturnChart({ ...known(), ...invalid }, after)).toThrow(RangeError);
  });

  it.each([['2025-03-09', '02:30', 'dst-gap'], ['2025-11-02', '01:30', 'dst-fold']])
    ('rejects an actual IANA ambiguity %s %s', (date, time, expectedFlag) => {
      const resolved = resolveLocalToUtc(date, time, 'America/New_York');
      expect(resolved.flags).toContain(expectedFlag);
      expect(() => lunarReturnChart({ ...known(), utc: resolved.utc, flags: resolved.flags }, after))
        .toThrow('unambiguous birth time');
    });

  it('rejects an invalid return location', () => {
    expect(() => lunarReturnChart(known(), after, { latitude: 0, longitude: NaN })).toThrow(RangeError);
  });

  it('rejects a failed natal Moon evaluation before it searches', () => {
    // The site reads the natal Moon itself; the search and its own failure
    // paths (a non-finite Moon, no crossing in 40 days) are the package's since
    // engine rc.16 and are tested there, and the parity record holds the search
    // to this module's former one (site-engine-rc16/techniques-parity.json, R-LI).
    const position = vi.spyOn(ephemeris, 'bodyLongitude').mockReturnValue(NaN);
    expect(() => lunarReturnChart(known(), after)).toThrow('Moon position');
    expect(position).toHaveBeenCalled();
  });

  it('excludes an exact lower identity: a search that starts on a return finds the next', () => {
    const at = lunarReturnInstant(123.4, after);
    expect(at.getTime()).toBeGreaterThan(after.getTime());
    expect(at.getTime() - after.getTime()).toBeLessThanOrEqual(40 * DAY_MS);
    const next = lunarReturnInstant(ephemeris.bodyLongitude('Moon', at), at);
    expect((next.getTime() - at.getTime()) / DAY_MS).toBeGreaterThan(26);
    expect((next.getTime() - at.getTime()) / DAY_MS).toBeLessThan(29);
  });

  it('does not retain mutable natal/reference Date objects in the return chart', () => {
    const natal = known();
    const reference = new Date(after);
    const result = lunarReturnChart(natal, reference);
    const instant = result.input.utc.toISOString();
    natal.utc.setUTCFullYear(2001);
    reference.setUTCFullYear(2030);
    expect(result.input.utc.toISOString()).toBe(instant);
  });
});
