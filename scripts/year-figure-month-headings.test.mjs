import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scoreYear } from '../src/lib/year-score/core';

// A public figure's Year Ahead page (ZOD-12) titles its two month tiles. The picks are made on each month's
// balance (support minus pressure), not on the most support or the most pressure, so the titles name the score.
describe("a public figure's month tiles", () => {
  const natal = { Sun: 10, Moon: null, Mercury: 200, Venus: 240, Mars: 300 };
  const byMonth = (months, rest) => (body, date) => (months[date.getUTCMonth()] ?? rest)[body] ?? 45;

  it('pick the highest- and lowest-scoring months, and say so', () => {
    const year = scoreYear(natal, byMonth({ 2: { Jupiter: 12 }, 6: { Saturn: 100 } }, { Jupiter: 10 }), new Date('2026-01-01T00:00:00Z'));
    expect(year.months.every((other) => year.best.score >= other.score)).toBe(true);
    expect(year.months.every((other) => year.hardest.score <= other.score)).toBe(true);
    const page = readFileSync(new URL('../src/pages/year/[slug].astro', import.meta.url), 'utf8');
    expect(page).toContain('<h2>Highest-scoring month</h2>');
    expect(page).toContain('<h2>Lowest-scoring month</h2>');
    expect(page).not.toMatch(/Most supported month|Most pressed month/u);
  });
});
