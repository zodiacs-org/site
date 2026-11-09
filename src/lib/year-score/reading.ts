/**
 * The Year Ahead Score in words: the tier, the best and hardest months and a
 * sentence for each transit driving the number. Engine-free: it phrases a
 * YearScore that core.ts already computed.
 *
 * Copy rules (Dias, 9 November 2026): plain and calm. Money, career,
 * wellbeing and legal themes are read as the tradition reads them (a strong
 * year for earnings, a year to take rest seriously, a good window to sign
 * agreements). Never a price, stock or other trading call, a buy or sell
 * signal, a diagnosis or medical timing, a death prediction or a legal win or
 * loss. A hard year reads as pressure and the work it asks for, never doom.
 * No em or en dashes. The transit sentences are the site's own (../transits.ts).
 */
import { BODY_ROLE } from '../compat';
import { transitLine } from '../transits';
import type { Driver, MonthScore, ScoreAspect, ScorePoint, SlowPlanet, YearScore } from './core';

export interface ScoreTier {
  key: 'open' | 'supportive' | 'balanced' | 'pressure' | 'heavy-pressure';
  label: string;
  summary: string;
}

/** The tier for a 0 to 10 score. */
export function scoreTier(score: number): ScoreTier {
  if (score >= 8) return { key: 'open', label: 'A wide open year', summary: 'The slow planets mostly help. Tradition reads a year like this as strong for career growth and earnings, and a good window to start things and sign agreements.' };
  if (score >= 6.5) return { key: 'supportive', label: 'A supportive year', summary: 'More of the slow-planet weather helps than presses. A good year to build on what already works, at work and with money alike.' };
  if (score >= 4.5) return { key: 'balanced', label: 'A balanced year', summary: 'Support and pressure arrive in about equal measure. The months below show when each one leads.' };
  if (score >= 3) return { key: 'pressure', label: 'A year of steady pressure', summary: 'The slow planets ask more than they give. Astrology reads this as a year for patience and follow through: steady work, careful spending and taking rest seriously.' };
  return { key: 'heavy-pressure', label: 'A year of heavy pressure', summary: 'The slow planets press hard on the chart. Tradition reads this as a demanding year: keep commitments clear, look after your energy and let patient work do the building.' };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10" as "October 2026". */
export function monthName(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return `${MONTHS[index - 1]} ${year}`;
}
/** "2026-10" as "Oct". */
export function shortMonth(month: string): string {
  return SHORT_MONTHS[Number(month.slice(5, 7)) - 1];
}
/** "2026-10-16" as "16 Oct 2026". */
export function dayName(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return `${date} ${SHORT_MONTHS[month - 1]} ${year}`;
}

const ASPECT_WORD: Record<ScoreAspect, string> = { conjunction: 'conjunct', sextile: 'sextile', square: 'square', trine: 'trine', opposition: 'opposite' };

/** "Saturn square your Venus". */
export function driverTitle(driver: Pick<Driver, 'planet' | 'aspect' | 'point'>): string {
  return `${driver.planet} ${ASPECT_WORD[driver.aspect]} your ${driver.point}`;
}

/** The site's transit sentence for a driver. */
export function driverLine(driver: Pick<Driver, 'planet' | 'aspect' | 'point'>): string {
  return transitLine(driver.planet, driver.aspect, driver.point);
}

const role = (point: ScorePoint) => BODY_ROLE[point] ?? point;

/** One sentence for the best or the hardest month. */
export function monthLine(month: MonthScore, which: 'best' | 'hardest'): string {
  const name = monthName(month.month);
  if (!month.lead) return which === 'best' ? `${name} is the lightest month, with no slow planet close to the chart.` : `${name} is the quietest month; no slow planet presses hard.`;
  const lead = `${month.lead.planet} ${ASPECT_WORD[month.lead.aspect]} your ${month.lead.point}`;
  if (which === 'best') {
    return month.lead.tone === 'support'
      ? `${name} is the strongest month: ${lead} backs your ${role(month.lead.point)}.`
      : `${name} is the strongest month, with the least pressure of the year; ${lead} still asks something of your ${role(month.lead.point)}.`;
  }
  return month.lead.tone === 'pressure'
    ? `${name} carries the most pressure: ${lead} leans on your ${role(month.lead.point)}. A month to pace yourself, not to fear.`
    : `${name} is the softest month of the year, though ${lead} still helps.`;
}

export interface YearReading {
  score: number;
  tier: ScoreTier;
  best: { month: string; name: string; score: number; line: string } | null;
  hardest: { month: string; name: string; score: number; line: string } | null;
  drivers: {
    planet: SlowPlanet;
    aspect: ScoreAspect;
    point: ScorePoint;
    tone: 'support' | 'pressure';
    share: number;
    title: string;
    line: string;
    inOrbFrom: string;
    inOrbTo: string;
    peak: string;
  }[];
  months: { month: string; name: string; score: number }[];
}

/** The words for a computed year. `guard` softens a line, e.g. for a reading for someone under 18. */
export function yearReading(year: YearScore, guard: (text: string) => string = (text) => text): YearReading {
  const month = (entry: MonthScore | null, which: 'best' | 'hardest') => (entry ? { month: entry.month, name: monthName(entry.month), score: entry.score, line: guard(monthLine(entry, which)) } : null);
  // The best and hardest months are the same only when every month scores alike; then name just one.
  const same = year.best && year.hardest && year.best.month === year.hardest.month;
  return {
    score: year.score,
    tier: scoreTier(year.score),
    best: month(year.best, 'best'),
    hardest: same ? null : month(year.hardest, 'hardest'),
    drivers: year.drivers.map((driver) => ({
      planet: driver.planet,
      aspect: driver.aspect,
      point: driver.point,
      tone: driver.tone,
      share: driver.share,
      title: driverTitle(driver),
      line: guard(driverLine(driver)),
      inOrbFrom: driver.inOrbFrom,
      inOrbTo: driver.inOrbTo,
      peak: driver.peak,
    })),
    months: year.months.map((entry) => ({ month: entry.month, name: monthName(entry.month), score: entry.score })),
  };
}
