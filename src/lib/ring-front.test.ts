import { describe, expect, it } from 'vitest';
import { ringFront, ringFrontForWholeDegree } from './ring-front';

const sunAt = (lon: number) => [{ body: 'Moon', lon: 10 }, { body: 'Sun', lon }];

describe('the sign a personal image\'s ring brings forward', () => {
  it('is the Sun\'s sign when the chart has a birth time', () => {
    expect(ringFront(sunAt(135), true)).toBe('leo');
    expect(ringFront(sunAt(120), true)).toBe('leo');
    expect(ringFront(sunAt(359.9), true)).toBe('pisces');
  });

  it('is only stated without a birth time when a whole day keeps the Sun in one sign', () => {
    expect(ringFront(sunAt(135), false)).toBe('leo');
    expect(ringFront(sunAt(120.5), false)).toBeNull();
    expect(ringFront(sunAt(149.5), false)).toBeNull();
    expect(ringFront([{ body: 'Moon', lon: 10 }], true)).toBeNull();
    expect(ringFront(undefined, true)).toBeNull();
  });

  it('reads a Sun given to the whole degree as anywhere in that degree', () => {
    expect(ringFrontForWholeDegree(120, true)).toBe('leo');
    expect(ringFrontForWholeDegree(149, true)).toBe('leo');
    expect(ringFrontForWholeDegree(121, false)).toBeNull();
    expect(ringFrontForWholeDegree(122, false)).toBe('leo');
    expect(ringFrontForWholeDegree(147, false)).toBe('leo');
    expect(ringFrontForWholeDegree(148, false)).toBeNull();
  });
});
