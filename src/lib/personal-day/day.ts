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
 * when it is within the moving body's orb of a major aspect at midday, or
 * when it is exact at some moment of the local day; the exact moment comes
 * from the transit scanner the /transits/ page and the profile use
 * (src/lib/engine/transit-scan.ts). The ranking is ./score.ts.
 *
 * The words are transitLine's (src/lib/transits.ts) and NATAL_HOUSE_THEME's
 * (src/lib/natal.ts); nothing is generated. Pure: no network, storage or
 * logging, and no birth detail goes into a link.
 */
import { bodyLongitude, computeBodies, computeChart } from '../engine/full.js';
import { findLongitudeCrossings } from '../engine/returns';
import { scanTransitContacts } from '../engine/transit-scan';
import { MAJOR_ASPECT_ORDER, TRANSIT_BODY_ORDER, type NatalPoint, type TransitBody } from '../engine/transit-scan-shared';
import type { AspectType } from '../engine/types';
import { wholeSignHouseFromAsc } from '../daily';
import { NATAL_HOUSE_THEME } from '../natal';
import { SIGNS, signIndexForLongitude } from '../signs';
import { transitLine } from '../transits';
import { MINOR_NOTE, isUnder18, softenMinor } from '../../ai-tools/features/reading-guards';
import { readingConfidence, readingConfidenceLabel, readingDetail, type ReadingDetail } from '../../ai-tools/reading-confidence';
import { clockTime, dayLabel, nextDate } from './clock';
import { PERSONAL_DAY_LIMIT, dayScore, maxOrb, orbOf, pointName } from './score';

const HOUR = 3_600_000;
const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'] as const;

/** The two calls of the site's local-time resolver the day needs (src/lib/time/localToUtc.ts, or the compute API's copy). */
export interface DayClock {
  prepareLocalTime: (date: string, timeZone: string) => Promise<void>;
  resolveLocalToUtc: (date: string, time: string, timeZone: string, options?: { longitude?: number }) => { utc: Date };
}

/** The birth chart as the day reads it: the natal bodies, the angles with a time and place, and how specific it is. */
export interface DayNatal {
  bodies: readonly { body: string; lon: number }[];
  angles: { asc: number; mc: number } | null;
  timeKnown: boolean;
  placed: boolean;
  detail: ReadingDetail;
}

