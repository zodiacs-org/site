/**
 * Reproduces YEAR_SCORE_SCALE and MONTH_SCORE_SCALE in src/lib/year-score/core.ts
 * from a fixed population, never from a named person: 4,000 birth dates drawn
 * with a seeded generator from 1940 to 2008 (noon UTC, Moon left out as for an
 * unknown birth time), scored for twelve start dates, 1 January 2020 to 2031.
 * The center is the year balance's mean; each scale is twice the standard deviation of the raw balance (support minus
 * pressure), so about 19 years in 20 land between 1.2 and 8.8.
 *
 *   npx vite-node --script scripts/calibrate-year-score.ts
 */
import { bodyLongitude, computeBodies } from '../src/lib/engine/full';
import { MONTH_SCORE_SCALE, SCORE_CENTER, YEAR_SCORE_SCALE, scoreYear, type LongitudeAt } from '../src/lib/year-score/core';

const PEOPLE = 4000;
const DAY = 86_400_000;
let seed = 20261109;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const lo = Date.UTC(1940, 0, 1);
const hi = Date.UTC(2008, 11, 31);
const natals = Array.from({ length: PEOPLE }, () => {
  const day = Math.floor(lo / DAY + random() * ((hi - lo) / DAY));
  const bodies = computeBodies(new Date(day * DAY + DAY / 2));
  const lon = (body: string) => bodies.find((row) => row.body === body)!.lon;
  return { Sun: lon('Sun'), Moon: null, Mercury: lon('Mercury'), Venus: lon('Venus'), Mars: lon('Mars') };
});

const years: number[] = [];
const months: number[] = [];
for (let year = 2020; year <= 2031; year++) {
  const start = new Date(Date.UTC(year, 0, 1));
  // The slow planets depend only on the date: compute each day once for the whole population.
  const cache = new Map<string, number>();
  const cached: LongitudeAt = (body, date) => {
    const key = `${body}|${date.getTime()}`;
    let value = cache.get(key);
    if (value === undefined) { value = bodyLongitude(body, date); cache.set(key, value); }
    return value;
  };
  for (const natal of natals) {
    const result = scoreYear(natal, cached, start);
    years.push(result.support - result.pressure);
    for (const month of result.months) if (month.days >= 10) months.push(month.support - month.pressure);
  }
}
const sd = (values: number[]) => { const mean = values.reduce((a, b) => a + b, 0) / values.length; return { mean, sd: Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) }; };
const y = sd(years);
const m = sd(months);
const round2 = (value: number) => Math.round(value * 100) / 100;
console.log(JSON.stringify({ people: PEOPLE, yearSamples: years.length, center: { value: round2(y.mean), inCore: SCORE_CENTER }, monthSamples: months.length, year: { mean: y.mean, sd: y.sd, scale: round2(2 * y.sd), inCore: YEAR_SCORE_SCALE }, month: { mean: m.mean, sd: m.sd, scale: round2(2 * m.sd), inCore: MONTH_SCORE_SCALE } }, null, 2));
