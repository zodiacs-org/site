import { describe, expect, it } from 'vitest';
import { rateOccasionDate } from './date-score';
import type { OccasionSkyFacts } from './sky';

function sky(overrides: Partial<OccasionSkyFacts> = {}): OccasionSkyFacts {
  return {
    instant: '2027-06-12T15:00:00Z',
    bodies: [
      { body: 'Sun', sign: 'gemini', degree: 21.4, retrograde: false },
      { body: 'Moon', sign: 'taurus', degree: 3, retrograde: false },
      { body: 'Venus', sign: 'libra', degree: 10, retrograde: false },
    ] as OccasionSkyFacts['bodies'],
    moon: { phase: 'Waxing Crescent', illuminationPercent: 30, waxing: true },
    retrograde: [],
    ...overrides,
  };
}

describe('rateOccasionDate', () => {
  it('rates a waxing Moon and a strong Venus well for a wedding, with reasons', () => {
    const rating = rateOccasionDate('wedding', sky());
    expect(rating.score).toBeGreaterThanOrEqual(82);
    expect(rating.verdict).toBe('An excellent day for it');
    expect(rating.reasons.some((reason) => reason.includes('Venus'))).toBe(true);
  });

  it('marks a wedding down for Venus and Mercury retrograde and a waning Moon', () => {
    const rating = rateOccasionDate('wedding', sky({ retrograde: ['Venus', 'Mercury'] as OccasionSkyFacts['retrograde'], moon: { phase: 'Waning Gibbous', illuminationPercent: 80, waxing: false } }));
    expect(rating.score).toBeLessThan(68);
    expect(rating.reasons.join(' ')).toMatch(/Venus is retrograde.*Mercury is retrograde/u);
  });

  it('stays within 0–100 and never promises an outcome', () => {
    const rating = rateOccasionDate('birthday', sky());
    expect(rating.score).toBeGreaterThanOrEqual(0);
    expect(rating.score).toBeLessThanOrEqual(100);
    expect(rating.reasons.join(' ')).not.toMatch(/guarantee|\bwill (?:last|succeed|fail)\b/iu);
  });
});
