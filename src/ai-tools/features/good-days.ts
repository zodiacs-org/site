/**
 * find_good_days: the best days in a window of up to a year for one goal, by the traditional rules of electional
 * astrology, with a plain one-line reason for each and the days to avoid. Offered only where
 * ZODIACS_GOOD_DAYS_ENABLED=1 joins the occasion and coverage switches, last in tools/list.
 *
 * The answer is computed by the site's own code (src/lib/good-days/find.ts, the module the /good-days/ page runs in
 * the browser) and pre-written sentences: no language model is called. It gives astrology's traditional reading of
 * each day plainly, money, career and legal themes included, and never a price or market call, medical timing or a
 * legal outcome; there is no procedure goal, and a medical one gets NO_MEDICAL_TIMING. A birth date, if the person
 * gives one, adds their own chart for this one call; it is never stored, logged, returned or put in a link. A birth
 * date under 13 is refused before anything is worked out (tools.ts, childBirthDateRefusal, and the finder itself), and
 * a relationship or wedding reading is refused for one under 18. Pure: no network, storage or logging.
 */
import { z } from 'zod';
import { GOAL_RULES, GOOD_DAYS_NOTE, GOOD_DAY_GOALS } from '../../lib/good-days/goals';
import { GOOD_DAYS_DEFAULT_COUNT, GOOD_DAYS_DEFAULT_DAYS, GOOD_DAYS_FIRST, GOOD_DAYS_LAST, GOOD_DAYS_MAX_COUNT, GOOD_DAYS_MAX_DAYS, findGoodDays, longDay, type GoodDaysClock } from '../../lib/good-days/find';
import { SIGNS } from '../../lib/signs';
import { readingConfidence, readingConfidenceLabel, readingDetail } from '../reading-confidence';

const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
const DATE = /^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/;
const zone = z.string().min(1).max(64).regex(ZONE_PATTERN);

export const goodDaysInput = z.strictObject({
  goal: z.enum(GOOD_DAY_GOALS).describe('What the day is for: launch (launching something new), contract (signing a contract), move (moving home), relationship (starting a relationship), travel (setting out on a journey), job (starting a new job) or wedding. Zodiacs gives no timing for surgery, medical procedures or treatment.'),
  from: z.string().regex(DATE).optional().describe("The first day to search, such as 2027-03-01, on the person's clock. Leave it out for today."),
  to: z.string().regex(DATE).optional().describe(`The last day to search, at most ${GOOD_DAYS_MAX_DAYS} days in all (about twelve months), from ${GOOD_DAYS_FIRST} to ${GOOD_DAYS_LAST}. Leave it out for ${GOOD_DAYS_DEFAULT_DAYS} days from from.`),
  zone: zone.optional().describe("The person's time zone, such as Europe/London, so days and times are on their clock. Without it, UTC."),
  count: z.number().int().min(1).max(GOOD_DAYS_MAX_COUNT).optional().describe(`How many best days to return: ${GOOD_DAYS_DEFAULT_COUNT} unless given, at most ${GOOD_DAYS_MAX_COUNT}.`),
  birthDate: z.string().regex(DATE).optional().describe("Optional: the person's own birth date, such as 1990-05-03, only if they ask for their own chart to be included. Used for this answer only, never stored. Never send a child's birth date."),
  birthTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional().describe('Optional: the birth time on the birthplace clock, only if the person knows it. Never guess it. Needs birthDate and birthZone.'),
  birthZone: zone.optional().describe("Optional: the birthplace's time zone, such as America/New_York. Needs birthDate."),
}).superRefine((args, context) => {
  if (args.birthTime !== undefined && args.birthZone === undefined) context.addIssue({ code: 'custom', message: 'A birth time needs its birthplace time zone (birthZone).' });
  if ((args.birthTime !== undefined || args.birthZone !== undefined) && args.birthDate === undefined) context.addIssue({ code: 'custom', message: 'A birth time or birthplace time zone needs the birth date.' });
});
export type GoodDaysToolInput = z.infer<typeof goodDaysInput>;

