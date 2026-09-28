/*
 * What a solver can recover from a solar or lunar return image, as its
 * renderer draws it. The return comes back to the natal Sun or Moon, so its
 * instant carries the birth instant: printed to the second (solar) or the
 * millisecond (lunar), it gave the birth instant to under a second, and before
 * standard time the birthplace's longitude in strips; without a birth time,
 * noon at the birthplace, and so its time zone. The angles and houses of a
 * return cast at the birthplace narrowed its latitude to a few kilometres.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { bodyLongitude, computeBodies, computeChart } from './engine/full';
import { lunarReturnChart } from './engine/lunar-return';
import { solarReturnChart } from './engine/solar-return';
import { lunarReturnShownInstant } from './lunar-return-ical';
import { lunarReturnImageModel } from './lunar-return-card';
import { solarReturnImageModel } from './share-card';
import { sharedTimedInstant } from './share-positions-noon';
import { prepareLocalTime, resolveLocalToUtc } from './time/localToUtc';
import { computeSolarReturn, nearForReturnYear, type SolarReturnResultData } from '../islands/solar-return/compute';
import { solarReturnExportModel } from '../islands/solar-return/export-model';
import { computeLunarReturn, type LunarReturnResultData } from '../islands/lunar-return/compute';
import { lunarReturnExportModel } from '../islands/lunar-return/export-model';

const NOW = new Date('2026-09-28T00:00:00Z');
const norm = (x: number) => ((x % 360) + 360) % 360;
const signed = (x: number) => norm(x + 180) - 180;
const births = [
  { place: 'Lyon 1987', date: '1987-03-14', time: '06:42', zone: 'Europe/Paris', lat: 45.764, lon: 4.8357 },
  { place: 'Buffalo 1870', date: '1870-06-15', time: '14:30', zone: 'America/New_York', lat: 42.8864, lon: -78.8784 },
  { place: 'Kathmandu 1915', date: '1915-01-20', time: '16:20', zone: 'Asia/Kathmandu', lat: 27.7172, lon: 85.324 },
];
const place = (b: typeof births[number]) => ({ name: b.place, lat: b.lat, lon: b.lon, tz: b.zone });
/** What SolarReturnResult and LunarReturnResult hand to their image and calendar actions. */
const solarImage = (result: SolarReturnResultData) => solarReturnImageModel(
  solarReturnExportModel(result.shared ? { ...result, chart: result.shared } : result),
);
const lunarImage = (result: LunarReturnResultData) => lunarReturnImageModel(
  lunarReturnExportModel(result.shared ? { ...result, chart: result.shared } : result),
);

beforeAll(async () => {
  for (const b of births) await prepareLocalTime(b.date, b.zone);
  for (const zone of ['Asia/Kathmandu', 'Asia/Kolkata', 'America/New_York']) {
    await prepareLocalTime('2013-06-15', zone);
    await prepareLocalTime('1870-06-15', zone);
  }
});

