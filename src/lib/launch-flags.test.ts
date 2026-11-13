import { describe, expect, it } from 'vitest';
import { LAUNCH_FLAGS, launchFlagOn } from './launch-flags';

describe('launch flags', () => {
  it('is off for every flag when nothing is set', () => {
    for (const name of LAUNCH_FLAGS) expect(launchFlagOn(name, {})).toBe(false);
  });

  it('is off for anything but exactly 1', () => {
    for (const name of LAUNCH_FLAGS) {
      for (const value of ['', '0', 'true', ' 1', 'yes']) expect(launchFlagOn(name, { [name]: value })).toBe(false);
    }
  });

  it('is on for exactly 1', () => {
    expect(launchFlagOn('PUBLIC_YEAR_SCORE_ENABLED', { PUBLIC_YEAR_SCORE_ENABLED: '1' })).toBe(true);
  });

  it('keeps the people pages off unless the score is on too', () => {
    expect(launchFlagOn('PUBLIC_YEAR_PEOPLE_ENABLED', { PUBLIC_YEAR_PEOPLE_ENABLED: '1' })).toBe(false);
    expect(launchFlagOn('PUBLIC_YEAR_PEOPLE_ENABLED', { PUBLIC_YEAR_PEOPLE_ENABLED: '1', PUBLIC_YEAR_SCORE_ENABLED: '1' })).toBe(true);
  });
});
