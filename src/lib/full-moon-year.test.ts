import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DISTANCE_DOMAIN, SUPERMOON_RULE_TEXT, closenessCurve, fullMoonYear, fullMoonYears } from './full-moon-year';
import { moonDistanceLunations, supermoon } from './supermoon';
import sky from '../data/sky.json';

const skyFulls = (sky.moons as { type: string; at: string }[]).filter((m) => m.type === 'full');

describe('fullMoonYear', () => {
  it('covers 2026 to 2030, and each year holds exactly its own sky.json full Moons', () => {
    expect(fullMoonYears()).toEqual([2026, 2027, 2028, 2029, 2030]);
    for (const year of fullMoonYears()) {
      const view = fullMoonYear(year)!;
      const expected = skyFulls.filter((m) => new Date(m.at).getUTCFullYear() === year).map((m) => m.at);
      expect(view.moons.map((m) => m.at), String(year)).toEqual(expected);
      for (const moon of view.moons) {
        expect(moon.fraction).toBeGreaterThanOrEqual(0);
        expect(moon.fraction).toBeLessThan(1);
      }
    }
    expect(fullMoonYear(2026)!.moons).toHaveLength(13);
    expect(fullMoonYear(2027)!.moons).toHaveLength(12);
    expect(fullMoonYear(2031)).toBeNull();
  });

  it('draws a closer full Moon larger and higher, never the other way', () => {
    const all = fullMoonYears().flatMap((year) => fullMoonYear(year)!.moons);
    const byDistance = [...all].sort((a, b) => a.distanceKm - b.distanceKm);
    for (let i = 1; i < byDistance.length; i += 1) {
      const nearer = byDistance[i - 1];
      const farther = byDistance[i];
      if (nearer.distanceKm === farther.distanceKm) continue;
      expect(nearer.size).toBeGreaterThan(farther.size);
      expect(nearer.apparent).toBeGreaterThan(farther.apparent);
      expect(nearer.closeness).toBeGreaterThan(farther.closeness);
    }
    expect(Math.min(...all.map((m) => m.size))).toBe(1);
    expect(Math.min(...all.map((m) => m.closeness))).toBe(0);
    expect(Math.max(...all.map((m) => m.closeness))).toBe(1);
    expect(DISTANCE_DOMAIN.nearKm).toBeLessThan(DISTANCE_DOMAIN.farKm);
  });

  it('picks the closest and farthest full Moon of 2026 and 2027', () => {
    const y2026 = fullMoonYear(2026)!;
    expect(y2026.closest.at.slice(0, 10)).toBe('2026-12-24');
    expect(y2026.closest.distanceKm).toBe(356739);
    expect(y2026.farthest.at.slice(0, 10)).toBe('2026-05-31');
    expect(y2026.farthest.distanceKm).toBe(406137);
    expect(y2026.widerPercent).toBe(13.8);
    const y2027 = fullMoonYear(2027)!;
    expect(y2027.closest.at.slice(0, 10)).toBe('2027-01-22');
    expect(y2027.farthest.at.slice(0, 10)).toBe('2027-07-18');
    for (const year of fullMoonYears()) {
      const view = fullMoonYear(year)!;
      const kms = view.moons.map((m) => m.distanceKm);
      expect(view.closest.distanceKm).toBe(Math.min(...kms));
      expect(view.farthest.distanceKm).toBe(Math.max(...kms));
    }
  });

  it('flags exactly the full Moons supermoon() marks, 2026 to 2030', () => {
    const rows = moonDistanceLunations().filter((row) => row.type === 'full');
    const flagged = new Map(fullMoonYears().flatMap((year) => fullMoonYear(year)!.moons).map((m) => [m.at, m.supermoon]));
    expect(flagged.size).toBe(rows.length);
    for (const row of rows) expect(flagged.get(row.at), row.at).toBe(supermoon(row) !== null);
    for (const year of fullMoonYears()) {
      const view = fullMoonYear(year)!;
      expect(view.supermoons.map((m) => m.at)).toEqual(view.moons.filter((m) => m.supermoon).map((m) => m.at));
    }
  });

  it('passes each instant to signOf', () => {
    const view = fullMoonYear(2027, (at) => (at.startsWith('2027-01') ? 'leo' : null))!;
    expect(view.moons[0].sign).toBe('leo');
    expect(view.moons[1].sign).toBeNull();
  });

  it('words the rule as the 2027 calendar does', () => {
    expect(SUPERMOON_RULE_TEXT).toBe("a full Moon within 10% of its orbit's perigee to apogee range, measured from the perigee");
    const page = readFileSync(new URL('../pages/full-moon-calendar/2027/index.astro', import.meta.url), 'utf8');
    expect(page).toContain(SUPERMOON_RULE_TEXT);
  });

  it('runs the line through every full Moon of the year and stays inside the scale', () => {
    for (const year of fullMoonYears()) {
      const view = fullMoonYear(year)!;
      const from = Date.UTC(year, 0, 1);
      const to = Date.UTC(year + 1, 0, 1);
      const curve = closenessCurve(from, to);
      expect(curve[0].t).toBe(from);
      expect(curve[curve.length - 1].t).toBe(to);
      expect(curve.slice(1, -1).map((k) => k.v)).toEqual(view.moons.map((m) => m.closeness));
      for (const knot of curve) {
        expect(knot.v).toBeGreaterThanOrEqual(0);
        expect(knot.v).toBeLessThanOrEqual(1);
      }
      // Two halves meet at 1 July with one value and one slope.
      const mid = Date.UTC(year, 6, 1);
      const a = closenessCurve(from, mid).at(-1)!;
      const b = closenessCurve(mid, to)[0];
      expect(a).toEqual(b);
    }
  });
});
