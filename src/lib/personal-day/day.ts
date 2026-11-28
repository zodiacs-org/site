/**
 * One day's transits to one birth chart, ranked, with the site's pre-written
 * transit sentences: the calculation behind the /your-day/ page (in the
 * browser, loaded only when the form is sent) and the get_personal_day tool
 * (src/ai-tools/personal/personal-day.ts), so the two give the same list.
 *
 * The moving Sun, Moon and planets are measured at the middle of the local
 * day (halfway between its two midnights on the person's clock) against the
 * natal Sun to Pluto, the natal Moon only with a birth time, and the rising
 * degree and Midheaven only with a birth time and place. A contact counts
 * when it is within the moving body's orb of a major aspect at midday, or,
 * with a birth time, when it is exact at some moment of the local day; the
 * exact moment comes from the transit scanner the /transits/ page and the
 * profile use (src/lib/engine/transit-scan.ts). Without a birth time the
 * natal points are known only to within the birth day, so a contact can be
 * exact a day or more either side of the moment the scanner finds: no exact
 * time is given, and a contact neither counts nor scores for being exact.
 * The ranking is ./score.ts.
 *
 * The words are transitLine's (src/lib/transits.ts) and NATAL_HOUSE_THEME's
 * (src/lib/natal.ts); nothing is generated. Pure: no network, storage or
 * logging, and no birth detail goes into a link.
 */
import { bodyLongitude, computeBodies, computeChart } from '../engine/full.js';
import { findLongitudeCrossings } from '../engine/returns';
import { scanTransitContacts } from '../engine/transit-scan';
import { MAJOR_ASPECT_ORDER, SLOW_TRANSIT_BODIES, TRANSIT_BODY_ORDER, type NatalPoint, type TransitBody } from '../engine/transit-scan-shared';
import type { AspectType } from '../engine/types';
import { wholeSignHouseFromAsc } from '../daily';
import { NATAL_HOUSE_THEME } from '../natal';
import { SIGNS, signIndexForLongitude } from '../signs';
import type { ShareSign } from '../share-results';
import { transitLine } from '../transits';
import { localDaySpan, readsOnDate, type WallResolution } from '../time/local-day';
import { MINOR_NOTE, isUnderAge, softenHealth, softenMinor } from '../../ai-tools/features/reading-guards';
import { earliestToday } from '../birth-date-policy';
import { isGeographicPole, roundCoordinate } from '../geo/coordinates';
import { readingConfidence, readingConfidenceLabel, readingDetail, type ReadingDetail } from '../../ai-tools/reading-confidence';
import { clockTime, dateOn, dayLabel, nextDate } from './clock';
import { SkippedBirthDateError, SkippedBirthTimeError, birthTimeOnClock } from '../vedic-signs/clock';
import { BACKGROUND_LIMIT, PERSONAL_DAY_LIMIT, dayScore, maxOrb, orbOf, pointName } from './score';

const slowMovers = new Set<TransitBody>(SLOW_TRANSIT_BODIES);
const HOUR = 3_600_000;
const MINUTE = 60_000;
/** The widest civil offset any clock has kept since 1800, rounded out to whole hours (src/ai-tools/personal/shared.ts). */
const WIDEST_OFFSET_HOURS = 16;
/** The limit a date-only reading carries; the /your-day/ FAQ says the same. */
export const UNTIMED_LIMIT = 'No birth time was given, so the natal Moon, the rising degree and the Midheaven are left out, the chart is cast for midday of the birth date, and no exact times are given: without a birth time a contact can be exact a day or more either side.';
const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'] as const;

/** The two calls of the site's local-time resolver the day needs (src/lib/time/localToUtc.ts, or the compute API's copy). */
export interface DayClock {
  prepareLocalTime: (date: string, timeZone: string) => Promise<void>;
  resolveLocalToUtc: (date: string, time: string, timeZone: string, options?: { longitude?: number; fold?: 'earlier' | 'later' }) => WallResolution;
}

