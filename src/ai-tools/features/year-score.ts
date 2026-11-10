/**
 * get_year_score: the Year Ahead Score for one birth chart, a number from 0 to
 * 10 for the twelve months from a start date, with the best and hardest
 * months and the slow-planet transits that move the number
 * (src/lib/year-score/core.ts), each driver dated with its exact passes from
 * the site's transit scanner (src/lib/engine/transit-scan.ts).
 *
 * Two ways in: the person's own birth details, used for this one answer and
 * never stored, logged or put in a link; or a public figure from the Year
 * Ahead directory (src/data/year-people.json) by name.
 *
 * The words read money, career, wellbeing and legal themes as the tradition
 * does, never as a price or trading call, a diagnosis, a death prediction or a
 * legal outcome (src/lib/year-score/reading.ts). Pure: no network, storage or
 * logging.
 */
import { z } from 'zod';
import type { LocalTimeModule } from '../../lib/compute-api/local-time';
import { bodyLongitude, computeChart } from '../../lib/engine/full.js';
import { scanTransitContacts } from '../../lib/engine/transit-scan';
import { SIGNS, signIndexForLongitude } from '../../lib/signs';
import { parseCivilDate, parseCivilTime } from '../../lib/time/civil-date';
import { scoreYear, type NatalPoints, type SlowPlanet, type YearScore } from '../../lib/year-score/core';
import { YEAR_PEOPLE, findYearPerson, type YearPerson } from '../../lib/year-score/people';
import { dayName, yearReading } from '../../lib/year-score/reading';
import { readingConfidence, readingConfidenceLabel, readingDetail } from '../reading-confidence';
import { roundCoordinate } from '../plain-text';
import { MINOR_NOTE, isUnder18, softenMinor } from './reading-guards';

const DAY = 86_400_000;
const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
const DATE = /^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/;
/** The earliest and latest start dates the tool takes. */
export const YEAR_SCORE_START_MIN = '2000-01-01';
export const YEAR_SCORE_START_MAX = '2099-12-31';

const zone = z.string().min(1).max(64).regex(ZONE_PATTERN);
export const yearScoreInput = z.strictObject({
  person: z.string().min(2).max(80).optional().describe('A public figure from the Zodiacs Year Ahead directory, by full name, such as Jensen Huang. Use instead of birth details. A name the directory does not have is answered plainly, with no score.'),
  birthDate: z.string().regex(DATE).optional().describe('The person’s own birth date, such as 1990-05-03. Used for this answer only; never stored, logged or put in a link.'),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional().describe('The birth time on the local clock, only if known. Never guess it. Needs zone. Without it the Moon is left out.'),
  zone: zone.optional().describe("The birthplace's time zone, such as Europe/Madrid. Needed with a time."),
  latitude: z.number().min(-90).max(90).optional().describe("Optional. The birthplace's latitude, with longitude. Nothing is stored."),
  longitude: z.number().min(-180).max(180).optional().describe("Optional. The birthplace's longitude, with latitude, for birth times before standard time. Nothing is stored."),
  from: z.string().regex(DATE).optional().describe('The first day of the twelve months, such as 2026-07-17. Defaults to today (UTC).'),
}).superRefine((args, context) => {
  if ((args.person === undefined) === (args.birthDate === undefined)) context.addIssue({ code: 'custom', message: 'Give either person or birthDate, not both.' });
  if (args.person !== undefined && (args.time !== undefined || args.zone !== undefined || args.latitude !== undefined || args.longitude !== undefined)) context.addIssue({ code: 'custom', message: 'With person, leave out the birth details.' });
  if ((args.latitude === undefined) !== (args.longitude === undefined)) context.addIssue({ code: 'custom', message: 'Give latitude and longitude together.' });
  if ((args.time !== undefined || args.latitude !== undefined) && !args.zone) context.addIssue({ code: 'custom', message: 'A birth time or a place needs its time zone.' });
});
export type YearScoreInput = z.infer<typeof yearScoreInput>;

