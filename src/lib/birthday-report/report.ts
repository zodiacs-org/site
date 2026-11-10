/**
 * The Birthday report: four readings for one birthday year, on one page.
 *
 * - The solar return: the instant the Sun comes back to its birth degree, the
 *   one that opened this birthday year and the next one.
 * - The Year Ahead Score for the twelve months from that solar return.
 * - Numerology: the Life Path, and the Personal Year of the calendar year the
 *   birthday falls in (the tradition runs Personal Years January to December).
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
import { tarotYearCard, type TarotCard } from '../tarot/year-card';

const DAY = 86_400_000;

export interface BirthdayReport {
  sun: { slug: string; name: string; hue: string };
  /** The solar return that opened this birthday year, and the next one (UTC instants). */
  solarReturn: string;
  nextSolarReturn: string;
  year: YearScore;
  lifePath: number;
  personalYear: number;
  /** The calendar year the Personal Year and the tarot card are for: the year this birthday year began. */
  calendarYear: number;
  card: TarotCard;
}

/** The report for a birth (its instant and its civil date) as of `now`. */
export function birthdayReport(birthUtc: Date, birthDate: string, timeKnown: boolean, now: Date): BirthdayReport {
  const natalSun = computeChart({ utc: birthUtc, houseSystem: 'whole', timeKnown }).bodies.find((row) => row.body === 'Sun')!.lon;
  const opened = mostRecentSolarReturnInstant(natalSun, now);
  const next = solarReturnInstant(natalSun, new Date(opened.getTime() + 365.25 * DAY));
  const { year, sunLon } = scoreBirth(birthUtc, timeKnown, opened);
  const sign = signForLongitude(sunLon);
  const calendarYear = opened.getUTCFullYear();
  const [, month, day] = birthDate.split('-').map(Number);
  return {
    sun: { slug: sign.slug, name: sign.name, hue: sign.hue },
    solarReturn: opened.toISOString(),
    nextSolarReturn: next.toISOString(),
    year,
    lifePath: dateNumbers(birthDate).lifePath.value,
    // The Personal Year depends only on the calendar year, so 1 January stands in (a 29 February birthday has no date in most years).
    personalYear: personalCycles(birthDate, `${calendarYear}-01-01`).year,
    calendarYear,
    card: tarotYearCard(month, day, calendarYear),
  };
}
