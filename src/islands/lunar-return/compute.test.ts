import { beforeAll, describe, expect, it } from 'vitest';
import { computeLunarReturn, type LunarReturnComputeInput } from './compute';
import { lunarReturnChart } from '../../lib/engine/lunar-return';
import { prepareLocalTime, resolveLocalToUtc } from '../../lib/time/localToUtc';

const place = { name: 'Synthetic UTC', lat: 0, lon: 0, tz: 'Etc/UTC' };
const after = new Date('2026-03-01T00:00:00Z');
const input = (): LunarReturnComputeInput => ({ birthDate: '1990-02-01', birthTime: '12:00', timeKnown: true,
  birthplace: { ...place }, houseSystem: 'placidus', castLocation: null });

describe('lunar return complete-input caller', () => {
  // The calculator awaits this before computing, for each birthplace zone used here.
  beforeAll(() => Promise.all(['Etc/UTC', 'America/New_York', 'America/Mexico_City', 'Africa/Cairo']
    .map((zone) => prepareLocalTime('1799-12-31', zone))));
  it('resolves original birth input and preserves the submitted reference', () => {
    const result = computeLunarReturn(input(), after);
    expect(result.chart).toEqual(lunarReturnChart({ utc: new Date('1990-02-01T12:00:00Z'), latitude: 0, longitude: 0, houseSystem: 'placidus', timeKnown: true, flags: [] }, after));
    expect(result.referenceUtc).toBe(after.toISOString());
  });
  it('ignores stale extra cached positions and recomputes the authoritative Moon', () => {
    const stale = { ...input(), savedMoonLon: 1, summary: { bodies: [{ body: 'Moon', lon: 1 }], engineVersion: 'old' } };
    expect(computeLunarReturn(stale, after)).toEqual(computeLunarReturn(input(), after));
  });
  it.each<Partial<LunarReturnComputeInput>>([
    { timeKnown: false }, { birthTime: null }, { birthTime: '' }, { birthplace: null },
    { birthplace: { ...place, tz: '' } }, { birthplace: { ...place, tz: 'Made/Up' } },
    { birthplace: { ...place, lat: NaN } }, { birthDate: '2026-02-30' },
    { birthTime: '24:00' }, { birthDate: '1799-12-31' }, { birthDate: '2026-03-02' },
  ])('rejects incomplete, impossible or out-of-range input %j', (invalid) => {
    expect(() => computeLunarReturn({ ...input(), ...invalid }, after)).toThrow(RangeError);
  });
  it.each([['2025-03-09', '02:30'], ['2025-11-02', '01:30']])('rejects actual IANA gap/fold %s %s', (birthDate, birthTime) => {
    expect(() => computeLunarReturn({ ...input(), birthDate, birthTime, birthplace: { ...place, tz: 'America/New_York' } }, after))
      .toThrow('skipped or repeated');
  });
  it('uses the birthplace mean time before standard time, without hand-written offsets', () => {
    const birthDate = '1907-07-06'; const birthTime = '08:30';
    const birthplace = { name: 'Mexico City', lat: 19.4326, lon: -99.1332, tz: 'America/Mexico_City' };
    const resolved = resolveLocalToUtc(birthDate, birthTime, birthplace.tz, { longitude: birthplace.lon });
    // tzdb's −6:36:36 is its own reference point; this longitude reads −6:36:32.
    expect(resolved.utc.getTime() - resolveLocalToUtc(birthDate, birthTime, birthplace.tz).utc.getTime()).toBe(-4000);
    const result = computeLunarReturn({ ...input(), birthDate, birthTime, birthplace }, after);
    expect(result.natalTimeFlags).toEqual(resolved.flags.filter((flag) => flag === 'lmt'));
    expect(result.natalLocalMeanTime).toBe(true);
    expect(result.chart).toEqual(lunarReturnChart({ utc: resolved.utc, latitude: birthplace.lat, longitude: birthplace.lon, houseSystem: 'placidus', timeKnown: true, flags: resolved.flags }, after));
  });
  it('marks a whole-minute local mean time, which carries the lmt flag too', () => {
    // 31.25° E is exactly +2:05:00. Since engine rc.15 `lmt` means a local mean time
    // read the wall time, whether or not it ran to seconds.
    const birthplace = { name: 'Cairo', lat: 30.04, lon: 31.25, tz: 'Africa/Cairo' };
    const result = computeLunarReturn({ ...input(), birthDate: '1890-05-01', birthTime: '10:00', birthplace }, after);
    expect(result.natalTimeFlags).toEqual(['lmt']);
    expect(result.natalLocalMeanTime).toBe(true);
    expect(computeLunarReturn(input(), after).natalLocalMeanTime).toBe(false);
  });
  it('keeps the event and planets under relocation while changing angles', () => {
    const first = computeLunarReturn(input(), after);
    const second = computeLunarReturn({ ...input(), castLocation: { name: 'Bangkok', lat: 13.7563, lon: 100.5018, tz: 'Asia/Bangkok' } }, after);
    expect(second.chart.input.utc).toEqual(first.chart.input.utc);
    expect(second.chart.bodies).toEqual(first.chart.bodies);
    expect(second.chart.angles).not.toEqual(first.chart.angles);
  });
  it('does not retain the caller’s mutable reference date', () => {
    const reference = new Date(after); const result = computeLunarReturn(input(), reference);
    reference.setUTCFullYear(2100);
    expect(result.referenceUtc).toBe(after.toISOString());
  });
});
