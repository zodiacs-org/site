import { beforeAll, describe, expect, it } from 'vitest';
import { computeLunarReturn } from './compute';
import { lunarReturnExportModel } from './export-model';
import { prepareLocalTime } from '../../lib/time/localToUtc';

// The resolver is the engine's, which the site loads on first use.
beforeAll(() => prepareLocalTime('2000-01-01', 'UTC'));

const result = () => computeLunarReturn({ birthDate: '1990-02-01', birthTime: '12:00', timeKnown: true,
  birthplace: { name: 'Private birthplace', lat: 13.7563, lon: 100.5018, tz: 'Asia/Bangkok' }, houseSystem: 'placidus', castLocation: null }, new Date('2026-03-01T00:00:00Z'));

describe('one private lunar completed-result model', () => {
  it('uses the actual return clock, Moon house and tightest eligible Moon aspect', () => {
    const data = result(); const model = lunarReturnExportModel(data);
    expect(model.instantUtc).toBe(data.chart.input.utc.toISOString());
    expect(model.referenceUtc).toBe(data.referenceUtc);
    expect(model.reading[0].kind).toBe('moon-house');
    const aspect = data.chart.aspects.filter((a) => (a.a === 'Moon' || a.b === 'Moon') && !a.a.includes('Node') && !a.b.includes('Node')).sort((a,b) => a.orb - b.orb)[0];
    if (aspect) expect(model.readingBasis[1]).toContain(`${aspect.a} ${aspect.type} ${aspect.b}`);
    expect(model.reading.every((row) => Boolean(row.text))).toBe(true);
  });
  it('excludes names, birth input, coordinates and profile IDs even when supplied as extra properties', () => {
    const data = result();
    const model = lunarReturnExportModel({ ...data, name: 'Secret Person', id: 'secret-id', birth: { date: '1990-02-01' } } as typeof data);
    const json = JSON.stringify(model);
    for (const excluded of ['Secret Person', 'secret-id', '1990-02-01', 'Private birthplace', '100.5018', '13.7563', 'latitude', 'longitude', 'input', 'birth']) expect(json).not.toContain(excluded);
  });
  it('copies mutable chart data so later source changes cannot alter a prepared result', () => {
    const data = result(); const model = lunarReturnExportModel(data); const before = JSON.stringify(model);
    data.chart.bodies[0].lon = 999; data.chart.houses!.cusps[0] = 999; data.chart.angles!.asc = 999; data.chart.aspects.splice(0);
    expect(JSON.stringify(model)).toBe(before);
  });
  it.each(['angles', 'houses'] as const)('rejects a positions-only chart missing %s', (field) => {
    const data = result(); data.chart[field] = null;
    expect(() => lunarReturnExportModel(data)).toThrow(RangeError);
  });
  it('rejects an unknown-time chart and an invalid or non-earlier reference', () => {
    const data = result(); data.chart.input.timeKnown = false;
    expect(() => lunarReturnExportModel(data)).toThrow(RangeError);
    const complete = result();
    expect(() => lunarReturnExportModel({ ...complete, referenceUtc: 'invalid' })).toThrow(RangeError);
    expect(() => lunarReturnExportModel({ ...complete, referenceUtc: complete.chart.input.utc.toISOString() })).toThrow(RangeError);
  });
});
