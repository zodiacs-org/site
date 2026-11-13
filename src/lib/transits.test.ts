/** Composition shape for the transit phrasing table. */
import { describe, expect, it } from 'vitest';
import { contactReceipt, transitLine, TRANSIT_ORB } from './transits';
import { BODY_ROLE } from './compat';

const PLANETS = Object.keys(BODY_ROLE);
const ASPECTS = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];

describe('transits', () => {
  it('formats compact saved-contact receipts without mutable sky positions', () => {
    expect(contactReceipt({
      transiting: 'Mercury',
      transitingLon: 12,
      transitingRetrograde: true,
      natal: 'Ascendant',
      natalLon: 102,
      natalRetrograde: false,
      type: 'square',
      separation: 90.04,
      orb: 0.04,
    })).toBe('Mercury Rx square natal ASC · 0.0° from exact');
  });

  it('keeps the active-transit orb tight', () => {
    expect(TRANSIT_ORB).toBe(3);
  });

  it('composes a full sentence for every planet x aspect x point', () => {
    for (const t of PLANETS) {
      for (const type of ASPECTS) {
        for (const n of PLANETS) {
          const line = transitLine(t, type, n);
          expect(line).toContain(t);
          expect(line).toContain(BODY_ROLE[n]);
          expect(line.endsWith('.')).toBe(true);
          // The composed voice, not the fallback.
          expect(line).toContain(': ');
        }
      }
    }
  });

  it('reads correctly for the canonical hard transit', () => {
    const line = transitLine('Saturn', 'square', 'Moon');
    expect(line).toBe(
      'Saturn pushes against your emotional life: a long season of pressure and accounting, friction that will not resolve on its own.',
    );
  });

  it('falls back plainly for unknown aspects or movers', () => {
    expect(transitLine('Saturn', 'quincunx', 'Moon')).toBe('Saturn aspects your emotional life.');
    expect(transitLine('Chiron', 'square', 'Moon')).toBe('Chiron aspects your emotional life.');
  });
});