const signSlug = z.enum(SIGNS.map((sign) => sign.slug) as [string, ...string[]]);
export const goodDaysData = z.object({
  goal: z.enum(GOOD_DAY_GOALS),
  goalLabel: z.string(),
  /** The first and last day searched, on the person's clock, and how many days that is. */
  from: z.string(),
  to: z.string(),
  days: z.number().int().min(1).max(GOOD_DAYS_MAX_DAYS),
  zone: z.string(),
  /** request: the call named a zone. assistant: the host shared one. default: UTC was assumed, and message says so. */
  zoneSource: z.enum(['request', 'assistant', 'default']),
  /** The best days, highest rated first, at least two days apart where the window allows. */
  best: z.array(z.object({
    date: z.string(),
    /** Such as Tue 12 Jan 2027. */
    label: z.string(),
    /** 0 to 100, astrology's traditional reading of the day for the goal. */
    score: z.number().int().min(0).max(100),
    verdict: z.string(),
    /** One plain line: the day's strongest reasons. */
    reason: z.string(),
    /** Every reason found, strongest first. */
    factors: z.array(z.string()),
    /** Void-of-course Moon periods that touch the day's waking hours (08:00 to 20:00), on the person's clock. */
    voidOfCourse: z.array(z.object({ from: z.string(), to: z.string() })),
    confidenceLabel: z.string(),
  })).max(GOOD_DAYS_MAX_COUNT),
  /** Days tradition would avoid for the goal, in date order, each with its one-line reason. */
  avoid: z.array(z.object({ date: z.string(), label: z.string(), score: z.number().int().min(0).max(100), reason: z.string() })),
  /** Retrograde periods of the planets the goal is read against, and eclipses, that touch the window. */
  periods: z.array(z.object({ kind: z.enum(['mercury-retrograde', 'venus-retrograde', 'mars-retrograde', 'eclipse']), from: z.string(), to: z.string(), line: z.string() })),
  /** With a birth date: the natal Sun sign (null when the Sun changed sign on an untimed day of birth). Nothing else about the birth is returned. */
  personal: z.object({ sun: signSlug.nullable(), timeKnown: z.boolean() }).nullable(),
  confidence: z.number().int().min(40).max(95),
  confidenceLabel: z.string(),
  /** The goal's own line: what tradition reads into its best days, and what it leaves to the person. */
  care: z.string(),
  /** What the answer leaves out or assumes, in plain sentences; null when there is nothing to add. */
  message: z.string().nullable(),
  pageUrl: z.url(),
  note: z.literal(GOOD_DAYS_NOTE),
});
export type GoodDaysData = z.infer<typeof goodDaysData>;

export interface GoodDaysOptions {
  zone: string;
  zoneSource: GoodDaysData['zoneSource'];
  /** Today on the person's clock, YYYY-MM-DD. */
  today: string;
  origin: string;
  /** The hosted boundary's event-search admission: a year of days is an event search. */
  allowEvents?: () => Promise<'allowed' | 'limited' | 'unavailable'>;
}

export async function getGoodDays(args: GoodDaysToolInput, clock: GoodDaysClock, options: GoodDaysOptions): Promise<{ data: GoodDaysData; links: { title: string; url: string }[] } | { refused: 'rate-limited' | 'rate-limit-unavailable' }> {
  if (options.allowEvents) {
    const verdict = await options.allowEvents();
    if (verdict !== 'allowed') return { refused: verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable' };
  }
  const result = await findGoodDays({
    goal: args.goal, from: args.from, to: args.to, zone: options.zone, today: options.today,
    ...(args.count !== undefined ? { count: args.count } : {}),
    birth: args.birthDate ? { date: args.birthDate, ...(args.birthTime ? { time: args.birthTime } : {}), ...(args.birthZone ? { zone: args.birthZone } : {}) } : null,
  }, clock);
  const detail = readingDetail({ hasDate: true, hasTime: false, hasPlace: false });
  const label = readingConfidenceLabel(detail);
  const messages = result.messages.filter((line) => !(options.zoneSource !== 'default' && line.startsWith('Days and times are in UTC')));
  if (options.zoneSource === 'default' && !messages.some((line) => line.startsWith('Days and times are in UTC'))) messages.push('Days and times are in UTC because no time zone was given.');
  const data: GoodDaysData = {
    goal: result.goal, goalLabel: result.goalLabel, from: result.from, to: result.to, days: result.days,
    zone: options.zone, zoneSource: options.zoneSource,
    best: result.best.map((day) => ({ ...day, confidenceLabel: label })),
    avoid: result.avoid,
    periods: result.periods,
    personal: result.personal,
    confidence: readingConfidence(detail),
    confidenceLabel: label,
    care: result.care,
    message: messages.length ? messages.join(' ') : null,
    pageUrl: `${options.origin}/good-days/`,
    note: GOOD_DAYS_NOTE,
  };
  const links = [
    { title: 'Find good days on Zodiacs', url: `${options.origin}/good-days/` },
    { title: 'Void-of-course Moon calendar', url: `${options.origin}/void-of-course-moon/` },
    { title: 'Retrogrades', url: `${options.origin}/retrogrades/` },
    { title: 'Eclipses', url: `${options.origin}/eclipses/` },
    { title: 'How we calculate', url: `${options.origin}/methodology/` },
  ];
  return { data, links };
}

/** For the description and get_capabilities: the window the finder covers, in words. */
export const GOOD_DAYS_SPAN = `${longDay(GOOD_DAYS_FIRST)} to ${longDay(GOOD_DAYS_LAST)}`;
/** Each goal's label, for the site picker and tests. */
export const GOOD_DAY_LABELS = Object.fromEntries(GOOD_DAY_GOALS.map((goal) => [goal, GOAL_RULES[goal].label]));
