import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { coordinateText, distinctPlaceLabels, placeDistinctions, placeId, rowPoint } from './place-label';
import type { CityIndex, Row } from './rank';

const cities = new URL('../../../public/data/cities/', import.meta.url);
const rows: Row[] = readdirSync(cities).filter((file) => /^[0a-z]\.json$/u.test(file))
  .flatMap((file) => JSON.parse(readFileSync(new URL(file, cities), 'utf8')) as Row[]);
const index = JSON.parse(readFileSync(new URL('index.json', cities), 'utf8')) as CityIndex;

describe('place ids and labels', () => {
  it('gives every row of the index its own id, the same every time', () => {
    const ids = rows.map((row) => placeId(rowPoint(index, row)));
    expect(ids.every((id) => /^p[0-9a-z]{11}$/u.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(rows.length);
    // Bristol, Tennessee and Bristol, Virginia share a name and coordinates; their regions keep them apart.
    const bristols = rows.filter((row) => row[0] === 'Bristol' && row[4] === 3660 && row[5] === -8219).map((row) => placeId(rowPoint(index, row)));
    expect(bristols).toHaveLength(2);
    expect(bristols[0]).not.toBe(bristols[1]);
    expect(placeId({ name: 'Udaipur', admin1: 'Rajasthan', country: 'India', lat: 27.72, lon: 75.47 })).toBe(placeId({ name: 'Udaipur', admin1: 'Rajasthan', country: 'India', lat: 2772 / 100, lon: 7547 / 100 }));
  });

  it('adds coordinates only where two places shown together share a name, region and country', () => {
    const udaipurs = rows.filter((row) => row[0] === 'Udaipur').map((row) => rowPoint(index, row));
    expect(distinctPlaceLabels(udaipurs)).toEqual([
      'Udaipur, Rajasthan, India (24.59° N, 73.71° E)',
      'Udaipur, Tripura, India',
      'Udaipur, Rajasthan, India (27.72° N, 75.47° E)',
    ]);
    expect(placeDistinctions(udaipurs.slice(0, 2))).toEqual(['', '']);
    expect(coordinateText(-33.87, -70.65)).toBe('33.87° S, 70.65° W');
    expect(coordinateText(0, 0)).toBe('0.00° N, 0.00° E');
  });

  it('separates every pair of same-named places in the index by their coordinates to two decimals', () => {
    const groups = new Map<string, string[]>();
    for (const row of rows) {
      const point = rowPoint(index, row);
      const key = `${point.name}|${point.admin1}|${point.country}`;
      groups.set(key, [...(groups.get(key) ?? []), coordinateText(point.lat, point.lon)]);
    }
    const shared = [...groups.values()].filter((list) => list.length > 1);
    expect(shared.length).toBeGreaterThan(100);
    for (const list of shared) expect(new Set(list).size).toBe(list.length);
  });
});