/** The birth chart as the day reads it: the natal bodies, the angles with a time and place, and how specific it is. */
export interface DayNatal {
  latitude?: number | undefined;
  bodies: readonly { body: string; lon: number }[];
  angles: { asc: number; mc: number } | null;
  timeKnown: boolean;
  placed: boolean;
  detail: ReadingDetail;
  /**
   * The sentence for a birth time the birthplace clock showed twice (REPEATED_BIRTH_TIME, src/lib/vedic-signs/clock.ts),
   * listed first in the limits; null or absent otherwise. A skipped birth time or date is refused before this.
   */
  clockLimit?: string | null;
}

export interface DayContact {
  rank: number;
  group: 'today' | 'background';
  planet: TransitBody;
  aspect: AspectType;
  point: NatalPoint;
  /** Degrees from exact at midday, to two decimals. */
  orb: number;
  applying: boolean;
  /** The exact moment (or first exact pass when a stationing planet crosses twice that day), when it falls inside the local day. */
  exactAt: string | null;
  /** The same moment(s) on the person's clock, HH:MM, with the UTC offset when repeated; multiple passes are joined with " and ". */
  exactLocal: string | null;
  /** All exact passes when a stationing planet hits the same natal point more than once on this local day. */
  exactPasses?: { at: string; local: string }[];
  score: number;
  title: string;
  line: string;
  confidence: number;
  confidenceLabel: string;
}

export interface PersonalDayReading {
  /** The day read, YYYY-MM-DD on the person's clock, and the clock. */
  date: string;
  dayLabel: string;
  zone: string;
  /** The instant the moving bodies were measured at: the middle of the local day. */
  middayUtc: string;
  points: NatalPoint[];
  theme: string;
  moon: {
    sign: string;
    entersSign: { sign: string; atUtc: string; atLocal: string } | null;
    house: { number: number; line: string } | null;
    line: string;
  };
  contacts: DayContact[];
  found: number;
  under18: boolean;
  limits: string[];
}

export { clockTime, dateOn, dayLabel, nextDate } from './clock';

const round2 = (value: number) => Math.round(value * 100) / 100;
const signName = (slug: string) => SIGNS.find((entry) => entry.slug === slug)!.name;

/**
 * The birth chart for the page, cast as the get_personal_day tool casts it
 * (castNatal in src/ai-tools/personal/shared.ts): whole-sign houses, the
 * birthplace rounded to two decimals, local noon without a birth time, and
 * the angles only with a time and place. Await clock.prepareLocalTime first.
 * A date the birthplace clock never showed (Apia went from 29 to 31 December
 * 2011) throws SkippedBirthDateError, and a birth time it skipped
 * SkippedBirthTimeError (src/lib/vedic-signs/clock.ts), rather than being read
 * as the next date or the time the clock jumped to; a time it showed twice is
 * read at its first pass, and clockLimit says so.
 */
export function castDayNatal(input: { birthDate: string; time?: string | undefined; zone: string; latitude?: number | undefined; longitude?: number | undefined }, clock: DayClock): DayNatal {
  const latitude = input.latitude === undefined ? undefined : roundCoordinate(input.latitude);
  const longitude = input.longitude === undefined ? undefined : roundCoordinate(input.longitude);
  const timeKnown = input.time !== undefined;
  const placed = latitude !== undefined && longitude !== undefined;
  const wall = (time: string) => (longitude !== undefined ? clock.resolveLocalToUtc(input.birthDate, time, input.zone, { longitude }) : clock.resolveLocalToUtc(input.birthDate, time, input.zone));
  if (!readsOnDate(input.birthDate, wall('00:00'))) throw new SkippedBirthDateError();
  const birth = wall(input.time ?? '12:00');
  const onClock = birthTimeOnClock(birth.flags, timeKnown);
  if (onClock.skipped) throw new SkippedBirthTimeError();
  const utc = birth.utc;
  const chart = computeChart({ utc, ...(placed ? { latitude, longitude } : {}), houseSystem: 'whole', timeKnown });
  const angles = timeKnown && placed && chart.angles ? { asc: chart.angles.asc, mc: chart.angles.mc } : null;
  return { bodies: chart.bodies, angles, latitude, timeKnown, placed, detail: readingDetail({ hasDate: true, hasTime: timeKnown, hasPlace: placed }), clockLimit: onClock.limit };
}

