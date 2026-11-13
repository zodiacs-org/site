import { describe, expect, it } from 'vitest';
import { moonPhase } from '@zodiacs/engine';
import {
  MOON_PHASE_NEW_ILLUMINATION, MOON_PHASE_QUARTER_DEGREES, moonPhaseAngle, moonPhaseName, moonPhaseNameFromAngle,
} from './lite';

// Adjacent representable doubles expose rounding that decimal epsilon tests miss.
function adjacent(value: number, direction: bigint): number {
  const bytes = new DataView(new ArrayBuffer(8));
  bytes.setFloat64(0, value);
  bytes.setBigUint64(0, bytes.getBigUint64(0) + direction);
  return bytes.getFloat64(0);
}
const lit = (angle: number) => (1 - Math.cos(angle * Math.PI / 180)) / 2;
/** The angle at which the lit fraction is exactly 3%: about 19.95°. */
const NEW_EDGE = Math.acos(1 - 2 * MOON_PHASE_NEW_ILLUMINATION) * 180 / Math.PI;

const boundaries = [
  [NEW_EDGE, 'New Moon', 'Waxing Crescent'],
  [90 - MOON_PHASE_QUARTER_DEGREES, 'Waxing Crescent', 'First Quarter'],
  [90 + MOON_PHASE_QUARTER_DEGREES, 'First Quarter', 'Waxing Gibbous'],
  [180 - NEW_EDGE, 'Waxing Gibbous', 'Full Moon'],
  [180 + NEW_EDGE, 'Full Moon', 'Waning Gibbous'],
  [270 - MOON_PHASE_QUARTER_DEGREES, 'Waning Gibbous', 'Last Quarter'],
  [270 + MOON_PHASE_QUARTER_DEGREES, 'Last Quarter', 'Waning Crescent'],
  [360 - NEW_EDGE, 'Waning Crescent', 'New Moon'],
] as const;

describe('standard phase names', () => {
  it.each(boundaries)('changes name around %f°: %s, then %s', (angle, before, after) => {
    expect(moonPhaseNameFromAngle(angle - 0.01)).toBe(before);
    expect(moonPhaseNameFromAngle(angle + 0.01)).toBe(after);
  });

  it('names New Moon and Full Moon exactly when the lit fraction is under 3% or over 97%', () => {
    for (let step = 0; step < 36000; step += 1) {
      const angle = step / 100;
      const name = moonPhaseNameFromAngle(angle);
      expect(name === 'New Moon', `${angle}°`).toBe(lit(angle) < MOON_PHASE_NEW_ILLUMINATION);
      expect(name === 'Full Moon', `${angle}°`).toBe(lit(angle) > 1 - MOON_PHASE_NEW_ILLUMINATION);
    }
  });

  it('keeps the quarters to 12° either side of 90° and 270°', () => {
    for (let step = 0; step < 36000; step += 1) {
      const angle = step / 100;
      const name = moonPhaseNameFromAngle(angle);
      expect(name === 'First Quarter', `${angle}°`).toBe(Math.abs(angle - 90) <= MOON_PHASE_QUARTER_DEGREES);
      expect(name === 'Last Quarter', `${angle}°`).toBe(Math.abs(angle - 270) <= MOON_PHASE_QUARTER_DEGREES);
    }
  });

  it('names the crescents and gibbous phases on the right side of the quarters', () => {
    expect(moonPhaseNameFromAngle(45)).toBe('Waxing Crescent');
    expect(moonPhaseNameFromAngle(135)).toBe('Waxing Gibbous');
    expect(moonPhaseNameFromAngle(225)).toBe('Waning Gibbous');
    expect(moonPhaseNameFromAngle(315)).toBe('Waning Crescent');
  });

  it('keeps the wraparound category without changing zero or the last double', () => {
    for (const value of [0, -0, Number.MIN_VALUE, adjacent(360, -1n)]) {
      expect(moonPhaseNameFromAngle(value)).toBe('New Moon');
    }
  });

  // Lunations of 2024 (UTC): new 11 Jan 11:57, first quarter 18 Jan 03:53,
  // full 25 Jan 17:54, last quarter 2 Feb 23:18.
  it.each([
    ['2024-01-11T11:57:00Z', 'New Moon'],
    ['2024-01-18T03:53:00Z', 'First Quarter'],
    ['2024-01-25T17:54:00Z', 'Full Moon'],
    ['2024-02-02T23:18:00Z', 'Last Quarter'],
  ] as const)('names the engine Moon near the exact moment %s as %s', (instant, expected) => {
    const exact = new Date(instant).getTime();
    // New and Full hold for at least a day either side; the 12° quarters for about a day in all, at least 12 hours either side.
    const offsets = expected.includes('Quarter') ? [-12, -6, 0, 6, 12] : [-24, -12, 0, 12, 24];
    for (const hours of offsets) {
      const at = new Date(exact + hours * 3_600_000);
      expect(moonPhaseNameFromAngle(moonPhase(at).angle), `${hours} h`).toBe(expected);
    }
  });

  it('does not call a Moon two days from full a Full Moon', () => {
    const twoDaysBefore = new Date(Date.parse('2024-01-25T17:54:00Z') - 48 * 3_600_000);
    expect(moonPhaseNameFromAngle(moonPhase(twoDaysBefore).angle)).toBe('Waxing Gibbous');
    const twoDaysAfter = new Date(Date.parse('2024-01-11T11:57:00Z') + 48 * 3_600_000);
    expect(moonPhaseNameFromAngle(moonPhase(twoDaysAfter).angle)).toBe('Waxing Crescent');
  });

  it.each([
    ['2024-01-09T00:00:00Z', 'Waning Crescent'],
    ['2024-01-09T23:59:00Z', 'Waning Crescent'],
    ['2024-01-16T00:00:00Z', 'Waxing Crescent'],
    ['2024-01-16T12:00:00Z', 'Waxing Crescent'],
    ['2024-04-07T00:00:00Z', 'Waning Crescent'],
    ['2024-04-07T12:00:00Z', 'New Moon'],
  ] as const)('names the lite date calculation %s as %s', (instant, expected) => {
    const date = new Date(instant);
    expect(moonPhaseName(date)).toBe(expected);
    expect(moonPhaseNameFromAngle(moonPhaseAngle(date))).toBe(expected);
  });
});
