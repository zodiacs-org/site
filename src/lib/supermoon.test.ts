import { describe, expect, it } from 'vitest';
import { SUPERMOON_RULE, moonDistanceLunation, moonDistanceLunations, supermoon, type MoonDistanceLunation } from './supermoon';

const full = (at: string) => {
  const row = moonDistanceLunations().find((l) => l.type === 'full' && l.at.startsWith(at));
  if (!row) throw new Error(`no full Moon on ${at}`);
  return row;
};

describe('supermoon rule (within 10% of the perigee to apogee range)', () => {
  it('marks the 24 November 2026 full Moon at 360,764 km', () => {
    const row = full('2026-11-24');
    expect(row.at.slice(0, 19)).toBe('2026-11-24T14:53:35');
    expect(row.distanceKm).toBe(360764);
    const result = supermoon(row);
    expect(result).toEqual({
      distanceKm: 360764,
      rule: SUPERMOON_RULE,
      // The perigee a day later, and the nearer apogee (13 November) of the two either side.
      perigee: { at: row.perigee.after.at, distanceKm: 359345 },
      apogee: { at: row.apogee.before.at, distanceKm: 405618 },
    });
    expect(result!.perigee.at.slice(0, 10)).toBe('2026-11-25');
    expect(result!.apogee.at.slice(0, 10)).toBe('2026-11-13');
    // About 3% of the range, under either apogee.
    expect((360764 - 359345) / (405618 - 359345)).toBeLessThan(0.04);
    expect((360764 - 359345) / (406418 - 359345)).toBeLessThan(0.04);
  });

  it('marks the 24 December 2026 full Moon at 356,739 km', () => {
    const row = full('2026-12-24');
    expect(row.distanceKm).toBe(356739);
    expect(supermoon(row)?.distanceKm).toBe(356739);
  });

  it('does not mark a far full Moon', () => {
    const farthest = moonDistanceLunations()
      .filter((l) => l.type === 'full')
      .reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));
    expect(farthest.distanceKm).toBeGreaterThan(400_000);
    expect(supermoon(farthest)).toBeNull();
    // 26 October 2026: 368,870 km, about 11% of the range, just outside.
    expect(supermoon(full('2026-10-26'))).toBeNull();
  });

  it('never marks a new Moon, however close', () => {
    const news = moonDistanceLunations().filter((l) => l.type === 'new');
    expect(news.length).toBeGreaterThan(60);
    for (const row of news) expect(supermoon(row), row.at).toBeNull();
    const closestNew = news.reduce((a, b) => (b.distanceKm < a.distanceKm ? b : a));
    expect(closestNew.distanceKm).toBeLessThan(360_000);
    // The same numbers on a full Moon would be marked.
    expect(supermoon({ ...closestNew, type: 'full' })).not.toBeNull();
  });

  it('uses the nearest perigee in time, before or after', () => {
    const base: MoonDistanceLunation = {
      type: 'full',
      at: '2030-01-10T00:00:00.000Z',
      distanceKm: 362_000,
      perigee: { before: { at: '2030-01-09T00:00Z', distanceKm: 361_000 }, after: { at: '2030-02-06T00:00Z', distanceKm: 368_000 } },
      apogee: { before: { at: '2029-12-26T00:00Z', distanceKm: 405_000 }, after: { at: '2030-01-23T00:00Z', distanceKm: 406_000 } },
    };
    // Perigee a day before: 1,000 km over a 44,000 km range.
    expect(supermoon(base)?.perigee.at).toBe('2030-01-09T00:00Z');
    // Move the full Moon so the later perigee is nearer in time: 362,000 km is closer than it, so marked.
    const later = { ...base, at: '2030-02-01T00:00:00.000Z' };
    expect(supermoon(later)?.perigee.at).toBe('2030-02-06T00:00Z');
  });

  it('takes the nearer of the two apogees, the stricter range', () => {
    const row: MoonDistanceLunation = {
      type: 'full',
      at: '2030-01-10T00:00:00.000Z',
      distanceKm: 0,
      perigee: { before: { at: '2030-01-09T00:00Z', distanceKm: 360_000 }, after: { at: '2030-02-06T00:00Z', distanceKm: 368_000 } },
      apogee: { before: { at: '2029-12-26T00:00Z', distanceKm: 404_000 }, after: { at: '2030-01-23T00:00Z', distanceKm: 406_000 } },
    };
    // Range 44,000 km with the nearer apogee: the line is at 364,400 km.
    expect(supermoon({ ...row, distanceKm: 364_400 })?.apogee.distanceKm).toBe(404_000);
    expect(supermoon({ ...row, distanceKm: 364_401 })).toBeNull();
    // 13 December 2027 is 10.1% under the nearer apogee and 9.9% under the farther: not marked.
    const dec2027 = full('2027-12-13');
    expect(supermoon(dec2027)).toBeNull();
  });

  it('marks a minority of the full Moons from 2026 to 2030, all of them close', () => {
    const fulls = moonDistanceLunations().filter((l) => l.type === 'full');
    const marked = fulls.filter((l) => supermoon(l));
    expect(marked.length).toBeGreaterThan(10);
    expect(marked.length).toBeLessThan(fulls.length / 3);
    for (const row of marked) expect(row.distanceKm, row.at).toBeLessThan(370_000);
  });

  it('finds a row by its catalog type and instant', () => {
    const row = full('2026-11-24');
    expect(moonDistanceLunation('full', row.at)).toBe(row);
    expect(moonDistanceLunation('new', row.at)).toBeUndefined();
  });
});
