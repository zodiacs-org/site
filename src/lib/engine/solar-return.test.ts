import { describe, expect, it } from 'vitest';
import { bodyLongitude, computeChart } from './full';
import independentCases from './fixtures/independent-eight-cases.json';
import independentPolicy from './fixtures/swiss-eight-cases-policy.json';
import { angularDifference, expectIndependentChart, expectIndependentTime } from './fixtures/independent-validation.test-helpers';
import {
  mostRecentSolarReturnInstant, solarReturnChart, solarReturnInstant,
} from './solar-return';
import { yearScan } from './year-scan';
import independentCrossings from './solar-return-crossings.fixture.json';

const KAHLO_BIRTH = new Date('1907-07-06T15:06:36Z');
const KAHLO_SUN_LON = bodyLongitude('Sun', KAHLO_BIRTH);
const NEAR = new Date('2026-07-06T00:00:00Z');
const DAY_MS = 86_400_000;

function angleDiff(a: number, b: number): number {
  const distance = Math.abs(((a - b) % 360 + 360) % 360);
  return distance > 180 ? 360 - distance : distance;
}

// These external longitude → instant vectors validate the crossing solver.
// They are not independently published natal-birth → next-year return reports.
describe('solarReturnInstant against independent longitude-crossing fixtures', () => {
  it.each(independentCrossings.fixtures)('$id', (fixture) => {
    const instant = solarReturnInstant(fixture.targetLongitudeDegrees, new Date(fixture.nearUTC));
    const residualSeconds = (instant.getTime() - Date.parse(fixture.expectedUTC)) / 1000;
    const diagnostic = `${fixture.id}: ${instant.toISOString()}, signed residual ${residualSeconds}s`;

    // Opt-in diagnostics report actual solver output without regenerating any
    // expected value or changing the predeclared provider-parity tolerances.
    if (process.env.SOLAR_RETURN_FIXTURE_REPORT === '1') console.info(diagnostic);
    expect(Math.abs(residualSeconds), diagnostic).toBeLessThanOrEqual(fixture.toleranceSeconds);
  });
});

describe('independent natal-to-solar return and chart', () => {
  const input = independentPolicy.solar;
  const reference = independentCases.solar;
  const location = { latitude: input.latitudeDegrees, longitude: input.longitudeDegreesEastPositive };

  it('matches the full independent return time, returned chart and unlocated mode', () => {
    const natalSun = bodyLongitude('Sun', new Date(input.birthUTC));
    expect(angularDifference(natalSun, reference.natalLongitudeDegrees))
      .toBeLessThanOrEqual(independentPolicy.gates.planetLongitudeCircularDegreesMaximum);
    const nearest = solarReturnChart(natalSun, new Date(input.nearUTC), location, 'placidus');
    const recent = solarReturnChart(natalSun, new Date(input.currentSelectionAtUTC), location, 'placidus', 'most-recent');
    expectIndependentTime(nearest.input.utc, reference.nearest);
    expectIndependentTime(recent.input.utc, reference.mostRecent);
    // This input exercises both paths but selects the same event; it does not
    // independently distinguish nearest from most-recent selection behavior.
    // The references are NASA JPL Horizons (DE441) positions and node and ERFA
    // angles and cusps (docs/engine-validation/independent-references/): the
    // natal Sun, the return and its ±0.1° band, and the chart at the instant
    // the product returns, taken when the references were built. The returned
    // chart must be the chart at its own instant, the product's chart at the
    // reference's instant is held to it, and the two instants may differ by
    // at most 15 s; beyond that, rebuild the references at the new instant.
    const place = { ...location, houseSystem: 'placidus' as const, timeKnown: true };
    const supplementUtc = new Date(reference.returnedChartUTC);
    for (const chart of [nearest, recent]) {
      expect(chart).toEqual(computeChart({ utc: chart.input.utc, ...place }));
      expect(Math.abs(chart.input.utc.getTime() - supplementUtc.getTime()), 'The returned-chart reference no longer applies; rebuild the independent references at the new product timestamp')
        .toBeLessThanOrEqual(15_000);
    }
    expectIndependentChart(computeChart({ utc: supplementUtc, ...place }), reference.returnedChart);
    const unlocated = solarReturnChart(natalSun, new Date(input.nearUTC), null, 'placidus');
    expect(unlocated.input.utc).toEqual(nearest.input.utc);
    expect(unlocated.bodies).toEqual(nearest.bodies);
    expect(unlocated.angles).toBeNull();
    expect(unlocated.houses).toBeNull();
  });

  it('matches the separately preserved independent fixed-instant chart', () => {
    const chart = computeChart({ utc: new Date(reference.independentChartUTC), ...location, houseSystem: 'placidus', timeKnown: true });
    expectIndependentChart(chart, reference.independentChart);
  });
});

describe('solar returns: same-engine consistency and chart behavior', () => {
  it('agrees with yearScan for the same scan window within one minute', () => {
    const from = new Date(NEAR.getTime() - 200 * DAY_MS);
    const to = new Date(NEAR.getTime() + 200 * DAY_MS);
    const scan = yearScan({
      sunLon: KAHLO_SUN_LON,
      moonLon: null,
      ascLon: null,
      birthUtc: KAHLO_BIRTH,
    }, from, to);
    const instant = solarReturnInstant(KAHLO_SUN_LON, NEAR);

    expect(scan.solarReturns).toHaveLength(1);
    expect(Math.abs(instant.getTime() - new Date(scan.solarReturns[0]).getTime()))
      .toBeLessThanOrEqual(60_000);
  });

  it('casts a full located chart and a planets-only unlocated chart', () => {
    const instant = solarReturnInstant(KAHLO_SUN_LON, NEAR);
    const located = solarReturnChart(
      KAHLO_SUN_LON,
      NEAR,
      { latitude: 19.4326, longitude: -99.1332 },
      'placidus',
    );
    const unlocated = solarReturnChart(KAHLO_SUN_LON, NEAR, null, 'placidus');

    expect(located.angles).not.toBeNull();
    expect(located.houses).not.toBeNull();
    expect(located.houses?.cusps).toHaveLength(12);
    expect(unlocated.angles).toBeNull();
    expect(unlocated.houses).toBeNull();
    expect(located.input.utc).toEqual(instant);
    expect(unlocated.input.utc).toEqual(instant);
    expect(angleDiff(
      located.bodies.find((body) => body.body === 'Sun')!.lon,
      KAHLO_SUN_LON,
    )).toBeLessThan(0.01);
    expect(angleDiff(
      unlocated.bodies.find((body) => body.body === 'Sun')!.lon,
      KAHLO_SUN_LON,
    )).toBeLessThan(0.01);
  });

  it('can select the birthday-year that is already in progress', () => {
    const inBetweenReturns = new Date('2026-03-01T00:00:00Z');
    const previous = mostRecentSolarReturnInstant(KAHLO_SUN_LON, inBetweenReturns);

    expect(previous.getTime()).toBeLessThanOrEqual(inBetweenReturns.getTime());
    expect(inBetweenReturns.getTime() - previous.getTime()).toBeLessThan(367 * DAY_MS);
  });
});
