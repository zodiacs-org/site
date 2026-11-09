/**
 * get_personal_day: one day's transits to the person's own birth chart,
 * ranked, with the site's pre-written transit sentences.
 *
 * The moving Sun, Moon and planets are measured at the middle of the local
 * day (halfway between its two midnights on the person's clock) against the
 * natal Sun to Pluto, the natal Moon only with a birth time, and the rising
 * degree and Midheaven only with a birth time and place. A contact counts
 * when it is within the moving body's orb of a major aspect at midday, or
 * when it is exact at some moment of the local day; the exact moment comes
 * from the transit scanner the profile and get_personal_transits use
 * (src/lib/engine/transit-scan.ts).
 *
 * Ranking (deterministic, highest first, ties broken by the fixed body,
 * point and aspect order):
 *
 *   score = MOVER_WEIGHT[mover] x POINT_WEIGHT[point] x ASPECT_WEIGHT[aspect]
 *           x (tightness + (exact today ? EXACT_BONUS : 0))
 *   tightness = max(0, 1 - orb / maxOrb), orb measured at midday
 *
 * The slow planets weigh most because their contacts last; the Moon weighs
 * least but is often the day's trigger, so an exact lunar contact still
 * climbs through the bonus. The natal Sun, Moon, rising degree and
 * Midheaven weigh most of the chart's points.
 *
 * The words are transitLine's (src/lib/transits.ts) and NATAL_HOUSE_THEME's
 * (src/lib/natal.ts); nothing is generated. Pure: no network, storage or
 * logging, and no birth detail goes into a link.
 */
import { z } from 'zod';
import { bodyLongitude, computeBodies } from '../../lib/engine/full.js';
import { findLongitudeCrossings } from '../../lib/engine/returns';
import { scanTransitContacts, type NatalPoint, type TransitBody } from '../../lib/engine/transit-scan';
import { MAJOR_ASPECT_ORDER, NATAL_POINT_ORDER, TRANSIT_BODY_ORDER } from '../../lib/engine/transit-scan-shared';
import type { AspectType } from '../../lib/engine/types';
import { wholeSignHouseFromAsc } from '../../lib/daily';
import { NATAL_HOUSE_THEME } from '../../lib/natal';
import { SIGNS, signIndexForLongitude } from '../../lib/signs';
import { parseCivilDate } from '../../lib/time/civil-date';
import { transitLine } from '../../lib/transits';
import { MINOR_NOTE, isUnder18, softenMinor } from '../features/reading-guards';
import { readingConfidence, readingConfidenceLabel } from '../reading-confidence';
import { ORDINAL, birthFields, castNatal, currentClock, dateOn, dayLabel, definePersonalTool, refineBirth, zoneField, type BirthArgs, type PersonalToolContext } from './shared';

const DAY = 86_400_000;
const HOUR = 3_600_000;
/** How far from today the date may be, either side. */
export const PERSONAL_DAY_MAX_DAYS = 366;
/** How many contacts are listed, highest score first. */
export const PERSONAL_DAY_LIMIT = 8;

/** Widest orb, in degrees, for each moving body's conjunction, square, trine and opposition. */
export const DAY_ORB: Readonly<Record<TransitBody, number>> = {
  Moon: 6, Sun: 3, Mercury: 3, Venus: 3, Mars: 3, Jupiter: 2, Saturn: 2, Uranus: 2, Neptune: 2, Pluto: 2,
};
/** A sextile is the weakest major aspect, so its orb is two thirds of the others. */
export const SEXTILE_ORB_SHARE = 2 / 3;
export const maxOrb = (mover: TransitBody, aspect: AspectType) => DAY_ORB[mover] * (aspect === 'sextile' ? SEXTILE_ORB_SHARE : 1);

/** How much a contact from each moving body counts: slow planets most, the Moon least. */
export const MOVER_WEIGHT: Readonly<Record<TransitBody, number>> = {
  Pluto: 10, Neptune: 9, Uranus: 9, Saturn: 8, Jupiter: 7, Mars: 6, Sun: 5, Venus: 5, Mercury: 4, Moon: 3,
};
/** How much each natal point counts: the lights and the angles most. */
export const POINT_WEIGHT: Readonly<Record<NatalPoint, number>> = {
  Sun: 10, Moon: 10, ASC: 10, MC: 9, Venus: 7, Mars: 7, Mercury: 6, Jupiter: 5, Saturn: 5, Uranus: 3, Neptune: 3, Pluto: 3,
};
/** How much each aspect counts: the conjunction most, the sextile least. */
export const ASPECT_WEIGHT: Readonly<Record<AspectType, number>> = {
  conjunction: 1, opposition: 0.85, square: 0.85, trine: 0.7, sextile: 0.55,
};
/** Added to tightness when the contact is exact during the local day. */
export const EXACT_BONUS = 0.75;
const ASPECT_ANGLE: Readonly<Record<AspectType, number>> = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };

