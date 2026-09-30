import { describe, expect, it } from 'vitest';
import { calendarTransitWindows, serializeTransitWindows } from './transit-window-ical';
import type { TransitWindow } from './engine/transit-window-core';

// Shaped on the D case's second period, its ends as the independent
// references give them (engine/fixtures/transit-window-horizons.json).
const window = (patch: Partial<TransitWindow> = {}): TransitWindow => ({
  id: 'private-chart-id-must-not-be-exported', transitBody: 'Uranus', natalPoint: 'Sun', aspect: 'conjunction',
  startUtc: '2019-09-30T09:06:21.996Z', endUtc: '2020-04-10T15:17:21.363Z',
  startClipped: false, endClipped: false, membershipStatus: 'resolved', exactTopologyStatus: 'uncertain',
  exactPassesUtc: ['2020-01-01T00:00:00.000Z', '2020-01-21T00:00:00.000Z'],
  peak: { kind: 'uncertain', fromUtc: '2019-12-24T00:00:00.000Z', toUtc: '2020-01-29T00:00:00.000Z' }, ...patch,
});
const options = { generatedAt: '2026-09-07T00:00:00.000Z', timeKnown: true };
const unfold = (text: string) => text.replace(/\r\n /g, '');

describe('transit itinerary calendar', () => {
  it('exports a genuine positive window without fabricating an uncertain peak', () => {
    const text = unfold(serializeTransitWindows([window()], options));
    expect(text).toContain('DTSTART:20190930T090621Z\r\nDTEND:20200410T151721Z');
    expect(text).toContain('exact timing and number of passes are unresolved');
    expect(text).not.toContain('2020-01-01');
    expect(text).not.toContain('2020-01-21');
    expect(text).not.toContain('DURATION:');
    expect(text).not.toContain('private-chart-id');
  });
  it('filters uncertain boundaries, touches and invalid or sub-second periods', () => {
    expect(calendarTransitWindows([
      window({ membershipStatus: 'uncertain' }), window({ boundaryTouch: true }),
      window({ endUtc: 'invalid' }), window({ endUtc: '2019-09-30T09:06:22.000Z' }),
    ], true)).toEqual([]);
    expect(() => serializeTransitWindows([], options)).toThrow('No resolved positive-duration');
  });
  it('excludes Moon and both angles from every unknown or unverified export', () => {
    const periods = ['Moon', 'ASC', 'MC', 'Sun'].map((natalPoint) => window({ natalPoint: natalPoint as TransitWindow['natalPoint'] }));
    expect(calendarTransitWindows(periods, false).map((x) => x.natalPoint)).toEqual(['Sun']);
    const text = unfold(serializeTransitWindows(periods, { ...options, timeKnown: false }));
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(text).toContain('Uses reference natal positions');
  });
  it('retains real gaps, stable identities and clipped-boundary explanations', () => {
    const a = window({ startClipped: true });
    const b = window({ startUtc: '2020-05-01T00:00:00.000Z', endUtc: '2020-07-01T00:00:00.000Z', endClipped: true });
    const text = serializeTransitWindows([b, a, a], options);
    expect(text).toBe(serializeTransitWindows([a, b], options));
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(unfold(text)).toContain('earlier entry is unknown');
    expect(unfold(text)).toContain('later exit is unknown');
    expect(text.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });
  it('distinguishes a closest approach from an exact contact and a clipped edge', () => {
    const text = unfold(serializeTransitWindows([window({ exactTopologyStatus: 'resolved', exactPassesUtc: [],
      peak: { kind: 'closest-approach', atUtc: '2020-01-11T00:00:00.000Z', orbDegrees: 1.5 } })], options));
    expect(text).toContain('does not become exact');
    const clipped = unfold(serializeTransitWindows([window({ exactTopologyStatus: 'resolved', exactPassesUtc: [], peak: { kind: 'none' } })], options));
    expect(clipped).toContain('No verified peak lies within this searched portion');
    const tied = unfold(serializeTransitWindows([window({ exactTopologyStatus: 'resolved', exactPassesUtc: [],
      peak: { kind: 'non-unique', candidatesUtc: ['2020-01-10T00:00:00.000Z', '2020-01-20T00:00:00.000Z'] } })], options));
    expect(tied).toContain('Several equally close approaches');
    expect(tied).not.toContain('Estimated closest approach:');
  });
});
