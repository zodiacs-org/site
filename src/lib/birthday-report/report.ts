/**
 * The Birthday report: four readings for one birthday year, on one page.
 *
 * - The solar return: the instant the Sun comes back to its birth degree, the
 *   one that opens the chosen birthday year (the current one, or the next one
 *   for a birthday that is close) and the one after it.
 * - The Year Ahead Score for the twelve months from that solar return.
 * - Numerology: the Life Path, and the Personal Year of the calendar year the
 *   birthday falls in (the tradition runs Personal Years January to December).
 *   That is the year of the civil birthday nearest the return, not the UTC
 *   year of the return instant, which can fall on the day before or after.
 * - One tarot card: the year card for the birthday's month and day in that
 *   year (../tarot/year-card.ts).
 *
 * Only ever lazy-loaded beside the engine; everything is calculated on the
 * device. Nothing is sent, stored or put in a link.
 */
import { computeChart } from '../engine/full';
import { mostRecentSolarReturnInstant, solarReturnInstant } from '../engine/solar-return';
import { dateNumbers, personalCycles } from '../numerology';
import { scoreBirth } from '../year-score/browser';
import type { YearScore } from '../year-score/core';
import { signForLongitude } from '../signs';
import { cardTitle, tarotYearCard, type TarotCard } from '../tarot/year-card';

const DAY = 86_400_000;

export interface BirthdayReport {
  /** The report's main heading: the Personal Year and its year, and the Sun sign. Never the tarot card. */
  heading: string;
  sun: { slug: string; name: string; hue: string };
  /** The solar return that opens the chosen birthday year, and the one after it (UTC instants). */
  solarReturn: string;
  nextSolarReturn: string;
  year: YearScore;
  lifePath: number;
  personalYear: number;
  /** The calendar year the Personal Year and the tarot card are for: the year of the birthday that opens this birthday year. */
  calendarYear: number;
  card: TarotCard;
  /** The card's name with its keyword ("Death: change"); the card never stands as a bare name. */
  cardTitle: string;
}

/** Which birthday year a report reads: the one in progress, or the one the next solar return opens. */
export type BirthdayYear = 'current' | 'next';

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * The calendar year of the civil birthday a solar return belongs to: of the
 * birthdays in the return's UTC year and the years either side, the one whose
 * noon (UTC) is nearest the return. A 1 January birthday whose return falls
 * on 31 December UTC gets the new year, and a 31 December one whose return
 * falls on 1 January UTC the old one. 28 February stands in for 29 February
 * in a year without it.
 */
export function birthdayCalendarYear(opened: Date, month: number, day: number): number {
  const y = opened.getUTCFullYear();
  let best = y;
  let gap = Infinity;
  for (const year of [y - 1, y, y + 1]) {
    const date = month === 2 && day === 29 && !isLeap(year) ? 28 : day;
    const distance = Math.abs(Date.UTC(year, month - 1, date, 12) - opened.getTime());
    if (distance < gap) { best = year; gap = distance; }
  }
  return best;
}

/**
 * The report for a birth (its instant and its civil date) as of `now`. `which`
 * picks the birthday year: 'current' opens it at the latest solar return,
 * 'next' at the one after that.
 */
export function birthdayReport(birthUtc: Date, birthDate: string, timeKnown: boolean, now: Date, which: BirthdayYear = 'current'): BirthdayReport {
  const natalSun = computeChart({ utc: birthUtc, houseSystem: 'whole', timeKnown }).bodies.find((row) => row.body === 'Sun')!.lon;
  const latest = mostRecentSolarReturnInstant(natalSun, now);
  const following = (from: Date) => solarReturnInstant(natalSun, new Date(from.getTime() + 365.25 * DAY));
  const opened = which === 'next' ? following(latest) : latest;
  const next = following(opened);
  const { year, sunLon } = scoreBirth(birthUtc, timeKnown, opened);
  const sign = signForLongitude(sunLon);
  const [, month, day] = birthDate.split('-').map(Number);
  const calendarYear = birthdayCalendarYear(opened, month, day);
  const card = tarotYearCard(month, day, calendarYear);
  // The Personal Year depends only on the calendar year, so 1 January stands in (a 29 February birthday has no date in most years).
  const personalYear = personalCycles(birthDate, `${calendarYear}-01-01`).year;
  return {
    heading: `Your birthday year: Personal Year ${personalYear} (${calendarYear}), ${sign.name} Sun`,
    sun: { slug: sign.slug, name: sign.name, hue: sign.hue },
    solarReturn: opened.toISOString(),
    nextSolarReturn: next.toISOString(),
    year,
    lifePath: dateNumbers(birthDate).lifePath.value,
    personalYear,
    calendarYear,
    card,
    cardTitle: cardTitle(card),
  };
}