describe('a solar return image', () => {
  it('starts from the natal Sun at the whole minute and prints the return to the whole minute', () => {
    for (const b of births) {
      const resolved = resolveLocalToUtc(b.date, b.time, b.zone, { longitude: b.lon });
      const minute = sharedTimedInstant(resolved.utc)!;
      const result = computeSolarReturn({
        birthDate: b.date, birthTime: b.time, timeKnown: true, birthplace: place(b), savedSunLon: null,
        houseSystem: 'whole', castLocation: place(b), year: 2026,
      }, NOW);
      const image = solarImage(result);
      expect(image.instantUtc, b.place).toMatch(/T\d{2}:\d{2}:00\.000Z$/u);
      // The return the image shows is the one from the Sun at the birth minute.
      const fromMinute = solarReturnChart(
        computeBodies(minute).find((body) => body.body === 'Sun')!.lon,
        nearForReturnYear(2026, b.date), { latitude: b.lat, longitude: b.lon }, 'whole',
      );
      expect((result.shared ?? result.chart).input.utc).toEqual(fromMinute.input.utc);
      expect(Boolean(result.shared)).toBe(minute.getTime() !== resolved.utc.getTime());
      // Angles at the middle of the whole degree; the Ascendant line to the degree.
      const { asc, mc } = image.wheel.angles!;
      expect([asc % 1, mc % 1]).toEqual([0.5, 0.5]);
      expect(image.readingBasis.find((line) => line.startsWith('Ascendant '))).toMatch(/^Ascendant \d{1,2}° [A-Z][a-z]+$/u);
    }
  });

  it('is the same image for every birth instant in the same minute', () => {
    // The saved-chart path takes an instant directly: seconds apart, one image.
    const images = new Set<string>();
    for (const second of [0, 7, 29.999, -30]) {
      const utc = new Date(Date.parse('1870-06-15T19:46:00Z') + second * 1000);
      const result = computeSolarReturn({
        birthDate: '1870-06-15', birthTime: '14:30', timeKnown: true, birthplace: null,
        savedSunLon: computeBodies(utc).find((body) => body.body === 'Sun')!.lon, savedUtc: utc.toISOString(),
        houseSystem: 'whole', castLocation: null, year: 2026,
      }, NOW);
      images.add(JSON.stringify(solarImage(result)));
    }
    expect(images.size).toBe(1);
  });

  it('leaves the birthplace’s latitude to the whole degree of the Ascendant, not a few kilometres', () => {
    for (const b of births) {
      const result = computeSolarReturn({
        birthDate: b.date, birthTime: b.time, timeKnown: true, birthplace: place(b), savedSunLon: null,
        houseSystem: 'whole', castLocation: place(b), year: 2026,
      }, NOW);
      const image = solarImage(result);
      const shown = Math.floor(image.wheel.angles!.asc);
      // A solver who knows the true longitude and the printed minute.
      const printed = Date.parse(image.instantUtc);
      let south = Infinity; let north = -Infinity;
      for (let lat = b.lat - 4; lat <= b.lat + 4; lat += 0.02) {
        for (const offset of [-29_000, 0, 29_000]) {
          const chart = computeChart({ utc: new Date(printed + offset), latitude: lat, longitude: b.lon, houseSystem: 'whole', timeKnown: true });
          if (Math.floor(chart.angles!.asc) === shown) { south = Math.min(south, lat); north = Math.max(north, lat); }
        }
      }
      expect((north - south) * 110.57, b.place).toBeGreaterThan(50);
    }
  }, 60_000);

  it('computes a return without a birth time from 12:00 UTC on the birth date: one image per date', () => {
    for (const [date, places] of [
      ['2013-06-15', [{ name: 'Kathmandu', lat: 27.72, lon: 85.32, tz: 'Asia/Kathmandu' }, { name: 'Kolkata', lat: 22.57, lon: 88.36, tz: 'Asia/Kolkata' }]],
      ['1870-06-15', [{ name: 'Buffalo', lat: 42.89, lon: -78.88, tz: 'America/New_York' }, { name: 'Rochester', lat: 43.16, lon: -77.61, tz: 'America/New_York' }]],
    ] as const) {
      const images = new Set<string>();
      for (const birthplace of places) {
        const result = computeSolarReturn({
          birthDate: date, birthTime: null, timeKnown: false, birthplace: { ...birthplace }, savedSunLon: null,
          houseSystem: 'whole', castLocation: { ...birthplace }, year: 2026,
        }, NOW);
        const sun = bodyLongitude('Sun', result.chart.input.utc);
        const noon = computeBodies(new Date(`${date}T12:00:00Z`)).find((body) => body.body === 'Sun')!.lon;
        expect(Math.abs(signed(sun - noon))).toBeLessThan(1e-6);
        const image = solarImage(result);
        expect(image.title).toBe('Approximate solar return');
        expect(image.wheel.angles).toBeNull();
        images.add(JSON.stringify(image));
      }
      expect(images.size, date).toBe(1);
    }
    expect(() => computeSolarReturn({
      birthDate: '2013-02-30', birthTime: null, timeKnown: false, birthplace: { name: 'X', lat: 0, lon: 0, tz: 'UTC' },
      savedSunLon: null, houseSystem: 'whole', castLocation: null, year: 2026,
    }, NOW)).toThrow('calendar date');
  });

  it('leaves out Placidus houses and the house they put the Sun in, and says so', () => {
    const b = births[0];
    const result = computeSolarReturn({
      birthDate: b.date, birthTime: b.time, timeKnown: true, birthplace: place(b), savedSunLon: null,
      houseSystem: 'placidus', castLocation: place(b), year: 2026,
    }, NOW);
    const page = solarReturnExportModel(result);
    expect(page.readingBasis.some((line) => line.startsWith('Sun in house'))).toBe(true);
    const image = solarImage(result);
    expect(image.wheel.houses).toBeNull();
    expect(image.readingBasis.some((line) => line.startsWith('Sun in house'))).toBe(false);
    expect(image.reading.map((entry) => entry.kind)).not.toContain('sun-house');
    expect(image.notes).toContain('Placidus houses are left out of this image.');
    // Whole-sign houses follow from the ascendant's sign and stay.
    const whole = solarImage(computeSolarReturn({
      birthDate: b.date, birthTime: b.time, timeKnown: true, birthplace: place(b), savedSunLon: null,
      houseSystem: 'whole', castLocation: place(b), year: 2026,
    }, NOW));
    expect(whole.wheel.houses?.system).toBe('whole');
    expect(whole.readingBasis.some((line) => line.startsWith('Sun in house'))).toBe(true);
  });
});

