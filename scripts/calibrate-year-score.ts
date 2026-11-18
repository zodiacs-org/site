/**
 * Reproduces the curve constants in src/lib/year-score/core.ts from fixed
 * populations, never from a named person: 4,000 birth dates drawn with a
 * seeded generator from 1940 to 2008, scored for twelve start dates,
 * 1 January 2020 to 2031, twice:
 *
 * - untimed: each date at noon UTC with the Moon left out, as for an unknown
 *   birth time (SCORE_CENTER, YEAR_SCORE_SCALE, MONTH_SCORE_SCALE);
 * - timed: the same dates, each at a random time of day, with the Moon
 *   (SCORE_CENTER_TIMED, YEAR_SCORE_SCALE_TIMED, MONTH_SCORE_SCALE_TIMED).
 *
 * For each population the center is the year balance's mean; each scale is
 * twice the standard deviation of the raw balance (support minus pressure),
 * so about 19 years in 20 land between 1.2 and 8.8. It also prints the share
 * of year scores in each tier, for the tier cut points before and after
 * ZOD-15, each population scored on its own center and scale.
 *
 *   npx vite-node --script scripts/calibrate-year-score.ts
 */
import { bodyLongitude, computeBodies } from '../src/lib/engine/full';
import {
  MONTH_SCORE_SCALE,
  MONTH_SCORE_SCALE_TIMED,
  SCORE_CENTER,
  SCORE_CENTER_TIMED,
  YEAR_SCORE_SCALE,
  YEAR_SCORE_SCALE_TIMED,
  curve,
  scoreYear,
  type LongitudeAt,
  type NatalPoints,
} from '../src/lib/year-score/core';

const PEOPLE = 4000;
const DAY = 86_400_000;
let seed = 20261109;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const lo = Date.UTC(1940, 0, 1);
const hi = Date.UTC(2008, 11, 31);
// Every date is drawn first, so the untimed sample is the one the constants were first fitted on;
// the times of day come after, from the same generator.
const days = Array.from({ length: PEOPLE }, () => Math.floor(lo / DAY + random() * ((hi - lo) / DAY)));
const times = days.map((day) => day * DAY + Math.floor(random() * DAY));
const natalAt = (ms: number, withMoon: boolean): NatalPoints => {
  const bodies = computeBodies(new Date(ms));
  const lon = (body: string) => bodies.find((row) => row.body === body)!.lon;
  return { Sun: lon('Sun'), Moon: withMoon ? lon('Moon') : null, Mercury: lon('Mercury'), Venus: lon('Venus'), Mars: lon('Mars') };
};
const populations = {
  untimed: days.map((day) => natalAt(day * DAY + DAY / 2, false)),
  timed: times.map((ms) => natalAt(ms, true)),
};

const years: Record<keyof typeof populations, number[]> = { untimed: [], timed: [] };
const months: Record<keyof typeof populations, number[]> = { untimed: [], timed: [] };
for (let year = 2020; year <= 2031; year++) {
  const start = new Date(Date.UTC(year, 0, 1));
  // The slow planets depend only on the date: compute each day once for both populations.
  const cache = new Map<string, number>();
  const cached: LongitudeAt = (body, date) => {
    const key = `${body}|${date.getTime()}`;
    let value = cache.get(key);
    if (value === undefined) { value = bodyLongitude(body, date); cache.set(key, value); }
    return value;
  };
  for (const name of ['untimed', 'timed'] as const) {
    for (const natal of populations[name]) {
      const result = scoreYear(natal, cached, start);
      years[name].push(result.support - result.pressure);
      for (const month of result.months) if (month.days >= 10) months[name].push(month.support - month.pressure);
    }
  }
}

const stats = (values: number[]) => { const mean = values.reduce((a, b) => a + b, 0) / values.length; return { mean, sd: Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) }; };
const round2 = (value: number) => Math.round(value * 100) / 100;
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Lower bounds of pressure, balanced, supportive and open; below the first is heavy pressure. */
const CUTS = { before: [3, 4.5, 6.5, 8], after: [2, 3.5, 6.5, 8] } as const;
const TIERS = ['heavy-pressure', 'pressure', 'balanced', 'supportive', 'open'] as const;
const tierShares = (scores: number[], cuts: readonly number[]) => {
  const counts = TIERS.map(() => 0);
  for (const score of scores) counts[cuts.filter((cut) => score >= cut).length]++;
  return Object.fromEntries(TIERS.map((tier, index) => [tier, round3(counts[index] / scores.length)]));
};
const shareWithin = (scores: number[], low: number, high: number) => round3(scores.filter((score) => score >= low && score <= high).length / scores.length);

const inCore = {
  untimed: { center: SCORE_CENTER, year: YEAR_SCORE_SCALE, month: MONTH_SCORE_SCALE },
  timed: { center: SCORE_CENTER_TIMED, year: YEAR_SCORE_SCALE_TIMED, month: MONTH_SCORE_SCALE_TIMED },
};
const report = (name: keyof typeof populations) => {
  const y = stats(years[name]);
  const m = stats(months[name]);
  const center = round2(y.mean);
  const yearScale = round2(2 * y.sd);
  const scores = years[name].map((balance) => curve(balance, yearScale, center));
  return {
    people: PEOPLE,
    yearSamples: years[name].length,
    center: { value: center, inCore: inCore[name].center },
    monthSamples: months[name].length,
    year: { mean: y.mean, sd: y.sd, scale: yearScale, inCore: inCore[name].year },
    month: { mean: m.mean, sd: m.sd, scale: round2(2 * m.sd), inCore: inCore[name].month },
    yearScoresWithin: { '1.2 to 8.8': shareWithin(scores, 1.2, 8.8), '1 to 9': shareWithin(scores, 1, 9) },
    tierShares: { before: tierShares(scores, CUTS.before), after: tierShares(scores, CUTS.after) },
  };
};
console.log(JSON.stringify({ cuts: CUTS, untimed: report('untimed'), timed: report('timed') }, null, 2));
