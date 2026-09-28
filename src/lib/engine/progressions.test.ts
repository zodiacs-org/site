import { describe, expect, it } from 'vitest';
import { computeBodies } from './full';
import horizonsReference from './fixtures/horizons-reference.json';
import independentPolicy from './fixtures/swiss-eight-cases-policy.json';
import { expectIndependentPositions } from './fixtures/independent-validation.test-helpers';
import {
  PROGRESSION_DAYS_PER_YEAR,
  progressedBodies,
  progressedInstant,
} from './progressions';

const DAY_MS = 86_400_000;
const KAHLO_BIRTH = new Date('1907-07-06T15:06:36Z');

function eastwardDistance(from: number, to: number): number {
  return ((to - from) % 360 + 360) % 360;
}

describe('secondary progressions', () => {
  it('maps a nonzero tropical year onto independently sourced JPL positions', () => {
    // Constructed convention-and-ephemeris component case, not a published
    // progression report. Its expected time and JPL longitudes are literal:
    // the progressed instant is 2020-01-01T00:00Z, whose Horizons tuple is
    // the one fixtures/horizons-reference.json holds.
    const input = independentPolicy.progression;
    const birth = new Date(input.birthUTC);
    const target = new Date(input.targetUTC);
    expect(Math.abs(progressedInstant(birth, target).getTime() - Date.parse(input.expectedProgressedUTC)))
      .toBeLessThanOrEqual(input.maximumInstantErrorMilliseconds);
    const epoch = horizonsReference.epochs.find((row) => Date.parse(row.utc) === Date.parse(input.expectedProgressedUTC))!;
    const positions = Object.fromEntries(Object.entries(epoch.longitudes)
      .map(([body, longitudeDegrees]) => [body, { longitudeDegrees }]));
    expect(Object.keys(positions)).toHaveLength(10);
    expectIndependentPositions(progressedBodies(birth, target), positions);
  });

  it('maps elapsed tropical years to civil days and delegates planetary positions', () => {
    const target = new Date('2026-07-06T00:00:00Z');
    const progressed = progressedInstant(KAHLO_BIRTH, target);
    const yearsLived = (target.getTime() - KAHLO_BIRTH.getTime())
      / (PROGRESSION_DAYS_PER_YEAR * DAY_MS);
    const expectedTime = KAHLO_BIRTH.getTime() + yearsLived * DAY_MS;

    expect(Math.abs(progressed.getTime() - expectedTime)).toBeLessThanOrEqual(1_000);
    expect(progressedBodies(KAHLO_BIRTH, target)).toEqual(computeBodies(progressed));
  });

  it('advances the progressed Moon at the doctrinal 12–15° per year across three spot years', () => {
    // Doctrinal-rate fallback: no independently retrievable external vector was
    // available for this fixture, so three consecutive years assert the standard
    // secondary-progressed Moon motion requested by the implementation packet.
    const targets = [2024, 2025, 2026, 2027].map(
      (year) => new Date(`${year}-07-06T00:00:00Z`),
    );
    const moonLongitudes = targets.map((target) =>
      progressedBodies(KAHLO_BIRTH, target).find((body) => body.body === 'Moon')!.lon);

    for (let i = 1; i < moonLongitudes.length; i += 1) {
      expect(eastwardDistance(moonLongitudes[i - 1], moonLongitudes[i])).toBeGreaterThanOrEqual(12);
      expect(eastwardDistance(moonLongitudes[i - 1], moonLongitudes[i])).toBeLessThanOrEqual(15);
    }
  });
});
