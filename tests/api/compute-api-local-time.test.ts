import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as bundled from '../../api/_compute/local-time.mjs';
import * as source from '../../src/lib/compute-api/local-time-source';
import { BUNDLE_PATH, TYPES_PATH, buildLocalTimeBundle } from '../../scripts/build-compute-local-time.mjs';

/*
 * The compute function resolves local time with api/_compute/local-time.mjs,
 * the site's own resolver bundled with its tables. This holds the bundle to
 * its source: it must be what the source builds to today, it must carry every
 * zone history the pinned release has, and it must answer every case exactly
 * as the calculator's module does.
 */
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url));

describe("the compute API's local-time bundle", () => {
  it('is what src/lib/time/localToUtc.ts builds to now, and loads nothing at run time', async () => {
    const { bytes, types, inputs } = await buildLocalTimeBundle();
    expect(read(BUNDLE_PATH).equals(bytes), 'stale: run node scripts/build-compute-local-time.mjs').toBe(true);
    expect(read(TYPES_PATH).equals(types)).toBe(true);
    expect(inputs).toContain('src/lib/time/localToUtc.ts');
    expect(inputs).toContain('src/lib/time/birthplace-clock.ts');
    expect(inputs).toContain('src/lib/time/zone-names.ts');
    expect(inputs).toContain('src/data/tz-lmt.json');
    expect(inputs).toContain('src/data/tz-history/2025c/excluded.json');
  });

  it('gives every zone name the spelling the source gives it, in any letter case', async () => {
    const directory = new URL('../../src/data/tz-history/2025c/', import.meta.url);
    const names = new Set<string>([
      ...Intl.supportedValuesOf('timeZone'),
      ...Object.keys(JSON.parse(read('src/data/tz-lmt.json').toString('utf8')).eras),
      ...Object.keys(JSON.parse(readFileSync(new URL('excluded.json', directory), 'utf8')).excluded),
    ]);
    for (const file of readdirSync(directory).filter((name) => /^\d{2}\.json$/u.test(name))) {
      for (const zone of Object.keys(JSON.parse(readFileSync(new URL(file, directory), 'utf8')).zones)) names.add(zone);
    }
    for (const name of [...names, 'Europe/Atlantis', 'SystemV/AST4', '+05:30']) {
      for (const spelling of [name, name.toLowerCase(), name.toUpperCase()]) {
        expect(await bundled.canonicalZoneName(spelling), spelling).toBe(await source.canonicalZoneName(spelling));
      }
    }
    expect(names.size).toBeGreaterThan(590);
  }, 60_000);

  it('carries every zone history of the pinned release', async () => {
    const directory = new URL('../../src/data/tz-history/2025c/', import.meta.url);
    let zones = 0;
    for (const file of readdirSync(directory).filter((name) => /^\d{2}\.json$/u.test(name))) {
      const bucket = JSON.parse(readFileSync(new URL(file, directory), 'utf8'));
      for (const [zone, history] of Object.entries<any>(bucket.zones)) {
        expect(await bundled.loadZoneHistory(zone), zone).toEqual(history);
        zones += 1;
      }
    }
    expect(zones).toBeGreaterThan(300);
    const excluded = JSON.parse(readFileSync(new URL('excluded.json', directory), 'utf8')).excluded;
    for (const zone of Object.keys(excluded)) expect(await bundled.loadZoneHistory(zone), zone).toBeNull();
  });

  it("resolves every case as the calculator's module does", async () => {
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
