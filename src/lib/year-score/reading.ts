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

export { scoreTier, type ScoreTier } from './tier';
import { scoreTier, type ScoreTier } from './tier';

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

/**
 * The word a reading gives a contact. Jupiter's square and opposition count
 * mildly for the year (their VALENCE stays positive, so the number is
 * unchanged), but the tradition reads them as growth that overreaches, so
 * they read as mixed rather than as support or pressure.
 */
export type DriverTone = 'support' | 'pressure' | 'mixed';
export function driverTone(contact: Pick<Driver, 'planet' | 'aspect' | 'tone'>): DriverTone {
  return contact.planet === 'Jupiter' && (contact.aspect === 'square' || contact.aspect === 'opposition') ? 'mixed' : contact.tone;
}

/** The site's transit sentence for a driver; a mixed contact gets its own. */
export function driverLine(driver: Pick<Driver, 'planet' | 'aspect' | 'point' | 'tone'>): string {
  if (driverTone(driver) === 'mixed') return `${driverTitle(driver)}: growth that asks for restraint.`;
  return transitLine(driver.planet, driver.aspect, driver.point);
}

const role = (point: ScorePoint) => BODY_ROLE[point] ?? point;

export interface MonthLineContext {
  /** Another listed month comes as close (core.ts TIE_MARGIN), so the month is one of several. */
  tied?: boolean;
  /** The month's pressure is the lowest of every listed month. */
  leastPressure?: boolean;
}

/** One sentence for the best or the hardest month. */
export function monthLine(month: MonthScore, which: 'best' | 'hardest', { tied = false, leastPressure = false }: MonthLineContext = {}): string {
  const name = monthName(month.month);
  if (!month.lead) {
    if (which === 'best') return `${name} is ${tied ? 'one of the lightest months' : 'the lightest month'}, with no slow planet close to the chart.`;
    return tied ? `${name} is one of the quietest months; no slow planet presses hard.` : `${name} is the quietest month; no slow planet presses hard.`;
  }
  const lead = `${month.lead.planet} ${ASPECT_WORD[month.lead.aspect]} your ${month.lead.point}`;
  const tone = driverTone(month.lead);
  if (which === 'best') {
    if (tied) {
      return tone === 'support'
        ? `${name} is one of the lightest months: ${lead} backs your ${role(month.lead.point)}.`
        : `${name} is one of the lightest months; ${lead} still asks something of your ${role(month.lead.point)}.`;
    }
    return tone === 'support'
      ? `${name} is the strongest month: ${lead} backs your ${role(month.lead.point)}.`
      : `${name} is the strongest month, ${leastPressure ? 'with the least pressure of the year' : 'with the most support of the year'}; ${lead} still asks something of your ${role(month.lead.point)}.`;
  }
  if (tied) {
    return tone === 'pressure'
      ? `${name} is one of the hardest months: ${lead} leans on your ${role(month.lead.point)}. A month to pace yourself, not to fear.`
      : `${name} is one of the hardest months; ${lead} still helps.`;
  }
  return tone === 'pressure'
    ? `${name} carries the most pressure: ${lead} leans on your ${role(month.lead.point)}. A month to pace yourself, not to fear.`
    : `${name} has the least support of the year; ${lead} still helps.`;
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
    tone: DriverTone;
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
  const leastPressure = (entry: MonthScore) => year.months.every((other) => entry.pressure <= other.pressure);
  const month = (entry: MonthScore | null, which: 'best' | 'hardest') => (entry
    ? { month: entry.month, name: monthName(entry.month), score: entry.score, line: guard(monthLine(entry, which, { tied: year.ties[which], leastPressure: leastPressure(entry) })) }
    : null);
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
      tone: driverTone(driver),
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
