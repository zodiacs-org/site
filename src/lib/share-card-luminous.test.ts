import { describe, expect, it } from 'vitest';
import { placeBodies } from './share-card-luminous';

describe('placeBodies', () => {
  it('moves a close pair onto separate lanes', () => {
    const placed = placeBodies([{ body: 'Sun', lon: 100 }, { body: 'Moon', lon: 103 }], 300, 50);
    expect(new Set(placed.map((b) => b.radius)).size).toBe(2);
  });

  it('treats bodies on either side of 0° Aries as neighbours', () => {
    const placed = placeBodies([{ body: 'Sun', lon: 359 }, { body: 'Moon', lon: 1 }, { body: 'Mars', lon: 180 }], 300, 50);
    const sun = placed.find((b) => b.body === 'Sun')!;
    const moon = placed.find((b) => b.body === 'Moon')!;
    expect(sun.radius).not.toBe(moon.radius);
    expect(placed.find((b) => b.body === 'Mars')!.radius).toBe(300);
  });
});