describe('a lunar return image', () => {
  const reference = new Date('2026-09-28T00:00:00Z');

  it('starts from the natal Moon at the whole minute: a solver recovers the minute, not the second', () => {
    for (const b of births) {
      const resolved = resolveLocalToUtc(b.date, b.time, b.zone, { longitude: b.lon });
      const minute = sharedTimedInstant(resolved.utc)!;
      const result = computeLunarReturn({
        birthDate: b.date, birthTime: b.time, timeKnown: true, birthplace: place(b), houseSystem: 'whole', castLocation: null,
      }, reference);
      const image = lunarImage(result);
      expect(image.instantUtc, b.place).toMatch(/T\d{2}:\d{2}:00\.000Z$/u);
      // The reviewer's inversion: the birth instant whose Moon is the return's.
      const shown = (result.shared ?? result.chart).input.utc;
      const moon = bodyLongitude('Moon', shown);
      let lo = resolved.utc.getTime() - 3_600_000; let hi = resolved.utc.getTime() + 3_600_000;
      for (let i = 0; i < 80; i += 1) {
        const mid = (lo + hi) / 2;
        if (signed(bodyLongitude('Moon', new Date(mid)) - moon) < 0) lo = mid; else hi = mid;
      }
      const inferred = (lo + hi) / 2;
      expect(Math.abs(inferred - minute.getTime()), b.place).toBeLessThan(10);
      if (minute.getTime() !== resolved.utc.getTime()) {
        expect(Math.abs(inferred - resolved.utc.getTime()), b.place).toBeGreaterThan(1000);
      }
      const { asc, mc } = image.wheel.angles!;
      expect([asc % 1, mc % 1]).toEqual([0.5, 0.5]);
    }
  });

  it('is the same image for every birth instant in the same minute', () => {
    const b = births[1];
    const images = new Set<string>();
    for (const second of [-30, -12, 0, 5, 29.5]) {
      const utc = new Date(Date.parse('1870-06-15T19:46:00Z') + second * 1000);
      const minute = sharedTimedInstant(utc)!;
      const natal = { latitude: b.lat, longitude: b.lon, houseSystem: 'whole' as const, timeKnown: true as const, flags: [] };
      // As computeLunarReturn builds its result for a birth at `utc`.
      const chart = lunarReturnChart({ ...natal, utc }, reference);
      const shared = lunarReturnChart({ ...natal, utc: minute }, reference);
      images.add(JSON.stringify(lunarImage({
        chart, ...(minute.getTime() !== utc.getTime() ? { shared } : {}), referenceUtc: reference.toISOString(),
        natalTimeFlags: [], natalLocalMeanTime: true,
      })));
      expect(lunarReturnShownInstant({ instantUtc: chart.input.utc.toISOString(), referenceUtc: reference.toISOString() }))
        .toMatch(/:00\.000Z$/u);
    }
    expect(images.size).toBe(1);
  });
});
