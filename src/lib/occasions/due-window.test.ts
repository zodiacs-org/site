import { describe, expect, it } from 'vitest';
import { dueWindow } from './due-window';

describe('due window', () => {
  it('splits the window at the Sun’s sign change and lists the lunations', () => {
    const window = dueWindow('2026-10-28');
    expect(window.from).toBe('2026-10-14');
    expect(window.to).toBe('2026-11-11');
    expect(window.sunSpans.map(({ sign, from, to }) => [sign, from, to])).toEqual([
      ['libra', '2026-10-14', '2026-10-22'],
      ['scorpio', '2026-10-23', '2026-11-11'],
    ]);
    expect(window.sunSpans[0]!.enters).toBeNull();
    expect(window.sunSpans[1]!.enters?.slice(0, 10)).toBe('2026-10-23');
    // Full moon 26 Oct 04:12 UTC, new moon 9 Nov 07:02 UTC (astronomy-engine).
    expect(window.lunations.map(({ kind, at }) => [kind, at.slice(0, 15)])).toEqual([
      ['full', '2026-10-26T04:1'],
      ['new', '2026-11-09T07:0'],
    ]);
  });

  it('keeps a window inside one sign as one span', () => {
    expect(dueWindow('2026-08-07').sunSpans.map((span) => span.sign)).toEqual(['leo']);
  });

  it('refuses an impossible due date', () => {
    expect(() => dueWindow('2026-02-30')).toThrow(RangeError);
  });
});
