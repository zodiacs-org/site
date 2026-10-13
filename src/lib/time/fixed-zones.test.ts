import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareLocalTime, resolveLocalToUtc } from '@zodiacs/engine/geo';
import tzNames from '../../data/tz-names.json';
import { FIXED_OFFSET_ZONE_SOURCE, isFixedOffsetZone } from './fixed-zones';

const engineDist = resolve(import.meta.dirname, '../../../node_modules/@zodiacs/engine/dist');

/** The engine's own FIXED_ZONE, as its geo entry's chunk declares it. */
function engineFixedZone(): { source: string; flags: string } {
  const found = readdirSync(engineDist).filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(resolve(engineDist, name), 'utf8').match(/\bvar FIXED_ZONE = \/(.+)\/([a-z]*);\n/u))
    .filter((match) => match !== null);
  expect(found).toHaveLength(1);
  return { source: found[0]![1], flags: found[0]![2] };
}

const intlAccepts = (name: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return true;
  } catch {
    return false;
  }
};

describe('fixed-offset zones', () => {
  it("are the engine's own: the same pattern, case-insensitive", () => {
    expect(engineFixedZone()).toEqual({ source: FIXED_OFFSET_ZONE_SOURCE, flags: 'iu' });
  });

  it('are UTC and Etc/GMT±N under every name, in any letter case, and nothing else', () => {
    for (const name of ['UTC', 'utc', 'Etc/UTC', 'Etc/UCT', 'GMT', 'GMT0', 'GMT+0', 'GMT-0', 'Greenwich', 'Universal', 'Zulu', 'Etc/GMT+5', 'etc/gmt-14']) {
      expect(isFixedOffsetZone(name), name).toBe(true);
    }
    for (const name of ['Europe/London', 'Africa/Abidjan', 'Atlantic/Reykjavik', 'Etc/Unknown', 'GMT+5', 'UTC+1', '+05:30', 'Antarctica/Troll']) {
      expect(isFixedOffsetZone(name), name).toBe(false);
    }
  });

  it('read the same offset from Intl before 1970 as after, in every one tzdb names', async () => {
    const fixed = tzNames.names.filter((name) => isFixedOffsetZone(name) && intlAccepts(name));
    expect(fixed).toEqual(expect.arrayContaining(['UTC', 'Etc/UTC', 'GMT', 'Etc/GMT+5', 'Etc/GMT-14']));
    for (const name of fixed) {
      await prepareLocalTime('1900-06-01', name);
      const early = resolveLocalToUtc('1900-06-01', '12:00', name);
      const late = resolveLocalToUtc('2000-06-01', '12:00', name);
      expect(early.zone.source, name).toBe('intl');
      expect(early.offsetMinutes, name).toBe(late.offsetMinutes);
      expect(early.flags, name).toEqual([]);
    }
  });
});
