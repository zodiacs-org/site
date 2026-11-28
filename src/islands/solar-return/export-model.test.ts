import { describe, expect, it } from 'vitest';
import type { SolarReturnResultData } from './compute';
import { solarReturnExportModel } from './export-model';
import { SR_COPY } from './copy';

const result = (): SolarReturnResultData => ({
  returnYear: 2024, noTime: false, noPlace: false,
  chart: {
    input: { utc: new Date('2023-12-31T23:59:12.345Z'), latitude: 51.5, longitude: -0.12, timeKnown: true, houseSystem: 'whole' },
    bodies: [{ body: 'Sun', lon: 103.3759585, lat: 0, speed: 0.98, retrograde: false }],
    angles: { asc: 15.125, mc: 285.5, dsc: 195.125, ic: 105.5 },
    houses: { system: 'whole', cusps: Array.from({ length: 12 }, (_, i) => i * 30) },
    aspects: [], flags: [], engineVersion: '1.0.0',
  },
});

describe('completed solar return export model', () => {
  it('preserves the selected year, actual instant/geometry and existing reading without birth inputs', () => {
    const source = result();
    const model = solarReturnExportModel(source);
    expect(model.returnYear).toBe(2024);
    expect(model.instantUtc).toBe('2023-12-31T23:59:12.345Z');
    expect(model.title).toBe('Solar return');
    expect(model.wheel.bodies).toEqual(source.chart.bodies);
    expect(model.wheel.houses).toEqual(source.chart.houses);
    expect(model.reading).toEqual([
      { kind: 'asc', text: SR_COPY.asc.aries },
      { kind: 'sun-house', text: SR_COPY.sunHouse[4] },
    ]);
    expect(model.readingBasis[1]).toBe('Sun in house 4');
    expect(JSON.stringify(model)).not.toMatch(/latitude|longitude|timeKnown|birth|51\.5|-0\.12/);
    expect(model.wheel).not.toHaveProperty('input');
  });

  it('uses result uncertainty even though the engine return input is always timeKnown', () => {
    const model = solarReturnExportModel({ ...result(), noTime: true });
    expect(model.title).toBe('Approximate solar return');
    expect(model.wheel.angles).toBeNull();
    expect(model.wheel.houses).toBeNull();
    expect(model.reading.map((entry) => entry.kind)).toEqual(['planets-only']);
    expect(model.notes.join(' ')).toMatch(/shift by hours/);
    expect(model.readingBasis.join(' ')).not.toMatch(/Ascendant|Sun in house/);
    expect(model.instantUtc).toBe(result().chart.input.utc.toISOString());
  });

  it('keeps a time-known no-place return planets-only without calling its instant approximate', () => {
    const model = solarReturnExportModel({ ...result(), noPlace: true });
    expect(model.title).toBe('Solar return');
    expect(model.noTime).toBe(false);
    expect(model.wheel.angles).toBeNull();
    expect(model.wheel.houses).toBeNull();
    expect(model.notes.join(' ')).toContain('No stored birthplace');
    expect(model.notes.join(' ')).not.toMatch(/noon|approximate|shift by hours/);
  });

  it('explains why houses and angles are omitted for a geographic pole return', () => {
    const model = solarReturnExportModel({ ...result(), atPole: true });
    expect(model.atPole).toBe(true);
    expect(model.wheel.angles).toBeNull();
    expect(model.wheel.houses).toBeNull();
    expect(model.notes.join(' ')).toContain('geographic pole');
  });

  it('owns its geometry and changes relocation geometry even when the instant is identical', () => {
    const source = result();
    const before = solarReturnExportModel(source);
    source.chart.bodies[0].lon = 104;
    source.chart.houses!.cusps[0] = 1;
    source.chart.angles!.asc = 45.5;
    const after = solarReturnExportModel(source);
    expect(before.wheel.bodies[0].lon).toBe(103.3759585);
    expect(before.wheel.houses!.cusps[0]).toBe(0);
    expect(before.wheel.angles!.asc).toBe(15.125);
    expect(after.instantUtc).toBe(before.instantUtc);
    expect(after.wheel.angles!.asc).toBe(45.5);
    expect(after.reading[0].text).toBe(SR_COPY.asc.taurus);
  });
});