/**
 * Under 18, a contact whose pre-written line reads as love, appetite, longing or heat (src/lib/transits.ts, BODY_ROLE
 * in src/lib/compat.ts): the moving Venus ("warmth and appetite"), Mars ("heat and urgency") and Neptune ("longing
 * and blur"), and the natal Venus ("way of loving") and Jupiter ("appetite for more"). No other words stand in.
 */
export function minorLeftOut(mover: TransitBody, point: NatalPoint): boolean {
  return mover === 'Venus' || mover === 'Mars' || mover === 'Neptune' || point === 'Venus' || point === 'Jupiter';
}

/** Under 18, the natal houses whose theme the Moon's line would read as pleasure: the fifth. */
export const MINOR_LEFT_OUT_HOUSES: readonly number[] = [5];

/**
 * The real time a local date covers on a zone's clock, as [start, end): from where the clock first reaches its
 * 00:00, or jumps over it into the date, to where it last reaches the next date's 00:00 (src/lib/time/local-day.ts,
 * as settledSunSign reads the birth day). Toronto's clocks went from 23:30 on 30 March 1919 to 00:30 on 31 March,
 * so the 31st starts at the jump (04:30 UTC), not at the 00:30 the resolver moves a skipped midnight to. Null for a
 * date the clock skipped.
 */
export async function localDayBounds(date: string, zone: string, clock: DayClock): Promise<[Date, Date] | null> {
  await clock.prepareLocalTime(date, zone);
  await clock.prepareLocalTime(nextDate(date), zone);
  const span = localDaySpan(date, (day, time, fold) => clock.resolveLocalToUtc(day, time, zone, { fold }));
  // localDaySpan includes the last millisecond. The exclusive end starts the next day.
  return span ? [span[0], new Date(span[1].getTime() + 1)] : null;
}

/**
 * One day's transits to one birth chart. `date` is the day on `zone`'s clock;
 * `today` is today's date on that clock, so the theme says "today" only for
 * today; `now` is the instant of the reading, for the under-18 rule; `note` is
 * a sentence about which clock was used, listed first in the limits.
 */
