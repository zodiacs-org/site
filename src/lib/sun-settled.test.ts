import { describe, expect, it } from 'vitest';
import { computeBodies } from './engine/full';
import { birthDayEnvelope, settledSunSign } from './sun-settled';

const sunLonAt = (at: Date) => computeBodies(at).find((body) => body.body === 'Sun')!.lon;

describe('the settled Sun sign of a birth date', () => {
  it('spans every clock’s version of the date: 14 hours before UTC midnight to 12 hours after 23:59 UTC', () => {
    const [start, end] = birthDayEnvelope('1990-05-03');
    expect(start.toISOString()).toBe('1990-05-02T10:00:00.000Z');
    expect(end.toISOString()).toBe('1990-05-04T11:59:00.000Z');
  });
  it('gives both candidates when the Sun changes sign during the day', () => {
    // The Sun entered Aries on 20 March 1990 (21:19 UTC).
    expect(settledSunSign(birthDayEnvelope('1990-03-20'), sunLonAt)).toEqual({ sign: null, candidates: [11, 0] });
  });
  it('settles the sign when the Sun keeps to one sign all day', () => {
    expect(settledSunSign(birthDayEnvelope('1990-05-03'), sunLonAt)).toEqual({ sign: 1, candidates: [] });
  });
  it('reads one instant as settled, and wraps longitudes outside 0 to 360', () => {
    const at = new Date('1990-03-20T12:00:00Z');
    expect(settledSunSign([at, at], sunLonAt)).toEqual({ sign: 11, candidates: [] });
    expect(settledSunSign([at, at], () => -0.5)).toEqual({ sign: 11, candidates: [] });
    expect(settledSunSign([at, at], () => 360.5)).toEqual({ sign: 0, candidates: [] });
  });
});