/** The score of one contact, rounded to two decimals. */
export function dayScore(mover: TransitBody, point: NatalPoint, aspect: AspectType, orb: number, exactToday: boolean): number {
  const tightness = Math.max(0, 1 - orb / maxOrb(mover, aspect));
  return Math.round(MOVER_WEIGHT[mover] * POINT_WEIGHT[point] * ASPECT_WEIGHT[aspect] * (tightness + (exactToday ? EXACT_BONUS : 0)) * 100) / 100;
}

export const personalDayInput = z.strictObject({
  ...birthFields,
  time: birthFields.time.describe('The birth time on the local clock, such as 08:30, only if the person knows it. Never guess it. Needs zone. Without it the natal Moon, rising degree and Midheaven are left out.'),
  latitude: birthFields.latitude.describe("Optional. The birthplace's latitude; with a birth time it adds the rising degree, the Midheaven and the house the Moon passes through. Give it with longitude and zone. Nothing is stored."),
  currentZone: zoneField.optional().describe('Where the person is now, such as Asia/Bangkok, so the day and its times fall on their own clock. Without it the day is read on the birthplace clock, or UTC, and the answer says which.'),
  date: z.string().regex(/^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/).optional().describe(`The day to read, such as 2026-11-12, at most ${PERSONAL_DAY_MAX_DAYS} days from today. Defaults to today on the person's clock.`),
}).superRefine(refineBirth);
export type PersonalDayInput = z.infer<typeof personalDayInput>;

const transitBody = z.enum(TRANSIT_BODY_ORDER);
const natalPoint = z.enum(NATAL_POINT_ORDER);
const signSlug = z.enum(SIGNS.map((entry) => entry.slug) as [string, ...string[]]);
export const personalDayData = z.object({
  birthDate: z.string(),
  timeKnown: z.boolean(),
  placed: z.boolean(),
  /** The day read, YYYY-MM-DD on the person's clock, and the clock. */
  date: z.string(),
  dayLabel: z.string(),
  zone: z.string(),
  /** The instant the moving bodies were measured at: the middle of the local day. */
  middayUtc: z.string(),
  /** The natal points the moving bodies were measured against. */
  points: z.array(natalPoint),
  /** One line built from the highest scored contact. */
  theme: z.string(),
  moon: z.object({
    /** The Moon's sign at midday. */
    sign: signSlug,
    /** When the Moon enters the next sign during the day, else null. */
    entersSign: z.object({ sign: signSlug, atUtc: z.string(), atLocal: z.string() }).nullable(),
    /** With a birth time and place: the whole-sign natal house the Moon passes through at midday. */
    house: z.object({ number: z.number().int().min(1).max(12), line: z.string() }).nullable(),
    line: z.string(),
  }),
  /** Contacts in score order, highest first. */
  contacts: z.array(z.object({
    rank: z.number().int().min(1),
    planet: transitBody,
    aspect: z.enum(MAJOR_ASPECT_ORDER),
    point: natalPoint,
    /** Degrees from exact at midday, to two decimals. */
    orb: z.number().min(0),
    applying: z.boolean(),
    /** The exact moment, when it falls inside the local day. */
    exactAt: z.string().nullable(),
    /** The same moment on the person's clock, HH:MM. */
    exactLocal: z.string().nullable(),
    score: z.number().min(0),
    title: z.string(),
    line: z.string(),
    confidence: z.number().int().min(40).max(95),
    confidenceLabel: z.string(),
  })).max(PERSONAL_DAY_LIMIT),
  /** Contacts found before the list was cut to its limit. */
  found: z.number().int().min(0),
  /** True when the birth date is under 18 on the day read. Romantic and attraction readings are left out. */
  under18: z.boolean(),
  limits: z.array(z.string()),
  pageUrl: z.url(),
});
export type PersonalDayData = z.infer<typeof personalDayData>;

const POINT_NAME: Partial<Record<NatalPoint, string>> = { ASC: 'rising degree', MC: 'Midheaven' };
const pointName = (point: NatalPoint) => POINT_NAME[point] ?? point;
const round2 = (value: number) => Math.round(value * 100) / 100;
/** The distance, 0 to 180 degrees, between two longitudes. */
const separation = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
const orbOf = (moverLon: number, pointLon: number, aspect: AspectType) => Math.abs(separation(moverLon, pointLon) - ASPECT_ANGLE[aspect]);
/** HH:MM on a zone's clock. */
const clockTime = (at: Date, timeZone: string) => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
const signName = (slug: string) => SIGNS.find((entry) => entry.slug === slug)!.name;

