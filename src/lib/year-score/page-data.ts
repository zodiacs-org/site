/**
 * Build-time data for the Year Ahead pages of directory figures
 * (src/pages/year/): each figure's noon chart on the birthplace clock, scored
 * for the twelve months from the first day of the build month. Runs only in
 * the Astro build, never in the browser.
 */
import { prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';
import { signForLongitude } from '../signs';
import { scoreBirth } from './browser';
import { YEAR_PEOPLE, yearPageStart, type YearPerson } from './people';
import { yearReading, type YearReading } from './reading';

export interface YearPage {
  person: YearPerson;
  reading: YearReading;
  from: string;
  to: string;
  sun: { name: string; slug: string; hue: string };
  alternates: { birthDate: string; score: number; label: string }[];
}

async function birthUtc(date: string, time: string | null, zone: string): Promise<Date> {
  await prepareLocalTime(date, zone);
  return resolveLocalToUtc(date, time ?? '12:00', zone).utc;
}

export async function yearPage(person: YearPerson, now = new Date()): Promise<YearPage> {
  const start = new Date(`${yearPageStart(now)}T00:00:00Z`);
  const { year, sunLon } = scoreBirth(await birthUtc(person.birthDate, person.birthTime, person.zone), person.birthTime !== null, start);
  const alternates = [];
  for (const alternate of person.alternateBirthDates) {
    const alt = scoreBirth(await birthUtc(alternate.date, null, person.zone), false, start).year;
    alternates.push({ birthDate: alternate.date, score: alt.score, label: yearReading(alt).tier.label });
  }
  const sign = signForLongitude(sunLon);
  return { person, reading: yearReading(year), from: year.from, to: year.to, sun: { name: sign.name, slug: sign.slug, hue: sign.hue }, alternates };
}

export async function allYearPages(now = new Date()): Promise<YearPage[]> {
  const pages: YearPage[] = [];
  for (const person of YEAR_PEOPLE) pages.push(await yearPage(person, now));
  return pages;
}
