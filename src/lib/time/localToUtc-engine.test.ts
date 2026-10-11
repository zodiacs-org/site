import { describe, expect, it } from 'vitest';
import { resolveLocalToUtc as packageResolveLocalToUtc } from '@zodiacs/engine/geo';
import cityIndex from '../../../public/data/cities/index.json';
import { prepareLocalTime, resolveLocalToUtc, type LocalTimeResolution } from './localToUtc';

/*
 * The site's resolver is @zodiacs/engine/geo's (src/lib/time/localToUtc.ts):
 * it checks the site's inputs and maps the engine's resolution onto the
 * site's fields. The engine's own tests hold the conversion: the birthplace
 * clock at every era end, at each change of the shipped history and on each
 * zone's own meridian (src/geo/birthplace-clock.test.ts in the engine), and
 * the all-zone round trip. Here, for every zone the birthplace search offers,
 * wall times from 1800 to 2199, with no longitude, the zone's own mean-time
 * longitude and two degrees either side of it, must resolve to the engine's
 * answer, field for field.
 */
const ZONES: string[] = cityIndex.tz.filter((zone: string) => !/^(?:Etc\/|UTC$)/u.test(zone));
const YEARS = [1800, 1850, 1870, 1883, 1890, 1900, 1912, 1920, 1935, 1945, 1950, 1960, 1969, 1970, 1975, 2000, 2026, 2100, 2199];
const DAYS = ['01-01', '04-01', '07-01', '10-15'];
const TIMES = ['00:30', '02:30', '12:00'];

/** The engine's resolution in the site's fields. */
function siteFields(resolved: ReturnType<typeof packageResolveLocalToUtc>): LocalTimeResolution {
  return {
    utc: resolved.utc,
    offsetMinutes: resolved.offsetMinutes,
    flags: [...resolved.flags],
    ...(resolved.localMeanTime ? { localMeanTime: { ...resolved.localMeanTime } } : {}),
  };
}

describe('the site resolver is the engine\'s', () => {
  it('for every zone of the city index, with and without a birthplace longitude', async () => {
    const failures: string[] = [];
    let compared = 0;
    for (const zone of ZONES) {
      await prepareLocalTime('1800-01-01', zone);
      // The zone's own mean time, as a longitude: its offset before standard time.
      const own = packageResolveLocalToUtc('1800-06-15', '12:00', zone).offsetMinutes / 4;
      const longitudes = [undefined, own, own - 2, own + 2].filter((value) => value === undefined || Math.abs(value) <= 180);
      for (const year of YEARS) {
        for (const day of DAYS) {
          for (const time of TIMES) {
            const date = `${year}-${day}`;
            for (const longitude of longitudes) {
              const options = longitude === undefined ? {} : { longitude };
              const site = resolveLocalToUtc(date, time, zone, options);
              const engine = siteFields(packageResolveLocalToUtc(date, time, zone, options));
              compared += 1;
              if (JSON.stringify(site) !== JSON.stringify(engine)) {
                failures.push(`${zone} ${date} ${time} ${longitude ?? 'no longitude'}: ${JSON.stringify(site)} for ${JSON.stringify(engine)}`);
              }
            }
          }
        }
      }
    }
    expect(failures.slice(0, 5)).toEqual([]);
    // 351 zones (the index's 356 less Etc/ and UTC), 228 wall times each, three or four longitudes.
    expect(compared).toBeGreaterThan(300_000);
  }, 120_000);

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 200, -181])('ignores a longitude the site cannot place (%s), as before', async (longitude) => {
    await prepareLocalTime('1870-06-15', 'America/New_York');
    expect(resolveLocalToUtc('1870-06-15', '12:00', 'America/New_York', { longitude }))
      .toEqual(resolveLocalToUtc('1870-06-15', '12:00', 'America/New_York'));
  });

  it.each([
    ['2024-02-30', '12:00'], ['2024-01-01', '24:00'], ['2024-01-01', '12:00:30'], ['24-01-01', '12:00'], ['', ''],
  ])('refuses %s %s with the site\'s message', (date, time) => {
    expect(() => resolveLocalToUtc(date, time, 'Europe/Paris'))
      .toThrow(new RangeError('resolveLocalToUtc needs a valid YYYY-MM-DD date and HH:MM time.'));
  });

  it.each(['Private/Atlantis', '', ' ', undefined, null, 42])('refuses an unsupported zone (%j) without repeating it', (zone) => {
    let caught: unknown;
    try { resolveLocalToUtc('2000-01-01', '12:00', zone as string); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(RangeError);
    expect((caught as Error).message).toBe('An explicit supported timezone is required.');
    expect(String(caught)).not.toContain('Atlantis');
  });

  it('prepares nothing for a zone Intl refuses, so resolving it is what fails', async () => {
    await expect(prepareLocalTime('1900-01-01', 'Private/Atlantis')).resolves.toBeUndefined();
    expect(() => resolveLocalToUtc('1900-01-01', '12:00', 'Private/Atlantis')).toThrow('An explicit supported timezone is required.');
  });
});
