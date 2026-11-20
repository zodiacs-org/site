import { describe, expect, it } from 'vitest';
import { under13 } from './AstrocartographyMap';

describe('the astrocartography page', () => {
  it('draws no map for a birth date less than 13 years before today, or still to come', () => {
    const now = new Date(2026, 10, 9, 12);
    expect(under13('2013-11-10', now)).toBe(true);
    expect(under13('2027-01-01', now)).toBe(true);
    expect(under13('2013-11-09', now)).toBe(false);
    expect(under13('1990-05-03', now)).toBe(false);
  });
});
