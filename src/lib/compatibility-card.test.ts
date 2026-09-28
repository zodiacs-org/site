import { describe, expect, it } from 'vitest';
import {
  COMPATIBILITY_CARD_BRAND_LAYOUT,
  compatibilityHeadline,
  compatibilityPlacementLine,
  type CompatibilityCardPerson,
} from './compatibility-card';

describe('compatibility share card', () => {
  it('selects a deterministic headline from the computed aspect balance', () => {
    expect(compatibilityHeadline({ easeful: 4, charged: 2 })).toBe('Flow, with useful friction');
    expect(compatibilityHeadline({ easeful: 1, charged: 3 })).toContain('attention');
    expect(compatibilityHeadline({ easeful: 2, charged: 2 })).toContain('even exchange');
  });

  it('accepts placements and a chosen label, never birth inputs', () => {
    const person: CompatibilityCardPerson = {
      label: 'Person A',
      bodies: [{ body: 'Sun', lon: 12 }],
      asc: 42,
    };
    expect(Object.keys(person).sort()).toEqual(['asc', 'bodies', 'label']);
  });

  it('prints the rising sign only to its whole degree, as the two-chart link keeps it', () => {
    const person: CompatibilityCardPerson = {
      label: 'Person A',
      bodies: [{ body: 'Sun', lon: 12.6 }, { body: 'Moon', lon: 100.2 }],
      asc: 42.7,
    };
    // 42.7° rounded would be Taurus 13°, half a degree past what the link's 12.5° allows.
    expect(compatibilityPlacementLine(person)).toBe('Aries 13°  ·  Cancer 10°  ·  Taurus 12°');
    expect(compatibilityPlacementLine({ ...person, asc: null })).toBe('Aries 13°  ·  Cancer 10°  ·  —');
  });

  it('keeps the logo above the occupied two-person footer', () => {
    expect(COMPATIBILITY_CARD_BRAND_LAYOUT.wordmarkX).toBe(1014);
    expect(COMPATIBILITY_CARD_BRAND_LAYOUT.centerY).toBe(76);
    expect(COMPATIBILITY_CARD_BRAND_LAYOUT.centerY
      + COMPATIBILITY_CARD_BRAND_LAYOUT.iconSize / 2).toBeLessThan(120);
  });
});
