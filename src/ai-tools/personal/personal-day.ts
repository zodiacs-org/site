/**
 * get_personal_day: one day's transits to the person's own birth chart,
 * ranked, with the site's pre-written transit sentences.
 *
 * The calculation, the ranking and the words live in src/lib/personal-day/
 * (day.ts and score.ts), which the /your-day/ page runs in the browser; this
 * module is the tool's adapter over them: its schemas, the clock "today" is
 * read on, the date checks, the links and the share link
 * (src/lib/personal-day/share.ts). Pure: no network, storage or logging, and
 * no birth detail goes into a link.
 */
import { z } from 'zod';
import { MAJOR_ASPECT_ORDER, NATAL_POINT_ORDER, TRANSIT_BODY_ORDER } from '../../lib/engine/transit-scan-shared';
import { readPersonalDay } from '../../lib/personal-day/day';
import { PERSONAL_DAY_LIMIT } from '../../lib/personal-day/score';
import { YOUR_DAY_PAGE_PATH, yourDayShareUrl } from '../../lib/personal-day/share';
import { SIGNS } from '../../lib/signs';
import { parseCivilDate } from '../../lib/time/civil-date';
import { birthFields, castNatal, currentClock, dateOn, definePersonalTool, refineBirth, zoneField, type BirthArgs, type PersonalToolContext } from './shared';

export {
  ASPECT_WEIGHT, DAY_ORB, EXACT_BONUS, MOVER_WEIGHT, PERSONAL_DAY_LIMIT, POINT_WEIGHT, SEXTILE_ORB_SHARE, dayScore, maxOrb,
} from '../../lib/personal-day/score';

const DAY = 86_400_000;
/** How far from today the date may be, either side. */
export const PERSONAL_DAY_MAX_DAYS = 366;

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
  /** The share card for the top contact: the day, the planet, aspect and natal point, and its confidence. Never a birth detail. Null with no contact. */
  shareUrl: z.url().nullable(),
});
export type PersonalDayData = z.infer<typeof personalDayData>;

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

  const day = await readPersonalDay(
    { bodies: natal.chart.bodies, angles: natal.angles, timeKnown: natal.timeKnown, placed: natal.placed, detail: natal.detail },
    { birthDate: args.birthDate, date, zone, today, note },
    context.localTime,
  );
  const pageUrl = `${context.origin}${YOUR_DAY_PAGE_PATH}`;
  return {
    data: {
      birthDate: args.birthDate, timeKnown: natal.timeKnown, placed: natal.placed,
      ...day,
      moon: day.moon as PersonalDayData['moon'],
      pageUrl,
      shareUrl: yourDayShareUrl(context.origin, { date, contact: day.contacts[0] }),
    },
    links: [
      { title: 'Your day on Zodiacs', url: pageUrl },
      { title: 'Transits on Zodiacs', url: `${context.origin}/transits/` },
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
