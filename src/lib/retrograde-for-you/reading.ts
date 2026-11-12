/**
 * Retrogrades in one person's chart: the pure parts shared by the
 * /retrogrades/for-you/ page (which computes on the device from the committed
 * sky data, src/data/sky.json) and the get_retrograde_for_me tool (which finds
 * the stations with the engine's station search, server-side).
 *
 * Given a planet's loop (its retrograde and direct stations with their
 * longitudes, and the shadow on either side), the instant "now" and the clock
 * the dates are read on, this works out the status, the signs the loop
 * covers, the whole-sign house each sign falls in, the natal points inside
 * the loop's degrees and the pre-written reading. Nothing here is generated,
 * stored, logged or sent anywhere.
 *
 * Houses are whole-sign, counted from the rising sign with a birth time and
 * place, as the site counts them; otherwise from the Sun sign, labelled so.
 */
import { wholeSignHouseFromAsc } from '../daily';
import { NATAL_HOUSE_THEME } from '../natal';
import { SIGNS, signBySlug, signIndexForLongitude } from '../signs';
import { MINOR_NOTE, isUnder13, isUnder18, softenMinor } from '../../ai-tools/features/reading-guards';
import { readingConfidence, readingConfidenceLabel, readingDetail, type ReadingDetail } from '../../ai-tools/reading-confidence';

export { isUnder13, MINOR_NOTE };

export const RETROGRADE_PLANETS = ['Mercury', 'Venus', 'Mars'] as const;
export type RetrogradePlanet = typeof RETROGRADE_PLANETS[number];

/** Each planet wears the hue of the sign it rules, as the site's other planet drawings do. */
export const RETROGRADE_HUE_SIGN: Readonly<Record<RetrogradePlanet, string>> = { Mercury: 'gemini', Venus: 'taurus', Mars: 'aries' };

/** What each planet's retrograde is traditionally read as, in general. */
export const RETROGRADE_LINE: Readonly<Record<RetrogradePlanet, string>> = {
  Mercury: 'Mercury retrograde is traditionally a time to review, revise and reconnect rather than launch: check the details, back up what matters, reread contracts before signing them, and leave room for delays in travel and messages.',
  Venus: 'Venus retrograde traditionally asks you to revisit what you value: relationships, money and what you find beautiful. It is read as a good window to review finances and old ties, and a poor one for big purchases or a sudden change of look.',
  Mars: 'Mars retrograde traditionally slows drive and ambition: plans stall, tempers run shorter and old disputes come back. It asks you to rework a strategy rather than force it, and to take rest seriously when energy dips.',
};

/** What each planet's retrograde traditionally asks for in the area of life a house covers. */
export const RETROGRADE_ASK: Readonly<Record<RetrogradePlanet, string>> = {
  Mercury: 'review plans, recheck the paperwork and reopen conversations that were left unfinished',
  Venus: 'look again at what you value there and what you spend on it, and to mend rather than replace',
  Mars: 'rework plans rather than push them, and to pace your effort',
};

/** Why a natal point inside the loop matters, said once per point. */
export const CONTACT_LINE = 'traditionally the most felt part of a retrograde, since the planet crosses that degree three times (before the turn, while retrograde and again after it)';

export const POINT_NAMES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;

export const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'] as const;

export type HouseBasis = 'rising sign' | 'Sun sign';
export type RetrogradeStatus = 'retrograde' | 'pre-shadow' | 'post-shadow' | 'direct';

export interface RetrogradeLoop {
  planet: RetrogradePlanet;
  stationRetrograde: { at: Date; lon: number };
  stationDirect: { at: Date; lon: number };
  preShadowStart: Date | null;
  postShadowEnd: Date | null;
}

/** The loop a planet is in at "now", or else its next one, and the one before (for a post-shadow still running). */
export interface LoopSet { current: RetrogradeLoop; previous: RetrogradeLoop | null; retrogradeNow: boolean }

export interface Instant { utc: string; date: string; label: string }
export interface Station extends Instant { sign: string; degree: number; position: string }

export interface RetrogradePeriod {
  planet: RetrogradePlanet;
  retrogradeNow: boolean;
  status: RetrogradeStatus;
  stationRetrograde: Station;
  stationDirect: Station;
  preShadowStart: Instant | null;
  postShadowEnd: Instant | null;
  signs: string[];
  housesCountedFrom: HouseBasis | null;
  houses: { house: number; sign: string; theme: string; line: string }[];
  contacts: { point: string; sign: string; position: string; line: string }[];
  reading: string;
  confidence: number;
  confidenceLabel: string;
}