async function startOf(date: string, zone: string, clock: PersonalToolContext['localTime']): Promise<Date> {
  await clock.prepareLocalTime(date, zone);
  return clock.resolveLocalToUtc(date, '00:00', zone).utc;
}

/** One day's transits to one birth chart. Throws RangeError for details it cannot use. */
export async function personalDay(args: BirthArgs & { currentZone?: string | undefined; date?: string | undefined }, context: PersonalToolContext): Promise<{ data: PersonalDayData; links: { title: string; url: string }[] }> {
  const natal = await castNatal(args, context.localTime);
  const { zone, note } = await currentClock(args.currentZone, args.zone, context);
  const today = dateOn(context.now, zone);
  const date = args.date ?? today;
  if (!parseCivilDate(date)) throw new RangeError('date must be a real date, such as 2026-11-12.');
  const distance = Math.round(Math.abs(Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  if (distance > PERSONAL_DAY_MAX_DAYS) throw new RangeError(`date must be within ${PERSONAL_DAY_MAX_DAYS} days of today.`);
  if (date < args.birthDate) throw new RangeError('date is before the birth date; give a day on or after it.');

  // The local day: its two midnights on the person's clock, and the moment halfway between them.
  const nextDate = new Date(Date.parse(`${date}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
  const dayStart = await startOf(date, zone, context.localTime);
  const dayEnd = await startOf(nextDate, zone, context.localTime);
  const midday = new Date((dayStart.getTime() + dayEnd.getTime()) / 2);
  const later = new Date(midday.getTime() + HOUR);

  const points: NatalPoint[] = [...TRANSIT_BODY_ORDER.filter((body) => natal.timeKnown || body !== 'Moon'), ...(natal.angles ? ['ASC', 'MC'] as const : [])];
  const natalLon = new Map<NatalPoint, number>(natal.chart.bodies.filter((row) => (TRANSIT_BODY_ORDER as readonly string[]).includes(row.body)).map((row) => [row.body as NatalPoint, row.lon]));
  if (natal.angles) { natalLon.set('ASC', natal.angles.asc); natalLon.set('MC', natal.angles.mc); }
  const sky = new Map(computeBodies(midday).map((row) => [row.body, row.lon]));

  // Exact moments inside the local day, from the transit scanner.
  const natalForScan = { bodies: natal.chart.bodies.filter((row) => (TRANSIT_BODY_ORDER as readonly string[]).includes(row.body)).map(({ body, lon }) => ({ body, lon })), angles: natal.angles };
  const exact = new Map<string, Date>();
  for (const contact of scanTransitContacts(natalForScan, dayStart, new Date(dayEnd.getTime() - 1), { transitBodies: TRANSIT_BODY_ORDER, includeMoon: true, natalPoints: points })) {
    const key = `${contact.transitBody}|${contact.natalPoint}|${contact.aspect}`;
    const at = new Date(contact.exactUtc);
    const held = exact.get(key);
    // Two passes in one day cannot happen for these bodies, but keep the one nearest midday if it ever did.
    if (!held || Math.abs(at.getTime() - midday.getTime()) < Math.abs(held.getTime() - midday.getTime())) exact.set(key, at);
  }

  const under18 = isUnder18(args.birthDate, date);
  const guard = (text: string) => (under18 ? softenMinor(text) : text);
  const found: Omit<PersonalDayData['contacts'][number], 'rank'>[] = [];
  for (const mover of TRANSIT_BODY_ORDER) {
    const moverLon = sky.get(mover)!;
    const moverLater = bodyLongitude(mover, later);
    for (const point of points) {
      const pointLon = natalLon.get(point)!;
      for (const aspect of MAJOR_ASPECT_ORDER) {
        const orb = orbOf(moverLon, pointLon, aspect);
        const at = exact.get(`${mover}|${point}|${aspect}`) ?? null;
        if (orb > maxOrb(mover, aspect) && !at) continue;
        const applying = at ? at.getTime() > midday.getTime() : orbOf(moverLater, pointLon, aspect) < orb;
        const tight = orb < 1 || at !== null;
        const confidenceLabel = readingConfidenceLabel(natal.detail, tight);
        found.push({
          planet: mover, aspect, point, orb: round2(orb), applying,
          exactAt: at ? at.toISOString() : null,
          exactLocal: at ? clockTime(at, zone) : null,
          score: dayScore(mover, point, aspect, orb, at !== null),
          title: `${mover} ${aspect} your ${pointName(point)}`,
          line: `${guard(transitLine(mover, aspect, pointName(point)))} ${confidenceLabel}.`,
          confidence: readingConfidence(natal.detail, tight),
          confidenceLabel,
        });
      }
    }
  }
  // Stable sort: equal scores keep the fixed body, point and aspect order they were found in.
  found.sort((a, b) => b.score - a.score);
  const contacts = found.slice(0, PERSONAL_DAY_LIMIT).map((contact, index) => ({ rank: index + 1, ...contact }));

  // The Moon today: its sign at midday, a change of sign inside the day, and with a rising sign the natal house.
  const moonIndex = signIndexForLongitude(sky.get('Moon')!);
  const moonSign = SIGNS[moonIndex].slug;
  const startIndex = signIndexForLongitude(bodyLongitude('Moon', dayStart));
  const endIndex = signIndexForLongitude(bodyLongitude('Moon', dayEnd));
  let entersSign: PersonalDayData['moon']['entersSign'] = null;
  if (startIndex !== endIndex) {
    const crossing = findLongitudeCrossings('Moon', endIndex * 30, dayStart, dayEnd, 0.25)[0];
    if (crossing) entersSign = { sign: SIGNS[endIndex].slug, atUtc: crossing.at.toISOString(), atLocal: clockTime(crossing.at, zone) };
  }
  const risingSign = natal.angles ? SIGNS[signIndexForLongitude(natal.angles.asc)].slug : null;
  const houseNumber = risingSign ? wholeSignHouseFromAsc(moonSign, risingSign) : null;
  const house = houseNumber ? { number: houseNumber, line: guard(`The Moon is passing through your ${ORDINAL[houseNumber]} house: ${NATAL_HOUSE_THEME[houseNumber]}.`) } : null;
  const moonLine = [
    !entersSign ? `The Moon is in ${signName(moonSign)} all day.`
      : Date.parse(entersSign.atUtc) <= midday.getTime() ? `The Moon enters ${signName(entersSign.sign)} at ${entersSign.atLocal} and stays there for the rest of the day.`
        : `The Moon is in ${signName(moonSign)} until ${entersSign.atLocal}, then enters ${signName(entersSign.sign)}.`,
    house ? house.line : '',
  ].filter(Boolean).join(' ');

  const top = contacts[0];
  const theme = top
    ? `Today's strongest contact is ${top.title}, ${top.exactLocal ? `exact at ${top.exactLocal}` : `${top.orb.toFixed(2)} degrees from exact and ${top.applying ? 'applying' : 'separating'}`} (${top.confidenceLabel}).`
    : `No major contact to your chart is within orb today, so the Moon in ${signName(moonSign)} sets the tone.`;

  const limits: string[] = [];
  if (note) limits.push(note);
  if (under18) limits.push(MINOR_NOTE);
  if (!natal.timeKnown) limits.push('No birth time was given, so the natal Moon, the rising degree and the Midheaven are left out, and the chart is cast for midday of the birth date; contacts to the other planets can shift by a few hours.');
  else if (!natal.placed) limits.push('No birthplace coordinates were given, so the rising degree, the Midheaven and the Moon\'s house are left out.');
  if (found.length > PERSONAL_DAY_LIMIT) limits.push(`${found.length} contacts were within orb; the ${PERSONAL_DAY_LIMIT} with the highest scores are listed.`);

  const pageUrl = `${context.origin}/transits/`;
  return {
    data: {
      birthDate: args.birthDate, timeKnown: natal.timeKnown, placed: natal.placed,
      date, dayLabel: dayLabel(midday, zone), zone, middayUtc: midday.toISOString(), points, theme,
      moon: { sign: moonSign, entersSign, house, line: moonLine },
      contacts, found: found.length, under18, limits, pageUrl,
    },
    links: [
      { title: 'Transits on Zodiacs', url: pageUrl },
      { title: 'Your birth chart on Zodiacs', url: `${context.origin}/birth-chart/` },
      { title: "Today's sky on Zodiacs", url: `${context.origin}/today/` },
    ],
  };
}

export const personalDayTool = definePersonalTool({
  name: 'get_personal_day',
  title: 'Your day',
  summary: "one day's transits to the person's own chart, ranked, with plain meanings",
  description: "Gives one day's transits to the person's own birth chart: the moving Moon, Sun and planets in major aspect to their natal planets (and the rising degree and Midheaven with a birth time and place), ranked by strength, each with the exact time when it falls that day, whether it is applying or separating, and what it traditionally means, plus the Moon's sign and the natal house it passes through. Use it for my day, my transits today or what today holds for me, once the person has given a birth date. For dated contacts over weeks or a year use get_personal_transits; for a general Sun-sign horoscope use get_horoscope. Give the birth date, and the time, birthplace time zone and coordinates only as the person gives them; never guess a birth time. When they name a town or city instead of coordinates, use find_birthplace first. Give currentZone for where they are now so the day falls on their clock. Share each reading plainly, with its reading-confidence label.",
  input: personalDayInput,
  data: personalDayData,
  clockDependent: true,
  example: { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7, currentZone: 'Europe/Madrid' },
  run: (args, context) => personalDay(args, context),
});