const planet = z.enum(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
const point = z.enum(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars']);
const aspect = z.enum(['conjunction', 'sextile', 'square', 'trine', 'opposition']);
const monthPick = z.object({ month: z.string(), name: z.string(), score: z.number().min(0).max(10), line: z.string() }).nullable();
export const yearScoreData = z.object({
  /** found: a score. not-in-directory: the name is not in the directory, and no score is given. */
  status: z.enum(['found', 'not-in-directory']),
  subject: z.object({
    kind: z.enum(['self', 'person']),
    /** The figure's name and description; null for a person's own details. */
    name: z.string().nullable(),
    description: z.string().nullable(),
    /** The natal Sun sign. Null when an untimed birth day straddles a sign change. */
    sun: z.string().nullable(),
    timeKnown: z.boolean(),
  }).nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  /** 0 to 10, one decimal. 5 is an ordinary year. */
  score: z.number().min(0).max(10).nullable(),
  label: z.string().nullable(),
  summary: z.string().nullable(),
  best: monthPick,
  hardest: monthPick,
  drivers: z.array(z.object({
    planet, aspect, point,
    tone: z.enum(['support', 'pressure']),
    /** Share of everything that moved the year, 0 to 1. */
    share: z.number().min(0).max(1),
    title: z.string(),
    line: z.string(),
    inOrb: z.string(),
    /** Exact passes inside the twelve months, as dates (UTC). */
    exact: z.array(z.string()),
  })).max(6),
  months: z.array(z.object({ month: z.string(), score: z.number().min(0).max(10) })),
  /** For a figure whose sources disagree on the birth date: the score with the other date. */
  alternates: z.array(z.object({ birthDate: z.string(), score: z.number().min(0).max(10), label: z.string() })),
  confidence: z.number().int().min(40).max(95).nullable(),
  confidenceLabel: z.string().nullable(),
  /** The figure's birth-date sources, for a directory person. */
  sources: z.array(z.object({ title: z.string(), url: z.url() })),
  limits: z.array(z.string()),
  under18: z.boolean(),
  pageUrl: z.url(),
});
export type YearScoreData = z.infer<typeof yearScoreData>;

export type YearScoreClock = Pick<LocalTimeModule, 'prepareLocalTime' | 'resolveLocalToUtc'>;

/** The natal longitudes the score reads, from a chart computed at `utc`. */
export function natalPointsAt(utc: Date, timeKnown: boolean): { natal: NatalPoints; sunLon: number } {
  const chart = computeChart({ utc, houseSystem: 'whole', timeKnown });
  const lon = (body: string) => chart.bodies.find((row) => row.body === body)!.lon;
  return { natal: { Sun: lon('Sun'), Moon: timeKnown ? lon('Moon') : null, Mercury: lon('Mercury'), Venus: lon('Venus'), Mars: lon('Mars') }, sunLon: lon('Sun') };
}

/** The instant of a birth: the given clock time, or noon, on the birthplace clock; noon UTC without a zone. */
export async function birthInstant(birthDate: string, time: string | null, timeZone: string | null, clock: YearScoreClock, longitude?: number): Promise<Date> {
  if (!timeZone) return new Date(`${birthDate}T12:00:00Z`);
  await clock.prepareLocalTime(birthDate, timeZone);
  const local = time ?? '12:00';
  return (longitude !== undefined ? clock.resolveLocalToUtc(birthDate, local, timeZone, { longitude }) : clock.resolveLocalToUtc(birthDate, local, timeZone)).utc;
}

/** The Sun sign, or null when an untimed birth day starts and ends in different signs. */
function settledSun(birthDate: string, timeKnown: boolean, sunLon: number): string | null {
  const sign = SIGNS[signIndexForLongitude(sunLon)].slug;
  if (timeKnown) return sign;
  // Every clock's version of the date: from 14 hours before UTC midnight to 12 hours after the next.
  const start = Date.parse(`${birthDate}T00:00:00Z`) - 14 * 3_600_000;
  const end = Date.parse(`${birthDate}T23:59:00Z`) + 12 * 3_600_000;
  const signs = new Set([start, end].map((ms) => signIndexForLongitude(computeChart({ utc: new Date(ms), houseSystem: 'whole', timeKnown: false }).bodies.find((row) => row.body === 'Sun')!.lon)));
  return signs.size === 1 ? sign : null;
}

/** The score with the slow planets' daily positions cached, so a second chart for the same window costs only arithmetic. */
export function scoreFrom(natal: NatalPoints, start: Date): YearScore {
  const cache = new Map<string, number>();
  return scoreYear(natal, (body: SlowPlanet, date: Date) => {
    const key = `${body}|${date.getTime()}`;
    let value = cache.get(key);
    if (value === undefined) { value = bodyLongitude(body, date); cache.set(key, value); }
    return value;
  }, start);
}

/** Exact passes of each driver inside the window, from the transit scanner. */
function exactPasses(natal: NatalPoints, year: YearScore): string[][] {
  const bodies = (Object.entries(natal) as [string, number | null][]).filter((entry): entry is [string, number] => entry[1] !== null).map(([body, lon]) => ({ body: body as never, lon }));
  const from = new Date(`${year.from}T00:00:00Z`);
  const to = new Date(Date.parse(`${year.to}T00:00:00Z`) + DAY);
  return year.drivers.map((driver) => scanTransitContacts({ bodies, angles: null }, from, to, { transitBodies: [driver.planet], natalPoints: [driver.point], aspects: [driver.aspect] })
    .map((contact) => contact.exactUtc.slice(0, 10)));
}

function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}

const EMPTY = { subject: null, from: null, to: null, score: null, label: null, summary: null, best: null, hardest: null, drivers: [], months: [], alternates: [], confidence: null, confidenceLabel: null, sources: [] };

export async function getYearScore(args: YearScoreInput, now: Date, clock: YearScoreClock, origin: string): Promise<{ data: YearScoreData; links: { title: string; url: string }[] }> {
  const pageUrl = `${origin}/year-score/`;
  const links = [{ title: 'Year Ahead Score on Zodiacs', url: pageUrl }, { title: 'Your transits on Zodiacs', url: `${origin}/transits/` }];
  const start = args.from ?? today(now);
  if (!parseCivilDate(start) || start < YEAR_SCORE_START_MIN || start > YEAR_SCORE_START_MAX) throw new RangeError(`from must be a real date from ${YEAR_SCORE_START_MIN} to ${YEAR_SCORE_START_MAX}.`);
  const startDate = new Date(`${start}T00:00:00Z`);
  const limits: string[] = [];
  let figure: YearPerson | undefined;
  let birthDate: string;
  let time: string | null;
  let timeZone: string | null;
  let longitude: number | undefined;
  let placed = false;
  if (args.person !== undefined) {
    figure = findYearPerson(args.person);
    if (!figure) {
      return {
        data: { status: 'not-in-directory', ...EMPTY, limits: [`That name is not in the Year Ahead directory, so no score is given. The directory has ${YEAR_PEOPLE.length} public figures; with the person’s own consent, their birth date gives a score instead.`], under18: false, pageUrl },
        links,
      };
    }
    ({ birthDate, birthTime: time, zone: timeZone } = figure);
  } else {
    birthDate = args.birthDate!;
    const parsed = parseCivilDate(birthDate);
    if (!parsed || parsed.year < 1800 || parsed.year > 2199) throw new RangeError('birthDate must be a real date from 1800 to 2199.');
    if (args.time !== undefined && !parseCivilTime(args.time)) throw new RangeError('time must be HH:MM, such as 08:30.');
    time = args.time ?? null;
    timeZone = args.zone ?? null;
    longitude = args.longitude === undefined ? undefined : roundCoordinate(args.longitude);
    placed = args.latitude !== undefined && longitude !== undefined;
  }
  if (start < birthDate) throw new RangeError('from is before the birth date; there is no chart to meet yet.');
  const timeKnown = time !== null;
  const under18 = isUnder18(birthDate, today(now));
  const guard = (text: string) => (under18 ? softenMinor(text) : text);
  if (under18) limits.push(MINOR_NOTE);
  const utc = await birthInstant(birthDate, time, timeZone, clock, longitude);
  const { natal, sunLon } = natalPointsAt(utc, timeKnown);
  const year = scoreFrom(natal, startDate);
  const reading = yearReading(year, guard);
  const exact = exactPasses(natal, year);
  if (!timeKnown) limits.push(figure ? 'No published birth time, so the chart is cast for noon on the birthplace clock and the Moon is left out.' : 'No birth time was given, so the Moon is left out; the other contacts can shift by about a day.');
  if (!timeZone && !figure) limits.push('No time zone was given, so the birth is placed at noon UTC.');
  limits.push('The score reads Jupiter, Saturn, Uranus, Neptune and Pluto against the Sun, Moon, Mercury, Venus and Mars. Fast planets and eclipses are left out.');
  if (figure?.note) limits.push(figure.note);
  const alternates = [];
  for (const alternate of figure?.alternateBirthDates ?? []) {
    const altUtc = await birthInstant(alternate.date, null, figure!.zone, clock);
    const altYear = scoreFrom(natalPointsAt(altUtc, false).natal, startDate);
    alternates.push({ birthDate: alternate.date, score: altYear.score, label: yearReading(altYear).tier.label });
  }
  const detail = readingDetail({ hasDate: true, hasTime: timeKnown, hasPlace: placed });
  return {
    data: {
      status: 'found',
      subject: { kind: figure ? 'person' : 'self', name: figure?.name ?? null, description: figure?.description ?? null, sun: settledSun(birthDate, timeKnown, sunLon), timeKnown },
      from: year.from,
      to: year.to,
      score: year.score,
      label: reading.tier.label,
      summary: guard(reading.tier.summary),
      best: reading.best,
      hardest: reading.hardest,
      drivers: reading.drivers.map((driver, index) => ({
        planet: driver.planet, aspect: driver.aspect, point: driver.point, tone: driver.tone, share: driver.share,
        title: driver.title, line: driver.line,
        inOrb: driver.inOrbFrom === driver.inOrbTo ? dayName(driver.inOrbFrom) : `${dayName(driver.inOrbFrom)} to ${dayName(driver.inOrbTo)}`,
        exact: exact[index],
      })),
      months: reading.months.map((month) => ({ month: month.month, score: month.score })),
      alternates,
      confidence: readingConfidence(detail),
      confidenceLabel: readingConfidenceLabel(detail),
      sources: figure?.sources ?? [],
      limits,
      under18,
      pageUrl,
    },
    links,
  };
}