/** What the reading takes from the birth chart. */
export interface NatalBasis {
  countedFrom: HouseBasis | null;
  baseSign: string | null;
  points: { name: string; lon: number }[];
  detail: ReadingDetail;
  minor: boolean;
  /** Plain sentences on what the details could not settle, in the order the answer gives them. */
  limits: string[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const minute = (at: Date) => new Date(Math.round(at.getTime() / 60_000) * 60_000);
const norm = (value: number) => ((value % 360) + 360) % 360;

/** The calendar date of an instant on a zone's clock, as YYYY-MM-DD. */
export function dateOn(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** "Tue 3 Nov 2026" on a zone's clock. */
export function dayLabel(at: Date | string, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(new Date(at)).map((part) => [part.type, part.value]));
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
}

/** Such as "20°56' Scorpio", rounded down to the minute of arc, as the sign pages print it. */
export function formatPosition(lon: number): string {
  const index = signIndexForLongitude(lon);
  const minutes = Math.floor((norm(lon) - index * 30) * 60);
  return `${Math.floor(minutes / 60)}°${String(minutes % 60).padStart(2, '0')}' ${SIGNS[index].name}`;
}

export function instantOn(at: Date, timeZone: string): Instant {
  const rounded = minute(at);
  return { utc: rounded.toISOString(), date: dateOn(rounded, timeZone), label: dayLabel(rounded, timeZone) };
}

function stationOn(at: Date, lon: number, timeZone: string): Station {
  const index = signIndexForLongitude(lon);
  return { ...instantOn(at, timeZone), sign: SIGNS[index].slug, degree: Math.min(29.99, round2(norm(lon) - index * 30)), position: formatPosition(lon) };
}

/** The signs a loop covers, in zodiac order from the direct station to the retrograde station. */
export function loopSigns(loop: RetrogradeLoop): number[] {
  const first = signIndexForLongitude(loop.stationDirect.lon);
  const last = signIndexForLongitude(loop.stationRetrograde.lon);
  const out = [first];
  for (let index = first; index !== last;) {
    index = (index + 1) % 12;
    out.push(index);
  }
  return out;
}

/** True when `lon` lies on the loop's degrees, from the direct station forward to the retrograde station. */
export function inLoop(loop: RetrogradeLoop, lon: number): boolean {
  return norm(lon - loop.stationDirect.lon) <= norm(loop.stationRetrograde.lon - loop.stationDirect.lon);
}

/**
 * The house basis and the natal points, from a chart cast with whole-sign
 * houses. `sunHeld` says whether the Sun's sign is the same at both ends of an
 * untimed birth day (always true with a birth time). `today` is the date on
 * the person's clock, for the under-18 rule.
 */
export function natalBasis(input: {
  timeKnown: boolean;
  placed: boolean;
  angles: { asc: number; mc: number } | null;
  bodies: readonly { body: string; lon: number }[];
  sunHeld: boolean;
  birthDate: string;
  today: string;
}): NatalBasis {
  const lonOf = (name: string) => input.bodies.find((row) => row.body === name)!.lon;
  const limits: string[] = [];
  let countedFrom: HouseBasis | null = null;
  let baseSign: string | null = null;
  if (input.angles) {
    countedFrom = 'rising sign';
    baseSign = SIGNS[signIndexForLongitude(input.angles.asc)].slug;
  } else if (input.sunHeld) {
    countedFrom = 'Sun sign';
    baseSign = SIGNS[signIndexForLongitude(lonOf('Sun'))].slug;
    limits.push(input.timeKnown
      ? 'No birthplace coordinates were given, so there is no rising sign: the houses are counted from your Sun sign, a rougher guide than your own houses.'
      : 'No birth time was given, so there is no rising sign: the houses are counted from your Sun sign, a rougher guide than your own houses.');
  } else limits.push('No birth time was given and the Sun changed sign on the birth day, so there are no houses. A birth time settles it.');

  // The Moon only with a birth time (it moves about 13 degrees a day), the angles only with a place too.
  const points = POINT_NAMES.filter((name) => name !== 'Moon' || input.timeKnown).map((name) => ({ name: name as string, lon: lonOf(name) }));
  if (input.angles) points.push({ name: 'Ascendant', lon: input.angles.asc }, { name: 'Midheaven', lon: input.angles.mc });
  if (!input.timeKnown) limits.push('Without a birth time the natal Moon is left out of the points each loop passes over.');

  return {
    countedFrom, baseSign, points,
    detail: readingDetail({ hasDate: true, hasTime: input.timeKnown, hasPlace: input.placed }),
    minor: isUnder18(input.birthDate, input.today),
    limits,
  };
}

/** One planet's period: status, stations, shadows, houses, natal points and the reading, on the given clock. */
export function retrogradePeriod(planet: RetrogradePlanet, loops: LoopSet, now: Date, zone: string, basis: NatalBasis): { period: RetrogradePeriod; opening: string } {
  const soften = (text: string) => (basis.minor ? softenMinor(text) : text);
  const { current: loop, previous, retrogradeNow } = loops;
  const confidence = readingConfidence(basis.detail);
  const confidenceLabel = readingConfidenceLabel(basis.detail);
  const retro = stationOn(loop.stationRetrograde.at, loop.stationRetrograde.lon, zone);
  const direct = stationOn(loop.stationDirect.at, loop.stationDirect.lon, zone);
  const preShadowStart = loop.preShadowStart ? instantOn(loop.preShadowStart, zone) : null;
  const postShadowEnd = loop.postShadowEnd ? instantOn(loop.postShadowEnd, zone) : null;
  const status: RetrogradeStatus = retrogradeNow ? 'retrograde'
    : previous?.postShadowEnd && previous.postShadowEnd.getTime() > now.getTime() ? 'post-shadow'
      : loop.preShadowStart && loop.preShadowStart.getTime() <= now.getTime() ? 'pre-shadow'
        : 'direct';
  const signs = loopSigns(loop).map((index) => SIGNS[index].slug);
  const houses = basis.baseSign ? signs.map((sign) => {
    const house = wholeSignHouseFromAsc(sign, basis.baseSign!);
    const theme = NATAL_HOUSE_THEME[house];
    const where = basis.countedFrom === 'rising sign' ? `your ${ORDINAL[house]} house` : `the ${ORDINAL[house]} house counted from your Sun sign`;
    return { house, sign, theme: soften(theme), line: soften(`In ${signBySlug(sign).name} it falls in ${where}, which covers ${theme}. There it traditionally asks you to ${RETROGRADE_ASK[planet]}.`) };
  }) : [];
  const contacts = basis.points.filter((point) => inLoop(loop, point.lon)).map((point) => ({
    point: point.name, sign: SIGNS[signIndexForLongitude(point.lon)].slug, position: formatPosition(point.lon),
    line: `The loop passes over your natal ${point.name} at ${formatPosition(point.lon)}: ${CONTACT_LINE}.`,
  }));
  const opening = retrogradeNow
    ? `${planet} is retrograde now. It turned retrograde on ${retro.label} at ${retro.position} and turns direct on ${direct.label} at ${direct.position}.`
    : `${planet} is not retrograde now. It next turns retrograde on ${retro.label} at ${retro.position} and turns direct on ${direct.label} at ${direct.position}.`;
  const shadowLine = status === 'post-shadow'
    ? ` It turned direct on ${instantOn(previous!.stationDirect.at, zone).label} and is in the post-shadow of that loop until ${instantOn(previous!.postShadowEnd!, zone).label}, going back over the degrees it covered while retrograde.`
    : status === 'pre-shadow' && preShadowStart
      ? ` It is already in the pre-shadow, which began on ${preShadowStart.label}, crossing the degrees the retrograde will revisit.`
      : preShadowStart && !retrogradeNow ? ` Its pre-shadow begins on ${preShadowStart.label}.` : '';
  const after = postShadowEnd ? ` The post-shadow runs until ${postShadowEnd.label}, when it is back at the degree where it turned retrograde.` : '';
  const reading = soften([
    `${opening}${shadowLine}${after}`,
    RETROGRADE_LINE[planet],
    ...houses.map((entry) => entry.line),
    ...contacts.map((entry) => entry.line),
    `${confidenceLabel}.`,
  ].join(' '));
  return {
    period: {
      planet, retrogradeNow, status, stationRetrograde: retro, stationDirect: direct, preShadowStart, postShadowEnd, signs,
      housesCountedFrom: basis.countedFrom, houses, contacts, reading, confidence, confidenceLabel,
    },
    opening: soften(opening),
  };
}

/**
 * Every asked-for planet's period, the one-paragraph summary and the limits.
 * `loopsFor` returns null when its data does not reach that planet's next
 * loop (the page's committed sky data ends); that planet is listed in
 * `unavailable` and left out of the summary rather than guessed.
 */
export function retrogradeReading(input: {
  planets: readonly RetrogradePlanet[];
  loopsFor: (planet: RetrogradePlanet) => LoopSet | null;
  now: Date;
  zone: string;
  basis: NatalBasis;
  /** Sentences that come before the chart's own limits, such as which clock "today" is read on. */
  leadingLimits?: readonly string[];
}): { periods: RetrogradePeriod[]; unavailable: RetrogradePlanet[]; summary: string; limits: string[] } {
  const periods: RetrogradePeriod[] = [];
  const unavailable: RetrogradePlanet[] = [];
  const openings: string[] = [];
  for (const planet of RETROGRADE_PLANETS.filter((entry) => input.planets.includes(entry))) {
    const loops = input.loopsFor(planet);
    if (!loops) { unavailable.push(planet); continue; }
    const { period, opening } = retrogradePeriod(planet, loops, input.now, input.zone, input.basis);
    periods.push(period);
    openings.push(opening);
  }
  const limits = [...(input.leadingLimits ?? []), ...input.basis.limits];
  if (input.basis.minor) limits.push(MINOR_NOTE);
  const summary = `${openings.join(' ')} ${readingConfidenceLabel(input.basis.detail)}.`;
  return { periods, unavailable, summary, limits };
}

/** The house the loop begins in (the retrograde station's sign), for a share link and its card. */
export function stationHouse(period: Pick<RetrogradePeriod, 'houses' | 'stationRetrograde'>): number | null {
  return period.houses.find((entry) => entry.sign === period.stationRetrograde.sign)?.house ?? null;
}
