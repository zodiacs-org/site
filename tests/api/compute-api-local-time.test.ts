import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../api/_compute/local-time.mjs';
const bundled = createLocalTimeModule();
import * as source from '../../src/lib/compute-api/local-time-source';
import { BUNDLE_PATH, TYPES_PATH, buildLocalTimeBundle } from '../../scripts/build-compute-local-time.mjs';

/*
 * The compute function resolves local time with api/_compute/local-time.mjs,
 * the engine's resolver (@zodiacs/engine/geo) bundled with the histories it
 * loads. This holds the bundle to its source: it must be what the source
 * builds to today, it must carry every zone name of the release, and it must
 * answer every case exactly as the source modules do, its histories included.
 */
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url));
const tzNames: { names: string[] } = JSON.parse(read('src/data/tz-names.json').toString('utf8'));

describe("the compute API's local-time bundle", () => {
  it("is what the engine's resolver builds to now, and loads nothing at run time", async () => {
    const { bytes, types, inputs } = await buildLocalTimeBundle();
    expect(read(BUNDLE_PATH).equals(bytes), 'stale: run node scripts/build-compute-local-time.mjs').toBe(true);
    expect(read(TYPES_PATH).equals(types)).toBe(true);
    expect(inputs).toContain('node_modules/@zodiacs/engine/dist/geo.js');
    expect(inputs.filter((input) => /^node_modules\/@zodiacs\/engine\/dist\/tzdb-2025c-\d{2}-/u.test(input))).toHaveLength(16);
    expect(inputs).toContain('src/lib/time/zone-names.ts');
    expect(inputs).toContain('src/data/tz-names.json');
    // The site's own resolver and tables are gone, from the bundle as from the site.
    expect(inputs.filter((input) => /localToUtc|birthplace-clock|tz-history|tz-lmt/u.test(input))).toEqual([]);
  });

  it('gives every zone name the spelling the source gives it, in any letter case', async () => {
    const names = new Set<string>([...Intl.supportedValuesOf('timeZone'), ...tzNames.names]);
    for (const name of [...names, 'Europe/Atlantis', 'SystemV/AST4', '+05:30']) {
      for (const spelling of [name, name.toLowerCase(), name.toUpperCase()]) {
        expect(await bundled.canonicalZoneName(spelling), spelling).toBe(await source.canonicalZoneName(spelling));
      }
    }
    expect(names.size).toBeGreaterThan(590);
  }, 60_000);

  it('carries every zone history the engine ships, and names the same release', async () => {
    expect(bundled.TZDB).toEqual(source.TZDB);
    let tzdb = 0;
    for (const zone of tzNames.names) {
      // A name the runtime's Intl refuses (Asia/Hanoi) is refused by both.
      let expected: unknown;
      let actual: unknown;
      try {
        await source.prepareLocalTime('1850-06-15', zone);
        expected = source.resolveLocalToUtc('1850-06-15', '12:00', zone);
      } catch (error) { expected = String(error); }
      try {
        await bundled.prepareLocalTime('1850-06-15', zone);
        actual = bundled.resolveLocalToUtc('1850-06-15', '12:00', zone);
      } catch (error) { actual = String(error); }
      expect(actual, zone).toEqual(expected);
      if ((actual as { zone?: { source: string } }).zone?.source === 'tzdb') tzdb += 1;
    }
    expect(tzdb).toBeGreaterThan(500);
  }, 60_000);

  it("resolves every case as the engine's module does", async () => {
    const zones: Array<[string, number]> = [
      ['Europe/Stockholm', 18.07], ['America/Mexico_City', -99.13], ['Asia/Kolkata', 88.36], ['Australia/Lord_Howe', 159.08],
      ['Pacific/Apia', -171.76], ['America/Sitka', -135.33], ['Asia/Manila', 120.98], ['Europe/Paris', 2.35],
      ['America/New_York', -74.01], ['Africa/Monrovia', -10.8], ['Asia/Harbin', 126.65], ['Pacific/Kiritimati', -157.36],
    ];
    const dates = ['1800-01-01', '1843-12-30', '1867-10-18', '1883-11-18', '1900-01-01', '1916-05-14', '1947-07-01',
      '1969-12-31', '1970-01-01', '1970-01-02', '1994-12-31', '2026-03-29', '2026-10-25', '2199-12-31'];
    const times = ['00:00', '01:30', '02:30', '12:00', '23:59'];
    let compared = 0;
    for (const [zone, longitude] of zones) {
      for (const date of dates) {
        await source.prepareLocalTime(date, zone);
        await bundled.prepareLocalTime(date, zone);
        for (const time of times) {
          for (const options of [{}, { longitude }]) {
            let expected: unknown;
            let actual: unknown;
            try { expected = source.resolveLocalToUtc(date, time, zone, options); } catch (error) { expected = String(error); }
            try { actual = bundled.resolveLocalToUtc(date, time, zone, options); } catch (error) { actual = String(error); }
            expect(actual, `${date} ${time} ${zone} ${JSON.stringify(options)}`).toEqual(expected);
            compared += 1;
          }
        }
      }
    }
    expect(compared).toBe(zones.length * dates.length * times.length * 2);
  }, 60_000);
});
