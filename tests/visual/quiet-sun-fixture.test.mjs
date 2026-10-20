import { describe, expect, it } from 'vitest';
import { quietSunFixture } from './quiet-sun-fixture.mjs';

describe('quiet Sun fixture', () => {
  it('finds a no-contact Sun sign when every Aries longitude has a nearby aspect', () => {
    const daily = {
      date: '2026-10-20',
      bodies: [
        317.2918872199784, 207.11458261439543, 230.10873699855264,
        212.9447512557334, 132.63100752433547, 142.77993719634617,
        10.070831862980526, 65.06106059968255, 2.350109184253654,
        303.0727844871471,
      ].map((lon) => ({ lon })),
    };

    const fixture = quietSunFixture(daily);
    expect(fixture.nearestOrb).toBeGreaterThan(3);
    expect(fixture.longitude).toBeGreaterThanOrEqual(30);
    expect(fixture.sign).not.toBe('Aries');
  });
});
