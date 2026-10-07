import { describe, expect, it } from 'vitest';
import { isAstrologyToolPath, showsCollectionNavigation } from './trust-boundary';

describe('collection navigation', () => {
  it.each(['', '/es', '/pt', '/fr', '/it', '/ru'])('restores the profile hub link without widening the tool boundary in %s', prefix => {
    expect(showsCollectionNavigation(`${prefix}/profile/`)).toBe(true);
    expect(showsCollectionNavigation(`${prefix}/profile`)).toBe(true);
    // Non-navigation consumers still treat Profile as a private surface.
    expect(isAstrologyToolPath(`${prefix}/profile/`)).toBe(true);
    for (const route of ['tools', 'birth-chart', 'today', 'compatibility', 'sky-calendar', 'transits']) {
      expect(showsCollectionNavigation(`${prefix}/${route}/`)).toBe(false);
    }
    expect(showsCollectionNavigation(`${prefix}/aries/`)).toBe(true);
  });
});
