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
 * Without a birth time the report is cast from 12:00 UTC on the birth date,
 * with or without a birthplace, as /solar-return/ and get_solar_return are, so
 * the three give the same return; its Sun sign is named only when the birth
 * day starts and ends in the same sign (../sun-settled.ts).
 *
 * Only ever lazy-loaded beside the engine; everything is calculated on the
 * device. Nothing is sent, stored or put in a link.
 */
import { computeChart } from '../engine/full';
import { mostRecentSolarReturnInstant, solarReturnInstant } from '../engine/solar-return';
import { dateNumbers, personalCycles } from '../numerology';
import { scoreBirth } from '../year-score/browser';
import type { YearScore } from '../year-score/core';
import { SIGNS, signForLongitude } from '../signs';
import { birthDayEnvelope, settledSunSign } from '../sun-settled';
import { tarotYearCard, type TarotCard } from '../tarot/year-card';

const DAY = 86_400_000;

export interface BirthdayReport {
  /** The Sun sign, or null when an untimed birth day starts and ends in different signs; then `sunCandidates` names both. */
  sun: { slug: string; name: string; hue: string } | null;
  sunCandidates: { slug: string; name: string }[];
  /** The tint for the page: the sign of the Sun the report was cast from. */
  hue: string;
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

/** A birth as the form takes it. A birthplace is used only with a birth time; its zone and longitude come from the place search. */
export interface ReportBirth {
  date: string;
  time: string | null;
  place: { tz: string; lon: number } | null;
}

/** The engine's wall-clock resolver (src/lib/time/localToUtc.ts); the caller has awaited prepareLocalTime(date, place.tz). */
export interface ReportClock {
  resolveLocalToUtc(date: string, time: string, timeZone: string, options: { longitude: number }): { utc: Date };
}

/**
 * The instant the report is cast from and the two instants that settle its Sun sign.
 * With a birth time and place: that instant, which settles the sign itself. Without a
 * time: 12:00 UTC on the birth date whatever the place, and the sign is settled across
 * the birthplace clock's 00:00 to 23:59, or every clock's version of the date without one.
 */
export function reportInstants(birth: ReportBirth, clock: ReportClock): { birthUtc: Date; timeKnown: boolean; sunEnds: [Date, Date] } {
  const { date, time, place } = birth;
  if (place && time) {
    const birthUtc = clock.resolveLocalToUtc(date, time, place.tz, { longitude: place.lon }).utc;
    return { birthUtc, timeKnown: true, sunEnds: [birthUtc, birthUtc] };
  }
  const local = (at: string) => clock.resolveLocalToUtc(date, at, place!.tz, { longitude: place!.lon }).utc;
  return { birthUtc: new Date(`${date}T12:00:00Z`), timeKnown: false, sunEnds: place ? [local('00:00'), local('23:59')] : birthDayEnvelope(date) };
}

const sunLonAt = (utc: Date) => computeChart({ utc, houseSystem: 'whole', timeKnown: false }).bodies.find((row) => row.body === 'Sun')!.lon;

/**
 * The report for a birth (its instant and its civil date) as of `now`. `sunEnds` settles
 * the Sun sign (reportInstants); without it, the birth instant when timed, else every
 * clock's version of the date.
 */
export function birthdayReport(birthUtc: Date, birthDate: string, timeKnown: boolean, now: Date, sunEnds?: readonly [Date, Date]): BirthdayReport {
  const natalSun = computeChart({ utc: birthUtc, houseSystem: 'whole', timeKnown }).bodies.find((row) => row.body === 'Sun')!.lon;
  const opened = mostRecentSolarReturnInstant(natalSun, now);
  const next = solarReturnInstant(natalSun, new Date(opened.getTime() + 365.25 * DAY));
  const { year, sunLon } = scoreBirth(birthUtc, timeKnown, opened);
  const settled = settledSunSign(sunEnds ?? (timeKnown ? [birthUtc, birthUtc] : birthDayEnvelope(birthDate)), sunLonAt);
  const calendarYear = opened.getUTCFullYear();
  const [, month, day] = birthDate.split('-').map(Number);
  return {
    sun: settled.sign === null ? null : { slug: SIGNS[settled.sign].slug, name: SIGNS[settled.sign].name, hue: SIGNS[settled.sign].hue },
    sunCandidates: settled.candidates.map((index) => ({ slug: SIGNS[index].slug, name: SIGNS[index].name })),
    hue: signForLongitude(sunLon).hue,
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
