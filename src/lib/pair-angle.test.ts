import { describe, expect, it } from 'vitest';
import { ALL_PAIRS } from './compat';
import { pairAngle } from './pair-angle';

describe('pairAngle', () => {
  it('measures the shorter way round, 30 degrees a sign', () => {
    expect(pairAngle('aries', 'aries')).toMatchObject({ steps: 0, degrees: 0, aspect: 'conjunction', same: true });
    expect(pairAngle('aries', 'taurus')).toMatchObject({ steps: 1, degrees: 30, aspect: 'semi-sextile', clockwise: true });
    expect(pairAngle('aries', 'gemini')).toMatchObject({ degrees: 60, aspect: 'sextile' });
    expect(pairAngle('aries', 'cancer')).toMatchObject({ degrees: 90, aspect: 'square' });
    expect(pairAngle('aries', 'leo')).toMatchObject({ degrees: 120, aspect: 'trine' });
    expect(pairAngle('aries', 'virgo')).toMatchObject({ degrees: 150, aspect: 'quincunx' });
    expect(pairAngle('aries', 'libra')).toMatchObject({ degrees: 180, aspect: 'opposition', clockwise: true });
    expect(pairAngle('aries', 'pisces')).toMatchObject({ steps: 1, degrees: 30, clockwise: false });
    expect(pairAngle('taurus', 'capricorn')).toMatchObject({ steps: 4, degrees: 120, clockwise: false });
  });

  it('states only shared make-up that holds for every pair at its angle', () => {
    const expected = [
      [true, true, true],
      [false, false, false],
      [false, false, true],
      [false, true, false],
      [true, false, true],
      [false, false, false],
      [false, true, true],
    ];
    for (const [a, b] of ALL_PAIRS) {
      const angle = pairAngle(a, b);
      expect([angle.sharesElement, angle.sharesModality, angle.sharesPolarity], `${a}-${b}`).toEqual(expected[angle.steps]);
    }
  });

  it('writes plain copy with no dashes and links to a Learn page', () => {
    for (const [a, b] of ALL_PAIRS) {
      const angle = pairAngle(a, b);
      for (const text of [angle.heading, angle.lede, angle.alt, angle.learn.label]) {
        expect(text, `${a}-${b}`).not.toMatch(/[–—]/u);
      }
      expect(angle.learn.href).toMatch(/^\/learn\/aspects\/(?:(?:conjunction|sextile|square|trine|opposition)\/)?$/u);
    }
  });
});
