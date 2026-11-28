import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prepareEveryZoneHistory } from './compute';

describe('your-day browser zone history preloading', () => {
  it('preloads all zone history groups uniformly before resolving birth details, with shard failure gating', () => {
    expect(typeof prepareEveryZoneHistory).toBe('function');
    const source = readFileSync(new URL('./compute.ts', import.meta.url), 'utf8');
    const preloadAt = source.indexOf('Promise.allSettled([');
    const guardedAt = source.indexOf('await clock.prepareLocalTime(input.birthDate');
    expect(source).toContain('ZONE_PER_HISTORY_FILE.map');
    expect(preloadAt).toBeGreaterThan(-1);
    expect(guardedAt).toBeGreaterThan(preloadAt);
    expect(source).not.toContain('await prepareLocalTime(input.birthDate');
  });
});