export async function readPersonalDay(natal: DayNatal, input: { birthDate: string; date: string; zone: string; now: Date; today?: string | undefined; note?: string | null | undefined }, clock: DayClock): Promise<PersonalDayReading> {
  const { date, zone } = input;
  const atPole = natal.timeKnown && natal.placed && natal.latitude !== undefined && isGeographicPole(natal.latitude);
  const angles = atPole ? null : natal.angles;
  // The local day as the clock showed it, and the moment halfway through it.
  const bounds = await localDayBounds(date, zone, clock);
  // A day the clock skipped has no length.
  if (!bounds) throw new RangeError('date must be a real date, such as 2026-11-12.');
  const [dayStart, dayEnd] = bounds;
  const midday = new Date((dayStart.getTime() + dayEnd.getTime()) / 2);
  // Applying or separating is the direction the orb is moving at midday itself: its rate of change there, read over a
  // minute either side. An orb read an hour later can be past an exact moment that falls inside that hour.
  const justBefore = new Date(midday.getTime() - MINUTE);
  const justAfter = new Date(midday.getTime() + MINUTE);

  const points: NatalPoint[] = [...TRANSIT_BODY_ORDER.filter((body) => natal.timeKnown || body !== 'Moon'), ...(angles ? ['ASC', 'MC'] as const : [])];
  const natalBodies = natal.bodies.filter((row) => (TRANSIT_BODY_ORDER as readonly string[]).includes(row.body)).map(({ body, lon }) => ({ body: body as TransitBody, lon }));
  const natalLon = new Map<NatalPoint, number>(natalBodies.map((row) => [row.body, row.lon]));
  if (angles) { natalLon.set('ASC', angles.asc); natalLon.set('MC', angles.mc); }
  const sky = new Map(computeBodies(midday).map((row) => [row.body, row.lon]));

  // Exact moments inside the local day, from the transit scanner: only with a birth time, which fixes the natal points to the minute.
  // A clock that turned back over midnight shows the date before again after the next one has begun (Goose Bay, 25
  // October 1987), so the spans of two neighbouring dates share that stretch; a contact there belongs only to the date
  // the clock showed at its exact moment. From 1971 that is read from Intl, as the resolver reads it; up to 1970 the
  // resolver reads the engine's zone history, and the span alone decides.
  const onDate = (at: Date) => Number(date.slice(0, 4)) <= 1970 || dateOn(at, zone) === date;
  const exact = new Map<string, Date[]>();
  if (natal.timeKnown) for (const contact of scanTransitContacts({ bodies: natalBodies, angles }, dayStart, new Date(dayEnd.getTime() - 1), { transitBodies: TRANSIT_BODY_ORDER, includeMoon: true, natalPoints: points })) {
    const key = `${contact.transitBody}|${contact.natalPoint}|${contact.aspect}`;
    const at = new Date(contact.exactUtc);
    if (!onDate(at)) continue;
    // A stationing planet can cross the same natal point twice in one local day; preserve every exact pass in order.
    const passes = exact.get(key) ?? [];
    passes.push(at);
    exact.set(key, passes);
  }
  for (const passes of exact.values()) passes.sort((a, b) => a.getTime() - b.getTime());

  // Age is taken on today, not on the day read, which can be up to a year ahead, and today is the calendar date at
  // UTC-12 (earliestToday), as the shared under-13 policy reads it: the clock the day is read on (the device's, the
  // current zone's or the birthplace's) never moves it, so nobody is read as 18 before their birthday everywhere.
  // For someone under 18 the contacts whose line reads as love, appetite, longing or heat are left out (minorLeftOut),
  // and so is the Moon's line in the fifth house ("pleasure").
  // softenMinor, shared with published tools whose output is frozen, does not reach them. MINOR_NOTE says so.
  // isUnderAge keeps 29 February as the cutoff, so someone born on 1 March is still under 18 on that day.
  const under18 = isUnderAge(input.birthDate, earliestToday(input.now), 18);
  const guard = (text: string) => softenHealth(under18 ? softenMinor(text) : text);
  const found: Omit<DayContact, 'rank'>[] = [];
  for (const mover of TRANSIT_BODY_ORDER) {
    const moverLon = sky.get(mover)!;
    const moverBefore = bodyLongitude(mover, justBefore);
    const moverAfter = bodyLongitude(mover, justAfter);
    for (const point of points) {
      if (under18 && minorLeftOut(mover, point)) continue;
      const pointLon = natalLon.get(point)!;
      for (const aspect of MAJOR_ASPECT_ORDER) {
        const orb = orbOf(moverLon, pointLon, aspect);
        const passes = exact.get(`${mover}|${point}|${aspect}`) ?? [];
        if (passes.length === 0 && orb > maxOrb(mover, aspect)) continue;
        let middayApplying = orbOf(moverAfter, pointLon, aspect) < orbOf(moverBefore, pointLon, aspect);
        const exactPass = passes.length > 0;
        if (passes.length > 1) {
          const nearestDelta = Math.min(...passes.map((at) => Math.abs(at.getTime() - midday.getTime())));
          const step = Math.max(1, Math.min(1_000, Math.floor(nearestDelta / 4)));
          middayApplying = orbOf(bodyLongitude(mover, new Date(midday.getTime() + step)), pointLon, aspect) < orb;
        }
        const applying = passes.length === 1 ? passes[0].getTime() > midday.getTime() : middayApplying;
        const minuteLabels = passes.map((at) => clockTime(at, zone));
        const includeSeconds = passes.length > 1 && new Set(minuteLabels).size < minuteLabels.length;
        const passEntries = passes.map((at, index) => ({
          at: at.toISOString(),
          local: includeSeconds ? clockTime(at, zone, true) : minuteLabels[index],
        }));
        const exactLocal = formatExactLocal(passEntries);
        // A date-only chart is never tight: its contacts carry the plain date-only confidence.
        const tight = natal.timeKnown && (orb < 1 || exactPass);
        const confidenceLabel = readingConfidenceLabel(natal.detail, tight);
        found.push({
          group: !exactPass && slowMovers.has(mover) ? 'background' : 'today',
          planet: mover, aspect, point, orb: round2(orb), applying,
          exactAt: passEntries[0]?.at ?? null,
          exactLocal,
          ...(passEntries.length > 1 ? { exactPasses: passEntries } : {}),
          score: dayScore(mover, point, aspect, orb, exactPass),
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
  const contacts: DayContact[] = [];
  let backgroundCount = 0;
  for (const contact of found) {
    if (contact.group === 'background') {
      if (backgroundCount === BACKGROUND_LIMIT) continue;
      backgroundCount += 1;
    }
    contacts.push({ rank: contacts.length + 1, ...contact });
    if (contacts.length === PERSONAL_DAY_LIMIT) break;
  }

  // The Moon today: its sign at midday, a change of sign inside the day, and with a rising sign the natal house.
  const moonIndex = signIndexForLongitude(sky.get('Moon')!);
  const moonSign = SIGNS[moonIndex].slug;
  const startIndex = signIndexForLongitude(bodyLongitude('Moon', dayStart));
  const endIndex = signIndexForLongitude(bodyLongitude('Moon', dayEnd));
  let entersSign: PersonalDayReading['moon']['entersSign'] = null;
  if (startIndex !== endIndex) {
    const crossing = findLongitudeCrossings('Moon', endIndex * 30, dayStart, dayEnd, 0.25)[0];
    if (crossing) entersSign = { sign: SIGNS[endIndex].slug, atUtc: crossing.at.toISOString(), atLocal: clockTime(crossing.at, zone) };
  }
  const risingSign = angles ? SIGNS[signIndexForLongitude(angles.asc)].slug : null;
  const houseNumber = risingSign ? wholeSignHouseFromAsc(moonSign, risingSign) : null;
  const house = houseNumber && !(under18 && MINOR_LEFT_OUT_HOUSES.includes(houseNumber)) ? { number: houseNumber, line: guard(`The Moon is passing through your ${ORDINAL[houseNumber]} house: ${NATAL_HOUSE_THEME[houseNumber]}.`) } : null;
  const moonLine = [
    !entersSign ? `The Moon is in ${signName(moonSign)} all day.`
      : Date.parse(entersSign.atUtc) <= midday.getTime() ? `The Moon enters ${signName(entersSign.sign)} at ${entersSign.atLocal} and stays there for the rest of the day.`
        : `The Moon is in ${signName(moonSign)} until ${entersSign.atLocal}, then enters ${signName(entersSign.sign)}.`,
    house ? house.line : '',
  ].filter(Boolean).join(' ');

  const top = contacts.find(({ group }) => group === 'today') ?? contacts[0];
  const label = dayLabel(midday, zone);
  const isToday = (input.today ?? dateOn(input.now, zone)) === date;
  const lead = top?.group === 'background' ? 'In the background,'
    : isToday ? "Today's strongest contact is" : `The strongest contact on ${label} is`;
  const theme = top
    ? `${lead} ${top.title}, ${top.exactLocal ? `exact at ${top.exactLocal}` : natal.timeKnown ? `${top.orb.toFixed(2)} degrees from exact and ${top.applying ? 'applying' : 'separating'}` : `about ${top.orb.toFixed(1)} degrees from exact`} (${top.confidenceLabel}).`
    : `No major contact to your chart is within orb ${isToday ? 'today' : 'that day'}, so the Moon in ${signName(moonSign)} sets the tone.`;

  const limits: string[] = natal.clockLimit ? [natal.clockLimit] : [];
  if (input.note) limits.push(input.note);
  if (under18) limits.push(MINOR_NOTE);
  if (!natal.timeKnown) limits.push(UNTIMED_LIMIT);
  else if (!natal.placed) limits.push('No birthplace coordinates were given, so the rising degree, the Midheaven and the Moon\'s house are left out.');
  else if (atPole) limits.push('At a geographic pole the rising degree is undefined. This reading leaves out the rising degree, the Midheaven and the Moon’s house.');
  if (found.length > contacts.length) limits.push(`Of ${found.length} contacts, ${contacts.length} are listed by score, with up to ${BACKGROUND_LIMIT} in the background.`);

  return { date, dayLabel: label, zone, middayUtc: midday.toISOString(), points, theme, moon: { sign: moonSign, entersSign, house, line: moonLine }, contacts, found: found.length, under18, limits };
}

function formatExactLocal(passEntries: readonly { at: string; local: string }[]): string | null {
  if (passEntries.length === 0) return null;
  if (passEntries.length === 1) return passEntries[0].local;
  const groups: { local: string; count: number }[] = [];
  for (const entry of passEntries) {
    const prev = groups[groups.length - 1];
    if (prev && prev.local === entry.local) prev.count += 1;
    else groups.push({ local: entry.local, count: 1 });
  }
  return groups
    .map(({ local, count }) => (count === 1 ? local : `${local} (${count === 2 ? 'twice' : `${count} passes`} within the same second)`))
    .join(' and ');
}

/**
 * The person's settled Sun sign for sharing: exact when a birth time is known,
 * or settled without a birth time only when both ends of the birth day share
 * the same Sun sign (else null). With a zone the day runs from where the
 * clock first reaches its 00:00 to where it last leaves the date
 * (src/lib/time/local-day.ts), so a date the clock showed twice (Apia, 4 July
 * 1892) is read whole and one it left early (St. John's, 2 May 1920, when
 * 23:00 became 00:00) ends there; a date it never showed settles nothing.
 */
export async function settledSunSign(
  natal: Pick<DayNatal, 'bodies' | 'timeKnown'>,
  birth: { birthDate: string; zone?: string | undefined; longitude?: number | undefined },
  clock: DayClock,
): Promise<ShareSign | null> {
  const sun = natal.bodies.find((row) => row.body === 'Sun');
  if (!sun) return null;
  const sunIndex = signIndexForLongitude(sun.lon);
  if (natal.timeKnown) return SIGNS[sunIndex].slug as ShareSign;
  let start: Date;
  let end: Date;
  if (birth.zone) {
    await clock.prepareLocalTime(birth.birthDate, birth.zone);
    const options = birth.longitude === undefined ? {} : { longitude: birth.longitude };
    const zone = birth.zone;
    // The span also reads the day after, which the birth date's preparation covers (src/lib/time/local-day.ts).
    const span = localDaySpan(birth.birthDate, (date, time, fold) => clock.resolveLocalToUtc(date, time, zone, { ...options, fold }));
    if (!span) return null;
    [start, end] = span;
  } else {
    // Every clock's version of the date since 1800: tzdb's history runs from UTC-15:56 (Asia/Manila before 1845)
    // to UTC+15:13 (America/Metlakatla before 1867), so 00:00 at UTC+16 to the last millisecond at UTC-16.
    start = new Date(Date.parse(`${birth.birthDate}T00:00:00Z`) - WIDEST_OFFSET_HOURS * HOUR);
    end = new Date(Date.parse(`${birth.birthDate}T23:59:59.999Z`) + WIDEST_OFFSET_HOURS * HOUR);
  }
  const startIndex = signIndexForLongitude(bodyLongitude('Sun', start));
  const endIndex = signIndexForLongitude(bodyLongitude('Sun', end));
  return startIndex === endIndex ? (SIGNS[startIndex].slug as ShareSign) : null;
}