export interface DayContact {
  rank: number;
  planet: TransitBody;
  aspect: AspectType;
  point: NatalPoint;
  /** Degrees from exact at midday, to two decimals. */
  orb: number;
  applying: boolean;
  /** The exact moment, when it falls inside the local day. */
  exactAt: string | null;
  /** The same moment on the person's clock, HH:MM. */
  exactLocal: string | null;
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
 */
export function castDayNatal(input: { birthDate: string; time?: string | undefined; zone: string; latitude?: number | undefined; longitude?: number | undefined }, clock: DayClock): DayNatal {
  const round = (value: number) => Math.round(value * 100) / 100;
  const latitude = input.latitude === undefined ? undefined : round(input.latitude);
  const longitude = input.longitude === undefined ? undefined : round(input.longitude);
  const timeKnown = input.time !== undefined;
  const placed = latitude !== undefined && longitude !== undefined;
  const time = input.time ?? '12:00';
  const utc = (longitude !== undefined ? clock.resolveLocalToUtc(input.birthDate, time, input.zone, { longitude }) : clock.resolveLocalToUtc(input.birthDate, time, input.zone)).utc;
  const chart = computeChart({ utc, ...(placed ? { latitude, longitude } : {}), houseSystem: 'whole', timeKnown });
  const angles = timeKnown && placed && chart.angles ? { asc: chart.angles.asc, mc: chart.angles.mc } : null;
  return { bodies: chart.bodies, angles, timeKnown, placed, detail: readingDetail({ hasDate: true, hasTime: timeKnown, hasPlace: placed }) };
}

async function startOf(date: string, zone: string, clock: DayClock): Promise<Date> {
  await clock.prepareLocalTime(date, zone);
  return clock.resolveLocalToUtc(date, '00:00', zone).utc;
}

/**
 * One day's transits to one birth chart. `date` is the day on `zone`'s clock;
 * `today` is today's date on that clock, so the theme says "today" only for
 * today; `note` is a sentence about which clock was used, listed first in the
 * limits.
 */
export async function readPersonalDay(natal: DayNatal, input: { birthDate: string; date: string; zone: string; today?: string | undefined; note?: string | null | undefined }, clock: DayClock): Promise<PersonalDayReading> {
  const { date, zone } = input;
  // The local day: its two midnights on the person's clock, and the moment halfway between them.
  const dayStart = await startOf(date, zone, clock);
  const dayEnd = await startOf(nextDate(date), zone, clock);
  const midday = new Date((dayStart.getTime() + dayEnd.getTime()) / 2);
  const later = new Date(midday.getTime() + HOUR);

  const points: NatalPoint[] = [...TRANSIT_BODY_ORDER.filter((body) => natal.timeKnown || body !== 'Moon'), ...(natal.angles ? ['ASC', 'MC'] as const : [])];
  const natalBodies = natal.bodies.filter((row) => (TRANSIT_BODY_ORDER as readonly string[]).includes(row.body)).map(({ body, lon }) => ({ body: body as TransitBody, lon }));
  const natalLon = new Map<NatalPoint, number>(natalBodies.map((row) => [row.body, row.lon]));
  if (natal.angles) { natalLon.set('ASC', natal.angles.asc); natalLon.set('MC', natal.angles.mc); }
  const sky = new Map(computeBodies(midday).map((row) => [row.body, row.lon]));

  // Exact moments inside the local day, from the transit scanner.
  const exact = new Map<string, Date>();
  for (const contact of scanTransitContacts({ bodies: natalBodies, angles: natal.angles }, dayStart, new Date(dayEnd.getTime() - 1), { transitBodies: TRANSIT_BODY_ORDER, includeMoon: true, natalPoints: points })) {
    const key = `${contact.transitBody}|${contact.natalPoint}|${contact.aspect}`;
    const at = new Date(contact.exactUtc);
    const held = exact.get(key);
    // Two passes in one day cannot happen for these bodies, but keep the one nearest midday if it ever did.
    if (!held || Math.abs(at.getTime() - midday.getTime()) < Math.abs(held.getTime() - midday.getTime())) exact.set(key, at);
  }

  const under18 = isUnder18(input.birthDate, date);
  const guard = (text: string) => (under18 ? softenMinor(text) : text);
  const found: Omit<DayContact, 'rank'>[] = [];
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
  let entersSign: PersonalDayReading['moon']['entersSign'] = null;
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
  const label = dayLabel(midday, zone);
  const isToday = input.today === undefined || input.today === date;
  const theme = top
    ? `${isToday ? "Today's strongest contact" : `The strongest contact on ${label}`} is ${top.title}, ${top.exactLocal ? `exact at ${top.exactLocal}` : `${top.orb.toFixed(2)} degrees from exact and ${top.applying ? 'applying' : 'separating'}`} (${top.confidenceLabel}).`
    : `No major contact to your chart is within orb ${isToday ? 'today' : 'that day'}, so the Moon in ${signName(moonSign)} sets the tone.`;

  const limits: string[] = [];
  if (input.note) limits.push(input.note);
  if (under18) limits.push(MINOR_NOTE);
  if (!natal.timeKnown) limits.push('No birth time was given, so the natal Moon, the rising degree and the Midheaven are left out, and the chart is cast for midday of the birth date; contacts to the other planets can shift by a few hours.');
  else if (!natal.placed) limits.push('No birthplace coordinates were given, so the rising degree, the Midheaven and the Moon\'s house are left out.');
  if (found.length > PERSONAL_DAY_LIMIT) limits.push(`${found.length} contacts were within orb; the ${PERSONAL_DAY_LIMIT} with the highest scores are listed.`);

  return { date, dayLabel: label, zone, middayUtc: midday.toISOString(), points, theme, moon: { sign: moonSign, entersSign, house, line: moonLine }, contacts, found: found.length, under18, limits };
}
