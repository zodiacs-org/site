import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOON_DISTANCES_PATH, moonDistanceKm, renderMoonDistances } from './build-moon-distances.mjs';

const root = resolve(import.meta.dirname, '..');
const fixtures = resolve(import.meta.dirname, 'fixtures/moon-distances');
const committed = readFileSync(MOON_DISTANCES_PATH, 'utf8');
const data = JSON.parse(committed);
const sky = JSON.parse(readFileSync(resolve(root, 'src/data/sky.json'), 'utf8'));
const de421 = JSON.parse(readFileSync(resolve(fixtures, 'de421-reference.json'), 'utf8'));

/** The range column of a Horizons VECTORS table (VEC_TABLE 3, CSV, KM-S, geometric). */
function horizonsRange(name) {
  const text = readFileSync(resolve(fixtures, 'horizons', `${name}.txt`), 'utf8');
  expect(text).toContain('Output type     : GEOMETRIC cartesian states');
  expect(text).toContain('Center body name: Earth (399)');
  expect(text).toContain('Target body name: Moon (301)');
  const row = text.split('$$SOE')[1].split('$$EOE')[0].trim().split(',').map((cell) => cell.trim());
  const [jdut, , , , , , , , , range] = row;
  const at = new Date(Math.round((Number(jdut) - 2440587.5) * 86400_000));
  return { at, km: Number(range), url: readFileSync(resolve(fixtures, 'horizons', `${name}.url`), 'utf8').trim() };
}

describe('moon distances', () => {
  it('rebuilds byte for byte', async () => {
    expect(await renderMoonDistances()).toBe(committed);
  });

  it('covers every new and full Moon in sky.json, at the catalog instant', () => {
    expect(data.lunations.map(({ type, at }) => ({ type, at }))).toEqual(sky.moons);
    const years = new Set(data.lunations.map((l) => l.at.slice(0, 4)));
    expect([...years]).toEqual(['2026', '2027', '2028', '2029', '2030']);
    for (const lunation of data.lunations) {
      expect(Number.isInteger(lunation.distanceKm)).toBe(true);
      for (const kind of ['perigee', 'apogee']) {
        const { before, after } = lunation[kind];
        expect(Date.parse(before.at)).toBeLessThanOrEqual(Date.parse(lunation.at));
        expect(Date.parse(after.at)).toBeGreaterThan(Date.parse(lunation.at));
        expect(Number.isInteger(before.distanceKm) && Number.isInteger(after.distanceKm)).toBe(true);
        expect(before.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/u);
      }
    }
  });

  it('matches the committed JPL Horizons (DE441) distances within 2 km', () => {
    const names = readdirSync(resolve(fixtures, 'horizons')).filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4));
    expect(names.sort()).toEqual(['2026-11-24', '2026-12-24']);
    for (const name of names) {
      const { at, km, url } = horizonsRange(name);
      expect(url).toMatch(/^https:\/\/ssd\.jpl\.nasa\.gov\/api\/horizons\.api\?/u);
      expect(url).toContain("CENTER='500@399'");
      // At the Horizons instant itself.
      expect(Math.abs(moonDistanceKm(at) - km)).toBeLessThan(2);
      // And as published: the lunation within a second of it, rounded to the km.
      const lunation = data.lunations.find((l) => Math.abs(Date.parse(l.at) - at.getTime()) < 1000);
      expect(lunation, name).toBeDefined();
      expect(Math.abs(lunation.distanceKm - km)).toBeLessThan(2);
    }
  });

  it('stays within 4 km of JPL DE421 at every lunation, and its apsides within 4 km and 5 minutes', () => {
    expect(de421.ephemeris.name).toBe('JPL DE421');
    expect(de421.lunations.map(({ type, at }) => ({ type, at }))).toEqual(sky.moons);
    data.lunations.forEach((lunation, i) => {
      expect(Math.abs(lunation.distanceKm - de421.lunations[i].distanceKm), lunation.at).toBeLessThan(4);
    });
    const reference = new Map(de421.apsides.map((a) => [a.seed, a]));
    for (const lunation of data.lunations) {
      for (const kind of ['perigee', 'apogee']) {
        for (const side of ['before', 'after']) {
          const apsis = lunation[kind][side];
          const ref = reference.get(apsis.at);
          expect(ref?.kind, apsis.at).toBe(kind);
          expect(Math.abs(apsis.distanceKm - ref.distanceKm), apsis.at).toBeLessThan(4);
          expect(Math.abs(Date.parse(apsis.at) - Date.parse(ref.at)), apsis.at).toBeLessThan(5 * 60_000);
        }
      }
    }
  });

  // The data stays rule-free; the site's supermoon rule (owner decision,
  // 2026-11-12) is applied in src/lib/supermoon.ts and tested there.
  it('names no rule about which Moons count as close', () => {
    expect(committed.toLowerCase()).not.toMatch(/super|micro|rule|nolle/u);
  });
});
