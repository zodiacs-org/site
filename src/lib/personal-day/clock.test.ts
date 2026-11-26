import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { clockTime } from './clock';

const RealDateTimeFormat = Intl.DateTimeFormat;

/** Records the time zone of every offset formatter made while `run` runs. */
function offsetFormattersMade(run: () => void): string[] {
  const zones: string[] = [];
  Intl.DateTimeFormat = new Proxy(RealDateTimeFormat, {
    construct(target, args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
      const options = args[1];
      if (options?.timeZoneName === 'longOffset') zones.push(String(options.timeZone));
      return new target(...args);
    },
  });
  try {
    run();
  } finally {
    Intl.DateTimeFormat = RealDateTimeFormat;
  }
  return zones;
}

afterEach(() => {
  Intl.DateTimeFormat = RealDateTimeFormat;
});

describe('clockTime keeps no time zone past the call', () => {
  it('makes its offset formatter again on the next call for the same zone, so a birth zone is not held', () => {
    const at = new Date('2026-11-25T15:00:00Z');
    const zone = 'America/Argentina/Rio_Gallegos';
    const first = offsetFormattersMade(() => clockTime(at, zone));
    const second = offsetFormattersMade(() => clockTime(at, zone));
    expect(first).toEqual([zone]);
    // A cache keyed by zone would hand back the first call's formatter and make none here.
    expect(second).toEqual([zone]);
    expect(clockTime(at, zone)).toBe('12:00');
  });

  it('still marks a repeated clock time with its offset', () => {
    expect(clockTime(new Date('2026-11-01T05:03:00Z'), 'America/New_York')).toBe('01:03 (UTC-4)');
    expect(clockTime(new Date('2026-11-01T06:03:00Z'), 'America/New_York')).toBe('01:03 (UTC-5)');
  });

  it('holds no module-level collection that could keep a zone', () => {
    const source = readFileSync(new URL('./clock.ts', import.meta.url), 'utf8');
    const topLevel = source.split('\n').filter((line) => /^(?:export\s+)?(?:const|let|var)\s/u.test(line));
    for (const line of topLevel) expect(line).not.toMatch(/new\s+(?:Weak)?(?:Map|Set)\b|Intl\./u);
  });
});
